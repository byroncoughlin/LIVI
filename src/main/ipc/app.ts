import { registerIpcHandle, registerIpcOn } from '@main/ipc/register'
import { readSystemStats } from '@main/services/systemStats'
import { compositorRestart } from '@main/services/video/GstVideo'
import { runtimeStateProps, ServicesProps } from '@main/types'
import { isMacPlatform } from '@main/utils'
import { broadcastToRenderers } from '@main/window/broadcast'
import { getMainWindow } from '@main/window/createWindow'
import { restoreKioskAfterWmExit } from '@main/window/utils'
import { spawn } from 'child_process'
import { app, shell } from 'electron'
import { readdirSync, readFileSync } from 'node:fs'

function collectDescendantPids(rootPid: number): number[] {
  if (process.platform !== 'linux') return []

  const childrenByParent = new Map<number, number[]>()
  try {
    for (const entry of readdirSync('/proc')) {
      if (!/^\d+$/.test(entry)) continue
      const pid = Number(entry)
      if (!Number.isFinite(pid) || pid <= 1) continue

      try {
        const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
        const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
        const ppid = Number(rest[1])
        if (!Number.isFinite(ppid) || ppid <= 1) continue

        const children = childrenByParent.get(ppid)
        if (children) children.push(pid)
        else childrenByParent.set(ppid, [pid])
      } catch {
        // Process exited while scanning.
      }
    }
  } catch {
    return []
  }

  const descendants: number[] = []
  const stack = [...(childrenByParent.get(rootPid) ?? [])]
  while (stack.length) {
    const pid = stack.pop()!
    descendants.push(pid)
    stack.push(...(childrenByParent.get(pid) ?? []))
  }
  return descendants
}

function scheduleCurrentAppChildCleanup(): void {
  const pids = collectDescendantPids(process.pid)
  if (!pids.length) return

  try {
    const pidArgs = pids.join(' ')
    spawn(
      '/bin/sh',
      [
        '-c',
        `sleep 0.25; kill -TERM ${pidArgs} 2>/dev/null || true; sleep 0.75; kill -KILL ${pidArgs} 2>/dev/null || true`
      ],
      { detached: true, stdio: 'ignore' }
    ).unref()
  } catch {
    // The restart itself must not depend on cleanup.
  }
}

export function registerAppIpc(runtimeState: runtimeStateProps, services: ServicesProps) {
  const mainWindow = getMainWindow()
  const { usbService } = services
  const isMac = isMacPlatform()

  registerIpcHandle('quit', () =>
    isMac
      ? mainWindow?.isFullScreen()
        ? (() => {
            runtimeState.suppressNextFsSync = true
            mainWindow!.once('leave-full-screen', () => mainWindow?.hide())
            mainWindow!.setFullScreen(false)
          })()
        : mainWindow?.hide()
      : app.quit()
  )

  // App Quit
  registerIpcHandle('app:quitApp', () => {
    if (runtimeState.isQuitting) return
    app.quit()
  })

  registerIpcHandle('app:rebootSystem', () => {
    if (runtimeState.isQuitting) return { ok: false, error: 'App is already quitting' }

    try {
      usbService?.beginShutdown()
    } catch {}

    if (process.platform !== 'linux') {
      return { ok: false, error: 'System reboot is only supported on Linux' }
    }

    try {
      const child = spawn('sudo', ['reboot'], { detached: true, stdio: 'ignore' })
      child.unref()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // App Restart
  let restartInProgress = false
  registerIpcHandle('app:restartApp', async () => {
    if (restartInProgress) return
    if (runtimeState.isQuitting) return
    restartInProgress = true

    try {
      usbService?.beginShutdown()
    } catch {}

    try {
      const disconnectPromise = runtimeState.telemetrySocket?.disconnect?.()
      if (disconnectPromise) void Promise.resolve(disconnectPromise).catch(() => {})
    } catch {
      // best-effort
    }

    // In the compositor: tell it to re-exec (full_restart), then quit ourselves cleanly so our
    // surfaces disconnect while the compositor loop is still alive
    if (compositorRestart()) {
      scheduleCurrentAppChildCleanup()
      await new Promise((r) => setTimeout(r, 100))
      runtimeState.isQuitting = true
      app.quit()
      return
    }

    if (process.platform === 'linux' && process.env.APPIMAGE) {
      const appImage = process.env.APPIMAGE

      const cleanEnv = { ...process.env }
      delete cleanEnv.APPIMAGE
      delete cleanEnv.APPDIR
      delete cleanEnv.ARGV0
      delete cleanEnv.OWD

      spawn(appImage, [], { detached: true, stdio: 'ignore', env: cleanEnv }).unref()
    } else {
      app.relaunch()
    }

    runtimeState.isQuitting = true
    app.quit()
  })

  // User activity (touch/click)
  registerIpcOn('app:user-activity', () => {
    restoreKioskAfterWmExit(runtimeState)
  })

  // Fan-out a media key event to all renderer windows
  registerIpcOn('app:media-key', (_evt, command: string) => {
    if (typeof command !== 'string' || !command) return
    broadcastToRenderers('app:media-key', command)
  })

  registerIpcHandle('app:openExternal', async (_evt, rawUrl: string) => {
    const url = String(rawUrl ?? '').trim()
    if (!url) return { ok: false, error: 'Empty URL' }
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Only http/https URLs are allowed' }

    await shell.openExternal(url)
    return { ok: true }
  })

  registerIpcHandle('app:systemStats', async () => {
    try {
      return await readSystemStats()
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
}

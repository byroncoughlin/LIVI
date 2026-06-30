import { readFileSync, statfsSync } from 'node:fs'

export type SystemStats = {
  cpu?: number
  cores?: number[]
  memUsedMb?: number | null
  memTotalMb?: number | null
  memPct?: number | null
  diskFreeMb?: number | null
  diskTotalMb?: number | null
  diskPct?: number | null
  swapUsedMb?: number | null
  tempC?: number | null
  load?: number[] | null
  uptime?: number | null
  error?: string
}

type CpuSnapshot = Record<string, number[]>
type ReadText = (path: string) => string
type StatFsResult = { bsize: number; blocks: number; bavail: number }
type StatFs = (path: string) => StatFsResult
type Sleep = (ms: number) => Promise<void>

const defaultReadText: ReadText = (path) => readFileSync(path, 'utf8')
const defaultStatFs: StatFs = (path) => statfsSync(path)
const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function parseCpuSnapshot(text: string): CpuSnapshot {
  const out: CpuSnapshot = {}
  for (const line of text.split('\n')) {
    if (!line.startsWith('cpu')) continue
    const parts = line.trim().split(/\s+/)
    out[parts[0]] = parts.slice(1).map(Number)
  }
  return out
}

export function cpuPct(a: number[] | undefined, b: number[] | undefined): number {
  if (!a || !b) return 0
  const idleA = a[3] + (a[4] || 0)
  const idleB = b[3] + (b[4] || 0)
  const totalA = a.reduce((sum, n) => sum + n, 0)
  const totalB = b.reduce((sum, n) => sum + n, 0)
  const totalDelta = totalB - totalA
  const idleDelta = idleB - idleA

  if (totalDelta <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)))
}

function parseMemKb(meminfo: string, key: string): number | null {
  const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))
  return match ? Number.parseInt(match[1], 10) : null
}

function tryRead<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}
export async function readSystemStats({
  readText = defaultReadText,
  statfs = defaultStatFs,
  sleep = defaultSleep,
  sampleMs = 240
}: {
  readText?: ReadText
  statfs?: StatFs
  sleep?: Sleep
  sampleMs?: number
} = {}): Promise<SystemStats> {
  const start = parseCpuSnapshot(readText('/proc/stat'))
  await sleep(sampleMs)
  const end = parseCpuSnapshot(readText('/proc/stat'))

  const cores: number[] = []
  for (let i = 0; start[`cpu${i}`] && end[`cpu${i}`]; i += 1) {
    cores.push(cpuPct(start[`cpu${i}`], end[`cpu${i}`]))
  }

  const meminfo = readText('/proc/meminfo')
  const memTotal = parseMemKb(meminfo, 'MemTotal')
  const memAvail = parseMemKb(meminfo, 'MemAvailable')
  const swapTotal = parseMemKb(meminfo, 'SwapTotal')
  const swapFree = parseMemKb(meminfo, 'SwapFree')
  const memUsed = memTotal != null && memAvail != null ? memTotal - memAvail : null
  const swapUsed = swapTotal != null && swapFree != null ? swapTotal - swapFree : null

  const tempC = tryRead(
    () => {
      const milliC = Number.parseInt(readText('/sys/class/thermal/thermal_zone0/temp').trim(), 10)
      return Number.isFinite(milliC) ? Math.round((milliC / 1000) * 10) / 10 : null
    },
    null as number | null
  )

  const load = tryRead(
    () => readText('/proc/loadavg').trim().split(/\s+/).slice(0, 3).map(Number),
    null as number[] | null
  )

  const uptime = tryRead(
    () => {
      const seconds = Number.parseFloat(readText('/proc/uptime').split(' ')[0])
      return Number.isFinite(seconds) ? Math.round(seconds) : null
    },
    null as number | null
  )

  const disk = tryRead(
    () => {
      const root = statfs('/')
      const totalBytes = root.blocks * root.bsize
      const freeBytes = root.bavail * root.bsize
      const usedBytes = totalBytes - freeBytes

      if (totalBytes <= 0 || freeBytes < 0 || usedBytes < 0) {
        return { freeMb: null, totalMb: null, pct: null }
      }

      return {
        freeMb: Math.round(freeBytes / 1024 / 1024),
        totalMb: Math.round(totalBytes / 1024 / 1024),
        pct: Math.round((usedBytes / totalBytes) * 100)
      }
    },
    null as { freeMb: number | null; totalMb: number | null; pct: number | null } | null
  )

  return {
    cpu: cpuPct(start.cpu, end.cpu),
    cores,
    memUsedMb: memUsed != null ? Math.round(memUsed / 1024) : null,
    memTotalMb: memTotal != null ? Math.round(memTotal / 1024) : null,
    memPct: memUsed != null && memTotal ? Math.round((memUsed / memTotal) * 100) : null,
    diskFreeMb: disk?.freeMb ?? null,
    diskTotalMb: disk?.totalMb ?? null,
    diskPct: disk?.pct ?? null,
    swapUsedMb: swapUsed != null ? Math.round(swapUsed / 1024) : null,
    tempC,
    load,
    uptime
  }
}

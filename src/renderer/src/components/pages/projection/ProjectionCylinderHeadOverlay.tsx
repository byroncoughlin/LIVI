import type { TelemetryPayload } from '@shared/types'
import * as React from 'react'

type ChtState = {
  left: number | null
  right: number | null
}

function finiteOrNull(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function tempColor(value: number | null): string {
  if (value == null) return 'rgba(255,255,255,0.34)'
  if (value < 80) return '#69c7ff'
  if (value < 160) return '#7bdc7b'
  if (value < 220) return '#ffd65a'
  return '#ff705d'
}

function readCht(payload: unknown): Partial<ChtState> | null {
  if (!payload || typeof payload !== 'object') return null
  const msg = payload as TelemetryPayload
  const left = finiteOrNull(msg.chtLeftC)
  const right = finiteOrNull(msg.chtRightC)
  if (left === undefined && right === undefined) return null
  return {
    ...(left === undefined ? {} : { left }),
    ...(right === undefined ? {} : { right })
  }
}

function valuesChanged(prev: ChtState, patch: Partial<ChtState>): boolean {
  return (
    (patch.left !== undefined && patch.left !== prev.left) ||
    (patch.right !== undefined && patch.right !== prev.right)
  )
}

function useCylinderHeadTelemetry(): ChtState {
  const [temps, setTemps] = React.useState<ChtState>({ left: null, right: null })

  React.useEffect(() => {
    let disposed = false

    const apply = (payload: unknown) => {
      const patch = readCht(payload)
      if (!patch || disposed) return
      setTemps((prev) => {
        if (!valuesChanged(prev, patch)) return prev
        return { ...prev, ...patch }
      })
    }

    const snapPromise = window.projection?.ipc?.getTelemetrySnapshot?.()
    if (snapPromise) {
      void snapPromise.then((snap) => {
        if (!disposed) apply(snap)
      })
    }

    window.projection?.ipc?.onTelemetry?.(apply)
    return () => {
      disposed = true
      window.projection?.ipc?.offTelemetry?.(apply)
    }
  }, [])

  return temps
}

function ChtBadge({ side, value }: { side: 'L' | 'R'; value: number | null }) {
  const display = value == null ? '--' : String(Math.round(value))

  return (
    <div
      aria-label={`${side} cylinder head temperature`}
      style={{
        width: 76,
        minHeight: 72,
        display: 'grid',
        justifyItems: 'center',
        alignContent: 'center',
        gap: 2,
        color: tempColor(value),
        fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
        textShadow: '0 1px 2px rgba(0,0,0,0.82)'
      }}
    >
      <div
        style={{
          fontSize: 11,
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: 0,
          color: 'rgba(255,255,255,0.62)'
        }}
      >
        {side} CHT
      </div>
      <div
        style={{
          fontSize: 30,
          lineHeight: 1,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {display}
      </div>
      <div
        style={{
          fontSize: 10,
          lineHeight: 1,
          fontWeight: 600,
          color: value == null ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.62)'
        }}
      >
        deg C
      </div>
    </div>
  )
}

export function ProjectionCylinderHeadOverlay() {
  const { left, right } = useCylinderHeadTelemetry()

  return (
    <div
      data-testid="projection-cylinder-head-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 8,
        pointerEvents: 'none'
      }}
    >
      <div style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }}>
        <ChtBadge side="L" value={left} />
      </div>
      <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)' }}>
        <ChtBadge side="R" value={right} />
      </div>
    </div>
  )
}

import type { TelemetryPayload } from '@shared/types'
import * as React from 'react'

type SensorState = {
  chtLeft: number | null
  chtRight: number | null
  gpsFix: boolean | null
  speedMph: number | null
}

function finiteOrNull(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function tempColor(value: number | null): string {
  if (value == null) return 'rgba(255,255,255,0.34)'
  if (value < 80) return '#69c7ff'
  if (value < 160) return '#7bdc7b'
  if (value < 220) return '#ffd65a'
  return '#ff705d'
}

function readSensors(payload: unknown): Partial<SensorState> | null {
  if (!payload || typeof payload !== 'object') return null
  const msg = payload as TelemetryPayload
  const chtLeft = finiteOrNull(msg.chtLeftC)
  const chtRight = finiteOrNull(msg.chtRightC)
  const speedKph = finiteNumber(msg.speedKph)
  const gpsFix = typeof msg.gpsFix === 'boolean' ? msg.gpsFix : undefined

  const patch: Partial<SensorState> = {}
  if (chtLeft !== undefined) patch.chtLeft = chtLeft
  if (chtRight !== undefined) patch.chtRight = chtRight
  if (gpsFix !== undefined) patch.gpsFix = gpsFix
  if (speedKph !== undefined) patch.speedMph = Math.max(0, Math.round(speedKph * 0.621371))

  return Object.keys(patch).length > 0 ? patch : null
}

function valuesChanged(prev: SensorState, patch: Partial<SensorState>): boolean {
  return (
    (patch.chtLeft !== undefined && patch.chtLeft !== prev.chtLeft) ||
    (patch.chtRight !== undefined && patch.chtRight !== prev.chtRight) ||
    (patch.gpsFix !== undefined && patch.gpsFix !== prev.gpsFix) ||
    (patch.speedMph !== undefined && patch.speedMph !== prev.speedMph)
  )
}

function useProjectionSensors(): SensorState {
  const [sensors, setSensors] = React.useState<SensorState>({
    chtLeft: null,
    chtRight: null,
    gpsFix: null,
    speedMph: null
  })

  React.useEffect(() => {
    let disposed = false

    const apply = (payload: unknown) => {
      const patch = readSensors(payload)
      if (!patch || disposed) return
      setSensors((prev) => {
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

  return sensors
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

function SpeedBadge({ gpsFix, value }: { gpsFix: boolean | null; value: number | null }) {
  const display = gpsFix === false || value == null ? '--' : String(value)

  return (
    <div
      aria-label="GPS speed"
      style={{
        width: 154,
        minHeight: 86,
        display: 'grid',
        justifyItems: 'center',
        alignContent: 'center',
        gap: 0,
        color: gpsFix === false ? 'rgba(255,255,255,0.4)' : '#ffffff',
        fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
        textShadow: '0 1px 2px rgba(0,0,0,0.86)'
      }}
    >
      <div
        style={{
          fontSize: 10,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: 0,
          color: gpsFix === false ? '#ffb300' : 'rgba(255,255,255,0.62)'
        }}
      >
        {gpsFix === false ? 'ACQUIRING' : 'SPEED'}
      </div>
      <div
        style={{
          fontSize: 54,
          lineHeight: 0.9,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {display}
      </div>
      <div
        style={{
          fontSize: 11,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: 0,
          color: 'rgba(255,255,255,0.62)'
        }}
      >
        mph
      </div>
    </div>
  )
}

export function ProjectionSensorOverlay() {
  const { chtLeft, chtRight, gpsFix, speedMph } = useProjectionSensors()

  return (
    <div
      data-testid="projection-sensor-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 8,
        pointerEvents: 'none'
      }}
    >
      <div style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }}>
        <ChtBadge side="L" value={chtLeft} />
      </div>
      <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)' }}>
        <ChtBadge side="R" value={chtRight} />
      </div>
      <div style={{ position: 'absolute', left: '50%', top: 14, transform: 'translateX(-50%)' }}>
        <SpeedBadge gpsFix={gpsFix} value={speedMph} />
      </div>
    </div>
  )
}

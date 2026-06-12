import { useTheme } from '@mui/material'
import type { CSSProperties } from 'react'

export type ViewAreaInsets = { top: number; bottom: number; left: number; right: number }

const CORNER_RADIUS_PX = 38

// Passepartout between the LIVI UI and the video plane: paints the configured view-area margins
// with the theme background, leaving the view area itself transparent so the video shows through.
// Platform-independent, the video always sits below the React UI (mac NSView, Linux compositor plane).
export function ViewAreaMask({
  insets,
  displayWidth,
  displayHeight,
  visible,
  color,
  cornerMask,
  barsVisible = true
}: {
  insets: ViewAreaInsets
  displayWidth: number
  displayHeight: number
  visible: boolean
  color?: string
  cornerMask?: boolean
  barsVisible?: boolean
}) {
  const theme = useTheme()
  if (
    !visible ||
    typeof displayWidth !== 'number' ||
    typeof displayHeight !== 'number' ||
    !Number.isFinite(displayWidth) ||
    !Number.isFinite(displayHeight) ||
    displayWidth <= 0 ||
    displayHeight <= 0
  ) {
    return null
  }

  const pct = (v: number, total: number): string => `${(Math.max(0, v) / total) * 100}%`
  const maskColor = color ?? theme.palette.background.default
  const bar: CSSProperties = {
    position: 'absolute',
    backgroundColor: maskColor,
    pointerEvents: 'none',
    zIndex: 5
  }
  const centerTop = pct(insets.top, displayHeight)
  const centerBottom = pct(insets.bottom, displayHeight)
  const centerLeft = pct(insets.left, displayWidth)
  const centerRight = pct(insets.right, displayWidth)
  const radius = Math.max(0, Math.min(CORNER_RADIUS_PX, displayWidth / 8, displayHeight / 8))
  const radiusX = pct(radius, displayWidth)
  const radiusY = pct(radius, displayHeight)
  const cornerBase: CSSProperties = {
    position: 'absolute',
    width: radiusX,
    height: radiusY,
    pointerEvents: 'none',
    zIndex: 6
  }
  const roundedStop = '70%'
  const hardStop = '71%'
  const cornerGradient = (at: string): string =>
    `radial-gradient(circle at ${at}, transparent 0 ${roundedStop}, ${maskColor} ${hardStop})`

  return (
    <>
      {barsVisible && (
        <>
          <div
            data-testid="view-area-mask-top"
            style={{ ...bar, top: 0, left: 0, right: 0, height: centerTop }}
          />
          <div
            data-testid="view-area-mask-bottom"
            style={{ ...bar, bottom: 0, left: 0, right: 0, height: centerBottom }}
          />
          <div
            data-testid="view-area-mask-left"
            style={{ ...bar, top: 0, bottom: 0, left: 0, width: centerLeft }}
          />
          <div
            data-testid="view-area-mask-right"
            style={{ ...bar, top: 0, bottom: 0, right: 0, width: centerRight }}
          />
        </>
      )}
      {cornerMask && radius > 0 && (
        <>
          <div
            data-testid="view-area-corner-mask-top-left"
            style={{
              ...cornerBase,
              top: centerTop,
              left: centerLeft,
              background: cornerGradient('100% 100%')
            }}
          />
          <div
            data-testid="view-area-corner-mask-top-right"
            style={{
              ...cornerBase,
              top: centerTop,
              right: centerRight,
              background: cornerGradient('0 100%')
            }}
          />
          <div
            data-testid="view-area-corner-mask-bottom-left"
            style={{
              ...cornerBase,
              bottom: centerBottom,
              left: centerLeft,
              background: cornerGradient('100% 0')
            }}
          />
          <div
            data-testid="view-area-corner-mask-bottom-right"
            style={{
              ...cornerBase,
              bottom: centerBottom,
              right: centerRight,
              background: cornerGradient('0 0')
            }}
          />
        </>
      )}
    </>
  )
}

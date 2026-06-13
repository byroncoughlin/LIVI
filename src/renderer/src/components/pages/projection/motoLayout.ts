export const MOTO_DISPLAY_SIZE = 800
export const MOTO_CENTER_SQUARE_SIZE = 565
export const MOTO_ARC_STRIP_SIZE = 117
export const MOTO_CENTER_CORNER_RADIUS_PX = 38
export const MOTO_GRAPH_OVERLAY_OVERSCAN_PX = 2
export const MOTO_SQUARE_PCT = `${(MOTO_CENTER_SQUARE_SIZE / MOTO_DISPLAY_SIZE) * 100}%`
export const MOTO_ARC_PCT = `${(MOTO_ARC_STRIP_SIZE / MOTO_DISPLAY_SIZE) * 100}%`

type Insets = {
  top: number
  bottom: number
  left: number
  right: number
}

type PercentFrame = {
  left: string
  top: string
  width: string
  height: string
}

const pct = (value: number, total: number): string => `${(value / total) * 100}%`

export function projectionFramePct(
  displayWidth: number,
  displayHeight: number,
  insets: Insets
): PercentFrame {
  const width = Math.max(1, displayWidth - insets.left - insets.right)
  const height = Math.max(1, displayHeight - insets.top - insets.bottom)

  return {
    left: pct(insets.left, displayWidth),
    top: pct(insets.top, displayHeight),
    width: pct(width, displayWidth),
    height: pct(height, displayHeight)
  }
}

export function roundDashboardFramePct(
  displayWidth: number,
  displayHeight: number,
  insets: Insets
): PercentFrame {
  // The dongle transport uses even-pixel 118px insets, while the old round UI
  // visually framed the center square at 117px/565px. Keep the placeholder
  // aligned with the dashboard overlay without changing the video transport.
  const defaultTransportFrame =
    displayWidth === MOTO_DISPLAY_SIZE &&
    displayHeight === MOTO_DISPLAY_SIZE &&
    insets.top === 118 &&
    insets.bottom === 118 &&
    insets.left === 118 &&
    insets.right === 118

  if (defaultTransportFrame) {
    return {
      left: MOTO_ARC_PCT,
      top: MOTO_ARC_PCT,
      width: MOTO_SQUARE_PCT,
      height: MOTO_SQUARE_PCT
    }
  }

  return projectionFramePct(displayWidth, displayHeight, insets)
}

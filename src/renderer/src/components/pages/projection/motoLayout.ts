export const MOTO_DISPLAY_SIZE = 800
export const MOTO_CENTER_SQUARE_SIZE = 586
export const MOTO_ARC_STRIP_SIZE = 107
export const MOTO_CENTER_CORNER_RADIUS_PX = 38
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
  const defaultRoundFrame =
    displayWidth === MOTO_DISPLAY_SIZE &&
    displayHeight === MOTO_DISPLAY_SIZE &&
    insets.top === MOTO_ARC_STRIP_SIZE &&
    insets.bottom === MOTO_ARC_STRIP_SIZE &&
    insets.left === MOTO_ARC_STRIP_SIZE &&
    insets.right === MOTO_ARC_STRIP_SIZE

  if (defaultRoundFrame) {
    return {
      left: MOTO_ARC_PCT,
      top: MOTO_ARC_PCT,
      width: MOTO_SQUARE_PCT,
      height: MOTO_SQUARE_PCT
    }
  }

  return projectionFramePct(displayWidth, displayHeight, insets)
}

import type { Config } from '@shared/types'
import { MicType } from '@shared/types/Config'

type PartialConfig = Partial<Config>

export function enforceRoundDashboardConfig<T extends PartialConfig>(config: T): T {
  const next = { ...config } as PartialConfig

  if ('darkMode' in next) next.darkMode = true
  if ('nightMode' in next) next.nightMode = true
  if ('disableAudioOutput' in next) next.disableAudioOutput = true
  if ('audioInputDevice' in next) next.audioInputDevice = ''
  if ('audioInputDeviceLabel' in next) next.audioInputDeviceLabel = ''
  if ('micType' in next) next.micType = MicType.CarMic
  if ('cameraId' in next) next.cameraId = ''
  if ('cameraMirror' in next) next.cameraMirror = false
  if ('autoSwitchOnReverse' in next) next.autoSwitchOnReverse = false

  if (next.kiosk && typeof next.kiosk === 'object' && !Array.isArray(next.kiosk)) {
    next.kiosk = { ...next.kiosk, main: true }
  }

  if (next.camera && typeof next.camera === 'object' && !Array.isArray(next.camera)) {
    next.camera = { ...next.camera, main: false, dash: false, aux: false }
  }

  return next as T
}

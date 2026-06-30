import { cpuPct, parseCpuSnapshot, readSystemStats } from '../systemStats'

describe('systemStats', () => {
  test('parseCpuSnapshot reads aggregate and per-core lines', () => {
    expect(
      parseCpuSnapshot('cpu  100 0 100 700 100 0 0 0\ncpu0 10 0 10 80 0 0 0 0\nintr 1\n')
    ).toEqual({
      cpu: [100, 0, 100, 700, 100, 0, 0, 0],
      cpu0: [10, 0, 10, 80, 0, 0, 0, 0]
    })
  })

  test('cpuPct calculates active CPU percentage from two snapshots', () => {
    expect(cpuPct([100, 0, 100, 700, 100], [150, 0, 150, 800, 100])).toBe(50)
    expect(cpuPct([1, 1, 1, 1], [1, 1, 1, 1])).toBe(0)
    expect(cpuPct(undefined, [1, 1, 1, 1])).toBe(0)
  })

  test('readSystemStats reads cpu, memory, temperature, load, and uptime', async () => {
    const statSnapshots = [
      'cpu  100 0 100 700 100\ncpu0 10 0 10 80 0\ncpu1 20 0 20 60 0\n',
      'cpu  150 0 150 800 100\ncpu0 20 0 20 120 0\ncpu1 25 0 25 100 0\n'
    ]
    const readText = jest.fn((path: string) => {
      if (path === '/proc/stat') return statSnapshots.shift() ?? ''
      if (path === '/proc/meminfo') {
        return [
          'MemTotal:       2048000 kB',
          'MemAvailable:   1024000 kB',
          'SwapTotal:       524288 kB',
          'SwapFree:        262144 kB'
        ].join('\n')
      }
      if (path === '/sys/class/thermal/thermal_zone0/temp') return '45678\n'
      if (path === '/proc/loadavg') return '1.00 0.50 0.25 1/2 3\n'
      if (path === '/proc/uptime') return '1234.5 99.0\n'
      throw new Error(`unexpected path ${path}`)
    })
    const statfs = jest.fn().mockReturnValue({
      bsize: 4096,
      blocks: 1024000,
      bavail: 256000
    })
    const sleep = jest.fn().mockResolvedValue(undefined)

    await expect(readSystemStats({ readText, statfs, sleep, sampleMs: 0 })).resolves.toEqual({
      cpu: 50,
      cores: [33, 20],
      memUsedMb: 1000,
      memTotalMb: 2000,
      memPct: 50,
      diskFreeMb: 1000,
      diskTotalMb: 4000,
      diskPct: 75,
      swapUsedMb: 256,
      tempC: 45.7,
      load: [1, 0.5, 0.25],
      uptime: 1235
    })
    expect(statfs).toHaveBeenCalledWith('/')
    expect(sleep).toHaveBeenCalledWith(0)
  })

  test('readSystemStats tolerates optional sensor files being unavailable', async () => {
    const readText = jest.fn((path: string) => {
      if (path === '/proc/stat') return 'cpu  0 0 0 10 0\n'
      if (path === '/proc/meminfo') return 'MemTotal: 1024 kB\n'
      throw new Error(`missing ${path}`)
    })

    await expect(
      readSystemStats({
        readText,
        statfs: jest.fn(() => {
          throw new Error('missing statfs')
        }),
        sleep: jest.fn().mockResolvedValue(undefined),
        sampleMs: 0
      })
    ).resolves.toMatchObject({
      cpu: 0,
      cores: [],
      memUsedMb: null,
      memTotalMb: 1,
      memPct: null,
      diskFreeMb: null,
      diskTotalMb: null,
      diskPct: null,
      swapUsedMb: null,
      tempC: null,
      load: null,
      uptime: null
    })
  })
})

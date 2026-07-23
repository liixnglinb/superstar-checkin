import * as fs from 'fs'
import YAML from 'yaml'
import type { AppConfig } from '../types'
import { DEFAULTS } from '../constants'

const DEFAULT_CONFIG: Partial<AppConfig> = {
  listener: {
    mode: 'im',
    pollInterval: DEFAULTS.POLL_INTERVAL,
  },
  checkin: {
    delay: { min: DEFAULTS.CHECKIN_DELAY_MIN, max: DEFAULTS.CHECKIN_DELAY_MAX },
    retry: { maxAttempts: DEFAULTS.RETRY_MAX, delayMs: DEFAULTS.RETRY_DELAY },
    antiDetect: {
      enabled: true,
      randomDelay: true,
      useragentRotation: false,
      gpsDrift: true,
    },
  },
  geo: {
    locations: [],
    providers: {},
  },
  notify: { channels: [] },
  storage: { dataDir: './data' },
  log: { level: 'info' },
}

/**
 * 加载并合并配置
 */
export function loadConfig(filePath?: string): AppConfig {
  const file = filePath || process.env.CONFIG_FILE || 'config.yaml'

  if (!fs.existsSync(file)) {
    throw new Error(`配置文件不存在: ${file}\n请复制 config.example.yaml 为 config.yaml 并填入配置`)
  }

  const raw = YAML.parse(fs.readFileSync(file, 'utf-8'))

  // 深度合并
  const config = deepMerge(DEFAULT_CONFIG, raw) as AppConfig

  // 基础校验
  if (!config.accounts?.length) {
    throw new Error('配置文件中 accounts 不能为空')
  }

  return config
}

function deepMerge(target: any, source: any): any {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

import * as fs from 'fs'
import * as path from 'path'
import YAML from 'yaml'
import type { AppConfig } from '../types'
import { DEFAULTS } from '../constants'
import { logger } from '../utils/logger'

/**
 * 打包为独立 exe 时，由 build-sea.js 通过 esbuild define 注入当前 config.yaml 的 base64。
 * 源码直接运行时该变量不存在（undefined），走内置默认配置。
 * 作用：用户拿到单个 exe 后首次双击，无需手动准备配置文件即可开箱即用。
 */
declare const __EMBEDDED_CONFIG_B64__: string | undefined

const DEFAULT_CONFIG: Partial<AppConfig> = {
  accounts: [],
  watchCourses: [],
  listener: {
    mode: 'hybrid',
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
  notify: {
    channels: [],
    desktop: true,
    quiet: { enabled: false, start: '23:00', end: '07:00' },
  },
  dingtalk: {
    appKey: '',
    appSecret: '',
    port: 3456,
  },
  web: {
    port: 3456,
    openBrowser: true,
  },
  storage: { dataDir: './data' },
  log: { level: 'info' },
}

/**
 * 加载并合并配置
 */
export function loadConfig(filePath?: string): AppConfig {
  const file = filePath || process.env.CONFIG_FILE || 'config.yaml'

  // 配置文件不存在：用内嵌配置（打包时注入）或内置默认配置自动生成，保证开箱即用
  if (!fs.existsSync(file)) {
    const config = bootstrapConfig(file)
    logger.info(`未找到配置文件，已自动生成: ${file}`)
    return config
  }

  const raw = YAML.parse(fs.readFileSync(file, 'utf-8'))

  // 深度合并
  const config = deepMerge(DEFAULT_CONFIG, raw) as AppConfig

  // 账号可为空：首次运行在软件内引导填写（支持多用户各自登录自己的账号）
  if (!config.accounts) config.accounts = []

  return config
}

/**
 * 首次运行引导：无配置文件时生成一份。
 * 优先使用打包时内嵌的配置（含账号，开箱即用）；没有内嵌配置则用默认值生成空模板。
 */
function bootstrapConfig(filePath: string): AppConfig {
  let embedded: any = null
  if (typeof __EMBEDDED_CONFIG_B64__ !== 'undefined' && __EMBEDDED_CONFIG_B64__) {
    try {
      const text = Buffer.from(__EMBEDDED_CONFIG_B64__, 'base64').toString('utf-8')
      embedded = YAML.parse(text)
      logger.info('已载入内置配置（首次运行自动写入 config.yaml）')
    } catch (e: any) {
      logger.warn(`内置配置解析失败，使用默认模板: ${e.message}`)
      embedded = null
    }
  }

  // Electron 打包版：从 asar 内 build/embedded-config.json 读取内嵌配置
  if (!embedded) {
    try {
      const ep = path.join(__dirname, '..', 'embedded-config.json')
      if (fs.existsSync(ep)) {
        const raw = JSON.parse(fs.readFileSync(ep, 'utf-8'))
        if (raw && raw.b64) {
          embedded = YAML.parse(Buffer.from(raw.b64, 'base64').toString('utf-8'))
          logger.info('已载入 asar 内置配置（首次运行自动写入 config.yaml）')
        }
      }
    } catch (e: any) {
      logger.warn(`asar 内置配置读取失败，使用默认模板: ${e.message}`)
      embedded = null
    }
  }

  const merged = deepMerge(DEFAULT_CONFIG, embedded || {}) as AppConfig
  if (!merged.accounts) merged.accounts = []

  fs.writeFileSync(filePath, YAML.stringify(merged), 'utf-8')
  return merged
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

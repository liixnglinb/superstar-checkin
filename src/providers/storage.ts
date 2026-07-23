import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../utils/logger'

let data: Record<string, any> = {}
let filePath = ''

export function initStorage(dataDir: string) {
  filePath = path.join(dataDir, 'superstar-data.json')
  fs.mkdirSync(dataDir, { recursive: true })
  try {
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
  } catch (e) {
    logger.warn('读取数据文件失败，使用空数据')
  }

  // 优雅退出时保存
  process.on('SIGINT', () => { persist(); process.exit(0) })
  process.on('SIGTERM', () => { persist(); process.exit(0) })
}

export function get<T>(key: string): T | null {
  return data[key] ?? null
}

export function set<T>(key: string, value: T) {
  data[key] = value
  persist()
}

export function remove(key: string) {
  delete data[key]
  persist()
}

export function getAll(): Record<string, any> {
  return { ...data }
}

function persist() {
  if (!filePath) return
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (e) {
    logger.error('保存数据文件失败', e)
  }
}

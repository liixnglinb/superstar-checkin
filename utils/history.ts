import * as fs from 'fs'
import * as path from 'path'

const HISTORY_FILE = path.join(process.cwd(), 'data', 'checkin-history.json')

export interface CheckinRecord {
    time: string
    aid: string
    courseName: string
    type: string
    result: string
    account: string
}

let history: CheckinRecord[] = []

// 从文件加载历史
try {
    if (fs.existsSync(HISTORY_FILE)) {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
    }
} catch { }

const save = () => {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true })
    // 保留最近 200 条
    if (history.length > 200) history = history.slice(-200)
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

export const addRecord = (record: CheckinRecord) => {
    history.push(record)
    save()
}

export const getHistory = (): CheckinRecord[] => [...history].reverse()

export const getStats = () => {
    const total = history.length
    const success = history.filter(r => r.result.includes('成功') || r.result === 'success').length
    const byType: Record<string, number> = {}
    for (const r of history) {
        byType[r.type] = (byType[r.type] || 0) + 1
    }
    return { total, success, byType, lastCheckin: history[history.length - 1] || null }
}

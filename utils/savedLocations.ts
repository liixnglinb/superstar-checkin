import * as fs from 'fs'
import * as path from 'path'

const LOCATION_FILE = path.join(process.cwd(), 'data', 'learned-locations.json')

interface SavedLocation {
    address: string      // 地址文本
    lat: number
    lon: number
    lastUsed: string     // 最后使用时间
    useCount: number     // 使用次数
}

let locations: SavedLocation[] = []

try {
    if (fs.existsSync(LOCATION_FILE)) {
        locations = JSON.parse(fs.readFileSync(LOCATION_FILE, 'utf-8'))
    }
} catch { }

const save = () => {
    fs.mkdirSync(path.dirname(LOCATION_FILE), { recursive: true })
    fs.writeFileSync(LOCATION_FILE, JSON.stringify(locations, null, 2))
}

// 获取学过的最佳坐标
export const getLearnedLocation = (address: string): { lat: number; lon: number } | null => {
    const found = locations.find(l => l.address === address)
    if (found) {
        found.lastUsed = new Date().toISOString()
        found.useCount++
        save()
        return { lat: found.lat, lon: found.lon }
    }
    return null
}

// 保存学到的坐标
export const saveLearnedLocation = (address: string, lat: number, lon: number) => {
    const existing = locations.find(l => l.address === address)
    if (existing) {
        existing.lat = lat
        existing.lon = lon
        existing.lastUsed = new Date().toISOString()
        existing.useCount++
    } else {
        locations.push({
            address,
            lat,
            lon,
            lastUsed: new Date().toISOString(),
            useCount: 1,
        })
    }
    // 最多保留20条
    if (locations.length > 20) locations = locations.slice(-20)
    save()
}

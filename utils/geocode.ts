import axios from 'axios'
import {info} from './log'

// 多源地理编码：优先高德→百度→OSM
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
    // 1. 高德 API（精度最高）
    const amapKey = 'd110b0e5cb3a1e4d3e4823e3b2b3a7b3'
    const r = await tryAmap(address, amapKey)
    if (r) return r

    // 2. 百度地图 Place API（无需 key 的公开接口）
    const r2 = await tryBaidu(address)
    if (r2) return r2

    // 3. OSM 兜底
    const r3 = await tryOSM(address)
    if (r3) return r3

    return null
}

async function tryAmap(address: string, key: string) {
    try {
        const res = await axios.get('https://restapi.amap.com/v3/geocode/geo', {
            params: { key, address, output: 'JSON' },
            timeout: 5000,
        })
        if (res.data?.status === '1' && res.data.geocodes?.length > 0) {
            const loc = res.data.geocodes[0].location.split(',')
            info(`高德: "${address}" -> (${loc[1]}, ${loc[0]})`)
            return { lat: parseFloat(loc[1]), lon: parseFloat(loc[0]) }
        }
    } catch (_) { }
    return null
}

async function tryBaidu(address: string) {
    try {
        // 百度地图 Place Suggestion API（无需认证）
        const res = await axios.get('https://map.baidu.com/su', {
            params: { wd: address, cid: 1, type: 0 },
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://map.baidu.com/' },
            timeout: 5000,
        })
        if (res.data?.s?.length > 0) {
            const xy = res.data.s[0].xy || res.data.s[0].geo
            if (xy) {
                const parts = String(xy).split('|')[0].split(',')
                if (parts.length === 2) {
                    const lon = parseFloat(parts[0])
                    const lat = parseFloat(parts[1])
                    info(`百度: "${address}" -> (${lat}, ${lon})`)
                    return { lat, lon }
                }
            }
        }
    } catch (_) { }
    return null
}

async function tryOSM(address: string) {
    try {
        const res = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: address, format: 'json', limit: 1 },
            headers: { 'User-Agent': 'SuperstarCheckin/1.0' },
            timeout: 5000,
        })
        if (res.data?.length > 0) {
            info(`OSM: "${address}" -> (${res.data[0].lat}, ${res.data[0].lon})`)
            return { lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon) }
        }
    } catch (_) { }
    return null
}

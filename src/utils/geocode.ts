import axios from 'axios'
import { logger } from './logger'

interface GeoResult {
  lat: number
  lon: number
  source: string
}

/**
 * 多源地理编码：高德 → 百度 → OSM，依次降级
 */
export async function geocodeAddress(
  address: string,
  amapKey?: string,
  baiduKey?: string,
): Promise<GeoResult | null> {
  if (!address) return null

  // 1. 高德
  if (amapKey) {
    const r = await tryAmap(address, amapKey)
    if (r) return r
  }

  // 2. 百度
  const r2 = await tryBaidu(address)
  if (r2) return r2

  // 3. OSM
  const r3 = await tryOSM(address)
  if (r3) return r3

  logger.warn(`地理编码失败: "${address}"`)
  return null
}

async function tryAmap(address: string, key: string): Promise<GeoResult | null> {
  try {
    const res = await axios.get('https://restapi.amap.com/v3/geocode/geo', {
      params: { key, address, output: 'JSON' },
      timeout: 5000,
    })
    if (res.data?.status === '1' && res.data.geocodes?.length > 0) {
      const loc = res.data.geocodes[0].location.split(',')
      logger.info(`高德: "${address}" -> (${loc[1]}, ${loc[0]})`)
      return { lat: parseFloat(loc[1]), lon: parseFloat(loc[0]), source: 'amap' }
    }
  } catch { /* 静默 */ }
  return null
}

async function tryBaidu(address: string): Promise<GeoResult | null> {
  try {
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
          logger.info(`百度: "${address}" -> (${parts[1]}, ${parts[0]})`)
          return { lat: parseFloat(parts[1]), lon: parseFloat(parts[0]), source: 'baidu' }
        }
      }
    }
  } catch { /* 静默 */ }
  return null
}

async function tryOSM(address: string): Promise<GeoResult | null> {
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: address, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'ChaoxingAutoSign/2.0' },
      timeout: 8000,
    })
    if (res.data?.length > 0) {
      logger.info(`OSM: "${address}" -> (${res.data[0].lat}, ${res.data[0].lon})`)
      return { lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon), source: 'osm' }
    }
  } catch { /* 静默 */ }
  return null
}

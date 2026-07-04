import {genGeoCheckinParams} from '../utils/genCheckinParams'
import checkin from '../requests/checkin'
import config from '../providers/config'
import AccountMetaData from '../types/AccountMetaData'
import handlerSimpleCheckin from './handleSimpleCheckin'
import GeoLocation from '../types/GeoLocation'
import {warn, info} from "../utils/log";
import {triangulateAndCheckin} from '../utils/triangulate'
import {getLearnedLocation} from '../utils/savedLocations'
import {geocodeAddress} from '../utils/geocode'

const inferCourseGeoInfo = (geoLocations: Array<GeoLocation>, courseId: number) => {
    const weekDay = new Date().getDay()
    const locations = geoLocations.filter(e => e.courseId === courseId)
    for (const location of locations) {
        if (!location.onlyOnWeekdays)
            return location
        else if (location.onlyOnWeekdays && location.onlyOnWeekdays.includes(weekDay)) {
            return location
        }
    }
    // 使用 fallback 位置
    const fallback = geoLocations.find(e => e.courseId === "*")
    if (fallback) {
        warn(`课程 ID ${courseId} 没有设置位置信息，使用 fallback 位置`)
        return fallback
    }
}

export default async (activeId: string | number, courseId: number, classId: number, account: AccountMetaData, geoInfo?: GeoLocation & { range?: string }) => {
    const apiAddress = geoInfo?.address || ''  // 老师填的地址文字
    let lat = geoInfo ? parseFloat(geoInfo.lat as any) : NaN
    let lon = geoInfo ? parseFloat(geoInfo.lon as any) : NaN

    // 新API不再下发经纬度，但有地址文字——用地理编码转坐标
    if (apiAddress && (Number.isNaN(lat) || lat === 0)) {
        info(`API无坐标但地址: "${apiAddress}"，尝试地理编码...`)
        const coded = await geocodeAddress(apiAddress)
        if (coded) {
            lat = coded.lat
            lon = coded.lon
        }
    }

    // 地理编码失败或没有地址 → fallback 到配置文件预设
    if (Number.isNaN(lat) || lat === 0) {
        const fallback = inferCourseGeoInfo(config.geoLocations, courseId)
        if (fallback) {
            lat = parseFloat(fallback.lat as any)
            lon = parseFloat(fallback.lon as any)
            info(`使用预设坐标: (${lat},${lon})`)
        } else {
            warn(`课程 ID ${courseId} 无可用坐标，走普通签到`)
            return (await handlerSimpleCheckin(activeId, account, { courseId, classId })) + `\n警告：无可用坐标`
        }
    }

    // 首次签到
    const address = apiAddress || geoInfo?.address || ''
    const firstResult = await trySign(activeId, account, address, { courseId, classId }, lat, lon)

    // 距离太远 → 三角定位逼近
    if (firstResult.includes('距教师指定签到地点') && firstResult.includes('不在可签到范围内')) {
        // 先试已学坐标
        const learned = getLearnedLocation(address)
        if (learned) {
            info(`尝试已学坐标: (${learned.lat},${learned.lon})`)
            const lr = await trySign(activeId, account, address, { courseId, classId }, learned.lat, learned.lon)
            if (!lr.includes('不在可签到范围内')) return lr
        }
        // 三角定位（最多2-3次请求）
        info('启动三角定位...')
        return await triangulateAndCheckin(activeId, account, address, { courseId, classId }, lat, lon)
    }

    return firstResult
}

// 在目标坐标附近 5~30 米随机偏移，模拟真实手机GPS误差
function addGpsDrift(lat: number, lon: number): { lat: number; lon: number } {
    const meters = 5 + Math.random() * 25
    const angle = Math.random() * 2 * Math.PI
    const dLat = meters * Math.cos(angle) / 111320
    const dLon = meters * Math.sin(angle) / (111320 * Math.cos(lat * Math.PI / 180))
    return { lat: lat + dLat, lon: lon + dLon }
}

async function trySign(activeId: string | number, account: AccountMetaData, address: string, preSignParams: any, lat: number, lon: number) {
    const drifted = addGpsDrift(lat, lon)
    return await checkin(account.cookie, genGeoCheckinParams({
        uid: account.uid, name: account.name, activeId, address,
        latitude: drifted.lat, longitude: drifted.lon,
    }), preSignParams)
}

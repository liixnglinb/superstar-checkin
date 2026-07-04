import axios from 'axios'
import {wrapper} from 'axios-cookiejar-support'
import {CookieJar} from 'tough-cookie'
import {MOBILE_AGENT} from '../constants'
import {doPreSign, doSubmit} from '../requests/checkin'
import AccountMetaData from '../types/AccountMetaData'
import {info} from './log'
import {saveLearnedLocation} from './savedLocations'

// 通过地址文字 + 服务器距离反馈，用最少次请求逼近教师坐标（最多2-3次，看起来像GPS漂移）
export async function triangulateAndCheckin(
    activeId: string | number,
    account: AccountMetaData,
    address: string,
    preSignParams: { courseId?: number; classId?: number },
    initialLat: number,
    initialLon: number
): Promise<string> {
    // 共享 session，preSign 只做一次
    const jar = new CookieJar()
    const client = wrapper(axios.create({ jar, proxy: false }))
    await doPreSign(client, account.cookie, { activeId: String(activeId), uid: account.uid }, preSignParams)
    info('三角定位 preSign 完成，开始搜索...')

    const probe = (lat: number, lon: number) =>
        doSubmit(client, account.cookie, { name: account.name, address, activeId: String(activeId), uid: account.uid, latitude: lat, longitude: lon })

    // 第一次：预设坐标
    let result = await probe(initialLat, initialLon)
    info(`尝试1 预设: (${initialLat.toFixed(6)},${initialLon.toFixed(6)}) -> ${result}`)

    const distMatch = result.match(/距教师指定签到地点([\d.]+)米/)
    if (!distMatch) {
        if (result.includes('success') || result.includes('成功')) saveLearnedLocation(address, initialLat, initialLon)
        return result
    }
    if (result.includes('您已签到')) return result

    const dist1 = parseFloat(distMatch[1])
    const step = dist1 / 111320
    const lonStep0 = dist1 / (111320 * Math.cos(initialLat * Math.PI / 180))

    // 四个方向各试一次，找距离最小的
    const dirs = [
        { dlat: step, dlon: 0, label: 'N' },
        { dlat: -step, dlon: 0, label: 'S' },
        { dlat: 0, dlon: lonStep0, label: 'E' },
        { dlat: 0, dlon: -lonStep0, label: 'W' },
    ]

    let best = { lat: initialLat, lon: initialLon, dist: dist1, result }

    for (const d of dirs) {
        const tl = initialLat + d.dlat
        const tn = initialLon + d.dlon
        const tr = await probe(tl, tn)
        info(`尝试 ${d.label}: (${tl.toFixed(6)},${tn.toFixed(6)}) -> ${tr}`)
        const m = tr.match(/距教师指定签到地点([\d.]+)米/)
        if (!m) {
            if (tr.includes('success') || tr.includes('成功')) { saveLearnedLocation(address, tl, tn); return tr }
            continue
        }
        const nd = parseFloat(m[1])
        if (nd < best.dist) { best = { lat: tl, lon: tn, dist: nd, result: tr } }
    }

    // 找到最接近的方向后，在该方向附近二分搜索（最多2次），目标50米内
    if (best.dist < dist1 && best.dist > 50) {
        // 在最佳点和初始点之间搜索
        const midLat = (best.lat + initialLat) / 2
        const midLon = (best.lon + initialLon) / 2
        const mr = await probe(midLat, midLon)
        info(`二分中点: (${midLat.toFixed(6)},${midLon.toFixed(6)}) -> ${mr}`)
        const mm = mr.match(/距教师指定签到地点([\d.]+)米/)
        if (mm) {
            const md = parseFloat(mm[1])
            if (md < best.dist) {
                best = { lat: midLat, lon: midLon, dist: md, result: mr }
                // 还在50米外？再搜一次
                if (md > 50) {
                    const qLat = (midLat + best.lat) / 2
                    const qLon = (midLon + best.lon) / 2
                    const qr = await probe(qLat, qLon)
                    info(`再二分: (${qLat.toFixed(6)},${qLon.toFixed(6)}) -> ${qr}`)
                    if (!qr.includes('不在可签到范围内')) { saveLearnedLocation(address, qLat, qLon); return qr }
                    const qm = qr.match(/距教师指定签到地点([\d.]+)米/)
                    if (qm && parseFloat(qm[1]) < md) { best = { lat: qLat, lon: qLon, dist: parseFloat(qm[1]), result: qr } }
                }
            } else {
                // 中点在反方向，在最佳附近搜索
                const nLat = best.lat + (best.lat - initialLat) * 0.3
                const nLon = best.lon + (best.lon - initialLon) * 0.3
                const nr = await probe(nLat, nLon)
                info(`最佳附近: (${nLat.toFixed(6)},${nLon.toFixed(6)}) -> ${nr}`)
                if (!nr.includes('不在可签到范围内')) { saveLearnedLocation(address, nLat, nLon); return nr }
            }
        }
    }

    // 如果在50米内，保存坐标供下次使用
    if (best.dist <= 50 && !best.result.includes('不在可签到范围内')) {
        saveLearnedLocation(address, best.lat, best.lon)
    }
    return best.result
}
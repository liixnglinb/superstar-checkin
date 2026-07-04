import axios from 'axios'
import * as fs from 'fs'
import {MOBILE_AGENT} from '../constants'
import {info, error} from '../utils/log'
import {wrapper} from 'axios-cookiejar-support'
import {CookieJar} from 'tough-cookie'

// 完整签到流程（preSign + analysis + stuSignajax）
export default async function checkin(
    cookie: string,
    params: { activeId: string; uid: number; name: string; address?: string; latitude?: number; longitude?: number } & any,
    preSignParams?: { courseId?: number; classId?: number }
): Promise<string> {
    const jar = new CookieJar()
    const client = wrapper(axios.create({ jar, proxy: false }))

    await doPreSign(client, cookie, params, preSignParams)
    return await doSubmit(client, cookie, params)
}

// 仅 preSign + analysis（一次签到只需调一次）
export async function doPreSign(
    client: any, cookie: string,
    params: { activeId: string; uid: number },
    preSignParams?: { courseId?: number; classId?: number }
) {
    await client.get('https://mobilelearn.chaoxing.com/newsign/preSign', {
        headers: { Cookie: cookie, 'User-Agent': MOBILE_AGENT },
        params: {
            courseId: preSignParams?.courseId || '',
            classId: preSignParams?.classId || '',
            activePrimaryId: params.activeId,
            general: 1, sys: 1, ls: 1, appType: 15,
            tid: '', uid: params.uid || '', ut: 's',
        },
    })
    // analysis/analysis2
    try {
        const aRes = await client.get('https://mobilelearn.chaoxing.com/pptSign/analysis', {
            headers: { Cookie: cookie, 'User-Agent': MOBILE_AGENT },
            params: { vs: 1, DB_STRATEGY: 'RANDOM', aid: params.activeId },
        })
        const text = String(aRes.data)
        let code = ''
        const idx = text.indexOf("code='+\\'")
        if (idx > 0) { code = text.substring(idx + 8); const end = code.indexOf("\\'"); if (end > 0) code = code.substring(0, end) }
        if (code) {
            await client.get('https://mobilelearn.chaoxing.com/pptSign/analysis2', {
                headers: { Cookie: cookie, 'User-Agent': MOBILE_AGENT },
                params: { DB_STRATEGY: 'RANDOM', code },
            })
        }
    } catch (_) { /* optional */ }
}

// 仅提交签到（三角定位重试用，跳过 preSign）
export async function doSubmit(
    client: any, cookie: string,
    params: { name: string; address?: string; activeId: string; uid: number; latitude?: number; longitude?: number; fid?: number }
): Promise<string> {
    const signParams: Record<string, any> = {
        name: params.name, address: params.address || '',
        activeId: params.activeId, uid: params.uid,
        clientip: '',
        latitude: params.latitude != null ? params.latitude : -1,
        longitude: params.longitude != null ? params.longitude : -1,
        fid: params.fid || '', appType: 15,
    }
    if (params.address) signParams.ifTiJiao = 1

    const fullUrl = axios.getUri({ url: 'https://mobilelearn.chaoxing.com/pptSign/stuSignajax', params: signParams })
    fs.appendFileSync('data/debug.log', `\n[${new Date().toLocaleString('zh-CN')}] URL: ${fullUrl}`)

    const res = await client.get('https://mobilelearn.chaoxing.com/pptSign/stuSignajax', {
        headers: { Cookie: cookie, 'User-Agent': MOBILE_AGENT },
        params: signParams,
    })
    const data = res.data
    fs.appendFileSync('data/debug.log', `\n  -> ${typeof data === 'string' ? data : JSON.stringify(data)}`)

    if (typeof data === 'string') return data
    if (typeof data === 'object' && data !== null) {
        if (data.status === 1 || data.status === true || data.success === true || data.msg === 'success') return 'success'
        return '失败: ' + (data.mes || data.msg || data.message || JSON.stringify(data))
    }
    return String(data)
}

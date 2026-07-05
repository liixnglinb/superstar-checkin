import * as http from 'http'
import {info, warn} from '../utils/log'
import config from './config'
import accountsManager from '../utils/accountsManager'
import handlerQrcodeSign from '../handlers/handleQrcodeCheckin'
import {pushToWechat} from '../utils/pushNotification'

const MAX_BODY_SIZE = 1024 * 1024 // 1MB

export const startQrApi = (port: number = 3456) => {
    const token = config.web?.token || process.env.QR_API_TOKEN || ''
    if (!token) {
        warn('QR API: 未配置 web.token 或 QR_API_TOKEN，不启动 QR API')
        return
    }

    const allowedOrigin = config.web?.allowedOrigin || 'http://localhost'

    const server = http.createServer(async (req, res) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

        // Bearer Token 认证
        const authHeader = req.headers.authorization
        if (authHeader !== `Bearer ${token}`) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, msg: 'unauthorized' }))
            return
        }

        if (req.method === 'POST' && req.url === '/api/sign') {
            let body = ''
            let tooLarge = false
            req.on('data', c => {
                body += c
                if (body.length > MAX_BODY_SIZE) {
                    tooLarge = true
                    res.writeHead(413, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ ok: false, msg: 'payload too large' }))
                    req.destroy()
                }
            })
            req.on('end', async () => {
                if (tooLarge) return
                try {
                    const { qrdata } = JSON.parse(body)
                    if (!qrdata) { res.end(JSON.stringify({ ok: false, msg: 'no qrdata' })); return }

                    let aid = ''; let enc = qrdata
                    const m = qrdata.match(/aid=(\d+)/); if (m) aid = m[1]
                    const e = qrdata.match(/enc=([\dA-F]+)/); if (e) enc = e[1]
                    if (!aid) { res.end(JSON.stringify({ ok: false, msg: '无法识别AID，收到: ' + qrdata.substring(0,100) })); return }

                    info(`QR API签到: aid=${aid}`)
                    let msg = ''
                    for (const acc of config.accounts) {
                        const am = await accountsManager.getAccountData(acc.username)
                        const ret = await handlerQrcodeSign(aid, enc, am)
                        msg += `${am.name}：${ret === 'success' ? '成功' : ret}\n`
                    }
                    pushToWechat('二维码签到结果', msg)
                    res.end(JSON.stringify({ ok: true, msg }))
                } catch (e: any) {
                    res.end(JSON.stringify({ ok: false, msg: e.message }))
                }
            })
            return
        }

        res.writeHead(200)
        res.end('ok')
    })

    server.listen(port, () => {
        info(`QR API: http://localhost:${port}/api/sign`)
    })
}

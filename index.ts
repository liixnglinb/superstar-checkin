import {info} from './utils/log'
import * as db from './providers/db'
import {loginBot} from './providers/bot'
import axios from 'axios'
import {imConnect} from './providers/easemob'
import accountsManager from './utils/accountsManager'
import config from './providers/config'
import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'
import getCheckinDetail from './requests/getCheckinDetail'
import handleCheckin from './handlers/handleCheckin'
import handlerQrcodeSign from './handlers/handleQrcodeCheckin'
import decodeQrCode from './utils/decodeQrCode'
import {pushToWechat} from './utils/pushNotification'
import {startQrApi} from './providers/qrApi'

(async () => {
    //初始化数据库连接和 bot
    axios.defaults.proxy = false
    await db.connect()
    await loginBot()
    //验证及获取 cookie
    await accountsManager.checkCookies()
    //登录步骤完成，使用第一个帐号登录环信
    const meta = await accountsManager.getAccountData(config.accounts[0].username)
    info(`正在使用 ${meta.name} 的帐号登录环信`)
    //连接 IM
    info('准备连接 IM')
    await imConnect(meta.cookie, meta.uid)
    info('系统初始化完毕')
    startQrApi(3456)
    info('')
    info('📋 手动签到：输入 签到 <aid> [enc二维码签到|couseId位置签到]')
    info('')

    // 终端手动签到
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.on('line', async (line) => {
        const parts = line.trim().split(/\s+/)
        if (parts[0] === '签到' || parts[0] === 'sign' || parts[0] === 'checkin') {
            const aid = parts[1]
            const encOrCourseId = parts[2]
            if (!aid) {
                info('用法: 签到 <aid> [enc|courseId]')
                info('  二维码签到: 签到 <aid> <enc>')
                info('  位置/普通签到: 签到 <aid> [courseId]')
                return
            }
            try {
                const meta = await accountsManager.getAccountData(config.accounts[0].username)
                const checkinInfo = await getCheckinDetail(meta.cookie, aid)
                info('签到类型：' + checkinInfo.type)
                if (checkinInfo.type === 'qr') {
                    if (!encOrCourseId) {
                        info('❌ 二维码签到需要提供 enc 参数')
                        info('  从二维码 URL 中提取，格式: 签到 <aid> <enc>')
                        return
                    }
                    for (const account of config.accounts) {
                        const am = await accountsManager.getAccountData(account.username)
                        info('开始签到 ' + am.name)
                        const ret = await handlerQrcodeSign(aid, encOrCourseId, am)
                        info(am.name + '：' + (ret === 'success' ? '✅ 成功' : ret))
                    }
                } else {
                    const courseId = encOrCourseId ? Number(encOrCourseId) : 0
                    const result = await handleCheckin(aid, courseId, 0, checkinInfo, '手动签到')
                    info(result)
                }
            } catch (e) {
                info('签到失败：' + e)
            }
        }
    })

    // 二维码文件夹监听：丢图片进 qrcode/ 自动签到
    const qrDir = path.join(process.cwd(), 'qrcode')
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true })
    info('📷 二维码文件夹监听: ' + qrDir)

    const REGEX_ENC = /(SIGNIN:|e\?).*(aid=|id=)(\d+)(&.*)?&enc=([\dA-F]+)/
    const processed = new Set<string>()

    fs.watch(qrDir, async (eventType, filename) => {
        if (!filename || !/\.(png|jpg|jpeg|bmp)$/i.test(filename)) return
        const filePath = path.join(qrDir, filename)
        // 避免重复处理
        if (processed.has(filePath)) return
        processed.add(filePath)

        // 等文件写完再读
        await new Promise(r => setTimeout(r, 500))
        if (!fs.existsSync(filePath)) return

        try {
            info('检测到二维码图片: ' + filename)
            const dec = await decodeQrCode(filePath)
            info('解码结果: ' + dec)
            if (REGEX_ENC.test(dec)) {
                const exec = REGEX_ENC.exec(dec)!
                const aid = exec[3]
                const enc = exec[5]
                info(`aid=${aid} enc=${enc}`)
                let result = '二维码自动签到：'
                for (const account of config.accounts) {
                    const am = await accountsManager.getAccountData(account.username)
                    const ret = await handlerQrcodeSign(aid, enc, am)
                    result += `\n${am.name}：${ret === 'success' ? '成功' : ret}`
                }
                info(result)
                pushToWechat('📷 二维码签到结果', result)
                // 删掉已处理的图片
                fs.unlinkSync(filePath)
            } else {
                info('未识别的二维码格式')
                pushToWechat('📷 二维码识别失败', '未找到签到参数\n' + dec)
            }
        } catch (e: any) {
            info('二维码处理失败: ' + e.message)
            pushToWechat('📷 二维码处理失败', e.message)
        }
    })
})()

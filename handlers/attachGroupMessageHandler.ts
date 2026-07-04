import { WebSocket } from 'ws'
import config from '../providers/config'
import { sendGroupMsg } from '../providers/bot'
import { info } from '../utils/log'
import decodeQrCode from '../utils/decodeQrCode'
import handlerQrcodeSign from './handleQrcodeCheckin'
import accountsManager from '../utils/accountsManager'
import getCheckinDetail from '../requests/getCheckinDetail'
import handleCheckin from './handleCheckin'

export default async (ws: WebSocket, event: any) => {
    // 只处理群消息
    if (event.post_type !== 'message' || event.message_type !== 'group') return

    const groupId = event.group_id
    const userId = event.user_id
    const rawMessage: string = event.raw_message || ''

    // 检查来源群
    if (!config.bot.qrcodeGroups.includes(groupId)) return
    // 检查屏蔽名单
    if (config.bot.ignore && config.bot.ignore.includes(userId)) return

    // 处理 ping
    if (rawMessage === 'ping') {
        sendGroupMsg(groupId, 'pong!')
        return
    }

    // 检查图片（OneBot 格式：message 数组中有 type="image" 元素）
    const messageArr: any[] = event.message || []
    const imageMsg = messageArr.find((e: any) => e.type === 'image')
    if (imageMsg) {
        const imageUrl: string = imageMsg.data?.url
        if (!imageUrl) {
            sendGroupMsg(groupId, '无法获取图片链接')
            return
        }
        try {
            const dec = await decodeQrCode(imageUrl)
            let message = '二维码解码：\n' + dec
            const REGEX_ENC = /(SIGNIN:|e\?).*(aid=|id=)(\d+)(&.*)?&enc=([\dA-F]+)/
            if (REGEX_ENC.test(dec)) {
                const exec = REGEX_ENC.exec(dec)
                message += `\naid: ${exec[3]}\nenc: ${exec[5]}\n正在执行签到...`
                sendGroupMsg(groupId, message)
                let res = '自动签到：'
                for (const account of config.accounts) {
                    const accountMeta = await accountsManager.getAccountData(account.username)
                    res += '\n' + accountMeta.name + '：'
                    info('开始签到', account.username)
                    const ret = await handlerQrcodeSign(exec[3], exec[5], accountMeta)
                    switch (ret) {
                        case 'success': res += '成功'; break;
                        default: res += ret; break;
                    }
                    info('签到结束', account.username, ret)
                }
                sendGroupMsg(groupId, res)
            } else {
                sendGroupMsg(groupId, message)
            }
        } catch (e) {
            info(`二维码解码失败：${e}`)
            sendGroupMsg(groupId, `二维码解码失败：${e}`)
        }
        return
    }

    // 文本命令
    const parts = rawMessage.split(' ')
    const command = parts[0]
    const args = parts.slice(1)

    switch (command) {
        case '签到':
        case 'sign':
        case 'checkin':
            if (!args.length) {
                sendGroupMsg(groupId, '请输入签到参数，参数格式为：\n' +
                    '签到 {aid} [enc(二维码签到时)|courseId(位置签到时。不需要提交位置可以不填)]')
                return
            }
            const aid = args[0]
            const meta = await accountsManager.getAccountData(config.accounts[0].username)
            const checkinInfo = await getCheckinDetail(meta.cookie, aid)
            if (checkinInfo.type === 'qr') {
                if (args.length < 2) {
                    sendGroupMsg(groupId, '二维码签到需要指定 enc')
                    return
                }
                const enc = args[1]
                sendGroupMsg(groupId, `aid: ${aid}\nenc: ${enc}\n正在执行签到...`)
                let res = '自动签到：'
                for (const account of config.accounts) {
                    const accountMeta = await accountsManager.getAccountData(account.username)
                    res += '\n' + accountMeta.name + '：'
                    info('开始签到', account.username)
                    const ret = await handlerQrcodeSign(aid, enc, accountMeta)
                    switch (ret) {
                        case 'success': res += '成功'; break;
                        default: res += ret; break;
                    }
                    info('签到结束', account.username, ret)
                }
                sendGroupMsg(groupId, res)
            } else {
                const courseId = args.length > 1 ? Number(args[1]) : 0
                const result = await handleCheckin(aid, courseId, 0, checkinInfo, '群聊手动')
                sendGroupMsg(groupId, result)
            }
            break
    }
}

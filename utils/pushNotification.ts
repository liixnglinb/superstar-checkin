import axios from 'axios'
import config from '../providers/config'
import {error, info} from './log'

/**
 * 通过 PushPlus 发送微信通知
 * @param title 通知标题
 * @param content 通知内容
 */
export const pushToWechat = async (title: string, content: string) => {
    if (!config.pushplus?.token) return
    try {
        await axios.post('http://www.pushplus.plus/send', {
            token: config.pushplus.token,
            title,
            content,
            template: 'txt'
        })
        info('微信通知已发送：' + title)
    } catch (e) {
        error('微信通知发送失败', e)
    }
}

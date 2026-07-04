import handleGeoCheckin from './handleGeoCheckin'
import handlerSimpleCheckin from './handleSimpleCheckin'
import {error, info} from '../utils/log'
import config from '../providers/config'
import accountsManager from '../utils/accountsManager'
import CheckinInfo from '../types/CheckinInfo'
import {addRecord} from '../utils/history'

export default async (aid: string | number, courseId: number, classId: number, checkinInfo: CheckinInfo, courseName?: string) => {
    let res = ''
    try {
        // 将会附加到最终 QQ 群里推送的提示消息中
        for (const account of config.accounts) {
            const accountMeta = await accountsManager.getAccountData(account.username)
            res += '\n' + accountMeta.name + '：'
            info('开始签到', account.username)
            let ret = ''
            if (checkinInfo.type === 'location') {
                ret = await handleGeoCheckin(aid, courseId, classId, accountMeta, checkinInfo.location)
            } else if (checkinInfo.type === 'gesture') {
                // 手势签到无法自动完成图案，尝试普通签到参数
                info('手势签到：尝试普通参数')
                ret = await handlerSimpleCheckin(aid, accountMeta, { courseId, classId })
                ret = '[手势]' + ret
            } else {
                ret = await handlerSimpleCheckin(aid, accountMeta, { courseId, classId })
            }
            // 服务器返回的原始结果
            info('签到返回: ' + ret)
            if (ret === 'success') {
                res += '成功'
            } else if (ret && ret !== 'success') {
                res += ret
            }
            info('签到结束', account.username, ret)
        }
        const resultStr = `自动签到：\naid:${aid}${res}`
        // 记录签到历史
        addRecord({
            time: new Date().toLocaleString('zh-CN'),
            aid: String(aid),
            courseName: courseName || '(未知课程)',
            type: checkinInfo.type,
            result: resultStr,
            account: config.accounts[0].username,
        })
        return resultStr
    } catch (e) {
        error('签到失败', aid, e)
        return `自动签到\naid:${aid}抛错：\n${e}\n\n部分返回信息：${res}`
    }
}

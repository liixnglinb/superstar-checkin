import { CheckinEngine } from '../core/checkin-engine'
import { logger } from '../utils/logger'
import { randomDelay } from '../utils/anti-detect'
import { retry } from '../utils/retry'
import type { AccountMetaData, CheckinInfo, CheckinResult, AppConfig } from '../types'
import type { AccountManager } from '../providers/account-manager'

/**
 * 签到处理器：协调多账号签到、延迟、重试、历史记录
 */
export class CheckinHandler {
  private config: AppConfig
  private accountManager: AccountManager
  private history: CheckinResult[] = []

  constructor(config: AppConfig, accountManager: AccountManager) {
    this.config = config
    this.accountManager = accountManager
  }

  /**
   * 处理一次签到事件（所有账号）
   */
  async handle(
    aid: string,
    courseId: number,
    classId: number,
    courseName: string,
    checkinInfo: CheckinInfo,
  ): Promise<CheckinResult[]> {
    const startTime = Date.now()
    const results: CheckinResult[] = []

    // 随机延迟（防检测）
    if (this.config.checkin.antiDetect.randomDelay) {
      const { min, max } = this.config.checkin.delay
      const delaySec = Math.floor(Math.random() * (max - min + 1) + min)
      logger.info(`延迟 ${delaySec} 秒后签到...`)
      await randomDelay(min, max)
    }

    // 遍历所有账号
    for (const account of this.accountManager.getAccounts()) {
      const meta = this.accountManager.getMeta(account.username)

      try {
        const result = await retry(
          () => this.executeCheckin(meta, aid, courseId, classId, checkinInfo),
          {
            maxAttempts: this.config.checkin.retry.maxAttempts,
            delayMs: this.config.checkin.retry.delayMs,
            label: `签到 ${meta.name}`,
          },
        )

        const cr: CheckinResult = {
          account: account.username,
          accountName: meta.name,
          success: result.includes('success') || result.includes('签到成功'),
          message: result,
          type: checkinInfo.type,
          courseName,
          aid,
          duration: Date.now() - startTime,
        }

        results.push(cr)
        this.history.push(cr)
        logger.info(`${meta.name}: ${cr.success ? '成功' : cr.message}`)
      } catch (e: any) {
        const cr: CheckinResult = {
          account: account.username,
          accountName: meta.name,
          success: false,
          message: `异常: ${e.message}`,
          type: checkinInfo.type,
          courseName,
          aid,
        }
        results.push(cr)
        logger.error(`${meta.name} 签到失败: ${e.message}`)
      }
    }

    return results
  }

  private async executeCheckin(
    account: AccountMetaData,
    aid: string,
    courseId: number,
    classId: number,
    info: CheckinInfo,
  ): Promise<string> {
    switch (info.type) {
      case 'location':
        return CheckinEngine.geoCheckin(
          account, aid, courseId, classId,
          info.location,
          this.config.geo.locations,
        )

      case 'gesture':
        logger.info('手势签到：尝试普通参数提交')
        return (await CheckinEngine.simpleCheckin(account, aid, { courseId, classId }))
          .replace(/^/, '[手势]')

      case 'qr':
        throw new Error('二维码签到需要提供 enc 参数，请通过 QQ/文件夹/API 提交')

      case 'photo':
        throw new Error('拍照签到需要提供照片，请通过上传链接提交')

      case 'normal':
      default:
        return CheckinEngine.simpleCheckin(account, aid, { courseId, classId })
    }
  }

  /**
   * 处理二维码签到
   */
  async handleQr(aid: string, enc: string): Promise<CheckinResult[]> {
    const results: CheckinResult[] = []

    for (const account of this.accountManager.getAccounts()) {
      const meta = this.accountManager.getMeta(account.username)
      try {
        const result = await CheckinEngine.qrCheckin(meta, aid, enc)
        results.push({
          account: account.username,
          accountName: meta.name,
          success: result.includes('success'),
          message: result,
          type: 'qr',
          aid,
        })
      } catch (e: any) {
        results.push({
          account: account.username,
          accountName: meta.name,
          success: false,
          message: e.message,
          type: 'qr',
          aid,
        })
      }
    }

    return results
  }

  /**
   * 处理拍照签到
   */
  async handlePhoto(
    aid: string,
    photoPath: string,
    info: { courseName: string; courseId: number; classId: number },
  ): Promise<CheckinResult[]> {
    const results: CheckinResult[] = []

    for (const account of this.accountManager.getAccounts()) {
      const meta = this.accountManager.getMeta(account.username)
      try {
        const result = await CheckinEngine.photoCheckin(
          meta, aid, photoPath, { courseId: info.courseId, classId: info.classId },
        )
        results.push({
          account: account.username,
          accountName: meta.name,
          success: result.includes('success') || result.includes('签到成功'),
          message: result,
          type: 'photo',
          courseName: info.courseName,
          aid,
        })
      } catch (e: any) {
        results.push({
          account: account.username,
          accountName: meta.name,
          success: false,
          message: e.message,
          type: 'photo',
          courseName: info.courseName,
          aid,
        })
      }
    }

    return results
  }

  getHistory(): CheckinResult[] {
    return [...this.history].reverse()
  }
}

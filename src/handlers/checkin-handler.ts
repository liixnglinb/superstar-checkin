import { CheckinEngine } from '../core/checkin-engine'
import { logger } from '../utils/logger'
import { randomDelay } from '../utils/anti-detect'
import { retry } from '../utils/retry'
import { DEFAULTS } from '../constants'
import type { AccountMetaData, CheckinInfo, CheckinResult, AppConfig } from '../types'
import type { AccountManager } from '../providers/account-manager'

/** 统一成功判定：成功 / 签到成功 / 您已签到（重复提交但已签过，视同成功） */
function isSuccessMessage(result: string): boolean {
  return result.includes('success') || result.includes('签到成功') || result.includes('您已签到')
}

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
    // 根据配置启用 UA 轮换（防检测增强）
    CheckinEngine.useragentRotation = config.checkin.antiDetect.useragentRotation
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
      logger.info(`随机延迟 ${min}~${max} 秒后签到...`)
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
          success: isSuccessMessage(result),
          message: result,
          type: checkinInfo.type,
          courseName,
          aid,
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        }

        results.push(cr)
        this.history.push(cr)
        if (this.history.length > DEFAULTS.MAX_HISTORY) {
          this.history = this.history.slice(-DEFAULTS.MAX_HISTORY)
        }
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
          timestamp: Date.now(),
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
          this.config.geo.providers,
          this.config.geo.locationRadius,
        )

      case 'qr':
        throw new Error('二维码签到需要提供 enc 参数，请拖拽/上传二维码图片提交')

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
          success: isSuccessMessage(result),
          message: result,
          type: 'qr',
          aid,
          timestamp: Date.now(),
        })
      } catch (e: any) {
        results.push({
          account: account.username,
          accountName: meta.name,
          success: false,
          message: e.message,
          type: 'qr',
          aid,
          timestamp: Date.now(),
        })
      }
    }

    return results
  }

  getHistory(): CheckinResult[] {
    return [...this.history].reverse()
  }

  /** 清空签到历史（软件内「清空记录」用） */
  clearHistory(): void {
    this.history = []
    logger.info('签到历史已清空')
  }
}

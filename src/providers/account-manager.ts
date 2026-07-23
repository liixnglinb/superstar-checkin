import { login, validateCookie, getUserInfo } from '../core/login'
import * as storage from './storage'
import { logger } from '../utils/logger'
import { retry } from '../utils/retry'
import type { Account, AccountMetaData } from '../types'

export class AccountManager {
  private accounts: Account[]
  private refreshTimer: NodeJS.Timeout | null = null
  /** 刷新失败回调（看门狗/通知用） */
  onRefreshFail: ((username: string, err: Error) => void) | null = null

  constructor(accounts: Account[]) {
    this.accounts = accounts
  }

  /**
   * 检查并刷新所有账号的 Cookie
   */
  async checkAll(): Promise<void> {
    logger.info(`开始检查 ${this.accounts.length} 个账号的 Cookie...`)

    for (const account of this.accounts) {
      await this.refreshIfNeeded(account)
    }
  }

  /**
   * 刷新单个账号（如果 Cookie 失效）
   * @param force 为 true 时忽略已有 Cookie 的有效性，直接重新登录（强制刷新用）
   */
  private async refreshIfNeeded(account: Account, force = false): Promise<void> {
    const meta = this.getMeta(account.username)

    if (!force && meta?.cookie) {
      const valid = await validateCookie(meta.cookie)
      if (valid) {
        logger.success(`${meta.name} 的 Cookie 仍然有效`)
        return
      }
      logger.warn(`${account.username} 的 Cookie 已失效`)
    }

    // 优先使用配置中的 Cookie（绕过云端登录风控）
    if (!force && account.cookie) {
      logger.info(`使用配置文件中的 Cookie (${account.username})`)
      storage.set(`cookie_${account.username}`, account.cookie)
      storage.set(`uid_${account.username}`, account.uid || 0)
      storage.set(`fid_${account.username}`, account.fid || 0)

      const valid = await validateCookie(account.cookie)
      if (valid) {
        try {
          const userInfo = await getUserInfo(account.cookie)
          storage.set(`name_${account.username}`, userInfo.name)
          storage.set(`schoolname_${account.username}`, userInfo.schoolname)
          logger.success(`${userInfo.name} 的配置 Cookie 已生效`)
          return
        } catch (e: any) {
          logger.warn(`获取用户信息失败: ${e.message}，使用用户名代替`)
          storage.set(`name_${account.username}`, account.username)
          return
        }
      }
      logger.warn(`配置中的 Cookie 已失效，尝试重新登录...`)
    }

    // 重新登录
    const loginResult = await retry(
      () => login(account.username, account.password),
      { maxAttempts: 3, delayMs: 5000, label: `登录 ${account.username}` },
    )

    storage.set(`cookie_${account.username}`, loginResult.cookie)
    storage.set(`uid_${account.username}`, loginResult.uid)
    storage.set(`fid_${account.username}`, loginResult.fid)

    // 获取用户信息
    const userInfo = await getUserInfo(loginResult.cookie)
    storage.set(`name_${account.username}`, userInfo.name)
    storage.set(`schoolname_${account.username}`, userInfo.schoolname)

    logger.success(`${userInfo.name} 的凭据已刷新`)
  }

  /**
   * 获取账号元数据
   */
  getMeta(username: string): AccountMetaData {
    return {
      cookie: storage.get<string>(`cookie_${username}`) || '',
      uid: storage.get<number>(`uid_${username}`) || 0,
      fid: storage.get<number>(`fid_${username}`) || 0,
      name: storage.get<string>(`name_${username}`) || username,
      schoolname: storage.get<string>(`schoolname_${username}`) || '',
    }
  }

  /**
   * 获取所有账号
   */
  getAccounts(): Account[] {
    return [...this.accounts]
  }

  /**
   * 获取主账号（第一个）
   */
  getPrimary(): Account {
    return this.accounts[0]
  }

  /**
   * 启动 Cookie 定时自动刷新
   *
   * 旧实现只在启动时校验一次 Cookie；运行中途 Cookie 过期会导致静默签到失败。
   * 这里周期性校验并刷新每个账号的 Cookie（默认 6 小时一次）。
   * 首次调度会延迟一个随机时间，避免多个进程同时打登录接口。
   *
   * @param intervalMs 刷新间隔，默认 6 小时
   */
  startAutoRefresh(intervalMs: number = 6 * 60 * 60 * 1000) {
    if (this.refreshTimer) return
    const initialDelay = Math.floor(Math.random() * 60000) // 0~60s 错峰
    this.refreshTimer = setInterval(() => {
      this.refreshAll().catch(e => logger.error('Cookie 定时刷新出错', e))
    }, intervalMs)
    // 不阻塞启动：用一次性定时器错峰触发首次刷新
    setTimeout(() => {
      this.refreshAll().catch(e => logger.error('Cookie 定时刷新出错', e))
    }, initialDelay)
    logger.info(`已启动 Cookie 自动刷新（间隔 ${Math.round(intervalMs / 60000)} 分钟）`)
  }

  /** 立即校验并刷新所有账号（由定时任务或外部调用） */
  async refreshAll(): Promise<void> {
    for (const account of this.accounts) {
      try {
        await this.refreshIfNeeded(account)
      } catch (e: any) {
        logger.error(`账号 ${account.username} 刷新失败: ${e.message}`)
        this.onRefreshFail?.(account.username, e)
      }
    }
  }

  /**
   * 手动强制刷新某个账号（签到失败疑似 Cookie 失效时可由外部调用）
   */
  async forceRefresh(username: string): Promise<boolean> {
    const account = this.accounts.find(a => a.username === username)
    if (!account) return false
    try {
      await this.refreshIfNeeded(account, true)
      return true
    } catch (e: any) {
      logger.error(`强制刷新 ${username} 失败: ${e.message}`)
      return false
    }
  }
}

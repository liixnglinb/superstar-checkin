import jsdom from 'jsdom'
import { logger } from '../utils/logger'
import { EASEMOB } from '../constants'
import type { ImMessage } from '../types'
import { getProxyConfig } from '../providers/runtime-config'

const { JSDOM } = jsdom
const { window } = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://im.chaoxing.com/webim/me',
})

Object.defineProperty(global, 'window', { value: window, writable: true, configurable: true })
Object.defineProperty(global, 'navigator', { value: window.navigator, writable: true, configurable: true })
Object.defineProperty(global, 'location', { value: window.location, writable: true, configurable: true })
Object.defineProperty(global, 'document', { value: window.document, writable: true, configurable: true })
Object.defineProperty(global, 'WebSocket', { value: window.WebSocket, writable: true, configurable: true })

import '../sdk/Easemob-chat-3.6.3'

type MessageHandler = (message: ImMessage, cookie: string) => void

/**
 * 环信 IM 监听器
 *
 * 优化点（相对旧版）：
 * - 跟踪连接状态（isConnected），供看门狗判断是否需要告警；
 * - 记录最近一次成功连接时间，看门狗据此判断「长时间无活动」；
 * - token 定时刷新：IM token 会过期，过期后静默重连会失败，这里周期性重新获取并重连；
 * - 断线自动重连（带退避），避免 onError 里只重连一次就放弃。
 */
export class ImListener {
  private cookie = ''
  private uid = 0
  private handler: MessageHandler | null = null
  private connected = false
  private lastConnectedAt = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private refreshTimer: NodeJS.Timeout | null = null
  private reconnectAttempt = 0
  private tokenRefreshMs: number
  /** 连接状态回调（看门狗用） */
  onStatusChange: ((connected: boolean) => void) | null = null

  constructor(tokenRefreshMs = 20 * 60 * 1000) {
    this.tokenRefreshMs = tokenRefreshMs
    this.setupWebIM()
  }

  onMessage(handler: MessageHandler) {
    this.handler = handler
  }

  isConnected(): boolean {
    return this.connected
  }

  getLastConnectedAt(): number {
    return this.lastConnectedAt
  }

  private setupWebIM() {
    const W: any = window as any

    W.WebIM.config = {
      xmppURL: EASEMOB.XMPP_URL,
      apiURL: EASEMOB.API_URL,
      appkey: EASEMOB.APP_KEY,
      Host: 'easemob.com',
      https: true,
      isHttpDNS: false,
      isMultiLoginSessions: true,
      isAutoLogin: true,
      isWindowSDK: false,
      isSandBox: false,
      isDebug: false,
      autoReconnectNumMax: Number.POSITIVE_INFINITY,
      autoReconnectInterval: 2,
      isWebRTC: true,
      heartBeatWait: 2000,
      delivery: false,
    }

    W.WebIM.conn = new W.WebIM.connection({
      appKey: W.WebIM.config.appkey,
      isHttpDNS: W.WebIM.config.isHttpDNS,
      isMultiLoginSessions: W.WebIM.config.isMultiLoginSessions,
      host: W.WebIM.config.Host,
      https: W.WebIM.config.https,
      url: W.WebIM.config.xmppURL,
      apiUrl: W.WebIM.config.apiUrl,
      isAutoLogin: false,
      heartBeatWait: W.WebIM.config.heartBeatWait,
      autoReconnectNumMax: W.WebIM.config.autoReconnectNumMax,
      autoReconnectInterval: W.WebIM.config.autoReconnectInterval,
      delivery: W.WebIM.config.delivery,
      isDebug: W.WebIM.config.isDebug,
    })

    W.WebIM.conn.listen({
      onOpened: () => {
        this.connected = true
        this.lastConnectedAt = Date.now()
        this.reconnectAttempt = 0
        logger.success('IM 协议连接成功')
        this.onStatusChange?.(true)
      },
      onClosed: () => {
        this.connected = false
        logger.warn('IM 协议连接关闭，准备重连')
        this.onStatusChange?.(false)
        this.scheduleReconnect()
      },
      onTextMessage: (message: ImMessage) => {
        logger.debug('IM 收到消息', JSON.stringify(message).substring(0, 200))
        this.handler?.(message, this.cookie)
      },
      onEmojiMessage: () => {},
      onPictureMessage: () => {},
      onCmdMessage: () => {},
      onAudioMessage: () => {},
      onLocationMessage: () => {},
      onFileMessage: () => {},
      onVideoMessage: () => {},
      onPresence: () => {},
      onRoster: () => {},
      onInviteMessage: () => {},
      onOnline: () => {},
      onOffline: () => logger.warn('IM 下线'),
      onError: async (message: any) => {
        logger.warn('IM 协议错误', message)
        if (message.type === 40) {
          // 身份验证失败：重新获取 token 并重连
          W.WebIM.conn.close()
          logger.warn('IM 身份验证失败，重新获取 token 并重连...')
          this.scheduleReconnect(2000)
        }
      },
      onBlacklistUpdate: () => {},
    })
  }

  async connect(cookie: string, uid: number): Promise<void> {
    this.cookie = cookie
    this.uid = uid
    await this.openWithFreshToken()
    this.startTokenRefresh()
  }

  /** 重新拉取 IM token 并打开连接 */
  private async openWithFreshToken(): Promise<void> {
    const axios = (await import('axios')).default
    const cheerio = (await import('cheerio')).default

    const res = await axios.get('https://im.chaoxing.com/webim/me', {
      headers: {
        Cookie: this.cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      responseType: 'text',
      proxy: getProxyConfig(),
    })

    const $ = cheerio.load(res.data)
    const token = $('#myToken').text()
    if (!token) throw new Error('未能从 webim/me 页面获取 IM token（Cookie 可能已失效）')

    const W: any = window as any
    W.WebIM.conn.open({
      apiUrl: EASEMOB.API_URL,
      user: this.uid,
      accessToken: token,
      appKey: EASEMOB.APP_KEY,
    })
  }

  /** 断线后按退避间隔重连，避免雪崩 */
  private scheduleReconnect(delayMs = 5000) {
    if (this.reconnectTimer) return
    const backoff = Math.min(delayMs * Math.pow(2, this.reconnectAttempt), 60000)
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        logger.info(`IM 重连中（第 ${this.reconnectAttempt} 次）...`)
        await this.openWithFreshToken()
      } catch (e: any) {
        logger.error(`IM 重连失败: ${e.message}`)
        this.scheduleReconnect()
      }
    }, backoff)
  }

  /** 周期性刷新 token（保持会话不过期） */
  private startTokenRefresh() {
    if (this.refreshTimer) return
    this.refreshTimer = setInterval(async () => {
      if (!this.connected) return // 未连接时交给重连逻辑处理
      try {
        await this.openWithFreshToken()
        logger.debug('IM token 已刷新')
      } catch (e: any) {
        logger.warn(`IM token 刷新失败: ${e.message}`)
      }
    }, this.tokenRefreshMs)
  }

  dispose() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.refreshTimer) clearInterval(this.refreshTimer)
    this.reconnectTimer = null
    this.refreshTimer = null
  }
}

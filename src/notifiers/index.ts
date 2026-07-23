import axios from 'axios'
import { logger } from '../utils/logger'
import type { NotifyChannel } from '../types'

export interface Notifier {
  send(title: string, content: string): Promise<void>
}

/**
 * 通知管理器：向所有已启用的通道发送通知
 */
export class NotificationManager {
  private notifiers: Map<string, Notifier> = new Map()

  constructor(channels: NotifyChannel[]) {
    for (const ch of channels) {
      if (!ch.enabled) continue

      switch (ch.type) {
        case 'pushplus':
          this.notifiers.set('pushplus', new PushPlusNotifier(ch.config.token))
          break
        case 'bark':
          this.notifiers.set('bark', new BarkNotifier(ch.config.url, ch.config.key))
          break
        case 'dingtalk':
          this.notifiers.set('dingtalk', new DingTalkNotifier(ch.config.webhook, ch.config.secret))
          break
        case 'email':
          this.notifiers.set('email', new EmailNotifier(ch.config))
          break
      }
    }

    logger.info(`已启用 ${this.notifiers.size} 个通知通道`)
  }

  async notify(title: string, content: string): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.notifiers.entries()).map(async ([name, notifier]) => {
        try {
          await notifier.send(title, content)
          logger.debug(`${name} 通知已发送: ${title}`)
        } catch (e: any) {
          logger.error(`${name} 通知发送失败: ${e.message}`)
          throw e
        }
      }),
    )

    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length === this.notifiers.size && this.notifiers.size > 0) {
      logger.error(`全部 ${this.notifiers.size} 个通知通道均发送失败，用户可能无法收到: ${title}`)
    }
  }
}

// ============ 具体通知实现 ============

class PushPlusNotifier implements Notifier {
  constructor(private token: string) {}

  async send(title: string, content: string): Promise<void> {
    await axios.post('https://www.pushplus.plus/send', {
      token: this.token,
      title,
      content,
      template: 'txt',
    })
  }
}

class BarkNotifier implements Notifier {
  constructor(private url: string, private key: string) {}

  async send(title: string, content: string): Promise<void> {
    const base = this.url || 'https://api.day.app'
    await axios.post(`${base}/${this.key}`, {
      title,
      body: content,
      group: '学习通签到',
    })
  }
}

class DingTalkNotifier implements Notifier {
  constructor(private webhook: string, private secret?: string) {}

  async send(title: string, content: string): Promise<void> {
    let url = this.webhook

    if (this.secret) {
      const crypto = await import('crypto')
      const timestamp = Date.now()
      const sign = crypto
        .createHmac('sha256', this.secret)
        .update(`${timestamp}\n${this.secret}`)
        .digest('base64')
      url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
    }

    await axios.post(url, {
      msgtype: 'markdown',
      markdown: { title, text: `### ${title}\n\n${content}` },
    })
  }
}

class EmailNotifier implements Notifier {
  constructor(private config: Record<string, any>) {}

  async send(title: string, content: string): Promise<void> {
    // 使用 nodemailer（需额外安装）
    try {
      const nodemailer = require('nodemailer')
      const transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort || 465,
        secure: true,
        auth: { user: this.config.from, pass: this.config.password },
      })
      await transporter.sendMail({
        from: this.config.from,
        to: this.config.to,
        subject: title,
        text: content,
      })
    } catch {
      logger.warn('邮件通知需要安装 nodemailer: npm install nodemailer')
    }
  }
}

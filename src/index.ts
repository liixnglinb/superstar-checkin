import { logger } from './utils/logger'
import { loadConfig } from './providers/config'
import { initStorage } from './providers/storage'
import { AccountManager } from './providers/account-manager'
import { ImListener } from './listeners/im-listener'
import { PollListener } from './listeners/poll-listener'
import { CheckinHandler } from './handlers/checkin-handler'
import { NotificationManager } from './notifiers'
import { CheckinEngine } from './core/checkin-engine'
import { getCourseList } from './core/course'
import { initLocationStore } from './utils/location'
import { DingTalkServer } from './server/dingtalk-server'
import { decodeQrFromBuffer } from './utils/qr-decoder'
import { setProxy } from './providers/runtime-config'
import {
  markProcessed,
  setPendingQr,
  takeLatestPendingQr,
  hasPendingQr,
  setPendingPhoto,
  takeLatestPendingPhoto,
  hasPendingPhoto,
  setCurrentPhoto,
  getCurrentPhoto,
} from './providers/sign-state'
import type { ImMessage, CheckinInfo } from './types'

import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'

// 全局错误兜底
process.on('unhandledRejection', (reason) => logger.error('未处理的 Promise 拒绝:', reason))
// uncaughtException 后进程状态不确定，记录后退出 1（Node 官方推荐）
process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常，进程将退出:', err)
  process.exit(1)
})

async function main() {
  // 1. 加载配置
  logger.info('=== ChaoXing Auto Sign v3.1 ===')
  const config = loadConfig()

  // 2. 初始化
  logger.configure(config.log.level, config.log.file)
  initStorage(config.storage.dataDir)
  initLocationStore(config.storage.dataDir)
  setProxy(config.proxy) // 代理全局生效（登录/签到请求均可走）

  // 拍照签到：上传图片暂存目录与保存助手
  const photoDir = path.join(config.storage.dataDir, 'photos')
  if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true })
  const savePhotoBuffer = (buf: Buffer): string => {
    const p = path.join(photoDir, `upload_${Date.now()}.jpg`)
    fs.writeFileSync(p, buf)
    return p
  }

  // 上传页服务：独立于登录，先启动，保证 3456 随时可用（不受代理/登录成败影响）
  let dtServer: DingTalkServer | null = null
  if (config.dingtalk?.port) {
    const dtPort = config.dingtalk.port || 3456
    dtServer = new DingTalkServer(dtPort, config.dingtalk.appSecret, {
      appKey: config.dingtalk.appKey,
      token: config.web?.token,
      allowedOrigin: config.web?.allowedOrigin,
    })
    dtServer.start()
    logger.info(`上传页服务已启动: http://0.0.0.0:${dtPort}`)
  }

  // 3. 通知管理器（先初始化，供账号刷新失败等回调引用，避免 TDZ）
  const notifier = new NotificationManager(config.notify.channels)

  // 4. 账号管理（登录失败不致命：上传页/二维码通道仍应可用，待代理/网络恢复后重试）
  const accountManager = new AccountManager(config.accounts)
  try {
    await accountManager.checkAll()
  } catch (e: any) {
    logger.error(`账号登录校验失败（上传页仍可用，待代理/网络恢复后重试）: ${e.message}`)
  }

  // Cookie 定时自动刷新（运行中途过期也不怕）
  accountManager.onRefreshFail = (username, err) => {
    notifier.notify('⚠️ Cookie 刷新失败', `账号 ${username} 刷新失败: ${err.message}`)
      .catch(() => {})
  }
  accountManager.startAutoRefresh()

  // 5. 签到处理器
  const checkinHandler = new CheckinHandler(config, accountManager)

  // 6. 获取课程列表
  const primaryMeta = accountManager.getMeta(config.accounts[0].username)
  const courses = await getCourseList(primaryMeta.cookie).catch((e: any) => {
    logger.error(`获取课程列表失败（不影响上传页）: ${e.message}`)
    return []
  })

  // 看门狗状态
  const watchdog = {
    lastActivityAt: Date.now(),
    imConnected: false,
    alerted: false,
  }

  // 7. 处理签到事件的统一函数（IM 与轮询共用，内部已做全局去重）
  const processCheckin = async (
    aid: string,
    courseId: number,
    classId: number,
    courseName: string,
  ) => {
    // 跨监听器去重：IM 与轮询可能同时捕获同一次签到
    if (markProcessed(aid)) {
      logger.info(`aid ${aid} 已处理，跳过重复签到`)
      return
    }

    try {
      const checkinInfo: CheckinInfo = await CheckinEngine.getDetail(primaryMeta.cookie, aid)
      logger.info(`签到类型: ${checkinInfo.type}`)

      if (checkinInfo.type === 'qr') {
        setPendingQr(aid, { courseName })
        logger.warn(`${courseName} 是二维码签到，等待上传图片`)

        const baseUrl = config.dingtalk?.publicUrl || `http://127.0.0.1:${config.dingtalk?.port || 3456}`
        const uploadUrl = `${baseUrl}/upload?type=qr${config.dingtalk?.token ? `&token=${encodeURIComponent(config.dingtalk.token)}` : ''}`

        await notifier.notify(
          `⚠️ ${courseName} - 二维码签到`,
          `请拍教室里的签到二维码上传\naid: ${aid}\n\n手机上传: ${uploadUrl}`,
        )
        return
      }

      if (checkinInfo.type === 'photo') {
        const defaultPhoto = getCurrentPhoto() || config.photo?.path
        if (defaultPhoto && fs.existsSync(defaultPhoto)) {
          logger.info(`${courseName} 是拍照签到，使用已配置的默认照片: ${defaultPhoto}`)
          const results = await checkinHandler.handlePhoto(aid, defaultPhoto, { courseName, courseId, classId })
          const summary = results.map(r => `${r.accountName}: ${r.success ? '✅' : '❌'} ${r.message}`).join('\n')
          await notifier.notify(`✅ ${courseName} 拍照签到结果`, summary)
        } else {
          setPendingPhoto(aid, { courseName, courseId, classId })
          logger.warn(`${courseName} 是拍照签到，等待上传照片`)
          const baseUrl = config.dingtalk?.publicUrl || `http://127.0.0.1:${config.dingtalk?.port || 3456}`
          const uploadUrl = `${baseUrl}/upload?type=photo${config.dingtalk?.token ? `&token=${encodeURIComponent(config.dingtalk.token)}` : ''}`
          await notifier.notify(
            `⚠️ ${courseName} - 拍照签到`,
            `请上传一张照片（与二维码签到同模式）\naid: ${aid}\n\n手机上传: ${uploadUrl}`,
          )
        }
        return
      }

      const results = await checkinHandler.handle(aid, courseId, classId, courseName, checkinInfo)
      const summary = results.map(r => `${r.accountName}: ${r.success ? '✅' : '❌'} ${r.message}`).join('\n')
      await notifier.notify(`✅ ${courseName} 签到结果`, summary)
    } catch (e: any) {
      logger.error(`处理签到失败: ${e.message}`)
      await notifier.notify('❌ 签到异常', `${courseName} aid:${aid}\n${e.message}`)
    }
  }

  // 8. 启动监听器
  let imListener: ImListener | null = null
  if (config.listener.mode === 'im' || config.listener.mode === 'hybrid') {
    imListener = new ImListener()
    imListener.onStatusChange = (connected) => {
      watchdog.imConnected = connected
      if (connected) watchdog.lastActivityAt = Date.now()
    }
    imListener.onMessage(async (message: ImMessage, cookie: string) => {
      try {
        if (!message.ext?.attachment) return
        if (message.ext.attachment.attachmentType !== 15) return

        const att = message.ext.attachment.att_chat_course
        const aid = String(att.aid)
        const courseName = att.courseInfo.coursename
        const courseId = Number(att.courseInfo.courseid)
        const classId = Number(att.courseInfo.classid)

        // 判断是否为签到
        const isCheckin = att.atype === 2 ||
          (att.atype === 0 && (
            att.pcUrl?.toLowerCase().includes('sign') ||
            att.url?.toLowerCase().includes('sign') ||
            att.logo?.toLowerCase().includes('qd3.png') ||
            att.title?.includes('签到')
          ))

        if (isCheckin) {
          logger.info(`IM 收到签到: ${courseName} (aid: ${aid})`)
          watchdog.lastActivityAt = Date.now()
          await processCheckin(aid, courseId, classId, courseName)
        } else if (att.atypeName) {
          logger.info(`IM 收到活动: ${courseName} - ${att.atypeName} (aid: ${aid})`)
        }
      } catch (e: any) {
        logger.error('处理 IM 消息异常:', e)
      }
    })

    try {
      await imListener.connect(primaryMeta.cookie, primaryMeta.uid)
    } catch (e: any) {
      logger.error(`IM 连接失败（轮询/上传页仍可用）: ${e.message}`)
    }
  }

  if (config.listener.mode === 'poll' || config.listener.mode === 'hybrid') {
    if (courses.length === 0) {
      logger.error('课程列表为空，轮询监听器将以空列表启动（无法发现任何签到），请检查登录/Cookie 是否正常')
      await notifier.notify('⚠️ 轮询监听异常', '课程列表为空，轮询无法发现签到活动，请检查登录状态')
        .catch(() => {})
    }
    const pollListener = new PollListener(config.listener.pollInterval)
    pollListener.onActivity((aid, courseId, classId, courseName) => {
      watchdog.lastActivityAt = Date.now()
      processCheckin(aid, courseId, classId, courseName)
    })
    try {
      pollListener.start(primaryMeta.cookie, courses)
    } catch (e: any) {
      logger.error(`轮询监听器启动失败（不影响上传页）: ${e.message}`)
    }
  }

  // 9. 钉钉回调服务器图片处理（服务已在启动早期创建并启动，这里仅绑定 onImage 回调）
  if (dtServer) {
    dtServer.onImage(async (imageBuffer: Buffer, type?: 'qr' | 'photo') => {
      // 按上传页声明的类型路由；未声明类型时维持原 QR 优先逻辑（钉钉机器人回调无类型）
      if (type === 'photo') {
        if (hasPendingPhoto()) {
          const pending = takeLatestPendingPhoto()
          if (!pending) return
          const { aid, info } = pending
          const photoPath = savePhotoBuffer(imageBuffer)
          logger.info(`收到拍照签到照片，开始上传... (aid: ${aid})`)
          const results = await checkinHandler.handlePhoto(aid, photoPath, info)
          const summary = results
            .map(r => `${r.accountName}: ${r.success ? '✅' : '❌'} ${r.message}`)
            .join('\n')
          await notifier.notify('✅ 拍照签到结果', summary)
          return
        }
        // 声明是 photo 但无待处理：存为默认照片
        const photoPath = savePhotoBuffer(imageBuffer)
        setCurrentPhoto(photoPath)
        logger.info(`已保存默认照片: ${photoPath}`)
        await notifier.notify('📷 已保存默认照片', '后续拍照签到将直接使用此照片')
        return
      }

      // qr 或未声明类型：二维码优先
      if (hasPendingQr()) {
        const pending = takeLatestPendingQr()
        if (!pending) return
        const { aid, info } = pending

        logger.info(`收到二维码图片，正在解析... (aid: ${aid})`)
        const enc = await decodeQrFromBuffer(imageBuffer, config.ocr)

        if (!enc) {
          // 解析失败则保留待处理状态，便于用户重试
          setPendingQr(aid, { courseName: info.courseName })
          logger.error('未能从图片中解析出二维码 enc 参数')
          await notifier.notify('❌ 二维码解析失败', '请确认拍到的是学习通签到二维码')
          return
        }

        logger.info(`解析到 enc: ${enc}，开始签到...`)
        const results = await checkinHandler.handleQr(aid, enc)
        const summary = results
          .map(r => `${r.accountName}: ${r.success ? '✅' : '❌'} ${r.message}`)
          .join('\n')
        await notifier.notify('✅ 二维码签到结果', summary)
        return
      }

      // 其次：拍照签到
      if (hasPendingPhoto()) {
        const pending = takeLatestPendingPhoto()
        if (!pending) return
        const { aid, info } = pending
        const photoPath = savePhotoBuffer(imageBuffer)
        logger.info(`收到拍照签到照片，开始上传... (aid: ${aid})`)
        const results = await checkinHandler.handlePhoto(aid, photoPath, info)
        const summary = results
          .map(r => `${r.accountName}: ${r.success ? '✅' : '❌'} ${r.message}`)
          .join('\n')
        await notifier.notify('✅ 拍照签到结果', summary)
        return
      }

      // 没有待处理签到：把这张图存为默认照片，供以后拍照签到复用
      const photoPath = savePhotoBuffer(imageBuffer)
      setCurrentPhoto(photoPath)
      logger.info(`已保存默认照片: ${photoPath}`)
      await notifier.notify('📷 已保存默认照片', '后续拍照签到将直接使用此照片')
    })
  }

  // 9.5 看门狗：检测「漏签风险」并告警
  // - IM 模式但连接已断开（且没有开 poll 兜底）
  // - 长时间未收到任何活动（可能进程假死 / 网络中断）
  const WATCHDOG_INTERVAL = 5 * 60 * 1000
  const ACTIVITY_TIMEOUT = 30 * 60 * 1000
  setInterval(() => {
    const now = Date.now()
    const imDown = config.listener.mode !== 'poll' && !watchdog.imConnected
    const stale = now - watchdog.lastActivityAt > ACTIVITY_TIMEOUT

    if ((imDown || stale) && !watchdog.alerted) {
      const reasons: string[] = []
      if (imDown) reasons.push('IM 连接已断开且未开启轮询兜底')
      if (stale) reasons.push(`已超过 ${ACTIVITY_TIMEOUT / 60000} 分钟无活动`)
      const reason = reasons.join('；')
      logger.error(`看门狗告警: ${reason}`)
      notifier.notify('🚨 签到看门狗告警', `${reason}\n请检查服务是否正常运行，避免漏签。`)
        .catch(() => {})
      watchdog.alerted = true
    } else if (!imDown && !stale) {
      watchdog.alerted = false // 恢复正常后允许下次再告警
    }
  }, WATCHDOG_INTERVAL)

  logger.success('系统初始化完毕')
  logger.info('')
  logger.info('手动签到: 输入 签到 <aid> [enc|courseId]')
  logger.info('查看历史: 输入 历史')
  logger.info('查看课程: 输入 课程')
  logger.info('')

  // 10. 终端交互
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.on('line', async (line) => {
    const parts = line.trim().split(/\s+/)
    const cmd = parts[0]

    switch (cmd) {
      case '签到':
      case 'sign':
      case 'checkin': {
        const aid = parts[1]
        if (!aid) { logger.info('用法: 签到 <aid> [enc|courseId]'); return }
        const checkinInfo = await CheckinEngine.getDetail(primaryMeta.cookie, aid)
        if (checkinInfo.type === 'qr' && parts[2]) {
          const results = await checkinHandler.handleQr(aid, parts[2])
          results.forEach(r => logger.info(`${r.accountName}: ${r.message}`))
        } else {
          const courseId = parts[2] ? Number(parts[2]) : 0
          await processCheckin(aid, courseId, 0, '手动签到')
        }
        break
      }

      case '历史':
      case 'history': {
        const history = checkinHandler.getHistory()
        if (history.length === 0) { logger.info('暂无签到记录'); break }
        for (const r of history.slice(0, 10)) {
          logger.info(`${r.courseName || '未知'} | ${r.type} | ${r.success ? '✅' : '❌'} ${r.accountName}`)
        }
        break
      }

      case '课程':
      case 'courses': {
        for (const c of courses) {
          logger.info(`${c.courseName} | ID: ${c.courseId} | Class: ${c.classId}`)
        }
        break
      }

      default:
        if (cmd) logger.info('可用命令: 签到, 历史, 课程')
    }
  })

  // 11. 二维码 / 拍照 文件夹监听（图片经 OCR 解析或存为照片处理）
  const qrDir = path.join(process.cwd(), 'qrcode')
  if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true })

  const watched = new Set<string>()
  fs.watch(qrDir, async (_event, filename) => {
    if (!filename || !/\.(png|jpg|jpeg|bmp)$/i.test(filename)) return
    const filePath = path.join(qrDir, filename)
    if (watched.has(filePath)) return
    watched.add(filePath)
    if (watched.size > 100) watched.clear()

    await new Promise(r => setTimeout(r, 500))
    if (!fs.existsSync(filePath)) return

    try {
      logger.info(`检测到图片: ${filename}`)
      const buffer = fs.readFileSync(filePath)

      // 二维码优先
      if (hasPendingQr()) {
        const enc = await decodeQrFromBuffer(buffer, config.ocr)
        if (!enc) {
          logger.error('未能从文件夹图片中解析出二维码 enc 参数')
          return
        }
        const pending = takeLatestPendingQr()
        if (!pending) return
        logger.info(`解析到 enc: ${enc}，开始签到...`)
        const results = await checkinHandler.handleQr(pending.aid, enc)
        const summary = results.map(r => `${r.accountName}: ${r.success ? '✅' : '❌'} ${r.message}`).join('\n')
        await notifier.notify('✅ 二维码签到结果', summary)
        return
      }

      // 拍照签到
      if (hasPendingPhoto()) {
        const pending = takeLatestPendingPhoto()
        if (!pending) return
        const photoPath = savePhotoBuffer(buffer)
        logger.info(`文件夹图片作为拍照签到照片，开始上传... (aid: ${pending.aid})`)
        const results = await checkinHandler.handlePhoto(pending.aid, photoPath, pending.info)
        const summary = results.map(r => `${r.accountName}: ${r.success ? '✅' : '❌'} ${r.message}`).join('\n')
        await notifier.notify('✅ 拍照签到结果', summary)
        return
      }

      // 没有待处理签到：存为默认照片
      const photoPath = savePhotoBuffer(buffer)
      setCurrentPhoto(photoPath)
      logger.info(`已保存默认照片: ${photoPath}`)
    } catch (e: any) {
      logger.error(`图片处理失败: ${e.message}`)
    }
  })
}

main().catch(e => {
  logger.error('启动失败:', e)
  process.exit(1)
})

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
  unmarkProcessed,
  recordFail,
  clearFail,
  shouldRetryFail,
  setPendingQr,
  takeLatestPendingQr,
  hasPendingQr,
} from './providers/sign-state'
import type { ImMessage, CheckinInfo } from './types'
import { DEFAULTS } from './constants'

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

/** 全部账号签到失败时：撤销标记允许重试（带次数上限），避免一次性漏签 */
function allowRetryOnFailure(aid: string) {
  const n = recordFail(aid)
  if (shouldRetryFail(aid)) {
    logger.warn(`aid ${aid} 签到失败（第 ${n} 次），将允许下一轮重试`)
    unmarkProcessed(aid)
  } else {
    logger.error(`aid ${aid} 连续 ${n} 次失败，放弃重试`)
  }
}

function openBrowser(url: string) {
  const cp = require('child_process')
  const cmd =
    process.platform === 'win32'
      ? `cmd /c start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`
  cp.exec(cmd, (err: any) => { if (err) logger.warn(`自动打开浏览器失败: ${err.message}`) })
}

async function main() {
  // 1. 加载配置
  logger.info('=== ChaoXing Auto Sign v3.1 ===')
  const config = loadConfig()

  // 2. 初始化
  logger.configure(config.log.level, config.log.file)
  initStorage(config.storage.dataDir)
  initLocationStore(config.storage.dataDir)
  setProxy(config.proxy) // 代理全局生效（登录/签到请求均可走）

  // 控制台状态数据提供者（每次请求实时计算；闭包引用后续初始化的模块）
  // 注意：上传页服务先于业务模块启动，早期请求可能命中 TDZ，故全部包 try/catch
  const getConsoleStatus = () => {
    const base: any = {
      version: '3.1',
      mode: config.listener.mode,
      pollInterval: config.listener.pollInterval,
      port: config.dingtalk?.port || 3456,
      uptime: process.uptime(),
    }
    try {
      const history = checkinHandler.getHistory()
      const okRe = /成功|✅|已签到/
      const successCount = history.filter((r: any) => okRe.test(r.message || r.result)).length
      // 课程签到统计（每门课成功/失败次数，供课程页展示）
      const statsMap = new Map<string, { success: number; fail: number }>()
      for (const r of history) {
        const k = r.courseName || '未知课程'
        const e = statsMap.get(k) || { success: 0, fail: 0 }
        if (okRe.test((r as any).message || (r as any).result)) e.success++
        else e.fail++
        statsMap.set(k, e)
      }
      const courseStats = Array.from(statsMap.entries()).map(([course, s]) => ({
        course,
        success: s.success,
        fail: s.fail,
      }))
      // 补全前端需要展示的字段（result/timestamp/accountName）
      const recent = history.slice(0, 10).map((r: any) => ({
        time: r.time || '',
        courseName: r.courseName || '',
        type: r.type || '',
        result: r.message || r.result || '',
        accountName: r.accountName || r.account || '',
        timestamp: r.timestamp || Date.now(),
      }))
      // 今日签到统计（托盘菜单/日报用）：按当天 0 点起算
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const dayStartTs = dayStart.getTime()
      const todayRecords = history.filter((r: any) => (r.timestamp || 0) >= dayStartTs)
      const todaySuccess = todayRecords.filter((r: any) => okRe.test(r.message || r.result)).length
      const todayStats = { total: todayRecords.length, success: todaySuccess, fail: todayRecords.length - todaySuccess }
      return {
        ...base,
        accounts: config.accounts.map((a: any) => {
          const meta = accountManager.getMeta(a.username)
          return { username: a.username, name: meta?.name || '', schoolname: meta?.schoolname || '' }
        }),
        courses,
        watchCourses: config.watchCourses || [],
        courseStats,
        recent,
        recordCount: history.length,
        successCount,
        failCount: history.length - successCount,
        todayStats,
        cookieValid: !!primaryMeta.cookie,
        imConnected: watchdog.imConnected,
        qrPending: hasPendingQr(),
        notifyDesktop: config.notify.desktop !== false,
        quiet: config.notify.quiet,
        pollJitter: config.listener.pollJitter || 0,
        locationRadius: config.geo.locationRadius || 10,
        retryMaxAttempts: config.checkin.retry.maxAttempts,
        retryDelayMs: config.checkin.retry.delayMs,
        report: config.report,
      }
    } catch (e) {
      // 业务模块尚未初始化完成（服务刚启动被立即访问），返回基础信息
      return base
    }
  }

  // 重新拉取课程列表：小课程/新课程未出现时手动刷新，并重建轮询监听
  async function refreshCourses(): Promise<{ ok: boolean; count: number; message: string }> {
    if (!config.accounts.length || !primaryMeta.cookie) {
      return { ok: false, count: 0, message: '未配置账号，无法刷新课程列表' }
    }
    try {
      const fresh = await getCourseList(primaryMeta.cookie)
      courses = fresh
      applyWatchFilter()
      if (pollListener) pollListener.stop()
      if (config.listener.mode === 'poll' || config.listener.mode === 'hybrid') {
        const pl = new PollListener(config.listener.pollInterval, (config.listener.pollJitter || 0) * 1000)
        pl.onActivity((aid, courseId, classId, courseName) => {
          watchdog.lastActivityAt = Date.now()
          processCheckin(aid, courseId, classId, courseName)
        })
        pl.start(primaryMeta.cookie, watchedCourses)
        pollListener = pl
      }
      logger.success(`课程列表已刷新: ${fresh.length} 门，监听 ${watchedCourses.length} 门`)
      return { ok: true, count: fresh.length, message: `已刷新课程列表（${fresh.length} 门），监听 ${watchedCourses.length} 门` }
    } catch (e: any) {
      logger.error(`刷新课程列表失败: ${e.message}`)
      return { ok: false, count: 0, message: `刷新失败: ${e.message}` }
    }
  }

  // 上传页服务：独立于登录，先启动，保证 3456 随时可用（不受代理/登录成败影响）
  let dtServer: DingTalkServer | null = null
  if (config.dingtalk?.port) {
    const dtPort = config.dingtalk.port || 3456
    dtServer = new DingTalkServer(dtPort, config.dingtalk.appSecret, {
      appKey: config.dingtalk.appKey,
      token: config.web?.token,
      allowedOrigin: config.web?.allowedOrigin,
      statusProvider: getConsoleStatus,
      historyProvider: () => checkinHandler.getHistory(),
      clearHistory: () => checkinHandler.clearHistory(),
      sendTestNotify: () =>
        notifier.notify('✅ 测试通知', '通知通道工作正常\n（免打扰时段内桌面通知不会弹出）').catch(() => {}),
      refreshCourses,
      getLogFile: () => config.log.file || '',
    })
    dtServer.start()
    logger.info(`上传页服务已启动: http://0.0.0.0:${dtPort}`)
  }

  // 3. 通知管理器（先初始化，供账号刷新失败等回调引用，避免 TDZ）
  const notifier = new NotificationManager(config.notify.channels, {
    desktop: config.notify.desktop,
    quiet: config.notify.quiet,
  })

  // 4. 账号管理（无账号时以"未配置"状态启动，软件内引导填写；登录失败不致命：上传页/二维码通道仍应可用）
  const accountManager = new AccountManager(config.accounts)
  if (config.accounts.length === 0) {
    logger.warn('未配置账号：请在软件"设置"页填写学习通账号后重启（支持多用户各自登录）')
  } else {
    try {
      await accountManager.checkAll()
    } catch (e: any) {
      logger.error(`账号登录校验失败（上传页仍可用，待代理/网络恢复后重试）: ${e.message}`)
    }
  }

  // Cookie 定时自动刷新（运行中途过期也不怕）
  accountManager.onRefreshFail = (username, err) => {
    notifier.notify('⚠️ Cookie 刷新失败', `账号 ${username} 刷新失败: ${err.message}`)
      .catch(() => {})
  }
  accountManager.startAutoRefresh()

  // 5. 签到处理器
  const checkinHandler = new CheckinHandler(config, accountManager)

  // 6. 获取课程列表（courses/watchedCourses 可被「重新拉取课程列表」运行时刷新）
  const primaryMeta = config.accounts.length
    ? accountManager.getMeta(config.accounts[0].username)
    : { cookie: '', name: '', schoolname: '', uid: 0, fid: '' }
  let courses = config.accounts.length
    ? await getCourseList(primaryMeta.cookie).catch((e: any) => {
        logger.error(`获取课程列表失败（不影响上传页）: ${e.message}`)
        return []
      })
    : []

  // 按「监听课程」配置过滤：watchCourses 为空 = 监听全部；否则只监听勾选的课程
  let watchedCourses: typeof courses = []
  function applyWatchFilter() {
    const watchSet = new Set((config.watchCourses || []).map((c: any) => String(c)))
    watchedCourses = watchSet.size > 0
      ? courses.filter(c => watchSet.has(String(c.courseId)))
      : courses
    if (watchSet.size > 0) {
      logger.info(`按监听配置过滤课程: ${courses.length} 门 → 监听 ${watchedCourses.length} 门`)
    }
  }
  applyWatchFilter()

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
        clearFail(aid)
        logger.warn(`${courseName} 是二维码签到，等待上传图片`)

        const baseUrl = config.dingtalk?.publicUrl || `http://127.0.0.1:${config.dingtalk?.port || 3456}`
        const uploadUrl = `${baseUrl}/upload?type=qr${config.web?.token ? `&token=${encodeURIComponent(config.web.token)}` : ''}`

        await notifier.notify(
          `⚠️ ${courseName} - 二维码签到`,
          `请拍教室里的签到二维码上传\naid: ${aid}\n\n手机上传: ${uploadUrl}`,
        )
        return
      }

      if (checkinInfo.type === 'photo' || checkinInfo.type === 'gesture') {
        // 本软件已移除拍照/手势自动签到：检测到仅提示，不尝试自动提交
        const typeName = checkinInfo.type === 'photo' ? '拍照' : '手势'
        logger.warn(`${courseName} 是${typeName}签到，本软件已移除该类型自动签到，请在学习通中手动完成`)
        await notifier.notify(
          `⚠️ ${courseName} - ${typeName}签到`,
          `本软件不支持${typeName}签到自动完成，请在学习通 APP 中手动签到\naid: ${aid}`,
        )
        return
      }

      const results = await checkinHandler.handle(aid, courseId, classId, courseName, checkinInfo)
      const summary = results.map(r => `${r.accountName}: ${r.success ? '✅' : '❌'} ${r.message}`).join('\n')
      await notifier.notify(`✅ ${courseName} 签到结果`, summary)

      // 失败重试：全部账号失败则撤销标记，允许下一轮重试（有次数上限）
      const allFailed = results.length > 0 && results.every(r => !r.success)
      if (allFailed) allowRetryOnFailure(aid)
      else clearFail(aid)
    } catch (e: any) {
      logger.error(`处理签到失败: ${e.message}`)
      await notifier.notify('❌ 签到异常', `${courseName} aid:${aid}\n${e.message}`).catch(() => {})
      // 异常（getDetail 失败/Cookie 失效等）同样允许重试，带次数上限
      allowRetryOnFailure(aid)
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

    if (config.accounts.length > 0) {
      try {
        await imListener.connect(primaryMeta.cookie, primaryMeta.uid)
      } catch (e: any) {
        logger.error(`IM 连接失败（轮询/上传页仍可用）: ${e.message}`)
      }
    }
  }

  // 轮询监听器（模块级可变：支持「重新拉取课程列表」时重建）
  let pollListener: PollListener | null = null
  if (config.listener.mode === 'poll' || config.listener.mode === 'hybrid') {
    if (courses.length === 0) {
      logger.error('课程列表为空，轮询监听器将以空列表启动（无法发现任何签到），请检查登录/Cookie 是否正常')
      await notifier.notify('⚠️ 轮询监听异常', '课程列表为空，轮询无法发现签到活动，请检查登录状态')
        .catch(() => {})
    }
    pollListener = new PollListener(config.listener.pollInterval, (config.listener.pollJitter || 0) * 1000)
    pollListener.onActivity((aid, courseId, classId, courseName) => {
      watchdog.lastActivityAt = Date.now()
      processCheckin(aid, courseId, classId, courseName)
    })
    try {
      pollListener.start(primaryMeta.cookie, watchedCourses)
    } catch (e: any) {
      logger.error(`轮询监听器启动失败（不影响上传页）: ${e.message}`)
    }
  }

  // 9. 钉钉回调服务器图片处理（服务已在启动早期创建并启动，这里仅绑定 onImage 回调）
  if (dtServer) {
    dtServer.onImage(async (imageBuffer: Buffer) => {
      // 二维码签到：解析图片中的二维码（enc + aid），支持拖拽/上传任意签到码
      const payload = await decodeQrFromBuffer(imageBuffer, config.ocr)

      if (!payload) {
        logger.error('未能从图片中解析出二维码 enc 参数')
        await notifier.notify('❌ 二维码解析失败', '请确认拖入/上传的是学习通签到二维码图片')
        return
      }

      // 优先使用软件已检测到的待处理签到；否则直接使用二维码自带的 aid（二维码更新后任意拖入即可）
      const pending = hasPendingQr() ? takeLatestPendingQr() : null
      const aid = pending?.aid || payload.aid
      if (!aid) {
        logger.warn('未检测到待处理签到，且二维码未包含活动编号，无法确定签到活动')
        await notifier.notify(
          '⚠️ 无法确定签到活动',
          '当前没有检测到待处理的签到，且该二维码未包含活动编号，请等签到发布后再拖入二维码',
        )
        return
      }

      logger.info(`解析到二维码 enc（aid=${aid}），开始签到...`)
      const results = await checkinHandler.handleQr(aid, payload.enc)
      const summary = results
        .map(r => `${r.accountName}: ${r.success ? '✅' : '❌'} ${r.message}`)
        .join('\n')
      await notifier.notify('✅ 二维码签到结果', summary)
      const allFailed = results.length > 0 && results.every(r => !r.success)
      if (allFailed) allowRetryOnFailure(aid)
      else clearFail(aid)
    })
  }

  // 9.5 看门狗：检测「漏签风险」并告警
  // - IM 模式但连接已断开（且没有开 poll 兜底）
  // - 长时间未收到任何活动（可能进程假死 / 网络中断）
  const WATCHDOG_INTERVAL = 5 * 60 * 1000
  const ACTIVITY_TIMEOUT = 30 * 60 * 1000
  setInterval(() => {
    const now = Date.now()
    const imDown = config.listener.mode === 'im' && !watchdog.imConnected
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

  // 9.55 每日签到日报：每天固定时间推送当日签到总结（桌面通知 + 已配置的外部通道）
  async function sendDailyReport() {
    try {
      const history = checkinHandler.getHistory()
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const okRe2 = /成功|✅|已签到/
      const today = history.filter((r: any) => (r.timestamp || 0) >= dayStart.getTime())
      const okCount = today.filter((r: any) => okRe2.test(r.message || r.result)).length
      const failList = today.filter((r: any) => !okRe2.test(r.message || r.result)).slice(0, 10)
      if (today.length === 0) {
        logger.info('日报：今天还没有签到记录')
        await notifier.notify('📊 今日签到日报', `今天（${dayStart.getMonth() + 1}月${dayStart.getDate()}日）还没有签到记录\n一切正常时表示今天无签到活动`)
        return
      }
      let content = `今日共处理 ${today.length} 次签到，成功 ${okCount} 次`
      if (failList.length > 0) {
        content += `，失败 ${failList.length} 次\n\n未成功签到：\n`
        content += failList.map((r: any) => `· ${r.courseName || '未知课程'} (${r.type || '普通'})`).join('\n')
      } else {
        content += '，全部成功 🎉'
      }
      await notifier.notify('📊 今日签到日报', content)
      logger.success('今日签到日报已推送')
    } catch (e: any) {
      logger.error(`日报发送失败: ${e.message}`)
    }
  }

  function scheduleDailyReport() {
    const now = new Date()
    const hour = Math.max(0, Math.min(23, config.report?.hour ?? DEFAULTS.REPORT_HOUR))
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0)
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
    const delay = next.getTime() - now.getTime()
    setTimeout(() => {
      if (config.report?.enabled !== false) {
        sendDailyReport().catch(() => {})
      }
      scheduleDailyReport()
    }, delay)
    logger.info(`每日签到日报已启用（每天 ${hour}:00 推送，当前${config.report?.enabled === false ? '关闭' : '开启'}）`)
  }
  if (config.report?.enabled !== false) scheduleDailyReport()

  // 9.6 自动打开控制台（GUI 打包环境通过 NO_OPEN_BROWSER 禁用）
  if (config.web?.openBrowser !== false && !process.env.NO_OPEN_BROWSER) {
    openBrowser(`http://127.0.0.1:${config.dingtalk?.port || 3456}/`)
  }

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

  // 11. 二维码文件夹监听（把签到二维码图片放进 qrcode 目录即可自动识别签到）
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

      // 二维码签到：解析图片中的二维码（enc + aid）
      const payload = await decodeQrFromBuffer(buffer, config.ocr)
      if (!payload) {
        logger.error('未能从文件夹图片中解析出二维码 enc 参数')
        return
      }
      const pending = hasPendingQr() ? takeLatestPendingQr() : null
      const aid = pending?.aid || payload.aid
      if (!aid) {
        logger.warn('未检测到待处理签到，且二维码未包含活动编号，无法确定签到活动')
        return
      }
      logger.info(`解析到二维码 enc（aid=${aid}），开始签到...`)
      const results = await checkinHandler.handleQr(aid, payload.enc)
      const summary = results.map(r => `${r.accountName}: ${r.success ? '✅' : '❌'} ${r.message}`).join('\n')
      await notifier.notify('✅ 二维码签到结果', summary)
      const allFailed = results.length > 0 && results.every(r => !r.success)
      if (allFailed) allowRetryOnFailure(aid)
      else clearFail(aid)
    } catch (e: any) {
      logger.error(`图片处理失败: ${e.message}`)
    }
  })
}

main().catch(e => {
  logger.error('启动失败:', e)
  process.exit(1)
})

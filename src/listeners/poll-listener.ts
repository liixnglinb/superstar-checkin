import { logger } from '../utils/logger'
import { getCourseActivities, type ActivityItem, type CourseInfo } from '../core/course'
import { CheckinEngine } from '../core/checkin-engine'
import type { AccountMetaData } from '../types'
import { isProcessed, trimProcessed } from '../providers/sign-state'

type ActivityHandler = (activeId: string, courseId: number, classId: number, courseName: string) => void

/**
 * 轮询监听器：定时检查课程活动列表，发现新的签到活动
 *
 * 去重：只调用 isProcessed 做「只查不标」判断，真正的标记由 processCheckin 统一完成。
 * 注意：不能在这里调用 markProcessed 直接标记——否则 processCheckin 内部二次判重
 * 会把轮询发现的签到全部跳过（此前纯 poll 模式 100% 漏签的回归 bug）。
 */
export class PollListener {
  private timer: NodeJS.Timeout | null = null
  private interval: number
  /** 随机抖动（毫秒）：每次轮询在固定间隔上叠加 0~jitter 随机值，降低规律性（防风控） */
  private jitterMs: number
  private handler: ActivityHandler | null = null

  constructor(intervalMs: number = 30000, jitterMs: number = 15000) {
    this.interval = intervalMs
    this.jitterMs = jitterMs
  }

  onActivity(handler: ActivityHandler) {
    this.handler = handler
  }

  start(cookie: string, courses: CourseInfo[]) {
    logger.info(`轮询监听已启动, 间隔 ${this.interval / 1000}s, 监控 ${courses.length} 门课程`)

    const poll = async () => {
      for (const course of courses) {
        try {
          const activities = await getCourseActivities(
            cookie,
            course.courseId,
            course.classId,
          )

          for (const act of activities) {
            // 只处理签到活动（activeType=2 或 activeType=0 但名字含"签到"）
            const isCheckin = act.activeType === 2 ||
              (act.activeType === 0 && act.name?.includes('签到'))

            // 只查不标：已处理（含 IM 已处理的情况）则跳过，标记交给 processCheckin
            if (isCheckin && !isProcessed(act.activeId)) {
              logger.info(`发现新签到: ${course.courseName} - ${act.name} (aid: ${act.activeId})`)
              this.handler?.(
                act.activeId,
                Number(course.courseId),
                Number(course.classId),
                course.courseName,
              )
            }
          }
        } catch (e: any) {
          logger.error(`轮询 ${course.courseName} 失败: ${e.message}`)
        }
      }

      // 清理旧记录防止内存泄漏
      trimProcessed(1000)
    }

    // 首次执行
    poll()

    // 定时执行（带随机抖动：interval + 0~jitter，防规律性被风控识别）
    const scheduleNext = () => {
      const jitter = this.jitterMs > 0 ? Math.floor(Math.random() * this.jitterMs) : 0
      this.timer = setTimeout(poll, this.interval + jitter)
    }
    const chain = async () => {
      await poll()
      if (this.timer) clearTimeout(this.timer)
      scheduleNext()
    }
    this.timer = setTimeout(chain, this.interval)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      logger.info('轮询监听已停止')
    }
  }
}

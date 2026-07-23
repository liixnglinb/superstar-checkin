import { logger } from '../utils/logger'
import { getCourseActivities, type ActivityItem, type CourseInfo } from '../core/course'
import { CheckinEngine } from '../core/checkin-engine'
import type { AccountMetaData } from '../types'
import { isProcessed, markProcessed, trimProcessed } from '../providers/sign-state'

type ActivityHandler = (activeId: string, courseId: number, classId: number, courseName: string) => void

/**
 * 轮询监听器：定时检查课程活动列表，发现新的签到活动
 *
 * 去重改用 sign-state 的全局集合，与 IM 监听器共享，避免 hybrid 模式下重复签到。
 */
export class PollListener {
  private timer: NodeJS.Timeout | null = null
  private interval: number
  private handler: ActivityHandler | null = null

  constructor(intervalMs: number = 30000) {
    this.interval = intervalMs
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

            // 用全局去重集合，标记返回 true 表示之前已处理（含 IM 已处理的情况）
            if (isCheckin && !markProcessed(act.activeId)) {
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

    // 定时执行
    this.timer = setInterval(poll, this.interval)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      logger.info('轮询监听已停止')
    }
  }
}

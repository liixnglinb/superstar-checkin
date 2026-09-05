import axios from 'axios'
import { PC_AGENT, API } from '../constants'
import { logger } from '../utils/logger'
import { getProxyConfig } from '../providers/runtime-config'

export interface CourseInfo {
  courseId: string
  classId: string
  courseName: string
  teacherName: string
  imageUrl: string
  /** 课程是否已结课/退休（学习通 isretire=1），结课后自动停用监听 */
  isRetired?: boolean
}

/** 把接口异常响应转成简洁可读的错误消息，避免整页 HTML 刷爆日志 */
function describeApiError(data: any): string {
  if (data && typeof data === 'object') {
    return JSON.stringify(data).substring(0, 200)
  }
  const text = String(data ?? '')
  if (text.includes('用户登录') || text.includes('<!DOCTYPE') || text.includes('<html')) {
    return '未登录或 Cookie 失效（接口返回登录页）'
  }
  return text.substring(0, 200)
}

/**
 * 获取用户当前学期的课程列表
 *
 * 稳定性说明：
 * - 显式携带 view=json&rss=1&pageSize=100 参数，避免接口默认分页行为变化导致课程缺失；
 * - 接口偶发 502/503/网络抖动，做最多 3 次退避重试（重试可救回大部分瞬时失败）；
 * - hasMore 为 true 时自动翻页合并（课程超过单页容量也不会漏）；
 * - 按 courseId+classId 去重（同一门课多个班级只保留不同的班）。
 */
export async function getCourseList(cookie: string): Promise<CourseInfo[]> {
  logger.info('正在获取课程列表...')

  const fetchPage = (pageIndex: number) =>
    axios.get(API.COURSE_LIST, {
      headers: { Cookie: cookie, 'User-Agent': PC_AGENT },
      params: { view: 'json', rss: 1, pageIndex, pageSize: 100 },
      proxy: getProxyConfig(),
      timeout: 20000,
    })

  // 瞬时错误（502/503/504/500/网络中断）退避重试；4xx 等确定性错误直接抛出
  let res: any = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetchPage(1)
      break
    } catch (e: any) {
      const status = e.response?.status
      const retriable = !status || status === 502 || status === 503 || status === 504 || status === 500
      if (!retriable || attempt >= 3) throw e
      logger.warn(`课程列表请求失败(${status || e.code})，第 ${attempt}/2 次重试...`)
      await new Promise(r => setTimeout(r, attempt * 800))
    }
  }

  if (!res.data || typeof res.data !== 'object' || res.data.result !== 1) {
    throw new Error('获取课程列表失败: ' + describeApiError(res.data))
  }

  const courses: CourseInfo[] = []
  const seen = new Set<string>()

  // hasMore 翻页合并（防御性：单页最多 100 门，超出时继续拉下一页）
  let page = 1
  for (;;) {
    const channelList = res.data.channelList || []
    for (const channel of channelList) {
      // 过滤非课程频道
      if (!channel.content || !channel.content.course) continue

      const course = channel.content.course
      const data = course.data?.[0]
      if (!data) continue

      const courseId = String(channel.key || data.courseId || '')
      // 学习通结构：channel.key 是 courseId；classId 在 course.data[0].id（课程空间 ID）。
      // 旧代码取 data.classId / channel.id，前者不存在、后者恒为 0，导致 classId 全空。
      const classId = String(data.id || data.classId || channel.id || '')
      const key = courseId + '|' + classId
      if (seen.has(key)) continue
      seen.add(key)

      courses.push({
        courseId,
        classId,
        courseName: data.name || data.courseName || '未知课程',
        teacherName: data.teacherfactor || data.teacherName || '',
        imageUrl: data.imageurl || '',
        isRetired: channel.content.isretire === 1,
      })
    }

    if (res.data.hasMore && page < 5) {
      page++
      res = await fetchPage(page)
      if (!res.data || typeof res.data !== 'object' || res.data.result !== 1) break
    } else {
      break
    }
  }

  logger.info(`获取到 ${courses.length} 门课程`)
  for (const c of courses) {
    logger.debug(`  - ${c.courseName} (ID: ${c.courseId}, Class: ${c.classId})`)
  }

  return courses
}

/**
 * 获取课程的活动列表（用于轮询模式）
 */
export interface ActivityItem {
  activeId: string
  activeType: number
  name: string
  startTime: number
  endTime: number
  status: number
}

export async function getCourseActivities(
  cookie: string,
  courseId: string,
  classId: string,
): Promise<ActivityItem[]> {
  const res = await axios.get('https://mobilelearn.chaoxing.com/v2/apis/active/student/activelist', {
    headers: {
      Cookie: cookie,
      'User-Agent': PC_AGENT,
    },
    params: {
      courseId,
      classId,
      showNotStarted: 0,
      fid: 0,
    },
    proxy: getProxyConfig(),
  })

  if (!res.data || typeof res.data !== 'object' || res.data.result !== 1) return []

  const activeList = res.data.data?.activeList || []
  return activeList.map((a: any) => ({
    activeId: String(a.id),
    activeType: a.activeType || 0,
    name: a.name || '',
    startTime: a.starttime || 0,
    endTime: a.endtime || 0,
    status: a.status || 0,
  }))
}

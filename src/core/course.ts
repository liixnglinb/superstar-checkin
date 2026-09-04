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
 */
export async function getCourseList(cookie: string): Promise<CourseInfo[]> {
  logger.info('正在获取课程列表...')

  const res = await axios.get(API.COURSE_LIST, {
    headers: {
      Cookie: cookie,
      'User-Agent': PC_AGENT,
    },
    proxy: getProxyConfig(),
  })

  if (!res.data || typeof res.data !== 'object' || res.data.result !== 1) {
    throw new Error('获取课程列表失败: ' + describeApiError(res.data))
  }

  const channelList = res.data.channelList || []
  const courses: CourseInfo[] = []

  for (const channel of channelList) {
    // 过滤非课程频道
    if (!channel.content || !channel.content.course) continue

    const course = channel.content.course
    const data = course.data?.[0]
    if (!data) continue

    courses.push({
      courseId: String(channel.key || data.courseId || ''),
      // 学习通结构：channel.key 是 courseId；classId 在 course.data[0].id（课程空间 ID）。
      // 旧代码取 data.classId / channel.id，前者不存在、后者恒为 0，导致 classId 全空。
      classId: String(data.id || data.classId || channel.id || ''),
      courseName: data.name || data.courseName || '未知课程',
      teacherName: data.teacherfactor || data.teacherName || '',
      imageUrl: data.imageurl || '',
    })
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

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

  if (res.data.result !== 1) {
    throw new Error('获取课程列表失败: ' + JSON.stringify(res.data))
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
      courseId: data.courseId || String(channel.key || ''),
      classId: data.classId || String(channel.id || ''),
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

  if (res.data.result !== 1) return []

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

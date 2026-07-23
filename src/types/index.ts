// ===================== 账号与用户 =====================

export interface Account {
  username: string
  password: string
  cookie?: string  // 浏览器预获取的 Cookie（跳过登录）
  uid?: number
  fid?: number
}

export interface AccountMetaData {
  cookie: string
  name: string
  schoolname: string
  uid: number
  fid: number
}

export interface LoginResult {
  cookie: string
  uid: number
  fid: number
}

export interface UserInfo {
  uid: number
  name: string
  schoolname: string
  phone: string
}

// ===================== 签到相关 =====================

export type CheckinType = 'normal' | 'gesture' | 'qr' | 'location' | 'photo'

export interface GeoLocation {
  courseId: number | string
  lat: number
  lon: number
  address: string
  onlyOnWeekdays?: number[]
}

export interface CheckinInfo {
  type: CheckinType
  location?: GeoLocation & { range: string }
}

export interface CheckinResult {
  account: string
  accountName: string
  success: boolean
  message: string
  type: CheckinType
  courseName?: string
  aid: string
  duration?: number
}

export interface CheckinRecord {
  time: string
  aid: string
  courseName: string
  type: string
  result: string
  account: string
  timestamp: number
}

// ===================== IM 消息 =====================

export interface ImMessage {
  id: string
  type: string
  from: string
  to: string
  data: string
  ext: {
    attachment?: {
      attachmentType: number
      att_chat_course: {
        aid: number
        atype: number
        atypeName: string
        courseInfo: {
          bbsid: string
          classid: number
          courseid: string
          coursename: string
        }
        logo: string
        pcUrl: string
        title: string
        url: string
      }
    }
  }
}

// ===================== API 响应 =====================

export interface LoginReturn {
  mes: string
  type: number
  url: string
  status: boolean
}

export interface CheckinDetailRet {
  result: number
  msg: string
  data: {
    id: number
    otherId: number
    ifphoto: number
    ifopenAddress: number
    locationText: string
    locationLatitude: string
    locationLongitude: string
    locationRange: string
    [key: string]: any
  }
}

// ===================== 配置 =====================

export interface AppConfig {
  /** 代理地址（如 http://127.0.0.1:7890）；留空或省略则不使用代理。
   *  用于把登录/签到请求走住宅代理，规避数据中心 IP 被学习通风控的问题。 */
  proxy?: string
  accounts: Account[]
  listener: {
    mode: 'im' | 'poll' | 'hybrid'
    pollInterval: number
  }
  checkin: {
    delay: { min: number; max: number }
    retry: { maxAttempts: number; delayMs: number }
    antiDetect: {
      enabled: boolean
      randomDelay: boolean
      useragentRotation: boolean
      gpsDrift: boolean
    }
  }
  geo: {
    locations: GeoLocation[]
    providers: {
      amapKey?: string
      baiduKey?: string
    }
  }
  notify: {
    channels: NotifyChannel[]
  }
  dingtalk?: {
    appKey: string
    appSecret: string
    port: number
    publicUrl?: string
  }
  ocr?: {
    provider: 'tencent' | 'zxing'
    tencent?: { secretId: string; secretKey: string }
  }
  web?: {
    port: number
    token?: string
    allowedOrigin?: string
  }
  /** 拍照签到：默认照片路径（可选）。留空则每次拍照签到需经上传链接提供照片。 */
  photo?: {
    path?: string
  }
  storage: {
    dataDir: string
  }
  log: {
    level: 'debug' | 'info' | 'warn' | 'error'
    file?: string
  }
}

export interface NotifyChannel {
  type: 'pushplus' | 'bark' | 'dingtalk' | 'email'
  enabled: boolean
  config: Record<string, any>
}

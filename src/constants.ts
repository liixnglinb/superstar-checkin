export const PC_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

export const MOBILE_AGENT =
  'Dalvik/2.1.0 (Linux; U; Android 14; Pixel 8 Build/UQ1A.240505.004) com.chaoxing.mobile/ChaoXingStudy_3_6.2.8_android_phone_680_72 (@Kalimdor)_a3b9f2c8e1d7456098b7c6d5e4f3a2b1'

export const MOBILE_AGENT_IOS =
  'com.chaoxing.mobile/ChaoXingStudy_3_6.2.8_iOS_phone (iPhone; iOS 17.5; Scale/3.00)'

// API 端点
export const API = {
  LOGIN: 'https://passport2-api.chaoxing.com/v11/loginregister',
  USER_INFO: 'https://sso.chaoxing.com/apis/login/userLogin4Uname.do',
  VALIDATE_COOKIE: 'https://i.mooc.chaoxing.com/space/',
  IM_TOKEN: 'https://im.chaoxing.com/webim/me',

  // 签到相关
  PRE_SIGN: 'https://mobilelearn.chaoxing.com/newsign/preSign',
  ANALYSIS: 'https://mobilelearn.chaoxing.com/pptSign/analysis',
  ANALYSIS2: 'https://mobilelearn.chaoxing.com/pptSign/analysis2',
  SIGN_AJAX: 'https://mobilelearn.chaoxing.com/pptSign/stuSignajax',
  CHECKIN_DETAIL: 'https://mobilelearn.chaoxing.com/v2/apis/active/getPPTActiveInfo',

  // 拍照签到：超星云盘上传
  PHOTO_TOKEN: 'https://pan-yz.chaoxing.com/api/token/uservalid',
  PHOTO_UPLOAD: 'https://pan-yz.chaoxing.com/upload',

  // 课程
  COURSE_LIST: 'https://mooc1-api.chaoxing.com/mycourse/backclazzdata',
} as const

// IM 协议配置
export const EASEMOB = {
  XMPP_URL: 'https://im-api-vip6-v2.easecdn.com/ws',
  API_URL: 'https://a1-vip6.easecdn.com',
  APP_KEY: 'cx-dev#cxstudy',
} as const

// 默认值
export const DEFAULTS = {
  POLL_INTERVAL: 30000,       // 轮询间隔 30 秒
  CHECKIN_DELAY_MIN: 15,      // 签到延迟下限（秒）
  CHECKIN_DELAY_MAX: 45,      // 签到延迟上限（秒）
  RETRY_MAX: 3,               // 最大重试次数
  RETRY_DELAY: 5000,          // 重试间隔（毫秒）
  GPS_DRIFT_MIN: 5,           // GPS 漂移下限（米）
  GPS_DRIFT_MAX: 30,          // GPS 漂移上限（米）
  TRIANGULATE_RADIUS: 50,     // 三角定位目标半径（米）
  MAX_HISTORY: 500,           // 签到历史最大条数
  MAX_LEARNED_LOC: 50,        // 已学坐标最大条数
  QR_API_PORT: 3456,          // QR API 默认端口
  BOT_WS_PORT: 8081,          // Bot WebSocket 端口
  BOT_CONNECT_TIMEOUT: 30000, // Bot 连接超时（毫秒）
  COOKIE_MAX_AGE: 2592000000, // Cookie 最大有效期 30 天（毫秒）
} as const

// 签到类型映射（otherId）
export const CHECKIN_TYPE_MAP: Record<number, string> = {
  0: 'normal',
  2: 'qr',
  3: 'gesture',
  4: 'location',
} as const

// 二维码正则
export const QR_REGEX = /(SIGNIN:|e\?).*(aid=|id=)(\d+)(&.*)?&enc=([\dA-F]+)/

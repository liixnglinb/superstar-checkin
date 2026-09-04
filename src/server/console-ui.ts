/**
 * 控制台 UI（软件主界面）
 *
 * 设计依据：taste-skill（反 AI 味设计）+ impeccable（Operate 模式质量底线）
 * - 色彩：冷灰中性底 + 单一 teal 主强调；成功/错误/警告为语义色
 * - 无：渐变文字、玻璃拟态、彩色左边框、等大图标卡墙、眉毛标签、emoji 图标
 * - 图标：内联 SVG，统一 1.5 描边
 * - 动效：克制的 hover 过渡与按压反馈
 */

export interface ConsoleStatus {
  version?: string
  mode?: string
  pollInterval?: number
  port?: number
  uptime?: number
  accounts?: Array<{ username: string; name?: string; schoolname?: string }>
  courses?: Array<{ courseName: string; courseId: number; classId: number }>
  watchCourses?: string[]
  /** 课程扫描健康：courseId -> 连续轮询失败次数（≥3 时 UI 显示"扫描异常"） */
  courseHealth?: Record<string, number>
  courseStats?: Array<{ course: string; success: number; fail: number }>
  recent?: Array<{ time: string; courseName: string; type: string; result: string; accountName: string; timestamp?: number }>
  recordCount?: number
  successCount?: number
  failCount?: number
  cookieValid?: boolean
  imConnected?: boolean
  qrPending?: boolean
  notifyDesktop?: boolean
  quiet?: { enabled: boolean; start: string; end: string }
  todayStats?: { total: number; success: number; fail: number }
  pollJitter?: number
  locationRadius?: number
  retryMaxAttempts?: number
  retryDelayMs?: number
  verifyEnabled?: boolean
  report?: { enabled: boolean; hour: number }
}

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
  courses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
  radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  // 品牌闹钟（与安装图标同语义：自动签到 + 准时）
  alarm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="6.5"/><path d="M12 10.5v3.2l2.2 1.4"/><path d="M8.8 2.8 7 5.4M15.2 2.8 17 5.4"/></svg>',
  // 窗口控制（自绘标题栏）
  winMin: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><path d="M2 6h8"/></svg>',
  winMax: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><rect x="2.5" y="2.5" width="7" height="7"/></svg>',
  winRestore: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><path d="M4.5 4.5V2.5h5v5h-2"/><rect x="2.5" y="4.5" width="5" height="5"/></svg>',
  winClose: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><path d="M2.8 2.8l6.4 6.4M9.2 2.8l-6.4 6.4"/></svg>',
  location: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16v18H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5.5 3.8 9.7 8 11 4.2-1.3 8-5.5 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>',
}

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtUptime(sec: number): string {
  const s = Math.floor(sec || 0)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${m} 分`
  return `${m} 分 ${s % 60} 秒`
}

function fmtTime(ts: any): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `今天 ${hm}`
  const yest = new Date(now.getTime() - 86400000)
  if (d.toDateString() === yest.toDateString()) return `昨天 ${hm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

function modeText(mode: string): string {
  if (mode === 'im') return 'IM 实时监听'
  if (mode === 'poll') return '轮询监听'
  return '混合模式（轮询兜底）'
}

function typeText(t: string): string {
  const map: Record<string, string> = { normal: '普通', gesture: '手势', qr: '二维码', location: '位置', photo: '拍照' }
  return map[t] || t
}

/** 生成完整控制台单页界面 */
export function getConsolePage(status: ConsoleStatus, token: string): string {
  const accounts = status.accounts || []
  const courses = status.courses || []
  const watchSet = new Set((status.watchCourses || []).map((c: any) => String(c)))
  const recent = status.recent || []
  const mode = status.mode || '-'
  const qs = token ? '?token=' + encodeURIComponent(token) : ''

  const accountRows = accounts.length
    ? accounts.map(a => `
      <div class="acct-row">
        <span class="acct-avatar">${esc((a.name || a.username || '?').slice(0, 1))}</span>
        <div class="acct-info">
          <div class="acct-name">${esc(a.name || a.username)}</div>
          <div class="acct-sub">${esc(a.schoolname || '')} · ${esc(a.username)}</div>
        </div>
        <span class="pill pill-ok">已登录</span>
      </div>`).join('')
    : `<div class="empty"><p>未配置账号</p><p class="empty-sub">首次使用请在"设置"页填写你的学习通账号（支持多用户各自登录）</p><a class="btn btn-ghost" href="#settings" style="margin-top:12px">去配置账号</a></div>`

  const courseRows = courses.length
    ? courses.map(c => {
        const watching = watchSet.size === 0 || watchSet.has(String(c.courseId))
        // 课程扫描健康：连续轮询失败 ≥3 次时提示"扫描异常"（多为瞬时网络/网关抖动，重试后自动恢复）
        const fails = (status.courseHealth || {})[String(c.courseId)] || 0
        const statePill = !watching
          ? '<span class="pill pill-off">已停用</span>'
          : fails >= 3
            ? '<span class="pill pill-warn" title="近期轮询多次失败，多为瞬时网络或网关限流，已自动重试；持续异常可点击「重新拉取课程列表」">扫描异常</span>'
            : '<span class="pill pill-ok">监控中</span>'
        return `
      <tr>
        <td class="cell-main">${esc(c.courseName)}</td>
        <td class="cell-mono">${c.courseId}</td>
        <td class="cell-mono">${c.classId}</td>
        <td>${statePill}</td>
        <td><button class="watch-toggle ${watching ? 'on' : ''}" data-cid="${esc(String(c.courseId))}">${watching ? '关闭监听' : '开启监听'}</button></td>
      </tr>`
      }).join('')
    : `<tr><td colspan="5" class="cell-empty">暂无课程数据</td></tr>`

  const recent2 = recent.map((r: any) => ({ ...r, timestamp: r.timestamp || r.time }))
  const recentRows = recent2.length
    ? recent.map(r => {
        const ok = /成功|✅|已签到/.test(r.result)
        const badge = ok ? '<span class="pill pill-ok">成功</span>' : '<span class="pill pill-err">失败</span>'
        return `
        <tr>
          <td class="cell-sub">${esc(fmtTime(r.timestamp))}</td>
          <td class="cell-main">${esc(r.courseName || '未知课程')}</td>
          <td class="cell-sub">${esc(typeText(r.type))}</td>
          <td class="cell-sub">${badge}</td>
        </tr>`
      }).join('')
    : `<tr><td colspan="4" class="cell-empty">还没有签到记录</td></tr>`

  const statCards = `
    <div class="stat-card">
      <div class="stat-ico" style="color:#0E7C66;background:#E3F2EC;">${ICONS.courses}</div>
      <div class="stat-num" id="stat-courses">${courses.length}</div>
      <div class="stat-label">监控课程</div>
    </div>
    <div class="stat-card">
      <div class="stat-ico" style="color:#2563EB;background:#E8EFFC;">${ICONS.history}</div>
      <div class="stat-num" id="stat-records">${status.recordCount ?? 0}</div>
      <div class="stat-label">累计记录</div>
    </div>
    <div class="stat-card">
      <div class="stat-ico" style="color:#178A5B;background:#E4F4EC;">${ICONS.check}</div>
      <div class="stat-num" id="stat-ok">${status.successCount ?? 0}</div>
      <div class="stat-label">签到成功</div>
    </div>
    <div class="stat-card">
      <div class="stat-ico" style="color:#D64545;background:#FBEBEB;">${ICONS.x}</div>
      <div class="stat-num" id="stat-fail">${status.failCount ?? 0}</div>
      <div class="stat-label">签到失败</div>
    </div>`

  const quiet = status.quiet || { enabled: false, start: '23:00', end: '07:00' }
  const settingsRows = `
    <div class="set-row"><span class="set-label">监听模式</span><span class="set-value">${esc(modeText(mode))}</span></div>
    <div class="set-row"><span class="set-label">轮询间隔</span><span class="set-value">${status.pollInterval ? status.pollInterval / 1000 + ' 秒' : '—'}</span></div>
    <div class="set-row"><span class="set-label">服务端口</span><span class="set-value">${esc(String(status.port || '—'))}</span></div>
    <div class="set-row"><span class="set-label">登录状态</span><span class="set-value">${status.cookieValid === false ? '<span class="pill pill-err">Cookie 失效</span>' : '<span class="pill pill-ok">Cookie 有效</span>'}</span></div>
    <div class="set-row"><span class="set-label">IM 通道</span><span class="set-value">${status.imConnected ? '<span class="pill pill-ok">已连接</span>' : '<span class="pill pill-warn">不可用（轮询兜底）</span>'}</span></div>
    <div class="set-row"><span class="set-label">配置文件</span><span class="set-value cell-mono">config.yaml（软件同目录，修改后重启生效）</span></div>`

  // 运行设置表单（保存到 config.yaml，重启生效）
  const settingsForm = `
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;max-width:620px;box-sizing:border-box">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label class="field-label" for="setPoll" style="width:104px">轮询间隔（秒）</label>
        <input class="field-input" id="setPoll" type="number" min="10" max="600" value="${Math.round((status.pollInterval || 30000) / 1000)}" style="width:120px">
        <span class="field-hint" style="line-height:1.5">10~600，越小发现签到越快，越频繁越可能被风控（默认 30）</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label class="field-label" for="setJitter" style="width:104px">轮询抖动（秒）</label>
        <input class="field-input" id="setJitter" type="number" min="0" max="120" value="${Math.round(status.pollJitter || 15)}" style="width:120px">
        <span class="field-hint" style="line-height:1.5">每次轮询叠加 0~抖动 的随机延迟，避免固定节奏被风控识别（0 = 关闭）</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label class="field-label" for="setRetry" style="width:104px">失败重试次数</label>
        <input class="field-input" id="setRetry" type="number" min="1" max="10" value="${status.retryMaxAttempts || 3}" style="width:120px">
        <label class="field-label" for="setRetryDelay" style="width:90px;margin-left:2px">重试间隔（秒）</label>
        <input class="field-input" id="setRetryDelay" type="number" min="1" max="120" value="${Math.round((status.retryDelayMs || 5000) / 1000)}" style="width:120px">
        <span class="field-hint" style="line-height:1.5">签到失败后自动重试的次数与间隔</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label class="field-label" for="setRadius" style="width:104px">位置半径（米）</label>
        <input class="field-input" id="setRadius" type="number" min="1" max="500" value="${Math.round(status.locationRadius || 10)}" style="width:120px">
        <span class="field-hint" style="line-height:1.5">以老师发布坐标为中心生成签到点（默认 10）</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label class="field-label" for="setDesktop" style="width:104px">桌面通知</label>
        <button class="switch ${status.notifyDesktop === false ? '' : 'on'}" id="setDesktop" type="button" role="switch"><span class="knob"></span></button>
        <span class="field-hint" style="line-height:1.5">签到成功/失败/二维码待签时弹出系统通知</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label class="field-label" for="setQuiet" style="width:104px">免打扰时段</label>
        <button class="switch ${quiet.enabled ? 'on' : ''}" id="setQuiet" type="button" role="switch"><span class="knob"></span></button>
        <input class="field-input" id="setQuietStart" type="time" value="${esc(quiet.start)}" style="width:110px">
        <span class="field-hint">至</span>
        <input class="field-input" id="setQuietEnd" type="time" value="${esc(quiet.end)}" style="width:110px">
        <span class="field-hint" style="line-height:1.5">期间不弹桌面通知，签到照常进行</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label class="field-label" for="setReport" style="width:104px">每日签到日报</label>
        <button class="switch ${status.report && status.report.enabled !== false ? 'on' : ''}" id="setReport" type="button" role="switch"><span class="knob"></span></button>
        <input class="field-input" id="setReportHour" type="number" min="0" max="23" value="${(status.report && status.report.hour) || 22}" style="width:80px">
        <span class="field-hint">点推送当天签到总结（成功/失败/未成功课程）</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label class="field-label" for="setVerify" style="width:104px">签到后二次核对</label>
        <button class="switch ${status.verifyEnabled === false ? '' : 'on'}" id="setVerify" type="button" role="switch"><span class="knob"></span></button>
        <span class="field-hint" style="line-height:1.5">提交成功后再次查询平台确认已签到，避免"显示成功实际没签上"（默认开启）</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label class="field-label" for="setAutoLaunch" style="width:104px">开机自启</label>
        <button class="switch" id="setAutoLaunch" type="button" role="switch"><span class="knob"></span></button>
        <span class="field-hint" style="line-height:1.5">开机后自动在后台运行，保证签到不中断</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px">
        <button class="btn btn-primary" id="settingsSaveBtn">保存设置</button>
        <button class="btn btn-ghost" id="notifyTestBtn">${ICONS.bell}<span>发送测试通知</span></button>
        <span class="cfg-msg" id="settingsMsg"></span>
      </div>
    </div>`

  // 账号管理：列表 + 添加表单
  const accountRows2 = accounts.length
    ? accounts.map((a, i) => `
      <div class="acct-row">
        <span class="acct-avatar">${esc((a.name || a.username || '?').slice(0, 1))}</span>
        <div class="acct-info">
          <div class="acct-name">${esc(a.name || a.username)}${i === 0 ? ' <span class="pill pill-ok">主账号</span>' : ''}</div>
          <div class="acct-sub">${esc(a.schoolname || '')} · ${esc(a.username)}</div>
        </div>
        ${i === 0 ? '' : `<button class="btn btn-ghost btn-sm" data-primary="${esc(a.username)}">设为主账号</button>`}
        <button class="btn btn-ghost btn-sm btn-danger" data-remove="${esc(a.username)}">${ICONS.trash}<span>删除</span></button>
      </div>`).join('')
    : `<div class="empty"><p>未配置账号</p><p class="empty-sub">添加学习通账号后，软件会用它自动签到（支持多账号，全部账号都会签到）</p></div>`

  const accountManageBox = `
    <div id="accountList">${accountRows2}</div>
    <div style="padding:16px 18px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:12px;max-width:520px;box-sizing:border-box">
      <div style="font-size:12.5px;font-weight:600;color:var(--text-2)">添加账号</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <input class="field-input" id="cfgUsername" type="text" placeholder="学习通账号（手机号）" autocomplete="off" style="width:100%">
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <input class="field-input" id="cfgPassword" type="password" placeholder="密码" style="width:100%">
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn btn-primary" id="cfgSaveBtn">添加账号</button>
        <span class="cfg-msg" id="cfgMsg"></span>
      </div>
      <p class="field-hint">添加/删除/切换主账号后需重启软件生效。第一个账号（主账号）负责课程轮询监听，所有账号都会自动签到。账号保存在 config.yaml，请妥善保管。</p>
    </div>`

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>学习通自动签到</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --canvas:#F6F4F1;--surface:#FFFFFF;--surface-2:#F1ECE7;
  --text:#211B17;--text-2:#6B5B51;--text-3:#9A8B80;
  --border:#E9E0D8;
  --accent:#C24E2E;--accent-strong:#A83F22;--accent-weak:#FBE9E1;
  --ok:#178A5B;--err:#D64545;--warn:#B7791F;
  --radius-lg:14px;--radius-sm:9px;
  --font:-apple-system,"Segoe UI Variable","Segoe UI","Microsoft YaHei UI","Microsoft YaHei",sans-serif;
}
html,body{height:100%}
body{font-family:var(--font);background:var(--canvas);color:var(--text);font-size:14px;line-height:1.5;overflow:hidden}
.shell{display:flex;flex-direction:column;height:100vh}
/* ===== 自绘标题栏（替代系统深色标题栏） ===== */
.titlebar{height:38px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;background:var(--surface);border-bottom:1px solid var(--border);-webkit-app-region:drag;user-select:none}
.titlebar-title{display:flex;align-items:center;gap:8px;padding-left:14px;font-size:12.5px;font-weight:500;color:var(--text-2);letter-spacing:.01em}
.titlebar-title svg{width:14px;height:14px;color:var(--accent)}
.titlebar-controls{display:flex;height:100%;-webkit-app-region:no-drag}
.win-btn{width:46px;height:100%;display:flex;align-items:center;justify-content:center;border:none;background:none;color:var(--text-2);cursor:pointer;transition:background .1s ease,color .1s ease}
.win-btn svg{width:11px;height:11px}
.win-btn:hover{background:var(--surface-2);color:var(--text)}
.win-close:hover{background:#E5484D;color:#fff}
/* 键盘焦点可见（可访问性） */
.btn:focus-visible,.watch-toggle:focus-visible,.switch:focus-visible,.nav-item:focus-visible,.win-btn:focus-visible,.modal-close:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.app{flex:1;display:flex;min-height:0}
/* ===== 左侧栏 ===== */
.side{width:224px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:16px 12px}
.brand{display:flex;align-items:center;gap:10px;padding:4px 8px 16px}
.brand-logo{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#F0805F,#D0512F);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 2px 8px rgba(208,81,47,.28)}
.brand-logo svg{width:22px;height:22px}
.brand-name{font-size:15px;font-weight:600;letter-spacing:-.01em}
.brand-ver{font-size:11px;color:var(--text-3);margin-top:1px}
.nav{display:flex;flex-direction:column;gap:2px;flex:1}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--radius-sm);color:var(--text-2);font-size:13.5px;cursor:pointer;border:none;background:none;width:100%;text-align:left;transition:background .12s ease,color .12s ease}
.nav-item svg{width:17px;height:17px;flex-shrink:0}
.nav-item:hover{background:var(--surface-2);color:var(--text)}
.nav-item.active{background:var(--accent-weak);color:var(--accent);font-weight:600}
.side-foot{border-top:1px solid var(--border);padding-top:12px;margin-top:12px}
.foot-row{display:flex;align-items:center;gap:8px;padding:2px 8px;font-size:12px;color:var(--text-2)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--ok);flex-shrink:0}
.foot-port{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--text-3)}
/* ===== 主区 ===== */
.main{flex:1;display:flex;flex-direction:column;min-width:0}
.topbar{height:60px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 28px;background:var(--surface);border-bottom:1px solid var(--border)}
.page-title{font-size:17px;font-weight:600;letter-spacing:-.01em}
.top-actions{display:flex;gap:10px}
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:var(--radius-sm);border:none;font-size:13px;font-weight:600;cursor:pointer;transition:transform .08s ease,background .12s ease,opacity .12s ease;font-family:var(--font)}
.btn svg{width:15px;height:15px}
.btn:active{transform:scale(.97)}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:var(--accent-strong)}
.btn-ghost{background:var(--surface);color:var(--text);border:1px solid var(--border)}
.btn-ghost:hover{background:var(--surface-2)}
.content{flex:1;overflow-y:auto;padding:24px 28px}
.view{display:none;animation:fadeIn .16s ease}
.view.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
/* ===== 总览 ===== */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;display:flex;flex-direction:column;gap:2px}
.stat-ico{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
.stat-ico svg{width:17px;height:17px}
.stat-num{font-size:24px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.stat-label{font-size:12.5px;color:var(--text-2)}
.section{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:16px;overflow:hidden}
.section-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)}
.section-title{font-size:14px;font-weight:600}
.section-more{font-size:12px;color:var(--text-3)}
.field-label{font-size:12.5px;font-weight:600;color:var(--text-2)}
.field-input{height:38px;padding:0 12px;border:1px solid var(--border);border-radius:8px;font-size:13.5px;color:var(--text);background:#fff;outline:none;transition:border-color .12s ease,box-shadow .12s ease;box-sizing:border-box}
.field-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(194,78,46,.13)}
.field-hint{font-size:12px;color:var(--text-3);line-height:1.7;margin:0}
.cfg-msg{font-size:12.5px;font-weight:600}
.drag-mask{position:fixed;inset:0;z-index:999;display:none;align-items:center;justify-content:center;background:rgba(194,78,46,.07);pointer-events:none}
.drag-mask.show{display:flex}
.drag-box{border:2px dashed var(--accent);border-radius:16px;background:var(--surface);padding:36px 60px;text-align:center;color:var(--accent);font-size:15px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.12)}
.drag-box small{display:block;margin-top:6px;font-size:12px;font-weight:400;color:var(--text-2)}
/* ===== 表格 ===== */
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;padding:10px 18px;font-size:12px;font-weight:600;color:var(--text-2);border-bottom:1px solid var(--border);background:var(--surface-2);letter-spacing:.02em}
td{padding:11px 18px;border-bottom:1px solid var(--border);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:#FCFAF8}
.cell-main{font-weight:500}
.cell-sub{color:var(--text-2);font-size:13px}
.cell-mono{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:var(--text-2);font-variant-numeric:tabular-nums}
.cell-empty{text-align:center;color:var(--text-3);padding:32px 0}
/* ===== 徽章/药丸 ===== */
.pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600}
.pill::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor}
.pill-ok{color:var(--ok);background:#E4F4EC}
.pill-err{color:var(--err);background:#FBEBEB}
.pill-warn{color:var(--warn);background:#FBF3E2}
/* ===== 账号 ===== */
.acct-row{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--border)}
.acct-row:last-child{border-bottom:none}
.acct-avatar{width:36px;height:36px;border-radius:9px;background:var(--accent-weak);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0}
.acct-info{flex:1;min-width:0}
.acct-name{font-weight:600;font-size:14px}
.acct-sub{font-size:12px;color:var(--text-2);margin-top:1px}
/* ===== 设置 ===== */
.set-row{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;border-bottom:1px solid var(--border);font-size:13.5px}
.set-row:last-child{border-bottom:none}
.set-label{color:var(--text-2)}
.set-value{font-weight:500;text-align:right}
/* ===== 功能总览卡 ===== */
.feature-grid{display:flex;flex-direction:column;gap:2px;padding:10px 18px}
.feature-item{display:flex;align-items:center;gap:12px;padding:10px 4px}
.feature-item+.feature-item{border-top:1px solid var(--border)}
.feature-ico{width:36px;height:36px;border-radius:10px;background:var(--accent-weak);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.feature-ico svg{width:17px;height:17px}
.feature-name{font-size:13.5px;font-weight:600}
.feature-desc{font-size:12.5px;color:var(--text-2);margin-top:2px;line-height:1.6}
/* ===== 课程监听开关 ===== */
.watch-bar{padding:10px 18px;font-size:12.5px;color:var(--text-3);border-bottom:1px solid var(--border);background:var(--surface)}
.watch-toggle{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text-2);font-size:12px;font-weight:600;cursor:pointer;transition:all .12s ease;font-family:var(--font)}
.watch-toggle:hover{border-color:var(--accent);color:var(--accent)}
.watch-toggle.on{background:var(--accent-weak);border-color:var(--accent);color:var(--accent)}
.pill-off{color:var(--text-3);background:var(--surface-2)}
.section-foot{display:flex;align-items:center;gap:14px;padding:12px 18px}
/* ===== 开关 ===== */
.switch{width:44px;height:24px;border-radius:999px;border:1px solid var(--border);background:var(--surface-2);position:relative;cursor:pointer;transition:background .15s ease,border-color .15s ease;flex-shrink:0;padding:0}
.switch .knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .15s ease}
.switch.on{background:var(--accent);border-color:var(--accent)}
.switch.on .knob{left:22px}
/* ===== 小按钮 / 危险按钮 ===== */
.btn-sm{padding:5px 10px;font-size:12px}
.btn-danger{color:var(--err);border-color:#F0D4D4}
.btn-danger:hover{background:#FBEBEB}
/* ===== 日志视图 ===== */
.log-box{background:#1B1F24;color:#D7DDE3;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.75;padding:14px 18px;max-height:56vh;overflow-y:auto;white-space:pre-wrap;word-break:break-all}
.log-box::-webkit-scrollbar{width:10px}
.log-box::-webkit-scrollbar-thumb{background:#3A4048;border-radius:5px}
.log-line{padding:1px 0}
.log-line.err{color:#FF8A80}
.log-line.warn{color:#FFD54F}
.log-line.ok{color:#69F0AE}
.log-empty{color:#6B7280;text-align:center;padding:24px 0}
/* ===== 关于 ===== */
.about-box{padding:6px 18px}
.about-line{display:flex;gap:14px;padding:9px 0;font-size:13px;border-bottom:1px solid var(--border);line-height:1.6}
.about-line:last-child{border-bottom:none}
.about-key{width:56px;flex-shrink:0;color:var(--text-3);font-size:12.5px}
/* ===== 免责声明弹窗 ===== */
.disclaimer-modal{max-width:680px;width:min(680px,92vw)}
.disclaimer-scroll{max-height:56vh;overflow-y:auto;padding:2px 4px 2px 0;line-height:1.8;font-size:13px;color:var(--text-1)}
.disclaimer-scroll::-webkit-scrollbar{width:10px}
.disclaimer-scroll::-webkit-scrollbar-thumb{background:#D8CFC6;border-radius:5px}
.disclaimer-scroll h3{font-size:15.5px;font-weight:700;margin:0 0 10px;color:var(--text-1)}
.disclaimer-scroll h4{font-size:13.5px;font-weight:600;margin:14px 0 6px;color:var(--accent-deep,#B45309)}
.disclaimer-scroll p{margin:4px 0;text-align:justify}
/* ===== 检查更新弹窗 ===== */
.update-modal{max-width:540px;width:min(540px,92vw)}
.spinner{width:15px;height:15px;border:2px solid rgba(0,0,0,0.14);border-top-color:var(--accent,#E8873A);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
/* ===== 二维码签到弹窗 ===== */
.modal-mask{position:fixed;inset:0;z-index:990;display:flex;align-items:center;justify-content:center;background:rgba(33,27,23,.42)}
.modal{width:440px;max-width:92vw;background:var(--surface);border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.22);display:flex;flex-direction:column;overflow:hidden;animation:modalIn .16s ease}
@keyframes modalIn{from{opacity:0;transform:scale(.96) translateY(6px)}to{opacity:1;transform:none}}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)}
.modal-title{display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:600}
.modal-title svg{width:17px;height:17px;color:var(--accent)}
.modal-close{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:none;background:none;border-radius:8px;color:var(--text-2);cursor:pointer}
.modal-close:hover{background:var(--surface-2);color:var(--text)}
.modal-body{padding:20px 18px}
.qr-drop{border:2px dashed var(--accent);border-radius:14px;background:var(--accent-weak);padding:30px 20px;text-align:center;color:var(--accent);transition:background .12s ease}
.qr-drop.drag{border-color:var(--accent-strong);background:#F8DCCD}
.qr-drop>svg{width:44px;height:44px;margin-bottom:10px}
.qr-drop-text{font-size:14.5px;font-weight:600;color:var(--text)}
.qr-drop-sub{font-size:12.5px;color:var(--text-2);margin-top:5px}
.qr-status{margin-top:14px;font-size:13px;color:var(--text-2);text-align:center;min-height:20px}
.qr-status.ok{color:var(--ok);font-weight:600}
.qr-status.err{color:var(--err);font-weight:600}
.modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 18px;border-top:1px solid var(--border);font-size:12px;color:var(--text-3)}
/* 免责声明：底部操作区撑满整行（左侧不同意、右侧同意并继续） */
.disclaimer-modal .modal-foot{padding:16px 18px;gap:12px}
.disclaimer-modal .modal-foot .btn{flex:1;justify-content:center;padding:11px 14px;font-size:13.5px;border-radius:10px}
/* ===== 空态 ===== */
.empty{padding:36px 18px;text-align:center}
.empty p{color:var(--text-2);font-size:14px}
.empty-sub{font-size:12.5px;color:var(--text-3);margin-top:4px}
/* ===== 滚动条（浏览器表面也主题化） ===== */
.content::-webkit-scrollbar{width:10px}
.content::-webkit-scrollbar-thumb{background:#DCD0C6;border-radius:5px;border:2px solid var(--canvas)}
.content::-webkit-scrollbar-thumb:hover{background:#C8B8AC}
::selection{background:rgba(194,78,46,.15)}
</style>
</head>
<body>
<div class="shell">
  <div class="titlebar">
    <div class="titlebar-title">${ICONS.alarm}<span>学习通自动签到 · v${esc(status.version || '3.1')}</span></div>
    <div class="titlebar-controls">
      <button class="win-btn" id="btnMin" title="最小化">${ICONS.winMin}</button>
      <button class="win-btn" id="btnMax" title="最大化">${ICONS.winMax}</button>
      <button class="win-btn win-close" id="btnClose" title="关闭（后台继续运行）">${ICONS.winClose}</button>
    </div>
  </div>
  <div class="app">
  <aside class="side">
    <div class="brand">
      <div class="brand-logo">${ICONS.alarm}</div>
      <div>
        <div class="brand-name">学习通自动签到</div>
        <div class="brand-ver">v${esc(status.version || '3.1')}</div>
      </div>
    </div>
    <nav class="nav" id="nav">
      <button class="nav-item active" data-view="overview">${ICONS.home}<span>总览</span></button>
      <button class="nav-item" data-view="courses">${ICONS.courses}<span>课程</span></button>
      <button class="nav-item" data-view="history">${ICONS.history}<span>历史记录</span></button>
      <button class="nav-item" data-view="logs">${ICONS.log}<span>日志</span></button>
      <button class="nav-item" data-view="settings">${ICONS.settings}<span>设置</span></button>
    </nav>
    <div class="side-foot">
      <div class="foot-row"><span class="dot"></span><span>运行中</span></div>
      <div class="foot-row"><span>${ICONS.server}</span><span class="foot-port">端口 ${esc(String(status.port || '3456'))}</span></div>
    </div>
  </aside>

  <div class="main">
    <header class="topbar">
      <div class="page-title" id="pageTitle">总览</div>
      <div class="top-actions">
        <button class="btn btn-primary" id="btnQrModal">${ICONS.qr}<span>二维码签到</span></button>
      </div>
    </header>

    <main class="content">
      <!-- 总览 -->
      <section class="view active" data-view="overview">
        <div class="stat-grid">${statCards}</div>
        <div class="section">
          <div class="section-head"><span class="section-title">最近活动</span><span class="section-more">自动签到 · 失败自动重试</span></div>
          <table>
            <thead><tr><th>时间</th><th>课程</th><th>类型</th><th>结果</th></tr></thead>
            <tbody id="recentBody">${recentRows}</tbody>
          </table>
        </div>
        <div class="section">
          <div class="section-head"><span class="section-title">账号</span></div>
          <div id="accountsBox">${accountRows}</div>
        </div>
      </section>

      <!-- 课程 -->
      <section class="view" data-view="courses">
        <div class="section">
          <div class="section-head"><span class="section-title">监控课程</span><span class="section-more" id="courseCount">${courses.length} 门 · 轮询发现签到活动</span></div>
          <div class="watch-bar">勾选要监听的课程（默认全部监听），保存后重启软件生效 · 新课程/小课程没出现时点「重新拉取课程列表」</div>
          <table>
            <thead><tr><th>课程名称</th><th>Course ID</th><th>Class ID</th><th>状态</th><th>监听</th></tr></thead>
            <tbody id="coursesBody">${courseRows}</tbody>
          </table>
          <div class="section-foot">
            <button class="btn btn-ghost" id="watchSaveBtn">保存监听设置</button>
            <button class="btn btn-ghost" id="refreshCoursesBtn">${ICONS.refresh}<span>重新拉取课程列表</span></button>
            <span class="cfg-msg" id="watchMsg"></span>
          </div>
        </div>
        <div class="section">
          <div class="section-head"><span class="section-title">课程签到统计</span><span class="section-more">按历史记录实时统计</span></div>
          <table>
            <thead><tr><th>课程</th><th>签到成功</th><th>签到失败</th><th>成功率</th></tr></thead>
            <tbody id="courseStatsBody"></tbody>
          </table>
        </div>
      </section>

      <!-- 历史 -->
      <section class="view" data-view="history">
        <div class="section">
          <div class="section-head"><span class="section-title">签到记录</span><span class="section-more" id="historyCount"></span></div>
          <table>
            <thead><tr><th>时间</th><th>课程</th><th>类型</th><th>结果</th></tr></thead>
            <tbody id="historyBody">${recentRows}</tbody>
          </table>
          <div class="section-foot">
            <a class="btn btn-ghost" href="/api/history/export" download="checkin-history.csv">${ICONS.download}<span>导出 CSV</span></a>
            <button class="btn btn-ghost btn-danger" id="clearHistoryBtn">${ICONS.trash}<span>清空记录</span></button>
            <span class="cfg-msg" id="historyMsg"></span>
          </div>
        </div>
      </section>

      <!-- 日志 -->
      <section class="view" data-view="logs">
        <div class="section">
          <div class="section-head"><span class="section-title">运行日志</span><span class="section-more" id="logFile">自动刷新 · 最近 200 行</span></div>
          <div class="log-box" id="logBox"><div class="log-empty">加载中…</div></div>
          <div class="section-foot">
            <button class="btn btn-ghost" id="logRefreshBtn">${ICONS.refresh}<span>刷新日志</span></button>
            <span class="cfg-msg" id="logMsg"></span>
          </div>
        </div>
      </section>

      <!-- 设置 -->
      <section class="view" data-view="settings">
        <div class="section">
          <div class="section-head"><span class="section-title">运行配置</span></div>
          ${settingsRows}
          ${settingsForm}
        </div>
        <div class="section">
          <div class="section-head"><span class="section-title">账号管理</span><span class="section-more">支持多账号，全部账号都会自动签到</span></div>
          ${accountManageBox}
        </div>
        <div class="section">
          <div class="section-head"><span class="section-title">支持的签到方式</span></div>
          <div class="feature-grid">
            <div class="feature-item">
              <div class="feature-ico">${ICONS.check}</div>
              <div>
                <div class="feature-name">普通签到</div>
                <div class="feature-desc">检测到老师发布签到后自动完成，无需任何操作</div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-ico">${ICONS.location}</div>
              <div>
                <div class="feature-name">位置签到</div>
                <div class="feature-desc">读取老师发布的位置坐标，在 10 米范围内自动生成签到点并完成</div>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-ico">${ICONS.qr}</div>
              <div>
                <div class="feature-name">二维码签到</div>
                <div class="feature-desc">把任意签到二维码图片直接拖入本窗口即可自动识别签到，二维码更新后拖入新码即可</div>
              </div>
            </div>
          </div>
          <div style="padding:2px 18px 14px;font-size:12px;color:var(--text-3);line-height:1.7">
            也可点击右上角「二维码签到」按钮，或手机在同一 Wi-Fi 下访问 <span class="cell-mono">http://电脑IP:${esc(String(status.port || '3456'))}/upload?type=qr</span> 上传。签到失败会自动重试，检测到拍照/手势类签到会推送提醒（请在学习通 APP 手动完成）。
          </div>
        </div>
        <div class="section">
          <div class="section-head"><span class="section-title">关于</span></div>
          <div class="about-box">
            <div class="about-line"><span class="about-key">版本</span><span>学习通自动签到 v${esc(status.version || '3.1')}</span><button class="btn btn-ghost btn-sm" id="updateCheckBtn" style="margin-left:auto">${ICONS.download}<span>检查更新</span></button></div>
            <div class="about-line"><span class="about-key">仓库</span><span class="cell-mono">github.com/liixnglinb/superstar-checkin</span></div>
            <div class="about-line"><span class="about-key">说明</span><span>仅用于个人学习场景的自动签到辅助，请遵守学校考勤规定。</span></div>
            <div class="about-line"><span class="about-key">声明</span><button class="btn btn-ghost btn-sm" id="disclaimerView">${ICONS.shield}<span>查看免责声明</span></button></div>
          </div>
        </div>
      </section>
    </main>
  </div>
</div>
<div class="drag-mask" id="dragMask"><div class="drag-box">松开即可上传二维码签到图片<small>支持任意签到二维码，识别后自动完成签到</small></div></div>

<!-- 检查更新：设置页「检查更新」按钮弹出 -->
<div class="modal-mask" id="updateModal" style="display:none">
  <div class="modal update-modal">
    <div class="modal-head">
      <span class="modal-title">${ICONS.download}<span>检查更新</span></span>
    </div>
    <div class="modal-body" style="min-height:110px">
      <div id="updateBody" style="font-size:13px;color:var(--text-1);line-height:1.8"></div>
      <div id="updateBar" style="display:none;margin-top:14px">
        <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden">
          <div id="updateBarFill" style="height:100%;width:0%;background:var(--accent,#E8873A);transition:width .2s"></div>
        </div>
        <div id="updateBarText" style="font-size:12px;color:var(--text-3);margin-top:6px">正在下载安装包…</div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" id="updateLater">以后再说</button>
      <button class="btn btn-primary" id="updateGo" style="display:none">立即下载安装</button>
    </div>
  </div>
</div>

<!-- 免责声明：首次进入软件时显示，同意后进入，不同意退出 -->
<div class="modal-mask" id="disclaimerModal" style="display:none">
  <div class="modal disclaimer-modal">
    <div class="modal-head">
      <span class="modal-title">${ICONS.shield}<span>免责声明</span></span>
    </div>
    <div class="modal-body">
      <div class="disclaimer-scroll">
        <h3>学习通自动签到助手 免责声明</h3>
        <p>感谢使用学习通自动签到助手（以下简称"本软件"）。在使用本软件前，请仔细阅读并充分理解以下全部条款。您点击下方「同意并继续」按钮，即表示您已阅读、理解并自愿接受本声明的全部内容。</p>
        <h4>一、软件性质与使用范围</h4>
        <p>1. 本软件是一款仅供个人学习辅助使用的自动化工具，用于协助使用者在本人已选课程中完成学习通平台的签到操作，以减轻重复性操作负担，不提供任何商业服务。</p>
        <p>2. 本软件仅限使用者本人使用，不得转售、出租、出借，不得用于任何商业用途或任何违反法律法规、平台规则的目的。</p>
        <h4>二、合规与责任声明</h4>
        <p>1. 使用者所在学校、学院可能对课堂考勤、签到行为有明确管理规定（包括但不限于：使用第三方工具自动签到可能被认定为违反考勤纪律的情形）。使用者应在使用前了解并遵守所在学校、学院及任课教师的相关规定。</p>
        <p>2. 因使用本软件而导致的考勤记录异常、课程成绩影响、纪律处分或其他任何后果，均由使用者本人自行承担，软件作者不承担任何责任。</p>
        <p>3. 本软件仅辅助完成签到操作，不代替使用者对课程内容的学习与掌握，使用者仍应正常参与课堂学习，按时完成学习任务。</p>
        <h4>三、平台条款与账号安全</h4>
        <p>1. 使用者应遵守学习通平台（超星学习通）的用户协议、隐私政策及相关法律法规，不得利用本软件从事违反平台规则的操作，如账号共享、批量注册、恶意刷课等。</p>
        <p>2. 使用者应妥善保管自己的学习通账号与密码。本软件对账号密码采用本地加密存储（Windows DPAPI 加密，与当前系统用户绑定），不会明文保存；但使用者仍不得将账号出借给他人，并应对自己账号下的全部操作负责。</p>
        <p>3. 因账号保管不善、密码泄露或被他人冒用所导致的任何损失，由使用者自行承担；本软件及作者不对账号安全承担担保责任。</p>
        <h4>四、服务可用性与技术限制</h4>
        <p>1. 本软件依赖学习通平台的公开接口与网络环境。平台接口变更、网络波动、服务器异常、登录状态失效、课程安排调整等情况均可能导致签到失败或功能异常，本软件不保证签到 100% 成功。</p>
        <p>2. 使用者应留意签到结果通知。如发现签到失败或漏签，应及时通过学习通 APP 手动补签，避免影响考勤。</p>
        <p>3. 本软件按"现状"提供，不提供任何明示或默示的担保，包括但不限于适销性、特定用途适用性及不侵权担保。</p>
        <h4>五、数据与隐私</h4>
        <p>1. 本软件的所有配置数据、签到记录均存储于使用者本地设备，默认不会上传至任何第三方服务器；除使用者主动配置的通知通道（如钉钉、邮件、PushPlus、Bark 等）外，本软件不向外部发送任何数据。</p>
        <p>2. 使用者如将本软件安装包、配置文件或软件目录分享给他人，需自行评估风险；本软件及作者不对因分享造成的账号、密码或数据泄露承担任何责任。</p>
        <h4>六、其他</h4>
        <p>1. 本声明内容可能随软件功能更新而调整，更新后以软件内展示的最新版本为准。</p>
        <p>2. 如使用者不同意本声明的任何条款，请点击「不同意并退出」，停止使用并卸载本软件。</p>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-danger" id="disclaimerRefuse">不同意并退出</button>
      <button class="btn btn-primary" id="disclaimerAgree">同意并继续</button>
    </div>
  </div>
</div>

<!-- 二维码签到弹窗：拖入任意签到码图片即完成签到 -->
<div class="modal-mask" id="qrModal" style="display:none">
  <div class="modal">
    <div class="modal-head">
      <span class="modal-title">${ICONS.qr}<span>二维码签到</span></span>
      <button class="modal-close" id="qrModalClose" title="关闭">${ICONS.x}</button>
    </div>
    <div class="modal-body">
      <div class="qr-drop" id="qrDrop">
        ${ICONS.qr}
        <div class="qr-drop-text">把签到二维码图片拖到这里</div>
        <div class="qr-drop-sub">支持任意签到码，识别后自动完成签到</div>
        <div style="margin-top:14px">
          <button class="btn btn-ghost" id="btnPickFile">或选择图片文件</button>
          <input type="file" id="qrFileInput" accept="image/*" style="display:none">
        </div>
      </div>
      <div class="qr-status" id="qrStatus"></div>
    </div>
    <div class="modal-foot" style="justify-content:flex-start">签到二维码会随时间更新，更新后拖入新码即可</div>
  </div>
</div>

<script>
(function(){
  var views=['overview','courses','history','logs','settings']
  var titles={overview:'总览',courses:'课程',history:'历史记录',logs:'运行日志',settings:'设置'}
  function show(v){
    if(views.indexOf(v)<0)v='overview'
    document.querySelectorAll('.view').forEach(function(el){el.classList.toggle('active',el.dataset.view===v)})
    document.querySelectorAll('.nav-item').forEach(function(el){el.classList.toggle('active',el.dataset.view===v)})
    document.getElementById('pageTitle').textContent=titles[v]
    if(v==='logs')loadLogs()
  }
  document.getElementById('nav').addEventListener('click',function(e){
    var btn=e.target.closest('.nav-item');if(!btn)return
    show(btn.dataset.view)
    if(history.replaceState)history.replaceState(null,'','#'+btn.dataset.view)
  })

  // ===== 免责声明（首次进入显示，同意后不再打扰；不同意则退出软件） =====
  function ensureDisclaimer(){
    var box=document.getElementById('disclaimerModal')
    if(!box)return
    try{
      if(localStorage.getItem('disclaimerAccepted')==='1')return
    }catch(e){/* 隐私模式等场景无法存取，直接显示 */}
    box.style.display='flex'
  }
  function closeDisclaimer(){
    var box=document.getElementById('disclaimerModal')
    if(box)box.style.display='none'
  }
  var disAgree=document.getElementById('disclaimerAgree')
  if(disAgree)disAgree.addEventListener('click',function(){
    try{localStorage.setItem('disclaimerAccepted','1')}catch(e){}
    closeDisclaimer()
  })
  var disRefuse=document.getElementById('disclaimerRefuse')
  if(disRefuse)disRefuse.addEventListener('click',function(){
    closeDisclaimer()
    if(window.appCtl&&window.appCtl.quit){window.appCtl.quit()}
    else{window.close()}
  })
  var disView=document.getElementById('disclaimerView')
  if(disView)disView.addEventListener('click',function(){
    var box=document.getElementById('disclaimerModal')
    if(box)box.style.display='flex'
  })
  ensureDisclaimer()

  // ===== 检查更新（设置页「检查更新」按钮 → GitHub Releases） =====
  var updateCheckBtn=document.getElementById('updateCheckBtn')
  var updateModal=document.getElementById('updateModal')
  var updateBody=document.getElementById('updateBody')
  var updateGo=document.getElementById('updateGo')
  var updateLater=document.getElementById('updateLater')
  var updateBar=document.getElementById('updateBar')
  var updateBarFill=document.getElementById('updateBarFill')
  var updateBarText=document.getElementById('updateBarText')
  var updateState={file:''}
  if(updateGo)updateGo.addEventListener('click',function(){
    if(updateState.file){
      // 已下载：立即安装（启动安装向导后软件自动退出）
      updateGo.disabled=true;updateGo.textContent='正在启动安装…'
      window.updateCtl.install(updateState.file).then(function(r){
        if(!r||!r.ok){updateGo.disabled=false;updateGo.textContent='立即安装';updateBody.innerHTML='<div class="cell-empty">安装启动失败：'+(r&&r.message?esc(r.message):'未知错误')+'</div>'}
      }).catch(function(){updateGo.disabled=false;updateGo.textContent='立即安装';updateBody.innerHTML='<div class="cell-empty">安装启动失败，请稍后重试</div>'})
      return
    }
    // 未下载：开始下载
    if(!window.updateCtl){updateBody.innerHTML='<div class="cell-empty">更新组件不可用（请使用安装版）</div>';return}
    updateGo.disabled=true;updateGo.textContent='下载中…'
    updateBar.style.display=''
    updateBarFill.style.width='0%'
    updateBarText.textContent='正在下载安装包… 0%'
    window.updateCtl.download().then(function(r){
      if(r&&r.ok){
        updateState.file=r.file
        updateBar.style.display='none'
        updateBody.innerHTML='<div style="padding:6px 0"><b>下载完成</b><br><span style="color:var(--text-3);font-size:12.5px">安装包已保存到本地，点击「立即安装」启动安装向导，也可以稍后手动安装。</span></div>'
        updateGo.disabled=false;updateGo.textContent='立即安装'
        updateLater.textContent='稍后再说'
      }else{
        updateBar.style.display='none'
        updateGo.disabled=false;updateGo.textContent='重新下载'
        updateBody.innerHTML='<div class="cell-empty">下载失败：'+(r&&r.message?esc(r.message):'网络异常，请重试')+'</div>'
      }
    }).catch(function(){
      updateBar.style.display='none'
      updateGo.disabled=false;updateGo.textContent='重新下载'
      updateBody.innerHTML='<div class="cell-empty">下载失败，请检查网络后重试</div>'
    })
  })
  if(updateLater)updateLater.addEventListener('click',function(){
    if(updateModal)updateModal.style.display='none'
    updateLater.textContent='以后再说'
  })
  // 下载进度（仅注册一次）
  if(window.updateCtl&&window.updateCtl.onProgress){
    window.updateCtl.onProgress(function(d){
      if(d&&d.phase==='downloading'&&updateBarFill){
        var pct=d.pct||0
        updateBarFill.style.width=pct+'%'
        updateBarText.textContent='正在下载安装包… '+pct+'%'
      }
    })
  }
  if(updateCheckBtn)updateCheckBtn.addEventListener('click',function(){
    if(!window.updateCtl){return}
    updateState.file=''
    if(updateModal)updateModal.style.display='flex'
    updateGo.style.display='none'
    updateLater.textContent='以后再说'
    updateBar.style.display='none'
    updateBody.innerHTML='<div style="display:flex;gap:10px;align-items:center"><span class="spinner"></span>正在检查更新…</div>'
    window.updateCtl.check().then(function(r){
      if(!r||!r.ok){
        updateGo.style.display='none'
        updateLater.textContent='知道了'
        updateBody.innerHTML='<div class="cell-empty">'+(r&&r.message?esc(r.message):'检查更新失败，请检查网络后重试')+'</div>'
        return
      }
      if(!r.hasUpdate){
        updateGo.style.display='none'
        updateLater.textContent='知道了'
        updateBody.innerHTML='<div style="padding:6px 0">当前已是最新版本 <b>v'+esc(r.current)+'</b>，无需更新。</div>'
        return
      }
      updateGo.style.display=''
      updateGo.disabled=false;updateGo.textContent='立即下载安装'
      updateBody.innerHTML='<div style="padding:4px 0"><div style="font-size:14px;font-weight:600;margin-bottom:8px">发现新版本 <b>v'+esc(r.latest)+'</b>（当前 v'+esc(r.current)+'）</div><div style="max-height:220px;overflow-y:auto;white-space:pre-wrap;background:var(--bg2,#FBF9F7);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12.5px;color:var(--text-2)">'+(r.body?esc(r.body):'暂无更新说明')+'</div></div>'
    }).catch(function(){
      updateGo.style.display='none'
      updateLater.textContent='知道了'
      updateBody.innerHTML='<div class="cell-empty">检查更新失败，请检查网络后重试</div>'
    })
  })
  function render(s){
    document.getElementById('stat-courses').textContent=(s.courses||[]).length
    document.getElementById('stat-records').textContent=s.recordCount||0
    document.getElementById('stat-ok').textContent=s.successCount||0
    document.getElementById('stat-fail').textContent=s.failCount||0
    document.getElementById('historyCount').textContent='共 '+(s.recordCount||0)+' 条'
    var rows=(s.recent||[]).map(function(r){
      var ok=/成功|✅|已签到/.test(r.result)
      var badge=ok?'<span class="pill pill-ok">成功</span>':'<span class="pill pill-err">失败</span>'
      return '<tr><td class="cell-sub">'+esc(fmtTime(r.timestamp))+'</td><td class="cell-main">'+esc(r.courseName||'未知课程')+'</td><td class="cell-sub">'+esc(typeText(r.type))+'</td><td class="cell-sub">'+badge+'</td></tr>'
    }).join('')
    if(!rows)rows='<tr><td colspan="4" class="cell-empty">还没有签到记录</td></tr>'
    if(document.getElementById('recentBody'))document.getElementById('recentBody').innerHTML=rows
    if(document.getElementById('historyBody'))document.getElementById('historyBody').innerHTML=rows
    // 账号区
    var ab=document.getElementById('accountsBox')
    if(ab){
      var accs=s.accounts||[]
      ab.innerHTML=accs.length
        ? accs.map(function(a){
            var nm=a.name||a.username||'?'
            return '<div class="acct-row"><span class="acct-avatar">'+esc(nm.slice(0,1))+'</span><div class="acct-info"><div class="acct-name">'+esc(nm)+'</div><div class="acct-sub">'+esc(a.schoolname||'')+' · '+esc(String(a.username))+'</div></div><span class="pill pill-ok">已登录</span></div>'
          }).join('')
        : '<div class="empty"><p>未配置账号</p><p class="empty-sub">首次使用请在"设置"页填写你的学习通账号</p><a class="btn btn-ghost" href="#settings" style="margin-top:12px">去配置账号</a></div>'
    }
    // 课程表（含监听开关）
    var cb=document.getElementById('coursesBody')
    if(cb){
      var cs2=s.courses||[]
      var ws2=(s.watchCourses||[]).map(String)
      var wset2={};ws2.forEach(function(id){wset2[id]=true})
      var allOn2=ws2.length===0
      cb.innerHTML=cs2.length
        ? cs2.map(function(c){
            var cid=String(c.courseId)
            var watching=watchLocal[cid]!==undefined?watchLocal[cid]:(allOn2||wset2[cid])
            return '<tr><td class="cell-main">'+esc(c.courseName)+'</td><td class="cell-mono">'+esc(String(c.courseId))+'</td><td class="cell-mono">'+esc(String(c.classId))+'</td><td><span class="pill '+(watching?'pill-ok':'pill-off')+'">'+(watching?'监控中':'已停用')+'</span></td><td><button class="watch-toggle '+(watching?'on':'')+'" data-cid="'+esc(cid)+'">'+(watching?'关闭监听':'开启监听')+'</button></td></tr>'
          }).join('')
        : '<tr><td colspan="5" class="cell-empty">暂无课程数据</td></tr>'
    }
    var cc=document.getElementById('courseCount')
    if(cc)cc.textContent=(s.courses||[]).length+' 门 · 轮询发现签到活动'
    // 课程签到统计
    var csb=document.getElementById('courseStatsBody')
    if(csb){
      var stats=s.courseStats||[]
      csb.innerHTML=stats.length
        ? stats.map(function(st){
            var total=st.success+st.fail
            var rate=total?Math.round(st.success/total*100):0
            var rc=rate>=90?'#178A5B':(rate>=60?'#B7791F':'#D64545')
            return '<tr><td class="cell-main">'+esc(st.course)+'</td><td class="cell-sub" style="color:#178A5B">'+st.success+'</td><td class="cell-sub" style="color:'+(st.fail?'#D64545':'#9A8B80')+'">'+st.fail+'</td><td class="cell-sub" style="color:'+rc+';font-weight:600">'+rate+'%</td></tr>'
          }).join('')
        : '<tr><td colspan="4" class="cell-empty">暂无统计数据（产生签到记录后显示）</td></tr>'
    }
  }
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function fmtTime(ts){if(!ts)return '—';var d=new Date(ts),n=new Date();var hm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');if(d.toDateString()===n.toDateString())return '今天 '+hm;var y=new Date(n.getTime()-86400000);if(d.toDateString()===y.toDateString())return '昨天 '+hm;return (d.getMonth()+1)+'月'+d.getDate()+'日 '+hm}
  function typeText(t){var m={normal:'普通',gesture:'手势',qr:'二维码',location:'位置',photo:'拍照'};return m[t]||t}
  function poll(){fetch('/api/status').then(function(r){return r.json()}).then(render).catch(function(){})}
  if(location.hash&&views.indexOf(location.hash.slice(1))>=0)show(location.hash.slice(1))
  window.addEventListener('hashchange',function(){var v=location.hash.slice(1);if(views.indexOf(v)>=0)show(v)})
  // 二维码图片拖拽签到：任意签到码拖入窗口即解析并签到（二维码更新后拖新码即可）
  var dragMask=document.getElementById('dragMask')
  var toastTimer=null
  function showToast(msg){
    var t=document.getElementById('dragToast')
    if(!t){
      t=document.createElement('div');t.id='dragToast'
      t.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#1B1F24;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;z-index:1000;box-shadow:0 6px 20px rgba(0,0,0,.2);max-width:70vw'
      document.body.appendChild(t)
    }
    t.textContent=msg;t.style.display='block'
    clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.style.display='none'},5000)
  }
  // 弹窗打开时，窗口级拖拽交给弹窗处理（避免双重上传）
  window.addEventListener('dragover',function(e){e.preventDefault();if(qrModal&&qrModal.style.display==='flex')return;if(dragMask&&!dragMask.classList.contains('show'))dragMask.classList.add('show')},{capture:true})
  window.addEventListener('dragleave',function(e){if(dragMask&&e.target===document.documentElement)dragMask.classList.remove('show')},{capture:true})
  window.addEventListener('drop',function(e){
    e.preventDefault()
    if(qrModal&&qrModal.style.display==='flex')return
    if(dragMask)dragMask.classList.remove('show')
    var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]
    if(!f)return
    if(f.type.indexOf('image/')!==0){showToast('请拖入二维码图片文件');return}
    showToast('二维码图片已接收，正在识别签到…')
    fetch('/upload/image?type=qr',{method:'POST',body:f,headers:{'Content-Type':f.type}})
      .then(function(r){return r.json()})
      .then(function(d){
        if(d.success){showToast('✅ '+d.message);setTimeout(function(){location.reload()},1500)}
        else{showToast('❌ '+(d.error||'处理失败'))}
      })
      .catch(function(err){showToast('❌ 上传失败: '+err.message)})
  })
  var saveBtn=document.getElementById('cfgSaveBtn')
  if(saveBtn)saveBtn.addEventListener('click',function(){
    var u=document.getElementById('cfgUsername').value.trim()
    var p=document.getElementById('cfgPassword').value
    var msg=document.getElementById('cfgMsg')
    if(!u||!p){msg.textContent='账号和密码不能为空';msg.style.color='#B42318';return}
    saveBtn.disabled=true;saveBtn.textContent='保存中…'
    fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})})
      .then(function(r){return r.json()})
      .then(function(d){
        msg.textContent=(d.ok?'✅ ':'❌ ')+(d.message||(d.ok?'已保存':'保存失败'))
        msg.style.color=d.ok?'#0E7C66':'#B42318'
        saveBtn.disabled=false;saveBtn.textContent='添加账号'
        if(d.ok)setTimeout(function(){location.reload()},1500)
      })
      .catch(function(){msg.textContent='❌ 保存失败，请重试';msg.style.color='#B42318';saveBtn.disabled=false;saveBtn.textContent='添加账号'})
  })
  // 自绘标题栏：窗口控制（最小化/最大化/关闭）
  var wc=window.winCtl
  if(wc){
    var btnMin=document.getElementById('btnMin')
    var btnMax=document.getElementById('btnMax')
    var btnClose=document.getElementById('btnClose')
    var icoMax='<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><rect x="2.5" y="2.5" width="7" height="7"/></svg>'
    var icoRestore='<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><path d="M4.5 4.5V2.5h5v5h-2"/><rect x="2.5" y="4.5" width="5" height="5"/></svg>'
    if(btnMin)btnMin.addEventListener('click',function(){wc.minimize()})
    if(btnMax)btnMax.addEventListener('click',function(){wc.maximizeToggle()})
    if(btnClose)btnClose.addEventListener('click',function(){wc.close()})
    function syncMax(){
      wc.isMaximized().then(function(m){
        if(btnMax){btnMax.innerHTML=m?icoRestore:icoMax;btnMax.title=m?'还原':'最大化'}
      }).catch(function(){})
    }
    window.addEventListener('resize',syncMax)
    syncMax()
  } else {
    // 非 Electron（浏览器调试）时隐藏自绘标题栏
    var tb=document.querySelector('.titlebar');if(tb)tb.style.display='none'
  }
  // ===== 课程监听开关 =====
  var watchLocal={}  // 本地未保存的开关修改（{courseId: bool}）
  var coursesBody=document.getElementById('coursesBody')
  if(coursesBody){
    coursesBody.addEventListener('click',function(e){
      var btn=e.target.closest('.watch-toggle');if(!btn)return
      var cid=btn.getAttribute('data-cid')
      var cur=btn.classList.contains('on')
      watchLocal[cid]=!cur
      // 重绘课程表以同步状态列与按钮
      fetch('/api/status').then(function(r){return r.json()}).then(function(s){
        var cb=document.getElementById('coursesBody')
        var cs2=s.courses||[],ws2=(s.watchCourses||[]).map(String)
        var wset2={};ws2.forEach(function(id){wset2[id]=true})
        var allOn2=ws2.length===0
        cb.innerHTML=cs2.length
          ? cs2.map(function(c){
              var id2=String(c.courseId)
              var w=watchLocal[id2]!==undefined?watchLocal[id2]:(allOn2||wset2[id2])
              var f2=(s.courseHealth||{})[id2]||0
              var sp=!w
                ? '<span class="pill pill-off">已停用</span>'
                : (f2>=3
                    ? '<span class="pill pill-warn" title="近期轮询多次失败，多为瞬时网络或网关限流，已自动重试">扫描异常</span>'
                    : '<span class="pill pill-ok">监控中</span>')
              return '<tr><td class="cell-main">'+esc(c.courseName)+'</td><td class="cell-mono">'+esc(String(c.courseId))+'</td><td class="cell-mono">'+esc(String(c.classId))+'</td><td>'+sp+'</td><td><button class="watch-toggle '+(w?'on':'')+'" data-cid="'+esc(id2)+'">'+(w?'关闭监听':'开启监听')+'</button></td></tr>'
            }).join('')
          : '<tr><td colspan="5" class="cell-empty">暂无课程数据</td></tr>'
      }).catch(function(){})
    })
  }
  var watchSaveBtn=document.getElementById('watchSaveBtn')
  if(watchSaveBtn)watchSaveBtn.addEventListener('click',function(){
    var rows=document.querySelectorAll('#coursesBody .watch-toggle')
    var onList=[],allOn=true
    rows.forEach(function(btn){
      var cid=btn.getAttribute('data-cid')
      var on=btn.classList.contains('on')
      if(on)onList.push(cid);else allOn=false
    })
    var msg=document.getElementById('watchMsg')
    watchSaveBtn.disabled=true;watchSaveBtn.textContent='保存中…'
    fetch('/api/watch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({watchCourses:allOn?[]:onList})})
      .then(function(r){return r.json()})
      .then(function(d){
        msg.textContent=(d.ok?'✅ ':'❌ ')+(d.message||'保存失败')
        msg.style.color=d.ok?'#178A5B':'#B42318'
        watchSaveBtn.disabled=false;watchSaveBtn.textContent='保存监听设置'
        if(d.ok){watchLocal={};setTimeout(function(){location.reload()},1500)}
      })
      .catch(function(){msg.textContent='❌ 保存失败，请重试';msg.style.color='#B42318';watchSaveBtn.disabled=false;watchSaveBtn.textContent='保存监听设置'})
  })

  // ===== 账号管理（设为主账号 / 删除） =====
  var accountList=document.getElementById('accountList')
  if(accountList)accountList.addEventListener('click',function(e){
    var pBtn=e.target.closest('[data-primary]')
    var dBtn=e.target.closest('[data-remove]')
    var msg=document.getElementById('cfgMsg')
    if(pBtn){
      var un=pBtn.getAttribute('data-primary')
      pBtn.disabled=true
      fetch('/api/accounts/primary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:un})})
        .then(function(r){return r.json()})
        .then(function(d){
          msg.textContent=(d.ok?'✅ ':'❌ ')+(d.message||'操作失败')
          msg.style.color=d.ok?'#178A5B':'#B42318'
          if(d.ok)setTimeout(function(){location.reload()},1200)
        })
        .catch(function(){msg.textContent='❌ 操作失败';msg.style.color='#B42318';pBtn.disabled=false})
      return
    }
    if(dBtn){
      var un2=dBtn.getAttribute('data-remove')
      if(!confirm('确定删除账号 '+un2+' 吗？'))return
      dBtn.disabled=true
      fetch('/api/accounts/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:un2})})
        .then(function(r){return r.json()})
        .then(function(d){
          msg.textContent=(d.ok?'✅ ':'❌ ')+(d.message||'操作失败')
          msg.style.color=d.ok?'#178A5B':'#B42318'
          if(d.ok)setTimeout(function(){location.reload()},1200)
        })
        .catch(function(){msg.textContent='❌ 操作失败';msg.style.color='#B42318';dBtn.disabled=false})
    }
  })

  // ===== 历史记录：清空 =====
  var clearHistoryBtn=document.getElementById('clearHistoryBtn')
  if(clearHistoryBtn)clearHistoryBtn.addEventListener('click',function(){
    if(!confirm('确定清空全部签到记录吗？此操作不可恢复。'))return
    var msg=document.getElementById('historyMsg')
    clearHistoryBtn.disabled=true
    fetch('/api/history/clear',{method:'POST'})
      .then(function(r){return r.json()})
      .then(function(d){
        msg.textContent=(d.ok?'✅ ':'❌ ')+(d.message||'操作失败')
        msg.style.color=d.ok?'#178A5B':'#B42318'
        if(d.ok)setTimeout(function(){location.reload()},800)
      })
      .catch(function(){msg.textContent='❌ 清空失败';msg.style.color='#B42318';clearHistoryBtn.disabled=false})
  })

  // ===== 运行设置（轮询/抖动/重试/半径/通知/免打扰/日报） =====
  var settingsSaveBtn=document.getElementById('settingsSaveBtn')
  if(settingsSaveBtn)settingsSaveBtn.addEventListener('click',function(){
    var poll=document.getElementById('setPoll').value
    var jitter=document.getElementById('setJitter').value
    var retry=document.getElementById('setRetry').value
    var retryDelay=document.getElementById('setRetryDelay').value
    var radius=document.getElementById('setRadius').value
    var desktop=document.getElementById('setDesktop').classList.contains('on')
    var quietOn=document.getElementById('setQuiet').classList.contains('on')
    var qs=document.getElementById('setQuietStart').value
    var qe=document.getElementById('setQuietEnd').value
    var reportOn=document.getElementById('setReport').classList.contains('on')
    var reportHour=document.getElementById('setReportHour').value
    var verify=document.getElementById('setVerify').classList.contains('on')
    var msg=document.getElementById('settingsMsg')
    settingsSaveBtn.disabled=true;settingsSaveBtn.textContent='保存中…'
    fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      pollInterval:poll,pollJitter:jitter,retryMaxAttempts:retry,retryDelayMs:retryDelay*1000,
      locationRadius:radius,desktop:desktop,quietEnabled:quietOn,quietStart:qs,quietEnd:qe,
      reportEnabled:reportOn,reportHour:reportHour,verifyEnabled:verify
    })})
      .then(function(r){return r.json()})
      .then(function(d){
        msg.textContent=(d.ok?'✅ ':'❌ ')+(d.message||'保存失败')
        msg.style.color=d.ok?'#178A5B':'#B42318'
        settingsSaveBtn.disabled=false;settingsSaveBtn.textContent='保存设置'
        if(d.ok)setTimeout(function(){location.reload()},1200)
      })
      .catch(function(){msg.textContent='❌ 保存失败';msg.style.color='#B42318';settingsSaveBtn.disabled=false;settingsSaveBtn.textContent='保存设置'})
  })
  function bindSwitch(id){
    var el=document.getElementById(id)
    if(el)el.addEventListener('click',function(){el.classList.toggle('on')})
  }
  bindSwitch('setDesktop');bindSwitch('setQuiet');bindSwitch('setReport');bindSwitch('setVerify')
  // 测试通知
  var notifyTestBtn=document.getElementById('notifyTestBtn')
  if(notifyTestBtn)notifyTestBtn.addEventListener('click',function(){
    var msg=document.getElementById('settingsMsg')
    msg.textContent='正在发送…';msg.style.color='#0E7C66'
    fetch('/api/notify/test',{method:'POST'})
      .then(function(r){return r.json()})
      .then(function(d){
        msg.textContent=(d.ok?'✅ ':'❌ ')+(d.message||'发送失败')
        msg.style.color=d.ok?'#178A5B':'#B42318'
      })
      .catch(function(){msg.textContent='❌ 发送失败';msg.style.color='#B42318'})
  })
  // 开机自启
  var alBtn=document.getElementById('setAutoLaunch')
  if(alBtn&&window.appCtl){
    window.appCtl.getAutoLaunch().then(function(v){alBtn.classList.toggle('on',!!v)}).catch(function(){})
    alBtn.addEventListener('click',function(){
      var next=!alBtn.classList.contains('on')
      alBtn.classList.toggle('on',next)
      window.appCtl.setAutoLaunch(next).then(function(r){
        if(!r||!r.ok){
          alBtn.classList.toggle('on',!next)
          var msg=document.getElementById('settingsMsg')
          msg.textContent='❌ '+(r&&r.message||'设置失败，请安装版重试')
          msg.style.color='#B42318'
        }
      }).catch(function(){alBtn.classList.toggle('on',!next)})
    })
  }

  // ===== 重新拉取课程列表 =====
  var refreshCoursesBtn=document.getElementById('refreshCoursesBtn')
  if(refreshCoursesBtn)refreshCoursesBtn.addEventListener('click',function(){
    var msg=document.getElementById('watchMsg')
    refreshCoursesBtn.disabled=true;refreshCoursesBtn.textContent='正在拉取…'
    fetch('/api/courses/refresh',{method:'POST'})
      .then(function(r){return r.json()})
      .then(function(d){
        msg.textContent=(d.ok?'✅ ':'❌ ')+(d.message||'刷新失败')
        msg.style.color=d.ok?'#178A5B':'#B42318'
        refreshCoursesBtn.disabled=false;refreshCoursesBtn.textContent='重新拉取课程列表'
        if(d.ok)setTimeout(function(){location.reload()},1500)
      })
      .catch(function(){msg.textContent='❌ 刷新失败';msg.style.color='#B42318';refreshCoursesBtn.disabled=false;refreshCoursesBtn.textContent='重新拉取课程列表'})
  })

  // ===== 运行日志查看 =====
  function loadLogs(){
    var box=document.getElementById('logBox')
    if(!box)return
    fetch('/api/logs?lines=200')
      .then(function(r){return r.json()})
      .then(function(d){
        if(!d.ok||!d.lines){box.innerHTML='<div class="log-empty">'+esc(d.message||'暂无日志')+'</div>';return}
        var lf=document.getElementById('logFile')
        if(lf)lf.textContent=(d.file||'')+' · 最近 '+d.lines.length+' 行'
        if(!d.lines.length){box.innerHTML='<div class="log-empty">暂无日志</div>';return}
        box.innerHTML=d.lines.map(function(line){
          var cls=''
          if(/\[ERROR\]/.test(line))cls='err'
          else if(/\[WARN\]/.test(line))cls='warn'
          else if(/\[OK\]/.test(line))cls='ok'
          return '<div class="log-line '+cls+'">'+esc(line)+'</div>'
        }).join('')
        box.scrollTop=box.scrollHeight
      })
      .catch(function(){box.innerHTML='<div class="log-empty">日志读取失败</div>'})
  }
  var logRefreshBtn=document.getElementById('logRefreshBtn')
  if(logRefreshBtn)logRefreshBtn.addEventListener('click',loadLogs)
  loadLogs()

  // ===== 二维码签到弹窗（拖入/选择图片即签） =====
  var qrModal=document.getElementById('qrModal')
  var qrStatus=document.getElementById('qrStatus')
  function openQrModal(){qrModal.style.display='flex';if(qrStatus){qrStatus.textContent='';qrStatus.className='qr-status'}}
  function closeQrModal(){qrModal.style.display='none'}
  var btnQrModal=document.getElementById('btnQrModal')
  if(btnQrModal)btnQrModal.addEventListener('click',openQrModal)
  var qrModalClose=document.getElementById('qrModalClose')
  if(qrModalClose)qrModalClose.addEventListener('click',closeQrModal)
  if(qrModal)qrModal.addEventListener('click',function(e){if(e.target===qrModal)closeQrModal()})
  function uploadQrFile(file){
    if(!file)return
    if(file.type.indexOf('image/')!==0){qrStatus.textContent='请选择图片文件';qrStatus.className='qr-status err';return}
    qrStatus.textContent='正在识别签到…';qrStatus.className='qr-status'
    fetch('/upload/image?type=qr',{method:'POST',body:file,headers:{'Content-Type':file.type}})
      .then(function(r){return r.json()})
      .then(function(d){
        if(d.success){qrStatus.textContent='✅ '+d.message;qrStatus.className='qr-status ok'}
        else{qrStatus.textContent='❌ '+(d.error||'处理失败');qrStatus.className='qr-status err'}
      })
      .catch(function(err){qrStatus.textContent='❌ 上传失败: '+err.message;qrStatus.className='qr-status err'})
  }
  var qrDrop=document.getElementById('qrDrop')
  if(qrDrop){
    qrDrop.addEventListener('dragover',function(e){e.preventDefault();e.stopPropagation();qrDrop.classList.add('drag')})
    qrDrop.addEventListener('dragleave',function(){qrDrop.classList.remove('drag')})
    qrDrop.addEventListener('drop',function(e){
      e.preventDefault();e.stopPropagation();qrDrop.classList.remove('drag')
      var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]
      if(f)uploadQrFile(f)
    })
  }
  var btnPickFile=document.getElementById('btnPickFile')
  var qrFileInput=document.getElementById('qrFileInput')
  if(btnPickFile&&qrFileInput){
    btnPickFile.addEventListener('click',function(){qrFileInput.click()})
    qrFileInput.addEventListener('change',function(){
      if(qrFileInput.files&&qrFileInput.files[0])uploadQrFile(qrFileInput.files[0])
      qrFileInput.value=''
    })
  }
  poll()
  setInterval(poll,5000)
})();
</script>
</body>
</html>`
}

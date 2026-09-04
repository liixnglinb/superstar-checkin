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
  recent?: Array<{ time: string; courseName: string; type: string; result: string; accountName: string; timestamp?: number }>
  recordCount?: number
  successCount?: number
  failCount?: number
  cookieValid?: boolean
  imConnected?: boolean
  qrPending?: boolean
  photoPending?: boolean
}

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
  courses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
  radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
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
    : `<div class="empty"><p>未配置账号</p><p class="empty-sub">请在 config.yaml 中填写账号后重启软件</p></div>`

  const courseRows = courses.length
    ? courses.map(c => `
      <tr>
        <td class="cell-main">${esc(c.courseName)}</td>
        <td class="cell-mono">${c.courseId}</td>
        <td class="cell-mono">${c.classId}</td>
        <td><span class="pill pill-ok">监控中</span></td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="cell-empty">暂无课程数据</td></tr>`

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

  const settingsRows = `
    <div class="set-row"><span class="set-label">监听模式</span><span class="set-value">${esc(modeText(mode))}</span></div>
    <div class="set-row"><span class="set-label">轮询间隔</span><span class="set-value">${status.pollInterval ? status.pollInterval / 1000 + ' 秒' : '—'}</span></div>
    <div class="set-row"><span class="set-label">服务端口</span><span class="set-value">${esc(String(status.port || '—'))}</span></div>
    <div class="set-row"><span class="set-label">登录状态</span><span class="set-value">${status.cookieValid === false ? '<span class="pill pill-err">Cookie 失效</span>' : '<span class="pill pill-ok">Cookie 有效</span>'}</span></div>
    <div class="set-row"><span class="set-label">IM 通道</span><span class="set-value">${status.imConnected ? '<span class="pill pill-ok">已连接</span>' : '<span class="pill pill-warn">不可用（轮询兜底）</span>'}</span></div>
    <div class="set-row"><span class="set-label">配置文件</span><span class="set-value cell-mono">config.yaml（软件同目录，修改后重启生效）</span></div>`

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>学习通自动签到</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --canvas:#F4F6F8;--surface:#FFFFFF;--surface-2:#EDF0F3;
  --text:#1B1F24;--text-2:#5A6470;--text-3:#8A93A0;
  --border:#E2E6EA;
  --accent:#0E7C66;--accent-weak:#E3F2EC;
  --ok:#178A5B;--err:#D64545;--warn:#B7791F;
  --radius-lg:12px;--radius-sm:8px;
  --font:-apple-system,"Segoe UI Variable","Segoe UI","Microsoft YaHei UI","Microsoft YaHei",sans-serif;
}
html,body{height:100%}
body{font-family:var(--font);background:var(--canvas);color:var(--text);font-size:14px;line-height:1.5;overflow:hidden}
.app{display:flex;height:100vh}
/* ===== 左侧栏 ===== */
.side{width:224px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:16px 12px}
.brand{display:flex;align-items:center;gap:10px;padding:4px 8px 16px}
.brand-logo{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#0E7C66,#14A085);display:flex;align-items:center;justify-content:center;color:#fff}
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
.btn-primary:hover{background:#0C6B58}
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
/* ===== 表格 ===== */
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;padding:10px 18px;font-size:12px;font-weight:600;color:var(--text-2);border-bottom:1px solid var(--border);background:var(--surface-2);letter-spacing:.02em}
td{padding:11px 18px;border-bottom:1px solid var(--border);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:#FAFBFC}
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
/* ===== 空态 ===== */
.empty{padding:36px 18px;text-align:center}
.empty p{color:var(--text-2);font-size:14px}
.empty-sub{font-size:12.5px;color:var(--text-3);margin-top:4px}
/* ===== 滚动条（浏览器表面也主题化） ===== */
.content::-webkit-scrollbar{width:10px}
.content::-webkit-scrollbar-thumb{background:#CFD6DC;border-radius:5px;border:2px solid var(--canvas)}
.content::-webkit-scrollbar-thumb:hover{background:#B8C1C9}
::selection{background:rgba(14,124,102,.16)}
</style>
</head>
<body>
<div class="app">
  <aside class="side">
    <div class="brand">
      <div class="brand-logo">${ICONS.check}</div>
      <div>
        <div class="brand-name">学习通自动签到</div>
        <div class="brand-ver">v${esc(status.version || '3.1')}</div>
      </div>
    </div>
    <nav class="nav" id="nav">
      <button class="nav-item active" data-view="overview">${ICONS.home}<span>总览</span></button>
      <button class="nav-item" data-view="courses">${ICONS.courses}<span>课程</span></button>
      <button class="nav-item" data-view="history">${ICONS.history}<span>历史记录</span></button>
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
        <a class="btn btn-primary" href="/upload?type=qr${esc(qs)}">${ICONS.qr}<span>二维码签到</span></a>
        <a class="btn btn-ghost" href="/upload?type=photo${esc(qs)}">${ICONS.camera}<span>拍照签到</span></a>
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
          <table>
            <thead><tr><th>课程名称</th><th>Course ID</th><th>Class ID</th><th>状态</th></tr></thead>
            <tbody id="coursesBody">${courseRows}</tbody>
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
        </div>
      </section>

      <!-- 设置 -->
      <section class="view" data-view="settings">
        <div class="section">
          <div class="section-head"><span class="section-title">运行配置</span></div>
          ${settingsRows}
        </div>
        <div class="section">
          <div class="section-head"><span class="section-title">说明</span></div>
          <div style="padding:14px 18px;font-size:13px;color:var(--text-2);line-height:1.8">
            配置修改后需重启软件生效。二维码/拍照签到可直接点击右上角按钮上传，也可用手机访问本机局域网地址上传。
          </div>
        </div>
      </section>
    </main>
  </div>
</div>

<script>
(function(){
  var views=['overview','courses','history','settings']
  var titles={overview:'总览',courses:'课程',history:'历史记录',settings:'设置'}
  function show(v){
    if(views.indexOf(v)<0)v='overview'
    document.querySelectorAll('.view').forEach(function(el){el.classList.toggle('active',el.dataset.view===v)})
    document.querySelectorAll('.nav-item').forEach(function(el){el.classList.toggle('active',el.dataset.view===v)})
    document.getElementById('pageTitle').textContent=titles[v]
  }
  document.getElementById('nav').addEventListener('click',function(e){
    var btn=e.target.closest('.nav-item');if(!btn)return
    show(btn.dataset.view)
    if(history.replaceState)history.replaceState(null,'','#'+btn.dataset.view)
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
        : '<div class="empty"><p>未配置账号</p><p class="empty-sub">请在 config.yaml 中填写账号后重启软件</p></div>'
    }
    // 课程表
    var cb=document.getElementById('coursesBody')
    if(cb){
      var cs2=s.courses||[]
      cb.innerHTML=cs2.length
        ? cs2.map(function(c){
            return '<tr><td class="cell-main">'+esc(c.courseName)+'</td><td class="cell-mono">'+esc(String(c.courseId))+'</td><td class="cell-mono">'+esc(String(c.classId))+'</td><td><span class="pill pill-ok">监控中</span></td></tr>'
          }).join('')
        : '<tr><td colspan="4" class="cell-empty">暂无课程数据</td></tr>'
    }
    var cc=document.getElementById('courseCount')
    if(cc)cc.textContent=(s.courses||[]).length+' 门 · 轮询发现签到活动'
  }
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function fmtTime(ts){if(!ts)return '—';var d=new Date(ts),n=new Date();var hm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');if(d.toDateString()===n.toDateString())return '今天 '+hm;var y=new Date(n.getTime()-86400000);if(d.toDateString()===y.toDateString())return '昨天 '+hm;return (d.getMonth()+1)+'月'+d.getDate()+'日 '+hm}
  function typeText(t){var m={normal:'普通',gesture:'手势',qr:'二维码',location:'位置',photo:'拍照'};return m[t]||t}
  function poll(){fetch('/api/status').then(function(r){return r.json()}).then(render).catch(function(){})}
  if(location.hash&&views.indexOf(location.hash.slice(1))>=0)show(location.hash.slice(1))
  poll()
  setInterval(poll,5000)
})();
</script>
</body>
</html>`
}

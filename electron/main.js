// Electron 主进程：启动签到服务 + 桌面窗口 + 系统托盘
// 打包为软件安装形式，界面为内置窗口（不依赖浏览器）
process.env.NO_OPEN_BROWSER = '1' // 禁止服务层调用系统浏览器

const path = require('path')
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron')

// 单实例：防止重复启动
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

const ICON = path.join(__dirname, '..', 'assets', 'app-icon.ico')
const CONSOLE_URL = 'http://127.0.0.1:3456/'

let mainWindow = null
let tray = null
let quitting = false
let serviceReady = false

// 服务就绪探测：等业务模块初始化完成（课程/账号数据可用）再打开窗口，保证首屏完整
function waitForService(retries) {
  const http = require('http')
  const req = http.get('http://127.0.0.1:3456/api/status', (res) => {
    let body = ''
    res.on('data', (d) => { body += d })
    res.on('end', () => {
      try {
        const data = JSON.parse(body)
        // 业务数据就绪（账号已配置且课程已加载，或明确无配置）
        if ((data.accounts && data.accounts.length > 0 && data.courses && data.courses.length > 0) || (data.courses && data.courses.length === 0 && data.uptime > 10)) {
          serviceReady = true
          openWindow()
          return
        }
      } catch (e) { /* 非 JSON，继续等待 */ }
      retry()
    })
  })
  req.on('error', retry)
  req.setTimeout(3000, () => { req.destroy(); retry() })

  function retry() {
    if (retries > 0) setTimeout(() => waitForService(retries - 1), 800)
    else { serviceReady = false; openWindow() }
  }
}

function openWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    return
  }
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    title: '学习通自动签到',
    icon: ICON,
    // 无边框自绘标题栏：去掉系统深色标题栏（大黑边），标题栏与内置 UI 融为一体
    frame: false,
    backgroundColor: '#F4F6F8',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  mainWindow.loadURL(CONSOLE_URL)
  // 安全防护：阻止页面导航离开本机控制台（含拖拽文件误触发的跳转）
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('http://127.0.0.1:3456')) e.preventDefault()
  })
  mainWindow.on('close', (e) => {
    // 关闭窗口 = 最小化到托盘（后台继续签到监控）
    if (!quitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
  mainWindow.on('closed', () => { mainWindow = null })
}

function createTray() {
  const img = nativeImage.createFromPath(ICON)
  tray = new Tray(img.resize({ width: 16, height: 16 }))
  tray.setToolTip('学习通自动签到 · 运行中')
  rebuildTrayMenu('今日已签 - · 失败 -')
  tray.on('double-click', () => openWindow())
  // 每 30 秒刷新托盘今日统计
  setInterval(refreshTrayStats, 30000)
  refreshTrayStats()
}

function refreshTrayStats() {
  const http = require('http')
  const req = http.get('http://127.0.0.1:3456/api/status', (res) => {
    let body = ''
    res.on('data', (d) => { body += d })
    res.on('end', () => {
      try {
        const s = JSON.parse(body)
        const t = s.todayStats || { success: 0, fail: 0 }
        rebuildTrayMenu(`今日已签 ${t.success} · 失败 ${t.fail}`)
      } catch (e) { /* 服务未就绪，保持旧文案 */ }
    })
  })
  req.on('error', () => {})
  req.setTimeout(3000, () => req.destroy())
}

function rebuildTrayMenu(todayLine) {
  if (!tray) return
  const menu = Menu.buildFromTemplate([
    { label: todayLine, enabled: false },
    { label: '打开控制台', click: () => openWindow() },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        quitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
}

app.whenReady().then(() => {
  // 窗口控制（自绘标题栏按钮 → 主进程；模块级注册一次，避免重复监听）
  ipcMain.on('win-minimize', () => mainWindow && mainWindow.minimize())
  ipcMain.on('win-maximize-toggle', () => {
    if (!mainWindow) return
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  })
  ipcMain.on('win-close', () => {
    // 与系统关闭行为一致：最小化到托盘（后台继续签到监控）
    if (mainWindow) mainWindow.close()
  })
  ipcMain.handle('win-is-maximized', () => mainWindow ? mainWindow.isMaximized() : false)
  // 开机自启（设置页开关；安装版在开始菜单生成快捷方式后可用）
  ipcMain.handle('auto-launch-get', () => {
    try { return app.getLoginItemSettings().openAtLogin } catch { return false }
  })
  ipcMain.handle('auto-launch-set', (_e, v) => {
    try {
      app.setLoginItemSettings({ openAtLogin: !!v, openAsHidden: true })
      return { ok: true, openAtLogin: !!v }
    } catch (err) {
      return { ok: false, message: String(err) }
    }
  })
  // 免责声明「不同意并退出」：真正退出应用（不驻留托盘）
  ipcMain.on('app-quit', () => {
    quitting = true
    app.quit()
  })
  // 启动签到服务（构建产物，与窗口同进程）
  try {
    require(path.join(__dirname, '..', 'build', 'index.js'))
  } catch (err) {
    console.error('签到服务启动失败:', err)
  }
  createTray()
  waitForService(60)
  app.on('activate', () => openWindow())
})

// 单实例：已有实例运行时激活已有窗口
app.on('second-instance', () => openWindow())

app.on('window-all-closed', (e) => {
  // 托盘常驻，不退出
})

app.on('before-quit', () => { quitting = true })

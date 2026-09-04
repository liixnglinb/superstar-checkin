# 学习通自动签到（ChaoXing Auto Sign）

学习通（超星）自动签到桌面软件。安装后常驻系统托盘，自动监听课程签到活动（普通 / 位置 / 二维码签到），支持失败自动重试，签到结果通过钉钉机器人 / Bark / PushPlus / 邮件推送通知。

## 功能

- **桌面软件**：Electron 内嵌窗口控制台，不依赖浏览器，托盘常驻后台监控
- **自动签到**：混合模式（IM 消息 + 轮询兜底），发现签到活动自动处理
- **签到类型支持**：
  - 普通签到：全自动
  - 位置签到：全自动（自动读取教师发布坐标，在 10 米范围内生成签到点）
  - 二维码签到：任意签到二维码图片直接拖入软件窗口，自动识别完成签到（二维码更新后拖入新码即可）
- **多账号支持**：可配置多个账号，各自独立登录签到
- **通知推送**：钉钉 / Bark / PushPlus / 邮件
- **失败重试**：自动重试（上限 3 次），异常不影响后续签到

## 安装

下载 `学习通自动签到-安装版-*.exe`，双击安装（安装到当前用户目录，无需管理员权限），安装完成自动启动。

## 首次使用

1. 启动软件后进入「设置」页
2. 在「账号配置」中填写你的学习通账号（手机号）和密码
3. 点击「保存账号」，重启软件生效
4. 重启后软件自动登录并加载课程列表，开始监控签到

> 账号保存在软件目录的 `config.yaml` 中（明文）。多人共用时各人填写各自的账号即可；请勿分享包含账号的软件目录。

## 使用方法

- **总览**：监控课程数、累计记录、成功/失败统计、最近活动
- **课程**：已加载的课程列表（Course ID / Class ID）
- **历史记录**：所有签到记录
- **设置**：监听模式、轮询间隔、账号配置、登录状态

### 二维码签到（拖拽 / 上传）

老师发起二维码签到时，把签到二维码图片**直接拖入软件窗口**，或：

- 点击软件右上角「二维码签到」按钮上传图片
- 或手机浏览器访问 `http://电脑局域网IP:3456/upload?type=qr`（同一 Wi-Fi 下）

软件自动识别二维码并完成签到。二维码会随时间更新，更新后拖入新码即可。

> 拍照签到、手势签到已从软件中移除：检测到这两类签到活动时会推送提醒（本软件不支持自动完成），请在学习通 APP 中手动签到。

### 手动签到

在服务日志终端输入：

```
签到 <aid> [enc|courseId]
历史
课程
```

## 配置文件（config.yaml）

首次运行自动生成。常用配置项：

```yaml
accounts:
  - username: 手机号
    password: 密码

listener:
  mode: hybrid        # im = IM 消息 | poll = 轮询 | hybrid = 两者
  pollInterval: 30000 # 轮询间隔（毫秒）

checkin:
  delay: { min: 15, max: 45 }   # 签到随机延迟（秒），降低风控概率
  retry: { maxAttempts: 3, delayMs: 5000 }

notify:
  channels:
    - type: dingtalk    # 钉钉机器人
      enabled: false
      config: { webhook: "https://oapi.dingtalk.com/robot/send?access_token=xxx", secret: "" }
    - type: bark        # Bark iOS 推送
      enabled: false
      config: { url: "", key: "" }
    - type: pushplus
      enabled: false
      config: { token: "" }
    - type: email       # SMTP 邮件（需安装 nodemailer）
      enabled: false
      config: { smtpHost: "", smtpPort: 465, from: "", password: "", to: "" }

geo:                  # 位置签到
  providers: { amapKey: "" }
  locations: [ { courseId: "", lat: 30.123456, lon: 120.123456, address: "" } ]

dingtalk:
  port: 3456          # 上传/控制台端口
  appKey: ""
  appSecret: ""

web:
  port: 3456
  token: ""           # 控制台访问令牌（可选）

storage:
  dataDir: ./data
```

## 构建

```bash
npm install
npm run build        # 编译 TS
npx electron-builder --win nsis   # 打包 NSIS 安装程序（输出 dist-electron/）
npm run pack         # 备选：打包 SEA 单文件 exe（输出 dist/）
```

## 目录结构

```
src/
  index.ts                  # 主入口
  listeners/                # IM 监听 / 轮询监听
  handlers/                 # 签到处理（二维码/拍照/手势/位置）
  providers/                # 账号管理 / 配置 / 签到状态
  server/                   # 本地 HTTP 服务 + 控制台 UI
  core/                     # 课程 / 签到引擎
  notifiers/                # 通知渠道
electron/
  main.js                   # Electron 主进程（窗口 + 托盘）
assets/
  app-icon.ico              # 软件图标
```

## 免责声明

本软件仅用于个人学习自动化研究。使用本软件进行签到可能违反所在学校的考勤管理规定，请自行评估风险并承担后果。请勿将软件用于作弊、代签等违规用途。

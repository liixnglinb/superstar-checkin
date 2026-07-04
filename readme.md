# Superstar Checkin — 超星学习通自动签到 (改进版)

基于 [clansty/superstar-checkin](https://github.com/clansty/superstar-checkin) 的增强版。

## 新增功能

### 微信推送通知
- 通过 PushPlus 推送签到结果到微信，替代原 QQ 机器人

### 智能位置签到
- **地理编码** — 高德 → 百度 → OSM 三级降级，根据教师地址文本自动获取坐标
- **三角定位** — 利用服务器距离反馈，四方向搜索 + 二分逼近，自动定位到 50 米内
- **坐标记忆** — 签到成功的位置自动记住，同地址下次秒签
- **GPS 漂移** — 提交坐标在 5~30 米随机偏移

### 二维码签到 API
- 提供 HTTP API 端点，可通过博客/网页远程触发签到

### 全类型签到
- 普通签到 ✅ 拍照签到 ✅ 位置签到 ✅ 手势签到 ⚠️ 二维码签到 ⚠️

## 技术改进
- Node.js v24 兼容 — 修复 navigator getter 冲突
- npm 包管理 — 从 Yarn Berry 迁移到 npm
- preSign 修复 — 添加 courseId/classId/uid/tid 参数
- analysis/analysis2 — 添加防重放验证步骤
- Cookie 域修复 — 使用 mobilelearn.chaoxing.com 域
- fid 动态提取 — 从 Cookie 提取，不再硬编码

## 快速开始
```bash
git clone https://github.com/liixnglinb/superstar-checkin.git
cd superstar-checkin
npm install
cp config.example.yaml config.yaml
# 编辑 config.yaml 填入学习通账号和 PushPlus token
npm run build
node build/index.js
```

## License
GPL-3.0

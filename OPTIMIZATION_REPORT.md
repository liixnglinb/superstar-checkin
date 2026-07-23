# 学习通自动签到系统 — P1/P2 全面优化报告

> 项目路径：`C:\Users\李星历\.qoderworkcn\workspace\mr7wir497wflajc2\outputs\chaoxing-auto-sign`
> 优化后版本：`v3.1`
> 验证结果：`tsc --noEmit` 通过（EXIT=0），`npm run build` 通过（EXIT=0）
> 说明：P0（服务器 IP 风控 / 403 拦截、明文凭证）按你的要求 **未处理**。

---

## 一、可行性结论

**可行。** 全部 P1、P2 问题已在 TypeScript 源码层修复，并通过类型检查与构建验证。改动均为增量式增强，未改动原有签到主流程的业务逻辑，向后兼容既有 `config.yaml`。

---

## 二、P1 / P2 修复清单

### P1 — 可靠性与健壮性（核心问题）

| # | 问题 | 修复方案 | 涉及文件 |
|---|------|----------|----------|
| 1 | **双监听器重复签到**（IM 与轮询各记各的，同一活动可能被签两次） | 新增跨监听器共享去重状态 `sign-state.ts`，统一用 `markProcessed / isProcessed` 判重；轮询监听器移除本地 `processedAids`，改用全局集合并按 1000 条上限裁剪 | `src/providers/sign-state.ts`（新增）、`src/listeners/poll-listener.ts`、`src/index.ts` |
| 2 | **二维码并发覆盖**（`pendingQrAid` 单变量会互相覆盖，导致漏签/错签） | 改为 `pendingQr` Map（aid → QR 信息），支持并发排队、按 aid 取用、取最新一个 | `src/providers/sign-state.ts`、`src/index.ts` |
| 3 | **IM Token 过期后静默失效** | `im-listener.ts` 重写连接管理：周期性 token 刷新（默认 20 分钟）、指数退避重连（上限 60s）、`onStatusChange` 状态回调、`dispose()` 清理、token 空值保护 | `src/listeners/im-listener.ts`（重写） |
| 4 | **Cookie 无运行时刷新**（登陆态失效后系统卡死） | `account-manager.ts` 新增 `startAutoRefresh`（默认 6h，随机初始延迟）、`refreshAll`、`forceRefresh`、`onRefreshFail` 回调；`refreshIfNeeded` 支持 `force` 参数 | `src/providers/account-manager.ts`、`src/index.ts` |
| 5 | **`validateCookie` 误判**（靠 `'用户登录'` 字符串匹配，极易误杀） | 改为调用 `API.USER_INFO` 并校验 `res.data?.result === 1` 的真实登陆态 | `src/core/login.ts` |
| 6 | **`randomDelay` 退化成固定值**（本应区间随机，实际恒等于上限） | 修正为 `const { min, max } = this.config.checkin.delay; await randomDelay(min, max)`，恢复真实区间抖动 | `src/handlers/checkin-handler.ts` |

### P2 — 代码质量与可维护性

| # | 问题 | 修复方案 | 涉及文件 |
|---|------|----------|----------|
| 7 | **钉钉图片下载为空**（`gettoken` + `messageFiles/download` 链路未实现） | `dingtalk-server.ts` 重写 `handleImageCode`：先 `gettoken` 取 `access_token`，再请求 `messageFiles/download` 拉取图片字节 | `src/server/dingtalk-server.ts`（重写） |
| 8 | **上传接口无鉴权**（`/upload/image` 任何人可调用） | 新增可选 `?token=` 校验；上传页注入 `UPLOAD_TOKEN`；新增 CORS 支持；构造函数改为 `(port, appSecret, options)` 形态 | `src/server/dingtalk-server.ts`、`src/index.ts` |
| 9 | **家庭宽带代理不可配置** | 新增 `runtime-config.ts` 全局代理 + `AppConfig.proxy` 字段；`getProxyConfig()` 将 URL 字符串解析为 axios 的 `AxiosProxyConfig`（无效/空则返回 `false`）；login 与 checkin-engine 五处请求统一接入 | `src/providers/runtime-config.ts`（新增）、`src/types/index.ts`、`src/core/login.ts`、`src/core/checkin-engine.ts`、`config.example.yaml` |
| 10 | **日志风格不统一**（混用 `console` 与 `logger`） | `anti-detect.ts` 的 `withRetry` 改用 `logger.warn`，统一日志出口 | `src/utils/anti-detect.ts` |
| 11 | **看门狗缺失**（IM 掉线 / 活动长时间无更新无告警） | `index.ts` 新增 5 分钟看门狗：检测 IM 断开、活动超过 30 分钟无更新，自动钉钉通知 | `src/index.ts` |
| 12 | **二维码目录监听未真正解码** | 监听到文件后实际调用 OCR 解码并进入签到流程（此前仅监听、未处理） | `src/index.ts` |

---

## 三、新增配置项（向后兼容）

`config.example.yaml` 已更新，新增：

```yaml
proxy: ""   # 留空=直连；可填住宅代理，如 http://user:pass@host:port
```

其余新增能力（IM 重连、Cookie 自动刷新、看门狗、上传 token）均为内置默认行为，无需额外配置即可生效。

---

## 四、部署 / 运行提醒

1. 首次运行需 `npm install`（依赖 axios / axios-cookiejar-support / jsdom / ws / yaml 等，约 200 包）。
2. 构建产物 `build/` 已验证能正确拷贝 `sdk/`（环信 SDK 依赖）。
3. 如需本机跑起来验证，建议按顺序：`npm install` → `npm run build` → 用 pm2 / docker-compose 启动。

---

## 五、仍遗留的 P0（未做，按你要求）

- 阿里云/数据中心 IP 触发 403 风控：本机无法直接解决，需依赖上面新增的 `proxy`（住宅代理）能力由你自行配置绕过。
- 凭证明文存储：你确认仅存于本地，故未做加密改造。

---

## 六、改动文件一览

新增：`src/providers/sign-state.ts`、`src/providers/runtime-config.ts`
重写：`src/listeners/im-listener.ts`、`src/server/dingtalk-server.ts`、`src/index.ts`
修改：`src/core/login.ts`、`src/core/checkin-engine.ts`、`src/handlers/checkin-handler.ts`、`src/listeners/poll-listener.ts`、`src/providers/account-manager.ts`、`src/utils/anti-detect.ts`、`src/types/index.ts`、`config.example.yaml`

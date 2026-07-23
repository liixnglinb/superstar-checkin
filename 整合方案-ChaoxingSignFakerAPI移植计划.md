# ChaoxingSignFaker API 移植整合方案

> 基于 ChaoxingSignFaker (Kotlin/Android) 逆向成果，将 6 种签到类型的完整 API 逻辑移植到现有的 Node.js/TypeScript 自动签到系统。

---

## 一、差距总览

| 签到类型 | 现有系统 | CSF 参考 | 差距 |
|---------|---------|----------|------|
| 普通签到 | ✅ simpleCheckin | — | 无 |
| 手势签到 | ⚠️ plain submit 无参数 | ✅ signCode 参数 + checkSignCode 验证 | **大** |
| 签到码签到 | ❌ 未实现 | ✅ checkSignCode + signCode 参数 + numberCount | **完全缺失** |
| 位置签到 | ✅ geoCheckin + 三角定位 | ✅ 同 + 人脸识别扩展 | 中（缺人脸 + 签退检测） |
| 二维码签到 | ✅ qrCheckin | ✅ 同 + 人脸识别扩展 + 位置扩展 | 中（缺人脸 + 过期检测） |
| 拍照签到 | ⚠️ 引擎已支持但 handler 抛异常 | ✅ 同 + 预存图自动提交 | 小（handler 异常需改） |
| 签退检测 | ❌ 未实现 | ✅ signOutId + signOutPublishTimeStamp | **完全缺失** |
| 验证码处理 | ❌ 未实现 | ✅ captcha getConf → image → result | **完全缺失** |
| 人脸识别 | ❌ 未实现 | ✅ faceResult → check-face-result → enc | **完全缺失** |
| 已签到检测 | ⚠️ 统一 success 字符串 | ✅ 每类型独立检测精确匹配 | 中 |

---

## 二、分层架构整合方案

### 新增/修改文件清单

```
src/
├── core/
│   ├── checkin-engine.ts         ← 大幅修改：增减类型分支、预签到改进
│   ├── captcha-helper.ts         ★ 新增：验证码流程（getConf → image → result）
│   └── face-helper.ts            ★ 新增：人脸识别（faceResult → check-face-result）
├── handlers/
│   └── checkin-handler.ts        ← 修改：新增 password/code 签到入口、签退检测
├── types/
│   └── index.ts                  ← 修改：新增 CheckinType 'password'/'signout'
├── constants.ts                  ← 修改：API 端点补充、CHECKIN_TYPE_MAP 补 5
└── server/
    └── dingtalk-server.ts        ← 可选修改：签到码输入通道
```

---

## 三、逐类型移植详细方案

### 3.1 签到码签到（otherId=5）— 全新实现

**API 流程**：

```
获取活动信息: GET /v2/apis/active/getPPTActiveInfo
  → 提取 data.numberCount（教师预设码位数，如 6）
  
验证签到码: GET /widget/sign/pcStuSignController/checkSignCode
  params: activeId, signCode
  → 响应: { "result": 1 } 表示正确
  
提交签到: GET /pptSign/stuSignajax
  params: activeId, uid, name, fid, signCode, deviceCode, latitude="", longitude=""
  → "success" 或包含签到码输入界面 → 已签到
```

**代码修改**：

**constants.ts** — 新增 `CHECKIN_TYPE_MAP[5] = 'password'` 和 API 端点

```typescript
// constants.ts 追加
CHECKIN_TYPE_MAP: {
  0: 'normal',
  2: 'qr',
  3: 'gesture',
  4: 'location',
  5: 'password',   // ★ 新增
}

API.CHECK_SIGN_CODE: 'https://mobilelearn.chaoxing.com/widget/sign/pcStuSignController/checkSignCode'
```

**types/index.ts** — 更新联合类型

```typescript
export type CheckinType = 'normal' | 'gesture' | 'qr' | 'location' | 'photo' | 'password'
```

**checkin-engine.ts** — 新增 `passwordCheckin` 方法

```typescript
static async passwordCheckin(
  account: AccountMetaData,
  activeId: string,
  signCode: string,
  extra?: { courseId?: number | string },
): Promise<string> {
  const jar = new CookieJar()
  const client = wrapper(axios.create({ jar, proxy: getProxyConfig() }))

  // 1. 验证签到码
  const verifyRes = await client.get(API.CHECK_SIGN_CODE, {
    headers: { Cookie: account.cookie, 'User-Agent': MOBILE_AGENT },
    params: { activeId, signCode },
  })
  if (verifyRes.data?.result !== 1) {
    return `签到码验证失败: ${JSON.stringify(verifyRes.data)}`
  }

  // 2. preSign
  await this.preSign(client, account.cookie, { activeId, uid: account.uid }, extra)

  // 3. 提交签到（带 signCode + 空经纬度）
  return this.submitSign(client, account.cookie, {
    name: account.name,
    activeId,
    uid: account.uid,
    signCode,
    extraParams: { latitude: '', longitude: '' },
  })
}
```

**checkin-handler.ts** — 新增 password 分支

```typescript
case 'password':
  if (!info.signCode) {
    return '签到码签到需要 signCode，请通过输入通道提交'
  }
  return CheckinEngine.passwordCheckin(account, aid, info.signCode, { courseId })
```

**签到码输入通道**：复用现有钉钉上传页模式，新增 `?type=code` 页面接收用户输入的签到码。

---

### 3.2 手势签到（otherId=3）— 加固

**当前问题**：`simpleCheckin` 不传 `signCode` 参数，手势验证完全跳过。

**移植后流程**：
```
获取活动信息 → 提取 signInId
用户提供手势码（6位数字）→ checkSignCode 验证 → preSign → stuSignajax(signCode)
```

**代码修改** — `checkin-engine.ts` 新增 `gestureCheckin`

```typescript
static async gestureCheckin(
  account: AccountMetaData,
  activeId: string,
  signCode: string,
  extra?: { courseId?: number | string },
): Promise<string> {
  const jar = new CookieJar()
  const client = wrapper(axios.create({ jar, proxy: getProxyConfig() }))

  // 验证手势码
  const verifyRes = await client.get(API.CHECK_SIGN_CODE, {
    headers: { Cookie: account.cookie, 'User-Agent': MOBILE_AGENT },
    params: { activeId, signCode },
  })
  if (verifyRes.data?.result !== 1) {
    return `手势码验证失败: ${JSON.stringify(verifyRes.data)}`
  }

  await this.preSign(client, account.cookie, { activeId, uid: account.uid }, extra)

  return this.submitSign(client, account.cookie, {
    name: account.name, activeId, uid: account.uid,
    signCode,
    extraParams: { latitude: '', longitude: '' },
  })
}
```

**注意**：手势码需要用户提供（同签到码逻辑），无法自动破解。现有 `[手势] plain submit` 保留作为 fallback。

---

### 3.3 拍照签到（otherId=0, ifphoto=1）— 修复自动提交

**当前问题**：handler 中 `case 'photo'` 直接 `throw new Error`，即使有默认照片也跳过。

**修改**：在 handler 中增加自动 fallback 逻辑

```typescript
case 'photo':
  // 有默认照片 → 自动上传提交
  if (this.config.photo?.path) {
    return CheckinEngine.photoCheckin(account, aid, this.config.photo.path, { courseId, classId })
  }
  // 无默认照片 → 等待用户上传（通过钉钉）
  throw new Error('拍照签到需要提供照片，请通过上传链接提交')
```

**config.yaml 新增**：
```yaml
photo:
  path: "/app/default-photo.jpg"  # 可选：容器内预存照片路径
```

---

### 3.4 已签到检测 — 按类型精确判断

**当前问题**：所有类型统一检查 `'success'` 或 `'签到成功'`，但 CSF 显示不同签到成功后页面 HTML 包含不同标识文字。

**修改 submitSign 响应解析**（`checkin-engine.ts`）：

| 类型 | 未签到标识 | 已签到标识 |
|------|-----------|-----------|
| gesture | 包含 `"传达的手势图案"` | 不包含 |
| password | 包含 `"输入发起者设置的签到码完成签到"` | 不包含 |
| location | 包含 `"恭喜你已完成签"` | 不包含 |
| qr | 包含 `"扫一扫"` | 不包含 |
| photo | 包含 `"请先拍照"` 或按钮 HTML | 不包含 |

```typescript
// 新增方法
static checkAlreadySigned(type: string, responseHtml: string): boolean {
  const markers: Record<string, string[]> = {
    gesture: ['传达的手势图案'],
    password: ['输入发起者设置的签到码完成签到'],
    location: ['恭喜你已完成签'],
    qr: ['扫一扫'],
    photo: ['请先拍照', '<div class="zactives-btn" onclick="send()">'],
  }
  const typeMarkers = markers[type] || []
  if (typeMarkers.length === 0) return false
  // CSF 逻辑：响应包含这些标记说明还未签到（页面还在等待操作）
  return !typeMarkers.some(m => responseHtml.includes(m))
}
```

---

### 3.5 验证码处理 — 全新实现

**当前问题**：`stuSignajax` 返回 `"validate"` 时系统无处理，签到直接失败。

**新增 `captcha-helper.ts`**：

```
流程：
1. GET /captcha/get/conf
   params: captchaId=Qt9FIw9o4pwRjOyqM6yizZBh682qN2TU, _=timestamp, callback=cx_captcha_function
   → 提取 t（时间戳令牌）

2. GET /captcha/get/verification/image
   params: callback, captchaId, type=slide, version, captchaKey(MD5), token(MD5), iv(MD5)
   → 提取 shadeImage(背景图) + cutoutImage(滑块图)

3. 滑块验证（前端交互，纯服务端需要：
   a) 将图片保存/推送到用户手机
   b) 用户拖拽完成后提交坐标

4. POST /captcha/check/verification/result
   params: callback, captchaId, type, token, textClickArr, coordinate, runEnv, version, iv
   → 提取 validate 字符串

5. 携带 validate 重新调用 stuSignajax
```

**服务端简化方案**：由于纯服务端无法做滑块拖拽交互，建议：
1. 检测到 `"validate"` 时，将验证码图片推送到钉钉
2. 用户手机打开链接完成滑块验证
3. 结果回调到系统，携带 `validate` 重试签到

---

### 3.6 人脸识别 — 全新实现

**新增 `face-helper.ts`**：

**API**：`GET /pptSign/check-face-result`

**参数**：
- `activeId`
- `faceResult`: JSON 字符串，结构：
  ```json
  {
    "currentFaceId": "<云盘图片objectId>",
    "LiveDetectionStatus": 1,
    "collectStatus": 1,
    "cxtime": "<当前时间戳>",
    "cxcid": "<解密的clientId>",
    "signToken": "<MD5签名>"
  }
  ```

**signToken 生成**：
```
将 TreeMap(currentFaceId, LiveDetectionStatus, collectStatus, cxtime, cxcid) 
按 key 排序 → 拼接 value 字符串 → 末尾追加 "sc" → 取 MD5
```

**集成位置**：在 `geoCheckin` 和 `qrCheckin` 中，当 `signInfo.ifOpenCheckFace === 1` 时触发。

---

### 3.7 签退检测 — 新增

**数据来源**：`/v2/apis/active/getPPTActiveInfo` 响应中的 `signOutPublishTimeStamp`

| 情景 | 逻辑 |
|------|------|
| `signOutPublishTimeStamp == -1` | 无签退事件 |
| `signOutPublishTimeStamp == 4999` | 无签退事件 |
| `signOutPublishTimeStamp == 有效时间戳` | 有签退事件，需监听 |

**签到完成后**：记录 `signOutId`，当接收到签退推送时自动提交签退请求（同签到流程，但使用签退相关端点）。

---

## 四、执行路线图

| 优先级 | 任务 | 工作量 | 依赖 |
|--------|------|--------|------|
| **P0** | 代理配置（现有阻塞项） | 低 | — |
| **P1** | 签到码签到实现 | 中 | — |
| **P1** | 拍照签到自动提交修复 | 低 | — |
| **P1** | 已签到检测按类型优化 | 低 | — |
| **P2** | 手势签到加固（checkSignCode） | 中 | 签到码实现 |
| **P2** | 签退检测 | 中 | — |
| **P3** | 验证码处理 | 高 | 钉钉交互 |
| **P4** | 人脸识别 | 高 | 云盘上传 + 签名算法 |

---

## 五、需要用户配合的事项

1. **代理（P0）**：方案 A/B/C 选择其一，配置 `config.proxy`
2. **签到码/手势码**：教师公布签到码/手势码后，通过钉钉输入通道提供
3. **默认签到照片**：上传一张合规照片到服务器 `photo.path` 配置路径
4. **验证码交互**：如启用验证码处理，遇到验证码时需在手机端完成滑验证码

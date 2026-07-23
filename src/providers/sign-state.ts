/**
 * 全局签到状态
 *
 * 解决两个原有缺陷：
 * 1. IM 监听器与轮询监听器各自维护去重集合，hybrid 模式下同一次签到可能被两个监听器各签一次。
 *    这里提供跨监听器共享的「已处理 aid 集合」。
 * 2. 原 index.ts 用单个全局变量 `pendingQrAid` 记录待处理的二维码签到，同时出现多个时会互相覆盖。
 *    这里改用 Map，支持并发的二维码签到，并可在多待办中取最近一个。
 */

// ===================== 去重（跨监听器共享） =====================

const processedAids = new Set<string>()

/** 标记某次签到活动已处理，返回之前是否已被处理（true=重复） */
export function markProcessed(aid: string): boolean {
  if (processedAids.has(aid)) return true
  processedAids.add(aid)
  return false
}

export function isProcessed(aid: string): boolean {
  return processedAids.has(aid)
}

/** 防止内存无限增长：只保留最近 N 条 */
export function trimProcessed(max = 1000): void {
  if (processedAids.size <= max) return
  const arr = Array.from(processedAids)
  processedAids.clear()
  for (const aid of arr.slice(-max)) processedAids.add(aid)
}

// ===================== 二维码待处理队列 =====================

export interface PendingQr {
  courseName: string
  createdAt: number
}

const pendingQr = new Map<string, PendingQr>()

/** 登记一个待处理的二维码签到 */
export function setPendingQr(aid: string, info: Omit<PendingQr, 'createdAt'>): void {
  pendingQr.set(aid, { ...info, createdAt: Date.now() })
}

export function getPendingQr(aid: string): PendingQr | undefined {
  return pendingQr.get(aid)
}

/** 是否还有待处理的二维码签到 */
export function hasPendingQr(): boolean {
  return pendingQr.size > 0
}

/** 取出并移除最近登记的一个待处理二维码（JS Map 保留插入顺序，最后一个即最近） */
export function takeLatestPendingQr(): { aid: string; info: PendingQr } | null {
  const keys = Array.from(pendingQr.keys())
  if (keys.length === 0) return null
  const aid = keys[keys.length - 1]
  const info = pendingQr.get(aid)!
  pendingQr.delete(aid)
  return { aid, info }
}

/** 取出指定 aid 的待处理二维码（精确匹配时使用） */
export function takePendingQr(aid: string): PendingQr | null {
  const info = pendingQr.get(aid)
  if (!info) return null
  pendingQr.delete(aid)
  return info
}

// ===================== 拍照签到待处理队列 + 默认照片 =====================
//
// 与二维码同模式：检测到拍照签到后登记待处理，等待用户经上传链接/文件夹提供照片。
// 同时支持「默认照片」——用户提前上传一张照片，后续所有拍照签到直接复用，无需每次上传。

export interface PendingPhoto {
  courseName: string
  courseId: number
  classId: number
  createdAt: number
}

const pendingPhotos = new Map<string, PendingPhoto>()
let currentPhotoPath: string | null = null

/** 登记一个待处理的拍照签到 */
export function setPendingPhoto(
  aid: string,
  info: { courseName: string; courseId: number; classId: number },
): void {
  pendingPhotos.set(aid, { ...info, createdAt: Date.now() })
}

export function getPendingPhoto(aid: string): PendingPhoto | undefined {
  return pendingPhotos.get(aid)
}

/** 是否还有待处理的拍照签到 */
export function hasPendingPhoto(): boolean {
  return pendingPhotos.size > 0
}

/** 取出并移除最近登记的一个待处理拍照签到 */
export function takeLatestPendingPhoto(): { aid: string; info: PendingPhoto } | null {
  const keys = Array.from(pendingPhotos.keys())
  if (keys.length === 0) return null
  const aid = keys[keys.length - 1]
  const info = pendingPhotos.get(aid)!
  pendingPhotos.delete(aid)
  return { aid, info }
}

/** 设置/清除默认照片（用户预先上传、供所有拍照签到复用） */
export function setCurrentPhoto(path: string | null): void {
  currentPhotoPath = path
}

export function getCurrentPhoto(): string | null {
  return currentPhotoPath
}

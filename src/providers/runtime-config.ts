/**
 * 运行时全局配置（轻量单例）
 *
 * 用于把「代理」这类不适合层层透传的参数集中存放：
 * - login.ts / checkin-engine.ts 在发请求前读取
 * - index.ts 在加载配置后写入
 *
 * 设为 false 时表示不使用代理（axios 的 proxy:false 语义）。
 */
import type { AxiosProxyConfig } from 'axios'

let proxy: string | false = false

export function setProxy(p?: string | false): void {
  proxy = p && p.length > 0 ? p : false
}

/** 原始代理字符串（或 false） */
export function getProxy(): string | false {
  return proxy
}

/**
 * 转换为 axios 可直接使用的 proxy 配置。
 * axios v1 的 proxy 选项不接受裸字符串，需要 {host,port,protocol} 形式。
 * 解析失败或为空时返回 false（即不使用代理）。
 */
export function getProxyConfig(): false | AxiosProxyConfig {
  if (!proxy) return false
  try {
    const u = new URL(proxy)
    const protocol = u.protocol.replace(':', '') || 'http'
    return {
      protocol,
      host: u.hostname,
      port: u.port ? Number(u.port) : (protocol === 'https' ? 443 : 80),
      ...(u.username
        ? { auth: { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } }
        : {}),
    }
  } catch {
    logger.warn(`代理地址解析失败，已忽略: ${proxy}`)
    return false
  }
}

// 延迟引入避免循环依赖问题（logger 不依赖本模块）
import { logger } from '../utils/logger'

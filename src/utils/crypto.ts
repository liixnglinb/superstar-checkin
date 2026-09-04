import { spawnSync } from 'child_process'
import { logger } from './logger'

/**
 * 账号密码加密存储（Windows DPAPI / .NET ProtectedData）
 *
 * 密码以 `DPAPI:<base64>` 形式写入 config.yaml；解密时通过 PowerShell 调用
 * .NET ProtectedData（CurrentUser 作用域，与 Windows 登录用户绑定，无需用户记主密码）。
 * 非 Windows 或 PowerShell 不可用时降级为明文并告警（软件主要面向 Windows）。
 */

const PREFIX = 'DPAPI:'

function runPs(script: string): string | null {
  try {
    const r = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout: 10000, windowsHide: true },
    )
    if (r.status !== 0) {
      logger.warn(`DPAPI 调用失败(status=${r.status}): ${String(r.stderr || '').slice(0, 200)}`)
      return null
    }
    return String(r.stdout || '').trim()
  } catch (e: any) {
    logger.warn(`DPAPI 调用异常: ${e.message}`)
    return null
  }
}

function psEscape(s: string): string {
  // 单引号包裹并用两个单引号转义内部单引号（PowerShell 字符串规则）
  return "'" + s.replace(/'/g, "''") + "'"
}

/** 加密明文密码 → DPAPI:base64（失败返回 null） */
export function encryptPassword(plain: string): string | null {
  if (!plain) return plain
  try {
    const b64 = Buffer.from(plain, 'utf8').toString('base64')
    const script =
      `Add-Type -AssemblyName System.Security; ` +
      `$b=[Convert]::FromBase64String(${psEscape(b64)}); ` +
      `[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))`
    const out = runPs(script)
    if (!out) return null
    return PREFIX + out
  } catch (e: any) {
    logger.warn(`加密密码失败: ${e.message}`)
    return null
  }
}

/** 解密 DPAPI:base64 → 明文；未加密的旧数据原样返回（兼容迁移） */
export function decryptPassword(stored: string): string {
  if (!stored) return stored
  if (!stored.startsWith(PREFIX)) return stored
  try {
    const b64 = stored.slice(PREFIX.length)
    const script =
      `Add-Type -AssemblyName System.Security; ` +
      `$b=[Convert]::FromBase64String(${psEscape(b64)}); ` +
      `[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))`
    const out = runPs(script)
    if (out === null) {
      logger.error('解密密码失败（DPAPI 不可用），请重新在设置页保存账号密码')
      return ''
    }
    return out
  } catch (e: any) {
    logger.error(`解密密码失败: ${e.message}`)
    return ''
  }
}

export function isEncrypted(stored: string): boolean {
  return !!stored && stored.startsWith(PREFIX)
}

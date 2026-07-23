import { logger } from './logger'

export interface RetryOptions {
  maxAttempts?: number
  delayMs?: number
  backoff?: 'fixed' | 'exponential'
  label?: string
  onRetry?: (error: Error, attempt: number) => void
}

/**
 * 通用重试装饰器
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 3000,
    backoff = 'exponential',
    label = 'operation',
    onRetry,
  } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      if (attempt === maxAttempts) {
        logger.error(`${label} 在 ${maxAttempts} 次尝试后仍然失败`)
        throw e
      }

      const wait = backoff === 'exponential'
        ? delayMs * Math.pow(2, attempt - 1) + Math.random() * 1000
        : delayMs + Math.random() * 1000

      logger.warn(`${label} 第 ${attempt}/${maxAttempts} 次失败: ${e.message}, ${Math.round(wait)}ms 后重试`)
      onRetry?.(e, attempt)
      await new Promise(r => setTimeout(r, wait))
    }
  }

  throw new Error('unreachable')
}

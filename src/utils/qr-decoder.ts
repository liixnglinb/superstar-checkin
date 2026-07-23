import axios from 'axios'
import * as crypto from 'crypto'
import { logger } from './logger'
import { QR_REGEX } from '../constants'

/**
 * 从图片 Buffer 中解析二维码，返回 enc 参数
 * 支持腾讯云 OCR 和本地 jsQR 两种方式
 */
export async function decodeQrFromBuffer(
  buffer: Buffer,
  ocrConfig?: { provider: string; tencent?: { secretId: string; secretKey: string } },
): Promise<string | null> {
  // 方式1：腾讯云 OCR
  if (ocrConfig?.provider === 'tencent' && ocrConfig.tencent) {
    return decodeViaTencentOcr(buffer, ocrConfig.tencent)
  }

  // 方式2：本地 jsQR（需要安装 jsqr）
  return decodeViaJsQR(buffer)
}

/**
 * 腾讯云 QrcodeOCR API
 * https://cloud.tencent.com/document/api/866/35715
 */
async function decodeViaTencentOcr(
  buffer: Buffer,
  credentials: { secretId: string; secretKey: string },
): Promise<string | null> {
  try {
    const base64 = buffer.toString('base64')
    const timestamp = Math.floor(Date.now() / 1000)
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
    const service = 'ocr'
    const host = 'ocr.tencentcloudapi.com'
    const action = 'QrcodeOCR'
    const version = '2018-11-19'

    const payload = JSON.stringify({ ImageBase64: base64 })

    // TC3-HMAC-SHA256 签名
    const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex')
    const canonicalRequest = [
      'POST', '/', '', `content-type:application/json\nhost:${host}\n`,
      'content-type;host', hashedPayload,
    ].join('\n')

    const credentialScope = `${date}/${service}/tc3_request`
    const hashedCanonical = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonical}`

    const signKey = (key: string, msg: string) =>
      crypto.createHmac('sha256', key).update(msg).digest()

    const secretDate = signKey(`TC3${credentials.secretKey}`, date)
    const secretService = signKey(secretDate.toString('hex'), service)
    const secretSigning = signKey(secretService.toString('hex'), 'tc3_request')
    const signature = crypto
      .createHmac('sha256', secretSigning)
      .update(stringToSign)
      .digest('hex')

    const authorization = `TC3-HMAC-SHA256 Credential=${credentials.secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`

    const resp = await axios.post(`https://${host}`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Host: host,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': 'ap-shanghai',
        Authorization: authorization,
      },
    })

    const results = resp.data?.Response?.CodeResults || []
    for (const item of results) {
      const url = item.Url || item.Symbol || ''
      const match = url.match(QR_REGEX) || url.match(/enc=([\dA-Fa-f]+)/)
      if (match) {
        const enc = match[5] || match[1]
        logger.info(`腾讯云 OCR 解析成功: enc=${enc}`)
        return enc
      }
      // 也检查原始文本内容
      const text = JSON.stringify(item)
      const textMatch = text.match(/enc=([\dA-Fa-f]+)/)
      if (textMatch) {
        logger.info(`腾讯云 OCR 解析成功(文本): enc=${textMatch[1]}`)
        return textMatch[1]
      }
    }

    logger.warn('腾讯云 OCR 未识别到签到二维码内容')
    return null
  } catch (e: any) {
    logger.error(`腾讯云 OCR 解析失败: ${e.message}`)
    return null
  }
}

/**
 * 本地 jsQR 解码（需 npm install jsqr sharp）
 */
async function decodeViaJsQR(buffer: Buffer): Promise<string | null> {
  try {
    const sharp = require('sharp')
    const jsQR = require('jsqr')

    const { data, info } = await sharp(buffer)
      .raw()
      .toBuffer({ resolveWithObject: true })

    const code = jsQR(
      new Uint8ClampedArray(data.buffer),
      info.width,
      info.height,
    )

    if (code?.data) {
      logger.info(`jsQR 解析结果: ${code.data.slice(0, 100)}`)
      const match = code.data.match(QR_REGEX) || code.data.match(/enc=([\dA-Fa-f]+)/)
      if (match) {
        const enc = match[5] || match[1]
        return enc
      }
    }

    logger.warn('jsQR 未识别到二维码内容')
    return null
  } catch (e: any) {
    if (e.code === 'MODULE_NOT_FOUND') {
      logger.warn('本地 QR 解码需要安装依赖: npm install jsqr sharp')
    } else {
      logger.error(`jsQR 解码失败: ${e.message}`)
    }
    return null
  }
}

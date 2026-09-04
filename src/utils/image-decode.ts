import { PNG } from 'pngjs'
import * as jpeg from 'jpeg-js'

/**
 * 纯 JS 图片解码（PNG / JPEG / BMP → RGBA），替代原生模块 sharp。
 *
 * 选型原因：sharp 是原生模块（含 libvips 二进制），无法随 pkg/SEA 稳定打包进单文件 exe；
 * pngjs / jpeg-js 是纯 JS 实现，可被任意打包器内联。
 * BMP 为手动解析（24/32 位，bottom-up 常见），覆盖大多数签到图片场景。
 */

export interface DecodedImage {
  data: Buffer          // RGBA，每像素 4 字节
  width: number
  height: number
}

/** 根据文件头识别格式并解码为 RGBA */
export function decodeImage(buffer: Buffer): DecodedImage {
  if (!buffer || buffer.length < 8) {
    throw new Error('图片数据为空或过短')
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  ) {
    return decodePng(buffer)
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return decodeJpeg(buffer)
  }

  // BMP: 42 4D ("BM")
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return decodeBmp(buffer)
  }

  throw new Error('不支持的图片格式（仅支持 PNG/JPEG/BMP）')
}

function decodePng(buffer: Buffer): DecodedImage {
  const png = PNG.sync.read(buffer)
  // pngjs 输出 RGBA（colorType=6 时原生 RGBA；其它色型 pngjs 也会转成 RGBA）
  return {
    data: png.data,
    width: png.width,
    height: png.height,
  }
}

function decodeJpeg(buffer: Buffer): DecodedImage {
  const { width, height, data } = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true })
  // jpeg-js formatAsRGBA 返回 RGBA；data 可能是 Uint8Array，转成 Buffer 保证一致性
  return {
    data: Buffer.from(data),
    width,
    height,
  }
}

/** 手动解析 BMP（支持 24/32 位，bottom-up / top-down） */
function decodeBmp(buffer: Buffer): DecodedImage {
  if (buffer.length < 54) throw new Error('BMP 文件头不完整')

  const dataOffset = buffer.readUInt32LE(10)
  const width = buffer.readInt32LE(18)
  const rawHeight = buffer.readInt32LE(22)
  const height = Math.abs(rawHeight)
  const bottomUp = rawHeight > 0
  const bpp = buffer.readUInt16LE(28)
  const compression = buffer.readUInt32LE(30)

  if (width <= 0 || height <= 0) throw new Error('BMP 尺寸非法')
  if (bpp !== 24 && bpp !== 32) throw new Error(`不支持的 BMP 位深: ${bpp}（仅支持 24/32 位）`)
  if (compression !== 0) throw new Error(`不支持的 BMP 压缩方式: ${compression}（仅支持未压缩）`)

  const rowSize = Math.ceil((width * (bpp / 8)) / 4) * 4 // 每行 4 字节对齐
  const out = Buffer.alloc(width * height * 4)

  for (let y = 0; y < height; y++) {
    const srcRow = bottomUp ? height - 1 - y : y
    const srcOffset = dataOffset + srcRow * rowSize
    for (let x = 0; x < width; x++) {
      const si = srcOffset + x * (bpp / 8)
      const di = (y * width + x) * 4
      // BMP 颜色顺序为 BGR(A)
      out[di] = buffer[si + 2]     // R
      out[di + 1] = buffer[si + 1] // G
      out[di + 2] = buffer[si]     // B
      out[di + 3] = bpp === 32 ? buffer[si + 3] : 0xff // A
    }
  }

  return { data: out, width, height }
}

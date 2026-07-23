import * as http from 'http'
import * as crypto from 'crypto'
import axios from 'axios'
import { logger } from '../utils/logger'
import { getProxyConfig } from '../providers/runtime-config'

export interface DingTalkMessage {
  msgtype: string
  text?: { content: string }
  richText?: { richText: Array<{ pictureDownloadCode?: string; text?: string }> }
  pictureDownloadCode?: string
  senderStaffId?: string
  conversationId?: string
  chatbotCorpId?: string
  msgId?: string
}

type ImageHandler = (imageBuffer: Buffer) => Promise<void>

export interface DingTalkServerOptions {
  /** 企业内部应用的 AppKey（用于获取 access_token 与图片下载） */
  appKey?: string
  /** 上传接口鉴权 token；不填则上传接口不鉴权（不推荐） */
  token?: string
  /** 允许跨域的来源（可选） */
  allowedOrigin?: string
}

/**
 * 钉钉机器人消息回调服务器
 * 接收群内消息（文字、图片），用于二维码签到流程
 *
 * 优化点：
 * - 真正实现了「钉钉群内发图 → 通过钉钉 API 下载图片 → OCR → 签到」链路；
 * - 为 /upload/image 增加了可选 token 鉴权，防止外人任意上传；
 * - 上传页面自动携带 token。
 */
export class DingTalkServer {
  private server: http.Server | null = null
  private imageHandler: ImageHandler | null = null
  private appSecret: string
  private appKey?: string
  private token?: string
  private allowedOrigin?: string

  constructor(
    private port: number,
    appSecret: string,
    options: DingTalkServerOptions = {},
  ) {
    this.appSecret = appSecret
    this.appKey = options.appKey
    this.token = options.token
    this.allowedOrigin = options.allowedOrigin
  }

  /**
   * 注册图片消息处理器（收到图片 → OCR → 签到）
   */
  onImage(handler: ImageHandler) {
    this.imageHandler = handler
  }

  /**
   * 启动 HTTP 服务器
   */
  start() {
    this.server = http.createServer(async (req, res) => {
      this.applyCors(res)

      // 健康检查
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }))
        return
      }

      // 钉钉回调
      if (req.method === 'POST' && req.url?.startsWith('/dingtalk/callback')) {
        try {
          const body = await this.readBody(req)
          const data = JSON.parse(body) as DingTalkMessage

          logger.debug(`钉钉消息: ${data.msgtype}`)

          // 处理图片消息（rich text 中的图片 或 直接发图）
          if (data.msgtype === 'richText' && data.richText?.richText) {
            for (const item of data.richText.richText) {
              if (item.pictureDownloadCode) {
                await this.handleImageCode(item.pictureDownloadCode)
              }
            }
          }

          // 处理文字指令
          if (data.msgtype === 'text' && data.text?.content) {
            logger.info(`钉钉文字消息: ${data.text.content}`)
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
        } catch (e: any) {
          logger.error(`钉钉回调处理失败: ${e.message}`)
          res.writeHead(500)
          res.end('error')
        }
        return
      }

      // 上传页面（手机端，支持 ?type=qr|photo 区分二维码/拍照）
      if (req.method === 'GET' && req.url?.startsWith('/upload')) {
        const url = new URL(req.url, `http://localhost:${this.port}`)
        const type: 'qr' | 'photo' = url.searchParams.get('type') === 'photo' ? 'photo' : 'qr'
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(this.getUploadPage(type))
        return
      }

      // 二维码图片上传接口
      if (req.method === 'POST' && req.url?.startsWith('/upload/image')) {
        // 可选 token 鉴权
        if (this.token) {
          const url = new URL(req.url, `http://localhost:${this.port}`)
          if (url.searchParams.get('token') !== this.token) {
            res.writeHead(403, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'token 校验失败' }))
            return
          }
        }

        try {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          await new Promise(r => req.on('end', r))
          const buffer = Buffer.concat(chunks)

          if (this.imageHandler && buffer.length > 0) {
            await this.imageHandler(buffer)
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, message: '图片已接收，正在处理...' }))
        } catch (e: any) {
          logger.error(`上传图片处理失败: ${e.message}`)
          res.writeHead(500)
          res.end(JSON.stringify({ error: e.message }))
        }
        return
      }

      res.writeHead(404)
      res.end('not found')
    })

    this.server.listen(this.port, () => {
      logger.success(`钉钉回调服务器已启动: http://0.0.0.0:${this.port}`)
      logger.info(`消息回调: POST /dingtalk/callback`)
      logger.info(`手机上传: GET  /upload${this.token ? ' （已开启 token 鉴权）' : ''}`)
      logger.info(`健康检查: GET  /health`)
    })
  }

  /**
   * 通过钉钉 API 下载图片（企业内部机器人）
   *
   * 链路：gettoken(appKey+appSecret) → messageFiles/download(downloadCode, robotCode)
   *       → downloadUrl → 下载为 Buffer → imageHandler
   *
   * 说明：robotCode 在多数企业内部机器人场景下等于 appKey；若下载失败，
   * 钉钉会返回具体错误，此时请改用 /upload 页面直接上传图片。
   */
  private async handleImageCode(downloadCode: string) {
    if (!this.appKey || !this.appSecret) {
      logger.warn('未配置 appKey/appSecret，无法从钉钉下载图片，请改用 /upload 页面上传')
      return
    }

    try {
      logger.info(`收到钉钉图片: ${downloadCode}`)

      const tokenResp = await axios.get('https://oapi.dingtalk.com/gettoken', {
        params: { appkey: this.appKey, appsecret: this.appSecret },
        proxy: getProxyConfig(),
      })
      const accessToken: string = tokenResp.data?.access_token
      if (!accessToken) throw new Error('获取钉钉 access_token 失败: ' + JSON.stringify(tokenResp.data))

      const dl = await axios.post(
        'https://oapi.dingtalk.com/robot/messageFiles/download',
        { downloadCode, robotCode: this.appKey },
        {
          headers: { 'x-acs-dingtalk-access-token': accessToken },
          proxy: getProxyConfig(),
        },
      )
      const downloadUrl: string | undefined = dl.data?.downloadUrl
      if (!downloadUrl) throw new Error('钉钉未返回图片下载地址: ' + JSON.stringify(dl.data))

      const imgResp = await axios.get(downloadUrl, { responseType: 'arraybuffer', proxy: getProxyConfig() })
      const buffer = Buffer.from(imgResp.data)

      if (this.imageHandler) await this.imageHandler(buffer)
    } catch (e: any) {
      logger.error(`下载钉钉图片失败: ${e.message}`)
      logger.warn('图片下载失败，请改用手机 /upload 页面直接上传二维码')
    }
  }

  private applyCors(res: http.ServerResponse) {
    if (this.allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', this.allowedOrigin)
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    }
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: string[] = []
      req.on('data', (chunk: string) => chunks.push(chunk))
      req.on('end', () => resolve(chunks.join('')))
      req.on('error', reject)
    })
  }

  /**
   * 手机端上传页面（自动携带 token）
   * @param type 'qr' 二维码签到上传 / 'photo' 拍照签到上传
   */
  private getUploadPage(type: 'qr' | 'photo' = 'qr'): string {
    const token = this.token || ''
    const isPhoto = type === 'photo'
    const title = isPhoto ? '学习通签到 - 拍照上传' : '学习通签到 - 二维码上传'
    const tip = isPhoto
      ? '拍一张照片（或选择相册图片）上传，用于拍照签到'
      : '拍一张教室里的签到二维码，点击上传'
    const placeholder = isPhoto ? '📷 点击拍照或选择照片' : '📷 点击拍照或选择图片'
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f0f2f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:16px;padding:32px;width:100%;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
h1{font-size:20px;text-align:center;margin-bottom:8px;color:#1a1a1a}
p{font-size:14px;color:#666;text-align:center;margin-bottom:24px}
.upload-area{border:2px dashed #d9d9d9;border-radius:12px;padding:40px 20px;text-align:center;cursor:pointer;transition:all .2s}
.upload-area:hover,.upload-area.drag{border-color:#1677ff;background:#f0f5ff}
.upload-area img{max-width:100%;max-height:200px;border-radius:8px;margin-top:12px}
.btn{display:block;width:100%;padding:14px;background:#1677ff;color:#fff;border:none;border-radius:10px;font-size:16px;cursor:pointer;margin-top:20px}
.btn:disabled{background:#ccc;cursor:not-allowed}
.status{text-align:center;margin-top:16px;font-size:14px;padding:8px;border-radius:8px}
.status.ok{background:#f6ffed;color:#52c41a}
.status.err{background:#fff2f0;color:#ff4d4f}
.status.loading{background:#e6f4ff;color:#1677ff}
input[type=file]{display:none}
</style>
</head>
<body>
<div class="card">
  <h1>${title}</h1>
  <p>${tip}</p>
  <div class="upload-area" id="dropZone" onclick="document.getElementById('fileInput').click()">
    <div id="placeholder">${placeholder}</div>
    <img id="preview" style="display:none">
  </div>
  <input type="file" id="fileInput" accept="image/*" capture="environment">
  <button class="btn" id="submitBtn" disabled onclick="upload()">上传并签到</button>
  <div id="status"></div>
</div>
<script>
const UPLOAD_TOKEN = ${JSON.stringify(token)}
const fileInput=document.getElementById('fileInput')
const preview=document.getElementById('preview')
const placeholder=document.getElementById('placeholder')
const submitBtn=document.getElementById('submitBtn')
const dropZone=document.getElementById('dropZone')
const status=document.getElementById('status')
let selectedFile=null

fileInput.addEventListener('change',e=>{
  const file=e.target.files[0]
  if(!file)return
  selectedFile=file
  const reader=new FileReader()
  reader.onload=ev=>{preview.src=ev.target.result;preview.style.display='block';placeholder.style.display='none'}
  reader.readAsDataURL(file)
  submitBtn.disabled=false
  status.textContent=''
})

dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag')})
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag'))
dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('drag');const file=e.dataTransfer.files[0];if(file){const dt=new DataTransfer();dt.items.add(file);fileInput.files=dt.files;fileInput.dispatchEvent(new Event('change'))}})

async function upload(){
  if(!selectedFile)return
  submitBtn.disabled=true
  status.className='status loading'
  status.textContent='正在上传识别中...'
  try{
    const qs = UPLOAD_TOKEN ? ('?token=' + encodeURIComponent(UPLOAD_TOKEN)) : ''
    const resp=await fetch('/upload/image' + qs,{method:'POST',body:selectedFile,headers:{'Content-Type':selectedFile.type}})
    const data=await resp.json()
    if(data.success){status.className='status ok';status.textContent='✅ '+data.message}
    else{status.className='status err';status.textContent='❌ '+(data.error||'未知错误')}
  }catch(e){status.className='status err';status.textContent='❌ 网络错误: '+e.message}
  submitBtn.disabled=false
}
</script>
</body>
</html>`
  }

  stop() {
    this.server?.close()
  }
}

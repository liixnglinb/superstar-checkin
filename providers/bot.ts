import { WebSocketServer, WebSocket } from 'ws'
import config from './config'
import attachGroupMessageHandler from '../handlers/attachGroupMessageHandler'
import { info, error, success, warn } from '../utils/log'

let wsConnection: WebSocket | null = null
let apiEchoSeq = 0

// 辅助：通过 OneBot 协议发送 API 调用
const sendApi = (action: string, params: object): void => {
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
    warn('Lagrange 未连接，无法发送消息')
    return
  }
  const echo = String(++apiEchoSeq)
  wsConnection.send(JSON.stringify({ action, params, echo }))
}

// 辅助：发送群消息
export const sendGroupMsg = (groupId: number, message: string) => {
  sendApi('send_group_msg', { group_id: groupId, message })
}

export const loginBot = () => new Promise<void>(resolve => {
  if (config.bot.uin === 'disabled') return resolve()

  const wss = new WebSocketServer({ port: 8081 })

  let resolved = false

  const timeout = setTimeout(() => {
    if (!resolved) {
      resolved = true
      warn('Lagrange.OneBot 30秒内未连接，继续启动（机器人功能不可用）')
      resolve()
    }
  }, 30000)

  wss.on('connection', (ws, req) => {
    // access_token 校验
    const expectedToken = config.bot.accessToken
    if (expectedToken) {
      const authHeader = req.headers.authorization
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      const queryToken = url.searchParams.get('access_token')
      const token = authHeader?.replace('Bearer ', '') || queryToken
      if (token !== expectedToken) {
        error('Lagrange access_token 校验失败，拒绝连接')
        ws.close(4001)
        return
      }
    }

    success('Lagrange.OneBot 已连接，QQ 机器人就绪')
    wsConnection = ws

    if (!resolved) {
      resolved = true
      clearTimeout(timeout)
      resolve()
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        // 将 OneBot 事件交给消息处理器
        attachGroupMessageHandler(ws, msg)
      } catch (e) {
        // 忽略非 JSON 消息
      }
    })

    ws.on('close', () => {
      warn('Lagrange.OneBot 连接断开，等待重连...')
      wsConnection = null
    })

    ws.on('error', (e) => {
      error('Lagrange WebSocket 错误', e)
    })
  })

  wss.on('error', (e) => {
    error('WebSocket 服务器启动失败', e)
  })

  info('等待 Lagrange.OneBot 连接... (ws://127.0.0.1:8081/onebot/v11/ws)')
})

export const pushQMsg = async (message: string) => {
  if (config.bot.uin === 'disabled') return
  try {
    for (const group of config.bot.notifyGroups) {
      sendGroupMsg(group, message)
    }
  } catch (e) {
    error('QQ 消息发送失败', e)
  }
}

export const pushQMsgToFirstGroup = async (message: string) => {
  if (config.bot.uin === 'disabled') return
  try {
    sendGroupMsg(config.bot.notifyGroups[0], message)
  } catch (e) {
    error('QQ 消息发送失败', e)
  }
}

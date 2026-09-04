// 生成 build/embedded-config.json：把当前 config.yaml 以 base64 内嵌进构建产物
// （Electron 打包版首次运行无 config.yaml 时自动写入，保证开箱即用）
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, 'config.yaml')
const out = path.join(__dirname, 'build', 'embedded-config.json')

if (!fs.existsSync(src)) {
  console.log('config.yaml 不存在，跳过内嵌配置生成')
  process.exit(0)
}

const b64 = fs.readFileSync(src, 'utf-8')
fs.writeFileSync(out, JSON.stringify({ b64: Buffer.from(b64, 'utf-8').toString('base64') }))
console.log('embedded-config.json generated:', out)

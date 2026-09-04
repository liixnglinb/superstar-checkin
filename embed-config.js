// 生成 build/embedded-config.json 的占位脚本
// 说明：v3.1 起不再内嵌任何账号（支持多用户各自登录自己的账号）。
// 首次运行无 config.yaml 时由 config.ts 生成空模板，软件内引导填写账号。
const fs = require('fs')
const path = require('path')

const out = path.join(__dirname, 'build', 'embedded-config.json')

// 生成不含账号的默认模板（保留内嵌机制的结构，但 accounts 恒为空）
const emptyTemplate = {
  b64: Buffer.from('accounts: []\n', 'utf-8').toString('base64'),
}
fs.writeFileSync(out, JSON.stringify(emptyTemplate))
console.log('embedded-config.json generated (no accounts - multi-user ready)')

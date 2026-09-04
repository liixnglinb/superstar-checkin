// SEA 构建脚本：esbuild bundle → SEA blob → node.exe + postject 注入
// 用法: node build-sea.js
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const ROOT = __dirname
const DIST = path.join(ROOT, 'dist')
const SEA_DIR = path.join(ROOT, 'dist-sea')
const BUNDLE = path.join(SEA_DIR, 'bundle.js')
const BLOB = path.join(SEA_DIR, 'sea-prep.blob')
const OUT_EXE = path.join(DIST, '学习通自动签到.exe')

function step(msg) {
  console.log(`\n== ${msg} ==`)
}

function run(cmd) {
  console.log('>', cmd)
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, shell: 'cmd.exe' })
}

// 0. 准备目录
fs.mkdirSync(SEA_DIR, { recursive: true })
fs.mkdirSync(DIST, { recursive: true })

// 1. esbuild bundle（全部纯 JS 依赖内联；sharp/nodemailer 等可选原生依赖已用变量 require 排除）
//    说明：v3.1 起不内嵌任何账号（支持多用户各自登录自己的账号），首次运行在软件内引导填写
step('1/5 esbuild bundle')
const esbuild = require('esbuild')
esbuild.buildSync({
  entryPoints: [path.join(ROOT, 'build', 'index.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: BUNDLE,
  logLevel: 'warning',
})

// 2. SEA 配置
step('2/5 生成 SEA blob')
const seaConfig = {
  main: BUNDLE,
  output: BLOB,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
}
const seaConfigPath = path.join(SEA_DIR, 'sea-config.json')
fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2))
run(`node --experimental-sea-config "${seaConfigPath}"`)

// 3. 复制 node.exe 作为可执行文件
step('3/5 复制 node.exe')
const nodeExe = process.execPath
fs.copyFileSync(nodeExe, OUT_EXE)

// 4. postject 注入 blob
step('4/5 postject 注入')
run(`npx postject "${OUT_EXE}" NODE_SEA_BLOB "${BLOB}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`)

// 5. 签名（可选，避免 Windows SmartScreen 提示；无签名工具则跳过）
step('5/5 完成')
console.log(`\n✅ 打包完成: ${OUT_EXE}`)
console.log(`  大小: ${(fs.statSync(OUT_EXE).size / 1024 / 1024).toFixed(1)} MB`)

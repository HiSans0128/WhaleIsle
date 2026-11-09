'use strict';

/**
 * SparkAtoll 开发启动器（轻量安全入口）
 * 
 * 作用：
 * 1. 绕过官方 prestart-ensure.mjs 的 10 核全量静态聚合分析与编译；
 * 2. 借用成熟已验证的底层二进制与 runtime 缓存，0 CPU 暴走；
 * 3. 真正拉起 SparkAtoll 自身的 src/main/index.js 源码。
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
// 优先使用本地 Electron 通用壳：它支持“目录参数 = 加载源码”模式。
// 官方 Whale Isle.app 是 electron-builder 打包产物，只会加载自己的 app.asar，
// 传目录参数不会生效（2026-10-27 主进程堆栈实锤），仅作缺失时回退。
const localElectron = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
const fallbackBinary = '/Applications/Whale Isle.app/Contents/MacOS/Whale Isle';
const appBinary = fs.existsSync(localElectron) ? localElectron : fallbackBinary;

if (!fs.existsSync(appBinary)) {
  console.error('[SparkAtoll Dev] 错误：未找到可用的 Electron 运行壳');
  process.exit(1);
}
console.log('[SparkAtoll Dev] 使用运行壳:', appBinary);

console.log('[SparkAtoll Dev] 正在安全启动 SparkAtoll 源码工程...');
console.log('[SparkAtoll Dev] 源码入口:', path.join(root, 'src', 'main', 'index.js'));

// 设置环境变量，指定运行当前源码目录
const env = {
  ...process.env,
  ELECTRON_ENABLE_LOGGING: '1',
  NODE_ENV: 'development',
};

// 启动子进程，加载当前源码工程；主进程日志同步落盘，
// 避免 exec 会话管道断裂后丢失主进程 console 输出（诊断黑洞）。
const logPath = '/tmp/sparkatoll-main.log';
const logStream = fs.createWriteStream(logPath, { flags: 'a' });
logStream.write(`\n[dev-safe] ==== launch at ${new Date().toISOString()} ====\n`);
const child = spawn(appBinary, [root], {
  cwd: root,
  env,
  stdio: ['inherit', 'pipe', 'pipe'],
});
child.stdout.pipe(logStream);
child.stderr.pipe(logStream);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on('error', (err) => {
  console.error('[SparkAtoll Dev] 启动出错:', err);
});

child.on('exit', (code, signal) => {
  console.log(`[SparkAtoll Dev] 进程退出 (code=${code}, signal=${signal})`);
  process.exit(code ?? 0);
});

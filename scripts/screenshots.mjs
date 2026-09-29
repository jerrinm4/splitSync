import { spawnSync } from 'node:child_process'
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--project=chromium', '--grep', 'capture documentation screenshots'], {
  stdio: 'inherit', env: { ...process.env, CAPTURE_SCREENSHOTS: '1' },
})
process.exit(result.status ?? 1)

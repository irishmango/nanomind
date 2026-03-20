#!/usr/bin/env node
'use strict'
const { spawnSync } = require('child_process')
const { resolve } = require('path')
const { accessSync } = require('fs')

// Try multiple possible locations for tsx binary
const possibleTsx = [
  resolve(__dirname, '../node_modules/.bin/tsx'),
  resolve(__dirname, '../../.bin/tsx'),
  resolve(__dirname, '../../../.bin/tsx'),
  resolve(__dirname, '../../../../.bin/tsx'),
]

let tsx = 'tsx' // fallback to PATH
for (const p of possibleTsx) {
  try { accessSync(p); tsx = p; break } catch {}
}

const cli = resolve(__dirname, './cli.ts')
const result = spawnSync(tsx, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(result.status ?? 1)

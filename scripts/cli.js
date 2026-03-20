#!/usr/bin/env node
'use strict'
const { spawnSync } = require('child_process')
const { resolve } = require('path')

const tsx = resolve(__dirname, '../node_modules/.bin/tsx')
const cli = resolve(__dirname, './cli.ts')

const result = spawnSync(tsx, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(result.status ?? 1)

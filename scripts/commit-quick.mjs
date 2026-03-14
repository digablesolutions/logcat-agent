#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const msg = process.argv.slice(2).join(' ').trim() || 'chore: quick commit';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('git', ['add', '-A']);
run('git', ['commit', '-m', msg]);
run('git', ['push', 'origin', 'main']);

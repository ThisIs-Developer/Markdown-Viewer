import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { verifyRuntimeSource } = require('../../desktop-app/experimental/verify-runtime.js');

test('runtime verification rejects extra edits outside reviewed hunks and preserves the caller index', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-verification-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init');
    fs.writeFileSync(path.join(directory, '.gitignore'), 'review.patch\n');
    fs.writeFileSync(path.join(directory, 'runtime.cpp'), 'original\n' + 'unchanged\n'.repeat(20));
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture');
    const commit = git('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(directory, 'runtime.cpp'), 'reviewed\n' + 'unchanged\n'.repeat(20));
    const patch = path.join(directory, 'review.patch');
    fs.writeFileSync(patch, git('diff') + '\n');
    const indexBefore = fs.readFileSync(path.join(directory, '.git/index'));
    assert.match(verifyRuntimeSource(directory, commit, patch), /^[a-f0-9]{40}$/);
    fs.appendFileSync(path.join(directory, 'runtime.cpp'), 'unexpected extra code\n');
    assert.throws(() => verifyRuntimeSource(directory, commit, patch), /differs from/);
    assert.deepEqual(fs.readFileSync(path.join(directory, '.git/index')), indexBefore);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('runtime-verification-test-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

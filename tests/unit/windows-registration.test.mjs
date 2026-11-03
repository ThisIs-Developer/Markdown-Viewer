import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { buildWindowsIntegration } = require('../../desktop-app/experimental/windows/build-integration.js');

test('Windows registration preserves defaults, quotes paths and removes only its own registrations', {skip:process.platform !== 'win32'}, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'markdown-viewer-registration-test-'));
  const executable = path.join(directory,'integration.exe');
  try {
    buildWindowsIntegration(executable);
    const result = spawnSync(executable,['--self-test'],{encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(result.status,0,result.error || result.stdout + result.stderr);
  } finally {
    fs.rmSync(executable,{force:true});
    fs.rmdirSync(directory);
  }
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Build an expected Git tree in an isolated index. Neither the caller's index
// nor its working files are modified, including when verification fails.
function verifyRuntimeSource(source, commit, patch) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-runtime-index-'));
  const index = path.join(directory, 'index');
  const git = args => execFileSync('git', args, { cwd: source, encoding: 'utf8',
    env: { ...process.env, GIT_INDEX_FILE: index }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    if (git(['rev-parse', 'HEAD']) !== commit) throw new Error('Unexpected runtime source revision.');
    git(['read-tree', commit]);
    git(['apply', '--cached', path.resolve(patch)]);
    try { git(['diff', '--exit-code', '--no-ext-diff']); }
    catch { throw new Error('Runtime source differs from the pinned commit and reviewed patch.'); }
    if (git(['ls-files', '--others', '--exclude-standard'])) throw new Error('Unexpected untracked runtime source files.');
    return git(['write-tree']);
  } finally {
    fs.rmSync(index, { force: true });
    fs.rmSync(index + '.lock', { force: true });
    fs.rmdirSync(directory);
  }
}
module.exports = { verifyRuntimeSource };

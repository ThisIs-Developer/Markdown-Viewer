import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import yaml from 'js-yaml';

const root = new URL('../../', import.meta.url);
const read = relative => fs.readFileSync(new URL(relative, root));
const manifest = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const html = read('index.html').toString();

for (const [name, version, url, asset] of [
  ['dompurify', '3.4.17', 'assets/vendor/purify.min.js', 'dist/purify.min.js'],
  ['js-yaml', '4.3.2', 'assets/vendor/js-yaml.min.js', 'dist/js-yaml.min.js']
]) {
  test(`${name}: package, lockfile, browser URL and SRI agree`, () => {
    assert.equal(manifest.devDependencies[name], version);
    assert.equal(lock.packages[''].devDependencies[name], version);
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
    assert.equal(JSON.parse(read(`node_modules/${name}/package.json`)).version, version);
    const tag = html.match(/<script\b[^>]*>/g).find(tag => tag.includes(`src="${url}"`));
    assert.ok(tag, 'Missing local pinned script');
    const expected = 'sha384-' + crypto.createHash('sha384')
      .update(read(`node_modules/${name}/${asset}`)).digest('base64');
    assert.ok(tag.includes(`integrity="${expected}"`), 'SRI differs from installed browser asset');
    assert.deepEqual(read(url), read(`node_modules/${name}/${asset}`), 'Local vendor bytes must match the locked package');
  });
}

test('YAML counts empty merge sources against the configured work limit', () => {
  // Bounded regression: no expensive denial-of-service payload is necessary.
  const document = 'sources: &sources [{}, {}, {}]\nvalue:\n  <<: *sources\n';
  assert.throws(() => yaml.load(document, { maxTotalMergeKeys: 2 }), /maxTotalMergeKeys/);
  assert.deepEqual(yaml.load(document, { maxTotalMergeKeys: 3 }).value, {});
});

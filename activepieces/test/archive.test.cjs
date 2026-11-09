const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { buildArchive } = require('../scripts/build-archive.cjs');

test('packed archive loads without node_modules and passes operation and TLS regressions', async () => {
  const { archive, report } = await buildArchive();
  const expected = ['LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.txt', 'logo.png', 'package.json', 'src/index.js'];
  assert.deepEqual(report.files, expected);
  assert.deepEqual(report.runtime_dependencies, []);
  assert.equal(report.sha256, createHash('sha256').update(fs.readFileSync(archive)).digest('hex'));
  const members = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n').sort();
  assert.deepEqual(members, expected.map(name => `package/${name}`).sort());
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sentfromai-piece-archive-'));
  try {
    execFileSync('tar', ['-xzf', archive, '-C', directory]);
    const packaged = path.join(directory, 'package');
    const manifest = JSON.parse(fs.readFileSync(path.join(packaged, 'package.json'), 'utf8'));
    assert.equal(manifest.main, './src/index.js');
    assert.deepEqual(manifest.dependencies, {});
    assert.equal(manifest.private, true);
    for (const field of ['scripts', 'devDependencies', 'peerDependencies', 'types']) assert.equal(field in manifest, false);
    const entry = path.join(packaged, 'src', 'index.js');
    assert.equal(fs.existsSync(path.join(packaged, 'node_modules')), false);
    const source = fs.readFileSync(entry, 'utf8');
    assert.equal(source.includes(path.resolve(__dirname, '..')), false);
    assert.equal(source.includes('synthetic-tls-test-key'), false);
    assert.equal(source.includes('unit-test-key'), false);
    const isolated = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      const Module = require('node:module');
      const entry = process.argv[1];
      const original = Module._load;
      Module._load = function (request, ...args) {
        assert(request === entry || Module.isBuiltin(request), 'Unexpected runtime dependency: ' + request);
        return original.call(this, request, ...args);
      };
      const exports = require(entry);
      const pieces = Object.values(exports).filter(value => value?.constructor?.name === 'Piece');
      assert.equal(pieces.length, 1);
      assert.equal(pieces[0].displayName, 'SentFromAI');
      assert.equal(Object.keys(pieces[0].actions()).length, 6);
      assert.equal(Object.keys(pieces[0].triggers()).length, 1);
      assert.equal(pieces[0].auth.type, 'SECRET_TEXT');
    `, entry], { encoding: 'utf8', cwd: directory, env: { ...process.env, NODE_PATH: '' } });
    assert.equal(isolated.status, 0, isolated.stderr);
    const regressionEnv = { ...process.env, SENTFROMAI_TEST_PIECE_PATH: entry };
    delete regressionEnv.NODE_TEST_CONTEXT;
    const regressions = spawnSync(process.execPath, ['--test', '--test-reporter=tap',
      path.join(__dirname, 'piece.test.cjs'), path.join(__dirname, 'transport.test.cjs')], {
      encoding: 'utf8', timeout: 60000,
      env: regressionEnv,
    });
    assert.equal(regressions.status, 0, regressions.stdout + regressions.stderr);
    assert.match(regressions.stdout, /# pass 20\b/);
    console.log('Extracted archive: isolated loading and all 20 operation/TLS checks passed.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

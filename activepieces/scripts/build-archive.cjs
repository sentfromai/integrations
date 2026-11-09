const fs = require('node:fs');
const path = require('node:path');
const { builtinModules } = require('node:module');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build', 'archive');
const stage = path.join(output, 'package');
const activepiecesPackages = new Set([
  '@activepieces/pieces-framework', '@activepieces/pieces-common', '@activepieces/shared',
]);
const builtins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));
const sha256 = value => createHash('sha256').update(value).digest('hex');

function packageFor(file) {
  let directory = path.dirname(path.resolve(root, file));
  while (directory !== path.dirname(directory)) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (pkg.name && pkg.version) return { directory, ...pkg };
    }
    directory = path.dirname(directory);
  }
  throw new Error(`Cannot identify bundled package for ${file}`);
}

function thirdPartyNotices(inputs) {
  const packages = new Map();
  for (const input of inputs.filter(file => file.includes('node_modules/'))) {
    const pkg = packageFor(input);
    packages.set(`${pkg.name}@${pkg.version}`, pkg);
  }
  const notices = [];
  for (const [identity, pkg] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
    const files = fs.readdirSync(pkg.directory).filter(name => /^(licen[cs]e|notice)(\.|$)/i.test(name));
    const texts = files.filter(name => fs.statSync(path.join(pkg.directory, name)).isFile())
      .map(name => fs.readFileSync(path.join(pkg.directory, name), 'utf8'));
    if (!texts.length && activepiecesPackages.has(pkg.name)) {
      texts.push(fs.readFileSync(path.join(root, 'licenses', 'ACTIVEPIECES_LICENSE'), 'utf8'));
    }
    if (!texts.length) throw new Error(`Missing license notice for ${identity}`);
    notices.push(`${identity}\n${texts.join('\n\n')}`);
  }
  return { text: notices.join('\n\n' + '='.repeat(72) + '\n\n') + '\n', packages: [...packages.keys()].sort() };
}

async function buildArchive() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const sourceCommit = git(['rev-parse', 'HEAD']);
  const dirty = Boolean(git(['status', '--porcelain']));
  if (process.env.SENTFROMAI_RELEASE === '1' && dirty) throw new Error('Release source must be committed and clean.');
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, 'src'), { recursive: true });
  const result = await esbuild.build({
    absWorkingDir: root, entryPoints: ['src/index.ts'], outfile: path.join(stage, 'src', 'index.js'),
    bundle: true, platform: 'node', target: 'node22', format: 'cjs', keepNames: true,
    minify: true, metafile: true, legalComments: 'eof', logLevel: 'silent',
  });
  if (result.warnings.length) throw new Error(`Bundle warnings: ${result.warnings.map(w => w.text).join('; ')}`);
  const external = Object.values(result.metafile.outputs).flatMap(item => item.imports)
    .filter(item => item.external && !builtins.has(item.path));
  if (external.length) throw new Error(`Unbundled runtime dependencies: ${external.map(item => item.path).join(', ')}`);
  const bundle = fs.readFileSync(path.join(stage, 'src', 'index.js'));
  if (bundle.length > 5 * 1024 * 1024) throw new Error('Bundle exceeds the upstream 5 MiB limit.');
  const notices = thirdPartyNotices(Object.keys(result.metafile.inputs));
  fs.writeFileSync(path.join(stage, 'THIRD_PARTY_NOTICES.txt'), notices.text);
  for (const name of ['README.md', 'logo.png']) fs.copyFileSync(path.join(root, name), path.join(stage, name));
  fs.copyFileSync(path.join(root, '..', 'LICENSE'), path.join(stage, 'LICENSE'));
  const packagedManifest = { ...manifest, main: './src/index.js', dependencies: {},
    files: ['src/index.js', 'README.md', 'logo.png', 'LICENSE', 'THIRD_PARTY_NOTICES.txt'] };
  for (const key of ['scripts', 'devDependencies', 'peerDependencies', 'types']) delete packagedManifest[key];
  fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(packagedManifest, null, 2) + '\n');
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--cache', path.join(root, 'build', '.npm-cache'), '--pack-destination', output],
    { cwd: stage, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))[0];
  const archive = path.join(output, packed.filename);
  const digest = sha256(fs.readFileSync(archive));
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), `${digest}  ${packed.filename}\n`);
  const report = { package: manifest.name, version: manifest.version, source_commit: sourceCommit, source_dirty: dirty,
    archive: packed.filename, sha256: digest, archive_bytes: packed.size, bundle_bytes: bundle.length,
    runtime_dependencies: [], bundled_packages: notices.packages,
    files: packed.files.map(file => file.path).sort(),
    validation_scope: 'Self-contained custom-piece archive; not an Activepieces catalog or hosted-install approval.' };
  fs.writeFileSync(path.join(output, 'release-manifest.json'), JSON.stringify(report, null, 2) + '\n');
  return { archive, stage, report };
}

module.exports = { buildArchive };
if (require.main === module) buildArchive().then(({ report }) => console.log(JSON.stringify(report, null, 2)))
  .catch(error => { console.error(error.message); process.exitCode = 1; });

/**
 * Zero-dependency sanity check, run in CI before every deploy.
 *
 * Kindercade has no bundler, so nothing would otherwise catch a typo in an
 * import path or a game that forgot its default export until a child taps the
 * card and gets a blank screen. This covers exactly that.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const note = (msg) => problems.push(msg);

/* ── 1. every .js file parses ─────────────────────────────────────────── */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    note(`syntax error in ${relative(ROOT, file)}\n${err.stderr?.toString().trim()}`);
  }
}

/* ── 2. relative imports resolve to real files ────────────────────────── */

const IMPORT_RE = /(?:^|[\s;{(])(?:import|export)[\s\S]{0,200}?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] || m[2];
    if (!spec) continue;
    const target = resolve(dirname(file), spec);
    if (!existsSync(target)) {
      note(`${relative(ROOT, file)} imports "${spec}" which does not exist`);
    }
  }
}

/* ── 3. the registry lines up with the games on disk ──────────────────── */

const registrySrc = readFileSync(join(ROOT, 'src/games/index.js'), 'utf8');
const ids = [...registrySrc.matchAll(/id:\s*'([\w-]+)'/g)].map((m) => m[1]);
if (ids.length === 0) note('src/games/index.js declares no games');

for (const id of ids) {
  const file = join(ROOT, 'src/games', `${id}.js`);
  if (!existsSync(file)) { note(`registry lists "${id}" but src/games/${id}.js is missing`); continue; }
  const src = readFileSync(file, 'utf8');
  if (!/export\s+default\s/.test(src)) note(`src/games/${id}.js has no default export`);
  if (!/static\s+meta\s*=/.test(src)) note(`src/games/${id}.js has no static meta block`);
  if (!new RegExp(`id:\\s*'${id}'`).test(src)) note(`src/games/${id}.js meta.id does not match "${id}"`);
}

const onDisk = readdirSync(join(ROOT, 'src/games'))
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .map((f) => f.replace(/\.js$/, ''));
for (const file of onDisk) {
  if (!ids.includes(file)) note(`src/games/${file}.js exists but is not in the registry`);
}

/* ── 4. the service worker precaches everything that ships ────────────── */

const swSrc = readFileSync(join(ROOT, 'sw.js'), 'utf8');
for (const id of ids) {
  if (!swSrc.includes(`src/games/${id}.js`)) note(`sw.js does not precache src/games/${id}.js`);
}

/* ── 5. required static files exist ───────────────────────────────────── */

for (const f of ['index.html', 'manifest.webmanifest', 'styles/main.css', '.nojekyll',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-180.png']) {
  if (!existsSync(join(ROOT, f))) note(`missing required file: ${f}`);
}

try {
  JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
} catch (err) {
  note(`manifest.webmanifest is not valid JSON: ${err.message}`);
}

/* ── 6. every spoken letter is a syllable, not an initialism ──────────── */

/*
 * Speech engines read a token they cannot pronounce one letter at a time, so a
 * phonics spelling like "sss" comes out as "ess, ess, ess" and "ks" as
 * "kay ess". Anything the voice says on its own therefore needs a vowel in it
 * and no run of repeated letters.
 */

const { LETTER_SOUND, LETTER_NAME, ALPHABET } = await import(
  new URL('../src/data/words.js', import.meta.url)
);

for (const [label, map] of [['LETTER_SOUND', LETTER_SOUND], ['LETTER_NAME', LETTER_NAME]]) {
  for (const [letter, said] of Object.entries(map)) {
    if (!/[aeiouy]/.test(said)) {
      note(`${label}.${letter} = "${said}" has no vowel — the voice will spell it out`);
    }
    const run = said.match(/(.)\1\1+/);
    if (run) {
      note(`${label}.${letter} = "${said}" repeats "${run[1]}" — the voice will spell it out`);
    }
  }
  for (const letter of ALPHABET) {
    if (!map[letter]) note(`${label} has no entry for "${letter}"`);
  }
}

/* ── report ───────────────────────────────────────────────────────────── */

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n`);
  problems.forEach((p) => console.error('  • ' + p));
  process.exit(1);
}
console.log(`✓ ${files.length} modules parse, ${ids.length} games registered, all imports resolve.`);

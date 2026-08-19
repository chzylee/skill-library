// The npx installer template: resolution, safety, and the no-destroy guarantee.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const TEMPLATE = fileURLToPath(new URL('../templates/install.mjs', import.meta.url));

// A throwaway repo: two skills, one decoy directory with no SKILL.md.
function fakeRepo({ skillsRoot = null } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'rig-install-'));
  const root = skillsRoot ? join(repo, skillsRoot) : repo;
  for (const name of ['alpha', 'beta']) {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
    writeFileSync(join(root, name, 'README.md'), `# ${name}\n`);
  }
  mkdirSync(join(root, 'not-a-skill'), { recursive: true });
  writeFileSync(join(root, 'not-a-skill', 'notes.txt'), 'no SKILL.md here\n');
  if (skillsRoot) writeFileSync(join(repo, '.dev-build.conf'), `skills_root="${skillsRoot}"\n`);
  cpSync(TEMPLATE, join(repo, 'install.mjs'));
  return repo;
}

function run(repo, args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [join(repo, 'install.mjs'), ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

test('--list finds only directories that contain a SKILL.md', () => {
  const repo = fakeRepo();
  const { code, out } = run(repo, ['--list']);
  assert.equal(code, 0);
  assert.match(out, /alpha/);
  assert.match(out, /beta/);
  assert.doesNotMatch(out, /not-a-skill/);
});

test('installs one skill as a real directory', () => {
  const repo = fakeRepo();
  const dest = mkdtempSync(join(tmpdir(), 'rig-dest-'));
  const { code, out } = run(repo, ['alpha', '--dir', dest]);
  assert.equal(code, 0);
  assert.match(out, /SKILL_INSTALLED alpha/);
  assert.ok(existsSync(join(dest, 'alpha', 'SKILL.md')));
  assert.match(readFileSync(join(dest, 'alpha', 'SKILL.md'), 'utf8'), /name: alpha/);
});

test('refuses to clobber an existing install without --force', () => {
  const repo = fakeRepo();
  const dest = mkdtempSync(join(tmpdir(), 'rig-dest-'));
  run(repo, ['alpha', '--dir', dest]);
  const { code, out } = run(repo, ['alpha', '--dir', dest]);
  assert.equal(code, 2);
  assert.match(out, /SKILL_INSTALL_ERROR/);
  assert.match(out, /--force/);
});

test('--force moves the old copy aside rather than deleting it', () => {
  const repo = fakeRepo();
  const dest = mkdtempSync(join(tmpdir(), 'rig-dest-'));
  run(repo, ['alpha', '--dir', dest]);
  writeFileSync(join(dest, 'alpha', 'MINE.md'), 'user edit worth not losing\n');
  const { code } = run(repo, ['alpha', '--dir', dest, '--force']);
  assert.equal(code, 0);
  const backup = readdirSync(dest).find((d) => d.startsWith('alpha.backup-'));
  assert.ok(backup, 'a backup directory should exist');
  assert.ok(existsSync(join(dest, backup, 'MINE.md')), 'the edit survives in the backup');
});

test('rejects an unknown skill and path traversal, exit 2 either way', () => {
  const repo = fakeRepo();
  const dest = mkdtempSync(join(tmpdir(), 'rig-dest-'));
  const missing = run(repo, ['nope', '--dir', dest]);
  assert.equal(missing.code, 2);
  assert.match(missing.out, /no skill named/);
  for (const bad of ['../escape', 'a/b', '.hidden']) {
    const r = run(repo, [bad, '--dir', dest]);
    assert.equal(r.code, 2, `${bad} must be refused`);
  }
});

test('honours skills_root from .dev-build.conf, and works without the file', () => {
  const nested = fakeRepo({ skillsRoot: 'skills' });
  const listed = run(nested, ['--list']);
  assert.match(listed.out, /alpha/);
  const dest = mkdtempSync(join(tmpdir(), 'rig-dest-'));
  assert.equal(run(nested, ['beta', '--dir', dest]).code, 0);
  assert.ok(existsSync(join(dest, 'beta', 'SKILL.md')));

  const flat = fakeRepo();               // no .dev-build.conf at all
  assert.equal(run(flat, ['--list']).code, 0);
});

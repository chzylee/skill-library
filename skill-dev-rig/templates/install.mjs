#!/usr/bin/env node
// Skill installer — copy one skill folder from this repo into ~/.claude/skills/.
//
// Scaffolded by /skill-dev-rig. Per-repo, not per-skill: one copy of this file
// serves every skill in the repo, and rigging a second skill does not touch it.
//
// Usage:
//   npx github:<owner>/<repo> <skill> [--force] [--dir <path>]
//   npx github:<owner>/<repo> --list
//
// Node stdlib only, so it runs under npx with nothing installed.
//
// Exit codes: 0 installed or listed · 2 bad args or precondition.

import { existsSync, readdirSync, readFileSync, statSync, cpSync, renameSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const REPO = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const valueOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dir');

const die = (msg) => { process.stdout.write(`SKILL_INSTALL_ERROR ${msg}\n`); process.exit(2); };

// `skills_root` tells us whether skills sit at the repo root or under a subdir.
// The file is optional — a repo that was never rigged for dev/prod still installs.
function skillsRoot() {
  const conf = join(REPO, '.dev-build.conf');
  if (!existsSync(conf)) return REPO;
  const m = /^\s*skills_root\s*=\s*"?([^"\n]*)"?/m.exec(readFileSync(conf, 'utf8'));
  const root = (m && m[1].trim()) || '.';
  return resolve(REPO, root);
}

const ROOT = skillsRoot();

const listSkills = () => readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  .map((e) => e.name)
  .filter((n) => existsSync(join(ROOT, n, 'SKILL.md')))
  .sort();

if (flags.has('--list') || positional.length === 0) {
  const skills = listSkills();
  if (!skills.length) die(`no skills found under ${ROOT}`);
  process.stdout.write(`Skills in this repo:\n${skills.map((s) => `  ${s}`).join('\n')}\n\n`);
  process.stdout.write(`Install one:  npx github:<owner>/<repo> ${skills[0]}\n`);
  process.exit(flags.has('--list') ? 0 : 2);
}

// One skill per run: installing several at once makes a partial failure ambiguous.
if (positional.length > 1) die(`one skill at a time; got: ${positional.join(', ')}`);

const skill = positional[0];
// The name is a single directory entry, never a path.
if (skill.includes('/') || skill.includes('\\') || skill.includes('..') || skill.startsWith('.')) {
  die(`unsafe skill name: ${skill}`);
}

const src = join(ROOT, skill);
if (!existsSync(join(src, 'SKILL.md'))) {
  die(`no skill named "${skill}" (try --list)`);
}

const targetDir = valueOf('--dir') ? resolve(valueOf('--dir')) : join(homedir(), '.claude', 'skills');
const dest = join(targetDir, skill);

// A real directory, never a symlink — symlinked skills have open Claude Code
// bugs on Windows.
if (existsSync(dest)) {
  if (!flags.has('--force')) {
    die(`${dest} already exists — pass --force to replace it (the old copy is kept as a backup)`);
  }
  // Replace, but never destroy: the previous install moves aside rather than being
  // deleted. It goes in a DOT-directory, not beside the skill — a backup named
  // `<skill>.backup-<ts>` still holds a SKILL.md inside the directory Claude Code
  // scans, which is the same-name shadow this whole pattern exists to prevent.
  const backupRoot = join(targetDir, '.skill-backups');
  mkdirSync(backupRoot, { recursive: true });
  const backup = join(backupRoot, `${skill}-${Date.now()}`);
  renameSync(dest, backup);
  process.stdout.write(`  previous install moved to ${backup}\n`);
}

mkdirSync(targetDir, { recursive: true });
// Dev-only weight stays behind: a skill's test/, fixtures/ and docs/ trees serve
// the repo, not the installed copy. Top level of the skill only — a nested
// directory that happens to share one of the names still installs.
const DEV_ONLY_DIRS = new Set(['test', 'fixtures', 'docs']);
cpSync(src, dest, {
  recursive: true,
  dereference: true,
  filter: (s) => {
    const base = s.split(/[\\/]/).pop();
    if (base === '.git' || base === 'node_modules') return false;
    const rel = relative(src, s);
    if (DEV_ONLY_DIRS.has(rel) && statSync(s).isDirectory()) return false;
    return true;
  },
});

const count = (function walk(d) {
  return readdirSync(d, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? walk(join(d, e.name)) : 1), 0);
})(dest);

process.stdout.write(`SKILL_INSTALLED ${skill} -> ${dest} (${count} files)\n`);
if (existsSync(join(dest, 'README.md'))) {
  process.stdout.write(`  setup notes: ${join(dest, 'README.md')}\n`);
}
process.stdout.write(`  restart Claude Code, or open a new session, to load it.\n`);

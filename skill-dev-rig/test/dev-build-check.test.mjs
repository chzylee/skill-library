// The SessionStart freshness hook: orphan detection (both clauses), staleness,
// the SKILL.md-derived ahead-of-stable list, and the never-source-the-conf rule.
// The script under test is the TEMPLATE — the copy every rigged repo receives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CHECK = fileURLToPath(new URL('../templates/dev-build-check.sh', import.meta.url));

function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t',
    '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' }).trim();
}

function skillMd(dir, name, body = 'v1') {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n${body}\n`);
}

function deployBuild(home, skill, sha) {
  const d = join(home, '.claude', 'skills', `${skill}-dev`);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'SKILL.md'),
    `---\nname: ${skill}-dev\ngenerated-by: dev-build\ngenerated-from: ${sha}\n---\n`);
}

// One repo exercises every verdict at once — the way a real session sees them.
function buildFixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'dev-build-check-'));
  const repo = join(tmp, 'repo');
  const home = join(tmp, 'home');
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(home, '.claude', 'skills'), { recursive: true });

  git(repo, 'init', '-q');
  git(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main'); // `init -b` needs git >= 2.28
  for (const s of ['alpha', 'beta', 'promoted', 'ghost', 'recording-standard']) skillMd(join(repo, s), s);
  mkdirSync(join(repo, 'docs'), { recursive: true });
  writeFileSync(join(repo, 'docs', 'notes.md'), 'v1\n');
  mkdirSync(join(repo, '_archive'), { recursive: true });
  writeFileSync(join(repo, '_archive', 'old.md'), 'v1\n');
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  writeFileSync(join(repo, 'scripts', 'x.sh'), 'echo hi\n');
  // release_steps carries a command substitution — prose is where these show up
  // innocently. Parsing must never execute it (the A4 regression this pins).
  writeFileSync(join(repo, '.dev-build.conf'),
    'skills_root="."\nstable_branch="main"\ndev_branch="dev"\nrelease_steps="then run $(touch PWNED) and `touch PWNED2`"\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'main');
  const mainSha = git(repo, 'rev-parse', 'HEAD');

  git(repo, 'checkout', '-q', '-b', 'dev');
  skillMd(join(repo, 'alpha'), 'alpha', 'v2');            // changed on dev
  skillMd(join(repo, 'recording-standard'), 'recording-standard', 'v2');
  writeFileSync(join(repo, 'docs', 'notes.md'), 'v2\n');  // non-skill churn
  writeFileSync(join(repo, '_archive', 'old.md'), 'v2\n');
  writeFileSync(join(repo, 'scripts', 'x.sh'), 'echo v2\n');
  rmSync(join(repo, 'ghost'), { recursive: true });        // gone from dev
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'dev work');
  skillMd(join(repo, 'beta'), 'beta', 'v2');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'more dev work');
  const devSha = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', '-q', 'main');                     // hook must not need dev checked out

  deployBuild(home, 'alpha', mainSha);   // built before dev's change -> STALE
  deployBuild(home, 'beta', devSha);     // at dev HEAD -> silent
  deployBuild(home, 'promoted', devSha); // identical main/dev -> ORPHAN (promoted)
  deployBuild(home, 'ghost', mainSha);   // gone from dev -> ORPHAN (not on dev)
  // a *-dev dir without the marker is a stray the hook must not judge
  const stray = join(home, '.claude', 'skills', 'stray-dev');
  mkdirSync(stray, { recursive: true });
  writeFileSync(join(stray, 'SKILL.md'), '---\nname: stray-dev\n---\n');

  return { tmp, repo, home };
}

function runCheck(repo, home) {
  return execFileSync('sh', [CHECK], {
    encoding: 'utf8',
    cwd: repo,
    env: { ...process.env, HOME: home, CLAUDE_PROJECT_DIR: repo },
  });
}

test('the freshness hook: both orphan clauses, staleness, and a SKILL.md-derived ahead list', () => {
  const { tmp, repo, home } = buildFixture();
  try {
    const out = runCheck(repo, home);

    // A9: a promoted-but-not-torn-down build must warn at session start —
    // this is the only way another machine learns of the teardown.
    assert.match(out, /'promoted-dev' is an ORPHAN.*no longer differs from main/,
      'promoted clause of the orphan definition is implemented');
    assert.match(out, /'ghost-dev' is an ORPHAN.*not on dev/);
    assert.match(out, /'alpha-dev' is STALE/);
    assert.doesNotMatch(out, /beta-dev/, 'a current build stays silent');
    assert.doesNotMatch(out, /stray-dev/, 'unmarked *-dev dirs are never judged');

    // The ahead list derives from SKILL.md existence, not a per-repo denylist.
    const ahead = /ahead of main on dev: (.*)/.exec(out);
    assert.ok(ahead, 'ahead line printed');
    for (const s of ['alpha', 'beta', 'recording-standard']) {
      assert.ok(ahead[1].split(/\s+/).includes(s), `${s} listed as ahead`);
    }
    for (const not of ['docs', '_archive', 'scripts']) {
      assert.ok(!ahead[1].split(/\s+/).includes(not), `${not} is not a skill and must not be listed`);
    }

    // A4: parsing the conf must never execute what its values contain.
    assert.ok(!existsSync(join(repo, 'PWNED')), 'command substitution in the conf did not run');
    assert.ok(!existsSync(join(repo, 'PWNED2')), 'backticks in the conf did not run');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('a CRLF conf still configures the hook (edited on Windows, run anywhere)', () => {
  const { tmp, repo, home } = buildFixture();
  try {
    writeFileSync(join(repo, '.dev-build.conf'),
      'skills_root="."\r\nstable_branch="main"\r\ndev_branch="dev"\r\n');
    const out = runCheck(repo, home);
    assert.match(out, /'alpha-dev' is STALE/, 'branch names parsed despite CRLF');
    assert.match(out, /ahead of main on dev:/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('the rigged copy in scripts/ has not drifted from the template', (t) => {
  const scriptsCopy = fileURLToPath(new URL('../../scripts/dev-build-check.sh', import.meta.url));
  if (!existsSync(scriptsCopy)) return t.skip('no repo-level scripts/ copy here');
  assert.equal(readFileSync(scriptsCopy, 'utf8'), readFileSync(CHECK, 'utf8'),
    'scripts/dev-build-check.sh must stay byte-identical to the template it was copied from');
});

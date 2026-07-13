# content-starter

A **content coach & marketing strategist** that sits down with you and walks a vague idea
to a ready-to-write **outline** — so *starting* a post or script stops being the hard part.

A *session skill*: you arrive with a rough seed ("I worked on X today", "I learned Y"), pick
what you're optimizing for, and the coach proposes structure while you keep judgment and voice.
It stops at the outline — **you** write the draft, which is what protects your voice.

```
coach me on a post — I worked on the onboarding flow today
```

## What it does

1. **Loads your Direction** — a small, stable config (positioning, offer, platform, voice) that
   shapes every outline. Resolves from Notion (if you run TS PMO) or a local file, or interviews
   you once on first run.
2. **Sets a mode** — the one thing you pick up front: **Growth** (reach), **Brand** (identity),
   **Community / Connection** (relationship), or **Explore / Play** (no metric). Each mode's bias
   is grounded in research (see below) and named when it acts, never silently applied.
3. **Proposes a shape** — Teach / Inform, Story / Anecdote, or Personal / Varied — with a one-line
   why; you confirm or switch.
4. **Builds the outline** on a proven funnel — **Hook → Draw-in → Hold → Ender** — with two hook
   options, then stops.

You get an outline (beats, not prose), adapted to your platform (post beats for LinkedIn/Substack,
script beats for TikTok). It never writes the full post.

## Grounded in research

The coach's patterns are not generic tips — each encodes a researched mechanism of what actually
holds attention and persuades (attention/hooks, narrative transportation, the curiosity gap,
concreteness, reach vs. brand-building, parasocial connection). The pattern → mechanism → primary
source map, with honest notes on evidence strength, is in
[`references/research-grounding.md`](references/research-grounding.md). The coach reasons *from* the
mechanism; it does not cite sources at runtime.

## The Agency Law

content-starter is the first skill built on a category rule: **a session skill may bias, but only
in the open, and never past your stated values.** The mode you pick is a bias — so it's user-chosen
each session, its trade-offs are named when they act, and it can never silently override your
Direction. (Grounded in research on how opinionated AI writing tools shift what users write and think.)

## Install

### Claude Code (personal)

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/content-starter ~/.claude/skills/content-starter
```

Windows (PowerShell):

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library\content-starter $env:USERPROFILE\.claude\skills\content-starter
```

Restart Claude Code (or start a new session). Project-scoped instead? Copy the `content-starter`
folder into that project's `.claude/skills/`.

### Claude desktop

Upload `dist/content-starter.skill` via **Settings → Customize → Skills**, or present it in a
claude.ai chat and click **Save skill**.

## Invoke

"outline a post about X" · "shape this into a post" · "coach me on a post" ·
"I worked on X / I learned Y — make it postable" · "turn this into a script" · `/content-starter`

## Requirements

None hard. **Optional:** a Notion `content-direction` Core Context module (best) — otherwise a local
Direction is created on first run at `$HOME/.claude/content-starter/direction.md`. Uses the
`humanizer` skill if present; otherwise applies the norm inline.

## License

MIT — see [LICENSE](../LICENSE).

# content-starter

A **persona-driven session skill** that sits down with you and walks a vague idea to a
ready-to-write **outline** — so *starting* a post or script stops being the hard part.

You arrive with a rough seed ("I worked on X today", "I learned Y"), pick what you're
optimizing for, and it proposes structure while you keep judgment and voice. It stops at
the outline — **you** write the draft, which is what protects your voice. It **shapes** an
idea you bring; it doesn't generate one from nothing.

```
coach me on a post — I worked on the onboarding flow today
```

## Install

### Claude Code (personal)

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/content-starter ~/.claude/skills/content-starter
```

Windows (PowerShell):

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library\content-starter "$HOME\.claude\skills\content-starter"
```

Restart Claude Code (or start a new session). Project-scoped instead? Copy the
`content-starter` folder into that project's `.claude/skills/`.

### Claude desktop

Upload `dist/content-starter.skill` via **Settings → Customize → Skills**, or present it
in a claude.ai chat and click **Save skill**.

## How it's built: persona + scaffold

content-starter is a **consumer** of a persona, kept decoupled by design:

- The **[Content strategist](https://app.notion.com/p/39d76356d6fe81e2af31db1ad9ee8345)**
  persona is the **judgment** — an advisory, data-driven stance, a three-stance bias, four
  goal-modes (Engagement / Community / Brand-development / Explore), directives, and
  grounding via live research. The skill *loads* it; it doesn't rebuild it.
- **content-starter** is the **orchestration** — the outline scaffolds (the shapes), the
  research-cost policy, how hard to push the stance, the session flow, and the outline
  deliverable.

That split is why the same persona can also be pulled aside mid-session as a lens on a
draft, no skill involved. See
[the architecture](https://app.notion.com/p/39e76356d6fe816688c2c1ec4a5da64f).

## What it does

1. **Loads the Content strategist** — live from your Notion Personae Library (personal
   form) or from the bundled versioned snapshot (standalone form); it tells you which.
2. **Loads your Direction** — a small, stable input (positioning, offer, platform, voice)
   the persona expects; from Notion (if you run TS PMO), a local file, or a first-run
   interview.
3. **Sets a mode** — the one thing you pick up front: **Engagement** (reach), **Community**
   (connection), **Brand-development** (positioning), or **Explore** (test an idea). Named
   when it acts, never silently applied.
4. **Decides the research question** — scoped and one focused pass at most; you rule on
   shape-from-judgment-now vs. a grounded pass.
5. **Proposes a scaffold** — a platform beat-skeleton (LinkedIn / Substack / X-thread /
   TikTok-Shorts / generic), flexed by the mode — with a one-line why; you confirm or
   switch.
6. **Builds the outline** — beats, two hook options, then stops.

You get an outline (beats, not prose), adapted to your platform. It never writes the full
post.

## Where the persona comes from (plug in, don't impose)

**On first run the skill asks** where to load the Content strategist from — you never have
to know an app-specific setting. Three first-class choices, and it remembers your answer:

- **Connect your Persona Library** — paste a Notion link when asked; the skill loads the
  **Content strategist** live (current canon) and saves the source to
  `$HOME/.claude/content-starter/persona-source.md` so it never asks again. If Notion is
  unreachable later, it falls back to the bundled snapshot and says so.
- **Use the bundled snapshot** — runs fully offline on the baked release copy at
  [`personas/content-strategist.v0.1.0.md`](personas/content-strategist.v0.1.0.md), which
  owes canon nothing. A valid destination, not a downgrade.
- **Set it up later** — bundled snapshot for this session; asks again next time.

Prefer a machine-wide default? Set `PERSONA_LIBRARY_DS_ID` and it skips the ask — but that's
an optional shortcut, never required.

## Grounded in research

The scaffold shapes and the Agency Law aren't generic tips — each encodes a researched
mechanism (attention/hooks, the curiosity gap, concreteness, narrative transportation,
and the evidence that opinionated AI tools reshape what users write). The map, with honest
notes on evidence strength, is in
[`references/research-grounding.md`](references/research-grounding.md). The *stance's*
grounding (the data-driven bias, the modes) lives with the Content strategist persona,
which grounds via live research. The skill reasons *from* the mechanism; it does not cite
sources at runtime.

## The Agency Law

content-starter is the first skill built on a category rule: **a session skill may bias,
but only in the open, and never past your stated values.** The mode you pick is a bias —
so it's user-chosen each session, its trade-offs are named when they act, and it can never
silently override your Direction. Enforcement lives in the skill (where you are), never in
the persona.

## Invoke

"outline a post about X" · "shape this into a post" · "coach me on a post" ·
"I worked on X / I learned Y — make it postable" · "turn this into a script" ·
`/content-starter`

## Requirements

None hard — the **standalone form** runs offline on the bundled persona snapshot.
**Optional upgrades:**

- A **Notion** connection + the Personae Library (`PERSONA_LIBRARY_DS_ID` or a link) to
  load the **Content strategist** live.
- A ts-pmo Core Context **content-direction** module for the Direction — otherwise a local
  one is created on first run at `$HOME/.claude/content-starter/direction.md`.
- A **web/research** tool for the research pass (absent → degrades to judgment, flagged).
- The **humanizer** skill for example phrasing (absent → apply the norm inline).

## License

MIT — see [LICENSE](../LICENSE).

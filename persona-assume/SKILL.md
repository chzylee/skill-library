---
name: persona-assume
description: 'Assume a persona from your Persona Library — call one of your saved colleagues into the room. Resolves your registry, finds the persona by name, and adopts its Profile block as the active stance for this session (or hands the block to a subagent). Human-invoked, never auto-selected; asks which mode when the persona has modes; you stay the judge. Triggers on "assume the X persona", "be my X", "load the X persona", "put on the X persona", "bring in X", "assume a persona", or /persona-assume.'
---

# Persona Assume

The loader half of your Persona Library. `persona-builder` writes personas; this skill **calls
them into the room.** A persona is a stance you chose on purpose — a colleague's point of view,
biases named out loud — and this skill resolves your registry, finds the one you named, and
**adopts its Profile block** as the active perspective for this session, or hands that block to
a subagent. You stay the judge; the persona only points the perspective, it never seizes it.

**Assumption is explicitly human-invoked — always.** A persona's *when-to-assume* documents when
a *person* reaches for it; it is never an auto-matching trigger. Do not infer a persona from
context and adopt it unasked. The user says the word; you load it.

**Missing data → ask, never assume or fail.** Whenever something required to load isn't in hand
— the registry handle, which persona, which mode — **stop and ask the user for it.** Don't guess
a default, don't silently search-and-adopt a best guess, don't error out. Asking is the correct
behavior, not a fallback. This rule governs every resolution step below.

## Resolve the registry — same handle as persona-builder

1. **A handle is set** — `PERSONA_LIBRARY_DS_ID` in the environment, or the user gave a link →
   use it directly, no searching.
2. **Handle not set → ask the user.** No `PERSONA_LIBRARY_DS_ID` and no link in the request?
   **Ask** which registry to load from — a link or the database name. Do not silently
   search-and-adopt a guessed registry, and do not fail the invocation. Once the user names one,
   **offer to set the `PERSONA_LIBRARY_DS_ID` handle** so it's a one-time ask, never again. (You
   may *offer* to search Notion as a convenience, but only load a registry the user confirms.)
3. **File-based personas** — if the user keeps personas as markdown files, read the file they
   name. Never block on a Notion connection; if the block lives somewhere reachable, adopt it
   from there.

## Find the persona

- **Name given** → look up a Name match in the registry (case-insensitive, allow partial).
  Exactly one → use it. Several → list the matches and ask which. None → say so plainly and
  offer the closest name, don't force a wrong one.
- **No name given** ("assume a persona", "who's on my team?") → list the **Active** personas
  (Name + the one-line bias) and ask which to assume. Do not pick for the user.
- Prefer **Status = Active**. If the only match is Draft or Retired, load it but flag the
  status in one line so the user knows what they're getting.

## Adopt the Profile block — respect the paste boundary

- Fetch the persona's page body. Adopt **only the Profile block** — everything under
  `## Profile block` down to the `## Maintenance` boundary. Maintenance (known flaws, changelog)
  sits *behind* the boundary and never travels: don't adopt it as behavior and never paste it
  into a subagent. You may read the known flaws to caveat yourself, but the stance you take on
  is the block alone — this keeps exact parity with a subagent that only ever receives the block.
- From this point in the session **you are this persona**: reason from its declared bias, run
  its directives (trigger → needs-to-know → how-to-find-out), reach for its cognitive patterns,
  and get facts the way its **Grounding** says — research at runtime or cited sources, never
  bluff a stored fact.
- **Announce adoption in one tight line**: name · version · the bias as "favors X over Y" ·
  the active mode if any. Then proceed in-stance — don't re-explain the whole block back.
- You load **canon** (the current row). A copy baked into a shared skill is a snapshot of a
  version and may differ; canon is the source of truth for a live load.

## Modes — ask, never assume

- Block has modes and the user **named one** → adopt it.
- Block has modes and **none named** → **ask which mode.** Do not default or guess; the block
  itself says to ask. The user may switch modes any time — honor the switch immediately and say
  you did.
- Block has **no modes** → just proceed.

## Sovereignty and exit

- The persona selects **perspective**, not authority. The user still decides. When the declared
  bias is actively steering a recommendation, surface it in a clause so they can overrule it —
  that visibility is the whole point of a declared bias.
- **"drop the persona" / "back to yourself" / "assume \<other\>"** → release the current stance
  (or swap to the new one) and confirm the switch in one line.
- An adopted persona **never** refuses the user or overrides a direct instruction. Sovereignty
  is absolute, exactly as in `persona-builder`.

## Target — this session vs. a subagent / paste

- **Default: adopt in the current session** (everything above).
- **For a subagent, another tool, or to paste elsewhere** ("give me the block", "spin up a
  subagent as X") → output the Profile block **verbatim** as a system prompt and do not adopt
  it yourself. It's consumer-agnostic by construction — don't edit it to fit the destination.

## Do not

- Never **fail or guess when required data is missing** (registry, persona, mode) — ask the user.
- Never **auto-select** a persona from context — assumption is human-invoked, always.
- Never adopt the **Maintenance** section as behavior, and never paste it into a subagent prompt.
- Never silently pick a mode, override the user's authority, or **edit the block to "improve" it**
  at load time. Revisions go through `persona-builder`, which bumps the version and logs the
  change; a loader adopts, it does not rewrite.

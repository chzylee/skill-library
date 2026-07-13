# sharpen

A one-word hook for a three-step move, done in a single response: **optimize the prompt → run it → reflect.**

Mark any rough request with `sharpen` and Claude will rewrite it into a sharper prompt, immediately
execute it (producing the real deliverable, not just the rewrite), then close with what's *most needed*
and where it's *least confident*.

```
sharpen draft a launch email for the new pricing tier
```

## What it does

1. **Optimize** — rewrites your rough request into a sharper prompt: goal in one line; scope,
   constraints, and success criteria explicit; ambiguity resolved from context instead of asking.
   Shown under a short "Sharpened prompt" heading.
2. **Run** — executes the sharpened prompt and produces the actual deliverable.
3. **Reflect** — ends with two short sections: **Most needed** (missing facts/decisions) and
   **Least confident** (guesses, thin evidence, or where the approach might be wrong).

It triggers only when you mark a request with the `sharpen` hook (`sharpen`, `sharpen:`,
`sharpen this`, etc.) — never on ordinary unmarked requests.

## Install

### Claude Code (personal)

```bash
git clone https://github.com/chzylee/skill-library.git
cp -r skill-library/sharpen ~/.claude/skills/sharpen
```

Windows (PowerShell):

```powershell
git clone https://github.com/chzylee/skill-library.git
Copy-Item -Recurse skill-library\sharpen $env:USERPROFILE\.claude\skills\sharpen
```

Restart Claude Code (or start a new session). Project-scoped instead? Copy the `sharpen` folder
into that project's `.claude/skills/`.

### Claude desktop

Upload `dist/sharpen.skill` via **Settings → Customize → Skills**, or present it in a claude.ai
chat and click **Save skill**.

## License

MIT — see [LICENSE](../LICENSE).

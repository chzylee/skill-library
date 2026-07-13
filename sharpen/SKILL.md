---
name: sharpen
description: 'Trigger when the user marks a request with the short hook "sharpen" — for example "sharpen", "sharpen:", "sharpen this", "sharpen that", or sharpen followed by a rough prompt. Shorthand for the user''s optimize-and-run pattern: rewrite their rough prompt into a sharper one, execute it, then report what''s most needed and least certain. Don''t trigger on ordinary unmarked requests.'
---

# sharpen — optimize, run, reflect

A one-word hook for a three-step move, done in a single response, in order.

## 1. Optimize the prompt
Rewrite the rough request into a sharper prompt: goal in one line; scope, constraints, and success criteria explicit; resolve ambiguity from available context instead of asking unless something is genuinely blocking; preserve intent and voice. Show it under a brief "Sharpened prompt" heading (2–6 lines).

## 2. Run it
Immediately execute the sharpened prompt and produce the real deliverable — not just the rewrite. Use tools if needed.

## 3. Reflect
End with exactly two short sections:
- **Most needed** — the few missing facts or decisions that would let you fully hit the goal.
- **Least confident** — where you're guessing, where evidence is thin, or where the approach might be wrong.

## Style
Lead with the answer; keep it concise. Never fabricate to fill the reflection — "I don't know X" is valid and preferred. For factual or technical claims, separate your explanation from primary sources and flag them.

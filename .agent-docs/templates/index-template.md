<!--
Per-dir index template per CONVENTIONS.md §7.1 (route, don't browse) + §8 (versioned templates).
Instantiate to `<dir>/index.md` — exactly ONE per populated content dir.
MAINTENANCE RULE (hook-enforced, §7.1): adding/retiring ANY doc in this dir updates this index in the
SAME change. The `` `file.md` `` references here MUST match the on-disk set — no unindexed, no phantom.
Entry shape = what-it-holds · Open when: · Carry-away:. Group by QUESTION / JOB, not alphabet.
Carry-away claims MUST be traceable to the source doc — a wrong carry-away is worse than none.
Root `.agent-docs/index.md` is directory-level ONLY (list dirs, not docs).
Delete this comment block + the inline guidance once filled in.
-->

---
provenance: llm-draft
template-version: 1.0.0
created: <YYYY-MM-DD>
last-modified: <YYYY-MM-DD>
tags: [index]
---

# <dir>/ — index

<!-- One-line statement of what this directory is FOR. -->

## <Question / job cluster A>

- ⭐ `canonical-doc.md` — <what it holds>.
  **Open when:** <the situation that makes this the right doc.>
  **Carry-away:** <the one fact to retain even if you don't open it.>
- 🔨 `actionable-doc.md` — <what it holds>.
  **Open when:** <…>  **Carry-away:** <…>

## <Question / job cluster B>

- 🧭 `proposal-doc.md` — <what it holds> *(proposal awaiting ratification)*.
  **Open when:** <…>  **Carry-away:** <…>

<!-- Markers: ⭐ canonical hub · 🔨 actionable · 🧭 proposal awaiting ratification. -->

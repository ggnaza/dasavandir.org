<!--
ADR template per CONVENTIONS.md §5 (decision policy) + §2 (front-matter) + §8 (versioned templates).
Instantiate to `.agent-docs/decisions/NNNN-kebab-claim-as-title.md` and fill in.
  NNNN = next zero-padded 4-digit sequential ADR number · title = the decision AS A CLAIM.
Record the `template-version` you scaffolded from (§8) so drift is detectable, not invisible.
The `## Alternatives Considered` field is authored BEFORE the work, not reverse-engineered after (§5).
Delete this comment block + the inline guidance comments once filled in.
-->

---
provenance: llm-reviewed        # §2 — accepted ADRs may NOT be llm-draft/llm-autonomous
status: proposed                # proposed → accepted/rejected → superseded/deprecated (§2, §5)
template-version: 1.0.0
created: <YYYY-MM-DD>            # LOCAL date (date +%Y-%m-%d), not UTC (§2)
last-modified: <YYYY-MM-DD>
work-unit: WU-NNNN              # §4 spine — the work-unit this decision serves
supersedes: []                  # ADR(s) this overrides (they get status: superseded + superseded-by)
superseded-by: null             # back-pointer, set if THIS ADR is later overridden
related: []                     # ADR / memory / OQ ids in the breadcrumb graph
tags: []
---

# ADR-NNNN — <the decision stated as a claim>

## Context
<!-- What forced this decision. The problem, the constraints, what triggered it now. -->

## Alternatives Considered          <!-- MANDATORY (§5) — the dead-ends ARE the value -->
<!-- Each rejected option + WHY it was rejected (its superseded-but-instructive lesson).
     A summarizer that drops these destroys the WHY. Written BEFORE acting. -->
- Option A — rejected because …
- Option B — rejected because … (what it would have cost / what it taught us)

## Prior art / reference
<!-- Cite the backing reference architecture, canonical pattern, or ecosystem precedent.
     If the shape is novel, say so and cite the absence of prior art as a risk. -->

## Decision
<!-- What we chose, in one paragraph. -->

## Consequences
<!-- What this means going forward — good AND bad. Name the costs, not just the wins. -->

## Related
<!-- ADR-XXXX · memories/some-gotcha · WU-NNNN · the log.md entry where this was decided. -->

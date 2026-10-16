## SmartGate project rules

Before planning, designing, or implementing SmartGate work, read
`docs/PROJECT-CONTEXT.md`. Then read every reference that the context map marks
as required for the task. Do not start feature work from the current code alone.

### Source-of-truth order

When references differ, apply them in this order:

1. The user's latest explicit instruction.
2. `docs/product/SmartGate-المتطلبات-والقرارات.md` for approved scope and decisions.
3. `docs/product/SmartGate-PRD.md` for requirements, acceptance criteria, and delivery stages.
4. `docs/brand/SmartGate-قرارات-الهوية.md` for approved brand decisions.
5. Files under `docs/reference/source-material/` for background and historical context only.
6. `docs/reference/smartgate-original-README.md` for repository history only.

Do not turn an open item, proposal, or historical statement into an approved
requirement. Preserve the A/D/P/O/F classifications used by the product docs.
If an unresolved choice is needed, use the smallest reversible assumption,
label it in the implementation and documentation, and ask only when the choice
has material product, security, or data consequences.

### Non-negotiable product boundaries

- The current product covers port entry, from trip planning through confirmed
  gate crossing, entry documentation, reports, and notifications.
- Exit operations and operations inside the port are outside the current scope.
- Verification success and barrier opening are separate events. Neither
  completes a trip. Only confirmed physical crossing completes entry.
- A barrier failure must be recorded and escalated without completing entry.
- Mocked, simulated, estimated, and unavailable data must be labeled clearly.
- Never imply a real port, customs, camera, sensor, or barrier integration unless
  such an integration has actually been implemented and verified.

### Implementation traceability

- Cite the relevant requirement or decision ID in plans, significant code
  comments, migrations, or PR descriptions when it helps reviewers trace the
  behavior.
- Validate work against the acceptance criteria in the PRD, including failure
  and exception paths.
- When the user explicitly approves a new or changed product decision, update
  the appropriate document under `docs/product/` in the same change.
- Never commit secrets. Keep private credentials in local or hosting environment
  variables. Public client configuration must still be documented in
  `.env.example`.

### Brand assets

Approved runtime assets live in `public/brand/`. Use SVG files for interface
logos when possible. Follow `docs/brand/SmartGate-قرارات-الهوية.md` and
`public/brand/README.md`; do not recolor, distort, redraw, or replace the approved
logo without an explicit user decision.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

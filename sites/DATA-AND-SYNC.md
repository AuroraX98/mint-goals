# Mint Goals data and sync

The public Site uses Sites authentication. `app/api/state/route.ts` obtains the platform-authenticated user and uses their stable Site-scoped ID as the D1 owner key. Requests without identity receive 401. Email is never the record key. No frontend credential, external auth provider, or production auth bypass is included.

`GET /api/state` returns `{state, version, ownerScope}`. First use returns `{state:null,version:0,ownerScope}`. `PUT /api/state` accepts `{state,version,ownerScope}` with the last server revision. State's own `version:3` is the data schema version, independent from server revision. Successful saves atomically increment the revision. A single conditional SQL insert/update prevents concurrent overwrites; 409 returns the latest state and revision. The client must preserve unsaved data and obtain explicit user resolution, never automatically re-submit a conflicting snapshot with the newer revision.

The state is validated server-side: up to 200 goals, 200 steps per goal, 50 categories; field limits and category references; unique IDs; finite valid creation dates; exact known field sets. Requests are limited to 2,000,000 UTF-8 bytes. Same-origin PUT requests require JSON. All responses disable caching.

## Files
- `db/schema.ts`: Drizzle table definition.
- `drizzle/0000_funny_maggott.sql` and `drizzle/meta/`: generated schema-only migration.
- `lib/goal-store.mjs`: validation, owner-scoped D1 operations, HTTP behavior.
- `public/`: frontend sources, copied to build assets.
- `.openai/hosting.json`: retained project identity and `DB` binding; Sites provisions and migrates hosted D1.

## Checks
```sh
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node /home/agent/.codex/plugins/cache/openai-curated-remote/sites/1.1.2/scripts/build-site.mjs
```
`storage.test.mjs` runs production SQL on persistent SQLite with close/reopen, user isolation, two initial writers, concurrent revision writes, input/auth/origin/size checks. `d1.test.mjs` uses actual local Miniflare D1 persistence across worker disposal/recreation and verifies isolation and compare-and-swap. These are local checks, not verification of a deployed account or two physical devices.

For portable local preview, `npm run dev` uses the starter's loopback-only development sign-in at `/signin-with-chatgpt?return_to=%2F`. That mock is Vite dev middleware, absent from production. Local preview database and tests are isolated from hosted data. The local development identity is not an actual account.

## Optional per-goal ideas and intentions (schema v3)

Each goal may have `reflection` with five optional plain-text keys: `why`, `explore`, `learn`, `create`, and `apply` (2,000 characters each). Optional `customQuestions` contains up to 100 `{id,question,answer}` entries; question text allows 300 characters and answers allow 2,000. Blank answers and blank custom pairs are valid. Missing legacy fields normalize to empty without changing old goals, steps, descriptions, or completion dates. Clients import v1/v2/v3 and export v3. A newer saved schema cannot be overwritten by an older client. No database table migration is needed.

Answers are debounced, not cleared by hiding the pane, and typing never rebuilds the textarea. The existing whole-notebook limit remains 1,990,000 UTF-8 bytes client-side, with a 2,000,000-byte request ceiling. Overlong or over-budget answer drafts stay in memory and are included in an export; they do not replace the valid saved goal. Drafts can be shortened to recover, and unrelated valid goal actions remain available. Such an over-limit backup requires shortening before reimport.

`ownerScope` is an opaque SHA-256 digest of an app-specific prefix plus the authenticated owner ID. It is not an auth credential, is held only in frontend memory, and is excluded from JSON backups. PUT compares it with the current authenticated account before any write. A mismatch or old client without a scope gets a 409 without any account's state in the response. Refresh also checks the scope before replacing the displayed goals. This prevents an account switch in another tab from copying the prior account's loaded goals into the new account at an equal revision. Existing platform authentication remains mandatory.

Targeted tests cover field/schema limits, whitespace, optional workflow, linked backup roundtrips, custom IDs, draft export, actual textarea event-handler/caret stability, pending saves and conflicts, and equal-revision account switches. This change has automated DOM simulation, not new rendered-browser QA: managed preview infrastructure was unavailable.

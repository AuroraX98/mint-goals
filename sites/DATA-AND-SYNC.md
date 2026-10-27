# Mint Goals data and sync

The private Site uses Sites authentication. `app/api/state/route.ts` obtains the platform-authenticated user and uses their stable Site-scoped ID as the D1 owner key. Requests without identity receive 401. Email is never the record key. No frontend credential, external auth provider, or production auth bypass is included.

`GET /api/state` returns `{state, version}`. First use returns `{state:null,version:0}`. `PUT /api/state` accepts `{state,version}` with the last server revision. The state's schema version (legacy version 1 or current version 2) is independent from the server revision. Successful saves atomically increment the revision. A single conditional SQL insert/update prevents concurrent overwrites; 409 returns the latest state and revision. The client must preserve unsaved data and obtain explicit user resolution, never automatically re-submit a conflicting snapshot with the newer revision.

The state is validated server-side: up to 200 goals, 200 steps per goal, 50 categories; field limits and category references; unique IDs; finite valid creation dates; exact known field sets. Requests are limited to 2,000,000 UTF-8 bytes. Same-origin PUT requests require JSON. All responses disable caching.

## Files
- `db/schema.ts`: Drizzle table definition.
- `drizzle/0000_funny_maggott.sql` and `drizzle/meta/`: generated schema-only migration.
- `lib/goal-store.mjs`: validation, owner-scoped D1 operations, HTTP behavior.
- `public/`: frontend sources, copied to build assets.
- `.openai/hosting.json`: generic `DB` binding with no project identity; the new-Site workflow supplies its own identity, provisions hosted D1, and applies migrations.

## Checks
```sh
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
# Build using the installed Sites skill after fresh project setup.
```
`storage.test.mjs` runs production SQL on persistent SQLite with close/reopen, user isolation, two initial writers, concurrent revision writes, input/auth/origin/size checks. `d1.test.mjs` uses actual local Miniflare D1 persistence across worker disposal/recreation and verifies isolation and compare-and-swap. These are local checks, not verification of a deployed account or two physical devices.

For portable local preview, `npm run dev` uses the starter's loopback-only development sign-in at `/signin-with-chatgpt?return_to=%2F`. That mock is Vite dev middleware, absent from production. Local preview database and tests are isolated from hosted data. The local development identity is not an actual account.

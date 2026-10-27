# Mint Goals — ChatGPT Sites edition

This is the reusable, full-stack edition of Mint Goals: the mint interface, authenticated per-user storage, revision-conflict protection, and JSON backup import/export. It starts with no personal goals. It contains no existing Site identity, deployment history, database contents, secrets, or account information.

**This folder is a ChatGPT Sites template, not a standalone static website.** Copying `public/` to a generic host does not provide its authenticated `/api/state` backend. For device-local use without Sites, use the offline edition in the repository root instead.

## Create your own private Site

1. Open a ChatGPT conversation with the **Sites** app available and give it this repository (or upload this `sites/` folder).
2. Ask:

   > Create a **new private ChatGPT Site** from the `sites/` template in this repository. Keep the mint design and behavior. Use Sites-managed ChatGPT authentication and a new D1 database bound as `DB`; R2 is unused. Do not reuse another Site or deployment identity. Install dependencies, run the tests and TypeScript checks, build, and deploy through the supported Sites workflow. Keep it private and give me its URL when deployment succeeds.

3. Sites should initialize a fresh checkout using this sanitized directory as its retained template, register a new private Site, and write the **newly returned** `project_id` into that checkout's `.openai/hosting.json`. The template deliberately omits this field. Keep `"d1": "DB"` and `"r2": null`.
4. The Sites workflow installs the locked dependencies, builds the Worker, synchronizes the new Site's source, and publishes through its private-deployment tools. Sites provisions D1 and applies the included schema-only migrations. Do not manually reuse a database or enter an old project ID.
5. Open the returned URL and sign in with ChatGPT. Add a disposable test goal, reload, and check it from another device signed in as the same account. Remove the test goal afterward. The public GitHub source does **not** make this private deployment or its stored goals public.

Availability of Sites and its hosting features depends on your ChatGPT account. This repository does not register or deploy a Site by itself.

## Data and backups

- `/api/state` requires the Sites-authenticated identity. Records are keyed by the stable, Site-scoped user ID, not email.
- Server saves use atomic revision checks. A concurrent change preserves tab edits and asks for explicit resolution; it is not silently overwritten.
- Import accepts Mint Goals JSON schema versions **1 and 2**. Export/import behavior is unchanged from the hosted app. Import merges with fresh IDs and explicit confirmation; it does not restore a server revision or overwrite another account.
- To move from a different Site or the offline edition, export a backup there, then import it into your own new Site. New Sites have separate identity scopes and databases; data is not automatically transferred.
- Unsaved edits are in memory. If a network save fails, export a backup before closing the tab. This edition is not an offline-first client.

## Developer checks

Use Node.js **22.13.0 or later**. In a Sites-enabled conversation, follow the installed Sites skill for template setup, dependency installation, checks, and builds. Its helpers select the appropriate local or managed execution profile.

After installation, from this folder:

```sh
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

The tests cover the model and import validation, progress and completion, forms, owner isolation, persistent SQLite, and real local Miniflare D1 persistence and revision conflicts. They do not verify a live account or multiple physical devices.

`npm run dev` is a development preview, not a deployment. The portable profile's loopback-only mock sign-in is only for local development and is absent from production; it is not a real ChatGPT account. Local preview D1 is separate from hosted D1. Use the installed Sites skill's local migration guidance if you need preview data. `npm start` previews the built Worker locally; neither it nor `npm run build` supplies production Sites identity/authentication on an arbitrary host.

## Source map

- `public/`: authored interface and browser model.
- `app/`, `worker/`: Vinext routes, Sites authentication, and Worker entrypoint.
- `lib/goal-store.mjs`: validation and owner-scoped D1 storage.
- `db/`, `drizzle/`: schema and schema-only migrations.
- `scripts/`, `vite.config.ts`: retained framework/Sites build and preview integration.
- `tests/`: automated checks; all sample records are synthetic fixtures.

Keep local `.env*`, `.dev.vars*`, `.sites-runtime/`, `.wrangler/`, dependencies, generated builds, exports, and personal backup files out of source control. Preserve the bundled third-party license notices.

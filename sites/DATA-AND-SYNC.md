# Mint Goals data and sync

The online edition saves a separate notebook for each signed-in account. It currently uses **notebook schema 4**, imports backup versions **1–4**, and exports **version 4**. The simpler offline edition remains on schema 3, imports versions 1–3, and exports version 3. Offline backups can be imported online; current online backups cannot be imported offline.

## What is saved where

| Data | Storage | Included in notebook backup? |
| --- | --- | --- |
| Goals, steps, substeps, categories, reflection answers, completion records | The signed-in account's notebook in this Site's D1 database | Yes |
| Selected category, focus, goal order, open or closed focus sections | Browser local storage, per account and category | No |
| Unsaved changes and invalid answer drafts | The current open tab | Export includes current notebook edits and reflection drafts |

The online app needs a connection to load and save its notebook. A failed save does not become saved merely because the text remains visible. The client preserves unsaved edits for export and asks for explicit resolution of a conflict. Exports do not include a new goal or step that has not been submitted through its form.

## One goal at a time

In **In progress**, selecting **Focus on this** or enabling **One goal at a time** keeps one active goal expanded. **Other goals** lists the remaining active goals and lets the user change focus or move goals up and down. The chosen order determines the next suggested goal.

Completing the current goal shows a pause with **Open next goal** when another active goal exists. The app waits for the user to choose. Archiving or removing the focused goal also does not silently select a replacement. Completed goals remain in their own expandable section.

The selected category, focused ID, order, and focus-section disclosure states use `mint-goals-focus-v1:<ownerScope>` in local storage. Each category, including All categories and Uncategorized, has independent preferences within the account. These preferences contain IDs and display settings, not a second copy of the notebook. They are not synced or backed up. Invalid saved values fall back to safe defaults. If browser storage fails, the view continues in memory and shows a notice that it lasts for this visit.

## Authentication and account changes

`app/api/state/route.ts` obtains the Sites-authenticated identity. The stable Site-scoped user ID is the D1 owner key; email is not the key. Requests without an authenticated identity receive HTTP 401. The source includes no production authentication bypass.

`ownerScope` is an opaque SHA-256 digest of an app-specific prefix and the authenticated owner ID. It is an account-match guard, not an authentication credential. The frontend holds it in memory and also uses it to namespace local view preferences; notebook backups exclude it.

Before writing, the server compares the submitted scope with the current authenticated account. A mismatch or an older client without a scope receives HTTP 409 without another account's state. Background refresh also checks the scope before replacing displayed goals. This prevents an account switch in another tab from copying one account's loaded notebook into another account at the same revision.

## Saves and revisions

`GET /api/state` returns `{state, version, ownerScope}`. An empty notebook returns `{state:null, version:0, ownerScope}`. `PUT /api/state` accepts `{state, version, ownerScope}`, where the outer `version` is the last server revision. The notebook's own `state.version` is its schema version, currently 4; these two numbers have different purposes.

A successful save increments the server revision. A single conditional SQL insert or update prevents two writes from replacing the same revision. A revision conflict returns HTTP 409 with the latest saved state and revision. The client must keep the tab's unsaved edits and require an explicit choice before replacing them. It must not retry a conflicting snapshot automatically with the new revision. A newer saved schema also cannot be overwritten by an older client.

Background refresh runs when the window regains focus or becomes visible and periodically while visible. It applies a newer revision only when there are no pending saves, blocked saves, open editor, reflection draft, or active input that needs preserving.

## Validation and limits

The server validates up to 200 goals, 200 steps per goal, 200 substeps per step, and 50 categories. It checks field lengths, category references, unique IDs, valid dates, completion consistency, and allowed fields. The frontend notebook limit is **1,990,000 UTF-8 bytes**; the server request ceiling is **2,000,000 bytes**. Field limits do not guarantee enough room to fill every field to its maximum.

PUT requires JSON and rejects a supplied Origin that differs from the request origin. Responses disable caching. Validation is performed again on the server, even when the browser has already checked the data.

## Reflection answers — introduced in schema 3

Each goal may have `reflection` with five optional plain-text keys: `why`, `explore`, `learn`, `create`, and `apply`. Each answer allows 2,000 characters. Optional `customQuestions` contains up to 100 `{id, question, answer}` entries, with 300 characters per question and 2,000 per answer. Blank answers and blank custom pairs are valid. Missing fields in older backups normalize to empty values.

The **Why this goal?** panel uses directly editable textareas. Changes are saved automatically after a short delay; there is no separate Edit or Save answers button in the current source. The panel shows save status, character counts, and field feedback. Closing the panel does not clear the answers, and typing does not rebuild the active textarea.

Overlong or over-budget answer drafts stay in memory and are included when the user exports. They do not replace the valid saved goal. The user can shorten the draft to recover; an exported backup containing over-limit text also needs shortening before it can be imported. Hiding the panel or closing the tab must not be treated as confirmation that a draft was saved.

Reflection data was introduced in schema 3 and remains part of schema 4. It is stored within the existing notebook JSON; adding these fields did not require a database table migration.

## Substeps — introduced in schema 4

A step can contain up to 200 ordered substeps. Each has an ID, text of up to 300 characters, and a completion flag. A step with substeps counts as complete only when all its substeps are checked. Checking or clearing the parent updates every substep. Older steps can omit `substeps`.

When importing into an empty notebook, the original goal, category, step, and substep IDs are preserved. Adding copies to a populated notebook creates fresh IDs for those records. Importing a file again can therefore create duplicates. Schema 4 preserves substeps in exported backups; the offline schema 3 importer does not accept these backups.

## Implementation and checks

`db/schema.ts` defines the table. `drizzle/0000_funny_maggott.sql` and `drizzle/meta/` contain schema-only migration data. `lib/goal-store.mjs` implements validation, account-specific storage, and HTTP behavior. The template's `.openai/hosting.json` declares the `DB` binding without a deployed `project_id`; a newly registered deployment gets its own identity through the Sites workflow.

See [Development and checks](../docs/DEVELOPMENT.md) for current commands. Tests exercise persistent SQLite and local Miniflare D1, account isolation, concurrent saves, schema and backup validation, reflection drafts, substeps, and focus preferences. Local tests do not prove live multi-account or physical-device behavior.

The portable development preview has a loopback-only mock sign-in implemented by Vite middleware. It is absent from production. Its identity and local database are separate from real ChatGPT accounts and hosted data.

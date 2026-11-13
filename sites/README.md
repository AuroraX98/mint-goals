# Mint Goals — online source

The current app is ready to use at **[Mint Goals online](https://mint-goals.aurorax.chatgpt.site)**. Sign in with your own ChatGPT account; no deployment or installation is needed to use it. See the [main guide](../README.md) for goals, steps, substeps, **One goal at a time**, and backups.

This folder contains the source for the online edition. Each signed-in person has a separate notebook. A separate Site made from this template starts with its own empty data store.

## Create your own private Site

Use these instructions if you want to host a separate copy. Sites availability depends on your ChatGPT account.

1. Open a ChatGPT conversation with the **Sites** app available and provide this repository or the `sites/` folder.
2. Ask it to create a new private Site from this template:

   > Create a new private ChatGPT Site from the `sites/` template. Keep the existing design and behavior. Use Sites-managed ChatGPT authentication and a new D1 database bound as `DB`; R2 is unused. Use a fresh Site identity and database. Follow the installed Sites workflow to install dependencies, run the tests and TypeScript checks, build, and deploy. Keep it private and give me its URL after deployment succeeds.

3. The Sites workflow should create a fresh checkout from the sanitized template, register a new private Site, and store the newly returned `project_id` in that checkout's `.openai/hosting.json`. The template has no deployed identity. Keep `"d1": "DB"` and `"r2": null`.
4. Let the supported Sites workflow synchronize and publish the new Site, provision its database, and apply the included schema-only migrations. Keep the generated identity and runtime data in your own deployment checkout.
5. Open the returned URL, sign in, and create a disposable test goal. Reload and check it from a second device signed in with the same account, then remove the test goal.

A public source repository does not make the goals in a separate private deployment public. The shared online app, the offline edition, and each separately deployed Site have separate notebooks. To transfer goals, export a compatible backup from the old notebook and import it into the new one.

Copying `public/` onto a generic static host does not provide the authenticated saving service this app needs. Use the [offline edition](../README.md#download-the-offline-edition) for use without Sites.

## Saving and backups

Goals, steps, substeps, categories, reflection answers, and completion records save to the signed-in account on this Site. The app checks for saved changes from other devices when it can safely refresh. If two devices try to save over the same version, it keeps the unsaved edits in the tab and asks you to resolve the conflict. Export those edits before loading the saved version.

The selected category, current focus, goal order, and open or closed **Other goals** and **Completed goals** sections are browser preferences. They are separate for each account and category, and are neither synced nor included in a backup.

This edition imports backup versions **1–4** and exports **version 4**. **Restore to empty notebook** keeps the original IDs. **Add copies** creates new IDs and may duplicate goals already present. The offline edition imports versions **1–3** and exports **version 3**: its backups can move online, but current online backups cannot move offline.

Unsaved changes are held in the open tab. Check the save status and export if saving fails. An expired sign-in or account change does not authorize saving the loaded notebook into a different account. Read [Data and sync](DATA-AND-SYNC.md) for storage limits and the implementation.

## Development

Use Node.js **22.13.0 or later**. Follow [Development and checks](../docs/DEVELOPMENT.md) for installation, validation, and local preview. In a Sites-enabled conversation, use the currently installed Sites skill for its execution profile and publishing helpers.

| Source | Purpose |
| --- | --- |
| `public/` | Interface, browser model, and images |
| `app/`, `worker/` | Routes, authentication, and Worker entrypoint |
| `lib/goal-store.mjs` | Input validation and account-specific storage |
| `db/`, `drizzle/` | Database schema and schema-only migrations |
| `scripts/`, `vite.config.ts`, `tests/` | Build/preview support and automated checks |

Keep environment files, credentials, local runtime state, generated builds, exports, and personal backups out of source control. Preserve bundled third-party license notices.

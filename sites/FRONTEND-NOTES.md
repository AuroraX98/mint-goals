# Mint Goals frontend

For everyday use, start with the [main guide](../README.md). This document maps
the online app’s source and behavior for people changing the code.

## Interface files

- `public/index.html`, `styles.css`, `ui-improvements.css`, and
  `reflection-feedback.css` provide the page, responsive layout, and form feedback.
- `public/app.mjs` connects goals, steps, substeps, reflections, dialogs, and saving.
- `public/model.mjs` validates goals and backups. The current notebook version is 4.
- `public/focus-view.mjs` stores and reads per-category focus preferences.
- `public/step-options.mjs`, `filter-switch.mjs`, `surface-motion.mjs`, and
  `confetti.mjs` provide compact step controls and optional motion.

The online app supports goals, categories, steps and substeps, goal reflections,
completion and reopening, archiving and restoring, progress charts, and backups.
One goal at a time keeps a selected goal visible while the rest sit in Other
goals. Completing it waits for an explicit Open next goal action. Focus choices
and order are browser preferences; they do not change goal status.

User text is inserted as text, not HTML. Icons come from the bundled SVG dictionary.
Light and dark appearances use shared CSS variables. Motion respects the device’s
reduced-motion setting.

## Saving and refresh

`GET /api/state` returns `{state, version, ownerScope}`. `PUT /api/state` sends the
same fields; `version` is the server revision, separate from the notebook schema.
The account scope prevents a tab from saving one account’s goals into another.
Revision conflicts preserve unsaved edits and require an explicit reload or retry.
See [Data and sync](DATA-AND-SYNC.md) for the complete storage contract.

Reflection answers save automatically after typing pauses. Oversized answer drafts
stay available for editing and export; hiding a panel does not discard them.
Step drafts also survive rendering and focus switches within the current tab.
These drafts are not durable offline storage.

Focus, selected category, queue order, collapsed goal sections, and appearance
stay in this browser. They are separate from the account’s notebook and backups.
Automatic server refresh runs on focus/visibility and at 30-second intervals while
the page is visible, with guards for pending edits, open dialogs, and active inputs.

## Behavior and checks

Marking a goal complete with unchecked steps requires confirmation and preserves
the step history. Reopening clears its current completion date. Archiving retains
the goal and its storage use. Categories can be created and renamed.

Run the checks in the [Sites setup guide](README.md#development). Tests cover
the model, form handlers, focus persistence, substeps, backup validation, progress,
reflection drafts, account isolation, and database revision conflicts. Local
browser checks have exercised focus, order, category selection, completion, and
reload persistence. This does not establish behavior on every browser or device.

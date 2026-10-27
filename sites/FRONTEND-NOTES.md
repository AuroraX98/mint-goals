# Mint Goals frontend

Source: `public/index.html`, `public/styles.css`, `public/app.mjs`, `public/model.mjs`, `public/icons.mjs`.

Approved light mint palette: background `#B5E4D0`, cards `#EAF7F0`, evergreen `#163B31`, lavender accent. No external font or asset requests.

Features: empty-by-default goals with optional example; title/description editing; goal icons (32 categorized SVG choices); custom category creation/renaming/filtering; steps with emoji picker/custom device emoji entry, editing, reordering and completion; counts/progress; completed/reopen; recoverable archive/restore; JSON export/import (merge, fresh IDs, explicit confirmation).

Persistence: uses authenticated server API, never claims localStorage/cloud sync without server load. GET `/api/state` reads `{state,version}`; PUT posts serialized `{state,version}` snapshots. A conflict preserves tab edits, offers export and explicit destructive-to-tab reload (no blind overwrite). Offline failures retain edits and warn before unload. Clean-state focus/visibility refresh and 30-second refresh avoid open dialogs and typed new-step inputs. These are browser refresh intervals, not background jobs.

Validation: 200 goals, 200 tasks per goal, 50 categories; bounded strings and imported dates; state payload cap below API max, invalid/oversized import rejected before mutation. Text is rendered via `textContent`; SVG markup comes only from a fixed internal icon dictionary. No user HTML.

Checks: `node --test tests/model.test.mjs` (10 tests); `node --check public/app.mjs`; backend team owns TypeScript/build/API/D1 checks. No browser-driven visual/accessibility test was performed by frontend author; browser tooling unavailable. Native dialogs, semantic labels, focus styles, keyboard buttons, mobile CSS and reduced motion are implemented but not yet verified in a real browser.

Known behavior: marking a goal complete does not silently check unfinished steps; confirms this first. Categories can be created/renamed, not deleted. Archives retain storage capacity. Unsaved edits are in memory (not durable offline); export backup before closing if save fails. Concurrent changes are safely detected rather than automatically merged. Use the same authenticated identity on both devices.

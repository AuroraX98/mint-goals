# Progress data contract

State version 2 adds nullable `completedAt` (canonical UTC ISO instant) and
`completionDate` (manual YYYY-MM-DD calendar date) to each goal. The existing
D1 table stores a JSON document, so no destructive SQL/table migration is needed.

The current online client accepts notebook versions 1–4 and exports version 4.
It copies legacy goals and sets missing date fields to null. Reading does not
write an upgraded notebook; the next authorized edit saves the current format
with the existing account and server-revision checks. The server rejects invalid
or inconsistent dates and refuses older-schema writes after an account has saved
a newer schema. This prevents older tabs from dropping dates, reflections, or
substeps. Export unsaved edits before reloading an older tab.

Only currently completed goals count (including archived goals whose previous status
is completed). Reopening clears both date fields; completing again records the new
instant. Each goal contributes at most one latest completion, not a lifetime event
log. Existing completion times are never inferred from task checks, revision times,
or creation dates. Optional manual historical dates are explicitly marked and never
used to calculate elapsed duration.

Weekly charts use the viewer's IANA timezone and Monday week starts, last 8 weeks;
monthly charts use last 12 calendar months. The timeline and typical duration cover
all currently completed goals matching the category, not only the chart window.
Typical duration is the median exact elapsed days between creation and latest
recorded completion, not work hours; unknown and manual dates are excluded.

QA: node --test tests/*.test.mjs. Tests use isolated local SQLite/Miniflare only.
No production records are created or altered by tests.

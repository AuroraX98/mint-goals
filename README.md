# Mint Goals

Mint Goals helps you turn a goal into small steps, work on one thing at a time, and see your progress.

**[Open Mint Goals online](https://mint-goals.aurorax.chatgpt.site)** and choose **Sign in with ChatGPT**. No download or setup is needed. Use your own account; each person has a separate notebook. The online app needs an internet connection.

![Mint Goals cover illustration with a frosted glass checklist, a progress ring, and a fresh mint sprig](sites/public/mint-goals-cover.jpg)

## Create your first goal

1. Choose **New goal**, give it a name, and add any first steps you already know.
2. Choose **Create goal**. You can add a description, category, or icon whenever you want.
3. Add more steps in **Add a small next step…**. Check a step when you finish it.

For example, your goal could be “Read a book,” with a step called “Read chapter one.” If a step still feels too big, open **Substeps**, choose **Add substeps**, and write one smaller action per line.

A step with substeps becomes complete when all its substeps are checked. Checking or clearing that whole step changes all its substeps too. The progress ring counts finished steps. Choose **Mark complete** when the goal itself is finished; checking every step does not finish the goal automatically.

Use the three-dot options button beside a step for **Edit step**, **Move up**, or **Move down**. Use **Edit goal** to change the goal's name, description, category, or icon.

## Work on one goal at a time

1. In **In progress**, choose a category if you want to narrow the list.
2. Choose **Focus on this** on a goal, or turn on **One goal at a time**.
3. Open **Other goals** to choose a different goal or move goals up and down to set what comes next.

When you complete the current goal, the app pauses. Choose **Open next goal** when you are ready. Completed goals stay available below, and turning off **One goal at a time** shows the usual list again.

Your chosen category, focused goal, goal order, and whether **Other goals** and **Completed goals** are open are remembered in this browser, separately for each account and category. These view choices do not sync to another device and are not included in backups.

## Remember why it matters

Open **Why this goal?** to write about why the goal matters, what you are curious about, or what you hope to learn or create. There are five optional questions, and **Add a custom question** lets you add your own.

Type directly into an answer to edit it. Answers save automatically; check the save message beside them before closing the page. You can leave every answer blank and still create, work on, or complete the goal. The app does not generate or assess your answers.

## See what you have done

Open **Progress** for weekly or monthly completion charts and your completed-goal timeline. You can filter by category or view the chart as a table. **Completed** and **Archived** keep finished or set-aside goals accessible, with options to reopen or restore them.

Each goal counts once, at its latest completion. Reopening it removes that completion from the chart. Older goals with no recorded completion date stay marked as unknown; you can add a date you know. “Typical elapsed time” measures calendar days from creation to completion, not hours worked, and excludes manually entered dates.

## Online or offline?

| | Online app | Offline edition |
| --- | --- | --- |
| Start | [Open and sign in](https://mint-goals.aurorax.chatgpt.site) | Download and open `offline/index.html` |
| Saved goals | Your account on this Site; available on your other signed-in devices | This browser and device only |
| Internet | Required | Not needed after download |
| Features | Current interface, substeps, and **One goal at a time** | Simpler interface with goals, steps, categories, reflections, and progress charts |
| Backups | Imports versions 1–4; exports version 4 | Imports versions 1–3; exports version 3 |

**Offline backups can be imported into the online app. Current online backups cannot be imported into the offline edition**, even if you have not added substeps. The two editions keep separate notebooks.

### Download the offline edition

1. On GitHub, choose **Code → Download ZIP**, then extract the download.
2. Open `offline/index.html` in a desktop browser.
3. Use **Export backup** regularly and keep the downloaded backup somewhere safe.

The offline app needs no account, installation, or internet connection after download. It makes no network requests. Your goals are saved in browser storage, not inside the HTML file. Clearing browser data, private browsing, changing browser profiles, or moving the HTML file can lose access to those goals. Use one editing tab at a time. Anyone with access to that browser profile may be able to read them.

If opening the file directly cannot save, the [local server instructions](docs/DEVELOPMENT.md#open-the-offline-edition-with-a-local-server) provide another way to run it on your computer.

## Save and back up your goals

The online app saves changes automatically. Wait for **All changes saved** before closing it. If saving fails or another device has changed the notebook, keep the tab open and use **Export your edits** before reloading or loading the saved version. Unsaved edits remain only in that tab. If sign-in expires, export first, use the offered sign-in link, then return to the original tab and retry saving with the same account.

For a normal backup, open **Backups → Export backup**. The downloaded JSON file contains your goal text, steps, substeps where supported, categories, reflection answers, and completion records. Keep it in a private folder.

To bring a supported backup into the online app:

1. Choose **Backups → Import backup** and select the file.
2. Review the counts shown before continuing.
3. Choose **Restore to empty notebook** if the notebook is empty, or **Add copies** if it already contains goals or categories.

Restoring to an empty notebook keeps the original records' IDs. Adding copies keeps your existing goals and creates new copies, so importing the same file twice creates duplicates. The offline edition calls this **Add to my goals**.

## For developers

The [`sites/` guide](sites/README.md) explains how to deploy a separate private Site from this source. [Development and checks](docs/DEVELOPMENT.md) covers local work, and [Data and sync](sites/DATA-AND-SYNC.md) explains the saved format and account protections.

No license has been selected. Existing third-party notices in the Sites source still apply.

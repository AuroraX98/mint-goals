# Mint Goals development and checks

The [main guide](../README.md) is for using the app. This page covers local source work. Use Node.js **22.13.0 or later** for the Sites edition; Node 22+ is sufficient for the offline build and tests.

## Online edition

In a Sites-enabled conversation, follow the currently installed Sites skill. Its helpers select the appropriate execution profile, install locked dependencies, build, and publish. Use the helper paths from that installed version rather than a path copied from another computer.

For local source work, run these commands from `sites/`:

```sh
npm run install:ci
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

`npm run dev` starts a development preview. The portable profile includes a loopback-only mock sign-in for local testing; it is not a real ChatGPT identity and is absent from production. Local preview D1 is separate from hosted D1. Follow the installed Sites skill for local database migrations and preview setup.

`npm start` previews the built Worker locally. Building or running a local preview does not deploy the app or supply production Sites authentication on an arbitrary host. To create a separate private deployment, follow the [Sites template guide](../sites/README.md).

Automated checks cover model and backup validation, progress and completion, forms, reflections, substeps, focus preferences, account isolation, and persistent storage. The SQLite and Miniflare D1 tests exercise concurrent revision conflicts and persistence across reopening. They do not establish that a live account or two physical devices have been tested.

From the repository root, also run the backup compatibility checks:

```sh
node --test tests/*.test.mjs
```

These check that older backups retain their data online and that the older offline edition rejects newer online backups safely.

## Offline edition

The authored source is in `offline/src`. From the repository root:

```sh
cd offline
npm test
npm run build
```

The offline edition needs no npm packages. Its build regenerates the self-contained `offline/index.html`, including its JavaScript, styles, and icons. The HTML makes no API calls and uses no remote fonts, analytics, or CDN assets. Its Content Security Policy blocks network connections.

### Open the offline edition with a local server

If direct-file browser storage is unavailable, open a terminal in the downloaded repository's `offline` folder. With Python 3 installed, run:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

On Windows, use `py -m http.server 8080 --bind 127.0.0.1`. Open `http://127.0.0.1:8080/` in your browser. Keep the terminal running while opening or reloading the page; press Ctrl+C to stop the server. This serves local files and needs no internet connection.

Always return with the same browser profile and address, including the port. A different file location, browser, or server address may have a different saved notebook. Export from the old location before moving whenever possible. The HTML file itself is not a backup of saved goals.

Direct `file://` storage and mobile file-opening behavior vary by browser. An earlier isolated Chromium check exercised creation, step completion, and goal completion after the local server was stopped, with network connections blocked by the page's policy. That check did not cover direct file URLs or all mobile browsers.

## Repository hygiene

Keep `.env*`, `.dev.vars*`, credentials, personal backups, `.sites-runtime/`, `.wrangler/`, dependencies, and generated builds out of source control. A deployed checkout gets a new Site identity; the reusable `sites/.openai/hosting.json` template must remain free of deployed project IDs. Tests should use synthetic data.

Preserve the bundled third-party license notices. No project license has been selected.

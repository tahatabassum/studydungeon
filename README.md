


## Frontend

### Layout check

`npm run layout:check` (in `frontend/`) opens the fit screens in a local headless Chrome or Edge at desktop and phone sizes and fails on page scrollbars, nested scrollbars and clipped text. It starts the Vite dev server in mock mode itself and stops only what it started. No dependency is added.

- `LAYOUT_BROWSER`: path to the browser executable. Without it the script tries Chrome, then Edge, in the default Windows, macOS and Linux locations.
- `LAYOUT_URL`: use a running server instead of starting Vite.
- `-- --routes /upload,/leaderboard`, `-- --sizes 1366x768,360x740`, `-- --screenshots .layout-shots/run1` (PNG per route and size; the folder is gitignored).
- Exit code 1 on any failure.

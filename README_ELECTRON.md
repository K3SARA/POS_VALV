# POS Desktop (Electron + Auto Updates)

This setup builds a Windows `.exe` and publishes updates via GitHub Releases.

## 1) One-time setup
1. Update `package.json`:
   - Set `repository.url` to your GitHub repo.
2. Create a GitHub Personal Access Token with `repo` scope.
   - Set it as an environment variable:

   `setx GH_TOKEN "your_token_here"`

## 2) Build the desktop app
From the project root:

```
npm install
npm run dist
```

The installer will be in the `dist/` folder.

## 3) Publish a new update
1. Bump the version in `package.json`.
2. Run:

```
npm run dist
```

electron-builder will upload the release to GitHub automatically.

## Notes
- The app auto-starts the backend on launch.
- The app uses a local SQLite database stored in the user's app data folder.

## One-click (offline) run
Build a portable EXE:

```
npm run dist
```

Then give your friend:
- `dist\\POS Desktop.exe`
- `start_pos.bat`

Your friend double-clicks `start_pos.bat`. It will launch the app.

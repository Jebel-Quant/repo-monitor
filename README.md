# repo-monitor

A desktop application for monitoring GitHub repositories, built with Electron and React.

## Features

- **Repository Dashboard** - View all your repos at a glance with:
  - GitHub Actions workflow status (success/failure/pending/cancelled)
  - Current branch indicator (highlighted when not on main)
  - Stats: branch count, open issues, open PRs, code coverage
  - CodeFactor code quality grades
  - Recent commits with timestamps
  - Quick links to GitHub Pages

- **Dependency Dashboard** - Manage Renovate dependency updates:
  - View pending dependency approvals across all repos
  - Bulk approve/merge updates via Renovate checkboxes
  - Real-time status updates after approval

- **Command Line** - Execute commands across multiple repositories:
  - Terminal-like interface for running shell commands
  - Commands execute in each repository directory
  - Progress tracking with streaming results
  - Command history with arrow key navigation

## Installation

```bash
npm install
```

## Usage

### Development

```bash
npm run dev
```

Runs the Vite dev server and Electron app with hot reload.

### Build

```bash
npm run build
```

Builds the React app to the `/dist` folder.

### Package

```bash
npm run package       # Cross-platform
npm run package:mac   # macOS DMG
```

## Configuration

Configuration is stored in `config.json` (checked in order: `~/.repo-monitor/config.json`, Electron app data, or project root).

```json
{
  "githubToken": "",
  "refreshInterval": 60,
  "repos": [
    { "owner": "username", "repo": "repo-name" }
  ],
  "reposBasePath": ""
}
```

| Field | Description |
|-------|-------------|
| `githubToken` | GitHub Personal Access Token with `repo` scope |
| `refreshInterval` | Auto-refresh interval in seconds (10-3600) |
| `repos` | Array of repositories to monitor |
| `reposBasePath` | Local directory where repos are cloned (for command line tab) |

Create a token at: https://github.com/settings/tokens

## Project Structure

```
repo-monitor/
├── src/
│   ├── components/
│   │   ├── DependencyDashboard.jsx
│   │   ├── RepoCard.jsx
│   │   └── StatusBadge.jsx
│   ├── hooks/
│   │   └── useGitHubStatus.js
│   ├── App.jsx
│   ├── config.js
│   ├── main.jsx
│   └── styles.css
├── electron/
│   ├── main.js
│   └── preload.js
├── config.json
├── index.html
├── package.json
└── vite.config.js
```

## Tech Stack

- **Electron** - Desktop application framework
- **React 19** - UI library
- **Vite** - Frontend bundler

## License

MIT

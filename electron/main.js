const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e'
  });

  // Load Vite dev server in development, built files in production
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Load config from various locations
function loadConfig() {
  const configPaths = [
    path.join(app.getPath('home'), '.repo-monitor', 'config.json'),
    path.join(app.getPath('userData'), 'config.json'),
    path.join(__dirname, '../config.json')
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(data);
        console.log('Loaded config from:', configPath);
        return { config, path: configPath };
      }
    } catch (err) {
      console.error(`Error reading config from ${configPath}:`, err.message);
    }
  }

  // Return default config if none found
  return {
    config: {
      githubToken: '',
      refreshInterval: 60,
      repos: []
    },
    path: null
  };
}

// IPC handlers
ipcMain.handle('get-config', () => {
  return loadConfig();
});

ipcMain.handle('save-config', (event, configData) => {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
    return { success: true, path: configPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

// Execute a command in a specific directory using login shell
function executeCommand(command, cwd) {
  return new Promise((resolve) => {
    // Use login shell to load user's full environment (PATH, virtualenvs, etc.)
    const shell = process.env.SHELL || '/bin/zsh';
    // Escape single quotes in the command
    const escapedCommand = command.replace(/'/g, "'\\''");
    const wrappedCommand = `${shell} -l -c '${escapedCommand}'`;

    exec(wrappedCommand, { cwd, timeout: 60000 }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout || '',
        stderr: stderr || '',
        error: error ? error.message : null
      });
    });
  });
}

// Get git info for a single repo
async function getGitInfo(repoPath, owner, repo) {
  if (!repoPath || !fs.existsSync(repoPath)) {
    return { error: 'Directory not found' };
  }

  // Fetch latest from remote
  await executeCommand('git fetch --all --prune', repoPath);

  // Get current branch
  const branchResult = await executeCommand('git rev-parse --abbrev-ref HEAD', repoPath);
  const currentBranch = branchResult.success ? branchResult.stdout.trim() : null;

  // Get total branch count using git branch --list
  const totalResult = await executeCommand('git branch --list | wc -l', repoPath);
  const totalBranches = totalResult.success ? parseInt(totalResult.stdout.trim(), 10) : null;

  // Get active branches (commits in last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const activeCmd = `git branch --list --format='%(refname:short)' | while read branch; do
    last_commit=$(git log -1 --format='%ci' "$branch" 2>/dev/null | cut -d' ' -f1)
    if [[ "$last_commit" > "${thirtyDaysAgo}" ]]; then echo "$branch"; fi
  done | wc -l`;
  const activeResult = await executeCommand(activeCmd, repoPath);
  const activeBranches = activeResult.success ? parseInt(activeResult.stdout.trim(), 10) : null;

  return {
    currentBranch,
    totalBranches,
    activeBranches
  };
}

// Get git info for all repos
ipcMain.handle('get-git-info', async (event, { basePath, repos }) => {
  const results = {};

  if (!basePath) {
    return results;
  }

  for (const { owner, repo } of repos) {
    const repoPath = path.join(basePath, repo);
    const key = `${owner}/${repo}`;

    try {
      results[key] = await getGitInfo(repoPath, owner, repo);
    } catch (err) {
      results[key] = { error: err.message };
    }
  }

  return results;
});

// Execute command in all repo directories (batch mode - waits for all)
ipcMain.handle('execute-command', async (event, { command, basePath, repos }) => {
  const results = {};

  for (const { owner, repo } of repos) {
    const repoPath = path.join(basePath, repo);
    const key = `${owner}/${repo}`;

    // Check if directory exists
    if (!fs.existsSync(repoPath)) {
      results[key] = {
        success: false,
        stdout: '',
        stderr: '',
        error: `Directory not found: ${repoPath}`
      };
      continue;
    }

    results[key] = await executeCommand(command, repoPath);
  }

  return results;
});

// Execute command with progress updates (streams results as each repo completes)
ipcMain.handle('execute-command-streaming', async (event, { command, basePath, repos }) => {
  const results = {};

  for (let i = 0; i < repos.length; i++) {
    const { owner, repo } = repos[i];
    const repoPath = path.join(basePath, repo);
    const key = `${owner}/${repo}`;

    // Send progress update
    mainWindow.webContents.send('command-progress', {
      current: i + 1,
      total: repos.length,
      repo: key,
      status: 'running'
    });

    // Check if directory exists
    if (!fs.existsSync(repoPath)) {
      results[key] = {
        success: false,
        stdout: '',
        stderr: '',
        error: `Directory not found: ${repoPath}`
      };
    } else {
      results[key] = await executeCommand(command, repoPath);
    }

    // Send result for this repo
    mainWindow.webContents.send('command-result', {
      repo: key,
      result: results[key]
    });
  }

  // Send completion
  mainWindow.webContents.send('command-progress', {
    current: repos.length,
    total: repos.length,
    status: 'complete'
  });

  return results;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Config utilities for loading and validating configuration

export async function loadConfig() {
  if (window.electronAPI) {
    const result = await window.electronAPI.getConfig();
    return result.config;
  }

  // Fallback for browser testing
  return {
    githubToken: '',
    refreshInterval: 60,
    repos: []
  };
}

export async function saveConfig(config) {
  if (window.electronAPI) {
    return await window.electronAPI.saveConfig(config);
  }
  return { success: false, error: 'Not running in Electron' };
}

export function validateConfig(config) {
  const errors = [];

  if (!config.githubToken) {
    errors.push('GitHub token is required');
  }

  if (!config.repos || !Array.isArray(config.repos)) {
    errors.push('Repos must be an array');
  } else {
    config.repos.forEach((repo, index) => {
      if (!repo.owner || !repo.repo) {
        errors.push(`Repo at index ${index} must have owner and repo fields`);
      }
    });
  }

  if (config.refreshInterval && (config.refreshInterval < 10 || config.refreshInterval > 3600)) {
    errors.push('Refresh interval must be between 10 and 3600 seconds');
  }

  return errors;
}

export function parseReposInput(input) {
  // Parse repos from text input (one per line: owner/repo)
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.includes('/'))
    .map(line => {
      const [owner, repo] = line.split('/');
      return { owner: owner.trim(), repo: repo.trim() };
    });
}

export function formatReposForDisplay(repos) {
  return repos.map(r => `${r.owner}/${r.repo}`).join('\n');
}

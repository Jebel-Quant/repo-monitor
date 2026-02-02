import React, { useState, useEffect } from 'react';
import RepoCard from './components/RepoCard';
import DependencyDashboard from './components/DependencyDashboard';
import { useGitHubStatus, formatTimeAgo } from './hooks/useGitHubStatus';
import { loadConfig, saveConfig, parseReposInput, formatReposForDisplay, validateConfig } from './config';

// Settings Icon
const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

// Loading spinner
const LoadingSpinner = () => (
  <svg className="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
    <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"></path>
  </svg>
);

// Terminal Icon
const TerminalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"></polyline>
    <line x1="12" y1="19" x2="20" y2="19"></line>
  </svg>
);

// Command Line Component (full page version)
function CommandLineTab({ config, repos }) {
  const [command, setCommand] = useState('');
  const [results, setResults] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [history, setHistory] = useState(() => {
    // Load history from localStorage
    try {
      const saved = localStorage.getItem('repo-monitor-cmd-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Save history to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('repo-monitor-cmd-history', JSON.stringify(history.slice(-50))); // Keep last 50
    } catch {
      // localStorage not available
    }
  }, [history]);

  useEffect(() => {
    if (!window.electronAPI?.onCommandProgress) return;

    // Listen for progress updates
    const unsubProgress = window.electronAPI.onCommandProgress((data) => {
      setProgress(data);
    });

    // Listen for individual repo results
    const unsubResult = window.electronAPI.onCommandResult((data) => {
      setResults(prev => ({
        ...prev,
        [data.repo]: data.result
      }));
    });

    return () => {
      unsubProgress();
      unsubResult();
    };
  }, []);

  const handleExecute = async () => {
    if (!command.trim() || !config?.reposBasePath) return;

    // Add to history (avoid duplicates at the end)
    const trimmedCmd = command.trim();
    setHistory(prev => {
      const filtered = prev.filter(c => c !== trimmedCmd);
      return [...filtered, trimmedCmd];
    });
    setHistoryIndex(-1);

    setExecuting(true);
    setResults({});
    setProgress({ current: 0, total: repos.length, status: 'starting' });

    try {
      // Use streaming API if available
      if (window.electronAPI?.executeCommandStreaming) {
        await window.electronAPI.executeCommandStreaming(
          command,
          config.reposBasePath,
          repos
        );
      } else {
        const res = await window.electronAPI.executeCommand(
          command,
          config.reposBasePath,
          repos
        );
        setResults(res);
      }
    } catch (err) {
      setResults({ _error: err.message });
    } finally {
      setExecuting(false);
      setProgress(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setCommand(history[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) {
        setHistoryIndex(-1);
        setCommand('');
      } else {
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      }
    }
  };

  const clearResults = () => {
    setResults(null);
  };

  if (!config?.reposBasePath) {
    return (
      <div className="tab-content-empty">
        <TerminalIcon />
        <p>Configure "Repos Base Path" in settings to use the command line.</p>
      </div>
    );
  }

  return (
    <div className="command-line-tab">
      <div className="command-input-row">
        <span className="command-prompt">$</span>
        <input
          type="text"
          className="command-input"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command... (↑↓ for history)"
          disabled={executing}
        />
        <button
          className="btn btn-primary command-run-btn"
          onClick={handleExecute}
          disabled={executing || !command.trim()}
        >
          {executing ? 'Running...' : 'Run'}
        </button>
      </div>

      {progress && progress.status !== 'complete' && (
        <div className="command-progress">
          <div className="command-progress-bar">
            <div
              className="command-progress-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <div className="command-progress-text">
            {progress.status === 'running' ? (
              <>Running on <strong>{progress.repo}</strong> ({progress.current}/{progress.total})</>
            ) : (
              <>Starting...</>
            )}
          </div>
        </div>
      )}

      {results && Object.keys(results).length > 0 && (
        <div className="command-results">
          <div className="command-results-header">
            <span>Results ({Object.keys(results).filter(k => k !== '_error').length}/{repos.length})</span>
            <button className="btn btn-secondary btn-small" onClick={clearResults}>
              Clear
            </button>
          </div>
          {results._error ? (
            <div className="command-result error">
              <div className="command-result-error">{results._error}</div>
            </div>
          ) : (
            Object.entries(results).map(([repoKey, result]) => (
              <div key={repoKey} className={`command-result ${result.success ? 'success' : 'error'}`}>
                <div className="command-result-repo">
                  <span className={`command-result-status ${result.success ? 'success' : 'error'}`}>
                    {result.success ? '✓' : '✗'}
                  </span>
                  {repoKey}
                </div>
                {result.stdout && (
                  <pre className="command-result-output">{result.stdout}</pre>
                )}
                {result.stderr && (
                  <pre className="command-result-output stderr">{result.stderr}</pre>
                )}
                {result.error && (
                  <div className="command-result-error">{result.error}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ConfigForm({ config, onSave, onCancel }) {
  const [token, setToken] = useState(config?.githubToken || '');
  const [interval, setInterval] = useState(config?.refreshInterval || 60);
  const [reposText, setReposText] = useState(
    config?.repos ? formatReposForDisplay(config.repos) : ''
  );
  const [basePath, setBasePath] = useState(config?.reposBasePath || '');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const newConfig = {
      githubToken: token,
      refreshInterval: parseInt(interval, 10),
      repos: parseReposInput(reposText),
      reposBasePath: basePath.trim()
    };

    const errors = validateConfig(newConfig);
    if (errors.length > 0) {
      setError(errors.join(', '));
      return;
    }

    const result = await saveConfig(newConfig);
    if (result.success) {
      onSave(newConfig);
    } else {
      setError(result.error || 'Failed to save config');
    }
  };

  return (
    <form className="config-form" onSubmit={handleSubmit}>
      <h2>Settings</h2>

      {error && (
        <div style={{ color: '#ff4757', marginBottom: '16px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <div className="form-group">
        <label>GitHub Token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_..."
        />
        <div style={{ fontSize: '0.75rem', color: '#a0a0a0', marginTop: '4px' }}>
          Create at github.com/settings/tokens (needs repo scope for private repos)
        </div>
      </div>

      <div className="form-group">
        <label>Refresh Interval (seconds)</label>
        <input
          type="number"
          min="10"
          max="3600"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Repositories (one per line: owner/repo)</label>
        <textarea
          value={reposText}
          onChange={(e) => setReposText(e.target.value)}
          placeholder="anthropics/claude-code&#10;facebook/react"
        />
      </div>

      <div className="form-group">
        <label>Repos Base Path (for command line)</label>
        <input
          type="text"
          value={basePath}
          onChange={(e) => setBasePath(e.target.value)}
          placeholder="/Users/you/code"
        />
        <div style={{ fontSize: '0.75rem', color: '#a0a0a0', marginTop: '4px' }}>
          Local directory where your repos are cloned (e.g., ~/code or /Users/you/repos)
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Save
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gitInfo, setGitInfo] = useState({});
  const [activeTab, setActiveTab] = useState('repos'); // 'repos', 'dependencies', 'command'

  const { repoStatuses, loading, error, lastUpdate, refresh } = useGitHubStatus(config);

  // Fetch local git info (current branch) for all repos
  const fetchGitInfo = async () => {
    if (!config?.reposBasePath || !config?.repos?.length) return;
    if (!window.electronAPI?.getGitInfo) return;

    try {
      const info = await window.electronAPI.getGitInfo(config.reposBasePath, config.repos);
      setGitInfo(info);
    } catch (err) {
      console.error('Failed to fetch git info:', err);
    }
  };

  useEffect(() => {
    fetchGitInfo();
  }, [config?.reposBasePath, config?.repos]);

  useEffect(() => {
    loadConfig().then((cfg) => {
      setConfig(cfg);
      setConfigLoaded(true);
      // Show settings if no repos configured
      if (!cfg.repos || cfg.repos.length === 0) {
        setShowSettings(true);
      }
    });
  }, []);

  const handleOpenUrl = (url) => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleConfigSave = (newConfig) => {
    setConfig(newConfig);
    setShowSettings(false);
  };

  if (!configLoaded) {
    return (
      <div className="app">
        <div className="loading-state">
          <LoadingSpinner />
          <div>Loading configuration...</div>
        </div>
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="app">
        <div className="loading-state">
          <ConfigForm
            config={config}
            onSave={handleConfigSave}
            onCancel={config?.repos?.length > 0 ? () => setShowSettings(false) : null}
          />
        </div>
      </div>
    );
  }

  const repos = config?.repos || [];

  return (
    <div className="app">
      <div className="header">
        <h1>Repo Monitor</h1>
        <div className="header-info">
          {lastUpdate && (
            <span>Updated {formatTimeAgo(lastUpdate.toISOString())}</span>
          )}
          <button
            className="refresh-btn"
            onClick={() => { refresh(); fetchGitInfo(); }}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            className="settings-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          color: '#ff4757',
          marginBottom: '16px',
          padding: '12px',
          background: 'rgba(255, 71, 87, 0.1)',
          borderRadius: '8px'
        }}>
          {error}
        </div>
      )}

      {repos.length === 0 ? (
        <div className="empty-state">
          <div>No repositories configured</div>
          <button
            className="btn btn-primary"
            onClick={() => setShowSettings(true)}
          >
            Add Repositories
          </button>
        </div>
      ) : (
        <>
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'repos' ? 'active' : ''}`}
              onClick={() => setActiveTab('repos')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              Repos
            </button>
            <button
              className={`tab ${activeTab === 'dependencies' ? 'active' : ''}`}
              onClick={() => setActiveTab('dependencies')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              Dependencies
            </button>
            <button
              className={`tab ${activeTab === 'command' ? 'active' : ''}`}
              onClick={() => setActiveTab('command')}
            >
              <TerminalIcon />
              Command Line
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'repos' && (
              <div className="repo-grid">
                {repos.map(({ owner, repo }) => (
                  <RepoCard
                    key={`${owner}/${repo}`}
                    owner={owner}
                    repo={repo}
                    data={repoStatuses[`${owner}/${repo}`]}
                    gitInfo={gitInfo[`${owner}/${repo}`]}
                    onOpenUrl={handleOpenUrl}
                  />
                ))}
              </div>
            )}
            {activeTab === 'dependencies' && (
              <DependencyDashboard repoStatuses={repoStatuses} config={config} onOpenUrl={handleOpenUrl} onRefresh={refresh} fullTab={true} />
            )}
            {activeTab === 'command' && (
              <CommandLineTab config={config} repos={repos} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

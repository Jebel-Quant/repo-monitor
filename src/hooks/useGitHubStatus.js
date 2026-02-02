import { useState, useEffect, useCallback, useRef } from 'react';

const GITHUB_API = 'https://api.github.com';

// Parse Pending Approvals section from Renovate Dependency Dashboard body
function parsePendingApprovals(body) {
  if (!body) return [];

  const approvals = [];

  // Look for "Awaiting Schedule" or "Rate-Limited" or "Pending Approval" sections
  // Renovate uses checkboxes like: - [ ] <!-- approve-branch=renovate/xxx -->dependency-name
  const lines = body.split('\n');
  let inPendingSection = false;
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for section headers
    const sectionMatch = line.match(/^##\s*(Pending Approval|Awaiting Schedule|Rate-Limited)/i);
    if (sectionMatch) {
      inPendingSection = true;
      currentSection = sectionMatch[1];
      continue;
    }
    // Exit section on new header
    if (line.match(/^##\s/) && inPendingSection) {
      inPendingSection = false;
      currentSection = '';
      continue;
    }

    // Parse unchecked items (pending)
    if (inPendingSection && line.match(/^\s*-\s*\[\s*\]/)) {
      // Extract the branch comment and dependency name
      const branchMatch = line.match(/<!--\s*(approve-branch|unschedule-branch|approve-all-pending-prs)=?([^>]*)\s*-->/);
      const nameMatch = line.match(/^\s*-\s*\[\s*\]\s*(?:<!--[^>]*-->)?\s*(.+)/);

      if (nameMatch) {
        approvals.push({
          name: nameMatch[1].trim(),
          lineIndex: i,
          originalLine: line,
          section: currentSection,
          actionType: branchMatch ? branchMatch[1] : null,
          branch: branchMatch ? branchMatch[2] : null,
          isApproveAll: branchMatch && branchMatch[1] === 'approve-all-pending-prs'
        });
      }
    }
  }

  return approvals;
}

// Update issue body to check a specific checkbox
export async function approveDepedencyUpdate(owner, repo, issueNumber, approval, token) {
  if (!token) throw new Error('GitHub token required');

  // First, get the current issue body
  const issueUrl = `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`
  };

  const getResponse = await fetch(issueUrl, { headers });
  if (!getResponse.ok) {
    throw new Error(`Failed to fetch issue: ${getResponse.status}`);
  }

  const issue = await getResponse.json();
  const body = issue.body;

  // Replace the unchecked box with a checked one for this specific line
  const lines = body.split('\n');
  if (approval.lineIndex < lines.length) {
    // Replace - [ ] with - [x]
    lines[approval.lineIndex] = lines[approval.lineIndex].replace(/^(\s*-\s*)\[\s*\]/, '$1[x]');
  }

  const newBody = lines.join('\n');

  // Update the issue
  const updateResponse = await fetch(issueUrl, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ body: newBody })
  });

  if (!updateResponse.ok) {
    const errorData = await updateResponse.json().catch(() => ({}));
    if (updateResponse.status === 403) {
      throw new Error('Token needs "repo" scope for write access. Update token at github.com/settings/tokens');
    }
    throw new Error(errorData.message || `Failed to update issue: ${updateResponse.status}`);
  }

  return true;
}

export function useGitHubStatus(config) {
  const [repoStatuses, setRepoStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);

  // Optimized: Single function to fetch all repo data with minimal API calls
  // Reduced from ~8 API calls per repo to ~5
  const fetchRepoData = useCallback(async (owner, repo, token) => {
    try {
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };

      // Batch 1: Essential data (4 GitHub API calls instead of 8+)
      // - issues includes PRs (no need for separate PR fetch)
      // - repo endpoint gives us branch count, pages info in one call
      const [issuesRes, repoRes, readmeRes] = await Promise.all([
        fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues?state=open&per_page=100`, { headers }),
        fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers }),
        fetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, { headers })
      ]);

      let openIssues = 0;
      let openPRs = 0;
      let branchCount = null;
      let pagesUrl = null;
      let readmeCoverage = null;
      let codeFactorGrade = null;
      let dependencyDashboard = null;
      let runs = [];

      // Parse repo data (includes default branch, has_pages, etc.)
      if (repoRes.ok) {
        const repoData = await repoRes.json();
        // Use open_issues_count which is faster than counting
        // Note: this includes PRs, we'll adjust below

        // Check if repo has pages
        if (repoData.has_pages) {
          pagesUrl = `https://${owner.toLowerCase()}.github.io/${repo}/`;

          // Try to fetch coverage badge JSON from pages (not a GitHub API call)
          try {
            const coverageUrl = `${pagesUrl}tests/coverage-badge.json`;
            const coverageRes = await fetch(coverageUrl);
            if (coverageRes.ok) {
              const coverageData = await coverageRes.json();
              if (coverageData.message) {
                const match = coverageData.message.match(/(\d+(?:\.\d+)?)/);
                if (match) {
                  readmeCoverage = parseFloat(match[1]);
                }
              }
            }
          } catch (e) {
            // Coverage fetch failed, not critical
          }
        }
      }

      // Parse README for CodeFactor badge
      if (readmeRes.ok) {
        try {
          const readmeData = await readmeRes.json();
          const readmeContent = atob(readmeData.content);

          const codeFactorMatch = readmeContent.match(/\[!\[CodeFactor\]\((https:\/\/www\.codefactor\.io\/[^)]+\/badge)\)\]\((https:\/\/www\.codefactor\.io\/[^)]+)\)/i);
          if (codeFactorMatch) {
            codeFactorGrade = {
              badgeUrl: codeFactorMatch[1],
              url: codeFactorMatch[2]
            };
          }
        } catch (e) {
          // README parse failed, not critical
        }
      }

      // Parse issues (includes PRs)
      if (issuesRes.ok) {
        const issues = await issuesRes.json();
        // Issues endpoint includes PRs - filter them
        const realIssues = issues.filter(i => !i.pull_request);
        const prs = issues.filter(i => i.pull_request);
        openIssues = realIssues.length;
        openPRs = prs.length;

        // Find Dependency Dashboard issue
        const depDashboard = realIssues.find(i => i.title.includes('Dependency Dashboard'));
        if (depDashboard) {
          const pendingApprovals = parsePendingApprovals(depDashboard.body);
          dependencyDashboard = {
            title: depDashboard.title,
            url: depDashboard.html_url,
            number: depDashboard.number,
            body: depDashboard.body,
            updatedAt: depDashboard.updated_at,
            pendingApprovals,
            owner,
            repo
          };
        }
      }

      // Fetch workflow runs (1 API call)
      try {
        const runsRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/actions/runs?per_page=5`, { headers });
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          runs = runsData.workflow_runs.map(run => ({
            id: run.id,
            name: run.name,
            status: run.status,
            conclusion: run.conclusion,
            branch: run.head_branch,
            createdAt: run.created_at,
            updatedAt: run.updated_at,
            htmlUrl: run.html_url,
            event: run.event
          }));
        }
      } catch (e) {
        // Workflow runs fetch failed
      }

      // Fetch recent commits (1 API call)
      let commits = [];
      try {
        const commitsRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=3`, { headers });
        if (commitsRes.ok) {
          const commitsData = await commitsRes.json();
          commits = commitsData.map(c => ({
            sha: c.sha,
            shortSha: c.sha.substring(0, 7),
            message: c.commit.message.split('\n')[0], // First line only
            author: c.commit.author.name,
            date: c.commit.author.date,
            htmlUrl: c.html_url
          }));
        }
      } catch (e) {
        // Commits fetch failed
      }

      // Get branch count (1 more API call)
      try {
        const branchesRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/branches?per_page=1`, { headers });
        if (branchesRes.ok) {
          // Use Link header to get total count without fetching all branches
          const linkHeader = branchesRes.headers.get('Link');
          if (linkHeader) {
            const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
            branchCount = lastMatch ? parseInt(lastMatch[1], 10) : 1;
          } else {
            const branches = await branchesRes.json();
            branchCount = branches.length;
          }
        }
      } catch (e) {
        // Branch count fetch failed
      }

      return {
        runs,
        commits,
        openIssues,
        openPRs,
        branchCount,
        pagesUrl,
        readmeCoverage,
        codeFactorGrade,
        dependencyDashboard,
        error: null
      };
    } catch (e) {
      return {
        runs: [],
        commits: [],
        openIssues: null,
        openPRs: null,
        branchCount: null,
        pagesUrl: null,
        readmeCoverage: null,
        codeFactorGrade: null,
        dependencyDashboard: null,
        error: e.message
      };
    }
  }, []);

  const fetchAllRepos = useCallback(async () => {
    if (!config?.repos?.length) {
      setRepoStatuses({});
      return;
    }

    setLoading(true);
    setError(null);

    const results = {};
    const errors = [];

    await Promise.all(
      config.repos.map(async ({ owner, repo }) => {
        const key = `${owner}/${repo}`;
        const data = await fetchRepoData(owner, repo, config.githubToken);
        results[key] = data;
        if (data.error) {
          errors.push(`${key}: ${data.error}`);
        }
      })
    );

    setRepoStatuses(results);
    setLastUpdate(new Date());
    setLoading(false);

    if (errors.length > 0 && errors.length === config.repos.length) {
      setError('Failed to fetch all repositories');
    }
  }, [config, fetchRepoData]);

  // Initial fetch and setup interval
  useEffect(() => {
    if (!config?.repos?.length) {
      return;
    }

    fetchAllRepos();

    const intervalMs = (config.refreshInterval || 60) * 1000;
    intervalRef.current = setInterval(fetchAllRepos, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [config, fetchAllRepos]);

  return {
    repoStatuses,
    loading,
    error,
    lastUpdate,
    refresh: fetchAllRepos
  };
}

export function getStatusInfo(run) {
  if (!run) {
    return { status: 'unknown', label: 'Unknown' };
  }

  if (run.status === 'completed') {
    switch (run.conclusion) {
      case 'success':
        return { status: 'success', label: 'Success' };
      case 'failure':
        return { status: 'failure', label: 'Failed' };
      case 'cancelled':
        return { status: 'cancelled', label: 'Cancelled' };
      case 'skipped':
        return { status: 'cancelled', label: 'Skipped' };
      default:
        return { status: 'cancelled', label: run.conclusion || 'Unknown' };
    }
  }

  if (run.status === 'in_progress' || run.status === 'queued' || run.status === 'waiting') {
    return { status: 'pending', label: 'In Progress' };
  }

  return { status: 'pending', label: run.status || 'Pending' };
}

export function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

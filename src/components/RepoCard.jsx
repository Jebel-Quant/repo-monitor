import React from 'react';
import StatusBadge from './StatusBadge';
import { getStatusInfo, formatTimeAgo } from '../hooks/useGitHubStatus';

// Simple stat with icon
function Stat({ icon, value, label, onClick, highlight }) {
  if (value === null || value === undefined) return null;

  return (
    <div
      className={`repo-stat ${highlight ? 'highlight' : ''}`}
      title={label}
      onClick={onClick}
    >
      {icon}
      <span>{value}</span>
    </div>
  );
}

export default function RepoCard({ owner, repo, data, gitInfo, onOpenUrl }) {
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const actionsUrl = `${repoUrl}/actions`;

  const handleClick = (url) => {
    if (onOpenUrl) {
      onOpenUrl(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const runs = data?.runs || [];
  const latestRun = runs[0];
  const latestStatus = latestRun ? getStatusInfo(latestRun) : null;
  const currentBranch = gitInfo?.currentBranch;
  const isNotMain = currentBranch && !['main', 'master'].includes(currentBranch);

  // Error state
  if (data?.error) {
    return (
      <div className="repo-card repo-card--error">
        <div className="repo-card__header">
          <div className="repo-card__title" onClick={() => handleClick(repoUrl)}>
            {repo}
          </div>
          <StatusBadge status="failure" title="Error" />
        </div>
        <div className="repo-card__error">{data.error}</div>
      </div>
    );
  }

  return (
    <div className="repo-card">
      {/* Header: Name + Status */}
      <div className="repo-card__header">
        <div className="repo-card__title" onClick={() => handleClick(repoUrl)}>
          {repo}
          <span className="repo-card__owner">/{owner}</span>
        </div>
        {latestStatus && (
          <StatusBadge status={latestStatus.status} title={latestStatus.label} />
        )}
      </div>

      {/* Branch indicator */}
      {currentBranch && (
        <div
          className={`repo-card__branch ${isNotMain ? 'repo-card__branch--warn' : ''}`}
          onClick={() => handleClick(`${repoUrl}/tree/${currentBranch}`)}
          title={isNotMain ? `Not on main branch` : `Current branch`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="3" x2="6" y2="15"></line>
            <circle cx="18" cy="6" r="3"></circle>
            <circle cx="6" cy="18" r="3"></circle>
            <path d="M18 9a9 9 0 0 1-9 9"></path>
          </svg>
          {currentBranch}
        </div>
      )}

      {/* Stats row */}
      <div className="repo-card__stats">
        <Stat
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>}
          value={data?.branchCount}
          label={`${data?.branchCount} branches`}
          onClick={() => handleClick(`${repoUrl}/branches`)}
        />
        <Stat
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          value={data?.openIssues}
          label={`${data?.openIssues} open issues`}
          onClick={() => handleClick(`${repoUrl}/issues`)}
          highlight={data?.openIssues > 0}
        />
        <Stat
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>}
          value={data?.openPRs}
          label={`${data?.openPRs} open PRs`}
          onClick={() => handleClick(`${repoUrl}/pulls`)}
          highlight={data?.openPRs > 0}
        />
        {data?.readmeCoverage !== null && data?.readmeCoverage !== undefined && (
          <Stat
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
            value={`${data.readmeCoverage}%`}
            label={`Code coverage: ${data.readmeCoverage}%`}
            onClick={() => data?.pagesUrl && handleClick(`${data.pagesUrl}tests/html-coverage/index.html`)}
            highlight={data.readmeCoverage < 60}
          />
        )}
        {data?.pagesUrl && (
          <Stat
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
            value="Pages"
            label="GitHub Pages"
            onClick={() => handleClick(data.pagesUrl)}
          />
        )}
        {data?.codeFactorGrade && (
          <div className="repo-stat repo-stat--image" onClick={() => handleClick(data.codeFactorGrade.url)}>
            <img src={data.codeFactorGrade.badgeUrl} alt="CodeFactor" />
          </div>
        )}
      </div>

      {/* Recent commits */}
      {data?.commits?.length > 0 && (
        <div className="repo-card__commits">
          {data.commits.map(commit => (
            <div key={commit.sha} className="repo-card__commit" onClick={() => handleClick(commit.htmlUrl)}>
              <span className="repo-card__commit-sha">{commit.shortSha}</span>
              <span className="repo-card__commit-msg">{commit.message}</span>
              <span className="repo-card__commit-time">{formatTimeAgo(commit.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

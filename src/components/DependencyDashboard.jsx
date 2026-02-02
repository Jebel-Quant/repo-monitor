import React, { useState } from 'react';
import { approveDepedencyUpdate } from '../hooks/useGitHubStatus';

export default function DependencyDashboard({ repoStatuses, config, onOpenUrl, onRefresh, fullTab = false }) {
  const [approving, setApproving] = useState({});
  const [approved, setApproved] = useState({});
  const [errors, setErrors] = useState({});

  // Collect all dependency dashboards from all repos
  const dashboards = Object.entries(repoStatuses)
    .filter(([, data]) => data?.dependencyDashboard)
    .map(([key, data]) => ({
      key,
      ...data.dependencyDashboard
    }));

  // Merge all pending approvals from all repos into one list
  const allPendingApprovals = dashboards.flatMap(d =>
    (d.pendingApprovals || []).map((approval, idx) => ({
      id: `${d.owner}/${d.repo}-${approval.lineIndex}`,
      owner: d.owner,
      repo: d.repo,
      issueNumber: d.number,
      repoKey: `${d.owner}/${d.repo}`,
      dashboardUrl: d.url,
      approval
    }))
  );

  if (dashboards.length === 0) {
    return null;
  }

  const handleOpenUrl = (url) => {
    if (onOpenUrl) {
      onOpenUrl(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleApprove = async (item) => {
    const { id, owner, repo, issueNumber, approval } = item;
    const token = config?.githubToken;

    if (!token) {
      setErrors(prev => ({ ...prev, [id]: 'GitHub token required' }));
      return;
    }

    setApproving(prev => ({ ...prev, [id]: true }));
    setErrors(prev => ({ ...prev, [id]: null }));

    try {
      await approveDepedencyUpdate(owner, repo, issueNumber, approval, token);
      setApproved(prev => ({ ...prev, [id]: true }));
      if (onRefresh) {
        setTimeout(onRefresh, 2000);
      }
    } catch (err) {
      setErrors(prev => ({ ...prev, [id]: err.message }));
    } finally {
      setApproving(prev => ({ ...prev, [id]: false }));
    }
  };

  const pendingCount = allPendingApprovals.filter(a => !a.approval.isApproveAll).length;

  const renderApprovalsList = () => (
    allPendingApprovals.length === 0 ? (
      <div className="no-pending">No pending approvals across {dashboards.length} repos</div>
    ) : (
      <div className="pending-approvals-list">
        {allPendingApprovals.map(item => {
          const { id, repoKey, dashboardUrl, approval } = item;
          const isApproving = approving[id];
          const isApproved = approved[id];
          const error = errors[id];

          return (
            <div
              key={id}
              className={`pending-approval-item ${isApproved ? 'approved' : ''} ${approval.isApproveAll ? 'approve-all' : ''}`}
            >
              <label className="approval-checkbox-label">
                <input
                  type="checkbox"
                  className="approval-checkbox"
                  checked={isApproved}
                  disabled={isApproving || isApproved}
                  onChange={() => handleApprove(item)}
                />
                {isApproving && <span className="approval-spinner"></span>}
              </label>
              <span
                className="pending-approval-repo"
                onClick={() => handleOpenUrl(dashboardUrl)}
              >
                {repoKey}
              </span>
              <span className={`pending-approval-name ${isApproved ? 'approved' : ''}`}>
                {approval.name}
              </span>
              {error && <span className="pending-approval-error" title={error}>!</span>}
              {isApproved && <span className="pending-approval-success">PR Created</span>}
            </div>
          );
        })}
      </div>
    )
  );

  // Full tab mode - no collapsible header
  if (fullTab) {
    return (
      <div className="dependency-dashboard full-tab">
        <div className="dependency-dashboard-content">
          <div style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {pendingCount} pending approvals across {dashboards.length} repos
          </div>
          {renderApprovalsList()}
        </div>
      </div>
    );
  }

  // Collapsible mode - not used in tabs anymore but keeping for backwards compatibility
  return null;
}

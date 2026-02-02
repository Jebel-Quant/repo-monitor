import React from 'react';

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const SpinnerIcon = () => (
  <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
    <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"></path>
  </svg>
);

const CancelledIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
  </svg>
);

export default function StatusBadge({ status, title }) {
  const icons = {
    success: <CheckIcon />,
    failure: <XIcon />,
    pending: <SpinnerIcon />,
    cancelled: <CancelledIcon />
  };

  return (
    <div className={`status-badge ${status}`} title={title}>
      {icons[status] || icons.cancelled}
    </div>
  );
}

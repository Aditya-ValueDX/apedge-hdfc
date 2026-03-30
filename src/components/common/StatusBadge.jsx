import React from 'react';

const StatusBadge = ({ status, capitalizeStatus }) => {
  // Unified status color map using the design system colors with improved contrast
  const statusColorMap = {
    // Document Queue statuses
    uploaded: { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200' },
    ocr_done: { bg: 'bg-green-100', text: 'text-green-900', border: 'border-green-200' },
    reconciled: { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200' },
    verified: { bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-200' },
    received: { bg: 'bg-blue-100', text: 'text-blue-900', border: 'border-blue-200' },
    created: { bg: 'bg-violet-100', text: 'text-violet-900', border: 'border-violet-200' },
    
    // Extraction Queue statuses
    Uploaded: { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200' },
    Ocr_done: { bg: 'bg-green-100', text: 'text-green-900', border: 'border-green-200' },
    Reconciled: { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200' },
    Verified: { bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-200' },
    Draft_saved: { bg: 'bg-gray-100', text: 'text-gray-900', border: 'border-gray-200' },
    Pending: { bg: 'bg-amber-200', text: 'text-amber-900', border: 'border-amber-300' },
    
    // Reconciliation Queue statuses
    'queued for matching': { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200' },
    extracted: { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200' },
    reconciled: { bg: 'bg-violet-100', text: 'text-violet-900', border: 'border-violet-200' },
    verified: { bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-200' },
    rejected: { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-200' },
    
    // Final Queue statuses
    Error: { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-200' },
    Rejected: { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200' },
    Approved: { bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-200' },
    Completed: { bg: 'bg-sky-100', text: 'text-sky-900', border: 'border-sky-200' },
    Failure: { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-200' },
    Reviewed: { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200' },
    Upload: { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200' },
    
    // Default
    default: { bg: 'bg-gray-100', text: 'text-gray-900', border: 'border-gray-200' },
  };

  // Normalize status for lookup
  const normalizedStatus = status?.toString().toLowerCase().replace(/\s+/g, '_');
  const statusKey = Object.keys(statusColorMap).find(
    key => key.toLowerCase().replace(/\s+/g, '_') === normalizedStatus
  ) || 'default';
  
  const statusStyle = statusColorMap[statusKey] || statusColorMap.default;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-normal tracking-wider border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
    >
      {capitalizeStatus ? capitalizeStatus(status) : status}
    </span>
  );
};

export default StatusBadge;
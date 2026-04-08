import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Search, Calendar, X, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

// Moved from fileUtils.js to resolve the import error.
const formatFileName = (filePath) => {
  if (!filePath) return 'N/A';

  const fileNameWithExtension = filePath.split(/[/\\]/).pop();
  if (!fileNameWithExtension) return 'N/A';

  const lastDotIndex = fileNameWithExtension.lastIndexOf('.');
  const baseName = lastDotIndex > 0
    ? fileNameWithExtension.substring(0, lastDotIndex)
    : fileNameWithExtension;
  const extension = lastDotIndex > 0
    ? fileNameWithExtension.substring(lastDotIndex)
    : '';

  const uuidRegex = /_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const genericIdRegex = /_[A-Za-z0-9]{6,}$/;

  let cleanBase = baseName;
  if (uuidRegex.test(cleanBase)) {
    cleanBase = cleanBase.replace(uuidRegex, '');
  } else if (genericIdRegex.test(cleanBase)) {
    cleanBase = cleanBase.replace(genericIdRegex, '');
  }

  return cleanBase + extension;
};

// Formats date timestamps into a readable string.
const formatDate = (timestamp, showTime = false) => {
  if (!timestamp) return 'N/A';

  // Attempt to parse the timestamp, which might be a number or a string.
  let date = new Date(Number(timestamp));

  // If parsing as a number fails, try parsing it directly as a string (for ISO formats etc.)
  if (isNaN(date.getTime())) {
    date = new Date(timestamp);
  }

  // If the date is still invalid, return the original content.
  if (isNaN(date.getTime())) {
    return String(timestamp);
  }

  // Format date using en-GB standard (dd/mm/yyyy)
  const dateString = date.toLocaleDateString('en-GB');

  // If showTime is false or column doesn't match time-related keywords, return only date
  if (!showTime) {
    return dateString;
  }

  // Format time using en-IN standard (hh:mm AM/PM)
  const timeString = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Return date and time on separate lines within a span element as per standard
  return React.createElement('span', { className: 'text-xs' },
    React.createElement('div', null, dateString),
    React.createElement('div', null, timeString)
  );
};

const TableComponent = ({
  data, // This is now paginated data from the server
  columns,
  columnFilters,
  setColumnFilters,
  // ─── NEW PROP ────────────────────────────────────────────────────────────────
  // Called when the user commits a column filter value (Enter / select / date pick).
  // Receives (key, value) so the parent can do per-field conflict resolution against
  // advanced filters before updating state.
  // Falls back to the plain setColumnFilters updater if not provided.
  onColumnFilterCommit,
  // ─────────────────────────────────────────────────────────────────────────────
  sortField,
  setSortField,
  sortAsc,
  setSortAsc,
  page,
  setPage,
  onRowClick,
  rowClassName,
  emptyMessage = "No data found matching your criteria.",
  pageSize, // Prop from parent
  setPageSize, // New prop for updating page size
  totalCount, // Prop from parent
  renderExpandedContent,
  filtering = false, // New prop for filtering state
  // Tour-related props
  'data-tour': dataTour,
  tableCardDataTour,
  tableFiltersDataTour,
  tableSortDataTour,
  tableViewDataTour,
  tableReprocessDataTour,
  tableDeleteDataTour,
  tablePaginationDataTour,
  tableExpandBtnDataTour,
  tableRowsPerPageDataTour,
  tablePaginationInfoDataTour,
}) => {

  const [expandedRows, setExpandedRows] = useState(new Set());
  const [columnWidths, setColumnWidths] = useState({});
  const [tooltip, setTooltip] = useState({ visible: false, content: '', x: 0, y: 0 });

  // Local state for filter inputs to allow continuous typing without triggering API calls
  const [filterInputValues, setFilterInputValues] = useState(columnFilters);

  // Sync local filter state if props change (e.g., "Clear All" in parent)
  useEffect(() => {
    setFilterInputValues(columnFilters);
  }, [columnFilters]);

  // Only updates the local input state — does NOT trigger a search
  const handleFilterChange = useCallback((key, value) => {
    let processedValue = value;
    if (key === 'id') {
      processedValue = value.replace(/[^0-9]/g, '');
    }
    setFilterInputValues(prev => ({ ...prev, [key]: processedValue }));
  }, []);

  // Commits the current local value to the parent, triggering the actual API/filter call.
  // If onColumnFilterCommit is provided, delegate to it so the parent can do per-field
  // conflict resolution (clearing only the overlapping advanced filter field, not all of them).
  // Otherwise fall back to the plain setColumnFilters updater.
  const handleFilterCommit = useCallback((key, value) => {
    let processedValue = value;
    if (key === 'id') {
      processedValue = String(value).replace(/[^0-9]/g, '');
    }

    if (onColumnFilterCommit) {
      // Parent handles conflict resolution + state update
      onColumnFilterCommit(key, processedValue);
    } else {
      // Fallback: plain update with no conflict resolution
      setColumnFilters(prev => ({ ...prev, [key]: processedValue }));
    }

    setPage(1);
  }, [onColumnFilterCommit, setColumnFilters, setPage]);


  useEffect(() => {
    const initialWidths = columns.reduce((acc, col) => {
      if (col && col.width !== undefined && col.width !== null) {
        acc[col.key] = typeof col.width === 'number' ? `${col.width}px` : String(col.width);
      } else {
        acc[col.key] = undefined;
      }
      return acc;
    }, {});
    setColumnWidths(initialWidths);
  }, [columns]);


  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const startResizing = useCallback((e, key) => {
    const startX = e.clientX;
    const startWidth = e.target.closest('th').offsetWidth;

    const doDrag = (e) => {
      const newWidth = startWidth + (e.clientX - startX);
      setColumnWidths(prev => ({
        ...prev,
        [key]: Math.max(newWidth, 50) + 'px'
      }));
    };

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag);
      window.removeEventListener('mouseup', stopDrag);
    };

    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  }, []);

  const capitalize = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const showTooltip = useCallback((e, content, col) => {
    // FIX: Do not show tooltip for the 'stage' column as its content is graphical.
    if (col.key === 'stage' || col.disableTooltip === true) {
      return;
    }

    // Prevent tooltip for null/undefined, empty strings, or complex React elements.
    if (content === null || content === undefined || content === '' || React.isValidElement(content)) {
      return;
    }

    let displayContent = String(content);
    // Format content based on column type
    if (col && col.key && typeof col.key === 'string' && col.key.toLowerCase().includes('file')) {
      displayContent = formatFileName(displayContent);
    } else if (col && col.filterType === 'date') {
      // Check if this is a time-related column
      const colKey = col.key.toLowerCase();
      // Exclude invoice-related columns from showing time
      const isInvoiceDateColumn = colKey.includes('inv') && colKey.includes('date') ||
        colKey.includes('invoice') && colKey.includes('date');
      const showTime = !isInvoiceDateColumn && (
        colKey.includes('updated') ||
        colKey.includes('created') ||
        colKey.includes('date') ||
        colKey.includes('time')
      );
      displayContent = formatDate(content, showTime);
    }

    // Check if content is long enough to warrant a tooltip (using memory rule)
    if (displayContent.length < 15) {
      return;
    }

    setTooltip({
      visible: true,
      content: displayContent,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  // Client-side filtering and sorting are removed.
  // const filteredAndSortedData = useMemo(() => { ... }, []);

  // Calculate totalPages based on props from parent
  const totalPages = useMemo(() => {
    return totalCount > 0 && pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1;
  }, [totalCount, pageSize]);


  // Client-side pagination is removed.
  // const paginatedData = useMemo(() => { ... }, []);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setPage(1); // Reset page on sort change
  };

  const getPaginationRange = (current, total) => {
    const range = [];
    if (total <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= total; i++) range.push(i);
    } else {
      // Always show exactly 7 elements for consistent width
      if (current <= 3) {
        range.push(1, 2, 3, 4, 5, '...', total);
      } else if (current >= total - 2) {
        range.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
      } else {
        range.push(1, '...', current - 1, current, current + 1, '...', total);
      }
    }
    return range;
  };

  // Page size options
  const pageSizeOptions = [10, 25, 50, 100];

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when page size changes
  };

  // Improved pagination for mobile devices
  const renderPagination = () => {
    // Only show pagination controls if there are more than one page AND there's data
    if (data.length === 0 || totalPages <= 1 || totalCount === 0) return null;

    const btnBase = {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 28, height: 26,
      borderRadius: 6,
      fontSize: '11px', fontWeight: 400,
      cursor: 'pointer',
      border: '1px solid #e5e7eb',
      background: '#fff',
      color: '#374151',
      transition: 'all 0.15s ease',
      padding: '0 6px',
    };
    const btnActive = { ...btnBase, background: '#6366f1', color: '#fff', border: '1px solid #6366f1', fontWeight: 500 };
    const btnDisabled = { ...btnBase, opacity: 0.35, cursor: 'not-allowed' };

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={page === 1 ? btnDisabled : btnBase}
          data-tour="pagination-previous"
          onMouseEnter={e => { if (page !== 1) { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#6366f1'; } }}
          onMouseLeave={e => { if (page !== 1) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151'; } }}
        >
          <ChevronLeft size={13} />
        </button>

        {getPaginationRange(page, totalPages).map((pg, i) => (
          <button
            type="button"
            key={i}
            disabled={pg === '...'}
            style={pg === page ? btnActive : pg === '...' ? { ...btnBase, cursor: 'default', color: '#9ca3af', border: 'none', background: 'none', minWidth: 20 } : btnBase}
            onClick={() => typeof pg === 'number' && setPage(pg)}
            onMouseEnter={e => { if (pg !== page && pg !== '...') { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#6366f1'; } }}
            onMouseLeave={e => { if (pg !== page && pg !== '...') { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151'; } }}
            {...(pg === page ? { 'data-tour': 'pagination-current' } : {})}
          >
            {pg}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages || totalCount === 0}
          style={(page === totalPages || totalCount === 0) ? btnDisabled : btnBase}
          data-tour="pagination-next"
          onMouseEnter={e => { if (page !== totalPages && totalCount > 0) { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#6366f1'; } }}
          onMouseLeave={e => { if (page !== totalPages && totalCount > 0) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151'; } }}
        >
          <ChevronRight size={13} />
        </button>
      </div>
    );
  };

  return (
    <>
      <style>{`
        /* ── Scrollbar ── */
        .tbl-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .tbl-scroll::-webkit-scrollbar-track { background: #f1f5f9; }
        .tbl-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        .tbl-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        /* ── Resize handle ── */
        .resize-handle {
          position: absolute; right: 0; top: 0;
          height: 100%; width: 4px;
          cursor: col-resize; z-index: 10;
        }
        .resize-handle:hover { background: rgba(99,102,241,0.3); }

        /* ── Tooltip ── */
        .tbl-tooltip {
          position: fixed;
          background: #1e293b;
          color: #f1f5f9;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 400;
          z-index: 9999;
          pointer-events: none;
          opacity: 0;
          max-width: 260px;
          white-space: normal;
          line-height: 1.5;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          transition: opacity 0.15s ease, transform 0.15s ease;
          transform: translateY(4px);
        }
        .tbl-tooltip.visible { opacity: 1; transform: translateY(0); }

        /* ── Header ── */
        .tbl-thead th {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 0;
          font-weight: 500;
          user-select: none;
          position: relative;
        }
        .tbl-thead th:hover { background: #e8edf5; }

        /* ── Body rows ── */
        .tbl-tbody td {
          border: 1px solid #e2e8f0;
          padding: 6px 10px;
          color: #374151;
          font-size: 11px;
          font-weight: 400;
          vertical-align: middle;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 9rem;
          background: #ffffff;
        }
        .tbl-row-even td { background: #f8fafc; }
        .tbl-row:hover td { background: #eff1ff !important; }
        
        /* ── Custom row classes ── */
        .tbl-row.bg-yellow-200 td { background: #fefcbf !important; }
        .tbl-row:hover.bg-yellow-200 td { background: #fefcbf !important; }

        /* ── Expand button ── */
        .tbl-expand-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: 4px;
          border: 1px solid #d1d5db;
          color: #6b7280; background: white;
          cursor: pointer; transition: all 0.15s ease;
        }
        .tbl-expand-btn:hover { border-color: #818cf8; color: #4f46e5; background: #eef2ff; }

        /* ── Filter inputs ── */
        .tbl-filter-input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 11px;
          background: #fff;
          color: #374151;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .tbl-filter-input:focus {
          outline: none;
          border-color: #818cf8;
          box-shadow: 0 0 0 2px rgba(129,140,248,0.2);
        }

        /* ── Expandable row ── */
        .tbl-expanded-td {
          padding: 10px 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-top: none;
        }
      `}</style>

      <div className="flex flex-col">
        {/* Tooltip */}
        <div
          className={`tbl-tooltip ${tooltip.visible ? 'visible' : ''}`}
          style={{
            top: tooltip.y + 8,
            left: tooltip.x,
            transform: `translateX(-50%) ${tooltip.visible ? 'translateY(0)' : 'translateY(4px)'}`,
          }}
        >
          {tooltip.content}
        </div>

        {/* Main card */}
        <div
          className="flex-1 min-w-0 mt-1 bg-white"
          style={{ borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 1px 6px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', overflow: 'hidden' }}
          data-tour={tableCardDataTour}
        >
          {/* Horizontal scroll */}
          <div className="tbl-scroll overflow-x-auto w-full">
            {/* Vertical scroll */}
            <div className="tbl-scroll overflow-y-auto" style={{ maxHeight: 'calc(100vh - 210px)' }}>
              <table
                className="w-full bg-white queue-table"
                style={{ tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}
                data-tour={dataTour}
              >
                {/* ── THEAD ── */}
                <thead className="tbl-thead" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    {renderExpandedContent && (
                      <th style={{ width: 36 }} />
                    )}
                    {columns.map(col => (
                      <th
                        key={col.key}
                        style={{
                          width: columnWidths[col.key] || col.width || 'auto',
                          position: 'relative',
                        }}
                      >
                        <div style={{ padding: '6px 8px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {/* Column label + sort icon */}
                          {col.sortable ? (
                            <div
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, cursor: 'pointer' }}
                              onClick={() => toggleSort(col.key)}
                              data-tour={tableSortDataTour}
                            >
                              <span style={{ color: '#374151', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {col.header}
                              </span>
                              {sortField === col.key
                                ? (sortAsc
                                    ? <ArrowUp size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
                                    : <ArrowDown size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
                                  )
                                : <ArrowUpDown size={12} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                              }
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: col.headerAlign === 'center' ? 'center' : 'flex-start' }} data-tour={tableSortDataTour}>
                              <span style={{ color: '#374151', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {col.header}
                              </span>
                            </div>
                          )}

                          {/* Filter control */}
                          {col.filterable && (
                            <div style={{ position: 'relative', width: '100%' }} data-tour={tableFiltersDataTour}>
                              {col.filterType === 'select' ? (
                                (() => {
                                  const rawOptions = col.filterOptions ? col.filterOptions() : [];
                                  const optionEntries = rawOptions
                                    .map(option => {
                                      const isObject = typeof option === 'object' && option !== null && 'value' in option && 'label' in option;
                                      const val   = isObject ? option.value : option;
                                      const label = isObject ? option.label : capitalize(String(option));
                                      if (typeof val === 'object' && val !== null) return null;
                                      return { val: String(val), label };
                                    })
                                    .filter(Boolean);

                                  const selectLabels = ['All', ...optionEntries.map(e => e.label)];
                                  const currentVal = filterInputValues[col.key] || '';
                                  const matchedEntry = optionEntries.find(e => e.val === currentVal);
                                  const selectedLabel = currentVal === '' ? 'All' : (matchedEntry ? matchedEntry.label : 'All');

                                  const handleSelectChange = (chosenLabel) => {
                                    if (chosenLabel === 'All' || chosenLabel === '') {
                                      handleFilterChange(col.key, '');
                                      handleFilterCommit(col.key, '');
                                    } else {
                                      const found = optionEntries.find(e => e.label === chosenLabel);
                                      const commitVal = found ? found.val : chosenLabel;
                                      handleFilterChange(col.key, commitVal);
                                      handleFilterCommit(col.key, commitVal);
                                    }
                                  };

                                  return (
                                    <div onClick={e => e.stopPropagation()} style={{ width: '100%' }}>
                                      <SearchableSelect
                                        options={selectLabels}
                                        value={selectedLabel}
                                        onChange={handleSelectChange}
                                        placeholder="All"
                                        allowClear={!!currentVal}
                                      />
                                    </div>
                                  );
                                })()
                              ) : col.filterType === 'date' ? (
                                <div style={{ position: 'relative', width: '100%' }}>
                                  <input
                                    type="date"
                                    value={filterInputValues[col.key] || ''}
                                    onChange={(e) => { handleFilterChange(col.key, e.target.value); handleFilterCommit(col.key, e.target.value); }}
                                    max={new Date().toISOString().split('T')[0]}
                                    onClick={e => e.stopPropagation()}
                                    className="tbl-filter-input"
                                    style={{ padding: '3px 6px', paddingRight: filterInputValues[col.key] ? '20px' : '6px' }}
                                  />
                                  {filterInputValues[col.key] && (
                                    <button
                                      type="button"
                                      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', cursor: 'pointer', display: 'flex', background: 'none', border: 'none', padding: 0 }}
                                      onClick={(e) => { e.stopPropagation(); handleFilterChange(col.key, ''); handleFilterCommit(col.key, ''); }}
                                    >
                                      <X size={11} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div style={{ position: 'relative', width: '100%' }}>
                                  <input
                                    type={col.filterType || 'text'}
                                    placeholder={`Filter ${col.filterPlaceholder || capitalize(col.key)}...`}
                                    value={filterInputValues[col.key] || ''}
                                    onChange={e => {
                                      handleFilterChange(col.key, e.target.value);
                                      if (e.target.value === '') {
                                        handleFilterCommit(col.key, '');
                                      }
                                    }}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') { e.stopPropagation(); handleFilterCommit(col.key, filterInputValues[col.key] || ''); }
                                    }}
                                    onClick={e => e.stopPropagation()}
                                    className="tbl-filter-input"
                                    style={{
                                      padding: '3px 6px',
                                      paddingRight: filterInputValues[col.key] ? '34px' : '20px',
                                    }}
                                  />
                                  {/* Search commit */}
                                  <button
                                    type="button"
                                    style={{
                                      position: 'absolute',
                                      right: filterInputValues[col.key] ? 17 : 4,
                                      top: '50%', transform: 'translateY(-50%)',
                                      color: '#9ca3af', cursor: 'pointer',
                                      display: 'flex', background: 'none', border: 'none', padding: 0,
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#6366f1'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                                    onClick={(e) => { e.stopPropagation(); handleFilterCommit(col.key, filterInputValues[col.key] || ''); }}
                                    title="Search"
                                  >
                                    <Search size={11} />
                                  </button>
                                  {filterInputValues[col.key] && (
                                    <button
                                      type="button"
                                      style={{ position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', cursor: 'pointer', display: 'flex', background: 'none', border: 'none', padding: 0 }}
                                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                      onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                                      onClick={(e) => { e.stopPropagation(); handleFilterChange(col.key, ''); handleFilterCommit(col.key, ''); }}
                                    >
                                      <X size={11} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Resize handle */}
                        <div className="resize-handle" onMouseDown={(e) => startResizing(e, col.key)} />
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* ── TBODY ── */}
                <tbody className="tbl-tbody">
                  {filtering ? (
                    <tr>
                      <td
                        colSpan={columns.length + (renderExpandedContent ? 1 : 0)}
                        style={{ padding: '133px 0', textAlign: 'center', border: '1px solid #e2e8f0' }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#6366f1', fontSize: '12px' }}>
                          <div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                          Updating results…
                        </div>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      </td>
                    </tr>
                  ) : data.length > 0 ? (
                    data.map((item, index) => {
                      const rowKey = item.id || item.detail_id || item.parameter_id || item.tenant_id || item.request_id || item.invoice_id || `${page}-${index}`;
                      const expandKey = item.request_id || item.detail_id || item.parameter_id || item.tenant_id || item.invoice_id || `row-${index}`;
                      const isExpanded = expandedRows.has(expandKey);
                      const extraClass = rowClassName ? rowClassName(item) : '';

                      return (
                        <React.Fragment key={rowKey}>
                          <tr
                            onClick={() => onRowClick && onRowClick(item)}
                            className={`tbl-row ${index % 2 === 0 ? 'tbl-row-even' : ''} ${extraClass}`}
                            style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                          >
                            {renderExpandedContent && (
                              <td style={{ textAlign: 'center', width: 36 }}>
                                <button
                                  className="tbl-expand-btn"
                                  onClick={(e) => { e.stopPropagation(); toggleExpand(expandKey); }}
                                  data-tour={tableExpandBtnDataTour}
                                >
                                  {isExpanded ? <Minus size={11} /> : <Plus size={11} />}
                                </button>
                              </td>
                            )}
                            {columns.map(col => {
                              const cellContent = item[col.key];
                              let displayContent = String(cellContent ?? '');
                              if (col?.key?.toLowerCase().includes('file')) {
                                displayContent = formatFileName(displayContent);
                              } else if (col?.filterType === 'date') {
                                const ck = col.key.toLowerCase();
                                const isInvDate = (ck.includes('inv') || ck.includes('invoice')) && ck.includes('date');
                                const showTime = !isInvDate && (ck.includes('updated') || ck.includes('created') || ck.includes('date') || ck.includes('time'));
                                displayContent = formatDate(cellContent, showTime);
                              }

                              const hasTooltip =
                                col.key !== 'stage' &&
                                col.disableTooltip !== true &&
                                cellContent !== null && cellContent !== undefined && cellContent !== '' &&
                                !React.isValidElement(cellContent) &&
                                String(displayContent).length >= 20;

                              let cellDisplay = item[col.key];
                              if (col.render) {
                                cellDisplay = col.render(item, index, page);
                              } else if (col.filterType === 'date') {
                                cellDisplay = formatDate(item[col.key], false);
                              }

                              return (
                                <td
                                  key={col.key}
                                  style={{
                                    width: columnWidths[col.key] || col.width || 'auto',
                                    overflow: col.key === 'stage' || col.key === 'actions' ? 'visible' : 'hidden',
                                  }}
                                  onMouseMove={(e) => col.disableTooltip !== true && showTooltip(e, item[col.key], col)}
                                  onMouseLeave={hideTooltip}
                                >
                                  {cellDisplay}
                                </td>
                              );
                            })}
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td
                                colSpan={columns.length + (renderExpandedContent ? 1 : 0)}
                                className="tbl-expanded-td"
                              >
                                {renderExpandedContent(item)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={columns.length + (renderExpandedContent ? 1 : 0)}
                        style={{ padding: '48px 0', textAlign: 'center', color: '#9ca3af', fontSize: '12px', fontWeight: 400, border: '1px solid #e2e8f0' }}
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Pagination bar ── */}
        <div
          className="flex flex-col sm:flex-row justify-between items-center gap-3"
          style={{ padding: '10px 4px 4px' }}
        >
          {/* Rows per page */}
          <div className="flex items-center gap-2" data-tour={tableRowsPerPageDataTour || "table-rows-per-page-label"}>
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 400 }}>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              data-tour={tableRowsPerPageDataTour ? `${tableRowsPerPageDataTour}-select` : "table-rows-per-page-select"}
              style={{
                fontSize: '11px',
                color: '#374151',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '3px 8px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          {/* Entry info */}
          <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }} data-tour={tablePaginationInfoDataTour || "table-pagination-info"}>
            {totalCount > 0 
              ? `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, totalCount)} of ${totalCount} entries`
              : '0 entries'
            }
          </div>

          {/* Page buttons */}
          <div data-tour={tablePaginationDataTour}>
            {renderPagination()}
          </div>
        </div>
      </div>
    </>
  );
};

export default TableComponent;
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  FileCheck2,
  FileX,
  Loader2,
  Hourglass,
  LayoutGrid,
  BarChart3,
  PieChart,
  Filter,
  RefreshCw,
  X,
  Users,
  FileText,
  Eye,
  Calendar,
  Clock,
  Info,
} from 'lucide-react';
import { Bar, Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import axios from '../utils/authInterceptor';
import OverviewChart from './common/OverviewChart';
import InvoicePerformanceGraph from './common/InvoicePerformanceGraph';
import { useSelector } from 'react-redux';
import { apiBaseUrl } from '../config/apiConfig';
import StatusCard, { resetUsedIcons, BalancedCardGrid } from './common/StatusCard';
import AdvancedFilterPanel from './common/AdvancedFilterPanel';
import Button from './common/Button';
import { COLOR_PALETTE, getStatusColor } from '../utils/Statuscolorutils';
import AgentStatusDrawer from './common/AgentStatusDrawer';

// Custom HTML Legend Plugin – three visual states:
// ─────────────────────────────────────────────────────────────────────────────
// Unified legend plugin – three visual states, matching InvoicePerformanceGraph
//   ACTIVE : has data, visible  → white chip, coloured dot, coloured count text
//   HIDDEN : has data, toggled  → muted chip, grey dot, strikethrough, eye icon
//   EMPTY  : zero count         → faint dashed chip, grey dot, "0"
// ─────────────────────────────────────────────────────────────────────────────
const htmlLegendPlugin = {
  id: 'htmlLegend',
  afterUpdate(chart) {
    const legendContainer = document.getElementById('chart-legend-container');
    if (!legendContainer) return;
    while (legendContainer.firstChild) legendContainer.firstChild.remove();

    const items    = chart.options.plugins.legend.labels.generateLabels(chart);
    const dataVals = chart.data.datasets[0]?.data || [];

    const active = items.filter(it => (dataVals[it.index] || 0) > 0 && !it.hidden);
    const hidden = items.filter(it => (dataVals[it.index] || 0) > 0 &&  it.hidden);
    const empty  = items.filter(it => (dataVals[it.index] || 0) === 0);

    // ── Chip list ────────────────────────────────────────────────────────────
    const ul = document.createElement('ul');
    ul.style.cssText = [
      'display:flex','flex-wrap:wrap','justify-content:center',
      'gap:6px','margin:0','padding:4px 0 6px','list-style:none',
    ].join(';');

    const mkChip = (item, state) => {
      const val      = dataVals[item.index] || 0;
      const isActive = state === 'active';
      const isHidden = state === 'hidden';

      // ── chip wrapper
      const li = document.createElement('li');
      li.style.cssText = [
        'display:flex','align-items:center','gap:5px',
        'padding:3px 8px 3px 6px','border-radius:6px',
        'font-size:11px','font-family:Poppins,sans-serif','font-weight:400',
        `color:${isActive ? '#9ca3af' : '#8a9099'}`,
        `border:${isActive ? '1px solid #eef0f4' : isHidden ? '1px solid #d1d5db' : '1px dashed #d1d5db'}`,
        `background:${isActive ? '#ffffff' : '#f3f4f6'}`,
        `opacity:${isHidden ? '0.85' : state === 'empty' ? '0.75' : '1'}`,
        `cursor:${state !== 'empty' ? 'pointer' : 'default'}`,
        'transition:all 0.15s','user-select:none',
      ].join(';');

      li.title = isActive
        ? `${item.text}: ${val} — click to hide`
        : isHidden
          ? `${item.text}: ${val} — hidden, click to restore`
          : `${item.text}: no data this period`;

      li.onmouseover = () => {
        if (state === 'empty') return;
        li.style.background  = '#f5f6f8';
        li.style.opacity     = '1';
        li.style.borderColor = '#d9dce2';
      };
      li.onmouseout = () => {
        li.style.background  = isActive ? '#ffffff' : '#f3f4f6';
        li.style.opacity     = isHidden ? '0.85' : state === 'empty' ? '0.75' : '1';
        li.style.borderColor = isActive ? '#eef0f4' : isHidden ? '#d1d5db' : '#d1d5db';
      };
      li.onclick = () => {
        if (state === 'empty') return;
        chart.toggleDataVisibility(item.index);
        chart.update();
      };

      // ── coloured dot
      const dot = document.createElement('span');
      dot.style.cssText = [
        'width:7px','height:7px','border-radius:50%','flex-shrink:0','display:inline-block',
        `background:${isActive ? item.fillStyle : '#9ca3af'}`,
      ].join(';');

      // ── label
      const lbl = document.createElement('span');
      lbl.textContent = item.text;
      if (isHidden) lbl.style.textDecoration = 'line-through';

      li.append(dot, lbl);

      // ── right-side indicator
      if (isActive) {
        // plain coloured count – no bubble/badge
        const cnt = document.createElement('span');
        cnt.textContent = val;
        cnt.style.cssText = [
          `color:${item.fillStyle}`,
          'font-size:11px','font-weight:600','flex-shrink:0',
          'min-width:14px','text-align:right',
        ].join(';');
        li.appendChild(cnt);
      } else if (isHidden) {
        // tiny eye-slash svg inline
        const eye = document.createElement('span');
        eye.style.cssText = 'display:inline-flex;align-items:center;flex-shrink:0;';
        eye.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        li.appendChild(eye);
      } else {
        // zero count in muted text
        const zero = document.createElement('span');
        zero.textContent = '0';
        zero.style.cssText = 'color:#9ca3af;font-size:11px;font-weight:500;flex-shrink:0;';
        li.appendChild(zero);
      }

      return li;
    };

    active.forEach(it => ul.appendChild(mkChip(it, 'active')));
    hidden.forEach(it => ul.appendChild(mkChip(it, 'hidden')));

    if ((active.length || hidden.length) && empty.length) {
      const sep = document.createElement('li');
      sep.style.cssText = 'width:100%;height:0;border-top:1px dashed #f0f2f5;margin:2px 0;list-style:none;';
      ul.appendChild(sep);
    }

    empty.forEach(it => ul.appendChild(mkChip(it, 'empty')));
    legendContainer.appendChild(ul);
  }
};

// Debounce function to limit how often a function can be called
function useDebounce(callback, delay) {
  const timeoutRef = useRef(null);

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
}

// Returns a YYYY-MM-DD string for exactly 1 calendar month ago from today
const getOneMonthAgoDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

// Add a helper function to validate date format
const isValidDateFormat = (dateString) => {
  if (!dateString) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && date.toISOString().slice(0, 10) === dateString;
};

// Filter field definitions for AdvancedFilterPanel
const useFilterFields = (user, allStatusValues, users, tenants) => {
  return useMemo(() => {
    const fields = [
      {
        key: 'fromDate',
        label: 'From Date',
        type: 'date',
        icon: Calendar,
        maxKey: 'toDate',
        defaultValue: getOneMonthAgoDate(),
      },
      {
        key: 'toDate',
        label: 'To Date',
        type: 'date',
        icon: Calendar,
        minKey: 'fromDate',
        defaultValue: getTodayDate(),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        icon: CheckCircle,
        options: allStatusValues.map(status => ({ value: status, label: status })),
        allOptionLabel: 'All Statuses',
      },
      {
        key: 'stage',
        label: 'Stage',
        type: 'select',
        icon: Clock,
        options: [
          { value: 'New', label: 'New' },
          { value: 'Review', label: 'Review' },
          { value: 'Upload', label: 'Upload' },
        ],
        allOptionLabel: 'All Stages',
      },
    ];

    // Add user filter for appropriate roles
    if (['super_admin', 'tenant_admin', 'account_manager'].includes(user.role)) {
      fields.push({
        key: 'userId',
        label: 'User Name',
        type: 'select',
        icon: Users,
        options: users.map(u => ({ value: u.id, label: u.user_name })),
        allOptionLabel: 'All Users',
      });
    }

    // Add tenant filter for super admin
    if (user.role === 'super_admin') {
      fields.push({
        key: 'tenantId',
        label: 'Tenant Name',
        type: 'select',
        icon: FileText,
        options: tenants.map(t => ({ value: t.tenant_id, label: t.tenant_name })),
        allOptionLabel: 'All Tenants',
      });
    }

    return fields;
  }, [user, allStatusValues, users, tenants]);
};

const AnimatedCounter = ({ value, isRefreshing, refreshTick, duration = 600 }) => {
  const [displayValue, setDisplayValue] = useState(() => Number(value) || 0);
  const lastRefreshTickRef = useRef(refreshTick);

  useEffect(() => {
    if (isRefreshing) return;

    const nextValue = Number(value) || 0;
    if (refreshTick === lastRefreshTickRef.current) {
      setDisplayValue(nextValue);
      return;
    }

    lastRefreshTickRef.current = refreshTick;
    const startValue = 0;
    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const current = Math.round(startValue + (nextValue - startValue) * progress);
      setDisplayValue(current);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [value, isRefreshing, refreshTick, duration]);

  if (isRefreshing) {
    return (
      <span
        className="inline-block h-5 w-12 rounded bg-gray-200 animate-pulse"
        aria-label="Refreshing"
      />
    );
  }

  return <span className="tabular-nums">{displayValue}</span>;
};

const Dashboard = () => {
  const user = useSelector(state => state.auth.user);
  const token = user?.token;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const MASTER_STATUSES = [
    'Processing',
    'Pending',
    'Approved',
    'Completed',
    'Rejected',
    'Error'
  ];

  // Cache for stats data
  const statsCache = useRef(new Map());
  const cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout

  const defaultFilters = useMemo(() => ({
    fromDate: '',
    toDate: '',
    status: '',
    stage: '',
    userId: '',
    tenantId: '',
  }), []);

  const [filters, setFilters] = useState(defaultFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [allStatusValues, setAllStatusValues] = useState([]);
  
  // Advanced filter state
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  
  // Track whether we are using the implicit 1-month default date range
  // It becomes false once the user explicitly applies dates via the filter panel
  // It resets to true when the user clears all filters
  const [isDefaultDateRange, setIsDefaultDateRange] = useState(
    () => !defaultFilters.fromDate && !defaultFilters.toDate
  );
  
  // State for default date range popover
  const [showNotePopover, setShowNotePopover] = useState(false);
  const noteRef = useRef(null);

  // Performance monitoring
  const mountTimeRef = useRef(null);

  useEffect(() => {
    mountTimeRef.current = performance.now();

    return () => {
      if (mountTimeRef.current) {
        const renderTime = performance.now() - mountTimeRef.current;
      }
    };
  }, []);

  // Memoize the dropdown data fetching
  const fetchDropdownData = useCallback(async () => {
    if (!token) return;
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const fetchUsers = async () => {
      if (['super_admin', 'tenant_admin', 'account_manager'].includes(user.role)) {
        let url = `/api/v1/tables/ap_users`;
        if (user.role === 'tenant_admin' || user.role === 'account_manager') {
          url += `?tenant_id=eq.${user.tenantId}`;
        }
        try {
          const res = await axios.get(url, config);
          setUsers(res.data || []);
        } catch (error) { /* Failed to fetch users */ }
      }
    };

    const fetchTenants = async () => {
      if (user.role === 'super_admin') {
        try {
          const res = await axios.get(`/api/v1/tables/ap_tenants`, config);
          setTenants(res.data || []);
        } catch (error) { /* Failed to fetch tenants */ }
      }
    };

    // Don't block the UI for dropdown data - fetch in background
    Promise.all([fetchUsers(), fetchTenants()]);
  }, [user, token]);

  // Memoize the function to fetch unique status values
  const fetchUniqueStatusValues = useCallback(async () => {
    if (!token) {
      console.warn('No token available for fetching unique status values');
      // Fallback to default status options if no token
      const fallbackStatusOptions = [
        { value: 'Processing', label: 'Processing' },
        { value: 'Pending', label: 'Pending' },
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Completed', label: 'Completed' },
        { value: 'Error', label: 'Error' },
      ];
      setAllStatusValues(fallbackStatusOptions.map(opt => opt.value));
      return;
    }

    const config = { headers: { Authorization: `Bearer ${token}` } };

    try {
      // Build base URL for fetching status values
      let statusUrl = `/api/v1/tables/ap_documents?select=status`;

      // Add role-based filters
      if (user.role === 'account_user') {
        if (!user.user_id || !user.tenantId) {
          console.warn('Missing user_id or tenantId for account_user role');
          return;
        }
        statusUrl += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
      } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
        if (!user.tenantId) {
          console.warn('Missing tenantId for account_manager or tenant_admin role');
          return;
        }
        statusUrl += `&tenant_id=eq.${user.tenantId}`;
      }
      // Super admin needs no additional filter

      const res = await axios.get(statusUrl, config);

      // Extract unique status values and filter out null/empty values
      const uniqueStatuses = [...new Set(res.data.map(doc => doc.status).filter(status => status !== null && status !== undefined && status !== ''))];

      // Create status options for the dropdown
      const statusOptions = uniqueStatuses.map(status => ({
        value: status,
        label: status
      }));

      // If no unique statuses are found, use a default set
      if (statusOptions.length === 0) {
        console.warn('No unique status values found in database, using defaults');
        const fallbackStatusOptions = [
          { value: 'Processing', label: 'Processing' },
          { value: 'Pending', label: 'Pending' },
          { value: 'Approved', label: 'Approved' },
          { value: 'Rejected', label: 'Rejected' },
          { value: 'Completed', label: 'Completed' },
          { value: 'Error', label: 'Error' },
        ];
        setAllStatusValues(fallbackStatusOptions.map(opt => opt.value));
      } else {
        const mergedStatuses = Array.from(
          new Set([
            ...MASTER_STATUSES,
            ...uniqueStatuses.map(s => s?.trim())
          ])
        );

        setAllStatusValues(mergedStatuses);

      }
    } catch (error) {
      console.error('Error fetching unique status values:', error);

      // Log more specific error information
      if (error.response) {
        console.error('API Response Error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('Network Error:', error.request);
      } else {
        console.error('General Error:', error.message);
      }

      // Fallback to default status options if fetching fails
      const fallbackStatusOptions = [
        { value: 'Processing', label: 'Processing' },
        { value: 'Pending', label: 'Pending' },
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Completed', label: 'Completed' },
        { value: 'Error', label: 'Error' },
      ];
      setAllStatusValues(fallbackStatusOptions.map(opt => opt.value));
    }
  }, [user, token]);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  // Create a cache key based on filters and user context
  const getCacheKey = useCallback((filtersOverride = filters) => {
    return JSON.stringify({
      userId: user?.user_id,
      tenantId: user?.tenantId,
      role: user?.role,
      filters: filtersOverride
    });
  }, [user, filters]);

  // Memoize the stats fetching with caching
  const fetchStats = useCallback(async (useCache = true, filtersOverride = filters) => {
    if (!user || !token) {
      setLoading(false);
      return;
    }

    const cacheKey = getCacheKey(filtersOverride);

    // Check if we have valid cached data
    if (useCache) {
      const cachedData = statsCache.current.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp < cacheTimeout)) {
        setStats(cachedData.data);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Prefer': 'count=exact'
      }
    };

    try {
      // Build base filter parameters to match the SQL query
      let baseParams = [];

      // Add tenant filter if user is not super_admin
      if (user.role !== 'super_admin' && user.tenantId) {
        baseParams.push(`tenant_id=eq.${user.tenantId}`);
      }

      // Add user filter for account_user role
      if (user.role === 'account_user') {
        baseParams.push(`user_id=eq.${user.user_id}`);
      }

      // Date range filtering: use explicit appliedFilters dates, or fall back to the
      // implicit 1-month default when no date filter has been set by the user.
      const effectiveFromDate = filtersOverride.fromDate || (isDefaultDateRange ? getOneMonthAgoDate() : '');
      const effectiveToDate   = filtersOverride.toDate   || (isDefaultDateRange ? getTodayDate()       : '');

      if (effectiveFromDate && isValidDateFormat(effectiveFromDate)) {
        try {
          const fromDate = new Date(effectiveFromDate);
          fromDate.setHours(0, 0, 0, 0); // Set to start of day
          const isoFromDate = fromDate.toISOString();
          baseParams.push(`created_at=gte.${isoFromDate}`);
        } catch (e) {
          /* Invalid fromDate for filtering */
        }
      }

      if (effectiveToDate && isValidDateFormat(effectiveToDate)) {
        try {
          const toDate = new Date(effectiveToDate);
          toDate.setHours(23, 59, 59, 999); // Set to end of day
          const isoToDate = toDate.toISOString();
          baseParams.push(`created_at=lte.${isoToDate}`);
        } catch (e) {
          /* Invalid toDate for filtering */
        }
      }

      // Add status and stage filters from dashboard filters
      if (filtersOverride.status) {
        baseParams.push(`status=eq.${filtersOverride.status}`);
      }
      if (filtersOverride.stage) {
        baseParams.push(`stage=eq.${filtersOverride.stage}`);
      }

      // Add user and tenant filters from dashboard filters
      if (filtersOverride.userId) {
        baseParams.push(`user_id=eq.${filtersOverride.userId}`);
      }
      if (filtersOverride.tenantId) {
        baseParams.push(`tenant_id=eq.${filtersOverride.tenantId}`);
      }

      // Function to get total count respecting default date range filter
      const getTotalCount = async () => {
        // Build base parameters with role-based filters and tenant/user filters if applicable
        let totalParams = [];

        // Add tenant filter if user is not super_admin
        if (user.role !== 'super_admin' && user.tenantId) {
          totalParams.push(`tenant_id=eq.${user.tenantId}`);
        }

        // Add tenant filter from dashboard filters if user is super_admin
        if (user.role === 'super_admin' && filtersOverride.tenantId) {
          totalParams.push(`tenant_id=eq.${filtersOverride.tenantId}`);
        }

        // Add user filter for account_user role
        if (user.role === 'account_user') {
          totalParams.push(`user_id=eq.${user.user_id}`);
        }

        // Add user filter from dashboard filters if applicable
        if (filtersOverride.userId) {
          totalParams.push(`user_id=eq.${filtersOverride.userId}`);
        }

        // Add date filters respecting default date range
        const effectiveFromDate = filtersOverride.fromDate || (isDefaultDateRange ? getOneMonthAgoDate() : '');
        const effectiveToDate   = filtersOverride.toDate   || (isDefaultDateRange ? getTodayDate()       : '');

        if (effectiveFromDate && isValidDateFormat(effectiveFromDate)) {
          try {
            const fromDate = new Date(effectiveFromDate);
            fromDate.setHours(0, 0, 0, 0); // Set to start of day
            const isoFromDate = fromDate.toISOString();
            totalParams.push(`created_at=gte.${isoFromDate}`);
          } catch (e) {
            /* Invalid fromDate for filtering */
          }
        }

        if (effectiveToDate && isValidDateFormat(effectiveToDate)) {
          try {
            const toDate = new Date(effectiveToDate);
            toDate.setHours(23, 59, 59, 999); // Set to end of day
            const isoToDate = toDate.toISOString();
            totalParams.push(`created_at=lte.${isoToDate}`);
          } catch (e) {
            /* Invalid toDate for filtering */
          }
        }

        totalParams.push('limit=1'); // We only need the count

        const url = `/api/v1/tables/ap_documents?${totalParams.join('&')}`;

        try {
          const res = await axios.get(url, config);
          const contentRange = res.headers['content-range'];

          if (contentRange) {
            // Extract the total count from content-range like "0-9/42" or "bytes 0-9/42"
            const match = contentRange.match(/\/(\d+)$/);
            if (match && match[1]) {
              return parseInt(match[1], 10);
            }
          }

          return 0;
        } catch (err) {
          return 0;
        }
      };

      // Function to get count for specific status
      const getStatusCount = async (status) => {
        let params = [...baseParams];
        if (status) {
          params.push(`status=ilike.${status}`);
        }
        params.push('limit=1'); // We only need the count

        const url = `/api/v1/tables/ap_documents?${params.join('&')}`;

        try {
          const res = await axios.get(url, config);
          const contentRange = res.headers['content-range'];

          if (contentRange) {
            // Extract the total count from content-range like "0-9/42" or "bytes 0-9/42"
            const match = contentRange.match(/\/(\d+)$/);
            if (match && match[1]) {
              return parseInt(match[1], 10);
            }
          }

          return 0;
        } catch (err) {
          return 0;
        }
      };

      // Function to get count for specific stage
      const getStageCount = async (stage) => {
        let params = [...baseParams];
        if (stage) {
          params.push(`stage=eq.${stage}`);
        }
        params.push('limit=1'); // We only need the count

        const url = `/api/v1/tables/ap_documents?${params.join('&')}`;

        try {
          const res = await axios.get(url, config);
          const contentRange = res.headers['content-range'];

          if (contentRange) {
            // Extract the total count from content-range like "0-9/42" or "bytes 0-9/42"
            const match = contentRange.match(/\/(\d+)$/);
            if (match && match[1]) {
              return parseInt(match[1], 10);
            }
          }

          return 0;
        } catch (err) {
          return 0;
        }
      };

      // Get total count without any user-applied filters (this should remain constant)
      const totalUploaded = await getTotalCount();

      // Calculate counts for all unique status values (these are affected by filters)
      const statusCounts = {};
      for (const status of allStatusValues) {
        const count = await getStatusCount(status);
        statusCounts[status] = count;
        // Debug logging
        // console.log(`Status: ${status}, Count: ${count}`);
      }

      // Get stage counts (these are affected by filters)
      const newStageCount = await getStageCount('New');
      const reviewStageCount = await getStageCount('Review');
      const uploadStageCount = await getStageCount('Upload');

      // Get additional stage counts
      const uploadedStageCount = await getStageCount('Uploaded');
      const extractionStageCount = await getStageCount('Extraction');
      const verificationStageCount = await getStageCount('Verification');
      const erpStageCount = await getStageCount('ERP');
      const postedStageCount = await getStageCount('Posted');

      // Adjust stage counts
      const adjustedNewStageCount = newStageCount + uploadedStageCount + extractionStageCount;
      const adjustedReviewStageCount = reviewStageCount + verificationStageCount;
      const adjustedUploadStageCount = uploadStageCount + erpStageCount + postedStageCount;

      const stageCounts = {
        new: adjustedNewStageCount,
        review: adjustedReviewStageCount,
        upload: adjustedUploadStageCount
      };

      const statsData = {
        totalUploaded,
        ...statusCounts, // Spread all dynamic status counts into the stats object
        stageData: stageCounts
      };

      // Cache the data
      statsCache.current.set(cacheKey, {
        data: statsData,
        timestamp: Date.now()
      });

      setStats(statsData);
    } catch (err) {
      setStats({});
    } finally {
      setLoading(false);
    }
  }, [user, token, filters, allStatusValues, getCacheKey, isDefaultDateRange]);

  // Debounced version of fetchStats to prevent excessive API calls
  const debouncedFetchStats = useDebounce(fetchStats, 300);

  useEffect(() => {
    if (user && user.TableConfigExists) {
      fetchUniqueStatusValues(); // Fetch unique status values first
    } else if (user) {
      setLoading(false);
    }
  }, [user, token, filters, fetchUniqueStatusValues]);

  // Run debouncedFetchStats after allStatusValues have been set
  useEffect(() => {
    if (user && user.TableConfigExists && allStatusValues.length > 0) {
      debouncedFetchStats();
    }
  }, [user, token, filters, allStatusValues, debouncedFetchStats, isDefaultDateRange]);

  const handleFilterChange = (key, value) => {
    setDraftFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    setFilters(draftFilters);
    setAppliedFilters(draftFilters);
    // Update default date range state - becomes false when user explicitly sets dates
    if (draftFilters.fromDate || draftFilters.toDate) {
      setIsDefaultDateRange(false);
    }
    setIsFilterPanelOpen(false);
  };

  // onClearAll — clears non-default fields (status, stage, userId, tenantId),
  // preserves default date fields as-is, applies immediately and closes panel
  const handleClearAll = (newValues) => {
    statsCache.current.clear(); // Bust stale cache so the next fetch hits the server
    setDraftFilters(newValues);
    setFilters(newValues);
    setAppliedFilters(newValues);
    // isDefaultDateRange intentionally unchanged — dates weren't touched
    setIsFilterPanelOpen(false);
  };

  // onClearDefaults — zeroes default date fields, preserves other filters,
  // applies immediately and closes panel
  const handleClearDefaults = (newValues) => {
    statsCache.current.clear(); // Bust stale cache so the next fetch hits the server
    setDraftFilters(newValues);
    setFilters(newValues);
    setAppliedFilters(newValues);
    setIsDefaultDateRange(false);
    setIsFilterPanelOpen(false);
  };

  const resetFilters = () => {
    statsCache.current.clear(); // Bust stale cache so the next fetch hits the server
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setDraftFilters(defaultFilters);
    // Reset to default date range when clearing filters
    setIsDefaultDateRange(false);
  };

  // hasActiveFilters — don't treat fields still at their known default values as active
  // so the "Clear" button only appears when the user has made meaningful filter changes
  const hasActiveFilters = useMemo(() => {
    const knownDefaults = {
      fromDate: getOneMonthAgoDate(),
      toDate: getTodayDate(),
    };
    return Object.entries(appliedFilters).some(([key, value]) => {
      if (!value) return false;
      if (knownDefaults[key] && value === knownDefaults[key]) return false;
      return true;
    });
  }, [appliedFilters]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setIsFilterPanelOpen(false);
    statsCache.current.clear();
    setShowNotePopover(false);

    try {
      // Only refresh the data without clearing filters
      await fetchUniqueStatusValues();
      await fetchStats(false, appliedFilters);
      setRefreshTick((prev) => prev + 1);
    } finally {
      setIsRefreshing(false);
    }
  }, [appliedFilters, fetchStats, fetchUniqueStatusValues]);


  // Dynamic status cards — each status name is hashed to its colour so
  // "Processing" is always the same colour here and in every other component.
  const statusCardsConfig = useMemo(() => {
    resetUsedIcons();

    const totalCard = {
      id: 'total',
      label: 'Total Uploaded',
      value: stats?.totalUploaded || 0,
      color: getStatusColor('total'),
      statusType: 'total',
    };

    const dynamicStatusCards = allStatusValues.map((status) => ({
      id: status,
      label: status,
      value: stats?.[status] ?? 0,
      color: getStatusColor(status),
      statusType: status,
    }));

    return [totalCard, ...dynamicStatusCards];
  }, [stats, allStatusValues]);

  const activeFilters = useMemo(() => {
    const active = [];
    if (filters.fromDate) active.push({ label: 'From', value: filters.fromDate });
    if (filters.toDate) active.push({ label: 'To', value: filters.toDate });
    if (filters.status) active.push({ label: 'Status', value: filters.status });
    if (filters.stage) active.push({ label: 'Stage', value: filters.stage });
    if (filters.userId && users.length > 0) {
      const userName = users.find(u => u.id == filters.userId)?.user_name || filters.userId;
      active.push({ label: 'User', value: userName });
    }
    if (filters.tenantId && tenants.length > 0) {
      const tenantName = tenants.find(t => t.tenant_id == filters.tenantId)?.tenant_name || filters.tenantId;
      active.push({ label: 'Tenant', value: tenantName });
    }
    return active;
  }, [filters, users, tenants]);

  // Initialize draft filters when applied filters change
  useEffect(() => {
    setDraftFilters(appliedFilters);
  }, [appliedFilters]);

  // Click outside handler for popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (noteRef.current && !noteRef.current.contains(e.target)) {
        setShowNotePopover(false);
      }
    };
    
    if (showNotePopover) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showNotePopover]);

  // Get filter fields configuration
  const filterFields = useFilterFields(user, allStatusValues, users, tenants);

  // Show loading spinner only on initial load, not on filter changes
  if (!user || (loading && !stats)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-4">
        {/* Compact loading spinner */}
        <div className="relative">
          {/* Main spinner */}
          <div className="h-12 w-12 rounded-full border-3 border-gray-200 border-t-blue-600 animate-spin"></div>

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <LayoutGrid size={18} className="text-blue-600" />
          </div>
        </div>

        {/* Loading text and dots */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-gray-600 text-sm font-medium">Loading Dashboard</p>

          {/* Simple 3-dot loader */}
          <div className="flex space-x-1">
            <div className="h-1.5 w-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="h-1.5 w-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="h-1.5 w-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // console.log("UUser", user)
  if (!user.TableConfigExists) {
    return (
      <div className="p-6 max-w-lg mx-auto my-8 bg-indigo-50 border border-indigo-200 rounded-xl shadow-lg flex flex-col items-center text-center">
        <div className="bg-indigo-100 p-3 rounded-full mb-4"> <LayoutGrid size={36} className="text-indigo-600" /> </div>
        <h2 className="text-xl font-semibold text-black mb-2">Process Not Configured</h2>
        <p className="text-gray-600 text-sm leading-relaxed"> {user.role === 'tenant_admin' ? "Your processes are not configured yet. Please navigate to the 'Configurations' menu to set up your extraction fields." : "Your manager has not yet configured the extraction processes. Please contact your manager to complete the setup."} </p>
      </div>
    );
  }

  const pieData = { labels: ['New', 'Review', 'Upload'], datasets: [{ data: [stats?.stageData?.new || 0, stats?.stageData?.review || 0, stats?.stageData?.upload || 0], backgroundColor: [getStatusColor('new').hex + 'cc', getStatusColor('review').hex + 'cc', getStatusColor('upload').hex + 'cc'], borderColor: [getStatusColor('new').hex + '66', getStatusColor('review').hex + '66', getStatusColor('upload').hex + '66'], borderWidth: 1, hoverOffset: 12 }] };
  // Bar chart — each status bar uses getStatusColor so it matches StatusCards exactly
  const barData = {
    labels: allStatusValues,
    datasets: [{
      label: 'Document Count',
      data: allStatusValues.map(status => stats?.[status] || 0),
      backgroundColor: allStatusValues.map((status) => getStatusColor(status).hex + 'bf'),
      borderColor:     allStatusValues.map((status) => getStatusColor(status).hex + '66'),
      borderWidth: 1, borderRadius: 6, barThickness: 20,
    }]
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#6b7280',
          font: { size: 11, family: 'Poppins, sans-serif', weight: '500' },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#6b7280',
        bodyColor: '#6b7280',
        borderColor: '#f0f2f5',
        borderWidth: 1,
        bodyFont: { family: 'Poppins, sans-serif', size: 11 },
        titleFont: { family: 'Poppins, sans-serif', size: 12, weight: '600' },
        padding: 10,
        boxPadding: 5,
        displayColors: true,
        cornerRadius: 6,
      }
    }
  };

  // Calculate how many legend items should be in each row (similar to card arrangement)
  const itemsPerRow = 5; // Similar to maxCardsPerRow logic but with 5 as requested

  const barOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        position: 'bottom',
        labels: {
          ...chartOptions.plugins.legend.labels,
          // Generate labels from the actual status values
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels && data.labels.length > 0) {
              return data.labels.map((label, i) => {
                const backgroundColors = data.datasets[0].backgroundColor;
                const borderColors = data.datasets[0].borderColor;

                return {
                  text: label,
                  fillStyle: backgroundColors[i],
                  strokeStyle: borderColors[i],
                  lineWidth: 1,
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                };
              });
            }
            return [];
          },
          // Wrap legend items similar to card arrangement - max 5 per row
          padding: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          // Set max width to encourage wrapping after 5 items
          boxWidth: 12,
          font: {
            size: 11,
            family: 'Poppins, sans-serif',
            weight: '500'
          }
        },
        // Display legend in multiple rows, similar to card arrangement
        display: false,
      },
      // Custom plugin to control legend layout - wrap after 5 items like cards
      afterLayout: (chart) => {
        // Attempt to style the legend container to wrap after specific number of items
        const legendItems = chart.legend.legendItems;
        if (legendItems && legendItems.length > itemsPerRow) {
          // This is handled by CSS, so we ensure the container allows wrapping
          if (chart.legend.legendGroup && chart.legend.legendGroup._parent) {
            const legendContainer = chart.legend.legendGroup._parent;
            if (legendContainer.el && legendContainer.el.style) {
              legendContainer.el.style.display = 'flex';
              legendContainer.el.style.flexWrap = 'wrap';
              legendContainer.el.style.justifyContent = 'center';
              legendContainer.el.style.gap = '10px';
            }
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          maxTicksLimit: 8,
          color: '#c9cdd4',
          font: { family: 'Poppins, sans-serif', weight: '400', size: 10 }
        },
        grid: { color: '#f3f5f8', drawBorder: false },
        afterDataLimits: (scale) => {
          const chart = scale.chart;
          const data  = chart.data.datasets[0]?.data || [];
          const vals  = data.filter((_, i) => chart.getDataVisibility(i));
          const max   = vals.length ? Math.max(...vals) : 0;
          scale.max   = max > 0 ? Math.ceil(max * 1.18) : 1;
          scale.min   = 0;
        },
      },
      x: {
        ticks: {
          color: '#c9cdd4',
          font: { family: 'Poppins, sans-serif', weight: '400', size: 10 },
          maxRotation: 45,
          minRotation: 45
        },
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
            
        /* Multi-row legend for document status chart - wrap after 5 items */
        .chart-legend {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
        }
                
        .chart-legend ul {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 1rem;
          margin: 0;
          padding: 0;
        }
                
        .chart-legend li {
          display: flex;
          align-items: center;
          margin: 0.25rem;
          white-space: nowrap;
        }
                
        .chart-legend .chartjs-legend {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
        }
                
        .chart-legend .chartjs-legend ul {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
        }
                
        .chart-legend .legend-container {
          width: 100%;
        }
                
        .chart-legend .legend {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
        }
      `}</style>
      <AdvancedFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        title="Filter Dashboard"
        filterFields={filterFields}
        values={draftFilters}
        onChange={handleFilterChange}
        onApply={handleApplyFilters}
        onClearAll={handleClearAll}
        onClearDefaults={handleClearDefaults}
      />
      <div className="min-h-screen bg-slate-50 p-4 sm:p-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <div className=" mx-auto">
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-y-2 mb-4">
              <h2 className="text-base font-medium text-gray-600 flex-shrink-0" data-tour="dashboard-header">Processing Summary</h2>

              {/* Center: default date-range badge */}
              <div className="flex-1 flex justify-center min-w-0 px-2">
                {isDefaultDateRange && (
                  <div ref={noteRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowNotePopover(v => !v)}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-100 rounded-md text-[10px] sm:text-[11px] font-normal text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Info size={11} className="flex-shrink-0" />
                      <span className="hidden sm:inline">Last 1 month ({getOneMonthAgoDate()} → {getTodayDate()})</span>
                      <span className="sm:hidden">Last 1 month</span>
                    </button>

                    {/* Popover detail */}
                    {showNotePopover && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-64 sm:w-72 bg-white border border-blue-100 rounded-lg shadow-xl p-3.5 text-xs">
                        {/* Arrow */}
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-blue-100 rotate-45 block" />
                        <p className="flex items-center gap-1 font-medium text-blue-700 mb-1.5">
                          <Info size={12} /> Default Date Filter Active
                        </p>
                        <p className="text-gray-600 leading-relaxed">
                          Documents are currently filtered to the{' '}
                          <span className="font-medium text-gray-800">last 1 month</span>{' '}
                          ({getOneMonthAgoDate()} → {getTodayDate()}) by default.
                          To view a different range, open{' '}
                          <span className="font-medium text-indigo-600">Advanced Filters</span>{' '}
                          and update the From / To date fields.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: action buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
                {hasActiveFilters && (
                  <Button
                    onClick={resetFilters}
                    color="red"
                    variant="solid"
                    size="xs"
                    icon={X}
                    data-tour="clear-filters-button"
                  >
                    <span className="hidden sm:inline">Clear Filters</span>
                    <span className="sm:hidden">Clear</span>
                  </Button>
                )}
                <Button
                  onClick={() => {
                    // Pre-fill draft with default dates so they're visible in the panel
                    if (isDefaultDateRange) {
                      setDraftFilters(prev => ({
                        ...prev,
                        fromDate: prev.fromDate || getOneMonthAgoDate(),
                        toDate:   prev.toDate   || getTodayDate(),
                      }));
                    }
                    setIsFilterPanelOpen(true);
                    setShowNotePopover(false);
                  }}
                  color="indigo"
                  variant="solid"
                  size="xs"
                  icon={Filter}
                  data-tour="filter-dashboard-button"
                >
                  <span className="hidden sm:inline">Filter Dashboard</span>
                  <span className="sm:hidden">Filters</span>
                </Button>
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  color="indigo"
                  variant="outline"
                  size="xs"
                  icon={RefreshCw}
                >
                  <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </Button>
              </div>
            </div>

            <div className='mb-3'>
              {user?.role !== 'super_admin' && <AgentStatusDrawer />}
            </div>
            
            <BalancedCardGrid
              items={statusCardsConfig}
              renderCard={(stat) => (
                <StatusCard
                  key={stat.id}
                  label={stat.label}
                  value={(
                    <AnimatedCounter
                      value={stat.value}
                      isRefreshing={isRefreshing}
                      refreshTick={refreshTick}
                    />
                  )}
                  color={stat.color}
                  statusType={stat.statusType}
                />
              )}
              maxCardsPerRow={7}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-2">
            {/* <div className="lg:col-span-1 bg-white p-4 rounded-md shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-600 flex items-center mb-4"><PieChart size={16} className="mr-1.5 text-blue-300" />Document Stage Distribution</h3>
              <div className="h-[250px] w-full flex justify-center items-center" data-tour="document-stage-chart"><Pie data={pieData} options={chartOptions} /></div>
            </div> */}
            <div className={`bg-white p-4 rounded-md shadow-sm border border-gray-100 ${user?.role !== 'account_user' && user?.role !== 'account_manager' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <h3 className="text-sm font-medium text-gray-600 flex items-center mb-4"><BarChart3 size={16} className="mr-1.5 text-emerald-300" />Document Status Outcomes</h3>
              <div className="h-[250px] w-full" data-tour="document-status-chart">
                <Bar data={barData} options={barOptions} plugins={[htmlLegendPlugin]} />
              </div>
              <div id="chart-legend-container" className="w-full"></div>
            </div>
            {user?.role !== 'account_user' && user?.role !== 'account_manager' && (
              <div className="lg:col-span-1 bg-white p-4 rounded-md shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-600 flex items-center mb-4"><Users size={16} className="mr-1.5 text-purple-300" />Users Overview</h3>
                <div className="h-[250px] overflow-y-auto custom-scrollbar">
                  <OverviewChart variant={user?.role === 'super_admin' ? 'super_admin' : 'tenant_admin'} compact={true} />
                </div>
              </div>
            )}
          </div>

          <div className="mb-4">
            <InvoicePerformanceGraph />
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
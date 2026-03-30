import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ViewDocumentModal from '../View/ViewDocumentModal';
import {
    Filter,
    X,
    Calendar,
    User,
    DollarSign,
    ListFilter,
    Loader2,
    Eye,
    RefreshCw,
    AlertCircle,
    Info,
    ArrowUpDown
} from 'lucide-react';
import TableComponent from '../common/TableComponent';
import StatusBadge from '../common/StatusBadge';
import { canUserView } from '../../permissions';
import axios from '../../utils/authInterceptor';
import { encryptId } from '../../utils/cryptoUtils';
import { useSelector } from 'react-redux';
import { toast, ToastContainer } from 'react-toastify';
import { formatFileName, normalizeFileSearch, isValidFileNameSearch } from '../../utils/fileUtils';
import { apiBaseUrl } from '../../config/apiConfig';
import ColorLegend from '../common/ColorLegend';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import { formatDate, formatDateTime, getDefaultDateRangeFilter, getOneMonthAgoDate, getTodayDate, isValidDateFormat } from '../../utils/dateUtils';
import MessageCell from '../common/MessageCell';
import StageDisplay from '../common/StageDisplay';
import AdvancedFilterPanel from '../common/AdvancedFilterPanel';
import Button from '../common/Button';

// Parse error_desc helper function (keep this in FinalQueue.jsx since it handles JSONB parsing)
const parseErrorDesc = (errorDescObj) => {
    if (!errorDescObj || !errorDescObj.value) return null;
    try {
        return typeof errorDescObj.value === 'string'
            ? JSON.parse(errorDescObj.value)
            : errorDescObj.value;
    } catch (e) {
        console.error("Error parsing error_desc:", e);
        return null;
    }
};



// ─── PER-FIELD CONFLICT MAPS ──────────────────────────────────────────────────
// Column filter key → advanced filter keys to clear when that column is committed
const COLUMN_TO_ADVANCED_CONFLICT_FQ = {
    status:      ['status'],
    vendor_name: ['vendor'],
    total:       ['amount_min', 'amount_max'],
    created_at:  ['from_date', 'to_date'],
};

// Advanced filter key → column filter keys to clear when that advanced field is applied
const ADVANCED_TO_COLUMN_CONFLICT_FQ = {
    status:     ['status'],
    vendor:     ['vendor_name'],
    amount_min: ['total'],
    amount_max: ['total'],
    from_date:  ['created_at'],
    to_date:    ['created_at'],
};
// ─────────────────────────────────────────────────────────────────────────────

const FinalQueue = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Initialize state from URL parameters
    const getInitialPage = () => {
        const pageParam = searchParams.get('page');
        return pageParam ? parseInt(pageParam, 10) : 1;
    };

    // New states for tracking full dataset message counts
    const [duplicateBillCount, setDuplicateBillCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const [warningCount, setWarningCount] = useState(0);
    const [successCount, setSuccessCount] = useState(0);

    const getInitialPageSize = () => {
        const pageSizeParam = searchParams.get('pageSize');
        return pageSizeParam ? parseInt(pageSizeParam, 10) : 10;
    };

    const getInitialSortField = () => {
        return searchParams.get('sortField') || 'invoice_id';
    };

    const getInitialSortAsc = () => {
        const sortAscParam = searchParams.get('sortAsc');
        return sortAscParam ? sortAscParam === 'true' : false;
    };

    const getInitialColumnFilters = () => {
        const filters = {};
        const invoice_id = searchParams.get('invoice_id');
        if (invoice_id) filters.invoice_id = invoice_id;

        const invoice_no = searchParams.get('invoice_no');
        if (invoice_no) filters.invoice_no = invoice_no;

        const po_no = searchParams.get('po_no');
        if (po_no) filters.po_no = po_no;

        const vendor_name = searchParams.get('vendor_name');
        if (vendor_name) filters.vendor_name = vendor_name;

        const invoice_date = searchParams.get('invoice_date');
        if (invoice_date) filters.invoice_date = invoice_date;

        const file_path = searchParams.get('file_path');
        if (file_path) filters.file_path = file_path;

        const file_name = searchParams.get('file_name');
        if (file_name) filters.file_name = file_name;

        const created_at = searchParams.get('created_at');
        if (created_at) filters.created_at = created_at;

        const status = searchParams.get('status');
        if (status) filters.status = status;

        const total = searchParams.get('total');
        if (total) filters.total = total;

        const userName = searchParams.get('userName');
        if (userName) filters.userName = userName;

        const tenantName = searchParams.get('tenantName');
        if (tenantName) filters.tenantName = tenantName;

        return filters;
    };

    const getInitialAdvancedFilters = () => {
        const filters = {};
        const from_date = searchParams.get('from_date');
        filters.from_date = from_date || '';

        const to_date = searchParams.get('to_date');
        filters.to_date = to_date || '';

        const vendor = searchParams.get('adv_vendor');
        filters.vendor = vendor || '';

        const status = searchParams.get('adv_status');
        filters.status = status || '';

        const amount_min = searchParams.get('amount_min');
        filters.amount_min = amount_min || '';

        const amount_max = searchParams.get('amount_max');
        filters.amount_max = amount_max || '';

        return filters;
    };

    // State to hold the invoices data, including document details
    const [invoices, setInvoices] = useState([]);
    const [page, setPage] = useState(getInitialPage());
    const [pageSize, setPageSize] = useState(getInitialPageSize()); // Added for pagination
    const [totalCount, setTotalCount] = useState(0); // Added for pagination
    const [modalOpen, setModalOpen] = useState(false);
    const [docUrl, setDocUrl] = useState('');
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [showSortOptions, setShowSortOptions] = useState(false); // New state for sort options
    const [sortField, setSortField] = useState(getInitialSortField());
    const [sortAsc, setSortAsc] = useState(getInitialSortAsc());
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingResults, setUpdatingResults] = useState(false); // New state for updating results indicator
    // New state for storing all unique status values from the database
    const [allStatusValues, setAllStatusValues] = useState([]);
    const [activeTooltipId, setActiveTooltipId] = useState(null);
    const [showNotePopover, setShowNotePopover] = useState(false);
    const noteRef = useRef(null);

    // Add state for rerun confirmation dialog
    const [showRerunDialog, setShowRerunDialog] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    const navigate = useNavigate();
    const user = useSelector(state => state.auth.user);
    const token = user?.token;
    const hasViewPermission = user ? canUserView(user.role, '/final_queue') : false;

    // State for column-specific and advanced filters
    const [columnFilters, setColumnFilters] = useState({
        invoice_id: '',
        invoice_no: '',
        po_no: '',
        vendor_name: '',
        invoice_date: '',
        file_path: '',
        file_name: '',
        created_at: '',
        status: '',
        total: '',
        userName: '', // New filter state
        tenantName: '', // New filter state
        ...getInitialColumnFilters()
    });

    // Add debounced column filters state
    const [debouncedColumnFilters, setDebouncedColumnFilters] = useState(columnFilters);

    // Add ref for debouncing
    const filterTimeoutRef = useRef(null);

    // FIX: Ref to track which filter mode is active ("column", "advanced", or null)
    // Prevents filter clearing cascade when switching between filter types
    const filterModeRef = useRef(null);

    const defaultAdvancedFilters = {
        from_date: '',
        to_date: '',
        vendor: '',
        status: '',
        amount_min: '',
        amount_max: '',
    };

    const [draftFilters, setDraftFilters] = useState({
        ...defaultAdvancedFilters,
        ...getInitialAdvancedFilters(),
    });

    const [appliedFilters, setAppliedFilters] = useState({
        ...defaultAdvancedFilters,
        ...getInitialAdvancedFilters(),
    });

    // true  = implicit 1-month range is active (no explicit dates chosen)
    // false = user has set their own date range via Advanced Filters
    // Also persisted in the URL so that Back-navigation from the editor restores it correctly.
    const getInitialIsDefaultDateRange = () => {
        const urlParam = searchParams.get('defaultDateRange');
        if (urlParam === 'false') return false;
        const initialAdv = getInitialAdvancedFilters();
        return !initialAdv.from_date && !initialAdv.to_date;
    };
    const [isDefaultDateRange, setIsDefaultDateRange] = useState(getInitialIsDefaultDateRange);

    // Initialize state from URL parameters when component mounts
    useEffect(() => {
        // This will ensure state is properly initialized from URL parameters on mount
        // The state initialization functions already handle this, so we don't need to do anything here
        // This useEffect is just to make sure we're responding to URL changes
    }, []); // Run only once on mount

    // Update URL parameters when state changes
    useEffect(() => {
        // Skip URL update on initial mount
        if (!hasMountedRef.current) {
            return;
        }

        const params = new URLSearchParams();

        // Add pagination params
        if (page !== 1) params.set('page', page.toString());
        if (pageSize !== 10) params.set('pageSize', pageSize.toString());

        // Add sort params
        if (sortField !== 'invoice_id') params.set('sortField', sortField);
        if (sortAsc) params.set('sortAsc', sortAsc.toString());

        // Add column filters - USE DEBOUNCED STATE FOR URL TO PREVENT FOCUS LOSS
        Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        // Add advanced filters
        Object.entries(appliedFilters).forEach(([key, value]) => {
            if (value) {
                switch (key) {
                    case 'vendor': params.set('adv_vendor', value); break;
                    case 'status': params.set('adv_status', value); break;
                    default: params.set(key, value);
                }
            }
        });

        // Persist isDefaultDateRange so Back-navigation from the editor restores it correctly
        if (!isDefaultDateRange) params.set('defaultDateRange', 'false');

        // Only update URL if there are params to set
        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, debouncedColumnFilters, appliedFilters, isDefaultDateRange, setSearchParams]);

    // Track first render to skip debounce on mount (prevents cascade of extra API calls)
    const isFirstDebounceRender = useRef(true);

    // Debounce column filters
    useEffect(() => {
        // Skip on first render — debouncedColumnFilters is already initialised to columnFilters
        // via useState. Skipping prevents a spurious extra fetch on mount.
        if (isFirstDebounceRender.current) {
            isFirstDebounceRender.current = false;
            return;
        }

        // If a programmatic filter change (Apply / Clear All / etc.) already updated
        // debouncedColumnFilters directly, skip the debounce timer entirely.
        // Without this guard the timer fires 300 ms later with the same values but a
        // new object reference, which would trigger a redundant second fetch.
        if (bypassDebounceRef.current) {
            bypassDebounceRef.current = false;
            return;
        }

        // Immediate clear: wipe stale rows and show the loading indicator the instant
        // a filter value changes — don't wait for the 300ms debounce to fire.
        // This prevents old data from remaining visible while the user is still typing.
        setInvoices([]);
        setLoading(true);
        setUpdatingResults(true);
        // Also abort any in-flight request immediately so it cannot resolve and
        // re-populate the table with stale data during the debounce window.
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        // Clear any existing timeout
        if (filterTimeoutRef.current) {
            clearTimeout(filterTimeoutRef.current);
        }

        // Set a new timeout to debounce the filter change
        filterTimeoutRef.current = setTimeout(() => {
            setDebouncedColumnFilters(columnFilters);
        }, 300); // 300ms debounce delay

        // Cleanup function
        return () => {
            if (filterTimeoutRef.current) {
                clearTimeout(filterTimeoutRef.current);
            }
        };
    }, [columnFilters]);

    // Ref to track if component has mounted (prevents URL update on initial render)
    const hasMountedRef = useRef(false);

    // Mark component as mounted (skip first URL-write render).
    // NOTE: Do NOT call setDebouncedColumnFilters here - it's already initialized
    // to columnFilters via useState to avoid a spurious extra fetch on load.
    useEffect(() => {
        hasMountedRef.current = true;
    }, []);

    // Close note popover when clicking outside
    useEffect(() => {
        if (!showNotePopover) return;
        const handler = (e) => {
            if (noteRef.current && !noteRef.current.contains(e.target)) {
                setShowNotePopover(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showNotePopover]);

    // Per-field conflict resolution is now handled directly in handleColumnFilterCommit
    // and handleApplyFilters — the blanket-clearing useEffect has been removed.

    // Add refetch trigger state for better data refresh handling
    const [refetchTrigger, setRefetchTrigger] = useState(0);

    // Ref to hold the AbortController for the current in-flight fetch.
    // Cancels the previous request whenever a new one is triggered (filter/page/sort change).
    const abortControllerRef = useRef(null);

    // When true the debounce effect skips its timer — the caller has already updated
    // debouncedColumnFilters directly, so no delayed second update (and second fetch) is needed.
    const bypassDebounceRef = useRef(false);

    // Fetches and processes invoice and document data
    useEffect(() => {
        if (user && hasViewPermission && token) {
            fetchData();
        }
    }, [user, hasViewPermission, token, page, pageSize, sortField, sortAsc, appliedFilters, debouncedColumnFilters, refetchTrigger, isDefaultDateRange]);

    // Move fetchData outside of useEffect so it can be called from confirmRerun
    const fetchData = async () => {
        if (!user || !hasViewPermission || !token) {
            setLoading(false);
            return;
        }

        // Cancel any previous in-flight request to avoid stale-data races.
        // Each new call gets its own AbortController so only the latest fetch wins.
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        // Immediately wipe old rows so stale data is never visible while the new
        // request is in flight.
        setInvoices([]);

        // Show loading spinner for every fetch (initial load and every filter/page change).
        setLoading(true);
        setUpdatingResults(true);

        // Client-side filtering is only needed for file_name (formatted name without UUID).
        // userName/tenantName are now resolved to IDs and filtered server-side.
        const needsClientSideFiltering =
            !!(debouncedColumnFilters.file_name && debouncedColumnFilters.file_name.trim());

        // Calculate offset
        const offset = (page - 1) * pageSize;

        // Pre-resolve userName/tenantName filters to IDs so they can be applied server-side,
        // keeping pagination accurate without needing to fetch all rows client-side.
        let userIdFilter = null;   // null = no filter; [] = filter active but no matches (return nothing)
        let tenantIdFilter = null;

        if (debouncedColumnFilters.userName && debouncedColumnFilters.userName.trim()) {
            try {
                const uRes = await axios.get(
                    `/api/v1/tables/ap_users?select=id&user_name=ilike.*${encodeURIComponent(debouncedColumnFilters.userName.trim())}*`,
                    { headers: { Authorization: `Bearer ${token}` }, signal }
                );
                userIdFilter = uRes.data.map(u => u.id);
            } catch (err) {
                if (axios.isCancel(err) || err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
                userIdFilter = [];
            }
        }

        if (debouncedColumnFilters.tenantName && debouncedColumnFilters.tenantName.trim()) {
            try {
                const tRes = await axios.get(
                    `/api/v1/tables/ap_tenants?select=tenant_id&tenant_name=ilike.*${encodeURIComponent(debouncedColumnFilters.tenantName.trim())}*`,
                    { headers: { Authorization: `Bearer ${token}` }, signal }
                );
                tenantIdFilter = tRes.data.map(t => t.tenant_id);
            } catch (err) {
                if (axios.isCancel(err) || err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
                tenantIdFilter = [];
            }
        }

        // Short-circuit: if a filter is active but matched nothing, return empty immediately
        if ((userIdFilter !== null && userIdFilter.length === 0) ||
            (tenantIdFilter !== null && tenantIdFilter.length === 0)) {
            setInvoices([]);
            setTotalCount(0);
            setLoading(false);
            setUpdatingResults(false);
            return;
        }

        let invoicesUrl = `/api/v1/tables/ap_invoices?select=*`;

        // ── Build the shared filter suffix ────────────────────────────────────
        // Built after ID pre-resolution so that userName/tenantName ID lists are
        // included. Reused by both the paginated main request AND the lightweight
        // legend-counts request so the ColorLegend always reflects ALL matching
        // rows across every page, not just the currently visible one.
        let filterSuffix = '';

        // Apply pre-resolved userName / tenantName as server-side ID filters
        if (userIdFilter !== null && userIdFilter.length > 0) {
            filterSuffix += `&user_id=in.(${userIdFilter.join(',')})`;
        }
        if (tenantIdFilter !== null && tenantIdFilter.length > 0) {
            filterSuffix += `&tenant_id=in.(${tenantIdFilter.join(',')})`;
        }

        // Role-based scope
        if (user.role === 'account_user') {
            filterSuffix += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
        } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
            if (!user.user_id || !user.tenantId) {
                setLoading(false);
                return;
            }
            filterSuffix += `&tenant_id=eq.${user.tenantId}`;
        }
        // Super admin needs no additional filter

        // Base filter — exclude Pending/Hold (this queue shows everything else)
        filterSuffix += `&status=not.in.(Pending,Hold)`;

        // Column filters (server-side; file_name and userName/tenantName handled elsewhere)
        Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
            if (value) {
                let filterValue;
                if (key === 'invoice_id' || key === 'total') {
                    filterValue = value;
                } else {
                    filterValue = encodeURIComponent(value);
                }

                switch (key) {
                    case 'invoice_id':
                        if (!isNaN(filterValue) && filterValue !== '') {
                            filterSuffix += `&invoice_id=eq.${filterValue}`;
                        }
                        break;
                    case 'invoice_no':
                        filterSuffix += `&invoice_no=ilike.*${filterValue}*`;
                        break;
                    case 'po_no':
                        filterSuffix += `&po_no=ilike.*${filterValue}*`;
                        break;
                    case 'vendor_name':
                        filterSuffix += `&vendor_name=ilike.*${filterValue}*`;
                        break;
                    case 'invoice_date':
                        filterSuffix += `&invoice_date=eq.${value}`;
                        break;
                    case 'file_path':
                        filterSuffix += `&file_path=ilike.*${filterValue}*`;
                        break;
                    case 'file_name':
                        // Handled client-side (formatted name without UUID)
                        break;
                    case 'created_at':
                        try {
                            const dateObj = new Date(value);
                            const isoDate = dateObj.toISOString();
                            const nextDay = new Date(dateObj);
                            nextDay.setDate(nextDay.getDate() + 1);
                            const nextDayIso = nextDay.toISOString();
                            filterSuffix += `&created_at=gte.${isoDate}&created_at=lt.${nextDayIso}`;
                        } catch (e) { /* Invalid date */ }
                        break;
                    case 'status':
                        filterSuffix += `&status=eq.${filterValue}`;
                        break;
                    case 'stage':
                        filterSuffix += `&stage=eq.${filterValue}`;
                        break;
                    case 'total':
                        filterSuffix += `&total=ilike.*${filterValue}*`;
                        break;
                    case 'userName':
                    case 'tenantName':
                        // Pre-resolved to IDs above; skip here
                        break;
                }
            }
        });

        // Advanced filters + date range
        if (Object.values(appliedFilters).some(v => v)) {
            if (appliedFilters.from_date && isValidDateFormat(appliedFilters.from_date)) {
                filterSuffix += `&created_at=gte.${appliedFilters.from_date}T00:00:00.000Z`;
            }
            if (appliedFilters.to_date && isValidDateFormat(appliedFilters.to_date)) {
                filterSuffix += `&created_at=lte.${appliedFilters.to_date}T23:59:59.999Z`;
            }
            if (appliedFilters.vendor) filterSuffix += `&vendor_name=ilike.*${encodeURIComponent(appliedFilters.vendor)}*`;
            if (appliedFilters.status) filterSuffix += `&status=eq.${encodeURIComponent(appliedFilters.status)}`;
            if (appliedFilters.amount_min) filterSuffix += `&total=gte.${encodeURIComponent(appliedFilters.amount_min)}`;
            if (appliedFilters.amount_max) filterSuffix += `&total=lte.${encodeURIComponent(appliedFilters.amount_max)}`;
        } else if (isDefaultDateRange) {
            filterSuffix += getDefaultDateRangeFilter();
        }

        // ── Sorting ──
        const effectiveSortField = sortField || 'invoice_id';
        const effectiveSortAsc = sortAsc;

        // Client-side sort needed for:
        //   1. userName / tenantName — pre-resolved to IDs for filtering, but sorting by
        //      user_id / tenant_id (integers) gives insertion order, not alphabetical order.
        //   2. file_name — derived client-side from docMap after the main fetch.
        //   3. invoice_no, po_no, vendor_name — TEXT columns; PostgreSQL lexicographic sort
        //      puts "INV-99" between "INV-998" and "INV-989" instead of after "INV-9".
        const CLIENT_SIDE_SORT_FIELDS_FQ = new Set([
            'userName', 'tenantName',           // name lookup done client-side
            'file_name',                         // derived after fetch
            'invoice_no', 'po_no', 'vendor_name', // alphanumeric TEXT — natural sort needed
        ]);
        const needsClientSideSort = CLIENT_SIDE_SORT_FIELDS_FQ.has(effectiveSortField);

        // Combined: fetch ALL rows (no server pagination) when either condition is true
        const needsAllRowsFetch = needsClientSideFiltering || needsClientSideSort;

        // Map frontend field keys to actual DB column names.
        // Client-side sort fields fall back to invoice_id (stable server order).
        let dbSortFieldMapped;
        switch (effectiveSortField) {
            case 'invoice_id':   dbSortFieldMapped = 'invoice_id';   break;
            case 'invoice_date': dbSortFieldMapped = 'invoice_date'; break;
            case 'created_at':   dbSortFieldMapped = 'created_at';   break;
            case 'status':       dbSortFieldMapped = 'status';       break;
            case 'stage':        dbSortFieldMapped = 'stage';        break;
            case 'total':        dbSortFieldMapped = 'total';        break;
            // Client-side sort fields — use invoice_id as stable server-side fallback
            case 'invoice_no':
            case 'po_no':
            case 'vendor_name':
            case 'file_name':
            case 'userName':
            case 'tenantName':   dbSortFieldMapped = 'invoice_id';   break;
            default:             dbSortFieldMapped = effectiveSortField;
        }

        let orderQuery = `${dbSortFieldMapped}.${effectiveSortAsc ? 'asc' : 'desc'}.nullslast`;
        if (effectiveSortField !== 'invoice_id') {
            orderQuery += `,invoice_id.desc`;
        }

        invoicesUrl += `&order=${orderQuery}`;

        // Pagination — skip when we need all rows for client-side sort or filtering
        if (!needsAllRowsFetch) {
            invoicesUrl += `&limit=${pageSize}&offset=${offset}`;
        }

        // Apply filter suffix to main URL
        invoicesUrl += filterSuffix;

        // ── Legend-counts URL: same filters, only error_desc, no pagination ──
        // Fetches ALL matching rows across every page so the ColorLegend
        // reflects the full filtered dataset, not just the current page.
        const legendCountsUrl =
            `/api/v1/tables/ap_invoices?select=error_desc` + filterSuffix;

        const config = {
            headers: {
                Authorization: `Bearer ${token}`,
                'Prefer': 'count=exact'
            }
        };

        try {
            // Run both requests in parallel — legend counts are non-blocking
            const [res, legendRes] = await Promise.all([
                axios.get(invoicesUrl, { ...config, signal }),
                axios.get(legendCountsUrl, { headers: { Authorization: `Bearer ${token}` }, signal }),
            ]);

            // ── Update legend counts from the full filtered dataset ──
            const legendCounts = (legendRes.data || []).reduce(
                (acc, inv) => {
                    if (!inv.error_desc) return acc;
                    try {
                        const ed = typeof inv.error_desc.value === 'string'
                            ? JSON.parse(inv.error_desc.value)
                            : (inv.error_desc.value || inv.error_desc);
                        if (!ed) return acc;
                        if (ed.Note || ed.note || ed.Note_1)                    acc.duplicate++;
                        if (ed.Error || ed.error)                               acc.error++;
                        if (ed.Warning || ed.warning || ed.Warning_1)           acc.warning++;
                        if (ed.Success || ed.success || ed.Success_1)           acc.success++;
                    } catch (_) { /* skip malformed */ }
                    return acc;
                },
                { duplicate: 0, error: 0, warning: 0, success: 0 }
            );
            setDuplicateBillCount(legendCounts.duplicate);
            setErrorCount(legendCounts.error);
            setWarningCount(legendCounts.warning);
            setSuccessCount(legendCounts.success);

            const data = res.data;

            // Get total count from Content-Range header
            const contentRange = res.headers['content-range'];
            let total = 0;
            if (contentRange) {
                const match = contentRange.match(/\/(\d+)/);
                if (match && match[1]) {
                    total = parseInt(match[1], 10);
                }
            }
            setTotalCount(total);

            // --- Separate lookups for user_name / tenant_name (avoids ambiguous FK join) ---
            // ap_invoices has multiple FKs to ap_users (user_id, created_by, updated_by)
            // so PostgREST can't auto-resolve ap_users(user_name) — fetch separately instead.
            const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
            const tenantIds = [...new Set(data.map(d => d.tenant_id).filter(Boolean))];

            const userMap = {};
            const tenantMap = {};

            if (userIds.length > 0) {
                try {
                    const usersRes = await axios.get(
                        `/api/v1/tables/ap_users?select=id,user_name&id=in.(${userIds.join(',')})`,
                        { headers: { Authorization: `Bearer ${token}` }, signal }
                    );
                    usersRes.data.forEach(u => { userMap[u.id] = u.user_name; });
                } catch (err) {
                    if (axios.isCancel(err) || err.name === 'AbortError' || err.code === 'ERR_CANCELED') throw err;
                    /* non-fatal */
                }
            }

            if (tenantIds.length > 0) {
                try {
                    const tenantsRes = await axios.get(
                        `/api/v1/tables/ap_tenants?select=tenant_id,tenant_name&tenant_id=in.(${tenantIds.join(',')})`,
                        { headers: { Authorization: `Bearer ${token}` }, signal }
                    );
                    tenantsRes.data.forEach(t => { tenantMap[t.tenant_id] = t.tenant_name; });
                } catch (err) {
                    if (axios.isCancel(err) || err.name === 'AbortError' || err.code === 'ERR_CANCELED') throw err;
                    /* non-fatal */
                }
            }

            // --- Separate lookup for file_path from ap_documents using doc_id ---
            const docIds = [...new Set(data.map(d => d.doc_id).filter(Boolean))];
            const docMap = {}; // doc_id → file_path

            if (docIds.length > 0) {
                try {
                    const docsRes = await axios.get(
                        `/api/v1/tables/ap_documents?select=doc_id,file_path&doc_id=in.(${docIds.join(',')})`,
                        { headers: { Authorization: `Bearer ${token}` }, signal }
                    );
                    docsRes.data.forEach(d => { docMap[d.doc_id] = d.file_path; });
                } catch (err) {
                    if (axios.isCancel(err) || err.name === 'AbortError' || err.code === 'ERR_CANCELED') throw err;
                    /* non-fatal — file names will be blank if this fails */
                }
            }

            // Process and format the data
            const formatted = data.map((inv) => {
                const filePath = docMap[inv.doc_id] || '';

                const userName = inv.user_id ? (userMap[inv.user_id] || '') : '';
                const tenantName = inv.tenant_id ? (tenantMap[inv.tenant_id] || '') : '';

                return {
                    ...inv,
                    userName,
                    tenantName,
                    file_path: filePath,
                    file_name: formatFileName(filePath),
                };
            });

            // Additional client-side filtering as a safety measure
            // This ensures that when filters are applied, we don't show rows with empty values
            let filteredData = formatted;

            // userName and tenantName are now filtered server-side via pre-resolved IDs (see above).
            // If file_name filter is applied, filter against the full formatted display name (UUID already stripped by formatFileName).
            // Simple includes() handles any input: partial names, underscores, extensions, special chars, etc.
            if (debouncedColumnFilters.file_name && debouncedColumnFilters.file_name.trim()) {
                const normalizedSearch = normalizeFileSearch(debouncedColumnFilters.file_name).toLowerCase();
                if (isValidFileNameSearch(normalizedSearch)) {
                    filteredData = filteredData.filter(inv =>
                        inv.file_name && inv.file_name.toLowerCase().includes(normalizedSearch)
                    );
                }
            }

            // ── Client-side natural sort for alphanumeric / derived fields ────────
            if (needsClientSideSort) {
                const sortKeyMap = {
                    invoice_no:  'invoice_no',
                    po_no:       'po_no',
                    vendor_name: 'vendor_name',
                    file_name:   'file_name',
                    userName:    'userName',
                    tenantName:  'tenantName',
                };
                const sortKey = sortKeyMap[effectiveSortField] || effectiveSortField;
                filteredData.sort((a, b) => {
                    const aVal = (a[sortKey] || '').toString().toLowerCase();
                    const bVal = (b[sortKey] || '').toString().toLowerCase();
                    return effectiveSortAsc
                        ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
                        : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
                });
            }

            // Apply client-side pagination if all rows were fetched
            let paginatedData = filteredData;
            let finalTotalCount = total;

            if (needsAllRowsFetch) {
                // Update total count to reflect client-side filtered results
                finalTotalCount = filteredData.length;

                if (finalTotalCount === 0) {
                    paginatedData = [];
                } else {
                    const maxPage = Math.ceil(finalTotalCount / pageSize);
                    const safePage = page > maxPage ? 1 : page;
                    const startIndex = (safePage - 1) * pageSize;
                    paginatedData = filteredData.slice(startIndex, startIndex + pageSize);
                }
            }

            setInvoices(paginatedData);
            setTotalCount(finalTotalCount);
        } catch (err) {
            // If the request was intentionally cancelled (filter changed), do nothing —
            // the newer fetch is already in flight and will populate the table.
            if (axios.isCancel(err) || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                return;
            }
            // Failed to fetch invoices
            toast.error('Failed to fetch invoices.');
            setTotalCount(0); // Reset count on error
            setInvoices([]); // Clear data on error
        } finally {
            // Only clear the loading flags if this request was NOT aborted.
            // An aborted request means a newer one is in flight — leave the spinner visible.
            if (!signal.aborted) {
                setLoading(false);
                setUpdatingResults(false);
            }
        }
    };

    // Function to get unique values for filter options
    const getUniqueValues = useCallback((field) => {
        return [
            ...new Set(
                invoices
                    .map((inv) => inv[field])
                    .filter((val) => val !== null && val !== undefined && val !== '')
            ),
        ];
    }, [invoices]);

    // ─── DROPDOWN OPTIONS + FULL-DATASET COUNTS ────────────────────────────────
    // Fetched once on mount WITHOUT column/advanced filters so:
    //   • Status dropdown always shows every possible value.
    //   • Color-legend counts reflect the entire dataset, not just the current page.
    const dropdownFetchedRef = useRef(false);

    const fetchDropdownOptions = useCallback(async () => {
        if (!user || !token) return;

        let url = `/api/v1/tables/ap_invoices?select=status,error_desc&status=not.in.(Pending,Hold)`;

        if (user.role === 'account_user') {
            if (user.user_id && user.tenantId) {
                url += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            }
        } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
            if (user.tenantId) {
                url += `&tenant_id=eq.${user.tenantId}`;
            }
        }

        try {
            const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
            const data = res.data;

            // ── Status dropdown options ──
            const statusMap = new Map();
            data.forEach(inv => {
                const s = inv.status;
                if (s) statusMap.set(s.toLowerCase(), s);
            });
            setAllStatusValues(Array.from(statusMap.values()));

            // NOTE: Color-legend counts are now computed inside fetchData via a
            // parallel request using the same active filters, so they update on every
            // filter/page change and reflect ALL matching rows across all pages.
        } catch (_) { /* non-fatal */ }
    }, [user, token]);

    useEffect(() => {
        if (user && token && !dropdownFetchedRef.current) {
            dropdownFetchedRef.current = true;
            fetchDropdownOptions();
        }
    }, [user, token, fetchDropdownOptions]);

    const openViewer = useCallback(async (url) => {
        if (!url || !token) {
            // No document available or token missing for this entry
            toast.error('Cannot view document: missing file path or authentication token.');
            return;
        }
        try {
            const response = await axios.get(`/api/${url}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const blobUrl = URL.createObjectURL(response.data);
            setDocUrl(blobUrl);
            setModalOpen(true);
        } catch (error) {
            // Error fetching file for viewer
            toast.error('Failed to load document for viewing.');
        }
    }, [token]);

    const openEditor = useCallback(async (invoiceId) => {
        if (!invoiceId || !token) {
            // No invoice ID or token missing
            toast.error('Cannot open editor: missing invoice ID or authentication token.');
            return;
        }
        try {
            // Encrypt the invoiceId before navigation
            const encryptedId = encryptId(invoiceId);
            // Navigate to editor with readonly state
            navigate(`/editor/${encryptedId}`, { state: { readonly: true } });
        } catch (error) {
            // Error navigating to editor
            toast.error('Failed to open editor.');
        }
    }, [token, navigate]);

    const capitalizeStatus = (status) => {
        if (!status) return '';
        return String(status)
            .replace(/_/g, ' ')
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const clearAllFilters = () => {
        if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
        // Immediately clear stale rows so old data never flashes during the new fetch.
        setInvoices([]);
        setLoading(true);
        setUpdatingResults(true);
        // Skip the debounce timer — debouncedColumnFilters is updated directly below.
        bypassDebounceRef.current = true;

        const emptyColumnFilters = {
            invoice_id: '',
            invoice_no: '',
            po_no: '',
            vendor_name: '',
            invoice_date: '',
            file_path: '',
            file_name: '',
            created_at: '',
            status: '',
            total: '',
            userName: '',
            tenantName: '',
            stage: '',
        };

        setAppliedFilters(defaultAdvancedFilters);
        setDraftFilters(defaultAdvancedFilters);
        setIsDefaultDateRange(false);
        setColumnFilters(emptyColumnFilters);
        setDebouncedColumnFilters(emptyColumnFilters);
        setPage(1);
        setSearchParams({}, { replace: true });
    };

    // New function to clear sort options
    const clearSortOptions = () => {
        setSortField('invoice_id');
        setSortAsc(false);
        setPage(1);
        // Update URL parameters
        const params = new URLSearchParams(searchParams);
        params.delete('sortField');
        params.delete('sortAsc');
        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            setSearchParams({}, { replace: true });
        }
    };

    // Add handleRefresh function
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            // Increment refresh trigger to force re-fetch
            setRefetchTrigger(prev => prev + 1);
            // Small delay to show refresh animation
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    // Add handleRerun function
    const handleRerun = (invoice) => {
        setSelectedInvoice(invoice);
        setShowRerunDialog(true);
    };

    // Add confirmRerun function
    const confirmRerun = async () => {
        if (!selectedInvoice || !user || !token) {
            toast.error("Missing required information for rerun operation.");
            return;
        }

        try {
            const userId = user.user_id;
            const currentTime = getCurrentTimeISOString();

            // Update ap_documents table
            const docUpdatePayload = {
                stage: 'Review',
                status: 'Pending',
                updated_at: currentTime,
                updated_by: userId
            };

            const docResponse = await axios.patch(
                `/api/v1/tables/ap_documents?doc_id=eq.${selectedInvoice.doc_id}`,
                docUpdatePayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            // Update ap_invoices table
            const invoiceUpdatePayload = {
                stage: 'Review',
                status: 'Pending',
                updated_at: currentTime,
                updated_by: userId
            };

            const invoiceResponse = await axios.patch(
                `/api/v1/tables/ap_invoices?invoice_id=eq.${selectedInvoice.invoice_id}`,
                invoiceUpdatePayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (docResponse.status === 200 && invoiceResponse.status === 200) {
                toast.success("Invoice successfully marked for reapprove. It will appear in the Invoice Queue.");
                // Refresh the data
                setRefetchTrigger(prev => prev + 1);
            } else {
                toast.error("Failed to update invoice for rerun.");
            }
        } catch (error) {
            console.error("Rerun error:", error);
            toast.error("An error occurred while processing the rerun request.");
        } finally {
            setShowRerunDialog(false);
            setSelectedInvoice(null);
        }
    };

    // Add cancelRerun function
    const cancelRerun = () => {
        setShowRerunDialog(false);
        setSelectedInvoice(null);
    };

    const hasActiveFilters = useMemo(() => {
        const hasColumnFilters = Object.values(columnFilters).some((v) => v !== '');
        // Don't treat a field as active if it's still sitting at its known default value
        const knownDefaults = {
            from_date: getOneMonthAgoDate(),
            to_date: getTodayDate(),
        };
        const hasAdvancedFilters = Object.entries(appliedFilters).some(([key, value]) => {
            if (!value) return false;
            if (knownDefaults[key] && value === knownDefaults[key]) return false;
            return true;
        });
        return hasColumnFilters || hasAdvancedFilters;
    }, [columnFilters, appliedFilters]);

    // True when the user has changed sorting away from the default (newest-first by invoice_id)
    const hasActiveSort = useMemo(() => {
        return sortField !== 'invoice_id' || sortAsc !== false;
    }, [sortField, sortAsc]);

    const handleApplyFilters = () => {
        // Immediately clear stale rows and show loading.
        setInvoices([]);
        setLoading(true);
        setUpdatingResults(true);
        // Tell the debounce effect to skip its 300 ms timer — we're updating
        // debouncedColumnFilters directly below, so no second fetch is needed.
        bypassDebounceRef.current = true;

        // Targeted column-filter clearing: only clear the column keys that directly
        // conflict with an advanced filter field that has a value in the draft.
        const columnKeysToClear = new Set();
        Object.entries(draftFilters).forEach(([advKey, value]) => {
            if (value && ADVANCED_TO_COLUMN_CONFLICT_FQ[advKey]) {
                ADVANCED_TO_COLUMN_CONFLICT_FQ[advKey].forEach(colKey => columnKeysToClear.add(colKey));
            }
        });

        if (columnKeysToClear.size > 0) {
            const patch = [...columnKeysToClear].reduce((acc, k) => ({ ...acc, [k]: '' }), {});
            setColumnFilters(prev => ({ ...prev, ...patch }));
            setDebouncedColumnFilters(prev => ({ ...prev, ...patch }));
        }

        if (draftFilters.from_date || draftFilters.to_date) {
            setIsDefaultDateRange(false);
        }

        setAppliedFilters(draftFilters);
        setPage(1);
        setShowAdvancedFilter(false);
    };

    const handleCloseAdvancedFilter = () => {
        setDraftFilters(appliedFilters);
        setShowAdvancedFilter(false);
    };

    // Called by TableComponent via onColumnFilterCommit.
    // Only clears the specific advanced filter field(s) that directly conflict with
    // the committed column key — everything else is left untouched.
    const handleColumnFilterCommit = useCallback((key, value) => {
        // Mirror handleApplyFilters: clear stale data immediately, skip the 300ms
        // debounce timer, and trigger one fetch right away — same as advanced filters.
        setInvoices([]);
        setLoading(true);
        setUpdatingResults(true);
        // Tell the debounce effect to skip its timer when it sees columnFilters
        // change below — we're already updating debouncedColumnFilters directly.
        bypassDebounceRef.current = true;

        const advancedKeysToClear = COLUMN_TO_ADVANCED_CONFLICT_FQ[key];
        if (advancedKeysToClear && advancedKeysToClear.length > 0) {
            const patch = advancedKeysToClear.reduce((acc, k) => ({ ...acc, [k]: '' }), {});
            setAppliedFilters(prev => ({ ...prev, ...patch }));
            setDraftFilters(prev => ({ ...prev, ...patch }));

            // Disable the default date-range banner when created_at column overrides dates
            if (key === 'created_at' && value) {
                setIsDefaultDateRange(false);
            }
        }

        // Update both columnFilters (display/URL) and debouncedColumnFilters
        // (fetch trigger) in the same render — no 300ms wait, fetch fires immediately.
        setColumnFilters(prev => ({ ...prev, [key]: value }));
        setDebouncedColumnFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    }, []);

    const filterFields = useMemo(() => [
        { key: 'from_date', label: 'From Date', type: 'date', icon: Calendar, maxKey: 'to_date', defaultValue: getOneMonthAgoDate() },
        { key: 'to_date', label: 'To Date', type: 'date', icon: Calendar, minKey: 'from_date', defaultValue: getTodayDate() },
        { key: 'vendor', label: 'Vendor', type: 'text', icon: User, placeholder: 'Search vendor...' },
        {
            key: 'status', label: 'Status', type: 'select', icon: ListFilter,
            options: allStatusValues.map(s => ({ value: s, label: capitalizeStatus(s) })),
            allOptionLabel: 'All Statuses',
        }
    ], [allStatusValues]);

    // Define the columns for the table, removing left-side icons
    const columns = useMemo(() => {
        const isManagerOrAdmin = user?.role === 'account_manager' || user?.role === 'tenant_admin';
        const isSuperAdmin = user?.role === 'super_admin';

        let baseColumns = [
            // {
            //     key: 'invoice_id',
            //     header: <>ID</>, // Removed icon
            //     sortable: true,
            //     filterable: true,
            //     width: '50px',
            // },
        ];

        // 1. Conditionally add User Name for Account Manager / Tenant Admin
        if (isManagerOrAdmin) {
            baseColumns.push({
                key: 'userName',
                header: <>User Name</>,
                sortable: true,
                filterable: true,
                width: '120px',
                render: (item) => item.userName || '—',
            });
        }

        // 2. Conditionally add Tenant Name for Super Admin
        if (isSuperAdmin) {
            baseColumns.push({
                key: 'tenantName',
                header: <>Tenant Name</>,
                sortable: true,
                filterable: true,
                width: '120px',
                render: (item) => item.tenantName || '—',
            });
            baseColumns.push({
                key: 'userName',
                header: <>User Name</>,
                sortable: true,
                filterable: true,
                width: '120px',
                render: (item) => item.userName || '—',
            });
        }

        // The rest of the original columns
        baseColumns.push(
            {
                key: 'invoice_no',
                header: <>Invoice No</>, // Removed icon
                sortable: true,
                filterable: true,
                width: '120px',
                // render: (item) => {
                //     let errorData = null;
                //     if (item.error_desc && item.error_desc.value) {
                //         try {
                //             // Parse the stringified JSONB value
                //             errorData = typeof item.error_desc.value === 'string'
                //                 ? JSON.parse(item.error_desc.value)
                //                 : item.error_desc.value;
                //         } catch (e) {
                //             console.error("Error parsing error_desc:", e);
                //         }
                //     }

                //     // Dynamically find all keys that contain "Error" (case-insensitive)
                //     const errorKeys = errorData
                //         ? Object.keys(errorData).filter(key => key.toLowerCase().includes('error'))
                //         : [];

                //     const hasError = errorKeys.length > 0;

                //     return (
                //         <div className="flex items-center justify-between gap-2 relative w-full">
                //             <span className="flex-1 overflow-hidden text-ellipsis invoice-number-text">
                //                 {item.invoice_no || '—'}
                //             </span>
                //             {hasError && (
                //                 <div
                //                     className="info-icon-wrapper relative inline-block flex-shrink-0"
                //                     onMouseEnter={(e) => {
                //                         e.stopPropagation();
                //                         const rect = e.currentTarget.getBoundingClientRect();
                //                         const tooltip = e.currentTarget.querySelector('.info-tooltip');
                //                         if (tooltip) {
                //                             const x = rect.left + (rect.width / 2);
                //                             const y = rect.top - 8;
                //                             tooltip.style.left = `${x}px`;
                //                             tooltip.style.top = `${y}px`;
                //                             tooltip.style.transform = 'translate(-50%, -100%)';
                //                         }
                //                     }}
                //                 >
                //                     <Info
                //                         size={14}
                //                         className="cursor-pointer text-red-600"
                //                     />
                //                     {/* Tooltip Container */}
                //                     <div
                //                         className="info-tooltip fixed invisible opacity-0 bg-white p-0 text-black text-xs font-medium rounded-md shadow-2xl transition-all duration-200 ease-in-out pointer-events-none border border-gray-200"
                //                         style={{
                //                             maxWidth: '350px',
                //                             minWidth: '220px',
                //                             maxHeight: '200px',
                //                             overflowY: 'scroll',
                //                             whiteSpace: 'normal',
                //                             wordWrap: 'break-word',
                //                             zIndex: 9999,
                //                         }}
                //                     >
                //                         <div className="bg-red-50 text-red-900 p-3 rounded-md flex flex-col gap-3">
                //                             <div className="font-bold border-b border-red-200 pb-1 flex items-center gap-1 uppercase text-[10px]">
                //                                 <span className="inline-block w-2 h-2 bg-red-600 rounded-full"></span>
                //                                 Validation Errors ({errorKeys.length})
                //                             </div>

                //                             {/* Mapping through all found error keys */}
                //                             <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                //                                 {errorKeys.map((key, index) => (
                //                                     <div key={key} className="text-[11px] leading-tight text-gray-700">
                //                                         <span className="font-semibold text-red-700">{key.replace('_', ' ')}:</span> {errorData[key]}
                //                                     </div>
                //                                 ))}
                //                             </div>
                //                         </div>
                //                         {/* Arrow */}
                //                         <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-white rotate-45 border-r border-b border-gray-200"></div>
                //                     </div>
                //                 </div>
                //             )}
                //         </div>
                //     );
                // },

                render: (item) => {
                    const errorData = parseErrorDesc(item.error_desc);
                    return (
                        <MessageCell
                            item={item}
                            itemId={item.invoice_id}
                            displayText={item.invoice_no}
                            errorData={errorData}
                            activeTooltipId={activeTooltipId}
                            onToggle={setActiveTooltipId}
                            title="Invoice Messages"
                        />
                    );
                },
            },
            {
                key: 'po_no',
                header: <>PO Number</>, // Removed icon
                sortable: true,
                filterable: true,
                width: '120px',
            },
            {
                key: 'vendor_name',
                header: <>Vendor</>, // Removed icon
                sortable: true,
                filterable: true,
                width: '120px',
            },
            {
                key: 'invoice_date',
                header: <>Invoice Date</>, // Removed icon
                sortable: true,
                filterable: true,
                filterType: 'date',
                width: '120px',
                render: (item) => (item.invoice_date ? formatDate(item.invoice_date) : '—'),
            },
            {
                key: 'file_name',
                header: <>File Name</>,
                sortable: true,
                filterable: true,
                width: '150px',
                // Use item.file_name which is populated using formatFileName
                render: (item) => (item.file_name || '—'),
            },
            {
                key: 'stage',
                header: <>Stage</>,
                sortable: false,
                filterable: true,
                filterType: 'select',
                filterOptions: () => ['New', 'Review', 'Upload'],
                width: '140px',
                render: (item) => <StageDisplay currentStage={item.stage} stages={['New', 'Review', 'Upload']} />,
            },
            {
                key: 'status',
                header: <>Status</>,
                sortable: true,
                filterable: true,
                filterType: 'select',
                filterOptions: () => allStatusValues,
                width: '100px',
                render: (item) => <StatusBadge status={item.status} capitalizeStatus={capitalizeStatus} />,
            },
            {
                key: 'created_at',
                header: <>Created On</>,
                sortable: true,
                filterable: true,
                filterType: 'date',
                width: '140px',
                render: (item) => (
                    <span className='text-xs'>
                        {item.created_at ? formatDateTime(item.created_at) : '—'}
                    </span>
                ),
            },
            {
                key: 'action',
                header: <div>Action</div>,
                sortable: false,
                filterable: false,
                width: '80px',
                render: (item) => (
                    <div className="flex items-center gap-1">
                        <button
                            className="text-indigo-600 hover:text-indigo-800 font-semibold py-1 px-2 rounded-md"
                            onClick={() => openEditor(item.invoice_id)}
                            data-tour="final-table-view"
                        >
                            <Eye size={16} />
                        </button>
                        {/* Rerun button - only visible when stage is "upload" and status is "error" or "failure" */}
                        {item.stage && item.stage.toLowerCase() === 'upload' &&
                            (item.status && (item.status.toLowerCase() === 'error' || item.status.toLowerCase() === 'failure')) && (
                                <button
                                    className="text-green-600 hover:text-green-800 font-semibold py-1 px-2 rounded-md flex items-center"
                                    onClick={(e) => { e.stopPropagation(); handleRerun(item); }}
                                    title="Reapprove Invoice"
                                    data-tour="final-table-rerun"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            )}
                    </div>
                ),
            }
        );

        return baseColumns;
    }, [getUniqueValues, user, allStatusValues, activeTooltipId]);

    if (!user) {
        return (
            // Loading State - Updated with standardized spacing
            <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-md border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <h2 className="text-xl font-bold mb-5">Loading Final Invoices...</h2>
                <Loader2 size={32} className="text-indigo-600" />
                <p className="text-gray-600 mt-5">Please wait while your data is being loaded.</p>
            </div>
        );
    }

    if (!hasViewPermission) {
        return;
    }

    return (
        // Main Container - Updated with standardized spacing
        <div className="text-gray-800 font-[poppins] m-3 sm:m-5 relative flex flex-col">
            <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />

            {/* Header and Filter Button */}
            <div className="flex flex-wrap items-center gap-2" data-tour="final-queue-header">

                {/* Title + inline date badge */}
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 text-sm font-medium text-gray-800">
                        Final Invoices ({totalCount} items)
                    </span>

                    {isDefaultDateRange && (
                        <div ref={noteRef} className="relative flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowNotePopover(v => !v)}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-md text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                            >
                                <Info size={11} className="flex-shrink-0" />
                                Last 1 month ({getOneMonthAgoDate()} → {getTodayDate()})
                            </button>

                            {showNotePopover && (
                                <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-white border border-blue-100 rounded-lg shadow-xl p-3.5 text-xs">
                                    <span className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-l border-t border-blue-100 rotate-45 block" />
                                    <p className="flex items-center gap-1 font-medium text-blue-700 mb-1.5">
                                        <Info size={12} /> Default Date Filter Active
                                    </p>
                                    <p className="text-gray-600 leading-relaxed">
                                        Invoices are currently filtered to the{' '}
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

                {/* Action buttons pushed to the right */}
                <div className="ml-auto flex items-center gap-2">
                    {hasActiveSort && (
                        <Button color="gray" icon={ArrowUpDown} onClick={clearSortOptions} data-tour="final-queue-clear-sort">
                            Clear Sort
                        </Button>
                    )}

                    {hasActiveFilters && (
                        <Button color="red" icon={X} onClick={clearAllFilters} data-tour="final-queue-filter">
                            Clear Filters
                        </Button>
                    )}

                    <Button color="indigo" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCw size={13} className={`flex-shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>

                    <Button
                        color="indigo"
                        icon={Filter}
                        onClick={() => {
                            if (isDefaultDateRange) {
                                setDraftFilters(prev => ({
                                    ...prev,
                                    from_date: prev.from_date || getOneMonthAgoDate(),
                                    to_date: prev.to_date || getTodayDate(),
                                }));
                            }
                            setShowNotePopover(false);
                            setShowAdvancedFilter(true);
                        }}
                        data-tour="final-queue-filter"
                    >
                        Advanced Filters
                    </Button>
                </div>
            </div>
            {/* Gradient Divider */}
            <div className="w-full h-0.5 bg-gradient-to-r from-indigo-600 via-green-500 to-transparent my-2 rounded-full"></div>

            {/* Show loading spinner only during initial load */}
            {/* {loading && initialLoad && (
                <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-md border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                    <h2 className="text-xl font-bold mb-5">Loading Final Invoices...</h2>
                    <Loader2 size={32} className="text-indigo-600" />
                    <p className="text-gray-600 mt-5">Please wait while your data is being loaded.</p>
                </div>
            ) */}

            <>
                {showSortOptions && (
                    <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white mt-12 p-5 rounded-md shadow-xl border border-gray-200 z-[10000] w-full max-w-md flex flex-col max-h-[70vh] overflow-hidden">
                            <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-200 flex-shrink-0">
                                <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                                    Sort Options
                                </h3>
                                <button
                                    className="bg-transparent border-none cursor-pointer text-gray-500 hover:text-gray-700 p-1"
                                    onClick={() => setShowSortOptions(false)}
                                    aria-label="Close sort options"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-y-4 mb-5 flex-grow overflow-y-auto pr-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-700 tracking-wider uppercase mb-1">
                                        Sort By
                                    </label>
                                    <select
                                        className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-800 w-full shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                                        value={sortField}
                                        onChange={e => { setSortField(e.target.value); setPage(1); }}
                                    >
                                        <option value="invoice_id">ID</option>
                                        <option value="invoice_no">Invoice Number</option>
                                        <option value="po_no">PO Number</option>
                                        <option value="vendor_name">Vendor</option>
                                        <option value="invoice_date">Invoice Date</option>
                                        <option value="file_name">File Name</option>
                                        <option value="created_at">Created At</option>
                                        <option value="status">Status</option>
                                        <option value="total">Total Amount</option>
                                        <option value="stage">Stage</option>
                                        {user?.role === 'account_manager' || user?.role === 'tenant_admin' || user?.role === 'super_admin' ? (
                                            <>
                                                <option value="userName">User Name</option>
                                                {user?.role === 'super_admin' && <option value="tenantName">Tenant Name</option>}
                                            </>
                                        ) : null}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-700 tracking-wider uppercase mb-1">
                                        Order
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="sortOrder"
                                                checked={!sortAsc}
                                                onChange={() => { setSortAsc(false); setPage(1); }}
                                                className="mr-2"
                                            />
                                            Descending
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="sortOrder"
                                                checked={sortAsc}
                                                onChange={() => { setSortAsc(true); setPage(1); }}
                                                className="mr-2"
                                            />
                                            Ascending
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 flex-shrink-0">
                                <button
                                    className="bg-transparent border border-gray-300 text-gray-600 px-4 py-2 rounded-md font-semibold text-xs hover:bg-gray-50 hover:text-gray-800"
                                    onClick={clearSortOptions}
                                >
                                    Reset to Default
                                </button>
                                <button
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-sm hover:bg-indigo-700"
                                    onClick={() => {
                                        setShowSortOptions(false);
                                    }}
                                >
                                    Apply Sort
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                {/* Advanced Filter Panel */}
                <AdvancedFilterPanel
                    isOpen={showAdvancedFilter}
                    onClose={handleCloseAdvancedFilter}
                    title="Advanced Filters"
                    filterFields={filterFields}
                    values={draftFilters}
                    onChange={(key, value) => setDraftFilters(prev => ({ ...prev, [key]: value }))}
                    onApply={handleApplyFilters}
                    onClearAll={(newValues) => {
                        setInvoices([]);
                        setLoading(true);
                        setUpdatingResults(true);
                        bypassDebounceRef.current = true;
                        // Non-default fields cleared, default fields preserved as-is.
                        // isDefaultDateRange intentionally unchanged.
                        setDraftFilters(newValues);
                        setAppliedFilters(newValues);
                        const empty = {
                            invoice_id: '', invoice_no: '', po_no: '', vendor_name: '',
                            invoice_date: '', file_path: '', file_name: '', created_at: '',
                            status: '', total: '', userName: '', tenantName: '', stage: '',
                        };
                        setColumnFilters(empty);
                        setDebouncedColumnFilters(empty);
                        setPage(1);
                        setShowAdvancedFilter(false);
                    }}
                    onClearDefaults={(newValues) => {
                        setInvoices([]);
                        setLoading(true);
                        setUpdatingResults(true);
                        bypassDebounceRef.current = true;
                        // Default fields zeroed, non-defaults preserved; apply immediately and close
                        setDraftFilters(newValues);
                        setAppliedFilters(newValues);
                        setIsDefaultDateRange(false);
                        const empty = {
                            invoice_id: '', invoice_no: '', po_no: '', vendor_name: '',
                            invoice_date: '', file_path: '', file_name: '', created_at: '',
                            status: '', total: '', userName: '', tenantName: '', stage: '',
                        };
                        setColumnFilters(empty);
                        setDebouncedColumnFilters(empty);
                        setPage(1);
                        setShowAdvancedFilter(false);
                    }}
                    onRestoreDefaults={(newValues) => {
                        setInvoices([]);
                        setLoading(true);
                        setUpdatingResults(true);
                        bypassDebounceRef.current = true;
                        // Default fields restored + non-defaults preserved; apply immediately and close
                        setDraftFilters(newValues);
                        setAppliedFilters(newValues);
                        setIsDefaultDateRange(true);
                        const empty = {
                            invoice_id: '', invoice_no: '', po_no: '', vendor_name: '',
                            invoice_date: '', file_path: '', file_name: '', created_at: '',
                            status: '', total: '', userName: '', tenantName: '', stage: '',
                        };
                        setColumnFilters(empty);
                        setDebouncedColumnFilters(empty);
                        setPage(1);
                        setShowAdvancedFilter(false);
                    }}
                />

                {/* Guard: while loading/updating, pass empty data so React
                     batch-update timing can never leak stale rows through. */}
                <TableComponent
                    data={loading || updatingResults ? [] : invoices}
                    columns={columns}
                    columnFilters={debouncedColumnFilters} // Use debounced filters for actual filtering
                    setColumnFilters={setColumnFilters}
                    onColumnFilterCommit={handleColumnFilterCommit}
                    sortField={sortField}
                    setSortField={setSortField}
                    sortAsc={sortAsc}
                    setSortAsc={setSortAsc}
                    page={page}
                    setPage={setPage}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    totalCount={loading || updatingResults ? 0 : totalCount}
                    loading={loading}
                    emptyMessage={loading || updatingResults ? 'Loading invoices...' : 'No invoices found matching your criteria.'}
                    rowClassName={(item) => {
                        const errorData = parseErrorDesc(item.error_desc);
                        if (errorData && (errorData.Note || errorData.note || errorData.Note_1)) {
                            return 'bg-yellow-200';
                        }
                        return '';
                    }}
                    filtering={updatingResults}
                    tableFiltersDataTour="final-queue-table-filters"
                    tableSortDataTour="final-queue-table-sort"
                    tableViewDataTour="final-queue-table-view"
                    tableReprocessDataTour="final-queue-table-reprocess"
                    tableDeleteDataTour="final-queue-table-delete"
                    tablePaginationDataTour="final-queue-table-pagination"
                />

                {/* Conditionally show color legend based on full dataset */}
                <ColorLegend
                    showDuplicateBill={duplicateBillCount > 0}
                    showSuccess={successCount > 0}
                    showWarning={warningCount > 0}
                    showError={errorCount > 0}
                    currentPage="finalQueue" /* prop kept for backwards compat, no longer used in ColorLegend */
                />

                <ViewDocumentModal
                    isOpen={modalOpen}
                    onRequestClose={() => {
                        setModalOpen(false);
                        if (docUrl && docUrl.startsWith('blob:')) {
                            URL.revokeObjectURL(docUrl);
                            setDocUrl('');
                            // Revoked object URL on modal close
                        }
                    }}
                    fileUrl={docUrl}
                />

                {/* Rerun Confirmation Dialog */}
                {showRerunDialog && selectedInvoice && (
                    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center backdrop-blur-sm p-4">
                        <div className="bg-white p-5 sm:p-6 rounded-xl shadow-2xl border border-gray-200 z-[1010] w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={20} className="text-yellow-500" />
                                    <h3 className="text-lg font-bold text-gray-800">Confirm Reapprove</h3>
                                </div>
                                <button
                                    className="text-gray-500 hover:text-gray-700"
                                    onClick={cancelRerun}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="mb-6 flex-grow overflow-y-auto">
                                <p className="text-gray-700 mb-4">
                                    Are you sure you want to reapprove the invoice?
                                </p>
                                <div className="bg-gray-50 p-3 rounded-lg mb-4">
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold">Invoice ID:</span> {selectedInvoice.invoice_id}
                                    </p>
                                </div>
                                <p className="text-sm text-gray-600">
                                    After confirmation, the invoice will be shown in Invoice Queue.
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 flex-shrink-0">
                                <button
                                    className="bg-transparent border border-gray-300 text-gray-700 px-4 py-2 rounded-md font-semibold text-sm hover:bg-gray-100 hover:text-gray-800"
                                    onClick={cancelRerun}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="bg-green-600 text-white px-4 py-2 rounded-md font-semibold text-sm shadow-sm hover:bg-green-700"
                                    onClick={confirmRerun}
                                >
                                    Confirm Rerun
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        </div>
    );
};
export default FinalQueue;
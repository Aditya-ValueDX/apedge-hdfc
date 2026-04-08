import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import ViewDocumentModal from '../View/ViewDocumentModal';
import {
    Filter, X, ChevronDown, Calendar, FileText,
    User, Hash, Clock, ListFilter, DollarSign,
    Trash2,
    Info,
    Lock,
    Eye,
    Loader2,
    RefreshCw,
    CheckSquare,
    Square,
    CheckCheck,
    ThumbsUp,
    ThumbsDown,
    RotateCcw,
    ChevronUp,
    AlertTriangle,
} from 'lucide-react';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import { useSelector } from 'react-redux';
import TableComponent from '../common/TableComponent';
import StageDisplay from '../common/StageDisplay';
import StatusBadge from '../common/StatusBadge'; // Import StatusBadge component
import { canUserView, canUserDelete, canUserEdit } from '../../permissions';
import { toast, ToastContainer } from 'react-toastify';
import { encryptId } from '../../utils/cryptoUtils';
import axios from '../../utils/authInterceptor';
import { formatFileName } from '../../utils/fileUtils';
import { apiBaseUrl } from '../../config/apiConfig';
import ColorLegend from '../common/ColorLegend'; // Import the ColorLegend component
import AdvancedFilterPanel from '../common/AdvancedFilterPanel';
import Button from '../common/Button';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import useVendorWorkflow from '../../hooks/useVendorWorkflow';
import WorkflowMissingWarning from '../common/Vendor/WorkflowMissing';


// +++ ADD HELPER FUNCTION +++
// Add a helper function to validate date format
const isValidDateFormat = (dateString) => {
    if (!dateString) return false;
    // Check if it's a valid date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;

    // Check if it's a valid date
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
};
// +++ END ADD HELPER FUNCTION +++

// Returns a YYYY-MM-DD string for exactly 1 calendar month ago from today
const getOneMonthAgoDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const VendorQueue = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Initialize state from URL parameters
    const getInitialPage = () => {
        const pageParam = searchParams.get('page');
        return pageParam ? parseInt(pageParam, 10) : 1;
    };

    const getInitialPageSize = () => {
        const pageSizeParam = searchParams.get('pageSize');
        return pageSizeParam ? parseInt(pageSizeParam, 10) : 10;
    };

    const getInitialSortField = () => {
        return searchParams.get('sortField') || 'id';
    };

    const getInitialSortAsc = () => {
        const sortAscParam = searchParams.get('sortAsc');
        return sortAscParam ? sortAscParam === 'true' : false;
    };

    const getInitialColumnFilters = () => {
        const filters = {};
        const id = searchParams.get('id');
        if (id) filters.id = id;

        const vendor_code = searchParams.get('vendor_code');
        if (vendor_code) filters.vendor_code = vendor_code;

        const vendor = searchParams.get('vendor');
        if (vendor) filters.vendor = vendor;

        const created_at = searchParams.get('created_at');
        if (created_at) filters.created_at = created_at;

        const status = searchParams.get('status');
        if (status) filters.status = status;

        const vendor_type = searchParams.get('vendor_type');
        if (vendor_type) filters.vendor_type = vendor_type;

        const vendor_input_source = searchParams.get('vendor_input_source');
        if (vendor_input_source) filters.vendor_input_source = vendor_input_source;

        const comments = searchParams.get('comments');
        if (comments) filters.comments = comments;

        const userName = searchParams.get('userName');
        if (userName) filters.userName = userName;

        const tenantName = searchParams.get('tenantName');
        if (tenantName) filters.tenantName = tenantName;

        const file_name = searchParams.get('file_name');
        if (file_name) filters.file_name = file_name;

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

        const vendor_type = searchParams.get('adv_vendor_type');
        filters.vendor_type = vendor_type || '';

        return filters;
    };

    const [files, setFiles] = useState([]);
    const [page, setPage] = useState(getInitialPage());
    const [pageSize, setPageSize] = useState(getInitialPageSize()); // Added for pagination
    const [totalCount, setTotalCount] = useState(0); // Added for pagination
    const [duplicateBillCount, setDuplicateBillCount] = useState(0); // Added for color legend - full dataset count
    const [sortField, setSortField] = useState(getInitialSortField());
    const [sortAsc, setSortAsc] = useState(getInitialSortAsc());
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [showSortOptions, setShowSortOptions] = useState(false); // New state for sort options
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); // Added refreshing state
    const [refetchTrigger, setRefetchTrigger] = useState(0);
    const [userRole, setUserRole] = useState(null);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState(null);

    const { workflowConfig, workflowConfigMissing, loading: workflowLoading } = useVendorWorkflow();

    // ── BULK ACTION STATE (admin-only) ──────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkActionType, setBulkActionType] = useState(null); // 'approve' | 'reject' | 'revert'
    const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
    const [bulkComment, setBulkComment] = useState('');
    const [bulkCommentError, setBulkCommentError] = useState('');
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [bulkResult, setBulkResult] = useState(null); // { success: n, failed: n }
    // ───────────────────────────────────────────────────────────────────────────

    // New states for partial loading
    const [updatingResults, setUpdatingResults] = useState(false); // New state for updating results indicator
    const [initialLoad, setInitialLoad] = useState(true); // New state to track initial load

    // New state for storing all unique status values from the database
    const [allStatusValues, setAllStatusValues] = useState([]);

    // New states for storing all unique vendor_input_source and docType values from the database
    const [allVendors, setAllVendors] = useState([]);

    // Get user from Redux store
    const user = useSelector(state => state.auth.user);
    const token = user?.token;

    useEffect(() => {
        if (user) {
            setUserRole(user.role);
        }
    }, [user]);

    const canViewInvoiceList = canUserView(userRole, '/vendor_queue');
    const canDeleteInvoice = canUserDelete(userRole, 'vendor_list_delete');
    const canEditVendor = canUserEdit(userRole, 'vendor_approve_reject');

    const deletePermissionDeniedMessage = "You do not have permission to delete vendors.";

    const navigate = useNavigate();

    // -- NEW: read step filter passed from VendorDashboard bottleneck table ----
    // location.state?.filterStep holds the raw current_step value (e.g. 'step_compliance_review').
    // A null/undefined value means no step filter — normal VendorQueue behaviour.
    const location = useLocation();
    const [stepFilter, setStepFilter] = React.useState(
        location.state?.filterStep ?? null
    );

    const [columnFilters, setColumnFilters] = useState({
        id: '',
        vendor_code: '',
        vendor: '',
        created_at: '',
        status: '',
        vendor_type: '',
        vendor_input_source: '',
        comments: '',
        userName: '',
        tenantName: '',
        file_name: '',
        ...getInitialColumnFilters()
    });

    // Ref for debouncing filter updates
    const filterTimeoutRef = useRef(null);

    // Initialize debounced filters (must exist before useEffect)
    const [debouncedColumnFilters, setDebouncedColumnFilters] = useState({
        id: '',
        vendor_code: '',
        vendor: '',
        created_at: '',
        status: '',
        vendor_type: '',
        vendor_input_source: '',
        comments: '',
        userName: '',
        tenantName: '',
        file_name: '',
    });


    const defaultAdvancedFilters = {
        from_date: '',
        to_date: '',
        vendor: '',
        status: '',
        amount_min: '',
        amount_max: '',
        vendor_type: '',
        stage: '',
    };

    const [draftFilters, setDraftFilters] = useState({
        ...defaultAdvancedFilters,
        ...getInitialAdvancedFilters(),
    });

    const [appliedFilters, setAppliedFilters] = useState({
        ...defaultAdvancedFilters,
        ...getInitialAdvancedFilters(),
    });

    // Track whether we are using the implicit 1-month default date range.
    const initialAdv = getInitialAdvancedFilters();
    const [isDefaultDateRange, setIsDefaultDateRange] = useState(
        () => !initialAdv.from_date && !initialAdv.to_date
    );

    // Ref to track which filter mode is active ("column", "advanced", or null)
    const filterModeRef = useRef(null);

    // For default date range info popover
    const [showNotePopover, setShowNotePopover] = useState(false);
    const noteRef = useRef(null);

    // Ref to track if component has mounted (prevents URL update on initial render)
    const hasMountedRef = useRef(false);

    // Initialize state from URL parameters when component mounts
    useEffect(() => {
        // This will ensure state is properly initialized from URL parameters on mount
        // The state initialization functions already handle this, so we don't need to do anything here
        // This useEffect is just to make sure we're responding to URL changes
    }, [searchParams]);

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
        if (sortField !== 'id') params.set('sortField', sortField);
        if (sortAsc) params.set('sortAsc', sortAsc.toString());

        // Add column filters
        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        // Add advanced filters only if they have been applied
        if (Object.values(appliedFilters).some(v => v)) {
            Object.entries(appliedFilters).forEach(([key, value]) => {
                if (value) {
                    switch (key) {
                        case 'vendor':
                            params.set('adv_vendor', value);
                            break;
                        case 'status':
                            params.set('adv_status', value);
                            break;
                        case 'vendor_type':
                            params.set('adv_vendor_type', value);
                            break;
                        default:
                            params.set(key, value);
                    }
                }
            });
        }

        // Only update URL if there are params to set
        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            // Clear URL params if no filters are active
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, columnFilters, appliedFilters, setSearchParams]);

    // Initialize debouncedColumnFilters on mount to match columnFilters
    useEffect(() => {
        setDebouncedColumnFilters(columnFilters);
        hasMountedRef.current = true;
    }, []);

    useEffect(() => {
        // Skip debounce on initial mount (already initialized)
        if (!hasMountedRef.current) {
            return;
        }

        if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
        filterTimeoutRef.current = setTimeout(() => {
            setDebouncedColumnFilters(columnFilters);
        }, 300);

        return () => clearTimeout(filterTimeoutRef.current);
    }, [columnFilters]);

    // Clear Advanced Filters when any column filter is applied
    useEffect(() => {
        const hasActiveColumnFilter = Object.values(debouncedColumnFilters).some(
            value => value && String(value).trim() !== ''
        );

        if (hasActiveColumnFilter && filterModeRef.current !== 'advanced') {
            filterModeRef.current = 'column';
            if (Object.values(appliedFilters).some(v => v)) {
                setAppliedFilters(defaultAdvancedFilters);
                setDraftFilters(defaultAdvancedFilters);
            }
        }
    }, [debouncedColumnFilters, appliedFilters]);

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

    const fetchAllStatusValues = useCallback(async () => {
        if (!user || !token) return;
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            let roleFilter = '';
            if (user.role === 'sla') {
                // sla: filter by old_channel == tenantName AND fls_email_excel == email
                if (!user.tenantName || !user.email) return;
                roleFilter = `&old_channel=eq.${encodeURIComponent(user.tenantName)}&fls_email_excel=eq.${encodeURIComponent(user.email)}`;
            } else if (user.role === 'spoc') {
                // spoc: filter by old_channel == tenantName only
                if (!user.tenantName) return;
                roleFilter = `&old_channel=eq.${encodeURIComponent(user.tenantName)}`;
            }
            // admin / super_admin: no extra filter

            const [statusRes, policyRes] = await Promise.all([
                axios.get(`/api/v1/tables/churn_policy?select=policy_status${roleFilter}`, config),
                axios.get(`/api/v1/tables/churn_policy?select=fls_name${roleFilter}`, config),
            ]);

            setAllStatusValues([...new Set(statusRes.data.map(i => i.policy_status).filter(Boolean))]);
            setAllVendors([...new Set(policyRes.data.map(i => i.fls_name).filter(Boolean))]);
        } catch (err) {
            console.error('Error fetching status/policy values:', err);
        }
    }, [user, token]);

    useEffect(() => {
        fetchAllStatusValues();
    }, [user, token, fetchAllStatusValues]);

    // Added handleRefresh function
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                fetchAllStatusValues(),
                new Promise(resolve => setTimeout(resolve, 500))
            ]);
            setRefetchTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    }, [fetchAllStatusValues]);



    useEffect(() => {
        const fetchInvoices = async () => {
            if (!canViewInvoiceList || !user || !token) {
                setLoading(false);
                return;
            }

            // Only show full page loading spinner on initial load
            if (initialLoad) {
                setLoading(true);
            }
            setUpdatingResults(true); // Always show updating results indicator

            // Calculate offset
            const offset = (page - 1) * pageSize;

            // ── TWO-STEP: resolve active instance_ids, then filter vendors ──
            // We join the workflow instances table and filter where is_active = true.
            // All other filtering (status/stage) is removed in favour of this single flag.
            // TWO-STEP FILTER: resolve active instance_ids first, then filter vendors.
            // PostgREST join filters on ap_process_workflow_instances do not correctly
            // restrict ap_vendors rows because ap_vendors is the FK-owning side.
            // The join returns ALL instances for the tenant, not just the matched one,
            // so the embedded filter cannot exclude vendors by a specific instance's is_active.
            // Correct fix: step 1 = get instance_ids where is_active=true,
            //              step 2 = filter ap_vendors with instance_id=in.(...)

            // --- Step 1: fetch active instance_ids ---
            // VendorQueue shows records where is_active=true AND pending_with == login user's role.
            // No tenant_id filtering here — role-specific scoping is done on churn_policy in Step 2.
            let instanceFilterUrl = `/api/v1/tables/ap_process_workflow_instances?select=instance_id&is_active=eq.true`;

            // All roles (sla, spoc, admin, super_admin): filter by pending_with == user's role
            if (user.role) {
                instanceFilterUrl += `&pending_with=eq.${user.role}`;
            }

            // Step filter from VendorDashboard (if navigated from there)
            if (stepFilter) {
                instanceFilterUrl += `&current_step=eq.${encodeURIComponent(stepFilter)}`;
            }
            let activeInstanceIds = [];
            try {
                const instanceRes = await axios.get(instanceFilterUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                activeInstanceIds = instanceRes.data.map(r => r.instance_id).filter(Boolean);
            } catch (instanceErr) {
                console.error('Failed to fetch active instance IDs:', instanceErr);
                setLoading(false);
                setUpdatingResults(false);
                setInitialLoad(false);
                setFiles([]);
                setTotalCount(0);
                return;
            }

            // Short-circuit if no active instances
            if (activeInstanceIds.length === 0) {
                setFiles([]);
                setTotalCount(0);
                setLoading(false);
                setUpdatingResults(false);
                setInitialLoad(false);
                return;
            }

            // --- Step 2: query churn_policy filtered by active instance_ids ---
            let policiesUrl = `/api/v1/tables/churn_policy?select=*,ap_users(user_name),ap_tenants(tenant_name)`;

            // --- 1. Base Filter: policies whose instance_id is in the active set ---
            policiesUrl += `&instance_id=in.(${activeInstanceIds.join(',')})`;

            // --- 2. Pagination ---
            policiesUrl += `&limit=${pageSize}&offset=${offset}`;

            // --- 3. Sorting ---
            const effectiveSortField = sortField || 'churn_policy_id';
            const effectiveSortAsc = sortAsc;

            let dbSortFieldMapped = effectiveSortField;
            if (effectiveSortField === 'id') dbSortFieldMapped = 'churn_policy_id';
            else if (effectiveSortField === 'vendor_code') dbSortFieldMapped = 'new_policy_number';
            else if (effectiveSortField === 'vendor') dbSortFieldMapped = 'fls_name';
            else if (effectiveSortField === 'vendor_type') dbSortFieldMapped = 'attachment_type';
            else if (effectiveSortField === 'userName') dbSortFieldMapped = 'ap_users.user_name';
            else if (effectiveSortField === 'tenantName') dbSortFieldMapped = 'ap_tenants.tenant_name';
            else if (effectiveSortField === 'file_name') dbSortFieldMapped = 'churn_policy_id';
            else if (effectiveSortField === 'created_at') dbSortFieldMapped = 'created_at';
            else if (effectiveSortField === 'updated_at') dbSortFieldMapped = 'updated_at';

            let orderQuery = `${dbSortFieldMapped}.${effectiveSortAsc ? 'asc' : 'desc'}.nullslast`;

            // Add secondary sort by churn_policy_id to break ties
            if (effectiveSortField === 'created_at') {
                orderQuery += `,churn_policy_id.desc`;
            } else if (effectiveSortField !== 'id') {
                orderQuery += `,churn_policy_id.desc`;
            }

            policiesUrl += `&order=${orderQuery}`;

            // --- 4. Role-based Filters on churn_policy ---
            // sla        : old_channel == user.tenantName  AND  fls_email_excel == user.email
            // spoc       : old_channel == user.tenantName
            // admin      : pending_with=eq.admin already applied at instance level — no extra policy filter
            // super_admin: no additional filters
            if (user.role === 'sla') {
                if (!user.tenantName || !user.email) {
                    setLoading(false);
                    setUpdatingResults(false);
                    setInitialLoad(false);
                    setFiles([]);
                    setTotalCount(0);
                    return;
                }
                policiesUrl += `&old_channel=eq.${encodeURIComponent(user.tenantName)}`;
                policiesUrl += `&fls_email_excel=eq.${encodeURIComponent(user.email)}`;
            } else if (user.role === 'spoc') {
                if (!user.tenantName) {
                    setLoading(false);
                    setUpdatingResults(false);
                    setInitialLoad(false);
                    setFiles([]);
                    setTotalCount(0);
                    return;
                }
                policiesUrl += `&old_channel=eq.${encodeURIComponent(user.tenantName)}`;
            }
            // admin: no extra policy-level filter (pending_with scoping is sufficient)
            // super_admin: no additional filters

            // --- 5. Column Filters ---
            Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
                if (value) {
                    const filterValue = encodeURIComponent(value);
                    switch (key) {
                        case 'id':
                            if (value && !isNaN(value)) {
                                policiesUrl += `&churn_policy_id=eq.${value}`;
                            } else if (value) {
                                const numericPart = value.replace(/\D/g, '');
                                if (numericPart) {
                                    policiesUrl += `&churn_policy_id=eq.${numericPart}`;
                                }
                            }
                            break;
                        case 'vendor_code':
                            policiesUrl += `&new_policy_number=ilike.*${filterValue}*`;
                            break;
                        case 'vendor':
                            policiesUrl += `&fls_name=ilike.*${filterValue}*`;
                            break;
                        case 'vendor_type':
                            policiesUrl += `&attachment_type=eq.${filterValue}`;
                            break;
                        case 'vendor_input_source':
                            policiesUrl += `&channel_hod_name=ilike.*${filterValue}*`;
                            break;
                        case 'status':
                            policiesUrl += `&policy_status=eq.${filterValue}`;
                            break;
                        case 'stage':
                            policiesUrl += `&policy_status=eq.${filterValue}`;
                            break;
                        case 'comments':
                            policiesUrl += `&action_comments=ilike.*${filterValue}*`;
                            break;
                        case 'userName':
                            if (filterValue && filterValue.trim()) {
                                policiesUrl += `&ap_users.user_name=ilike.*${filterValue}*`;
                                policiesUrl += `&ap_users.user_name=not.is.null`;
                            }
                            break;
                        case 'tenantName':
                            if (filterValue && filterValue.trim()) {
                                policiesUrl += `&ap_tenants.tenant_name=ilike.*${filterValue}*`;
                                policiesUrl += `&ap_tenants.tenant_name=not.is.null`;
                            }
                            break;
                        case 'file_name':
                            policiesUrl += `&churn_policy_id=ilike.*${filterValue}*`;
                            break;
                        case 'created_at':
                            try {
                                const startOfDay = new Date(value);
                                const endOfDay = new Date(value);
                                endOfDay.setDate(endOfDay.getDate() + 1);

                                const startISO = startOfDay.toISOString();
                                const endISO = endOfDay.toISOString();

                                policiesUrl += `&created_at=gte.${encodeURIComponent(startISO)}&created_at=lt.${encodeURIComponent(endISO)}`;
                            } catch (e) {
                                // Invalid date for created_at filtering
                            }
                            break;
                        case 'updated_at':
                            try {
                                const startOfDay = new Date(value);
                                const endOfDay = new Date(value);
                                endOfDay.setDate(endOfDay.getDate() + 1);
                                const startISO = startOfDay.toISOString();
                                const endISO = endOfDay.toISOString();
                                policiesUrl += `&updated_at=gte.${encodeURIComponent(startISO)}&updated_at=lt.${encodeURIComponent(endISO)}`;
                            } catch (e) { }
                            break;
                    }
                }
            });

            // --- 6. Advanced Filters + Date Range ---
            if (Object.values(appliedFilters).some(v => v)) {
                if (appliedFilters.from_date && isValidDateFormat(appliedFilters.from_date)) {
                    policiesUrl += `&created_at=gte.${appliedFilters.from_date}T00:00:00.000Z`;
                }
                if (appliedFilters.to_date && isValidDateFormat(appliedFilters.to_date)) {
                    policiesUrl += `&created_at=lte.${appliedFilters.to_date}T23:59:59.999Z`;
                }
                if (appliedFilters.vendor) policiesUrl += `&fls_name=ilike.*${encodeURIComponent(appliedFilters.vendor)}*`;
                if (appliedFilters.status) policiesUrl += `&policy_status=eq.${encodeURIComponent(appliedFilters.status)}`;
                if (appliedFilters.stage) policiesUrl += `&policy_status=eq.${encodeURIComponent(appliedFilters.stage)}`;
                if (appliedFilters.vendor_type) policiesUrl += `&attachment_type=eq.${encodeURIComponent(appliedFilters.vendor_type)}`;
                if (appliedFilters.amount_min) policiesUrl += `&churn_policy_id=gte.${encodeURIComponent(appliedFilters.amount_min)}`;
                if (appliedFilters.amount_max) policiesUrl += `&churn_policy_id=lte.${encodeURIComponent(appliedFilters.amount_max)}`;
            } else if (isDefaultDateRange) {
                policiesUrl += `&created_at=gte.${getOneMonthAgoDate()}T00:00:00.000Z`;
                policiesUrl += `&created_at=lte.${getTodayDate()}T23:59:59.999Z`;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact' // Request total count
                }
            };

            try {
                const policiesResponse = await axios.get(policiesUrl, config);
                const policiesData = policiesResponse.data;

                // Get total count from Content-Range header
                const contentRange = policiesResponse.headers['content-range'];
                let total = 0;
                if (contentRange) {
                    const match = contentRange.match(/\/(\d+)/);
                    if (match && match[1]) {
                        total = parseInt(match[1], 10);
                    }
                }
                setTotalCount(total);


                // Fetch full dataset counts for color legend (same scoping as main query)
                let countInstanceFilterUrl = `/api/v1/tables/ap_process_workflow_instances?select=instance_id&is_active=eq.true`;

                // All roles: filter by pending_with == user's role
                if (user.role) {
                    countInstanceFilterUrl += `&pending_with=eq.${user.role}`;
                }

                // Step filter if active
                if (stepFilter) {
                    countInstanceFilterUrl += `&current_step=eq.${encodeURIComponent(stepFilter)}`;
                }
                
                let activeCountInstanceIds = [];
                try {
                    const countInstanceRes = await axios.get(countInstanceFilterUrl, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    activeCountInstanceIds = countInstanceRes.data.map(r => r.instance_id).filter(Boolean);
                } catch (countInstanceErr) {
                    console.error('Failed to fetch active instance IDs for count:', countInstanceErr);
                    activeCountInstanceIds = [];
                }
                
                let countUrl = `/api/v1/tables/churn_policy?select=*,ap_users(user_name),ap_tenants(tenant_name)`;
                countUrl += `&instance_id=in.(${activeCountInstanceIds.join(',')})`;

                // Role-based filters for count (mirrors main query)
                if (user.role === 'sla') {
                    if (user.tenantName && user.email) {
                        countUrl += `&old_channel=eq.${encodeURIComponent(user.tenantName)}`;
                        countUrl += `&fls_email_excel=eq.${encodeURIComponent(user.email)}`;
                    } else {
                        setDuplicateBillCount(0);
                    }
                } else if (user.role === 'spoc') {
                    if (user.tenantName) {
                        countUrl += `&old_channel=eq.${encodeURIComponent(user.tenantName)}`;
                    } else {
                        setDuplicateBillCount(0);
                    }
                }
                // admin / super_admin: no extra policy-level filter

                // Add the same column filters for the count URL
                Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
                    if (value) {
                        const filterValue = encodeURIComponent(value);
                        switch (key) {
                            case 'id':
                                countUrl += `&churn_policy_id=ilike.*${filterValue}*`;
                                break;
                            case 'vendor_code':
                                countUrl += `&new_policy_number=ilike.*${filterValue}*`;
                                break;
                            case 'vendor':
                                countUrl += `&fls_name=ilike.*${filterValue}*`;
                                break;
                            case 'vendor_type':
                                countUrl += `&attachment_type=eq.${filterValue}`;
                                break;
                            case 'created_at':
                                try {
                                    const startOfDay = new Date(value);
                                    const endOfDay = new Date(value);
                                    endOfDay.setDate(endOfDay.getDate() + 1);

                                    const startISO = startOfDay.toISOString();
                                    const endISO = endOfDay.toISOString();

                                    countUrl += `&created_at=gte.${encodeURIComponent(startISO)}&created_at=lt.${encodeURIComponent(endISO)}`;
                                } catch (e) {
                                    // Invalid date for created_at filtering
                                }
                                break;
                            case 'vendor_input_source':
                                countUrl += `&channel_hod_name=ilike.*${filterValue}*`;
                                break;
                            case 'status':
                                countUrl += `&policy_status=eq.${filterValue}`;
                                break;
                            case 'stage':
                                countUrl += `&policy_status=eq.${filterValue}`;
                                break;
                            case 'comments':
                                countUrl += `&action_comments=ilike.*${filterValue}*`;
                                break;
                            case 'userName':
                                if (filterValue && filterValue.trim()) {
                                    countUrl += `&ap_users.user_name=ilike.*${filterValue}*`;
                                    countUrl += `&ap_users.user_name=not.is.null`;
                                }
                                break;
                            case 'tenantName':
                                if (filterValue && filterValue.trim()) {
                                    countUrl += `&ap_tenants.tenant_name=ilike.*${filterValue}*`;
                                    countUrl += `&ap_tenants.tenant_name=not.is.null`;
                                }
                                break;
                            case 'file_name':
                                countUrl += `&churn_policy_id=ilike.*${filterValue}*`;
                                break;
                        }
                    }
                });

                // Advanced Filters for count URL
                if (Object.values(appliedFilters).some(v => v)) {
                    if (appliedFilters.from_date && isValidDateFormat(appliedFilters.from_date)) {
                        countUrl += `&created_at=gte.${appliedFilters.from_date}T00:00:00.000Z`;
                    }
                    if (appliedFilters.to_date && isValidDateFormat(appliedFilters.to_date)) {
                        countUrl += `&created_at=lte.${appliedFilters.to_date}T23:59:59.999Z`;
                    }
                    if (appliedFilters.vendor) countUrl += `&fls_name=ilike.*${encodeURIComponent(appliedFilters.vendor)}*`;
                    if (appliedFilters.status) countUrl += `&policy_status=eq.${encodeURIComponent(appliedFilters.status)}`;
                    if (appliedFilters.stage) countUrl += `&policy_status=eq.${encodeURIComponent(appliedFilters.stage)}`;
                    if (appliedFilters.vendor_type) countUrl += `&attachment_type=eq.${encodeURIComponent(appliedFilters.vendor_type)}`;
                    if (appliedFilters.amount_min) countUrl += `&churn_policy_id=gte.${encodeURIComponent(appliedFilters.amount_min)}`;
                    if (appliedFilters.amount_max) countUrl += `&churn_policy_id=lte.${encodeURIComponent(appliedFilters.amount_max)}`;
                } else if (isDefaultDateRange) {
                    countUrl += `&created_at=gte.${getOneMonthAgoDate()}T00:00:00.000Z`;
                    countUrl += `&created_at=lte.${getTodayDate()}T23:59:59.999Z`;
                }

                // Make the count request
                try {
                    const countRes = await axios.get(countUrl, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    });

                    // Count policies with duplicate bill errors (Note in error_desc)
                    const duplicateCount = countRes.data.filter(inv => {
                        if (inv.error_desc) {
                            try {
                                const errorDesc = typeof inv.error_desc === 'string'
                                    ? JSON.parse(inv.error_desc)
                                    : inv.error_desc;
                                return errorDesc && (errorDesc.Note || errorDesc.note);
                            } catch (e) {
                                return false;
                            }
                        }
                        return false;
                    }).length;

                    setDuplicateBillCount(duplicateCount);
                } catch (countErr) {
                    setDuplicateBillCount(0);
                    console.error('Error fetching count for duplicate bills:', countErr);
                }

                // Step 2: Map policy data directly (no separate document lookup needed)
                // Format data
                let formatted = policiesData.map((policy) => {
                    const policyNumber = policy.new_policy_number || '—';
                    const flsName = policy.fls_name || 'Unknown';
                    const attachmentType = policy.attachment_type || '—';
                    const channelHodName = policy.channel_hod_name || '';
                    const createdAt = policy.created_at || '';
                    const userName = policy.ap_users ? policy.ap_users.user_name : '';
                    const tenantName = policy.ap_tenants ? policy.ap_tenants.tenant_name : '';

                    return {
                        id: policy.churn_policy_id,
                        vendor_code: policyNumber,
                        vendor: flsName,
                        comments: policy.action_comments || '',
                        vendor_type: attachmentType,
                        vendor_input_source: channelHodName,
                        file_path: '',
                        file_name: `Policy_${policy.churn_policy_id}`,
                        doc_id: null,
                        created_at: createdAt,
                        updated_at: policy.updated_at || '',
                        status: policy.policy_status || 'unknown',
                        stage: policy.policy_status || 'New',
                        userName,
                        tenantName,
                        // New policy-specific fields
                        old_policy_number: policy.old_policy_number || '—',
                        new_policy_number: policy.new_policy_number || '—',
                        new_policy_rcd: policy.new_policy_rcd || '—',
                        fls_name: policy.fls_name || '—',
                        fls_code: policy.fls_code || '—',
                        error_desc: policy.exception_reason ? (() => {
                            try {
                                return typeof policy.exception_reason === 'string'
                                    ? JSON.parse(policy.exception_reason)
                                    : { Note: policy.exception_reason };
                            } catch (e) {
                                return { Note: policy.exception_reason };
                            }
                        })() : null,
                    };
                });

                // Additional client-side filtering for userName, tenantName, and file_name as a safety measure
                if (columnFilters.userName && columnFilters.userName.trim()) {
                    formatted = formatted.filter(item =>
                        item.userName && item.userName.trim() &&
                        item.userName.toLowerCase().includes(columnFilters.userName.toLowerCase())
                    );
                }

                if (columnFilters.tenantName && columnFilters.tenantName.trim()) {
                    formatted = formatted.filter(item =>
                        item.tenantName && item.tenantName.trim() &&
                        item.tenantName.toLowerCase().includes(columnFilters.tenantName.toLowerCase())
                    );
                }

                if (columnFilters.file_name && columnFilters.file_name.trim()) {
                    formatted = formatted.filter(item =>
                        item.file_name && item.file_name.trim() &&
                        item.file_name.toLowerCase().includes(columnFilters.file_name.toLowerCase())
                    );
                }

                setFiles(formatted);

            } catch (err) {
                setTotalCount(0);
                setFiles([]);
                console.error('Error fetching churn policies:', err);
            } finally {
                setLoading(false);
                setUpdatingResults(false);
                setInitialLoad(false);
            }
        };

        fetchInvoices();
    }, [
        user, canViewInvoiceList, token,
        page, pageSize, sortField, sortAsc,
        appliedFilters, debouncedColumnFilters, isDefaultDateRange, refetchTrigger,
        stepFilter  // NEW: re-fetch when step filter changes
    ]);

    // ── BULK SELECTION HELPERS ──────────────────────────────────────────────────
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    const toggleSelectId = useCallback((id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const selectAllOnPage = useCallback(() => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            files.forEach(f => next.add(f.id));
            return next;
        });
    }, [files]);

    const clearAllSelections = useCallback(() => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            files.forEach(f => next.delete(f.id));
            return next;
        });
    }, [files]);

    const isAllPageSelected = files.length > 0 && files.every(f => selectedIds.has(f.id));
    const isSomePageSelected = files.some(f => selectedIds.has(f.id)) && !isAllPageSelected;

    // ── BULK WORKFLOW HELPERS (mirror VendorEditor logic) ──────────────────────
    const resolveWorkflowStepBulk = useCallback((actionRef, currentStepId) => {
        if (!workflowConfig) return { current_step: currentStepId, next_step: null, status: null, pending_with: null };
        const steps = workflowConfig.steps || [];
        if (!steps.length) return { current_step: currentStepId, next_step: null, status: null, pending_with: null };
        const csi = steps.findIndex(s => s.stepId === currentStepId);
        const cs = csi >= 0 ? steps[csi] : steps[0];
        const matched = (cs?.transitions || []).find(t => t.actionRef?.toLowerCase() === actionRef?.toLowerCase());
        if (matched) {
            const du = matched.dataUpdates || {};
            const txNext = du.next_step || du.NextStep || null;
            const rc = txNext || steps[csi + 1]?.stepId || cs.stepId;
            const rco = steps.find(s => s.stepId === rc);
            const rci = rco ? steps.indexOf(rco) : -1;
            const rn = rci >= 0 ? steps[rci + 1]?.stepId ?? null : null;
            return { current_step: rc, next_step: rn, status: du.status || null, pending_with: du.pending_with || null };
        }
        return { current_step: currentStepId || steps[0]?.stepId || null, next_step: steps[csi + 1]?.stepId || null, status: cs?.dataUpdates?.status || null, pending_with: cs?.dataUpdates?.pending_with || null };
    }, [workflowConfig]);

    // Process a single policy item in bulk
    const processSingleBulkAction = async (item, actionRef, statusLabel, comment) => {
        const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
        const nowIso = getCurrentTimeISOString();

        // 1. Get current workflow step
        let csid = workflowConfig?.steps?.[0]?.stepId || null;
        if (item.id) {
            try {
                // item has instance_id embedded (we need to fetch it)
                const policyRes = await axios.get(
                    `/api/v1/tables/churn_policy?churn_policy_id=eq.${item.id}&select=instance_id`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const instId = policyRes.data?.[0]?.instance_id;
                if (instId) {
                    const instRes = await axios.get(
                        `/api/v1/tables/ap_process_workflow_instances?instance_id=eq.${instId}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (instRes.data?.[0]?.current_step) csid = instRes.data[0].current_step;
                    const instanceId = instId;

                    // 2. Resolve next step
                    const { current_step, next_step, status: wfStatus, pending_with } = resolveWorkflowStepBulk(actionRef, csid);
                    const effectiveStatus = wfStatus || statusLabel;
                    const steps = workflowConfig?.steps || [];
                    const isTerminal = current_step && !steps.find(s => s.stepId === current_step);

                    // 3. Update workflow instance
                    await axios.patch(
                        `/api/v1/tables/ap_process_workflow_instances?instance_id=eq.${instanceId}`,
                        {
                            current_step: current_step || null,
                            next_step: next_step || null,
                            status: effectiveStatus || null,
                            pending_with: pending_with || null,
                            updated_by: user.user_id,
                            updated_at: nowIso,
                            ...(isTerminal && { is_active: false }),
                        },
                        { headers: authHeaders }
                    );

                    // 4. Post workflow history
                    await axios.post(
                        '/api/v1/tables/ap_process_workflow_history',
                        [{
                            tenant_id: user.tenantId,
                            instance_id: instanceId,
                            module_name: 'Churn Policy',
                            Process_name: 'Churn Policy Onboarding',
                            created_by: user.user_id,
                            created_role_name: user.role || '',
                            previous_step: csid || null,
                            next_step: current_step || null,
                            actionRef,
                            user_comments: comment || null,
                            status: effectiveStatus || null,
                            history_json: null,
                        }],
                        { headers: { ...authHeaders, Prefer: 'return=representation' } }
                    );

                    // 5. Patch churn_policy
                    await axios.patch(
                        `/api/v1/tables/churn_policy?churn_policy_id=eq.${item.id}`,
                        {
                            policy_status: effectiveStatus,
                            action_comments: comment || null,
                            updated_by: user.user_id,
                            updated_at: nowIso,
                        },
                        { headers: authHeaders }
                    );

                    return true;
                }
            } catch (err) {
                console.error(`Bulk action failed for policy ${item.id}:`, err);
                return false;
            }
        }
        return false;
    };

    // Action label → actionRef + statusLabel mapping (mirrors VendorEditor)
    const bulkActionMeta = {
        approve: { actionRef: 'btn_approve', statusLabel: 'Approved', requiresComment: false },
        reject:  { actionRef: 'btn_reject',  statusLabel: 'Rejected', requiresComment: true },
        revert:  { actionRef: 'btn_revert',  statusLabel: 'Reverted', requiresComment: true },
    };

    const handleOpenBulkModal = useCallback((actionType) => {
        if (selectedIds.size === 0) { toast.warn('Please select at least one policy first.'); return; }
        setBulkActionType(actionType);
        setBulkComment('');
        setBulkCommentError('');
        setBulkResult(null);
        setShowBulkConfirmModal(true);
    }, [selectedIds]);

    const handleCloseBulkModal = useCallback(() => {
        if (bulkProcessing) return;
        setShowBulkConfirmModal(false);
        setBulkActionType(null);
        setBulkComment('');
        setBulkCommentError('');
        setBulkResult(null);
    }, [bulkProcessing]);

    const handleConfirmBulkAction = useCallback(async () => {
        const meta = bulkActionMeta[bulkActionType];
        if (!meta) return;

        if (meta.requiresComment && !bulkComment.trim()) {
            setBulkCommentError(`${bulkActionType === 'reject' ? 'Rejection' : 'Revert'} reason is required.`);
            return;
        }

        setBulkProcessing(true);
        setBulkResult(null);

        const selectedItems = files.filter(f => selectedIds.has(f.id));
        let successCount = 0;
        let failCount = 0;

        for (const item of selectedItems) {
            const ok = await processSingleBulkAction(item, meta.actionRef, meta.statusLabel, bulkComment.trim());
            if (ok) successCount++; else failCount++;
        }

        setBulkResult({ success: successCount, failed: failCount });
        setBulkProcessing(false);

        if (successCount > 0) {
            toast.success(`${successCount} policy/policies ${meta.statusLabel.toLowerCase()} successfully.`);
            setSelectedIds(new Set());

            // If ALL records on the current page were processed successfully and
            // we are not on the first page, navigate to the previous page so the
            // user never lands on an empty last page.
            const remainingOnPage = files.length - successCount;
            if (remainingOnPage <= 0 && page > 1) {
                setPage(p => p - 1);
            }

            setRefetchTrigger(t => t + 1);
        }
        if (failCount > 0) {
            toast.error(`${failCount} policy/policies failed to process.`);
        }

        if (failCount === 0) {
            setTimeout(() => setShowBulkConfirmModal(false), 800);
        }
    }, [bulkActionType, bulkComment, files, selectedIds, user, token, workflowConfig, resolveWorkflowStepBulk, page]);

    // ── END BULK ACTION ────────────────────────────────────────────────────────

    const clearAllFilters = () => {
        if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);

        const emptyColumnFilters = {
            id: '',
            vendor_code: '',
            vendor: '',
            vendor_type: '',
            created_at: '',
            vendor_input_source: '',
            status: '',
            comments: '',
            file_name: '',
            userName: '',
            tenantName: '',
            stage: '',
        };

        setAppliedFilters(defaultAdvancedFilters);
        setDraftFilters(defaultAdvancedFilters);
        setIsDefaultDateRange(true);
        setColumnFilters(emptyColumnFilters);
        setDebouncedColumnFilters(emptyColumnFilters);
        setPage(1);
        setSearchParams({}, { replace: true });
    };

    // New function to clear sort options
    const clearSortOptions = () => {
        setSortField('id');
        setSortAsc(false);
        setPage(1);
        const params = new URLSearchParams(searchParams);
        params.delete('sortField');
        params.delete('sortAsc');
        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            setSearchParams({}, { replace: true });
        }
    };

    const hasActiveFilters = useMemo(() => {
        const hasColumnFilters = Object.values(columnFilters).some((v) => v !== '');
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

    const getUniqueValues = useCallback((field) => {
        return [
            ...new Set(
                files
                    .map((f) => f[field])
                    .filter((val) => val !== null && val !== undefined && val !== '')
            ),
        ];
    }, [files]);

    const capitalizeStatus = (status) => {
        if (!status) return '';
        return String(status)
            .replace(/_/g, ' ')
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const handleCancelInvoice = useCallback(async (invoiceId) => {
        if (!canDeleteInvoice) {
            toast.error("You do not have permission to cancel policies.");
            return;
        }
        setInvoiceToDelete(invoiceId);
        setShowConfirmDeleteModal(true);
    }, [canDeleteInvoice]);

    const confirmDeleteInvoice = useCallback(async () => {
        if (!invoiceToDelete) return;

        if (!canDeleteInvoice) {
            toast.error("You do not have permission to cancel policies.");
            setShowConfirmDeleteModal(false);
            return;
        }

        if (!user.tenantId || !token) {
            toast.error('Authentication information is missing. Please log in again.');
            setShowConfirmDeleteModal(false);
            return;
        }

        try {
            const updatePolicyResponse = await axios.patch(`/api/v1/tables/churn_policy?churn_policy_id=eq.${invoiceToDelete}`,
                { policy_status: 'Cancel' },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (updatePolicyResponse.status !== 200) {
                throw new Error(updatePolicyResponse.data.message || 'Failed to cancel policy.');
            }

            setFiles(prevFiles => prevFiles.filter(file => file.id !== invoiceToDelete));
            setTotalCount(prevCount => Math.max(0, prevCount - 1));

            if (files.length === 1 && page > 1) {
                setPage(p => p - 1);
            }

            toast.success('Policy cancelled successfully!');
        } catch (error) {
            toast.error(error.message || 'Error cancelling policy.');
        } finally {
            setShowConfirmDeleteModal(false);
            setInvoiceToDelete(null);
        }
    }, [invoiceToDelete, canDeleteInvoice, user, files.length, page]);

    const cancelDelete = useCallback(() => {
        setShowConfirmDeleteModal(false);
        setInvoiceToDelete(null);
    }, []);

    const handleApplyFilters = () => {
        filterModeRef.current = 'advanced';

        const emptyColumnFilters = {
            id: '',
            vendor_code: '',
            vendor: '',
            vendor_type: '',
            created_at: '',
            vendor_input_source: '',
            status: '',
            comments: '',
            file_name: '',
            userName: '',
            tenantName: '',
            stage: '',
        };
        setColumnFilters(emptyColumnFilters);
        setDebouncedColumnFilters(emptyColumnFilters);

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

    const emptyVendorColumnFilters = {
        id: '',
        vendor_code: '',
        vendor: '',
        vendor_type: '',
        created_at: '',
        vendor_input_source: '',
        status: '',
        comments: '',
        file_name: '',
        userName: '',
        tenantName: '',
        stage: '',
    };

    const filterFields = useMemo(() => [
        {
            key: 'from_date',
            label: 'From Date',
            type: 'date',
            icon: Calendar,
            maxKey: 'to_date',
            defaultValue: getOneMonthAgoDate(),
        },
        {
            key: 'to_date',
            label: 'To Date',
            type: 'date',
            icon: Calendar,
            minKey: 'from_date',
            defaultValue: getTodayDate(),
        },
        {
            key: 'vendor',
            label: 'FLS Name',
            type: 'text',
            icon: User,
            placeholder: 'Search FLS name...',
        },
        {
            key: 'vendor_type',
            label: 'Attachment Type',
            type: 'text',
            icon: ListFilter,
            placeholder: 'Search attachment type...',
        },
        {
            key: 'status',
            label: 'Status',
            type: 'select',
            icon: ListFilter,
            options: allStatusValues.map(s => ({ value: s, label: capitalizeStatus(s) })),
            allOptionLabel: 'All Statuses',
        }
    ], [allStatusValues]);

    const columns = useMemo(() => {
        const isManagerOrAdmin = user?.role === 'spoc' || user?.role === 'admin';
        const isSuperAdmin = user?.role === 'super_admin';
        const isAdminRole = user?.role === 'admin' || user?.role === 'super_admin';

        let baseColumns = [];

        // ── Checkbox column — admin / super_admin only ──────────────────────────
        if (isAdminRole) {
            baseColumns.push({
                key: '__select__',
                header: (
                    <div className="flex items-center justify-center w-full">
                        <button
                            title={isAllPageSelected ? 'Deselect all on page' : 'Select all on page'}
                            onClick={(e) => {
                                e.stopPropagation();
                                isAllPageSelected ? clearAllSelections() : selectAllOnPage();
                            }}
                            className="text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                            {isAllPageSelected
                                ? <CheckSquare size={16} />
                                : isSomePageSelected
                                    ? <CheckSquare size={16} className="opacity-50" />
                                    : <Square size={16} />}
                        </button>
                    </div>
                ),
                sortable: false,
                filterable: false,
                width: '44px',
                headerAlign: 'center',
                render: (item) => (
                    <div className="flex items-center justify-center">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleSelectId(item.id); }}
                            className={`transition-colors ${selectedIds.has(item.id) ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}`}
                            title={selectedIds.has(item.id) ? 'Deselect' : 'Select'}
                        >
                            {selectedIds.has(item.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                        </button>
                    </div>
                ),
            });
        }
        // ───────────────────────────────────────────────────────────────────────

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
                key: 'old_policy_number',
                header: <>Old Policy Number</>,
                sortable: true,
                filterable: true,
                width: '140px',
                render: (item) => item.old_policy_number || '—',
            },
            {
                key: 'new_policy_number',
                header: <>New Policy Number</>,
                sortable: true,
                filterable: true,
                width: '140px',
                render: (item) => item.new_policy_number || '—',
            },
            {
                key: 'new_policy_rcd',
                header: <>New Policy RCD</>,
                sortable: true,
                filterable: true,
                width: '130px',
                render: (item) => item.new_policy_rcd || '—',
            },
            {
                key: 'fls_name',
                header: <>FLS Name</>,
                sortable: true,
                filterable: true,
                width: '120px',
                render: (item) => item.fls_name || '—',
            },
            {
                key: 'fls_code',
                header: <>FLS Code</>,
                sortable: true,
                filterable: true,
                width: '110px',
                render: (item) => item.fls_code || '—',
            },
            // {
            //     key: 'stage',
            //     header: <div>Stage</div>,
            //     filterType: 'select',
            //     filterOptions: () => ['New', 'Review', 'Upload'],
            //     width: '120px',
            //     render: (item) => <StageDisplay currentStage={item.stage} stages={['New', 'Review', 'Upload']} />,
            // },
            {
                key: 'status',
                header: <>Status</>,
                filterable: true,
                filterType: 'select',
                filterOptions: () => allStatusValues,
                width: '90px',
                render: (item) => <StatusBadge status={item.status} capitalizeStatus={capitalizeStatus} />,
            },
            {
                key: 'created_at',
                header: <>Created On</>,
                sortable: true,
                filterable: true,
                filterType: 'date',
                width: '130px',
                render: (item) =>
                    item.created_at ? (
                        <span className='text-xs'>
                            {new Date(item.created_at).toLocaleDateString('en-GB')}{' '}
                            {new Date(item.created_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                            })}
                        </span>
                    ) : (
                        '—'
                    ),
            },
            {
                key: 'updated_at',
                header: <>Updated At</>,
                sortable: true,
                filterable: true,
                filterType: 'date',
                width: '130px',
                render: (item) =>
                    item.updated_at ? (
                        <span className='text-xs'>
                            {new Date(item.updated_at).toLocaleDateString('en-GB')}{' '}
                            {new Date(item.updated_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                            })}
                        </span>
                    ) : (
                        '—'
                    ),
            }
        );

        const canViewInvoiceDetails = user?.role && canUserView(user.role, '/vendor_editor/:vendorId');

        const workflowReadRoles = workflowConfig?.meta?.permissions?.read;
        const workflowEditRoles = workflowConfig?.meta?.permissions?.edit;
        const workflowDeleteRoles = workflowConfig?.meta?.permissions?.delete;

        // Edit icon — role is in the workflow `edit` array (or legacy fallback)
        const showEditIcon = workflowConfig
            ? Array.isArray(workflowEditRoles) && workflowEditRoles.includes(userRole)
            : canViewInvoiceDetails;

        // Read (eye) icon — role is in the workflow `read` array but NOT in `edit`
        // Falls back to false when no workflowConfig (legacy roles don't have a separate read-only mode)
        const showReadIcon = workflowConfig
            ? Array.isArray(workflowReadRoles) &&
            workflowReadRoles.includes(userRole) &&
            !(Array.isArray(workflowEditRoles) && workflowEditRoles.includes(userRole))
            : false;

        const showDeleteIcon = workflowConfig
            ? Array.isArray(workflowDeleteRoles) && workflowDeleteRoles.includes(userRole)
            : canDeleteInvoice;

        if (showEditIcon || showReadIcon || showDeleteIcon) {
            baseColumns.push({
                key: 'action',
                header: <div>Action</div>,
                sortable: false,
                filterable: false,
                width: '70px',
                sticky: true,
                render: (item) => (
                    <div className="flex flex-col md:flex-row gap-0 md:justify-center md:items-center">
                        {/* Edit icon — opens the form in editable mode */}
                        {showEditIcon && (
                            <button
                                className="text-indigo-600 hover:text-indigo-800 font-semibold py-1 px-2 rounded-md"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const isDraftNew = item.status === 'Draft' && item.stage === 'New';
                                    navigate(
                                        `/vendor_editor/${encryptId(item.id)}`,
                                        isDraftNew ? { state: { type: 'manualVendor' } } : undefined
                                    );
                                }}
                                title="Edit Vendor"
                                data-tour="extraction-table-view"
                            >
                                <Eye size={16} />
                            </button>
                        )}
                        {/* Read-only eye icon — opens the form in readonly mode */}
                        {showReadIcon && (
                            <button
                                className="text-gray-500 hover:text-gray-700 font-semibold py-1 px-2 rounded-md"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                        `/vendor_editor/${encryptId(item.id)}`,
                                        { state: { readonly: true } }
                                    );
                                }}
                                title="View Vendor (Read Only)"
                                data-tour="extraction-table-readonly-view"
                            >
                                <Eye size={16} />
                            </button>
                        )}
                        {showDeleteIcon && (
                            <button
                                className="text-red-500 hover:text-red-700 font-semibold py-1 px-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={(e) => { e.stopPropagation(); handleCancelInvoice(item.id); }}
                                title="Cancel Vendor"
                                data-tour="extraction-table-delete"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                ),
            });
        }

        return baseColumns;
    }, [getUniqueValues, navigate, user, canDeleteInvoice, handleCancelInvoice, deletePermissionDeniedMessage, allStatusValues, workflowConfig, userRole, selectedIds, isAllPageSelected, isSomePageSelected, toggleSelectId, selectAllOnPage, clearAllSelections]);

    if (!canViewInvoiceList) {
        return (
            <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-xl border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <h2 className="text-xl font-bold mb-4">Access Denied</h2>
                <p className="text-gray-600">You do not have permission to view this page. Please contact your administrator.</p>
            </div>
        );
    }

    if (!workflowLoading && workflowConfigMissing && userRole !== 'super_admin') {
        return <WorkflowMissingWarning pageName="Vendor Queue" />;
    }

    return (
        <div className="text-gray-800 font-[poppins] m-5 relative flex flex-col">
            <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />

            {/* Header and Filter Button */}
            <div className="flex flex-wrap items-center gap-2" data-tour="vendor-queue-header">

                {/* Title + inline date badge */}
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 text-sm font-medium text-gray-800">
                        Churn Policy Queue ({totalCount} items)
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
                                        Policies are currently filtered to the{' '}
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
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                    {hasActiveFilters && (
                        <Button
                            color="red"
                            icon={X}
                            onClick={clearAllFilters}
                            data-tour="vendor-queue-filter"
                        >
                            Clear Filters
                        </Button>
                    )}

                    {(() => {
                        const showCreatePolicy = workflowConfig
                            ? Array.isArray(workflowConfig?.meta?.permissions?.create) &&
                            workflowConfig.meta.permissions.create.includes(userRole)
                            : canEditVendor;

                        return showCreatePolicy ? (
                            <Button
                                color="green"
                                icon={FileText}
                                onClick={() => navigate('/vendor_editor', { state: { type: "manualVendor" } })}
                            >
                                Create Policy
                            </Button>
                        ) : null;
                    })()}

                    <Button
                        color="indigo"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
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
                        data-tour="vendor-queue-filter"
                    >
                        Advanced Filters
                    </Button>
                </div>
            </div>
            {/* Gradient Divider */}
            <div className="w-full h-0.5 bg-gradient-to-r from-indigo-600 via-green-500 to-transparent my-2 rounded-full"></div>

            {showSortOptions && (
                <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white mt-12 p-5 rounded-md shadow-xl border border-gray-200 z-[10000] w-[90%] max-w-md flex flex-col max-h-[70vh] overflow-hidden">
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
                                    <option value="id">ID</option>
                                    <option value="vendor_code">Policy Number</option>
                                    <option value="vendor_type">Attachment Type</option>
                                    <option value="vendor">FLS Name</option>
                                    <option value="vendor_input_source">Channel HOD</option>
                                    <option value="file_name">File Name</option>
                                    <option value="created_at">Created At</option>
                                    <option value="status">Status</option>
                                    <option value="comments">Comments</option>
                                    <option value="stage">Stage</option>
                                    {user?.role === 'spoc' || user?.role === 'admin' || user?.role === 'super_admin' ? (
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
                                    setPage(1);
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
                    setDraftFilters(newValues);
                    setAppliedFilters(newValues);
                    setColumnFilters(emptyVendorColumnFilters);
                    setPage(1);
                    setShowAdvancedFilter(false);
                }}
                onClearDefaults={(newValues) => {
                    setDraftFilters(newValues);
                    setAppliedFilters(newValues);
                    setIsDefaultDateRange(false);
                    setColumnFilters(emptyVendorColumnFilters);
                    setPage(1);
                    setShowAdvancedFilter(false);
                }}
                onRestoreDefaults={(newValues) => {
                    setDraftFilters(newValues);
                    setAppliedFilters(newValues);
                    setIsDefaultDateRange(true);
                    setColumnFilters(emptyVendorColumnFilters);
                    setPage(1);
                    setShowAdvancedFilter(false);
                }}
            />

            {/* -- NEW: Step filter banner — shown only when navigated from VendorDashboard --
                 Displays which current_step is active and lets the user clear it.          */}
            {stepFilter && (
                <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
                    <span className="text-yellow-800 font-medium">
                        Filtered by workflow step:
                        <span className="ml-1 px-2 py-0.5 bg-yellow-100 rounded-full font-semibold">
                            {stepFilter
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                    </span>
                    <button
                        onClick={() => setStepFilter(null)}
                        className="flex items-center gap-1 text-yellow-700 hover:text-yellow-900 font-semibold transition-colors"
                        title="Clear step filter and show all pending policies"
                    >
                        <X size={13} />
                        Clear filter
                    </button>
                </div>
            )}

            {/* ── BULK ACTION TOOLBAR (admin / super_admin only) ─────────────────────
                 Appears when one or more rows are selected. Shows count + action buttons
                 (Approve, Reject, Revert) plus selection helpers (Select All Page,
                 Clear All).                                                           */}
            {isAdmin && selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs animate-fade-in">
                    {/* Count badge */}
                    <span className="flex items-center gap-1.5 font-semibold text-indigo-800">
                        <CheckCheck size={14} className="text-indigo-600" />
                        {selectedIds.size} {selectedIds.size === 1 ? 'policy' : 'policies'} selected
                    </span>

                    <div className="h-4 w-px bg-indigo-200 mx-1" />

                    {/* Approve */}
                    <button
                        onClick={() => handleOpenBulkModal('approve')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold transition-colors shadow-sm"
                        title="Bulk Approve selected policies"
                    >
                        <ThumbsUp size={13} />
                        Approve
                    </button>

                    {/* Reject */}
                    <button
                        onClick={() => handleOpenBulkModal('reject')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold transition-colors shadow-sm"
                        title="Bulk Reject selected policies"
                    >
                        <ThumbsDown size={13} />
                        Reject
                    </button>

                    {/* Revert */}
                    <button
                        onClick={() => handleOpenBulkModal('revert')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md font-semibold transition-colors shadow-sm"
                        title="Bulk Revert selected policies"
                    >
                        <RotateCcw size={13} />
                        Revert
                    </button>

                    {/* <div className="h-4 w-px bg-indigo-200 mx-1" /> */}

                    {/* Select all on current page */}
                    {/* {!isAllPageSelected && (
                        <button
                            onClick={selectAllOnPage}
                            className="flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-semibold underline-offset-2 hover:underline transition-colors"
                        >
                            <CheckSquare size={13} />
                            Select all on page
                        </button>
                    )} */}

                    {/* Clear all selections */}
                    <button
                        onClick={clearAllSelections}
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-800 font-semibold underline-offset-2 hover:underline transition-colors ml-auto"
                    >
                        <X size={13} />
                        Clear selection
                    </button>
                </div>
            )}

            <TableComponent
                data={files}
                columns={columns}
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
                sortField={sortField}
                setSortField={setSortField}
                sortAsc={sortAsc}
                setSortAsc={setSortAsc}
                page={page}
                setPage={setPage}
                emptyMessage={loading ? "Loading policies..." : "No policies found matching your criteria."}
                // Pass pagination props
                totalCount={totalCount}
                pageSize={pageSize}
                setPageSize={setPageSize}
                rowClassName={(item) => {
                    if (item.error_desc && (item.error_desc.Note || item.error_desc.note)) {
                        return 'bg-yellow-100';
                    }
                    return '';
                }}
                data-tour="vendor-table"
                tableFiltersDataTour="vendor-table-filters"
                tableSortDataTour="vendor-table-sort"
                tableViewDataTour="vendor-table-view"
                tableDeleteDataTour="vendor-table-delete"
                tablePaginationDataTour="vendor-table-pagination"
                filtering={updatingResults}
            />

            {/* Conditionally show color legend based on data */}
            <ColorLegend
                showDuplicateBill={duplicateBillCount > 0}
                currentPage="vendorQueue"
            />

            {/* ── BULK ACTION CONFIRMATION MODAL ─────────────────────────────────────
                 Shown when admin clicks Approve / Reject / Revert in the bulk toolbar.
                 Reject and Revert require a comment; Approve is optional.             */}
            {showBulkConfirmModal && bulkActionType && (
                <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[90%] max-w-md flex flex-col overflow-hidden">

                        {/* Modal Header */}
                        <div className={`flex items-center gap-3 px-6 py-4 border-b border-gray-100
                            ${bulkActionType === 'approve' ? 'bg-green-50' : bulkActionType === 'reject' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                            <div className={`flex items-center justify-center h-9 w-9 rounded-full
                                ${bulkActionType === 'approve' ? 'bg-green-100' : bulkActionType === 'reject' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                                {bulkActionType === 'approve' && <ThumbsUp size={18} className="text-green-600" />}
                                {bulkActionType === 'reject'  && <ThumbsDown size={18} className="text-red-600" />}
                                {bulkActionType === 'revert'  && <RotateCcw size={18} className="text-yellow-600" />}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">
                                    Bulk {bulkActionType.charAt(0).toUpperCase() + bulkActionType.slice(1)}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {selectedIds.size} {selectedIds.size === 1 ? 'policy' : 'policies'} selected
                                </p>
                            </div>
                            {!bulkProcessing && (
                                <button
                                    onClick={handleCloseBulkModal}
                                    className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 flex flex-col gap-4">

                            {/* Processing state */}
                            {bulkProcessing && (
                                <div className="flex flex-col items-center gap-3 py-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                        <Loader2 size={20} className="text-blue-600 animate-spin" />
                                    </div>
                                    <p className="text-sm text-gray-600 font-medium">
                                        Processing {selectedIds.size} {selectedIds.size === 1 ? 'policy' : 'policies'}…
                                    </p>
                                    <p className="text-xs text-gray-400">Please wait, do not close this window.</p>
                                </div>
                            )}

                            {/* Result state */}
                            {!bulkProcessing && bulkResult && (
                                <div className="flex flex-col items-center gap-3 py-2">
                                    {bulkResult.failed === 0
                                        ? <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                            <CheckCheck size={20} className="text-green-600" />
                                          </div>
                                        : <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                            <AlertTriangle size={20} className="text-orange-500" />
                                          </div>
                                    }
                                    <p className="text-sm font-semibold text-gray-800 text-center">
                                        {bulkResult.success > 0 && <span className="text-green-700">{bulkResult.success} succeeded</span>}
                                        {bulkResult.success > 0 && bulkResult.failed > 0 && <span className="text-gray-400"> · </span>}
                                        {bulkResult.failed > 0 && <span className="text-red-600">{bulkResult.failed} failed</span>}
                                    </p>
                                    {bulkResult.failed > 0 && (
                                        <p className="text-xs text-gray-500 text-center">
                                            Failed items may have already been processed or may lack an active workflow instance.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Normal (pre-submit) state */}
                            {!bulkProcessing && !bulkResult && (
                                <>
                                    <p className="text-sm text-gray-600">
                                        You are about to{' '}
                                        <span className={`font-semibold
                                            ${bulkActionType === 'approve' ? 'text-green-700' : bulkActionType === 'reject' ? 'text-red-700' : 'text-yellow-700'}`}>
                                            {bulkActionType}
                                        </span>{' '}
                                        <span className="font-semibold text-gray-800">{selectedIds.size}</span>{' '}
                                        {selectedIds.size === 1 ? 'policy' : 'policies'}.
                                        This action will update the workflow status for each selected record.
                                    </p>

                                    {/* Selected policy IDs preview */}
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 max-h-24 overflow-y-auto">
                                        <p className="text-xs text-gray-500 font-medium mb-1">Selected Policy IDs:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {[...selectedIds].map(id => (
                                                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-300 rounded-full text-xs text-gray-700 font-medium">
                                                    #{id}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Comment field — required for reject/revert, optional for approve */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-gray-700">
                                            {bulkActionType === 'reject' ? 'Rejection Reason' : bulkActionType === 'revert' ? 'Revert Reason' : 'Comments'}
                                            {(bulkActionType === 'reject' || bulkActionType === 'revert') && (
                                                <span className="text-red-500 ml-0.5">*</span>
                                            )}
                                        </label>
                                        <textarea
                                            value={bulkComment}
                                            onChange={(e) => {
                                                setBulkComment(e.target.value);
                                                if (bulkCommentError && e.target.value.trim()) setBulkCommentError('');
                                            }}
                                            placeholder={
                                                bulkActionType === 'reject' ? 'Enter rejection reason…'
                                                : bulkActionType === 'revert' ? 'Enter revert reason…'
                                                : 'Optional comment…'
                                            }
                                            rows={3}
                                            className={`w-full text-sm px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 transition-colors
                                                ${bulkCommentError
                                                    ? 'border-red-400 focus:ring-red-300 bg-red-50'
                                                    : 'border-gray-300 focus:ring-indigo-300 bg-white'}`}
                                        />
                                        {bulkCommentError && (
                                            <p className="text-xs text-red-600 flex items-center gap-1">
                                                <AlertTriangle size={12} /> {bulkCommentError}
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {!bulkProcessing && (
                            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                                <button
                                    onClick={handleCloseBulkModal}
                                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-600 bg-white hover:bg-gray-100 transition-colors"
                                >
                                    {bulkResult ? 'Close' : 'Cancel'}
                                </button>
                                {!bulkResult && (
                                    <button
                                        onClick={handleConfirmBulkAction}
                                        className={`px-4 py-2 text-sm font-semibold rounded-lg text-white shadow-sm transition-colors
                                            ${bulkActionType === 'approve' ? 'bg-green-600 hover:bg-green-700'
                                            : bulkActionType === 'reject'  ? 'bg-red-600 hover:bg-red-700'
                                            : 'bg-yellow-500 hover:bg-yellow-600'}`}
                                    >
                                        Confirm {bulkActionType.charAt(0).toUpperCase() + bulkActionType.slice(1)}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {showConfirmDeleteModal && invoiceToDelete && (
                <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-gradient-to-b from-white to-gray-50 p-8 rounded-md shadow-2xl border border-gray-200 z-[10000] w-[90%] max-w-lg flex flex-col">
                        <div className="flex items-center pb-4 mb-4 border-b border-gray-200">
                            <Info size={20} className="text-yellow-500 mr-3" />
                            <h3 className="text-lg font-bold text-gray-800">Confirm Cancellation</h3>
                        </div>
                        <p className="mb-5 text-gray-700">
                            Are you sure you want to cancel Policy with ID: <span className="font-bold">{invoiceToDelete}</span>?
                            This action will mark the policy as cancelled.
                        </p>
                        <div className="flex justify-end gap-4 pt-5 border-t border-gray-200 flex-shrink-0">
                            <button
                                className="bg-transparent border border-gray-400 text-gray-600 px-6 py-3 rounded-md font-semibold text-sm hover:bg-gray-100 hover:text-gray-800 hover:border-gray-500 hover:shadow-sm"
                                onClick={cancelDelete}
                            >
                                Cancel
                            </button>
                            <button
                                className="bg-red-600 text-white px-6 py-3 rounded-md font-semibold text-sm shadow-md hover:bg-red-700 hover:shadow-lg"
                                onClick={confirmDeleteInvoice}
                            >
                                Cancel Policy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VendorQueue;
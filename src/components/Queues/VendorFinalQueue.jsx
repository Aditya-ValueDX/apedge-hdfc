import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Filter,
    X,
    ChevronDown,
    Calendar,
    User,
    Hash,
    DollarSign,
    ListFilter,
    Lock,
    Loader2,
    Eye,
    Info,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import TableComponent from '../common/TableComponent';
import StatusBadge from '../common/StatusBadge';
import { canUserView } from '../../permissions';
import axios from '../../utils/authInterceptor';
import { encryptId } from '../../utils/cryptoUtils';
import { useSelector } from 'react-redux';
import { toast, ToastContainer } from 'react-toastify';
import { apiBaseUrl } from '../../config/apiConfig';
import ColorLegend from '../common/ColorLegend';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import AdvancedFilterPanel from '../common/AdvancedFilterPanel';
import Button from '../common/Button';
import useVendorWorkflow from '../../hooks/useVendorWorkflow';
import WorkflowMissingWarning from '../common/Vendor/WorkflowMissing';

// Returns a YYYY-MM-DD string for exactly 1 calendar month ago from today
const getOneMonthAgoDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const isValidDateFormat = (dateString) => {
    if (!dateString) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
};

const VendorFinalQueue = () => {
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

        const new_policy_number = searchParams.get('new_policy_number');
        if (new_policy_number) filters.new_policy_number = new_policy_number;

        const old_policy_number = searchParams.get('old_policy_number');
        if (old_policy_number) filters.old_policy_number = old_policy_number;

        const fls_name = searchParams.get('fls_name');
        if (fls_name) filters.fls_name = fls_name;

        const fls_code = searchParams.get('fls_code');
        if (fls_code) filters.fls_code = fls_code;

        const channel_hod_name = searchParams.get('channel_hod_name');
        if (channel_hod_name) filters.channel_hod_name = channel_hod_name;

        const attachment_type = searchParams.get('attachment_type');
        if (attachment_type) filters.attachment_type = attachment_type;

        const policy_status = searchParams.get('policy_status');
        if (policy_status) filters.policy_status = policy_status;

        const created_at = searchParams.get('created_at');
        if (created_at) filters.created_at = created_at;

        const action_comments = searchParams.get('action_comments');
        if (action_comments) filters.action_comments = action_comments;

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

        const fls_name = searchParams.get('adv_fls_name');
        filters.fls_name = fls_name || '';

        const policy_status = searchParams.get('adv_policy_status');
        filters.policy_status = policy_status || '';

        const attachment_type = searchParams.get('adv_attachment_type');
        filters.attachment_type = attachment_type || '';

        return filters;
    };

    // State to hold churn policy data
    const [policies, setPolicies] = useState([]);
    const [page, setPage] = useState(getInitialPage());
    const [pageSize, setPageSize] = useState(getInitialPageSize());
    const [totalCount, setTotalCount] = useState(0);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [showSortOptions, setShowSortOptions] = useState(false);
    const [sortField, setSortField] = useState(getInitialSortField());
    const [sortAsc, setSortAsc] = useState(getInitialSortAsc());
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingResults, setUpdatingResults] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const [allStatusValues, setAllStatusValues] = useState([]);
    const [allFLSNames, setAllFLSNames] = useState([]);

    const navigate = useNavigate();
    const user = useSelector(state => state.auth.user);
    const token = user?.token;
    const hasViewPermission = user ? canUserView(user.role, '/vendor_final_queue') : false;
    const canViewPolicyDetails = user?.role && canUserView(user.role, '/vendor_editor/:vendorId');

    const { workflowConfigMissing, loading: workflowLoading } = useVendorWorkflow();

    // Column filters — keyed to churn_policy fields
    const [columnFilters, setColumnFilters] = useState({
        id: '',
        new_policy_number: '',
        old_policy_number: '',
        fls_name: '',
        fls_code: '',
        channel_hod_name: '',
        attachment_type: '',
        policy_status: '',
        created_at: '',
        action_comments: '',
        userName: '',
        tenantName: '',
        ...getInitialColumnFilters()
    });

    // Debounced column filters state
    const [debouncedColumnFilters, setDebouncedColumnFilters] = useState(columnFilters);

    // Ref for debouncing
    const filterTimeoutRef = useRef(null);

    const defaultAdvancedFilters = {
        from_date: '',
        to_date: '',
        fls_name: '',
        policy_status: '',
        attachment_type: '',
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

    // Ref to track which filter mode is active
    const filterModeRef = useRef(null);

    // Ref to track if component has mounted
    const hasMountedRef = useRef(false);

    // For default date range info popover
    const [showNotePopover, setShowNotePopover] = useState(false);
    const noteRef = useRef(null);

    // Refetch trigger
    const [refetchTrigger, setRefetchTrigger] = useState(0);

    // Update URL parameters when state changes
    useEffect(() => {
        const params = new URLSearchParams();

        if (page !== 1) params.set('page', page.toString());
        if (pageSize !== 10) params.set('pageSize', pageSize.toString());
        if (sortField !== 'id') params.set('sortField', sortField);
        if (sortAsc) params.set('sortAsc', sortAsc.toString());

        Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        if (Object.values(appliedFilters).some(v => v)) {
            Object.entries(appliedFilters).forEach(([key, value]) => {
                if (value) {
                    switch (key) {
                        case 'fls_name':
                            params.set('adv_fls_name', value);
                            break;
                        case 'policy_status':
                            params.set('adv_policy_status', value);
                            break;
                        case 'attachment_type':
                            params.set('adv_attachment_type', value);
                            break;
                        default:
                            params.set(key, value);
                    }
                }
            });
        }

        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, debouncedColumnFilters, appliedFilters, setSearchParams]);

    // Initialize debouncedColumnFilters on mount
    useEffect(() => {
        setDebouncedColumnFilters(columnFilters);
        hasMountedRef.current = true;
    }, []);

    // Debounce column filters
    useEffect(() => {
        if (!hasMountedRef.current) return;

        if (filterTimeoutRef.current) {
            clearTimeout(filterTimeoutRef.current);
        }

        filterTimeoutRef.current = setTimeout(() => {
            setDebouncedColumnFilters(columnFilters);
        }, 300);

        return () => {
            if (filterTimeoutRef.current) {
                clearTimeout(filterTimeoutRef.current);
            }
        };
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

    // ─── DATA FETCHING ────────────────────────────────────────────────────────
    // Mirrors VendorQueue's two-step pattern but for is_active = false (completed/final).
    const fetchData = useCallback(async () => {
        if (!user || !hasViewPermission || !token) {
            setLoading(false);
            return;
        }

        if (initialLoad) {
            setLoading(true);
        }
        setUpdatingResults(true);

        const offset = (page - 1) * pageSize;

        // ── TWO-STEP: resolve inactive instance_ids, then filter churn policies ──
        // We join the workflow instances table and filter where is_active = false.
        // All other filtering (status/stage) is removed in favour of this single flag.
        // TWO-STEP FILTER: resolve inactive instance_ids first, then filter churn policies.
        // PostgREST join filters on ap_process_workflow_instances do not correctly
        // restrict ap_vendors rows because ap_vendors is the FK-owning side.
        // The join returns ALL instances for the tenant, not just the matched one,
        // so the embedded filter cannot exclude vendors by a specific instance's is_active.
        // Correct fix: step 1 = get instance_ids where is_active=false,
        //              step 2 = filter churn policies with instance_id=in.(...)

        // --- Step 1: fetch instance_ids where pending_with != login user's role ---
        // VendorFinalQueue shows records that are NOT pending with the login user's role.
        // No tenant_id filtering here — role-specific scoping is done on churn_policy in Step 2.
        let instanceFilterUrl = `/api/v1/tables/ap_process_workflow_instances?select=instance_id`;

        // All roles (sla, spoc, admin, super_admin): exclude records pending with the login user's role
        if (user.role) {
            instanceFilterUrl += `&pending_with=neq.${user.role}`;
        }
        
        let inactiveInstanceIds = [];
        try {
            const instanceRes = await axios.get(instanceFilterUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });
            inactiveInstanceIds = instanceRes.data.map(r => r.instance_id).filter(Boolean);
        } catch (instanceErr) {
            console.error('Failed to fetch inactive instance IDs:', instanceErr);
            setLoading(false);
            setUpdatingResults(false);
            setInitialLoad(false);
            setPolicies([]);
            setTotalCount(0);
            return;
        }

        // Short-circuit if no inactive instances
        if (inactiveInstanceIds.length === 0) {
            setPolicies([]);
            setTotalCount(0);
            setLoading(false);
            setUpdatingResults(false);
            setInitialLoad(false);
            return;
        }

        // --- Step 2: query churn_policy filtered by inactive instance_ids ---
        let policiesUrl = `/api/v1/tables/churn_policy?select=*,ap_users(user_name),ap_tenants(tenant_name)`;

        // --- 1. Base Filter: policies whose instance_id is in the inactive set ---
        policiesUrl += `&instance_id=in.(${inactiveInstanceIds.join(',')})`;

        // --- 2. Pagination ---
        policiesUrl += `&limit=${pageSize}&offset=${offset}`;

        // --- 3. Sorting ---
        const effectiveSortField = sortField || 'churn_policy_id';
        const effectiveSortAsc = sortAsc;

        let dbSortFieldMapped = effectiveSortField;
        if (effectiveSortField === 'id') dbSortFieldMapped = 'churn_policy_id';
        else if (effectiveSortField === 'new_policy_number') dbSortFieldMapped = 'new_policy_number';
        else if (effectiveSortField === 'old_policy_number') dbSortFieldMapped = 'old_policy_number';
        else if (effectiveSortField === 'fls_name') dbSortFieldMapped = 'fls_name';
        else if (effectiveSortField === 'fls_code') dbSortFieldMapped = 'fls_code';
        else if (effectiveSortField === 'channel_hod_name') dbSortFieldMapped = 'channel_hod_name';
        else if (effectiveSortField === 'attachment_type') dbSortFieldMapped = 'attachment_type';
        else if (effectiveSortField === 'policy_status') dbSortFieldMapped = 'policy_status';
        else if (effectiveSortField === 'created_at') dbSortFieldMapped = 'created_at';
        else if (effectiveSortField === 'updated_at') dbSortFieldMapped = 'updated_at';
        else if (effectiveSortField === 'userName') dbSortFieldMapped = 'ap_users.user_name';
        else if (effectiveSortField === 'tenantName') dbSortFieldMapped = 'ap_tenants.tenant_name';

        let orderQuery = `${dbSortFieldMapped}.${effectiveSortAsc ? 'asc' : 'desc'}.nullslast`;

        // Add secondary sort by churn_policy_id to break ties, but avoid duplicates
        if (effectiveSortField === 'created_at') {
            orderQuery += `,churn_policy_id.desc`;
        } else if (effectiveSortField !== 'id' && dbSortFieldMapped !== 'churn_policy_id') {
            orderQuery += `,churn_policy_id.desc`;
        }

        policiesUrl += `&order=${orderQuery}`;

        // --- 4. Role-based Filters on churn_policy ---
        // sla        : old_channel == user.tenantName  AND  fls_email_excel == user.email
        // spoc       : old_channel == user.tenantName
        // admin      : pending_with=neq.admin already applied at instance level — no extra policy filter
        // super_admin: no additional filters
        if (user.role === 'sla') {
            if (!user.tenantName || !user.email) {
                setLoading(false);
                setUpdatingResults(false);
                setInitialLoad(false);
                setPolicies([]);
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
                setPolicies([]);
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
                    case 'new_policy_number':
                        policiesUrl += `&new_policy_number=ilike.*${filterValue}*`;
                        break;
                    case 'old_policy_number':
                        policiesUrl += `&old_policy_number=ilike.*${filterValue}*`;
                        break;
                    case 'fls_name':
                        policiesUrl += `&fls_name=ilike.*${filterValue}*`;
                        break;
                    case 'fls_code':
                        policiesUrl += `&fls_code=ilike.*${filterValue}*`;
                        break;
                    case 'channel_hod_name':
                        policiesUrl += `&channel_hod_name=ilike.*${filterValue}*`;
                        break;
                    case 'attachment_type':
                        policiesUrl += `&attachment_type=eq.${filterValue}`;
                        break;
                    case 'policy_status':
                        policiesUrl += `&policy_status=eq.${filterValue}`;
                        break;
                    case 'action_comments':
                        policiesUrl += `&action_comments=ilike.*${filterValue}*`;
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
                    default:
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
            if (appliedFilters.fls_name) policiesUrl += `&fls_name=ilike.*${encodeURIComponent(appliedFilters.fls_name)}*`;
            if (appliedFilters.policy_status) policiesUrl += `&policy_status=eq.${encodeURIComponent(appliedFilters.policy_status)}`;
            if (appliedFilters.attachment_type) policiesUrl += `&attachment_type=eq.${encodeURIComponent(appliedFilters.attachment_type)}`;
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

            // Step 2: Map policy data directly (no separate document lookup needed)
            // Format data
            let formatted = policiesData.map((policy) => {
                const newPolicyNumber = policy.new_policy_number || '—';
                const oldPolicyNumber = policy.old_policy_number || '—';
                const flsName = policy.fls_name || 'Unknown';
                const flsCode = policy.fls_code || '—';
                const channelHodName = policy.channel_hod_name || '';
                const attachmentType = policy.attachment_type || '—';
                const createdAt = policy.created_at || '';
                const userName = policy.ap_users ? policy.ap_users.user_name : '';
                const tenantName = policy.ap_tenants ? policy.ap_tenants.tenant_name : '';

                return {
                    id: policy.churn_policy_id,
                    new_policy_number: newPolicyNumber,
                    old_policy_number: oldPolicyNumber,
                    fls_name: flsName,
                    fls_code: flsCode,
                    channel_hod_name: channelHodName,
                    old_channel: policy.old_channel || '—',
                    attachment_type: attachmentType,
                    policy_status: policy.policy_status || 'unknown',
                    action_comments: policy.action_comments || '',
                    exception_reason: policy.exception_reason || '',
                    created_at: createdAt,
                    updated_at: policy.updated_at || '',
                    instance_id: policy.instance_id,
                    userName,
                    tenantName,
                };
            });

            // Additional client-side filtering for userName, tenantName as a safety measure
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

            setPolicies(formatted);

        } catch (err) {
            setTotalCount(0);
            setPolicies([]);
            console.error('Error fetching churn policies:', err);
        } finally {
            setLoading(false);
            setUpdatingResults(false);
            setInitialLoad(false);
        }
    }, [
        user, hasViewPermission, token,
        page, pageSize, sortField, sortAsc,
        appliedFilters, debouncedColumnFilters, isDefaultDateRange, refetchTrigger
    ]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch unique status and FLS name values for filter dropdowns
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

            const [statusRes, flsRes] = await Promise.all([
                axios.get(`/api/v1/tables/churn_policy?select=policy_status${roleFilter}`, config),
                axios.get(`/api/v1/tables/churn_policy?select=fls_name${roleFilter}`, config),
            ]);

            setAllStatusValues([...new Set(statusRes.data.map(i => i.policy_status).filter(Boolean))]);
            setAllFLSNames([...new Set(flsRes.data.map(i => i.fls_name).filter(Boolean))]);
        } catch (err) {
            console.error('Error fetching status/FLS values:', err);
        }
    }, [user, token]);

    useEffect(() => {
        fetchAllStatusValues();
    }, [user, token, fetchAllStatusValues]);

    // Unique values helper (for column filter dropdowns)
    const getUniqueValues = useCallback((field) => {
        return [
            ...new Set(
                policies
                    .map((p) => p[field])
                    .filter((val) => val !== null && val !== undefined && val !== '')
            ),
        ];
    }, [policies]);

    const capitalizeStatus = (status) => {
        if (!status) return '';
        return String(status)
            .replace(/_/g, ' ')
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const clearAllFilters = () => {
        const emptyColumnFilters = {
            id: '',
            new_policy_number: '',
            old_policy_number: '',
            fls_name: '',
            fls_code: '',
            channel_hod_name: '',
            attachment_type: '',
            policy_status: '',
            created_at: '',
            action_comments: '',
            userName: '',
            tenantName: '',
        };

        setAppliedFilters(defaultAdvancedFilters);
        setDraftFilters(defaultAdvancedFilters);
        setIsDefaultDateRange(true);
        setColumnFilters(emptyColumnFilters);
        setDebouncedColumnFilters(emptyColumnFilters);
        setPage(1);
        setSearchParams({}, { replace: true });
    };

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

    const emptyFinalColumnFilters = {
        id: '',
        new_policy_number: '',
        old_policy_number: '',
        fls_name: '',
        fls_code: '',
        channel_hod_name: '',
        attachment_type: '',
        policy_status: '',
        created_at: '',
        action_comments: '',
        userName: '',
        tenantName: '',
    };

    const handleApplyFilters = () => {
        filterModeRef.current = 'advanced';

        setColumnFilters(emptyFinalColumnFilters);
        setDebouncedColumnFilters(emptyFinalColumnFilters);

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
            key: 'fls_name',
            label: 'FLS Name',
            type: 'text',
            icon: User,
            placeholder: 'Search FLS name...',
        },
        {
            key: 'attachment_type',
            label: 'Attachment Type',
            type: 'text',
            icon: ListFilter,
            placeholder: 'Search attachment type...',
        },
        {
            key: 'policy_status',
            label: 'Policy Status',
            type: 'select',
            icon: ListFilter,
            options: allStatusValues.map(s => ({ value: s, label: capitalizeStatus(s) })),
            allOptionLabel: 'All Statuses',
        }
    ], [allStatusValues]);

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

    // ─── TABLE COLUMNS ────────────────────────────────────────────────────────
    const columns = useMemo(() => {
        const isManagerOrAdmin = user?.role === 'spoc' || user?.role === 'admin';
        const isSuperAdmin = user?.role === 'super_admin';

        let baseColumns = [];

        // Conditionally add User Name for Account Manager / Tenant Admin
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

        // Conditionally add Tenant Name + User Name for Super Admin
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

        baseColumns.push(
            {
                key: 'new_policy_number',
                header: <>New Policy Number</>,
                sortable: true,
                filterable: true,
                width: '150px',
                render: (item) => item.new_policy_number,
            },
            {
                key: 'old_policy_number',
                header: <>Old Policy Number</>,
                sortable: true,
                filterable: true,
                width: '150px',
                render: (item) => item.old_policy_number,
            },
            {
                key: 'fls_name',
                header: <>FLS Name</>,
                sortable: true,
                filterable: true,
                width: '130px',
                render: (item) => item.fls_name,
            },
            {
                key: 'fls_code',
                header: <>FLS Code</>,
                sortable: true,
                filterable: true,
                width: '110px',
                render: (item) => item.fls_code,
            },
            {
                key: 'channel_hod_name',
                header: <>Channel HOD</>,
                sortable: true,
                filterable: true,
                width: '130px',
                render: (item) => item.channel_hod_name,
            },
            {
                key: 'attachment_type',
                header: <>Attachment Type</>,
                sortable: true,
                filterable: true,
                width: '130px',
                render: (item) => item.attachment_type,
            },
            {
                key: 'policy_status',
                header: <>Policy Status</>,
                filterable: true,
                filterType: 'select',
                filterOptions: () => allStatusValues,
                width: '120px',
                render: (item) => <StatusBadge status={item.policy_status} capitalizeStatus={capitalizeStatus} />,
            },
            {
                key: 'created_at',
                header: <>Created On</>,
                sortable: true,
                filterable: true,
                filterType: 'date',
                width: '140px',
                render: (item) => (
                    item.created_at ? (
                        <span className='text-xs'>
                            {new Date(item.created_at).toLocaleDateString('en-GB')}{' '}
                            {new Date(item.created_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                            })}
                        </span>
                    ) : '—'
                ),
            },
            {
                key: 'updated_at',
                header: <>Updated At</>,
                sortable: true,
                filterable: true,
                filterType: 'date',
                width: '140px',
                render: (item) => (
                    item.updated_at ? (
                        <span className='text-xs'>
                            {new Date(item.updated_at).toLocaleDateString('en-GB')}{' '}
                            {new Date(item.updated_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                            })}
                        </span>
                    ) : '—'
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
                        {canViewPolicyDetails && (
                            <button
                                className="text-indigo-600 hover:text-indigo-800 font-semibold py-1 px-2 rounded-md"
                                onClick={() => navigate(`/vendor_editor/${encryptId(item.id)}`, { state: { readonly: true, from: '/vendor_final_queue' } })}
                                title="View Churn Policy"
                                data-tour="final-table-view"
                            >
                                <Eye size={16} />
                            </button>
                        )}
                    </div>
                ),
            }
        );

        return baseColumns;
    }, [getUniqueValues, user, allStatusValues, canViewPolicyDetails, navigate]);

    // ─── GUARD RENDERS ────────────────────────────────────────────────────────
    if (!user) {
        return (
            <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-md border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <h2 className="text-xl font-bold mb-5">Loading Churn Policies...</h2>
                <Loader2 size={32} className="text-indigo-600" />
                <p className="text-gray-600 mt-5">Please wait while your data is being loaded.</p>
            </div>
        );
    }

    if (!hasViewPermission) {
        return (
            <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-xl border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <h2 className="text-xl font-bold mb-4">Access Denied</h2>
                <p className="text-gray-600">You do not have permission to view this page. Please contact your administrator.</p>
            </div>
        );
    }

    if (!workflowLoading && workflowConfigMissing && user?.role !== 'super_admin') {
        return <WorkflowMissingWarning pageName="Final Queue" />;
    }

    // ─── MAIN RENDER ─────────────────────────────────────────────────────────
    return (
        <div className="text-gray-800 font-[poppins] m-5 relative flex flex-col">
            <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />

            {/* Header and Filter Button */}
            <div className="flex flex-wrap items-center gap-2" data-tour="vendor-final-queue-header">

                {/* Title + inline date badge */}
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 text-sm font-medium text-gray-800">
                        Final Queue ({totalCount} items)
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
                                        Churn policies are currently filtered to the{' '}
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
                    {hasActiveFilters && (
                        <Button
                            color="red"
                            icon={X}
                            onClick={clearAllFilters}
                            data-tour="vendor-final-queue-clear-filters"
                        >
                            Clear Filters
                        </Button>
                    )}

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
                        data-tour="vendor-final-queue-filter"
                    >
                        Advanced Filters
                    </Button>
                </div>
            </div>

            {/* Gradient Divider */}
            <div className="w-full h-0.5 bg-gradient-to-r from-indigo-600 via-green-500 to-transparent my-2 rounded-full"></div>

            {/* Sort Options Modal */}
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
                                    <option value="new_policy_number">New Policy Number</option>
                                    <option value="old_policy_number">Old Policy Number</option>
                                    <option value="fls_name">FLS Name</option>
                                    <option value="fls_code">FLS Code</option>
                                    <option value="channel_hod_name">Channel HOD</option>
                                    <option value="attachment_type">Attachment Type</option>
                                    <option value="policy_status">Policy Status</option>
                                    <option value="created_at">Created At</option>
                                    <option value="updated_at">Updated At</option>
                                    {(user?.role === 'account_manager' || user?.role === 'tenant_admin' || user?.role === 'super_admin') && (
                                        <>
                                            <option value="userName">User Name</option>
                                            {user?.role === 'super_admin' && <option value="tenantName">Tenant Name</option>}
                                        </>
                                    )}
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
                                onClick={() => setShowSortOptions(false)}
                            >
                                Apply Sort
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Advanced Filter Panel */}
            {showAdvancedFilter && (
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
                        setColumnFilters(emptyFinalColumnFilters);
                        setPage(1);
                        setShowAdvancedFilter(false);
                    }}
                    onClearDefaults={(newValues) => {
                        setDraftFilters(newValues);
                        setAppliedFilters(newValues);
                        setIsDefaultDateRange(false);
                        setColumnFilters(emptyFinalColumnFilters);
                        setPage(1);
                        setShowAdvancedFilter(false);
                    }}
                    onRestoreDefaults={(newValues) => {
                        setDraftFilters(newValues);
                        setAppliedFilters(newValues);
                        setIsDefaultDateRange(true);
                        setColumnFilters(emptyFinalColumnFilters);
                        setPage(1);
                        setShowAdvancedFilter(false);
                    }}
                />
            )}

            <TableComponent
                data={policies}
                columns={columns}
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
                sortField={sortField}
                setSortField={setSortField}
                sortAsc={sortAsc}
                setSortAsc={setSortAsc}
                page={page}
                setPage={setPage}
                pageSize={pageSize}
                setPageSize={setPageSize}
                totalCount={totalCount}
                loading={loading}
                emptyMessage={loading ? "Loading churn policies..." : "No churn policies found matching your criteria."}
                filtering={updatingResults}
                tableFiltersDataTour="final-queue-table-filters"
                tableSortDataTour="final-queue-table-sort"
                tableViewDataTour="final-queue-table-view"
                tablePaginationDataTour="final-queue-table-pagination"
            />

            {/* Color Legend */}
            <ColorLegend
                showDuplicateBill={false}
                currentPage="finalQueue"
            />
        </div>
    );
};

export default VendorFinalQueue;
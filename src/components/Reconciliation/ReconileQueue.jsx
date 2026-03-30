import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ViewDocumentModal from '../View/ViewDocumentModal';
import {
    Filter, X, ChevronDown, Calendar, FileText,
    User, Hash, Clock, ListFilter, DollarSign,
    Lock,
    Loader2,
    Info,
    RefreshCw,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { canUserView } from '../../permissions';
import TableComponent from '../common/TableComponent';
import StageDisplay from '../common/StageDisplay';
import StatusBadge from '../common/StatusBadge'; // Import StatusBadge component
import AdvancedFilterPanel from '../common/AdvancedFilterPanel';
import Button from '../common/Button';
import { encryptId } from '../../utils/cryptoUtils';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import { formatFileName } from '../../utils/fileUtils';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import { formatDateTime } from '../../utils/dateUtils';

const ReconQueue = () => {
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
        return searchParams.get('sortField') || 'created_at';
    };

    const getInitialSortAsc = () => {
        const sortAscParam = searchParams.get('sortAsc');
        return sortAscParam ? sortAscParam === 'true' : false;
    };

    const getInitialColumnFilters = () => {
        const filters = {};
        const id = searchParams.get('id');
        if (id) filters.id = id;

        const invoice_id = searchParams.get('invoice_id');
        if (invoice_id) filters.invoice_id = invoice_id;

        const doc_id = searchParams.get('doc_id');
        if (doc_id) filters.doc_id = doc_id;

        const vendor = searchParams.get('vendor');
        if (vendor) filters.vendor = vendor;

        const created_at = searchParams.get('created_at');
        if (created_at) filters.created_at = created_at;

        const status = searchParams.get('status');
        if (status) filters.status = status;

        const total_amount = searchParams.get('total_amount');
        if (total_amount) filters.total_amount = total_amount;

        const file_name = searchParams.get('file_name');
        if (file_name) filters.file_name = file_name;

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

        const po_number = searchParams.get('adv_po_number');
        filters.po_number = po_number || '';

        return filters;
    };

    const [files, setFiles] = useState([]);
    const [page, setPage] = useState(getInitialPage());
    const [pageSize, setPageSize] = useState(getInitialPageSize()); // Added for pagination
    const [totalCount, setTotalCount] = useState(0); // Added for pagination
    const [sortField, setSortField] = useState(getInitialSortField());
    const [sortAsc, setSortAsc] = useState(getInitialSortAsc());
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [loading, setLoading] = useState(true); // Changed default to true to match DocumentQueue
    const [refreshing, setRefreshing] = useState(false);
    const [updatingResults, setUpdatingResults] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    // New state for storing all unique status values from the database
    const [allStatusValues, setAllStatusValues] = useState([]);

    // Add refetch trigger state for better data refresh handling
    const [refetchTrigger, setRefetchTrigger] = useState(0);

    const user = useSelector(state => state.auth.user);
    const token = user?.token;

    const [hasViewPermission, setHasViewPermission] = useState(false);

    const [columnFilters, setColumnFilters] = useState({
        id: '',
        invoice_id: '',
        doc_id: '',
        vendor: '',
        created_at: '',
        status: '',
        total_amount: '',
        file_name: '',
        userName: '',
        tenantName: '',
        ...getInitialColumnFilters()
    });

    // Add debounced column filters state
    const [debouncedColumnFilters, setDebouncedColumnFilters] = useState(columnFilters);

    // Add ref for debouncing
    const filterTimeoutRef = useRef(null);

    const [filters, setFilters] = useState({
        from_date: '',
        to_date: '',
        vendor: '',
        status: '',
        amount_min: '',
        amount_max: '',
        po_number: '',
        ...getInitialAdvancedFilters()
    });

    const navigate = useNavigate();

    // Initialize state from URL parameters when component mounts
    useEffect(() => {
        // This will ensure state is properly initialized from URL parameters on mount
        // The state initialization functions already handle this, so we don't need to do anything here
        // This useEffect is just to make sure we're responding to URL changes
    }, [searchParams]);

    // Update URL parameters when state changes
    useEffect(() => {
        const params = new URLSearchParams();

        // Add pagination params
        if (page !== 1) params.set('page', page.toString());
        if (pageSize !== 10) params.set('pageSize', pageSize.toString());

        // Add sort params
        if (sortField !== 'created_at') params.set('sortField', sortField);
        if (sortAsc) params.set('sortAsc', sortAsc.toString());

        // Add column filters
        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        // Add advanced filters
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                // Map advanced filter keys to URL parameter names
                switch (key) {
                    case 'vendor':
                        params.set('adv_vendor', value);
                        break;
                    case 'status':
                        params.set('adv_status', value);
                        break;
                    case 'po_number':
                        params.set('adv_po_number', value);
                        break;
                    default:
                        params.set(key, value);
                }
            }
        });

        // Only update URL if there are params to set
        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            // Clear URL params if no filters are active
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, columnFilters, filters, setSearchParams]);

    // Debounce column filters
    useEffect(() => {
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

    useEffect(() => {
        if (user) {
            setHasViewPermission(canUserView(user.role, '/reconcile_queue'));
        }
    }, [user]);

    // Check if tenant has reconciliation enabled
    const checkReconciliationAccess = useCallback(async () => {
        if (!user || !user.tenantId || !token) return true; // Default to true for super_admin

        try {
            // Fetch the enable_reconciliation parameter for this tenant
            const response = await axios.get(`/api/v1/tables/ap_parameters?tenant_id=eq.${user.tenantId}&unique_key=eq.enable_reconciliation`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data && response.data.length > 0) {
                // Check if the parameter value is 'true'
                const paramValue = response.data[0].req_value;
                return paramValue === 'true' || paramValue === true;
            } else {
                // Parameter not found, check if user is super_admin
                return user.role === 'super_admin';
            }
        } catch (error) {
            // Default to false if there's an error
            return false;
        }
    }, [user, token]);

    useEffect(() => {
        const fetchReconData = async () => {
            if (!user || !hasViewPermission || !token) {
                setLoading(false);
                return;
            }

            // Check if tenant has reconciliation enabled
            const hasReconciliationAccess = await checkReconciliationAccess();
            if (!hasReconciliationAccess) {
                setLoading(false);
                return;
            }

            // Only show full page loading spinner on initial load
            if (initialLoad) {
                setLoading(true);
            }
            setUpdatingResults(true); // Always show updating results indicator

            // Calculate offset for pagination
            const offset = (page - 1) * pageSize;

            const tenantId = user.tenantId;
            if (!tenantId && user.role !== 'super_admin') {
                setLoading(false);
                return;
            }

            // Updated URL to fetch user and tenant details with pagination
            let reconUrl = `/api/v1/tables/ap_reconcile?select=*,ap_users(user_name),ap_tenants(tenant_name)`;
            let docsUrl = `/api/v1/tables/ap_documents`; // Used for fetching file_path

            // Add pagination parameters
            reconUrl += `&limit=${pageSize}&offset=${offset}`;

            // Add sorting
            let dbSortFieldMapped = sortField;
            if (sortField === 'userName') dbSortFieldMapped = 'ap_users.user_name';
            else if (sortField === 'tenantName') dbSortFieldMapped = 'ap_tenants.tenant_name';
            else if (sortField === 'invoice_id') dbSortFieldMapped = 'invoice_id';
            else if (sortField === 'created_at') dbSortFieldMapped = 'created_at'; // Fixed column name
            else if (sortField === 'total_amount') dbSortFieldMapped = 'amount';
            else if (sortField === 'stage') dbSortFieldMapped = 'stage';

            let orderQuery = `${dbSortFieldMapped}.${sortAsc ? 'asc' : 'desc'}.nullslast`;
            reconUrl += `&order=${orderQuery}`;

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact' // Request total count
                }
            };

            // Build URL filters
            // if (user.role === 'account_user') {
            //     reconUrl += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            //     docsUrl += `?user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            // }else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
            //     reconUrl += `&tenant_id=eq.${tenantId}`;
            //     docsUrl += `?tenant_id=eq.${tenantId}`;
            // }

            // Add column filters - USING DEBOUNCED FILTERS NOW
            Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
                if (value) {
                    // For numeric values, don't encode them as they might cause issues
                    const filterValue = key === 'invoice_id' || key === 'id' || key === 'total_amount' ? value : encodeURIComponent(value);
                    switch (key) {
                        case 'id':
                            // Assuming id refers to reconcile_id
                            // Validate that it's a number
                            if (!isNaN(filterValue) && filterValue !== '') {
                                reconUrl += `&reconcile_id=eq.${filterValue}`;
                            }
                            break;
                        case 'invoice_id':
                            // Fix: Use eq operator for numeric invoice_id instead of ilike
                            // Validate that it's a number
                            if (!isNaN(filterValue) && filterValue !== '') {
                                reconUrl += `&invoice_id=eq.${filterValue}`;
                            }
                            break;
                        case 'doc_id':
                            // Add doc_id filter handling
                            // Validate that it's not empty
                            if (filterValue !== '') {
                                reconUrl += `&doc_id=eq.${encodeURIComponent(filterValue)}`;
                            }
                            break;
                        case 'vendor':
                            reconUrl += `&vendor=ilike.*${encodeURIComponent(filterValue)}*`;
                            break;
                        case 'created_at':
                            // Fix: Use proper date operators instead of ilike for date fields
                            // Only apply if not using advanced filters to avoid conflicts
                            if (!filters.from_date && !filters.to_date) {
                                // Ensure the date is in the correct format
                                const dateValue = filterValue;
                                if (dateValue && !isNaN(Date.parse(dateValue))) {
                                    reconUrl += `&created_at=gte.${dateValue}T00:00:00.000Z&created_at=lte.${dateValue}T23:59:59.999Z`;
                                }
                            }
                            break;
                        case 'status':
                            reconUrl += `&status=ilike.*${encodeURIComponent(filterValue)}*`;
                            break;
                        case 'stage':
                            reconUrl += `&stage=eq.${encodeURIComponent(filterValue)}`;
                            break;
                        case 'total_amount':
                            // Fix: Use proper numeric operators for amount fields
                            // For column filter, we'll use a simple approach with gte
                            // Validate that it's a number
                            if (!isNaN(filterValue) && filterValue !== '') {
                                reconUrl += `&amount=gte.${filterValue}`;
                            }
                            break;
                        case 'userName':
                            reconUrl += `&ap_users.user_name=ilike.*${encodeURIComponent(filterValue)}*`;
                            // Add a condition to ensure we only get records where user_name is not null
                            reconUrl += `&ap_users.user_name=not.is.null`;
                            break;
                        case 'tenantName':
                            reconUrl += `&ap_tenants.tenant_name=ilike.*${encodeURIComponent(filterValue)}*`;
                            // Add a condition to ensure we only get records where tenant_name is not null
                            reconUrl += `&ap_tenants.tenant_name=not.is.null`;
                            break;
                        case 'file_name':
                            // Add file_name filter handling
                            // Note: This would require joining with ap_documents table to filter by file_name
                            // For now, we'll skip this filter as it's not directly available in ap_reconcile table
                            break;
                    }
                }
            });

            // Add advanced filters
            // Fix: Use created_at field instead of date field
            // Validate and format date values
            if (filters.from_date && !isNaN(Date.parse(filters.from_date))) {
                reconUrl += `&created_at=gte.${encodeURIComponent(filters.from_date)}T00:00:00.000Z`;
            }
            if (filters.to_date && !isNaN(Date.parse(filters.to_date))) {
                reconUrl += `&created_at=lte.${encodeURIComponent(filters.to_date)}T23:59:59.999Z`;
            }
            if (filters.vendor) reconUrl += `&vendor=ilike.*${encodeURIComponent(filters.vendor)}*`;
            if (filters.status) reconUrl += `&status=eq.${encodeURIComponent(filters.status)}`;
            if (filters.stage) reconUrl += `&stage=eq.${encodeURIComponent(filters.stage)}`;
            // Validate that amount_min is a number
            if (filters.amount_min && !isNaN(filters.amount_min)) reconUrl += `&amount=gte.${encodeURIComponent(filters.amount_min)}`;
            // Validate that amount_max is a number
            if (filters.amount_max && !isNaN(filters.amount_max)) reconUrl += `&amount=lte.${encodeURIComponent(filters.amount_max)}`;
            if (filters.po_number) reconUrl += `&po_number=ilike.*${encodeURIComponent(filters.po_number)}*`;

            try {
                const reconRes = await axios.get(reconUrl, config);
                const reconData = reconRes.data;

                // Get total count from Content-Range header
                const contentRange = reconRes.headers['content-range'];
                let total = 0;
                if (contentRange) {
                    const match = contentRange.match(/\/(\d+)/);
                    if (match && match[1]) {
                        total = parseInt(match[1], 10);
                    }
                }
                setTotalCount(total);

                // 1. Get unique doc_ids to fetch documents in bulk or parallel
                const docIds = [...new Set(reconData.map(entry => entry.doc_id).filter(Boolean))];

                let documentsMap = new Map();
                if (docIds.length > 0) {
                    // Fetch all documents matching the IDs
                    const docPromises = docIds.map(docId =>
                        axios.get(docsUrl + (docsUrl.includes('?') ? `&doc_id=eq.${docId}` : `?doc_id=eq.${docId}`), config)
                            .then(res => res.data[0])
                            .catch(err => {
                                return null;
                            })
                    );

                    const documents = await Promise.all(docPromises);
                    documents.filter(Boolean).forEach(doc => documentsMap.set(doc.doc_id, doc));
                }

                // 2. Format and merge data
                const formatted = reconData.map((entry, idx) => {
                    const document = documentsMap.get(entry.doc_id) || {};
                    // Fix: Use the correct field name for file path
                    const filePath = document.file_path || '';

                    // Extract joined data - use empty strings instead of 'N/A' for proper filtering
                    const userName = entry.ap_users ? entry.ap_users.user_name : '';
                    const tenantName = entry.ap_tenants ? entry.ap_tenants.tenant_name : '';

                    return {
                        // CRITICAL CHANGE: Using reconcile_id as the primary key for the table
                        id: entry.reconcile_id,
                        doc_id: entry.doc_id || `INV-${idx + 1}`,
                        invoice_id: entry.invoice_id || `N/A-${idx + 1}`,
                        vendor: entry.vendor || 'Unknown Vendor',
                        total_amount: parseFloat(entry.amount) || 0,
                        invoice_date: entry.date || '',
                        // Fix: Use the correct field name for created_at
                        created_at: entry.created_at || getCurrentTimeISOString(),
                        match_confidence: entry.match_confidence || 85 + (idx % 15),
                        status: entry.status || 'extracted',
                        stage: entry.stage || 'New',
                        file_path: filePath,
                        file_name: formatFileName(filePath), // Use shared utility
                        userName, // Added for display
                        tenantName, // Added for display
                    };
                });

                // Additional client-side filtering as a safety measure
                let filteredData = formatted;

                // If userName filter is applied, filter out rows with empty userName - USING DEBOUNCED FILTERS NOW
                if (debouncedColumnFilters.userName && debouncedColumnFilters.userName.trim()) {
                    filteredData = filteredData.filter(item =>
                        item.userName && item.userName.trim() &&
                        item.userName.toLowerCase().includes(debouncedColumnFilters.userName.toLowerCase())
                    );
                }

                // If tenantName filter is applied, filter out rows with empty tenantName - USING DEBOUNCED FILTERS NOW
                if (debouncedColumnFilters.tenantName && debouncedColumnFilters.tenantName.trim()) {
                    filteredData = filteredData.filter(item =>
                        item.tenantName && item.tenantName.trim() &&
                        item.tenantName.toLowerCase().includes(debouncedColumnFilters.tenantName.toLowerCase())
                    );
                }

                setFiles(filteredData);
            } catch (error) {
                toast.error('Failed to fetch reconciliation data.');
                setTotalCount(0); // Reset count on error
                setFiles([]); // Clear data on error
            } finally {
                setLoading(false);
                setUpdatingResults(false);
                setInitialLoad(false); // Mark initial load as complete
            }
        };

        if (user && token) {
            fetchReconData();
        }
    }, [user, hasViewPermission, token, checkReconciliationAccess, page, pageSize, sortField, sortAsc, filters, debouncedColumnFilters, refetchTrigger, initialLoad]); // Added initialLoad to dependencies

    // Remove this problematic useEffect that causes blinking
    // useEffect(() => {
    //     setPage(1);
    // }, [advancedFilteredFiles]);

    const clearAllFilters = () => {
        setFilters({
            from_date: '',
            to_date: '',
            vendor: '',
            status: '',
            amount_min: '',
            amount_max: '',
            po_number: '',
            stage: '',
        });
        setColumnFilters({
            id: '',
            invoice_id: '',
            doc_id: '',
            vendor: '',
            created_at: '',
            status: '',
            total_amount: '',
            file_name: '',
            userName: '',
            tenantName: '',
            stage: '',
        });
        setPage(1); // Reset to first page
        // Clear URL parameters
        setSearchParams({}, { replace: true });
    };

    // Handler for when filters are applied in the AdvancedFilterPanel
    const handleApplyFilters = () => {
        setShowAdvancedFilter(false);
        setRefetchTrigger(prev => prev + 1); // Force refetch
    };

    // Handler for clearing all non-default filters
    const handleClearAllFilters = (newValues) => {
        setFilters(newValues);
        setShowAdvancedFilter(false);
        setRefetchTrigger(prev => prev + 1); // Force refetch
    };

    // Handler for clearing default filters
    const handleClearDefaultFilters = (newValues) => {
        setFilters(newValues);
        setShowAdvancedFilter(false);
        setRefetchTrigger(prev => prev + 1); // Force refetch
    };

    const hasActiveFilters =
        Object.values(filters).some((v) => v) ||
        Object.values(columnFilters).some((v) => v);

    const getUniqueValues = useCallback((field) => {
        return [
            ...new Set(
                files
                    .map((file) => file[field])
                    .filter((val) => val !== null && val !== undefined && val !== '')
            ),
        ];
    }, [files]);

    // Function to fetch all unique status values from the database
    const fetchAllStatusValues = useCallback(async () => {
        if (!user || !token) {
            return;
        }

        try {
            // Build base URL for fetching distinct status values
            let statusUrl = `/api/v1/tables/ap_reconcile?select=status`;

            // Add role-based filters
            if (user.role === 'account_user') {
                if (!user.user_id || !user.tenantId) {
                    return;
                }
                statusUrl += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
                if (!user.tenantId) {
                    return;
                }
                statusUrl += `&tenant_id=eq.${user.tenantId}`;
            }
            // Super admin needs no additional filter

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            const res = await axios.get(statusUrl, config);

            // Extract unique status values and filter out null/empty values
            const uniqueStatuses = [...new Set(res.data.map(invoice => invoice.status).filter(status => status !== null && status !== undefined && status !== ''))];

            setAllStatusValues(uniqueStatuses);
        } catch (err) {
            // Failed to fetch status values
            // Silently fail as this is not critical functionality
        }
    }, [user, token]);

    // Load all status values on component mount and when user/token changes
    useEffect(() => {
        fetchAllStatusValues();
    }, [user, token, fetchAllStatusValues]);

    // Added handleRefresh function
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            // Refresh all status values along with invoices
            await Promise.all([
                fetchAllStatusValues(),
                new Promise(resolve => setTimeout(resolve, 500)) // Small delay to show refresh animation
            ]);
            // Force a re-render by updating state
            setRefetchTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    }, [fetchAllStatusValues]);

    const capitalizeStatus = (status) => {
        if (!status) return '';
        return String(status)
            .replace(/_/g, ' ')
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Columns definition (Icons removed)
    const columns = useMemo(() => {
        const isManagerOrAdmin = user?.role === 'account_manager' || user?.role === 'tenant_admin';
        const isSuperAdmin = user?.role === 'super_admin';

        let baseColumns = [
            {
                key: 'id',
                header: <>Reconcile ID</>, // Updated header for clarity
                sortable: true,
                filterable: true,
                width: '120px',
            },
        ];

        // 1. Conditionally add User Name for Account Manager / Tenant Admin
        if (isManagerOrAdmin) {
            baseColumns.push({
                key: 'userName',
                header: <>User Name</>,
                sortable: true,
                filterable: true,
                width: '100px',
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
                width: '100px',
                render: (item) => item.tenantName || '—',
            });
            baseColumns.push({
                key: 'userName',
                header: <>User Name</>,
                sortable: true,
                filterable: true,
                width: '100px',
                render: (item) => item.userName || '—',
            });
        }

        // The rest of the original columns
        baseColumns.push(
            {
                key: 'invoice_id',
                header: <>Invoice No.</>, // Removed icon
                sortable: true,
                filterable: true,
                width: '150px',
            },
            {
                key: 'doc_id',
                header: <>Doc ID</>, // Removed icon
                sortable: true,
                filterable: true,
                width: '120px',
            },
            // {
            //     key: 'file_name',
            //     header: <>File Name</>, // Added file name column
            //     sortable: true,
            //     filterable: true,
            //     width: '200px',
            //     render: (item) => item.file_name,
            // },
            {
                key: 'created_at',
                header: <>Created On</>, // Removed icon
                sortable: true,
                filterable: true,
                filterType: 'date',
                width: '150px',
                render: (item) => (
                    item.created_at ? (
                        <span className='text-xs'>
                            {formatDateTime(item.created_at)}
                        </span>
                    ) : (
                        '—'
                    )
                ),
            },

            {
                key: 'stage',
                header: <div>Stage</div>,
                sortable: true,
                filterable: true,
                filterType: 'select',
                filterOptions: () => ['New', 'Review', 'Reconcile', 'Upload'],
                width: '200px',
                render: (item) => <StageDisplay currentStage={item.stage} stages={['New', 'Review', 'Reconcile', 'Upload']} />,
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
                key: 'action',
                header: <div>Action</div>,
                sortable: false,
                filterable: false,
                width: '80px',
                render: (item) => (
                    <button
                        className="text-indigo-600 hover:text-indigo-800 font-semibold py-1 px-2 rounded-md"
                        // CRITICAL CHANGE: Navigate using the invoice number
                        onClick={() => navigate(`/reconcile_queue/${encryptId(item.id)}`)}
                    >
                        View
                    </button>
                ),
            }
        );

        return baseColumns;
    }, [getUniqueValues, navigate, user, allStatusValues]);

    // Tailwind CSS Styling for UI states

    // if (!user || (loading && initialLoad)) {
    //     return (
    //         // Loading State - Matching RequestList style
    //         <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-xl border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
    //             <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    //             <h2 className="text-xl font-bold mb-4">Loading Reconciliation Queue...</h2>
    //             <Loader2 size={32} className="animate-spin text-indigo-600" />
    //             <p className="text-gray-600 mt-4">Please wait while your data is being loaded.</p>
    //         </div>
    //     );
    // }

    if (!hasViewPermission) {
        return (
            // Permission Denied State - Matching RequestList style
            <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-xl border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <h2 className="text-xl font-bold mb-4">Access Denied</h2>
                <p className="text-gray-600">You do not have permission to view this page. Please contact your administrator.</p>
            </div>
        );
    }

    return (
        // Main Container - Updated with standardized spacing
        <div className="text-gray-800 m-5 relative flex flex-col">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />

            {/* Show loading spinner only during initial load */}
            {/* {!loading && initialLoad && (
                <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-xl border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                    <h2 className="text-xl font-bold mb-4">Loading Reconciliation Queue...</h2>
                    <Loader2 size={32} className="animate-spin text-indigo-600" />
                    <p className="text-gray-600 mt-4">Please wait while your data is being loaded.</p>
                </div>
            )} */}

            {/* Top Gradient Stripe */}

            {/* Header and Filter Button - Updated with standardized spacing */}
            <div className="flex justify-between items-center text-lg font-semibold mb-1 text-gray-900 tracking-tight" data-tour="reconciliation-queue-header">
                <span>Reconciliation Queue ({totalCount} items)</span>
                <div className="flex gap-2">
                    {/* Show Clear Filters button only when filters are active */}
                    {hasActiveFilters && (
                        <Button
                            variant="solid"
                            color="red"
                            size="xs"
                            onClick={clearAllFilters}
                            data-tour="reconciliation-queue-filter"
                            className="flex items-center gap-2"
                        >
                            <X size={14} />
                            Clear Filters
                        </Button>
                    )}
                    <Button
                        variant="solid"
                        color="indigo"
                        size="xs"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                    <Button
                        variant="solid"
                        color="indigo"
                        size="xs"
                        icon={Filter}
                        onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                        data-tour="reconciliation-queue-filter"
                        className="flex items-center gap-2"
                    >
                        Advanced Filter

                    </Button>
                </div>
            </div>
            {/* Gradient Divider */}
            <div className="w-full h-0.5 bg-gradient-to-r from-indigo-600 via-green-500 to-transparent my-1 rounded-full"></div>

            <AdvancedFilterPanel
                isOpen={showAdvancedFilter}
                onClose={() => setShowAdvancedFilter(false)}
                title="Advanced Filters"
                filterFields={[{
                    key: 'from_date',
                    label: 'From Date',
                    type: 'date',
                    icon: Calendar,
                    maxKey: 'to_date'
                },
                {
                    key: 'to_date',
                    label: 'To Date',
                    type: 'date',
                    icon: Calendar,
                    minKey: 'from_date'
                },
                {
                    key: 'status',
                    label: 'Status',
                    type: 'select',
                    icon: ListFilter,
                    options: allStatusValues,
                    allOptionLabel: 'All Statuses'
                },
                {
                    key: 'stage',
                    label: 'Stage',
                    type: 'select',
                    icon: ListFilter,
                    options: ['New', 'Review', 'Reconcile', 'Upload'],
                    allOptionLabel: 'All Stages'
                }
                ]}
                values={filters}
                onChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
                onApply={handleApplyFilters}
                onClearAll={handleClearAllFilters}
                onClearDefaults={handleClearDefaultFilters}
            />

            <TableComponent
                data={files}
                columns={columns}
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
                setSortField={setSortField}
                sortAsc={sortAsc}
                setSortAsc={setSortAsc}
                page={page}
                setPage={setPage}
                emptyMessage={loading ? "Loading reconciliation data..." : "No documents found matching your criteria."}
                // CRITICAL CHANGE: Navigate using the invoice ID (invoice_id property)
                // Removed onRowClick to prevent navigation when clicking anywhere on the row
                // onRowClick={(item) => navigate(`/reconcile_queue/${encryptId(item.invoice_id)}`)}
                // Add pagination props
                totalCount={totalCount}
                pageSize={pageSize}
                setPageSize={setPageSize}
                data-tour="reconciliation-table"
                tableFiltersDataTour="reconciliation-table-filters"
                tableSortDataTour="reconciliation-table-sort"
                tableViewDataTour="reconciliation-table-view"
                tableReprocessDataTour="reconciliation-table-reprocess"
                tableDeleteDataTour="reconciliation-table-delete"
                tablePaginationDataTour="reconciliation-table-pagination"
                filtering={updatingResults} // Use updatingResults state for filtering indicator
            />
        </div>
    );
};

export default ReconQueue;
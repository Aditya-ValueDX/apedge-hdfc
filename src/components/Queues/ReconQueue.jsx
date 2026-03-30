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
import { encryptId } from '../../utils/cryptoUtils';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import { formatFileName } from '../../utils/fileUtils';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import { apiBaseUrl } from '../../config/apiConfig';
import { formatDate } from '../../utils/dateUtils';


// Add a helper function to validate date format (Copied from DocumentsQueue for robustness)
const isValidDateFormat = (dateString) => {
    if (!dateString) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date) && date.toISOString().slice(0, 10) === dateString;
};

// Add a helper function to validate numeric format (Copied from DocumentsQueue for robustness)
const isValidNumericFormat = (value) => {
    if (!value) return false;
    const numericRegex = /^-?\d+(\.\d+)?$/;
    return numericRegex.test(value);
};


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
        
        const invoice_number = searchParams.get('invoice_number');
        if (invoice_number) filters.invoice_number = invoice_number;
        
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
    const [showSortOptions, setShowSortOptions] = useState(false); // New state for sort options
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingResults, setUpdatingResults] = useState(false); // New state for updating results indicator
    const [initialLoad, setInitialLoad] = useState(true); // New state to track initial load
    // New state for storing all unique status values from the database
    const [allStatusValues, setAllStatusValues] = useState([]);

    const user = useSelector(state => state.auth.user);
    const token = user?.token;

    const [hasViewPermission, setHasViewPermission] = useState(false);

    const [columnFilters, setColumnFilters] = useState({
        id: '',
        invoice_number: '',
        vendor: '',
        created_at: '',
        status: '',
        total_amount: '',
        file_name: '', // Added for filtering
        userName: '', // New filter state
        tenantName: '', // New filter state
        ...getInitialColumnFilters()
    });
    
    // --- START: Debouncing Logic from DocumentsQueue ---
    // Add debounced column filters state
    const [debouncedColumnFilters, setDebouncedColumnFilters] = useState(columnFilters);
    
    // Add ref for debouncing
    const filterTimeoutRef = useRef(null);

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
    // --- END: Debouncing Logic ---

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
        if (sortField !== 'id') params.set('sortField', sortField);
        if (sortAsc) params.set('sortAsc', sortAsc.toString());
        
        // Add column filters - USE DEBOUNCED STATE FOR URL TO PREVENT FOCUS LOSS
        Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
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
    }, [page, pageSize, sortField, sortAsc, debouncedColumnFilters, filters, setSearchParams]);

    useEffect(() => {
        if (user && canUserView(user.role, '/reconcile_queue')) {
            setHasViewPermission(true);
        } else {
            setHasViewPermission(false);
        }
    }, [user]);

    // Function to fetch all unique status values from the database
    const fetchAllStatusValues = useCallback(async () => {
        if (!user || !token) {
            return;
        }

        try {
            // Build base URL for fetching distinct status values
            let statusUrl = `/api/v1/tables/ap_invoices?select=status`;

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

    useEffect(() => {
        const fetchData = async () => {
            if (!user || !hasViewPermission || !token) {
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

            // Updated URL to fetch user and tenant details
            let invoicesUrl = `/api/v1/tables/ap_invoices?select=*,ap_users(user_name),ap_tenants(tenant_name),ap_documents(file_path,mime_type),error_desc`;

            // Add pagination
            invoicesUrl += `&limit=${pageSize}&offset=${offset}`;

            // Add sorting
            const effectiveSortField = sortField || 'id';
            const effectiveSortAsc = sortAsc;

            let dbSortFieldMapped = effectiveSortField;
            if (effectiveSortField === 'id') dbSortFieldMapped = 'id';
            else if (effectiveSortField === 'invoice_number') dbSortFieldMapped = 'invoice_number';
            else if (effectiveSortField === 'po_number') dbSortFieldMapped = 'po_number';
            else if (effectiveSortField === 'vendor') dbSortFieldMapped = 'vendor';
            else if (effectiveSortField === 'invoice_date') dbSortFieldMapped = 'invoice_date';
            else if (effectiveSortField === 'file_name') dbSortFieldMapped = 'ap_documents.file_path';
            else if (effectiveSortField === 'created_at') dbSortFieldMapped = 'created_at';
            else if (effectiveSortField === 'status') dbSortFieldMapped = 'status';
            else if (effectiveSortField === 'total_amount') dbSortFieldMapped = 'total_amount';
            else if (effectiveSortField === 'userName') dbSortFieldMapped = 'ap_users.user_name';
            else if (effectiveSortField === 'tenantName') dbSortFieldMapped = 'ap_tenants.tenant_name';

            // For composite fields like ap_users.user_name, we need to handle sorting differently
            // to avoid parsing issues with the API
            if (effectiveSortField === 'userName' || effectiveSortField === 'tenantName') {
                // For joined fields, we'll sort by the foreign key field only to avoid parsing errors
                let baseField = 'id'; // Default to id
                if (effectiveSortField === 'userName') baseField = 'user_id';
                else if (effectiveSortField === 'tenantName') baseField = 'tenant_id';
                
                let orderQuery = `${baseField}.${effectiveSortAsc ? 'asc' : 'desc'}.nullslast`;
                
                // Add secondary sort by id to break ties
                if (baseField !== 'id') {
                    orderQuery += `,id.desc`;
                }
                
                invoicesUrl += `&order=${orderQuery}`;
            } else {
                let orderQuery = `${dbSortFieldMapped}.${effectiveSortAsc ? 'asc' : 'desc'}.nullslast`;

                // Add secondary sort by id to break ties
                if (effectiveSortField === 'created_at') {
                    orderQuery += `,id.desc`;
                } else if (effectiveSortField !== 'id') {
                    // Only add secondary sort for non-composite fields
                    orderQuery += `,id.desc`;
                }

                invoicesUrl += `&order=${orderQuery}`;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact' // Request total count
                }
            };

            // Add tenant filter for non-admin users
            if (user.role === 'account_user') {
                invoicesUrl += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
                if (!user.user_id || !user.tenantId) {
                    // Missing account_user user_id or tenantId.
                    setLoading(false);
                    return;
                }
                invoicesUrl += `&tenant_id=eq.${user.tenantId}`;
            }
            // Super admin needs no additional filter

            // Add status filter to only show reconcilation statuses
            invoicesUrl += `&status=in.(Reconciled,Partially_Reconciled,Not_Reconciled,Error)`;

            // Add column filters - USING DEBOUNCED FILTERS
            Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
                if (value) {
                    // For numeric values, don't encode them as they might cause issues
                    // For joined table fields, handle encoding carefully
                    let filterValue;
                    if (key === 'id' || key === 'total_amount') {
                        filterValue = value; // Don't encode numeric values for comparison, but still use the value
                    } else {
                        filterValue = encodeURIComponent(value);
                    }
                    
                    switch (key) {
                        case 'id':
                            // Fix: Use eq operator for numeric id instead of ilike to prevent encoding issues
                            // Validate that it's a number
                            if (!isNaN(filterValue) && filterValue !== '') {
                                invoicesUrl += `&id=eq.${filterValue}`;
                            }
                            break;
                        case 'invoice_number':
                            invoicesUrl += `&invoice_number=ilike.*${filterValue}*`;
                            break;
                        case 'po_number':
                            invoicesUrl += `&po_number=ilike.*${filterValue}*`;
                            break;
                        case 'vendor':
                            invoicesUrl += `&vendor=ilike.*${filterValue}*`;
                            break;
                        case 'invoice_date':
                            try {
                                // Fix: For DATE columns, use date format without time components
                                invoicesUrl += `&invoice_date=eq.${value}`;
                            } catch (e) {
                                // Invalid date for filtering
                            }
                            break;
                        case 'file_name':
                            invoicesUrl += `&ap_documents.file_path=ilike.*${filterValue}*`;
                            break;
                        case 'created_at':
                            try {
                                // For TIMESTAMP columns, use full ISO format
                                const dateObj = new Date(value);
                                const isoDate = dateObj.toISOString();
                                const nextDay = new Date(dateObj);
                                nextDay.setDate(nextDay.getDate() + 1);
                                const nextDayIso = nextDay.toISOString();
                                invoicesUrl += `&created_at=gte.${isoDate}&created_at=lt.${nextDayIso}`;
                            } catch (e) {
                                // Invalid date for filtering
                            }
                            break;
                        case 'status':
                            invoicesUrl += `&status=ilike.*${filterValue}*`;
                            break;
                        case 'stage':
                            invoicesUrl += `&stage=eq.${filterValue}`;
                            break;
                        case 'total_amount':
                            invoicesUrl += `&total_amount=ilike.*${filterValue}*`;
                            break;
                        case 'userName':
                            // Add validation to ensure the filter is applied properly
                            if (filterValue && filterValue.trim() !== '') {
                                invoicesUrl += `&ap_users.user_name=ilike.*${filterValue}*`;
                                // Add a condition to ensure we only get records where user_name is not null
                                invoicesUrl += `&ap_users.user_name=not.is.null`;
                            }
                            break;
                        case 'tenantName':
                            // Add validation to ensure the filter is applied properly
                            if (filterValue && filterValue.trim() !== '') {
                                invoicesUrl += `&ap_tenants.tenant_name=ilike.*${filterValue}*`;
                                // Add a condition to ensure we only get records where tenant_name is not null
                                invoicesUrl += `&ap_tenants.tenant_name=not.is.null`;
                            }
                            break;
                    }
                }
            });

            // Add advanced filters
            if (filters.from_date) {
                try {
                    const fromDate = new Date(filters.from_date);
                    fromDate.setHours(0, 0, 0, 0); // Set to start of day
                    const isoFromDate = fromDate.toISOString();
                    invoicesUrl += `&created_at=gte.${encodeURIComponent(isoFromDate)}`;
                } catch (e) {
                    // Invalid from_date for advanced filtering
                }
            }
            
            if (filters.to_date) {
                try {
                    const toDate = new Date(filters.to_date);
                    toDate.setHours(23, 59, 59, 999); // Set to end of day
                    const isoToDate = toDate.toISOString();
                    invoicesUrl += `&created_at=lte.${encodeURIComponent(isoToDate)}`;
                } catch (e) {
                    // Invalid to_date for advanced filtering
                }
            }
            
            if (filters.vendor) invoicesUrl += `&vendor=ilike.*${encodeURIComponent(filters.vendor)}*`;
            if (filters.status) invoicesUrl += `&status=eq.${encodeURIComponent(filters.status)}`;
            if (filters.po_number) invoicesUrl += `&po_number=ilike.*${encodeURIComponent(filters.po_number)}*`;
            if (filters.amount_min) invoicesUrl += `&total_amount=gte.${encodeURIComponent(filters.amount_min)}`;
            if (filters.amount_max) invoicesUrl += `&total_amount=lte.${encodeURIComponent(filters.amount_max)}`;

            try {
                const res = await axios.get(invoicesUrl, config);
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

                // Process and format the data
                const formatted = data.map((inv) => {
                    // Use empty strings instead of 'N/A' to ensure proper filtering behavior
                    // When filtering is applied, rows with empty values will not match and will be excluded
                    const userName = inv.ap_users ? inv.ap_users.user_name : '';
                    const tenantName = inv.ap_tenants ? inv.ap_tenants.tenant_name : '';

                    return {
                        ...inv,
                        userName,
                        tenantName,
                        file_name: formatFileName(inv.ap_documents?.file_path || ''), // Add formatted file name
                    };
                });

                // Additional client-side filtering as a safety measure
                // This ensures that when filters are applied, we don't show rows with empty values
                let filteredData = formatted;
                
                // If userName filter is applied, filter out rows with empty userName - USING DEBOUNCED FILTERS
                if (debouncedColumnFilters.userName && debouncedColumnFilters.userName.trim()) {
                    filteredData = filteredData.filter(inv => 
                        inv.userName && inv.userName.trim() && 
                        inv.userName.toLowerCase().includes(debouncedColumnFilters.userName.toLowerCase())
                    );
                }
                
                // If tenantName filter is applied, filter out rows with empty tenantName - USING DEBOUNCED FILTERS
                if (debouncedColumnFilters.tenantName && debouncedColumnFilters.tenantName.trim()) {
                    filteredData = filteredData.filter(inv => 
                        inv.tenantName && inv.tenantName.trim() && 
                        inv.tenantName.toLowerCase().includes(debouncedColumnFilters.tenantName.toLowerCase())
                    );
                }

                setFiles(filteredData);
            } catch (err) {
                // Failed to fetch invoices
                toast.error('Failed to fetch invoices.');
                setTotalCount(0); // Reset count on error
                setFiles([]); // Clear data on error
            } finally {
                setLoading(false);
                setUpdatingResults(false);
                setInitialLoad(false); // Mark initial load as complete
            }
        };

        fetchData();
    }, [user, hasViewPermission, token, page, pageSize, sortField, sortAsc, filters, debouncedColumnFilters, initialLoad]); // UPDATED: Ensure debouncedColumnFilters is the dependency

    const openViewer = useCallback(async (document) => {
        if (!document || !token) {
            // No document available or token missing for this entry
            toast.error('Cannot view document: missing file path or authentication token.');
            return;
        }
        try {
            const response = await axios.get(`/api/${document.file_path}`, {
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

    const capitalizeStatus = (status) => {
        if (!status) return '';
        return String(status)
            .replace(/_/g, ' ')
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

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
            invoice_number: '',
            vendor: '',
            created_at: '',
            status: '',
            total_amount: '',
            file_name: '',
            userName: '',
            tenantName: '',
        });
        setPage(1); // Reset page when clearing filters
    };

    const clearSortOptions = () => {
        setSortField('id'); // Reset to default sort field
        setSortAsc(false); // Reset to descending order (default)
        setPage(1); // Reset page when clearing sort
    };

    const hasActiveFilters = useMemo(() => {
        // Check if any column filters are active
        const hasColumnFilters = Object.values(debouncedColumnFilters).some(value => value !== '');
        
        // Check if any advanced filters are active
        const hasAdvancedFilters = Object.values(filters).some(value => value !== '');
        
        return hasColumnFilters || hasAdvancedFilters;
    }, [debouncedColumnFilters, filters]);

    // Function to handle filter changes with debounce
    const handleColumnFilterChange = (key, value) => {
        setColumnFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Add the handleApplyFilters function
    const handleApplyFilters = () => {
        // setPage(1); // Reset page on apply - REMOVED to prevent full page reload
        setShowAdvancedFilter(false);
        // We don't need a refetch trigger here since the useEffect will pick up the filter changes
    };

    // Added handleRefresh function
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            // Refresh all status values along with documents
            await Promise.all([
                fetchAllStatusValues(),
                new Promise(resolve => setTimeout(resolve, 500)) // Small delay to show refresh animation
            ]);
            // Force a refetch by updating a dummy state or resetting page
            setPage(1);
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    }, [fetchAllStatusValues]);

    const [modalOpen, setModalOpen] = useState(false);
    const [docUrl, setDocUrl] = useState('');

    const columns = useMemo(() => {
        const baseColumns = [
            // {
            //     key: 'id',
            //     header: 'ID',
            //     sortable: true,
            //     filterable: true,
            //     width: '70px',
            // },
            {
                key: 'invoice_number',
                header: 'Invoice Number',
                sortable: true,
                filterable: true,
                width: '120px',
            },
            {
                key: 'po_number',
                header: 'PO Number',
                sortable: true,
                filterable: true,
                width: '100px',
            },
            {
                key: 'vendor',
                header: 'Vendor',
                sortable: true,
                filterable: true,
                width: '120px',
            },
            {
                key: 'invoice_date',
                header: 'Invoice Date',
                sortable: true,
                filterable: true,
                filterType: 'date',
                width: '100px',
                render: (item) => (
                    <div className="text-xs text-gray-800">
                        {item.invoice_date ? formatDate(item.invoice_date) : ''}
                    </div>
                ),
            },
            {
                key: 'file_name',
                header: <>File Name <FileText size={12} className="inline ml-1" /></>,
                sortable: true,
                filterable: true,
                width: '150px',
                render: (item) => (
                    <div className="text-xs text-gray-800 truncate max-w-[130px]" title={item.file_name}>
                        {item.file_name}
                    </div>
                ),
            },
            {
                key: 'created_at',
                header: <>Created At <Clock size={12} className="inline ml-1" /></>,
                sortable: true,
                filterable: true,
                filterType: 'date',
                width: '120px',
                render: (item) => (
                    <div className="text-xs text-gray-800">
                        {item.created_at ? formatDate(item.created_at) : ''}
                    </div>
                ),
            },
            {
                key: 'status',
                header: <>Status</>,
                sortable: true,
                filterable: true,
                filterType: 'select',
                filterOptions: () => allStatusValues,
                width: '130px',
                render: (item) => <StatusBadge status={item.status} capitalizeStatus={capitalizeStatus} />,
            },
            {
                key: 'total_amount',
                header: <>Total <DollarSign size={12} className="inline ml-1" /></>,
                sortable: true,
                filterable: true,
                width: '80px',
                render: (item) => (
                    <div className="text-xs text-gray-800">
                        {parseFloat(item.total_amount || 0).toFixed(2)}
                    </div>
                ),
            },
            {
                key: 'stage',
                header: <>Stage <Info size={12} className="inline ml-1" /></>,
                sortable: true,
                filterable: true,
                width: '100px',
                render: (item) => <StageDisplay stage={item.stage} />,
            },
            {
                key: 'action',
                header: <div>Action</div>,
                sortable: false,
                filterable: false,
                width: '50px',
                render: (item) => (
                    <div className="flex items-center gap-1">
                        <button
                            className="text-indigo-600 hover:text-indigo-800 font-semibold py-1 px-2 rounded-md flex items-center justify-center"
                            onClick={(e) => { e.stopPropagation(); openViewer(item.ap_documents); }}
                            title="View Document"
                            data-tour="reconciliation-table-view"
                        >
                            <Lock size={16} />
                        </button>
                    </div>
                ),
            }
        ];

        // Conditionally add user and tenant columns based on user role
        if (user?.role === 'account_manager' || user?.role === 'tenant_admin' || user?.role === 'super_admin') {
            baseColumns.splice(-1, 0, {
                key: 'userName',
                header: 'User',
                sortable: true,
                filterable: true,
                width: '100px',
            });

            if (user?.role === 'super_admin') {
                baseColumns.splice(-1, 0, {
                    key: 'tenantName',
                    header: 'Tenant',
                    sortable: true,
                    filterable: true,
                    width: '100px',
                });
            }
        }

        return baseColumns;

    }, [getUniqueValues, openViewer, user, allStatusValues]);

    // Function to get unique values for filter options
    const getUniqueValues = useCallback((field) => {
        return [
            ...new Set(
                files
                    .map((file) => file[field])
                    .filter((val) => val !== null && val !== undefined && val !== '')
            ),
        ];
    }, [files]);

    // Tailwind CSS Styling for UI states

    // Show loading spinner only during initial load
    if (loading && initialLoad) {
        return (
            // Loading State - Matching RequestList style
            <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-xl border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <h2 className="text-xl font-bold mb-4">Loading Reconciliation Queue...</h2>
                <Loader2 size={32} className="animate-spin text-indigo-600" />
                <p className="text-gray-600 mt-4">Please wait while your data is being loaded.</p>
            </div>
        );
    }
    
    if (!hasViewPermission) {
        return (
            // Permission Denied State - Matching RequestList style
            <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-xl border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <h2 className="text-xl font-bold mb-4">Access Denied</h2>
                <p className="text-gray-600">You do not have permission to view this page. Please contact your administrator.</p>
            </div>
        );
    }

    return (
        // Main Container - Updated with standardized spacing
        <div className="p-5 bg-slate-50 text-gray-800 m-5 rounded-md border border-gray-200 shadow-xl relative flex flex-col">
            <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
            
            {/* Top Gradient Stripe */}
            <div className="absolute top-0 left-1.5 right-1.5 h-1 rounded-t-md bg-gradient-to-r from-indigo-600 via-emerald-500 to-yellow-500"></div>
            
            {/* Header and Filter Button - Updated with standardized spacing */}
            <div className="flex justify-between items-center text-lg font-semibold text-gray-900 tracking-tight" data-tour="reconciliation-queue-header">
                <span>Reconciliation Queue ({totalCount} items)</span>
                <div className="flex gap-2">
                    {/* Show Clear Filters button only when filters are active */}
                    {hasActiveFilters && (
                        <button
                            className="flex items-center gap-2 p-1.5 bg-red-500 text-white rounded-md cursor-pointer font-semibold text-xs"
                            onClick={clearAllFilters}
                            data-tour="reconciliation-queue-filter"
                        >
                            <X size={14} />
                            Clear Filters
                        </button>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 p-1.5 bg-indigo-600 text-white rounded-md cursor-pointer font-semibold text-xs disabled:cursor-not-allowed disabled:bg-gray-400"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button
                        className="flex items-center gap-2 p-1.5 bg-indigo-600 text-white rounded-md cursor-pointer font-semibold text-xs"
                        onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                        data-tour="reconciliation-queue-filter"
                    >
                        <Filter size={14} />
                        Advanced Filter
                        <ChevronDown
                            size={16}
                            className={`${showAdvancedFilter ? 'rotate-180' : 'rotate-0'}`}
                        />
                    </button>
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
                                    <option value="invoice_number">Invoice Number</option>
                                    <option value="vendor">Vendor</option>
                                    <option value="created_at">Created At</option>
                                    <option value="status">Status</option>
                                    <option value="total_amount">Total Amount</option>
                                    <option value="file_name">File Name</option>
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
                                    // setPage(1); // Reset page on apply - REMOVED to prevent full page reload
                                    setShowSortOptions(false);
                                }}
                            >
                                Apply Sort
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAdvancedFilter && (
                // Advanced Filter Modal - Updated with standardized spacing
                <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white mt-12 p-5 rounded-md shadow-xl border border-gray-200 z-[10000] w-[90%] max-w-md flex flex-col max-h-[70vh] overflow-hidden">
                        <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-200 flex-shrink-0">
                            <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                                <ListFilter size={18} /> Advanced Filters
                            </h3>
                            <button
                                className="bg-transparent border-none cursor-pointer text-gray-500 hover:text-gray-700 p-1"
                                onClick={() => setShowAdvancedFilter(false)}
                                aria-label="Close advanced filters"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-5 mb-5 flex-grow overflow-y-auto pr-3">
                            {/* Filter fields with standardized spacing */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-700 tracking-wider uppercase flex items-center gap-1 mb-1">
                                    <Calendar size={12} /> From Date
                                </label>
                                <input
                                    type="date"
                                    className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-800 w-full shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                                    value={filters.from_date}
                                    onChange={(e) =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            from_date: e.target.value,
                                        }))
                                    }
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-700 tracking-wider uppercase flex items-center gap-1 mb-1">
                                    <Calendar size={12} /> To Date
                                </label>
                                <input
                                    type="date"
                                    className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-800 w-full shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                                    value={filters.to_date}
                                    onChange={(e) =>
                                        setFilters((prev) => ({ ...prev, to_date: e.target.value }))
                                    }
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-700 tracking-wider uppercase flex items-center gap-1 mb-1">
                                    <User size={12} /> Vendor
                                </label>
                                <input
                                    type="text"
                                    className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-800 w-full shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                                    placeholder="Search vendor..."
                                    value={filters.vendor}
                                    onChange={(e) =>
                                        setFilters((prev) => ({ ...prev, vendor: e.target.value }))
                                    }
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-700 tracking-wider uppercase mb-1">
                                    Status
                                </label>
                                <select
                                    className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-800 w-full shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                                    value={filters.status}
                                    onChange={(e) =>
                                        setFilters((prev) => ({ ...prev, status: e.target.value }))
                                    }
                                >
                                    <option value="">All Statuses</option>
                                    {/* Use allStatusValues instead of getUniqueValues('status') */}
                                    {allStatusValues.map(status => (
                                        <option key={status} value={status}>{capitalizeStatus(status)}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-700 tracking-wider uppercase flex items-center gap-1 mb-1">
                                    <DollarSign size={12} /> Min Amount
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-800 w-full shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                                    placeholder="0.00"
                                    value={filters.amount_min}
                                    onChange={(e) =>
                                        setFilters((prev) => ({ ...prev, amount_min: e.target.value }))
                                    }
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-700 tracking-wider uppercase flex items-center gap-1 mb-1">
                                    <DollarSign size={12} /> Max Amount
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-800 w-full shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                                    placeholder="0.00"
                                    value={filters.amount_max}
                                    onChange={(e) =>
                                        setFilters((prev) => ({ ...prev, amount_max: e.target.value }))
                                    }
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-700 tracking-wider uppercase flex items-center gap-1 mb-1">
                                    <Hash size={12} /> PO Number
                                </label>
                                <input
                                    type="text"
                                    className="text-sm font-medium px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-800 w-full shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                                    placeholder="Search PO number..."
                                    value={filters.po_number}
                                    onChange={(e) =>
                                        setFilters((prev) => ({ ...prev, po_number: e.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 flex-shrink-0">
                            <button 
                                className="bg-transparent border border-gray-300 text-gray-600 px-4 py-2 rounded-md font-semibold text-xs hover:bg-gray-50 hover:text-gray-800" 
                                onClick={() => {
                                    clearAllFilters();
                                    setShowAdvancedFilter(false); // Close the popup after clearing filters
                                }}
                            >
                                Clear All
                            </button>
                            <button
                                className="bg-indigo-600 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-sm hover:bg-indigo-700"
                                onClick={handleApplyFilters}
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <TableComponent
                data={files} // Pass server-side paginated data
                columns={columns}
                columnFilters={columnFilters} // Pass immediate state for instant input reflection/focus
                setColumnFilters={setColumnFilters}
                sortField={sortField}
                setSortField={setSortField}
                sortAsc={sortAsc}
                setSortAsc={setSortAsc}
                page={page}
                setPage={setPage}
                emptyMessage={loading ? "Loading reconciliation data..." : "No documents found matching your criteria."}
                onRowClick={(item) => navigate(`/reconcile_queue/${encryptId(item.id)}`)}
                // Pass pagination props
                totalCount={totalCount}
                pageSize={pageSize}
                setPageSize={setPageSize} // Pass the setPageSize function
                filtering={updatingResults} // Use updatingResults state for filtering indicator
                data-tour="reconciliation-table"
                tableFiltersDataTour="reconciliation-table-filters"
                tableSortDataTour="reconciliation-table-sort"
                tableViewDataTour="reconciliation-table-view"
                tableReprocessDataTour="reconciliation-table-reprocess"
                tableDeleteDataTour="reconciliation-table-delete"
                tablePaginationDataTour="reconciliation-table-pagination"
            />
            
            {/* Color legend for reconciliation queue */}
            <ColorLegend 
                showDuplicateBill={files.some(file => file.error_desc && (file.error_desc.Note || file.error_desc.note))}
                // showReadyForRerun={files.some(file => file.stage === 'Upload' && (file.status === 'Error' || file.status === 'Failure'))}
                // showError={files.some(file => file.error_desc && (file.error_desc.Error || file.error_desc.error))}
                currentPage="reconcileQueue"
            />
        </div>
    );
};

export default ReconQueue;
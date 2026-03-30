import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    Filter,
    X,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    Clock,
    Eye,
    FileDown,
    TrendingUp,
    CheckCircle,
    AlertCircle,
    XCircle,
    Loader2,
    Calendar,
    User,
    FileText,
    Building2,
    Package,
    Search,
    RefreshCw,
    Info,
    ArrowUpDown,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import axios from '../../utils/authInterceptor';
import ViewInvoiceDetailDialog from './ViewInvoiceDetailDialog';
import ViewDocumentModal from '../View/ViewDocumentModal';
import * as XLSX from 'xlsx';
import TableComponent from '../common/TableComponent'; // Import TableComponent
import StatusCard, { resetUsedIcons, BalancedCardGrid } from '../common/StatusCard';
import AdvancedFilterPanel from '../common/AdvancedFilterPanel';
import Button from '../common/Button';
import { apiBaseUrl } from '../../config/apiConfig';
import { formatFileName } from '../../utils/fileUtils';
import { useSearchParams } from 'react-router-dom';
import { getStatusColor } from '../../utils/Statuscolorutils';

// ─── PER-FIELD CONFLICT MAPS ──────────────────────────────────────────────────
// Column filter key → advanced (tempFilters/appliedFilters) keys to clear
const COLUMN_TO_ADVANCED_CONFLICT_IR = {
    status:     ['status'],
    stage:      ['stage'],
    created_at: ['from_date', 'to_date'],
};

// Advanced filter key → column filter keys to clear when that advanced field is applied
const ADVANCED_TO_COLUMN_CONFLICT_IR = {
    status:    ['status'],
    stage:     ['stage'],
    from_date: ['created_at'],
    to_date:   ['created_at'],
};
// ─────────────────────────────────────────────────────────────────────────────

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

// Global styles for animations
const styles = `
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-scaleIn {
  animation: scaleIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.animate-slideIn {
  animation: slideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
`;

const InvoiceReports = () => {
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
        // Add all possible column filter keys here
        const invoice_id = searchParams.get('invoice_id');
        if (invoice_id) filters.invoice_id = invoice_id;

        const tenant_name = searchParams.get('tenant_name');
        if (tenant_name) filters.tenant_name = tenant_name;

        const invoice_no = searchParams.get('invoice_no');
        if (invoice_no) filters.invoice_no = invoice_no;

        const po_no = searchParams.get('po_no');
        if (po_no) filters.po_no = po_no;

        const vendor_name = searchParams.get('vendor_name');
        if (vendor_name) filters.vendor_name = vendor_name;

        const doc_id = searchParams.get('doc_id');
        if (doc_id) filters.doc_id = doc_id;

        const user_id = searchParams.get('user_id');
        if (user_id) filters.user_id = user_id;

        const invoice_date = searchParams.get('invoice_date');
        if (invoice_date) filters.invoice_date = invoice_date;

        const created_at = searchParams.get('created_at');
        if (created_at) filters.created_at = created_at;

        const stage = searchParams.get('stage');
        if (stage) filters.stage = stage;

        const status = searchParams.get('status');
        if (status) filters.status = status;





        return filters;
    };

    // Redux state
    const user = useSelector(state => state.auth.user);
    const token = useSelector(state => state.auth.token);

    // Component state
    const [invoices, setInvoices] = useState([]);
    const [page, setPage] = useState(getInitialPage());
    const [pageSize, setPageSize] = useState(getInitialPageSize()); // Added for pagination
    const [totalCount, setTotalCount] = useState(0); // Added for pagination
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filtering, setFiltering] = useState(false);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

    // New state for storing all unique status values from the database
    const [allStatusValues, setAllStatusValues] = useState([]);

    const capitalizeStatus = (status) =>
        String(status || '')
            .replace(/_/g, ' ')
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

    // --- ADVANCED FILTER PANEL FIELD DEFINITIONS ---
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
            key: 'status',
            label: 'Status',
            type: 'select',
            icon: CheckCircle,
            options: allStatusValues.map(s => ({ value: s, label: capitalizeStatus(s) })),
            allOptionLabel: 'All Statuses',
        },
        {
            key: 'stage',
            label: 'Stage',
            type: 'text',
            icon: Clock,
            placeholder: 'Filter by stage',
        },
    ], [allStatusValues, capitalizeStatus]);

    // New state for storing all unique stage values from the database
    const [allStageValues, setAllStageValues] = useState([]);

    // Summary statistics state
    const [summaryStats, setSummaryStats] = useState({
        totalApproved: 0,
        totalPending: 0,
        totalRejected: 0
    });

    // State for status counts
    const [statusCounts, setStatusCounts] = useState({});
    const [statusCardsConfig, setStatusCardsConfig] = useState([]);
    const [loadingStatusCounts, setLoadingStatusCounts] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const itemsPerPage = 10;
    const searchInputRef = useRef(null);
    const filterButtonRef = useRef(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchField, setSearchField] = useState('all'); // all, invoice_no, vendor_name, po_no, user_id, doc_id
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, right: 0 });

    // Sorting state
    const [sortField, setSortField] = useState(getInitialSortField()); // Changed to match TableComponent
    const [sortAsc, setSortAsc] = useState(getInitialSortAsc()); // Changed to match TableComponent

    // Column filters state for TableComponent
    const [columnFilters, setColumnFilters] = useState({
        ...getInitialColumnFilters()
    });

    // Debounced filters — drive API refetch (same pattern as ExtractionQueue)
    const [debouncedColumnFilters, setDebouncedColumnFilters] = useState({
        ...getInitialColumnFilters()
    });
    const filterDebounceRef = useRef(null);

    // CardPopup states
    const [cardPopup, setCardPopup] = useState({
        isOpen: false,
        title: '',
        content: '',
        isEditable: false,
        contentType: 'text'
    });

    // User Popover states
    const [userPopover, setUserPopover] = useState({
        isOpen: false,
        userId: null,
        userData: null,
        loading: false,
        position: { top: 0, left: 0 }
    });

    // Document Preview Modal states
    const [documentModal, setDocumentModal] = useState({
        isOpen: false,
        fileUrl: '',
        fileName: '',
        loading: false
    });

    // Export confirmation dialog state
    const [showExportDialog, setShowExportDialog] = useState(false);
    // Add state for column selection
    const [selectedExportColumns, setSelectedExportColumns] = useState([]);
    // Add state for export loading overlay
    const [exportLoading, setExportLoading] = useState(false);

    // Track whether we are using the implicit 1-month default date range.
    // It becomes false once the user explicitly changes the date range in the Advanced Filter panel.
    // It resets to true when the user clears all filters.
    const [isDefaultDateRange, setIsDefaultDateRange] = useState(true);

    // State for default date filter popover
    const [showNotePopover, setShowNotePopover] = useState(false);
    const noteRef = useRef(null);

    // Store original default dates when opening the filter panel
    const originalDefaultFromDate = useRef(getOneMonthAgoDate());
    const originalDefaultToDate = useRef(getTodayDate());

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
        if (sortAsc) params.set('sortAsc', sortAsc.toString()); // Only set if not default (false)

        // Add column filters
        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        // Only update URL if there are params to set
        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            // Clear URL params if no filters are active
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, columnFilters, setSearchParams]);

    // Debounce column filters (300 ms) — same as ExtractionQueue
    useEffect(() => {
        if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
        filterDebounceRef.current = setTimeout(() => {
            setDebouncedColumnFilters({ ...columnFilters });
        }, 300);
        return () => clearTimeout(filterDebounceRef.current);
    }, [columnFilters]);

    // Inject animation styles
    useEffect(() => {
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // Cleanup function to remove the style tag when component unmounts
        return () => {
            document.head.removeChild(styleSheet);
        };
    }, []);

    // Prevent page refresh during export
    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (exportLoading) {
                event.preventDefault();
                event.returnValue = 'An export operation is in progress. Are you sure you want to leave this page?';
                return event.returnValue;
            }
        };

        if (exportLoading) {
            window.addEventListener('beforeunload', handleBeforeUnload);
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [exportLoading]);

    // Initialize export columns when dialog opens
    const initializeExportColumns = () => {
        // Create a comprehensive list of all possible export columns
        const allPossibleColumns = [
            { key: 'invoice_id', header: 'ID', selected: true },
            { key: 'tenant_name', header: 'Tenant Name', selected: true },
            { key: 'invoice_no', header: 'Invoice No', selected: true },
            { key: 'invoice_date', header: 'Invoice Date', selected: true },
            { key: 'po_no', header: 'PO Number', selected: true },
            { key: 'vendor_name', header: 'Vendor', selected: true },
            { key: 'doc_id', header: 'File Name', selected: true },
            { key: 'user_id', header: 'User Name', selected: true },
            { key: 'stage', header: 'Stage', selected: true },
            { key: 'status', header: 'Status', selected: true },
            { key: 'error_desc', header: 'Error Description', selected: true },
            { key: 'comments', header: 'Comments', selected: true },
            { key: 'extracted_data', header: 'Extracted Data', selected: false }, // Default to unselected
            { key: 'extracted_data_history', header: 'Extracted Data History', selected: false }, // Default to unselected
            { key: 'page_count', header: 'Page Count', selected: true }, // Add page count column
            { key: 'created_at', header: 'Created On', selected: true },
            { key: 'created_by', header: 'Created By', selected: true },
            { key: 'updated_at', header: 'Updated On', selected: true },
            { key: 'updated_by', header: 'Updated By', selected: true }
        ];

        // Filter columns based on user role and availability in the data
        const filteredColumns = allPossibleColumns.filter(col => {
            // For account_user role, hide specific columns
            if (user.role === 'account_user') {
                if (['created_by', 'updated_by', 'extracted_data', 'extracted_data_history'].includes(col.key)) {
                    return false; // Don't include these columns for account_user
                }
            }

            // Always include basic columns
            if (['invoice_id', 'invoice_no', 'po_no', 'vendor_name', 'doc_id', 'stage', 'status', 'created_at', 'updated_at'].includes(col.key)) {
                return true;
            }

            // Role-based columns
            if (col.key === 'tenant_name') {
                return user.role === 'super_admin';
            }

            if (col.key === 'user_id') {
                return user.role === 'tenant_admin' || user.role === 'account_manager' || user.role === 'super_admin';
            }

            // Include all other columns by default
            return true;
        });

        setSelectedExportColumns(filteredColumns);
    };

    const handleExportClick = () => {
        initializeExportColumns();
        setShowExportDialog(true);
    };


    // API functions
    // Fetch user details for popover
    const fetchUserDetails = async (userId) => {
        if (!user || !token) return null;

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            const response = await axios.get(`/api/v1/tables/ap_users?id=eq.${userId}&select=*`, config);

            if (response.status === 200 && response.data.length > 0) {
                return response.data[0];
            }
            return null;
        } catch (error) {
            // Error fetching user details
            return null;
        }
    };

    // Fetch document details and open preview modal
    const fetchDocumentAndPreview = async (docId) => {
        if (!user || !token || !docId) return;

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            // First fetch the document metadata
            const response = await axios.get(`/api/v1/tables/ap_documents?doc_id=eq.${docId}&select=*`, config);

            // Document response

            if (response.status === 200 && response.data.length > 0) {
                const document = response.data[0];
                // Document data

                // Try multiple possible field names for file path
                let filePath = document.file_path ||
                    document.doc_path ||
                    document.path ||
                    document.file_url ||
                    document.url ||
                    document.document_path ||
                    '';

                // Try multiple possible field names for file name
                let fileName = document.file_name ||
                    document.doc_name ||
                    document.name ||
                    document.document_name ||
                    document.original_name ||
                    '';

                // If no explicit filename, extract from path
                if (!fileName && filePath) {
                    // Extract filename from path (handle both forward and back slashes)
                    const pathParts = filePath.split(/[/\\]/);
                    fileName = pathParts[pathParts.length - 1];
                }

                // If still no filename, use default
                if (!fileName) {
                    fileName = `Document_${docId}.pdf`;
                }

                // Original File Path
                // Extracted File Name

                if (!filePath || filePath === '') {
                    // No file path found in document data
                    setDocumentModal({
                        isOpen: true,
                        fileUrl: 'not-found',
                        fileName: fileName,
                        loading: false
                    });
                    return;
                }

                // Convert Windows-style backslashes to forward slashes
                filePath = filePath.replace(/\\/g, '/');

                // Build the full URL - convert relative path to absolute URL
                // If the path doesn't start with http/https, make it relative to the API base
                let fileUrl;
                if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
                    fileUrl = filePath;
                } else {
                    // Remove leading slash if present to avoid double slashes
                    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

                    // Based on vite proxy config, /api routes to backend server
                    // The file path from DB is: files/1/filename.pdf
                    // So the full URL should be: /api/files/1/filename.pdf
                    fileUrl = `/api/${cleanPath}`;
                }

                // Final File URL

                setDocumentModal({
                    isOpen: true,
                    fileUrl: fileUrl,
                    fileName: fileName,
                    loading: false
                });
            } else {
                // Document not found in database
                // If document not found
                setDocumentModal({
                    isOpen: true,
                    fileUrl: 'not-found',
                    fileName: `Document_${docId}.pdf`,
                    loading: false
                });
            }
        } catch (error) {
            // Error fetching document
            setDocumentModal({
                isOpen: true,
                fileUrl: 'not-found',
                fileName: `Document_${docId}.pdf`,
                loading: false
            });
        }
    };

    const handleDocIdClick = (docId) => {
        if (!docId) return;

        setDocumentModal({
            isOpen: true,
            fileUrl: '',
            fileName: '',
            loading: true
        });

        fetchDocumentAndPreview(docId);
    };

    const handleUserIdClick = async (userId, event) => {
        const rect = event.target.getBoundingClientRect();
        const popoverWidth = 320; // w-80 = 320px
        const popoverMaxHeight = window.innerHeight * 0.85; // 85vh
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        let top, left;

        // For large screens (desktop), position near the clicked element
        if (viewportWidth >= 640) {
            // Calculate position relative to clicked element
            top = rect.bottom + scrollY + 8; // 8px gap below element
            left = rect.left + scrollX;

            // Adjust horizontal position if popover goes off-screen
            if (left + popoverWidth > viewportWidth + scrollX) {
                // Try positioning to the left of the element
                left = rect.right + scrollX - popoverWidth;
                // If still off-screen, align to right edge with margin
                if (left < scrollX + 10) {
                    left = scrollX + viewportWidth - popoverWidth - 10;
                }
            }

            // Ensure minimum left margin
            left = Math.max(scrollX + 10, left);
        } else {
            // For small screens, center the popover in the viewport
            const popoverHeight = popoverMaxHeight; // Use max height for centering calculation

            // Center horizontally
            left = (viewportWidth - popoverWidth) / 2;

            // Center vertically in the current viewport
            top = scrollY + (viewportHeight - popoverHeight) / 2;

            // Ensure minimum margins
            left = Math.max(10, left);
            top = Math.max(scrollY + 10, top);
        }

        setUserPopover({
            isOpen: true,
            userId: userId,
            userData: null,
            loading: true,
            position: {
                top: top,
                left: left
            }
        });

        // Fetch user data
        const userData = await fetchUserDetails(userId);
        setUserPopover(prev => ({
            ...prev,
            userData: userData,
            loading: false
        }));
    };

    // Fetch summary statistics without pagination
    const fetchSummaryStats = async () => {
        if (!user || !token || !user.role) {
            return;
        }

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact' // Request total count
                }
            };

            let apiUrl = `/api/v1/tables/ap_invoices?select=*,ap_tenants(tenant_name),ap_users(user_name)`;

            // Apply role-based filtering
            if (user.role === 'tenant_admin' || user.role === 'account_manager') {
                apiUrl += `&tenant_id=eq.${user.tenantId}`;
            }
            else if (user.role === 'account_user') {
                apiUrl += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            }


            // Add sorting — client-side sort fields fall back to invoice_id for stable ordering
            let dbSortField = sortField;
            switch (sortField) {
                case 'tenant_name':
                case 'user_id':
                case 'doc_id':
                case 'invoice_no':
                case 'po_no':
                case 'vendor_name': dbSortField = 'invoice_id'; break;
                default:            dbSortField = sortField;
            }

            const orderDirection = sortAsc ? 'asc' : 'desc';
            apiUrl += `&order=${dbSortField}.${orderDirection}`;

            // Apply search term based on selected field
            if (searchTerm.trim()) {
                const searchLower = searchTerm.toLowerCase();
                switch (searchField) {
                    case 'invoice_no':
                        apiUrl += `&invoice_no=ilike.*${searchLower}*`;
                        break;
                    case 'vendor_name':
                        apiUrl += `&vendor_name=ilike.*${searchLower}*`;
                        break;
                    case 'po_no':
                        apiUrl += `&po_no=ilike.*${searchLower}*`;
                        break;
                    case 'user_id':   // user name search
                        apiUrl += `&ap_users.user_name=ilike.*${searchLower}*`;
                        break;
                    case 'doc_id':
                        // File name filtering is handled client-side
                        break;
                    case 'status':
                        apiUrl += `&status=ilike.*${searchLower}*`;
                        break;
                    case 'all':
                    default:
                        apiUrl += `&or=(invoice_no.ilike.*${searchLower}*,vendor_name.ilike.*${searchLower}*,po_no.ilike.*${searchLower}*,status.ilike.*${searchLower}*)`;
                        // File name filtering is handled client-side
                        break;
                }
            }

            // Apply column filters
            Object.entries(columnFilters).forEach(([key, value]) => {
                if (value) {
                    const filterValue = encodeURIComponent(value);
                    switch (key) {
                        case 'invoice_id':
                            // For numeric fields, check if the value is numeric
                            if (/^\d+$/.test(value)) {
                                // Exact match for numeric values
                                apiUrl += `&invoice_id=eq.${filterValue}`;
                            } else {
                                // Partial match for non-numeric values
                                apiUrl += `&invoice_id=ilike.*${filterValue}*`;
                            }
                            break;
                        case 'tenant_name':
                            // Handled client-side — skip server filter to avoid incorrect counts.
                            break;
                        case 'invoice_no':
                            apiUrl += `&invoice_no=ilike.*${filterValue}*`;
                            break;
                        case 'po_no':
                            apiUrl += `&po_no=ilike.*${filterValue}*`;
                            break;
                        case 'vendor_name':
                            apiUrl += `&vendor_name=ilike.*${filterValue}*`;
                            break;
                        case 'doc_id':
                            // File name filtering is handled client-side
                            break;
                        case 'user_id':
                            // Handled client-side — skip server filter to avoid incorrect counts.
                            break;
                        case 'invoice_date':
                            try {
                                const nextDay = new Date(value);
                                nextDay.setDate(nextDay.getDate() + 1);
                                apiUrl += `&invoice_date=gte.${value}&invoice_date=lt.${nextDay.toISOString().split('T')[0]}`;
                            } catch (e) {
                                // Invalid date for filtering
                            }
                            break;
                        case 'created_at':
                            try {
                                // For TIMESTAMP columns, we need to use proper timestamp formatting
                                // Set start of day (00:00:00.000)
                                const startDate = new Date(value);
                                startDate.setHours(0, 0, 0, 0);
                                const startTimestamp = startDate.toISOString();

                                // Set end of day (23:59:59.999)
                                const endDate = new Date(value);
                                endDate.setHours(23, 59, 59, 999);
                                const endTimestamp = endDate.toISOString();

                                apiUrl += `&created_at=gte.${startTimestamp}&created_at=lte.${endTimestamp}`;
                            } catch (e) {
                                // Invalid date for filtering
                            }
                            break;
                        case 'stage':
                            apiUrl += `&stage=ilike.*${filterValue}*`;
                            break;
                        case 'status':
                            apiUrl += `&status=ilike.*${filterValue}*`;
                            break;


                    }
                }
            });

            // Apply advanced filters to the API call
            // Date range filtering: use explicit appliedFilters dates, or fall back to the
            // implicit 1-month default when no date filter has been set by the user.
            const effectiveFromDate = appliedFilters.from_date || (isDefaultDateRange ? getOneMonthAgoDate() : '');
            const effectiveToDate = appliedFilters.to_date || (isDefaultDateRange ? getTodayDate() : '');

            if (effectiveFromDate && isValidDateFormat(effectiveFromDate)) {
                try {
                    // For TIMESTAMP columns, we need to use proper timestamp formatting
                    // Set start of day (00:00:00.000)
                    const fromDate = new Date(effectiveFromDate);
                    fromDate.setHours(0, 0, 0, 0);
                    const fromTimestamp = fromDate.toISOString();
                    apiUrl += `&created_at=gte.${fromTimestamp}`;
                } catch (e) {
                    // Invalid from_date for advanced filtering
                }
            }

            if (effectiveToDate && isValidDateFormat(effectiveToDate)) {
                try {
                    // For TIMESTAMP columns, we need to use proper timestamp formatting
                    // Set end of day (23:59:59.999)
                    const toDate = new Date(effectiveToDate);
                    toDate.setHours(23, 59, 59, 999);
                    const toTimestamp = toDate.toISOString();
                    apiUrl += `&created_at=lte.${toTimestamp}`;
                } catch (e) {
                    // Invalid to_date for advanced filtering
                }
            }

            if (appliedFilters.stage) {
                apiUrl += `&stage=ilike.*${encodeURIComponent(appliedFilters.stage)}*`;
            }

            if (appliedFilters.status) {
                apiUrl += `&status=ilike.*${encodeURIComponent(appliedFilters.status)}*`;
            }





            const response = await axios.get(apiUrl, config);

            // Calculate summary statistics
            let approved = 0;
            let pending = 0;
            let rejected = 0;

            if (response.status === 200) {
                response.data.forEach(invoice => {
                    const status = invoice.status?.toLowerCase();
                    if (status === 'approved' || status === 'complete') {
                        approved++;
                    } else if (status === 'waiting approval' || status === 'submitted' || status === 'pending') {
                        pending++;
                    } else if (status === 'rejected') {
                        rejected++;
                    }
                });
            }

            setSummaryStats({
                totalApproved: approved,
                totalPending: pending,
                totalRejected: rejected
            });
        } catch (error) {
            // Error fetching summary stats
            setSummaryStats({
                totalApproved: 0,
                totalPending: 0,
                totalRejected: 0
            });
        }
    };

    // Function to fetch all unique status values from the database
    const fetchAllStatusValues = useCallback(async () => {
        if (!user || !token || !user.role) {
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
            console.error('Error fetching status values:', err);
            // Set empty array to ensure dropdown is properly initialized
            setAllStatusValues([]);
        }
    }, [user, token]);

    // Function to fetch all unique stage values from the database
    const fetchAllStageValues = useCallback(async () => {
        if (!user || !token || !user.role) {
            return;
        }

        try {
            // Build base URL for fetching distinct stage values
            let stageUrl = `/api/v1/tables/ap_invoices?select=stage`;

            // Add role-based filters
            if (user.role === 'account_user') {
                if (!user.user_id || !user.tenantId) {
                    return;
                }
                stageUrl += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
                if (!user.tenantId) {
                    return;
                }
                stageUrl += `&tenant_id=eq.${user.tenantId}`;
            }
            // Super admin needs no additional filter

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            const res = await axios.get(stageUrl, config);

            // Extract unique stage values and filter out null/empty values
            const uniqueStages = [...new Set(res.data.map(invoice => invoice.stage).filter(stage => stage !== null && stage !== undefined && stage !== ''))];

            setAllStageValues(uniqueStages);
        } catch (err) {
            // Failed to fetch stage values
            console.error('Error fetching stage values:', err);
            // Set empty array to ensure dropdown is properly initialized
            setAllStageValues([]);
        }
    }, [user, token]);



    const fetchInvoices = async (showRefreshIndicator = false) => {
        if (!user || !token || !user.role) {
            setLoading(false);
            return;
        }

        if (showRefreshIndicator) {
            setRefreshing(true);
        } else if (loading) {
            setLoading(true);
        } else {
            setFiltering(true);
        }

        // File name, tenant name, and user name filters are client-side:
        // when active, skip server pagination, fetch ALL records, then filter + re-paginate locally
        // (same pattern as ExtractionQueue for userName / tenantName / file_name)
        const needsClientSideFiltering = !!(
            (debouncedColumnFilters.doc_id && debouncedColumnFilters.doc_id.trim()) ||
            (debouncedColumnFilters.tenant_name && debouncedColumnFilters.tenant_name.trim()) ||
            (debouncedColumnFilters.user_id && debouncedColumnFilters.user_id.trim())
        );

        // Client-side sort needed for:
        //   1. tenant_name — embedded join; server falls back to tenant_id (integer = insertion order)
        //   2. user_id column — displays user_name but server sorts by user_id integer
        //   3. doc_id column — displays file_name but server sorts by doc_id integer
        //   4. invoice_no, po_no, vendor_name — alphanumeric TEXT; PostgreSQL lexicographic order
        //      puts INV-9 between INV-99 and INV-100
        const CLIENT_SIDE_SORT_FIELDS_IR = new Set([
            'tenant_name', 'user_id', 'doc_id',          // embedded/derived — server can't sort by display name
            'invoice_no', 'po_no', 'vendor_name',         // alphanumeric TEXT — natural sort needed
        ]);
        const needsClientSideSort = CLIENT_SIDE_SORT_FIELDS_IR.has(sortField);

        // Combined: fetch ALL rows when either condition is true
        const needsAllRowsFetch = needsClientSideFiltering || needsClientSideSort;

        const offset = (page - 1) * pageSize;

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact'
                }
            };

            let apiUrl = `/api/v1/tables/ap_invoices?select=*,ap_tenants(tenant_name),ap_users(user_name)`;

            // Role-based filtering
            if (user.role === 'tenant_admin' || user.role === 'account_manager') {
                apiUrl += `&tenant_id=eq.${user.tenantId}`;
            } else if (user.role === 'account_user') {
                apiUrl += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            }

            // Skip server pagination when doing client-side sort or filter
            if (!needsAllRowsFetch) {
                apiUrl += `&limit=${pageSize}&offset=${offset}`;
            }

            // Add sorting — map frontend field keys to real DB columns.
            // CLIENT_SIDE_SORT_FIELDS fall back to invoice_id for stable server-side ordering.
            let dbSortField;
            switch (sortField) {
                case 'invoice_id':   dbSortField = 'invoice_id';  break;
                case 'invoice_date': dbSortField = 'invoice_date'; break;
                case 'created_at':   dbSortField = 'created_at';  break;
                case 'stage':        dbSortField = 'stage';        break;
                case 'status':       dbSortField = 'status';       break;
                // Client-side sort fields — use invoice_id as stable server-side fallback
                case 'tenant_name':
                case 'user_id':
                case 'doc_id':
                case 'invoice_no':
                case 'po_no':
                case 'vendor_name':  dbSortField = 'invoice_id';  break;
                default:             dbSortField = sortField;
            }

            const orderDirection = sortAsc ? 'asc' : 'desc';
            apiUrl += `&order=${dbSortField}.${orderDirection}.nullslast`;

            // Apply search term based on selected field
            if (searchTerm.trim()) {
                const searchLower = searchTerm.toLowerCase();
                switch (searchField) {
                    case 'invoice_no':
                        apiUrl += `&invoice_no=ilike.*${searchLower}*`;
                        break;
                    case 'vendor_name':
                        apiUrl += `&vendor_name=ilike.*${searchLower}*`;
                        break;
                    case 'po_no':
                        apiUrl += `&po_no=ilike.*${searchLower}*`;
                        break;
                    case 'user_id':   // user name search
                        apiUrl += `&ap_users.user_name=ilike.*${searchLower}*`;
                        break;
                    case 'doc_id':
                        // File name filtering is handled client-side
                        break;
                    case 'status':
                        apiUrl += `&status=ilike.*${searchLower}*`;
                        break;
                    case 'all':
                    default:
                        apiUrl += `&or=(invoice_no.ilike.*${searchLower}*,vendor_name.ilike.*${searchLower}*,po_no.ilike.*${searchLower}*,status.ilike.*${searchLower}*)`;
                        // File name filtering is handled client-side
                        break;
                }
            }

            // Apply column filters — use debouncedColumnFilters so that clearing a filter
            // is reflected immediately (no stale-value race with the debounce timer).
            Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
                if (value) {
                    const filterValue = encodeURIComponent(value);
                    switch (key) {
                        case 'invoice_id':
                            // For numeric fields, check if the value is numeric
                            if (/^\d+$/.test(value)) {
                                // Exact match for numeric values
                                apiUrl += `&invoice_id=eq.${filterValue}`;
                            } else {
                                // Partial match for non-numeric values
                                apiUrl += `&invoice_id=ilike.*${filterValue}*`;
                            }
                            break;
                        case 'tenant_name':
                            // Handled client-side — PostgREST embedded-table filters do not
                            // produce a correct Content-Range count, so we fetch all and filter locally.
                            break;
                        case 'invoice_no':
                            apiUrl += `&invoice_no=ilike.*${filterValue}*`;
                            break;
                        case 'po_no':
                            apiUrl += `&po_no=ilike.*${filterValue}*`;
                            break;
                        case 'vendor_name':
                            apiUrl += `&vendor_name=ilike.*${filterValue}*`;
                            break;
                        case 'doc_id':
                            // File name filtering is handled client-side
                            break;
                        case 'user_id':
                            // Handled client-side — same reason as tenant_name above.
                            break;
                        case 'invoice_date':
                            try {
                                const nextDay = new Date(value);
                                nextDay.setDate(nextDay.getDate() + 1);
                                apiUrl += `&invoice_date=gte.${value}&invoice_date=lt.${nextDay.toISOString().split('T')[0]}`;
                            } catch (e) {
                                // Invalid date for filtering
                            }
                            break;
                        case 'created_at':
                            try {
                                // For TIMESTAMP columns, we need to use proper timestamp formatting
                                // Set start of day (00:00:00.000)
                                const startDate = new Date(value);
                                startDate.setHours(0, 0, 0, 0);
                                const startTimestamp = startDate.toISOString();

                                // Set end of day (23:59:59.999)
                                const endDate = new Date(value);
                                endDate.setHours(23, 59, 59, 999);
                                const endTimestamp = endDate.toISOString();

                                apiUrl += `&created_at=gte.${startTimestamp}&created_at=lte.${endTimestamp}`;
                            } catch (e) {
                                // Invalid date for filtering
                            }
                            break;
                        case 'stage':
                            apiUrl += `&stage=ilike.*${filterValue}*`;
                            break;
                        case 'status':
                            apiUrl += `&status=ilike.*${filterValue}*`;
                            break;


                    }
                }
            });

            // Apply advanced filters to the API call
            // Date range filtering: use explicit appliedFilters dates, or fall back to the
            // implicit 1-month default when no date filter has been set by the user.
            const effectiveFromDate = appliedFilters.from_date || (isDefaultDateRange ? getOneMonthAgoDate() : '');
            const effectiveToDate = appliedFilters.to_date || (isDefaultDateRange ? getTodayDate() : '');

            if (effectiveFromDate && isValidDateFormat(effectiveFromDate)) {
                try {
                    // For TIMESTAMP columns, we need to use proper timestamp formatting
                    // Set start of day (00:00:00.000)
                    const fromDate = new Date(effectiveFromDate);
                    fromDate.setHours(0, 0, 0, 0);
                    const fromTimestamp = fromDate.toISOString();
                    apiUrl += `&created_at=gte.${fromTimestamp}`;
                } catch (e) {
                    // Invalid from_date for advanced filtering
                }
            }

            if (effectiveToDate && isValidDateFormat(effectiveToDate)) {
                try {
                    // For TIMESTAMP columns, we need to use proper timestamp formatting
                    // Set end of day (23:59:59.999)
                    const toDate = new Date(effectiveToDate);
                    toDate.setHours(23, 59, 59, 999);
                    const toTimestamp = toDate.toISOString();
                    apiUrl += `&created_at=lte.${toTimestamp}`;
                } catch (e) {
                    // Invalid to_date for advanced filtering
                }
            }

            if (appliedFilters.stage) {
                apiUrl += `&stage=ilike.*${encodeURIComponent(appliedFilters.stage)}*`;
            }

            if (appliedFilters.status) {
                apiUrl += `&status=ilike.*${encodeURIComponent(appliedFilters.status)}*`;
            }

            const response = await axios.get(apiUrl, config);

            // Get total count from Content-Range header
            const contentRange = response.headers['content-range'];
            let total = 0;
            if (contentRange) {
                const match = contentRange.match(/\/(\d+)/);
                if (match && match[1]) {
                    total = parseInt(match[1], 10);
                }
            }
            setTotalCount(total);

            if (response.status === 200) {
                // --- Batch fetch file_path from ap_documents (same as ExtractionQueue) ---
                const docIds = [...new Set(response.data.map(inv => inv.doc_id).filter(Boolean))];
                const docMap = {};
                if (docIds.length > 0) {
                    try {
                        const docsRes = await axios.get(
                            `/api/v1/tables/ap_documents?select=doc_id,file_path&doc_id=in.(${docIds.join(',')})`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        docsRes.data.forEach(d => { docMap[d.doc_id] = d.file_path; });
                    } catch (_) { /* non-fatal */ }
                }

                // Build flat rows with file_name (UUID stripped) — same pattern as ExtractionQueue
                let formatted = response.data.map(invoice => {
                    const filePath = docMap[invoice.doc_id] || '';
                    const tenantName = invoice.ap_tenants ? invoice.ap_tenants.tenant_name : null;
                    const userName = invoice.ap_users ? invoice.ap_users.user_name : null;

                    // Process error_desc
                    let processedErrorDesc = invoice.error_desc;
                    if (invoice.error_desc) {
                        if (typeof invoice.error_desc === 'object' && invoice.error_desc.value) {
                            try {
                                const p = JSON.parse(invoice.error_desc.value);
                                processedErrorDesc = p.Note && p.Error ? `Note: ${p.Note} | Error: ${p.Error}` : p.Note || p.Error || JSON.stringify(p);
                            } catch (e) { processedErrorDesc = invoice.error_desc.value; }
                        } else if (typeof invoice.error_desc === 'string') {
                            try {
                                const p = JSON.parse(invoice.error_desc);
                                processedErrorDesc = p.Note && p.Error ? `Note: ${p.Note} | Error: ${p.Error}` : p.Note || p.Error || JSON.stringify(p);
                            } catch (e) { processedErrorDesc = invoice.error_desc; }
                        } else {
                            processedErrorDesc = JSON.stringify(invoice.error_desc);
                        }
                    }

                    return {
                        ...invoice,
                        tenant_name: tenantName || '',
                        user_name: userName || '',
                        file_path: filePath,
                        file_name: formatFileName(filePath), // UUID stripped — used for filter & display
                        error_desc: processedErrorDesc,
                    };
                });

                // --- Client-side file name filter (same logic as ExtractionQueue) ---
                if (debouncedColumnFilters.doc_id && debouncedColumnFilters.doc_id.trim() !== '') {
                    const fileNameSearch = debouncedColumnFilters.doc_id.trim().toLowerCase();
                    formatted = formatted.filter((item) => {
                        if (!item.file_name) return false;
                        const baseFileName = item.file_name.split('_')[0]; // same as ExtractionQueue
                        return baseFileName && baseFileName.toLowerCase().includes(fileNameSearch);
                    });
                }

                // --- Client-side tenant name filter (mirrors ExtractionQueue tenantName logic) ---
                if (debouncedColumnFilters.tenant_name && debouncedColumnFilters.tenant_name.trim() !== '') {
                    const tenantSearch = debouncedColumnFilters.tenant_name.trim().toLowerCase();
                    formatted = formatted.filter(item =>
                        item.tenant_name &&
                        item.tenant_name.trim() &&
                        item.tenant_name.toLowerCase().includes(tenantSearch)
                    );
                }

                // --- Client-side user name filter (mirrors ExtractionQueue userName logic) ---
                if (debouncedColumnFilters.user_id && debouncedColumnFilters.user_id.trim() !== '') {
                    const userSearch = debouncedColumnFilters.user_id.trim().toLowerCase();
                    formatted = formatted.filter(item =>
                        item.user_name &&
                        item.user_name.trim() &&
                        item.user_name.toLowerCase().includes(userSearch)
                    );
                }

                // --- Client-side pagination when file name filter is active ---
                let finalData = formatted;
                let finalTotal = total;
                if (needsAllRowsFetch) {
                    finalTotal = formatted.length;
                    if (finalTotal === 0) {
                        finalData = [];
                    } else {
                        const maxPage = Math.ceil(finalTotal / pageSize);
                        const safePage = page > maxPage ? 1 : page;
                        const start = (safePage - 1) * pageSize;

                        // ── Client-side natural sort for embedded/alphanumeric fields ─────
                        if (needsClientSideSort) {
                            // Map column key → actual data field used for display
                            const sortKeyMap = {
                                tenant_name: 'tenant_name',
                                user_id:     'user_name',   // column key is user_id; data field is user_name
                                doc_id:      'file_name',   // column key is doc_id;  data field is file_name
                                invoice_no:  'invoice_no',
                                po_no:       'po_no',
                                vendor_name: 'vendor_name',
                            };
                            const sortKey = sortKeyMap[sortField] || sortField;
                            formatted.sort((a, b) => {
                                const aVal = (a[sortKey] || '').toString().toLowerCase();
                                const bVal = (b[sortKey] || '').toString().toLowerCase();
                                return sortAsc
                                    ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
                                    : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
                            });
                        }

                        finalData = formatted.slice(start, start + pageSize);
                    }
                }

                setInvoices(finalData);
                setTotalCount(finalTotal);
            } else {
                // Failed to fetch invoices
                setInvoices([]);
                setTotalCount(0); // Reset count on error
            }
        } catch (error) {
            // Error fetching invoices
            setInvoices([]);
            setTotalCount(0); // Reset count on error
        } finally {
            setLoading(false);
            setRefreshing(false);
            setFiltering(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            // Refresh stage and status values along with invoices
            await Promise.all([
                fetchAllStatusValues(),
                fetchAllStageValues(),
                fetchInvoices(true)
            ]);
            fetchSummaryStats();
            // Fetch updated status counts after refresh
            if (allStatusValues.length > 0) {
                await fetchStatusCounts();
            }
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const openCardPopup = (title, content) => {
        setCardPopup({
            isOpen: true,
            title,
            content,
            isEditable: false,
            contentType: 'text'
        });
    };

    const [tempFilters, setTempFilters] = useState({
        from_date: '',
        to_date: '',
        status: '',
        stage: '',
    });

    const [appliedFilters, setAppliedFilters] = useState({
        from_date: '',
        to_date: '',
        status: '',
        stage: '',
    });

    // Inline status badge colour — uses the same shared hash so table badges
    // match StatusCards and chart bars across all components.
    const statusColor = (status) => getStatusColor(status).hex;

    // Function to fetch status counts for each unique status
    const fetchStatusCounts = useCallback(async () => {
        if (!user || !token || !user.role || allStatusValues.length === 0) {
            return;
        }

        setLoadingStatusCounts(true);

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact'
                }
            };

            // Build base filter parameters (without tenant_name and user_id for server consistency)
            let baseParams = [];

            // Add role-based filtering
            if (user.role === 'tenant_admin' || user.role === 'account_manager') {
                baseParams.push(`tenant_id=eq.${user.tenantId}`);
            } else if (user.role === 'account_user') {
                baseParams.push(`user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`);
            }

            // Apply all filters consistently - including advanced filters, column filters, and search
            
            // Apply advanced filters
            const effectiveFromDate = appliedFilters.from_date || (isDefaultDateRange ? getOneMonthAgoDate() : '');
            const effectiveToDate = appliedFilters.to_date || (isDefaultDateRange ? getTodayDate() : '');

            if (effectiveFromDate && isValidDateFormat(effectiveFromDate)) {
                try {
                    const fromDate = new Date(effectiveFromDate);
                    fromDate.setHours(0, 0, 0, 0);
                    const fromTimestamp = fromDate.toISOString();
                    baseParams.push(`created_at=gte.${fromTimestamp}`);
                } catch (e) {
                    // Invalid from_date for advanced filtering
                }
            }

            if (effectiveToDate && isValidDateFormat(effectiveToDate)) {
                try {
                    const toDate = new Date(effectiveToDate);
                    toDate.setHours(23, 59, 59, 999);
                    const toTimestamp = toDate.toISOString();
                    baseParams.push(`created_at=lte.${toTimestamp}`);
                } catch (e) {
                    // Invalid to_date for advanced filtering
                }
            }

            if (appliedFilters.stage) {
                baseParams.push(`stage=ilike.*${encodeURIComponent(appliedFilters.stage)}*`);
            }

            if (appliedFilters.status) {
                baseParams.push(`status=ilike.*${encodeURIComponent(appliedFilters.status)}*`);
            }

            // Apply column filters - CONSISTENT with main table filtering (skip tenant_name and user_id for server)
            Object.entries(columnFilters).forEach(([key, value]) => {
                if (value) {
                    const filterValue = encodeURIComponent(value);
                    switch (key) {
                        case 'invoice_id':
                            if (/^\d+$/.test(value)) {
                                baseParams.push(`invoice_id=eq.${filterValue}`);
                            } else {
                                baseParams.push(`invoice_id=ilike.*${filterValue}*`);
                            }
                            break;
                        case 'tenant_name':
                            // Handled client-side — skip server filter to match main table behavior
                            break;
                        case 'invoice_no':
                            baseParams.push(`invoice_no=ilike.*${filterValue}*`);
                            break;
                        case 'po_no':
                            baseParams.push(`po_no=ilike.*${filterValue}*`);
                            break;
                        case 'vendor_name':
                            baseParams.push(`vendor_name=ilike.*${filterValue}*`);
                            break;
                        case 'doc_id':
                            // File name filtering is handled client-side
                            break;
                        case 'user_id':
                            // Handled client-side — skip server filter to match main table behavior
                            break;
                        case 'invoice_date':
                            try {
                                const nextDay = new Date(value);
                                nextDay.setDate(nextDay.getDate() + 1);
                                baseParams.push(`invoice_date=gte.${value}&invoice_date=lt.${nextDay.toISOString().split('T')[0]}`);
                            } catch (e) {
                                // Invalid date for filtering
                            }
                            break;
                        case 'created_at':
                            try {
                                const startDate = new Date(value);
                                startDate.setHours(0, 0, 0, 0);
                                const startTimestamp = startDate.toISOString();

                                const endDate = new Date(value);
                                endDate.setHours(23, 59, 59, 999);
                                const endTimestamp = endDate.toISOString();

                                baseParams.push(`created_at=gte.${startTimestamp}&created_at=lte.${endTimestamp}`);
                            } catch (e) {
                                // Invalid date for filtering
                            }
                            break;
                        case 'stage':
                            baseParams.push(`stage=ilike.*${filterValue}*`);
                            break;
                        case 'status':
                            baseParams.push(`status=ilike.*${filterValue}*`);
                            break;
                    }
                }
            });

            // Apply search term based on selected field
            if (searchTerm.trim()) {
                const searchLower = searchTerm.toLowerCase();
                switch (searchField) {
                    case 'invoice_no':
                        baseParams.push(`invoice_no=ilike.*${searchLower}*`);
                        break;
                    case 'vendor_name':
                        baseParams.push(`vendor_name=ilike.*${searchLower}*`);
                        break;
                    case 'po_no':
                        baseParams.push(`po_no=ilike.*${searchLower}*`);
                        break;
                    case 'user_id':
                        // Search by user name
                        baseParams.push(`ap_users.user_name=ilike.*${searchLower}*`);
                        break;
                    case 'doc_id':
                        // File name filtering is handled client-side
                        break;
                    case 'status':
                        baseParams.push(`status=ilike.*${searchLower}*`);
                        break;
                    case 'all':
                    default:
                        baseParams.push(`or=(invoice_no.ilike.*${searchLower}*,vendor_name.ilike.*${searchLower}*,po_no.ilike.*${searchLower}*,status.ilike.*${searchLower}*)`);
                        break;
                }
            }

            // Fetch all data first, then apply client-side filtering for accurate counts
            baseParams.push('limit=10000'); // Fetch more data to handle client-side filtering

            const baseUrl = `/api/v1/tables/ap_invoices?select=*,ap_tenants(tenant_name),ap_users(user_name)&${baseParams.join('&')}`;
            
            try {
                const res = await axios.get(baseUrl, config);
                
                // Apply client-side filtering similar to main table
                let filteredData = [...res.data];
                
                // Client-side tenant name filter
                if (columnFilters.tenant_name && columnFilters.tenant_name.trim() !== '') {
                    const tenantSearch = columnFilters.tenant_name.trim().toLowerCase();
                    filteredData = filteredData.filter(item =>
                        item.ap_tenants && item.ap_tenants.tenant_name &&
                        item.ap_tenants.tenant_name.trim() &&
                        item.ap_tenants.tenant_name.toLowerCase().includes(tenantSearch)
                    );
                }

                // Client-side user name filter
                if (columnFilters.user_id && columnFilters.user_id.trim() !== '') {
                    const userSearch = columnFilters.user_id.trim().toLowerCase();
                    filteredData = filteredData.filter(item =>
                        item.ap_users && item.ap_users.user_name &&
                        item.ap_users.user_name.trim() &&
                        item.ap_users.user_name.toLowerCase().includes(userSearch)
                    );
                }

                // Client-side file name filter
                if (columnFilters.doc_id && columnFilters.doc_id.trim() !== '') {
                    const fileNameSearch = columnFilters.doc_id.trim().toLowerCase();
                    // Need to fetch file paths separately for file name filtering
                    const docIds = [...new Set(filteredData.map(inv => inv.doc_id).filter(Boolean))];
                    const docMap = {};
                    if (docIds.length > 0) {
                        try {
                            const docsRes = await axios.get(
                                `/api/v1/tables/ap_documents?select=doc_id,file_path&doc_id=in.(${docIds.join(',')})`,
                                { headers: { Authorization: 'Bearer ' + token } }
                            );
                            docsRes.data.forEach(d => { docMap[d.doc_id] = d.file_path; });
                        } catch (_) { /* non-fatal */ }
                    }
                    
                    filteredData = filteredData.filter((item) => {
                        const filePath = docMap[item.doc_id] || '';
                        const fileName = formatFileName(filePath);
                        if (!fileName) return false;
                        const baseFileName = fileName.split('_')[0];
                        return baseFileName && baseFileName.toLowerCase().includes(fileNameSearch);
                    });
                }

                // Now calculate status counts based on the filtered data
                const statusCounts = {};
                statusCounts['Total Uploaded'] = filteredData.length;

                // Calculate counts for each unique status using exact match
                for (const status of allStatusValues) {
                    const statusFiltered = filteredData.filter(item =>
                        item.status && item.status.toLowerCase() === status.toLowerCase()
                    );
                    statusCounts[status] = statusFiltered.length;
                }

                setStatusCounts(statusCounts);

                // Prepare status cards configuration
                const statusCardsConfig = [];
                resetUsedIcons(); // Reset icon tracking for fresh card generation


                // Add total card first
                statusCardsConfig.push({
                    id: 'total',
                    label: 'Total Uploaded',
                    value: filteredData.length,
                    color: getStatusColor('total'),
                    statusType: 'total'
                });

                // Add cards for each unique status
                allStatusValues.forEach((status) => {
                    const statusLabel = capitalizeStatus(status);
                    statusCardsConfig.push({
                        id: status,
                        label: statusLabel,
                        value: statusCounts[status] || 0,
                        color: getStatusColor(status),
                        statusType: status
                    });
                });

                setStatusCardsConfig(statusCardsConfig);
                
            } catch (err) {
                console.error('Error fetching data for status counts:', err);
                
                // If client-side filtering fails, calculate counts using the traditional method
                const statusCounts = {};

                // Calculate total count with all filters applied (except client-side ones)
                const totalBaseParams = [...baseParams];
                totalBaseParams.push('limit=10000'); // Fetch more data to handle client-side filtering

                const totalUrl = `/api/v1/tables/ap_invoices?select=*,ap_tenants(tenant_name),ap_users(user_name)&${totalBaseParams.join('&')}`;
                
                try {
                    const totalRes = await axios.get(totalUrl, config);
                    let totalFilteredData = [...totalRes.data];
                    
                    // Apply client-side filtering to get total count
                    if (columnFilters.tenant_name && columnFilters.tenant_name.trim() !== '') {
                        const tenantSearch = columnFilters.tenant_name.trim().toLowerCase();
                        totalFilteredData = totalFilteredData.filter(item =>
                            item.ap_tenants && item.ap_tenants.tenant_name &&
                            item.ap_tenants.tenant_name.trim() &&
                            item.ap_tenants.tenant_name.toLowerCase().includes(tenantSearch)
                        );
                    }

                    if (columnFilters.user_id && columnFilters.user_id.trim() !== '') {
                        const userSearch = columnFilters.user_id.trim().toLowerCase();
                        totalFilteredData = totalFilteredData.filter(item =>
                            item.ap_users && item.ap_users.user_name &&
                            item.ap_users.user_name.trim() &&
                            item.ap_users.user_name.toLowerCase().includes(userSearch)
                        );
                    }

                    if (columnFilters.doc_id && columnFilters.doc_id.trim() !== '') {
                        const fileNameSearch = columnFilters.doc_id.trim().toLowerCase();
                        const docIds = [...new Set(totalFilteredData.map(inv => inv.doc_id).filter(Boolean))];
                        const docMap = {};
                        if (docIds.length > 0) {
                            try {
                                const docsRes = await axios.get(
                                    `/api/v1/tables/ap_documents?select=doc_id,file_path&doc_id=in.(${docIds.join(',')})`,
                                    { headers: { Authorization: 'Bearer ' + token } }
                                );
                                docsRes.data.forEach(d => { docMap[d.doc_id] = d.file_path; });
                            } catch (_) { /* non-fatal */ }
                        }
                        
                        totalFilteredData = totalFilteredData.filter((item) => {
                            const filePath = docMap[item.doc_id] || '';
                            const fileName = formatFileName(filePath);
                            if (!fileName) return false;
                            const baseFileName = fileName.split('_')[0];
                            return baseFileName && baseFileName.toLowerCase().includes(fileNameSearch);
                        });
                    }
                    
                    statusCounts['Total Uploaded'] = totalFilteredData.length;

                    // Calculate individual status counts with same client-side filtering
                    for (const status of allStatusValues) {
                        const statusBaseParams = [...baseParams];
                        statusBaseParams.push(`status=eq.${encodeURIComponent(status)}`);
                        statusBaseParams.push('limit=10000');

                        const statusUrl = `/api/v1/tables/ap_invoices?select=*,ap_tenants(tenant_name),ap_users(user_name)&${statusBaseParams.join('&')}`;
                        
                        try {
                            const statusRes = await axios.get(statusUrl, config);
                            let statusFilteredData = [...statusRes.data];
                            
                            // Apply same client-side filtering
                            if (columnFilters.tenant_name && columnFilters.tenant_name.trim() !== '') {
                                const tenantSearch = columnFilters.tenant_name.trim().toLowerCase();
                                statusFilteredData = statusFilteredData.filter(item =>
                                    item.ap_tenants && item.ap_tenants.tenant_name &&
                                    item.ap_tenants.tenant_name.trim() &&
                                    item.ap_tenants.tenant_name.toLowerCase().includes(tenantSearch)
                                );
                            }

                            if (columnFilters.user_id && columnFilters.user_id.trim() !== '') {
                                const userSearch = columnFilters.user_id.trim().toLowerCase();
                                statusFilteredData = statusFilteredData.filter(item =>
                                    item.ap_users && item.ap_users.user_name &&
                                    item.ap_users.user_name.trim() &&
                                    item.ap_users.user_name.toLowerCase().includes(userSearch)
                                );
                            }

                            if (columnFilters.doc_id && columnFilters.doc_id.trim() !== '') {
                                const fileNameSearch = columnFilters.doc_id.trim().toLowerCase();
                                const docIds = [...new Set(statusFilteredData.map(inv => inv.doc_id).filter(Boolean))];
                                const docMap = {};
                                if (docIds.length > 0) {
                                    try {
                                        const docsRes = await axios.get(
                                            `/api/v1/tables/ap_documents?select=doc_id,file_path&doc_id=in.(${docIds.join(',')})`,
                                            { headers: { Authorization: 'Bearer ' + token } }
                                        );
                                        docsRes.data.forEach(d => { docMap[d.doc_id] = d.file_path; });
                                    } catch (_) { /* non-fatal */ }
                                }
                                
                                statusFilteredData = statusFilteredData.filter((item) => {
                                    const filePath = docMap[item.doc_id] || '';
                                    const fileName = formatFileName(filePath);
                                    if (!fileName) return false;
                                    const baseFileName = fileName.split('_')[0];
                                    return baseFileName && baseFileName.toLowerCase().includes(fileNameSearch);
                                });
                            }
                            
                            statusCounts[status] = statusFilteredData.length;
                        } catch (statusErr) {
                            // If status-specific request fails, set count to 0
                            statusCounts[status] = 0;
                        }
                    }

                } catch (totalErr) {
                    // If total request fails, set all counts to 0
                    statusCounts['Total Uploaded'] = 0;
                    for (const status of allStatusValues) {
                        statusCounts[status] = 0;
                    }
                }

                setStatusCounts(statusCounts);

                // Prepare status cards configuration
                const statusCardsConfig = [];
                resetUsedIcons(); // Reset icon tracking for fresh card generation

                // Add total card first
                statusCardsConfig.push({
                    id: 'total',
                    label: 'Total Uploaded',
                    value: statusCounts['Total Uploaded'] || 0,
                    color: getStatusColor('total'),
                    statusType: 'total'
                });

                // Add cards for each unique status
                allStatusValues.forEach((status) => {
                    const statusLabel = capitalizeStatus(status);
                    statusCardsConfig.push({
                        id: status,
                        label: statusLabel,
                        value: statusCounts[status] || 0,
                        color: getStatusColor(status),
                        statusType: status
                    });
                });

                setStatusCardsConfig(statusCardsConfig);
            }

        } catch (error) {
            console.error('Error fetching status counts:', error);
            
            // Preserve existing status counts if they exist, otherwise initialize with empty
            if (Object.keys(statusCounts).length === 0) {
                setStatusCounts({ 'Total Uploaded': 0 });

                // Prepare fallback status cards configuration
                const fallbackCardsConfig = [];
                resetUsedIcons(); // Reset icon tracking for fallback cards

                // Add total card first
                fallbackCardsConfig.push({
                    id: 'total',
                    label: 'Total Uploaded',
                    value: 0,
                    color: getStatusColor('total'),
                    statusType: 'total'
                });

                setStatusCardsConfig(fallbackCardsConfig);
            }
            // Otherwise, keep existing status cards to prevent UI flickering
        } finally {
            setLoadingStatusCounts(false);
        }
    }, [user, token, allStatusValues, appliedFilters, columnFilters, searchTerm, searchField]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showAdvancedFilter && filterButtonRef.current && !filterButtonRef.current.contains(event.target)) {
                const popover = document.querySelector('[data-popover="filter"]');
                if (popover && !popover.contains(event.target)) {
                    setShowAdvancedFilter(false);
                }
            }

            // Close user popover when clicking outside
            if (userPopover.isOpen) {
                const userPopoverElement = document.querySelector('[data-popover="user"]');
                if (userPopoverElement && !userPopoverElement.contains(event.target)) {
                    setUserPopover(prev => ({ ...prev, isOpen: false }));
                }
            }

            // Close default date filter popover when clicking outside
            if (showNotePopover && noteRef.current && !noteRef.current.contains(event.target)) {
                const notePopover = document.querySelector('[data-popover="note"]');
                if (notePopover && !notePopover.contains(event.target)) {
                    setShowNotePopover(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAdvancedFilter, userPopover.isOpen, tempFilters, showNotePopover]);

    // Immediately clear data when debounced filters change to prevent showing stale rows.
    // Using debouncedColumnFilters (not raw columnFilters) keeps this in sync with
    // the actual fetch trigger, preventing a flash of unfiltered/wrongly-filtered data.
    useEffect(() => {
        setInvoices([]);
        setFiltering(true);
    }, [
        debouncedColumnFilters.tenant_name,
        debouncedColumnFilters.user_id,
        debouncedColumnFilters.doc_id,
        debouncedColumnFilters.invoice_id,
        debouncedColumnFilters.invoice_no,
        debouncedColumnFilters.po_no,
        debouncedColumnFilters.vendor_name,
        debouncedColumnFilters.invoice_date,
        debouncedColumnFilters.created_at,
        debouncedColumnFilters.stage,
        debouncedColumnFilters.status,
    ]);

    // Load data on component mount and when user/token changes
    useEffect(() => {
        // Fetch stage and status values first to ensure dropdowns are populated
        const initializeFilters = async () => {
            await Promise.all([
                fetchAllStatusValues(),
                fetchAllStageValues()
            ]);

            // Then fetch invoices and summary stats
            fetchInvoices();
            fetchSummaryStats();
        };

        initializeFilters();
        // NOTE: `columnFilters` is intentionally excluded — we only re-fetch after the
        // 300 ms debounce settles (debouncedColumnFilters) to avoid race conditions
        // where a cleared filter is still applied during the transition window.
    }, [user, token, page, pageSize, sortField, sortAsc, debouncedColumnFilters, searchTerm, searchField, appliedFilters, fetchAllStatusValues, fetchAllStageValues, isDefaultDateRange]);

    // Update status counts when filters change - ensure all filter types trigger updates
    useEffect(() => {
        if (user && token && allStatusValues.length > 0) {
            fetchStatusCounts();
        }
    }, [
        user,
        token,
        allStatusValues,
        appliedFilters.from_date,
        appliedFilters.to_date,
        appliedFilters.stage,
        appliedFilters.status,
        columnFilters.tenant_name,
        columnFilters.user_id,
        columnFilters.doc_id,
        columnFilters.invoice_id,
        columnFilters.invoice_no,
        columnFilters.po_no,
        columnFilters.vendor_name,
        columnFilters.invoice_date,
        columnFilters.created_at,
        columnFilters.stage,
        columnFilters.status,
        searchTerm,
        searchField,
        isDefaultDateRange,
        fetchStatusCounts
    ]);

    const filteredRequests = useMemo(() => {
        // Data is already filtered + paginated in fetchInvoices;
        // this memo handles the top search-bar only (not column filters)
        let result = [...invoices];

        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            result = result.filter((req) => {
                switch (searchField) {
                    case 'invoice_no':
                        return req.invoice_no?.toLowerCase().includes(searchLower);
                    case 'vendor_name':
                        return req.vendor_name?.toLowerCase().includes(searchLower);
                    case 'po_no':
                        return req.po_no?.toLowerCase().includes(searchLower);
                    case 'user_id':
                        return req.user_name?.toLowerCase().includes(searchLower);
                    case 'doc_id': {
                        // Same logic as ExtractionQueue: match against base name (before first '_')
                        if (!req.file_name) return false;
                        const base = req.file_name.split('_')[0];
                        return base && base.toLowerCase().includes(searchLower);
                    }
                    case 'status':
                        return req.status?.toLowerCase().includes(searchLower);
                    case 'all':
                    default:
                        return (
                            req.invoice_no?.toLowerCase().includes(searchLower) ||
                            req.vendor_name?.toLowerCase().includes(searchLower) ||
                            req.po_no?.toLowerCase().includes(searchLower) ||
                            req.invoice_id?.toString().includes(searchLower) ||
                            req.file_name?.toLowerCase().includes(searchLower) ||
                            req.user_name?.toLowerCase().includes(searchLower) ||
                            req.tenant_name?.toLowerCase().includes(searchLower) ||
                            req.status?.toLowerCase().includes(searchLower) ||
                            req.stage?.toLowerCase().includes(searchLower)
                        );
                }
            });
        }

        return result;
    }, [invoices, searchTerm, searchField]);
    // Get sort icon for column header
    const getSortIcon = (columnKey) => {
        if (sortField !== columnKey) {
            return <ChevronsUpDown size={14} className="text-gray-400" />;
        }
        return sortAsc ?
            <ChevronUp size={14} className="text-indigo-600" /> :
            <ChevronDown size={14} className="text-indigo-600" />;
    };

    const clearAllFilters = () => {
        setTempFilters({ from_date: '', to_date: '', status: '', stage: '' });
        setAppliedFilters({ from_date: '', to_date: '', status: '', stage: '' });
        setSearchTerm('');
        setColumnFilters({});
        // Immediately flush debouncedColumnFilters so the pending debounce timer
        // cannot re-apply stale filter values before it fires.
        if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
        setDebouncedColumnFilters({});
        setIsDefaultDateRange(false); // Avoid reseting to default date range
        setPage(1); // Reset page
    };

    // Reset sort to default (created_at descending)
    const clearSortOptions = () => {
        setSortField('created_at');
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

    // True when the user has changed sorting away from the default (newest-first by created_at)
    const hasActiveSort = sortField !== 'created_at' || sortAsc !== false;

    const applyFilters = () => {
        setAppliedFilters({
            from_date: tempFilters.from_date,
            to_date: tempFilters.to_date,
            status: tempFilters.status,
            stage: tempFilters.stage,
        });
        setShowAdvancedFilter(false);
        setPage(1); // Reset page
    };

    // Advanced Filter Panel event handlers
    const handleApplyFilters = () => {
        // Targeted column-filter clearing: only clear the column keys that directly
        // conflict with an advanced filter field that has a value in tempFilters.
        const columnKeysToClear = new Set();
        Object.entries(tempFilters).forEach(([advKey, value]) => {
            if (value && ADVANCED_TO_COLUMN_CONFLICT_IR[advKey]) {
                ADVANCED_TO_COLUMN_CONFLICT_IR[advKey].forEach(colKey => columnKeysToClear.add(colKey));
            }
        });

        if (columnKeysToClear.size > 0) {
            const patch = [...columnKeysToClear].reduce((acc, k) => ({ ...acc, [k]: '' }), {});
            setColumnFilters(prev => ({ ...prev, ...patch }));
            if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
            setDebouncedColumnFilters(prev => ({ ...prev, ...patch }));
        }

        // If user explicitly set dates, stop treating this as the default range
        if (tempFilters.from_date || tempFilters.to_date) {
            setIsDefaultDateRange(false);
        }
        setAppliedFilters({ ...tempFilters });
        setShowAdvancedFilter(false);
        setPage(1);
    };

    const handleCloseAdvancedFilter = () => {
        setTempFilters({ ...appliedFilters });
        setShowAdvancedFilter(false);
    };

    // Called by TableComponent via onColumnFilterCommit.
    // Only clears the specific advanced filter field(s) that directly conflict with
    // the committed column key — everything else is left untouched.
    const handleColumnFilterCommit = useCallback((key, value) => {
        const advancedKeysToClear = COLUMN_TO_ADVANCED_CONFLICT_IR[key];
        if (advancedKeysToClear && advancedKeysToClear.length > 0) {
            const patch = advancedKeysToClear.reduce((acc, k) => ({ ...acc, [k]: '' }), {});
            setAppliedFilters(prev => ({ ...prev, ...patch }));
            setTempFilters(prev => ({ ...prev, ...patch }));

            // Disable the default date-range banner when created_at column overrides dates
            if (key === 'created_at' && value) {
                setIsDefaultDateRange(false);
            }
        }

        setColumnFilters(prev => ({ ...prev, [key]: value }));
        if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
        setDebouncedColumnFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    }, []);

    // onClearAll — clears non-default fields, preserves default dates, closes panel
    const handleClearAll = (newValues) => {
        setTempFilters(newValues);
        setAppliedFilters(newValues);
        setColumnFilters({});
        if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
        setDebouncedColumnFilters({});
        setPage(1);
        setShowAdvancedFilter(false);
        // isDefaultDateRange unchanged — dates weren't explicitly cleared
    };

    // onClearDefaults — zeroes default date fields, applies immediately, closes panel
    const handleClearDefaults = (newValues) => {
        setTempFilters(newValues);
        setAppliedFilters(newValues);
        setIsDefaultDateRange(false);
        setPage(1);
        setShowAdvancedFilter(false);
    };

    // Hard reset — clears everything and reinstates the 1-month default
    const handleClearFilters = () => {
        setTempFilters({ from_date: '', to_date: '', status: '', stage: '' });
        setAppliedFilters({ from_date: '', to_date: '', status: '', stage: '' });
        setSearchTerm('');
        setColumnFilters({});
        if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
        setDebouncedColumnFilters({});
        setIsDefaultDateRange(false); // Avoid reseting to default date range
        setPage(1);
    };

    const removeFilter = (filterKey) => {
        if (filterKey === 'doc_type' || filterKey === 'input_source') return; // Skip non-existent filters
        setAppliedFilters(prev => ({ ...prev, [filterKey]: '' }));
        setTempFilters(prev => ({ ...prev, [filterKey]: '' }));
        setPage(1); // Reset page
    };

    const activeFilterCount = Object.entries(appliedFilters).filter(([key, val]) => val !== '' && key !== 'doc_type' && key !== 'input_source').length;

    // Check if any column filters are active
    const areColumnFiltersActive = Object.values(columnFilters).some(val => val !== '');

    // hasNonDefaultFilters — don't count fields still at their known default values,
    // so the "Reset" button only appears when meaningful changes have been made
    const hasNonDefaultFilters = () => {
        const knownDefaults = {
            from_date: getOneMonthAgoDate(),
            to_date: getTodayDate(),
        };
        const hasAdvancedFilters = Object.entries(appliedFilters).some(([key, value]) => {
            if (!value) return false;
            if (knownDefaults[key] && value === knownDefaults[key]) return false;
            return true;
        });
        return hasAdvancedFilters || areColumnFiltersActive;
    };

    // Total active filters (advanced + column filters)
    const totalActiveFilters = activeFilterCount + (areColumnFiltersActive ? 1 : 0);

    const totalRequests = totalCount; // Use server-side count
    const totalApproved = summaryStats.totalApproved;
    const totalPending = summaryStats.totalPending;
    const totalRejected = summaryStats.totalRejected;

    // const totalRequestedAmount = filteredRequests.reduce((sum, r) => sum + r.requested_amt, 0);
    // const totalApprovedAmount = filteredRequests
    //     .filter(r => r.approved_amt)
    //     .reduce((sum, r) => sum + r.approved_amt, 0);
    // const totalTaxAmount = filteredRequests.reduce((sum, r) => sum + (r.total_tax || 0), 0);


    const totalRequestedAmount = 0;
    const totalApprovedAmount = 0;
    const totalTaxAmount = 0;

    const getUniqueValues = (field) => {
        return [...new Set(invoices.map((item) => item[field]).filter(Boolean))];
    };

    // Column selection is now handled in the modified handleExportClick above

    // Fetch all invoices without pagination for export
    const fetchAllInvoicesForExport = async () => {
        if (!user || !token || !user.role) {
            return [];
        }

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact' // Request total count
                }
            };

            let apiUrl = `/api/v1/tables/ap_invoices?select=*,ap_tenants(tenant_name),ap_users(user_name)`;

            if (user.role === 'tenant_admin' || user.role === 'account_manager') {
                apiUrl += `&tenant_id=eq.${user.tenantId}`;
            }
            else if (user.role === 'account_user') {
                apiUrl += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            }
            // super_admin → no extra filter


            // Add sorting — client-side sort fields fall back to invoice_id for stable ordering
            let dbSortField = sortField;
            switch (sortField) {
                case 'tenant_name':
                case 'user_id':
                case 'doc_id':
                case 'invoice_no':
                case 'po_no':
                case 'vendor_name': dbSortField = 'invoice_id'; break;
                default:            dbSortField = sortField;
            }

            const orderDirection = sortAsc ? 'asc' : 'desc';
            apiUrl += `&order=${dbSortField}.${orderDirection}`;

            // Apply search term based on selected field
            if (searchTerm.trim()) {
                const searchLower = searchTerm.toLowerCase();
                switch (searchField) {
                    case 'invoice_no':
                        apiUrl += `&invoice_no=ilike.*${searchLower}*`;
                        break;
                    case 'vendor_name':
                        apiUrl += `&vendor_name=ilike.*${searchLower}*`;
                        break;
                    case 'po_no':
                        apiUrl += `&po_no=ilike.*${searchLower}*`;
                        break;
                    case 'user_id':
                        apiUrl += `&ap_users.user_name=ilike.*${searchLower}*`;
                        break;
                    case 'doc_id':
                        // File name filtering is handled client-side
                        break;
                    case 'status':
                        apiUrl += `&status=ilike.*${searchLower}*`;
                        break;
                    case 'all':
                    default:
                        apiUrl += `&or=(invoice_no.ilike.*${searchLower}*,vendor_name.ilike.*${searchLower}*,po_no.ilike.*${searchLower}*,status.ilike.*${searchLower}*)`;
                        break;
                }
            }

            // Apply column filters
            Object.entries(columnFilters).forEach(([key, value]) => {
                if (value) {
                    const filterValue = encodeURIComponent(value);
                    switch (key) {
                        case 'invoice_id':
                            // For numeric fields, check if the value is numeric
                            if (/^\d+$/.test(value)) {
                                // Exact match for numeric values
                                apiUrl += `&invoice_id=eq.${filterValue}`;
                            } else {
                                // Partial match for non-numeric values
                                apiUrl += `&invoice_id=ilike.*${filterValue}*`;
                            }
                            break;
                        case 'tenant_name':
                            // Handled client-side — skip server filter.
                            break;
                        case 'invoice_no':
                            apiUrl += `&invoice_no=ilike.*${filterValue}*`;
                            break;
                        case 'po_no':
                            apiUrl += `&po_no=ilike.*${filterValue}*`;
                            break;
                        case 'vendor_name':
                            apiUrl += `&vendor_name=ilike.*${filterValue}*`;
                            break;
                        case 'doc_id':
                            // File name filtering is handled client-side since we fetch file paths separately
                            // We don't apply server-side filtering for file names
                            break;
                        case 'user_id':
                            // Handled client-side — skip server filter.
                            break;
                        case 'invoice_date':
                            try {
                                const nextDay = new Date(value);
                                nextDay.setDate(nextDay.getDate() + 1);
                                apiUrl += `&invoice_date=gte.${value}&invoice_date=lt.${nextDay.toISOString().split('T')[0]}`;
                            } catch (e) {
                                // Invalid date for filtering
                            }
                            break;
                        case 'created_at':
                            try {
                                // For TIMESTAMP columns, we need to use proper timestamp formatting
                                // Set start of day (00:00:00.000)
                                const startDate = new Date(value);
                                startDate.setHours(0, 0, 0, 0);
                                const startTimestamp = startDate.toISOString();

                                // Set end of day (23:59:59.999)
                                const endDate = new Date(value);
                                endDate.setHours(23, 59, 59, 999);
                                const endTimestamp = endDate.toISOString();

                                apiUrl += `&created_at=gte.${startTimestamp}&created_at=lte.${endTimestamp}`;
                            } catch (e) {
                                // Invalid date for filtering
                            }
                            break;
                        case 'stage':
                            apiUrl += `&stage=ilike.*${filterValue}*`;
                            break;
                        case 'status':
                            apiUrl += `&status=ilike.*${filterValue}*`;
                            break;


                    }
                }
            });

            // Apply advanced filters to the API call
            // Date range filtering: use explicit appliedFilters dates, or fall back to the
            // implicit 1-month default when no date filter has been set by the user.
            const effectiveFromDate = appliedFilters.from_date || (isDefaultDateRange ? getOneMonthAgoDate() : '');
            const effectiveToDate = appliedFilters.to_date || (isDefaultDateRange ? getTodayDate() : '');

            if (effectiveFromDate && isValidDateFormat(effectiveFromDate)) {
                try {
                    // For TIMESTAMP columns, we need to use proper timestamp formatting
                    // Set start of day (00:00:00.000)
                    const fromDate = new Date(effectiveFromDate);
                    fromDate.setHours(0, 0, 0, 0);
                    const fromTimestamp = fromDate.toISOString();
                    apiUrl += `&created_at=gte.${fromTimestamp}`;
                } catch (e) {
                    // Invalid from_date for advanced filtering
                }
            }

            if (effectiveToDate && isValidDateFormat(effectiveToDate)) {
                try {
                    // For TIMESTAMP columns, we need to use proper timestamp formatting
                    // Set end of day (23:59:59.999)
                    const toDate = new Date(effectiveToDate);
                    toDate.setHours(23, 59, 59, 999);
                    const toTimestamp = toDate.toISOString();
                    apiUrl += `&created_at=lte.${toTimestamp}`;
                } catch (e) {
                    // Invalid to_date for advanced filtering
                }
            }

            if (appliedFilters.stage) {
                apiUrl += `&stage=ilike.*${encodeURIComponent(appliedFilters.stage)}*`;
            }

            if (appliedFilters.status) {
                apiUrl += `&status=ilike.*${encodeURIComponent(appliedFilters.status)}*`;
            }





            const response = await axios.get(apiUrl, config);

            if (response.status === 200) {
                // --- Batch fetch file_path (same as ExtractionQueue) ---
                const exportDocIds = [...new Set(response.data.map(inv => inv.doc_id).filter(Boolean))];
                const exportDocMap = {};
                if (exportDocIds.length > 0) {
                    try {
                        const docsRes = await axios.get(
                            `/api/v1/tables/ap_documents?select=doc_id,file_path&doc_id=in.(${exportDocIds.join(',')})`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        docsRes.data.forEach(d => { exportDocMap[d.doc_id] = d.file_path; });
                    } catch (_) { /* non-fatal */ }
                }

                const transformedData = response.data.map(invoice => {
                    const filePath = exportDocMap[invoice.doc_id] || '';
                    const tenantName = invoice.ap_tenants ? invoice.ap_tenants.tenant_name : null;
                    const userName = invoice.ap_users ? invoice.ap_users.user_name : null;

                    let processedErrorDesc = invoice.error_desc;
                    if (invoice.error_desc) {
                        if (typeof invoice.error_desc === 'object' && invoice.error_desc.value) {
                            try {
                                const p = JSON.parse(invoice.error_desc.value);
                                processedErrorDesc = p.Note && p.Error ? `Note: ${p.Note} | Error: ${p.Error}` : p.Note || p.Error || JSON.stringify(p);
                            } catch (e) { processedErrorDesc = invoice.error_desc.value; }
                        } else if (typeof invoice.error_desc === 'string') {
                            try {
                                const p = JSON.parse(invoice.error_desc);
                                processedErrorDesc = p.Note && p.Error ? `Note: ${p.Note} | Error: ${p.Error}` : p.Note || p.Error || JSON.stringify(p);
                            } catch (e) { processedErrorDesc = invoice.error_desc; }
                        } else {
                            processedErrorDesc = JSON.stringify(invoice.error_desc);
                        }
                    }

                    return {
                        ...invoice,
                        tenant_name: tenantName || '',
                        user_name: userName || '',
                        file_path: filePath,
                        file_name: formatFileName(filePath), // UUID stripped
                        error_desc: processedErrorDesc,
                    };
                });

                // Apply same client-side filters as fetchInvoices
                let filteredData = [...transformedData];
                if (columnFilters.doc_id && columnFilters.doc_id.trim() !== '') {
                    const fileNameSearch = columnFilters.doc_id.trim().toLowerCase();
                    filteredData = filteredData.filter((item) => {
                        if (!item.file_name) return false;
                        const base = item.file_name.split('_')[0];
                        return base && base.toLowerCase().includes(fileNameSearch);
                    });
                }

                // Client-side tenant name filter for export
                if (columnFilters.tenant_name && columnFilters.tenant_name.trim() !== '') {
                    const tenantSearch = columnFilters.tenant_name.trim().toLowerCase();
                    filteredData = filteredData.filter(item =>
                        item.tenant_name &&
                        item.tenant_name.trim() &&
                        item.tenant_name.toLowerCase().includes(tenantSearch)
                    );
                }

                // Client-side user name filter for export
                if (columnFilters.user_id && columnFilters.user_id.trim() !== '') {
                    const userSearch = columnFilters.user_id.trim().toLowerCase();
                    filteredData = filteredData.filter(item =>
                        item.user_name &&
                        item.user_name.trim() &&
                        item.user_name.toLowerCase().includes(userSearch)
                    );
                }

                return filteredData;
            } else {
                return [];
            }
        } catch (error) {
            // Error fetching invoices
            return [];
        }
    };
    const downloadExcel = async () => {
        // Show full-page loading overlay
        setExportLoading(true);

        // Show loading state on button
        const originalButtonText = document.querySelector('[data-export-button]')?.textContent;
        const exportButton = document.querySelector('[data-export-button]');
        if (exportButton) {
            exportButton.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Exporting...';
            exportButton.disabled = true;
        }

        try {
            // Fetch all invoices without pagination
            const allInvoices = await fetchAllInvoicesForExport();

            // Prepare the data for Excel export with only selected columns
            const exportData = await Promise.all(allInvoices.map(async (req, index) => {
                const rowData = {
                    'S.No': index + 1,
                };

                // Add only selected columns to the export data
                for (const col of selectedExportColumns.filter(col => col.selected && col.key !== 'actions')) {
                    switch (col.key) {
                        case 'invoice_id':
                            rowData['ID'] = req.invoice_id || 'N/A';
                            break;
                        case 'tenant_name':
                            if (user.role === 'super_admin') {
                                rowData['Tenant'] = req.tenant_name || 'N/A';
                            }
                            break;
                        case 'invoice_no':
                            rowData['Invoice No'] = req.invoice_no || 'N/A';
                            break;
                        case 'po_no':
                            rowData['PO No'] = req.po_no || 'N/A';
                            break;
                        case 'vendor_name':
                            rowData['Vendor Name'] = req.vendor_name || 'N/A';
                            break;
                        case 'doc_id':
                            rowData['File Name'] = req.file_path ? formatFileName(req.file_path) : 'N/A';
                            break;
                        case 'user_id':
                            if (user.role === 'tenant_admin' || user.role === 'account_manager') {
                                rowData['User Name'] = req.user_name || 'N/A';
                            }
                            break;
                        case 'stage':
                            rowData['Stage'] = capitalizeStatus(req.stage) || 'N/A';
                            break;
                        case 'status':
                            rowData['Status'] = capitalizeStatus(req.status) || 'N/A';
                            break;
                        case 'created_at':
                            rowData['Created At'] = req.created_at ? new Date(req.created_at).toLocaleDateString('en-IN') : 'N/A';
                            break;
                        case 'updated_at':
                            rowData['Updated At'] = req.updated_at ? new Date(req.updated_at).toLocaleDateString('en-IN') : 'N/A';
                            break;
                        case 'invoice_date':
                            rowData['Invoice Date'] = req.invoice_date ? new Date(req.invoice_date).toLocaleDateString('en-IN') : 'N/A';
                            break;
                        case 'extracted_data':
                            // Format extracted data as JSON string
                            rowData['Extracted Data'] = req.extracted_data ? JSON.stringify(req.extracted_data, null, 2) : 'N/A';
                            break;
                        case 'extracted_data_history':
                            // Format extracted data history as JSON string
                            rowData['Extracted Data History'] = req.extracted_data_history ? JSON.stringify(req.extracted_data_history, null, 2) : 'N/A';
                            break;
                        case 'error_desc':
                            // Handle error_desc which is stored as JSONB with {type: 'jsonb', value: '...', null: false} structure
                            let errorDescValue = 'N/A';
                            if (req.error_desc) {
                                if (typeof req.error_desc === 'object' && req.error_desc.value) {
                                    // Handle JSONB format
                                    try {
                                        const parsedError = JSON.parse(req.error_desc.value);
                                        // Format as a readable string with both Note and Error if available
                                        if (parsedError.Note && parsedError.Error) {
                                            errorDescValue = `Note: ${parsedError.Note} | Error: ${parsedError.Error}`;
                                        } else if (parsedError.Note) {
                                            errorDescValue = parsedError.Note;
                                        } else if (parsedError.Error) {
                                            errorDescValue = parsedError.Error;
                                        } else {
                                            errorDescValue = JSON.stringify(parsedError);
                                        }
                                    } catch (e) {
                                        // If parsing fails, use the raw value
                                        errorDescValue = req.error_desc.value;
                                    }
                                } else if (typeof req.error_desc === 'string') {
                                    // Handle if it's already a string
                                    try {
                                        const parsedError = JSON.parse(req.error_desc);
                                        if (parsedError.Note && parsedError.Error) {
                                            errorDescValue = `Note: ${parsedError.Note} | Error: ${parsedError.Error}`;
                                        } else if (parsedError.Note) {
                                            errorDescValue = parsedError.Note;
                                        } else if (parsedError.Error) {
                                            errorDescValue = parsedError.Error;
                                        } else {
                                            errorDescValue = JSON.stringify(parsedError);
                                        }
                                    } catch (e) {
                                        // If it's not JSON, use as is
                                        errorDescValue = req.error_desc;
                                    }
                                } else {
                                    errorDescValue = JSON.stringify(req.error_desc);
                                }
                            }
                            rowData['Error Description'] = errorDescValue;
                            break;
                        case 'comments':
                            rowData['Comments'] = req.comments || 'N/A';
                            break;
                        case 'created_by':
                            rowData['Created By'] = req.created_by || 'N/A';
                            break;
                        case 'updated_by':
                            rowData['Updated By'] = req.updated_by || 'N/A';
                            break;
                        case 'page_count':
                            // Get page count from the document table
                            let pageCount = 'N/A';
                            if (req.doc_id) {
                                try {
                                    const config = {
                                        headers: {
                                            Authorization: `Bearer ${token}`
                                        }
                                    };
                                    const docResponse = await axios.get(`/api/v1/tables/ap_documents?doc_id=eq.${req.doc_id}&select=page_count`, config);
                                    if (docResponse.data && docResponse.data[0] && docResponse.data[0].page_count) {
                                        pageCount = docResponse.data[0].page_count;
                                    }
                                } catch (docError) {
                                    console.warn('Failed to fetch page count for doc_id:', req.doc_id);
                                }
                            }
                            rowData['Page Count'] = pageCount;
                            break;
                    }
                }

                return rowData;
            }));

            // Create a new workbook
            const workbook = XLSX.utils.book_new();

            // Convert the data to worksheet
            const worksheet = XLSX.utils.json_to_sheet(exportData);

            // Set column widths for better visibility
            const columnWidths = [
                { wch: 6 },   // S.No
            ];

            // Add column widths based on selected columns
            selectedExportColumns
                .filter(col => col.selected && col.key !== 'actions')
                .forEach(col => {
                    switch (col.key) {
                        case 'invoice_id':
                            columnWidths.push({ wch: 10 }); // ID
                            break;
                        case 'tenant_name':
                            if (user.role === 'super_admin') {
                                columnWidths.push({ wch: 20 }); // Tenant
                            }
                            break;
                        case 'invoice_no':
                            columnWidths.push({ wch: 16 }); // Invoice No
                            break;
                        case 'po_no':
                            columnWidths.push({ wch: 14 }); // PO No
                            break;
                        case 'vendor_name':
                            columnWidths.push({ wch: 30 }); // Vendor Name
                            break;
                        case 'doc_id':
                            columnWidths.push({ wch: 25 }); // File Name
                            break;
                        case 'user_id':
                            if (user.role === 'tenant_admin' || user.role === 'account_manager') {
                                columnWidths.push({ wch: 20 }); // User Name
                            }
                            break;
                        case 'stage':
                            columnWidths.push({ wch: 12 }); // Stage
                            break;
                        case 'status':
                            columnWidths.push({ wch: 12 }); // Status
                            break;
                        case 'created_at':
                            columnWidths.push({ wch: 12 }); // Created At
                            break;
                        case 'updated_at':
                            columnWidths.push({ wch: 12 }); // Updated At
                            break;
                        case 'invoice_date':
                            columnWidths.push({ wch: 12 }); // Invoice Date
                            break;
                        case 'extracted_data':
                            columnWidths.push({ wch: 30 }); // Extracted Data
                            break;
                        case 'error_desc':
                            columnWidths.push({ wch: 25 }); // Error Description
                            break;
                        case 'comments':
                            columnWidths.push({ wch: 30 }); // Comments
                            break;
                        case 'created_by':
                            columnWidths.push({ wch: 20 }); // Created By
                            break;
                        case 'updated_by':
                            columnWidths.push({ wch: 20 }); // Updated By
                            break;
                        case 'extracted_data_history':
                            columnWidths.push({ wch: 30 }); // Extracted Data History
                            break;
                        case 'page_count':
                            columnWidths.push({ wch: 12 }); // Page Count
                            break;
                    }
                });

            worksheet['!cols'] = columnWidths;

            // Style the header row
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                if (!worksheet[cellAddress]) continue;

                worksheet[cellAddress].s = {
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "4F46E5" } },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }

            // Add the worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice Report');

            // Create a summary sheet
            // Dynamically count every distinct status present in the filtered data
            const statusCountMap = allInvoices.reduce((acc, invoice) => {
                const raw = String(invoice.status || '').trim();
                if (!raw) return acc;
                acc[raw] = (acc[raw] || 0) + 1;
                return acc;
            }, {});

            // Sort alphabetically for consistent ordering in the sheet
            const statusStatRows = Object.entries(statusCountMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([status, count]) => ({
                    Section: status
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase()),
                    Value: count,
                }));

            const formatFilterKey = (key) =>
                String(key || '')
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (char) => char.toUpperCase());

            const mapFilterLabel = (key) => {
                switch (key) {
                    case 'user_id':
                        return 'Username';
                    case 'tenant_name':
                        return 'Tenant Name';
                    case 'stage':
                        return 'Stage';
                    case 'status':
                        return 'Status';
                    default:
                        return formatFilterKey(key);
                }
            };

            const filterMap = new Map();

            const setFilter = (key, value) => {
                if (!(typeof value === 'string' ? value.trim() !== '' : Boolean(value))) return;
                const normalizedValue = String(value).trim();
                if (key === 'user_id') {
                    const usernames = [...new Set(
                        allInvoices
                            .map((invoice) => invoice.user_name)
                            .filter((name) => name && String(name).trim() !== '')
                            .map((name) => String(name).trim())
                    )];
                    filterMap.set('user_id', usernames.length > 0 ? usernames.join(', ') : normalizedValue);
                    return;
                }
                filterMap.set(key, normalizedValue);
            };

            Object.entries(columnFilters || {}).forEach(([key, value]) => setFilter(key, value));
            Object.entries(appliedFilters || {}).forEach(([key, value]) => setFilter(key, value));

            if (searchTerm && searchTerm.trim() !== '') {
                const searchLabel = searchField && searchField !== 'all'
                    ? `Search (${formatFilterKey(searchField)})`
                    : 'Search';
                filterMap.set(searchLabel, searchTerm.trim());
            }

            const filterRows = filterMap.size > 0
                ? [...filterMap.entries()].map(([key, value]) => ({
                    Section: mapFilterLabel(key),
                    Value: value,
                }))
                : [{ Section: 'None', Value: '' }];

            const summaryData = [
                { Section: 'INVOICE EXPORT SUMMARY', Value: '' },
                { Section: '------------------------------------------------', Value: '' },
                { Section: 'Report Generated On', Value: new Date().toLocaleString('en-IN') },
                { Section: 'Generated By', Value: user.username || user.email || 'N/A' },
                { Section: 'Total Records', Value: allInvoices.length },
                { Section: '', Value: '' },
                { Section: 'FILTERS APPLIED', Value: '' },
                { Section: '------------------------------------------------', Value: '' },
                ...filterRows,
                { Section: '', Value: '' },
                { Section: 'STATISTICS', Value: '' },
                { Section: '------------------------------------------------', Value: '' },
                ...statusStatRows,
            ];

            const summarySheet = XLSX.utils.json_to_sheet(summaryData);
            summarySheet['!cols'] = [{ wch: 30 }, { wch: 40 }];
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

            // Generate filename with current date and time
            const currentDate = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
            const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '-');
            const filename = `Invoice_Report_${currentDate}_${currentTime}.xlsx`;

            // Save the file
            XLSX.writeFile(workbook, filename);
        } finally {
            // Hide full-page loading overlay
            setExportLoading(false);

            // Restore button state
            if (exportButton) {
                exportButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-down"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 12v6"/><path d="m9 15 3-3 3 3"/></svg> <span class="hidden sm:inline">Export</span>';
                exportButton.disabled = false;
            }
        }
    };

    const viewInvoiceDetails = (invoice) => {
        // selected invoice

        setSelectedInvoice(invoice);
        setShowDetailModal(true);
    };

    // Define columns for TableComponent
    const columns = useMemo(() => {
        const baseColumns = [
            // {
            //     key: 'invoice_id',
            //     header: 'ID',
            //     sortable: true,
            //     filterable: true,
            //     width: '50px',
            // },
        ];

        if (user.role === 'super_admin') {
            baseColumns.push({
                key: 'tenant_name',
                header: 'Tenant Name',
                sortable: true,
                filterable: true,
                width: '120px',
                render: (item) => {
                    const name = item.tenant_name;
                    // Only show valid tenant names, not 'N/A' placeholders
                    return name && name !== 'N/A' ? (
                        <div className="truncate" title={name}>
                            {name}
                        </div>
                    ) : null;
                },
            });
        }

        if (user.role === 'super_admin' || user.role === 'tenant_admin' || user.role === 'account_manager') {
            baseColumns.push({
                key: 'user_id',
                header: 'User Name',
                filterPlaceholder: 'User Name',
                sortable: true,
                filterable: true,
                width: '150px',
                render: (item) => {
                    const userName = item.user_name;
                    // Only show valid user names, not 'N/A' placeholders
                    return userName && userName !== 'N/A' ? (
                        <div className="truncate" title={userName}>
                            {userName}
                        </div>
                    ) : null;
                },
            });
        }

        baseColumns.push(
            {
                key: 'invoice_no',
                header: 'Invoice No',
                sortable: true,
                filterable: true,
                width: '120px',
            },
            {
                key: 'po_no',
                header: 'PO Number',
                filterPlaceholder: 'PO Number',
                sortable: true,
                filterable: true,
                width: '120px',
            },
            {
                key: 'vendor_name',
                header: 'Vendor',
                sortable: true,
                filterable: true,
                width: '150px',
            },
            {
                key: 'doc_id',
                header: 'File Name',
                sortable: true,
                filterable: true,
                filterPlaceholder: 'File Name',
                width: '140px',
                render: (item) => {
                    const formattedName = item.file_name || (item.file_path ? formatFileName(item.file_path) : '—');
                    return (
                        <div className="truncate" title={formattedName !== '—' ? formattedName : 'No file available'}>
                            {formattedName}
                        </div>
                    );
                },
            }
        );

        baseColumns.push(

            {
                key: 'stage',
                header: 'Stage',
                sortable: true,
                filterable: true,
                filterType: 'select',
                filterOptions: () => allStageValues,
                width: '100px',
            },
            {
                key: 'status',
                header: 'Status',
                sortable: true,
                filterable: true,
                filterType: 'select',
                filterOptions: () => allStatusValues,
                width: '100px',
            },
            {
                key: 'created_at',
                header: 'Created On',
                sortable: true,
                filterable: true,
                filterType: 'date',
                width: '140px',
                render: (item) => item.created_at ? `${new Date(item.created_at).toLocaleDateString('en-IN')} ${new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : 'N/A',
            },
            // {
            //     key: 'actions',
            //     header: 'Actions',
            //     sortable: false,
            //     filterable: false,
            //     width: '100px',
            //     render: (item) => (
            //         <div className="flex justify-center">
            //             <button 
            //                 className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 hover:shadow-md" 
            //                 title="View Invoice" 
            //                 onClick={() => viewInvoiceDetails(item)}
            //             >
            //                 <Eye size={16} />
            //             </button>
            //         </div>
            //     ),
            // }
        );

        return baseColumns;
    }, [user.role, allStageValues, allStatusValues]);

    return (
        <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 font-[poppins] text-xs ${showAdvancedFilter || showDetailModal ? "overflow-y-hidden" : "overflow"
            }`}>
            {loading && !filtering && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                        <p className="text-xs font-medium text-gray-700">Loading invoice data...</p>
                    </div>
                </div>
            )}

            <div className={`mx-auto max-w-auto flex flex-col gap-4 `}>
                <div className="flex flex-wrap items-center gap-y-2" data-tour="reports-header">
                    <div className="flex-shrink-0">
                        <h1 className="text-base font-semibold text-gray-900">Invoice Reports</h1>
                        <p className="mt-1 text-xs text-gray-600">Track and manage all invoice submissions with extracted data</p>
                    </div>

                    {/* Center: default date-range note */}
                    <div className="flex-1 flex justify-center min-w-0 px-2">
                        {isDefaultDateRange && (
                            <div ref={noteRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowNotePopover(v => !v)}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-md text-[10px] sm:text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                    <Info size={11} className="flex-shrink-0" />
                                    <span className="hidden sm:inline">Last 1 month ({getOneMonthAgoDate()} → {getTodayDate()})</span>
                                    <span className="sm:hidden">Last 1 month</span>
                                </button>

                                {/* Popover detail */}
                                {showNotePopover && (
                                    <div data-popover="note" className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-64 sm:w-72 bg-white border border-blue-100 rounded-lg shadow-xl p-3.5 text-xs">
                                        {/* Arrow */}
                                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-blue-100 rotate-45 block" />
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

                    {/* Buttons Section */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
                        {/* Clear Sort Button - Only show when sort is non-default */}
                        {hasActiveSort && (
                            <Button
                                variant="outline"
                                color="gray"
                                icon={ArrowUpDown}
                                onClick={clearSortOptions}
                                className="w-full sm:w-auto"
                            >
                                <span className="hidden sm:inline">Clear Sort</span>
                                <span className="sm:hidden">Sort</span>
                            </Button>
                        )}

                        {/* Reset Filters Button - Only show when non-default filters are applied */}
                        {hasNonDefaultFilters() && (
                            <Button
                                variant="outline"
                                color="red"
                                icon={X}
                                onClick={handleClearFilters}
                                data-tour="clear-filters"
                                className="w-full sm:w-auto"
                            >
                                <span className="hidden sm:inline">Reset Filters</span>
                                <span className="sm:hidden">Reset</span>
                            </Button>
                        )}

                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 hover:shadow disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                        </button>

                        <Button
                            ref={filterButtonRef}
                            variant="outline"
                            color="indigo"
                            icon={Filter}
                            onClick={() => {
                                if (filterButtonRef.current) {
                                    const rect = filterButtonRef.current.getBoundingClientRect();
                                    setPopoverPosition({
                                        top: rect.bottom + window.scrollY,
                                        right: window.innerWidth - rect.right
                                    });
                                }
                                // Pre-fill draft with default dates so they're visible in the panel
                                if (isDefaultDateRange) {
                                    setTempFilters(prev => ({
                                        ...appliedFilters,
                                        from_date: appliedFilters.from_date || getOneMonthAgoDate(),
                                        to_date:   appliedFilters.to_date   || getTodayDate(),
                                    }));
                                } else {
                                    setTempFilters(appliedFilters);
                                }
                                // Update original default dates when opening the filter panel
                                originalDefaultFromDate.current = getOneMonthAgoDate();
                                originalDefaultToDate.current = getTodayDate();
                                setShowAdvancedFilter(!showAdvancedFilter);
                                setShowNotePopover(false);
                            }}
                            data-tour="report-filters"
                            className="w-full sm:w-auto relative"
                        >
                            <span className="hidden sm:inline">Filter</span>
                            {activeFilterCount > 0 && (
                                <span className="ml-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>

                        <Button
                            data-export-button
                            icon={FileDown}
                            onClick={handleExportClick}
                            disabled={totalCount === 0}
                            data-tour="export-options"
                            className="w-full sm:w-auto"
                        >
                            <span className="hidden sm:inline">Export</span>
                        </Button>
                    </div>
                </div>

                {/* Status Cards */}
                <div className="rounded-lg">
                    <BalancedCardGrid
                        items={statusCardsConfig}
                        renderCard={(stat) => (
                            <StatusCard
                                key={stat.id}
                                label={stat.label}
                                value={stat.value}
                                color={stat.color}
                                statusType={stat.statusType}
                            />
                        )}
                        maxCardsPerRow={7}
                    />
                </div>


                {/* Use TableComponent instead of custom table */}
                <TableComponent
                    data={invoices}
                    columns={columns}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    onColumnFilterCommit={handleColumnFilterCommit}
                    sortField={sortField}
                    setSortField={setSortField}
                    sortAsc={sortAsc}
                    setSortAsc={setSortAsc}
                    page={page}
                    setPage={setPage}
                    emptyMessage={loading ? "Loading invoices..." : "No invoices found matching your criteria."}
                    totalCount={totalCount}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    // Pass filtering state to show inline loading indicator
                    filtering={filtering}
                    // Data tour attributes for comprehensive tour coverage
                    data-tour="reports-table"
                    tableFiltersDataTour="reports-table-filters"
                    tableSortDataTour="reports-table-sort"
                    tablePaginationDataTour="reports-table-pagination"
                />

                {/* Advanced Filter Panel */}
                <AdvancedFilterPanel
                    isOpen={showAdvancedFilter}
                    onClose={handleCloseAdvancedFilter}
                    title="Advanced Filters"
                    filterFields={filterFields}
                    values={tempFilters}
                    onChange={(key, value) => setTempFilters(prev => ({ ...prev, [key]: value }))}
                    onApply={handleApplyFilters}
                    onClearAll={handleClearAll}
                    onClearDefaults={handleClearDefaults}
                />

                {showDetailModal && <ViewInvoiceDetailDialog invoiceId={selectedInvoice ? selectedInvoice.invoice_id : null} tenant_id={user.tenantId} openDialog={showDetailModal} setOpenDialog={setShowDetailModal} />}

                {/* Document Preview Modal */}
                {documentModal.isOpen && (
                    <ViewDocumentModal
                        isOpen={documentModal.isOpen}
                        onRequestClose={() => setDocumentModal(prev => ({ ...prev, isOpen: false }))}
                        fileUrl={documentModal.fileUrl}
                        fileName={documentModal.fileName}
                    />
                )}

                {/* User Information Popover */}
                {userPopover.isOpen && (
                    <div
                        data-popover="user"
                        className="fixed z-[1600] w-80 rounded-lg bg-white shadow-2xl border border-indigo-200"
                        style={{
                            top: `${userPopover.position.top}px`,
                            left: `${userPopover.position.left}px`,
                        }}
                    >
                        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 rounded-t-lg flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="bg-white rounded-full p-1.5">
                                        <User size={16} className="text-indigo-600" />
                                    </div>
                                    <h3 className="text-xs font-semibold text-white">User Information</h3>
                                </div>
                                <button
                                    onClick={() => setUserPopover(prev => ({ ...prev, isOpen: false }))}
                                    className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1">
                            {userPopover.loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                                </div>
                            ) : userPopover.userData ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                                        <div className="bg-indigo-100 rounded-full p-3">
                                            <User size={24} className="text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900 text-xs">{userPopover.userData.user_name || 'N/A'}</p>
                                            <p className="text-xs text-gray-500">User ID: {userPopover.userData.id}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <div className="flex items-start gap-2">
                                            <div className="bg-blue-50 rounded p-1.5 mt-0.5">
                                                <User size={14} className="text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-medium text-gray-500">Email</p>
                                                <p className="text-xs text-gray-900 break-all">{userPopover.userData.email || 'N/A'}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <div className="bg-purple-50 rounded p-1.5 mt-0.5">
                                                <CheckCircle size={14} className="text-purple-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-medium text-gray-500">Role</p>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                                    {capitalizeStatus(userPopover.userData.user_role) || 'N/A'}
                                                </span>
                                            </div>
                                        </div>

                                        {userPopover.userData.phone && (
                                            <div className="flex items-start gap-2">
                                                <div className="bg-green-50 rounded p-1.5 mt-0.5">
                                                    <Building2 size={14} className="text-green-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-gray-500">Phone</p>
                                                    <p className="text-xs text-gray-900">{userPopover.userData.phone}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-start gap-2">
                                            <div className="bg-amber-50 rounded p-1.5 mt-0.5">
                                                <CheckCircle size={14} className="text-amber-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-medium text-gray-500">Status</p>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${userPopover.userData.is_active
                                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                                    : 'bg-red-100 text-red-800 border border-red-200'
                                                    }`}>
                                                    {userPopover.userData.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>

                                        {userPopover.userData.created_at && (
                                            <div className="flex items-start gap-2">
                                                <div className="bg-gray-50 rounded p-1.5 mt-0.5">
                                                    <Calendar size={14} className="text-gray-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-gray-500">Created On</p>
                                                    <p className="text-xs text-gray-900">
                                                        {new Date(userPopover.userData.created_at).toLocaleDateString('en-IN', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                                    <AlertCircle size={32} className="mb-2 text-gray-300" />
                                    <p className="text-sm">User information not found</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Export Confirmation Dialog with Column Selection */}
                {showExportDialog && (
                    <>
                        <div
                            className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowExportDialog(false)}
                        />
                        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full animate-scaleIn">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-2 rounded-t-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white rounded-full p-2">
                                            <FileDown size={14} className="text-indigo-600" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-white">Export to Excel</h3>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-4">
                                    <p className="text-xs text-gray-700 mb-2">
                                        Select the columns you want to include in the export:
                                    </p>

                                    {/* Column Selection */}
                                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 mb-2">
                                        <div className="flex flex-wrap">
                                            {selectedExportColumns.map((col, index) => (
                                                // Skip actions column
                                                col.key !== 'actions' && (
                                                    <div key={col.key} className="flex items-center py-2 w-1/2">
                                                        <input
                                                            type="checkbox"
                                                            id={`export-col-${col.key}`}
                                                            checked={col.selected}
                                                            onChange={(e) => {
                                                                const updatedColumns = [...selectedExportColumns];
                                                                updatedColumns[index].selected = e.target.checked;
                                                                setSelectedExportColumns(updatedColumns);
                                                            }}
                                                            className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                        />
                                                        <label
                                                            htmlFor={`export-col-${col.key}`}
                                                            className="ml-2 text-xs text-gray-700"
                                                        >
                                                            {col.header}
                                                        </label>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                                        <div className="flex items-start gap-3">
                                            <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />
                                            <div className="text-sm text-gray-700">
                                                <p className="font-medium text-blue-900 mb-1 text-xs">Export will include:</p>
                                                <ul className="space-y-1 text-xs">
                                                    <li>• Selected columns only</li>
                                                    <li>• All filtered invoice data</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="bg-gray-50 px-6 py-2 rounded-b-xl flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowExportDialog(false)}
                                        className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 font-medium text-xs hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowExportDialog(false);
                                            downloadExcel();
                                        }}
                                        className="px-3 py-1.5 rounded-md bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium text-xs hover:from-indigo-700 hover:to-indigo-800 shadow-md hover:shadow transition-all flex items-center gap-1"
                                    >
                                        <FileDown size={14} />
                                        Export Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Full-page Export Loading Overlay */}
                {exportLoading && (
                    <div className="fixed inset-0 z-[10001] bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-8 max-w-sm w-full mx-4 text-center animate-scaleIn">
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <div className="relative">
                                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                                        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Preparing Export</h3>
                                    <p className="text-sm text-gray-500 mb-2">Please wait while we prepare your data for export...</p>

                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default InvoiceReports;
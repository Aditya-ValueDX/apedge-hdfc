import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import useVendorStats from '../../hooks/useVendorStats';
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
    Timer,
    ThumbsUp,
    ThumbsDown,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import axios from '../../utils/authInterceptor';
import ViewInvoiceDetailDialog from './ViewInvoiceDetailDialog';
import ViewDocumentModal from '../View/ViewDocumentModal';
import * as XLSX from 'xlsx';
import TableComponent from '../common/TableComponent';
import StatusCard, { resetUsedIcons, BalancedCardGrid } from '../common/StatusCard';
import AdvancedFilterPanel from '../common/AdvancedFilterPanel';
import Button from '../common/Button';
import { apiBaseUrl } from '../../config/apiConfig';
import { formatFileName } from '../../utils/fileUtils';
import { useSearchParams } from 'react-router-dom';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import useVendorWorkflow from '../../hooks/useVendorWorkflow';
import WorkflowMissing from '../common/Vendor/WorkflowMissing';

// Returns a YYYY-MM-DD string for exactly 1 calendar month ago from today
const getOneMonthAgoDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

// Helper function to validate date format
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

// ─────────────────────────────────────────────────────────────────────────────
// -- Vendor Stats Card helpers (mirrors VendorDashboard)
// ─────────────────────────────────────────────────────────────────────────────
const VENDOR_STATS_COLORS = {
    total: { hex: '#5d76cb', bg: 'bg-blue-50' },
    completed: { hex: '#56ae76', bg: 'bg-green-50' },
    rejected: { hex: '#eb8484', bg: 'bg-red-50' },
    pending: { hex: '#e4b149', bg: 'bg-yellow-50' },
};

const formatVendorStepLabel = (step) =>
    step.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const VendorStatsPendingCard = ({ value, color, loading, pendingBreakdown }) => {
    const [hovered, setHovered] = useState(false);
    const breakdownEntries = Object.entries(pendingBreakdown || {});

    return (
        <div
            className="relative h-full"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <StatusCard
                label="Pending"
                value={value}
                color={color}
                statusType="pending"
            />
            {hovered && !loading && breakdownEntries.length > 0 && (
                <div
                    className="absolute z-50 top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-3"
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                >
                    <span className="absolute -top-1.5 left-5 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45 block" />
                    <p className="text-xs font-semibold text-gray-700 mb-2">Details</p>
                    <ul className="space-y-1.5">
                        {breakdownEntries.map(([step, count]) => (
                            <li key={step} className="flex items-center justify-between text-xs">
                                <span className="text-gray-500 truncate pr-2">
                                    {formatVendorStepLabel(step)}:
                                </span>
                                <span className="font-semibold text-gray-800 flex-shrink-0">
                                    {count}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// -- VendorKPIPanel
//
// Displays three KPI tiles derived purely from vendorStats (already fetched by
// useVendorStats — zero extra API calls):
//   1. Approval Rate  = completed / (completed + rejected) × 100
//   2. Rejection Rate = rejected  / (completed + rejected) × 100
//   3. Avg Completion Time = mean of (updated_at - created_at) for completed
//      vendors in recentVendors sample (best-effort; labelled as "sample").
//
// Props:
//   stats   — vendorStats object from useVendorStats  (may be null while loading)
//   loading — vendorStatsLoading boolean
// ─────────────────────────────────────────────────────────────────────────────
const VendorKPIPanel = ({ stats, loading }) => {
    // --- Derived values -------------------------------------------------------
    const completed = stats?.completed ?? 0;
    const rejected = stats?.rejected ?? 0;
    const resolved = completed + rejected; // denominator for rate KPIs

    const approvalRate = resolved > 0 ? ((completed / resolved) * 100).toFixed(1) : null;
    const rejectionRate = resolved > 0 ? ((rejected / resolved) * 100).toFixed(1) : null;

    // Avg completion days — computed from recentVendors that have both timestamps.
    // These are already in-memory (fetched by useVendorStats), no extra call.
    const avgDays = useMemo(() => {
        const rows = (stats?.recentVendors ?? []).filter(
            (v) => v.created_at && v.updated_at && v.updated_at !== v.created_at
        );
        if (rows.length === 0) return null;
        const totalMs = rows.reduce((sum, v) => {
            const diff = new Date(v.updated_at) - new Date(v.created_at);
            return sum + (diff > 0 ? diff : 0);
        }, 0);
        const avgMs = totalMs / rows.length;
        const days = avgMs / (1000 * 60 * 60 * 24);
        return days < 1 ? '< 1' : days.toFixed(1);
    }, [stats]);

    // --- Single KPI tile ------------------------------------------------------
    const KPITile = ({ icon: Icon, iconBg, iconColor, label, value, suffix, sub, barColor, barValue, shimmer }) => (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                    <Icon size={15} className={iconColor} />
                </div>
                {shimmer ? (
                    <div className="h-6 w-16 bg-gray-100 rounded animate-pulse" />
                ) : (
                    <span className="text-xl font-bold text-gray-900 tabular-nums">
                        {value !== null ? `${value}${suffix ?? ''}` : '—'}
                    </span>
                )}
            </div>
            <div>
                <p className="text-xs font-medium text-gray-500">{label}</p>
                {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
            {/* Progress bar — only shown when barValue is a valid number */}
            {typeof barValue === 'number' && !shimmer && (
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${Math.min(barValue, 100)}%` }}
                    />
                </div>
            )}
        </div>
    );

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Approval Rate */}
            <KPITile
                icon={ThumbsUp}
                iconBg="bg-green-50"
                iconColor="text-green-600"
                label="Approval Rate"
                value={approvalRate}
                suffix="%"
                sub={resolved > 0 ? `${completed} of ${resolved} resolved vendors` : 'No resolved vendors yet'}
                barColor="bg-green-400"
                barValue={approvalRate !== null ? parseFloat(approvalRate) : undefined}
                shimmer={loading}
            />

            {/* Rejection Rate */}
            <KPITile
                icon={ThumbsDown}
                iconBg="bg-red-50"
                iconColor="text-red-500"
                label="Rejection Rate"
                value={rejectionRate}
                suffix="%"
                sub={resolved > 0 ? `${rejected} of ${resolved} resolved vendors` : 'No resolved vendors yet'}
                barColor="bg-red-400"
                barValue={rejectionRate !== null ? parseFloat(rejectionRate) : undefined}
                shimmer={loading}
            />

            {/* Avg Completion Time */}
            <KPITile
                icon={Timer}
                iconBg="bg-indigo-50"
                iconColor="text-indigo-500"
                label="Avg Completion Time"
                value={loading ? null : avgDays}
                suffix={avgDays !== null && avgDays !== '< 1' ? ' days' : avgDays === '< 1' ? ' day' : ''}
                sub="Based on recent vendors sample"
                shimmer={loading}
            />
        </div>
    );
};

const VendorReports = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { workflowConfigMissing, loading: workflowLoading } = useVendorWorkflow();

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
        const vendor_id = searchParams.get('vendor_id');
        if (vendor_id) filters.vendor_id = vendor_id;

        const tenant_name = searchParams.get('tenant_name');
        if (tenant_name) filters.tenant_name = tenant_name;

        const vendor_code = searchParams.get('vendor_code');
        if (vendor_code) filters.vendor_code = vendor_code;

        const vendor_type = searchParams.get('vendor_type');
        if (vendor_type) filters.vendor_type = vendor_type;

        const vendor_name = searchParams.get('vendor_name');
        if (vendor_name) filters.vendor_name = vendor_name;

        const doc_id = searchParams.get('doc_id');
        if (doc_id) filters.doc_id = doc_id;

        const user_id = searchParams.get('user_id');
        if (user_id) filters.user_id = user_id;

        const vendor_input_source = searchParams.get('vendor_input_source');
        if (vendor_input_source) filters.vendor_input_source = vendor_input_source;

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

    // Vendor stats (Total / Pending / Completed / Rejected) — same hook as VendorDashboard
    const { stats: vendorStats, loading: vendorStatsLoading } = useVendorStats();

    // Component state
    const [vendors, setVendors] = useState([]);
    const [page, setPage] = useState(getInitialPage());
    const [pageSize, setPageSize] = useState(getInitialPageSize());
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filtering, setFiltering] = useState(false);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

    // All unique status values from the database
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
        {
            key: 'vendor_input_source',
            label: 'Input Source',
            type: 'text',
            icon: Package,
            placeholder: 'Filter by input source',
        },
    ], [allStatusValues, capitalizeStatus]);

    // All unique stage values from the database
    const [allStageValues, setAllStageValues] = useState([]);

    // All unique vendor_input_source values from the database
    const [allInputSourceValues, setAllInputSourceValues] = useState([]);

    // Summary statistics state
    const [summaryStats, setSummaryStats] = useState({
        totalApproved: 0,
        totalPending: 0,
        totalRejected: 0
    });

    // Status counts state
    const [statusCounts, setStatusCounts] = useState({});
    const [statusCardsConfig, setStatusCardsConfig] = useState([]);
    const [loadingStatusCounts, setLoadingStatusCounts] = useState(false);

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState(null);
    const searchInputRef = useRef(null);
    const filterButtonRef = useRef(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchField, setSearchField] = useState('all');
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, right: 0 });

    // Sorting state
    const [sortField, setSortField] = useState(getInitialSortField());
    const [sortAsc, setSortAsc] = useState(getInitialSortAsc());

    // Column filters state for TableComponent
    const [columnFilters, setColumnFilters] = useState({
        ...getInitialColumnFilters()
    });

    // Debounced filters — drive API refetch (same pattern as InvoiceReports)
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
    const [selectedExportColumns, setSelectedExportColumns] = useState([]);
    const [exportLoading, setExportLoading] = useState(false);

    // Track whether we are using the implicit 1-month default date range.
    // Becomes false once the user explicitly changes dates in the Advanced Filter panel.
    // Resets to true when the user clears all filters.
    const [isDefaultDateRange, setIsDefaultDateRange] = useState(true);

    // State for default date filter popover
    const [showNotePopover, setShowNotePopover] = useState(false);
    const noteRef = useRef(null);

    // Store original default dates when opening the filter panel
    const originalDefaultFromDate = useRef(getOneMonthAgoDate());
    const originalDefaultToDate = useRef(getTodayDate());

    // Temp and applied filters
    const [tempFilters, setTempFilters] = useState({
        from_date: '',
        to_date: '',
        status: '',
        stage: '',
        vendor_input_source: '',
    });

    const [appliedFilters, setAppliedFilters] = useState({
        from_date: '',
        to_date: '',
        status: '',
        stage: '',
        vendor_input_source: '',
    });

    // Initialize state from URL parameters when component mounts
    useEffect(() => {
        // State initialization functions already handle this
    }, [searchParams]);

    // Update URL parameters when state changes
    useEffect(() => {
        const params = new URLSearchParams();

        if (page !== 1) params.set('page', page.toString());
        if (pageSize !== 10) params.set('pageSize', pageSize.toString());

        if (sortField !== 'created_at') params.set('sortField', sortField);
        if (sortAsc) params.set('sortAsc', sortAsc.toString());

        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, columnFilters, setSearchParams]);

    // Debounce column filters (300 ms)
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
        const allPossibleColumns = [
            { key: 'vendor_id', header: 'ID', selected: true },
            { key: 'tenant_name', header: 'Tenant Name', selected: true },
            { key: 'vendor_code', header: 'Vendor Code', selected: true },
            { key: 'vendor_input_source', header: 'Input Source', selected: true },
            { key: 'vendor_type', header: 'Vendor Type', selected: true },
            { key: 'vendor_name', header: 'Vendor', selected: true },
            { key: 'doc_id', header: 'File Name', selected: true },
            { key: 'user_id', header: 'User Name', selected: true },
            { key: 'stage', header: 'Stage', selected: true },
            { key: 'status', header: 'Status', selected: true },
            { key: 'error_desc', header: 'Error Description', selected: true },
            { key: 'comments', header: 'Comments', selected: true },
            { key: 'extracted_data', header: 'Extracted Data', selected: false },
            { key: 'extracted_data_history', header: 'Extracted Data History', selected: false },
            { key: 'page_count', header: 'Page Count', selected: true },
            { key: 'created_at', header: 'Created On', selected: true },
            { key: 'created_by', header: 'Created By', selected: true },
            { key: 'updated_at', header: 'Updated On', selected: true },
            { key: 'updated_by', header: 'Updated By', selected: true }
        ];

        const filteredColumns = allPossibleColumns.filter(col => {
            if (user.role === 'account_user') {
                if (['created_by', 'updated_by', 'extracted_data', 'extracted_data_history'].includes(col.key)) {
                    return false;
                }
            }

            if (['vendor_id', 'vendor_code', 'vendor_type', 'vendor_name', 'doc_id', 'stage', 'status', 'created_at', 'updated_at'].includes(col.key)) {
                return true;
            }

            if (col.key === 'tenant_name') {
                return user.role === 'super_admin';
            }

            if (col.key === 'user_id') {
                return user.role === 'tenant_admin' || user.role === 'account_manager' || user.role === 'super_admin';
            }

            return true;
        });

        setSelectedExportColumns(filteredColumns);
    };

    const handleExportClick = () => {
        initializeExportColumns();
        setShowExportDialog(true);
    };

    // API functions
    const fetchUserDetails = async (userId) => {
        if (!user || !token) return null;

        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.get(`/api/v1/tables/ap_users?id=eq.${userId}&select=*`, config);
            if (response.status === 200 && response.data.length > 0) {
                return response.data[0];
            }
            return null;
        } catch (error) {
            return null;
        }
    };

    const fetchDocumentAndPreview = async (docId) => {
        if (!user || !token || !docId) return;

        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.get(`/api/v1/tables/ap_documents?doc_id=eq.${docId}&select=*`, config);

            if (response.status === 200 && response.data.length > 0) {
                const document = response.data[0];

                let filePath = document.file_path ||
                    document.doc_path ||
                    document.path ||
                    document.file_url ||
                    document.url ||
                    document.document_path ||
                    '';

                let fileName = document.file_name ||
                    document.doc_name ||
                    document.name ||
                    document.document_name ||
                    document.original_name ||
                    '';

                if (!fileName && filePath) {
                    const pathParts = filePath.split(/[/\\]/);
                    fileName = pathParts[pathParts.length - 1];
                }

                if (!fileName) {
                    fileName = `Document_${docId}.pdf`;
                }

                if (!filePath || filePath === '') {
                    setDocumentModal({ isOpen: true, fileUrl: 'not-found', fileName, loading: false });
                    return;
                }

                filePath = filePath.replace(/\\/g, '/');

                let fileUrl;
                if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
                    fileUrl = filePath;
                } else {
                    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
                    fileUrl = `/api/${cleanPath}`;
                }

                setDocumentModal({ isOpen: true, fileUrl, fileName, loading: false });
            } else {
                setDocumentModal({ isOpen: true, fileUrl: 'not-found', fileName: `Document_${docId}.pdf`, loading: false });
            }
        } catch (error) {
            setDocumentModal({ isOpen: true, fileUrl: 'not-found', fileName: `Document_${docId}.pdf`, loading: false });
        }
    };

    const handleDocIdClick = (docId) => {
        if (!docId) return;
        setDocumentModal({ isOpen: true, fileUrl: '', fileName: '', loading: true });
        fetchDocumentAndPreview(docId);
    };

    const handleUserIdClick = async (userId, event) => {
        const rect = event.target.getBoundingClientRect();
        const popoverWidth = 320;
        const popoverMaxHeight = window.innerHeight * 0.85;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        let top, left;

        if (viewportWidth >= 640) {
            top = rect.bottom + scrollY + 8;
            left = rect.left + scrollX;

            if (left + popoverWidth > viewportWidth + scrollX) {
                left = rect.right + scrollX - popoverWidth;
                if (left < scrollX + 10) {
                    left = scrollX + viewportWidth - popoverWidth - 10;
                }
            }
            left = Math.max(scrollX + 10, left);
        } else {
            left = (viewportWidth - popoverWidth) / 2;
            top = scrollY + (viewportHeight - popoverMaxHeight) / 2;
            left = Math.max(10, left);
            top = Math.max(scrollY + 10, top);
        }

        setUserPopover({
            isOpen: true,
            userId,
            userData: null,
            loading: true,
            position: { top, left }
        });

        const userData = await fetchUserDetails(userId);
        setUserPopover(prev => ({ ...prev, userData, loading: false }));
    };

    // Function to fetch all unique status values from the database
    const fetchAllStatusValues = useCallback(async () => {
        if (!user || !token || !user.role) return;

        try {
            let statusUrl = `/api/v1/tables/ap_vendors?select=status`;

            if (user.role === 'account_user') {
                if (!user.user_id || !user.tenantId) return;
                statusUrl += `&created_by=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
                if (!user.tenantId) return;
                statusUrl += `&tenant_id=eq.${user.tenantId}`;
            }

            const config = { headers: { Authorization: `Bearer ${token}` } };
            const res = await axios.get(statusUrl, config);
            const uniqueStatuses = [...new Set(res.data.map(v => v.status).filter(s => s !== null && s !== undefined && s !== ''))];
            setAllStatusValues(uniqueStatuses);
        } catch (err) {
            console.error('Error fetching status values:', err);
            setAllStatusValues([]);
        }
    }, [user, token]);

    // Function to fetch all unique stage values from the database
    const fetchAllStageValues = useCallback(async () => {
        if (!user || !token || !user.role) return;

        try {
            let stageUrl = `/api/v1/tables/ap_vendors?select=stage`;

            if (user.role === 'account_user') {
                if (!user.user_id || !user.tenantId) return;
                stageUrl += `&created_by=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
                if (!user.tenantId) return;
                stageUrl += `&tenant_id=eq.${user.tenantId}`;
            }

            const config = { headers: { Authorization: `Bearer ${token}` } };
            const res = await axios.get(stageUrl, config);
            const uniqueStages = [...new Set(res.data.map(v => v.stage).filter(s => s !== null && s !== undefined && s !== ''))];
            setAllStageValues(uniqueStages);
        } catch (err) {
            console.error('Error fetching stage values:', err);
            setAllStageValues([]);
        }
    }, [user, token]);

    // Function to fetch all unique vendor_input_source values from the database
    const fetchAllInputSourceValues = useCallback(async () => {
        if (!user || !token || !user.role) return;

        try {
            let inputSourceUrl = `/api/v1/tables/ap_vendors?select=vendor_input_source`;

            if (user.role === 'account_user') {
                if (!user.user_id || !user.tenantId) return;
                inputSourceUrl += `&created_by=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
                if (!user.tenantId) return;
                inputSourceUrl += `&tenant_id=eq.${user.tenantId}`;
            }

            const config = { headers: { Authorization: `Bearer ${token}` } };
            const res = await axios.get(inputSourceUrl, config);
            const uniqueInputSources = [...new Set(res.data.map(v => v.vendor_input_source).filter(s => s !== null && s !== undefined && s !== ''))];
            setAllInputSourceValues(uniqueInputSources);
        } catch (err) {
            console.error('Error fetching vendor_input_source values:', err);
            setAllInputSourceValues([]);
        }
    }, [user, token]);

    // Helper: build the role-based filter string for ap_vendors queries
    const buildRoleFilter = () => {
        if (user.role === 'tenant_admin' || user.role === 'account_manager') {
            return `&tenant_id=eq.${user.tenantId}`;
        } else if (user.role === 'account_user') {
            return `&created_by=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
        }
        return ''; // super_admin: no extra filter
    };

    // Helper: apply date range based on appliedFilters + isDefaultDateRange
    const applyDateRangeParams = (urlRef, currentAppliedFilters, currentIsDefaultDateRange) => {
        const effectiveFromDate = currentAppliedFilters.from_date || (currentIsDefaultDateRange ? getOneMonthAgoDate() : '');
        const effectiveToDate = currentAppliedFilters.to_date || (currentIsDefaultDateRange ? getTodayDate() : '');

        if (effectiveFromDate && isValidDateFormat(effectiveFromDate)) {
            try {
                const fromDate = new Date(effectiveFromDate);
                fromDate.setHours(0, 0, 0, 0);
                urlRef += `&created_at=gte.${fromDate.toISOString()}`;
            } catch (e) { /* noop */ }
        }

        if (effectiveToDate && isValidDateFormat(effectiveToDate)) {
            try {
                const toDate = new Date(effectiveToDate);
                toDate.setHours(23, 59, 59, 999);
                urlRef += `&created_at=lte.${toDate.toISOString()}`;
            } catch (e) { /* noop */ }
        }

        return urlRef;
    };

    // Fetch summary statistics (approved/pending/rejected counts)
    const fetchSummaryStats = async () => {
        if (!user || !token || !user.role) return;

        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            let apiUrl = `/api/v1/tables/ap_vendors?select=status`;
            apiUrl += buildRoleFilter();
            apiUrl = applyDateRangeParams(apiUrl, appliedFilters, isDefaultDateRange);

            if (appliedFilters.stage) apiUrl += `&stage=ilike.*${encodeURIComponent(appliedFilters.stage)}*`;
            if (appliedFilters.status) apiUrl += `&status=ilike.*${encodeURIComponent(appliedFilters.status)}*`;
            if (appliedFilters.vendor_input_source) apiUrl += `&vendor_input_source=ilike.*${encodeURIComponent(appliedFilters.vendor_input_source)}*`;

            const response = await axios.get(apiUrl, config);

            if (response.status === 200) {
                let approved = 0, pending = 0, rejected = 0;
                response.data.forEach(vendor => {
                    const status = vendor.status?.toLowerCase();
                    if (status === 'approved' || status === 'complete') approved++;
                    else if (status === 'waiting approval' || status === 'submitted' || status === 'pending') pending++;
                    else if (status === 'rejected') rejected++;
                });
                setSummaryStats({ totalApproved: approved, totalPending: pending, totalRejected: rejected });
            }
        } catch (error) {
            setSummaryStats({ totalApproved: 0, totalPending: 0, totalRejected: 0 });
        }
    };

    const fetchVendors = async (showRefreshIndicator = false) => {
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
        // skip server pagination, fetch ALL records, then filter + re-paginate locally
        const needsClientSideFiltering = !!(
            (debouncedColumnFilters.doc_id && debouncedColumnFilters.doc_id.trim()) ||
            (debouncedColumnFilters.tenant_name && debouncedColumnFilters.tenant_name.trim()) ||
            (debouncedColumnFilters.user_id && debouncedColumnFilters.user_id.trim())
        );

        const offset = (page - 1) * pageSize;

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact'
                }
            };

            let apiUrl = `/api/v1/tables/ap_vendors?select=*,ap_tenants(tenant_name),ap_users(user_name)`;
            apiUrl += buildRoleFilter();

            // Skip server pagination when doing client-side filtering
            if (!needsClientSideFiltering) {
                apiUrl += `&limit=${pageSize}&offset=${offset}`;
            }

            // Sorting
            let dbSortField = sortField;
            if (sortField === 'tenant_name') dbSortField = 'tenant_id';
            const orderDirection = sortAsc ? 'asc' : 'desc';
            apiUrl += `&order=${dbSortField}.${orderDirection}`;

            // Column filters (debouncedColumnFilters)
            Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
                if (value) {
                    const fv = encodeURIComponent(value);
                    switch (key) {
                        case 'vendor_id':
                            apiUrl += /^\d+$/.test(value) ? `&vendor_id=eq.${fv}` : `&vendor_id=ilike.*${fv}*`;
                            break;
                        case 'tenant_name':
                            // Handled client-side
                            break;
                        case 'vendor_code':
                            apiUrl += `&vendor_code=ilike.*${fv}*`;
                            break;
                        case 'vendor_type':
                            apiUrl += `&vendor_type=ilike.*${fv}*`;
                            break;
                        case 'vendor_name':
                            apiUrl += `&vendor_name=ilike.*${fv}*`;
                            break;
                        case 'doc_id':
                            // Handled client-side
                            break;
                        case 'user_id':
                            // Handled client-side
                            break;
                        case 'vendor_input_source':
                            apiUrl += `&vendor_input_source=ilike.*${fv}*`;
                            break;
                        case 'created_at':
                            try {
                                const startDate = new Date(value);
                                startDate.setHours(0, 0, 0, 0);
                                const endDate = new Date(value);
                                endDate.setHours(23, 59, 59, 999);
                                apiUrl += `&created_at=gte.${startDate.toISOString()}&created_at=lte.${endDate.toISOString()}`;
                            } catch (e) { /* noop */ }
                            break;
                        case 'stage':
                            apiUrl += `&stage=ilike.*${fv}*`;
                            break;
                        case 'status':
                            apiUrl += `&status=ilike.*${fv}*`;
                            break;
                    }
                }
            });

            // Date range filtering: use explicit appliedFilters dates, or fall back to the
            // implicit 1-month default when no date filter has been set by the user.
            apiUrl = applyDateRangeParams(apiUrl, appliedFilters, isDefaultDateRange);

            if (appliedFilters.stage) {
                apiUrl += `&stage=ilike.*${encodeURIComponent(appliedFilters.stage)}*`;
            }

            if (appliedFilters.status) {
                apiUrl += `&status=ilike.*${encodeURIComponent(appliedFilters.status)}*`;
            }

            if (appliedFilters.vendor_input_source) {
                apiUrl += `&vendor_input_source=ilike.*${encodeURIComponent(appliedFilters.vendor_input_source)}*`;
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
                // Batch fetch file_path from ap_documents
                const docIds = [...new Set(response.data.map(v => v.doc_id).filter(Boolean))];
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

                // Build flat rows with joins from ap_tenants and ap_users
                let formatted = response.data.map(vendor => {
                    const filePath = docMap[vendor.doc_id] || '';
                    const tenantName = vendor.ap_tenants ? vendor.ap_tenants.tenant_name : null;
                    const userName = vendor.ap_users ? vendor.ap_users.user_name : null;

                    // Process error_desc
                    let processedErrorDesc = vendor.error_desc;
                    if (vendor.error_desc) {
                        if (typeof vendor.error_desc === 'object' && vendor.error_desc.value) {
                            try {
                                const p = JSON.parse(vendor.error_desc.value);
                                processedErrorDesc = p.Note && p.Error ? `Note: ${p.Note} | Error: ${p.Error}` : p.Note || p.Error || JSON.stringify(p);
                            } catch (e) { processedErrorDesc = vendor.error_desc.value; }
                        } else if (typeof vendor.error_desc === 'string') {
                            try {
                                const p = JSON.parse(vendor.error_desc);
                                processedErrorDesc = p.Note && p.Error ? `Note: ${p.Note} | Error: ${p.Error}` : p.Note || p.Error || JSON.stringify(p);
                            } catch (e) { processedErrorDesc = vendor.error_desc; }
                        } else {
                            processedErrorDesc = JSON.stringify(vendor.error_desc);
                        }
                    }

                    return {
                        ...vendor,
                        tenant_name: tenantName || '',
                        user_name: userName || '',
                        file_path: filePath,
                        file_name: formatFileName(filePath),
                        error_desc: processedErrorDesc,
                    };
                });

                // Client-side file name filter
                if (debouncedColumnFilters.doc_id && debouncedColumnFilters.doc_id.trim() !== '') {
                    const fileNameSearch = debouncedColumnFilters.doc_id.trim().toLowerCase();
                    formatted = formatted.filter((item) => {
                        if (!item.file_name) return false;
                        const baseFileName = item.file_name.split('_')[0];
                        return baseFileName && baseFileName.toLowerCase().includes(fileNameSearch);
                    });
                }

                // Client-side tenant name filter
                if (debouncedColumnFilters.tenant_name && debouncedColumnFilters.tenant_name.trim() !== '') {
                    const tenantSearch = debouncedColumnFilters.tenant_name.trim().toLowerCase();
                    formatted = formatted.filter(item =>
                        item.tenant_name &&
                        item.tenant_name.trim() &&
                        item.tenant_name.toLowerCase().includes(tenantSearch)
                    );
                }

                // Client-side user name filter
                if (debouncedColumnFilters.user_id && debouncedColumnFilters.user_id.trim() !== '') {
                    const userSearch = debouncedColumnFilters.user_id.trim().toLowerCase();
                    formatted = formatted.filter(item =>
                        item.user_name &&
                        item.user_name.trim() &&
                        item.user_name.toLowerCase().includes(userSearch)
                    );
                }

                // Client-side pagination when client-side filter is active
                let finalData = formatted;
                let finalTotal = total;
                if (needsClientSideFiltering) {
                    finalTotal = formatted.length;
                    if (finalTotal === 0) {
                        finalData = [];
                    } else {
                        const maxPage = Math.ceil(finalTotal / pageSize);
                        const safePage = page > maxPage ? 1 : page;
                        const start = (safePage - 1) * pageSize;
                        finalData = formatted.slice(start, start + pageSize);
                    }
                }

                setVendors(finalData);
                setTotalCount(finalTotal);
            } else {
                setVendors([]);
                setTotalCount(0);
            }
        } catch (error) {
            setVendors([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setFiltering(false);
        }
    };

    // Function to fetch status counts for each unique status
    const fetchStatusCounts = useCallback(async () => {
        if (!user || !token || !user.role || allStatusValues.length === 0) return;

        setLoadingStatusCounts(true);

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact'
                }
            };

            const extraParams = [];

            // Role filter
            if (user.role === 'tenant_admin' || user.role === 'account_manager') {
                extraParams.push(`tenant_id=eq.${user.tenantId}`);
            } else if (user.role === 'account_user') {
                extraParams.push(`created_by=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`);
            }

            // Date range
            const effectiveFromDate = appliedFilters.from_date || (isDefaultDateRange ? getOneMonthAgoDate() : '');
            const effectiveToDate = appliedFilters.to_date || (isDefaultDateRange ? getTodayDate() : '');

            if (effectiveFromDate && isValidDateFormat(effectiveFromDate)) {
                try {
                    const fromDate = new Date(effectiveFromDate);
                    fromDate.setHours(0, 0, 0, 0);
                    extraParams.push(`created_at=gte.${fromDate.toISOString()}`);
                } catch (e) { /* noop */ }
            }

            if (effectiveToDate && isValidDateFormat(effectiveToDate)) {
                try {
                    const toDate = new Date(effectiveToDate);
                    toDate.setHours(23, 59, 59, 999);
                    extraParams.push(`created_at=lte.${toDate.toISOString()}`);
                } catch (e) { /* noop */ }
            }

            if (appliedFilters.stage) extraParams.push(`stage=ilike.*${encodeURIComponent(appliedFilters.stage)}*`);
            if (appliedFilters.status) extraParams.push(`status=ilike.*${encodeURIComponent(appliedFilters.status)}*`);
            if (appliedFilters.vendor_input_source) extraParams.push(`vendor_input_source=ilike.*${encodeURIComponent(appliedFilters.vendor_input_source)}*`);

            // Column filters (server-side only)
            Object.entries(columnFilters).forEach(([key, value]) => {
                if (value) {
                    const fv = encodeURIComponent(value);
                    switch (key) {
                        case 'vendor_id':
                            extraParams.push(/^\d+$/.test(value) ? `vendor_id=eq.${fv}` : `vendor_id=ilike.*${fv}*`);
                            break;
                        case 'tenant_name': break; // client-side
                        case 'vendor_code': extraParams.push(`vendor_code=ilike.*${fv}*`); break;
                        case 'vendor_type': extraParams.push(`vendor_type=ilike.*${fv}*`); break;
                        case 'vendor_name': extraParams.push(`vendor_name=ilike.*${fv}*`); break;
                        case 'doc_id': break; // client-side
                        case 'user_id': break; // client-side
                        case 'vendor_input_source': extraParams.push(`vendor_input_source=ilike.*${fv}*`); break;
                        case 'created_at':
                            try {
                                const startDate = new Date(value); startDate.setHours(0, 0, 0, 0);
                                const endDate = new Date(value); endDate.setHours(23, 59, 59, 999);
                                extraParams.push(`created_at=gte.${startDate.toISOString()}&created_at=lte.${endDate.toISOString()}`);
                            } catch (e) { /* noop */ }
                            break;
                        case 'stage': extraParams.push(`stage=ilike.*${fv}*`); break;
                        case 'status': extraParams.push(`status=ilike.*${fv}*`); break;
                    }
                }
            });

            extraParams.push('limit=10000');

            const allParamStr = extraParams.filter(Boolean).join('&');
            const baseUrl = `/api/v1/tables/ap_vendors?select=*,ap_tenants(tenant_name),ap_users(user_name)&${allParamStr}`;

            const res = await axios.get(baseUrl, config);
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
                const docIds = [...new Set(filteredData.map(v => v.doc_id).filter(Boolean))];
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
                filteredData = filteredData.filter((item) => {
                    const filePath = docMap[item.doc_id] || '';
                    const fileName = formatFileName(filePath);
                    if (!fileName) return false;
                    const baseFileName = fileName.split('_')[0];
                    return baseFileName && baseFileName.toLowerCase().includes(fileNameSearch);
                });
            }

            // Calculate status counts from filtered data
            const counts = {};
            counts['Total Uploaded'] = filteredData.length;

            for (const status of allStatusValues) {
                const statusFiltered = filteredData.filter(item =>
                    item.status && item.status.toLowerCase().includes(status.toLowerCase())
                );
                counts[status] = statusFiltered.length;
            }

            setStatusCounts(counts);

            // Build status cards config
            const cardsConfig = [];
            resetUsedIcons();

            const getStatusColor = (statusType) => {
                const n = statusType.toLowerCase();
                if (n.includes('approved') || n.includes('complete') || n.includes('posted')) {
                    return { hex: '#10b981', bg: 'bg-green-50' };
                } else if (n.includes('pending') || n.includes('waiting') || n.includes('review') || n.includes('draft')) {
                    return { hex: '#f59e0b', bg: 'bg-amber-50' };
                } else if (n.includes('rejected') || n.includes('error') || n.includes('failure')) {
                    return { hex: '#ef4444', bg: 'bg-red-50' };
                } else if (n.includes('processing') || n.includes('extract') || n.includes('upload')) {
                    return { hex: '#3b82f6', bg: 'bg-blue-50' };
                } else {
                    return { hex: '#6b7280', bg: 'bg-gray-50' };
                }
            };

            cardsConfig.push({
                id: 'total',
                label: 'Total Uploaded',
                value: filteredData.length,
                color: { hex: '#5d76cb', bg: 'bg-blue-50' },
                statusType: 'total'
            });

            allStatusValues.forEach((status) => {
                cardsConfig.push({
                    id: status,
                    label: capitalizeStatus(status),
                    value: counts[status] || 0,
                    color: getStatusColor(status),
                    statusType: status
                });
            });

            setStatusCardsConfig(cardsConfig);

        } catch (error) {
            console.error('Error fetching status counts:', error);
            if (Object.keys(statusCounts).length === 0) {
                setStatusCounts({ 'Total Uploaded': 0 });
                resetUsedIcons();
                setStatusCardsConfig([{
                    id: 'total',
                    label: 'Total Uploaded',
                    value: 0,
                    color: { hex: '#5d76cb', bg: 'bg-blue-50' },
                    statusType: 'total'
                }]);
            }
        } finally {
            setLoadingStatusCounts(false);
        }
    }, [user, token, allStatusValues, appliedFilters, columnFilters, isDefaultDateRange]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                fetchAllStatusValues(),
                fetchAllStageValues(),
                fetchAllInputSourceValues(),
                fetchVendors(true)
            ]);
            fetchSummaryStats();
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
        setCardPopup({ isOpen: true, title, content, isEditable: false, contentType: 'text' });
    };

    const statusColor = (status) => {
        const map = {
            draft: '#94a3b8',
            'waiting approval': '#f59e0b',
            processing: '#2563eb',
            submitted: '#6366f1',
            error: '#ef4444',
            rejected: '#ef4444',
            approved: '#10b981',
            complete: '#10b981',
            default: '#9ca3af',
        };
        return map[status?.toLowerCase()] || map.default;
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showAdvancedFilter && filterButtonRef.current && !filterButtonRef.current.contains(event.target)) {
                const popover = document.querySelector('[data-popover="filter"]');
                if (popover && !popover.contains(event.target)) {
                    setShowAdvancedFilter(false);
                }
            }

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
    useEffect(() => {
        setVendors([]);
        setFiltering(true);
    }, [
        debouncedColumnFilters.tenant_name,
        debouncedColumnFilters.user_id,
        debouncedColumnFilters.doc_id,
        debouncedColumnFilters.vendor_id,
        debouncedColumnFilters.vendor_code,
        debouncedColumnFilters.vendor_type,
        debouncedColumnFilters.vendor_name,
        debouncedColumnFilters.vendor_input_source,
        debouncedColumnFilters.created_at,
        debouncedColumnFilters.stage,
        debouncedColumnFilters.status,
    ]);

    // Load data on component mount and when dependencies change
    useEffect(() => {
        const initializeFilters = async () => {
            await Promise.all([
                fetchAllStatusValues(),
                fetchAllStageValues(),
                fetchAllInputSourceValues()
            ]);

            fetchVendors();
            fetchSummaryStats();
        };

        initializeFilters();
        // 300 ms debounce settles (debouncedColumnFilters) to avoid race conditions.
    }, [user, token, page, pageSize, sortField, sortAsc, debouncedColumnFilters, searchTerm, searchField, appliedFilters, fetchAllStatusValues, fetchAllStageValues, fetchAllInputSourceValues, isDefaultDateRange]);

    // Update status counts when filters change
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
        appliedFilters.vendor_input_source,
        columnFilters.tenant_name,
        columnFilters.user_id,
        columnFilters.doc_id,
        columnFilters.vendor_id,
        columnFilters.vendor_code,
        columnFilters.vendor_type,
        columnFilters.vendor_name,
        columnFilters.vendor_input_source,
        columnFilters.created_at,
        columnFilters.stage,
        columnFilters.status,
        searchTerm,
        searchField,
        isDefaultDateRange,
        fetchStatusCounts
    ]);

    const filteredRequests = useMemo(() => {
        let result = [...vendors];

        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            result = result.filter((req) => {
                switch (searchField) {
                    case 'vendor_code':
                        return req.vendor_code?.toLowerCase().includes(searchLower);
                    case 'vendor_name':
                        return req.vendor_name?.toLowerCase().includes(searchLower);
                    case 'vendor_type':
                        return req.vendor_type?.toLowerCase().includes(searchLower);
                    case 'user_id':
                        return req.user_name?.toLowerCase().includes(searchLower);
                    case 'doc_id': {
                        if (!req.file_name) return false;
                        const base = req.file_name.split('_')[0];
                        return base && base.toLowerCase().includes(searchLower);
                    }
                    case 'status':
                        return req.status?.toLowerCase().includes(searchLower);
                    case 'all':
                    default:
                        return (
                            req.vendor_code?.toLowerCase().includes(searchLower) ||
                            req.vendor_name?.toLowerCase().includes(searchLower) ||
                            req.vendor_type?.toLowerCase().includes(searchLower) ||
                            req.vendor_id?.toString().includes(searchLower) ||
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
    }, [vendors, searchTerm, searchField]);

    const getSortIcon = (columnKey) => {
        if (sortField !== columnKey) {
            return <ChevronsUpDown size={14} className="text-gray-400" />;
        }
        return sortAsc ?
            <ChevronUp size={14} className="text-indigo-600" /> :
            <ChevronDown size={14} className="text-indigo-600" />;
    };

    // Hard reset — clears everything and reinstates the 1-month default
    const handleClearFilters = () => {
        setTempFilters({ from_date: '', to_date: '', status: '', stage: '', vendor_input_source: '' });
        setAppliedFilters({ from_date: '', to_date: '', status: '', stage: '', vendor_input_source: '' });
        setSearchTerm('');
        setColumnFilters({});
        if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
        setDebouncedColumnFilters({});
        setIsDefaultDateRange(true);
        setPage(1);
    };

    const applyFilters = () => {
        setAppliedFilters({ ...tempFilters });
        setShowAdvancedFilter(false);
        setPage(1);
    };

    // Advanced Filter Panel event handlers
    const handleApplyFilters = () => {
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

    const removeFilter = (filterKey) => {
        setAppliedFilters(prev => ({ ...prev, [filterKey]: '' }));
        setTempFilters(prev => ({ ...prev, [filterKey]: '' }));
        setPage(1);
    };

    const activeFilterCount = Object.entries(appliedFilters).filter(([key, val]) => val !== '').length;

    const areColumnFiltersActive = Object.values(columnFilters).some(val => val !== '');

    // hasNonDefaultFilters — don't count fields still at their known default values
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

    const totalActiveFilters = activeFilterCount + (areColumnFiltersActive ? 1 : 0);
    const totalRequests = totalCount;

    const getUniqueValues = (field) => {
        return [...new Set(vendors.map((item) => item[field]).filter(Boolean))];
    };

    // Fetch all vendors without pagination for export
    const fetchAllVendorsForExport = async () => {
        if (!user || !token || !user.role) return [];

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact'
                }
            };

            let apiUrl = `/api/v1/tables/ap_vendors?select=*,ap_tenants(tenant_name),ap_users(user_name)`;
            apiUrl += buildRoleFilter();

            // Sorting
            let dbSortField = sortField;
            if (sortField === 'tenant_name') dbSortField = 'tenant_id';
            const orderDirection = sortAsc ? 'asc' : 'desc';
            apiUrl += `&order=${dbSortField}.${orderDirection}`;

            // Column filters for export use raw columnFilters
            Object.entries(columnFilters).forEach(([key, value]) => {
                if (value) {
                    const fv = encodeURIComponent(value);
                    switch (key) {
                        case 'vendor_id':
                            apiUrl += /^\d+$/.test(value) ? `&vendor_id=eq.${fv}` : `&vendor_id=ilike.*${fv}*`;
                            break;
                        case 'tenant_name': break; // client-side
                        case 'vendor_code': apiUrl += `&vendor_code=ilike.*${fv}*`; break;
                        case 'vendor_type': apiUrl += `&vendor_type=ilike.*${fv}*`; break;
                        case 'vendor_name': apiUrl += `&vendor_name=ilike.*${fv}*`; break;
                        case 'doc_id': break; // client-side
                        case 'user_id': break; // client-side
                        case 'vendor_input_source': apiUrl += `&vendor_input_source=ilike.*${fv}*`; break;
                        case 'created_at':
                            try {
                                const startDate = new Date(value); startDate.setHours(0, 0, 0, 0);
                                const endDate = new Date(value); endDate.setHours(23, 59, 59, 999);
                                apiUrl += `&created_at=gte.${startDate.toISOString()}&created_at=lte.${endDate.toISOString()}`;
                            } catch (e) { /* noop */ }
                            break;
                        case 'stage': apiUrl += `&stage=ilike.*${fv}*`; break;
                        case 'status': apiUrl += `&status=ilike.*${fv}*`; break;
                    }
                }
            });

            apiUrl = applyDateRangeParams(apiUrl, appliedFilters, isDefaultDateRange);

            if (appliedFilters.stage) apiUrl += `&stage=ilike.*${encodeURIComponent(appliedFilters.stage)}*`;
            if (appliedFilters.status) apiUrl += `&status=ilike.*${encodeURIComponent(appliedFilters.status)}*`;
            if (appliedFilters.vendor_input_source) apiUrl += `&vendor_input_source=ilike.*${encodeURIComponent(appliedFilters.vendor_input_source)}*`;

            const response = await axios.get(apiUrl, config);

            if (response.status === 200) {
                // Batch fetch file_path
                const exportDocIds = [...new Set(response.data.map(v => v.doc_id).filter(Boolean))];
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

                const transformedData = response.data.map(vendor => {
                    const filePath = exportDocMap[vendor.doc_id] || '';
                    const tenantName = vendor.ap_tenants ? vendor.ap_tenants.tenant_name : null;
                    const userName = vendor.ap_users ? vendor.ap_users.user_name : null;

                    let processedErrorDesc = vendor.error_desc;
                    if (vendor.error_desc) {
                        if (typeof vendor.error_desc === 'object' && vendor.error_desc.value) {
                            try {
                                const p = JSON.parse(vendor.error_desc.value);
                                processedErrorDesc = p.Note && p.Error ? `Note: ${p.Note} | Error: ${p.Error}` : p.Note || p.Error || JSON.stringify(p);
                            } catch (e) { processedErrorDesc = vendor.error_desc.value; }
                        } else if (typeof vendor.error_desc === 'string') {
                            try {
                                const p = JSON.parse(vendor.error_desc);
                                processedErrorDesc = p.Note && p.Error ? `Note: ${p.Note} | Error: ${p.Error}` : p.Note || p.Error || JSON.stringify(p);
                            } catch (e) { processedErrorDesc = vendor.error_desc; }
                        } else {
                            processedErrorDesc = JSON.stringify(vendor.error_desc);
                        }
                    }

                    return {
                        ...vendor,
                        tenant_name: tenantName || '',
                        user_name: userName || '',
                        file_path: filePath,
                        file_name: formatFileName(filePath),
                        error_desc: processedErrorDesc,
                    };
                });

                // Apply client-side filters for export
                let filteredData = [...transformedData];
                if (columnFilters.doc_id && columnFilters.doc_id.trim() !== '') {
                    const fileNameSearch = columnFilters.doc_id.trim().toLowerCase();
                    filteredData = filteredData.filter((item) => {
                        if (!item.file_name) return false;
                        const base = item.file_name.split('_')[0];
                        return base && base.toLowerCase().includes(fileNameSearch);
                    });
                }
                if (columnFilters.tenant_name && columnFilters.tenant_name.trim() !== '') {
                    const tenantSearch = columnFilters.tenant_name.trim().toLowerCase();
                    filteredData = filteredData.filter(item =>
                        item.tenant_name && item.tenant_name.trim() &&
                        item.tenant_name.toLowerCase().includes(tenantSearch)
                    );
                }
                if (columnFilters.user_id && columnFilters.user_id.trim() !== '') {
                    const userSearch = columnFilters.user_id.trim().toLowerCase();
                    filteredData = filteredData.filter(item =>
                        item.user_name && item.user_name.trim() &&
                        item.user_name.toLowerCase().includes(userSearch)
                    );
                }

                return filteredData;
            } else {
                return [];
            }
        } catch (error) {
            return [];
        }
    };

    const downloadExcel = async () => {
        setExportLoading(true);

        const exportButton = document.querySelector('[data-export-button]');
        if (exportButton) {
            exportButton.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Exporting...';
            exportButton.disabled = true;
        }

        try {
            const allVendors = await fetchAllVendorsForExport();

            const exportData = await Promise.all(allVendors.map(async (req, index) => {
                const rowData = { 'S.No': index + 1 };

                for (const col of selectedExportColumns.filter(col => col.selected && col.key !== 'actions')) {
                    switch (col.key) {
                        case 'vendor_id':
                            rowData['ID'] = req.vendor_id || 'N/A';
                            break;
                        case 'tenant_name':
                            if (user.role === 'super_admin') {
                                rowData['Tenant'] = req.tenant_name || 'N/A';
                            }
                            break;
                        case 'vendor_code':
                            rowData['Vendor Code'] = req.vendor_code || 'N/A';
                            break;
                        case 'vendor_type':
                            rowData['Vendor Type'] = req.vendor_type || 'N/A';
                            break;
                        case 'vendor_name':
                            rowData['Vendor Name'] = req.vendor_name || 'N/A';
                            break;
                        case 'doc_id':
                            rowData['File Name'] = req.file_path ? formatFileName(req.file_path) : 'N/A';
                            break;
                        case 'user_id':
                            if (user.role === 'super_admin' || user.role === 'tenant_admin' || user.role === 'account_manager') {
                                rowData['User Name'] = req.user_name || 'N/A';
                            }
                            break;
                        case 'stage':
                            rowData['Stage'] = capitalizeStatus(req.stage) || 'N/A';
                            break;
                        case 'status':
                            rowData['Status'] = capitalizeStatus(req.status) || 'N/A';
                            break;
                        case 'vendor_input_source':
                            rowData['Input Source'] = req.vendor_input_source || 'N/A';
                            break;
                        case 'created_at':
                            rowData['Created At'] = req.created_at ? new Date(req.created_at).toLocaleDateString('en-IN') : 'N/A';
                            break;
                        case 'updated_at':
                            rowData['Updated At'] = req.updated_at ? new Date(req.updated_at).toLocaleDateString('en-IN') : 'N/A';
                            break;
                        case 'extracted_data':
                            rowData['Extracted Data'] = req.extracted_data ? JSON.stringify(req.extracted_data, null, 2) : 'N/A';
                            break;
                        case 'extracted_data_history':
                            rowData['Extracted Data History'] = req.extracted_data_history ? JSON.stringify(req.extracted_data_history, null, 2) : 'N/A';
                            break;
                        case 'error_desc': {
                            let errorDescValue = 'N/A';
                            if (req.error_desc) {
                                if (typeof req.error_desc === 'object' && req.error_desc.value) {
                                    try {
                                        const p = JSON.parse(req.error_desc.value);
                                        errorDescValue = p.Note && p.Error ? `Note: ${p.Note} | Error: ${p.Error}` : p.Note || p.Error || JSON.stringify(p);
                                    } catch (e) { errorDescValue = req.error_desc.value; }
                                } else if (typeof req.error_desc === 'string') {
                                    try {
                                        const p = JSON.parse(req.error_desc);
                                        errorDescValue = p.Note && p.Error ? `Note: ${p.Note} | Error: ${p.Error}` : p.Note || p.Error || JSON.stringify(p);
                                    } catch (e) { errorDescValue = req.error_desc; }
                                } else {
                                    errorDescValue = JSON.stringify(req.error_desc);
                                }
                            }
                            rowData['Error Description'] = errorDescValue;
                            break;
                        }
                        case 'comments':
                            rowData['Comments'] = req.comments || 'N/A';
                            break;
                        case 'created_by':
                            rowData['Created By'] = req.created_by || 'N/A';
                            break;
                        case 'updated_by':
                            rowData['Updated By'] = req.updated_by || 'N/A';
                            break;
                        case 'page_count': {
                            let pageCount = 'N/A';
                            if (req.doc_id) {
                                try {
                                    const docResponse = await axios.get(
                                        `/api/v1/tables/ap_documents?doc_id=eq.${req.doc_id}&select=page_count`,
                                        { headers: { Authorization: `Bearer ${token}` } }
                                    );
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
                }

                return rowData;
            }));

            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(exportData);

            const columnWidths = [{ wch: 6 }];
            selectedExportColumns
                .filter(col => col.selected && col.key !== 'actions')
                .forEach(col => {
                    switch (col.key) {
                        case 'vendor_id': columnWidths.push({ wch: 10 }); break;
                        case 'tenant_name': if (user.role === 'super_admin') columnWidths.push({ wch: 20 }); break;
                        case 'vendor_code': columnWidths.push({ wch: 16 }); break;
                        case 'vendor_type': columnWidths.push({ wch: 14 }); break;
                        case 'vendor_name': columnWidths.push({ wch: 30 }); break;
                        case 'doc_id': columnWidths.push({ wch: 25 }); break;
                        case 'user_id': if (user.role === 'super_admin' || user.role === 'tenant_admin' || user.role === 'account_manager') columnWidths.push({ wch: 20 }); break;
                        case 'stage': columnWidths.push({ wch: 12 }); break;
                        case 'status': columnWidths.push({ wch: 12 }); break;
                        case 'vendor_input_source': columnWidths.push({ wch: 16 }); break;
                        case 'created_at': columnWidths.push({ wch: 12 }); break;
                        case 'updated_at': columnWidths.push({ wch: 12 }); break;
                        case 'extracted_data': columnWidths.push({ wch: 30 }); break;
                        case 'error_desc': columnWidths.push({ wch: 25 }); break;
                        case 'comments': columnWidths.push({ wch: 30 }); break;
                        case 'created_by': columnWidths.push({ wch: 20 }); break;
                        case 'updated_by': columnWidths.push({ wch: 20 }); break;
                        case 'extracted_data_history': columnWidths.push({ wch: 30 }); break;
                        case 'page_count': columnWidths.push({ wch: 12 }); break;
                    }
                });

            worksheet['!cols'] = columnWidths;

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

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendor Report');

            const summaryData = [
                { 'Metric': 'Total Vendors', 'Count': totalCount },
                { 'Metric': 'Approved Vendors', 'Count': summaryStats.totalApproved },
                { 'Metric': 'Pending Vendors', 'Count': summaryStats.totalPending },
                { 'Metric': 'Rejected Vendors', 'Count': summaryStats.totalRejected },
                { 'Metric': '', 'Count': '' },
                { 'Metric': 'Report Generated On', 'Count': new Date().toLocaleString('en-IN') },
                { 'Metric': 'Generated By', 'Count': user.username || user.email || 'N/A' },
                { 'Metric': 'Total Records Exported', 'Count': exportData.length }
            ];

            const summarySheet = XLSX.utils.json_to_sheet(summaryData);
            summarySheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

            const currentDate = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
            const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '-');
            const filename = `Vendor_Report_${currentDate}_${currentTime}.xlsx`;

            XLSX.writeFile(workbook, filename);
        } finally {
            setExportLoading(false);

            if (exportButton) {
                exportButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-down"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 12v6"/><path d="m9 15 3-3 3 3"/></svg> <span class="hidden sm:inline">Export</span>';
                exportButton.disabled = false;
            }
        }
    };

    const viewVendorDetails = (vendor) => {
        setSelectedVendor(vendor);
        setShowDetailModal(true);
    };

    // Define columns for TableComponent
    const columns = useMemo(() => {
        const baseColumns = [];

        if (user.role === 'super_admin') {
            baseColumns.push({
                key: 'tenant_name',
                header: 'Tenant Name',
                sortable: false,
                filterable: true,
                width: '120px',
                render: (item) => {
                    const name = item.tenant_name;
                    return name && name !== 'N/A' ? (
                        <div className="truncate" title={name}>{name}</div>
                    ) : null;
                },
            });
        }

        if (user.role === 'super_admin' || user.role === 'tenant_admin' || user.role === 'account_manager') {
            baseColumns.push({
                key: 'user_id',
                header: 'User Name',
                filterPlaceholder: 'User Name',
                sortable: false,
                filterable: true,
                width: '150px',
                render: (item) => {
                    const userName = item.user_name;
                    return userName && userName !== 'N/A' ? (
                        <div className="truncate" title={userName}>{userName}</div>
                    ) : null;
                },
            });
        }

        baseColumns.push(
            {
                key: 'vendor_code',
                header: 'Vendor Code',
                sortable: true,
                filterable: true,
                width: '120px',
            },
            {
                key: 'vendor_type',
                header: 'Vendor Type',
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
                sortable: false,
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
            },
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
            }
        );

        return baseColumns;
    }, [user.role, allStageValues, allStatusValues]);

    if (!workflowLoading && workflowConfigMissing && user?.role !== 'super_admin') {
        return <WorkflowMissing pageName="Vendor Reports" />;
    }

    return (
        <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 font-[poppins] text-xs ${showAdvancedFilter || showDetailModal ? "overflow-y-hidden" : "overflow"
            }`}>
            {loading && !filtering && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                        <p className="text-xs font-medium text-gray-700">Loading vendor data...</p>
                    </div>
                </div>
            )}

            <div className={`mx-auto max-w-auto flex flex-col gap-4`}>
                <div className="flex flex-wrap items-center gap-y-2" data-tour="reports-header">
                    <div className="flex-shrink-0">
                        <h1 className="text-base font-semibold text-gray-900">Vendor Reports</h1>
                        <p className="mt-1 text-xs text-gray-600">Track and manage all vendor submissions with extracted data</p>
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

                                {showNotePopover && (
                                    <div data-popover="note" className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-64 sm:w-72 bg-white border border-blue-100 rounded-lg shadow-xl p-3.5 text-xs">
                                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-blue-100 rotate-45 block" />
                                        <p className="flex items-center gap-1 font-medium text-blue-700 mb-1.5">
                                            <Info size={12} /> Default Date Filter Active
                                        </p>
                                        <p className="text-gray-600 leading-relaxed">
                                            Vendors are currently filtered to the{' '}
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
                                        to_date: appliedFilters.to_date || getTodayDate(),
                                    }));
                                } else {
                                    setTempFilters(appliedFilters);
                                }
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

                {/* Vendor Stats Cards — Total / Pending / Completed / Rejected (mirrors VendorDashboard) */}
                {/* <div className="rounded-lg">
                    <BalancedCardGrid
                        items={[
                            {
                                id: 'vs-total',
                                label: 'Total Vendors',
                                value: vendorStatsLoading ? '—' : (vendorStats?.total ?? 0),
                                color: VENDOR_STATS_COLORS.total,
                                statusType: 'total',
                            },
                            {
                                id: 'vs-pending',
                                label: 'Pending',
                                value: vendorStatsLoading ? '—' : (vendorStats?.pending ?? 0),
                                color: VENDOR_STATS_COLORS.pending,
                                statusType: 'pending',
                                isPending: true,
                            },
                            {
                                id: 'vs-completed',
                                label: 'Completed',
                                value: vendorStatsLoading ? '—' : (vendorStats?.completed ?? 0),
                                color: VENDOR_STATS_COLORS.completed,
                                statusType: 'completed',
                            },
                            {
                                id: 'vs-rejected',
                                label: 'Rejected',
                                value: vendorStatsLoading ? '—' : (vendorStats?.rejected ?? 0),
                                color: VENDOR_STATS_COLORS.rejected,
                                statusType: 'rejected',
                            },
                        ]}
                        renderCard={(stat) => {
                            if (stat.isPending) {
                                return (
                                    <VendorStatsPendingCard
                                        key={stat.id}
                                        value={stat.value}
                                        color={stat.color}
                                        loading={vendorStatsLoading}
                                        pendingBreakdown={vendorStats?.pendingBreakdown ?? {}}
                                    />
                                );
                            }
                            return (
                                <StatusCard
                                    key={stat.id}
                                    label={stat.label}
                                    value={stat.value}
                                    color={stat.color}
                                    statusType={stat.statusType}
                                />
                            );
                        }}
                        maxCardsPerRow={7}
                    />
                </div> */}

                {/* Approval Rate / Rejection Rate / Avg Completion Time KPIs */}
                <VendorKPIPanel stats={vendorStats} loading={vendorStatsLoading} />

                {/* Table */}
                <TableComponent
                    data={vendors}
                    columns={columns}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortField={sortField}
                    setSortField={setSortField}
                    sortAsc={sortAsc}
                    setSortAsc={setSortAsc}
                    page={page}
                    setPage={setPage}
                    emptyMessage={loading ? "Loading vendors..." : "No vendors found matching your criteria."}
                    totalCount={totalCount}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    filtering={filtering}
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

                {showDetailModal && <ViewInvoiceDetailDialog invoiceId={selectedVendor ? selectedVendor.vendor_id : null} tenant_id={user.tenantId} openDialog={showDetailModal} setOpenDialog={setShowDetailModal} />}

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
                                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-2 rounded-t-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white rounded-full p-2">
                                            <FileDown size={14} className="text-indigo-600" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-white">Export to Excel</h3>
                                    </div>
                                </div>

                                <div className="p-4">
                                    <p className="text-xs text-gray-700 mb-2">
                                        Select the columns you want to include in the export:
                                    </p>

                                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 mb-2">
                                        <div className="flex flex-wrap">
                                            {selectedExportColumns.map((col, index) => (
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
                                                    <li>• All filtered vendor data</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

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
export default VendorReports;
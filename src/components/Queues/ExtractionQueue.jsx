import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    ArrowUpDown
} from 'lucide-react';
import { useSelector } from 'react-redux';
import TableComponent from '../common/TableComponent';
import StageDisplay from '../common/StageDisplay';
import StatusBadge from '../common/StatusBadge';
import { canUserView, canUserDelete } from '../../permissions';
import { toast, ToastContainer } from 'react-toastify';
import { encryptId } from '../../utils/cryptoUtils';
import axios from '../../utils/authInterceptor';
import { formatFileName, normalizeFileSearch } from '../../utils/fileUtils';
import { apiBaseUrl } from '../../config/apiConfig';
import { formatDate, formatDateTime, getDefaultDateRangeFilter, getOneMonthAgoDate, getTodayDate, isValidDateFormat } from '../../utils/dateUtils';
import ColorLegend from '../common/ColorLegend';
import MessageDisplay from '../common/MessageDisplay';
import MessageCell from '../common/MessageCell';
import AdvancedFilterPanel from '../common/AdvancedFilterPanel';
import Button from '../common/Button';



// ─── PER-FIELD CONFLICT MAPS ──────────────────────────────────────────────────
// Column filter key → advanced filter keys to clear when that column is committed
const COLUMN_TO_ADVANCED_CONFLICT_EQ = {
    status:       ['status'],
    vendor:       ['vendor'],
    total_amount: ['amount_min', 'amount_max'],
    created_at:   ['from_date', 'to_date'],
    po_number:    ['po_number'],
    stage:        ['stage'],
};

// Advanced filter key → column filter keys to clear when that advanced field is applied
const ADVANCED_TO_COLUMN_CONFLICT_EQ = {
    status:     ['status'],
    vendor:     ['vendor'],
    amount_min: ['total_amount'],
    amount_max: ['total_amount'],
    from_date:  ['created_at'],
    to_date:    ['created_at'],
    po_number:  ['po_number'],
    stage:      ['stage'],
};
// ─────────────────────────────────────────────────────────────────────────────


const InvoiceNumberCell = ({ item, activeTooltipId, onToggle }) => {
    const isTooltipOpen = activeTooltipId === item.id;
    const tooltipRef = useRef(null);
    const iconRef = useRef(null);

    // --- Data Logic: Extraction & Grouping ---
    const errorData = item.error_desc;

    const groupedMessages = useMemo(() => {
        const groups = { error: [], warning: [], note: [], success: [], other: [] };
        if (!errorData) return groups;

        Object.entries(errorData).forEach(([key, value]) => {
            const lowerKey = key.toLowerCase();
            const pair = { key, value };

            if (lowerKey.startsWith('error')) groups.error.push(pair);
            else if (lowerKey.startsWith('warning')) groups.warning.push(pair);
            else if (lowerKey.includes('note')) groups.note.push(pair);
            else if (lowerKey.startsWith('success')) groups.success.push(pair);
            else groups.other.push(pair);
        });

        // Sort error keys numerically (Error, Error_1, Error_2)
        groups.error.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));

        // Sort warning keys numerically (Warning, Warning_1, Warning_2)
        groups.warning.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));

        // Sort success keys numerically (Success, Success_1, Success_2)
        groups.success.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));

        // Sort note keys numerically (Note, Note_1, Note_2)
        groups.note.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));

        // Sort other keys numerically (for any other numbered keys)
        groups.other.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' }));

        return groups;
    }, [errorData]);

    const getIconColor = () => {
        if (groupedMessages.error.length > 0) return 'text-red-600';
        if (groupedMessages.warning.length > 0) return 'text-orange-600';
        if (groupedMessages.success.length > 0) return 'text-green-600';
        return 'text-yellow-600';
    };

    // --- Smart Positioning Logic with Boundary Detection ---
    useEffect(() => {
        if (isTooltipOpen && iconRef.current && tooltipRef.current) {
            requestAnimationFrame(() => {
                const tooltip = tooltipRef.current;
                const icon = iconRef.current;

                if (tooltip && icon) {
                    const iconRect = icon.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const margin = 16;

                    // 1. Horizontal Positioning (Clamped to screen edges)
                    let x = iconRect.left + (iconRect.width / 2);
                    const halfWidth = tooltipRect.width / 2;

                    if (x - halfWidth < margin) {
                        x = halfWidth + margin;
                    } else if (x + halfWidth > viewportWidth - margin) {
                        x = viewportWidth - halfWidth - margin;
                    }

                    // 2. Vertical Positioning (Auto-flip if off-screen)
                    const spaceAbove = iconRect.top;
                    const tooltipHeight = tooltipRect.height;

                    let y;
                    let transformY;

                    if (spaceAbove < tooltipHeight + 40) {
                        // Not enough space above -> Show BELOW icon
                        y = iconRect.bottom + 12;
                        transformY = '0%'; // Slide from top down
                        tooltip.style.setProperty('--translate-start', '-10px');
                    } else {
                        // Enough space -> Show ABOVE icon
                        y = iconRect.top - 12;
                        transformY = '-100%'; // Anchor bottom
                        tooltip.style.setProperty('--translate-start', '10px');
                    }

                    tooltip.style.left = `${x}px`;
                    tooltip.style.top = `${y}px`;
                    tooltip.style.transform = `translate(-50%, ${transformY})`;
                }
            });
        }
    }, [isTooltipOpen]);

    // --- Click Outside Handler ---
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (tooltipRef.current && !tooltipRef.current.contains(e.target) &&
                iconRef.current && !iconRef.current.contains(e.target)) {
                onToggle(null);
            }
        };
        if (isTooltipOpen) {
            setTimeout(() => window.addEventListener('click', handleClickOutside), 0);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isTooltipOpen, onToggle]);

    const handleIconClick = (e) => {
        e.stopPropagation();
        onToggle(isTooltipOpen ? null : item.id);
    };

    return (
        <div className="flex items-center justify-between gap-2 relative w-full">
            <span
                className="flex-1 overflow-hidden text-ellipsis invoice-number-text"
                title={item.invoice_number || ''}
            >
                {item.invoice_number || '—'}
            </span>

            {errorData && (
                <div className="relative inline-block flex-shrink-0">
                    <div ref={iconRef}>
                        <Info
                            size={16}
                            className={`cursor-pointer transition-all duration-300 hover:scale-125 ${getIconColor()} ${isTooltipOpen ? 'opacity-100 scale-110' : 'opacity-70'}`}
                            onClick={handleIconClick}
                        />
                    </div>
                </div>
            )}

            {/* Modal / Tooltip */}
            <div
                ref={tooltipRef}
                className={`fixed bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-200 z-[100000] w-[400px] max-w-[calc(100vw-32px)] max-h-[200px] overflow-hidden flex flex-col transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${isTooltipOpen
                    ? 'visible opacity-100 scale-100'
                    : 'invisible opacity-0 scale-95 pointer-events-none'
                    }`}
                style={{
                    whiteSpace: 'normal',
                    wordWrap: 'break-word',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-3.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <div className={`p-1 rounded-md bg-white shadow-sm ${getIconColor()}`}>
                            <Info size={14} />
                        </div>
                        Invoice Messages
                    </h4>
                    <button
                        onClick={() => onToggle(null)}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="overflow-y-auto p-4 space-y-3 flex-1 scrollbar-thin scrollbar-thumb-gray-200">
                    {/* Errors */}
                    {groupedMessages.error.map(({ value }, index) => (
                        <div key={`err-${index}`} className="bg-red-50/50 border border-red-100 p-3 rounded-lg">
                            <div className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-red-600 mb-0.5">Error</p>
                                    <p className="text-xs text-red-900 leading-relaxed">{value}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Warnings */}
                    {groupedMessages.warning.map(({ value }, index) => (
                        <div key={`warn-${index}`} className="bg-orange-50/50 border border-orange-100 p-3 rounded-lg">
                            <div className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-orange-600 mb-0.5">Warning</p>
                                    <p className="text-xs text-orange-900 leading-relaxed">{value}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Notes */}
                    {groupedMessages.note.map(({ value }, index) => (
                        <div key={`note-${index}`} className="bg-yellow-50/50 border border-yellow-100 p-3 rounded-lg">
                            <div className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-yellow-600 mb-0.5">Note</p>
                                    <p className="text-xs text-yellow-900 leading-relaxed">{value}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Success */}
                    {groupedMessages.success.map(({ value }, index) => (
                        <div key={`success-${index}`} className="bg-green-50/50 border border-green-100 p-3 rounded-lg">
                            <div className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-green-600 mb-0.5">Success</p>
                                    <p className="text-xs text-green-900 leading-relaxed">{value}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Other messages */}
                    {groupedMessages.other.map(({ key, value }, index) => {
                        const lowerKey = key.toLowerCase();
                        let bgColor, borderColor, textColor, dotColor;

                        if (lowerKey.startsWith('warning')) {
                            bgColor = 'bg-orange-50/50';
                            borderColor = 'border-orange-100';
                            textColor = 'text-orange-900';
                            dotColor = 'bg-orange-500';
                        } else if (lowerKey.startsWith('success')) {
                            bgColor = 'bg-green-50/50';
                            borderColor = 'border-green-100';
                            textColor = 'text-green-900';
                            dotColor = 'bg-green-500';
                        } else {
                            bgColor = 'bg-gray-50/50';
                            borderColor = 'border-gray-100';
                            textColor = 'text-gray-900';
                            dotColor = 'bg-gray-500';
                        }

                        return (
                            <div key={`other-${index}`} className={`${bgColor} ${borderColor} p-3 rounded-lg`}>
                                <div className="flex items-start gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                    <div className="flex-1">
                                        <p className={`text-[10px] uppercase tracking-wider font-bold mb-0.5 ${textColor.replace('text-', 'text-')}`}>{key}</p>
                                        <p className={`text-xs ${textColor}`}>{value}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-right">
                    <span className="text-[10px] text-gray-400 italic font-medium">Click outside to dismiss</span>
                </div> */}
            </div>
        </div>
    );
};


const ExtractionQueue = () => {
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

        const po_number = searchParams.get('po_number');
        if (po_number) filters.po_number = po_number;

        const invoice_date = searchParams.get('invoice_date');
        if (invoice_date) filters.invoice_date = invoice_date;

        const total_amount = searchParams.get('total_amount');
        if (total_amount) filters.total_amount = total_amount;

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

        const po_number = searchParams.get('adv_po_number');
        filters.po_number = po_number || '';

        return filters;
    };

    const [files, setFiles] = useState([]);
    const [page, setPage] = useState(getInitialPage());
    const [pageSize, setPageSize] = useState(getInitialPageSize()); // Added for pagination
    const [totalCount, setTotalCount] = useState(0); // Added for pagination
    const [duplicateBillCount, setDuplicateBillCount] = useState(0); // Added for color legend - full dataset count
    const [errorCount, setErrorCount] = useState(0);   // Full-dataset error count for color legend
    const [warningCount, setWarningCount] = useState(0); // Full-dataset warning count for color legend
    const [successCount, setSuccessCount] = useState(0); // Full-dataset success count for color legend
    const [sortField, setSortField] = useState(getInitialSortField());
    const [sortAsc, setSortAsc] = useState(getInitialSortAsc());
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [showSortOptions, setShowSortOptions] = useState(false); // New state for sort options
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); // Added refreshing state
    const [refreshTrigger, setRefreshTrigger] = useState(0); // Added refresh trigger
    const [userRole, setUserRole] = useState(null);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

    const [invoiceToDelete, setInvoiceToDelete] = useState(null);
    const [activeTooltipId, setActiveTooltipId] = useState(null);
    const [showNotePopover, setShowNotePopover] = useState(false);
    const noteRef = useRef(null);

    // New states for partial loading
    const [updatingResults, setUpdatingResults] = useState(false); // New state for updating results indicator
    const [initialLoad, setInitialLoad] = useState(true); // New state to track initial load

    // New state for storing all unique status values from the database
    const [allStatusValues, setAllStatusValues] = useState([]);

    // New states for storing all unique input_source and docType values from the database
    const [allVendors, setAllVendors] = useState([]);

    // Get user from Redux store
    const user = useSelector(state => state.auth.user);
    const token = user?.token;

    useEffect(() => {
        if (user) {
            setUserRole(user.role);
        }
    }, [user]);

    const canViewInvoiceList = canUserView(userRole, '/invoice_queue');
    const canDeleteInvoice = canUserDelete(userRole, 'invoice_list_delete');

    const deletePermissionDeniedMessage = "You do not have permission to delete invoices.";


    const [columnFilters, setColumnFilters] = useState({
        id: '',
        invoice_number: '',
        vendor: '',
        created_at: '',
        status: '',
        po_number: '',
        invoice_date: '',
        total_amount: '',
        userName: '',
        tenantName: '',
        file_name: '',
        ...getInitialColumnFilters()
    });

    // Ref for debouncing filter updates
    const filterTimeoutRef = useRef(null);

    // FIX: Ref to track which filter mode is active ("column", "advanced", or null)
    // Prevents filter clearing cascade when switching between filter types
    const filterModeRef = useRef(null);

    // Initialize debounced filters (must exist before useEffect)
    const [debouncedColumnFilters, setDebouncedColumnFilters] = useState({
        id: '',
        invoice_number: '',
        vendor: '',
        created_at: '',
        status: '',
        po_number: '',
        invoice_date: '',
        total_amount: '',
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
        po_number: '',
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
    // Becomes false once the user explicitly applies dates via the Advanced Filter panel.
    // Resets to true when the user clears all filters.
    // Also persisted in the URL so that Back-navigation from the editor restores it correctly.
    const getInitialIsDefaultDateRange = () => {
        const urlParam = searchParams.get('defaultDateRange');
        if (urlParam === 'false') return false;
        const initialAdv = getInitialAdvancedFilters();
        return !initialAdv.from_date && !initialAdv.to_date;
    };
    const [isDefaultDateRange, setIsDefaultDateRange] = useState(getInitialIsDefaultDateRange);

    const navigate = useNavigate();

    // Ref to track if component has mounted (prevents URL update on initial render)
    const hasMountedRef = useRef(false);



    // Initialize debouncedColumnFilters on mount to match columnFilters
    useEffect(() => {
        setDebouncedColumnFilters(columnFilters);
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

    // Update URL parameters when state changes (skip on initial mount to prevent cascade)
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

        // Persist isDefaultDateRange so Back-navigation from the editor restores it correctly
        if (!isDefaultDateRange) params.set('defaultDateRange', 'false');

        // Add advanced filters only if they have been applied
        if (Object.values(appliedFilters).some(v => v)) {
            Object.entries(appliedFilters).forEach(([key, value]) => {
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
        }

        // Only update URL if there are params to set
        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            // Clear URL params if no filters are active
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, columnFilters, appliedFilters, isDefaultDateRange, setSearchParams]);

    // Debounce column filters to prevent rapid API calls
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

    // Per-field conflict resolution is now handled directly in handleColumnFilterCommit
    // and handleApplyFilters — the blanket-clearing useEffect has been removed.

    // ─── DROPDOWN OPTIONS: Fetch ALL unique values once on mount ──────────────────
    // Populated independently of the main fetch so that applying a status filter
    // does NOT remove other statuses from the dropdown.
    const dropdownFetchedRef = useRef(false);

    const fetchDropdownOptions = useCallback(async () => {
        if (!user || !token) return;

        // ap_invoices: only show Pending/Hold (same base filter as the queue)
        // Also select error_desc so we can compute full-dataset color-legend counts
        let url = `/api/v1/tables/ap_invoices?select=status,error_desc&status=in.(Pending,Hold)&stage=eq.Review`;

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
                if (s) {
                    const lower = s.toLowerCase();
                    if (lower === 'pending' || lower === 'hold') {
                        statusMap.set(lower, lower === 'pending' ? 'Pending' : 'Hold');
                    }
                }
            });
            setAllStatusValues(Array.from(statusMap.values()));

            // NOTE: Color-legend counts are now computed inside fetchInvoices via a
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

    // Added handleRefresh function
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            // Increment refresh trigger to force re-fetch
            setRefreshTrigger(prev => prev + 1);
            // Small delay to show refresh animation
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    }, []);


    useEffect(() => {
        const fetchInvoices = async () => {
            if (!canViewInvoiceList || !user || !token) {
                // User does not have permission, is not logged in, or token is missing to view Invoice List.
                setLoading(false);
                return;
            }

            // Only show full page loading spinner on initial load
            if (initialLoad) {
                setLoading(true);
            }
            setUpdatingResults(true); // Always show updating results indicator

            // Check if client-side filtering is needed (file_name, userName, or tenantName filters)
            const needsClientSideFiltering =
                (columnFilters.file_name && columnFilters.file_name.trim()) ||
                (columnFilters.userName && columnFilters.userName.trim()) ||
                (columnFilters.tenantName && columnFilters.tenantName.trim());

            // Fields that require client-side natural sort:
            //   1. Embedded/joined table columns — PostgREST ORDER BY doesn't support them directly.
            //   2. Alphanumeric text fields (invoice_number, vendor, po_number) — PostgreSQL sorts
            //      these lexicographically so "INV-99" sorts between "INV-998" and "INV-989" rather
            //      than after "INV-9". A JS localeCompare with { numeric: true } fixes this.
            const needsClientSideSort = [
                'userName', 'tenantName', 'file_name',
                'invoice_number', 'vendor', 'po_number',
            ].includes(sortField);

            // Combined flag: fetch ALL rows (no server-side pagination) when either condition is true
            const needsAllRowsFetch = needsClientSideFiltering || needsClientSideSort;

            // Calculate offset
            const offset = (page - 1) * pageSize;

            // ── Build the shared filter suffix ────────────────────────────────────
            // This string is reused by both the paginated main request AND the
            // lightweight legend-counts request so that the ColorLegend always
            // reflects ALL matching rows across every page, not just the current one.

            // --- 1. Base Filter (Hardcoded) ---
            let filterSuffix = `&status=in.(Pending,Hold)&stage=eq.Review`;

            // --- 2. Role-based Filters ---
            if (user.role === 'account_user') {
                if (!user.user_id || !user.tenantId) {
                    setLoading(false);
                    return;
                }
                filterSuffix += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
            } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
                if (!user.user_id || !user.tenantId) {
                    setLoading(false);
                    return;
                }
                filterSuffix += `&tenant_id=eq.${user.tenantId}`;
            }
            // Super admin needs no additional filter

            // --- 3. Column Filters (server-side only; id and file_name are client-side) ---
            Object.entries(columnFilters).forEach(([key, value]) => {
                if (value) {
                    const filterValue = encodeURIComponent(value);
                    switch (key) {
                        case 'id':
                            // Handled client-side (partial match)
                            break;
                        case 'invoice_number':
                            filterSuffix += `&invoice_no=ilike.*${filterValue}*`;
                            break;
                        case 'vendor':
                            filterSuffix += `&vendor_name=ilike.*${filterValue}*`;
                            break;
                        case 'po_number':
                            filterSuffix += `&po_no=ilike.*${filterValue}*`;
                            break;
                        case 'created_at':
                            try {
                                const startOfDay = new Date(value);
                                const endOfDay = new Date(value);
                                endOfDay.setDate(endOfDay.getDate() + 1);
                                filterSuffix += `&created_at=gte.${encodeURIComponent(startOfDay.toISOString())}&created_at=lt.${encodeURIComponent(endOfDay.toISOString())}`;
                            } catch (e) { /* Invalid date */ }
                            break;
                        case 'invoice_date':
                            filterSuffix += `&invoice_date=eq.${value}`;
                            break;
                        case 'status':
                            filterSuffix += `&status=eq.${filterValue}`;
                            break;
                        case 'stage':
                            filterSuffix += `&stage=eq.${filterValue}`;
                            break;
                        case 'total_amount':
                            filterSuffix += `&total_amount=eq.${filterValue}`;
                            break;
                        case 'userName':
                            if (value && value.trim()) {
                                filterSuffix += `&ap_users.user_name=ilike.*${encodeURIComponent(value.trim())}*`;
                            }
                            break;
                        case 'tenantName':
                            if (value && value.trim()) {
                                filterSuffix += `&ap_tenants.tenant_name=ilike.*${encodeURIComponent(value.trim())}*`;
                            }
                            break;
                        case 'file_name':
                            // Handled client-side (formatted name without UUID)
                            break;
                    }
                }
            });

            // --- 4. Advanced Filters + Date Range ---
            if (Object.values(appliedFilters).some(v => v)) {
                if (appliedFilters.from_date && isValidDateFormat(appliedFilters.from_date)) {
                    filterSuffix += `&created_at=gte.${appliedFilters.from_date}T00:00:00.000Z`;
                }
                if (appliedFilters.to_date && isValidDateFormat(appliedFilters.to_date)) {
                    filterSuffix += `&created_at=lte.${appliedFilters.to_date}T23:59:59.999Z`;
                }
                if (appliedFilters.vendor) filterSuffix += `&vendor_name=ilike.*${encodeURIComponent(appliedFilters.vendor)}*`;
                if (appliedFilters.status) filterSuffix += `&status=eq.${encodeURIComponent(appliedFilters.status)}`;
                if (appliedFilters.stage) filterSuffix += `&stage=eq.${encodeURIComponent(appliedFilters.stage)}`;
                if (appliedFilters.po_number) filterSuffix += `&po_no=ilike.*${encodeURIComponent(appliedFilters.po_number)}*`;
                if (appliedFilters.amount_min) filterSuffix += `&total_amount=gte.${encodeURIComponent(appliedFilters.amount_min)}`;
                if (appliedFilters.amount_max) filterSuffix += `&total_amount=lte.${encodeURIComponent(appliedFilters.amount_max)}`;
            } else if (isDefaultDateRange) {
                filterSuffix += getDefaultDateRangeFilter();
            }

            // ── Main paginated URL ──
            // Sorting
            const effectiveSortField = sortField || 'invoice_id';
            const effectiveSortAsc = sortAsc;

            // Map every frontend column key to the PostgREST column for the ORDER clause.
            // Fields that need natural/numeric sort or live in joined tables are routed to
            // invoice_id here and sorted client-side after all rows are fetched.
            let dbSortFieldMapped;
            switch (effectiveSortField) {
                case 'id':           dbSortFieldMapped = 'invoice_id';   break;
                case 'invoice_date': dbSortFieldMapped = 'invoice_date'; break;
                case 'status':       dbSortFieldMapped = 'status';       break;
                case 'created_at':   dbSortFieldMapped = 'created_at';   break;
                // Alphanumeric text fields: PostgreSQL lexicographic sort gives wrong numeric
                // ordering (e.g. "INV-99" between "INV-998" and "INV-989"). Fetch all rows
                // and apply a JS natural sort (localeCompare { numeric: true }) client-side.
                case 'invoice_number':
                case 'vendor':
                case 'po_number':
                // Embedded/joined table columns: PostgREST cannot ORDER BY these directly.
                case 'userName':
                case 'tenantName':
                case 'file_name':    dbSortFieldMapped = 'invoice_id';   break;
                default:             dbSortFieldMapped = effectiveSortField;
            }

            // Single unified ORDER clause — secondary sort on invoice_id ensures stable
            // pagination whenever we are not already sorting by the PK.
            const sortDir = effectiveSortAsc ? 'asc' : 'desc';
            let orderQuery = `${dbSortFieldMapped}.${sortDir}.nullslast`;
            if (effectiveSortField !== 'id') {
                orderQuery += `,invoice_id.desc`;
            }

            // Always embed ap_users and ap_tenants for userName/tenantName display.
            // ap_documents(file_path) is fetched separately via doc_id lookup below — no need to embed.
            const selectEmbeds = ['ap_users(user_name)', 'ap_tenants(tenant_name)', 'error_desc'];

            let invoicesUrl =
                `/api/v1/tables/ap_invoices?select=*,${selectEmbeds.join(',')}` +
                `&order=${orderQuery}` +
                filterSuffix;

            // Pagination — skip when we need all rows for client-side sort or filtering
            if (!needsAllRowsFetch) {
                invoicesUrl += `&limit=${pageSize}&offset=${offset}`;
            }

            // ── Legend-counts URL: same filters, only error_desc, no pagination ──
            // Fetches ALL matching rows across every page so the ColorLegend
            // reflects the full filtered dataset, not just the current page.
            // If filterSuffix references ap_users / ap_tenants columns, those embedded
            // resources must also appear in the select or PostgREST returns error 2007.
            const legendEmbeds = [];
            if (columnFilters.userName && columnFilters.userName.trim()) legendEmbeds.push('ap_users(user_name)');
            if (columnFilters.tenantName && columnFilters.tenantName.trim()) legendEmbeds.push('ap_tenants(tenant_name)');
            const legendSelect = ['error_desc', ...legendEmbeds].join(',');
            const legendCountsUrl =
                `/api/v1/tables/ap_invoices?select=${legendSelect}` + filterSuffix;

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact'
                }
            };

            try {
                // Run both requests in parallel — legend counts are non-blocking
                const [invoicesResponse, legendRes] = await Promise.all([
                    axios.get(invoicesUrl, config),
                    axios.get(legendCountsUrl, { headers: { Authorization: `Bearer ${token}` } }),
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
                            if (ed.Note || ed.note || ed.Note_1)                   acc.duplicate++;
                            if (ed.Error || ed.error)                              acc.error++;
                            if (ed.Warning || ed.warning || ed.Warning_1)          acc.warning++;
                            if (ed.Success || ed.success || ed.Success_1)          acc.success++;
                        } catch (_) { /* skip malformed */ }
                        return acc;
                    },
                    { duplicate: 0, error: 0, warning: 0, success: 0 }
                );
                setDuplicateBillCount(legendCounts.duplicate);
                setErrorCount(legendCounts.error);
                setWarningCount(legendCounts.warning);
                setSuccessCount(legendCounts.success);
                const invoicesData = invoicesResponse.data;

                // Invoices Data

                // Get total count from Content-Range header
                const contentRange = invoicesResponse.headers['content-range'];
                let total = 0;
                if (contentRange) {
                    const match = contentRange.match(/\/(\d+)/);
                    if (match && match[1]) {
                        total = parseInt(match[1], 10);
                    }
                }
                setTotalCount(total);

                // --- Separate lookup for file_path from ap_documents using doc_id ---
                const docIds = [...new Set(invoicesData.map(inv => inv.doc_id).filter(Boolean))];
                const docMap = {}; // doc_id → file_path

                if (docIds.length > 0) {
                    try {
                        const docsRes = await axios.get(
                            `/api/v1/tables/ap_documents?select=doc_id,file_path&doc_id=in.(${docIds.join(',')})`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        docsRes.data.forEach(d => { docMap[d.doc_id] = d.file_path; });
                    } catch (_) { /* non-fatal — file names will be blank if this fails */ }
                }

                // Format data
                let formatted = invoicesData.map((inv) => {
                    // When sorting by file_name, ap_documents is embedded in the response.
                    // Otherwise, file_path comes from the separate docMap lookup.
                    const filePath = inv.ap_documents?.file_path || docMap[inv.doc_id] || '';

                    const ocrData = inv.extracted_data || {};
                    const vendorName =
                        inv.vendor_name ||
                        ocrData.vendor ||
                        ocrData.Name ||
                        ocrData.businessName ||
                        'Unknown';
                    const invoiceNumber =
                        inv.invoice_no || ocrData.invoiceNumber || ocrData.invoiceId || '—';
                    const totalAmount = parseFloat(
                        inv.total_amount || // Prefer top-level column
                        ocrData.grandTotal ||
                        ocrData.Grand_Total ||
                        ocrData.amount ||
                        ocrData.Amount ||
                        0
                    );
                    const poNumber =
                        inv.po_no || ocrData.poNumber || ocrData.Order_No || '—';
                    const invoiceDate =
                        inv.invoice_date ||
                        ocrData.date ||
                        ocrData.invoiceDate ||
                        ocrData.Invoice_Date ||
                        '';
                    const createdAt = inv.created_at || '';

                    // Extract joined data - use empty strings instead of 'N/A' for proper filtering
                    const userName = inv.ap_users ? inv.ap_users.user_name : '';
                    const tenantName = inv.ap_tenants ? inv.ap_tenants.tenant_name : '';

                    return {
                        id: inv.invoice_id,
                        invoice_number: invoiceNumber,
                        vendor: vendorName,
                        total_amount: totalAmount,
                        po_number: poNumber,
                        invoice_date: invoiceDate,
                        file_path: filePath, // Fetched separately from ap_documents
                        file_name: formatFileName(filePath), // Use the imported utility
                        doc_id: inv.doc_id, // Store document ID for reference
                        created_at: createdAt,
                        status: inv.status || 'unknown',
                        stage: inv.stage || 'New',
                        userName, // Added for display
                        tenantName, // Added for display
                        error_desc: inv.error_desc ? (() => {
                            try {
                                return typeof inv.error_desc.value === 'string'
                                    ? JSON.parse(inv.error_desc.value)
                                    : inv.error_desc.value;
                            } catch (e) {
                                // Error parsing error_desc
                                return typeof inv.error_desc === 'string' 
                                    ? JSON.parse(inv.error_desc) 
                                    : inv.error_desc;
                            }
                        })() : null, // Parse error_desc correctly with error handling
                    };
                });

                // Apply partial client-side ID match
                if (columnFilters.id && columnFilters.id.trim() !== '') {
                    const idSearch = columnFilters.id.trim();
                    formatted = formatted.filter((item) =>
                        String(item.id).includes(idSearch)
                    );
                }

                // Apply client-side file name filter against the full formatted display name (UUID already stripped by formatFileName)
                if (debouncedColumnFilters.file_name && debouncedColumnFilters.file_name.trim() !== '') {
                    const fileNameSearch = normalizeFileSearch(debouncedColumnFilters.file_name).toLowerCase();
                    formatted = formatted.filter((item) => {
                        if (!item.file_name) return false;
                        return item.file_name.toLowerCase().includes(fileNameSearch);
                    });
                }

                // Additional client-side filtering for userName and tenantName as a safety measure
                // If userName filter is applied, filter out rows with empty userName - USING DEBOUNCED FILTERS
                if (debouncedColumnFilters.userName && debouncedColumnFilters.userName.trim()) {
                    formatted = formatted.filter(item =>
                        item.userName && item.userName.trim() &&
                        item.userName.toLowerCase().includes(debouncedColumnFilters.userName.toLowerCase())
                    );
                }

                // If tenantName filter is applied, filter out rows with empty tenantName - USING DEBOUNCED FILTERS
                if (debouncedColumnFilters.tenantName && debouncedColumnFilters.tenantName.trim()) {
                    formatted = formatted.filter(item =>
                        item.tenantName && item.tenantName.trim() &&
                        item.tenantName.toLowerCase().includes(debouncedColumnFilters.tenantName.toLowerCase())
                    );
                }

                // ── Client-side natural sort ────────────────────────────────────────────────
                // Used for:
                //   • Alphanumeric text fields (invoice_number, vendor, po_number) — JS
                //     localeCompare with { numeric: true } gives correct numeric ordering
                //     so INV-99 sorts next to INV-100, not between INV-998 and INV-989.
                //   • Embedded/joined table fields (userName, tenantName, file_name) — these
                //     are not sortable by PostgREST directly.
                if (needsClientSideSort) {
                    // Map the frontend sortField key to the actual property on the formatted object
                    const sortKeyMap = {
                        invoice_number: 'invoice_number',
                        vendor:         'vendor',
                        po_number:      'po_number',
                        userName:       'userName',
                        tenantName:     'tenantName',
                        file_name:      'file_name',
                    };
                    const sortKey = sortKeyMap[sortField] || sortField;
                    formatted.sort((a, b) => {
                        const aVal = (a[sortKey] || '').toString().toLowerCase();
                        const bVal = (b[sortKey] || '').toString().toLowerCase();
                        return effectiveSortAsc
                            ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
                            : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
                    });
                }

                // ... inside your fetchInvoices useEffect ...

                // --- UPDATE THIS BLOCK IN ExtractionQueue.jsx ---

                // Apply client-side pagination if client-side filtering or sorting was used
                let paginatedData = formatted;
                let finalTotalCount = total;

                if (needsAllRowsFetch) {
    finalTotalCount = formatted.length;

    if (finalTotalCount === 0) {
        paginatedData = [];
    } else {
        // Ensure we don't try to slice a page that doesn't exist in the filtered set
        const maxPage = Math.ceil(finalTotalCount / pageSize);
        const safePage = page > maxPage ? 1 : page; // Fallback to page 1 if current page is too high
        
        const startIndex = (safePage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        paginatedData = formatted.slice(startIndex, endIndex);
    }
}

                // Ensure these are ALWAYS called with the new values
                setFiles(paginatedData);
                setTotalCount(finalTotalCount);

            } catch (err) {
                // Failed to fetch invoices/documents
                // --- MODIFICATION START ---
                // Requirement #4: Don't display toast errors
                // toast.error('Failed to load invoices/documents.');
                // --- MODIFICATION END ---
                setTotalCount(0);
                setFiles([]);
            } finally {
                setLoading(false);
                setUpdatingResults(false); // Hide updating results indicator
                setInitialLoad(false); // Mark initial load as complete
            }
        };

        fetchInvoices();
    }, [
        user, canViewInvoiceList, token,
        page, pageSize, sortField, sortAsc,
        appliedFilters, debouncedColumnFilters, refreshTrigger, isDefaultDateRange
    ]);

//     // To this (Immediate Reset):
// useEffect(() => {
//     setPage(1);
// }, [columnFilters.tenantName, columnFilters.userName, columnFilters.file_name, columnFilters.id]);

    // Immediately clear data when filters change to prevent showing stale data
    useEffect(() => {
        setFiles([]);
        setUpdatingResults(true);
    }, [columnFilters.tenantName, columnFilters.userName, columnFilters.file_name, columnFilters.id, 
        columnFilters.invoice_number, columnFilters.vendor, columnFilters.po_number, 
        columnFilters.created_at, columnFilters.invoice_date, columnFilters.status, columnFilters.total_amount]);

    // Client-side filtering is no longer needed
    // const advancedFilteredFiles = useMemo(() => { ... });

    // Page reset is handled by TableComponent and filter change handlers
    // useEffect(() => {
    //     setPage(1);
    // }, [advancedFilteredFiles]);

    const clearAllFilters = () => {
        // Clear the debounce timeout to prevent it from firing
        if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);

        const emptyColumnFilters = {
            id: '',
            invoice_number: '',
            vendor: '',
            po_number: '',
            created_at: '',
            invoice_date: '',
            status: '',
            total_amount: '',
            file_name: '',
            userName: '',
            tenantName: '',
            stage: '',
        };

        // Batch all state updates together to trigger only one fetch
        setAppliedFilters(defaultAdvancedFilters);
        setDraftFilters(defaultAdvancedFilters);
        setIsDefaultDateRange(false); // Avoid restoring default 1-month range
        setColumnFilters(emptyColumnFilters);
        // Immediately update debounced filters to prevent debounce from triggering
        setDebouncedColumnFilters(emptyColumnFilters);
        setPage(1);
        // Clear URL parameters
        setSearchParams({}, { replace: true });
    };

    // New function to clear sort options
    const clearSortOptions = () => {
        setSortField('id');
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

    // True when the user has changed sorting away from the default (newest-first by id)
    const hasActiveSort = useMemo(() => {
        return sortField !== 'id' || sortAsc !== false;
    }, [sortField, sortAsc]);

    const getUniqueValues = useCallback((field) => {
        // This will only show unique values from the *current page*
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
            toast.error("You do not have permission to cancel invoices.");
            return;
        }
        setInvoiceToDelete(invoiceId);
        setShowConfirmDeleteModal(true);
    }, [canDeleteInvoice]);

    const confirmDeleteInvoice = useCallback(async () => {
        if (!invoiceToDelete) return;

        if (!canDeleteInvoice) {
            toast.error("You do not have permission to cancel invoices.");
            setShowConfirmDeleteModal(false);
            return;
        }

        if (!user.tenantId || !token) {
            toast.error('Authentication information is missing. Please log in again.');
            setShowConfirmDeleteModal(false);
            return;
        }

        try {
            // Instead of deleting the invoice, update its status to "Cancel"
            const updateInvoiceResponse = await axios.patch(`/api/v1/tables/ap_invoices?invoice_id=eq.${invoiceToDelete}`,
                { status: 'Cancel' },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (updateInvoiceResponse.status !== 200) {
                throw new Error(updateInvoiceResponse.data.message || 'Failed to cancel invoice.');
            }

            // Also cancel the related document
            // First, find the document ID for this invoice
            const invoiceToCancel = files.find(file => file.id === invoiceToDelete);
            if (invoiceToCancel && invoiceToCancel.doc_id) {
                try {
                    // Update the document status to "Cancel"
                    await axios.patch(`/api/v1/tables/ap_documents?doc_id=eq.${invoiceToCancel.doc_id}`,
                        { status: 'Cancel' },
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                        }
                    );
                } catch (docError) {
                    // Error cancelling related document
                    // Don't throw here - we want to continue even if document update fails
                }
            }

            // Re-fetch data for the current page
            setFiles(prevFiles => prevFiles.filter(file => file.id !== invoiceToDelete));
            setTotalCount(prevCount => Math.max(0, prevCount - 1)); // Decrement total count

            // If the last item on a page is deleted, go to the previous page
            if (files.length === 1 && page > 1) {
                setPage(p => p - 1);
            }

            toast.success('Invoice and related document cancelled successfully!');
        } catch (error) {
            // Error cancelling invoice
            toast.error(error.message || 'Error cancelling invoice.');
        } finally {
            setShowConfirmDeleteModal(false);
            setInvoiceToDelete(null);
        }
    }, [invoiceToDelete, canDeleteInvoice, user, files.length, page]);

    // No need for separate useEffect - status and vendor values are extracted from invoice data

    const cancelDelete = useCallback(() => {
        setShowConfirmDeleteModal(false);
        setInvoiceToDelete(null);
    }, []);

    const handleApplyFilters = () => {
        // Targeted column-filter clearing: only clear the column keys that directly
        // conflict with an advanced filter field that has a value in the draft.
        const columnKeysToClear = new Set();
        Object.entries(draftFilters).forEach(([advKey, value]) => {
            if (value && ADVANCED_TO_COLUMN_CONFLICT_EQ[advKey]) {
                ADVANCED_TO_COLUMN_CONFLICT_EQ[advKey].forEach(colKey => columnKeysToClear.add(colKey));
            }
        });

        if (columnKeysToClear.size > 0) {
            const patch = [...columnKeysToClear].reduce((acc, k) => ({ ...acc, [k]: '' }), {});
            setColumnFilters(prev => ({ ...prev, ...patch }));
            setDebouncedColumnFilters(prev => ({ ...prev, ...patch }));
        }

        // If the user has set explicit dates, remove the default date range banner
        if (draftFilters.from_date || draftFilters.to_date) {
            setIsDefaultDateRange(false);
        }

        // Apply the draft filters
        setAppliedFilters(draftFilters);
        setPage(1);
        setShowAdvancedFilter(false);
    };

    const handleCloseAdvancedFilter = () => {
        // Reset draft to applied on close without applying
        setDraftFilters(appliedFilters);
        setShowAdvancedFilter(false);
    };

    // Called by TableComponent via onColumnFilterCommit.
    // Only clears the specific advanced filter field(s) that directly conflict with
    // the committed column key — everything else is left untouched.
    const handleColumnFilterCommit = useCallback((key, value) => {
        const advancedKeysToClear = COLUMN_TO_ADVANCED_CONFLICT_EQ[key];
        if (advancedKeysToClear && advancedKeysToClear.length > 0) {
            const patch = advancedKeysToClear.reduce((acc, k) => ({ ...acc, [k]: '' }), {});
            setAppliedFilters(prev => ({ ...prev, ...patch }));
            setDraftFilters(prev => ({ ...prev, ...patch }));

            // Disable the default date-range banner when created_at column overrides dates
            if (key === 'created_at' && value) {
                setIsDefaultDateRange(false);
            }
        }

        setColumnFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    }, []);
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
            label: 'Vendor',
            type: 'text',
            icon: User,
            placeholder: 'Search vendor...',
        },
        {
            key: 'po_number',
            label: 'PO Number',
            type: 'text',
            icon: Hash,
            placeholder: 'Search PO number...',
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
        const isManagerOrAdmin = user?.role === 'account_manager' || user?.role === 'tenant_admin';
        const isSuperAdmin = user?.role === 'super_admin';

        let baseColumns = [
            // {
            //     key: 'id',
            //     header: <>ID</>,
            //     sortable: true,
            //     filterable: true,
            //     width: '50px',
            //     render: (item) => item.id,
            // },
        ];

        // 1. Conditionally add Tenant Name for Super Admin (first column)
        if (isSuperAdmin) {
            baseColumns.push({
                key: 'tenantName',
                header: <>Tenant Name</>,
                sortable: true,
                filterable: true,
                width: '120px',
                render: (item) => item.tenantName || '—',
            });
        }

        // 2. Conditionally add User Name for Account Manager / Tenant Admin / Super Admin
        if (isManagerOrAdmin || isSuperAdmin) {
            baseColumns.push({
                key: 'userName',
                header: <>User Name</>,
                sortable: true,
                filterable: true,
                width: '120px',
                render: (item) => item.userName || '—',
            });
        }

        // 3. Other relevant columns
        baseColumns.push(
            {
                key: 'invoice_number',
                header: <>Invoice No</>,
                sortable: true,
                filterable: true,
                width: '120px',
                render: (item) => (
                    <MessageCell
                        item={item}
                        itemId={item.id}
                        displayText={item.invoice_number}
                        errorData={item.error_desc}
                        activeTooltipId={activeTooltipId}
                        onToggle={setActiveTooltipId}
                        title="Invoice Messages"
                    />
                ),
                // render: (item) => (
                //     <div className="flex items-center justify-between gap-2 relative">
                //         <span
                //             className="flex-1 overflow-hidden text-ellipsis invoice-number-text"
                //             title={item.invoice_number} // Add native title for fallback
                //         >
                //             {item.invoice_number}
                //         </span>
                //         {item.error_desc && (item.error_desc.Note || item.error_desc.note) && (
                //             <div
                //                 className="info-icon-wrapper relative inline-block flex-shrink-0"
                //                 onMouseEnter={(e) => {
                //                     // Calculate position relative to viewport
                //                     const rect = e.currentTarget.getBoundingClientRect();
                //                     const tooltip = e.currentTarget.querySelector('.info-tooltip');
                //                     if (tooltip) {
                //                         const tooltipRect = tooltip.getBoundingClientRect();
                //                         const x = rect.left + (rect.width / 2);
                //                         const y = rect.top - 8; // 8px above the icon

                //                         tooltip.style.left = `${x}px`;
                //                         tooltip.style.top = `${y}px`;
                //                         tooltip.style.transform = 'translate(-50%, -100%)';
                //                     }
                //                 }}
                //             >
                //                 <Info size={16} className="text-yellow-600 cursor-pointer" />
                //                 {/* Tooltip with fixed positioning */}
                //                 <span
                //                     className="info-tooltip fixed invisible opacity-0 bg-gray-900 text-white text-xs font-medium rounded-md px-3 py-2 shadow-2xl transition-all duration-200 ease-in-out group-hover:visible group-hover:opacity-100 pointer-events-none"
                //                     style={{
                //                         maxWidth: '400px',
                //                         minWidth: '200px',
                //                         whiteSpace: 'normal',
                //                         wordWrap: 'break-word',
                //                         zIndex: 999999,
                //                     }}
                //                 >
                //                     {item.error_desc.Note || item.error_desc.note}
                //                     {/* Tooltip arrow */}
                //                     <span
                //                         className="absolute border-4 border-solid border-transparent border-t-gray-900"
                //                         style={{
                //                             top: '100%',
                //                             left: '50%',
                //                             transform: 'translateX(-50%)',
                //                             marginTop: '-1px'
                //                         }}
                //                     ></span>
                //                 </span>
                //             </div>
                //         )}
                //     </div>
                // ),

                // render: (item) => <InvoiceNumberCell item={item} activeTooltipId={activeTooltipId} onToggle={setActiveTooltipId} />,
            },
            {
                key: 'po_number',
                header: <>PO Number</>,
                sortable: true,
                filterable: true,
                width: '120px',
                render: (item) => item.po_number || '—',
            },
            {
                key: 'vendor',
                header: <>Vendor</>,
                sortable: true,
                filterable: true,
                width: '120px',
                render: (item) => item.vendor || '—',
            },
            {
                key: 'invoice_date',
                header: <>Invoice Date</>,
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
                width: '140px',
                render: (item) => item.file_name || '—',
            },
            {
                key: 'stage',
                header: <div>Stage</div>,
                sortable: false,
                filterable: false,
                filterType: 'select',
                filterOptions: () => ['New', 'Review', 'Upload'],
                width: '120px',
                render: (item) => <StageDisplay currentStage={item.stage} stages={['New', 'Review', 'Upload']} />,
            },
            {
                key: 'status',
                header: <>Status</>,    
                sortable: true,
                filterType: 'select',
                filterable: true,
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
                width: '140px',
                render: (item) =>
                    item.created_at ? (
                        <span className='text-xs'>
                            {formatDateTime(item.created_at)}
                        </span>
                    ) : (
                        '—'
                    ),
            }
        );

        const canViewInvoiceDetails = user?.role && canUserView(user.role, '/editor/:invoiceId');

        if (canViewInvoiceDetails || canDeleteInvoice) {
            baseColumns.push({
                key: 'action',
                header: <div>Action</div>,
                sortable: false,
                filterable: false,
                width: '70px',
                render: (item) => (
                    <div className="flex flex-col md:flex-row gap-0 md:justify-center md:items-center">
                        {canViewInvoiceDetails && (
                            <button
                                className="text-indigo-600 hover:text-indigo-800 font-semibold py-1 px-2 rounded-md"
                                onClick={(e) => { e.stopPropagation(); navigate(`/editor/${encryptId(item.id)}`); }}
                                title="View/Edit Invoice"
                                data-tour="extraction-table-view"
                            >
                                <Eye size={16} />
                            </button>
                        )}
                        {canDeleteInvoice && (
                            <button
                                className="text-red-500 hover:text-red-700 font-semibold py-1 px-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={(e) => { e.stopPropagation(); handleCancelInvoice(item.id); }}
                                title={canDeleteInvoice ? "Cancel Invoice" : deletePermissionDeniedMessage}
                                disabled={!canDeleteInvoice}
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
    }, [getUniqueValues, navigate, user, canDeleteInvoice, handleCancelInvoice, deletePermissionDeniedMessage, allStatusValues, activeTooltipId]);

    if (!canViewInvoiceList) {
        return (
            // Access Denied State - Matching RequestList style
            <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-xl border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <h2 className="text-xl font-bold mb-4">Access Denied</h2>
                <p className="text-gray-600">You do not have permission to view this page. Please contact your administrator.</p>
            </div>
        );
    }

    // if (loading || !user) {
    //     // Show a full-page loader while initial user data is loading
    //     return (
    //         <div className="flex justify-center items-center h-[80vh]">
    //             <Loader2 className="animate-spin text-indigo-600" size={40} />
    //         </div>
    //     );
    // }

    return (
        // Main Container - Updated with standardized spacing
        <div className="text-gray-800 font-[poppins] m-5 relative flex flex-col">
            <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />

            {/* Header and Filter Button */}
            <div className="flex flex-wrap items-center gap-2" data-tour="extraction-queue-header">

                {/* Title + inline date badge */}
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 text-sm font-medium text-gray-800">
                        Invoice Queue ({totalCount} items)
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

                            {/* Popover detail */}
                            {showNotePopover && (
                                <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-white border border-blue-100 rounded-lg shadow-xl p-3.5 text-xs">
                                    {/* Arrow */}
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
                        <Button
                            color="gray"
                            icon={ArrowUpDown}
                            onClick={clearSortOptions}
                            data-tour="extraction-queue-clear-sort"
                        >
                            Clear Sort
                        </Button>
                    )}

                    {hasActiveFilters && (
                        <Button
                            color="red"
                            icon={X}
                            onClick={clearAllFilters}
                            data-tour="extraction-queue-filter"
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
                            // Pre-fill draft with default dates so they're visible in the panel
                            if (isDefaultDateRange) {
                                setDraftFilters(prev => ({
                                    ...prev,
                                    from_date: prev.from_date || getOneMonthAgoDate(),
                                    to_date:   prev.to_date   || getTodayDate(),
                                }));
                            }
                            setShowNotePopover(false);
                            setShowAdvancedFilter(true);
                        }}
                        data-tour="extraction-queue-filter"
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
                    <h2 className="text-xl font-bold mb-5">Loading invoices...</h2>
                    <Loader2 size={32} className="text-indigo-600" />
                    <p className="text-gray-600 mt-5">Please wait while your data is being loaded.</p>
                </div>
            )} */}

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
                                    <option value="po_number">PO Number</option>
                                    <option value="vendor">Vendor</option>
                                    <option value="invoice_date">Invoice Date</option>
                                    <option value="file_name">File Name</option>
                                    <option value="created_at">Created At</option>
                                    <option value="status">Status</option>
                                    <option value="total_amount">Total Amount</option>
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
                                    setPage(1); // Reset page on apply
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
                    // Non-default fields cleared, default fields preserved as-is.
                    // isDefaultDateRange intentionally unchanged.
                    setDraftFilters(newValues);
                    setAppliedFilters(newValues);
                    setColumnFilters({
                        id: '',
                        invoice_number: '',
                        vendor: '',
                        created_at: '',
                        status: '',
                        po_number: '',
                        invoice_date: '',
                        total_amount: '',
                        userName: '',
                        tenantName: '',
                        file_name: '',
                        stage: '',
                    });
                    setPage(1);
                    setShowAdvancedFilter(false);
                }}
                onClearDefaults={(newValues) => {
                    // Default fields zeroed, non-defaults preserved; apply immediately and close
                    setDraftFilters(newValues);
                    setAppliedFilters(newValues);
                    setIsDefaultDateRange(false);
                    setColumnFilters({
                        id: '',
                        invoice_number: '',
                        vendor: '',
                        created_at: '',
                        status: '',
                        po_number: '',
                        invoice_date: '',
                        total_amount: '',
                        userName: '',
                        tenantName: '',
                        file_name: '',
                        stage: '',
                    });
                    setPage(1);
                    setShowAdvancedFilter(false);
                }}
                onRestoreDefaults={(newValues) => {
                    // Default fields restored + non-defaults preserved; apply immediately and close
                    setDraftFilters(newValues);
                    setAppliedFilters(newValues);
                    setIsDefaultDateRange(true);
                    setColumnFilters({
                        id: '',
                        invoice_number: '',
                        vendor: '',
                        created_at: '',
                        status: '',
                        po_number: '',
                        invoice_date: '',
                        total_amount: '',
                        userName: '',
                        tenantName: '',
                        file_name: '',
                        stage: '',
                    });
                    setPage(1);
                    setShowAdvancedFilter(false);
                }}
            />

            <TableComponent
                data={files}
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
                // Pass pagination props
                totalCount={totalCount}
                pageSize={pageSize}
                setPageSize={setPageSize}
                rowClassName={(item) => {
                    // Check if the item has a Note error
                    if (item.error_desc && (item.error_desc.Note || item.error_desc.note || item.error_desc.Note_1)) {
                        return 'bg-yellow-200'; // Yellow background for rows with Note error
                    }
                    return ''; // No special styling for other rows
                }}
                data-tour="extraction-table"
                tableFiltersDataTour="extraction-table-filters"
                tableSortDataTour="extraction-table-sort"
                tableViewDataTour="extraction-table-view"
                tableDeleteDataTour="extraction-table-delete"
                tablePaginationDataTour="extraction-table-pagination"
                filtering={updatingResults} // Use updatingResults state for filtering indicator
            />

            {/* Conditionally show color legend based on data */}
            <ColorLegend
                showDuplicateBill={duplicateBillCount > 0}
                // showReadyForRerun={files.some(file => file.stage === 'Upload' && (file.status === 'Error' || file.status === 'Failure'))}
                showSuccess={successCount > 0}
                showWarning={warningCount > 0}
                showError={errorCount > 0}
                currentPage="extractionQueue"
            />

            {/* Confirm Delete Modal - Updated with standardized spacing */}
            {showConfirmDeleteModal && invoiceToDelete && (
                <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-gradient-to-b from-white to-gray-50 p-8 rounded-md shadow-2xl border border-gray-200 z-[10000] w-[90%] max-w-lg flex flex-col">
                        <div className="flex items-center pb-4 mb-4 border-b border-gray-200">
                            <Info size={20} className="text-yellow-500 mr-3" />
                            <h3 className="text-lg font-bold text-gray-800">Confirm Cancellation</h3>
                        </div>
                        <p className="mb-5 text-gray-700">
                            Are you sure you want to cancel Invoice with ID: <span className="font-bold">{invoiceToDelete}</span>?
                            This action will mark the invoice and its related document as cancelled.
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
                                Cancel Invoice & Document
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ExtractionQueue;
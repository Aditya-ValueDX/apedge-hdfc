import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ViewDocumentModal from '../View/ViewDocumentModal';
import {
    Filter, X, Calendar, FileText,
    User, Hash, Clock, ListFilter, Eye, Loader2, Info, RefreshCw, DollarSign, ArrowUpDown
} from 'lucide-react';
import { useSelector } from 'react-redux';
import TableComponent from '../common/TableComponent';
import StatusBadge from '../common/StatusBadge';
import StageDisplay from '../common/StageDisplay';
import { canUserView } from '../../permissions';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { formatFileName, getSearchableFileName, normalizeFileSearch, isValidFileNameSearch } from '../../utils/fileUtils';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import { formatDate, formatDateTime, parseDisplayDateToRaw, getDefaultDateRangeFilter, getOneMonthAgoDate, getTodayDate, isValidDateFormat } from '../../utils/dateUtils';
import { apiBaseUrl } from '../../config/apiConfig';
import ColorLegend from '../common/ColorLegend';
import MessageCell from '../common/MessageCell';
import AdvancedFilterPanel from '../common/AdvancedFilterPanel';
import Button from '../common/Button';

// ─── PER-FIELD CONFLICT MAPS ──────────────────────────────────────────────────
// These define which fields in the *other* filter system must be cleared when a
// field in *this* system is committed, so that the same data dimension is never
// filtered twice simultaneously (once in column filters AND once in advanced filters).
//
// Rule: the filter that was set LAST wins for that field; everything else coexists.

// Column filter key → advanced filter keys to clear when that column is typed/selected
const COLUMN_TO_ADVANCED_CONFLICT = {
    status:       ['status'],
    input_source: ['input_source'],
    docType:      ['type'],
    vendor:       ['vendor'],
    amount:       ['amount_min', 'amount_max'],
    createdAt:    ['from_date', 'to_date'],
};

// Advanced filter key → column filter keys to clear when that advanced field is applied
const ADVANCED_TO_COLUMN_CONFLICT = {
    status:       ['status'],
    input_source: ['input_source'],
    type:         ['docType'],
    vendor:       ['vendor'],
    amount_min:   ['amount'],
    amount_max:   ['amount'],
    from_date:    ['createdAt'],
    to_date:      ['createdAt'],
};
// ─────────────────────────────────────────────────────────────────────────────

// Add a helper function to validate numeric format
const isValidNumericFormat = (value) => {
    if (!value) return false;
    const numericRegex = /^-?\d+(\.\d+)?$/;
    return numericRegex.test(value);
};

const FileNameCell = ({ item, activeTooltipId, onToggle }) => {
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
                title={formatFileName(item.filePath) || ''}
            >
                {formatFileName(item.filePath) || '—'}
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
                        Document Messages
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

const DocumentsQueue = () => {
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
        return sortAscParam ? sortAscParam === 'true' : false; // Default to descending
    };

    const getInitialColumnFilters = () => {
        const filters = {};
        const id = searchParams.get('id');
        if (id) filters.id = id;

        const filePath = searchParams.get('filePath');
        if (filePath) filters.filePath = filePath;

        const input_source = searchParams.get('input_source');
        if (input_source) filters.input_source = input_source;

        const docType = searchParams.get('docType');
        if (docType) filters.docType = docType;

        const createdAt = searchParams.get('createdAt');
        if (createdAt) filters.createdAt = createdAt;

        const status = searchParams.get('status');
        if (status) filters.status = status;

        const vendor = searchParams.get('vendor');
        if (vendor) filters.vendor = vendor;

        const amount = searchParams.get('amount');
        if (amount) filters.amount = amount;

        const userName = searchParams.get('userName');
        if (userName) filters.userName = userName;

        const tenantName = searchParams.get('tenantName');
        if (tenantName) filters.tenantName = tenantName;

        return filters;
    };

    const getInitialAdvancedFilters = () => {
        const filters = {};
        const type = searchParams.get('type');
        filters.type = type || '';

        const input_source = searchParams.get('adv_input_source');
        filters.input_source = input_source || '';

        const from_date = searchParams.get('from_date');
        filters.from_date = from_date || '';

        const to_date = searchParams.get('to_date');
        filters.to_date = to_date || '';

        const status = searchParams.get('adv_status');
        filters.status = status || '';

        const vendor = searchParams.get('adv_vendor');
        filters.vendor = vendor || '';

        const amount_min = searchParams.get('amount_min');
        filters.amount_min = amount_min || '';

        const amount_max = searchParams.get('amount_max');
        filters.amount_max = amount_max || '';

        return filters;
    };

    const defaultAdvancedFilters = {
        type: '',
        input_source: '',
        from_date: '',
        to_date: '',
        status: '',
        vendor: '',
        amount_min: '',
        amount_max: '',
        stage: '',
    };

    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(() => {
        const pageParam = searchParams.get('page');
        return pageParam ? parseInt(pageParam, 10) : 1;
    });
    const [pageSize, setPageSize] = useState(() => {
        const pageSizeParam = searchParams.get('pageSize');
        return pageSizeParam ? parseInt(pageSizeParam, 10) : 10;
    });
    const [sortField, setSortField] = useState(() => searchParams.get('sortField') || 'id');
    const [sortAsc, setSortAsc] = useState(() => {
        const sortAscParam = searchParams.get('sortAsc');
        return sortAscParam ? sortAscParam === 'true' : false; // Default to descending
    });
    const [initialLoad, setInitialLoad] = useState(true); // New state to track initial load
    const [totalCount, setTotalCount] = useState(0); // Add missing state for totalCount
    const [filteredTotalCount, setFilteredTotalCount] = useState(0); // Add state for filtered total count
    const [duplicateBillCount, setDuplicateBillCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const [warningCount, setWarningCount] = useState(0);
    const [successCount, setSuccessCount] = useState(0);
    const [updatingResults, setUpdatingResults] = useState(false); // Add missing state for updatingResults
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false); // Add missing state for showAdvancedFilter
    const [showSortOptions, setShowSortOptions] = useState(false); // Add missing state for showSortOptions
    const [modalOpen, setModalOpen] = useState(false); // Add missing state for modalOpen
    const [docUrl, setDocUrl] = useState(''); // Add missing state for docUrl
    const [docMimeType, setDocMimeType] = useState(''); // Add missing state for docMimeType
    const [currentDocument, setCurrentDocument] = useState(null); // Add missing state for currentDocument
    const [activeTooltipId, setActiveTooltipId] = useState(null); // Add state for tooltip
    const [showNotePopover, setShowNotePopover] = useState(false);
    const noteRef = useRef(null);

    const [allStatusValues, setAllStatusValues] = useState([]);
    const [allInputSources, setAllInputSources] = useState([]);
    const [allDocTypes, setAllDocTypes] = useState([]);

    const user = useSelector(state => state.auth.user);
    const token = user.token;
    const [columnFilters, setColumnFilters] = useState({
        id: '',
        filePath: '',
        input_source: '',
        docType: '',
        createdAt: '',
        status: '',
        vendor: '',
        amount: '',
        userName: '',
        tenantName: '',
        ...getInitialColumnFilters()
    });

    const [debouncedColumnFilters, setDebouncedColumnFilters] = useState(columnFilters);

    // --- TWO-STATE FILTER SYSTEM ---
    // Initialize directly from URL so a full-page refresh restores state correctly
    const [appliedFilters, setAppliedFilters] = useState(() => getInitialAdvancedFilters());
    const [draftFilters, setDraftFilters] = useState(() => getInitialAdvancedFilters());

    // Track whether we are using the implicit 1-month default date range.
    // It becomes false once the user explicitly applies dates via the Advanced Filter panel.
    // It resets to true when the user clears all filters.
    const initialAdv = getInitialAdvancedFilters();
    const [isDefaultDateRange, setIsDefaultDateRange] = useState(
        () => !initialAdv.from_date && !initialAdv.to_date
    );

    // --- GUARD REFS TO PREVENT INFINITE LOOPS ---
    // hasMountedRef: skip the URL-write on the very first render so we never
    // clobber URL params that were already present when the page loaded.
    const hasMountedRef = useRef(false);
    const filterTimeoutRef = useRef(null);

    const navigate = useNavigate();
    const canViewDocuments = user ? canUserView(user.role, '/documents') : false;

    // Mark component as mounted so the URL-update effect starts writing after the
    // first render (state is already seeded from URL via lazy initialisers above).
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

    // --- UPDATE URL ONLY WHEN FILTERS/PAGE CHANGE (after initial mount) ---
    useEffect(() => {
        if (!hasMountedRef.current) return;

        const params = new URLSearchParams();

        if (page !== 1) params.set('page', page.toString());
        if (pageSize !== 10) params.set('pageSize', pageSize.toString());

        if (sortField !== 'id') params.set('sortField', sortField);
        if (sortAsc) params.set('sortAsc', sortAsc.toString());

        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        Object.entries(appliedFilters).forEach(([key, value]) => {
            if (value) {
                switch (key) {
                    case 'input_source':
                        params.set('adv_input_source', value);
                        break;
                    case 'status':
                        params.set('adv_status', value);
                        break;
                    case 'vendor':
                        params.set('adv_vendor', value);
                        break;
                    default:
                        params.set(key, value);
                }
            }
        });

        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, columnFilters, appliedFilters, setSearchParams]);

    // --- DEBOUNCE COLUMN FILTERS ---
    useEffect(() => {
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

    // --- 2️⃣ PURE FETCH FUNCTION (NO SIDE EFFECTS) ---
    const fetchDocuments = useCallback(async (filtersToUse) => {
        if (!user || !token || !canViewDocuments) {
            setLoading(false);
            return;
        }

        // Prevent multiple simultaneous API calls
        if (isLoadingData) {
            return;
        }
        
        setIsLoadingData(true);
        setUpdatingResults(true);

        const offset = (page - 1) * pageSize;
        let documentsUrl = `/api/v1/tables/ap_documents?select=*,ap_users(user_name),ap_tenants(tenant_name)`;

        // Client-side filtering: userName/tenantName are resolved from embedded join data
        const needsClientSideFiltering =
            !!(columnFilters.userName && columnFilters.userName.trim()) ||
            !!(columnFilters.tenantName && columnFilters.tenantName.trim());

        // Client-side sort needed for:
        //   1. Embedded/joined columns (userName, tenantName) — PostgREST can't ORDER BY these
        //   2. Alphanumeric text columns (filePath, docType) — PostgreSQL lexicographic sort
        //      gives wrong natural order (e.g. "file-9" between "file-99" and "file-100")
        const CLIENT_SIDE_SORT_FIELDS = new Set([
            'userName', 'tenantName',   // embedded join — server can't sort by name
            'filePath', 'docType',      // alphanumeric TEXT — natural sort needed
        ]);
        const needsClientSideSort = CLIENT_SIDE_SORT_FIELDS.has(sortField);

        // Fetch ALL rows (skip server pagination) when either flag is true
        const needsAllRowsFetch = needsClientSideFiltering || needsClientSideSort;

        const effectiveSortField = sortField || 'doc_id';
        const effectiveSortAsc = sortAsc;

        // Map frontend field keys to actual DB column names.
        // Fields in CLIENT_SIDE_SORT_FIELDS fall back to doc_id so the server
        // returns rows in a stable order ready for client-side re-sorting.
        let dbSortFieldMapped;
        switch (effectiveSortField) {
            case 'id':           dbSortFieldMapped = 'doc_id';       break;
            case 'createdAt':    dbSortFieldMapped = 'created_at';   break;
            case 'status':       dbSortFieldMapped = 'status';       break;
            case 'stage':        dbSortFieldMapped = 'stage';        break;
            case 'input_source': dbSortFieldMapped = 'input_source'; break;
            // Client-side sort fields — use doc_id as stable server-side fallback
            case 'userName':
            case 'tenantName':
            case 'filePath':
            case 'docType':      dbSortFieldMapped = 'doc_id';       break;
            default:             dbSortFieldMapped = effectiveSortField;
        }

        const sortDir = effectiveSortAsc ? 'asc' : 'desc';
        let orderQuery = `${dbSortFieldMapped}.${sortDir}.nullslast`;
        if (effectiveSortField !== 'id') {
            orderQuery += `,doc_id.desc`;
        }
        documentsUrl += `&order=${orderQuery}`;

        // Role-based scope
        if (user.role === 'account_user') {
            if (!user.user_id || !user.tenantId) {
                setLoading(false);
                return;
            }
            documentsUrl += `&user_id=eq.${user.user_id}&tenant_id=eq.${user.tenantId}`;
        } else if (user.role === 'account_manager' || user.role === 'tenant_admin') {
            if (!user.tenantId) {
                setLoading(false);
                return;
            }
            documentsUrl += `&tenant_id=eq.${user.tenantId}`;
        }

        // Column Filters
        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value) {
                const filterValue = encodeURIComponent(value);
                switch (key) {
                    case 'id':
                        if (isValidNumericFormat(value)) {
                            documentsUrl += `&doc_id=eq.${filterValue}`;
                        }
                        break;
                    case 'filePath': {
                        const normalizedValue = normalizeFileSearch(value);
                        if (isValidFileNameSearch(normalizedValue)) {
                            const lastDot = normalizedValue.lastIndexOf('.');
                            if (lastDot > 0) {
                                const basePart = encodeURIComponent(normalizedValue.substring(0, lastDot));
                                const extPart  = encodeURIComponent(normalizedValue.substring(lastDot));
                                documentsUrl += `&file_path=ilike.*${basePart}*${extPart}*`;
                            } else {
                                documentsUrl += `&file_path=ilike.*${encodeURIComponent(normalizedValue)}*`;
                            }
                        }
                        break;
                    }
                    case 'input_source':
                        documentsUrl += `&input_source=ilike.*${filterValue}*`;
                        break;
                    case 'docType':
                        documentsUrl += `&doc_type=ilike.*${filterValue}*`;
                        break;
                    case 'createdAt':
                        if (isValidDateFormat(value)) {
                            try {
                                const dateObj = new Date(value);
                                const isoDate = dateObj.toISOString();
                                const nextDay = new Date(dateObj);
                                nextDay.setDate(nextDay.getDate() + 1);
                                const nextDayIso = nextDay.toISOString();
                                documentsUrl += `&created_at=gte.${isoDate}&created_at=lt.${nextDayIso}`;
                            } catch (e) { /* Invalid date */ }
                        }
                        break;
                    case 'status':
                        documentsUrl += `&status=eq.${filterValue}`;
                        break;
                    case 'stage':
                        documentsUrl += `&stage=eq.${filterValue}`;
                        break;
                    case 'userName':
                        if (filterValue.trim()) {
                            documentsUrl += `&ap_users.user_name=ilike.*${filterValue}*`;
                            documentsUrl += `&ap_users=not.is.null`;
                        }
                        break;
                    case 'tenantName':
                        if (filterValue.trim()) {
                            documentsUrl += `&ap_tenants.tenant_name=ilike.*${filterValue}*`;
                            documentsUrl += `&ap_tenants=not.is.null`;
                        }
                        break;
                    case 'vendor':
                        documentsUrl += `&vendor=ilike.*${filterValue}*`;
                        break;
                    case 'amount':
                        if (isValidNumericFormat(value)) {
                            documentsUrl += `&amount=ilike.*${filterValue}*`;
                        }
                        break;
                }
            }
        });

        // Advanced Filters
        if (filtersToUse.type) documentsUrl += `&doc_type=eq.${encodeURIComponent(filtersToUse.type)}`;
        if (filtersToUse.input_source) documentsUrl += `&input_source=eq.${encodeURIComponent(filtersToUse.input_source)}`;
        if (filtersToUse.status) documentsUrl += `&status=eq.${encodeURIComponent(filtersToUse.status)}`;
        if (filtersToUse.stage) documentsUrl += `&stage=eq.${encodeURIComponent(filtersToUse.stage)}`;
        if (filtersToUse.vendor) documentsUrl += `&vendor=ilike.*${encodeURIComponent(filtersToUse.vendor)}*`;

        // Date range filtering
        // If explicit dates are set in the advanced filter, apply them individually.
        // Otherwise, if the default 1-month range is active, use the shared helper.
        if (filtersToUse.from_date && isValidDateFormat(filtersToUse.from_date)) {
            documentsUrl += `&created_at=gte.${filtersToUse.from_date}T00:00:00.000Z`;
        }
        if (filtersToUse.to_date && isValidDateFormat(filtersToUse.to_date)) {
            documentsUrl += `&created_at=lte.${filtersToUse.to_date}T23:59:59.999Z`;
        }
        if (!filtersToUse.from_date && !filtersToUse.to_date && isDefaultDateRange) {
            documentsUrl += getDefaultDateRangeFilter();
        }

        if (filtersToUse.amount_min) documentsUrl += `&amount=gte.${encodeURIComponent(filtersToUse.amount_min)}`;
        if (filtersToUse.amount_max) documentsUrl += `&amount=lte.${encodeURIComponent(filtersToUse.amount_max)}`;

        // Only apply server-side pagination when we don't need all rows
        if (!needsAllRowsFetch) {
            documentsUrl += `&limit=${pageSize}&offset=${offset}`;
        }

        const config = {
            headers: {
                Authorization: `Bearer ${token}`,
                'Prefer': 'count=exact'
            }
        };

        try {
            const res = await axios.get(documentsUrl, config);
            const data = res.data;

            const contentRange = res.headers['content-range'];
            let total = 0;
            if (contentRange) {
                const match = contentRange.match(/\/(\d+)/);
                if (match && match[1]) {
                    total = parseInt(match[1], 10);
                }
            }
            setTotalCount(total);

            const formatted = data.map((doc) => {
                const totalAmount = parseFloat(doc.amount || doc.total || 0);
                const vendorName = doc.vendor || doc.vendor_name || 'Unknown Vendor';
                const createdAt = doc.createdAt || doc.created_at || doc.date || getCurrentTimeISOString();

                const userName = doc.ap_users ? doc.ap_users.user_name : '';
                const tenantName = doc.ap_tenants ? doc.ap_tenants.tenant_name : '';

                let errorDesc = null;
                if (doc.error_desc) {
                    try {
                        errorDesc = typeof doc.error_desc.value === 'string'
                            ? JSON.parse(doc.error_desc.value)
                            : doc.error_desc.value;
                    } catch (e) {
                        errorDesc = null;
                    }
                }

                return {
                    id: doc.doc_id || doc.id,
                    type: doc.doc_type || 'Document',
                    vendor: vendorName,
                    date: doc.date || '',
                    status: doc.status || 'uploaded',
                    amount: totalAmount,
                    filePath: doc.file_path || '',
                    input_source: doc.input_source || 'Manual',
                    docType: doc.doc_type || 'Document',
                    createdAt: createdAt,
                    mimeType: doc.mime_type || '',
                    userName,
                    tenantName,
                    stage: doc.stage || 'New',
                    error_desc: errorDesc,
                };
            });

            // ── Client-side filtering for userName / tenantName ─────────────────
            let filteredData = formatted;
            if (columnFilters.userName && columnFilters.userName.trim()) {
                const search = columnFilters.userName.trim().toLowerCase();
                filteredData = filteredData.filter(item =>
                    item.userName && item.userName.toLowerCase().includes(search)
                );
            }
            if (columnFilters.tenantName && columnFilters.tenantName.trim()) {
                const search = columnFilters.tenantName.trim().toLowerCase();
                filteredData = filteredData.filter(item =>
                    item.tenantName && item.tenantName.toLowerCase().includes(search)
                );
            }

            // ── Client-side natural sort for embedded/alphanumeric fields ────────
            // Covers: userName, tenantName (embedded join), filePath & docType (alphanumeric TEXT)
            if (needsClientSideSort) {
                // Map frontend sortField key → actual property on formatted object
                const sortKeyMap = {
                    userName:   'userName',
                    tenantName: 'tenantName',
                    filePath:   'filePath',
                    docType:    'docType',
                };
                const sortKey = sortKeyMap[sortField] || sortField;
                filteredData.sort((a, b) => {
                    const aVal = (a[sortKey] || '').toString().toLowerCase();
                    const bVal = (b[sortKey] || '').toString().toLowerCase();
                    return effectiveSortAsc
                        ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
                        : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
                });
            }

            // ── Client-side pagination when all rows were fetched ────────────────
            let paginatedData = filteredData;
            let finalTotalCount = total;

            if (needsAllRowsFetch) {
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

            setDocuments(paginatedData);
            setTotalCount(finalTotalCount);
            setFilteredTotalCount(finalTotalCount);
        } catch (err) {
            toast.error('Failed to fetch documents.');
            setTotalCount(0);
            setDocuments([]);
        } finally {
            setLoading(false);
            setIsLoadingData(false);
            setUpdatingResults(false);
        }
    }, [user, token, canViewDocuments, page, pageSize, sortField, sortAsc, columnFilters, isDefaultDateRange]);

    // ─── DROPDOWN OPTIONS + FULL-DATASET COUNTS ────────────────────────────────
    // Fetched once on mount WITHOUT any column/advanced filters so that:
    //   • Dropdown options always show every value, even when a filter is active.
    //   • Color-legend counts reflect the entire dataset, not just the current page.
    const dropdownFetchedRef = useRef(false);

    const fetchDropdownOptions = useCallback(async () => {
        if (!user || !token) return;

        let url = `/api/v1/tables/ap_documents?select=status,doc_type,input_source,stage,error_desc`;

        // Apply role-based scope only (same rules as the main fetch)
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

            // ── Dropdown option lists (full dataset, no active filter) ──
            setAllStatusValues([...new Set(data.map(d => d.status).filter(Boolean))]);
            setAllInputSources([...new Set(data.map(d => d.input_source).filter(Boolean))]);
            setAllDocTypes([...new Set(data.map(d => d.doc_type).filter(Boolean))]);

            // ── Color-legend counts from the full dataset ──
            const counts = data.reduce((acc, doc) => {
                if (!doc.error_desc) return acc;
                try {
                    const ed = typeof doc.error_desc.value === 'string'
                        ? JSON.parse(doc.error_desc.value)
                        : doc.error_desc.value || doc.error_desc;
                    if (!ed) return acc;
                    if (ed.Note || ed.note || ed.Note_1) acc.duplicate++;
                    if (ed.Error || ed.error)           acc.error++;
                    if (ed.Warning || ed.warning || ed.Warning_1) acc.warning++;
                    if (ed.Success || ed.success || ed.Success_1) acc.success++;
                } catch (_) { /* skip malformed */ }
                return acc;
            }, { duplicate: 0, error: 0, warning: 0, success: 0 });

            setDuplicateBillCount(counts.duplicate);
            setErrorCount(counts.error);
            setWarningCount(counts.warning);
            setSuccessCount(counts.success);
        } catch (_) { /* non-fatal — dropdowns stay at previous values */ }
    }, [user, token]);

    useEffect(() => {
        if (user && token && !dropdownFetchedRef.current) {
            dropdownFetchedRef.current = true;
            fetchDropdownOptions();
        }
    }, [user, token, fetchDropdownOptions]);

    // Ref to track if initial fetch has been completed to prevent duplicate calls
    const initialFetchCompletedRef = useRef(false);

    // --- 3️⃣ TRIGGER FETCH ONLY WHEN appliedFilters CHANGE ---
    useEffect(() => {
        if (!hasMountedRef.current) {
            // On very first render we still want to fetch — mark mounted then fetch.
            hasMountedRef.current = true;
        }

        // Only allow fetch if it's not the initial load or if initial load has been completed
        if (!initialFetchCompletedRef.current) {
            initialFetchCompletedRef.current = true;
        }

        fetchDocuments(appliedFilters);
    }, [appliedFilters, fetchDocuments]);

    // --- HANDLE APPLY FILTERS ---
    // Only clears the specific column filter field(s) that directly conflict with
    // an advanced filter being applied. All other column filters are left untouched.
    const handleApplyFilters = () => {
        // 1️⃣ Targeted column-filter clearing: for every advanced filter field that has
        //    a value in the draft, clear only the overlapping column filter key(s).
        const columnKeysToClear = new Set();
        Object.entries(draftFilters).forEach(([advKey, value]) => {
            if (value && ADVANCED_TO_COLUMN_CONFLICT[advKey]) {
                ADVANCED_TO_COLUMN_CONFLICT[advKey].forEach(colKey => columnKeysToClear.add(colKey));
            }
        });

        if (columnKeysToClear.size > 0) {
            const clearedPatch = [...columnKeysToClear].reduce(
                (acc, k) => ({ ...acc, [k]: '' }),
                {}
            );
            setColumnFilters(prev => ({ ...prev, ...clearedPatch }));
        }

        // 2️⃣ Reset page
        setPage(1);

        // 3️⃣ If the user has set explicit dates, remove the default date range banner
        if (draftFilters.from_date || draftFilters.to_date) {
            setIsDefaultDateRange(false);
        }

        // 4️⃣ Apply advanced filters
        setAppliedFilters(draftFilters);

        // 5️⃣ Close modal
        setShowAdvancedFilter(false);
    };


    // --- HANDLE MODAL CLOSE ---
    const handleCloseAdvancedFilter = () => {
        setDraftFilters(appliedFilters);
        setShowAdvancedFilter(false);
    };

    // --- HANDLE REFRESH ---
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            // Only refresh the data without clearing filters
            await fetchDocuments(appliedFilters);
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    }, [appliedFilters, fetchDocuments]);

    const openViewer = useCallback(async (relativePath, originalMimeType, documentData) => {
        if (!relativePath || !token) {
            toast.error('Cannot view document: missing file path or authentication token.');
            return;
        }
        try {
            const response = await axios.get(`/api/${relativePath}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const blobUrl = URL.createObjectURL(response.data);
            setDocUrl(blobUrl);
            setDocMimeType(originalMimeType);
            setCurrentDocument(documentData);
            setModalOpen(true);
        } catch (error) {
            toast.error('Failed to load document for viewing.');
        }
    }, [token]);

    const getUniqueValues = useCallback((field) => {
        return [
            ...new Set(
                documents
                    .map((doc) => doc[field])
                    .filter((val) => val !== null && val !== undefined && val !== '')
            ),
        ];
    }, [documents]);

    const capitalizeStatus = (status) => {
        if (!status) return '';
        return String(status)
            .replace(/_/g, ' ')
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const clearAllFilters = () => {
        setAppliedFilters(defaultAdvancedFilters);
        setDraftFilters(defaultAdvancedFilters);
        setIsDefaultDateRange(false); // Avoid restoring default 1-month range
        setColumnFilters({
            id: '',
            filePath: '',
            input_source: '',
            docType: '',
            createdAt: '',
            status: '',
            vendor: '',
            amount: '',
            userName: '',
            tenantName: '',
        });
        setPage(1);
    };

    const clearSortOptions = () => {
        setSortField('id');
        setSortAsc(false);
        setPage(1);
    };

    const hasActiveFilters = useMemo(() => {
        const hasColumnFilters = Object.values(columnFilters).some(value => value !== '');
        // Build a map of known default values so we don't reference filterFields (defined later)
        const knownDefaults = {
            from_date: getOneMonthAgoDate(),
            to_date: getTodayDate(),
        };
        const hasAdvancedFilters = Object.entries(appliedFilters).some(([key, value]) => {
            if (!value) return false;
            // Don't count a field as active if it's just sitting at its default value
            if (knownDefaults[key] && value === knownDefaults[key]) return false;
            return true;
        });
        return hasColumnFilters || hasAdvancedFilters;
    }, [columnFilters, appliedFilters]);

    // True when the user has changed sorting away from the default (newest-first by id)
    const hasActiveSort = useMemo(() => {
        return sortField !== 'id' || sortAsc !== false;
    }, [sortField, sortAsc]);

    // --- HANDLE COLUMN FILTER COMMIT (called by TableComponent via onColumnFilterCommit) ---
    // Only clears the specific advanced filter field(s) that directly conflict with the
    // column filter key being committed. All other advanced filters are left untouched.
    const handleColumnFilterCommit = useCallback((key, value) => {
        // 1️⃣ Targeted advanced-filter clearing: only clear the overlapping advanced field(s)
        const advancedKeysToClear = COLUMN_TO_ADVANCED_CONFLICT[key];
        if (advancedKeysToClear && advancedKeysToClear.length > 0) {
            const clearedPatch = advancedKeysToClear.reduce(
                (acc, k) => ({ ...acc, [k]: '' }),
                {}
            );
            setAppliedFilters(prev => ({ ...prev, ...clearedPatch }));
            setDraftFilters(prev => ({ ...prev, ...clearedPatch }));

            // If the column's createdAt is overriding the advanced date range,
            // disable the default-date-range banner so it doesn't show stale info.
            if (key === 'createdAt' && value) {
                setIsDefaultDateRange(false);
            }
        }

        // 2️⃣ Apply the new column filter value — all other filters untouched
        setColumnFilters(prev => ({ ...prev, [key]: value }));

        // 3️⃣ Reset page
        setPage(1);
    }, []);

    const columns = useMemo(() => {
        const baseColumns = [];

        // Conditionally add user and tenant columns based on user role
        if (user?.role === 'account_manager' || user?.role === 'tenant_admin' || user?.role === 'super_admin') {
            if (user?.role === 'super_admin') {
                baseColumns.push({
                    key: 'tenantName',
                    header: 'Tenant Name',
                    sortable: true,
                    filterable: true,
                    width: '100px',
                });
            }
            
            baseColumns.push({
                key: 'userName',
                header: 'User Name',
                sortable: true,
                filterable: true,
                width: '100px',
            });            
        }

        // Add the remaining columns in the requested order
        baseColumns.push({
            key: 'filePath',
            header: <>File Name</>,
            sortable: true,
            filterable: true,
            filterType: 'text',
            filterPlaceholder: 'File Name',
            width: '200px',
            render: (item) => (
                <MessageCell
                    item={item}
                    itemId={item.id}
                    displayText={formatFileName(item.filePath)}
                    errorData={item.error_desc}
                    activeTooltipId={activeTooltipId}
                    onToggle={setActiveTooltipId}
                    title="Document Messages"
                />
            ),
        });
        baseColumns.push({
            key: 'input_source',
            header: <>Source</>,
            sortable: true,
            filterable: true,
            filterType: 'select',
            filterOptions: () => allInputSources,
            width: '100px',
        });
        baseColumns.push({
            key: 'docType',
            header: 'Doc Type',
            sortable: true,
            filterable: true,
            // filterType: 'select',
            filterType: 'text',
            // filterOptions: () => allDocTypes,
            width: '120px',
        });
        baseColumns.push({
            key: 'stage',
            header: 'Stage',
            sortable: true,
            filterable: true,
            filterType: 'select',
            filterOptions: () => ['New', 'Review', 'Upload'],
            width: '120px',
            render: (item) => <StageDisplay currentStage={item.stage} stages={['New', 'Review', 'Upload']} />,
        });
        baseColumns.push({
            key: 'status',
            header: <>Status</>,
            sortable: true,
            filterable: true,
            filterType: 'select',
            filterOptions: () => allStatusValues,
            width: '120px',
            render: (item) => <StatusBadge status={item.status} capitalizeStatus={capitalizeStatus} />,
        });
        baseColumns.push({
            key: 'createdAt',
            header: <>Created At</>,
            sortable: true,
            filterable: true,
            filterType: 'date',
            width: '120px',
            render: (item) => (
                <div className="text-gray-800">
                    {formatDateTime(item.createdAt)}
                </div>
            ),
        });

        // Add action column at the end
        baseColumns.push({
            key: 'action',
            header: <div>Action</div>,
            sortable: false,
            filterable: false,
            width: '50px',
            render: (item) => (
                <div className="flex items-center gap-1">
                    <button
                        className="text-indigo-600 hover:text-indigo-800 font-semibold py-1 px-2 rounded-md flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); openViewer(item.filePath, item.mimeType, item); }}
                        title="View Document"
                        data-tour="documents-table-view"
                    >
                        <Eye size={14} />
                    </button>
                </div>
            ),
        });

        return baseColumns;

    }, [getUniqueValues, openViewer, user, allInputSources, allDocTypes, activeTooltipId]);

    // --- ADVANCED FILTER PANEL FIELD DEFINITIONS ---
    const filterFields = useMemo(() => [
        
        {
            key: 'from_date',
            label: 'From Date',
            type: 'date',
            icon: Calendar,
            maxKey: 'to_date',
            // Tells the panel this value is a pre-set default so Clear Defaults can target it
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
            key: 'input_source',
            label: 'Source',
            type: 'select',
            icon: FileText,
            options: allInputSources,
            allOptionLabel: 'All Sources',
        },
        {
            key: 'status',
            label: 'Status',
            type: 'select',
            icon: ListFilter,
            options: allStatusValues.map(s => ({ value: s, label: capitalizeStatus(s) })),
            allOptionLabel: 'All Statuses',
        },
        {
            key: 'stage',
            label: 'Stage',
            type: 'select',
            icon: Clock,
            options: ['New', 'Review', 'Upload'],
            allOptionLabel: 'All Stages',
        },
    ], [allInputSources, allStatusValues]);

    // --- 5️⃣ GUARD RENDERING TO PREVENT BLANK UI ---
    if (!user || !canViewDocuments) {
        return (
            <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-md border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <h2 className="text-xl font-bold mb-4">Access Denied</h2>
                <p className="text-gray-600">You do not have permission to view this page. Please contact your administrator.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-md border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
                <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <h2 className="text-xl font-bold mb-5">Loading Documents...</h2>
                <Loader2 size={32} className="text-indigo-600 animate-spin" />
                <p className="text-gray-600 mt-5">Please wait while your data is being loaded.</p>
            </div>
        );
    }

    return (
        <div className="text-gray-800 m-5 font-[poppins] border-gray-200 relative flex flex-col">
            <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />

            {!loading && (
                <>
                    <div className="flex flex-wrap items-center gap-2" data-tour="documents-queue-header">

                        {/* Title + inline date badge */}
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="flex-shrink-0 text-sm font-medium text-gray-800">
                                Documents Queue ({totalCount} items)
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

                        {/* Action buttons pushed to the right */}
                        <div className="ml-auto flex items-center gap-2">
                            {hasActiveSort && (
                                <Button
                                    color="gray"
                                    icon={ArrowUpDown}
                                    onClick={clearSortOptions}
                                    data-tour="documents-queue-clear-sort"
                                >
                                    Clear Sort
                                </Button>
                            )}

                            {hasActiveFilters && (
                                <Button
                                    color="red"
                                    icon={X}
                                    onClick={clearAllFilters}
                                    data-tour="documents-queue-filter"
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
                                data-tour="documents-queue-filter"
                            >
                                Advanced Filters
                            </Button>
                        </div>
                    </div>
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-5 mb-5 flex-grow overflow-y-auto pr-3">
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
                                            <option value="filePath">File Name</option>
                                            <option value="input_source">Source</option>
                                            <option value="docType">Document Type</option>
                                            <option value="createdAt">Created At</option>
                                            <option value="status">Status</option>
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

                    {/* Advanced Filter Panel (replaces the old inline modal) */}
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
                                filePath: '',
                                input_source: '',
                                docType: '',
                                createdAt: '',
                                status: '',
                                vendor: '',
                                amount: '',
                                userName: '',
                                tenantName: '',
                            });
                            setPage(1);
                            setShowAdvancedFilter(false);
                        }}
                        onClearDefaults={(newValues) => {
                            // Default fields have been zeroed by the panel; apply immediately and close
                            setDraftFilters(newValues);
                            setAppliedFilters(newValues);
                            setIsDefaultDateRange(false);
                            setColumnFilters({
                                id: '',
                                filePath: '',
                                input_source: '',
                                docType: '',
                                createdAt: '',
                                status: '',
                                vendor: '',
                                amount: '',
                                userName: '',
                                tenantName: '',
                            });
                            setPage(1);
                            setShowAdvancedFilter(false);
                        }}
                    />

                    <TableComponent
                        data={documents}
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
                        emptyMessage="No documents found matching your criteria."
                        totalCount={totalCount}
                        pageSize={pageSize}
                        setPageSize={setPageSize}
                        rowClassName={(item) => {
                            if (item.error_desc && (item.error_desc.Note || item.error_desc.note || item.error_desc.Note_1)) {
                                return 'bg-yellow-200';
                            }
                            return '';
                        }}
                        filtering={updatingResults}
                        tableFiltersDataTour="documents-table-filters"
                        tableSortDataTour="documents-table-sort"
                        tableViewDataTour="documents-table-view"
                        tableReprocessDataTour="documents-table-reprocess"
                        tableDeleteDataTour="documents-table-delete"
                        tablePaginationDataTour="documents-table-pagination"
                        data-tour="documents-table"
                    />

                    <ColorLegend
                        showDuplicateBill={duplicateBillCount > 0}
                        showSuccess={successCount > 0}
                        showWarning={warningCount > 0}
                        showError={errorCount > 0}
                        currentPage="documentsQueue" /* prop kept for backwards compat, no longer used in ColorLegend */
                    />

                    <ViewDocumentModal
                        isOpen={modalOpen}
                        onRequestClose={() => {
                            setModalOpen(false);
                            if (docUrl && docUrl.startsWith('blob:')) {
                                URL.revokeObjectURL(docUrl);
                                setDocUrl('');
                            }
                        }}
                        fileUrl={docUrl}
                        mimeType={docMimeType}
                        fileName={currentDocument ? formatFileName(currentDocument.filePath) : 'Document'}
                        errorDesc={currentDocument ? currentDocument.error_desc : null}
                    />
                </>
            )}
        </div>
    );
};

export default DocumentsQueue;
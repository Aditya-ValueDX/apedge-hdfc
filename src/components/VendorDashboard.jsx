import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, TrendingUp, BarChart2, ChevronDown, Filter, X, Info, Calendar } from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';
import { useSelector } from 'react-redux';
import axios from '../utils/authInterceptor';
import StatusCard, { resetUsedIcons, BalancedCardGrid } from '../components/common/StatusCard';
import { useNavigate } from 'react-router-dom'; // NEW - for step filter navigation
import useVendorStats from '../hooks/useVendorStats';
import useVendorInsights from '../hooks/useVendorInsights'; // NEW
import useVendorWorkflow from '../hooks/useVendorWorkflow';
import WorkflowMissing from './common/Vendor/WorkflowMissing';
import AdvancedFilterPanel from './common/AdvancedFilterPanel';

// ─────────────────────────────────────────────────────────────────────────────
// -- Existing colors - untouched
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = {
    total: { hex: '#5d76cb', bg: 'bg-blue-50', cardBg: '#EFF6FF', iconHex: '#1D4ED8' },
    completed: { hex: '#56ae76', bg: 'bg-green-50', cardBg: '#F0FDF4', iconHex: '#15803D' },
    rejected: { hex: '#eb8484', bg: 'bg-red-50', cardBg: '#FEF2F2', iconHex: '#B91C1C' },
    pending: { hex: '#e4b149', bg: 'bg-yellow-50', cardBg: '#FEFCE8', iconHex: '#A16207' },
};

// ─────────────────────────────────────────────────────────────────────────────
// -- Date helpers (same pattern as Dashboard.jsx)
// ─────────────────────────────────────────────────────────────────────────────
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
    return date instanceof Date && !isNaN(date) && date.toISOString().slice(0, 10) === dateString;
};

// ─────────────────────────────────────────────────────────────────────────────
// -- Filter field definitions for AdvancedFilterPanel (date-only for vendors)
// ─────────────────────────────────────────────────────────────────────────────
const VENDOR_FILTER_FIELDS = [
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
];

/**
 * Formats a raw current_step string into a readable label.
 * Removes underscores and Title Cases — preserves the "step" prefix.
 * e.g. "step_finance_review"    -> "Step Finance Review"
 *      "step_compliance_review" -> "Step Compliance Review"
 *      "STEP_FINANCE_REVIEW"    -> "Step Finance Review"
 *      "step_initiate"          -> "Step Initiate"
 */
const formatStepLabel = (step) => {
    // Removes underscores and Title Cases each word.
    // Preserves the 'step' prefix so e.g. "step_finance_review" -> "Step Finance Review".
    return step
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Converts a snake_case DB column key into a readable label.
 * e.g. "vendor_name" -> "Vendor Name"  |  "created_at" -> "Created At"
 */
const formatColumnLabel = (key) => {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Formats an ISO timestamp into a readable date string → "20/03/2026"
 */
const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB');
};

/**
 * Returns Tailwind badge classes for a given vendor status string.
 */
const getStatusBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('approved')) return 'bg-green-100 text-green-700';
    if (s.includes('rejected')) return 'bg-red-100 text-red-700';
    if (s.includes('submitted')) return 'bg-blue-100 text-blue-700';
    if (s.includes('draft')) return 'bg-yellow-100 text-yellow-700';
    if (s.includes('sap') || s.includes('creation')) return 'bg-purple-100 text-purple-700';
    if (s.includes('compliance')) return 'bg-indigo-100 text-indigo-700';
    return 'bg-gray-100 text-gray-600';
};

// ─────────────────────────────────────────────────────────────────────────────
// -- Existing: Recent Vendors table column definitions - untouched
// ─────────────────────────────────────────────────────────────────────────────
const RECENT_VENDOR_COLUMNS = [
    { key: 'vendor_name' },
    { key: 'vendor_type' },
    { key: 'status', isStatus: true },
    { key: 'created_at', isDate: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// -- Existing: RecentVendorsTable - untouched
// ─────────────────────────────────────────────────────────────────────────────
const RecentVendorsTable = ({ rows, loading }) => {
    if (loading) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                ))}
            </div>
        );
    }

    if (!rows || rows.length === 0) {
        return (
            <p className="text-xs text-gray-400 text-center py-8">
                No vendors found.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[10px]">
                <thead>
                    <tr>
                        {RECENT_VENDOR_COLUMNS.map((col) => (
                            <th
                                key={col.key}
                                className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide bg-slate-50 border-b border-gray-200 whitespace-nowrap first:rounded-tl-lg last:rounded-tr-lg"
                            >
                                {col.label ?? formatColumnLabel(col.key)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr
                            key={row.vendor_id ?? idx}
                            className={`
                                border-b border-gray-100 transition-colors duration-150
                                hover:bg-slate-50
                                ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                                ${idx === rows.length - 1 ? 'border-b-0' : ''}
                            `}
                        >
                            {RECENT_VENDOR_COLUMNS.map((col) => {
                                const raw = row[col.key];

                                if (col.isDate) {
                                    return (
                                        <td key={col.key} className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                                            {formatDate(raw)}
                                        </td>
                                    );
                                }

                                if (col.isStatus) {
                                    return (
                                        <td key={col.key} className="px-3 py-2.5 whitespace-nowrap">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusBadgeClass(raw)}`}>
                                                {raw || '—'}
                                            </span>
                                        </td>
                                    );
                                }

                                return (
                                    <td
                                        key={col.key}
                                        className="px-3 py-2.5 text-gray-700 max-w-[160px] truncate"
                                        title={raw || ''}
                                    >
                                        {raw || '—'}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// -- PendingCard
// All tooltip logic moved into StatusCard via infoTooltip + onFormatStep props.
// PendingCard is now a thin wrapper — no local hover state needed.
// ─────────────────────────────────────────────────────────────────────────────
const PendingCard = ({ value, color, loading, pendingBreakdown }) => {
    const breakdownEntries = Object.entries(pendingBreakdown || {});

    return (
        <StatusCard
            label="In Progress"
            value={value}
            color={color}
            statusType="pending"
            infoTooltip={!loading && breakdownEntries.length > 0 ? breakdownEntries : null}
            onFormatStep={formatStepLabel}
        />
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// -- NEW: VendorTrendGraph
//
// Modeled after DailyRequests.jsx but scoped to ap_vendors.created_at.
// Fetches vendor rows for the selected time range, aggregates client-side,
// and renders a Recharts LineChart + Area — same visual style as DailyRequests.
//
// Uses:
//   - user.token  from state.auth.user  (matches VendorDashboard pattern)
//   - user.tenantId from state.auth.user
//   - ap_vendors?tenant_id=eq.{id}&created_at=gte.{start}&created_at=lte.{end}&select=vendor_id,created_at
//
// Time ranges: Today (hourly) | Weekly (day-of-week) | Monthly (day-of-month)
//            | Quarterly (Q1-Q4) | Yearly (Jan-Dec)
// ─────────────────────────────────────────────────────────────────────────────
const TIME_RANGE_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
];

const VendorTrendGraph = ({ externalDateFilter = null }) => {
    const user = useSelector(state => state.auth.user);
    console.log(user);
    const token = user?.token;
    const tenantId = user?.tenantId;

    const [timeRange, setTimeRange] = useState('monthly');
    const [chartData, setChartData] = useState([]);
    const [graphLoading, setGraphLoading] = useState(false);
    const [graphError, setGraphError] = useState(null);

    // True when the parent has supplied an explicit date range via the filter panel.
    // When active the internal time-range selector is hidden and the graph uses
    // the external dates instead of its own range helpers.
    const isExternalFilter =
        externalDateFilter &&
        (externalDateFilter.fromDate || externalDateFilter.toDate);

    // -- Date-range helpers (same logic as DailyRequests) ---------------------
    const getTodayRange = useCallback(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return { start, end };
    }, []);

    const getWeekRange = useCallback(() => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 6, 23, 59, 59, 999);
        return { start, end };
    }, []);

    const getMonthRange = useCallback(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start, end };
    }, []);

    const getQuarterRange = useCallback(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start, end };
    }, []);

    const getYearRange = useCallback(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start, end };
    }, []);

    const getDateRange = useCallback((range) => {
        switch (range) {
            case 'today': return getTodayRange();
            case 'weekly': return getWeekRange();
            case 'monthly': return getMonthRange();
            case 'quarterly': return getQuarterRange();
            case 'yearly': return getYearRange();
            default: return getMonthRange();
        }
    }, [getTodayRange, getWeekRange, getMonthRange, getQuarterRange, getYearRange]);

    // -- Aggregate raw vendor rows into chart-ready data ----------------------
    const aggregateRows = useCallback((rows, range, start) => {
        if (range === 'today') {
            // Bucket by hour 0-23
            const counts = {};
            rows.forEach(r => {
                try {
                    const d = new Date(r.created_at);
                    if (isNaN(d)) return;
                    const h = d.getHours();
                    counts[h] = (counts[h] || 0) + 1;
                } catch { /* ignore */ }
            });
            return Array.from({ length: 24 }, (_, i) => ({
                hour: i + 1,
                vendors: counts[i] || 0,
            }));
        }

        if (range === 'weekly') {
            const counts = {};
            rows.forEach(r => {
                try {
                    const d = new Date(r.created_at);
                    if (isNaN(d)) return;
                    const day = d.getDay();
                    counts[day] = (counts[day] || 0) + 1;
                } catch { /* ignore */ }
            });
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return Array.from({ length: 7 }, (_, i) => ({
                day: dayNames[i],
                vendors: counts[i] || 0,
            }));
        }

        if (range === 'monthly') {
            const counts = {};
            rows.forEach(r => {
                try {
                    const d = new Date(r.created_at);
                    if (isNaN(d)) return;
                    const day = d.getDate();
                    counts[day] = (counts[day] || 0) + 1;
                } catch { /* ignore */ }
            });
            const daysInMonth = new Date(
                start.getFullYear(), start.getMonth() + 1, 0
            ).getDate();
            return Array.from({ length: daysInMonth }, (_, i) => ({
                day: i + 1,
                vendors: counts[i + 1] || 0,
            }));
        }

        if (range === 'quarterly') {
            const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
            rows.forEach(r => {
                try {
                    const d = new Date(r.created_at);
                    if (isNaN(d)) return;
                    const qi = Math.floor(d.getMonth() / 3);
                    counts[qi] = (counts[qi] || 0) + 1;
                } catch { /* ignore */ }
            });
            return Array.from({ length: 4 }, (_, i) => ({
                quarter: `Q${i + 1}`,
                vendors: counts[i] || 0,
            }));
        }

        if (range === 'yearly') {
            const counts = {};
            rows.forEach(r => {
                try {
                    const d = new Date(r.created_at);
                    if (isNaN(d)) return;
                    const m = d.getMonth();
                    counts[m] = (counts[m] || 0) + 1;
                } catch { /* ignore */ }
            });
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return Array.from({ length: 12 }, (_, i) => ({
                month: monthNames[i],
                vendors: counts[i] || 0,
            }));
        }

        return [];
    }, []);

    // -- Aggregate rows for an arbitrary date range (external filter) ---------
    // Buckets by calendar day. Each point: { date: 'DD/MM', vendors: N }
    const aggregateCustomRange = useCallback((rows, start, end) => {
        // Build a map of date-string → count
        const counts = {};
        rows.forEach(r => {
            try {
                const d = new Date(r.created_at);
                if (isNaN(d)) return;
                // Key by DD/MM so the X-axis stays readable
                const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                counts[key] = (counts[key] || 0) + 1;
            } catch { /* ignore */ }
        });

        // Generate every calendar day in the range so gaps show as 0
        const result = [];
        const cursor = new Date(start);
        cursor.setHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setHours(23, 59, 59, 999);

        while (cursor <= endDay) {
            const key = `${String(cursor.getDate()).padStart(2, '0')}/${String(cursor.getMonth() + 1).padStart(2, '0')}`;
            result.push({ date: key, vendors: counts[key] || 0 });
            cursor.setDate(cursor.getDate() + 1);
        }
        return result;
    }, []);
    // -- Fetch vendors — uses external date range when supplied, internal otherwise
    useEffect(() => {
        const isSuperAdmin = user?.role === 'super_admin';
        if (!token || (!isSuperAdmin && !tenantId)) return;

        const fetchVendorTrend = async () => {
            setGraphLoading(true);
            setGraphError(null);
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const tenantFilter = isSuperAdmin ? `` : `&tenant_id=eq.${tenantId}`;

                let start, end;
                if (isExternalFilter) {
                    // Use dates supplied by the dashboard filter panel
                    start = externalDateFilter.fromDate
                        ? new Date(externalDateFilter.fromDate)
                        : new Date(new Date().setMonth(new Date().getMonth() - 1));
                    end = externalDateFilter.toDate
                        ? new Date(externalDateFilter.toDate)
                        : new Date();
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                } else {
                    // Use the internal time-range selector — existing behaviour
                    ({ start, end } = getDateRange(timeRange));
                }

                const url =
                    `/api/v1/tables/ap_vendors` +
                    `?created_at=gte.${start.toISOString()}` +
                    `&created_at=lte.${end.toISOString()}` +
                    tenantFilter +
                    `&select=vendor_id,created_at`;

                const res = await axios.get(url, config);
                const rows = res.data || [];

                if (isExternalFilter) {
                    setChartData(aggregateCustomRange(rows, start, end));
                } else {
                    setChartData(aggregateRows(rows, timeRange, start));
                }
            } catch (err) {
                console.error('[VendorTrendGraph] fetch error:', err);
                setGraphError('Failed to load vendor trend data.');
            } finally {
                setGraphLoading(false);
            }
        };

        fetchVendorTrend();
    }, [
        user, token, tenantId, timeRange,
        isExternalFilter,
        externalDateFilter?.fromDate,
        externalDateFilter?.toDate,
        getDateRange, aggregateRows, aggregateCustomRange,
    ]);

    // -- Dynamic X-axis key and labels (same pattern as DailyRequests) --------
    const xKey = useMemo(() => {
        if (isExternalFilter) return 'date';
        if (timeRange === 'today') return 'hour';
        if (timeRange === 'weekly') return 'day';
        if (timeRange === 'monthly') return 'day';
        if (timeRange === 'quarterly') return 'quarter';
        return 'month';
    }, [timeRange, isExternalFilter]);

    const xAxisLabel = useMemo(() => {
        if (isExternalFilter) return 'Date';
        if (timeRange === 'today') return 'Hour';
        if (timeRange === 'weekly') return 'Day';
        if (timeRange === 'monthly') return 'Date';
        if (timeRange === 'quarterly') return 'Quarter';
        return 'Month';
    }, [timeRange, isExternalFilter]);

    const displayTitle = useMemo(() => {
        if (isExternalFilter) {
            const from = externalDateFilter.fromDate
                ? new Date(externalDateFilter.fromDate).toLocaleDateString('en-GB')
                : '—';
            const to = externalDateFilter.toDate
                ? new Date(externalDateFilter.toDate).toLocaleDateString('en-GB')
                : '—';
            return `Vendors — ${from} to ${to}`;
        }
        const now = new Date();
        if (timeRange === 'today') {
            return `Vendors Today — ${now.toLocaleDateString('en-GB')}`;
        }
        if (timeRange === 'weekly') {
            const { start, end } = getDateRange('weekly');
            return `Vendors This Week — ${start.toLocaleDateString('en-GB')} to ${end.toLocaleDateString('en-GB')}`;
        }
        if (timeRange === 'monthly') {
            const monthName = now.toLocaleString('en-IN', { month: 'long' });
            return `Vendors in ${monthName} ${now.getFullYear()}`;
        }
        if (timeRange === 'quarterly') {
            return `Vendors in ${now.getFullYear()} by Quarter`;
        }
        return `Vendors in ${now.getFullYear()}`;
    }, [timeRange, getDateRange, isExternalFilter, externalDateFilter]);

    // -- Chart height (same scaling logic as DailyRequests) -------------------
    const chartHeight = useMemo(() => {
        const base = 120;
        const increment = timeRange === 'today' ? 10
            : timeRange === 'weekly' ? 12
                : timeRange === 'monthly' ? 8
                    : timeRange === 'quarterly' ? 30
                        : 12;
        const scaled = Math.min(180, (chartData?.length || 0) * increment + 50);
        return Math.max(base, scaled);
    }, [chartData, timeRange]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col min-h-[200px]">
            {/* -- Header row ------------------------------------------------ */}
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <TrendingUp size={15} className="text-green-500" />
                    {displayTitle}
                </h3>

                {/* Time-range selector — hidden when external date filter is active */}
                {!isExternalFilter && (
                    <div className="relative">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="py-0.5 px-2 pr-6 rounded-md border border-gray-300 bg-white text-black text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                        >
                            {TIME_RANGE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <ChevronDown
                            size={13}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                        />
                    </div>
                )}
            </div>

            {/* -- Chart body ------------------------------------------------ */}
            <div className="flex-1 mt-2">
                {graphError ? (
                    <div className="text-xs text-red-500 text-center py-6">{graphError}</div>
                ) : graphLoading ? (
                    <div className="flex items-center justify-center h-32 gap-2 text-xs text-indigo-500">
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                        Loading…
                    </div>
                ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <LineChart
                            data={chartData}
                            margin={{ top: 8, right: 8, left: 25, bottom: 25 }}
                        >
                            <defs>
                                <linearGradient id="vendorLineGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#5d76cb" stopOpacity={0.9} />
                                    <stop offset="100%" stopColor="#5d76cb" stopOpacity={0.08} />
                                </linearGradient>
                            </defs>

                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#e5e7eb"
                                vertical={false}
                            />

                            <XAxis
                                dataKey={xKey}
                                stroke="#9ca3af"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                label={{
                                    value: xAxisLabel,
                                    position: 'bottom',
                                    offset: 10,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    fill: '#4b5563',
                                }}
                            />

                            <YAxis
                                stroke="#9ca3af"
                                fontSize={11}
                                allowDecimals={false}
                                tickLine={false}
                                axisLine={false}
                                label={{
                                    value: 'Vendors',
                                    angle: -90,
                                    position: 'left',
                                    offset: 10,
                                    fontSize: 11,
                                    fontWeight: 500,
                                    fill: '#4b5563',
                                }}
                            />

                            <Tooltip
                                cursor={{ stroke: 'rgba(236, 240, 241, 0.9)', strokeWidth: 10 }}
                                contentStyle={{
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    backdropFilter: 'blur(5px)',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
                                    fontSize: '11px',
                                }}
                                formatter={(value) => [`${value} vendor${value !== 1 ? 's' : ''}`, 'Count']}
                                labelFormatter={(label) => {
                                    if (timeRange === 'today') return `Hour ${label}:00`;
                                    if (timeRange === 'weekly') return `Day: ${label}`;
                                    if (timeRange === 'monthly') return `Day ${label}`;
                                    if (timeRange === 'quarterly') return `Quarter: ${label}`;
                                    return `Month: ${label}`;
                                }}
                            />

                            {/* Area fill below the line */}
                            <Area
                                type="monotone"
                                dataKey="vendors"
                                stroke="none"
                                fill="url(#vendorLineGradient)"
                            />

                            {/* Main trend line */}
                            <Line
                                type="monotone"
                                dataKey="vendors"
                                stroke="#5d76cb"
                                strokeWidth={1.5}
                                dot={{ r: 2.5 }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                        <BarChart2 size={36} className="mb-2" />
                        <p className="text-xs font-medium">No vendor data for selected period</p>
                    </div>
                )}
            </div>
        </div>
    );
};


// ─────────────────────────────────────────────────────────────────────────────
// -- NEW: WorkflowInsights
// Combines Feature 2 (Step Bottleneck), Feature 4 (Vendor Type Distribution),
// and Feature 6 (Recently Rejected Vendors) into one self-contained section.
// Uses useVendorInsights hook — zero impact on useVendorStats or any existing logic.
// ─────────────────────────────────────────────────────────────────────────────

// Colour palette for the vendor type donut chart
const PIE_COLORS = ['#5d76cb', '#56ae76', '#e4b149', '#eb8484', '#8a7de6', '#4fbccd', '#f97316'];

/**
 * WorkflowInsights
 * Renders three panels in a responsive grid:
 *   Left  : Step Bottleneck table (from pendingBreakdown already in useVendorStats)
 *   Right : Vendor Type donut chart (from useVendorInsights)
 *   Bottom: Recently Rejected vendors table (from useVendorInsights)
 */
const WorkflowInsights = ({ pendingBreakdown, statsLoading }) => {
    const navigate = useNavigate(); // NEW - navigate to vendor_queue with step filter
    const { insights, insightsLoading, insightsError, refetchInsights } =
        useVendorInsights();

    const loading = statsLoading || insightsLoading;

    // ── Step Bottleneck: sort by count desc ──────────────────────────────────
    const bottleneckRows = Object.entries(pendingBreakdown || {})
        .sort((a, b) => b[1] - a[1]);

    // ── Vendor Type donut data ───────────────────────────────────────────────
    const typeEntries = Object.entries(
        insights?.vendorTypeDistribution || {}
    ).sort((a, b) => b[1] - a[1]);

    const pieData = typeEntries.map(([name, value]) => ({ name, value }));

    // ── Recently Rejected ───────────────────────────────────────────────────
    const recentlyRejected = insights?.recentlyRejected || [];

    // Skeleton row helper
    const SkeletonRows = ({ count = 4 }) => (
        <div className="space-y-2 mt-2">
            {[...Array(count)].map((_, i) => (
                <div key={i} className="h-7 bg-gray-100 rounded-lg animate-pulse" />
            ))}
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
            {/* Section header */}
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800 pl-1">
                    Vendor Onboarding Insights
                </h3>
                {insightsError && !insightsLoading && (
                    <button
                        onClick={refetchInsights}
                        className="text-[11px] text-indigo-600 hover:underline"
                    >
                        Retry
                    </button>
                )}
            </div>

            {/* ── Top row: Bottleneck + Type Distribution ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Left: Step Bottleneck Table */}
                <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Pending by Step
                    </p>
                    {loading ? (
                        <SkeletonRows count={4} />
                    ) : bottleneckRows.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">
                            No pending vendors.
                        </p>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr>
                                    <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-400 uppercase">
                                        Step
                                    </th>
                                    <th className="text-right py-1.5 px-2 text-[10px] font-semibold text-gray-400 uppercase">
                                        Pending
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {bottleneckRows.map(([step, count], idx) => (
                                    <tr
                                        key={step}
                                        className={`border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : ''}`}
                                    >
                                        <td className="py-2 px-2 text-gray-700 max-w-[180px] truncate" title={formatStepLabel(step)}>
                                            {formatStepLabel(step)}
                                        </td>
                                        <td className="py-2 px-2 text-right">
                                            {/* Clicking navigates to /vendor_queue with the raw step key as filter state */}
                                            <button
                                                // onClick={() => navigate('/vendor_queue', { state: { filterStep: step } })}
                                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700 hover:bg-yellow-200 cursor-pointer transition-colors"
                                                title={`View vendors at ${formatStepLabel(step)}`}
                                            >
                                                {count}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Right: Vendor Type Distribution Donut */}
                <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Vendor Type Distribution
                    </p>
                    {insightsLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                        </div>
                    ) : pieData.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">
                            No vendor type data.
                        </p>
                    ) : (
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={70}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        fontSize: '11px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                    }}
                                    formatter={(value, name) => [`${value} vendor${value !== 1 ? 's' : ''}`, name]}
                                />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Bottom row: Recently Rejected Vendors Table ── */}
            {/* <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Recently Rejected Vendors
                </p>
                {insightsLoading ? (
                    <SkeletonRows count={3} />
                ) : recentlyRejected.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">
                        No rejected vendors found.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr>
                                    {['Vendor Name', 'Type', 'Status', 'Comments', 'Date'].map(h => (
                                        <th
                                            key={h}
                                            className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-slate-50 border-b border-gray-200 whitespace-nowrap"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentlyRejected.map((row, idx) => (
                                    <tr
                                        key={row.vendor_id ?? idx}
                                        className={`border-b border-gray-100 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} ${idx === recentlyRejected.length - 1 ? 'border-b-0' : ''}`}
                                    >
                                        <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate" title={row.vendor_name || ''}>
                                            {row.vendor_name || '—'}
                                        </td>
                                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                                            {row.vendor_type || '—'}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusBadgeClass(row.status)}`}>
                                                {row.status || '—'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate" title={row.comments || ''}>
                                            {row.comments || '—'}
                                        </td>
                                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                                            {formatDate(row.created_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div> */}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// -- VendorDashboard - layout only changed (graph inserted above table)
// ─────────────────────────────────────────────────────────────────────────────
const VendorDashboard = () => {
    const user = useSelector(state => state.auth.user);

    // ── Filter state — mirrors Dashboard.jsx pattern exactly ─────────────────
    const defaultFilters = useMemo(() => ({ fromDate: '', toDate: '' }), []);

    const [draftFilters, setDraftFilters] = useState(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [showNotePopover, setShowNotePopover] = useState(false);
    const noteRef = useRef(null);

    // True while no explicit dates have been set — implicit 1-month window
    const [isDefaultDateRange, setIsDefaultDateRange] = useState(
        () => !defaultFilters.fromDate && !defaultFilters.toDate
    );

    // Keep draft in sync when applied filters change
    useEffect(() => {
        setDraftFilters(appliedFilters);
    }, [appliedFilters]);

    // Close popover on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (noteRef.current && !noteRef.current.contains(e.target)) {
                setShowNotePopover(false);
            }
        };
        if (showNotePopover) document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showNotePopover]);

    const handleFilterChange = (key, value) => {
        setDraftFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleApplyFilters = () => {
        setAppliedFilters(draftFilters);
        if (draftFilters.fromDate || draftFilters.toDate) setIsDefaultDateRange(false);
        setIsFilterPanelOpen(false);
    };

    // onClearAll — clears all fields, keeps isDefaultDateRange unchanged
    const handleClearAll = (newValues) => {
        setDraftFilters(newValues);
        setAppliedFilters(newValues);
        setIsFilterPanelOpen(false);
    };

    // onClearDefaults — zeroes default date fields, sets isDefaultDateRange false
    const handleClearDefaults = (newValues) => {
        setDraftFilters(newValues);
        setAppliedFilters(newValues);
        setIsDefaultDateRange(false);
        setIsFilterPanelOpen(false);
    };

    const resetFilters = () => {
        setDraftFilters(defaultFilters);
        setAppliedFilters(defaultFilters);
        setIsDefaultDateRange(true);
    };

    // hasActiveFilters — don't treat the known default dates as active
    const hasActiveFilters = useMemo(() => {
        const knownDefaults = { fromDate: getOneMonthAgoDate(), toDate: getTodayDate() };
        return Object.entries(appliedFilters).some(([key, value]) => {
            if (!value) return false;
            if (knownDefaults[key] && value === knownDefaults[key]) return false;
            return true;
        });
    }, [appliedFilters]);

    // Effective date range — explicit if set, otherwise implicit 1-month default
    const effectiveDateFilter = useMemo(() => ({
        fromDate: appliedFilters.fromDate || (isDefaultDateRange ? getOneMonthAgoDate() : ''),
        toDate: appliedFilters.toDate || (isDefaultDateRange ? getTodayDate() : ''),
    }), [appliedFilters, isDefaultDateRange]);

    // ── Hooks — now receive dateFilter ───────────────────────────────────────
    const { stats, loading, error, refetch } = useVendorStats(effectiveDateFilter);
    const { workflowConfigMissing, loading: workflowLoading } = useVendorWorkflow();

    // Reset icon tracking so VendorDashboard gets a clean set of icons
    // -- Existing call - untouched --
    resetUsedIcons();

    // -- Existing cards config - untouched ------------------------------------
    const statusCardsConfig = [
        {
            id: 'total',
            label: 'Total Vendors',
            value: loading ? '—' : (stats?.total ?? 0),
            color: COLORS.total,
            statusType: 'total',
        },
        {
            id: 'pending',
            label: 'Pending',
            value: loading ? '—' : (stats?.pending ?? 0),
            color: COLORS.pending,
            statusType: 'pending',
            isPending: true,
        },
        {
            id: 'completed',
            label: 'Completed',
            value: loading ? '—' : (stats?.completed ?? 0),
            color: COLORS.completed,
            statusType: 'completed',
        },
        {
            id: 'rejected',
            label: 'Rejected',
            value: loading ? '—' : (stats?.rejected ?? 0),
            color: COLORS.rejected,
            statusType: 'rejected',
        },
    ];

    const recentVendors = stats?.recentVendors ?? [];

    if (!workflowLoading && workflowConfigMissing && user?.role !== 'super_admin') {
        return <WorkflowMissing pageName="Vendor Dashboard" />;
    }

    return (
        <>
            {/* ── Advanced Filter Panel — same as Dashboard ─────────────────── */}
            <AdvancedFilterPanel
                isOpen={isFilterPanelOpen}
                onClose={() => setIsFilterPanelOpen(false)}
                filterFields={VENDOR_FILTER_FIELDS}
                values={draftFilters}
                onChange={handleFilterChange}
                onApply={handleApplyFilters}
                onClearAll={handleClearAll}
                onClearDefaults={handleClearDefaults}
            />

            <div
                className="min-h-screen bg-slate-50 p-4 sm:p-4"
                style={{ fontFamily: 'Poppins, sans-serif' }}
            >
                <div className="mx-auto">
                    <div className="mb-4 relative z-20">

                        {/* -- Header -------------------------------------------- */}
                        <div className="flex flex-wrap items-center gap-y-2 mb-4">
                            <h2 className="text-base font-semibold text-gray-800 flex-shrink-0">
                                Vendor Summary
                            </h2>

                            {/* Centre: default date-range badge — same as Dashboard */}
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
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-64 sm:w-72 bg-white border border-blue-100 rounded-lg shadow-xl p-3.5 text-xs">
                                                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-blue-100 rotate-45 block" />
                                                <p className="flex items-center gap-1 font-medium text-blue-700 mb-1.5">
                                                    <Info size={12} /> Default Date Filter Active
                                                </p>
                                                <p className="text-gray-600 leading-relaxed">
                                                    Vendors are currently filtered to the{' '}
                                                    <span className="font-medium text-gray-800">last 1 month</span>{' '}
                                                    ({getOneMonthAgoDate()} → {getTodayDate()}) by default.
                                                    To view a different range, open{' '}
                                                    <span className="font-medium text-indigo-600">Filters</span>{' '}
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
                                    <button
                                        onClick={resetFilters}
                                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded-md bg-white hover:bg-red-50 transition-colors"
                                    >
                                        <X size={12} />
                                        <span className="hidden sm:inline">Clear Filters</span>
                                        <span className="sm:hidden">Clear</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (isDefaultDateRange) {
                                            setDraftFilters(prev => ({
                                                ...prev,
                                                fromDate: prev.fromDate || getOneMonthAgoDate(),
                                                toDate: prev.toDate || getTodayDate(),
                                            }));
                                        }
                                        setIsFilterPanelOpen(true);
                                        setShowNotePopover(false);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                                >
                                    <Filter size={12} />
                                    <span className="hidden sm:inline">Filter Dashboard</span>
                                    <span className="sm:hidden">Filters</span>
                                </button>
                                <button
                                    onClick={refetch}
                                    disabled={loading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-md bg-white hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                                    <span className="hidden sm:inline">
                                        {loading ? 'Loading...' : 'Refresh'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* -- Error banner - untouched -------------------------- */}
                        {error && !loading && (
                            <div className="mb-3 px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                                Failed to load vendor statistics. Please try refreshing.
                            </div>
                        )}

                        {/* -- Status Cards - untouched -------------------------- */}
                        <BalancedCardGrid
                            items={statusCardsConfig}
                            renderCard={(stat) => {
                                if (stat.isPending) {
                                    return (
                                        <PendingCard
                                            key={stat.id}
                                            value={stat.value}
                                            color={stat.color}
                                            loading={loading}
                                            pendingBreakdown={stats?.pendingBreakdown ?? {}}
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
                    </div>

                    {/* -- Vendor Trend Graph ------------------------------------ */}
                    <div className="mb-4">
                        <VendorTrendGraph externalDateFilter={effectiveDateFilter} />
                    </div>

                    {/* -- Workflow Insights ------------------------------------- */}
                    <div className="mb-4">
                        <WorkflowInsights
                            pendingBreakdown={stats?.pendingBreakdown ?? {}}
                            statsLoading={loading}
                        />
                    </div>

                    {/* -- Recent Vendors Table - untouched ---------------------- */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                        <h3 className="text-sm font-semibold text-gray-800 mb-2">
                            Recent Vendors
                        </h3>
                        <RecentVendorsTable
                            rows={recentVendors}
                            loading={loading}
                        />
                    </div>

                </div>
            </div>
        </>
    );
};

export default VendorDashboard;
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from '../utils/authInterceptor';
import {
    RefreshCw, Filter, X, Info, Calendar, TrendingUp, Download,
    Printer, FileText, CheckCircle, XCircle, Clock, Send,
    AlertTriangle, BarChart2, Users, Shield, ChevronDown,
    ArrowUpRight, Activity, Layers
} from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart, Line,
    AreaChart, Area,
    BarChart, Bar,
    XAxis, YAxis, CartesianGrid,
    Tooltip, Legend,
    PieChart, Pie, Cell,
} from 'recharts';
import useChurnStats from '../hooks/useChurnStats';
import StatusCard, { resetUsedIcons, BalancedCardGrid } from '../components/common/StatusCard';

// ─── Color Palette ────────────────────────────────────────────────────────────
const PALETTE = {
    total:    { hex: '#6366f1', bg: 'bg-indigo-50', cardBg: '#eef2ff', iconHex: '#4338ca' },
    submitted:{ hex: '#0ea5e9', bg: 'bg-sky-50',    cardBg: '#f0f9ff', iconHex: '#0369a1' },
    approved: { hex: '#22c55e', bg: 'bg-green-50',  cardBg: '#f0fdf4', iconHex: '#15803d' },
    rejected: { hex: '#ef4444', bg: 'bg-red-50',    cardBg: '#fef2f2', iconHex: '#b91c1c' },
    pending:  { hex: '#f59e0b', bg: 'bg-amber-50',  cardBg: '#fffbeb', iconHex: '#b45309' },
    progress: { hex: '#8b5cf6', bg: 'bg-violet-50', cardBg: '#f5f3ff', iconHex: '#6d28d9' },
};

const CHART_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#6366f1', '#0ea5e9', '#8b5cf6'];
const PIE_COLORS  = { Approved: '#22c55e', Rejected: '#ef4444', Submitted: '#0ea5e9', Other: '#f59e0b' };

// ─── Date Helpers ─────────────────────────────────────────────────────────────
const getOneMonthAgoDate = () => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
};
const getTodayDate = () => new Date().toISOString().split('T')[0];

// ─── Formatters ───────────────────────────────────────────────────────────────
const formatDate = (val) => {
    if (!val) return '—';
    const d = new Date(val);
    return isNaN(d) ? String(val) : d.toLocaleDateString('en-GB');
};

const getStatusStyle = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') return 'bg-green-100 text-green-700 border border-green-200';
    if (s === 'REJECTED') return 'bg-red-100 text-red-700 border border-red-200';
    if (s === 'SUBMITTED') return 'bg-sky-100 text-sky-700 border border-sky-200';
    if (s === 'REVERTED') return 'bg-amber-100 text-amber-700 border border-amber-200';
    return 'bg-gray-100 text-gray-600 border border-gray-200';
};

// ─── Role labels ──────────────────────────────────────────────────────────────
const ROLE_LABELS = {
    L1: 'SLA User',
    L2: 'Channel SPOC',
    L3: 'Admin',
    super_admin: 'Super Admin',
};

const ROLE_ACCESS = {
    L1: ['Submit new policies for SPOC review', 'Edit & resubmit reverted policies', 'Upload supporting documents', 'View policy status & audit trail'],
    L2: ['Review policies submitted by SLA users', 'Approve and forward policies to Admin', 'Revert policies back to SLA user for corrections', 'Upload SPOC review documents', 'Manage SLA users under your channel', 'View user-wise performance analytics'],
    L3: ['Final approval or rejection of policies', 'Revert policies back to SPOC for review', 'View all channels and policies', 'Manage all users (SPOC & SLA)', 'Access reports & analytics across channels'],
    super_admin: ['Full system access', 'View all tenants', 'Manage all configurations'],
};

const ACCESS_ICON_MAP = {
    'Submit': Send, 'Edit': TrendingUp, 'Upload': FileText, 'View': Shield,
    'Review': Shield, 'Approve': CheckCircle, 'Revert': RefreshCw,
    'Final': Shield, 'Manage': Users, 'Access': BarChart2, 'Full': Layers,
};

const getAccessIcon = (text) => {
    for (const [key, Icon] of Object.entries(ACCESS_ICON_MAP)) {
        if (text.includes(key)) return Icon;
    }
    return Shield;
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-xl p-3 text-xs min-w-[120px]">
            <p className="font-semibold text-gray-700 mb-2">{label}</p>
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
                        <span className="text-gray-500">{entry.name}</span>
                    </span>
                    <span className="font-bold text-gray-800">{entry.value}</span>
                </div>
            ))}
        </div>
    );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
    <div className={`animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 rounded-lg ${className}`} />
);

// ─── Recent Policies Table ────────────────────────────────────────────────────
const RecentPoliciesTable = ({ rows, loading }) => {
    if (loading) return (
        <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9" />)}
        </div>
    );
    if (!rows?.length) return <p className="text-xs text-gray-400 text-center py-8">No policies found.</p>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
                <thead>
                    <tr>
                        {['New Policy #', 'Old Policy #', 'FLS Name', 'Channel', 'Status', 'Date'].map(h => (
                            <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/80 border-b border-gray-100">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr key={row.churn_policy_id ?? idx}
                            className={`border-b border-gray-50 hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                            <td className="px-3 py-2.5 font-medium text-gray-800">{row.new_policy_number || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-500">{row.old_policy_number || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-600">{row.fls_name || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-500">{row.old_channel || '—'}</td>
                            <td className="px-3 py-2.5">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusStyle(row.policy_status)}`}>
                                    {row.policy_status || '—'}
                                </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(row.created_at)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ─── Channel Breakdown Chart ──────────────────────────────────────────────────
const ChannelBreakdownChart = ({ channelBreakdown, loading }) => {
    const data = useMemo(() => {
        return Object.entries(channelBreakdown || {}).map(([channel, counts]) => ({
            channel: channel.length > 10 ? channel.slice(0, 10) + '…' : channel,
            fullChannel: channel,
            ...counts,
        }));
    }, [channelBreakdown]);

    if (loading) return <Skeleton className="h-64" />;
    if (!data.length) return <p className="text-xs text-gray-400 text-center py-12">No channel data available.</p>;

    return (
        <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="channel" fontSize={9} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                <Bar dataKey="approved" name="Approved" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" name="Rejected" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending"  name="Pending"  fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
};

// ─── Monthly Trend Chart ──────────────────────────────────────────────────────
const MonthlyTrendChart = ({ monthlyTrend, loading }) => {
    if (loading) return <Skeleton className="h-64" />;
    return (
        <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" fontSize={10} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                <Line type="monotone" dataKey="total"    stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} name="Total" />
                <Line type="monotone" dataKey="approved" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3, fill: '#22c55e' }} name="Approved" />
                <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} name="Rejected" />
            </LineChart>
        </ResponsiveContainer>
    );
};

// ─── Status Distribution Pie ──────────────────────────────────────────────────
const StatusPieChart = ({ stats, loading }) => {
    const data = useMemo(() => {
        if (!stats) return [];
        return [
            { name: 'Approved',  value: stats.approved  || 0 },
            { name: 'Rejected',  value: stats.rejected  || 0 },
            { name: 'Submitted', value: stats.submitted || 0 },
            { name: 'Other',     value: Math.max(0, (stats.total || 0) - (stats.approved || 0) - (stats.rejected || 0) - (stats.submitted || 0)) },
        ].filter(d => d.value > 0);
    }, [stats]);

    if (loading) return <Skeleton className="h-64" />;
    if (!data.length) return <p className="text-xs text-gray-400 text-center py-12">No data.</p>;

    return (
        <ResponsiveContainer width="100%" height={260}>
            <PieChart>
                <Pie
                    data={data} cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90}
                    paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false} fontSize={9} strokeWidth={0}
                >
                    {data.map((entry, i) => (
                        <Cell key={i} fill={PIE_COLORS[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '11px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
            </PieChart>
        </ResponsiveContainer>
    );
};

// ─── Date Filter Panel ────────────────────────────────────────────────────────
const DateFilterPanel = ({ isOpen, onClose, filters, onChange, onApply, onReset }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800">Filter Dashboard</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={16} className="text-gray-500" />
                    </button>
                </div>
                <div className="flex-1 p-5 space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            <Calendar size={11} className="inline mr-1" /> From Date
                        </label>
                        <input
                            type="date"
                            value={filters.fromDate || ''}
                            max={filters.toDate || getTodayDate()}
                            onChange={e => onChange('fromDate', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            <Calendar size={11} className="inline mr-1" /> To Date
                        </label>
                        <input
                            type="date"
                            value={filters.toDate || ''}
                            min={filters.fromDate || ''}
                            max={getTodayDate()}
                            onChange={e => onChange('toDate', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition"
                        />
                    </div>
                </div>
                <div className="p-5 border-t border-gray-100 space-y-2">
                    <button onClick={onApply}
                        className="w-full py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors">
                        Apply Filters
                    </button>
                    <button onClick={onReset}
                        className="w-full py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                        Reset to Default
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const ChurnDashboard = () => {
    const user = useSelector(state => state.auth.user);
    const userRole = user?.role || 'L1';

    // Date filter state
    const [appliedFilter, setAppliedFilter] = useState({
        fromDate: getOneMonthAgoDate(),
        toDate: getTodayDate(),
    });
    const [draftFilter, setDraftFilter] = useState({ ...appliedFilter });
    const [filterOpen, setFilterOpen] = useState(false);
    const [showNotePopover, setShowNotePopover] = useState(false);
    const noteRef = useRef(null);

    const isDefaultFilter = appliedFilter.fromDate === getOneMonthAgoDate() && appliedFilter.toDate === getTodayDate();
    const hasActiveFilters = appliedFilter.fromDate || appliedFilter.toDate;

    // Data
    const { stats, loading, error, refetch } = useChurnStats(appliedFilter);

    // Close popover on outside click
    useEffect(() => {
        const handler = (e) => {
            if (noteRef.current && !noteRef.current.contains(e.target)) setShowNotePopover(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleApplyFilter = () => {
        setAppliedFilter({ ...draftFilter });
        setFilterOpen(false);
    };
    const handleResetFilter = () => {
        const def = { fromDate: getOneMonthAgoDate(), toDate: getTodayDate() };
        setDraftFilter(def);
        setAppliedFilter(def);
        setFilterOpen(false);
    };
    const handleClearFilters = () => {
        const def = { fromDate: getOneMonthAgoDate(), toDate: getTodayDate() };
        setDraftFilter(def);
        setAppliedFilter(def);
    };

    // Access list for current role
    const accessList = ROLE_ACCESS[userRole] || ROLE_ACCESS.L1;
    const isAdmin = userRole === 'L3' || userRole === 'super_admin';
    const isSPOC = userRole === 'L2';

    // Status cards config
    resetUsedIcons();
    const statusCards = useMemo(() => [
        { id: 'total',    label: 'Total Policies',   value: loading ? '—' : (stats?.total || 0),         color: PALETTE.total,    statusType: 'total'    },
        { id: 'pending',  label: 'Pending with You', value: loading ? '—' : (stats?.pendingWithYou || 0), color: PALETTE.pending,  statusType: 'pending'  },
        { id: 'submitted',label: 'Submitted',        value: loading ? '—' : (stats?.submitted || 0),      color: PALETTE.submitted,statusType: 'sent'     },
        { id: 'approved', label: 'Approved',         value: loading ? '—' : (stats?.approved || 0),       color: PALETTE.approved, statusType: 'approved' },
        { id: 'rejected', label: 'Rejected',         value: loading ? '—' : (stats?.rejected || 0),       color: PALETTE.rejected, statusType: 'rejected' },
        { id: 'progress', label: 'In Progress',      value: loading ? '—' : (stats?.inProgress || 0),     color: PALETTE.progress, statusType: 'progress' },
    ], [stats, loading]);

    // Channel chart data
    const channelChartData = useMemo(() => {
        return Object.entries(stats?.channelBreakdown || {}).map(([ch, counts]) => ({
            channel: ch.length > 12 ? ch.slice(0, 12) + '…' : ch,
            ...counts,
        }));
    }, [stats]);

    return (
        <>
            <DateFilterPanel
                isOpen={filterOpen}
                onClose={() => setFilterOpen(false)}
                filters={draftFilter}
                onChange={(key, val) => setDraftFilter(prev => ({ ...prev, [key]: val }))}
                onApply={handleApplyFilter}
                onReset={handleResetFilter}
            />

            <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'DM Sans', 'Poppins', sans-serif" }}>
                {/* ── Gradient Hero Header ── */}
                {/* <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 px-6 py-5">
                    <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute bottom-0 left-1/3 w-64 h-32 bg-violet-500/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 mb-0">
                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shadow-lg flex-shrink-0">
                                <Shield size={20} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <h3 className="text-sm font-bold text-white">{user?.name || 'User'}</h3>
                                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-400/30 text-indigo-100 border border-indigo-400/40">
                                        {ROLE_LABELS[userRole] || userRole}
                                    </span>
                                    {user?.channel && (
                                        <span className="text-[10px] text-indigo-200">· {user.channel}</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {accessList.map((access, i) => {
                                        const Icon = getAccessIcon(access);
                                        return (
                                            <div key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-[10px] text-indigo-100 border border-white/10">
                                                <Icon size={11} className="text-indigo-300" />
                                                {access}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div> */}

                {/* ── Main Content ── */}
                <div className="px-4 sm:px-6 py-5 space-y-5">

                    {/* ── Filter Bar ── */}
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-gray-800 flex-shrink-0">Policy Dashboard</h2>

                        {/* Date range badge */}
                        <div className="flex-1 flex justify-center min-w-0 px-2">
                            <div ref={noteRef} className="relative">
                                <button
                                    onClick={() => setShowNotePopover(v => !v)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-[11px] font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
                                >
                                    <Info size={11} />
                                    <span className="hidden sm:inline">
                                        {appliedFilter.fromDate} → {appliedFilter.toDate}
                                    </span>
                                    <span className="sm:hidden">Date range</span>
                                </button>
                                {showNotePopover && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-68 bg-white border border-indigo-100 rounded-xl shadow-xl p-3.5 text-xs pointer-events-none">
                                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-indigo-100 rotate-45 block" />
                                        <p className="font-semibold text-indigo-700 mb-1 flex items-center gap-1"><Info size={11} /> Active Filter</p>
                                        <p className="text-gray-500">Showing policies from <span className="font-semibold text-gray-700">{appliedFilter.fromDate}</span> to <span className="font-semibold text-gray-700">{appliedFilter.toDate}</span>.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            {hasActiveFilters && !isDefaultFilter && (
                                <button onClick={handleClearFilters}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg bg-white hover:bg-red-50 transition-colors">
                                    <X size={12} /> <span className="hidden sm:inline">Clear</span>
                                </button>
                            )}
                            <button onClick={() => setFilterOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                                <Filter size={12} /> <span className="hidden sm:inline">Filters</span>
                            </button>
                            <button onClick={refetch} disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg bg-white hover:bg-indigo-50 transition-colors disabled:opacity-50">
                                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline">{loading ? 'Loading…' : 'Refresh'}</span>
                            </button>
                        </div>
                    </div>

                    {/* ── Error ── */}
                    {error && !loading && (
                        <div className="flex items-center gap-2 px-4 py-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">
                            <AlertTriangle size={14} /> Failed to load statistics. Please try refreshing.
                        </div>
                    )}

                    {/* ── Status Cards ── */}
                    <BalancedCardGrid
                        items={statusCards}
                        renderCard={(card) => (
                            <StatusCard
                                key={card.id}
                                label={card.label}
                                value={card.value}
                                color={card.color}
                                statusType={card.statusType}
                            />
                        )}
                        maxCardsPerRow={6}
                    />

                    {/* ── Charts Row 1: Trend + Distribution ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Monthly Trend */}
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800">Monthly Policy Trend</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Last 12 months overview</p>
                                </div>
                                <div className="p-2 bg-indigo-50 rounded-xl">
                                    <TrendingUp size={16} className="text-indigo-600" />
                                </div>
                            </div>
                            <MonthlyTrendChart monthlyTrend={stats?.monthlyTrend} loading={loading} />
                        </div>

                        {/* Status Distribution */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800">Status Distribution</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Policy breakdown</p>
                                </div>
                                <div className="p-2 bg-green-50 rounded-xl">
                                    <Activity size={16} className="text-green-600" />
                                </div>
                            </div>
                            <StatusPieChart stats={stats} loading={loading} />
                        </div>
                    </div>

                    {/* ── Channel Breakdown (Admin only) ── */}
                    {isAdmin && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800">Channel-wise Policy Breakdown</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Performance across channels</p>
                                </div>
                                <div className="p-2 bg-amber-50 rounded-xl">
                                    <BarChart2 size={16} className="text-amber-600" />
                                </div>
                            </div>
                            <ChannelBreakdownChart channelBreakdown={stats?.channelBreakdown} loading={loading} />
                        </div>
                    )}

                    {/* ── Quick Stats Row ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Approval Rate', value: stats?.total ? `${Math.round((stats.approved / stats.total) * 100)}%` : '—', color: 'text-green-600', bg: 'bg-green-50' },
                            { label: 'Rejection Rate', value: stats?.total ? `${Math.round((stats.rejected / stats.total) * 100)}%` : '—', color: 'text-red-500', bg: 'bg-red-50' },
                            { label: 'Avg Reverts (Approver)', value: stats?.recentPolicies?.length ? Math.round(stats.recentPolicies.reduce((a, p) => a + (p.approver_revert_count || 0), 0) / stats.recentPolicies.length) : '—', color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: 'Avg Reverts (Admin)', value: stats?.recentPolicies?.length ? Math.round(stats.recentPolicies.reduce((a, p) => a + (p.admin_revert_count || 0), 0) / stats.recentPolicies.length) : '—', color: 'text-violet-600', bg: 'bg-violet-50' },
                        ].map((item, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                                {loading ? <Skeleton className="h-7 w-16" /> : (
                                    <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* ── Recent Policies Table ── */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800">Recent Policies</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Latest 5 submitted policies</p>
                            </div>
                            <div className="p-2 bg-sky-50 rounded-xl">
                                <FileText size={16} className="text-sky-600" />
                            </div>
                        </div>
                        <RecentPoliciesTable rows={stats?.recentPolicies} loading={loading} />
                    </div>

                </div>
            </div>
        </>
    );
};

export default ChurnDashboard;
import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from '../../utils/authInterceptor';
import { apiBaseUrl } from '../../config/apiConfig';
import {
  CircleChevronDown,
  CircleChevronUp,
  Loader2,
  ShieldCheck,
  Bot,
  CalendarClock,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Activity,
} from 'lucide-react';

/**
 * AgentStatusDrawer
 * Collapsible drawer — API called only on first open.
 * Shows: license end date + advanced page usage + agent name & state.
 */
const AgentStatusDrawer = ({
  tenantId: propTenantId,
  credKey = 'AE_CRED',
  title = 'Agent & License Status',
}) => {
  const user     = useSelector(state => state.auth.user);
  const token    = user?.token;
  const tenantId = user?.tenantId;

  const [isOpen,     setIsOpen]     = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [loading,    setLoading]    = useState(false);
  // error shape: { type: 'config' | 'access' | 'generic', message: string } | null
  const [error,      setError]      = useState(null);
  const [data,       setData]       = useState(null);

  // ── helpers ──────────────────────────────────────────────────────────────────

  const fmt = (ms) => ms
    ? new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const daysUntil = (ms) => ms
    ? Math.ceil((ms - Date.now()) / 86_400_000)
    : null;

  const agentMeta = (state) => {
    switch ((state || '').toUpperCase()) {
      case 'RUNNING': return { label: 'Running', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', pulse: true  };
      case 'STOPPED': return { label: 'Stopped', cls: 'text-red-600 bg-red-50 border-red-200',             dot: 'bg-red-400',     pulse: false };
      case 'IDLE':    return { label: 'Idle',    cls: 'text-amber-600 bg-amber-50 border-amber-200',       dot: 'bg-amber-400',   pulse: false };
      default:        return { label: state||'—',cls: 'text-gray-500 bg-gray-50 border-gray-200',           dot: 'bg-gray-400',    pulse: false };
    }
  };

  // ── fetch ────────────────────────────────────────────────────────────────────

  /**
   * Extracts the backend error message verbatim so the UI displays exactly
   * what the server returned — no custom or overridden copy.
   */
  const classifyError = (responseData, fallback) => {
    const message = responseData?.errorMessage || responseData?.message || fallback || 'Failed to load status.';
    return { message };
  };

  const fetchStatus = useCallback(async (force = false) => {
    if (!token) return;
    if (hasFetched && !force) return;
    try {
      setLoading(true); setError(null);
      const res = await axios.get(
        `${apiBaseUrl}/v1/agent/status/${tenantId}/${credKey}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );

      // Some endpoints return HTTP 200 with success:false in the body
      const body = res.data;
      if (body?.success === false) {
        setError(classifyError(body, 'Request failed.'));
        return;
      }

      setData(body);
      setHasFetched(true);
    } catch (err) {
      const responseData = err?.response?.data;
      setError(classifyError(responseData, err.message));
    } finally {
      setLoading(false);
    }
  }, [token, tenantId, credKey, hasFetched]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !hasFetched) fetchStatus();
  };

  const handleRefresh = (e) => {
    e.stopPropagation();
    setHasFetched(false);
    fetchStatus(true);
  };

  // ── derived ──────────────────────────────────────────────────────────────────

  const license  = data?.license ?? {};
  const agent    = data?.agent   ?? {};
  const am       = agentMeta(agent.agentState);

  const expDays      = daysUntil(license.endDate);
  const expired      = expDays !== null && expDays < 0;
  const expiringSoon = expDays !== null && expDays >= 0 && expDays <= 30;

  const licActive = !expired;
  const licCls    = licActive
    ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : 'text-red-600 bg-red-50 border-red-200';
  const licDot    = licActive ? 'bg-emerald-500' : 'bg-red-500';
  const licLabel  = licActive ? 'Active' : 'Expired';

  const advTotal    = license.advancedPageCount         ?? 0;
  const advConsumed = license.consumedAdvancedPageCount  ?? 0;
  const advPct      = advTotal > 0 ? Math.min(100, Math.round((advConsumed / advTotal) * 100)) : 0;
  const advBar      = advPct >= 90 ? '#f87171' : advPct >= 70 ? '#fb923c' : '#6366f1';
  const advPctCls   = advPct >= 90 ? 'text-red-500' : advPct >= 70 ? 'text-orange-500' : 'text-indigo-500';

  // expiry colour helpers
  const expColor   = expired ? '#ef4444' : expiringSoon ? '#f59e0b' : '#6b7280';
  const expBg      = expired ? '#fef2f2' : expiringSoon ? '#fffbeb' : '#f9fafb';
  const expBorder  = expired ? '#fecaca' : expiringSoon ? '#fde68a' : '#f3f4f6';

  // ── micro components ─────────────────────────────────────────────────────────

  const Dot = ({ cls, pulse }) => (
    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
      {pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${cls}`} />}
      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cls}`} />
    </span>
  );

  const Badge = ({ label, cls, dot, pulse = false }) => (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      <Dot cls={dot} pulse={pulse} />
      {label}
    </span>
  );

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="rounded-md overflow-hidden border border-gray-100"
      style={{ fontFamily: 'Poppins, sans-serif', boxShadow: '0 1px 6px 0 rgba(0,0,0,0.06)' }}
    >
      {/* ── Header / Toggle ── */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left bg-white hover:bg-gray-50/80 transition-colors group"
      >
        {/* Left */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Icon pill */}
          <div
            className="flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
          >
            <Bot size={12} color="#fff" />
          </div>

          <span className="text-[12px] font-semibold text-gray-700 tracking-tight">{title}</span>

          {/* Collapsed quick-view badges */}
          {data && !isOpen && (
            <div className="flex items-center gap-1">
              <Badge label={licLabel} cls={licCls} dot={licDot} />
              <Badge label={am.label} cls={am.cls}  dot={am.dot} pulse={am.pulse} />
            </div>
          )}

          {/* Expiry warnings always visible */}
          {data && expiringSoon && !expired && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
              <CalendarClock size={9} />{expDays} days left
            </span>
          )}
          {data && expired && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-500 border border-red-200">
              <AlertCircle size={9} />Expired
            </span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {isOpen && data && (
            <button
              type="button"
              onClick={handleRefresh}
              className="p-1 rounded-md text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw 
                size={12} 
                className={loading ? 'animate-spin' : ''}
              />
            </button>
          )}
          <span className="text-gray-400 group-hover:text-gray-500 transition-colors">
            {isOpen ? <CircleChevronUp size={14} /> : <CircleChevronDown size={14} />}
          </span>
        </div>
      </button>

      {/* ── Body ── */}
      {isOpen && (
        <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-5">
              <Loader2 size={14} className="animate-spin text-indigo-400" />
              <span className="text-[11px] text-gray-400">Loading…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex items-start gap-2 m-2.5 px-2.5 py-2.5 bg-red-50 border border-red-100 rounded-lg">
              <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] leading-snug text-red-600">{error.message}</p>
                <button
                  type="button"
                  onClick={() => { setHasFetched(false); fetchStatus(true); }}
                  className="text-[10px] underline mt-1 text-red-600"
                >Retry</button>
              </div>
            </div>
          )}

          {/* Data */}
          {!loading && !error && data && (
            <div className="p-2.5 grid grid-cols-2 gap-2">

              {/* ── License card ── */}
              <div
                className="rounded-md p-3 flex flex-col gap-2.5"
                style={{ background: '#fff', border: '1px solid #ede9fe', boxShadow: '0 1px 4px 0 rgba(99,102,241,0.06)' }}
              >
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}
                    >
                      <ShieldCheck size={11} color="#7c3aed" />
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700">License</span>
                  </div>
                  <Badge label={licLabel} cls={licCls} dot={licDot} />
                </div>

                {/* Expiry date block */}
                <div
                  className="rounded-md px-2.5 py-2 flex items-center gap-2"
                  style={{ background: expBg, border: `1px solid ${expBorder}` }}
                >
                  <CalendarClock size={14} color={expColor} className="flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: expColor, opacity: 0.7 }}>
                      License Expires
                    </p>
                    <p className="text-[11px] font-semibold leading-tight" style={{ color: expColor }}>
                      {fmt(license.endDate)}
                    </p>
                  </div>
                  {expDays !== null && (
                    <span
                      className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: expColor + '18', color: expColor }}
                    >
                      {expired ? `${Math.abs(expDays)} days ago` : `${expDays} days left`}
                    </span>
                  )}
                </div>

                {/* Advanced pages usage */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1">
                      <Sparkles size={12} color={advBar} />
                      <span className="text-[10px] font-semibold text-gray-500">Advanced Pages</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-700">
                      {advConsumed.toLocaleString()}
                      <span className="text-[9px] font-normal text-gray-400"> / {advTotal.toLocaleString()}</span>
                    </span>
                  </div>
                  {/* Track */}
                  <div className="relative w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                      style={{ width: `${advPct}%`, background: `linear-gradient(90deg, ${advBar}aa, ${advBar})` }}
                    />
                  </div>
                  <div className="flex justify-end mt-0.5">
                    <span className={`text-[9px] font-bold ${advPctCls}`}>{advPct}%</span>
                  </div>
                </div>
              </div>

              {/* ── Agent card ── */}
              <div
                className="rounded-md p-3 flex flex-col gap-2.5"
                style={{ background: '#fff', border: '1px solid #d1fae5', boxShadow: '0 1px 4px 0 rgba(16,185,129,0.06)' }}
              >
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' }}
                    >
                      <Bot size={11} color="#059669" />
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700">Agent</span>
                  </div>
                  <Badge label={am.label} cls={am.cls} dot={am.dot} pulse={am.pulse} />
                </div>

                {/* Agent name block */}
                <div
                  className="rounded-md px-2.5 py-2"
                  style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-500 mb-0.5">Agent Name</p>
                  <p className="text-[11px] font-bold text-gray-800 break-all leading-snug">
                    {agent.agentName || '—'}
                  </p>
                </div>

                {/* State row */}
                <div
                  className="rounded-md px-2.5 py-2 flex items-center gap-2"
                  style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
                >
                  <Activity size={11} color="#059669" className="flex-shrink-0" />
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-500">State</p>
                    <p className="text-[11px] font-bold text-gray-800">{agent.agentState || '—'}</p>
                  </div>
                  {am.pulse && (
                    <span className="ml-auto relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentStatusDrawer;
import React, { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import axios from "../../../utils/authInterceptor";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  FileEdit,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Shield,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateTime = (isoString) => {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
};

const toTitleCase = (str) => {
  if (!str) return "";
  return str
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// ─── Status → card background + text colours ──────────────────────────────────
const getCardStyle = (status) => {
  if (!status)
    return {
      card: "bg-white border-gray-100",
      title: "text-gray-900",
      meta: "text-gray-500",
    };
  const s = status.toLowerCase();
  if (s.includes("approv"))
    return {
      card: "bg-green-50 border-green-100",
      title: "text-green-800",
      meta: "text-green-700/80",
    };
  if (s.includes("reject"))
    return {
      card: "bg-red-50 border-red-100",
      title: "text-red-800",
      meta: "text-red-700/80",
    };
  // submitted / pending / draft → neutral white
  return {
    card: "bg-white border-gray-100",
    title: "text-gray-900",
    meta: "text-gray-500",
  };
};

// ─── Status badge pill ─────────────────────────────────────────────────────────
// Colors match the reference UI image:
//   SUBMITTED / COMPLIANT / APPROVED  → green  (as seen in image)
//   REJECTED                          → red
//   PENDING / DRAFT                   → gray
//   ON HOLD                           → amber
//   everything else                   → indigo fallback
const getBadgeStyle = (status) => {
  if (!status) return "bg-gray-100 text-gray-500";
  const s = status.toLowerCase();
  if (s.includes("approv") || s.includes("submit") || s.includes("compliant"))
    return "bg-green-100 text-green-700";
  if (s.includes("reject")) return "bg-red-100 text-red-700";
  if (s.includes("pending")) return "bg-blue-100 text-blue-700";
  if (s.includes("draft")) return "bg-gray-100 text-gray-600";
  if (s.includes("hold")) return "bg-amber-100 text-amber-700";
  return "bg-indigo-100 text-indigo-700";
};

// Icon circle background
const getIconBg = (actionRef, status) => {
  const s = (actionRef || status || "").toLowerCase();
  if (s.includes("reject")) return "bg-red-500 shadow-red-200";
  if (s.includes("approv")) return "bg-green-500 shadow-green-200";
  if (s.includes("submit") || s.includes("send"))
    return "bg-[#137fec] shadow-blue-200";
  if (s.includes("draft")) return "bg-[#137fec] shadow-blue-200";
  if (s.includes("hold")) return "bg-amber-500 shadow-amber-200";
  return "bg-[#137fec] shadow-blue-200";
};

// Icon inside the circle (always white)
const getActionIcon = (actionRef, status) => {
  const s = (actionRef || status || "").toLowerCase();
  if (s.includes("reject")) return <XCircle size={18} className="text-white" />;
  if (s.includes("approv"))
    return <CheckCircle2 size={18} className="text-white" />;
  if (s.includes("submit")) return <Send size={18} className="text-white" />;
  if (s.includes("draft")) return <FileEdit size={18} className="text-white" />;
  if (s.includes("hold"))
    return <AlertCircle size={18} className="text-white" />;
  return <Shield size={18} className="text-white" />;
};

// Friendly step title derived from the record
const getStepTitle = (record) => {
  const STEP_LABELS = {
    step_initiate: "Draft Created",
    step_manager_review: "Submitted for Review",
    step_finance_processing: "Finance Approval",
    step_end_process: "End Process",
  };
  // Use next_step to label what this event moved TO, else fall back
  const key = record.next_step || record.previous_step || "";
  return STEP_LABELS[key] || toTitleCase(record.status || key || "Action");
};

// ─── Changed-fields collapsible panel ────────────────────────────────────────
// history_json is stored as a Postgres JSONB wrapper: { type, value, null }
// The actual changed field data lives inside history_json.value as a flat object.
// We always unwrap .value and skip the outer wrapper keys (type, null, value label).

// Keys from the Postgres JSONB wrapper to always ignore
const JSONB_WRAPPER_KEYS = new Set(["type", "null"]);

const HistoryDataPanel = ({ historyJson }) => {
  const [expanded, setExpanded] = useState(false);

  // ── Unwrap history_json.value → the real changed-fields object ──────────────
  // history_json shape: { type: "jsonb", value: { field1, field2, ... }, null: false }
  // We want only the entries inside .value
  const rawData = (() => {
    if (!historyJson || typeof historyJson !== "object") return null;

    // Case 1: .value is already a parsed object — use it directly
    if (historyJson.value && typeof historyJson.value === "object") {
      return historyJson.value;
    }

    // Case 2: .value is a JSON string (actual API shape) — parse it
    // API returns: { type: "jsonb", value: "{\"group\":\"AX\",...}", null: false }
    if (historyJson.value && typeof historyJson.value === "string") {
      try {
        const parsed = JSON.parse(historyJson.value);
        if (parsed && typeof parsed === "object") return parsed;
      } catch {
        // not valid JSON — fall through to flat fallback
      }
    }

    // Case 3: Fallback — filter out known wrapper-only keys and render the rest flat
    const filtered = Object.fromEntries(
      Object.entries(historyJson).filter(([k]) => !JSONB_WRAPPER_KEYS.has(k.toLowerCase()))
    );
    return Object.keys(filtered).length > 0 ? filtered : null;
  })();

  if (!rawData || Object.keys(rawData).length === 0) return null;

  const entries = Object.entries(rawData);

  return (
    <div className="mt-2">
      {/* Toggle trigger */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? "Hide" : "Show"} changed fields ({entries.length})
      </button>

      {/* ── Compact pill chips: fieldname : bold value ────────────────────────
          Pill-shaped (rounded-full), no icons, no quotes, text-[10px].
          Field name in normal weight, value in bold. Wraps to next line.       */}
      {expanded && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {entries.map(([key, val]) => {
            // Stringify objects/arrays; strip any surrounding quotes from strings
            const displayVal =
              val === null || val === undefined
                ? "—"
                : typeof val === "object"
                  ? JSON.stringify(val)
                  : String(val);

            return (
              <div
                key={key}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[10px] leading-none whitespace-nowrap"
              >
                <span className="text-gray-500 font-normal">{key}:</span>
                <span className="text-gray-800 font-bold">{displayVal}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Single Timeline Entry ────────────────────────────────────────────────────

const HistoryEntry = ({ record, isLast, usersMap }) => {
  const cardStyle = getCardStyle(record.status);
  const badgeStyle = getBadgeStyle(record.status);
  const iconBg = getIconBg(record.actionRef, record.status);
  const stepTitle = getStepTitle(record);
  const isRejected = record.status?.toLowerCase().includes("reject");

  // ── Username resolution (priority order) ──────────────────────────────────
  // 1. usersMap fetched separately from ap_users keyed by created_by id
  // 2. PostgREST join result already on record: record.ap_users.user_name
  // 3. Fallback field set from elsewhere: record.created_by_name
  // 4. Last resort: "User #<id>"
  const resolvedUser = usersMap?.[record.created_by];
  const displayName =
    resolvedUser?.user_name ||
    record.ap_users?.user_name ||
    record.created_by_name ||
    (record.created_by ? `User #${record.created_by}` : "System");

  // ── Role resolution ────────────────────────────────────────────────────────
  // Prefer created_role_name from history record (the role they acted as),
  // fall back to user_role from ap_users if not present.
  const displayRole =
    record.created_role_name || resolvedUser?.user_role || null;

  return (
    <div className="flex gap-3">
      {/* ── Left: coloured icon circle + connector ── */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg flex-shrink-0 z-10 ${iconBg}`}
        >
          {getActionIcon(record.actionRef, record.status)}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-grow bg-gray-200 mt-1 min-h-[20px]" />
        )}
      </div>

      {/* ── Right: card ── */}
      <div className="flex-1 pb-5">
        <div
          className={`rounded-xl border shadow-sm overflow-hidden ${cardStyle.card}`}
        >
          {/* ── Card content ── */}
          <div className="px-4 py-3 min-w-0">
            {/* Row 1: step title + status badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-4">
                {/* <h4
                  className={`text-sm font-bold leading-snug ${cardStyle.title}`}
                >
                  {record.status || '—'}
                </h4> */}
                {record.status && (
                  <span
                    className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}
                  >
                    {record.status || '—'}
                  </span>
                )}
                {/* Step flow badge row (prev → next) — secondary info, subtle */}
                {(record.previous_step || record.next_step) && (
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 flex-wrap">
                    {record.previous_step && (
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded font-mono">
                        {toTitleCase(record.previous_step)}
                      </span>
                    )}
                    {record.previous_step && record.next_step && <span>→</span>}
                    {record.next_step && (
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded font-mono">
                        {toTitleCase(record.next_step)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* Row 2: user name (role) • timestamp — matches reference image layout */}
                <div
                  className={`flex items-center flex-wrap gap-x-1.5 mt-0.5 text-[10px] font-medium ${cardStyle.meta}`}
                >
                  {/* User full name from ap_users */}
                  <span className="text-black">{displayName}</span>

                  {/* Role label in parentheses — from created_role_name or ap_users.user_role */}
                  {displayRole && (
                    <span className="text-black font-normal">
                      ({toTitleCase(displayRole)})
                    </span>
                  )}

                  {/* Timestamp */}
                  {record.transaction_timestamp && (
                    <span className="text-black font-normal">
                      &bull; {formatDateTime(record.transaction_timestamp)}
                    </span>
                  )}
                </div>

              </div>
            </div>

            {/* ── Comment strip ─────────────────────────────────────────────────────
                Compact single-row block: sits between step flow and changed fields.
                Reuses displayName, displayRole, transaction_timestamp already
                resolved in this component. Only rendered when user_comments present. */}
            {record.user_comments && (
              <div className="mt-2 flex items-center gap-2 px-2">
                {/* Opening quote accent */}
                <span className="text-gray-300 text-base leading-none select-none flex-shrink-0">
                  &ldquo;
                </span>

                {/* Comment text — grows, truncates on overflow */}
                <p className="flex-1 text-[11px] italic text-gray-600 leading-snug truncate">
                  {record.user_comments}
                </p>
              </div>
            )}

            {/* Changed fields collapsible */}
            <HistoryDataPanel historyJson={record.history_json} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const VendorApprovalHistory = ({ instanceId }) => {
  const user = useSelector((state) => state.auth.user);
  const token = user?.token;

  const [records, setRecords] = useState([]);
  const [usersMap, setUsersMap] = useState({}); // { [userId]: { user_name, user_role } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!instanceId || !token) return;
    setLoading(true);
    setError(null);

    try {
      // ── Step 1: Fetch workflow history records (plain, no join) ──────────────
      const res = await axios.get(
        `/api/v1/tables/ap_process_workflow_history?instance_id=eq.${instanceId}&order=transaction_timestamp.asc`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const historyRecords = Array.isArray(res.data) ? res.data : [];
      setRecords(historyRecords);

      // ── Step 2: Collect unique created_by IDs from history records ───────────
      const userIds = [
        ...new Set(historyRecords.map((r) => r.created_by).filter(Boolean)),
      ];

      // ── Step 3: Fetch ap_users for those IDs in a single call ────────────────
      if (userIds.length > 0) {
        try {
          const usersRes = await axios.get(
            `/api/v1/tables/ap_users?id=in.(${userIds.join(",")})`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const usersArr = Array.isArray(usersRes.data) ? usersRes.data : [];

          // Build a map keyed by user id for O(1) lookup in HistoryEntry
          const map = {};
          usersArr.forEach((u) => {
            map[u.id] = { user_name: u.user_name, user_role: u.user_role };
          });
          setUsersMap(map);
        } catch (userErr) {
          // Non-fatal: user details failed — fall back to "User #id" display
          console.warn(
            "[VendorApprovalHistory] ap_users fetch failed:",
            userErr?.response?.status,
          );
          setUsersMap({});
        }
      }
    } catch (err) {
      console.error("[VendorApprovalHistory] History fetch failed:", err);
      setError("Unable to load approval history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [instanceId, token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-9 h-9 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading approval history…</p>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center">
          <XCircle size={22} className="text-red-500" />
        </div>
        <p className="text-sm font-semibold text-gray-700">{error}</p>
        <button
          onClick={fetchHistory}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  // ── No instance yet ──
  if (!instanceId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
        <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center">
          <Clock size={22} className="text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-600">
          No workflow instance found
        </p>
        <p className="text-xs text-gray-400">
          History will appear here once the vendor record has been saved.
        </p>
      </div>
    );
  }

  // ── Empty ──
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
        <div className="w-11 h-11 rounded-full bg-indigo-50 flex items-center justify-center">
          <Shield size={22} className="text-indigo-400" />
        </div>
        <p className="text-sm font-semibold text-gray-600">
          No approval history yet
        </p>
        <p className="text-xs text-gray-400">
          Actions such as Submit, Approve, and Reject will appear here.
        </p>
      </div>
    );
  }

  // ── Timeline ──
  return (
    <div className="px-3 py-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Clock size={14} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-widest">
              Approval Audit Trail
            </h3>
            <p className="text-[10px] text-gray-400">
              {records.length} event{records.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
        </div>
        <button
          onClick={fetchHistory}
          title="Refresh history"
          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Timeline entries */}
      <div className="space-y-0">
        {records.map((rec, idx) => (
          <HistoryEntry
            key={rec.history_id ?? idx}
            record={rec}
            isLast={idx === records.length - 1}
            usersMap={usersMap}
          />
        ))}
      </div>
    </div>
  );
};

export default VendorApprovalHistory;
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from "recharts";
import { getStatusColor } from "../../utils/Statuscolorutils";

// Lightweight helpers for date grouping
const pad = (n) => String(n).padStart(2, "0");

function getDayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`; // YYYY-MM-DD
}

function getWeekKey(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  // Thursday in current week decides the year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(weekNo)}`;
}

function getMonthKey(date) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]}-${date.getFullYear()}`; // MMM-YYYY
}

function getQuarterKey(date) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${q}`; // YYYY-Q1
}

// (yearly aggregation not used — quarterly is preferred)

const STATUS_PRIORITY = [
  "Processing",
  "Pending",
  "Approved",
  "Rejected",
  "Completed",
  "Error",
];

const rangeConfigs = {
  daily: { periods: 30, unit: "day" },
  weekly: { periods: 4, unit: "week" },
  monthly: { periods: 12, unit: "month" },
  quarterly: { periods: 4, unit: "quarter" },
  all: { periods: 24, unit: "month" },
};

export default function InvoicePerformanceGraph() {
  const user = useSelector((s) => s.auth.user);
  const token = user?.token;
  const [range, setRange] = useState("monthly");
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState(new Set());

  const fetchInvoices = useCallback(
    async (startDateISO) => {
      if (!token) return [];
      setLoading(true);
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };

        // page size per request — choose a value safe for your backend
        const pageSize = 1000;
        let offset = 0;
        let all = [];

        // build the static parts of the query
        const staticParams = [
          "select=invoice_id,created_at,status",
          "order=created_at.asc",
        ];

        if (user?.role !== "super_admin" && user?.tenantId) {
          staticParams.push(`tenant_id=eq.${user.tenantId}`);
        }
        if (user?.role === "account_user") {
          staticParams.push(`user_id=eq.${user.user_id}`);
        }
        if (startDateISO) {
          staticParams.push(`created_at=gte.${encodeURIComponent(startDateISO)}`);
        }

        // safety guard to avoid infinite loops in case of unexpected backend behavior
        const maxPages = 200; // 200 * 1000 = 200k rows max
        let pages = 0;

        while (true) {
          const params = [...staticParams, `limit=${pageSize}`, `offset=${offset}`];
          const url = `/api/v1/tables/ap_invoices?${params.join("&")}`;
          const res = await axios.get(url, config);
          const rows = res.data || [];
          if (rows.length > 0) {
            all = all.concat(rows);
          }

          pages += 1;
          if (rows.length < pageSize) break; // last page
          if (pages >= maxPages) {
            console.warn("Reached max pages while fetching invoices — stopping early");
            break;
          }
          offset += pageSize;
        }

        return all;
      } catch (err) {
        console.error("Failed fetching invoices for performance graph", err);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [token, user]
  );

  // compute start date based on range
  const computeStartDate = useCallback((r) => {
    const now = new Date();
    if (r === "daily") {
      const d = new Date();
      d.setDate(now.getDate() - 29);
      return d.toISOString();
    }
    if (r === "weekly") {
      const d = new Date();
      d.setDate(now.getDate() - 12 * 7);
      return d.toISOString();
    }
    if (r === "monthly") {
      const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return d.toISOString();
    }
    if (r === "quarterly") {
      const d = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      return d.toISOString();
    }
    // all -> limit to last 24 months for performance
    const d = new Date(now.getFullYear(), now.getMonth() - 23, 1);
    return d.toISOString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const startISO = computeStartDate(range);
      const data = await fetchInvoices(startISO);
      if (!cancelled)
        setRaw(
          data.map((r) => ({
            status: r.status || "Unknown",
            created_at: r.created_at,
          }))
        );
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range, fetchInvoices, computeStartDate]);

  const processed = useMemo(() => {
    if (!raw || raw.length === 0) return { data: [], statuses: [] };

    // determine grouping function
    let keyFn = getMonthKey;
    if (range === "daily") keyFn = getDayKey;
    if (range === "weekly") keyFn = getWeekKey;
    if (range === "quarterly") keyFn = getQuarterKey;

    const buckets = new Map();
    const statusesSet = new Set();

    raw.forEach((r) => {
      const d = new Date(r.created_at);
      const key = keyFn(d);
      statusesSet.add(r.status || "Unknown");
      if (!buckets.has(key)) buckets.set(key, {});
      const obj = buckets.get(key);
      obj[r.status || "Unknown"] = (obj[r.status || "Unknown"] || 0) + 1;
    });

    // fill missing periods to keep consistent x axis
    const now = new Date();
    const cfg = rangeConfigs[range] || rangeConfigs.monthly;
    const periods = cfg.periods;
    const periodKeys = [];
    if (cfg.unit === "day") {
      for (let i = periods - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        periodKeys.push(getDayKey(d));
      }
    } else if (cfg.unit === "week") {
      for (let i = periods - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i * 7);
        periodKeys.push(getWeekKey(d));
      }
    } else if (cfg.unit === "month") {
      for (let i = periods - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periodKeys.push(getMonthKey(d));
      }
    } else if (cfg.unit === "quarter") {
      for (let i = periods - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
        periodKeys.push(getQuarterKey(d));
      }
    }

    // prepare ordered data
    const ordered = periodKeys.map((k) => {
      const entry = { period: k };
      const bucket = buckets.get(k) || {};
      // ensure known statuses first
      STATUS_PRIORITY.forEach((s) => {
        if (bucket[s]) entry[s] = bucket[s];
      });
      // include other statuses discovered
      Object.keys(bucket).forEach((s) => {
        if (!STATUS_PRIORITY.includes(s)) entry[s] = bucket[s];
        statusesSet.add(s);
      });
      return entry;
    });

    const statuses = Array.from(
      new Set([...STATUS_PRIORITY, ...Array.from(statusesSet)])
    ).filter(Boolean);

    return { data: ordered, statuses };
  }, [raw, range]);

  // Initialize visible statuses with all discovered statuses when data loads
  useEffect(() => {
    if (processed.statuses.length > 0 && visibleStatuses.size === 0) {
      setVisibleStatuses(new Set(processed.statuses));
    }
  }, [processed.statuses, visibleStatuses.size]);

  // compute totals across all periods for summary badges
  const totals = useMemo(() => {
    const t = {};
    processed.data.forEach((entry) => {
      processed.statuses.forEach((s) => {
        const v = entry[s] || 0;
        t[s] = (t[s] || 0) + v;
      });
    });
    return t;
  }, [processed]);


  // Derive colour for each status via the shared hash-based utility.
  // getStatusColor(name) always returns the same hex for the same name,
  // matching Dashboard, InvoiceReports, and OverviewChart exactly.
  const statusColorMap = useMemo(() => {
    const map = {};
    processed.statuses.forEach((s) => {
      map[s] = getStatusColor(s).hex;
    });
    return map;
  }, [processed.statuses]);
  // total overall
  const overallTotal = useMemo(
    () => Object.values(totals).reduce((a, b) => a + (b || 0), 0),
    [totals]
  );

  // label for X axis based on selected range
  const rangeLabel = useMemo(() => {
    if (range === "daily") return "Daily";
    if (range === "weekly") return "Weekly";
    if (range === "monthly") return "Monthly";
    if (range === "quarterly") return "Quarterly";
    return "Date";
  }, [range]);

  // info message showing data range
  const rangeInfoMsg = useMemo(() => {
    const cfg = rangeConfigs[range];
    if (!cfg) return "";
    if (range === "daily") {
      return `(Last ${cfg.periods} days data)`;
    }
    if (range === "weekly") {
      return `(Last ${cfg.periods} weeks data)`;
    }
    if (range === "monthly") {
      return `(Last ${cfg.periods} months data)`;
    }
    if (range === "quarterly") {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      const startMonth = startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const currentMonth = now.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return `(${startMonth} to ${currentMonth})`;
    }
    return "";
  }, [range]);

  // custom tooltip to show per-period breakdown and total
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    // payload is array of items for each dataKey present in that period
    const items = payload
      .filter(Boolean)
      .map((p) => ({
        name: p.name,
        value: p.value,
        color: p.payload && p.fill ? p.fill : p.color,
      }));
    const periodTotal = items.reduce((a, b) => a + (b.value || 0), 0);
    // For daily view, convert YYYY-MM-DD to formatted date
    let displayLabel = label;
    if (range === "daily" && label && /^\d{4}-\d{2}-\d{2}$/.test(label)) {
      const [year, month, day] = label.split("-");
      const dateObj = new Date(`${year}-${month}-${day}T00:00:00`);
      displayLabel = dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    return (
      <div
        style={{
          background: "white",
          border: "1px solid #f0f2f5",
          padding: 8,
          borderRadius: 8,
          minWidth: 160,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 6,
          }}
        >
          {displayLabel}
        </div>
        {items.map((it) => (
          <div
            key={it.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: it.color || "#cbd5e1",
                  borderRadius: 3,
                  display: "inline-block",
                }}
              />
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{it.name}</div>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
              {it.value}
            </div>
          </div>
        ))}
        <div
          style={{
            borderTop: "1px solid #f3f4f6",
            marginTop: 6,
            paddingTop: 6,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
            Total
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
            {periodTotal}
          </div>
        </div>
      </div>
    );
  };

  // compute responsive bar spacing
  const barCategoryGap = useMemo(() => {
    const len = (processed.data && processed.data.length) || 1;
    if (len <= 6) return "40%";
    if (len <= 12) return "30%";
    if (len <= 24) return "20%";
    return "8%";
  }, [processed.data]);

  const barGap = useMemo(() => {
    const len = (processed.data && processed.data.length) || 1;
    if (len <= 6) return 8;
    if (len <= 12) return 6;
    if (len <= 24) return 4;
    return 2;
  }, [processed.data]);

  // track window width for responsive adjustments
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(() => {
    function onResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const chartMargin = useMemo(
    () => ({
      top: 10,
      right: 16,
      left: windowWidth < 640 ? 8 : 20,
      bottom: 50,
    }),
    [windowWidth]
  );

  const chartHeight = useMemo(() => (windowWidth < 640 ? 220 : windowWidth < 1024 ? 320 : 380), [windowWidth]);

  return (
    <div className="bg-white rounded-md shadow-sm border border-gray-100 p-4 w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-400" />
          <h3 className="text-sm font-medium text-gray-600">
            Performance Graph <span className="text-xs font-light text-gray-400">{rangeInfoMsg}</span>
          </h3>
        </div>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {["daily", "weekly", "monthly", "quarterly"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded-md font-medium ${
                range === r
                  ? "bg-indigo-400 text-white shadow-sm"
                  : "bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-100"
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={processed.data}
          margin={chartMargin}
          barCategoryGap={barCategoryGap}
          barGap={barGap}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
          <XAxis
            dataKey="period"
            tick={range === "daily" ? false : { fontSize: 11, fill: "#c9cdd4" }}
            label={{
              value: rangeLabel,
              position: "bottom",
              offset: 10,
              fill: "#c9cdd4",
              fontSize: 12,
              fontWeight: 400,
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#c9cdd4" }}
            label={{
              value: "Invoices",
              angle: -90,
              position: "insideLeft",
              fill: "#374151",
              fontSize: 12,
              fontWeight: 400,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {processed.statuses
            .filter((s) => visibleStatuses.has(s))
            .map((s, idx) => {
              const color = statusColorMap[s] || getStatusColor(s).hex;
              return (
                <Bar
                  key={s}
                  dataKey={s}
                  fill={color}
                  stroke={color}
                  strokeWidth={2}
                  radius={[0, 0, 0, 0]}
                />
              );
            })}
        </BarChart>
      </ResponsiveContainer>
      {/* ── Unified legend – matches Document Status Outcomes chip style ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "10px 8px 6px",
          borderTop: "1px solid #f3f4f6",
          marginTop: 4,
        }}
      >
        {/* Total pill */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 8px 3px 8px",
            borderRadius: 6,
            border: "1px solid #eef0f4",
            background: "#ffffff",
            fontSize: 11,
            fontFamily: "Poppins, sans-serif",
            color: "#9ca3af",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 11, color: "#9ca3af" }}>Total</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", minWidth: 14, textAlign: "right" }}>
            {overallTotal}
          </span>
        </span>

        {/* Separator */}
        <span style={{ width: 1, height: 16, background: "#eef0f4", flexShrink: 0 }} />

        {processed.statuses.map((s) => {
          const isVisible = visibleStatuses.has(s);
          const count     = totals[s] || 0;
          const color = statusColorMap[s] || getStatusColor(s).hex;
          return (
            <button
              key={s}
              title={isVisible ? `${s}: ${count} — click to hide` : `${s}: hidden — click to show`}
              onClick={() =>
                setVisibleStatuses((prev) => {
                  const next = new Set(prev);
                  if (next.has(s)) next.delete(s); else next.add(s);
                  return next;
                })
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px 3px 6px",
                borderRadius: 6,
                border: "1px solid #eef0f4",
                background: isVisible ? "#ffffff" : "#f3f4f6",
                fontSize: 11,
                fontFamily: "Poppins, sans-serif",
                fontWeight: 400,
                color: "#9ca3af",
                opacity: isVisible ? 1 : 0.75,
                cursor: "pointer",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
                outline: "none",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f5f6f8"; e.currentTarget.style.borderColor = "#d9dce2"; e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#eef0f4"; e.currentTarget.style.opacity = isVisible ? "1" : "0.75"; }}
            >
              {/* Coloured dot */}
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: isVisible ? color : "#9ca3af",
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              {/* Label */}
              <span style={{ textDecoration: isVisible ? "none" : "line-through" }}>{s}</span>
              {/* Count – plain coloured text, no bubble */}
              {isVisible ? (
                <span style={{ color, fontWeight: 600, fontSize: 11, minWidth: 14, textAlign: "right" }}>
                  {count}
                </span>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {loading && <div className="text-xs text-gray-500 mt-2">Loading...</div>}
    </div>
  );
}
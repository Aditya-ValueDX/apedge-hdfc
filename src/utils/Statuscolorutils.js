/**
 * statusColorUtils.js
 *
 * Single source of truth for status colours across ALL dashboard components:
 *   Dashboard · InvoiceReports · InvoicePerformanceGraph · OverviewChart
 *
 * Strategy (two-tier):
 *   1. STATUS_COLOR_OVERRIDES — explicit palette index for every well-known
 *      status name.  Guarantees that statuses which appear together in the
 *      same chart (e.g. "New / Review / Upload" in the pie, or
 *      "Processing / Approved / …" in the bar) are always visually distinct.
 *   2. Hash fallback — any status not listed in the override map is hashed to
 *      a palette index exactly as before, so custom / future statuses keep
 *      working without any code changes.
 *
 * Root cause of the previous bug
 * ─────────────────────────────
 *   • "new"  and "review"  both hashed to palette index 0  → same blue.
 *   • "upload" and "approved" both hashed to palette index 7  → same green.
 *   • "processing" (index 19, light-green) ≈ "approved" (index 7, green)
 *     were perceptually too close on bar charts.
 */

// 24 perceptually-distinct hex colours.
export const COLOR_PALETTE = [
  '#3b82f6', // 0  blue
  '#8b5cf6', // 1  violet
  '#10b981', // 2  emerald
  '#ef4444', // 3  red
  '#f59e0b', // 4  amber
  '#06b6d4', // 5  cyan
  '#ec4899', // 6  pink
  '#22c55e', // 7  green
  '#f97316', // 8  orange
  '#14b8a6', // 9  teal
  '#a855f7', // 10 purple
  '#f43f5e', // 11 rose
  '#0ea5e9', // 12 sky
  '#84cc16', // 13 lime
  '#d946ef', // 14 fuchsia
  '#6366f1', // 15 indigo
  '#fb923c', // 16 light-orange
  '#2dd4bf', // 17 teal-400
  '#facc15', // 18 yellow
  '#4ade80', // 19 green-400
  '#c084fc', // 20 purple-400
  '#38bdf8', // 21 sky-400
  '#f87171', // 22 red-400
  '#a3e635', // 23 lime-400
];

/**
 * Explicit palette-index overrides for all well-known status / stage names.
 *
 * Rules followed when assigning indices:
 *   • Pie-chart group  (new / review / upload)     → all different indices.
 *   • Bar-chart group  (processing / pending / approved / completed /
 *                       rejected / error / cleared) → all different indices.
 *   • No two entries in the same display context share an index.
 *   • Keys are lower-cased & trimmed to match the normalisation applied below.
 */
const STATUS_COLOR_OVERRIDES = {
  // ── Stage / Pie-chart group ──────────────────────────────────────
  'new':          0,   // blue
  'review':       2,   // emerald   ← was colliding with "new" (both → 0)
  'upload':       4,   // amber     ← was colliding with "approved" (both → 7)
  'uploaded':     5,   // cyan

  // ── Status / Bar-chart group ─────────────────────────────────────
  'processing':   1,   // violet    ← was light-green (19), too close to "approved"
  'pending':      18,  // yellow
  'approved':     7,   // green
  'completed':    9,   // teal
  'rejected':     3,   // red
  'error':        8,   // orange
  'cleared':      13,  // lime

  // ── Other common statuses ────────────────────────────────────────
  'failed':       11,  // rose
  'cancel':       16,  // light-orange
  'cancelled':    16,  // light-orange
  'hold':         14,  // fuchsia
  'on hold':      14,  // fuchsia
  'active':       17,  // teal-400
  'draft':        6,   // pink
  'posted':       12,  // sky
  'total':        15,  // indigo
  'erp':          15,  // indigo
  'intermediate': 20,  // purple-400
  'success':      7,   // green  (alias of approved)
  'blocked':      3,   // red    (alias of rejected)
  'retry':        16,  // light-orange
  'progress':     1,   // violet
  'verification': 5,   // cyan
  'extraction':   19,  // green-400
  'archived':     15,  // indigo
  'sent':         12,  // sky
};

/**
 * Deterministic string hash → non-negative integer.
 * Used only for status names NOT listed in STATUS_COLOR_OVERRIDES.
 * Same input always produces the same output.
 */
const hashString = (str) => {
  let hash = 0;
  const s = (str || '').toLowerCase().trim();
  for (let i = 0; i < s.length; i++) {
    hash = (Math.imul(31, hash) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

/**
 * getStatusColor(statusName) → { hex: string, bg: null }
 *
 * Returns a colour object for a given status name.
 * The `bg` field is intentionally null — backgrounds should be derived
 * inline via  hex + '18'  (~10 % opacity) so no Tailwind class is needed.
 *
 * Usage:
 *   const { hex } = getStatusColor('Processing');
 *   style={{ color: hex, backgroundColor: hex + '18' }}
 */
export const getStatusColor = (statusName) => {
  const key = (statusName || '').toLowerCase().trim();
  const index = key in STATUS_COLOR_OVERRIDES
    ? STATUS_COLOR_OVERRIDES[key]
    : hashString(statusName) % COLOR_PALETTE.length;
  return { hex: COLOR_PALETTE[index], bg: null };
};

/**
 * getStatusHex(statusName) → string
 * Convenience shorthand when you only need the hex value.
 */
export const getStatusHex = (statusName) => getStatusColor(statusName).hex;
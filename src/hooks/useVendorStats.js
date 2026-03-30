import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from '../utils/authInterceptor';

/**
 * useVendorStats - Custom hook to fetch vendor statistics for the VendorDashboard.
 *
 * Stats fetched for the current tenant:
 *  - total           : all vendors for the tenant
 *  - completed       : vendors whose workflow instance has is_active=false AND status NOT containing 'Rejected'
 *  - rejected        : vendors whose workflow instance has is_active=false AND status containing 'Rejected'
 *  - pending         : count of active workflow instances (is_active=true) for this tenant
 *  - pendingBreakdown: { [current_step]: count } breakdown of pending vendors by workflow step
 *  - recentVendors   : latest 5 vendors ordered by created_at desc
 *
 * Strategy (two-step) - avoids PostgREST embedded-resource filter limitation:
 *  Step 1: Fetch instance_ids from ap_process_workflow_instances where
 *           is_active=false  (for completed/rejected logic)
 *           is_active=true   (for pending logic + breakdown by current_step)
 *           both fetched in parallel, no extra round-trips.
 *  Step 2: Count inactive vendors total + rejected ones separately.
 *           completed = inactiveTotal - rejectedCount
 *           (avoids not.ilike negation which causes SQL syntax errors)
 *
 * Accepts an optional dateFilter { fromDate, toDate } (ISO date strings).
 * When provided the created_at range is appended to every ap_vendors query so
 * all counts reflect only vendors created within that window — matching the
 * same default 1-month filter behaviour as Dashboard.jsx.
 *
 * Follows the same restifyDB (PostgREST) + axios pattern used in Dashboard.jsx.
 */
const useVendorStats = (dateFilter = {}) => {
    const user = useSelector(state => state.auth.user);
    const token = user?.token;

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Simple in-memory cache (keyed by tenantId + dateFilter) - same approach as Dashboard
    const cacheRef = useRef(new Map());
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Reads the total row-count from the PostgREST content-range header.
     * Header format: "0-0/42"  ->  42
     */
    const extractCount = (headers) => {
        const contentRange = headers['content-range'];
        if (contentRange) {
            const match = contentRange.match(/\/(\d+)$/);
            if (match && match[1]) return parseInt(match[1], 10);
        }
        return 0;
    };

    const fetchStats = useCallback(async () => {
        if (!user || !token) {
            setLoading(false);
            return;
        }

        const isSuperAdmin = user.role === 'super_admin';
        const tenantId = user.tenantId;

        // Include dateFilter in the cache key so different date ranges get separate caches
        const dateKey = `${dateFilter.fromDate || ''}_${dateFilter.toDate || ''}`;
        const cacheKey = isSuperAdmin
            ? `vendor_stats_super_admin_${dateKey}`
            : `vendor_stats_${tenantId}_${dateKey}`;

        // Return cached data if still fresh
        const cached = cacheRef.current.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            setStats(cached.data);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const authConfig = {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        };

        const countConfig = {
            headers: {
                Authorization: `Bearer ${token}`,
                Prefer: 'count=exact',
            },
        };

        try {
            // Tenant filter — omitted entirely for super_admin so all tenants are included
            const tenantFilter = isSuperAdmin ? `` : `&tenant_id=eq.${tenantId}`;

            // Date filter — appended to every ap_vendors query when dates are provided
            // Mirrors the created_at range logic in Dashboard.jsx fetchStats.
            let dateRangeFilter = '';
            if (dateFilter.fromDate) {
                const isoFrom = new Date(dateFilter.fromDate).toISOString();
                dateRangeFilter += `&created_at=gte.${isoFrom}`;
            }
            if (dateFilter.toDate) {
                // Use end-of-day for toDate so the full day is included
                const toDateObj = new Date(dateFilter.toDate);
                toDateObj.setHours(23, 59, 59, 999);
                dateRangeFilter += `&created_at=lte.${toDateObj.toISOString()}`;
            }

            // -- Step 1 ------------------------------------------------------------------
            // Fetch workflow instances for this tenant in parallel:
            //   a) is_active=false -> instance_id only  (for completed/rejected)
            //   b) is_active=true  -> instance_id + current_step (for pending + breakdown)
            // Both run in parallel - no extra round-trips vs. before.
            // NOTE: workflow instances are NOT date-filtered — we want ALL instances so
            // that instance_id matching against the date-filtered ap_vendors is correct.
            // ---------------------------------------------------------------------------
            const [inactiveWorkflowRes, activeWorkflowRes] = await Promise.all([
                axios.get(
                    `/api/v1/tables/ap_process_workflow_instances` +
                    `?is_active=eq.false` +
                    tenantFilter +
                    `&select=instance_id`,
                    authConfig
                ),
                axios.get(
                    `/api/v1/tables/ap_process_workflow_instances` +
                    `?is_active=eq.true` +
                    tenantFilter +
                    `&select=instance_id,current_step`,
                    authConfig
                ),
            ]);

            // -- Inactive instances (existing logic - untouched) -------------------------
            const inactiveInstanceIds = (inactiveWorkflowRes.data || []).map(
                (row) => row.instance_id
            );

            // -- Active instances (for pending) ------------------------------------------
            const activeWorkflowRows = activeWorkflowRes.data || [];

            // pendingBreakdown is computed AFTER the date-filtered pending fetch below,
            // so it only reflects vendors within the selected date range.
            // Initialise as empty here — filled in the Pending block further down.
            let pendingBreakdown = {};

            // -- Step 2 ------------------------------------------------------------------
            const [totalRes, recentVendorsRes] = await Promise.all([
                axios.get(
                    `/api/v1/tables/ap_vendors?limit=1` + tenantFilter + dateRangeFilter,
                    countConfig
                ),
                axios.get(
                    `/api/v1/tables/ap_vendors` +
                    `?order=created_at.desc` +
                    tenantFilter +
                    dateRangeFilter +
                    `&limit=5` +
                    `&select=vendor_id,vendor_name,vendor_type,status,stage,created_at`,
                    authConfig
                ),
            ]);

            let completedCount = 0;
            let rejectedCount = 0;
            let pendingCount = 0;

            // -- Completed / Rejected ----------------------------------------------------
            if (inactiveInstanceIds.length > 0) {
                const idList = inactiveInstanceIds.join(',');

                const inactiveTotalUrl =
                    `/api/v1/tables/ap_vendors` +
                    `?instance_id=in.(${idList})` +
                    tenantFilter +
                    dateRangeFilter +
                    `&limit=1`;

                const rejectedUrl =
                    `/api/v1/tables/ap_vendors` +
                    `?instance_id=in.(${idList})` +
                    tenantFilter +
                    dateRangeFilter +
                    `&status=ilike.*Rejected*` +
                    `&limit=1`;

                const [inactiveTotalRes, rejectedRes] = await Promise.all([
                    axios.get(inactiveTotalUrl, countConfig),
                    axios.get(rejectedUrl, countConfig),
                ]);

                const inactiveTotal = extractCount(inactiveTotalRes.headers);
                rejectedCount = extractCount(rejectedRes.headers);
                completedCount = Math.max(0, inactiveTotal - rejectedCount);
            }

            // -- Pending -----------------------------------------------------------------
            // Step A: fetch ap_vendors rows (with dateRangeFilter) for all active
            //         instance_ids — select only instance_id so we know which active
            //         workflow rows are within the date window.
            // Step B: build pendingBreakdown from the matching activeWorkflowRows only.
            // Step C: count is derived from the same result (no extra API call).
            if (activeWorkflowRows.length > 0) {
                const activeIdList = activeWorkflowRows
                    .map((row) => row.instance_id)
                    .join(',');

                // Fetch all matching vendor rows (instance_id only) within date range.
                // No limit — we need every row to build the per-step breakdown correctly.
                const pendingVendorsRes = await axios.get(
                    `/api/v1/tables/ap_vendors` +
                    `?instance_id=in.(${activeIdList})` +
                    tenantFilter +
                    dateRangeFilter +
                    `&select=instance_id`,
                    authConfig
                );

                const pendingVendorRows = pendingVendorsRes.data || [];
                pendingCount = pendingVendorRows.length;

                // Build a Set of instance_ids that are within the date range
                const dateFilteredInstanceIds = new Set(
                    pendingVendorRows.map((r) => r.instance_id)
                );

                // Build pendingBreakdown only from active workflow rows whose
                // vendor falls within the selected date range.
                pendingBreakdown = activeWorkflowRows
                    .filter((row) => dateFilteredInstanceIds.has(row.instance_id))
                    .reduce((acc, row) => {
                        const step = row.current_step || 'Unknown';
                        acc[step] = (acc[step] || 0) + 1;
                        return acc;
                    }, {});
            }

            const data = {
                total: extractCount(totalRes.headers),
                completed: completedCount,
                rejected: rejectedCount,
                pending: pendingCount,
                pendingBreakdown,
                recentVendors: recentVendorsRes.data || [],
            };

            cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
            setStats(data);
        } catch (err) {
            console.error('[useVendorStats] Error fetching vendor stats:', err);
            setError(err);
            setStats({
                total: 0,
                completed: 0,
                rejected: 0,
                pending: 0,
                pendingBreakdown: {},
                recentVendors: [],
            });
        } finally {
            setLoading(false);
        }
    }, [user, token, dateFilter.fromDate, dateFilter.toDate]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { stats, loading, error, refetch: fetchStats };
};

export default useVendorStats;
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from '../utils/authInterceptor';

/**
 * useChurnStats - Custom hook to fetch churn policy statistics.
 *
 * Stats fetched:
 *  - total           : all churn_policy records for this tenant
 *  - submitted       : policy_status = 'SUBMITTED'
 *  - approved        : policy_status = 'APPROVED'
 *  - rejected        : policy_status = 'REJECTED'
 *  - pendingWithYou  : policies where the workflow instance is active + pending_with matches user role
 *  - inProgress      : active workflow instances (is_active=true) not pending with current user
 *  - recentPolicies  : latest 5 churn_policy records
 *  - channelBreakdown: { [old_channel]: { approved, rejected, pending } }
 *  - monthlyTrend    : [{ month, total, approved, rejected }] for last 12 months
 *
 * Accepts an optional dateFilter { fromDate, toDate } (ISO date strings).
 */
const useChurnStats = (dateFilter = {}) => {
    const user = useSelector(state => state.auth.user);
    const token = user?.token;
    const tenantId = user?.tenantId;
    const userRole = user?.role;

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const cacheRef = useRef(new Map());
    const CACHE_TTL = 5 * 60 * 1000;

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

        const isSuperAdmin = userRole === 'super_admin';
        const dateKey = `${dateFilter.fromDate || ''}_${dateFilter.toDate || ''}`;
        const cacheKey = isSuperAdmin
            ? `churn_stats_super_admin_${dateKey}`
            : `churn_stats_${tenantId}_${dateKey}`;

        const cached = cacheRef.current.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            setStats(cached.data);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const authConfig = { headers: { Authorization: `Bearer ${token}` } };
        const countConfig = { headers: { Authorization: `Bearer ${token}`, Prefer: 'count=exact' } };

        try {
            const tenantFilter = isSuperAdmin ? `` : `&tenant_id=eq.${tenantId}`;

            let dateRangeFilter = '';
            if (dateFilter.fromDate) {
                dateRangeFilter += `&created_at=gte.${new Date(dateFilter.fromDate).toISOString()}`;
            }
            if (dateFilter.toDate) {
                const toDate = new Date(dateFilter.toDate);
                toDate.setHours(23, 59, 59, 999);
                dateRangeFilter += `&created_at=lte.${toDate.toISOString()}`;
            }

            // Fetch all key stats in parallel
            const [
                totalRes,
                submittedRes,
                approvedRes,
                rejectedRes,
                recentRes,
                allPoliciesRes,
            ] = await Promise.all([
                // Total count
                axios.get(`/api/v1/tables/churn_policy?limit=1${tenantFilter}${dateRangeFilter}`, countConfig),
                // Submitted
                axios.get(`/api/v1/tables/churn_policy?limit=1&policy_status=eq.SUBMITTED${tenantFilter}${dateRangeFilter}`, countConfig),
                // Approved
                axios.get(`/api/v1/tables/churn_policy?limit=1&policy_status=eq.APPROVED${tenantFilter}${dateRangeFilter}`, countConfig),
                // Rejected
                axios.get(`/api/v1/tables/churn_policy?limit=1&policy_status=eq.REJECTED${tenantFilter}${dateRangeFilter}`, countConfig),
                // Recent 5
                axios.get(
                    `/api/v1/tables/churn_policy?order=created_at.desc&limit=5${tenantFilter}${dateRangeFilter}` +
                    `&select=churn_policy_id,new_policy_number,old_policy_number,fls_name,old_channel,policy_status,created_at,instance_id`,
                    authConfig
                ),
                // All policies for client-side aggregation (channel breakdown + monthly trend)
                axios.get(
                    `/api/v1/tables/churn_policy?select=old_channel,policy_status,created_at${tenantFilter}${dateRangeFilter}`,
                    authConfig
                ),
            ]);

            // Fetch active workflow instances for "Pending with You" + "In Progress"
            let pendingWithYouCount = 0;
            let inProgressCount = 0;

            const activeWorkflowRes = await axios.get(
                `/api/v1/tables/ap_process_workflow_instances?is_active=eq.true&module_name=ilike.*Churn*${tenantFilter}&select=instance_id,current_step,pending_with,status`,
                authConfig
            );
            const activeInstances = activeWorkflowRes.data || [];

            // Match active instances to churn_policy via instance_id
            const activeInstanceIds = activeInstances.map(r => r.instance_id);
            let matchedPolicies = [];
            if (activeInstanceIds.length > 0) {
                const idList = activeInstanceIds.join(',');
                const matchRes = await axios.get(
                    `/api/v1/tables/churn_policy?instance_id=in.(${idList})${tenantFilter}${dateRangeFilter}&select=instance_id`,
                    authConfig
                );
                const matchedIds = new Set((matchRes.data || []).map(r => r.instance_id));

                // Filter active instances to only those within date range
                const dateFilteredInstances = activeInstances.filter(r => matchedIds.has(r.instance_id));
                inProgressCount = dateFilteredInstances.length;

                // Pending with current user's role
                pendingWithYouCount = dateFilteredInstances.filter(r => {
                    if (!r.pending_with) return false;
                    return r.pending_with.toLowerCase().includes((userRole || '').toLowerCase());
                }).length;
            }

            // Client-side: channel breakdown
            const allPolicies = allPoliciesRes.data || [];
            const channelBreakdown = {};
            allPolicies.forEach(p => {
                const ch = p.old_channel || 'Unknown';
                if (!channelBreakdown[ch]) channelBreakdown[ch] = { approved: 0, rejected: 0, pending: 0 };
                const s = (p.policy_status || '').toUpperCase();
                if (s === 'APPROVED') channelBreakdown[ch].approved++;
                else if (s === 'REJECTED') channelBreakdown[ch].rejected++;
                else channelBreakdown[ch].pending++;
            });

            // Client-side: monthly trend (last 12 months)
            const now = new Date();
            const monthlyMap = {};
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                monthlyMap[key] = { month: label, total: 0, approved: 0, rejected: 0 };
            }
            allPolicies.forEach(p => {
                if (!p.created_at) return;
                const d = new Date(p.created_at);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (monthlyMap[key]) {
                    monthlyMap[key].total++;
                    const s = (p.policy_status || '').toUpperCase();
                    if (s === 'APPROVED') monthlyMap[key].approved++;
                    else if (s === 'REJECTED') monthlyMap[key].rejected++;
                }
            });
            const monthlyTrend = Object.values(monthlyMap);

            const data = {
                total: extractCount(totalRes.headers),
                submitted: extractCount(submittedRes.headers),
                approved: extractCount(approvedRes.headers),
                rejected: extractCount(rejectedRes.headers),
                pendingWithYou: pendingWithYouCount,
                inProgress: inProgressCount,
                recentPolicies: recentRes.data || [],
                channelBreakdown,
                monthlyTrend,
            };

            cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
            setStats(data);
        } catch (err) {
            console.error('[useChurnStats] Error fetching stats:', err);
            setError(err);
            setStats({
                total: 0, submitted: 0, approved: 0, rejected: 0,
                pendingWithYou: 0, inProgress: 0, recentPolicies: [],
                channelBreakdown: {}, monthlyTrend: [],
            });
        } finally {
            setLoading(false);
        }
    }, [user, token, tenantId, userRole, dateFilter.fromDate, dateFilter.toDate]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { stats, loading, error, refetch: fetchStats };
};

export default useChurnStats;
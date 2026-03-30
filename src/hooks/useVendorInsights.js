import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from '../utils/authInterceptor';

/**
 * useVendorInsights - Custom hook for the Workflow Insights section.
 *
 * Fetches two datasets independently from useVendorStats (zero impact on it):
 *  - vendorTypeDistribution : { [vendor_type]: count } from ap_vendors
 *  - recentlyRejected       : latest 5 vendors where status ilike *Rejected*
 *
 * Both are fetched in a single Promise.all — one round-trip.
 * Uses the same restifyDB (PostgREST) + axios pattern as Dashboard.jsx.
 */
const useVendorInsights = () => {
    const user = useSelector(state => state.auth.user);
    const token = user?.token;
    const tenantId = user?.tenantId;

    const [insights, setInsights] = useState(null);
    const [insightsLoading, setLoading] = useState(true);
    const [insightsError, setError] = useState(null);

    // 5-minute in-memory cache keyed by tenantId — same approach as useVendorStats
    const cacheRef = useRef(new Map());
    const CACHE_TTL = 5 * 60 * 1000;

    const fetchInsights = useCallback(async () => {
        if (!token || !tenantId) {
            setLoading(false);
            return;
        }

        const isSuperAdmin = user?.role === 'super_admin';
        // Super admin sees all tenants — use a dedicated cache key
        const cacheKey = isSuperAdmin ? `vendor_insights_super_admin` : `vendor_insights_${tenantId}`;
        const cached = cacheRef.current.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            setInsights(cached.data);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const authConfig = {
            headers: { Authorization: `Bearer ${token}` },
        };

        try {
            // Tenant filter — omitted entirely for super_admin so all tenants are included
            const tenantFilter = isSuperAdmin ? `` : `&tenant_id=eq.${tenantId}`;

            // Both requests fire in parallel — one round-trip total.
            const [typeDistRes, rejectedRes] = await Promise.all([
                // 1. All vendors for this tenant — only vendor_type needed
                axios.get(
                    `/api/v1/tables/ap_vendors` +
                    `?select=vendor_type` +
                    tenantFilter,
                    authConfig
                ),
                // 2. Latest 5 rejected vendors with comments
                axios.get(
                    `/api/v1/tables/ap_vendors` +
                    `?status=ilike.*Rejected*` +
                    tenantFilter +
                    `&order=created_at.desc` +
                    `&limit=5` +
                    `&select=vendor_id,vendor_name,vendor_type,status,comments,created_at`,
                    authConfig
                ),
            ]);

            // Build vendor_type distribution map: { [type]: count }
            // Normalise blank/null vendor_type to "Unspecified"
            const vendorTypeDistribution = (typeDistRes.data || []).reduce((acc, row) => {
                const t = (row.vendor_type || '').trim() || 'Unspecified';
                acc[t] = (acc[t] || 0) + 1;
                return acc;
            }, {});

            const data = {
                vendorTypeDistribution,
                recentlyRejected: rejectedRes.data || [],
            };

            cacheRef.current.set(cacheKey, { data, timestamp: Date.now() });
            setInsights(data);
        } catch (err) {
            console.error('[useVendorInsights] fetch error:', err);
            setError(err);
            setInsights({ vendorTypeDistribution: {}, recentlyRejected: [] });
        } finally {
            setLoading(false);
        }
    }, [token, tenantId]);

    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    return { insights, insightsLoading, insightsError, refetchInsights: fetchInsights };
};

export default useVendorInsights;
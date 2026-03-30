import axios from './authInterceptor';

const extractCount = (response) => {
    const contentRange = response?.headers?.['content-range'];
    if (!contentRange) return 0;
    const match = contentRange.match(/\/(\d+)$/);
    return match && match[1] ? parseInt(match[1], 10) : 0;
};

const buildBaseParams = (user) => {
    const params = [];

    if (user?.role === 'account_user') {
        if (user?.user_id) {
            params.push(`user_id=eq.${user.user_id}`);
        }
        if (user?.tenantId) {
            params.push(`tenant_id=eq.${user.tenantId}`);
        }
    } else if (user?.role === 'account_manager' || user?.role === 'tenant_admin') {
        if (user?.tenantId) {
            params.push(`tenant_id=eq.${user.tenantId}`);
        }
    }

    return params;
};

export const fetchDocumentStageSummary = async ({ token, user }) => {
    if (!token || !user?.role) {
        return {
            totalUploaded: 0,
            completed: 0,
            pending: 0,
            error: 0
        };
    }

    const headers = {
        Authorization: `Bearer ${token}`,
        Prefer: 'count=exact'
    };

    const baseParams = buildBaseParams(user);
    const pendingStages = ['Uploaded', 'Extraction', 'Verification', 'FRP'];

    const buildUrl = (extraParams = []) => {
        const params = [...baseParams, ...extraParams, 'limit=1'];
        return `/api/v1/tables/ap_documents?${params.join('&')}`;
    };

    try {
        const [totalRes, completedRes, errorRes, pendingRes] = await Promise.all([
            axios.get(buildUrl(), { headers }),
            axios.get(buildUrl(['stage=eq.Posted']), { headers }),
            axios.get(buildUrl(['stage=eq.Error']), { headers }),
            axios.get(buildUrl([`stage=in.(${pendingStages.join(',')})`]), { headers })
        ]);

        return {
            totalUploaded: extractCount(totalRes),
            completed: extractCount(completedRes),
            pending: extractCount(pendingRes),
            error: extractCount(errorRes)
        };
    } catch (error) {
        return {
            totalUploaded: 0,
            completed: 0,
            pending: 0,
            error: 0
        };
    }
};

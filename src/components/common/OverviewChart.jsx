import React, { useState, useEffect } from 'react';
import axios from '../../utils/authInterceptor';
import { Users, UserCheck, Briefcase, Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { apiBaseUrl } from '../../config/apiConfig';
import { COLOR_PALETTE } from '../../utils/Statuscolorutils';

/**
 * OverviewChart Component
 * 
 * Displays overview statistics based on user role:
 * - Super Admin: Total Tenants, Total Account Managers, Total Account Users
 * - Tenant Admin: Total Account Managers, Total Account Users (in their tenant)
 * 
 * @param {Object} props - Component props
 * @param {string} props.variant - 'super_admin' or 'tenant_admin' (defaults to role from Redux)
 * @param {boolean} props.loading - External loading state (optional)
 * @param {boolean} props.compact - Compact mode for sidebar display (optional)
 */
const OverviewChart = ({ variant, loading: externalLoading = false, compact = false }) => {
  const user = useSelector(state => state.auth.user);
  const token = user?.token;
  const tenantId = user?.tenantId;
  const userRole = user?.role;

  const [stats, setStats] = useState({
    totalTenants: 0,
    totalAccountManagers: 0,
    totalAccountUsers: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine which variant to use
  const displayVariant = variant || userRole;

  useEffect(() => {
    const fetchStats = async () => {
      if (!user || !token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (displayVariant === 'super_admin') {
          // Fetch all users for super admin (request a large limit to avoid pagination)
          const response = await axios.get(`${apiBaseUrl}/v1/tables/ap_users?limit=100000`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Prefer: 'count=exact',
            },
          });

          const users = response.data || [];

          // Count by role
          const accountManagers = users.filter(u => u.user_role === 'account_manager').length;
          const accountUsers = users.filter(u => u.user_role === 'account_user').length;

          // Count unique tenants
          const uniqueTenants = new Set(
            users
              .filter(u => u.tenant_id && u.user_role !== 'super_admin')
              .map(u => u.tenant_id)
          ).size;

          // Total users (exclude super_admin from the visible user count)
          const totalUsers = users.filter(u => u.user_role !== 'super_admin').length;

          setStats({
            totalTenants: uniqueTenants,
            totalAccountManagers: accountManagers,
            totalAccountUsers: accountUsers,
            totalUsers,
          });
        } else if (displayVariant === 'tenant_admin') {
          // Fetch users for current tenant (request a large limit to avoid pagination)
          const response = await axios.get(`${apiBaseUrl}/v1/tables/ap_users?limit=100000`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Prefer: 'count=exact',
            },
          });

          const users = response.data || [];

          // Filter by current tenant and exclude tenant admin
          const tenantUsers = users.filter(u => u.tenant_id === tenantId && u.user_role !== 'tenant_admin');

          const accountManagers = tenantUsers.filter(u => u.user_role === 'account_manager').length;
          const accountUsers = tenantUsers.filter(u => u.user_role === 'account_user').length;

          const totalUsers = tenantUsers.length;

          setStats({
            totalTenants: 0, // Not used for tenant admin
            totalAccountManagers: accountManagers,
            totalAccountUsers: accountUsers,
            totalUsers,
          });
        }
      } catch (err) {
        console.error('Error fetching overview stats:', err);
        setError(err.message || 'Failed to fetch statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, token, tenantId, displayVariant]);

  if (loading || externalLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 text-sm bg-red-50 rounded-lg">
        Error: {error}
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, colorIndex = 0 }) => {
    const hex = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
    const bgStyle = { backgroundColor: hex + '18' }; // ~10% opacity background
    return (
      <div
        className={`rounded-lg ${compact ? 'p-3' : 'p-6'} hover:shadow-sm transition-shadow`}
        style={bgStyle}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-medium text-gray-600 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</p>
            <p className={`font-semibold text-gray-900 ${compact ? 'text-lg' : 'text-3xl'}`}>{value}</p>
          </div>
          {Icon && <Icon className={`opacity-25 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`} style={{ color: hex }} />}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {!compact && <h2 className="text-lg font-semibold text-gray-800 mb-4">Overview</h2>}
      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        {displayVariant === 'super_admin' && (
          <>
            <StatCard icon={Users}     label="Total Tenants"           value={stats.totalTenants}          colorIndex={0} />
            <StatCard icon={Users}     label="Total Users"             value={stats.totalUsers}            colorIndex={1} />
            <StatCard icon={Briefcase} label="Total Account Managers"  value={stats.totalAccountManagers}  colorIndex={2} />
            <StatCard icon={UserCheck} label="Total Account Users"     value={stats.totalAccountUsers}     colorIndex={3} />
          </>
        )}
        {displayVariant === 'tenant_admin' && (
          <>
            <StatCard icon={Users}     label="Total Users"            value={stats.totalUsers}           colorIndex={4} />
            <StatCard icon={Briefcase} label="Total Account Managers" value={stats.totalAccountManagers} colorIndex={5} />
            <StatCard icon={UserCheck} label="Total Account Users"    value={stats.totalAccountUsers}    colorIndex={6} />
          </>
        )}
      </div>
    </div>
  );
};

export default OverviewChart;
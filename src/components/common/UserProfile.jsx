import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../utils/authInterceptor';
import { User as UserIcon, Mail, Briefcase, Phone, Building, X } from 'lucide-react'; // Added X for the close button

// --- Helper Components for Professional Styling ---

// Skeleton Loader for data fields (Clean professional pulse)
const ProfessionalSkeletonRow = () => (
    <div className="flex justify-between items-center py-3 animate-pulse">
        <div className="w-1/5 h-3 bg-gray-200 rounded"></div>
        <div className="w-2/5 h-3 bg-gray-200 rounded"></div>
    </div>
);

// Component for a single profile detail row
const ProfessionalDetailRow = ({ icon: Icon, label, value }) => (
    <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
        <div className="flex items-center text-sm font-medium text-gray-500">
            <Icon size={16} className="mr-3 text-blue-600 opacity-70" />
            {label}
        </div>
        <span className="text-sm text-gray-800 font-semibold truncate max-w-[60%] text-right">
            {value || 'N/A'}
        </span>
    </div>
);

// --- Main Professional Component ---

const UserProfile = ({ user, token, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState({});
    const [tenantName, setTenantName] = useState('Loading...');

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            try {
                // Fetch user info and related tenant in one PostgREST relational select
                const userResp = await axios.get(
                    `/api/v1/tables/ap_users?id=eq.${user.user_id}&select=*,ap_tenants(tenant_id,tenant_name)`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (!mounted) return;

                const u = (userResp.data && userResp.data[0]) || {};
                setProfile(u);

                // Tenant name comes from the relational select: response.data[0].ap_tenants.tenant_name
                const tenantRel = u.ap_tenants;
                const resolvedTenantName = (
                    (tenantRel && tenantRel.tenant_name) ||
                    (Array.isArray(tenantRel) && tenantRel[0] && tenantRel[0].tenant_name)
                );

                if (resolvedTenantName) {
                    setTenantName(resolvedTenantName);
                } else {
                    setTenantName(user.role === 'super_admin' ? 'Super Admin Mode' : 'Not Available');
                }

            } catch (err) {
                // fallback to basic values
                setProfile({ user_name: user.name || '', email: user.email || '', user_role: user.role || '' });
                setTenantName(user.role === 'super_admin' ? 'Super Admin Mode' : 'Not Available');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();

        return () => { mounted = false; };
    }, [user, token]);

    // Role formatting for the badge
    const rawRole = (profile.user_role || user.role || '');
    const roleText = rawRole.replace(/_/g, ' ') || 'Role Unknown';
    
    // Professional color coding for roles
    const getRoleBadgeClasses = (role) => {
        const lowerRole = role.toLowerCase();
        if (lowerRole.includes('admin')) return 'bg-red-50 text-red-700 border border-red-200';
        if (lowerRole.includes('manager')) return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
        return 'bg-blue-50 text-blue-700 border border-blue-200';
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div 
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm"
            onClick={onClose} 
        >
            <div 
                className="w-[92%] max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300"
                onClick={(e) => e.stopPropagation()} 
            >
                {/* Header Section (Flat, High Contrast) */}
                <div className="p-5 border-b border-gray-200 flex items-start justify-between bg-[#f0eee5]">
                    <div className="flex items-center">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-4 border border-blue-200 shadow-sm">
                            <UserIcon size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 truncate">
                                {loading ? 'Fetching User Data...' : (profile.user_name || user.name || 'User Profile')}
                            </h3>
                            {/* <p className="text-sm text-gray-500 truncate">
                                {loading ? 'Loading Email...' : (profile.email || user.email || 'N/A')}
                            </p> */}
                        </div>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="text-gray-400 p-1 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Profile Details Section */}
                <div className="p-5">
                    <div className="flex justify-start mb-4">
                         <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${getRoleBadgeClasses(rawRole)}`}>
                            {loading ? 'Loading Role' : roleText}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                        {loading ? (
                            <>
                                <ProfessionalSkeletonRow />
                                <ProfessionalSkeletonRow />
                                <ProfessionalSkeletonRow />
                                <ProfessionalSkeletonRow />
                            </>
                        ) : (
                            <>
                                <ProfessionalDetailRow 
                                    icon={UserIcon} 
                                    label="Username" 
                                    value={profile.user_name || user.name} 
                                />
                                <ProfessionalDetailRow 
                                    icon={Mail} 
                                    label="Email" 
                                    value={profile.email || user.email} 
                                />
                                {/* <ProfessionalDetailRow 
                                    icon={Briefcase} 
                                    label="Role" 
                                    value={roleText} 
                                /> */}
                                <ProfessionalDetailRow 
                                    icon={Phone} 
                                    label="Contact No." 
                                    value={profile.contact} 
                                />
                                <ProfessionalDetailRow 
                                    icon={Building} 
                                    label="Tenant" 
                                    value={tenantName} 
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* Footer/Action Button */}
                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 bg-gray-700 text-white rounded-md text-sm font-medium shadow-sm hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default UserProfile;
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Settings, LogOut, User, Menu, Building2, CircleChevronDown } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { clearAuth } from '../../store/authSlice';
import axios from '../../utils/authInterceptor'; // This already imports axios with interceptors
import { apiBaseUrl } from '../../config/apiConfig';
import logoImage from '/APEdge.png';

// Helper function to convert string to Title Case (or Proper Case)
const toTitleCase = (str) => {
    if (!str) return str;

    const lowerStr = str.toLowerCase();

    const specialStatuses = ['super admin mode', 'error loading tenant', 'loading...', 'not available', 'tenant name not found'];
    if (specialStatuses.includes(lowerStr)) {
        return str;
    }

    return lowerStr.split(' ').map((word) => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};


const Navbar = ({ toggleCollapse, collapsed }) => {
    const navigate = useNavigate();

    // Get user and token from Redux state
    const user = useSelector(state => state.auth.user);
    const token = user?.token;
    const dispatch = useDispatch();

    // New state for the organization/tenant name
    const [tenantName, setTenantName] = useState('Loading...');
    // State for tenant logo
    const [tenantLogo, setTenantLogo] = useState(null);
    const [tenantLogoUrl, setTenantLogoUrl] = useState(null);

    const handleLogout = () => {
        dispatch(clearAuth());
        navigate('/login');
    };

    // Function to fetch the tenant logo
    const fetchTenantLogo = useCallback(async (currentTenantId, token, currentRole) => {
        if (!currentTenantId || !token || currentRole === 'super_admin') {
            return;
        }

        try {
            // API endpoint to fetch the tenant details based on tenant_id
            const fetchUrl = `/api/v1/tables/ap_tenants?tenant_id=eq.${currentTenantId}`;

            const response = await axios.get(fetchUrl, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const tenant = response.data?.[0];

            if (tenant && tenant.logo_path) {
                // Fetch the logo with authorization using axios to leverage interceptors
                try {
                    const logoResponse = await axios.get(`/api/${tenant.logo_path}`, {
                        responseType: 'blob', // Specify response type as blob
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (logoResponse.status === 200) {
                        const blob = logoResponse.data;
                        const objectUrl = URL.createObjectURL(blob);
                        setTenantLogo(tenant.logo_path);
                        setTenantLogoUrl(objectUrl);
                    }
                } catch (logoError) {
                    // Clear logo state on error
                    setTenantLogo(null);
                    setTenantLogoUrl(null);
                }
            } else {
                // Clear logo if none exists
                setTenantLogo(null);
                setTenantLogoUrl(null);
            }
        } catch (error) {
            // Clear logo state on error
            setTenantLogo(null);
            setTenantLogoUrl(null);
        }
    }, []);

    // Function to fetch the tenant name
    const fetchTenantName = useCallback(async (currentTenantId, token, currentRole) => {
        if (!currentTenantId || !token) {
            setTenantName(currentRole === 'super_admin' ? 'Super Admin Mode' : 'Not Available');
            return;
        }

        if (currentRole === 'super_admin') {
            setTenantName('Super Admin Mode');
            return;
        }

        try {
            // API endpoint to fetch the tenant name based on tenant_id
            const fetchUrl = `/api/v1/tables/ap_tenants?tenant_id=eq.${currentTenantId}`;

            const response = await axios.get(fetchUrl, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const tenant = response.data?.[0];

            if (tenant && tenant.tenant_name) {
                setTenantName(tenant.tenant_name);
            } else {
                setTenantName('Tenant Name Not Found');
            }
        } catch (error) {
            setTenantName('Error Loading Tenant');
        }
    }, []);

    // Combined useEffect for cleanup and tenant fetch
    useEffect(() => {
        // Fetch tenant name and logo on load/user change
        if (user) {
            fetchTenantName(user.tenantId, token, user.role);
            fetchTenantLogo(user.tenantId, token, user.role);
        }

        return () => {
            // Clean up the object URL when the component unmounts
            if (tenantLogoUrl) {
                URL.revokeObjectURL(tenantLogoUrl);
            }
        };
    }, [user, token, fetchTenantName, fetchTenantLogo]); // Added user and token to dependencies to trigger re-fetch when they change

    // Do not render the Navbar until the user object is available from Redux
    if (!user) {
        return null;
    }

    return (
        // The main container is now a flex container with three distinct sections
        <div className="h-[60px] bg-[#2c3e50] text-white flex items-center justify-between px-3.5 shadow-xl fixed top-0 left-0 w-full z-[9999] box-border">
            
            {/* LEFT SECTION: Menu Button and Organization Name/Logo */}
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                {/* Menu Toggle Button */}
                <button 
                    className="bg-white/10 p-2 rounded-lg transition-colors hover:bg-white/30" 
                    onClick={toggleCollapse}
                    aria-label="Toggle Sidebar Menu"
                >
                    <Menu size={20} />
                </button>
                
                {/* Organization/Tenant Name or Logo - Now visible on all screens */}
                <div className="flex-shrink-0"> 
                    <div className="flex flex-col text-left leading-none min-w-0">
                        {/* Show Organization label only when logo is not available */}
                        {!tenantLogoUrl && (
                            <span className="text-[10px] font-medium text-slate-400/80 uppercase tracking-wider">Organization</span>
                        )}
                        {/* Tenant Logo or Name */}
                        <div className="flex items-center gap-1 mt-0.5">
                            {tenantLogoUrl ? (
                                <div className="flex items-center">
                                    <img 
                                        src={tenantLogoUrl} 
                                        alt="Organization Logo" 
                                        className="h-8 rounded-sm w-auto max-w-[100px] md:max-w-[150px] object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <Building2 size={14} className="text-blue-400 flex-shrink-0" />
                                    <span className="text-sm font-semibold truncate text-blue-300 max-w-[100px] md:max-w-[150px]" title={toTitleCase(tenantName)}>{toTitleCase(tenantName)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* CENTER SECTION: Empty now, APEdge logo moved to the right */}
            <div className="flex-1 flex items-center justify-end min-w-0">
                
                {/* Brand Logo (Always visible) */}
                <img 
                    src={logoImage} 
                    alt="APEdge Logo" 
                    className="h-6 w-auto object-contain"
                />
            </div>

            {/* RIGHT SECTION: User Profile and Notifications (Visible on sm: and up) */}
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                {/* Notifications Button */}
                {/* <button 
                    className="bg-white/10 p-2 rounded-lg transition-colors hover:bg-white/30" 
                    aria-label="Notifications"
                >
                    <Bell size={20} />
                </button> */}

                {/* User Profile Button */}
                {/* <button 
                    className="bg-white/10 p-2 rounded-lg transition-colors hover:bg-white/30" 
                    aria-label="User Profile"
                >
                    <User size={20} />
                </button> */}

                {/* Settings Button */}
                {/* <button 
                    className="bg-white/10 p-2 rounded-lg transition-colors hover:bg-white/30" 
                    aria-label="Settings"
                >
                    <Settings size={20} />
                </button> */}

                {/* Logout Button */}
                {/* <button 
                    className="bg-white/10 p-2 rounded-lg transition-colors hover:bg-white/30" 
                    onClick={handleLogout}
                    aria-label="Logout"
                >
                    <LogOut size={20} />
                </button> */}

            </div>
        </div>
    );
};

export default Navbar;
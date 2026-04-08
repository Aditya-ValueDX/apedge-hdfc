import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Settings, LogOut, User, Menu, Building2, CircleChevronDown } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { clearAuth } from '../../store/authSlice';
import axios from '../../utils/authInterceptor'; // This already imports axios with interceptors
import { apiBaseUrl } from '../../config/apiConfig';
import logoImage from '../../assets/hdfc-life-logo.png';

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

    const handleLogout = () => {
        dispatch(clearAuth());
        navigate('/login');
    };

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

    // Combined useEffect for tenant name fetch
    useEffect(() => {
        // Fetch tenant name on load/user change
        if (user) {
            fetchTenantName(user.tenantId, token, user.role);
        }
    }, [user, token, fetchTenantName]); // Added user and token to dependencies to trigger re-fetch when they change

    // Do not render the Navbar until the user object is available from Redux
    if (!user) {
        return null;
    }

    return (
        // The main container is now a flex container with two distinct sections
        <div className="h-[60px] bg-[#2c3e50] text-white flex items-center justify-between px-3.5 shadow-xl fixed top-0 left-0 w-full z-[9999] box-border">
            
            {/* LEFT SECTION: Menu Button and Brand Logo */}
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                {/* Menu Toggle Button */}
                <button 
                    className="bg-white/10 p-2 rounded-lg transition-colors hover:bg-white/30" 
                    onClick={toggleCollapse}
                    aria-label="Toggle Sidebar Menu"
                >
                    <Menu size={20} />
                </button>
                
                {/* Brand Logo (Always visible) */}
                <img 
                    src={logoImage} 
                    alt="HDFC Logo" 
                    className="h-9 w-auto object-contain"
                />
            </div>
        </div>
    );
};

export default Navbar;
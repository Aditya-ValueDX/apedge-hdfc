import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    LayoutDashboard,
    UploadCloud,
    FileText,
    ScanText,
    Link2,
    CheckCircle,
    BarChart2,
    Receipt,
    Shield,
    Folder,
    File,
    Users,
    Settings,
    HandCoins,
    ListChecks,
    FileCog,
    SlidersHorizontal,
    Database,
    ShoppingCart,
    ClipboardCheck,
    Image,
    FileKey2,
    LogOut,
    User,
    CircleChevronDown,
    Search,
    HelpCircle,
    Crown,
    Contact,
    Clock
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { clearAuth } from '../../store/authSlice';
import axios from '../../utils/authInterceptor';
import { createPortal } from 'react-dom';
import UserProfile from './UserProfile';

// Import the updated canUserView function
import { canUserView } from '../../permissions';
import { useTourManager } from './TourManager';
import { loadSecure, saveSecure } from '../../utils/secureStorage';
import useVendorWorkflow from '../../hooks/useVendorWorkflow'; // Vendor workflow hook

const Sidebar = ({ collapsed, toggleCollapse, onHelpPopupToggle }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();
    const dropdownRef = useRef(null);
    const { startTour } = useTourManager(); // Add useTourManager hook

    // Vendor workflow config — used to conditionally show the Vendor loading placeholder
    const { workflowConfig: vendorWorkflowConfig, loading: vendorWorkflowLoading } = useVendorWorkflow();

    // Get user and token from Redux store
    const user = useSelector(state => state.auth.user);
    const token = user?.token;

    const [openMenus, setOpenMenus] = useState({ 'Invoice': true, 'Input': true });
    const [hoveredItem, setHoveredItem] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [userName, setUserName] = useState(user?.name || 'User');
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredMenuItems, setFilteredMenuItems] = useState([]);
    const [hasReconciliationAccess, setHasReconciliationAccess] = useState(false);
    // State for help tour popup
    const [showHelpPopup, setShowHelpPopup] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    // State for tracking window size
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });

    const [showSidebarContent, setShowSidebarContent] = useState(!collapsed);

    useEffect(() => {
        if (!collapsed) {
            // Delay content until the expand animation finishes
            const timer = setTimeout(() => setShowSidebarContent(true), 200);
            return () => clearTimeout(timer);
        } else {
            // Instantly hide content when collapsing
            setShowSidebarContent(false);
        }
    }, [collapsed]);


    // Track window resize events
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!showHelpPopup && onHelpPopupToggle) {
            onHelpPopupToggle(false);
        }
    }, [showHelpPopup, onHelpPopupToggle]);


    // Check if this is the user's first visit to the dashboard
    useEffect(() => {
        if (!user || location.pathname !== '/dashboard') return;

        const key = `sidebar_help_seen_${user.user_id}`;

        const alreadySeen = localStorage.getItem(key);

        if (!alreadySeen) {
            setTimeout(() => {
                setShowHelpPopup(true);
            }, 1200);
        }
    }, [user, location.pathname]);


    // Fetch user name from ap_users table
    const fetchUserName = useCallback(async () => {
        if (!user || !user.user_id || !token) return;

        try {
            const response = await axios.get(`/api/v1/tables/ap_users?id=eq.${user.user_id}&select=user_name`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data && response.data.length > 0 && response.data[0].user_name) {
                setUserName(response.data[0].user_name);
            }
        } catch (error) {
            // Fallback to the name from Redux if available
            setUserName(user?.name || 'User');
        }
    }, [user]);

    // Check if tenant has reconciliation enabled
    const checkReconciliationAccess = useCallback(async () => {
        if (!user || !user.tenantId || !token) return;

        try {
            // Fetch the enable_reconciliation parameter for this tenant
            const response = await axios.get(`/api/v1/tables/ap_parameters?tenant_id=eq.${user.tenantId}&unique_key=eq.enable_reconciliation`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data && response.data.length > 0) {
                // Check if the parameter value is 'true'
                const paramValue = response.data[0].req_value;
                setHasReconciliationAccess(paramValue === 'true' || paramValue === true);
            } else {
                // Parameter not found, check if user is super_admin
                setHasReconciliationAccess(user.role === 'super_admin');
            }
        } catch (error) {
            // Default to false if there's an error
            setHasReconciliationAccess(false);
        }
    }, [user]);

    useEffect(() => {
        fetchUserName();
        checkReconciliationAccess();
    }, [fetchUserName, checkReconciliationAccess]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = () => {
        navigate('/login');
        dispatch(clearAuth());
    };

    const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

    const buildMenuItems = useMemo(() => {
        if (!user || !user.role) {
            return [];
        }

        const { role, TableConfigExists: hasTableConfig,modules } = user;
        const hasVendorAccess = modules?.Vendor === true || modules?.vendor === true || user.role === 'super_admin';
        const hasInvoiceAccess = modules?.Invoice === true || modules?.invoice === true || user.role === 'super_admin';

        const baseMenuItems = [
            // {
            //     label: 'Dashboard',
            //     path: '/dashboard',
            //     icon: <LayoutDashboard size={18} />,
            // },
            {
                label: 'Dashboard',
                path: '/vendor/dashboard',
                icon: <LayoutDashboard size={18} />,
            },
            // {
            //     label: 'Input',
            //     path: '/input',
            //     icon: <UploadCloud size={18} />,
            //     children: [
            //         { label: 'Source', path: '/source', icon: <Folder size={14} /> },
            //         { label: 'Documents', path: '/documents', icon: <File size={14} /> },
            //     ],
            // },
            // {
            //     label: 'Invoice',
            //     path: '/invoice',
            //     icon: <FileText size={18} />,
            //     children: [
            //         {
            //             label: 'Invoice Queue',
            //             path: '/invoice_queue',
            //             icon: <ScanText size={14} />,
            //         },
            //         {
            //             label: 'Final Invoices',
            //             path: '/final_queue',
            //             icon: <CheckCircle size={14} />,
            //         },
            //     ],
            // },
            // Add Vendor Queue as main menu item
            {
                label: 'Pending Queue',
                path: '/vendor_queue',
                icon: <Clock size={18} />,
            },
            // Add Vendor Final Queue as main menu item
            {
                label: 'Final Queue',
                path: '/vendor_final_queue',
                icon: <Folder size={18} />,
            },
            // Add Reconciliation menu item conditionally
            // ...(hasReconciliationAccess ? [
            //     {
            //         label: 'Reconciliation',
            //         path: '/reconciliation',
            //         icon: <Link2 size={18} />,
            //         children: [
            //             { label: 'Reconciliation Queue', path: '/reconcile_queue', icon: <ListChecks size={14} /> },
            //         ],
            //     }
            // ] : []),
            // {
            //     label: 'Reports', path: '/invoice_reports', icon: <BarChart2 size={18} />,
            //     children: [
            //         {
            //             label: 'Invoice Reports',
            //             path: '/invoice_reports',
            //             icon: <ScanText size={14} />,
            //         },
            //         ...(hasVendorAccess ? [{
            //             label: 'Vendor Reports',
            //             path: '/vendor_reports',
            //             icon: <FileText size={14} />,
            //         }] : []),
            //     ]
            // },
            // { label: 'Billing', path: '/billing', icon: <HandCoins size={18} /> },
        ];

        const adminConfigItems = [
            // {
            //     label: 'Invoice Field Config',
            //     path: '/configure',
            //     icon: <FileCog size={14} />,
            // },
            ...(hasVendorAccess ? [{
                label: 'Field Config',
                path: '/vendor_configure',
                icon: <Settings size={14} />
            }] : []),
            // {
            //     label: 'Parameters',
            //     path: '/parameters',
            //     icon: <SlidersHorizontal size={14} />,
            // },
            // {
            //     label: 'Masters',
            //     path: '/masters',
            //     icon: <Database size={14} />,
            // },
            {
                label: 'User Management',
                path: '/users',
                icon: <Users size={14} />,
            },
            // ...(role === 'tenant_admin' ? [
            //     {
            //         label: 'Tenant Logo',
            //         path: '/tenantlogo',
            //         icon: <Image size={14} />,
            //     }
            // ] : [])
        ];

        const poSubmenuItems = [
            { label: 'PO Queue', path: '/po_queue', icon: <ListChecks size={14} /> },
            { label: 'Approved POs', path: '/po_completed', icon: <ClipboardCheck size={14} /> },
        ];

        let filteredMenuItems = [];

        if (role === 'tenant_admin' && !hasTableConfig) {
            const adminChildren = [];
            // Check if invoice module is enabled before showing invoice config
            const hasInvoiceAccessLocal = modules?.Invoice === true || modules?.invoice === true || user.role === 'super_admin';
            if (canUserView(role, '/configure') && hasInvoiceAccessLocal) {
                adminChildren.push({
                    label: 'Invoice Field Config',
                    path: '/configure',
                    icon: <FileCog size={14} />,
                });
            }
            // Check if vendor module is enabled before showing vendor config
            const hasVendorAccessLocal = modules?.Vendor === true || modules?.vendor === true || user.role === 'super_admin';
            if (canUserView(role, '/vendor_configure') && hasVendorAccessLocal) {
                adminChildren.push({
                    label: 'Vendor Invoice Config',
                    path: '/vendor_configure',
                    icon: <Settings size={14} />,
                });
            }
            if (adminChildren.length > 0) {
                return [{
                    label: 'Admin',
                    path: '/admin',
                    icon: <Shield size={18} />,
                    children: adminChildren,
                }];
            }
            return [];
        } else if ((role === 'account_user' || role === 'account_manager') && !hasTableConfig) {
            if (canUserView(role, '/dashboard')) {
                return [{ label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> }];
            }
            return [];
        }

        // These child paths are gated by hasVendorAccess at the menu-building level
        // and are NOT registered in canUserView — bypassing canUserView for them only.
        const vendorOnlyChildPaths = new Set(['/vendor_queue', '/vendor_final_queue', '/vendor_reports']);

        // These top-level paths are also vendor-gated and not in canUserView
        const vendorOnlyTopLevelPaths = new Set(['/vendor/dashboard']);

        // Filter base items
        baseMenuItems.forEach((item) => {
            if (item.children) {
                const visibleChildren = item.children.filter((child) =>
                    vendorOnlyChildPaths.has(child.path) ? true : canUserView(role, child.path)
                );
                if (visibleChildren.length > 0) {
                    filteredMenuItems.push({ ...item, children: visibleChildren });
                }
            } else if (vendorOnlyTopLevelPaths.has(item.path) || canUserView(role, item.path)) {
                filteredMenuItems.push(item);
            }
        });

        // Add Admin menu if applicable
        if (role === 'tenant_admin' || role === 'super_admin') {
            const adminChildren = adminConfigItems.filter((item) => canUserView(role, item.path));
            
            // Add Tenant Registration to admin menu for tenant admins
            if (canUserView(role, '/tenantreg') && (role === 'tenant_admin' || role === 'super_admin')) {
                adminChildren.push({
                    label: 'Channel Registration',
                    path: '/tenantreg',
                    icon: <Receipt size={14} />,
                });
            }
            
            if (adminChildren.length > 0) {
                filteredMenuItems.push({
                    label: 'Admin',
                    path: '/admin',
                    icon: <Shield size={18} />,
                    children: adminChildren,
                });
            }
        }

        // Add Super Admin menu for Super Admin users
        if (role === 'super_admin') {
            const superAdminItems = [];
            
            // Add Default Configuration if user can view it
            if (canUserView(role, '/defaultconfig')) {
                superAdminItems.push({
                    label: 'Default Configuration',
                    path: '/defaultconfig',
                    icon: <FileKey2 size={14} />,
                });
            }
            
            // Add Generic Fields if user can view it
            if (canUserView(role, '/generic-fields')) {
                superAdminItems.push({
                    label: 'Generic Fields',
                    path: '/generic-fields',
                    icon: <Database size={14} />,
                });
            }
            
            // Only add the Super Admin menu if there are items to show
            if (superAdminItems.length > 0) {
                filteredMenuItems.push({
                    label: 'Super Admin',
                    path: '/super-admin',
                    icon: <Crown size={18} />,
                    children: superAdminItems,
                });
            }
        }

        return filteredMenuItems;
    }, [user, hasReconciliationAccess]);

    const menuItems = buildMenuItems;

    useEffect(() => {
        if (!user || menuItems.length === 0) return;

        const initialOpenState = menuItems.reduce((acc, item) => {
            if (item.children) {
                const isActiveParent = item.children.some(child => location.pathname.startsWith(child.path));
                if (isActiveParent) {
                    acc[item.label] = true;
                }
            } else if (location.pathname.startsWith(item.path)) {
                // If a top-level item is active, don't auto-open any parent menus.
            }
            return acc;
        }, {});

        // Keep existing open states and add new ones based on active path
        setOpenMenus(prev => ({ ...prev, ...initialOpenState }));
    }, [location.pathname, user, menuItems]);

    const toggleMenu = (label) => {
        setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
    };

    const handleNavigation = (path) => {
        navigate(path);
        if (window.innerWidth <= 1024) {
            toggleCollapse();
        }
    };

    const isPathActive = (path) => {
        const baseRoute = path.split('/')[1];
        if (baseRoute) {
            // Special case for paths like /editor/:id
            if (location.pathname.startsWith(`/${baseRoute}/`)) {
                return true;
            }
        }
        return location.pathname === path;
    };

    const isParentActive = (item) => {
        if (item.children) {
            return item.children.some(child => isPathActive(child.path));
        }
        return false;
    };

    // Filter menu items based on search term
    useEffect(() => {
        if (!searchTerm) {
            setFilteredMenuItems(menuItems);
            return;
        }

        const term = searchTerm.toLowerCase();
        const filtered = menuItems.reduce((acc, item) => {
            // Check if the parent item matches
            const parentMatches = item.label.toLowerCase().includes(term);

            // Check if any children match
            if (item.children) {
                const matchingChildren = item.children.filter(child =>
                    child.label.toLowerCase().includes(term)
                );

                // If parent matches or has matching children, include it
                if (parentMatches || matchingChildren.length > 0) {
                    acc.push({
                        ...item,
                        children: parentMatches ? item.children : matchingChildren
                    });
                }
            } else if (parentMatches) {
                // If no children and parent matches
                acc.push(item);
            }

            return acc;
        }, []).sort((a, b) => {
            // Sort to show exact matches first, then partial matches
            const aLabel = a.label.toLowerCase();
            const bLabel = b.label.toLowerCase();
            const termIndexA = aLabel.indexOf(term);
            const termIndexB = bLabel.indexOf(term);

            // Exact matches first
            if (termIndexA === 0 && termIndexB !== 0) return -1;
            if (termIndexB === 0 && termIndexA !== 0) return 1;

            // Then by position of match
            if (termIndexA !== termIndexB) return termIndexA - termIndexB;

            // Finally alphabetically
            return aLabel.localeCompare(bLabel);
        });

        setFilteredMenuItems(filtered);
    }, [searchTerm, menuItems]);

    // Handle closing the help popup and mark as seen
    const closeHelpPopup = () => {
        setShowHelpPopup(false);
        if (user?.user_id) {
            const key = `sidebar_help_seen_${user.user_id}`;
            localStorage.setItem(key, "true");
        }
    };

    return (
        <>
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                
                @keyframes shimmer {
                    from { left: -100%; }
                    to { left: 100%; }
                }
                
                @keyframes slideInFloat {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }

                /* NEW: Animation for the modern tooltip pop-in effect */
                @keyframes tooltipPop {
                    from { opacity: 0; transform: translate(10px, -50%); }
                    to { opacity: 1; transform: translate(0px, -50%); }
                }

                .tooltip-pop {
                    animation: tooltipPop 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                
                .nav-item-shimmer::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
                    transition: left 0.5s ease;
                }
                
                .nav-item-shimmer:hover::before {
                    left: 100%;
                }
                
                .caret-rotate {
                    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
                    transform-origin: center;
                }
                
                .caret-rotate.rotated {
                    transform: rotate(180deg);
                }
                
                .floating-submenu {
                    animation: slideInFloat 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                
                .scrollbar-custom::-webkit-scrollbar {
                    width: 7px;
                    transition: width 0.3s ease;
                }
                
                .scrollbar-custom::-webkit-scrollbar-track {
                    background: transparent;
                }
                
                .scrollbar-custom::-webkit-scrollbar-thumb {
                    background: #acacac;
                    cursor: pointer;
                    transition: background 0.3s ease;
                }
                
                .scrollbar-custom::-webkit-scrollbar-thumb:hover {
                    background: #696969;
                    width: 8px;
                    cursor: pointer;
                }

                .sidebar-mobile-overlay {
                    z-index: 1000;
                    transition: opacity 0.3s ease-in-out;
                    opacity: 0;
                    pointer-events: none;
                }
                
                .sidebar-mobile-overlay.active {
                    opacity: 1;
                    pointer-events: auto;
                }
                
                /* Fade in animation for help popup */
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out forwards;
                }
                
                /* Center the help popup on mobile screens */
                @media (max-width: 1023px) {
                    .help-popup-mobile-center {
                        left: 50% !important;
                        transform: translateX(-50%) !important;
                    }
                }
                `}
            </style>

            <aside
                className={`fixed top-[60px] left-0 h-[calc(100vh-60px)] bg-gradient-to-b from-slate-800 to-slate-900 text-white transition-all duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-2xl z-[3001]
        ${collapsed ? 'w-16' : 'w-[220px]'}
        lg:transform-none transform
        ${collapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
        flex flex-col
        ${showHelpPopup ? 'sidebar-blur-active' : ''}
    `}
                style={{ fontFamily: 'Poppins, sans-serif' }}
            >
                {/* Search Bar */}
                {showSidebarContent && (
                    <div className="m-1 relative transition-opacity duration-200 opacity-100">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search menus..."
                            className="w-full py-1 pl-10 pr-10 bg-slate-700/50 text-white text-sm rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                onClick={() => setSearchTerm('')}
                            >
                                <svg className="h-4 w-4 text-slate-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                <nav className={`flex-1 py-1 border-t border-slate-400/50 ${collapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}
                ${showHelpPopup ? 'blur-sm brightness-50 pointer-events-none' : ''} scrollbar-custom`}>
                    {(searchTerm ? filteredMenuItems : menuItems).map((item) => {
                        const isOpen = openMenus[item.label] ?? false;
                        const isActive = isParentActive(item) || isPathActive(item.path);
                        const isHovered = hoveredItem === item.label;

                        // Render a loading placeholder in the Vendor tab position while workflow config is being fetched
                        if (item.label === 'Vendor' && vendorWorkflowLoading) {
                            return (
                                <div
                                    key="vendor-loading"
                                    className={`relative mx-2 my-0.5 rounded-lg flex items-center gap-3 py-1.5 px-3.5 ${collapsed ? 'justify-center py-3.5 px-3' : ''}`}
                                    title={collapsed ? 'Vendor (loading...)' : undefined}
                                >
                                    <div className="flex items-center justify-center min-w-[20px]">
                                        <svg
                                            className="animate-spin text-slate-400"
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                        </svg>
                                    </div>
                                    {!collapsed && (
                                        <span className="text-xs font-normal text-slate-400">Vendor</span>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div
                                key={item.label}
                                className="relative"
                                onMouseEnter={() => setHoveredItem(item.label)}
                                onMouseLeave={() => setHoveredItem(null)}
                            >
                                <div
                                    className={`nav-item-shimmer relative overflow-hidden mx-2 my-0.5 rounded-lg cursor-pointer transition-all duration-300 ease-out flex items-center gap-3 ${collapsed ? 'justify-center py-3.5 px-3' : 'justify-between py-1.5 px-3.5'
                                        } ${isActive
                                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg shadow-blue-600/30'
                                            : 'hover:bg-white/10 hover:transform hover:translate-x-1'
                                        } ${isActive && 'hover:transform hover:translate-x-0.5'}`}
                                    onClick={() =>
                                        item.children
                                            ? toggleMenu(item.label)
                                            : handleNavigation(item.path)
                                    }
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="flex items-center justify-center min-w-[20px] transition-transform duration-300 hover:scale-110">
                                            {item.icon}
                                        </div>
                                        {!collapsed && (
                                            <span className="text-xs font-normal truncate">{item.label}</span>
                                        )}
                                    </div>
                                    {!collapsed && item.children && (
                                        <svg
                                            className={`caret-rotate opacity-60 w-[14px] h-[14px] flex-shrink-0 ${isOpen ? '' : 'rotated'}`}
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <path d="M12 6.5c.55 0 1.05.23 1.38.65l7.1 8.8C21.3 17.1 20.5 18.5 19.1 18.5H4.9c-1.4 0-2.2-1.4-1.38-2.55l7.1-8.8C10.95 6.73 11.45 6.5 12 6.5z" />
                                        </svg>
                                    )}
                                </div>

                                {/* Tooltip for items without children when collapsed */}
                                {!item.children && collapsed && isHovered && (
                                    <div className="hidden lg:block floating-submenu pointer-events-none absolute left-full top-3 z-[1300] ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                                        {item.label}
                                        {/* Tooltip Arrow */}
                                        <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-l border-slate-700 bg-slate-800"></div>
                                    </div>
                                )}


                                {item.children && (
                                    <>
                                        {!collapsed && (
                                            <div className={`overflow-hidden transition-all duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] ${isOpen ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
                                                }`}>
                                                <div className="mx-2.5 mt-1 mb-2 bg-black/20 rounded-lg py-2 border-l-2 border-blue-600">
                                                    {item.children.map((child) => (
                                                        <div
                                                            key={child.path}
                                                            className={`relative mx-1.5 my-0.5 py-2.5 px-4 text-xs text-slate-300 cursor-pointer rounded-md transition-all duration-300 flex items-center gap-2 border-l-4 border-transparent ${isPathActive(child.path)
                                                                ? 'bg-blue-600/20 text-white font-semibold border-l-blue-600'
                                                                : 'hover:bg-white/10 hover:text-white hover:transform hover:translate-x-1 hover:border-l-blue-600'
                                                                } before:absolute before:left-0 before:top-1/2 before:w-0 before:h-0 before:bg-blue-600 before:rounded-r before:transform before:-translate-y-1/2 before:transition-all before:duration-300 ${isPathActive(child.path) ? 'before:h-full' : 'hover:before:h-3/5'
                                                                }`}
                                                            onClick={() => handleNavigation(child.path)}
                                                        >
                                                            {child.icon && (
                                                                <span className={`inline-flex items-center justify-center text-slate-400 transition-all duration-300 ${isPathActive(child.path) ? 'text-white transform scale-110' : 'hover:text-white hover:transform hover:scale-110'
                                                                    }`}>
                                                                    {child.icon}
                                                                </span>
                                                            )}
                                                            <span>{child.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {collapsed && isHovered && (
                                            <div className="hidden lg:block floating-submenu absolute left-[88%] top-0 min-w-[220px] ml-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-2xl z-[1200] border border-white/10 backdrop-blur-sm">
                                                <div className="px-3.5 py-3 bg-blue-600/12 border-b border-white/8 flex items-center gap-2 font-semibold text-xs text-blue-400 rounded-t-lg">
                                                    {item.icon}
                                                    <span>{item.label}</span>
                                                </div>
                                                <div className="p-1">
                                                    {item.children.map((child) => (
                                                        <div
                                                            key={child.path}
                                                            className={`py-2.5 px-3.5 text-xs text-slate-300 cursor-pointer flex items-center gap-2 transition-all duration-150 border-l-3 border-transparent ${isPathActive(child.path)
                                                                ? 'bg-blue-600/15 text-white font-semibold border-l-blue-600'
                                                                : 'hover:bg-white/8 hover:text-white hover:border-l-blue-600 hover:transform hover:translate-x-0.5'
                                                                }`}
                                                            onClick={() => handleNavigation(child.path)}
                                                        >
                                                            {child.icon && (
                                                                <span className={`transition-all duration-150 ${isPathActive(child.path) ? 'text-blue-400 transform scale-110' : ''
                                                                    }`}>
                                                                    {child.icon}
                                                                </span>
                                                            )}
                                                            <span>{child.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Combined Help and User Profile Section */}
                <div className="border-t border-slate-400/50 p-2 mt-auto bg-slate-600/70">
                    {/* Help Button */}
                    <div
                        key="Help"
                        className={`relative mb-2 ${showHelpPopup ? 'blur-0 brightness-100 pointer-events-auto' : ''
                            }`}
                        onMouseEnter={() => setHoveredItem('Help')}
                        onMouseLeave={() => setHoveredItem(null)}
                        id="sidebar-help-button"
                    >
                        <div
                            className={`nav-item-shimmer relative overflow-hidden my-0.5 rounded-lg cursor-pointer transition-all duration-300 ease-out flex items-center gap-3 ${collapsed ? 'justify-center py-3 px-3' : 'justify-between py-1.5 px-3.5'
                                } hover:bg-white/10 hover:transform hover:translate-x-1 bg-slate-700/50 ring-2 ring-blue-500/30 ring-opacity-70`}
                            onClick={() => {
                                // Determine the current page to start the appropriate tour
                                const path = window.location.pathname;
                                let pageName = 'dashboard'; // default

                                // More specific routes first to avoid overlap
                                if (path === '/invoice_reports') {
                                    pageName = 'reports';
                                } else if (path === '/documents') {
                                    pageName = 'documentsQueue';
                                } else if (path === '/source') {
                                    pageName = 'uploadInvoice';
                                } else if (path === '/invoice_queue') {
                                    pageName = 'extractionQueue';
                                } else if (path === '/final_queue') {
                                    pageName = 'finalQueue';
                                } else if (path === '/reconcile_queue') {
                                    pageName = 'reconcileQueue';
                                } else if (path.startsWith('/reconcile_queue/')) {
                                    pageName = 'reconciliationView';
                                } else if (path.startsWith('/editor/')) {
                                    pageName = 'editor';
                                } else if (path === '/configure') {
                                    pageName = 'invoiceConfig';
                                } else if (path === '/parameters') {
                                    pageName = 'parameters';
                                } else if (path === '/masters') {
                                    pageName = 'masters';
                                } else if (path === '/users') {
                                    pageName = 'userManagement';
                                } else if (path === '/tenantreg') {
                                    pageName = 'tenantRegistration';
                                } else if (path === '/defaultconfig') {
                                    pageName = 'default-config';
                                } else if (path === '/tenantlogo') {
                                    pageName = 'tenantLogoManagement';
                                } else if (path === '/match') {
                                    pageName = 'matchInvoice';
                                } else if (path.startsWith('/view/')) {
                                    pageName = 'viewDocumentModal';
                                } else if (path.startsWith('/po-editor/')) {
                                    pageName = 'poEditor';
                                } else if (path === '/request-view') {
                                    pageName = 'requestView';
                                } else if (path.startsWith('/invoice-detail/')) {
                                    pageName = 'viewInvoiceDetail';
                                } else if (path === '/super-admin') {
                                    pageName = 'superAdmin';
                                }

                                if (onHelpPopupToggle) {
                                    onHelpPopupToggle(true);
                                }
                                startTour(pageName, true);
                            }}
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="flex items-center justify-center min-w-[20px] transition-transform duration-300 hover:scale-110">
                                    <HelpCircle size={16} className="text-white drop-shadow-[0_0_4px_rgba(59,130,246,0.7)]" />
                                </div>
                                {!collapsed && (
                                    <span className="text-xs font-medium truncate text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]">Help</span>
                                )}
                            </div>
                            {/* {!collapsed && (
                                <HelpCircle size={14} className="text-blue-400 opacity-80" />
                            )} */}
                        </div>

                        {collapsed && hoveredItem === 'Help' && (
                            <div className="tooltip-pop absolute left-full top-1/2 transform -translate-y-1/2 ml-4 min-w-max bg-slate-700/95 text-white text-xs px-3 py-2 rounded-xl shadow-2xl shadow-blue-500/50 z-[1350] border border-blue-600/50 pointer-events-none">
                                Help
                                <div className="absolute left-[-6px] top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-[6px] border-b-[6px] border-r-[6px] border-solid border-t-transparent border-b-transparent border-r-slate-700/95"></div>
                            </div>
                        )}
                    </div>

                    {/* User Profile Section at the bottom */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            className={`flex items-center gap-2 w-full p-2 rounded-lg cursor-pointer transition-all duration-200 ${collapsed
                                ? 'justify-center'
                                : 'justify-between bg-[#34495e] hover:bg-[#576f88]'
                                }`}
                            onClick={toggleDropdown}
                            aria-expanded={dropdownOpen}
                            aria-controls="user-dropdown-menu"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[#3498db] flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {user.avatar ? (
                                        <img src={user.avatar} alt="User Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={18} />
                                    )}
                                </div>
                                {showSidebarContent && (
                                    <div className="flex flex-col items-start leading-snug">
                                        <span className="text-xs font-normal leading-tight truncate max-w-[120px] capitalize">{userName}</span>
                                        <span className="text-[10px] text-[#bdc3c7] leading-tight capitalize">
                                            {user.role?.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {!collapsed && (
                                <CircleChevronDown
                                    size={16}
                                    className={`transition-transform duration-250 ease-in-out ${dropdownOpen ? 'rotate-180' : ''}`}
                                />
                            )}
                        </button>

                        {/* Dropdown inside sidebar when expanded */}
                        {showSidebarContent && dropdownOpen && (
                            <div
                                id="user-dropdown-menu"
                                className="absolute bottom-full left-0 mb-2 bg-white text-[#2c3e50] rounded-lg shadow-xl min-w-full z-50 opacity-100 translate-y-0 transition-all duration-200 ease-out p-1 overflow-hidden"
                                role="menu"
                            >
                                <div className="bg-[#f8f9fa] p-3 rounded-t-md border-b border-[#e9ecef]">
                                    <div className="text-xs">
                                        <span className="block text-xs font-medium  text-[#34495e] mb-0.5 capitalize">{userName}</span>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] text-[#566573] truncate">{user.email}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="flex items-center w-full gap-2 p-2 cursor-pointer transition-colors duration-200 hover:bg-[#f1f2f6] text-xs font-medium"
                                    onClick={() => setShowProfileModal(true)}
                                    role="menuitem"
                                >
                                    <User size={14} />
                                    <span>Profile</span>
                                </button>

                                <button
                                    className="flex items-center w-full gap-2 p-2 cursor-pointer transition-colors duration-200 hover:bg-[#f1f2f6] rounded-b-md text-xs text-[#e74c3c] font-medium"
                                    onClick={handleLogout}
                                    role="menuitem"
                                >
                                    <LogOut size={14} />
                                    <span>Logout</span>
                                </button>
                            </div>
                        )}

                        {/* Dropdown outside sidebar when collapsed */}
                        {collapsed && dropdownOpen && (
                            <div
                                id="user-dropdown-menu"
                                className="absolute bottom-full left-full ml-2 bg-white text-[#2c3e50] rounded-lg shadow-xl min-w-[200px] z-50 opacity-100 translate-y-0 transition-all duration-200 ease-out p-1 overflow-hidden"
                                role="menu"
                            >
                                <div className="bg-[#f8f9fa] p-3 rounded-t-md border-b border-[#e9ecef]">
                                    <div className="text-xs">
                                        <strong className="block text-sm text-[#34495e] mb-0.5">{userName}</strong>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] text-[#566573] truncate">{user.email}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    className="flex items-center w-full gap-2 p-2 cursor-pointer transition-colors duration-200 hover:bg-[#f1f2f6] text-xs font-medium"
                                    onClick={() => setShowProfileModal(true)}
                                    role="menuitem"
                                >
                                    <User size={14} />
                                    <span>Profile</span>
                                </button>

                                <button
                                    className="flex items-center w-full gap-2 p-2 cursor-pointer transition-colors duration-200 hover:bg-[#f1f2f6] rounded-b-md text-xs text-[#e74c3c] font-medium"
                                    onClick={handleLogout}
                                    role="menuitem"
                                >
                                    <LogOut size={14} />
                                    <span>Logout</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </aside>

            {/* Mobile overlay for when sidebar is open */}
            {!collapsed && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 sidebar-mobile-overlay active"
                    onClick={toggleCollapse}
                />
            )}

            {/* Help Tour Popup Overlay */}
            {showHelpPopup &&
                createPortal(
                    <div className="fixed inset-0 z-[1300] flex items-end justify-left bg-black/70">
                        {/* POPUP BOX - Dynamically positioned based on sidebar state and screen size */}
                        <div className={`relative bg-white rounded-xl shadow-2xl p-4 border border-blue-300 ring-4 ring-blue-500/20 animate-fade-in-up mx-4 w-full max-w-xs sm:max-w-sm bottom-5
                            ${windowSize.width < 1024
                                ? 'help-popup-mobile-center'  // Mobile/small screens - perfectly centered
                                : collapsed
                                    ? 'left-20'  // Desktop collapsed
                                    : 'left-56'   // Desktop expanded
                            }`}>

                            {/* POINTER - Only show on larger screens and when sidebar is visible */}
                            {windowSize.width >= 1024 && (
                                <div className={`absolute top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[12px] border-r-white ring-2 ring-blue-500/30 ${collapsed ? '-left-3' : '-left-3'
                                    }`}>
                                </div>
                            )}

                            {/* CLOSE BUTTON */}
                            <div className="absolute top-2 right-2">
                                <button
                                    onClick={closeHelpPopup}
                                    className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors ring-1 ring-blue-500/30"
                                >
                                    <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* YOUR ORIGINAL MESSAGE */}
                            <div className="flex items-center mb-3">
                                <div className="bg-blue-100 p-2 rounded-full mr-3 ring-2 ring-blue-500/30">
                                    <HelpCircle size={16} className="text-blue-600" />
                                </div>
                                <p className="text-gray-700 text-sm font-medium">
                                    Click the <strong>Help</strong> button in the sidebar for guidance.
                                </p>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={closeHelpPopup}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-transform"
                                >
                                    Got it
                                </button>
                            </div>

                        </div>
                    </div>,
                    document.body
                )
            }

            {/* User Profile Modal */}
            {showProfileModal && (
                <UserProfile user={user} token={token} onClose={() => setShowProfileModal(false)} />
            )}

        </>
    );
};

Sidebar.defaultProps = {
    onHelpPopupToggle: () => { }
};

export default Sidebar;
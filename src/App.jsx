import React, { useState, useRef, Suspense, lazy, useEffect } from 'react';
import { preloadCriticalImages } from './utils/imageLoader';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    useLocation,
    Navigate,
    useNavigate // Added useNavigate hook
} from 'react-router-dom';
import PropTypes from 'prop-types';
import { useSelector, useDispatch, Provider } from 'react-redux';
import { jwtDecode } from 'jwt-decode';
import axios, { scheduleTokenRefresh, clearRefreshTimeout } from './utils/authInterceptor'; // Use our custom axios instance with interceptors
import { Clock, LogIn } from 'lucide-react';

// Redux store and slices
import { store } from './store/store.js';
import { setAuth, setLoading, clearAuth } from './store/authSlice';

// Utils and permissions
import { canUserView } from './permissions';
import { getStoredAuth, clearSecureData } from './utils/secureStorage';
import { apiBaseUrl } from './config/apiConfig';

// Import your components
import Sidebar from './components/common/Sidebar';
import Navbar from './components/common/Navbar';
import Login from './components/Auth/Login.jsx';
import NotFound from './components/common/NotFound.jsx';
import Unauthorized from './components/Auth/Unauthorized.jsx';
import ForgotPassword from './components/Auth/ForgetPassword.jsx';
import SessionExpired from './components/Auth/SessionExpired.jsx';
import TourProviderWrapper from './components/common/TourProviderWrapper.jsx';

// Lazy load components
const Dashboard = lazy(() => import('./components/Dashboard.jsx'));
const VendorDashboard = lazy(() => import('./components/VendorDashboard.jsx'));
const InProcess = lazy(() => import('./components/common/InProcess.jsx'));
const InvoiceConfig = lazy(() => import('./components/Admin/InvoiceConfig.jsx'));
const UserTable = lazy(() => import('./components/Admin/UserTable.jsx'));
const Reports = lazy(() => import('./components/Reports/InvoiceReports.jsx'));
const VendorReports = lazy(() => import('./components/Reports/VendorReports.jsx'));
const Parameters = lazy(() => import('./components/Admin/Parameters.jsx'));
const Masters = lazy(() => import('./components/Admin/Masters.jsx'));
const TenantRegistration = lazy(() => import('./components/Admin/TenantRegistration.jsx'));
const DefaultConfig = lazy(() => import('./components/Admin/DefaultConfig.jsx'));
const TenantLogoManagement = lazy(() => import('./components/Admin/TenantLogoManagement.jsx'));
const GenericFieldsConfig = lazy(() => import('./components/Admin/GenericFieldsConfig.jsx'));

const UploadInvoice = lazy(() => import('./components/Upload/UploadInvoice.jsx'));
const ExtractionQueue = lazy(() => import('./components/Queues/ExtractionQueue.jsx'));
const ReconQueue = lazy(() => import('./components/Queues/ReconQueue.jsx'));
const Editor = lazy(() => import('./components/Editor_components/Editor.jsx'));
const DocumentsQueue = lazy(() => import('./components/Queues/DocumentsQueue.jsx'));
const FinalQueue = lazy(() => import('./components/Queues/FinalQueue.jsx'));
const MatchInvoice = lazy(() => import('./components/View/MatchInvoice.jsx'));

// Vendor components
const VendorQueue = lazy(() => import('./components/Queues/VendorQueue.jsx'));
const VendorFinalQueue = lazy(() => import('./components/Queues/VendorFinalQueue.jsx'));
const VendorEditor = lazy(() => import('./components/Editor_components/VendorEditor.jsx'));

// Vendor Invoice Configuration component
const VendorInvoiceConfig = lazy(() => import('./components/Admin/VendorInvoiceConfig.jsx'));

// Reconciliation components
const ReconciliationView = lazy(() => import('./components/Reconciliation/ReconciliationView.jsx'));
const ReconileQueue = lazy(() => import('./components/Reconciliation/ReconileQueue.jsx'));

// Skeleton loader components for suspense
const SkeletonLoader = ({ type = "default" }) => {
    const renderSkeleton = () => {
        switch (type) {
            case 'dashboard':
                return (
                    <div className="animate-pulse w-full p-4 md:p-8">
                        <div className="space-y-6">
                            {/* Dashboard header */}
                            <div className="h-8 w-1/3 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl"></div>

                            {/* Dashboard cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="h-36 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl shadow-sm"></div>
                                ))}
                            </div>

                            {/* Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="h-80 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl shadow-sm"></div>
                                <div className="h-80 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl shadow-sm"></div>
                            </div>

                            {/* Recent activity */}
                            <div className="h-96 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl shadow-sm"></div>
                        </div>
                    </div>
                );

            case 'table':
                return (
                    <div className="animate-pulse w-full p-4 md:p-8">
                        <div className="space-y-6">
                            {/* Table header */}
                            <div className="flex justify-between items-center">
                                <div className="h-10 w-1/3 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl"></div>
                                <div className="h-10 w-32 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl"></div>
                            </div>

                            {/* Table filters */}
                            <div className="h-16 w-full bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl"></div>

                            {/* Table rows */}
                            <div className="space-y-3">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="h-14 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl shadow-sm"></div>
                                ))}
                            </div>

                            {/* Pagination */}
                            <div className="h-12 w-64 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl mx-auto"></div>
                        </div>
                    </div>
                );

            case 'form':
                return (
                    <div className="animate-pulse w-full p-4 md:p-8">
                        <div className="space-y-8">
                            {/* Form header */}
                            <div className="h-8 w-1/2 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl"></div>

                            {/* Form fields */}
                            <div className="space-y-6">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="space-y-3">
                                        <div className="h-5 w-1/4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg"></div>
                                        <div className="h-12 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl"></div>
                                    </div>
                                ))}
                            </div>

                            {/* Form actions */}
                            <div className="flex justify-end space-x-4">
                                <div className="h-10 w-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl"></div>
                                <div className="h-10 w-32 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl"></div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="animate-pulse w-full p-4 md:p-8">
                        <div className="space-y-6">
                            <div className="h-8 w-1/2 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl"></div>
                            <div className="space-y-3">
                                <div className="h-4 w-full bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg"></div>
                                <div className="h-4 w-5/6 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg"></div>
                                <div className="h-4 w-3/4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg"></div>
                                <div className="h-4 w-full bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg"></div>
                                <div className="h-4 w-4/5 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg"></div>
                            </div>
                            <div className="h-64 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl mt-8"></div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="w-full min-h-[calc(100vh-60px)] flex flex-col items-center">
            {renderSkeleton()}
        </div>
    );
};

const getSkeletonType = (pathname) => {
    const skeletonTypes = {
        '/dashboard': 'dashboard',
        '/vendor/dashboard': 'dashboard',
        '/users': 'table',
        '/configure': 'table',
        '/invoice_reports': 'table',
        '/vendor_reports': 'table',
        '/requestview': 'table',
        '/billing': 'form',
        '/parameters': 'table',
        '/masters': 'table',
        '/tenantreg': 'table',
        '/new-request': 'form',
        '/requests': 'table',
        '/approve-requests': 'table',
        '/approvalview': 'form',
        '/defaultconfig': 'table',
        '/tenantlogo': 'table',
        '/generic-fields': 'table',
        '/vendor_queue': 'table',
        '/vendor_final_queue': 'table'
    };
    // The pathname may include a dynamic part, like /approvalview/:id
    const basePaths = Object.keys(skeletonTypes);
    const basePath = basePaths.find(path => pathname.startsWith(path));

    return skeletonTypes[basePath] || 'default';
};

const SuspenseWrapper = ({ children }) => {
    const location = useLocation();
    const skeletonType = getSkeletonType(location.pathname);

    return (
        <Suspense key={location.pathname} fallback={<SkeletonLoader type={skeletonType} />}>
            {children}
        </Suspense>
    );
};

const CustomPrivateRoute = ({ children }) => {
    const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
    const isLoading = useSelector(state => state.auth.isLoading);
    const user = useSelector(state => state.auth.user);
    const location = useLocation();
    const dispatch = useDispatch();

    // If still loading auth state, don't render anything yet to avoid premature redirect
    if (isLoading) {
        return <SkeletonLoader type={getSkeletonType(location.pathname)} />;
    }

    // Check if the user is authenticated and has user data
    if (!isAuthenticated || !user || !user.role) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Explicitly allow navigation to editor pages as they are part of a specific workflow.
    // This bypasses the role-based view permission check for these specific routes.
    const isEditorRoute = location.pathname.startsWith('/approvalview/' || '/requestview/');
    if (!isEditorRoute) {
        // Check permissions using the updated canUserView function
        const hasPermission = canUserView(user.role, location.pathname, user);
        // Since canUserView is now async, we need to handle it differently
        // For now, we'll use the synchronous version for non-reconciliation paths
        if (location.pathname.startsWith('/reconcile_queue')) {
            // For reconciliation paths, we'll allow access if the user has the basic permission
            // The actual access control will be handled by the reconciliation components themselves
            if (!canUserView(user.role, location.pathname)) {
                return <Navigate to="/dashboard" replace />;
            }
        } else {
            if (!canUserView(user.role, location.pathname)) {
                return <Navigate to="/dashboard" replace />;
            }
        }
    }

    return children;
};


const AppWrapper = () => {
    const navigate = useNavigate(); // Added navigate hook
    const location = useLocation();
    const dispatch = useDispatch();
    const user = useSelector(state => state.auth.user);
    const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
    // Get the loading state from Redux
    const isLoading = useSelector(state => state.auth.isLoading);
    
    // State declarations (must be at the top in order)
    const [collapsed, setCollapsed] = useState(window.innerWidth < 1024);
    // ✅ useRef keeps the timer ID stable across renders.
    // A plain `let idleTimer` resets to null on every render, making clearTimeout a no-op
    // and causing timers to stack up indefinitely without ever being cleared.
    const idleTimerRef = useRef(null);

    const hideLayout = ['/', '/login', '/forgetpassword', '/unauthorized', '/session-expired'].includes(location.pathname);
    const toggleCollapse = () => setCollapsed(!collapsed);

    const IDLE_TIMEOUT = 45 * 60 * 1000; // 45 minutes in milliseconds
    // const IDLE_TIMEOUT = 30 * 1000; // 30 seconds in milliseconds

    // Function to reset the idle timer
    const resetIdleTimer = () => {
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }
        idleTimerRef.current = setTimeout(() => {
            window.dispatchEvent(new CustomEvent('sessionExpired'));
        }, IDLE_TIMEOUT);
    };

    // Effect for handling session expired event — navigates to the dedicated page
    useEffect(() => {
        const handleSessionExpired = () => {
            // ✅ Do NOT dispatch clearAuth() here. Dispatching it immediately sets
            // isAuthenticated=false, which triggers the AppWrapper guard and redirects
            // to /unauthorized BEFORE navigate('/session-expired') can execute.
            // SessionExpired.jsx already calls dispatch(clearAuth()) when the user
            // clicks "Go to Login", so auth is cleaned up at the right time.
            navigate('/session-expired');
        };

        window.addEventListener('sessionExpired', handleSessionExpired);

        return () => {
            window.removeEventListener('sessionExpired', handleSessionExpired);
        };
    // ✅ navigate added to deps — was missing before, causing a stale closure
    }, [navigate]);

    // Initial auth state check from secure storage
    useEffect(() => {
        const initAuth = async () => {
            dispatch(setLoading(true));
            try {
                const storedAuth = await getStoredAuth();
                if (storedAuth && storedAuth.user && storedAuth.token) {
                    // ✅ Validate token expiry before restoring auth state.
                    // Restoring an expired token sets isAuthenticated=true with a dead token,
                    // causing every subsequent API call to 401, which then fails to refresh
                    // (server may return 400 for expired tokens, not 401), eventually
                    // triggering clearAuth mid-navigation → redirect to login.
                    try {
                        const decoded = jwtDecode(storedAuth.token);
                        const isExpired = decoded.exp < Date.now() / 1000;

                        if (!isExpired) {
                            // Token is still valid — restore session
                            dispatch(setAuth({ user: storedAuth.user, token: storedAuth.token }));
                            // ✅ Schedule proactive refresh so the token never expires silently
                            // after a page reload. Without this, only the reactive 401 path
                            // would refresh the token — too late and error-prone.
                            scheduleTokenRefresh(storedAuth.token);
                        }
                        // If expired: don't restore auth. isAuthenticated stays false.
                        // The user will be redirected to login cleanly instead of getting
                        // a mid-session logout after a failed refresh attempt.
                    } catch {
                        // Token decoding failed — treat as unauthenticated
                    }
                }
            } catch (error) {
                // Error handling for stored auth retrieval
            } finally {
                dispatch(setLoading(false));
            }
        };
        initAuth();
    }, [dispatch]);

    // ✅ Cancel any pending proactive refresh timer when the user logs out.
    // Without this, the timer fires after clearAuth and tries to refresh with a
    // revoked token, causing unnecessary errors.
    useEffect(() => {
        if (!isAuthenticated) {
            clearRefreshTimeout();
        }
    }, [isAuthenticated]);

    // Effect for handling the idle timer
    useEffect(() => {
        if (isAuthenticated) {
            resetIdleTimer();

            const handleActivity = () => resetIdleTimer();

            window.addEventListener('mousemove', handleActivity);
            window.addEventListener('mousedown', handleActivity);
            window.addEventListener('keydown', handleActivity);
            window.addEventListener('touchstart', handleActivity);

            return () => {
                // ✅ Clears the actual timer via ref — previously idleTimer was a plain let
                // variable that reset to null on every render, so this was always a no-op
                if (idleTimerRef.current) {
                    clearTimeout(idleTimerRef.current);
                }
                window.removeEventListener('mousemove', handleActivity);
                window.removeEventListener('mousedown', handleActivity);
                window.removeEventListener('keydown', handleActivity);
                window.removeEventListener('touchstart', handleActivity);
            };
        }
    }, [isAuthenticated]);

    React.useEffect(() => {
        // Preload critical images when the app initializes
        preloadCriticalImages();
        
        if (window.innerWidth <= 1024 && !collapsed) {
            document.body.classList.add('no-scroll');
        } else {
            document.body.classList.remove('no-scroll');
        }
    }, [collapsed]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen w-full">
                <SkeletonLoader type="default" />
            </div>
        );
    }

    // Redirect unauthenticated users to /login (e.g. after logout).
        // /unauthorized is only shown for authenticated users who lack role permissions.
    if (!isAuthenticated && !hideLayout) {
        return <Navigate to="/login" replace />;
    }

    return (
        <TourProviderWrapper>
            <>
                {!hideLayout && <Navbar collapsed={collapsed} toggleCollapse={toggleCollapse} />}

                <div className={`app-body ${!hideLayout ? 'with-navbar' : ''} flex flex-col`}>
                    {!hideLayout && (
                        <>
                            <Sidebar
                                collapsed={collapsed}
                                toggleCollapse={toggleCollapse}
                            />
                            <div
                                className={`sidebar-overlay ${!collapsed ? 'active' : ''}`}
                                onClick={toggleCollapse}
                            ></div>
                        </>
                    )}
                    <div className={`flex-1 transition-all duration-300 ease-out  md:p-2 lg:p-0 ${!hideLayout ? 'mt-[60px]' : ''} ${!hideLayout && (collapsed ? 'lg:ml-16' : 'lg:ml-[220px]')}`}>
                        <div>
                            <Routes>
                                <Route path="/" element={<Login />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/forgetpassword" element={<ForgotPassword />} />
                                <Route path="/unauthorized" element={<Unauthorized />} />
                                <Route path="/session-expired" element={<SessionExpired />} />
                                <Route path="/dashboard" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <Dashboard />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/vendor/dashboard" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <VendorDashboard />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/configure" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <InvoiceConfig />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/users" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <UserTable />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/parameters" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <Parameters />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/masters" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <Masters />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/tenantreg" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <TenantRegistration />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/defaultconfig" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <DefaultConfig />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/tenantlogo" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <TenantLogoManagement />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/generic-fields" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <GenericFieldsConfig />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />
                        
                                <Route path="/editor/:invoiceId" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <Editor />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/vendor_editor/:invoiceId" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <VendorEditor />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/vendor_editor" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <VendorEditor />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/invoice_queue" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <ExtractionQueue mode="invoice_queue" />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/vendor_queue" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <VendorQueue />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/vendor_final_queue" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <VendorFinalQueue />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/vendor_configure" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <VendorInvoiceConfig />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/reconcile_queue" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <ReconileQueue />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/reconcile_queue/:invoiceId" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <ReconciliationView />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/documents" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <DocumentsQueue />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/source" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <UploadInvoice />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />


                                <Route path="/billing" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <InProcess />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/invoice_reports" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <Reports />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/vendor_reports" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <VendorReports />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />

                                <Route path="/final_queue" element={
                                    <CustomPrivateRoute>
                                        <SuspenseWrapper>
                                            <FinalQueue />
                                        </SuspenseWrapper>
                                    </CustomPrivateRoute>
                                } />
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </div>
                    </div>
                </div>
            </>
        </TourProviderWrapper>
    );
};

const App = () => {
    return (
        <Provider store={store}>
            <Router>
                <AppWrapper />
            </Router>
        </Provider>
    );
};

SkeletonLoader.propTypes = {
    type: PropTypes.string,
};
SuspenseWrapper.propTypes = {
    children: PropTypes.node.isRequired,
};

CustomPrivateRoute.propTypes = {
    children: PropTypes.node.isRequired,
};

export default App;
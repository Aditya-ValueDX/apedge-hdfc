import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
    Upload,
    Eye,
    Trash2,
    Save,
    X,
    Image as ImageIcon,
    RefreshCw,
    Download,
    CheckCircle,
    ZoomIn,
    ZoomOut,
    RotateCw,
    Move
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import ViewDocumentModal from '../View/ViewDocumentModal';
import TableComponent from '../common/TableComponent';
import { canUserEdit } from '../../permissions';
import { apiBaseUrl } from '../../config/apiConfig';
import { updateUserProperty } from '../../store/authSlice';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Simple debounce function
const useDebounce = (callback, delay) => {
    const timeoutRef = useRef(null);

    return useCallback((...args) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    }, [callback, delay]);
};

const TenantLogoManagement = () => {
    const user = useSelector(state => state.auth.user);
    const token = user?.token;
    const userRole = user?.role;
    const tenantId = user?.tenantId;
    const dispatch = useDispatch(); // Add dispatch for updating Redux store

    // State for tenant admin
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [currentLogo, setCurrentLogo] = useState(null);
    const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    // State for image editing (rotation, zoom, position)
    const [imageTransform, setImageTransform] = useState({
        rotation: 0,
        scale: 1,
        position: { x: 0, y: 0 }
    });
    const [isEditing, setIsEditing] = useState(false);

    // State for super admin
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(false);
    // Added for pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10); // Added for pagination
    const [totalCount, setTotalCount] = useState(0); // Added for pagination

    // State for view modal
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedLogoUrl, setSelectedLogoUrl] = useState('');
    const [selectedTenantName, setSelectedTenantName] = useState('');

    // TableComponent states
    const [sortField, setSortField] = useState('tenant_id');
    const [sortAsc, setSortAsc] = useState(true);
    const [columnFilters, setColumnFilters] = useState({});

    // Permissions
    const canEditLogo = canUserEdit(userRole, 'tenant_logo');

    // Refs for cleanup
    const currentLogoUrlRef = useRef(null);
    const logoPreviewRef = useRef(null);
    const fetchTenantsRef = useRef(false);
    const fileInputRef = useRef(null);
    const previewContainerRef = useRef(null);

    // Cleanup object URLs
    const cleanupObjectUrls = useCallback(() => {
        if (currentLogoUrlRef.current) {
            URL.revokeObjectURL(currentLogoUrlRef.current);
            currentLogoUrlRef.current = null;
        }
        if (logoPreviewRef.current) {
            URL.revokeObjectURL(logoPreviewRef.current);
            logoPreviewRef.current = null;
        }
    }, []);

    // Fetch logo with authorization and create object URL
    const fetchLogoWithAuth = useCallback(async (logoPath) => {
        if (!token || !logoPath) return;

        try {
            // Use axios with interceptors instead of native fetch to handle auth properly
            const response = await axios.get(`/api/${logoPath}`, {
                responseType: 'blob', // Specify response type as blob for image data
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.status === 200) {
                const blob = response.data;
                const objectUrl = URL.createObjectURL(blob);

                // Clean up previous URL
                if (currentLogoUrlRef.current) {
                    URL.revokeObjectURL(currentLogoUrlRef.current);
                }

                setCurrentLogoUrl(objectUrl);
                currentLogoUrlRef.current = objectUrl;
            } else {
                throw new Error('Failed to fetch logo');
            }
        } catch (error) {
            toast.error('Failed to load logo');
        }
    }, [token]);

    // Fetch current tenant logo for tenant admin
    const fetchCurrentLogo = useCallback(async () => {
        if (!token || userRole !== 'tenant_admin' || !tenantId) return;

        try {
            const response = await axios.get(`/api/v1/tables/ap_tenants?tenant_id=eq.${tenantId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data && response.data.length > 0) {
                const tenant = response.data[0];
                if (tenant.logo_path && tenant.logo_path !== currentLogo) {
                    setCurrentLogo(tenant.logo_path);
                    // Fetch the logo with authorization
                    fetchLogoWithAuth(tenant.logo_path);
                } else if (!tenant.logo_path) {
                    // Clear current logo if none exists
                    setCurrentLogo(null);
                    setCurrentLogoUrl(null);
                    if (currentLogoUrlRef.current) {
                        URL.revokeObjectURL(currentLogoUrlRef.current);
                        currentLogoUrlRef.current = null;
                    }
                }
            }
        } catch (error) {
            toast.error('Failed to fetch current logo');
        }
    }, [token, tenantId, userRole, currentLogo, fetchLogoWithAuth]);

    // Fetch all tenants with logos for super admin with pagination
    const fetchAllTenants = useCallback(async () => {
        if (!token || userRole !== 'super_admin') return;

        setLoading(true);
        try {
            // Calculate offset
            const offset = (page - 1) * pageSize;
            
            // Base URL with pagination
            let tenantsUrl = `/api/v1/tables/ap_tenants?limit=${pageSize}&offset=${offset}`;
            
            // Add sorting
            const effectiveSortField = sortField || 'tenant_id';
            const effectiveSortAsc = sortAsc;
            let dbSortFieldMapped = effectiveSortField;
            if (effectiveSortField === 'tenant_id') dbSortFieldMapped = 'tenant_id';
            else if (effectiveSortField === 'tenant_name') dbSortFieldMapped = 'tenant_name';
            
            let orderQuery = `${dbSortFieldMapped}.${effectiveSortAsc ? 'asc' : 'desc'}.nullslast`;
            tenantsUrl += `&order=${orderQuery}`;
            
            // Add column filters
            Object.entries(columnFilters).forEach(([key, value]) => {
                if (value) {
                    const filterValue = encodeURIComponent(value);
                    switch (key) {
                        case 'tenant_id':
                            // tenant_id is numeric, use 'eq' for exact match or 'gte/lte' for range
                            tenantsUrl += `&tenant_id=eq.${filterValue}`;
                            break;
                        case 'tenant_name':
                            // tenant_name is text, use 'ilike' for partial match
                            tenantsUrl += `&tenant_name=ilike.*${filterValue}*`;
                            break;
                    }
                }
            });

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact' // Request total count
                }
            };

            const response = await axios.get(tenantsUrl, config);
            const data = response.data;

            // Get total count from Content-Range header
            const contentRange = response.headers['content-range'];
            let total = 0;
            if (contentRange) {
                const match = contentRange.match(/\/(\d+)/);
                if (match && match[1]) {
                    total = parseInt(match[1], 10);
                }
            }
            setTotalCount(total);

            setTenants(data || []);
        } catch (error) {
            toast.error('Failed to fetch tenants');
            setTotalCount(0); // Reset count on error
            setTenants([]); // Clear data on error
        } finally {
            setLoading(false);
        }
    }, [token, userRole, page, pageSize, sortField, sortAsc, columnFilters]);

    // Debounced versions of fetch functions
    const debouncedFetchCurrentLogo = useDebounce(fetchCurrentLogo, 300);
    const debouncedFetchAllTenants = useDebounce(fetchAllTenants, 300);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            cleanupObjectUrls();
            fetchTenantsRef.current = false;
        };
    }, [cleanupObjectUrls]);

    useEffect(() => {
        if (userRole === 'tenant_admin' && token && tenantId) {
            debouncedFetchCurrentLogo();
        } else if (userRole === 'super_admin' && token) {
            debouncedFetchAllTenants();
        }
    }, [userRole, token, tenantId, page, pageSize, debouncedFetchCurrentLogo, debouncedFetchAllTenants]);

    // Handle drag events
    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    // Handle file drop
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    }, []);

    // Handle file selection (both drag-and-drop and traditional input)
    const handleFileSelection = (file) => {
        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            toast.error('Please upload a valid image file (JPEG, JPG, PNG, GIF)');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size exceeds 5MB limit');
            return;
        }

        setLogoFile(file);

        // Clean up previous preview
        if (logoPreviewRef.current) {
            URL.revokeObjectURL(logoPreviewRef.current);
        }

        // Create preview using object URL
        const objectUrl = URL.createObjectURL(file);
        setLogoPreview(objectUrl);
        logoPreviewRef.current = objectUrl;

        // Reset image transform when new file is selected
        setImageTransform({
            rotation: 0,
            scale: 1,
            position: { x: 0, y: 0 }
        });
        setIsEditing(false);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelection(e.target.files[0]);
        }
    };

    const handleUploadLogo = async () => {
        if (!logoFile || !token || !tenantId) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('tenant_id', tenantId);
            formData.append('file', logoFile);

            const response = await axios.post(`/api/tenant/logo/getlogo`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data && response.data.path) {
                toast.success('Logo uploaded successfully');
                setCurrentLogo(response.data.path);
                // Fetch the newly uploaded logo with authorization
                fetchLogoWithAuth(response.data.path);
                setLogoFile(null);
                // Clean up the preview object URL
                if (logoPreviewRef.current) {
                    URL.revokeObjectURL(logoPreviewRef.current);
                    logoPreviewRef.current = null;
                    setLogoPreview(null);
                }
                
                // Update user's logo path in Redux store
                dispatch(updateUserProperty({ logoPath: response.data.path }));
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            toast.error('Failed to upload logo: ' + (error.response?.data?.error || error.message));
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdateLogo = async () => {
        if (!logoFile || !token || !tenantId) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('tenant_id', tenantId);
            formData.append('file', logoFile);

            const response = await axios.put(`/api/tenant/logo/updatelogo`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data && response.data.path) {
                toast.success('Logo updated successfully');
                setCurrentLogo(response.data.path);
                // Fetch the updated logo with authorization
                fetchLogoWithAuth(response.data.path);
                setLogoFile(null);
                // Clean up the preview object URL
                if (logoPreviewRef.current) {
                    URL.revokeObjectURL(logoPreviewRef.current);
                    logoPreviewRef.current = null;
                    setLogoPreview(null);
                }
                
                // Update user's logo path in Redux store
                dispatch(updateUserProperty({ logoPath: response.data.path }));
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            toast.error('Failed to update logo: ' + (error.response?.data?.error || error.message));
        } finally {
            setIsUploading(false);
        }
    };

    const handleViewLogo = (logoPath, tenantName) => {
        if (logoPath) {
            setSelectedLogoUrl(`/api/${logoPath}`);
            setSelectedTenantName(tenantName || 'Tenant Logo');
            setIsViewModalOpen(true);
        }
    };

    const handleRemovePreview = () => {
        if (logoPreviewRef.current) {
            URL.revokeObjectURL(logoPreviewRef.current);
            logoPreviewRef.current = null;
        }
        setLogoPreview(null);
        setLogoFile(null);
        setIsEditing(false);
    };

    const handleDownloadLogo = () => {
        if (currentLogoUrl) {
            const link = document.createElement('a');
            link.href = currentLogoUrl;
            link.download = 'logo.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const triggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // Image editing functions
    const rotateImage = (degrees) => {
        setImageTransform(prev => ({
            ...prev,
            rotation: (prev.rotation + degrees) % 360
        }));
    };

    const zoomImage = (scaleFactor) => {
        setImageTransform(prev => ({
            ...prev,
            scale: Math.max(0.5, Math.min(3, prev.scale + scaleFactor))
        }));
    };

    const resetImageTransform = () => {
        setImageTransform({
            rotation: 0,
            scale: 1,
            position: { x: 0, y: 0 }
        });
    };

    const toggleEditingMode = () => {
        setIsEditing(!isEditing);
    };

    // Columns for super admin table
    const tenantLogoColumns = [
        { key: 'tenant_id', header: 'ID', sortable: true, filterable: true },
        { key: 'tenant_name', header: 'Organization', sortable: true, filterable: true },
        {
            key: 'logo_path',
            header: 'Logo',
            disableTooltip: true,
            render: (item) => (
                item.logo_path ? (
                    <button
                        onClick={() => handleViewLogo(item.logo_path, item.tenant_name)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium font-[Poppins]"
                        data-tour="view-logo-button"
                    >
                        <Eye size={14} />
                        <span>View</span>
                    </button>
                ) : (
                    <span className="text-gray-400 text-xs font-[Poppins]">No logo</span>
                )
            )
        }
    ];

    // Filtered tenants for the table
    const filteredTenants = useMemo(() => {
        return tenants.filter(tenant => {
            return Object.keys(columnFilters).every(key => {
                const filterValue = columnFilters[key];
                if (!filterValue) return true;
                const itemValue = tenant[key];
                return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());
            });
        });
    }, [tenants, columnFilters]);

    return (
        <div className="font-[Poppins] p-4 md:p-6 rounded-xl mx-auto">
            <div className="rounded-xl flex flex-col font-[Poppins] antialiased bg-white">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 tracking-tight font-[Poppins]" data-tour="tenant-logo-header">
                            {userRole === 'super_admin' ? 'Tenant Logos' : 'Organization Logo'}
                        </h1>
                        <p className="text-xs text-gray-500 mt-1 font-[Poppins]">
                            {userRole === 'super_admin'
                                ? 'View and manage logos for all tenant organizations'
                                : 'Upload and manage your organization\'s logo'}
                        </p>
                    </div>
                </div>

                {userRole === 'tenant_admin' ? (
                    // Tenant Admin View
                    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-gray-50 to-white p-6 shadow-lg border border-gray-200 transition-all duration-300 font-[Poppins]">
                        <h2 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2 font-[Poppins]">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <ImageIcon className="text-blue-600" size={16} />
                            </div>
                            Logo Management
                        </h2>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Upload Section */}
                            <div
                                className={`border-2 rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden font-[Poppins] ${dragActive
                                        ? 'border-blue-500 bg-blue-50 shadow-md'
                                        : 'border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                                    }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                data-tour="upload-section"
                            >
                                {/* Background pattern */}
                                <div className="absolute inset-0 opacity-5">
                                    <div className="absolute inset-0 bg-[radial-gradient(#000000_1px,transparent_2px)] [background-size:16px_16px]"></div>
                                </div>

                                {!logoPreview ? (
                                    <>
                                        <div className="mb-4 text-blue-600 relative z-10">
                                            <div className="bg-blue-100 p-3 rounded-full">
                                                <Upload size={20} />
                                            </div>
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-800 mb-2 relative z-10 font-[Poppins]">Upload New Logo</h3>
                                        <p className="text-xs text-gray-600 mb-4 text-center relative z-10 font-[Poppins]">
                                            Drag & drop your logo here or click to browse
                                        </p>
                                        <p className="text-xs text-gray-500 mb-4 text-center relative z-10 font-[Poppins]">
                                            Supported formats: JPEG, JPG, PNG, GIF (Max 5MB)
                                        </p>

                                        <div className="w-full max-w-xs relative z-10">
                                            <input
                                                type="file"
                                                id="logo-upload"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/jpeg,image/jpg,image/png,image/gif"
                                                onChange={handleFileChange}
                                                disabled={!canEditLogo}
                                            />
                                            <button
                                                onClick={triggerFileInput}
                                                disabled={!canEditLogo}
                                                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-300 font-[Poppins] ${canEditLogo
                                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md'
                                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    }`}
                                                data-tour="choose-file-button"
                                            >
                                                <Upload size={14} />
                                                Choose File
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full flex flex-col items-center relative z-10">
                                        <div className="relative mb-4 group w-full">
                                            <div
                                                ref={previewContainerRef}
                                                className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center font-[Poppins]"
                                                data-tour="logo-preview"
                                            >
                                                <img
                                                    src={logoPreview}
                                                    alt="Logo Preview"
                                                    className="max-h-40 object-contain transition-transform duration-300"
                                                    style={{
                                                        transform: `rotate(${imageTransform.rotation}deg) scale(${imageTransform.scale})`,
                                                        transformOrigin: 'center'
                                                    }}
                                                />
                                            </div>

                                            {isEditing && (
                                                <div className="absolute top-2 right-2 flex gap-1">
                                                    <button
                                                        onClick={() => rotateImage(-90)}
                                                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50 font-[Poppins]"
                                                        title="Rotate Left"
                                                    >
                                                        <RotateCw size={14} className="rotate-180" />
                                                    </button>
                                                    <button
                                                        onClick={() => rotateImage(90)}
                                                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50 font-[Poppins]"
                                                        title="Rotate Right"
                                                    >
                                                        <RotateCw size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => zoomImage(-0.1)}
                                                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50 font-[Poppins]"
                                                        title="Zoom Out"
                                                    >
                                                        <ZoomOut size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => zoomImage(0.1)}
                                                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50 font-[Poppins]"
                                                        title="Zoom In"
                                                    >
                                                        <ZoomIn size={14} />
                                                    </button>
                                                    <button
                                                        onClick={resetImageTransform}
                                                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50 font-[Poppins]"
                                                        title="Reset"
                                                    >
                                                        <Move size={14} />
                                                    </button>
                                                </div>
                                            )}

                                            <button
                                                onClick={handleRemovePreview}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-sm transition-all duration-300 font-[Poppins]"
                                                title="Remove Preview"
                                                data-tour="cancel-upload-button"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-3 justify-center w-full">
                                            {currentLogo ? (
                                                <button
                                                    onClick={handleUpdateLogo}
                                                    disabled={isUploading || !canEditLogo}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-300 font-[Poppins] ${isUploading || !canEditLogo
                                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                            : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-sm hover:shadow-md'
                                                        }`}
                                                    data-tour="update-logo-button"
                                                >
                                                    {isUploading ? (
                                                        <>
                                                            <RefreshCw size={14} className="animate-spin" />
                                                            Updating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle size={14} />
                                                            Update Logo
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleUploadLogo}
                                                    disabled={isUploading || !canEditLogo}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-300 font-[Poppins] ${isUploading || !canEditLogo
                                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md'
                                                        }`}
                                                    data-tour="upload-logo-button"
                                                >
                                                    {isUploading ? (
                                                        <>
                                                            <RefreshCw size={14} className="animate-spin" />
                                                            Uploading...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload size={14} />
                                                            Upload Logo
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            <button
                                                onClick={handleRemovePreview}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 shadow-sm transition-all duration-300 font-[Poppins]"
                                                data-tour="cancel-upload-button-secondary"
                                            >
                                                <X size={14} />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Current Logo Preview */}
                            <div className="border border-gray-200 rounded-2xl p-6 flex flex-col bg-white shadow-lg transition-all duration-300 font-[Poppins]" data-tour="current-logo-section">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 font-[Poppins]">
                                        <div className="p-2 bg-indigo-100 rounded-lg">
                                            <Eye className="text-indigo-600" size={14} />
                                        </div>
                                        Current Logo
                                    </h3>
                                    <div className="flex gap-2">
                                        {currentLogo && (
                                            <>
                                                <button
                                                    onClick={handleDownloadLogo}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-300 shadow-sm font-[Poppins]"
                                                    data-tour="download-logo-button"
                                                >
                                                    <Download size={12} />
                                                    Download
                                                </button>
                                                {/* <button
                                                    onClick={() => {
                                                        // Handle delete logo functionality
                                                        // This would typically show a confirmation and then delete the logo
                                                    }}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-all duration-300 shadow-sm font-[Poppins]"
                                                    data-tour="delete-logo-button"
                                                >
                                                    <Trash2 size={12} />
                                                    Delete
                                                </button> */}
                                            </>
                                        )}
                                        
                                    </div>
                                </div>

                                {currentLogo && currentLogoUrl ? (
                                    <div className="flex flex-col items-center flex-grow">
                                        <div className="relative group flex-grow flex items-center justify-center w-full h-48 bg-gray-50 rounded-lg overflow-hidden border border-gray-200" data-tour="current-logo-image">
                                            <img
                                                src={currentLogoUrl}
                                                alt="Current Logo"
                                                className="max-h-40 object-contain transition-transform duration-300 group-hover:scale-105"
                                            />
                                        </div>
                                        <p className="mt-4 text-xs text-gray-600 text-center font-[Poppins]">
                                            This is your organization's current logo
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center flex-grow py-6">
                                        <div className="bg-gray-100 p-4 rounded-full mb-4">
                                            <ImageIcon size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-700 mb-1 font-[Poppins]" data-tour="no-logo-message">No logo uploaded yet</p>
                                        <p className="text-xs text-gray-500 text-center max-w-xs font-[Poppins]">
                                            Upload a logo to display it here and in the navigation bar
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : userRole === 'super_admin' ? (
                    // Super Admin View
                    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-gray-50 to-white p-6 shadow-lg border border-gray-200 font-[Poppins]">
                        <h2 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2 font-[Poppins]">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <ImageIcon className="text-indigo-600" size={16} />
                            </div>
                            All Tenant Logos
                        </h2>

                        <div className="overflow-x-auto">
                            <TableComponent
                                data={tenants} // Pass server-side paginated data
                                columns={tenantLogoColumns}
                                columnFilters={columnFilters}
                                setColumnFilters={setColumnFilters}
                                sortField={sortField}
                                setSortField={setSortField}
                                sortAsc={sortAsc}
                                setSortAsc={setSortAsc}
                                page={page}
                                setPage={setPage}
                                emptyMessage="No tenants found."
                                loading={loading}
                                // Pass pagination props
                                totalCount={totalCount}
                                pageSize={pageSize}
                                // setPageSize={setPageSize} // We can add a page size selector later if needed
                                data-tour="tenant-logos-table"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="rounded-2xl bg-white p-8 text-center shadow-lg border border-gray-200 font-[Poppins]">
                        <div className="bg-red-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                            <X size={20} className="text-red-600" />
                        </div>
                        <h3 className="text-base font-bold text-gray-800 mb-2 font-[Poppins]">Access Denied</h3>
                        <p className="text-sm text-gray-600 font-[Poppins]">You don't have permission to access this page.</p>
                    </div>
                )}
            </div>

            {/* View Document Modal */}
            <ViewDocumentModal
                isOpen={isViewModalOpen}
                onRequestClose={() => setIsViewModalOpen(false)}
                fileUrl={selectedLogoUrl}
                fileName={selectedTenantName}
            />

            <ToastContainer
                position="top-right"
                autoClose={2000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
            />
        </div>
    );
};

export default TenantLogoManagement;
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
    Search, Filter, X, ChevronDown, Edit, Trash2, Info, Loader2, Lock, Key, FileText, AlignLeft, Layers, RefreshCw,
    SquareArrowOutUpRight // Import the icon for the popup trigger
} from 'lucide-react';
import { useSelector } from 'react-redux';
import TableComponent from '../common/TableComponent';
import { canUserEdit, canUserDelete } from '../../permissions';
import classNames from 'classnames';
import CardPopup from '../common/CardPopup';
import { useCardPopup } from '../hooks/useCardPopup';
import MetadataPopup from '../common/MetadataPopup';

import { apiBaseUrl } from '../../config/apiConfig';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SearchableSelect from '../common/SearchableSelect';
import AdvancedFilterPanel from '../common/AdvancedFilterPanel';
import Button from '../common/Button';

const fixedKeys = [];

const ToastHost = React.memo(() => (
    <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
    />
));

const Parameters = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // ── [VENDOR] Module error state ──────────────────────────────────────────
    const [moduleError, setModuleError] = useState("");

    // Initialize state from URL parameters
    const getInitialPage = () => {
        const pageParam = searchParams.get('page');
        return pageParam ? parseInt(pageParam, 10) : 1;
    };

    const getInitialPageSize = () => {
        const pageSizeParam = searchParams.get('pageSize');
        return pageSizeParam ? parseInt(pageSizeParam, 10) : 10;
    };

    const getInitialSortField = () => {
        return searchParams.get('sortField') || 'unique_key';
    };

    const getInitialSortAsc = () => {
        const sortAscParam = searchParams.get('sortAsc');
        return sortAscParam ? sortAscParam === 'true' : true;
    };

    const getInitialColumnFilters = () => {
        const filters = {};
        const unique_key = searchParams.get('unique_key');
        if (unique_key) filters.unique_key = unique_key;

        const req_value = searchParams.get('req_value');
        if (req_value) filters.req_value = req_value;

        const description = searchParams.get('description');
        if (description) filters.description = description;

        const apedge_group = searchParams.get('apedge_group');
        if (apedge_group) filters.apedge_group = apedge_group;

        // ── [VENDOR] module_key column filter from URL ──
        const module_key = searchParams.get('module_key');
        if (module_key) filters.module_key = module_key;

        const tenantName = searchParams.get('tenantName');
        if (tenantName) filters.tenant_name = tenantName;

        return filters;
    };

    const getInitialAdvancedFilters = () => {
        const filters = {};
        const unique_key = searchParams.get('adv_unique_key');
        filters.unique_key = unique_key || '';

        const req_value = searchParams.get('adv_req_value');
        filters.req_value = req_value || '';

        const apedge_group = searchParams.get('adv_apedge_group');
        filters.apedge_group = apedge_group || '';

        // ── [VENDOR] module_key advanced filter from URL ──
        const module_key = searchParams.get('adv_module_key');
        filters.module_key = module_key || '';

        return filters;
    };

    const [parameters, setParameters] = useState([]);
    const [defaultConfigs, setDefaultConfigs] = useState([]); // New state for default configs
    // ── [VENDOR] Vendor field config for workflow JSON validation ──
    const [vendorFieldConfig, setVendorFieldConfig] = useState([]);
    // ── [VENDOR] module_key added to newParam ──
    const [newParam, setNewParam] = useState({ unique_key: '', req_value: '', description: '', apedge_group: '', metadata: '', protected_config: '', module_key: '' });
    const [editingParam, setEditingParam] = useState(null);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [page, setPage] = useState(getInitialPage());
    const [pageSize, setPageSize] = useState(getInitialPageSize()); // Added for pagination
    const [totalCount, setTotalCount] = useState(0); // Added for pagination
    const [sortField, setSortField] = useState(getInitialSortField()); // Default sort field is 'unique_key'
    const [sortAsc, setSortAsc] = useState(getInitialSortAsc());
    const [columnFilters, setColumnFilters] = useState({
        unique_key: '',
        req_value: '',
        description: '',
        apedge_group: '',
        // ── [VENDOR] module_key column filter ──
        module_key: '',
        tenant_name: '',
        ...getInitialColumnFilters()
    });

    const defaultAdvancedFilters = {
        unique_key: '',
        req_value: '',
        apedge_group: '',
        // ── [VENDOR] module_key advanced filter default ──
        module_key: ''
    };

    // Advanced filter field definitions for AdvancedFilterPanel
    const filterFields = [
        { key: 'unique_key', label: 'Key', type: 'text', icon: Key, placeholder: 'Filter by key' },
        { key: 'req_value', label: 'Value', type: 'text', icon: AlignLeft, placeholder: 'Filter by value' },
        { key: 'apedge_group', label: 'Group', type: 'text', icon: Layers, placeholder: 'Filter by group' },
        // ── [VENDOR] module filter field for AdvancedFilterPanel ──
        { key: 'module_key', label: 'Module', type: 'text', icon: Layers, placeholder: 'Filter by module' },
    ];

    // appliedFilters: committed to server; draftFilters: live in the filter panel (not yet applied)
    const [appliedFilters, setAppliedFilters] = useState({
        ...defaultAdvancedFilters,
        ...getInitialAdvancedFilters()
    });
    const [draftFilters, setDraftFilters] = useState({
        ...defaultAdvancedFilters,
        ...getInitialAdvancedFilters()
    });

    const [loadingParameters, setLoadingParameters] = useState(true);
    const [filtering, setFiltering] = useState(false); // Added for partial loading during filtering
    const [refreshTrigger, setRefreshTrigger] = useState(0); // Increment to force a data refresh
    const [isFiltering, setIsFiltering] = useState(false); // Track filtering state

    // State for tenant selection
    const [tenants, setTenants] = useState([]);
    const [selectedTenantId, setSelectedTenantId] = useState('');

    // ── [VENDOR] Tenant modules (for super admin module dropdown) ──
    const [tenantModules, setTenantModules] = useState([]);

    // State for custom confirmation modal
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [paramToDelete, setParamToDelete] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);

    // Tracks which fixedKeys are already registered for the active tenant (used to hide them from the key dropdown)
    const [registeredKeysForTenant, setRegisteredKeysForTenant] = useState(new Set());
    // Tracks which tenant_ids already have the selected key (used to hide them from the tenant dropdown)
    const [tenantsWithKey, setTenantsWithKey] = useState(new Set());

    // Metadata popup state
    const [showMetadataPopup, setShowMetadataPopup] = useState(false);
    const [showMetadataViewer, setShowMetadataViewer] = useState(false);
    const [currentMetadataItem, setCurrentMetadataItem] = useState(null);

    // Get user from Redux store using useSelector
    const user = useSelector(state => state.auth.user);
    const tenantId = user?.tenantId;
    const userId = user?.user_id;
    const userRole = user?.role;
    const token = user?.token;

    // ── [VENDOR] Derive user's assigned modules from Redux user object ──
    const userModules = useMemo(() => {
        if (user?.modules && typeof user.modules === 'object') {
            return Object.keys(user.modules).filter(key => user.modules[key] === true);
        }
        return [];
    }, [user?.modules]);

    // Initialize state from URL parameters when component mounts
    useEffect(() => {
        // This will ensure state is properly initialized from URL parameters on mount
        // The state initialization functions already handle this, so we don't need to do anything here
        // This useEffect is just to make sure we're responding to URL changes
    }, [searchParams]);

    // Update URL parameters when state changes
    useEffect(() => {
        const params = new URLSearchParams();

        // Add pagination params
        if (page !== 1) params.set('page', page.toString());
        if (pageSize !== 10) params.set('pageSize', pageSize.toString());

        // Add sort params
        if (sortField !== 'unique_key') params.set('sortField', sortField);
        if (!sortAsc) params.set('sortAsc', sortAsc.toString()); // Only set if not default (true)

        // Add column filters
        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value) {
                // Map internal field names to URL parameter names
                let paramName = key;
                if (key === 'tenant_name') paramName = 'tenantName';
                params.set(paramName, value);
            }
        });

        // Add advanced filters
        Object.entries(appliedFilters).forEach(([key, value]) => {
            if (value) {
                // Map advanced filter keys to URL parameter names
                switch (key) {
                    case 'unique_key':
                        params.set('adv_unique_key', value);
                        break;
                    case 'req_value':
                        params.set('adv_req_value', value);
                        break;
                    case 'apedge_group':
                        params.set('adv_apedge_group', value);
                        break;
                    // ── [VENDOR] module_key URL sync ──
                    case 'module_key':
                        params.set('adv_module_key', value);
                        break;
                    default:
                        params.set(key, value);
                }
            }
        });

        // Only update URL if there are params to set
        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            // Clear URL params if no filters are active
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, columnFilters, appliedFilters, setSearchParams]);

    // Permissions for Parameters
    const canEditParameters = canUserEdit(userRole, 'parameters');
    const canDeleteParameters = canUserDelete(userRole, 'parameters');

    const editPermissionMessage = "You do not have permission to edit parameters.";
    const deletePermissionMessage = "You do not have permission to delete parameters.";

    // REMOVED from here: const fixedKeys = [];

    // State for custom dropdown logic
    const keyInputRef = useRef(null);
    const dropdownRef = useRef(null);
    const saveTimerRef = useRef(null);


    // Hook for the CardPopup
    const { isCardPopupOpen, popupContent, openCardPopup, closeCardPopup, setPopupContent } = useCardPopup();


    // Fetch default configurations for parameters
    const fetchDefaultConfigs = useCallback(async () => {
        if (!user || !token) {
            return;
        }

        try {
            const { data } = await axios.get(`/api/v1/tables/ap_default_configs?config_type=eq.parameter`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setDefaultConfigs(data);
            // Update fixedKeys with default config keys
            fixedKeys.length = 0; // Clear the array
            data.forEach(config => fixedKeys.push(config.unique_key));
        } catch (error) {
            // Error fetching default configurations
        }
    }, [user, token]);

    // ── [VENDOR] Fetch vendor field config for workflow JSON validation ──────
    const fetchVendorFieldConfig = useCallback(async () => {
        if (!user || !token) return;
        try {
            const targetTenantId = userRole === 'super_admin' && selectedTenantId
                ? selectedTenantId
                : tenantId;
            if (!targetTenantId) return;
            const { data } = await axios.get(
                `/api/v1/tables/ap_vendor_field_config?tenant_id=eq.${targetTenantId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setVendorFieldConfig(data || []);
        } catch (error) {
            // silently ignore — validation will simply skip field-existence checks
        }
    }, [user, token, tenantId, userRole, selectedTenantId]);

    // Fetch tenants for super admin
    const fetchTenants = useCallback(async () => {
        if (!user || !token || userRole !== 'super_admin') {
            return;
        }

        try {
            const { data } = await axios.get(`/api/v1/tables/ap_tenants?select=tenant_id,tenant_name,allowed_modules&order=tenant_name.asc`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setTenants(data);
        } catch (error) {
            toast.error("Failed to load tenants.");
        }
    }, [user, token, userRole]);

    // ── [VENDOR] Fetch modules for a specific tenant (super admin only) ──────
    const fetchTenantModules = useCallback(async (tid) => {
        if (!token || userRole !== 'super_admin' || !tid) {
            setTenantModules([]);
            return [];
        }

        try {
            const response = await axios.get(`/api/v1/tables/ap_tenants?tenant_id=eq.${tid}`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { select: 'allowed_modules' }
            });

            if (response.data && response.data.length > 0) {
                let modulesData = response.data[0]?.allowed_modules;
                let modules = [];

                // Handle the API response structure where allowed_modules is an object with value property
                if (modulesData && typeof modulesData === 'object' && modulesData.value) {
                    try {
                        const parsedModules = JSON.parse(modulesData.value);
                        modules = Object.keys(parsedModules).filter(key => {
                            const value = parsedModules[key];
                            return value === true || value === 'true';
                        });
                    } catch (parseError) {
                        modules = [];
                    }
                } else if (modulesData && typeof modulesData === 'object') {
                    // Fallback: if modulesData is directly an object (not wrapped in value)
                    modules = Object.keys(modulesData).filter(key => {
                        const value = modulesData[key];
                        return value === true || value === 'true';
                    });
                }

                setTenantModules(Array.isArray(modules) ? modules : []);
                return modules;
            }
            setTenantModules([]);
            return [];
        } catch (error) {
            toast.error("Failed to load tenant modules.");
            setTenantModules([]);
            return [];
        }
    }, [token, userRole]);

    // ── [VENDOR] Get available modules based on role & selected tenant ────────
    const getAvailableModules = useCallback(() => {
        if (userRole === 'super_admin') {
            return selectedTenantId ? (Array.isArray(tenantModules) ? tenantModules : []) : [];
        } else {
            return Array.isArray(userModules) ? userModules : [];
        }
    }, [userRole, selectedTenantId, tenantModules, userModules]);

    // Fetch all unique_keys already registered for a given tenant so we can hide them in the key dropdown
    const fetchRegisteredKeysForTenant = useCallback(async (tid) => {
        if (!tid || !token) return;
        try {
            const { data } = await axios.get(
                `/api/v1/tables/ap_parameters?tenant_id=eq.${tid}&select=unique_key`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRegisteredKeysForTenant(new Set(data.map(p => p.unique_key)));
        } catch {
            setRegisteredKeysForTenant(new Set());
        }
    }, [token]);

    // Fetch all tenant_ids that already have a given key so we can hide them in the tenant dropdown (super admin only)
    const fetchTenantsWithKey = useCallback(async (key) => {
        if (!key || !token) return;
        try {
            const { data } = await axios.get(
                `/api/v1/tables/ap_parameters?unique_key=eq.${encodeURIComponent(key)}&select=tenant_id`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTenantsWithKey(new Set(data.map(p => p.tenant_id)));
        } catch {
            setTenantsWithKey(new Set());
        }
    }, [token]);

    const fetchParameters = useCallback(async () => {
        if (!user || !token) {
            setLoadingParameters(false);
            return;
        }

        // Clear stale data immediately so old rows do not show while new fetch is in-flight
        setParameters([]);
        setTotalCount(0);

        // Only show full page loading spinner on initial load
        if (loadingParameters) {
            setLoadingParameters(true);
        }
        // Always show filtering indicator for filter operations
        setFiltering(true);

        // Calculate offset
        const offset = (page - 1) * pageSize;

        let fetchUrl;
        const isSuperAdmin = userRole === 'super_admin';
        const tenantNameFilter = columnFilters.tenant_name?.trim();

        // Use !inner join when filtering by tenant name so PostgREST can filter on the embedded resource.
        const tenantJoin = tenantNameFilter ? 'ap_tenants!inner(tenant_name)' : 'ap_tenants(tenant_name)';

        if (isSuperAdmin) {
            fetchUrl = `/api/v1/tables/ap_parameters?select=*,${tenantJoin}&limit=${pageSize}&offset=${offset}`;
        } else {
            fetchUrl = `/api/v1/tables/ap_parameters?select=*,${tenantJoin}&tenant_id=eq.${tenantId}&limit=${pageSize}&offset=${offset}`;
        }

        // Add column filters
        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value?.trim()) {
                const filterValue = encodeURIComponent(value.trim());
                switch (key) {
                    case 'unique_key':
                        fetchUrl += `&unique_key=ilike.*${filterValue}*`;
                        break;
                    case 'req_value':
                        fetchUrl += `&req_value=ilike.*${filterValue}*`;
                        break;
                    case 'description':
                        fetchUrl += `&description=ilike.*${filterValue}*`;
                        break;
                    case 'apedge_group':
                        fetchUrl += `&apedge_group=ilike.*${filterValue}*`;
                        break;
                    // ── [VENDOR] module_key column filter in fetch URL ──
                    case 'module_key':
                        fetchUrl += `&module_key=ilike.*${filterValue}*`;
                        break;
                    case 'tenant_name':
                        // PostgREST embedded resource filter — works with !inner join
                        fetchUrl += `&ap_tenants.tenant_name=ilike.*${filterValue}*`;
                        break;
                    default:
                        break;
                }
            }
        });

        // Add advanced filters
        if (appliedFilters.unique_key) fetchUrl += `&unique_key=ilike.*${encodeURIComponent(appliedFilters.unique_key)}*`;
        if (appliedFilters.req_value) fetchUrl += `&req_value=ilike.*${encodeURIComponent(appliedFilters.req_value)}*`;
        if (appliedFilters.apedge_group) fetchUrl += `&apedge_group=ilike.*${encodeURIComponent(appliedFilters.apedge_group)}*`;
        // ── [VENDOR] module_key advanced filter in fetch URL ──
        if (appliedFilters.module_key) fetchUrl += `&module_key=ilike.*${encodeURIComponent(appliedFilters.module_key)}*`;

        // Add sorting
        const effectiveSortField = sortField || 'unique_key';
        const effectiveSortAsc = sortAsc;

        let dbSortFieldMapped = effectiveSortField;
        if (effectiveSortField === 'unique_key') dbSortFieldMapped = 'unique_key';
        else if (effectiveSortField === 'req_value') dbSortFieldMapped = 'req_value';
        else if (effectiveSortField === 'description') dbSortFieldMapped = 'description';
        else if (effectiveSortField === 'apedge_group') dbSortFieldMapped = 'apedge_group';
        // ── [VENDOR] module_key sort mapping ──
        else if (effectiveSortField === 'module_key') dbSortFieldMapped = 'module_key';
        else if (effectiveSortField === 'updated_at') dbSortFieldMapped = 'updated_at';
        else if (effectiveSortField === 'tenant_name') dbSortFieldMapped = 'tenant_id';

        let orderQuery = `${dbSortFieldMapped}.${effectiveSortAsc ? 'asc' : 'desc'}.nullslast`;

        // Add secondary sort by parameter_id to break ties
        if (effectiveSortField !== 'parameter_id') {
            orderQuery += `,parameter_id.desc`;
        }

        fetchUrl += `&order=${orderQuery}`;

        try {
            const response = await axios.get(fetchUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact' // Request total count
                }
            });

            // Get total count from Content-Range header
            const contentRange = response.headers['content-range'];
            let total = 0;
            if (contentRange) {
                const match = contentRange.match(/\/(\d+)$/);
                if (match && match[1]) {
                    total = parseInt(match[1], 10);
                }
            }

            // Flatten embedded ap_tenants join — no secondary API calls needed
            const parametersWithTenantNames = response.data.map(param => ({
                ...param,
                tenant_name: param.ap_tenants?.tenant_name || 'N/A'
            }));

            setTotalCount(total);
            setParameters(parametersWithTenantNames);
        } catch (error) {
            setTotalCount(0); // Reset count on error
        } finally {
            setLoadingParameters(false);
            setFiltering(false);
        }
    }, [tenantId, user, userRole, token, page, pageSize, appliedFilters, columnFilters, sortField, sortAsc, refreshTrigger]);

    useEffect(() => {
        if (user && token) { // Only fetch if user object and token are available
            fetchParameters();
            fetchDefaultConfigs(); // Fetch default configs
            // ── [VENDOR] Also fetch vendor field config on mount ──
            fetchVendorFieldConfig();
            if (userRole === 'super_admin') {
                fetchTenants();
            }
        }
    }, [fetchParameters, fetchDefaultConfigs, fetchVendorFieldConfig, fetchTenants, user, token, userRole, refreshTrigger]);

    // ── [VENDOR] Re-fetch vendor field config & tenant modules when super admin selects a tenant ──
    useEffect(() => {
        if (userRole === 'super_admin' && selectedTenantId) {
            fetchTenantModules(selectedTenantId);
            fetchVendorFieldConfig();
        } else if (userRole === 'super_admin' && !selectedTenantId) {
            setTenantModules([]);
        }
    }, [selectedTenantId, fetchTenantModules, fetchVendorFieldConfig, userRole]);

    // For regular tenant users: load their already-registered keys whenever the component
    // mounts, after a save/delete, or when they're not in edit mode.
    useEffect(() => {
        if (!editingParam && userRole !== 'super_admin' && tenantId && token) {
            fetchRegisteredKeysForTenant(tenantId);
        }
    }, [tenantId, token, userRole, editingParam, refreshTrigger, fetchRegisteredKeysForTenant]);

    // For super admins: reload registered keys whenever the selected tenant changes.
    useEffect(() => {
        if (!editingParam && userRole === 'super_admin') {
            if (selectedTenantId) {
                fetchRegisteredKeysForTenant(selectedTenantId);
            } else {
                setRegisteredKeysForTenant(new Set());
            }
        }
    }, [selectedTenantId, token, userRole, editingParam, refreshTrigger, fetchRegisteredKeysForTenant]);

    // For super admins: whenever the typed/selected key changes, find which tenants already
    // have that key so we can remove them from the tenant dropdown.
    useEffect(() => {
        if (!editingParam && userRole === 'super_admin') {
            if (newParam.unique_key) {
                fetchTenantsWithKey(newParam.unique_key);
            } else {
                setTenantsWithKey(new Set());
            }
        }
    }, [newParam.unique_key, token, userRole, editingParam, fetchTenantsWithKey]);

    // Handle clicks outside the dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                keyInputRef.current &&
                !keyInputRef.current.contains(event.target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Effect for debounced autosave of popup content
    useEffect(() => {
        if (!popupContent.isEditable || (popupContent.field !== 'req_value' && popupContent.field !== 'protected_config')) {
            return;
        }
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = setTimeout(() => {
            if (editingParam) {
                if (popupContent.field === 'req_value') {
                    setEditingParam(prev => ({ ...prev, req_value: popupContent.content }));
                } else if (popupContent.field === 'protected_config') {
                    setEditingParam(prev => ({ ...prev, protected_config: popupContent.content }));
                }
            } else {
                if (popupContent.field === 'req_value') {
                    setNewParam(prev => ({ ...prev, req_value: popupContent.content }));
                } else if (popupContent.field === 'protected_config') {
                    setNewParam(prev => ({ ...prev, protected_config: popupContent.content }));
                }
            }
        }, 1500);
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, [popupContent.content, popupContent.field, popupContent.isEditable, editingParam]);


    const handleInputChange = (e) => {
        if (!canEditParameters) {
            toast.error(editPermissionMessage);
            return;
        }
        const { name, value } = e.target;
        if (editingParam) {
            setEditingParam({ ...editingParam, [name]: value });
        } else {
            setNewParam({ ...newParam, [name]: value });
        }
        if (name === 'unique_key') {
            setShowDropdown(true);
        }
    };

    const handleKeySelect = (key) => {
        if (editingParam) {
            setEditingParam({ ...editingParam, unique_key: key });
        } else {
            setNewParam({ ...newParam, unique_key: key });
        }
        setShowDropdown(false);
    };

    const handleClearKey = () => {
        if (editingParam) {
            setEditingParam({ ...editingParam, unique_key: '' });
        } else {
            setNewParam({ ...newParam, unique_key: '' });
        }
        setShowDropdown(false);
    };

    // ── [VENDOR] Module selection handler ────────────────────────────────────
    const handleModuleChange = (selectedOption) => {
        if (!canEditParameters) {
            toast.error(editPermissionMessage);
            return;
        }
        if (selectedOption) {
            setModuleError("");
        } else {
            setModuleError("Module is required");
        }
        if (editingParam) {
            setEditingParam({ ...editingParam, module_key: selectedOption || '' });
        } else {
            setNewParam({ ...newParam, module_key: selectedOption || '' });
        }
    };

    // ── [VENDOR] Form validation — ensures module is selected ────────────────
    const validateForm = () => {
        const moduleValue = editingParam ? editingParam.module_key : newParam.module_key;
        if (!moduleValue) {
            setModuleError("Module is required");
            toast.error("Please select a module");
            return false;
        }
        setModuleError("");
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const isSuperAdmin = userRole === 'super_admin';

        if (!canEditParameters) {
            toast.error(editPermissionMessage);
            return;
        }

        if (!tenantId && !isSuperAdmin) {
            toast.error("Authentication information not found. Please log in again.");
            return;
        }

        // For super admin, validate tenant selection
        if (isSuperAdmin && !selectedTenantId && !editingParam) {
            toast.error("Please select a tenant to register the parameter.");
            return;
        }

        const paramToSave = editingParam || newParam;

        if (!paramToSave.unique_key) {
            toast.warn("Key is a required field.");
            return;
        }

        if (!paramToSave.req_value) {
            toast.warn("Value is a required field.");
            return;
        }

        // ── [VENDOR] Validate module selection ──
        if (!validateForm()) return;

        // Determine the tenant ID to use in the URL based on role
        const activeTenantId = isSuperAdmin ? selectedTenantId : tenantId;

        if (!editingParam && parameters.some(p => p.unique_key === paramToSave.unique_key && p.tenant_id === activeTenantId)) {
            toast.error("This key already exists for the selected tenant. Please use a unique key.");
            return;
        }
        if (!activeTenantId) {
            toast.error(isSuperAdmin ? "Please select a tenant to register the parameter." : "Authentication information not found. Please log in again.");
            return;
        }

        const payloadToSend = { ...paramToSave };

        try {
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            };

            if (editingParam) {
                const editTenantId = isSuperAdmin ? selectedTenantId : tenantId;

                // Always update basic fields via the tables API (reliable, no protected_config dependency)
                await axios.patch(
                    `/api/v1/tables/ap_parameters?parameter_id=eq.${payloadToSend.parameter_id}`,
                    {
                        req_value: payloadToSend.req_value,
                        description: payloadToSend.description || null,
                        apedge_group: payloadToSend.apedge_group || null,
                        metadata: payloadToSend.metadata || null,
                        // ── [VENDOR] include module_key in update payload ──
                        module_key: payloadToSend.module_key || null,
                        updated_by: userId,
                        updated_at: getCurrentTimeISOString()
                    },
                    config
                );

                // Update protected_config via its dedicated endpoint (only when there is content)
                if (payloadToSend.protected_config && payloadToSend.protected_config.trim() !== '') {
                    const protectedPayload = {
                        uniqueKey: payloadToSend.unique_key,
                        reqValue: payloadToSend.req_value,
                        description: payloadToSend.description || null,
                        apedgeGroup: payloadToSend.apedge_group || null,
                        moduleKey: payloadToSend.module_key || null,
                        protectedConfig: payloadToSend.protected_config,
                        updated_by: userId,
                        updated_at: getCurrentTimeISOString()
                    };
                    try {
                        // Try PATCH first — works when the record already exists
                        await axios.patch(
                            `/api/v1/protected_config/${editTenantId}/${payloadToSend.unique_key}`,
                            protectedPayload,
                            config
                        );
                    } catch (patchErr) {
                        // 500/404 = no protected_config record yet → create it with POST
                        await axios.post(
                            `/api/v1/protected_config/${editTenantId}`,
                            { ...protectedPayload, tenant_id: editTenantId, created_by: userId },
                            config
                        );
                    }
                }

                toast.success("Parameter updated successfully!");
                setEditingParam(null);
            } else {
                // New parameter — use protected_config endpoint when content is provided,
                // otherwise fall back to the regular tables API
                if (payloadToSend.protected_config && payloadToSend.protected_config.trim() !== '') {
                    const postPayload = {
                        uniqueKey: payloadToSend.unique_key,
                        reqValue: payloadToSend.req_value,
                        description: payloadToSend.description || null,
                        apedgeGroup: payloadToSend.apedge_group || null,
                        metadata: payloadToSend.metadata || null,
                        // ── [VENDOR] include module_key in protected config POST ──
                        moduleKey: payloadToSend.module_key || null,
                        protectedConfig: payloadToSend.protected_config,
                        tenant_id: activeTenantId,
                        created_by: userId,
                        created_at: getCurrentTimeISOString()
                    };
                    await axios.post(`/api/v1/protected_config/${activeTenantId}`, postPayload, config);
                } else {
                    // No protected_config — use standard PostgREST tables API
                    const tablePayload = {
                        unique_key: payloadToSend.unique_key,
                        req_value: payloadToSend.req_value,
                        description: payloadToSend.description || null,
                        apedge_group: payloadToSend.apedge_group || null,
                        metadata: payloadToSend.metadata || null,
                        // ── [VENDOR] include module_key in table POST ──
                        module_key: payloadToSend.module_key || null,
                        tenant_id: activeTenantId,
                        created_by: userId,
                        created_at: getCurrentTimeISOString()
                    };
                    await axios.post(`/api/v1/tables/ap_parameters`, [tablePayload], config);
                }
                toast.success("Parameter added successfully!");
            }
            // ── [VENDOR] Reset includes module_key ──
            setNewParam({ unique_key: '', req_value: '', description: '', apedge_group: '', metadata: '', protected_config: '', module_key: '' });
            setModuleError("");
            if (userRole === 'super_admin') {
                setSelectedTenantId('');
            }
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            if (error.response?.data?.message?.includes('duplicate key value') ||
                error.response?.data?.message?.includes('ap_parameters_tenant_unique_key_unique')) {
                toast.error(`A parameter with key "${paramToSave.unique_key}" already exists for this tenant.`);
            } else {
                toast.error("Failed to save parameter.");
            }
        }
    };

    const handleEdit = async (param) => {
        if (!canEditParameters) {
            toast.warn(editPermissionMessage);
            return;
        }

        // ── [VENDOR] Reset includes module_key ──
        setNewParam({ unique_key: '', req_value: '', description: '', apedge_group: '', metadata: '', protected_config: '', module_key: '' });
        setModuleError("");
        // Open form immediately with existing row data (protected_config will be fetched below)
        setEditingParam({ ...param, protected_config: '', metadata: param.metadata || '', module_key: param.module_key || '' });

        if (userRole === 'super_admin') {
            setSelectedTenantId(param.tenant_id || '');
        }

        // Fetch protected_config — silently ignore 500s (record may not exist yet)
        const editTenantId = userRole === 'super_admin' ? (param.tenant_id || tenantId) : tenantId;
        try {
            const response = await axios.get(
                `/api/v1/protected_config/${editTenantId}/${param.unique_key}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const fetched = response.data?.protectedConfig ?? '';
            setEditingParam(prev => ({ ...prev, protected_config: fetched }));
        } catch {
            // 404/500 = no protected_config record yet — keep field empty
            setEditingParam(prev => ({ ...prev, protected_config: '' }));
        }
    };

    const handleDeleteClick = (param) => {
        if (!canDeleteParameters) {
            toast.error(deletePermissionMessage);
            return;
        }
        setParamToDelete(param);
        setShowConfirmModal(true);
    };

    const confirmDelete = async () => {
        if (!paramToDelete) return;

        if (!canDeleteParameters) {
            toast.error(deletePermissionMessage);
            setShowConfirmModal(false);
            return;
        }

        if (!token) {
            toast.error("Authentication information not found. Please log in again.");
            return;
        }
        try {
            let endpoint = `/api/v1/tables/ap_parameters?parameter_id=eq.${paramToDelete.parameter_id}`;
            await axios.delete(endpoint, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            toast.success("Parameter deleted successfully!");
            setRefreshTrigger(prev => prev + 1); // Reactively re-fetch the table
        } catch (error) {
            toast.error("Failed to delete parameter.");
        } finally {
            setShowConfirmModal(false);
            setParamToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowConfirmModal(false);
        setParamToDelete(null);
    };

    const clearAllFilters = () => {
        setAppliedFilters(defaultAdvancedFilters);
        setDraftFilters(defaultAdvancedFilters);
        // ── [VENDOR] module_key included in reset ──
        setColumnFilters({ unique_key: '', req_value: '', description: '', apedge_group: '', module_key: '', tenant_name: '' });
        setPage(1);
        setShowAdvancedFilter(false);
        // Note: Don't call fetchParameters() here because state updates are asynchronous.
        // The useEffect hook will automatically detect changes to appliedFilters/columnFilters
        // and trigger a new fetch with the cleared filter values.
    };

    const formatDate = (isoString) => {
        if (!isoString) return '—';
        const date = new Date(isoString);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    const handlePopupCloseAndSave = useCallback(() => {
        // When closing the popup, update the form state with the popup content
        if (popupContent.field === 'req_value') {
            if (editingParam) {
                setEditingParam(prev => ({ ...prev, req_value: popupContent.content }));
            } else {
                setNewParam(prev => ({ ...prev, req_value: popupContent.content }));
            }
        } else if (popupContent.field === 'protected_config') {
            if (editingParam) {
                setEditingParam(prev => ({ ...prev, protected_config: popupContent.content }));
            } else {
                setNewParam(prev => ({ ...prev, protected_config: popupContent.content }));
            }
        }
        closeCardPopup();
    }, [closeCardPopup, popupContent, editingParam]);

    // Add this new function to handle saving parameter values from the popup
    const handlePopupSave = useCallback((contentToSave, itemId) => {
        // Ensure we handle empty strings or nulls by defaulting to an empty string
        const finalContent = contentToSave === null || contentToSave === undefined ? '' : contentToSave;

        // Update the form state with the new value
        if (popupContent.field === 'req_value') {
            if (editingParam) {
                setEditingParam(prev => ({ ...prev, req_value: finalContent }));
            } else {
                setNewParam(prev => ({ ...prev, req_value: finalContent }));
            }
        } else if (popupContent.field === 'protected_config') {
            if (editingParam) {
                setEditingParam(prev => ({ ...prev, protected_config: finalContent }));
            } else {
                setNewParam(prev => ({ ...prev, protected_config: finalContent }));
            }
        }

        // Clear the autosave timer to prevent it from overwriting our explicit save
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        // Close the popup after saving
        closeCardPopup();
    }, [editingParam, closeCardPopup, popupContent.field]);

    const handleMetadataSave = useCallback((metadataValue) => {
        if (editingParam) {
            setEditingParam(prev => ({ ...prev, metadata: metadataValue || '' }));
        } else {
            setNewParam(prev => ({ ...prev, metadata: metadataValue || '' }));
        }
    }, [editingParam]);

    const baseColumns = useMemo(() => [
        {
            key: 'unique_key', header: 'Key', sortable: true, filterable: true, width: '150px', render: (item) => (
                <span className="text-xs text-gray-800">
                    {item.unique_key || 'N/A'}
                </span>
            )
        },
        // ── [VENDOR] Module column ────────────────────────────────────────────
        {
            key: 'module_key', header: 'Module', sortable: true, filterable: true, width: '130px', render: (item) => (
                <span className="text-xs text-gray-800">
                    {item.module_key || 'N/A'}
                </span>
            )
        },
        {
            key: 'req_value',
            header: 'Value',
            width: '180px',
            sortable: true,
            filterable: true,
            render: (item) => (
                <div
                    className="inline-flex items-center gap-1.5 px-2 h-[26px] rounded-md border border-indigo-100 bg-indigo-50/60 text-xs text-indigo-700 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors w-full"
                    onClick={() => openCardPopup("Parameter Value", item.req_value || 'N/A', false)}
                    title={item.req_value || 'N/A'}
                >
                    <span className="truncate flex-1">{item.req_value || <span className="text-gray-400 italic">—</span>}</span>
                    <SquareArrowOutUpRight size={10} className="shrink-0 text-indigo-300" />
                </div>
            )
        },
        {
            key: 'description', header: 'Description', sortable: true, filterable: true, width: '250px', render: (item) => (
                <span className="text-xs text-gray-800">
                    {item.description || 'N/A'}
                </span>
            )
        },
        {
            key: 'apedge_group', header: 'Group', sortable: true, filterable: true, width: '150px', render: (item) => (
                <span className="text-xs text-gray-800">
                    {item.apedge_group || 'N/A'}
                </span>
            )
        },
        {
            key: 'metadata',
            header: 'Metadata',
            sortable: false,
            filterable: false,
            width: '140px',
            render: (item) => {
                const meta = item.metadata;
                const hasContent = meta && meta.trim() !== '' && meta !== '{}' && meta !== 'null';
                let label = 'No entries';
                if (hasContent) {
                    try {
                        const parsed = JSON.parse(meta);
                        const count = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 1;
                        label = `${count} ${count === 1 ? 'entry' : 'entries'}`;
                    } catch { label = 'View entries'; }
                }
                return (
                    <div
                        className={`inline-flex items-center gap-1.5 px-2.5 h-[26px] rounded-md border text-xs transition-shadow w-full ${hasContent ? 'bg-blue-50 border-blue-200 text-blue-700 cursor-pointer hover:shadow-sm hover:shadow-blue-200' : 'bg-gray-50 border-gray-200 text-gray-400 cursor-default'}`}
                        onClick={() => { if (hasContent) { setCurrentMetadataItem(item); setShowMetadataViewer(true); } }}
                        title={hasContent ? 'Click to view metadata' : 'No metadata'}
                    >
                        <FileText size={11} className={hasContent ? 'text-blue-500 shrink-0' : 'text-gray-400 shrink-0'} />
                        <span className="truncate">{label}</span>
                        {hasContent && <SquareArrowOutUpRight size={10} className="ml-auto shrink-0 text-blue-400" />}
                    </div>
                );
            }
        },
        {
            key: 'protected_config',
            header: 'Protected',
            sortable: false,
            filterable: false,
            width: '120px',
            render: (item) => {
                const hasCfg = item.protected_config && item.protected_config.trim() !== '';
                return (
                    <div
                        className={`inline-flex items-center gap-1.5 px-2.5 h-[26px] rounded-md border text-xs w-full ${hasCfg ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                        title={hasCfg ? 'Protected config is set' : 'No protected config'}
                    >
                        <Lock size={11} className={hasCfg ? 'text-amber-500 shrink-0' : 'text-gray-400 shrink-0'} />
                        <span className="truncate">{hasCfg ? 'Configured' : 'Not set'}</span>
                    </div>
                );
            }
        },
        {
            key: 'updated_at',
            header: 'Updated On',
            sortable: true,
            filterable: false,
            render: (item) => (
                <span className="text-xs text-gray-800">
                    {formatDate(item.updated_at)}
                </span>
            ),
            width: '180px'
        }
    ], [openCardPopup]);

    const tenantColumn = useMemo(() => ({
        key: 'tenant_name',
        header: 'Tenant Name',
        sortable: true,
        filterable: true,
        render: (item) => (
            <span className="text-xs text-gray-800">
                {item.tenant_name || 'N/A'}
            </span>
        ),
        width: '150px'
    }), []);

    const columns = useMemo(() => {
        if (userRole === 'super_admin') {
            const keyIndex = baseColumns.findIndex(col => col.key === 'unique_key');
            if (keyIndex !== -1) {
                return [...baseColumns.slice(0, keyIndex + 1), tenantColumn, ...baseColumns.slice(keyIndex + 1)];
            }
            return [tenantColumn, ...baseColumns];
        }
        return baseColumns;
    }, [userRole, baseColumns, tenantColumn]);

    const columnsWithActions = useMemo(() => {
        return [...columns,
        {
            key: 'actions',
            header: 'Actions',
            width: '80px',
            render: (item) => (
                <div className="flex gap-1 justify-center">
                    <Button
                        variant="ghost" size="xs" icon={Edit}
                        onClick={() => handleEdit(item)}
                        disabled={!canEditParameters || (userRole !== 'super_admin' && item.tenant_id !== tenantId)}
                        title={!canEditParameters || (userRole !== 'super_admin' && item.tenant_id !== tenantId) ? editPermissionMessage : "Edit Parameter"}
                        data-tour="parameters-table-edit"
                        className="p-2 rounded-md hover:bg-gray-100 text-indigo-600 transition-colors"
                    />
                    {canDeleteParameters && (userRole === 'super_admin' || item.tenant_id === tenantId) && (
                        <Button
                            variant="ghost" size="xs" icon={Trash2}
                            onClick={() => handleDeleteClick(item)}
                            title="Delete Parameter"
                            data-tour="parameters-table-delete"
                            className="p-2 rounded-md hover:bg-gray-100 text-red-600 transition-colors"
                        />
                    )}
                </div>
            )
        }
        ];
    }, [columns, handleEdit, handleDeleteClick, canEditParameters, canDeleteParameters, editPermissionMessage, deletePermissionMessage, userRole, tenantId]);



    // Memoize filtered dropdown keys to avoid re-computation on every render
    const filteredKeys = useMemo(() => {
        // Derive from defaultConfigs (reactive state) — not the stale mutable fixedKeys array.
        // Super admin, no tenant: registeredKeysForTenant is empty → all keys shown.
        // Super admin, tenant selected: keys already registered for that tenant are hidden.
        // Tenant admin: keys registered for their own tenant are always hidden.
        const allKeys = defaultConfigs.map(c => c.unique_key);
        const available = allKeys.filter(key => !registeredKeysForTenant.has(key));
        if (!newParam.unique_key) return available;
        return available.filter(key =>
            key.toLowerCase().includes(newParam.unique_key.toLowerCase())
        );
    }, [newParam.unique_key, registeredKeysForTenant, defaultConfigs]);

    const filteredAndSortedDocuments = useMemo(() => {
        // Since we're using server-side filtering, we don't need client-side filtering
        // Just return the parameters as they are already filtered by the server
        let filtered = [...parameters];

        // We still need sorting since it's not handled by the server in all cases
        if (sortField) {
            filtered.sort((a, b) => {
                let aValue, bValue;

                if (sortField === 'tenant_name') {
                    // For tenant_name, compare the resolved tenant names
                    aValue = a[sortField] || 'N/A';
                    bValue = b[sortField] || 'N/A';
                } else {
                    // For other fields, use the direct value
                    aValue = a[sortField];
                    bValue = b[sortField];
                }

                if (aValue === null || aValue === undefined) return sortAsc ? 1 : -1;
                if (bValue === null || bValue === undefined) return sortAsc ? -1 : 1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortAsc ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                } else {
                    return sortAsc ? aValue - bValue : bValue - aValue;
                }
            });
        }
        return filtered;
    }, [parameters, sortField, sortAsc]);

    // True when super admin hasn't selected a tenant yet — used to lock all form fields
    const isTenantBlocked = userRole === 'super_admin' && !selectedTenantId && !editingParam;

    // Add this helper function to check if any filters are active
    const areFiltersActive = () => {
        return appliedFilters.unique_key || appliedFilters.req_value || appliedFilters.apedge_group ||
            // ── [VENDOR] module_key included in active-filter check ──
            appliedFilters.module_key ||
            columnFilters.unique_key || columnFilters.req_value ||
            columnFilters.description || columnFilters.apedge_group || columnFilters.module_key || columnFilters.tenant_name;
    };

    return (
        <div className="font-[Poppins]">
            <div className="font-[Poppins] p-4 rounded-xl  mx-auto flex flex-col">
                <ToastHost />

                {!user ? (
                    <div className="flex flex-col items-center justify-center text-center p-12 border border-gray-200 rounded-xl bg-white shadow-sm mt-8">
                        <Lock size={48} className="text-yellow-500 mb-4" />
                        <h2 className="text-2xl font-bold mb-2">Permission Denied</h2>
                        <p className="text-gray-500">Please log in to view this page.</p>
                    </div>
                ) : (
                    <>
                        <h2 className="text-sm font-semibold text-gray-800 mb-0.5" data-tour="parameters-header">Parameters</h2>
                        <div className="w-full h-0.5 bg-gradient-to-r from-indigo-500 to-transparent my-2"></div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
                            {/* Form header */}
                            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                                <div className="p-1 bg-indigo-100 rounded">
                                    <Key size={13} className="text-indigo-600" />
                                </div>
                                <span className="text-sm font-semibold text-gray-700">
                                    {editingParam ? 'Edit Parameter' : 'Add New Parameter'}
                                </span>
                                {editingParam && (
                                    <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                                        {editingParam.unique_key}
                                    </span>
                                )}
                            </div>

                            <form onSubmit={handleSubmit} className="p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">

                                    {/* ── Tenant (super admin only) — rendered FIRST so admin selects it before anything else ── */}
                                    {userRole === 'super_admin' && !editingParam && (
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                                Tenant <span className="text-red-500 normal-case tracking-normal">*</span>
                                            </label>
                                            <div className="[&>div]:!h-8 [&>div]:!min-h-0 [&>div]:!rounded-md [&>div]:!border-gray-300 [&>div]:!text-xs [&>div]:!bg-white [&>div>button]:!h-8 [&>div>button]:!text-xs [&>div>button]:!px-2.5 [&_input]:!text-xs [&_input]:!h-8 [&_input]:!py-0">
                                                <SearchableSelect
                                                    options={tenants
                                                        .filter(t => !tenantsWithKey.has(t.tenant_id))
                                                        .map(t => t.tenant_name)}
                                                    value={selectedTenantId ? tenants.find(t => t.tenant_id === selectedTenantId)?.tenant_name : ''}
                                                    onChange={(selectedOption) => {
                                                        if (!canEditParameters) { toast.error(editPermissionMessage); return; }
                                                        const found = tenants.find(t => t.tenant_name === selectedOption);
                                                        setSelectedTenantId(found ? found.tenant_id : '');
                                                    }}
                                                    placeholder="Select a tenant"
                                                    disabled={!canEditParameters}
                                                    className="w-full"
                                                    title={!canEditParameters ? editPermissionMessage : "Select a tenant to continue"}
                                                    allowClear={true}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Key ── */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                            Key <span className="text-red-500 normal-case tracking-normal">*</span>
                                        </label>
                                        <div className="relative">
                                            <Key size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                            <input
                                                type="text"
                                                id="unique_key"
                                                name="unique_key"
                                                value={editingParam ? editingParam.unique_key : newParam.unique_key}
                                                onChange={(e) => handleInputChange({ target: { name: 'unique_key', value: e.target.value } })}
                                                required
                                                autoComplete="off"
                                                onFocus={() => setShowDropdown(true)}
                                                ref={keyInputRef}
                                                className="w-full h-8 pl-8 pr-9 border border-gray-300 rounded-md text-xs text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 bg-white placeholder-gray-400 transition-colors"
                                                disabled={!canEditParameters || !!editingParam}
                                                placeholder="Enter or select key"
                                                title={
                                                    !canEditParameters ? editPermissionMessage
                                                        : editingParam ? "Key cannot be changed when editing"
                                                            : "Enter a unique key"
                                                }
                                            />
                                            {!!(editingParam ? editingParam.unique_key : newParam.unique_key) && !editingParam && (
                                                <button type="button" className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={handleClearKey} disabled={!canEditParameters}>
                                                    <X size={11} />
                                                </button>
                                            )}
                                            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowDropdown(!showDropdown)} disabled={!canEditParameters || !!editingParam}>
                                                <ChevronDown size={13} />
                                            </button>
                                            {showDropdown && !editingParam && (
                                                <ul ref={dropdownRef} className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-44 overflow-y-auto">
                                                    {filteredKeys.length > 0 ? filteredKeys.map(key => (
                                                        <li key={key} onClick={() => handleKeySelect(key)} className="px-3 py-1.5 cursor-pointer text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">{key}</li>
                                                    )) : (
                                                        <li className="px-3 py-2 text-xs text-gray-400 text-center">No fixed keys match or already registered.</li>
                                                    )}
                                                </ul>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Value ── */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                            Value <span className="text-red-500 normal-case tracking-normal">*</span>
                                        </label>
                                        <div
                                            className={`relative flex items-center h-8 border border-gray-300 rounded-md px-2.5 transition-colors group ${isTenantBlocked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30'}`}
                                            onClick={() => {
                                                if (isTenantBlocked) { toast.warn("Please select a tenant first."); return; }
                                                canEditParameters ? openCardPopup("Value", editingParam ? editingParam.req_value : newParam.req_value, true, editingParam ? editingParam.parameter_id : null, 'req_value') : toast.warn(editPermissionMessage);
                                            }}
                                            title={isTenantBlocked ? "Please select a tenant first" : undefined}
                                        >
                                            <span className={`flex-1 truncate text-xs pr-5 ${isTenantBlocked ? 'text-gray-400' : 'text-gray-800'}`}>
                                                {(editingParam ? editingParam.req_value : newParam.req_value) || <span className="text-gray-400">{isTenantBlocked ? "Select a tenant first" : "Click to enter value…"}</span>}
                                            </span>
                                            <SquareArrowOutUpRight size={12} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${isTenantBlocked ? 'text-gray-300' : 'text-gray-400 group-hover:text-indigo-500'}`} />
                                        </div>
                                    </div>

                                    {/* ── Description ── */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
                                        <div className="relative">
                                            <AlignLeft size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                            <input
                                                type="text"
                                                id="description"
                                                name="description"
                                                placeholder={isTenantBlocked ? "Select a tenant first" : "Enter description"}
                                                value={editingParam ? editingParam.description : newParam.description}
                                                onChange={handleInputChange}
                                                autoComplete="off"
                                                disabled={!canEditParameters || isTenantBlocked}
                                                title={isTenantBlocked ? "Please select a tenant first" : !canEditParameters ? editPermissionMessage : "Enter a description"}
                                                className="w-full h-8 pl-8 pr-2.5 border border-gray-300 rounded-md text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 disabled:bg-gray-100 disabled:text-gray-500 bg-white transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* ── Group ── */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Group</label>
                                        <div className="relative">
                                            <Layers size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                            <input
                                                type="text"
                                                id="apedge_group"
                                                name="apedge_group"
                                                placeholder={isTenantBlocked ? "Select a tenant first" : "Enter group"}
                                                value={editingParam ? editingParam.apedge_group : newParam.apedge_group}
                                                onChange={handleInputChange}
                                                autoComplete="off"
                                                disabled={!canEditParameters || isTenantBlocked}
                                                title={isTenantBlocked ? "Please select a tenant first" : !canEditParameters ? editPermissionMessage : "Enter group"}
                                                className="w-full h-8 pl-8 pr-2.5 border border-gray-300 rounded-md text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 disabled:bg-gray-100 disabled:text-gray-500 bg-white transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* ── [VENDOR] Module Selection ──────────────────────────────────────── */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                            Module <span className="text-red-500 normal-case tracking-normal">*</span>
                                        </label>
                                        <div className="relative">
                                            <Layers size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                            {userRole === 'super_admin' && !selectedTenantId && !editingParam ? (
                                                // Super admin: no tenant selected yet — show disabled placeholder
                                                <div className="flex items-center w-full h-8 border border-gray-300 rounded-md pl-8 pr-2.5 bg-gray-100 cursor-not-allowed">
                                                    <span className="text-xs text-gray-400">Select a tenant first</span>
                                                </div>
                                            ) : (
                                                <SearchableSelect
                                                    options={getAvailableModules()}
                                                    value={editingParam ? editingParam.module_key || '' : newParam.module_key || ''}
                                                    onChange={handleModuleChange}
                                                    placeholder="Select module"
                                                    disabled={!canEditParameters || isTenantBlocked}
                                                    title={
                                                        isTenantBlocked ? "Please select a tenant first"
                                                            : !canEditParameters ? editPermissionMessage
                                                                : "Select module for this parameter"
                                                    }
                                                    hasError={!!moduleError}
                                                    className="!w-full !h-8 !pl-8 !pr-2 !border !border-gray-300 !rounded-md !text-xs !text-gray-800 focus:!border-indigo-400 focus:!ring-2 focus:!ring-indigo-400/20 focus:!outline-none disabled:!bg-gray-100 disabled:!text-gray-500 !bg-white !placeholder-gray-400 !transition-colors !shadow-none !py-0 flex flex-col justify-center"
                                                    allowClear={true}
                                                />
                                            )}
                                        </div>
                                        {moduleError && (
                                            <p className="mt-1 text-xs text-red-500">{moduleError}</p>
                                        )}
                                    </div>

                                    {/* ── Metadata ── */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Metadata</label>
                                        <div
                                            className={`relative flex items-center h-8 border border-gray-300 rounded-md px-2.5 transition-colors group ${isTenantBlocked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-blue-400 hover:bg-blue-50/30'}`}
                                            onClick={() => {
                                                if (isTenantBlocked) { toast.warn("Please select a tenant first."); return; }
                                                canEditParameters ? setShowMetadataPopup(true) : toast.warn(editPermissionMessage);
                                            }}
                                            title={isTenantBlocked ? "Please select a tenant first" : !canEditParameters ? editPermissionMessage : 'Click to edit metadata'}
                                        >
                                            <FileText size={13} className={`shrink-0 mr-1.5 transition-colors ${isTenantBlocked ? 'text-gray-300' : 'text-gray-400 group-hover:text-blue-500'}`} />
                                            <span className="flex-1 truncate text-xs pr-5">
                                                {(() => {
                                                    if (isTenantBlocked) return <span className="text-gray-400">Select a tenant first</span>;
                                                    const meta = editingParam ? editingParam.metadata : newParam.metadata;
                                                    if (!meta || meta.trim() === '' || meta === '{}') return <span className="text-gray-400">Add metadata…</span>;
                                                    try {
                                                        const parsed = JSON.parse(meta);
                                                        const count = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 1;
                                                        return <span className="text-blue-700 font-medium">{count} {count === 1 ? 'entry' : 'entries'}</span>;
                                                    } catch { return <span className="text-blue-700 font-medium">View / Edit</span>; }
                                                })()}
                                            </span>
                                            <SquareArrowOutUpRight size={12} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${isTenantBlocked ? 'text-gray-300' : 'text-gray-400 group-hover:text-blue-500'}`} />
                                        </div>
                                    </div>

                                    {/* ── Protected Config ── */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                            <Lock size={11} className={isTenantBlocked ? 'text-gray-300' : 'text-amber-500'} /> Protected Config
                                        </label>
                                        <div
                                            className={`relative flex items-center h-8 border border-gray-300 rounded-md px-2.5 transition-colors group ${isTenantBlocked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-amber-400 hover:bg-amber-50/30'}`}
                                            onClick={() => {
                                                if (isTenantBlocked) { toast.warn("Please select a tenant first."); return; }
                                                canEditParameters ? openCardPopup("Protected Config", editingParam ? editingParam.protected_config : newParam.protected_config, true, editingParam ? editingParam.parameter_id : null, 'protected_config') : toast.warn(editPermissionMessage);
                                            }}
                                            title={isTenantBlocked ? "Please select a tenant first" : undefined}
                                        >
                                            <span className="flex-1 truncate text-xs pr-5">
                                                {isTenantBlocked
                                                    ? <span className="text-gray-400">Select a tenant first</span>
                                                    : (editingParam ? editingParam.protected_config : newParam.protected_config)
                                                        ? <span className="text-amber-700 font-medium">Configured — click to edit</span>
                                                        : <span className="text-gray-400">Add protected config…</span>}
                                            </span>
                                            <SquareArrowOutUpRight size={12} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${isTenantBlocked ? 'text-gray-300' : 'text-gray-400 group-hover:text-amber-500'}`} />
                                        </div>
                                    </div>

                                </div>

                                {/* ── Actions ── */}
                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                                    <Button
                                        type="submit"
                                        color="indigo" variant="solid" size="xs"
                                        disabled={!canEditParameters || isTenantBlocked}
                                        title={isTenantBlocked ? "Please select a tenant first" : !canEditParameters ? editPermissionMessage : editingParam ? "Update parameter" : "Add parameter"}
                                        data-tour="add-param-button"
                                    >
                                        {editingParam ? 'Update Parameter' : 'Add Parameter'}
                                    </Button>
                                    {editingParam && (
                                        <Button
                                            type="button"
                                            color="gray" variant="outline" size="xs"
                                            onClick={() => {
                                                setEditingParam(null);
                                                setNewParam({ unique_key: '', req_value: '', description: '', apedge_group: '', metadata: '', protected_config: '', module_key: '' });
                                                setModuleError("");
                                                if (userRole === 'super_admin') setSelectedTenantId('');
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            </form>
                        </div>

                        <div className="flex items-center justify-between mt-4 mb-2">
                            <span className="text-sm font-semibold text-gray-800">Parameters List ({totalCount} items)</span>
                            <div className="flex items-center gap-2">
                                {areFiltersActive() && (
                                    <Button color="red" variant="solid" size="xs" icon={X} onClick={clearAllFilters} title="Clear all filters">
                                        Clear Filters
                                    </Button>
                                )}
                                <Button
                                    color="indigo" variant="solid" size="xs"
                                    onClick={() => fetchParameters()}
                                    title="Refresh parameters"
                                    disabled={filtering}
                                >
                                    <RefreshCw size={13} className={filtering ? 'animate-spin' : ''} />
                                    {filtering ? 'Refreshing...' : 'Refresh'}
                                </Button>
                                <Button
                                    color="indigo" variant="solid" size="xs" icon={Filter}
                                    onClick={() => { setDraftFilters({ ...appliedFilters }); setShowAdvancedFilter(true); }}
                                    title="Open advanced filters"
                                >
                                    Advanced Filter
                                </Button>
                            </div>
                        </div>

                        <AdvancedFilterPanel
                            isOpen={showAdvancedFilter}
                            onClose={() => setShowAdvancedFilter(false)}
                            title="Advanced Filters"
                            filterFields={filterFields}
                            values={draftFilters}
                            onChange={(key, value) => setDraftFilters(prev => ({ ...prev, [key]: value }))}
                            onApply={() => {
                                setAppliedFilters({ ...draftFilters });
                                // ── [VENDOR] module_key included in column filter reset on apply ──
                                setColumnFilters({ unique_key: '', req_value: '', description: '', apedge_group: '', module_key: '', tenant_name: '' });
                                setPage(1);
                                setShowAdvancedFilter(false);
                            }}
                            onClearAll={(newValues) => {
                                setDraftFilters(newValues);
                                clearAllFilters();
                            }}
                            onClearDefaults={(newValues) => {
                                setDraftFilters(newValues);
                                setAppliedFilters(defaultAdvancedFilters);
                                // ── [VENDOR] module_key included in column filter reset on clear ──
                                setColumnFilters({ unique_key: '', req_value: '', description: '', apedge_group: '', module_key: '', tenant_name: '' });
                                setPage(1);
                                setShowAdvancedFilter(false);
                            }}
                        />

                        {loadingParameters && !filtering ? ( // Show full loading message only during initial load, not during filtering
                            <div className="flex flex-col items-center justify-center h-[200px] text-gray-500 mt-8">
                                <Loader2 className="animate-spin" size={36} />
                                <p>Loading parameters...</p>
                            </div>
                        ) : (
                            <TableComponent
                                data={filteredAndSortedDocuments}
                                columns={columnsWithActions}
                                columnFilters={columnFilters}
                                setColumnFilters={setColumnFilters}
                                sortField={sortField}
                                setSortField={setSortField}
                                sortAsc={sortAsc}
                                setSortAsc={setSortAsc}
                                page={page}
                                setPage={setPage}
                                emptyMessage="No parameters found."
                                data-tour="parameters-table"
                                data-tour-table-filters="parameters-table-filters"
                                data-tour-table-sort="parameters-table-sort"
                                tablePaginationDataTour="parameters-table-pagination"
                                // Pass pagination props
                                totalCount={totalCount}
                                pageSize={pageSize}
                                setPageSize={setPageSize}
                                // Pass filtering state for visual feedback
                                filtering={filtering}
                            />
                        )}

                        {showConfirmModal && paramToDelete && (
                            <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center backdrop-blur-sm" onClick={cancelDelete}>
                                <div className="bg-white p-4 rounded-md shadow-sm w-full max-w-lg" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-between pb-1.5 mb-3 border-b border-gray-200">
                                        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                            <Info size={14} className="text-red-500" /> Confirm Deletion
                                        </h3>
                                        <Button variant="ghost" size="xs" icon={X} onClick={cancelDelete} />
                                    </div>
                                    <p className="text-xs text-gray-700 mb-3">Are you sure you want to delete the parameter with Key: <span className="font-semibold">{paramToDelete.unique_key}</span>? This action cannot be undone.</p>
                                    <div className="flex justify-end gap-2 mt-3">
                                        <Button color="gray" variant="outline" size="xs" onClick={cancelDelete}>Cancel</Button>
                                        <Button color="red" variant="solid" size="xs" onClick={confirmDelete}>Delete</Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Metadata editor — form use */}
                        {showMetadataPopup && (
                            <MetadataPopup
                                isOpen={true}
                                onClose={() => setShowMetadataPopup(false)}
                                onSave={(val) => { handleMetadataSave(val); setShowMetadataPopup(false); }}
                                metadata={(editingParam ? editingParam.metadata : newParam.metadata) || ''}
                                isEditable={true}
                                title="Metadata Editor"
                                configType="parameter"
                                uniqueKey={(editingParam ? editingParam.unique_key : newParam.unique_key) || ''}
                                // ── [VENDOR] Pass vendorFieldConfig to MetadataPopup ──
                                vendorFieldConfig={vendorFieldConfig}
                            />
                        )}

                        {/* Metadata viewer — table row click */}
                        {showMetadataViewer && currentMetadataItem && (
                            <MetadataPopup
                                isOpen={true}
                                onClose={() => { setShowMetadataViewer(false); setCurrentMetadataItem(null); }}
                                metadata={currentMetadataItem.metadata || ''}
                                isEditable={false}
                                title="Metadata Viewer"
                                uniqueKey={currentMetadataItem.unique_key || ''}
                                // ── [VENDOR] Pass vendorFieldConfig to MetadataPopup viewer ──
                                vendorFieldConfig={vendorFieldConfig}
                            />
                        )}

                        <CardPopup
                            isOpen={isCardPopupOpen}
                            onRequestClose={closeCardPopup}
                            title={popupContent.title}
                            content={popupContent.content}
                            isEditable={popupContent.isEditable}
                            onContentChange={(newValue) => setPopupContent(prev => ({
                                ...prev,
                                content: newValue,
                                isError: false
                            }))}
                            isError={popupContent.isError}
                            showActionButtons={popupContent.isEditable}
                            onSave={popupContent.isEditable ? handlePopupSave : null}
                        />

                    </>
                )}
            </div >
        </div >
    );
}
export default Parameters;
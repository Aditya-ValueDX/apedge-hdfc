import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from '../../utils/authInterceptor';
import { Search, Filter, X, ChevronDown, Download, Eye, FileText, Edit, Trash2, Info, Loader2, Lock, Key, AlignLeft, Layers, SquareArrowOutUpRight, RefreshCw } from 'lucide-react';
import { useSelector } from 'react-redux';
import TableComponent from '../common/TableComponent';
import ViewDocumentModal from '../View/ViewDocumentModal';
import { canUserEdit, canUserDelete } from '../../permissions';
import { formatFileName } from '../../utils/fileUtils';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SearchableSelect from '../common/SearchableSelect';

import { apiBaseUrl } from '../../config/apiConfig';
import CardPopup from '../common/CardPopup';
import { useCardPopup } from '../hooks/useCardPopup';


import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdvancedFilterPanel from '../common/AdvancedFilterPanel';
import Button from '../common/Button';

// Define the list of fixed keys (will be populated from default configs)
const FIXED_KEYS = [];

const Masters = () => {
    const [searchParams, setSearchParams] = useSearchParams();

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
        return searchParams.get('sortField') || 'created_at';
    };

    const getInitialSortAsc = () => {
        const sortAscParam = searchParams.get('sortAsc');
        return sortAscParam ? sortAscParam === 'true' : false;
    };

    const getInitialColumnFilters = () => {
        const filters = {};
        const key = searchParams.get('key');
        if (key && key.trim() !== '') filters.unique_key = key.trim();

        const description = searchParams.get('description');
        if (description && description.trim() !== '') filters.description = description.trim();

        const file_path = searchParams.get('file_path');
        if (file_path && file_path.trim() !== '') filters.file_path = file_path.trim();

        const tenantName = searchParams.get('tenantName');
        if (tenantName && tenantName.trim() !== '') filters.tenant_name = tenantName.trim();

        return filters;
    };

    const getInitialAdvancedFilters = () => {
        const filters = {};
        const key = searchParams.get('adv_key');
        filters.key = key && key.trim() !== '' ? key.trim() : '';

        return filters;
    };

    const [masters, setMasters] = useState([]);
    const [defaultConfigs, setDefaultConfigs] = useState([]);
    const [cachedTenantNames, setCachedTenantNames] = useState({});
    const [tenants, setTenants] = useState([]);
    const [selectedTenantId, setSelectedTenantId] = useState('');
    // ── [VENDOR] selectedTenant mirrors selectedTenantId — used to gate module dropdown ──
    const [selectedTenant, setSelectedTenant] = useState(null);
    // ── [VENDOR] module_key added to currentMaster initial state ──
    const [currentMaster, setCurrentMaster] = useState({ master_id: null, key: '', description: '', file_path: '', metadata: '', module_key: '' });
    const [file, setFile] = useState(null);
    const [errors, setErrors] = useState({});

    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [page, setPage] = useState(getInitialPage());
    const [pageSize, setPageSize] = useState(getInitialPageSize());
    const [totalCount, setTotalCount] = useState(0);
    const [sortField, setSortField] = useState(getInitialSortField());
    const [sortAsc, setSortAsc] = useState(getInitialSortAsc());
    const [columnFilters, setColumnFilters] = useState({
        unique_key: '',
        description: '',
        file_path: '',
        tenant_name: '',
        ...getInitialColumnFilters()
    });
    const [filters, setFilters] = useState({
        key: '',
        ...getInitialAdvancedFilters()
    });
    // Draft state for the Advanced Filter modal — only committed to filters on Apply
    const [draftFilters, setDraftFilters] = useState({ key: '' });

    // Define filter fields for AdvancedFilterPanel
    const filterFields = [
        {
            key: 'key',
            label: 'Key',
            type: 'text',
            icon: Key,
            placeholder: 'Filter by key'
        }
    ];
    const [modalOpen, setModalOpen] = useState(false);
    const [docUrl, setDocUrl] = useState('');
    const [docFileName, setDocFileName] = useState('');
    const [loadingMasters, setLoadingMasters] = useState(true);
    const [filtering, setFiltering] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [masterToDelete, setMasterToDelete] = useState(null);

    // Tracks which FIXED_KEYS are already registered for the active tenant
    const [registeredKeysForTenant, setRegisteredKeysForTenant] = useState(new Set());
    // Tracks which tenant_ids already have the selected key
    const [tenantsWithKey, setTenantsWithKey] = useState(new Set());

    const [showDropdown, setShowDropdown] = useState(false);
    const keyInputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Hook for the CardPopup
    const { isCardPopupOpen, popupContent, openCardPopup, closeCardPopup, setPopupContent } = useCardPopup();

    // Get user from Redux store using useSelector
    const user = useSelector(state => state.auth.user);
    const tenantId = user?.tenantId;
    const userId = user?.user_id;
    const userRole = user?.role;
    const token = user?.token;

    // ── [VENDOR] Derive user's assigned modules from Redux user object ──────
    const userModules = useMemo(() => {
        if (user?.modules && typeof user.modules === 'object') {
            return Object.keys(user.modules).filter(key => user.modules[key] === true);
        }
        return [];
    }, [user?.modules]);

    // ── [VENDOR] Tenant modules state (super admin — populated after tenant selection) ──
    const [tenantModules, setTenantModules] = useState([]);

    // Initialize state from URL parameters when component mounts
    useEffect(() => {
        // State initialization functions already handle URL params on mount
    }, [searchParams]);

    // Update URL parameters when state changes
    useEffect(() => {
        const params = new URLSearchParams();

        if (page !== 1) params.set('page', page.toString());
        if (pageSize !== 10) params.set('pageSize', pageSize.toString());

        if (sortField !== 'created_at') params.set('sortField', sortField);
        if (sortAsc) params.set('sortAsc', sortAsc.toString());

        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value && value.trim()) {
                let paramName = key;
                if (key === 'unique_key') paramName = 'key';
                if (key === 'tenant_name') paramName = 'tenantName';
                params.set(paramName, value.trim());
            }
        });

        Object.entries(filters).forEach(([key, value]) => {
            if (value && value.trim()) {
                switch (key) {
                    case 'key':
                        params.set('adv_key', value.trim());
                        break;
                    default:
                        params.set(key, value.trim());
                }
            }
        });

        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, columnFilters, filters, setSearchParams]);

    const canEditMasters = canUserEdit(userRole, 'masters');
    const canDeleteMasters = canUserDelete(userRole, 'masters');

    const editPermissionDeniedMessage = "You do not have permission to edit Masters.";
    const deletePermissionDeniedMessage = "You do not have permission to delete Masters.";

    const downloadApprovalTemplate = () => {
        const headers = [
            "Employee Email",
            "L1 Approver Email",
            "L2 Approver Email",
            "L3 Approver Email",
            "L4 Approver Email",
            "L5 Approver Email",
            "L6 Approver Email",
            "L7 Approver Email",
            "L8 Approver Email",
            "L9 Approver Email",
            "L10 Approver Email"
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Approval Template");

        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([wbout], { type: "application/octet-stream" }), "Approval_File_Template.xlsx");
    };

    // Fetch tenants for super admin
    const fetchTenants = useCallback(async () => {
        if (!user || !token || userRole !== 'super_admin') {
            return;
        }

        try {
            // ── [VENDOR] Include allowed_modules so fetchTenantModules can reuse the list ──
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

                // Handle API response where allowed_modules is wrapped in a {value: ...} object
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
                    // Fallback: modulesData is directly an object (not wrapped in value)
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

    // ── [VENDOR] Derive available module list based on role + selected tenant ──
    const getAvailableModules = useCallback(() => {
        if (userRole === 'super_admin') {
            // Only populate when a tenant is selected; otherwise keep empty
            return selectedTenant ? (Array.isArray(tenantModules) ? tenantModules : []) : [];
        } else {
            return Array.isArray(userModules) ? userModules : [];
        }
    }, [userRole, selectedTenant, tenantModules, userModules]);

    // Fetch default configurations for masters
    const fetchDefaultConfigs = useCallback(async () => {
        if (!user || !token) {
            return;
        }

        try {
            const { data } = await axios.get(`/api/v1/tables/ap_default_configs?config_type=eq.master`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setDefaultConfigs(data);
            FIXED_KEYS.length = 0;
            data.forEach(config => FIXED_KEYS.push(config.unique_key));
        } catch (error) {
            // Error fetching default configurations
        }
    }, [user, token]);

    // Get default config for current key to check file type restrictions
    const getDefaultConfigForKey = useCallback((key) => {
        return defaultConfigs.find(config => config.unique_key === key);
    }, [defaultConfigs]);

    // Check if the current key is one of the fixed keys
    const isFixedKey = useMemo(() => {
        return defaultConfigs.some(c => c.unique_key === (currentMaster.unique_key || currentMaster.key));
    }, [currentMaster.unique_key, currentMaster.key, defaultConfigs]);

    // True when a super admin hasn't selected a tenant yet (only in add mode)
    const isTenantBlocked = userRole === 'super_admin' && !selectedTenantId && !currentMaster.master_id;

    useEffect(() => {
        if (showAdvancedFilter || modalOpen || showConfirmDeleteModal) {
            document.body.classList.add('overflow-hidden');
        } else {
            document.body.classList.remove('overflow-hidden');
        }
        return () => {
            document.body.classList.remove('overflow-hidden');
        };
    }, [showAdvancedFilter, modalOpen, showConfirmDeleteModal]);

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

    // ── [VENDOR] Re-fetch tenant modules whenever super admin changes tenant selection ──
    useEffect(() => {
        if (userRole === 'super_admin' && selectedTenant) {
            fetchTenantModules(selectedTenant);
        } else if (userRole === 'super_admin' && !selectedTenant) {
            setTenantModules([]);
        }
    }, [selectedTenant, fetchTenantModules, userRole]);

    const fetchTenantNames = useCallback(async (tenantIds) => {
        if (!tenantIds.length || !token) {
            return {};
        }

        const updatedCache = { ...cachedTenantNames };
        const uncachedTenantIds = tenantIds.filter(id => !(id in updatedCache));

        if (uncachedTenantIds.length === 0) {
            return updatedCache;
        }

        try {
            const tenantPromises = uncachedTenantIds.map(id =>
                axios.get(`/api/v1/tables/ap_tenants?tenant_id=eq.${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            );
            const tenantResponses = await Promise.all(tenantPromises);

            tenantResponses.forEach(res => {
                const tenant = res.data[0];
                if (tenant) {
                    updatedCache[tenant.tenant_id] = tenant.tenant_name;
                }
            });

            setCachedTenantNames(updatedCache);
            return updatedCache;
        } catch (error) {
            toast.error("Failed to load some tenant names.");
            return updatedCache;
        }
    }, [cachedTenantNames, token]);

    const fetchMasters = useCallback(async () => {
        if (!user || !token) {
            setLoadingMasters(false);
            return;
        }

        // Clear stale data immediately
        setMasters([]);
        setTotalCount(0);

        if (loadingMasters) {
            setLoadingMasters(true);
        }
        setFiltering(true);

        const offset = (page - 1) * pageSize;

        let fetchUrl;
        const isSuperAdmin = userRole === 'super_admin';
        const tenantNameFilter = columnFilters.tenant_name?.trim();

        const tenantJoin = tenantNameFilter ? 'ap_tenants!inner(tenant_name)' : 'ap_tenants(tenant_name)';

        if (isSuperAdmin) {
            fetchUrl = `/api/v1/tables/ap_masters?select=*,${tenantJoin}&limit=${pageSize}&offset=${offset}`;
        } else {
            fetchUrl = `/api/v1/tables/ap_masters?select=*,${tenantJoin}&tenant_id=eq.${tenantId}&limit=${pageSize}&offset=${offset}`;
        }

        // Add column filters
        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value?.trim()) {
                const filterValue = encodeURIComponent(value.trim());
                switch (key) {
                    case 'unique_key':
                        fetchUrl += `&unique_key=ilike.*${filterValue}*`;
                        break;
                    case 'description':
                        fetchUrl += `&description=ilike.*${filterValue}*`;
                        break;
                    case 'file_path':
                        fetchUrl += `&file_path=ilike.*${filterValue}*`;
                        break;
                    // ── [VENDOR] module_key column filter ──
                    case 'module_key':
                        fetchUrl += `&module_key=ilike.*${filterValue}*`;
                        break;
                    case 'tenant_name':
                        fetchUrl += `&ap_tenants.tenant_name=ilike.*${filterValue}*`;
                        break;
                    default:
                        break;
                }
            }
        });

        // Add advanced filters
        if (filters.key && filters.key.trim()) fetchUrl += `&unique_key=ilike.*${encodeURIComponent(filters.key.trim())}*`;

        // Add sorting
        const effectiveSortField = sortField || 'created_at';
        const effectiveSortAsc = sortAsc;

        let dbSortFieldMapped = effectiveSortField;
        if (effectiveSortField === 'unique_key') dbSortFieldMapped = 'unique_key';
        else if (effectiveSortField === 'description') dbSortFieldMapped = 'description';
        else if (effectiveSortField === 'file_path') dbSortFieldMapped = 'file_path';
        else if (effectiveSortField === 'created_at') dbSortFieldMapped = 'created_at';
        // ── [VENDOR] module_key sort mapping ──
        else if (effectiveSortField === 'module_key') dbSortFieldMapped = 'module_key';
        else if (effectiveSortField === 'tenant_name') dbSortFieldMapped = 'tenant_id';

        let orderQuery = `${dbSortFieldMapped}.${effectiveSortAsc ? 'asc' : 'desc'}.nullslast`;

        if (effectiveSortField !== 'master_id') {
            orderQuery += `,master_id.desc`;
        }

        fetchUrl += `&order=${orderQuery}`;

        try {
            const response = await axios.get(fetchUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact'
                }
            });

            const contentRange = response.headers['content-range'];
            let total = 0;
            if (contentRange) {
                const match = contentRange.match(/\/\d+$/);
                if (match) {
                    total = parseInt(match[0].substring(1), 10);
                }
            }

            let mastersWithTenantNames = response.data.map(master => ({
                ...master,
                tenant_name: master.ap_tenants?.tenant_name || 'N/A'
            }));

            setTotalCount(total);
            setMasters(mastersWithTenantNames);
        } catch (error) {
            setTotalCount(0);
        } finally {
            setLoadingMasters(false);
            setFiltering(false);
        }
    }, [tenantId, user, userRole, token, page, pageSize, sortField, sortAsc, columnFilters, filters, refreshTrigger]);

    useEffect(() => {
        if (user && token) {
            fetchMasters();
            if (userRole === 'super_admin') {
                fetchTenants();
            }
        }
    }, [fetchMasters, fetchTenants, user, token, userRole, page, pageSize, sortField, sortAsc, columnFilters, filters, refreshTrigger]);

    // Fetch default configs separately - only when user/token changes
    useEffect(() => {
        if (user && token) {
            fetchDefaultConfigs();
        } else {
            setCachedTenantNames({});
        }
    }, [fetchDefaultConfigs, user, token]);

    const getTenantName = useCallback((tenantId) => {
        return cachedTenantNames[tenantId] || 'N/A';
    }, [cachedTenantNames]);

    // Update cached tenant names when user changes
    useEffect(() => {
        if (user && token) {
            setCachedTenantNames({});
        }
    }, [user, token]);

    // Fetch all unique_keys already registered for a given tenant
    const fetchRegisteredKeysForTenant = useCallback(async (tid) => {
        if (!tid || !token) return;
        try {
            const { data } = await axios.get(
                `/api/v1/tables/ap_masters?tenant_id=eq.${tid}&select=unique_key`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRegisteredKeysForTenant(new Set(data.map(m => m.unique_key)));
        } catch {
            setRegisteredKeysForTenant(new Set());
        }
    }, [token]);

    // For regular tenant users: load their already-registered keys on mount and after save/delete
    useEffect(() => {
        if (!currentMaster.master_id && userRole !== 'super_admin' && tenantId && token) {
            fetchRegisteredKeysForTenant(tenantId);
        }
    }, [tenantId, token, userRole, currentMaster.master_id, refreshTrigger, fetchRegisteredKeysForTenant]);

    // For super admins: reload registered keys whenever the selected tenant changes
    useEffect(() => {
        if (!currentMaster.master_id && userRole === 'super_admin') {
            if (selectedTenantId) {
                fetchRegisteredKeysForTenant(selectedTenantId);
            } else {
                setRegisteredKeysForTenant(new Set());
            }
        }
    }, [selectedTenantId, token, userRole, currentMaster.master_id, refreshTrigger, fetchRegisteredKeysForTenant]);

    // Fetch all tenant_ids that already have a given key
    const fetchTenantsWithKey = useCallback(async (key) => {
        if (!key || !token) return;
        try {
            const { data } = await axios.get(
                `/api/v1/tables/ap_masters?unique_key=eq.${encodeURIComponent(key)}&select=tenant_id`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTenantsWithKey(new Set(data.map(m => m.tenant_id)));
        } catch {
            setTenantsWithKey(new Set());
        }
    }, [token]);

    useEffect(() => {
        if (!currentMaster.master_id && userRole === 'super_admin') {
            const key = currentMaster.unique_key || currentMaster.key;
            if (key) {
                fetchTenantsWithKey(key);
            } else {
                setTenantsWithKey(new Set());
            }
        }
    }, [currentMaster.unique_key, currentMaster.key, userRole, currentMaster.master_id, fetchTenantsWithKey]);

    const handleInputChange = (e) => {
        if (!canEditMasters) {
            toast.error(editPermissionDeniedMessage);
            return;
        }
        const { name, value } = e.target;
        setCurrentMaster({ ...currentMaster, [name]: value });

        if ((name === 'unique_key' || name === 'key') && errors.key) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.key;
                return newErrors;
            });
        }

        if (name === 'unique_key' || name === 'key') {
            if (defaultConfigs.some(c => c.unique_key.toLowerCase().includes(value.toLowerCase()))) {
                setShowDropdown(true);
            } else {
                setShowDropdown(false);
            }
        }
    };

    const handleKeySelect = (key) => {
        setCurrentMaster({ ...currentMaster, unique_key: key });
        setShowDropdown(false);
    };

    const handleClearKey = () => {
        setCurrentMaster({ ...currentMaster, unique_key: '' });
        setShowDropdown(false);
    };

    const filteredKeys = useMemo(() => {
        const allKeys = defaultConfigs.map(c => c.unique_key);
        const available = allKeys.filter(key => !registeredKeysForTenant.has(key));
        const currentKey = currentMaster.unique_key || currentMaster.key;
        if (!currentKey) return available;
        return available.filter(key => key.toLowerCase().includes(currentKey.toLowerCase()));
    }, [currentMaster.unique_key, currentMaster.key, registeredKeysForTenant, defaultConfigs]);

    const handleFileChange = (e) => {
        if (!canEditMasters) {
            toast.error(editPermissionDeniedMessage);
            return;
        }

        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        if (errors.file) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.file;
                return newErrors;
            });
        }

        const currentKey = currentMaster.unique_key || currentMaster.key;

        if (currentKey === 'Policy') {
            if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
                toast.error("Only PDF files are allowed for Policy uploads.");
                e.target.value = '';
                return;
            }
        } else {
            const validExcelTypes = [
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel.sheet.macroEnabled.12',
                'text/csv'
            ];
            const isValidExcel = validExcelTypes.includes(selectedFile.type) ||
                selectedFile.name.toLowerCase().endsWith('.xls') ||
                selectedFile.name.toLowerCase().endsWith('.xlsx') ||
                selectedFile.name.toLowerCase().endsWith('.csv');

            if (!isValidExcel) {
                toast.error("Only Excel files (.xls, .xlsx, .csv) are allowed for this key.");
                e.target.value = '';
                return;
            }
        }

        setFile(selectedFile);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const isSuperAdmin = userRole === 'super_admin';

        if (!canEditMasters) {
            toast.error(editPermissionDeniedMessage);
            return;
        }

        if (!token) {
            toast.error("Authentication information not found. Please log in again.");
            return;
        }

        if (isSuperAdmin && !selectedTenantId && !currentMaster.master_id) {
            toast.error("Please select a tenant to register the master.");
            return;
        }

        const newErrors = {};
        const currentKey = currentMaster.unique_key || currentMaster.key;

        if (!currentKey) {
            newErrors.key = 'Key is required';
        }

        if (!currentMaster.master_id && !file) {
            newErrors.file = 'File is required';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.warn("Please fill in all required fields.");
            return;
        }

        setErrors({});

        const tenantToCheck = isSuperAdmin ? selectedTenantId : tenantId;
        if (
            !currentMaster.master_id &&
            masters.some(m => m.unique_key === currentKey && m.tenant_id === tenantToCheck)
        ) {
            toast.error("This key already exists for the selected tenant. Please choose a different key.");
            return;
        }

        try {
            let response;
            if (currentMaster.master_id) {
                // UPDATE CASE
                if (file) {
                    // Scenario 1: New file selected — use PUT endpoint
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('tenant_id', tenantId);
                    formData.append('user_id', userId);
                    if (currentMaster.description) {
                        formData.append('desc', currentMaster.description);
                    }
                    formData.append('metadata', currentMaster.metadata || '');
                    // ── [VENDOR] include module_key in PUT formData ──
                    formData.append('module_key', currentMaster.module_key || '');

                    const config = {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            Authorization: `Bearer ${token}`
                        },
                    };

                    response = await axios.put(`/api/updateuploadmaster/${currentMaster.master_id}`, formData, config);

                    // ── [VENDOR] Fix: Patch module_key since updateuploadmaster API drops it ──
                    if (currentMaster.module_key !== undefined) {
                        try {
                            const patchUrl = `/api/v1/tables/ap_masters?master_id=eq.${currentMaster.master_id}`;
                            const patchPayload = { module_key: currentMaster.module_key || null };
                            await axios.patch(patchUrl, patchPayload, { headers: { Authorization: `Bearer ${token}` } });
                        } catch (patchErr) {
                            console.error("Error patching module_key", patchErr);
                        }
                    }

                    toast.success("Master updated successfully!");
                } else {
                    // Scenario 2: No new file — PATCH only text fields
                    const patchUrl = `/api/v1/tables/ap_masters?master_id=eq.${currentMaster.master_id}`;
                    const patchPayload = {
                        unique_key: currentMaster.unique_key || currentMaster.key,
                        description: currentMaster.description,
                        metadata: currentMaster.metadata || '',
                        // ── [VENDOR] include module_key in PATCH payload ──
                        module_key: currentMaster.module_key || '',
                        updated_at: getCurrentTimeISOString(),
                        updated_by: userId
                    };
                    response = await axios.patch(patchUrl, patchPayload, { headers: { Authorization: `Bearer ${token}` } });
                    toast.success("Master updated successfully!");
                }
            } else {
                // INSERT CASE
                const formData = new FormData();
                formData.append('file', file);
                formData.append('unique_key', currentMaster.unique_key || currentMaster.key);
                formData.append('desc', currentMaster.description || '');
                formData.append('metadata', currentMaster.metadata || '');
                // ── [VENDOR] include module_key in POST formData ──
                formData.append('module_key', currentMaster.module_key || '');
                const tenantToUse = isSuperAdmin ? selectedTenantId : tenantId;
                formData.append('tenant_id', tenantToUse);
                formData.append('user_id', userId);

                const config = {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${token}`
                    },
                };

                response = await axios.post(`/api/uploadmaster`, formData, config);

                // ── [VENDOR] Fix: Patch module_key since uploadmaster API drops it ──
                if (response.data && response.data.master_id && currentMaster.module_key !== undefined) {
                    try {
                        const patchUrl = `/api/v1/tables/ap_masters?master_id=eq.${response.data.master_id}`;
                        const patchPayload = { module_key: currentMaster.module_key || null };
                        await axios.patch(patchUrl, patchPayload, { headers: { Authorization: `Bearer ${token}` } });
                    } catch (patchErr) {
                        console.error("Error patching module_key", patchErr);
                    }
                }

                toast.success("Master created successfully!");
            }

            // ── [VENDOR] Reset includes module_key ──
            setCurrentMaster({ master_id: null, key: '', description: '', file_path: '', metadata: '', module_key: '' });
            setFile(null);
            if (userRole === 'super_admin') {
                setSelectedTenantId('');
                setSelectedTenant(null);
            }
            if (document.getElementById('file-input')) {
                document.getElementById('file-input').value = '';
            }
            setRefreshTrigger(prev => prev + 1);

        } catch (error) {
            const errorMessage = error.response?.data?.message || `Failed to ${currentMaster.master_id ? 'update' : 'create'} master.`;
            toast.error(errorMessage);
        }
    };

    const handleEdit = (master) => {
        if (!canEditMasters) {
            toast.error(editPermissionDeniedMessage);
            return;
        }
        // ── [VENDOR] Preserve module_key when populating edit form ──
        setCurrentMaster({
            ...master,
            metadata: master.metadata || '',
            module_key: master.module_key || ''
        });
        setFile(null);
        if (userRole === 'super_admin') {
            setSelectedTenantId(master.tenant_id || '');
            setSelectedTenant(master.tenant_id || null);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        // ── [VENDOR] Reset includes module_key ──
        setCurrentMaster({ master_id: null, key: '', description: '', file_path: '', metadata: '', module_key: '' });
        setFile(null);
        setErrors({});
        if (userRole === 'super_admin') {
            setSelectedTenantId('');
            setSelectedTenant(null);
        }
        if (document.getElementById('file-input')) {
            document.getElementById('file-input').value = '';
        }
    };

    const handleDeleteClick = (master) => {
        if (!canDeleteMasters) {
            toast.error(deletePermissionDeniedMessage);
            return;
        }
        setMasterToDelete(master);
        setShowConfirmDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!masterToDelete) return;
        const isSuperAdmin = userRole === 'super_admin';

        if (!canDeleteMasters) {
            toast.error(deletePermissionDeniedMessage);
            setShowConfirmDeleteModal(false);
            return;
        }

        if (!token) {
            toast.error("Authentication information not found. Please log in again.");
            return;
        }
        try {
            const endpoint = `/api/v1/tables/ap_masters?master_id=eq.${masterToDelete.master_id}`;
            await axios.delete(endpoint, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            toast.success("Master deleted successfully!");
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            toast.error("Failed to delete master.");
            if (error.response && error.response.data && error.response.data.message) {
                toast.error(`Error: ${error.response.data.message}`);
            }
        } finally {
            setShowConfirmDeleteModal(false);
            setMasterToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowConfirmDeleteModal(false);
        setMasterToDelete(null);
    };

    const openViewer = (filePath) => {
        setDocUrl(`/api/${filePath}`);
        setDocFileName(formatFileName(filePath));
        setModalOpen(true);
    };

    const downloadFile = (filePath, key) => {
        const link = document.createElement('a');
        link.href = `/api/${filePath}`;
        link.setAttribute('download', formatFileName(filePath) || key || 'download');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearAllFilters = () => {
        setFilters({ key: '' });
        setColumnFilters({ unique_key: '', description: '', file_path: '', tenant_name: '' });
        setPage(1);
        setShowAdvancedFilter(false);
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

    // Check if any filters are active
    const areFiltersActive = () => {
        return (filters.key && filters.key.trim()) ||
            (columnFilters.unique_key && columnFilters.unique_key.trim()) ||
            (columnFilters.description && columnFilters.description.trim()) ||
            (columnFilters.file_path && columnFilters.file_path.trim()) ||
            (columnFilters.tenant_name && columnFilters.tenant_name.trim());
    };

    const baseColumns = useMemo(() => [
        {
            key: 'unique_key', header: 'Key', width: '150px', sortable: true, filterable: true, render: (item) => (
                <span className="text-xs text-gray-700">
                    {item.unique_key || 'N/A'}
                </span>
            )
        },
        // ── [VENDOR] Module column ────────────────────────────────────────────
        {
            key: 'module_key',
            header: 'Module',
            width: '130px',
            sortable: true,
            filterable: true,
            render: (item) => (
                <span className="text-xs text-gray-700">
                    {item.module_key || 'N/A'}
                </span>
            )
        },
        {
            key: 'file_path', header: 'File Name', width: 250, sortable: true, filterable: true, filterPlaceholder: 'File Name', render: (item) => (
                <span className="text-xs text-gray-700" title={item.file_path}>
                    {formatFileName(item.file_path)}
                </span>
            )
        },
        {
            key: 'description', header: 'Description', width: '150px', sortable: true, filterable: true, render: (item) => (
                <span className="text-xs text-gray-700">
                    {item.description || 'N/A'}
                </span>
            )
        },
        {
            key: 'metadata',
            header: 'Metadata',
            width: '130px',
            sortable: false,
            filterable: false,
            render: (item) => {
                const meta = item.metadata;
                const hasContent = meta && meta.trim() !== '' && meta !== '{}' && meta !== 'null';
                let label = 'No entries';
                if (hasContent) {
                    try {
                        const parsed = JSON.parse(meta);
                        const count = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 1;
                        label = `${count} ${count === 1 ? 'entry' : 'entries'}`;
                    } catch { label = meta.length > 20 ? meta.slice(0, 20) + '…' : meta; }
                }
                return (
                    <div
                        className={`inline-flex items-center gap-1 px-2 h-[22px] rounded border text-[11px] font-light w-full ${hasContent ? 'bg-blue-50 border-blue-100 text-blue-600 cursor-default' : 'bg-gray-50 border-gray-100 text-gray-400 cursor-default'}`}
                        title={hasContent ? meta : 'No metadata'}
                    >
                        <FileText size={10} className={hasContent ? 'text-blue-400 shrink-0' : 'text-gray-200 shrink-0'} />
                        <span className="truncate">{label}</span>
                    </div>
                );
            }
        },
        {
            key: 'updated_at',
            header: 'Updated On',
            width: '150px',
            sortable: true,
            filterable: false,
            render: (item) => (
                <span className="text-xs text-gray-700">
                    {formatDate(item.updated_at)}
                </span>
            )
        },
    ], []);

    // Add Tenant Name column if user is super_admin
    const tenantColumn = useMemo(() => ({
        key: 'tenant_name',
        header: 'Tenant Name',
        sortable: true,
        filterable: true,
        width: '200px',
        render: (item) => (
            <span className="text-xs text-gray-700">
                {item.tenant_name || 'N/A'}
            </span>
        )
    }), []);

    // Combine base columns with the tenant column if applicable
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

    // Add actions column at the end
    const columnsWithActions = useMemo(() => {
        return [...columns,
        {
            key: 'actions',
            header: 'Actions',
            width: '100px',
            render: (item) => (
                <div className="flex gap-1 justify-center">
                    <Button
                        variant="ghost"
                        size="xs"
                        icon={Eye}
                        onClick={() => openViewer(item.file_path)}
                        title="View Master File"
                        data-tour="masters-table-view"
                        className="p-2 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
                    />
                    <Button
                        variant="ghost"
                        size="xs"
                        icon={Edit}
                        onClick={() => handleEdit(item)}
                        disabled={!canEditMasters || (userRole !== 'super_admin' && item.tenant_id !== tenantId)}
                        title={!canEditMasters || (userRole !== 'super_admin' && item.tenant_id !== tenantId) ? editPermissionDeniedMessage : "Edit Master"}
                        data-tour="masters-table-edit"
                        className="p-2 rounded-md hover:bg-gray-100 text-indigo-600 transition-colors"
                    />
                    {canDeleteMasters && (
                        <Button
                            variant="ghost"
                            size="xs"
                            icon={Trash2}
                            onClick={() => handleDeleteClick(item)}
                            disabled={
                                !canDeleteMasters ||
                                (userRole !== 'super_admin' && item.tenant_id !== tenantId)
                            }
                            title={
                                !canDeleteMasters ||
                                    (userRole !== 'super_admin' && item.tenant_id !== tenantId)
                                    ? deletePermissionDeniedMessage
                                    : "Delete Master"
                            }
                            data-tour="masters-table-delete"
                            className="p-2 rounded-md hover:bg-gray-100 text-red-600 transition-colors"
                        />
                    )}
                </div>
            )
        }
        ];
    }, [columns, openViewer, handleEdit, handleDeleteClick, canEditMasters, canDeleteMasters, editPermissionDeniedMessage, deletePermissionDeniedMessage, userRole, tenantId]);

    // Handle initial loading state where user is not yet in Redux store
    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500 text-lg">
                    Loading user data...
                </div>
            </div>
        );
    }

    // Helper function to get file accept attribute based on key
    const getFileAcceptAttribute = () => {
        const currentKey = currentMaster.unique_key || currentMaster.key;

        if (currentKey === 'Policy') {
            return ".pdf,application/pdf";
        } else {
            return ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";
        }
    };

    // Helper function to get file type label based on key
    const getFileTypeLabel = () => {
        const currentKey = currentMaster.unique_key || currentMaster.key;

        if (currentKey === 'Policy') {
            return 'PDF only';
        } else {
            return 'Excel only';
        }
    };

    return (
        <div className="font-[Poppins] ">
            <div className="p-3 rounded-lg min-h-full font-[Poppins] overflow-x-hidden">

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-2" data-tour="masters-header">
                    <h2 className="text-sm font-semibold text-gray-800">Masters</h2>
                </div>

                {/* Form to add new Master / Edit Existing Master */}
                <div className="bg-white rounded-md border border-gray-200 shadow-sm mb-3 overflow-hidden">
                    {/* Form header */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
                        <div className="p-1 bg-indigo-100 rounded">
                            <Key size={13} className="text-indigo-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                            {currentMaster.master_id ? 'Edit Master' : 'Add New Master'}
                        </span>
                        {currentMaster.master_id && (
                            <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                                {currentMaster.unique_key || currentMaster.key}
                            </span>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">

                            {/* ── Tenant (super admin only) — FIRST so tenant must be selected before anything else ── */}
                            {userRole === 'super_admin' && !currentMaster.master_id && (
                                <div className="flex flex-col gap-1" data-tour="tenant-selection-field">
                                    <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                        Tenant <span className="text-red-500 normal-case tracking-normal">*</span>
                                    </label>
                                    <div className="h-8 [&>*]:!h-8 [&_button]:!h-6 [&_button]:!text-xs [&_input]:!h-8 [&_input]:!text-xs [&_input]:!py-0 [&>div]:!min-h-0">
                                        <SearchableSelect
                                            options={tenants
                                                .filter(t => !tenantsWithKey.has(t.tenant_id))
                                                .map(t => t.tenant_name)}
                                            value={selectedTenantId ? tenants.find(t => t.tenant_id === selectedTenantId)?.tenant_name : ''}
                                            onChange={(selectedOption) => {
                                                const found = tenants.find(t => t.tenant_name === selectedOption);
                                                const newId = found ? found.tenant_id : '';
                                                setSelectedTenantId(newId);
                                                // ── [VENDOR] keep selectedTenant in sync for module gating ──
                                                setSelectedTenant(newId || null);
                                            }}
                                            placeholder="Select a tenant"
                                            disabled={!canEditMasters}
                                            className="w-full"
                                            title={!canEditMasters ? editPermissionDeniedMessage : "Select a tenant to continue"}
                                            allowClear={true}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ── Key ── */}
                            <div className="flex flex-col gap-1" data-tour="master-key-field">
                                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                    Key <span className="text-red-500 normal-case tracking-normal">*</span>
                                </label>
                                <div className="relative w-full">
                                    <Key size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                                    <input
                                        type="text"
                                        id="unique_key"
                                        name="unique_key"
                                        value={currentMaster.unique_key || currentMaster.key}
                                        onChange={(e) => handleInputChange({ target: { name: 'unique_key', value: e.target.value } })}
                                        autoComplete="off"
                                        onFocus={() => setShowDropdown(true)}
                                        ref={keyInputRef}
                                        className={`w-full h-8 pl-8 pr-9 border ${errors.key ? 'border-red-400' : 'border-gray-300'} rounded-md text-xs focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400 bg-white text-gray-800 placeholder-gray-500 transition-colors`}
                                        disabled={!canEditMasters || isFixedKey || !!currentMaster.master_id}
                                        placeholder="Enter or select master key"
                                        title={
                                            !canEditMasters ? editPermissionDeniedMessage
                                                : currentMaster.master_id ? "Key cannot be changed when editing"
                                                    : "Enter a unique key or select from the list"
                                        }
                                    />
                                    {!!(currentMaster.unique_key || currentMaster.key) && !currentMaster.master_id && (
                                        <button type="button" className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" onClick={handleClearKey} disabled={!canEditMasters}>
                                            <X size={11} />
                                        </button>
                                    )}
                                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setShowDropdown(!showDropdown)} disabled={!canEditMasters || !!currentMaster.master_id}>
                                        <ChevronDown size={13} />
                                    </button>
                                    {showDropdown && !currentMaster.master_id && (
                                        <ul ref={dropdownRef} className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-44 overflow-y-auto">
                                            {filteredKeys.length > 0 ? filteredKeys.map(key => (
                                                <li key={key} onClick={() => handleKeySelect(key)} className="px-3 py-1.5 cursor-pointer text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">{key}</li>
                                            )) : (
                                                <li className="px-3 py-2 text-xs text-gray-500 text-center">No fixed keys match or already registered</li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                                {errors.key && <p className="text-xs text-red-500 mt-0.5">{errors.key}</p>}
                            </div>

                            {/* ── [VENDOR] Module Selection ─────────────────────────────────────── */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                    Module
                                </label>
                                <div className="relative">
                                    <Layers size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none z-10" />
                                    {userRole === 'super_admin' && !selectedTenant && !currentMaster.master_id ? (
                                        // Super admin: no tenant selected yet — show disabled placeholder
                                        <div className="flex items-center w-full h-8 border border-gray-300 rounded-md pl-8 pr-2.5 bg-gray-100 cursor-not-allowed">
                                            <span className="text-xs text-gray-400">Select a tenant first</span>
                                        </div>
                                    ) : (
                                        <SearchableSelect
                                            options={getAvailableModules()}
                                            value={currentMaster.module_key || ''}
                                            onChange={(selectedOption) => {
                                                if (!canEditMasters) {
                                                    toast.error(editPermissionDeniedMessage);
                                                    return;
                                                }
                                                setCurrentMaster({ ...currentMaster, module_key: selectedOption || '' });
                                            }}
                                            placeholder="Select module"
                                            disabled={!canEditMasters || isTenantBlocked}
                                            className="!w-full !h-8 !pl-8 !pr-2 !border !border-gray-300 !rounded-md !text-xs !text-gray-800 focus:!border-indigo-400 focus:!ring-2 focus:!ring-indigo-400/20 focus:!outline-none disabled:!bg-gray-100 disabled:!text-gray-500 !bg-white !placeholder-gray-400 !transition-colors !shadow-none !py-0 flex flex-col justify-center"
                                            title={
                                                isTenantBlocked ? "Please select a tenant first"
                                                    : !canEditMasters ? editPermissionDeniedMessage
                                                        : "Select module for this master record"
                                            }
                                            allowClear={true}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* ── File Upload ── */}
                            <div className="flex flex-col gap-1" data-tour="master-file-upload">
                                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                    {currentMaster.master_id ? `Replace File` : `Upload File`} ({getFileTypeLabel()}) <span className="text-red-500 normal-case tracking-normal">*</span>
                                </label>
                                <div className="flex items-center w-full gap-2">
                                    <label htmlFor="file-input" className={`flex items-center justify-center h-8 flex-1 border rounded-md px-3 text-xs transition-colors ${isTenantBlocked ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed' : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 cursor-pointer'} ${errors.file ? 'border-red-400' : ''}`}
                                        onClick={(e) => { if (isTenantBlocked) { e.preventDefault(); toast.warn("Please select a tenant first."); } }}
                                    >
                                        {isTenantBlocked ? "Select a tenant first" : "Choose File"}
                                    </label>
                                    <input
                                        type="file"
                                        id="file-input"
                                        onChange={handleFileChange}
                                        accept={getFileAcceptAttribute()}
                                        disabled={!canEditMasters || isTenantBlocked}
                                        title={isTenantBlocked ? "Please select a tenant first" : !canEditMasters ? editPermissionDeniedMessage : `Upload or replace master file (${getFileTypeLabel()})`}
                                        className="hidden"
                                    />
                                </div>
                                <div className="text-xs mt-0.5">
                                    {currentMaster.file_path && !file && (
                                        <p className="text-gray-600 truncate">Current: {formatFileName(currentMaster.file_path)}</p>
                                    )}
                                    {file && <p className="text-green-600 truncate font-medium">Selected: {file.name}</p>}
                                    {errors.file && <p className="text-red-500">{errors.file}</p>}
                                </div>
                            </div>

                            {/* ── Description ── */}
                            <div className="flex flex-col gap-1" data-tour="master-description-field">
                                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Description</label>
                                <div className="relative">
                                    <AlignLeft size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                                    <input
                                        type="text"
                                        id="description"
                                        name="description"
                                        autoComplete="off"
                                        value={currentMaster.description}
                                        onChange={handleInputChange}
                                        placeholder={isTenantBlocked ? "Select a tenant first" : "Enter description (optional)"}
                                        disabled={!canEditMasters || isTenantBlocked}
                                        title={isTenantBlocked ? "Please select a tenant first" : !canEditMasters ? editPermissionDeniedMessage : "Enter description for the master"}
                                        className="w-full h-8 pl-8 pr-3 border border-gray-300 rounded-md text-xs focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400 bg-white text-gray-800 placeholder-gray-500 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* ── Metadata ── */}
                            <div className="flex flex-col gap-1" data-tour="master-metadata-field">
                                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Metadata</label>
                                <div className="relative">
                                    <Layers size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                                    <input
                                        type="text"
                                        id="metadata"
                                        name="metadata"
                                        autoComplete="off"
                                        value={currentMaster.metadata || ''}
                                        onChange={handleInputChange}
                                        placeholder={isTenantBlocked ? "Select a tenant first" : "Enter metadata (optional)"}
                                        disabled={!canEditMasters || isTenantBlocked}
                                        title={isTenantBlocked ? "Please select a tenant first" : !canEditMasters ? editPermissionDeniedMessage : "Enter metadata for the master"}
                                        className="w-full h-8 pl-8 pr-3 border border-gray-300 rounded-md text-xs focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400 bg-white text-gray-800 placeholder-gray-500 transition-colors"
                                    />
                                </div>
                            </div>

                        </div>

                        {/* ── Actions ── */}
                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                            <Button
                                type="submit"
                                color="indigo" variant="solid" size="xs"
                                disabled={!canEditMasters || isTenantBlocked}
                                title={isTenantBlocked ? "Please select a tenant first" : !canEditMasters ? editPermissionDeniedMessage : currentMaster.master_id ? "Update the master record" : "Upload a new master file"}
                                data-tour="upload-master-button"
                            >
                                {currentMaster.master_id ? 'Update' : 'Upload'}
                            </Button>
                            {currentMaster.master_id && (
                                <Button
                                    type="button"
                                    color="gray" variant="outline" size="xs"
                                    onClick={() => {
                                        handleCancelEdit();
                                        if (userRole === 'super_admin') setSelectedTenantId('');
                                    }}
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Masters List Header and Filter Toggle */}
                <div className="flex items-center justify-between mt-4 mb-2">
                    <span className="text-sm font-semibold text-gray-800">Masters List ({totalCount} items)</span>
                    <div className="flex items-center gap-2">
                        {areFiltersActive() && (
                            <Button
                                color="red"
                                variant="solid"
                                size="xs"
                                icon={X}
                                onClick={clearAllFilters}
                                title="Clear all filters"
                            >
                                Clear Filters
                            </Button>
                        )}
                        <Button
                            color="indigo"
                            variant="solid"
                            size="xs"
                            onClick={() => fetchMasters()}
                            title="Refresh masters"
                            disabled={filtering}
                        >
                            <RefreshCw size={13} className={filtering ? 'animate-spin' : ''} />
                            {filtering ? 'Refreshing...' : 'Refresh'}
                        </Button>
                        <Button
                            color="indigo"
                            variant="solid"
                            size="xs"
                            icon={Filter}
                            onClick={() => { setDraftFilters({ key: filters.key }); setShowAdvancedFilter(true); }}
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
                    onChange={(key, value) => setDraftFilters({ ...draftFilters, [key]: value })}
                    onApply={() => {
                        const trimmedKey = draftFilters.key && draftFilters.key.trim();
                        setFilters({ key: trimmedKey || '' });
                        setColumnFilters(prev => ({
                            ...prev,
                            unique_key: trimmedKey || '',
                        }));
                        setPage(1);
                        setShowAdvancedFilter(false);
                    }}
                    onClearAll={(newValues) => {
                        setDraftFilters(newValues);
                        clearAllFilters();
                    }}
                    onClearDefaults={(newValues) => {
                        setDraftFilters(newValues);
                        setFilters({ key: '' });
                        setColumnFilters(prev => ({
                            ...prev,
                            unique_key: '',
                        }));
                        setPage(1);
                        setShowAdvancedFilter(false);
                    }}
                />

                {/* Table Component for Masters List */}
                <TableComponent
                    data={masters}
                    columns={columnsWithActions}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortField={sortField}
                    setSortField={setSortField}
                    sortAsc={sortAsc}
                    setSortAsc={setSortAsc}
                    page={page}
                    setPage={setPage}
                    emptyMessage={loadingMasters ? "Loading masters..." : "No masters found."}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    totalCount={totalCount}
                    filtering={loadingMasters}
                    data-tour="masters-table"
                />

                {/* Document Viewer Modal */}
                <ViewDocumentModal
                    isOpen={modalOpen}
                    onRequestClose={() => setModalOpen(false)}
                    fileUrl={docUrl}
                    fileName={docFileName}
                />

                {/* Confirmation Modal for Delete */}
                {showConfirmDeleteModal && masterToDelete && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-sm" onClick={cancelDelete}>
                        <div className="bg-white p-4 rounded-md shadow-sm w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between pb-1.5 mb-3 border-b border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Info size={14} className="text-red-500" />Confirm Deletion</h3>
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    icon={X}
                                    onClick={cancelDelete}
                                    className="bg-transparent border-0 cursor-pointer text-gray-500 hover:text-gray-700 transition-colors"
                                />
                            </div>
                            <p className="text-xs text-gray-700 mb-3">Are you sure you want to delete the master with Key: <span className="font-semibold">{masterToDelete.unique_key}</span>? This action cannot be undone.</p>
                            <div className="flex justify-end gap-2 mt-3">
                                <Button color="gray" variant="outline" size="xs" onClick={cancelDelete}>Cancel</Button>
                                <Button color="red" variant="solid" size="xs" onClick={confirmDelete}>Delete</Button>
                            </div>
                        </div>
                    </div>
                )}

                <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} />
            </div>
        </div>
    );
};

export default Masters;
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
    Search, Filter, X, Edit, Trash2, Info, Loader2, Key, AlignLeft, Layers, Plus, Save, RefreshCw, ChevronDown, ChevronUp, Trash, SquareArrowOutUpRight
} from 'lucide-react';
import { useSelector } from 'react-redux';
import TableComponent from '../common/TableComponent';
import MetadataPopup from '../common/MetadataPopup';
import { canUserEdit, canUserDelete } from '../../permissions';

import { apiBaseUrl } from '../../config/apiConfig';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';

const DefaultConfig = () => {
    const [configs, setConfigs] = useState([]);
    const [newConfig, setNewConfig] = useState({
        config_type: 'parameter',
        unique_key: '',
        default_value: '',
        description: '',
        metadata: ''
    });
    const [editingConfig, setEditingConfig] = useState(null);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10); // Added for pagination
    const [totalCount, setTotalCount] = useState(0); // Added for pagination
    const [sortField, setSortField] = useState('unique_key');
    const [sortAsc, setSortAsc] = useState(true);
    const [columnFilters, setColumnFilters] = useState({
        config_type: '',
        unique_key: '',
        default_value: '',
        description: '',
        metadata: ''
    });
    const prevColumnFilters = useRef(columnFilters);
    const [filters, setFilters] = useState({
        config_type: '',
        unique_key: ''
    });
    const [loadingConfigs, setLoadingConfigs] = useState(true);
    const [filtering, setFiltering] = useState(false); // Added for partial loading during filtering
    const [savingConfig, setSavingConfig] = useState(false);

    // State for custom confirmation modal
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [configToDelete, setConfigToDelete] = useState(null);

    // State for metadata popup
    const [showMetadataPopup, setShowMetadataPopup] = useState(false);
    const [showMetadataViewer, setShowMetadataViewer] = useState(false);
    const [currentMetadataItem, setCurrentMetadataItem] = useState(null);

    // State for collapsible dropdown
    const [showKeyDropdown, setShowKeyDropdown] = useState(false);

    // State for file type enforcement
    const [fileType, setFileType] = useState('');

    // Refs for dropdown
    const keyInputRef = useRef(null);
    const keyDropdownRef = useRef(null);

    // Get user from Redux store
    const user = useSelector(state => state.auth.user);
    const userId = user?.user_id;
    const userRole = user?.role;
    const token = user?.token;

    // Permissions for Default Config
    const canEditConfigs = canUserEdit(userRole, 'default_config');
    const canDeleteConfigs = canUserDelete(userRole, 'default_config');

    const editPermissionMessage = "You do not have permission to edit default configurations.";
    const deletePermissionMessage = "You do not have permission to delete default configurations.";

    // Handle clicks outside the dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                keyInputRef.current &&
                !keyInputRef.current.contains(event.target) &&
                keyDropdownRef.current &&
                !keyDropdownRef.current.contains(event.target)
            ) {
                setShowKeyDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);



    const fetchConfigs = useCallback(async () => {
        if (!user || !token) {
            setLoadingConfigs(false);
            return;
        }

        // Only super admin can access this page
        if (userRole !== 'super_admin') {
            toast.error("Access denied. Only super admins can manage default configurations.");
            setLoadingConfigs(false);
            return;
        }

        // Only show full page loading spinner on initial load
        if (loadingConfigs) {
            setLoadingConfigs(true);
        }
        // Always show filtering indicator for filter operations
        setFiltering(true);

        // Calculate offset
        const offset = (page - 1) * pageSize;

        try {
            let fetchUrl = `/api/v1/tables/ap_default_configs?limit=${pageSize}&offset=${offset}`;

            // Add column filters
            Object.entries(columnFilters).forEach(([key, value]) => {
                if (value) {
                    const filterValue = encodeURIComponent(value);
                    switch (key) {
                        case 'config_type':
                            fetchUrl += `&config_type=ilike.*${filterValue}*`;
                            break;
                        case 'unique_key':
                            fetchUrl += `&unique_key=ilike.*${filterValue}*`;
                            break;
                        case 'default_value':
                            fetchUrl += `&default_value=ilike.*${filterValue}*`;
                            break;
                        case 'description':
                            fetchUrl += `&description=ilike.*${filterValue}*`;
                            break;
                        case 'metadata':
                            fetchUrl += `&metadata=ilike.*${filterValue}*`;
                            break;
                    }
                }
            });

            // Add advanced filters
            if (filters.config_type) fetchUrl += `&config_type=ilike.*${encodeURIComponent(filters.config_type)}*`;
            if (filters.unique_key) fetchUrl += `&unique_key=ilike.*${encodeURIComponent(filters.unique_key)}*`;

            // Add sorting
            const effectiveSortField = sortField || 'unique_key';
            const effectiveSortAsc = sortAsc;

            let dbSortFieldMapped = effectiveSortField;
            if (effectiveSortField === 'config_type') dbSortFieldMapped = 'config_type';
            else if (effectiveSortField === 'unique_key') dbSortFieldMapped = 'unique_key';
            else if (effectiveSortField === 'default_value') dbSortFieldMapped = 'default_value';
            else if (effectiveSortField === 'description') dbSortFieldMapped = 'description';
            else if (effectiveSortField === 'metadata') dbSortFieldMapped = 'metadata';

            let orderQuery = `${dbSortFieldMapped}.${effectiveSortAsc ? 'asc' : 'desc'}.nullslast`;

            // Add secondary sort by config_id to break ties
            if (effectiveSortField !== 'config_id') {
                orderQuery += `,config_id.desc`;
            }

            fetchUrl += `&order=${orderQuery}`;

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
                const match = contentRange.match(/\/(\d+)/);
                if (match && match[1]) {
                    total = parseInt(match[1], 10);
                }
            }
            setTotalCount(total);

            setConfigs(response.data);
        } catch (error) {
            // Requirement #4: Don't display toast errors for filter operations
            // toast.error("Failed to fetch default configurations.");
            setTotalCount(0); // Reset count on error
        } finally {
            setLoadingConfigs(false);
            setFiltering(false);
        }
    }, [user, userRole, token, page, pageSize, columnFilters, filters]);

    // Ref to track if initial fetch has been completed to prevent duplicate calls
    const initialFetchCompletedRef = useRef(false);

    // Consolidated useEffect - single trigger for all data fetch scenarios
    useEffect(() => {
        if (!user || !token) {
            return;
        }

        // Only allow fetch if it's not the initial load or if initial load has been completed
        if (!initialFetchCompletedRef.current) {
            initialFetchCompletedRef.current = true;
        }

        fetchConfigs();
    }, [fetchConfigs, user, token, page, pageSize, columnFilters, filters]);

    const handleInputChange = (e) => {
        if (!canEditConfigs) {
            toast.error(editPermissionMessage);
            return;
        }
        const { name, value } = e.target;
        if (editingConfig) {
            setEditingConfig({ ...editingConfig, [name]: value });
        } else {
            setNewConfig({ ...newConfig, [name]: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!canEditConfigs) {
            toast.error(editPermissionMessage);
            return;
        }

        if (!token) {
            toast.error("Authentication information not found. Please log in again.");
            return;
        }

        const configToSave = editingConfig || newConfig;
        if (!configToSave.unique_key) {
            toast.warn("Key is a required field.");
            return;
        }

        // Check for duplicate keys when creating new config
        if (!editingConfig && configs.some(c => c.unique_key === configToSave.unique_key)) {
            toast.error("This key already exists. Please use a unique key.");
            return;
        }

        // Validate and normalize metadata
        let normalizedMetadata = '';
        if (configToSave.metadata) {
            try {
                // If it's already a string, check if it's valid JSON
                if (typeof configToSave.metadata === 'string') {
                    if (configToSave.metadata.trim() === '') {
                        normalizedMetadata = '';
                    } else {
                        // Try to parse as JSON, if it fails, treat as plain text
                        try {
                            const parsed = JSON.parse(configToSave.metadata);
                            normalizedMetadata = JSON.stringify(parsed);
                        } catch (e) {
                            // If not valid JSON, treat as plain text
                            normalizedMetadata = configToSave.metadata;
                        }
                    }
                } else {
                    // If it's already an object, stringify it
                    normalizedMetadata = JSON.stringify(configToSave.metadata);
                }
            } catch (e) {
                // If any other error occurs, treat as plain text
                normalizedMetadata = typeof configToSave.metadata === 'string' ? configToSave.metadata : JSON.stringify(configToSave.metadata);
            }
        }

        setSavingConfig(true);

        try {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            if (editingConfig) {
                // Update existing config
                const patchUrl = `/api/v1/tables/ap_default_configs?config_id=eq.${configToSave.config_id}`;
                const patchPayload = {
                    config_type: configToSave.config_type,
                    unique_key: configToSave.unique_key,
                    default_value: configToSave.default_value,
                    description: configToSave.description,
                    metadata: normalizedMetadata,
                    updated_by: userId,
                    updated_at: getCurrentTimeISOString()
                };

                await axios.patch(patchUrl, patchPayload, config);
                toast.success("Default configuration updated successfully!");
                setEditingConfig(null);
            } else {
                // Create new config
                const postPayload = {
                    config_type: configToSave.config_type,
                    unique_key: configToSave.unique_key,
                    default_value: configToSave.default_value,
                    description: configToSave.description,
                    metadata: normalizedMetadata,
                    created_by: userId,
                    created_at: getCurrentTimeISOString(),
                    updated_by: userId,
                    updated_at: getCurrentTimeISOString()
                };

                await axios.post(`/api/v1/tables/ap_default_configs`, [postPayload], config);
                toast.success("Default configuration added successfully!");
            }

            // Reset form
            setNewConfig({
                config_type: 'parameter',
                unique_key: '',
                default_value: '',
                description: '',
                metadata: ''
            });
            setFileType(''); // Reset file type
            fetchConfigs();
        } catch (error) {
            toast.error("Failed to save default configuration.");
            // Error saving config
        } finally {
            setSavingConfig(false);
        }
    };

    const handleEdit = (config) => {
        if (!canEditConfigs) {
            toast.warn(editPermissionMessage);
            return;
        }
        setEditingConfig({
            ...config,
            metadata: config.metadata?.value || config.metadata || ''
        });

        // Extract file_type from metadata if it's a master config
        if (config.config_type === 'master') {
            try {
                const metadataObj = JSON.parse(config.metadata?.value || config.metadata || ''); // Changed from '{}' to ''
                setFileType(metadataObj.file_type || '');
            } catch (e) {
                setFileType('');
            }
        } else {
            setFileType('');
        }

        setNewConfig({
            config_type: 'parameter',
            unique_key: '',
            default_value: '',
            description: '',
            metadata: ''
        });
    };

    // Handle metadata save from popup
    const handleMetadataSave = (metadataText) => {
        // When saving metadata from popup, we need to merge it with existing file_type if any
        const config = editingConfig || newConfig;
        let existingMetadataObj = {};

        // Parse existing metadata to preserve file_type
        try {
            const existingMetadataStr = config.metadata?.value || config.metadata || '';
            if (existingMetadataStr && existingMetadataStr.trim() !== '') {
                existingMetadataObj = JSON.parse(existingMetadataStr);
            }
        } catch (e) {
            // Failed to parse existing metadata
        }

        let newMetadataObj = {};

        // Parse the new metadata text
        if (metadataText && metadataText.trim() !== '') {
            try {
                // Try to parse as JSON
                newMetadataObj = JSON.parse(metadataText);
            } catch (e) {
                // If not valid JSON, treat as plain text
                newMetadataObj = { value: metadataText };
            }
        }

        // Merge file_type from existing metadata with new metadata
        if (existingMetadataObj.file_type) {
            newMetadataObj.file_type = existingMetadataObj.file_type;
        }

        // Create the final metadata string
        const finalMetadata = Object.keys(newMetadataObj).length > 0 ? JSON.stringify(newMetadataObj) : '';

        if (editingConfig) {
            setEditingConfig({ ...editingConfig, metadata: finalMetadata });
        } else {
            setNewConfig({ ...newConfig, metadata: finalMetadata });
        }
    };

    // Handle file type change for master configurations
    const handleFileTypeChange = (type) => {
        // Ensure type is a string
        const fileTypeValue = type || '';
        setFileType(fileTypeValue);

        // Update metadata with file_type when type is selected
        const config = editingConfig || newConfig;
        let metadataObj = {};

        // Parse existing metadata, preserving user-entered metadata
        try {
            const metadataStr = config.metadata?.value || config.metadata || ''; // Changed from '{}' to ''
            if (metadataStr && metadataStr.trim() !== '') {
                metadataObj = JSON.parse(metadataStr);
            }
        } catch (e) {
            // Failed to parse metadata
        }

        // Update file_type in metadata
        if (fileTypeValue) {
            metadataObj.file_type = fileTypeValue;
        } else {
            delete metadataObj.file_type;
        }

        // Update the config with new metadata
        const updatedMetadata = metadataObj && Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : ''; // Changed to use empty string for empty objects
        if (editingConfig) {
            setEditingConfig({ ...editingConfig, metadata: updatedMetadata });
        } else {
            setNewConfig({ ...newConfig, metadata: updatedMetadata });
        }
    };

    // Handle metadata save for existing items in the table
    const handleItemMetadataSave = async (metadataText) => {
        if (!currentMetadataItem || !canEditConfigs || !token) {
            return;
        }

        // When saving metadata from popup, we need to merge it with existing file_type if any
        let existingMetadataObj = {};

        // Parse current item's metadata to preserve file_type
        try {
            const existingMetadataStr = currentMetadataItem.metadata?.value || currentMetadataItem.metadata || '';
            if (existingMetadataStr && existingMetadataStr.trim() !== '') {
                existingMetadataObj = JSON.parse(existingMetadataStr);
            }
        } catch (e) {
            // Failed to parse existing metadata
        }

        let newMetadataObj = {};

        // Parse the new metadata text
        if (metadataText && metadataText.trim() !== '') {
            try {
                // Try to parse as JSON
                newMetadataObj = JSON.parse(metadataText);
            } catch (e) {
                // If not valid JSON, treat as plain text
                newMetadataObj = { value: metadataText };
            }
        }

        // Merge file_type from existing metadata with new metadata
        if (existingMetadataObj.file_type) {
            newMetadataObj.file_type = existingMetadataObj.file_type;
        }

        // Create the final metadata string
        const finalMetadata = Object.keys(newMetadataObj).length > 0 ? JSON.stringify(newMetadataObj) : '';

        setSavingConfig(true);

        try {
            const patchUrl = `/api/v1/tables/ap_default_configs?config_id=eq.${currentMetadataItem.config_id}`;
            const patchPayload = {
                metadata: finalMetadata,
                updated_by: userId,
                updated_at: getCurrentTimeISOString()
            };

            await axios.patch(patchUrl, patchPayload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            toast.success("Metadata updated successfully!");
            setShowMetadataPopup(false);
            setCurrentMetadataItem(null);
            fetchConfigs();
        } catch (error) {
            toast.error("Failed to update metadata.");
            // Error updating metadata
        } finally {
            setSavingConfig(false);
        }
    };



    const handleDeleteClick = (config) => {
        if (!canDeleteConfigs) {
            toast.error(deletePermissionMessage);
            return;
        }
        setConfigToDelete(config);
        setShowConfirmModal(true);
    };

    const confirmDelete = async () => {
        if (!configToDelete) return;

        if (!canDeleteConfigs) {
            toast.error(deletePermissionMessage);
            setShowConfirmModal(false);
            return;
        }

        if (!token) {
            toast.error("Authentication information not found. Please log in again.");
            return;
        }

        try {
            const endpoint = `/api/v1/tables/ap_default_configs?config_id=eq.${configToDelete.config_id}`;
            await axios.delete(endpoint, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            toast.success("Default configuration deleted successfully!");
            fetchConfigs();
        } catch (error) {
            toast.error("Failed to delete default configuration.");
            // Error deleting config
        } finally {
            setShowConfirmModal(false);
            setConfigToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowConfirmModal(false);
        setConfigToDelete(null);
    };

    const clearAllFilters = () => {
        setFilters({ config_type: '', unique_key: '' });
        setColumnFilters({ config_type: '', unique_key: '', default_value: '', description: '', metadata: '' });
        setPage(1); // Reset page
        // The consolidated useEffect will automatically trigger fetchConfigs() when filter states change
    };

    // Function to check if any filters are applied
    const areFiltersApplied = () => {
        // Check advanced filters
        const hasAdvancedFilters = filters.config_type !== '' || filters.unique_key !== '';

        // Check column filters
        const hasColumnFilters = Object.values(columnFilters).some(filter => filter !== '');

        return hasAdvancedFilters || hasColumnFilters;
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

    const columns = useMemo(() => [
        {
            key: 'config_type',
            header: 'Type',
            sortable: true,
            filterable: true,
            filterType: 'select',
            width: '120px',
            filterOptions: () => [
                { value: 'parameter', label: 'Parameter' },
                { value: 'master', label: 'Master' }
            ],
            render: (item) => (
                <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${item.config_type === 'parameter'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800'
                    }`}>
                    {item.config_type ? item.config_type.charAt(0).toUpperCase() + item.config_type.slice(1) : ''}
                </span>
            )
        },
        { key: 'unique_key', header: 'Key', sortable: true, filterable: true, width: '200px' },
        { key: 'default_value', header: 'Default Value', sortable: true, filterable: true, width: '200px' },
        { key: 'description', header: 'Description', sortable: true, filterable: true, width: '250px' },
        {
            key: 'metadata',
            header: 'Metadata',
            sortable: false,
            filterable: false,
            width: '150px',
            disableTooltip: true,
            render: (item) => {
                // Count the number of key-value pairs in the metadata
                const getCount = () => {
                    // Extract the actual metadata string from nested structure
                    let metadataStr = item.metadata;
                    if (item.metadata && typeof item.metadata === 'object' && item.metadata.value) {
                        metadataStr = item.metadata.value;
                    }

                    // Handle null, undefined, or empty cases
                    if (!metadataStr || metadataStr === 'null' || metadataStr === 'undefined') {
                        return 0;
                    }

                    // Handle empty object case
                    if (metadataStr === '{}') {
                        return 0;
                    }

                    try {
                        const parsed = JSON.parse(metadataStr);
                        // Check if it's a valid object with key-value pairs
                        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                            return Object.keys(parsed).length;
                        }
                        return 0;
                    } catch (e) {
                        // If parsing fails, it might be a string that isn't valid JSON
                        // In this case, we consider it as having no valid metadata entries
                        return 0;
                    }
                };

                const count = getCount();

                return (
                    <div className="flex items-center gap-1" data-tour="table-metadata-field">
                        <button
                            type="button"
                            onClick={() => {
                                // Set the current item for metadata viewing
                                setCurrentMetadataItem(item);
                                setShowMetadataViewer(true);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                            title={count > 0 ? `View ${count} metadata entries` : "No metadata entries"}
                            data-tour="view-metadata-button"
                        >
                            <AlignLeft size={12} />
                            <span>{count === 0 ? 'None' : `${count} ${count === 1 ? 'entry' : 'entries'}`}</span>
                            <SquareArrowOutUpRight size={12} className="ml-auto" />
                        </button>
                    </div>
                );
            }
        },
        {
            key: 'updated_at',
            header: 'Updated On',
            sortable: true,
            filterable: false,
            render: (item) => formatDate(item.updated_at),
            width: '180px'
        },
        {
            key: 'actions',
            header: 'Actions',
            width: '120px',
            render: (item) => (
                <div className="flex gap-2">
                    <button
                        className="p-1 rounded hover:bg-gray-100 text-indigo-600 transition-colors"
                        onClick={() => handleEdit(item)}
                        disabled={!canEditConfigs}
                        title={!canEditConfigs ? editPermissionMessage : "Edit Configuration"}
                        data-tour="edit-config-button"
                    >
                        <Edit size={14} />
                    </button>
                    <button
                        className="p-1 rounded hover:bg-gray-100 text-red-600 transition-colors"
                        onClick={() => handleDeleteClick(item)}
                        disabled={!canDeleteConfigs}
                        title={!canDeleteConfigs ? deletePermissionMessage : "Delete Configuration"}
                        data-tour="delete-config-button"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )
        }
    ], [handleEdit, handleDeleteClick, canEditConfigs, canDeleteConfigs, editPermissionMessage, deletePermissionMessage]);

    const filteredAndSortedConfigs = useMemo(() => {
        let filtered = [...configs]; // Use the already filtered data from API

        // Only apply client-side filtering when there are actual filter values
        const hasActiveColumnFilters = Object.values(columnFilters).some(filter => filter && filter.trim() !== '');

        if (hasActiveColumnFilters) {
            filtered = filtered.filter(c => {
                const columnFilterMatch = (
                    (columnFilters.config_type && columnFilters.config_type.trim() ? c.config_type?.toLowerCase().includes(columnFilters.config_type.toLowerCase()) : true) &&
                    (columnFilters.unique_key && columnFilters.unique_key.trim() ? c.unique_key?.toLowerCase().includes(columnFilters.unique_key.toLowerCase()) : true) &&
                    (columnFilters.default_value && columnFilters.default_value.trim() ? c.default_value?.toLowerCase().includes(columnFilters.default_value.toLowerCase()) : true) &&
                    (columnFilters.description && columnFilters.description.trim() ? c.description?.toLowerCase().includes(columnFilters.description.toLowerCase()) : true) &&
                    (columnFilters.metadata && columnFilters.metadata.trim() ?
                        (() => {
                            try {
                                const metadataObj = JSON.parse(c.metadata || '{}');
                                return Object.values(metadataObj).some(val =>
                                    String(val).toLowerCase().includes(columnFilters.metadata.toLowerCase())
                                );
                            } catch (e) {
                                return false;
                            }
                        })()
                        : true)
                );

                return columnFilterMatch;
            });
        }

        if (sortField) {
            filtered.sort((a, b) => {
                const aValue = a[sortField];
                const bValue = b[sortField];

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
    }, [configs, columnFilters, sortField, sortAsc]);

    // Handle initial loading state where user is not yet in Redux store
    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-800 text-lg">
                    Loading user data...
                </div>
            </div>
        );
    }

    // Check if user is super admin
    if (userRole !== 'super_admin') {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 border border-gray-200 rounded-md bg-white shadow-sm mt-4">
                <Info size={32} className="text-red-500 mb-3" />
                <h2 className="text-sm font-semibold mb-1 text-gray-800">Access Denied</h2>
                <p className="text-xs text-gray-600">Only super administrators can access this page.</p>
            </div>
        );
    }

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchConfigs();
        } finally {
            // Small delay to ensure the spinning animation is visible
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    return (
        <div className="font-[Poppins] p-3 rounded-lg mx-auto flex flex-col">
            <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />

            <h2 className="text-sm font-semibold text-gray-800 mb-2" data-tour="default-config-header">Default Configuration</h2>

            <div className="bg-white rounded-md p-4 shadow-sm border border-gray-100">
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                        {/* Type Field with Dropdown */}
                        <div className="flex flex-col">
                            <label htmlFor="config_type" className="mb-0.5 text-xs font-medium text-gray-700">Type</label>
                            <div className="relative flex items-center">
                                <Layers size={18} className="absolute left-3 text-gray-500 pointer-events-none" />
                                <select
                                    id="config_type"
                                    name="config_type"
                                    value={editingConfig ? editingConfig.config_type : newConfig.config_type}
                                    onChange={handleInputChange}
                                    disabled={!canEditConfigs}
                                    title={
                                        !canEditConfigs
                                            ? editPermissionMessage
                                            : "Select configuration type"
                                    }
                                    className="w-full h-8 px-3 pl-8 py-1.5 border border-gray-300 rounded-md text-xs transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 appearance-none bg-white text-gray-800"
                                    data-tour="config-type-select"
                                >
                                    <option value="parameter" className="text-gray-800">Parameter</option>
                                    <option value="master" className="text-gray-800">Master</option>
                                </select>
                                <button
                                    type="button"
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-700 transition-transform duration-200"
                                    onClick={() => setShowKeyDropdown(!showKeyDropdown)}
                                    disabled={!canEditConfigs}
                                    title="Toggle type dropdown"
                                    data-tour="config-type-dropdown-toggle"
                                    data-testid="config-type-dropdown-toggle"
                                >
                                    {showKeyDropdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>

                                {/* Dropdown content - showing available types */}
                                {showKeyDropdown && (
                                    <div
                                        ref={keyDropdownRef}
                                        className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-sm max-h-40 overflow-y-auto"
                                        data-tour="config-type-dropdown"
                                        data-testid="config-type-dropdown"
                                    >
                                        <button
                                            type="button"
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors text-gray-800"
                                            onClick={() => {
                                                handleInputChange({ target: { name: 'config_type', value: 'parameter' } });
                                                setShowKeyDropdown(false);
                                            }}
                                        >
                                            Parameter
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors text-gray-800"
                                            onClick={() => {
                                                handleInputChange({ target: { name: 'config_type', value: 'master' } });
                                                setShowKeyDropdown(false);
                                            }}
                                        >
                                            Master
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Key Field without Dropdown */}
                        <div className="flex flex-col">
                            <label htmlFor="unique_key" className="mb-0.5 text-xs font-medium text-gray-700">Key</label>
                            <div className="relative flex items-center">
                                <Key size={18} className="absolute left-3 text-gray-500 pointer-events-none" />
                                <input
                                    type="text"
                                    id="unique_key"
                                    name="unique_key"
                                    placeholder="Enter unique key"
                                    value={editingConfig ? editingConfig.unique_key : newConfig.unique_key}
                                    onChange={handleInputChange}
                                    required
                                    disabled={!canEditConfigs}
                                    title={
                                        !canEditConfigs
                                            ? editPermissionMessage
                                            : "Enter a unique key for the configuration"
                                    }
                                    className="w-full h-8 px-3 pl-8 py-1.5 border border-gray-300 rounded-md text-xs transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 bg-white text-gray-800"
                                    data-tour="config-key-input"
                                    data-testid="config-key-input"
                                />
                            </div>
                        </div>

                        {/* Default Value Field */}
                        <div className="flex flex-col">
                            <label htmlFor="default_value" className="mb-0.5 text-xs font-medium text-gray-700">Default Value</label>
                            <div className="relative flex items-center">
                                <AlignLeft size={18} className="absolute left-3 text-gray-500 pointer-events-none" />
                                <input
                                    type="text"
                                    id="default_value"
                                    name="default_value"
                                    placeholder="Enter default value"
                                    value={editingConfig ? editingConfig.default_value : newConfig.default_value}
                                    onChange={handleInputChange}
                                    disabled={!canEditConfigs}
                                    title={
                                        !canEditConfigs
                                            ? editPermissionMessage
                                            : "Enter a default value for the configuration"
                                    }
                                    className="w-full h-8 px-3 pl-8 py-1.5 border border-gray-300 rounded-md text-xs transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 bg-white text-gray-800"
                                    data-tour="config-default-value-input"
                                />
                            </div>
                        </div>

                        {/* Description Field */}
                        <div className="flex flex-col">
                            <label htmlFor="description" className="mb-0.5 text-xs font-medium text-gray-700">Description</label>
                            <div className="relative flex items-center">
                                <AlignLeft size={18} className="absolute left-3 text-gray-500 pointer-events-none" />
                                <input
                                    type="text"
                                    id="description"
                                    name="description"
                                    placeholder="Enter description"
                                    value={editingConfig ? editingConfig.description : newConfig.description}
                                    onChange={handleInputChange}
                                    disabled={!canEditConfigs}
                                    title={
                                        !canEditConfigs
                                            ? editPermissionMessage
                                            : "Enter a description for the configuration"
                                    }
                                    className="w-full h-8 px-3 pl-8 py-1.5 border border-gray-300 rounded-md text-xs transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 bg-white text-gray-800"
                                    data-tour="config-description-input"
                                />
                            </div>
                        </div>

                        {/* Metadata Field */}
                        <div className="flex flex-col" data-tour="config-metadata-field">
                            <label htmlFor="metadata" className="mb-0.5 text-xs font-medium text-gray-700">Metadata</label>
                            <div
                                className="flex items-center justify-between relative px-3 py-1.5 border border-gray-300 rounded-md bg-white cursor-pointer w-full h-8 transition-shadow hover:shadow-md hover:shadow-blue-500/20"
                                onClick={() => {
                                    if (canEditConfigs) {
                                        setShowMetadataPopup(true);
                                    } else {
                                        setShowMetadataViewer(true);
                                    }
                                }}
                                title={!canEditConfigs ? editPermissionMessage : 'Click to edit metadata'}
                            >
                                <span className="flex-grow overflow-hidden whitespace-nowrap text-ellipsis pr-6 text-xs text-gray-500">
                                    {(() => {
                                        const meta = editingConfig ? editingConfig.metadata : newConfig.metadata;
                                        if (!meta || meta === '{}' || meta === '') return 'Add metadata...';
                                        try {
                                            const parsed = JSON.parse(meta);
                                            const count = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 1;
                                            return `${count} ${count === 1 ? 'entry' : 'entries'}`;
                                        } catch { return 'View / Edit'; }
                                    })()}
                                </span>
                                <SquareArrowOutUpRight size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500/80" />
                            </div>
                            {/* Hidden input to maintain form state */}
                            <input
                                type="hidden"
                                name="metadata"
                                value={editingConfig ? editingConfig.metadata : newConfig.metadata}
                            />
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-start gap-2 mt-4">
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-normal transition-all duration-300 text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                            disabled={!canEditConfigs || savingConfig}
                            title={
                                !canEditConfigs
                                    ? editPermissionMessage
                                    : editingConfig
                                        ? "Update the configuration"
                                        : "Add a new configuration"
                            }
                            data-tour="add-config-button"
                        >
                            {savingConfig ? (
                                <>
                                    <Loader2 className="animate-spin" size={12} />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    {editingConfig ? <Save size={12} /> : <Plus size={12} />}
                                    {editingConfig ? "Update" : "Add"}
                                </>
                            )}
                        </button>

                        {editingConfig && (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-normal transition-all duration-300 text-white bg-gray-500 hover:bg-gray-600 shadow-sm"
                                onClick={() => setEditingConfig(null)}
                                title="Cancel editing and clear form"
                                data-tour="cancel-edit-button"
                            >
                                <X size={12} />
                                Cancel
                            </button>
                        )}

                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-normal transition-all duration-300 text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                            onClick={handleRefresh}
                            title="Refresh configurations"
                            data-tour="refresh-config-button"
                            disabled={isRefreshing}
                        >
                            {isRefreshing ? (
                                <RefreshCw size={12} className="animate-spin" />
                            ) : (
                                <RefreshCw size={12} />
                            )}
                            {isRefreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="mt-4 pb-2 border-b border-gray-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-800">Default Configurations ({totalCount} items)</span>
                <div className="flex gap-2 items-center">
                    {areFiltersApplied() && (
                        <button
                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs font-normal rounded shadow-sm hover:bg-red-700 transition-colors"
                            onClick={clearAllFilters}
                            title="Clear all filters"
                            data-tour="clear-filters-button"
                        >
                            <X size={12} /> Clear Filters
                        </button>
                    )}
                    {/* <button
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md transition-all duration-300 hover:bg-indigo-700"
                            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                            title="Toggle Advanced Filters"
                            data-tour="advanced-filter-button"
                        >
                            <Filter size={14} className="mr-1" /> Advanced Filter
                        </button> */}
                </div>
            </div>

            {showAdvancedFilter && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100 z-[1010] w-[95%] max-w-xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="flex justify-between items-center pb-1.5 mb-3 border-b border-gray-200 flex-shrink-0">
                            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Filter size={14} /> Advanced Filters</h3>
                            <button className="bg-transparent border-0 cursor-pointer text-gray-500 hover:text-gray-700 transition-colors" onClick={() => setShowAdvancedFilter(false)} title="Close Filters">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 flex-grow overflow-y-auto pr-1">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-700">Type</label>
                                <select
                                    value={filters.config_type}
                                    onChange={e => setFilters({ ...filters, config_type: e.target.value })}
                                    title="Filter by type"
                                    className="w-full px-3 py-1.5 text-xs rounded-md border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 bg-white text-gray-800"
                                    data-tour="filter-type-select"
                                >
                                    <option value="" className="text-gray-800">All Types</option>
                                    <option value="parameter" className="text-gray-800">Parameter</option>
                                    <option value="master" className="text-gray-800">Master</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-700">Key</label>
                                <input
                                    type="text"
                                    value={filters.unique_key}
                                    onChange={e => setFilters({ ...filters, unique_key: e.target.value })}
                                    title="Filter by key"
                                    className="w-full px-3 py-1.5 text-xs rounded-md border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 bg-white text-gray-800 placeholder-gray-400"
                                    data-tour="filter-key-input"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-shrink-0">
                            <button
                                className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-normal rounded-md shadow-sm hover:bg-gray-100 transition-colors"
                                onClick={clearAllFilters}
                                title="Clear all applied filters"
                                data-tour="clear-filters-button"
                            >
                                Clear All Filters
                            </button>
                            <button
                                className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-normal rounded-md shadow-sm hover:bg-indigo-700 transition-colors"
                                onClick={() => {
                                    setShowAdvancedFilter(false);
                                    setPage(1); // Reset page on apply
                                    fetchConfigs(); // Explicitly fetch with new filters
                                }}
                                title="Apply selected filters"
                                data-tour="apply-filters-button"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loadingConfigs && !filtering ? ( // Show full loading message only during initial load, not during filtering
                <div className="flex flex-col items-center justify-center h-[160px] text-gray-500 mt-4">
                    <Loader2 className="animate-spin" size={24} />
                    <p className="text-xs mt-2">Loading configurations...</p>
                </div>
            ) : (
                <TableComponent
                    data={filteredAndSortedConfigs}
                    columns={columns}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortField={sortField}
                    setSortField={setSortField}
                    sortAsc={sortAsc}
                    setSortAsc={setSortAsc}
                    page={page}
                    setPage={setPage}
                    emptyMessage="No default configurations found."
                    data-tour="default-config-table"
                    // Pass pagination props
                    totalCount={totalCount}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    // Pass filtering state for visual feedback
                    filtering={filtering}
                />
            )}

            {showConfirmModal && configToDelete && (
                <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100 w-full max-w-lg">
                        <div className="flex items-center justify-between pb-1.5 mb-3 border-b border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Info size={14} className="text-red-500" /> Confirm Deletion</h3>
                        </div>
                        <p className="mb-3 text-xs text-gray-700">Are you sure you want to delete the default configuration with Key: <span className="font-semibold">{configToDelete.unique_key}</span>? This action cannot be undone.</p>
                        <div className="flex justify-end gap-2 mt-3">
                            <button
                                className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-normal rounded-md shadow-sm hover:bg-gray-100 transition-colors"
                                onClick={cancelDelete}
                                data-tour="cancel-delete-button"
                            >
                                Cancel
                            </button>
                            <button
                                className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-xs font-normal rounded-md shadow-sm hover:bg-red-700 transition-colors"
                                onClick={confirmDelete}
                                data-tour="confirm-delete-button"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Metadata Popup (for editing existing items or new/edited items) */}
            {showMetadataPopup && (
                <MetadataPopup
                    isOpen={true}
                    onClose={() => {
                        setShowMetadataPopup(false);
                        setCurrentMetadataItem(null);
                        setFileType(''); // Reset file type when closing
                    }}
                    onSave={currentMetadataItem ? handleItemMetadataSave : handleMetadataSave}
                    metadata={currentMetadataItem ? (currentMetadataItem.metadata?.value || currentMetadataItem.metadata || '{}') : (editingConfig ? (editingConfig.metadata?.value || editingConfig.metadata || '{}') : (newConfig.metadata?.value || newConfig.metadata || '{}'))}
                    isEditable={true}
                    title={currentMetadataItem ? `Edit Metadata for ${currentMetadataItem.unique_key}` : "Metadata Editor"}
                    configType={editingConfig ? editingConfig.config_type : newConfig.config_type}
                    fileType={fileType || ''}  // Ensure we pass a default value
                    onFileTypeChange={handleFileTypeChange}
                />
            )}

            {/* Metadata Viewer Popup (for viewing existing items from table) */}
            {showMetadataViewer && (
                <MetadataPopup
                    isOpen={true}
                    onClose={() => {
                        setShowMetadataViewer(false);
                        setCurrentMetadataItem(null);
                    }}
                    metadata={currentMetadataItem ? (currentMetadataItem.metadata?.value || currentMetadataItem.metadata || '{}') : (editingConfig ? (editingConfig.metadata?.value || editingConfig.metadata || '{}') : (newConfig.metadata?.value || newConfig.metadata || '{}'))}
                    isEditable={false}
                    readOnlyTitle={currentMetadataItem ? `View Metadata for ${currentMetadataItem.unique_key}` : "Metadata Viewer"}
                />
            )}

            <ToastContainer />
        </div>
    );
};

export default DefaultConfig;
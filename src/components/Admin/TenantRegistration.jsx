import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Building, KeyRound, Plus, Edit, Power, Save, Loader2, X } from 'lucide-react';
import TableComponent from '../common/TableComponent';
import classNames from 'classnames';
import { canUserEdit } from '../../permissions';
import { useSelector } from 'react-redux';

import { apiBaseUrl } from '../../config/apiConfig';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Global styles for animations
const styles = `
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-scaleIn {
  animation: scaleIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

.animate-slideIn {
  animation: slideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
`;

const TenantRegistration = () => {
    // State for the form to add/edit a tenant
    const [formData, setFormData] = useState({
        tenantName: '',
    });

    // State for validation errors
    const [validationErrors, setValidationErrors] = useState({
        tenantName: ''
    });

    // State for loading indicators
    const [loading, setLoading] = useState(false);

    // State to control the visibility of the "Add Tenant" modal
    const [showAddTenantModal, setShowAddTenantModal] = useState(false);

    // State to store the list of tenants fetched from the backend
    const [channels, setChannels] = useState([]);

    // State to track if we are editing an existing channel (stores tenant_id)
    const [editingChannelId, setEditingChannelId] = useState(null);



    // Added for pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // TableComponent states
    const [sortField, setSortField] = useState('tenant_id');
    const [sortAsc, setSortAsc] = useState(false);
    const [columnFilters, setColumnFilters] = useState({ tenant_name: '', tenant_id: '', created_at: '' });

    // Get user from Redux store using useSelector
    const user = useSelector(state => state.auth.user);
    const userRole = user?.role;
    const token = useSelector(state => state.auth.token);

    // Permissions for Channel Registration
    const canEditTenantRegistration = canUserEdit(userRole, 'tenant_registration');
    const editPermissionDeniedMessage = "You do not have permission to manage Channel Registration.";

    // Fetch channels from the backend with pagination.
    // Uses exactly 2 API calls regardless of page size (down from the original N+1):
    //   Call 1: GET ap_tenants (paginated)
    const fetchChannels = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const offset = (page - 1) * pageSize;

            let tenantsUrl = `/api/v1/tables/ap_tenants?limit=${pageSize}&offset=${offset}`;

            // Add sorting
            const effectiveSortField = sortField || 'tenant_id';
            let dbSortFieldMapped = effectiveSortField;
            if (effectiveSortField === 'is_active') dbSortFieldMapped = 'tenant_id';

            tenantsUrl += `&order=${dbSortFieldMapped}.${sortAsc ? 'asc' : 'desc'}.nullslast`;

            // Add column filters — all handled server-side so every page is correctly filtered
            if (columnFilters.tenant_id) {
                tenantsUrl += `&tenant_id=eq.${encodeURIComponent(columnFilters.tenant_id)}`;
            }
            if (columnFilters.tenant_name) {
                tenantsUrl += `&tenant_name=ilike.*${encodeURIComponent(columnFilters.tenant_name)}*`;
            }
            if (columnFilters.created_at) {
                // Match the full day range for the selected date (yyyy-mm-dd)
                const dateValue = columnFilters.created_at;
                const nextDay = new Date(new Date(dateValue).getTime() + 86400000)
                    .toISOString().split('T')[0];
                tenantsUrl += `&created_at=gte.${dateValue}T00:00:00.000&created_at=lt.${nextDay}T00:00:00.000`;
            }



            // Call 1: paginated tenant list (all filters now baked into the URL)
            const { data: tenantData, headers } = await axios.get(tenantsUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Prefer': 'count=exact'
                }
            });

            // Parse total count from Content-Range header
            const contentRange = headers['content-range'];
            let total = 0;
            if (contentRange) {
                const match = contentRange.match(/\/(\d+)/);
                if (match && match[1]) total = parseInt(match[1], 10);
            }
            setTotalCount(total);

            setChannels(tenantData || []);
        } catch (error) {
            setTotalCount(0);
            setChannels([]);
        } finally {
            setLoading(false);
        }
    }, [token, page, pageSize, sortField, sortAsc, columnFilters]);

    // Effect hook to fetch channels on component mount
    useEffect(() => {
        if (token) {
            fetchChannels();
        }
    }, [fetchChannels, token]);

    // Reset to page 1 whenever filters change so the offset stays valid
    useEffect(() => {
        setPage(1);
    }, [columnFilters]);

    // Validation function for alphabetic characters and spaces only
    const validateAlphabetic = (value) => {
        const regex = /^[a-zA-Z\s]*$/;
        return regex.test(value);
    };

    // Validation function to check if string contains only spaces (and is not empty)
    const validateOnlySpaces = (value) => {
        // Check if the string contains only whitespace characters but is not empty
        return /^\s+$/.test(value);
    };

    // Validation function to check if string starts with spaces
    const validateLeadingSpaces = (value) => {
        // Check if the string starts with one or more whitespace characters
        return /^\s+/.test(value);
    };

    // Validation function to check if string has trailing spaces
    const validateTrailingSpaces = (value) => {
        // Check if the string ends with one or more whitespace characters
        return /\s+$/.test(value);
    };

    // Enhanced validation function that combines all checks
    const validateNameField = (value, fieldName) => {
        // Check maximum length
        if (value.length > 200) {
            return 'Maximum length exceeded (200 characters)';
        }

        // Check if string contains only spaces
        if (validateOnlySpaces(value)) {
            return 'Input cannot contain only spaces';
        }

        // Check if string starts with spaces
        if (validateLeadingSpaces(value)) {
            return 'Input cannot start with spaces';
        }

        // // Check if string ends with spaces
        // if (validateTrailingSpaces(value)) {
        //     return 'Input cannot end with spaces';
        // }

        // Validate input - only allow letters and spaces
        if (!validateAlphabetic(value)) {
            return 'Only letters and spaces are allowed';
        }

        return null; // Valid input
    };

    /*
    Test cases for validation:
    - "" (empty string) - Valid (handled by required attribute in HTML)
    - "OnlyLetters" - Valid
    - "Multiple Words" - Valid
    - "Mixed Letters and Spaces" - Valid
    - "   " (3 spaces) - Invalid (only spaces)
    - "                    " (20 spaces) - Invalid (only spaces)
    - "   LeadingSpaces" - Invalid (starts with spaces)
    - "TrailingSpaces   " - Invalid (ends with spaces)
    - "  Mixed  Spaces  " - Invalid (starts/ends with spaces)
    - "Special@Char" - Invalid (special character)
    - "ExactlyTwentyCharacters" - Valid (20 chars)
    - "OverTwentyCharactersLong" - Invalid (over 20 chars)
    */



    // Handle input changes for the form fields with validation
    const handleChange = (e) => {
        if (!canEditTenantRegistration) {
            toast.error(editPermissionDeniedMessage);
            return;
        }

        const { name, value, type, checked } = e.target;

        // Apply validation based on field name
        if (name === 'tenantName') {
            const error = validateNameField(value, name);
            if (error) {
                setValidationErrors(prev => ({
                    ...prev,
                    [name]: error
                }));
                return; // Don't update form data if invalid
            } else {
                // Clear error if valid
                setValidationErrors(prev => ({
                    ...prev,
                    [name]: ''
                }));
            }
        }

        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Function to check if all fields are valid
    const isFormValid = () => {
        // Check required fields that apply to both new and edit modes
        if (!formData.tenantName.trim()) {
            return false;
        }

        // Validate tenant name
        if (validateNameField(formData.tenantName)) {
            return false;
        }

        // Check if there are any validation errors
        const hasValidationErrors = Object.values(validationErrors).some(error => error !== '' && error !== undefined);
        if (hasValidationErrors) {
            return false;
        }

        return true;
    };

    // Reset form data and close modal
    const resetFormAndCloseModal = () => {
        setFormData({
            tenantName: '',
        });
        setValidationErrors({
            tenantName: ''
        });
        setEditingChannelId(null);
        setShowAddTenantModal(false);
    };

    // Function to register default parameters for a channel
    const registerDefaultParameters = async (channelId) => {
        try {
            // Fetch default parameters from the ap_default_configs table
            const { data: defaultParameters } = await axios.get(`/api/v1/tables/ap_default_configs?config_type=eq.parameter`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            // Create parameter records for each default parameter
            const parameterPromises = defaultParameters.map(async (param) => {
                const parameterPayload = {
                    unique_key: param.unique_key,
                    req_value: param.default_value || '',
                    description: param.description || '',
                    apedge_group: 'Default', // Default group for default parameters
                    tenant_id: channelId,
                    metadata: param.metadata || '', // Add metadata from default config
                    created_by: null, // System created
                    created_at: getCurrentTimeISOString()
                };

                return axios.post(`/api/v1/tables/ap_parameters`, parameterPayload, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
            });

            await Promise.all(parameterPromises);
        } catch (error) {
            // Error registering default parameters
            throw new Error("Failed to register default parameters");
        }
    };

    // Function to register default master keys for a channel
    const registerDefaultMasterKeys = async (channelId) => {
        try {
            // Fetch default master keys from the ap_default_configs table
            const { data: defaultMasters } = await axios.get(`/api/v1/tables/ap_default_configs?config_type=eq.master`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            // Create master records for each default master key
            const masterPromises = defaultMasters.map(async (master) => {
                const masterPayload = {
                    unique_key: master.unique_key,
                    description: master.description || '',
                    file_path: master.default_value || '', // Default value for file path
                    tenant_id: channelId,
                    metadata: master.metadata || '', // Add metadata from default config
                    created_by: null, // System created
                    created_at: getCurrentTimeISOString()
                };

                return axios.post(`/api/v1/tables/ap_masters`, masterPayload, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
            });

            await Promise.all(masterPromises);
        } catch (error) {
            // Error registering default master keys
            throw new Error("Failed to register default master keys");
        }
    };

    // Handle the submission of the new channel registration or update form
    const handleSubmitChannelForm = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (!canEditTenantRegistration) {
            toast.error(editPermissionDeniedMessage);
            setLoading(false);
            return;
        }

        if (!token) {
            toast.error("Authentication information not found. Please log in again.");
            setLoading(false);
            return;
        }

        try {
            if (editingChannelId) {
                // --- Update Existing Channel using PATCH ---
                const now = getCurrentTimeISOString();
                const currentUserId = user?.user_id || null;

                // 1. Update channel in ap_tenants with audit fields
                await axios.patch(`/api/v1/tables/ap_tenants?tenant_id=eq.${editingChannelId}`, {
                    tenant_name: formData.tenantName,
                    updated_at: now,
                    updated_by: currentUserId,
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                toast.success('Channel updated successfully!');
            } else {
                // --- Register New Channel ---
                // Check if a channel with this name already exists before creating.
                const existingChannels = await axios.get(`/api/v1/tables/ap_tenants?tenant_name=eq.${formData.tenantName}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (existingChannels.data && existingChannels.data.length > 0) {
                    toast.error("A channel with this name already exists. Please use a different name.");
                    setLoading(false);
                    return;
                }

                // 1. Store the channel name in the tenants table
                let channelId;
                const now = getCurrentTimeISOString();
                const currentUserId = user?.user_id || null;

                const channelResponse = await axios.post(`/api/v1/tables/ap_tenants`, {
                    tenant_name: formData.tenantName,
                    created_at: now,
                    updated_at: now,
                    created_by: currentUserId,
                    updated_by: currentUserId,
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const newChannel = channelResponse.data;
                channelId = newChannel?.tenant_id || newChannel?.id;

                if (!channelId) {
                    // Fallback to fetching the newly created channel ID if the POST response doesn't return it
                    const getChannelRes = await axios.get(`/api/v1/tables/ap_tenants?tenant_name=${formData.tenantName}`, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    });
                    const getResponseData = getChannelRes.data;
                    if (Array.isArray(getResponseData) && getResponseData.length > 0) {
                        channelId = getResponseData[0]?.tenant_id || getResponseData[0]?.id;
                    } else if (typeof getResponseData === 'object' && getResponseData !== null) {
                        channelId = getResponseData?.tenant_id || getResponseData?.id;
                    }
                }

                if (!channelId) {
                    toast.error('Channel created, but no ID could be retrieved from the server. Please check backend responses.');
                    setLoading(false);
                    return;
                }

                // 2. Automatically register default parameters and master keys
                try {
                    await registerDefaultParameters(channelId);
                    await registerDefaultMasterKeys(channelId);
                } catch (error) {
                    toast.warn("Channel created but failed to register default configurations. Please configure manually.");
                }

                toast.success('Channel registered successfully!');
            }

            resetFormAndCloseModal();
            fetchChannels(); // Refresh the channel list
        } catch (error) {
            // Operation error
            let errorMessage = 'An unexpected error occurred during operation.';
            if (error.response && error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle edit button click
    const handleEditChannel = useCallback((channel) => {
        if (!canEditTenantRegistration) {
            toast.error(editPermissionDeniedMessage);
            return;
        }

        setFormData({
            tenantName: channel.tenant_name,
        });
        setEditingChannelId(channel.tenant_id);
        setShowAddTenantModal(true);
    }, [canEditTenantRegistration, editPermissionDeniedMessage]);

    // Columns definition for the TableComponent
    const channelTableColumns = useMemo(() => [
        { key: 'tenant_id', header: 'Channel ID', width: '100px', sortable: true, filterable: true, filterType: 'number' },
        { key: 'tenant_name', header: 'Channel Name', sortable: true, filterable: true },
        {
            key: 'created_at',
            header: 'Created Date',
            width: '150px',
            sortable: true,
            filterable: true,
            filterType: 'date',
            render: (item) => {
                if (!item.created_at) return '-';
                const date = new Date(item.created_at);
                if (isNaN(date.getTime())) return '-';
                const dateStr = date.toLocaleDateString('en-GB');
                const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                return <span className="text-xs">{dateStr}, {timeStr}</span>;
            }
        },
        {
            key: 'actions',
            header: 'Actions',
            width: '80px',
            render: (item) => (
                <div className="flex gap-1.5">
                    <button
                        className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleEditChannel(item)}
                        title={!canEditTenantRegistration ? editPermissionDeniedMessage : "Edit Channel"}
                        disabled={!canEditTenantRegistration}
                        data-tour="tenant-edit-action"
                    >
                        <Edit size={14} color="#4f46e5" />
                    </button>
                </div>
            )
        }
    ], [handleEditChannel, canEditTenantRegistration, editPermissionDeniedMessage]);

    // All filtering is now handled server-side in fetchChannels.
    // filteredChannels is kept as a simple alias so the JSX reference below is unchanged.
    const filteredChannels = channels;

    // Effect hook to manage body scroll when modal is open
    useEffect(() => {
        if (showAddTenantModal) {
            document.body.classList.add('overflow-hidden');
        } else {
            document.body.classList.remove('overflow-hidden');
        }
        // Cleanup function
        return () => {
            document.body.classList.remove('overflow-hidden');
        };
    }, [showAddTenantModal]);

    return (
        <div className="font-[Poppins] p-3 rounded-lg flex flex-col antialiased">
            <style>{styles}</style>

            <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2" data-tour="tenant-reg-page-header">
                <h1 className="text-sm font-semibold text-gray-800 mb-2 sm:mb-0" data-tour="tenant-reg-title">Channel Management</h1>
                <div className="flex items-center gap-2">
                    {Object.values(columnFilters).some(v => v !== '') && (
                        <button
                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs font-normal rounded shadow-sm hover:bg-red-700 transition-colors"
                            onClick={() => setColumnFilters({ tenant_name: '', tenant_id: '', created_at: '' })}
                            title="Clear all filters"
                            data-tour="tenant-registration-filter"
                        >
                            <X size={14} />
                            Clear Filters
                        </button>
                    )}
                    <button
                        className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs font-normal rounded shadow-sm hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        onClick={() => { setEditingChannelId(null); setShowAddTenantModal(true); }}
                        disabled={!canEditTenantRegistration}
                        title={!canEditTenantRegistration ? editPermissionDeniedMessage : "Register a new channel"}
                        data-tour="tenant-reg-add-btn"
                    >
                        <Plus size={10} /> Add Channel
                    </button>
                </div>
            </div>

            {/* Tenant List Table */}
            <div className="overflow-x-auto" data-tour="tenant-reg-table">
                <TableComponent
                    data={filteredChannels}
                    columns={channelTableColumns}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    sortField={sortField}
                    setSortField={setSortField}
                    sortAsc={sortAsc}
                    setSortAsc={setSortAsc}
                    page={page}
                    setPage={setPage}
                    emptyMessage="No channels registered yet."
                    loading={loading}
                    // Pass pagination props
                    totalCount={totalCount}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    // Tour props
                    data-tour="tenant-reg-table-element"
                    tableCardDataTour="tenant-reg-table-card"
                    tableSortDataTour="tenant-reg-col-sort"
                    tableFiltersDataTour="tenant-reg-col-filter"
                    tablePaginationDataTour="tenant-reg-table-pagination"
                    tableRowsPerPageDataTour="tenant-reg-rows-per-page"
                    tablePaginationInfoDataTour="tenant-reg-pagination-info"
                />
            </div>

            {/* Add/Edit Tenant Modal */}
            {showAddTenantModal && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <div className="relative w-full max-w-lg mx-auto rounded-md bg-white p-4 shadow-sm border border-gray-100 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-1.5 mb-3 border-b border-gray-200" data-tour="tenant-reg-header">
                            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                <KeyRound size={14} className="text-indigo-600" />
                                {editingChannelId ? 'Edit Channel' : 'Register New Channel'}
                            </h3>
                            <button
                                className="bg-transparent border-0 cursor-pointer text-gray-500 hover:text-gray-700 transition-colors"
                                onClick={() => resetFormAndCloseModal()}
                                title="Close form"
                                data-tour="tenant-reg-close"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitChannelForm} className="space-y-4" data-tour="tenant-reg-form">
                            {/* First Row: Tenant Name, Admin User Name */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                                <div className="md:col-span-12">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Channel Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="tenantName"
                                        name="tenantName"
                                        value={formData.tenantName}
                                        onChange={handleChange}
                                        placeholder="Enter channel name"
                                        maxLength={200}
                                        required
                                        disabled={!canEditTenantRegistration}
                                        title={!canEditTenantRegistration ? editPermissionDeniedMessage : `Enter the channel name (Max ${formData.tenantName.length}/200 characters)`}
                                        className={`w-full px-2.5 py-1.5 text-gray-700 border ${validationErrors.tenantName ? 'border-red-500' : 'border-gray-300'} rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                                        data-tour="tenant-name-field"
                                    />
                                    {validationErrors.tenantName && (
                                        <p className="mt-1 text-xs text-red-600">{validationErrors.tenantName}</p>
                                    )}
                                    <div className="text-xs text-gray-500 mt-1 text-right">
                                        {formData.tenantName.length}/200
                                    </div>
                                </div>
                            </div>

                            {/* Status Toggle (removed as is_active field is removed from tenant table) */}

                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-normal rounded-md shadow-sm hover:bg-gray-100 transition-colors"
                                    onClick={resetFormAndCloseModal}
                                    data-tour="tenant-reg-cancel"
                                >
                                    <X size={12} />
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-normal rounded-md shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={loading || !canEditTenantRegistration || !isFormValid()}
                                    title={!canEditTenantRegistration ? editPermissionDeniedMessage : (!isFormValid() ? "Please fill all required fields correctly" : (editingChannelId ? "Update channel details" : "Register new channel"))}
                                    data-tour="tenant-reg-submit"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={12} className="animate-spin" />
                                            {editingChannelId ? 'Updating...' : 'Registering...'}
                                        </>
                                    ) : (
                                        <>
                                            <Save size={12} />
                                            {editingChannelId ? 'Update Channel' : 'Register Channel'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenantRegistration;
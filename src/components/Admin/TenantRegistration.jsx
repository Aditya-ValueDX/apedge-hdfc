import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Building, Mail, Phone, Lock, User, KeyRound, XCircle, Plus, Info, Edit, Power, Eye, EyeOff, Save, Loader2, X } from 'lucide-react';
import TableComponent from '../common/TableComponent';
import classNames from 'classnames';
import { canUserEdit } from '../../permissions';
import CryptoJS from 'crypto-js';
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
        userName: '',
        email: '',
        contact: '',
        password: '',
        isActive: true,
    });

    // State for validation errors
    const [validationErrors, setValidationErrors] = useState({
        tenantName: '',
        userName: '',
        email: '',
        contact: '',
        password: '',
        duplicateEmail: ''
    });

    // State for loading indicators
    const [loading, setLoading] = useState(false);

    // State to control the visibility of the "Add Tenant" modal
    const [showAddTenantModal, setShowAddTenantModal] = useState(false);

    // State to store the list of tenants fetched from the backend
    const [tenants, setTenants] = useState([]);

    // State to track if we are editing an existing tenant (stores tenant_id)
    const [editingTenantId, setEditingTenantId] = useState(null);

    // State to track the admin user id for the tenant being edited
    const [editingUserId, setEditingUserId] = useState(null);
    
    // State to track the admin user data for the tenant being edited
    const [editingAccountUser, setEditingAccountUser] = useState(null);

    // State to toggle password visibility
    const [showPassword, setShowPassword] = useState(false);

    // Added for pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // TableComponent states
    const [sortField, setSortField] = useState('tenant_id');
    const [sortAsc, setSortAsc] = useState(true);
    const [columnFilters, setColumnFilters] = useState({ tenant_name: '', tenant_id: '', is_active: '', created_at: '' });

    // Get user from Redux store using useSelector
    const user = useSelector(state => state.auth.user);
    const userRole = user?.role;
    const token = useSelector(state => state.auth.token);

    // Permissions for Tenant Registration
    const canEditTenantRegistration = canUserEdit(userRole, 'tenant_registration');
    const editPermissionDeniedMessage = "You do not have permission to manage Tenant Registration.";

    // Fetch tenants from the backend with pagination.
    // Uses exactly 2 API calls regardless of page size (down from the original N+1):
    //   Call 1: GET ap_tenants (paginated)
    //   Call 2: GET ap_users WHERE user_role=tenant_admin AND tenant_id IN (current page ids)
    // Then merges them client-side by tenant_id.
    const fetchTenants = useCallback(async () => {
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

            // is_active lives on ap_users, not ap_tenants — pre-fetch matching tenant IDs first
            if (columnFilters.is_active !== '') {
                const { data: activeUsers } = await axios.get(
                    `/api/v1/tables/ap_users?user_role=eq.tenant_admin&is_active=eq.${columnFilters.is_active}&select=tenant_id`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (activeUsers.length === 0) {
                    setTenants([]);
                    setTotalCount(0);
                    return;
                }
                const filteredIds = activeUsers.map(u => u.tenant_id).join(',');
                tenantsUrl += `&tenant_id=in.(${filteredIds})`;
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

            if (tenantData.length === 0) {
                setTenants([]);
                return;
            }

            // Call 2: fetch all tenant_admin users for this page's tenants in one request
            const tenantIds = tenantData.map(t => t.tenant_id).join(',');
            const adminUsersUrl = `/api/v1/tables/ap_users?user_role=eq.tenant_admin&tenant_id=in.(${tenantIds})&select=id,tenant_id,is_active,user_name,email,contact`;

            const { data: adminUsers } = await axios.get(adminUsersUrl,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Build a tenant_id → admin user map for O(1) lookup
            const adminUserMap = {};
            adminUsers.forEach(u => { adminUserMap[u.tenant_id] = u; });

            // Merge: each tenant row gets is_active and cached _adminUser from the map
            const tenantsWithStatus = tenantData.map(tenant => {
                const adminUser = adminUserMap[tenant.tenant_id] || null;
                return {
                    ...tenant,
                    is_active: adminUser ? adminUser.is_active : false,
                    _adminUser: adminUser,
                };
            });

            setTenants(tenantsWithStatus);
        } catch (error) {
            setTotalCount(0);
            setTenants([]);
        } finally {
            setLoading(false);
        }
    }, [token, page, pageSize, sortField, sortAsc, columnFilters]);

    // Effect hook to fetch tenants on component mount
    useEffect(() => {
        if (token) {
            fetchTenants();
        }
    }, [fetchTenants, token]);

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

    // Validation function for email format
    const validateEmail = (value) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(value);
    };

    // Password validation function
    const validatePassword = (password) => {
        const validations = {
            minLength: password.length >= 8,
            hasUppercase: /[A-Z]/.test(password),
            hasLowercase: /[a-z]/.test(password),
            hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
            noSpaces: !/\s/.test(password)
        };
        
        const isValid = Object.values(validations).every(check => check);
        return { isValid, validations };
    };

    // Get password strength level
    const getPasswordStrength = (password) => {
        const { validations } = validatePassword(password);
        const passedChecks = Object.values(validations).filter(check => check).length;
        
        if (password.length === 0) return { level: 0, label: '', color: '' };
        if (passedChecks <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
        if (passedChecks === 3) return { level: 2, label: 'Medium', color: 'bg-yellow-500' };
        if (passedChecks === 4) return { level: 3, label: 'Strong', color: 'bg-green-500' };
        if (passedChecks === 5) return { level: 4, label: 'Very Strong', color: 'bg-green-600' };
        
        return { level: 0, label: '', color: '' };
    };

    // Handle input changes for the form fields with validation
    const handleChange = (e) => {
        if (!canEditTenantRegistration) {
            toast.error(editPermissionDeniedMessage);
            return;
        }

        const { name, value, type, checked } = e.target;

        // Apply validation based on field name
        if (name === 'tenantName' || name === 'userName') {
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
        } else if (name === 'email') {
            // Validate email format
            if (value && !validateEmail(value)) {
                setValidationErrors(prev => ({
                    ...prev,
                    [name]: 'Please enter a valid email address',
                    duplicateEmail: '' // Clear duplicate email error when user changes email
                }));
            } else {
                // Clear error if valid or empty
                setValidationErrors(prev => ({
                    ...prev,
                    [name]: '',
                    duplicateEmail: '' // Clear duplicate email error when user changes email
                }));
            }
        } else if (name === 'password') {
            // Validate password
            const { isValid, validations } = validatePassword(value);
            if (!isValid) {
                setValidationErrors(prev => ({
                    ...prev,
                    [name]: 'Password does not meet security requirements'
                }));
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
        if (!formData.tenantName.trim() || 
            !formData.userName.trim() || 
            !formData.email.trim() || 
            !formData.contact.trim()) {
            return false;
        }

        // Validate tenant name
        if (validateNameField(formData.tenantName)) {
            return false;
        }

        // Validate user name
        if (validateNameField(formData.userName)) {
            return false;
        }

        // Validate email format
        if (!validateEmail(formData.email)) {
            return false;
        }

        // Validate contact format (10 digits for Indian numbers)
        if (!/^[6-9]\d{9}$/.test(formData.contact)) {
            return false;
        }

        // For new tenant, validate password
        if (!editingTenantId && (!formData.password || !validatePassword(formData.password).isValid)) {
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
            userName: '',
            email: '',
            contact: '',
            password: '',
            isActive: true,
        });
        setValidationErrors({
            tenantName: '',
            userName: '',
            email: '',
            contact: '',
            duplicateEmail: ''
        });
        setEditingTenantId(null);
        setEditingUserId(null);
        setEditingAccountUser(null);
        setShowAddTenantModal(false);
    };

    // Function to register default parameters for a tenant
    const registerDefaultParameters = async (tenantId) => {
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
                    tenant_id: tenantId,
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

    // Function to register default master keys for a tenant
    const registerDefaultMasterKeys = async (tenantId) => {
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
                    tenant_id: tenantId,
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

    // Handle the submission of the new tenant registration or update form
    const handleSubmitTenantForm = async (e) => {
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
            if (editingTenantId) {
                // --- Update Existing Tenant using PATCH ---
                const now = getCurrentTimeISOString();
                const currentUserId = user?.user_id || null;

                // 1. Update tenant in ap_tenants with audit fields
                await axios.patch(`/api/v1/tables/ap_tenants?tenant_id=eq.${editingTenantId}`, {
                    tenant_name: formData.tenantName,
                    updated_at: now,
                    updated_by: currentUserId,
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // 2. Update the associated admin user using the id stored when edit was opened
                //    (no extra GET needed — editingUserId was set from the joined data in fetchTenants)
                if (editingUserId) {
                    // Check for duplicate email if email is being changed
                    if (formData.email !== editingAccountUser?.email) {
                        const existingUsers = await axios.get(`/api/v1/tables/ap_users?email=eq.${formData.email}`, {
                            headers: {
                                Authorization: `Bearer ${token}`
                            }
                        });
                        if (existingUsers.data && existingUsers.data.length > 0) {
                            setValidationErrors(prev => ({
                                ...prev,
                                duplicateEmail: 'A user with this email already exists. Please use a different email.'
                            }));
                            setLoading(false);
                            return;
                        }
                    }
                    
                    const userPayload = {
                        user_name: formData.userName,
                        email: formData.email, // Update email as well
                        contact: formData.contact,
                        is_active: formData.isActive,
                        updated_at: now,
                    };
                    if (formData.password) {
                        const { isValid: isPasswordValid } = validatePassword(formData.password);
                        if (!isPasswordValid) {
                            toast.error('Password does not meet security requirements. Please ensure your password has at least 8 characters, one uppercase, one lowercase, and one special character.');
                            setLoading(false);
                            return;
                        }
                        userPayload.user_password = CryptoJS.SHA256(formData.password).toString();
                    }
                    await axios.patch(`/api/v1/tables/ap_users?id=eq.${editingUserId}`, userPayload, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                } else {
                    // No admin user found for tenant ID
                }

                toast.success('Tenant and admin user updated successfully!');
            } else {
                // --- Register New Tenant ---
                // Check if a tenant with this name already exists before creating.
                const existingTenants = await axios.get(`/api/v1/tables/ap_tenants?tenant_name=eq.${formData.tenantName}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (existingTenants.data && existingTenants.data.length > 0) {
                    toast.error("A tenant with this name already exists. Please use a different name.");
                    setLoading(false);
                    return;
                }

                // Check if a user with this email already exists
                const existingUsers = await axios.get(`/api/v1/tables/ap_users?email=eq.${formData.email}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (existingUsers.data && existingUsers.data.length > 0) {
                    setValidationErrors(prev => ({
                        ...prev,
                        email: 'A user with this email already exists. Please use a different email.'
                    }));
                    setLoading(false);
                    return;
                }

                // 1. Store the tenant name in the tenants table
                let tenantId;
                const now = getCurrentTimeISOString();
                const currentUserId = user?.user_id || null;

                const tenantResponse = await axios.post(`/api/v1/tables/ap_tenants`, {
                    tenant_name: formData.tenantName,
                    created_at: now,
                    updated_at: now,
                    created_by: currentUserId,
                    updated_by: currentUserId,
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const newTenant = tenantResponse.data;
                tenantId = newTenant?.tenant_id || newTenant?.id;

                if (!tenantId) {
                    // Fallback to fetching the newly created tenant ID if the POST response doesn't return it
                    const getTenantRes = await axios.get(`/api/v1/tables/ap_tenants?tenant_name=${formData.tenantName}`, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    });
                    const getResponseData = getTenantRes.data;
                    if (Array.isArray(getResponseData) && getResponseData.length > 0) {
                        tenantId = getResponseData[0]?.tenant_id || getResponseData[0]?.id;
                    } else if (typeof getResponseData === 'object' && getResponseData !== null) {
                        tenantId = getResponseData?.tenant_id || getResponseData?.id;
                    }
                }

                if (!tenantId) {
                    toast.error('Tenant created, but no ID could be retrieved from the server. Please check backend responses.');
                    setLoading(false);
                    return;
                }

                // 2. Store the tenant user name in the users table
                // Validate password before submission
                const { isValid: isPasswordValid } = validatePassword(formData.password);
                if (!isPasswordValid) {
                    toast.error('Password does not meet security requirements. Please ensure your password has at least 8 characters, one uppercase, one lowercase, and one special character.');
                    setLoading(false);
                    return;
                }
                
                const userPayload = {
                    email: formData.email,
                    contact: formData.contact,
                    password: formData.password,
                    user_name: formData.userName,
                    user_role: 'tenant_admin',
                    tenant_id: tenantId,
                    is_active: formData.isActive,
                    created_at: now,
                    updated_at: now,
                    created_by: currentUserId,
                };

                await axios.post(`/api/api/signup`, userPayload, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                // 3. Automatically register default parameters and master keys
                try {
                    await registerDefaultParameters(tenantId);
                    await registerDefaultMasterKeys(tenantId);
                } catch (error) {
                    toast.warn("Tenant created but failed to register default configurations. Please configure manually.");
                }

                toast.success('Tenant and admin user registered successfully!');
            }

            resetFormAndCloseModal();
            fetchTenants(); // Refresh the tenant list
        } catch (error) {
            // Operation error
            let errorMessage = 'An unexpected error occurred during operation.';
            if (error.response && error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            // Check if it's a duplicate email error from database constraint
            if (errorMessage.includes('duplicate key value violates unique constraint') && errorMessage.includes('ap_users_email_key')) {
                setValidationErrors(prev => ({
                    ...prev,
                    duplicateEmail: 'A user with this email already exists. Please use a different email.',
                }));
            } else {
                toast.error(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle edit button click — uses the _adminUser cached in the tenant row
    // from the join done in fetchTenants; no extra API call needed.
    const handleEditTenant = useCallback((tenant) => {
        if (!canEditTenantRegistration) {
            toast.error(editPermissionDeniedMessage);
            return;
        }

        const adminUser = tenant._adminUser;
        if (adminUser) {
            setFormData({
                tenantName: tenant.tenant_name,
                userName: adminUser.user_name,
                email: adminUser.email,
                contact: adminUser.contact,
                password: '',
                isActive: adminUser.is_active,
            });
            setEditingTenantId(tenant.tenant_id);
            setEditingUserId(adminUser.id);
            setEditingAccountUser(adminUser); // Store the account user data for comparison
            setShowAddTenantModal(true);
        } else {
            toast.error("Admin user not found for this tenant.");
        }
    }, [canEditTenantRegistration, editPermissionDeniedMessage]);

    // Handle status change button click
    const handleChangeTenantStatus = async (tenant) => {
        if (!canEditTenantRegistration) {
            toast.error(editPermissionDeniedMessage);
            return;
        }
        setLoading(true);
        try {
            const newStatus = !tenant.is_active;
            const now = getCurrentTimeISOString();
            const currentUserId = user?.user_id || null;

            // Fetch all users for the given tenant
            const { data: usersToUpdate } = await axios.get(
                `/api/v1/tables/ap_users?tenant_id=eq.${tenant.tenant_id}&user_role=neq.super_admin`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update each user individually
            const updatePromises = usersToUpdate.map(u =>
                axios.patch(`/api/v1/tables/ap_users?id=eq.${u.id}`, {
                    is_active: newStatus,
                    updated_at: now,
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            );

            await Promise.all(updatePromises);

            // Optimistically update the local state for a smoother UI
            const updatedTenants = tenants.map(t =>
                t.tenant_id === tenant.tenant_id ? { ...t, is_active: newStatus } : t
            );
            setTenants(updatedTenants);

            toast.success(`Tenant and associated users set to ${newStatus ? 'Active' : 'Inactive'}!`);
        } catch (error) {
            // Error changing tenant status
            const originalStatus = !tenant.is_active;
            setTenants(tenants.map(t =>
                t.tenant_id === tenant.tenant_id ? { ...t, is_active: originalStatus } : t
            ));
            toast.error("Failed to update tenant status.");
        } finally {
            setLoading(false);
        }
    };

    // Columns definition for the TableComponent
    const tenantTableColumns = useMemo(() => [
        { key: 'tenant_id', header: 'Tenant ID', width: '100px', sortable: true, filterable: true, filterType: 'number' },
        { key: 'tenant_name', header: 'Tenant Name', sortable: true, filterable: true },
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
            key: 'is_active',
            header: 'Status',
            width: '100px',
            sortable: false,
            filterable: true,
            filterType: 'select',
            filterOptions: () => [
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
            ],
            render: (item) => (
                <span className={`px-1.5 py-0.5 text-[11px] font-medium rounded-lg uppercase ${item.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                </span>
            )
        },
        {
            key: 'actions',
            header: 'Actions',
            width: '80px',
            render: (item) => (
                <div className="flex gap-1.5">
                    <button
                        className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleEditTenant(item)}
                        title={!canEditTenantRegistration ? editPermissionDeniedMessage : "Edit Tenant"}
                        disabled={!canEditTenantRegistration}
                        data-tour="tenant-edit-action"
                    >
                        <Edit size={14} color="#4f46e5" />
                    </button>
                    <button
                        className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleChangeTenantStatus(item)}
                        title={!canEditTenantRegistration ? editPermissionDeniedMessage : `Set to ${item.is_active ? 'Inactive' : 'Active'}`}
                        disabled={!canEditTenantRegistration}
                        data-tour="tenant-status-action"
                    >
                        <Power size={14} color={item.is_active ? "#10b981" : "#ef4444"} />
                    </button>
                </div>
            )
        }
    ], [handleEditTenant, handleChangeTenantStatus, canEditTenantRegistration, editPermissionDeniedMessage]);

    // All filtering is now handled server-side in fetchTenants.
    // filteredTenants is kept as a simple alias so the JSX reference below is unchanged.
    const filteredTenants = tenants;

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

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2" data-tour="tenant-reg-page-header">
                    <h1 className="text-sm font-semibold text-gray-800 mb-2 sm:mb-0" data-tour="tenant-reg-title">Tenant Management</h1>
                    <div className="flex items-center gap-2">
                        {Object.values(columnFilters).some(v => v !== '') && (
                            <button
                                className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs font-normal rounded shadow-sm hover:bg-red-700 transition-colors"
                                onClick={() => setColumnFilters({ tenant_name: '', tenant_id: '', is_active: '', created_at: '' })}
                                title="Clear all filters"
                                data-tour="tenant-registration-filter"
                            >
                                <X size={14} />
                                Clear Filters
                            </button>
                        )}
                        <button
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs font-normal rounded shadow-sm hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            onClick={() => { setEditingTenantId(null); setShowAddTenantModal(true); }}
                            disabled={!canEditTenantRegistration}
                            title={!canEditTenantRegistration ? editPermissionDeniedMessage : "Register a new tenant"}
                            data-tour="tenant-reg-add-btn"
                        >
                            <Plus size={10} /> Add Tenant
                        </button>
                    </div>
                </div>

                {/* Tenant List Table */}
                <div className="overflow-x-auto" data-tour="tenant-reg-table">
                        <TableComponent
                            data={filteredTenants}
                            columns={tenantTableColumns}
                            columnFilters={columnFilters}
                            setColumnFilters={setColumnFilters}
                            sortField={sortField}
                            setSortField={setSortField}
                            sortAsc={sortAsc}
                            setSortAsc={setSortAsc}
                            page={page}
                            setPage={setPage}
                            emptyMessage="No tenants registered yet."
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
                                    {editingTenantId ? 'Edit Tenant' : 'Register New Tenant'}
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
                            <form onSubmit={handleSubmitTenantForm} className="space-y-4" data-tour="tenant-reg-form">
                                {/* First Row: Tenant Name, Admin User Name */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                                    <div className="md:col-span-6">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Tenant Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="tenantName"
                                            name="tenantName"
                                            value={formData.tenantName}
                                            onChange={handleChange}
                                            placeholder="Enter tenant name"
                                            maxLength={200}
                                            required
                                            disabled={!canEditTenantRegistration}
                                            title={!canEditTenantRegistration ? editPermissionDeniedMessage : `Enter the tenant name (Max ${formData.tenantName.length}/200 characters)`}
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
                                    
                                    <div className="md:col-span-6">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Admin User Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="userName"
                                            name="userName"
                                            value={formData.userName}
                                            onChange={handleChange}
                                            placeholder="Enter admin user name"
                                            maxLength={200}
                                            required
                                            disabled={!canEditTenantRegistration}
                                            title={!canEditTenantRegistration ? editPermissionDeniedMessage : `Enter the admin user name (Max ${formData.userName.length}/200 characters)`}
                                            className={`w-full px-2.5 py-1.5 text-gray-700 border ${validationErrors.userName ? 'border-red-500' : 'border-gray-300'} rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                                            data-tour="tenant-admin-field"
                                        />
                                        {validationErrors.userName && (
                                            <p className="mt-1 text-xs text-red-600">{validationErrors.userName}</p>
                                        )}
                                        <div className="text-xs text-gray-500 mt-1 text-right">
                                            {formData.userName.length}/200
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Second Row: Email, Contact */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                                    <div className="md:col-span-6">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="user@example.com"
                                            required
                                            disabled={!canEditTenantRegistration}
                                            title={!canEditTenantRegistration ? editPermissionDeniedMessage : "Enter the user email"}
                                            className={`w-full px-2.5 py-1.5 text-gray-700 border ${validationErrors.email || validationErrors.duplicateEmail ? 'border-red-500' : 'border-gray-300'} rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                                            data-tour="tenant-reg-email"
                                        />
                                        {validationErrors.duplicateEmail ? (
                                            <p className="mt-1 text-xs text-red-600">{validationErrors.duplicateEmail}</p>
                                        ) : validationErrors.email ? (
                                            <p className="mt-1 text-xs text-red-600">{validationErrors.email}</p>
                                        ) : (
                                            <p className="mt-1 text-transparent text-xs">&nbsp;</p>
                                        )}
                                    </div>
                                    
                                    <div className="md:col-span-6">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Contact <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            id="contact"
                                            name="contact"
                                            value={formData.contact}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                // Allow only numbers and limit to 10 digits
                                                if (/^\d{0,10}$/.test(value)) {
                                                    // Clear contact validation error when user types
                                                    setValidationErrors(prev => ({
                                                        ...prev,
                                                        contact: ''
                                                    }));
                                                    handleChange(e);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                // Validate Indian mobile format on blur
                                                if (value && !/^[6-9]\d{9}$/.test(value)) {
                                                    setValidationErrors(prev => ({
                                                        ...prev,
                                                        contact: 'Please enter a valid 10-digit Indian contact number'
                                                    }));
                                                } else {
                                                    setValidationErrors(prev => ({
                                                        ...prev,
                                                        contact: ''
                                                    }));
                                                }
                                            }}
                                            placeholder="10-digit phone number"
                                            required
                                            disabled={!canEditTenantRegistration}
                                            title={
                                                !canEditTenantRegistration
                                                    ? editPermissionDeniedMessage
                                                    : "Enter the user contact number"
                                            }
                                            className={`w-full px-2.5 py-1.5 text-gray-700 border ${validationErrors.contact ? 'border-red-500' : 'border-gray-300'} rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                                            data-tour="tenant-reg-contact"
                                        />
                                        {validationErrors.contact && (
                                            <p className="mt-1 text-xs text-red-600">{validationErrors.contact}</p>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Password Field (only shown when adding new tenant) */}
                                {!editingTenantId && (
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3" data-tour="tenant-reg-password-section">
                                        <div className="md:col-span-6">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Password <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    id="password"
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={handleChange}
                                                    placeholder="Enter password"
                                                    required
                                                    disabled={!canEditTenantRegistration}
                                                    title={!canEditTenantRegistration ? editPermissionDeniedMessage : "Enter password for the new tenant"}
                                                    className={`w-full px-2.5 py-1.5 text-gray-700 border ${validationErrors.password ? 'border-red-500' : 'border-gray-300'} rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 pr-8 disabled:bg-gray-100 disabled:cursor-not-allowed`}
                                                    data-tour="tenant-reg-password"
                                                />
                                                <button
                                                    type="button"
                                                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-500 hover:text-gray-700"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    tabIndex={-1}
                                                    data-tour="tenant-reg-password-toggle"
                                                >
                                                    {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                                                </button>
                                            </div>
                                            {validationErrors.password && (
                                                <p className="mt-1 text-xs text-red-600">{validationErrors.password}</p>
                                            )}
                                            {!validatePassword(formData.password).isValid && formData.password && (
                                                <div className="mt-1 text-xs text-red-500 space-y-0.5">
                                                    {!validatePassword(formData.password).validations.minLength && <p>• Minimum 8 characters required</p>}
                                                    {!validatePassword(formData.password).validations.hasUppercase && <p>• At least one uppercase letter required</p>}
                                                    {!validatePassword(formData.password).validations.hasLowercase && <p>• At least one lowercase letter required</p>}
                                                    {!validatePassword(formData.password).validations.hasSpecialChar && <p>• At least one special character required</p>}
                                                    {!validatePassword(formData.password).validations.noSpaces && <p>• No spaces allowed</p>}
                                                </div>
                                            )}
                                            
                                            {/* Compact Password Strength and Requirements */}
                                            <div className="mt-1 space-y-1">
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-xs text-gray-600">Strength:</span>
                                                    {formData.password && (
                                                        <span className="text-[10px] font-normal">
                                                            <span className={`${getPasswordStrength(formData.password).color} text-white px-2 py-0.5 rounded-full`}>
                                                                {getPasswordStrength(formData.password).label}
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-1">
                                                    <div 
                                                        className={`h-1 rounded-full ${getPasswordStrength(formData.password).color}`}
                                                        style={{ width: `${getPasswordStrength(formData.password).level * 25}%` }}
                                                    ></div>
                                                </div>
                                                {/* <div className="flex flex-wrap gap-2 text-[0.6rem]">
                                                    <span className={`${validatePassword(formData.password).validations.minLength ? 'text-green-600' : 'text-red-500'}`}>8+</span>
                                                    <span className={`${validatePassword(formData.password).validations.hasUppercase ? 'text-green-600' : 'text-red-500'}`}>A-Z</span>
                                                    <span className={`${validatePassword(formData.password).validations.hasLowercase ? 'text-green-600' : 'text-red-500'}`}>a-z</span>
                                                    <span className={`${validatePassword(formData.password).validations.hasSpecialChar ? 'text-green-600' : 'text-red-500'}`}>!@#</span>
                                                    <span className={`${validatePassword(formData.password).validations.noSpaces ? 'text-green-600' : 'text-red-500'}`}>No Space</span>
                                                </div> */}

                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Status Toggle (only shown when editing) */}
                                {editingTenantId && (
                                    <div className="flex justify-start mb-4">
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                name="isActive"
                                                onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${formData.isActive ? 'bg-indigo-600' : 'bg-gray-200'}`}
                                                disabled={!canEditTenantRegistration}
                                                data-tour="tenant-reg-status-toggle"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.isActive ? 'translate-x-4' : 'translate-x-0'}`}
                                                />
                                            </button>
                                            <label className="ml-2 block text-xs text-gray-700">Is Active</label>
                                        </div>
                                    </div>
                                )}

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
                                        title={!canEditTenantRegistration ? editPermissionDeniedMessage : (!isFormValid() ? "Please fill all required fields correctly" : (editingTenantId ? "Update tenant details" : "Register new tenant"))}
                                        data-tour="tenant-reg-submit"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 size={12} className="animate-spin" />
                                                {editingTenantId ? 'Updating...' : 'Registering...'}
                                            </>
                                        ) : (
                                            <>
                                                <Save size={12} />
                                                {editingTenantId ? 'Update Tenant' : 'Register Tenant'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                <ToastContainer />
        </div>
    );
};

export default TenantRegistration;
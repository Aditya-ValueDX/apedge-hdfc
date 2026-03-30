import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Mail, Phone, Lock, User, KeyRound, XCircle, Plus, Info, Edit, Power, ShieldCheck, ShieldOff, Upload, Download, AlertTriangle, Trash2, Eye, EyeOff } from 'lucide-react';
import { useSelector } from 'react-redux';
import TableComponent from '../common/TableComponent';
import classNames from 'classnames';
import { canUserEdit, canUserDelete } from '../../permissions'; // Assuming these are external utility functions
import * as XLSX from 'xlsx';
import { apiBaseUrl } from '../../config/apiConfig';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import { formatDateTime } from '../../utils/dateUtils';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Main component for managing users.
 * It provides features for viewing, adding, editing, and bulk-registering users.
 */
const UserTable = () => {
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
        return searchParams.get('sortField') || 'id';
    };

    const getInitialSortAsc = () => {
        const sortAscParam = searchParams.get('sortAsc');
        return sortAscParam ? sortAscParam === 'true' : false;
    };

    const getInitialColumnFilters = () => {
        const filters = {};
        const id = searchParams.get('id');
        if (id) filters.id = id;

        const userName = searchParams.get('userName');
        if (userName) filters.user_name = userName;

        const contact = searchParams.get('contact');
        if (contact) filters.contact = contact;

        const email = searchParams.get('email');
        if (email) filters.email = email;

        const userRole = searchParams.get('userRole');
        if (userRole) filters.user_role = userRole;

        const tenantName = searchParams.get('tenantName');
        if (tenantName) filters.tenant_name = tenantName;

        const isActive = searchParams.get('isActive');
        if (isActive) filters.is_active = isActive;

        return filters;
    };

    // --- State Variables ---
    const [showAddEditModal, setShowAddEditModal] = useState(false);
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
    const [showBulkRegistrationSummary, setShowBulkRegistrationSummary] = useState(false);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [accountUserToDelete, setAccountUserToDelete] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [editingAccountUser, setEditingAccountUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [phoneError, setPhoneError] = useState('');

    const [accountUsers, setAccountUsers] = useState([]);
    const [loadingAccountUsers, setLoadingAccountUsers] = useState(true);
    const [errorAccountUsers, setErrorAccountUsers] = useState(null);
    const [totalCount, setTotalCount] = useState(0); // Added for pagination
    const [filtering, setFiltering] = useState(false); // Added for partial loading during filtering

    const [uploadedUsers, setUploadedUsers] = useState([]);
    const [validUsers, setValidUsers] = useState([]);
    const [invalidUsers, setInvalidUsers] = useState([]);
    const [bulkUploadLoading, setBulkUploadLoading] = useState(false);
    const [bulkUploadErrors, setBulkUploadErrors] = useState(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [bulkRegistrationSummary, setBulkRegistrationSummary] = useState({
        registeredCount: 0,
        updatedCount: 0,
        skippedList: [],
        errorsList: [],
    });

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: '',
        isActive: true,
    });
    const [errors, setErrors] = useState({
        email: '',
        phone: '',
        name: '',
        password: '',
        duplicateEmail: '',
        generalError: ''
    });

    // State for table filtering and sorting
    const [page, setPage] = useState(() => getInitialPage());
    const [pageSize, setPageSize] = useState(() => getInitialPageSize()); // Added for pagination
    const [sortField, setSortField] = useState(() => getInitialSortField());
    const [sortAsc, setSortAsc] = useState(() => getInitialSortAsc());
    const [columnFilters, setColumnFilters] = useState({
        id: '',
        user_name: '',
        contact: '',
        email: '',
        user_role: '',
        tenant_name: '',
        is_active: '',
        ...getInitialColumnFilters()
    });

    // Add debounced column filters state
    const [debouncedColumnFilters, setDebouncedColumnFilters] = useState(columnFilters);

    // Check if any column filters are active
    const hasActiveFilters = useMemo(() => {
        return Object.values(columnFilters).some(value => value !== '' && value !== null && value !== undefined);
    }, [columnFilters]);

    // Ref for the file input element in the bulk upload modal
    const fileInputRef = useRef(null);

    // Drag and drop state
    const [dragActive, setDragActive] = useState(false);

    // Retrieve user and tenant information from the Redux store
    const user = useSelector(state => state.auth.user);
    const tenantId = user?.tenantId;
    const userRole = user?.role;
    const token = user?.token;
    const userId = user?.id;

    // Memoized list of available roles for the current user's context
    const AVAILABLE_ROLES = useMemo(() => {
        if (userRole === 'super_admin') {
            return ['account_user', 'account_manager', 'tenant_admin'];
        } else if (userRole === 'tenant_admin') {
            return ['account_user', 'account_manager'];
        } else if (userRole === 'account_manager') {
            return ['account_user'];
        }
    }, [userRole]);

    const isSuperAdmin = userRole === 'super_admin';
    const canEditUsers = canUserEdit(userRole, 'all_users');
    const canDeleteUsers = canUserDelete(userRole, 'all_users');
    const editPermissionDeniedMessage = "You do not have permission to manage users.";
    const deletePermissionDeniedMessage = "You do not have permission to delete users.";



    // --- Effects & Callbacks ---

    // This function is now defined inside fetchAccountUsers to avoid dependency issues

    // Fetch account users with optimized API call using server-side joins
    const fetchAccountUsers = useCallback(async () => {
        if (!user || !token) {
            setErrorAccountUsers('User or token not found in Redux store. Please log in.');
            setLoadingAccountUsers(false);
            return;
        }

        // Only show full page loading spinner on initial load
        if (loadingAccountUsers) {
            setLoadingAccountUsers(true);
        }
        // Always show filtering indicator for filter operations
        setFiltering(true);
        setErrorAccountUsers(null);

        // ── Pre-resolve tenant_name filter to tenant_id list ──────────────────
        // PostgREST embedded-table filter (&ap_tenants.tenant_name=ilike.*...*)
        // only restricts which embedded rows are returned — it does NOT filter
        // the parent ap_users rows.  The correct approach (same as FinalQueue) is
        // to look up matching tenant_ids first and then filter by tenant_id=in.()
        let tenantIdFilter = null; // null = no filter; [] = filter active but no matches
        if (debouncedColumnFilters.tenant_name && debouncedColumnFilters.tenant_name.trim()) {
            try {
                const tRes = await axios.get(
                    `/api/v1/tables/ap_tenants?select=tenant_id&tenant_name=ilike.*${encodeURIComponent(debouncedColumnFilters.tenant_name.trim())}*`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                tenantIdFilter = tRes.data.map(t => t.tenant_id);
            } catch (_) {
                tenantIdFilter = [];
            }
        }

        // Short-circuit: filter is active but matched no tenants → return empty immediately
        if (tenantIdFilter !== null && tenantIdFilter.length === 0) {
            setAccountUsers([]);
            setTotalCount(0);
            setLoadingAccountUsers(false);
            setFiltering(false);
            return;
        }
        // ─────────────────────────────────────────────────────────────────────

        // Calculate offset
        const offset = (page - 1) * pageSize;

        let fetchUrl;
        const rolesToFetch = AVAILABLE_ROLES.join(',');

        // Use server-side join to get tenant names in single API call
        if (isSuperAdmin) {
            fetchUrl = `/api/v1/tables/ap_users?user_role=in.(${rolesToFetch})&select=*,is_active,ap_tenants(tenant_name)&limit=${pageSize}&offset=${offset}`;
        } else {
            fetchUrl = `/api/v1/tables/ap_users?tenant_id=eq.${tenantId}&user_role=in.(${rolesToFetch})&select=*,is_active,ap_tenants(tenant_name)&limit=${pageSize}&offset=${offset}`;
        }

        // Apply pre-resolved tenant_id list as a server-side filter
        if (tenantIdFilter !== null && tenantIdFilter.length > 0) {
            fetchUrl += `&tenant_id=in.(${tenantIdFilter.join(',')})`;
        }

        // Add column filters
        Object.entries(debouncedColumnFilters).forEach(([key, value]) => {
            if (value) {
                const filterValue = encodeURIComponent(value);
                switch (key) {
                    case 'id':
                        // For ID field, check if the value is numeric
                        if (/^\d+$/.test(value)) {
                            fetchUrl += `&id=eq.${value}`;
                        } else {
                            fetchUrl += `&id=like.*${filterValue}*`;
                        }
                        break;
                    case 'user_name':
                        fetchUrl += `&user_name=ilike.*${filterValue}*`;
                        break;
                    case 'contact':
                        fetchUrl += `&contact=ilike.*${filterValue}*`;
                        break;
                    case 'email':
                        fetchUrl += `&email=ilike.*${filterValue}*`;
                        break;
                    case 'user_role':
                        fetchUrl += `&user_role=ilike.*${filterValue}*`;
                        break;
                    case 'tenant_name':
                        // Handled above via pre-resolved tenantIdFilter — skip here
                        break;
                    case 'is_active':
                        fetchUrl += `&is_active=eq.${value === 'true'}`;
                        break;
                }
            }
        });

        // Add sorting
        const effectiveSortField = sortField || 'id';
        const effectiveSortAsc = sortAsc;

        let dbSortFieldMapped = effectiveSortField;
        if (effectiveSortField === 'id') dbSortFieldMapped = 'id';
        else if (effectiveSortField === 'user_name') dbSortFieldMapped = 'user_name';
        else if (effectiveSortField === 'contact') dbSortFieldMapped = 'contact';
        else if (effectiveSortField === 'email') dbSortFieldMapped = 'email';
        else if (effectiveSortField === 'user_role') dbSortFieldMapped = 'user_role';
        else if (effectiveSortField === 'is_active') dbSortFieldMapped = 'is_active';
        else if (effectiveSortField === 'tenant_name') dbSortFieldMapped = 'tenant_id';

        let orderQuery = `${dbSortFieldMapped}.${effectiveSortAsc ? 'asc' : 'desc'}.nullslast`;

        // Add secondary sort by id to break ties
        if (effectiveSortField !== 'id') {
            orderQuery += `,id.desc`;
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
                const match = contentRange.match(/\/(\d+)/);
                if (match && match[1]) {
                    total = parseInt(match[1], 10);
                }
            }

            // Process the joined tenant names from the response
            const accountUsersWithTenantNames = response.data.map(user => ({
                ...user,
                // Extract tenant name from the joined ap_tenants table
                tenant_name: user.ap_tenants && user.ap_tenants.tenant_name
                    ? user.ap_tenants.tenant_name
                    : 'N/A'
            }));

            setTotalCount(total);
            setAccountUsers(accountUsersWithTenantNames);
        } catch (error) {
            let errorMessage = error.response?.data?.message || error.message || 'Failed to fetch account_users.';
            setErrorAccountUsers(errorMessage);
            // Requirement #4: Don't display toast errors for filter operations
            // toast.error(errorMessage);
            setTotalCount(0); // Reset count on error
        } finally {
            setLoadingAccountUsers(false);
            setFiltering(false);
        }
    }, [tenantId, user?.id, user?.role, user?.tenantId, isSuperAdmin, token, page, pageSize, sortField, sortAsc, debouncedColumnFilters]);

    // Ref to track if initial fetch has been completed to prevent duplicate calls
    const initialFetchCompletedRef = useRef(false);

    // Consolidated useEffect - single trigger for all data fetch scenarios (like Parameters.jsx and Masters.jsx)
    useEffect(() => {
        if (!user || !token) {
            return;
        }

        // Only allow fetch if it's not the initial load or if initial load has been completed
        if (loadingAccountUsers || initialFetchCompletedRef.current) {
            fetchAccountUsers();
        }

        // Mark initial fetch as completed after first render
        if (!initialFetchCompletedRef.current) {
            initialFetchCompletedRef.current = true;
        }
    }, [fetchAccountUsers, user, token, page, pageSize, sortField, sortAsc, debouncedColumnFilters]);

    // Updates form data when a user is selected for editing
    useEffect(() => {
        if (editingAccountUser) {
            setFormData({
                name: editingAccountUser.user_name || '',
                email: editingAccountUser.email || '',
                phone: editingAccountUser.contact || '',
                password: '',
                role: editingAccountUser.user_role || AVAILABLE_ROLES[0],
                isActive: editingAccountUser.is_active,
            });
            setShowAddEditModal(true);
        } else {
            // Reset form for new user
            setFormData({
                name: '',
                email: '',
                phone: '',
                password: '',
                role: AVAILABLE_ROLES[0],
                isActive: true,
            });
        }
        setPhoneError('');
    }, [editingAccountUser, AVAILABLE_ROLES]);

    // Adds a class to the body to prevent scrolling when a modal is open
    useEffect(() => {
        if (showAddEditModal || showBulkUploadModal || showBulkRegistrationSummary || showConfirmDeleteModal) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [showAddEditModal, showBulkUploadModal, showBulkRegistrationSummary, showConfirmDeleteModal]);

    // Ref for debouncing
    const filterTimeoutRef = useRef(null);

    // Debounce column filters
    useEffect(() => {
        // Clear any existing timeout
        if (filterTimeoutRef.current) {
            clearTimeout(filterTimeoutRef.current);
        }

        // Set a new timeout to debounce the filter change
        filterTimeoutRef.current = setTimeout(() => {
            setDebouncedColumnFilters(columnFilters);
        }, 300); // 300ms debounce delay

        // Cleanup function
        return () => {
            if (filterTimeoutRef.current) {
                clearTimeout(filterTimeoutRef.current);
            }
        };
    }, [columnFilters]);

    // Update URL parameters when state changes
    useEffect(() => {
        const params = new URLSearchParams();

        // Add pagination params
        if (page !== 1) params.set('page', page.toString());
        if (pageSize !== 10) params.set('pageSize', pageSize.toString());

        // Add sort params
        if (sortField !== 'id') params.set('sortField', sortField);
        if (sortAsc) params.set('sortAsc', sortAsc.toString());

        // Add column filters
        Object.entries(columnFilters).forEach(([key, value]) => {
            if (value) {
                // Map internal field names to URL parameter names
                let paramName = key;
                if (key === 'user_name') paramName = 'userName';
                else if (key === 'user_role') paramName = 'userRole';
                else if (key === 'tenant_name') paramName = 'tenantName';
                else if (key === 'is_active') paramName = 'isActive';

                params.set(paramName, value);
            }
        });

        // Only update URL if there are params to set
        if (params.toString()) {
            setSearchParams(params, { replace: true });
        } else {
            // Clear URL params if no filters are active
            setSearchParams({}, { replace: true });
        }
    }, [page, pageSize, sortField, sortAsc, columnFilters, setSearchParams]);

    // Validation functions
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone) => {
        const phoneRegex = /^[789]\d{9}$/;
        return phoneRegex.test(phone);
    };

    // Validation function for alphabetic characters and spaces only
    const validateAlphabetic = (value) => {
        const regex = /^[a-zA-Z\s]*$/;
        return regex.test(value);
    };

    // Validation function to check if string contains only spaces (and is not empty)
    const validateOnlySpaces = (value) => {
        return /^\s+$/.test(value);
    };

    // Validation function to check if string starts with spaces
    const validateLeadingSpaces = (value) => {
        return /^\s+/.test(value);
    };

    // Validation function to check if string has trailing spaces
    const validateTrailingSpaces = (value) => {
        return /\s+$/.test(value);
    };

    // Validation function to check for special characters (only allow alphanumeric, spaces, and hyphens)
    const validateSpecialCharacters = (value) => {
        const regex = /^[a-zA-Z0-9 _-]*$/;
        return regex.test(value);
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
        
        // Validate input - only allow letters and spaces
        if (!validateAlphabetic(value)) {
            return 'Only letters and spaces are allowed';
        }
        
        return null; // Valid input
    };

    // Enhanced validation function for username, contact, and role that prevents special characters
    const validateFieldWithoutSpecialChars = (value, fieldName) => {
        // Check maximum length
        if (value && value.length > 200) {
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
        
        // Check if string ends with spaces
        if (validateTrailingSpaces(value)) {
            return 'Input cannot end with spaces';
        }
        
        // Validate input - only allow alphanumeric characters, spaces, underscores, and hyphens
        if (!validateSpecialCharacters(value)) {
            return `Only alphanumeric characters, spaces, underscores (_), and hyphens (-) are allowed in ${fieldName}`;
        }
        
        return null; // Valid input
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

    // --- Event Handlers & Logic Functions ---

    // Handles changes to form input fields
    const handleChange = useCallback((e) => {
        if (!canEditUsers) {
            // This is not in the form submission context, so we keep the toast
            toast.error(editPermissionDeniedMessage);
            return;
        }
        const { name, value, type, checked } = e.target;
        
        // Clear general error when user starts typing
        setErrors(prev => ({
            ...prev,
            generalError: ''
        }));
        
        // Apply validation based on field name
        if (name === 'name') {
            // Validate name field - allows spaces between words during typing
            const usernameValidationError = validateNameField(value, 'name');
            if (usernameValidationError) {
                setErrors(prev => ({
                    ...prev,
                    [name]: usernameValidationError
                }));
                return; // Don't update form data if invalid
            } else {
                // Clear error if valid
                setErrors(prev => ({
                    ...prev,
                    [name]: ''
                }));
            }
        } else if (name === 'email') {
            // Validate email format
            if (value && !validateEmail(value)) {
                setErrors(prev => ({
                    ...prev,
                    [name]: 'Please enter a valid email address',
                    duplicateEmail: '' // Clear duplicate email error when user changes email
                }));
            } else {
                // Clear error if valid or empty
                setErrors(prev => ({
                    ...prev,
                    [name]: '',
                    duplicateEmail: '' // Clear duplicate email error when user changes email
                }));
            }
        } else if (name === 'phone') {
            // For phone, we only validate the format on change
            // The detailed validation happens on submit
        } else if (name === 'role') {
            // Validate role for special characters
            if (value) {
                const roleValidationError = validateFieldWithoutSpecialChars(value, 'user role');
                if (roleValidationError) {
                    setErrors(prev => ({
                        ...prev,
                        [name]: roleValidationError
                    }));
                    return; // Don't update form data if invalid
                } else {
                    // Clear error if valid
                    setErrors(prev => ({
                        ...prev,
                        [name]: ''
                    }));
                }
            }
        } else if (name === 'password') {
            // Validate password
            const { isValid, validations } = validatePassword(value);
            if (!isValid) {
                setErrors(prev => ({
                    ...prev,
                    [name]: 'Password does not meet security requirements'
                }));
            } else {
                // Clear error if valid
                setErrors(prev => ({
                    ...prev,
                    [name]: ''
                }));
            }
        }
        
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    }, [canEditUsers, editPermissionDeniedMessage, validateNameField, validateEmail, validatePassword]);

    const handlePhoneChange = useCallback((e) => {
        const { value } = e.target;
        // Allow only numbers and limit to 10 digits
        if (/^\d{0,10}$/.test(value)) {
            // Clear phone validation error when user types
            setErrors(prev => ({
                ...prev,
                phone: '',
                generalError: ''
            }));
            setPhoneError('');
            setFormData(prev => ({ ...prev, phone: value }));
        }
    }, []);

    const resetFormAndCloseModal = useCallback(() => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            password: '',
            role: AVAILABLE_ROLES[0],
            isActive: true,
        });
        setErrors({
            email: '',
            phone: '',
            name: '',
            password: '',
            duplicateEmail: '',
            generalError: ''
        });
        setEditingAccountUser(null);
        setShowAddEditModal(false);
        setShowPassword(false);
    }, [AVAILABLE_ROLES]);

    // Function to check if form is valid
    const isFormValid = () => {
        // Check required fields
        if (!formData.name.trim() || 
            !formData.email.trim() || 
            !formData.phone.trim() || 
            !formData.role) {
            return false;
        }

        // Validate name
        if (validateFieldWithoutSpecialChars(formData.name, 'username')) {
            return false;
        }

        // Validate email
        if (!validateEmail(formData.email)) {
            return false;
        }

        // Validate phone
        if (!validatePhone(formData.phone)) {
            return false;
        }

        // Validate password for new users
        if (!editingAccountUser) {
            if (!formData.password.trim()) {
                return false;
            }
            const { isValid: isPasswordValid } = validatePassword(formData.password);
            if (!isPasswordValid) {
                return false;
            }
        }

        // Check if there are any validation errors
        const hasValidationErrors = Object.values(errors).some(error => error !== '');
        if (hasValidationErrors) {
            return false;
        }

        return true;
    };

    const handleSubmitAccountUserForm = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Reset errors
        setErrors({ email: '', phone: '', name: '', password: '', duplicateEmail: '', generalError: '' });
        setPhoneError('');

        // Validation
        let isValid = true;
        const newErrors = { email: '', phone: '', name: '', password: '' };

        // Validate name
        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
            isValid = false;
        } else {
            const nameError = validateFieldWithoutSpecialChars(formData.name, 'username');
            if (nameError) {
                newErrors.name = nameError;
                isValid = false;
            }
        }

        // Validate email
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
            isValid = false;
        } else if (!validateEmail(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
            isValid = false;
        }

        // Validate phone
        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone is required';
            isValid = false;
        } else if (!validatePhone(formData.phone)) {
            newErrors.phone = 'Contact number must start with 7, 8, or 9 and be exactly 10 digits';
            isValid = false;
        }

        // Validate role for special characters
        if (formData.role && validateFieldWithoutSpecialChars(formData.role, 'user role')) {
            newErrors.role = validateFieldWithoutSpecialChars(formData.role, 'user role');
            isValid = false;
        }

        // Validate password for new users
        if (!editingAccountUser) {
            if (!formData.password.trim()) {
                newErrors.password = 'Password is required';
                isValid = false;
            } else {
                const { isValid: isPasswordValid } = validatePassword(formData.password);
                if (!isPasswordValid) {
                    newErrors.password = 'Password does not meet security requirements';
                    isValid = false;
                }
            }
        }

        if (!isValid) {
            setErrors(newErrors);
            setLoading(false);
            return;
        }

        // ... rest of the function remains the same ...

        if (!canEditUsers) {
            setErrors(prev => ({
                ...prev,
                generalError: editPermissionDeniedMessage
            }));
            setLoading(false);
            return;
        }

        const { name, email, phone, password, role, isActive } = formData;
        const isNewUser = !editingAccountUser;

        if (!name || !email || !phone || !role) {
            setErrors(prev => ({
                ...prev,
                generalError: 'Please fill all required fields.'
            }));
            setLoading(false);
            return;
        }

        if (isNewUser && !password) {
            setErrors(prev => ({
                ...prev,
                generalError: 'Please provide a password for the new user.'
            }));
            setLoading(false);
            return;
        }

        const phoneRegex = /^[789]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            setErrors(prev => ({
                ...prev,
                phone: 'Contact number must be exactly 10 digits.',
                generalError: ''
            }));
            setLoading(false);
            return;
        }

        if (!isSuperAdmin && !tenantId) {
            setErrors(prev => ({
                ...prev,
                generalError: 'Session expired. Please login again.'
            }));
            setLoading(false);
            return;
        }

        try {
            const userPayload = {
                user_name: name,
                email: email,
                contact: phone,
                user_role: role,
                is_active: isActive,
                updated_at: getCurrentTimeISOString(),
            };

            if (isNewUser) {
                const existingUsers = await axios.get(`/api/v1/tables/ap_users?email=eq.${email}`);
                if (existingUsers.data?.length > 0) {
                    setErrors(prev => ({
                        ...prev,
                        duplicateEmail: "A user with this email already exists. Please use a different email."
                    }));
                    setLoading(false);
                    return;
                }
                userPayload.password = password;
                userPayload.created_at = getCurrentTimeISOString();
                userPayload.created_by = userId;
                userPayload.tenant_id = isSuperAdmin ? null : tenantId;

                await axios.post(`/api/api/signup`, userPayload);
                toast.success('User registered successfully!');

            } else {
                if (password) {
                    userPayload.user_password = password;
                }
                const patchUrl = `/api/v1/tables/ap_users?id=eq.${editingAccountUser.id}`;
                await axios.patch(patchUrl, userPayload);
                toast.success('User updated successfully!');
            }

            resetFormAndCloseModal();
            fetchAccountUsers();
        } catch (error) {
            // Operation error
            let errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred during operation.';
            
            // Check if it's a duplicate email error from database constraint
            if (errorMessage.includes('duplicate key value violates unique constraint') && errorMessage.includes('ap_users_email_key')) {
                setErrors(prev => ({
                    ...prev,
                    duplicateEmail: 'A user with this email already exists. Please use a different email.',
                    generalError: ''
                }));
            } else {
                setErrors(prev => ({
                    ...prev,
                    generalError: errorMessage
                }));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEditAccountUser = useCallback((accountUser) => {
        if (!canEditUsers) {
            // This is not in the form context, so we keep the toast
            toast.error(editPermissionDeniedMessage);
            return;
        }
        setEditingAccountUser(accountUser);
    }, [canEditUsers, editPermissionDeniedMessage]);

    const handleDeleteAccountUserClick = useCallback((accountUser) => {
        if (!canDeleteUsers) {
            // This is not in the form context, so we keep the toast
            toast.error(deletePermissionDeniedMessage);
            return;
        }
        setAccountUserToDelete(accountUser);
        setShowConfirmDeleteModal(true);
    }, [canDeleteUsers, deletePermissionDeniedMessage]);

    const confirmDeleteAccountUser = async () => {
        if (!accountUserToDelete) return;
        setLoading(true);

        if (!canDeleteUsers) {
            // This is not in the main form context, so we keep the toast
            toast.error(deletePermissionDeniedMessage);
            setLoading(false);
            setShowConfirmDeleteModal(false);
            return;
        }

        try {
            await axios.delete(`/api/v1/tables/ap_users?id=eq.${accountUserToDelete.id}`);
            toast.success("User deleted successfully!");
            fetchAccountUsers();
            setShowConfirmDeleteModal(false);
            setAccountUserToDelete(null);
        } catch (error) {
            // Error deleting user
            let errorMessage = error.response?.data?.message || "Failed to delete user.";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const cancelDelete = useCallback(() => {
        setShowConfirmDeleteModal(false);
        setAccountUserToDelete(null);
    }, []);

    const handleChangeUserStatus = async (user) => {
        if (!canEditUsers) {
            // For status changes, we can show the error in a temporary way since it's not in the modal
            toast.error(editPermissionDeniedMessage);
            return;
        }
        setLoading(true);
        try {
            const newStatus = !user.is_active;
            const updatedUsers = accountUsers.map(u =>
                u.id === user.id ? { ...u, is_active: newStatus } : u
            );
            setAccountUsers(updatedUsers);

            await axios.patch(`/api/v1/tables/ap_users?id=eq.${user.id}`, {
                is_active: newStatus,
                updated_at: getCurrentTimeISOString(),
            });

            toast.success(`User status changed to ${newStatus ? 'Active' : 'Inactive'}!`);
        } catch (error) {
            // Error changing user status
            const originalStatus = !user.is_active;
            setAccountUsers(accountUsers.map(u =>
                u.id === user.id ? { ...u, is_active: originalStatus } : u
            ));
            // This is not in the form context, so we keep the toast
            toast.error("Failed to update user status.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const headers = [['user_name', 'email', 'contact', 'user_role', 'password']];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Users");
        XLSX.writeFile(wb, "user_registration_template.xlsx");
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) {
            setUploadedUsers([]);
            setValidUsers([]);
            setInvalidUsers([]);
            return;
        }

        setIsProcessingFile(true);
        setBulkUploadErrors(null);
        setUploadedUsers([]);
        setValidUsers([]);
        setInvalidUsers([]);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length < 2) {
                    setBulkUploadErrors('The Excel file is empty or has no data rows.');
                    setIsProcessingFile(false);
                    return;
                }

                const headers = json[0];
                const requiredHeaders = ['user_name', 'email', 'contact', 'user_role', 'password'];
                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

                if (missingHeaders.length > 0) {
                    setBulkUploadErrors(`Missing required columns in the Excel file: ${missingHeaders.join(', ')}. Please use the provided template.`);
                    setIsProcessingFile(false);
                    return;
                }

                const usersData = json.slice(1).map(row => {
                    const user = {};
                    headers.forEach((header, index) => {
                        user[header] = row[index];
                    });
                    return user;
                });

                const existingAccountUserMap = new Map();
                accountUsers.forEach(accountUser => existingAccountUserMap.set(String(accountUser.email).toLowerCase(), accountUser));

                const validatedUsers = usersData.map((user, index) => {
                    const errors = [];
                    const userRoleLower = String(user.user_role).toLowerCase();

                    if (!user.user_name) errors.push('User name is required.');
                    if (!user.email) errors.push('Email is required.');
                    if (!user.contact) errors.push('Contact is required.');
                    if (!user.user_role) errors.push('User role is required.');

                    // Special character validation for username, contact, and role
                    if (user.user_name) {
                        const nameValidationError = validateFieldWithoutSpecialChars(String(user.user_name), 'username');
                        if (nameValidationError) {
                            errors.push(nameValidationError);
                        }
                    }
                    if (user.contact) {
                        const contactValidationError = validateFieldWithoutSpecialChars(String(user.contact), 'contact');
                        if (contactValidationError) {
                            errors.push(contactValidationError);
                        }
                    }
                    if (user.user_role) {
                        const roleValidationError = validateFieldWithoutSpecialChars(String(user.user_role), 'user role');
                        if (roleValidationError) {
                            errors.push(roleValidationError);
                        }
                    }

                    const existingAccountUser = existingAccountUserMap.get(String(user.email).toLowerCase());
                    if (!user.password && !existingAccountUser) {
                        errors.push('Password is required for new users.');
                    }

                    // Email validation
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (user.email && !emailRegex.test(user.email)) {
                        errors.push('Invalid email format.');
                    }

                    // Phone validation
                    const phoneRegex = /^[789]\d{9}$/;
                    if (user.contact && !phoneRegex.test(String(user.contact))) {
                        errors.push('Contact number must start with 7, 8, or 9 and be exactly 10 digits.');
                    }

                    if (user.user_role && !AVAILABLE_ROLES.includes(userRoleLower)) {
                        errors.push(`Invalid role: '${user.user_role}'. Must be one of: ${AVAILABLE_ROLES.join(', ')}.`);
                    }

                    const status = existingAccountUser ? 'update' : (errors.length > 0 ? 'error' : 'new');

                    return {
                        ...user,
                        user_role: userRoleLower,
                        errors: errors.length > 0 ? errors : null,
                        originalIndex: index + 2,
                        status: status,
                        id: existingAccountUser?.id,
                    };
                });

                const valid = validatedUsers.filter(u => !u.errors);
                const invalid = validatedUsers.filter(u => u.errors);
                setUploadedUsers(validatedUsers);
                setValidUsers(valid);
                setInvalidUsers(invalid);
                setIsProcessingFile(false);

            } catch (error) {
                // Error reading Excel file
                setBulkUploadErrors('Failed to read the Excel file. Please ensure it is a valid format.');
                setUploadedUsers([]);
                setValidUsers([]);
                setInvalidUsers([]);
                setIsProcessingFile(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Drag and drop handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isProcessingFile && canEditUsers) {
            setDragActive(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (isProcessingFile || !canEditUsers) {
            return;
        }

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            // Only accept the first file
            const file = files[0];

            // Validate file type
            const fileName = file.name.toLowerCase();
            if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
                // This is in the bulk upload modal, not the main form, so we can keep toast
                toast.error('Only Excel files (.xlsx, .xls) are allowed');
                return;
            }

            // Simulate the file selection by setting it to the file input ref
            Object.defineProperty(file, 'name', {
                writable: true,
                value: file.name
            });

            // Create a DataTransfer object to simulate the event
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Create a synthetic event
            const event = {
                target: {
                    files: dataTransfer.files
                }
            };

            handleFileChange(event);
        }
    };

    const openFileInput = () => {
        if (!isProcessingFile && canEditUsers) {
            fileInputRef.current?.click();
        }
    };

    const clearFile = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
        }
        setUploadedUsers([]);
        setValidUsers([]);
        setInvalidUsers([]);
        setBulkUploadErrors(null);
    };

    const handleBulkRegistration = async () => {
        if (!validUsers.length) {
            setBulkUploadErrors('There are no valid users to register or update.');
            return;
        }

        if (!user || !token) {
            setBulkUploadErrors('Session expired. Please log in again.');
            return;
        }

        if (!isSuperAdmin && !tenantId) {
            setBulkUploadErrors('Session expired. Please log in again.');
            return;
        }

        setBulkUploadLoading(true);

        try {
            const newUsersToRegister = validUsers.filter(user => user.status === 'new');
            const usersToUpdate = validUsers.filter(user => user.status === 'update');

            const registrationPromises = newUsersToRegister.map(user => {
                const userPayload = {
                    email: user.email,
                    contact: user.contact,
                    password: user.password,
                    user_role: user.user_role,
                    user_name: user.user_name,
                    is_active: true,
                    tenant_id: isSuperAdmin ? null : tenantId,
                };
                return axios.post(`/api/api/signup`, userPayload);
            });

            const updatePromises = usersToUpdate.map(user => {
                const userPayload = {
                    user_name: user.user_name,
                    contact: user.contact,
                    user_role: user.user_role,
                    updated_at: getCurrentTimeISOString(),
                };
                // Password updates are not allowed for existing users during bulk registration
                // Only non-password fields are updated for existing users
                const patchUrl = `/api/v1/tables/ap_users?id=eq.${user.id}`;
                return axios.patch(patchUrl, userPayload);
            });

            const registrationResults = await Promise.allSettled(registrationPromises);
            const updateResults = await Promise.allSettled(updatePromises);

            const registeredCount = registrationResults.filter(r => r.status === 'fulfilled').length;
            const updatedCount = updateResults.filter(r => r.status === 'fulfilled').length;
            const registrationErrors = registrationResults.filter(r => r.status === 'rejected').map(r => r.reason.response?.data?.message || r.reason.message);
            const updateErrors = updateResults.filter(r => r.status === 'rejected').map(r => r.reason.response?.data?.message || r.reason.message);

            setBulkRegistrationSummary({
                registeredCount: registeredCount,
                updatedCount: updatedCount,
                skippedList: [],
                errorsList: [...invalidUsers, ...registrationErrors, ...updateErrors],
            });

            setShowBulkUploadModal(false);
            setShowBulkRegistrationSummary(true);
            fetchAccountUsers();

            // These are in bulk upload modal, not the main form, so we keep the toasts
            if (registrationErrors.length > 0 || updateErrors.length > 0) {
                toast.error("Some operations failed during bulk processing. Check the summary for details.");
            } else {
                toast.success('Bulk registration and updates completed successfully!');
            }

        } catch (error) {
            // Bulk operation error
            let errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred during bulk operation.';
            setBulkUploadErrors(errorMessage);
            // This is in the bulk upload modal, not the main form, so we keep the toast
            toast.error(errorMessage);
        } finally {
            setBulkUploadLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = null;
            }
        }
    };

    const resetBulkUploadModal = () => {
        setShowBulkUploadModal(false);
        setUploadedUsers([]);
        setValidUsers([]);
        setInvalidUsers([]);
        setBulkUploadErrors(null);
        setIsProcessingFile(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
        }
    }

    const resetBulkRegistrationSummaryModal = () => {
        setShowBulkRegistrationSummary(false);
        setBulkRegistrationSummary({
            registeredCount: 0,
            updatedCount: 0,
            skippedList: [],
            errorsList: [],
        });
        resetBulkUploadModal();
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
        }
    }

    // Function to clear all column filters
    const clearFilters = useCallback(() => {
        const emptyFilters = {
            id: '',
            user_name: '',
            contact: '',
            email: '',
            user_role: '',
            tenant_name: '',
            is_active: '',
        };
        setColumnFilters(emptyFilters);
        setDebouncedColumnFilters(emptyFilters);
    }, []);

    // Called by TableComponent via onColumnFilterCommit.
    // Resets to page 1 so filter results always start from the first page
    // (prevents "no results" when user is on page N > total filtered pages).
    const handleColumnFilterCommit = useCallback((key, value) => {
        setColumnFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    }, []);

    const baseColumns = useMemo(() => [
        // { key: 'id', header: 'ID', sortable: true, filterable: true, width: '70px', filterType: 'text' },
        { key: 'user_name', header: 'Name', sortable: true, filterable: true, width: '150px', filterType: 'text', filterPlaceholder: 'by name' },
        { key: 'contact', header: 'Contact', sortable: true, filterable: true, width: '90px', filterType: 'text', filterPlaceholder: 'by contact' },
        { key: 'email', header: 'Email', sortable: true, filterable: true, width: '200px', filterType: 'text', filterPlaceholder: 'by email' },
        {
            key: 'user_role',
            header: 'Role',
            width: '120px',
            sortable: true,
            filterable: true,
            filterType: 'select',
            filterOptions: () => AVAILABLE_ROLES,
            render: (item) => (
                <span className="role-badge"><span>{item.user_role}</span></span>
            )
        },
        {
            key: 'is_active',
            header: 'Status',
            sortable: true,
            filterable: true,
            filterType: 'select',
            filterOptions: () => [
                { label: 'Active', value: 'true' },
                { label: 'Inactive', value: 'false' }
            ],
            width: '80px',
            render: (item) => (
                <span className={`status-badge ${item.is_active ? 'active' : 'inactive'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                </span>
            )
        },
        {
            key: 'created_at',
            header: 'Created At',
            sortable: true,
            width: '150px',
            render: (item) => (
                <span className="text-xs text-gray-600">
                    {item.created_at ? formatDateTime(item.created_at) : 'N/A'}
                </span>
            )
        }
    ], [AVAILABLE_ROLES]);

    const tenantColumn = useMemo(() => ({
        key: 'tenant_name',
        header: 'Tenant Name',
        sortable: true,
        filterable: true,
        width: '150px',
        filterPlaceholder: 'by tenant name',
        render: (item) => item.tenant_name || 'N/A'
    }), []);

    const accountUserTableColumns = useMemo(() => {
        const columns = isSuperAdmin ? [tenantColumn, ...baseColumns] : baseColumns;
        return [...columns,
        {
            key: 'actions',
            header: 'Actions',
            width: '100px',
            render: (item) => (
                <div className="table-actions flex gap-3 justify-center" data-tour="user-actions">
                    <button
                        className="action-icon-button"
                        onClick={() => handleEditAccountUser(item)}
                        title={!canEditUsers ? editPermissionDeniedMessage : "Edit user"}
                        disabled={!canEditUsers || item.user_role === 'tenant_admin'}
                        data-tour="user-edit-button"
                    >
                        <Edit size={14} color="#4f46e5" />
                    </button>
                    <button
                        className="action-icon-button"
                        onClick={() => handleChangeUserStatus(item)}
                        title={!canEditUsers ? editPermissionDeniedMessage : `Set to ${item.is_active ? 'Inactive' : 'Active'}`}
                        disabled={!canEditUsers || item.user_role === 'tenant_admin'}
                        data-tour="user-active-toggle"
                    >
                        {item.is_active ? (
                            <ShieldCheck size={14} color={!canEditUsers || item.user_role === 'tenant_admin' ? '#9ca3af' : '#10b981'} />
                        ) : (
                            <ShieldOff size={14} color={!canEditUsers || item.user_role === 'tenant_admin' ? '#9ca3af' : '#ef4444'} />
                        )}
                    </button>
                    {canDeleteUsers && (
                        <button
                            className="action-icon-button"
                            onClick={() => handleDeleteAccountUserClick(item)}
                            title="Delete user"
                            disabled={item.user_role === 'tenant_admin'}
                            data-tour="user-delete-button"
                        >
                            <Trash2 size={14} color={item.user_role === 'tenant_admin' ? '#9ca3af' : '#ef4444'} />
                        </button>
                    )}
                </div>
            )
        }
        ];
    }, [isSuperAdmin, baseColumns, tenantColumn, handleEditAccountUser, handleChangeUserStatus, handleDeleteAccountUserClick, canEditUsers, canDeleteUsers, editPermissionDeniedMessage, deletePermissionDeniedMessage]);

    if (!user) {
        return (
            <div className="permission-denied-container">
                <p>Please log in to view this page.</p>
            </div>
        );
    }

    if (loadingAccountUsers && !filtering) { // Show full loading message only during initial load, not during filtering
        return <div className="loading-message">Loading users...</div>;
    }

    if (errorAccountUsers) {
        return <div className="error-message">Error: {errorAccountUsers}</div>;
    }

    return (
        <div className="font-[Poppins] p-3 rounded-lg max-w-auto mx-auto flex flex-col">
            <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
            <div className="bg-white  flex-grow flex flex-col">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-2">
                    <h1 className="text-sm font-semibold text-gray-800" data-tour="user-mgmt-header">User Management</h1>
                    <div className="flex flex-wrap gap-2">
                        <div>
                            {hasActiveFilters && (
                                <button
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs font-normal rounded shadow-sm hover:bg-red-700 transition-colors duration-200"
                                    onClick={clearFilters}
                                    title="Clear all active filters"
                                    data-tour="clear-filters-button"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                        {canEditUsers && userRole !== 'super_admin' && (
                        <button
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs font-normal rounded shadow-sm hover:bg-indigo-700 transition-colors duration-200"
                            onClick={() => {
                                if (!isSuperAdmin) {
                                    setEditingAccountUser(null);
                                    setShowAddEditModal(true);
                                }
                            }}
                            disabled={!canEditUsers || isSuperAdmin}
                            title={
                                !canEditUsers
                                    ? editPermissionDeniedMessage
                                    : isSuperAdmin
                                        ? "Super Admins cannot add new users"
                                        : "Add a new user"
                            }
                            data-tour="add-user-button"
                        >
                            <Plus size={10} /> Add User
                        </button>
                        )}
                        {!isSuperAdmin && (
                            <button
                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-600 text-white text-xs font-normal rounded shadow-sm hover:bg-gray-700 transition-colors duration-200"
                                onClick={() => {
                                    setShowBulkUploadModal(true);
                                }}
                                disabled={!canEditUsers}
                                title={
                                    !canEditUsers
                                        ? editPermissionDeniedMessage
                                        : "Bulk register users from an Excel file"
                                }
                                data-tour="bulk-register-button"
                            >
                                <Upload size={10} /> Bulk Register
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-grow" data-tour="user-table">
                    <TableComponent
                        data={accountUsers}
                        columns={accountUserTableColumns}
                        columnFilters={columnFilters}
                        setColumnFilters={setColumnFilters}
                        onColumnFilterCommit={handleColumnFilterCommit}
                        sortField={sortField}
                        setSortField={setSortField}
                        sortAsc={sortAsc}
                        setSortAsc={setSortAsc}
                        page={page}
                        setPage={setPage}
                        emptyMessage="No users found. Click 'Add User' to add one."
                        pageSize={pageSize}
                        setPageSize={setPageSize}
                        totalCount={totalCount} // Pass total count for pagination
                        filtering={filtering} // Use filtering state for loading indicator
                        data-tour="user-table"
                        data-tour-table-filters="user-table-filters"
                        data-tour-table-sort="user-table-sort"
                        tablePaginationDataTour="user-table-pagination"
                    />
                </div>
            </div>

            {showAddEditModal && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center" onClick={() => resetFormAndCloseModal()}>
                    <div className="bg-white p-4 rounded-md shadow-sm w-full max-w-lg transition-transform transform scale-100 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-200 flex-shrink-0">
                            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                <KeyRound size={14} className="text-blue-500" />
                                {editingAccountUser ? 'Edit User Details' : 'Add New User'}
                            </h3>
                            <button className="bg-transparent border-0 cursor-pointer text-gray-500 hover:text-gray-700 transition-colors" onClick={() => resetFormAndCloseModal()} title="Close form">
                                <XCircle size={14} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitAccountUserForm} className="space-y-3">
                            {errors.generalError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs">
                                    {errors.generalError}
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="flex flex-col">
                                    <label htmlFor="name" className="text-xs font-medium text-gray-700 mb-1">Full Name</label>
                                    <div className="relative">
                                        <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="Enter Full Name"
                                            maxLength={200}
                                            required
                                            disabled={!canEditUsers}
                                            title={!canEditUsers ? editPermissionDeniedMessage : `Enter the user's full name (Max ${formData.name.length}/200 characters)`}
                                            className={`w-full px-3 pl-8 py-1.5 rounded-md border text-xs text-black transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                    </div>
                                    {errors.name && <span className="text-red-500 text-[11px] mt-1">{errors.name}</span>}
                                    <div className="text-xs text-gray-500 mt-1 text-right">
                                        {formData.name.length}/200
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="email" className="text-xs font-medium text-gray-700 mb-1">Email</label>
                                    <div className="relative">
                                        <Mail size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="Enter Email ID"
                                            required
                                            disabled={!canEditUsers}
                                            title={!canEditUsers ? editPermissionDeniedMessage : "Enter the user's email address"}
                                            className={`w-full px-3 pl-8 py-1.5 rounded-md border text-xs text-black transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 ${errors.email || errors.duplicateEmail ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                    </div>
                                    {errors.duplicateEmail ? (
                                        <span className="text-red-500 text-[11px] mt-1">{errors.duplicateEmail}</span>
                                    ) : errors.email ? (
                                        <span className="text-red-500 text-[11px] mt-1">{errors.email}</span>
                                    ) : (
                                        <span className="text-transparent text-[11px] mt-1">&nbsp;</span>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="phone" className="text-xs font-medium text-gray-700 mb-1">Contact</label>
                                    <div className="relative">
                                        <Phone size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        <input
                                            type="tel"
                                            id="phone"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handlePhoneChange}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                // Validate Indian mobile format on blur
                                                if (value && !/^[789]\d{9}$/.test(value)) {
                                                    setErrors(prev => ({
                                                        ...prev,
                                                        phone: 'Please enter a valid 10-digit Indian contact number'
                                                    }));
                                                } else {
                                                    setErrors(prev => ({
                                                        ...prev,
                                                        phone: ''
                                                    }));
                                                }
                                            }}
                                            placeholder="10-digit phone number"
                                            required
                                            disabled={!canEditUsers}
                                            title={!canEditUsers ? editPermissionDeniedMessage : "Enter the user's contact number"}
                                            className={`w-full px-3 pl-8 py-1.5 rounded-md border text-xs text-black transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 ${errors.phone || phoneError ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                    </div>
                                    {(errors.phone || phoneError) && <span className="text-red-500 text-[11px] mt-1">{errors.phone || phoneError}</span>}
                                    {!(errors.phone || phoneError) && <span className="text-transparent text-[11px] mt-1">&nbsp;</span>}
                                </div>
                                {!editingAccountUser && (
                                    <div className="flex flex-col">
                                        <label htmlFor="password" className="text-xs font-medium text-gray-700 mb-1">Password</label>
                                        <div className="relative">
                                            <Lock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                id="password"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                placeholder="Enter Password"
                                                required
                                                disabled={!canEditUsers}
                                                title={!canEditUsers ? editPermissionDeniedMessage : "Enter password for the new user"}
                                                className={`w-full px-3 pl-8 py-1.5 rounded-md border text-xs text-black transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 pr-8 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                                onClick={() => setShowPassword(!showPassword)}
                                                disabled={!canEditUsers}
                                                title={!canEditUsers ? editPermissionDeniedMessage : "Toggle password visibility"}
                                            >
                                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                        {errors.password && (
                                            <p className="mt-1 text-xs text-red-600">{errors.password}</p>
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
                                        
                                        {/* Password Strength and Requirements */}
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
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <label htmlFor="role" className="text-xs font-medium text-gray-700 mb-1">Role</label>
                                    <div className="relative">
                                        <ShieldCheck size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        <select
                                            id="role"
                                            name="role"
                                            value={formData.role}
                                            onChange={handleChange}
                                            disabled={!canEditUsers}
                                            title={!canEditUsers ? editPermissionDeniedMessage : "Select the user's role"}
                                            className="w-full px-3 pl-8 py-1.5 rounded-md border border-gray-300 text-xs text-black transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                                        >
                                            {AVAILABLE_ROLES.map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {editingAccountUser && (
                                    <div className="flex items-center mt-4">
                                        <label htmlFor="isActive" className="text-xs font-medium text-gray-700 mr-2">Status:</label>
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            name="isActive"
                                            checked={formData.isActive}
                                            onChange={handleChange}
                                            disabled={!canEditUsers}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-xs text-gray-700">{formData.isActive ? 'Active' : 'Inactive'}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-normal transition-all duration-300 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
                                    disabled={loading || !canEditUsers || (!editingAccountUser && !isFormValid())}
                                    title={!canEditUsers ? editPermissionDeniedMessage : (editingAccountUser ? "Save changes to user details" : (isFormValid() ? "Add new user" : "Please fill all required fields correctly"))}
                                >
                                    {loading ? (editingAccountUser ? 'Updating...' : 'Adding...') : (editingAccountUser ? 'Save Changes' : 'Add User')}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetFormAndCloseModal}
                                    className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-normal transition-all duration-300 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 shadow-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showBulkUploadModal && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center backdrop-blur-sm" onClick={resetBulkUploadModal} data-tour="bulk-upload-modal">
                    <div className="bg-white p-4 rounded-md shadow-sm w-full max-w-xl transition-transform transform scale-100 animate-fade-in flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                <Upload size={14} className="text-blue-500" />
                                Bulk User Registration
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-normal transition-all duration-300 bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
                                    disabled={!canEditUsers}
                                    data-tour="download-template"
                                >
                                    <Download size={14} className="mr-1" /> Download Template
                                </button>
                                <button className="bg-transparent border-0 cursor-pointer text-gray-500 hover:text-gray-700 transition-colors" onClick={resetBulkUploadModal} title="Close form">
                                    <XCircle size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 flex flex-col items-center flex-shrink-0">
                            <div className="flex flex-col items-center gap-2 mt-2 w-full">
                                {!(fileInputRef.current?.files[0]) ? (
                                    <div
                                        className={`w-full p-4 border-2 border-dashed rounded-md text-center cursor-pointer transition-all duration-200 ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onClick={openFileInput}
                                    >
                                        <input
                                            type="file"
                                            id="file-upload"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept=".xlsx, .xls"
                                            disabled={!canEditUsers || isProcessingFile}
                                            className="hidden"
                                        />
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <Upload size={14} className="text-gray-400" />
                                            <p className="text-xs text-gray-600">
                                                {dragActive ? 'Drop Excel file here' : 'Drag & drop Excel file here or click to browse'}
                                            </p>
                                            <p className="text-[11px] text-gray-500">.xlsx or .xls files only</p>
                                        </div>
                                    </div>
                                ) : null}
                                {fileInputRef.current?.files[0] && (
                                    <div className="flex items-center justify-between w-full p-2 bg-gray-50 rounded border border-gray-200">
                                        <span className="text-[11px] font-normal text-gray-700 truncate flex-grow mr-2">{fileInputRef.current.files[0].name}</span>
                                        <button
                                            type="button"
                                            onClick={clearFile}
                                            className="text-gray-500 hover:text-red-500 transition-colors"
                                            title="Remove file"
                                        >
                                            <XCircle size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isProcessingFile && (
                            <div className="flex items-center justify-center gap-1.5 p-3 mt-3 bg-blue-50 text-blue-800 rounded-md border border-blue-300">
                                <Info size={16} />
                                <p className="text-xs">Processing file, please wait...</p>
                            </div>
                        )}

                        {bulkUploadErrors && (
                            <div className="flex items-center gap-1.5 p-3 mt-3 bg-red-50 text-red-800 rounded-md border border-red-300">
                                <AlertTriangle size={16} />
                                <p className="text-xs">{bulkUploadErrors}</p>
                            </div>
                        )}

                        {uploadedUsers.length > 0 && (
                            <div className="mt-4 flex flex-col flex-grow overflow-hidden">
                                {validUsers.length > 0 && (
                                    <div className="mb-3 flex flex-col flex-shrink-0">
                                        <h4 className="text-xs font-normal text-gray-800 mb-1">Users to be processed ({validUsers.length})</h4>
                                        <div className="flex-grow max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                                            <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                                                <thead className="bg-gray-50 sticky top-0">
                                                    <tr>
                                                        <th className="px-2 py-1 text-left text-gray-500 uppercase font-normal text-[11px]">Row #</th>
                                                        <th className="px-2 py-1 text-left text-gray-500 uppercase font-normal text-[11px]">Name</th>
                                                        <th className="px-2 py-1 text-left text-gray-500 uppercase font-normal text-[11px]">Email</th>
                                                        <th className="px-2 py-1 text-left text-gray-500 uppercase font-normal text-[11px]">Contact</th>
                                                        <th className="px-2 py-1 text-left text-gray-500 uppercase font-normal text-[11px]">Role</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white text-gray-700 divide-y divide-gray-200">
                                                    {validUsers.map((user, index) => (
                                                        <tr key={index} className="hover:bg-gray-50">
                                                            <td className="px-2 py-1">{user.originalIndex}</td>
                                                            <td className="px-2 py-1 text-[11px]">{user.user_name}</td>
                                                            <td className="px-2 py-1">{user.email}</td>
                                                            <td className="px-2 py-1 text-[11px]">{user.contact}</td>
                                                            <td className="px-2 py-1 text-[11px]">{user.user_role}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {invalidUsers.length > 0 && (
                                    <div className="flex flex-col flex-grow min-h-0">
                                        <h4 className="text-xs font-normal text-gray-800 mb-1 flex-shrink-0">Users with errors ({invalidUsers.length})</h4>
                                        <div className="flex-grow max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                                            <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                                                <thead className="bg-gray-50 sticky top-0">
                                                    <tr>
                                                        <th className="px-2 py-1 text-left text-gray-500 uppercase font-normal text-[11px]">Row</th>
                                                        <th className="px-2 py-1 text-left text-gray-500 uppercase font-normal text-[11px]">Email</th>
                                                        <th className="px-2 py-1 text-left text-gray-500 uppercase font-normal text-[11px]">Errors</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white text-gray-700 divide-y divide-gray-200">
                                                    {invalidUsers.map((user, index) => (
                                                        <tr key={index} className="hover:bg-gray-50">
                                                            <td className="px-2 py-1">{user.originalIndex}</td>
                                                            <td className="px-2 py-1">{user.email}</td>
                                                            <td className="px-2 py-1">
                                                                <ul className="list-disc pl-2 space-y-0.5">
                                                                    {user.errors?.map((err, i) => <li key={i} className="text-[11px]">{err}</li>)}</ul>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-center mt-3 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleBulkRegistration}
                                        className="inline-flex items-center px-3 py-1 rounded-md font-normal text-sm transition-all duration-300 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
                                        disabled={bulkUploadLoading || !canEditUsers || validUsers.length === 0}
                                    >
                                        {bulkUploadLoading ? 'Processing...' : `Process ${validUsers.length} Users`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showBulkRegistrationSummary && (
                <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center backdrop-blur-sm" onClick={resetBulkRegistrationSummaryModal} data-tour="bulk-summary">
                    <div className="bg-white p-4 rounded-md shadow-sm w-full max-w-lg transition-transform transform scale-100 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-200">
                            <h3 className="text-sm font-normal text-gray-800 flex items-center gap-1.5">
                                <Info size={14} className="text-blue-500" />
                                Bulk Registration Summary
                            </h3>
                            <button className="bg-transparent border-0 cursor-pointer text-gray-500 hover:text-gray-700 transition-colors" onClick={resetBulkRegistrationSummaryModal} title="Close form">
                                <XCircle size={14} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-green-600 font-normal text-xs">Successfully registered: <span className="font-normal">{bulkRegistrationSummary.registeredCount}</span> users.</p>
                            <p className="text-green-600 font-normal text-xs">Successfully updated: <span className="font-normal">{bulkRegistrationSummary.updatedCount}</span> users.</p>
                            {bulkRegistrationSummary.errorsList.length > 0 && (
                                <div className="p-2 bg-red-50 text-red-800 rounded-md border border-red-300">
                                    <h4 className="font-normal mb-1.5 text-xs">Errors ({bulkRegistrationSummary.errorsList.length}):</h4>
                                    <div className="max-h-24 overflow-y-auto">
                                        <ul className="list-disc pl-2 text-[11px]">
                                            {bulkRegistrationSummary.errorsList.map((err, index) => (
                                                <li key={index}>{typeof err === 'string' ? err : `Row ${err.originalIndex}: ${err.errors.join(', ')}`}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end mt-4">
                            <button
                                className="inline-flex items-center justify-center px-3 py-1.5 rounded-md font-normal text-sm transition-all duration-300 bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                                onClick={resetBulkRegistrationSummaryModal}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showConfirmDeleteModal && accountUserToDelete && (
                <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center backdrop-blur-sm" onClick={cancelDelete}>
                    <div className="bg-white p-4 rounded-md shadow-sm w-full max-w-lg transition-transform transform scale-100 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-200">
                            <h3 className="text-sm font-normal text-gray-800 flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-red-500" />
                                Confirm Deletion
                            </h3>
                        </div>
                        <p className="mb-3 text-gray-700 text-xs">
                            Are you sure you want to delete the user "<span className="font-normal">{accountUserToDelete.user_name}</span>" (ID: {accountUserToDelete.id})?
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                className="inline-flex items-center px-3 py-1.5 rounded-md font-normal transition-all duration-300 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 shadow-sm"
                                onClick={cancelDelete}
                            >
                                Cancel
                            </button>
                            <button
                                className="inline-flex items-center px-3 py-1.5 rounded-md font-normal transition-all duration-300 bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
                                onClick={confirmDeleteAccountUser}
                                disabled={loading || !canDeleteUsers}
                                title={!canDeleteUsers ? deletePermissionDeniedMessage : "Confirm deletion of user"}
                            >
                                {loading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserTable;
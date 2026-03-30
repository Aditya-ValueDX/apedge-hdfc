import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { X, ArrowLeft, GitCompare, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import axios from '../../utils/authInterceptor';
import { parseCustomValues } from '../../utils/customValuesParser';


import InvoiceFormUI from '../common/formUI/InvoiceFormUI';
import StatusBadge from '../common/StatusBadge';
import MasterKeySearchPopup from '../common/MasterKeySearchPopup';
// import '../styles/Editor.css'; // Removed as no longer needed
import { canUserEdit } from '../../permissions';
import { apiBaseUrl } from '../../config/apiConfig';
import { encryptId, decryptId } from '../../utils/cryptoUtils';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';

// Set up the PDF.js worker with a stable CDN link
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

// --- Normalization Helper ---
const normalizeKey = (key) => {
    if (typeof key !== 'string') return '';
    return key
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\b(no|num)\b/g, 'number')
        .replace(/\b(dt)\b/g, 'date')
        .replace(/\b(qty)\b/g, 'quantity')
        .replace(/\b(hrs)\b/g, 'hours')
        .replace(/[^a-z0-9]/g, '');
};

// Helper function to normalize error description keys
const normalizeErrorDesc = (errorDesc) => {
    if (!errorDesc || typeof errorDesc !== 'object') return errorDesc;

    const normalized = {};
    for (const [key, value] of Object.entries(errorDesc)) {
        const lowerKey = key.toLowerCase();
        normalized[lowerKey] = value;
    }
    return normalized;
};

// --- Custom Parser for Non-Standard Line Item Strings ---
const parseCustomLineItemString = (lineItemString) => {
    if (!lineItemString || typeof lineItemString !== 'string') {
        return [];
    }
    let cleanedString = lineItemString.trim();
    if (cleanedString.startsWith('[') && cleanedString.endsWith(']')) {
        cleanedString = cleanedString.substring(1, cleanedString.length - 1);
    }
    const itemStrings = cleanedString.split(/},\s*{/);
    return itemStrings.map(itemStr => {
        const cleanItemStr = itemStr.replace(/[{}]/g, '').trim();
        const item = {};
        cleanItemStr.split(',').forEach(pair => {
            const parts = pair.split('=');
            if (parts.length === 2) {
                const key = parts[0].trim();
                let value = parts[1].trim();
                if (!isNaN(Number(value)) && value.trim() !== '') {
                    value = Number(value);
                }
                item[key] = value;
            }
        });
        return item;
    });
};

const Editor = () => {
    const { invoiceId: encryptedInvoiceId } = useParams();
    const location = useLocation();
    // invoiceId here is actually the doc_id from the URL
    const invoiceId = useMemo(() => decryptId(encryptedInvoiceId), [encryptedInvoiceId]);
    const navigate = useNavigate();
    const [formData, setFormData] = useState(null);
    const [fieldConfig, setFieldConfig] = useState([]);
    const [invoicePath, setInvoicePath] = useState('');
    const [loading, setLoading] = useState(true);
    const [errors, setErrors] = useState({});
    const [lineItemTableHeaders, setLineItemTableHeaders] = useState([]);
    const [lineItemColumnProperties, setLineItemColumnProperties] = useState({});
    // Per-array table configs: { [arrayFieldName]: { displayName, headers, columnProperties } }
    const [arrayTableConfigs, setArrayTableConfigs] = useState({});
    const [fileUrl, setFileUrl] = useState(null);
    const [fileType, setFileType] = useState(null); // State for file type
    const [rejectionComment, setRejectionComment] = useState('');
    const [existingComments, setExistingComments] = useState(''); // State to store existing comments from DB
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [pageScale, setPageScale] = useState(1.5);
    const [invoicePk, setInvoicePk] = useState(null);
    const [docId, setDocId] = useState(null);
    const [firstInvalidField, setFirstInvalidField] = useState(null);
    const [errorDesc, setErrorDesc] = useState(null); // Add errorDesc state

    // Add state for invoice status
    const [invoiceStatus, setInvoiceStatus] = useState('');

    // Add loading state for history and status updates
    const [processing, setProcessing] = useState(false);
    // Add state for process result messages
    const [processMessage, setProcessMessage] = useState('');
    const [processStatus, setProcessStatus] = useState(''); // 'success', 'error', 'warning'

    // Master Key Search Popup states
    const [masterKeyPopupOpen, setMasterKeyPopupOpen] = useState(false);
    const [masterKeyPopupField, setMasterKeyPopupField] = useState('');

    // Add state for rejection confirmation modal
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    // Add state for hold confirmation modal
    const [showHoldModal, setShowHoldModal] = useState(false);

    const user = useSelector(state => state.auth.user);
    const token = user.token; // Use token directly from Redux store
    const userRole = user?.role;

    // Check if the editor should be readonly based on location state
    // Exempt super_admin and tenant_admin roles from readonly restrictions
    const isReadonly = (userRole === 'super_admin' || userRole === 'tenant_admin') ? true : location.state?.readonly === true;
    // If readonly, user cannot edit regardless of their permissions
    const canEditInvoice = !isReadonly && (user ? canUserEdit(userRole, 'invoice_approve_reject') : false);

    const toTitleCase = useCallback((str) => {
        if (typeof str !== 'string' || !str) return '';
        // Add a space before an uppercase letter only if it is preceded by a lowercase letter or a number
        return str
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/^./, (char) => char.toUpperCase())
            .replace(/_/g, ' ');
    }, []);

    // A new helper function to format dates from various string formats to YYYY-MM-DD
    // Enhanced to handle timezone issues and validate date correctness
    const formatDateValue = useCallback((value) => {
        if (typeof value !== 'string' || !value.trim()) return '';

        // Parse various date formats
        let date;
        let expectedDay, expectedMonth, expectedYear;
        const trimmedValue = value.trim();

        // Handle various common date formats
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
            // Already in YYYY-MM-DD format
            const [year, month, day] = trimmedValue.split('-').map(Number);
            expectedYear = year;
            expectedMonth = month - 1; // month is 0-indexed
            expectedDay = day;
            date = new Date(year, expectedMonth, expectedDay);
        } else if (/^\d{2}-\d{2}-\d{4}$/.test(trimmedValue)) {
            // MM-DD-YYYY format
            const [month, day, year] = trimmedValue.split('-').map(Number);
            expectedYear = year;
            expectedMonth = month - 1;
            expectedDay = day;
            date = new Date(expectedYear, expectedMonth, expectedDay);
        } else if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(trimmedValue)) {
            // DD-MMM-YYYY format (e.g., 31-Dec-2025)
            const months = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
            };
            const [day, month, year] = trimmedValue.split('-');
            const monthIndex = months[month.toLowerCase().substring(0, 3)];
            if (monthIndex === undefined) return '';
            expectedYear = Number(year);
            expectedMonth = monthIndex;
            expectedDay = Number(day);
            date = new Date(expectedYear, expectedMonth, expectedDay);
        } else if (/^\d{2}-[A-Za-z]+-\d{4}$/.test(trimmedValue)) {
            // DD-MMMM-YYYY format (e.g., 31-December-2025)
            const months = {
                'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
                'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
            };
            const [day, month, year] = trimmedValue.split('-');
            const monthIndex = months[month.toLowerCase()];
            if (monthIndex === undefined) return '';
            expectedYear = Number(year);
            expectedMonth = monthIndex;
            expectedDay = Number(day);
            date = new Date(expectedYear, expectedMonth, expectedDay);
        } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmedValue)) {
            // YYYY/MM/DD format
            const [year, month, day] = trimmedValue.split('/').map(Number);
            expectedYear = year;
            expectedMonth = month - 1;
            expectedDay = day;
            date = new Date(expectedYear, expectedMonth, expectedDay);
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmedValue)) {
            // MM/DD/YYYY or M/D/YYYY format
            const [month, day, year] = trimmedValue.split('/').map(Number);
            expectedYear = year;
            expectedMonth = month - 1;
            expectedDay = day;
            date = new Date(expectedYear, expectedMonth, expectedDay);
        } else {
            // Try to parse with the built-in Date constructor
            date = new Date(trimmedValue);
            // For this case, we can't easily validate, so we'll do a basic check
            if (isNaN(date.getTime())) {
                return '';
            }
            // Set to start of day for comparison
            date.setHours(0, 0, 0, 0);

            // Format as YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
            return '';
        }

        // Critical validation: Check if the parsed date matches what the user intended
        // This catches invalid dates like Feb 31, Apr 31, etc.
        if (date.getFullYear() !== expectedYear ||
            date.getMonth() !== expectedMonth ||
            date.getDate() !== expectedDay) {
            return '';
        }

        // Format as YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }, []);

    const clearRejectionCommentError = useCallback(() => {
        if (errors.rejectionComment) {
            const newErrors = { ...errors };
            delete newErrors.rejectionComment;
            setErrors(newErrors);
        }
    }, [errors, setErrors]);

    const validateForm = useCallback((action = 'default') => {
        const newErrors = {};
        let isValid = true;
        let firstInvalidFieldId = null;

        if (action === 'reject' || action === 'hold') {
            if (!rejectionComment || rejectionComment.trim() === '') {
                const commentError = action === 'hold' ? 'Hold reason is required.' : 'Rejection reason is required.';
                newErrors.rejectionComment = commentError;
                firstInvalidFieldId = 'rejectionComment';
                isValid = false;
            }
            setErrors(newErrors);
            return { isValid, firstInvalidFieldId };
        }

        // --- Dropdown validation: Check all dropdown fields ---
        // This validation ensures dropdown values match predefined options
        const dropdownFields = fieldConfig.filter(f =>
            (f.field_type === 'dropdown' || (f.custom_values && f.custom_values.startsWith('Drop('))) &&
            !f.parent &&
            (f.is_visible ?? true)
        );

        dropdownFields.forEach((fieldConfigItem) => {
            const fieldName = fieldConfigItem.field_name;
            const value = formData[fieldName];

            // Skip if field is empty
            if (value === null || value === undefined || String(value).trim() === '') {
                return;
            }

            // Parse dropdown options
            let dropdownOptions = [];
            if (fieldConfigItem.custom_values) {
                const parsed = parseCustomValues(fieldConfigItem.custom_values);
                if (parsed.type === 'Drop') {
                    dropdownOptions = parsed.options || [];
                }
            }

            // Check if value exists in dropdown options
            if (dropdownOptions.length > 0 && !dropdownOptions.includes(value) && fieldConfigItem.is_required) {
                newErrors[fieldName] = 'Please select a value';
                isValid = false;
                if (!firstInvalidFieldId) {
                    firstInvalidFieldId = fieldName;
                }
            }
        });

        // --- Dropdown validation for line items ---
        // This validation ensures dropdown values in line items match predefined options
        const lineItemDropdownFields = fieldConfig.filter(f =>
            (f.field_type === 'dropdown' || (f.custom_values && f.custom_values.startsWith('Drop('))) &&
            f.parent &&
            (f.is_visible ?? true)
        );

        if (formData.lineItems && Array.isArray(formData.lineItems)) {
            formData.lineItems.forEach((item, itemIndex) => {
                lineItemDropdownFields.forEach((fieldConfigItem) => {
                    const fieldName = fieldConfigItem.field_name;
                    const value = item[fieldName];

                    // Skip if field is empty
                    if (value === null || value === undefined || String(value).trim() === '') {
                        return;
                    }

                    // Parse dropdown options
                    let dropdownOptions = [];
                    if (fieldConfigItem.custom_values) {
                        const parsed = parseCustomValues(fieldConfigItem.custom_values);
                        if (parsed.type === 'Drop') {
                            dropdownOptions = parsed.options || [];
                        }
                    }

                    // Check if value exists in dropdown options
                    if (dropdownOptions.length > 0 && !dropdownOptions.includes(value)) {
                        newErrors.lineItems ??= [];
                        newErrors.lineItems[itemIndex] ??= {};
                        // newErrors.lineItems[itemIndex][fieldName] = `${toTitleCase(fieldName)} value "${value}" is not in the list of valid options.`;
                        isValid = false;
                        if (!firstInvalidFieldId) {
                            firstInvalidFieldId = `line-item-${itemIndex}-${fieldName}`;
                        }
                    }
                });
            });
        }

        // --- Normal validation (for approve / send to reconciliation) ---
        // Filter for required and visible fields for immediate validation feedback
        const visibleRequiredFields = fieldConfig.filter(f => f.is_required && !f.parent && (f.is_visible ?? true));
        visibleRequiredFields.forEach((fieldConfigItem) => {
            const fieldName = fieldConfigItem.field_name;
            const value = formData[fieldName];
            const isEmpty = value === null || value === undefined || String(value).trim() === '';

            if (isEmpty) {
                newErrors[fieldName] = `${toTitleCase(fieldName)} is required.`;
                isValid = false;
                if (!firstInvalidFieldId) {
                    firstInvalidFieldId = fieldName;
                }
            }

            // Check for invalid date values
            if (fieldConfigItem.field_type === 'date' && typeof value === 'string' && value.trim() !== '') {
                const formattedDate = formatDateValue(value);
                if (formattedDate === '') {
                    // Provide more specific error messages for invoice_date field
                    if (fieldName === 'invoice_date') {
                        const testDate = new Date(value);
                        if (!isNaN(testDate.getTime())) {
                            newErrors[fieldName] = "Invalid invoice date. Please check the day/month combination.";
                        } else {
                            newErrors[fieldName] = "Invalid invoice date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.";
                        }
                    } else {
                        const testDate = new Date(value);
                        if (!isNaN(testDate.getTime())) {
                            newErrors[fieldName] = "Invalid date. Please check the day/month combination.";
                        } else {
                            newErrors[fieldName] = "Invalid date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.";
                        }
                    }
                    isValid = false;
                    if (!firstInvalidFieldId) {
                        firstInvalidFieldId = fieldName;
                    }
                }
            }
        });

        // Check for any invalid date values in non-required fields
        // Only check visible fields to reduce noise for the user
        const dateFields = fieldConfig.filter(f => f.field_type === 'date' && !f.parent && (f.is_visible ?? true));
        dateFields.forEach((fieldConfigItem) => {
            const fieldName = fieldConfigItem.field_name;
            const value = formData[fieldName];

            // Skip if field is empty or already has an error from the required check
            if (value === null || value === undefined || String(value).trim() === '' || newErrors[fieldName]) {
                return;
            }

            // Check for invalid date values
            if (typeof value === 'string' && value.trim() !== '') {
                const formattedDate = formatDateValue(value);
                if (formattedDate === '') {
                    // Provide more specific error messages for invoice_date field
                    if (fieldName === 'invoice_date') {
                        const testDate = new Date(value);
                        if (!isNaN(testDate.getTime())) {
                            newErrors[fieldName] = "Invalid invoice date. Please check the day/month combination.";
                        } else {
                            newErrors[fieldName] = "Invalid invoice date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.";
                        }
                    } else {
                        const testDate = new Date(value);
                        if (!isNaN(testDate.getTime())) {
                            newErrors[fieldName] = "Invalid date. Please check the day/month combination.";
                        } else {
                            newErrors[fieldName] = "Invalid date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.";
                        }
                    }
                    isValid = false;
                    if (!firstInvalidFieldId) {
                        firstInvalidFieldId = fieldName;
                    }
                }
            }
        });

        // Additional validation: Check all fields in formData, not just those in fieldConfig
        // This ensures we catch any invalid dates that might have been loaded from the database
        // We only check fields that are visible to prevent user confusion
        const visibleFieldNames = new Set(fieldConfig.filter(f => !f.parent && (f.is_visible ?? true)).map(f => f.field_name));
        Object.keys(formData).forEach((fieldName) => {
            // Only validate if the field is configured as visible or if it's already flagged for error
            if (!visibleFieldNames.has(fieldName) && !newErrors[fieldName]) {
                return;
            }

            const value = formData[fieldName];

            // Skip if field is empty or not a string
            if (value === null || value === undefined || typeof value !== 'string' || value.trim() === '') {
                return;
            }

            // Check if this is a date field by looking at the field name
            // This is a fallback for cases where fieldConfig might not include all fields
            if (fieldName.toLowerCase().includes('date')) {
                const formattedDate = formatDateValue(value);
                if (formattedDate === '') {
                    // Only add error if it's not already there
                    if (!newErrors[fieldName]) {
                        const testDate = new Date(value);
                        if (!isNaN(testDate.getTime())) {
                            newErrors[fieldName] = "Invalid date. Please check the day/month combination.";
                        } else {
                            newErrors[fieldName] = "Invalid date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.";
                        }
                        isValid = false;
                        if (!firstInvalidFieldId) {
                            firstInvalidFieldId = fieldName;
                        }
                    }
                }
            }

            // Check if this is a dropdown field that might not be in fieldConfig
            // This handles cases where extracted data contains values not in the dropdown options
            const fieldConfigItem = fieldConfig.find(f => f.field_name === fieldName);
            if (fieldConfigItem &&
                (fieldConfigItem.field_type === 'dropdown' ||
                    (fieldConfigItem.custom_values && fieldConfigItem.custom_values.startsWith('Drop(')))) {

                // Parse dropdown options
                let dropdownOptions = [];
                if (fieldConfigItem.custom_values) {
                    const parsed = parseCustomValues(fieldConfigItem.custom_values);
                    if (parsed.type === 'Drop') {
                        dropdownOptions = parsed.options || [];
                    }
                }

                // Check if value exists in dropdown options
                if (dropdownOptions.length > 0 && !dropdownOptions.includes(value)) {
                    // Only add error if it's not already there
                    if (!newErrors[fieldName] && fieldConfigItem.is_required) {
                        newErrors[fieldName] = `${toTitleCase(fieldName)} value "${value}" is not in the list of valid options.`;
                        isValid = false;
                        if (!firstInvalidFieldId) {
                            firstInvalidFieldId = fieldName;
                        }
                    }
                }
            }
        });

        // Only consider required line items that are visible
        const requiredLineItemFields = fieldConfig.filter(f => f.is_required && f.parent && (f.is_visible ?? true));
        // Only consider all line item date fields that are visible
        const allLineItemDateFields = fieldConfig.filter(f => f.field_type === 'date' && f.parent && (f.is_visible ?? true));
        // Only consider all line item dropdown fields that are visible
        const allLineItemDropdownFields = fieldConfig.filter(f =>
            (f.field_type === 'dropdown' || (f.custom_values && f.custom_values.startsWith('Drop('))) &&
            f.parent &&
            (f.is_visible ?? true)
        );

        if (formData.lineItems && Array.isArray(formData.lineItems)) {
            formData.lineItems.forEach((item, itemIndex) => {
                // Check required fields
                requiredLineItemFields.forEach((requiredConfigItem) => {
                    const headerKey = requiredConfigItem.field_name;
                    const value = item[headerKey];
                    const fieldTitle = requiredConfigItem.display_name || toTitleCase(headerKey);
                    const isEmpty = value === null || value === undefined || String(value).trim() === '';

                    if (isEmpty) {
                        newErrors.lineItems ??= [];
                        newErrors.lineItems[itemIndex] ??= {};
                        newErrors.lineItems[itemIndex][headerKey] = `${fieldTitle} is required.`;
                        isValid = false;
                        if (!firstInvalidFieldId) {
                            firstInvalidFieldId = `line-item-${itemIndex}-${headerKey}`;
                        }
                    }

                    // Check for invalid date values in required line items
                    if (requiredConfigItem.field_type === 'date' && typeof value === 'string' && value.trim() !== '') {
                        const formattedDate = formatDateValue(value);
                        if (formattedDate === '') {
                            // Provide more specific error messages for invoice_date field
                            if (headerKey === 'invoice_date') {
                                const testDate = new Date(value);
                                if (!isNaN(testDate.getTime())) {
                                    newErrors.lineItems ??= [];
                                    newErrors.lineItems[itemIndex] ??= {};
                                    newErrors.lineItems[itemIndex][headerKey] = "Invalid invoice date. Please check the day/month combination.";
                                } else {
                                    newErrors.lineItems ??= [];
                                    newErrors.lineItems[itemIndex] ??= {};
                                    newErrors.lineItems[itemIndex][headerKey] = "Invalid invoice date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.";
                                }
                            } else {
                                const testDate = new Date(value);
                                if (!isNaN(testDate.getTime())) {
                                    newErrors.lineItems ??= [];
                                    newErrors.lineItems[itemIndex] ??= {};
                                    newErrors.lineItems[itemIndex][headerKey] = "Invalid date. Please check the day/month combination.";
                                } else {
                                    newErrors.lineItems ??= [];
                                    newErrors.lineItems[itemIndex] ??= {};
                                    newErrors.lineItems[itemIndex][headerKey] = "Invalid date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.";
                                }
                            }
                            isValid = false;
                            if (!firstInvalidFieldId) {
                                firstInvalidFieldId = `line-item-${itemIndex}-${headerKey}`;
                            }
                        }
                    }
                });

                // Check all date fields (including non-required ones)
                allLineItemDateFields.forEach((dateConfigItem) => {
                    const headerKey = dateConfigItem.field_name;
                    const value = item[headerKey];

                    // Skip if field is empty or already has an error
                    if (value === null || value === undefined || String(value).trim() === '' || (newErrors.lineItems?.[itemIndex]?.[headerKey])) {
                        return;
                    }

                    // Check for invalid date values in line items
                    if (typeof value === 'string' && value.trim() !== '') {
                        const formattedDate = formatDateValue(value);
                        if (formattedDate === '') {
                            // Provide more specific error messages for invoice_date field
                            if (headerKey === 'invoice_date') {
                                const testDate = new Date(value);
                                if (!isNaN(testDate.getTime())) {
                                    newErrors.lineItems ??= [];
                                    newErrors.lineItems[itemIndex] ??= {};
                                    newErrors.lineItems[itemIndex][headerKey] = "Invalid invoice date. Please check the day/month combination.";
                                } else {
                                    newErrors.lineItems ??= [];
                                    newErrors.lineItems[itemIndex] ??= {};
                                    newErrors.lineItems[itemIndex][headerKey] = "Invalid invoice date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.";
                                }
                            } else {
                                const testDate = new Date(value);
                                if (!isNaN(testDate.getTime())) {
                                    newErrors.lineItems ??= [];
                                    newErrors.lineItems[itemIndex] ??= {};
                                    newErrors.lineItems[itemIndex][headerKey] = "Invalid date. Please check the day/month combination.";
                                } else {
                                    newErrors.lineItems ??= [];
                                    newErrors.lineItems[itemIndex] ??= {};
                                    newErrors.lineItems[itemIndex][headerKey] = "Invalid date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.";
                                }
                            }
                            isValid = false;
                            if (!firstInvalidFieldId) {
                                firstInvalidFieldId = `line-item-${itemIndex}-${headerKey}`;
                            }
                        }
                    }
                });

                // Check all dropdown fields (including non-required ones)
                allLineItemDropdownFields.forEach((dropdownConfigItem) => {
                    const headerKey = dropdownConfigItem.field_name;
                    const value = item[headerKey];

                    // Skip if field is empty or already has an error
                    if (value === null || value === undefined || String(value).trim() === '' || (newErrors.lineItems?.[itemIndex]?.[headerKey])) {
                        return;
                    }

                    // Parse dropdown options
                    let dropdownOptions = [];
                    if (dropdownConfigItem.custom_values) {
                        const parsed = parseCustomValues(dropdownConfigItem.custom_values);
                        if (parsed.type === 'Drop') {
                            dropdownOptions = parsed.options || [];
                        }
                    }

                    // Check if value exists in dropdown options
                    if (dropdownOptions.length > 0 && !dropdownOptions.includes(value)) {
                        newErrors.lineItems ??= [];
                        newErrors.lineItems[itemIndex] ??= {};
                        // newErrors.lineItems[itemIndex][headerKey] = `${dropdownConfigItem.display_name || toTitleCase(headerKey)} value "${value}" is not in the list of valid options.`;
                        isValid = false;
                        if (!firstInvalidFieldId) {
                            firstInvalidFieldId = `line-item-${itemIndex}-${headerKey}`;
                        }
                    }
                });
            });
        }

        setErrors(newErrors);
        return { isValid, firstInvalidFieldId, errors: newErrors };
    }, [formData, fieldConfig, toTitleCase, rejectionComment]);

    const fetchInvoiceFile = async (docId, authHeaders, tenantQuery) => {
        try {
            const docResponse = await axios.get(`/api/v1/tables/ap_documents?doc_id=eq.${docId}${tenantQuery}`, {
                headers: authHeaders
            });

            if (!docResponse.data || !docResponse.data[0]?.file_path) return;

            const filePath = docResponse.data[0].file_path;
            setInvoicePath(filePath);

            const extension = filePath.split('.').pop().toLowerCase();
            setFileType(extension); // Set file type

            const fullUrl = `/api/${filePath.replace(/^\/+/, "")}`;
            const fileResponse = await axios.get(fullUrl, {
                headers: {
                    Authorization: authHeaders.Authorization,
                },
                responseType: 'blob'
            });

            const blob = new Blob([fileResponse.data]);
            const url = URL.createObjectURL(blob);

            setFileUrl(url); // Set the blob URL for all file types
        } catch (error) {
            toast.error("Failed to load invoice preview.", {
                position: "top-right",
                autoClose: 3000
            });
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!invoiceId || !user) {
                setLoading(false);
                return;
            }

            try {
                const authHeaders = {
                    'Authorization': `Bearer ${token}`
                };

                // Super admin doesn't need tenant_id
                const isSuperAdmin = user.role === 'super_admin';
                const tenantQuery = isSuperAdmin ? '' : `&tenant_id=eq.${user.tenantId}`;
                const tenantCheck = isSuperAdmin ? true : !!user.tenantId;

                if (!tenantCheck) {
                    throw new Error('❌ Missing tenant ID');
                }

                // --- API Call 1: Fetch Invoice Data First to Check for field_structure ---
                const invoiceResponse = await axios.get(`/api/v1/tables/ap_invoices?invoice_id=eq.${invoiceId}${tenantQuery}&select=*,error_desc,tenant_id`, {
                    headers: authHeaders
                });
                if (!invoiceResponse.data || !Array.isArray(invoiceResponse.data) || invoiceResponse.data.length === 0) throw new Error('Failed to fetch invoice.');
                const invoice = invoiceResponse.data[0];

                // Save invoice PK
                if (invoice?.invoice_id) {
                    setInvoicePk(invoice.invoice_id);
                } else {
                    throw new Error('Invoice primary key (invoice_id) not found.');
                }

                // Save invoice status
                if (invoice?.status) {
                    setInvoiceStatus(invoice.status);
                }

                // Save error_desc for displaying in the form
                if (invoice?.error_desc) {
                    try {
                        const parsedErrorDesc = typeof invoice.error_desc.value === 'string'
                            ? JSON.parse(invoice.error_desc.value)
                            : invoice.error_desc.value;
                        setErrorDesc(normalizeErrorDesc(parsedErrorDesc));
                    } catch (e) {
                        setErrorDesc(null);
                    }
                }

                // Save existing comments from the invoice
                if (invoice?.comments) {
                    setExistingComments(invoice.comments);
                    // If rejectionComment is empty, initialize it with existing comments
                    if (!rejectionComment) {
                        setRejectionComment(invoice.comments);
                    }
                }

                // ✅ Save doc_id for later document patch
                if (invoice?.doc_id) {
                    setDocId(invoice.doc_id);
                }

                let fieldConfigurations = [];

                // Check if field_structure exists in the invoice data
                if (invoice?.field_structure) {
                    let rawFieldStructure = invoice.field_structure;

                    // Handle different data types for field_structure
                    let parsedFieldStructure = [];

                    // Handle the case where field_structure is an object with a value property
                    if (typeof rawFieldStructure === 'object' && rawFieldStructure !== null && 'value' in rawFieldStructure) {
                        rawFieldStructure = rawFieldStructure.value;
                    }

                    if (typeof rawFieldStructure === 'string') {
                        try {
                            // Parse JSON string
                            parsedFieldStructure = JSON.parse(rawFieldStructure);
                        } catch (parseError) {
                            // Fall back to ap_field_config
                            rawFieldStructure = null;
                        }
                    } else if (Array.isArray(rawFieldStructure)) {
                        parsedFieldStructure = rawFieldStructure;
                    } else if (typeof rawFieldStructure === 'object' && rawFieldStructure !== null) {
                        // If it's an object, try to convert it to an array
                        parsedFieldStructure = Object.values(rawFieldStructure);
                    }

                    if (parsedFieldStructure && Array.isArray(parsedFieldStructure) && parsedFieldStructure.length > 0) {
                        fieldConfigurations = parsedFieldStructure;
                    } else {
                        // Special handling for super_admin users
                        let configQuery = tenantQuery;
                        if (isSuperAdmin && invoice?.tenant_id) {
                            // For super admins, fetch field configurations for the specific tenant of the invoice
                            configQuery = `&tenant_id=eq.${invoice.tenant_id}`;
                        }

                        // Fallback to fetching from ap_field_config table
                        const configResponse = await axios.get(`/api/v1/tables/ap_field_config?${configQuery}`, {
                            headers: authHeaders
                        });
                        if (!configResponse.data) throw new Error('Failed to fetch field configurations.');
                        fieldConfigurations = configResponse.data;
                    }

                    // Ensure fieldConfigurations has the correct property names
                    // Map from UI naming (name, type) to database naming (field_name, field_type) if needed
                    // fieldConfigurations = fieldConfigurations.map(field => {
                    //     // Create a new object with proper property names
                    //     const mappedField = {
                    //         // Map field_name
                    //         field_name: field.field_name || field.name || field.label || '',
                    //         // Map field_type
                    //         field_type: field.field_type || field.type || 'text',
                    //         // Map other properties
                    //         is_required: field.is_required || field.required || false,
                    //         custom_values: field.custom_values || field.customValues || '',
                    //         display_name: field.display_name || field.displayName || field.label || '',
                    //         parent: field.parent || field.group || '',
                    //         sequence: field.sequence || field.order || 0,
                    //         use_llm: field.use_llm || field.useLlm || false,
                    //         // Map is_visible, defaulting to true if missing
                    //         is_visible: field.hasOwnProperty('is_visible') ? field.is_visible : (field.hasOwnProperty('visible') ? field.visible : true)
                    //     };
                    //     // Copy any other properties that might exist
                    //     Object.keys(field).forEach(key => {
                    //         if (!(key in mappedField)) {
                    //             mappedField[key] = field[key];
                    //         }
                    //     });

                    //     return mappedField;
                    // });
                } else {
                    // Special handling for super_admin users
                    let configQuery = tenantQuery;
                    if (isSuperAdmin && invoice?.tenant_id) {
                        // For super admins, fetch field configurations for the specific tenant of the invoice
                        configQuery = `&tenant_id=eq.${invoice.tenant_id}`;
                    }

                    // Fallback to fetching from ap_field_config table
                    const configResponse = await axios.get(`/api/v1/tables/ap_field_config?${configQuery}`, {
                        headers: authHeaders
                    });
                    if (!configResponse.data) throw new Error('Failed to fetch field configurations.');
                    fieldConfigurations = configResponse.data;

                    fieldConfigurations = fieldConfigurations.map(field => {
                        // 1. Parse meta_config if it exists and is a valid JSON string
                        let metaValues = {};
                        if (field.meta_config && typeof field.meta_config.value === 'string') {
                            try {
                                metaValues = JSON.parse(field.meta_config.value);
                            } catch (e) {
                                console.error("Error parsing meta_config for field:", field.field_name, e);
                            }
                        }

                        // 2. Helper to convert string "true"/"false" to actual boolean
                        const toBool = (val) => val === true || val === 'true';

                        const mappedField = {
                            field_name: field.field_name || field.name || field.label || '',
                            field_type: field.field_type || field.type || 'text',
                            // Priority: meta_config > direct field property > default false
                            is_required: metaValues.hasOwnProperty('required')
                                ? toBool(metaValues.required)
                                : (field.is_required || field.required || false),
                            custom_values: field.custom_values || field.customValues || '',
                            display_name: field.display_name || field.displayName || field.label || '',
                            parent: field.parent || field.group || '',
                            sequence: field.sequence || field.order || 0,
                            use_llm: field.use_llm || field.useLlm || false,
                            // Priority: meta_config > direct field property > default true
                            is_visible: metaValues.hasOwnProperty('visible')
                                ? toBool(metaValues.visible)
                                : (field.hasOwnProperty('is_visible') ? field.is_visible : true),
                            is_readonly: metaValues.hasOwnProperty('readonly')
                                ? toBool(metaValues.readonly)
                                : false,
                        };

                        // Copy any other properties that might exist
                        Object.keys(field).forEach(key => {
                            if (!(key in mappedField)) {
                                mappedField[key] = field[key];
                            }
                        });

                        return mappedField;
                    });
                }
                // Ensure fieldConfigurations is an array before proceeding
                if (!Array.isArray(fieldConfigurations)) {
                    throw new Error('Field configurations are not in the expected array format.');
                }

                setFieldConfig(fieldConfigurations);

                // Extract data for form initialization
                let extractedData = {};
                if (invoice?.extracted_data) {
                    const parsed = typeof invoice.extracted_data.value === 'string'
                        ? JSON.parse(invoice.extracted_data.value)
                        : invoice.extracted_data;
                    extractedData = parsed.extracted_data || parsed;
                }

                const dataMap = new Map(Object.entries(extractedData));
                let rawLineItems = [];
                let lineItemKey = null;

                for (const [key, value] of dataMap.entries()) {
                    let potentialItems = null;

                    if (typeof value === 'string' && (value.trim().startsWith('[') || value.trim().startsWith('{'))) {
                        try {
                            const parsedValue = JSON.parse(value);
                            if (Array.isArray(parsedValue) && parsedValue.length > 0 && typeof parsedValue[0] === 'object') {
                                potentialItems = parsedValue;
                            }
                        } catch (e) {
                            const customParsed = parseCustomLineItemString(value);
                            if (customParsed.length > 0 && typeof customParsed[0] === 'object') {
                                potentialItems = customParsed;
                            }
                        }
                    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                        potentialItems = value;
                    }

                    if (potentialItems) {
                        rawLineItems = potentialItems;
                        lineItemKey = key;
                        break;
                    }
                }

                if (lineItemKey) {
                    dataMap.delete(lineItemKey);
                }

                const normalizedDataMap = new Map();
                for (const [key, value] of dataMap.entries()) {
                    const normalized = normalizeKey(key);
                    if (normalized) {
                        normalizedDataMap.set(normalized, value);
                    }
                }

                const initialFormData = {};
                // Ensure fieldConfigurations is an array before filtering
                if (Array.isArray(fieldConfigurations)) {
                    fieldConfigurations
                        .filter((f) => !f.parent)
                        .forEach((config) => {
                            const normalizedConfigKey = normalizeKey(config.field_name);
                            let value = normalizedDataMap.get(normalizedConfigKey) ?? '';

                            // For array fields, preserve the actual array data
                            if (config.field_type === 'array') {
                                // Check if the value is actually an array in the extracted data
                                if (Array.isArray(normalizedDataMap.get(normalizedConfigKey))) {
                                    value = normalizedDataMap.get(normalizedConfigKey);
                                } else if (normalizedDataMap.has(normalizedConfigKey) &&
                                    normalizedDataMap.get(normalizedConfigKey) !== '' &&
                                    normalizedDataMap.get(normalizedConfigKey) !== null &&
                                    normalizedDataMap.get(normalizedConfigKey) !== undefined) {
                                    // If it's not an array but has a value, preserve it
                                    value = normalizedDataMap.get(normalizedConfigKey);
                                } else {
                                    // Default to empty array for array-type fields
                                    value = [];
                                }
                            } else {
                                // Format values for non-array fields
                                if (config.field_type === 'date') {
                                    value = formatDateValue(value);
                                } else if (config.field_type === 'number' && typeof value === 'string') {
                                    value = value.replace(/,/g, '');
                                }
                            }

                            // Keep all values in formData, even for invisible fields, as required by the user
                            initialFormData[config.field_name] = value;
                        });
                }

                const poNumberFromOcr =
                    normalizedDataMap.get('ponumber') ||
                    normalizedDataMap.get('ordernumber') ||
                    '';
                if (poNumberFromOcr) {
                    initialFormData['po_number'] = poNumberFromOcr;
                }

                // Ensure fieldConfigurations is an array before filtering
                const lineItemConfigs = Array.isArray(fieldConfigurations)
                    ? fieldConfigurations.filter(f => f.parent)
                    : [];

                // Build a flat columnProps map and normalized key map (used for line item mapping)
                const columnProps = {};
                const normalizedKeyToOfficialKeyMap = new Map();
                if (Array.isArray(fieldConfigurations)) {
                    lineItemConfigs.forEach(config => {
                        columnProps[config.field_name] = {
                            title: config.display_name || toTitleCase(config.field_name),
                            type: config.field_type,
                            custom_values: config.custom_values,
                            display_name: config.display_name,
                            is_visible: config.is_visible ?? true,
                        };
                        normalizedKeyToOfficialKeyMap.set(normalizeKey(config.field_name), config.field_name);
                        if (config.display_name) {
                            normalizedKeyToOfficialKeyMap.set(normalizeKey(config.display_name), config.field_name);
                        }
                    });
                }

                // --- Build per-array table configs ---
                // Find all array-type fields (the parent arrays)
                const arrayFields = Array.isArray(fieldConfigurations)
                    ? fieldConfigurations.filter(f => f.field_type === 'array' && !f.parent)
                    : [];

                const newArrayTableConfigs = {};
                arrayFields.forEach(arrayField => {
                    const arrayFieldName = arrayField.field_name;
                    // Children are fields whose parent matches this array field name
                    const childConfigs = lineItemConfigs
                        .filter(f => f.parent === arrayFieldName)
                        .sort((a, b) => (a.sequence ?? 999999) - (b.sequence ?? 999999));

                    const visibleHeaders = childConfigs
                        .filter(c => c.is_visible ?? true)
                        .map(c => c.field_name);

                    const childColumnProps = {};
                    childConfigs.forEach(config => {
                        childColumnProps[config.field_name] = columnProps[config.field_name] || {
                            title: config.display_name || toTitleCase(config.field_name),
                            type: config.field_type,
                            custom_values: config.custom_values,
                            display_name: config.display_name,
                            is_visible: config.is_visible ?? true,
                        };
                    });

                    newArrayTableConfigs[arrayFieldName] = {
                        displayName: arrayField.display_name || toTitleCase(arrayFieldName),
                        headers: visibleHeaders,
                        columnProperties: childColumnProps,
                        allFieldNames: childConfigs.map(c => c.field_name),
                    };
                });

                // Fallback: if no array fields defined but there are child configs (legacy),
                // group them under a virtual "lineItems" array
                if (arrayFields.length === 0 && lineItemConfigs.length > 0) {
                    const sortedLineItemConfigs = lineItemConfigs.sort((a, b) =>
                        (a.sequence ?? 999999) - (b.sequence ?? 999999)
                    );
                    const orderedLineItemHeaders = sortedLineItemConfigs
                        .filter(config => config.is_visible ?? true)
                        .map(config => config.field_name);
                    newArrayTableConfigs['lineItems'] = {
                        displayName: 'Itemized Details',
                        headers: orderedLineItemHeaders,
                        columnProperties: columnProps,
                        allFieldNames: sortedLineItemConfigs.map(c => c.field_name),
                    };
                }

                setArrayTableConfigs(newArrayTableConfigs);
                // Also keep legacy state for backward compat (validation etc.)
                const sortedLineItemConfigs = lineItemConfigs.sort((a, b) =>
                    (a.sequence ?? 999999) - (b.sequence ?? 999999)
                );
                const orderedLineItemHeaders = sortedLineItemConfigs
                    .filter(config => config.is_visible ?? true)
                    .map(config => config.field_name);
                setLineItemTableHeaders(orderedLineItemHeaders);
                setLineItemColumnProperties(columnProps);

                // Map raw line items to official keys
                if (rawLineItems.length > 0) {
                    const finalLineItems = rawLineItems.map(rawItem => {
                        const mappedItem = {};
                        for (const [rawKey, rawValue] of Object.entries(rawItem)) {
                            const officialKey = normalizedKeyToOfficialKeyMap.get(normalizeKey(rawKey));
                            if (officialKey) {
                                mappedItem[officialKey] = rawValue;
                            }
                        }

                        const completeItem = {};
                        const allLineItemFieldNames = lineItemConfigs.map(config => config.field_name);
                        allLineItemFieldNames.forEach(header => {
                            let value = mappedItem[header] ?? '';
                            const fieldType = columnProps[header]?.type;
                            if (fieldType === 'date') {
                                value = formatDateValue(value);
                            } else if (fieldType === 'number' && typeof value === 'string') {
                                value = value.replace(/,/g, '');
                            }
                            completeItem[header] = value;
                        });
                        return completeItem;
                    });
                    initialFormData.lineItems = finalLineItems;
                } else {
                    initialFormData.lineItems = [];
                }

                // Also store per-array data in formData for multi-array support
                // Each array field in the config gets its own key in formData
                arrayFields.forEach(arrayField => {
                    const arrayFieldName = arrayField.field_name;
                    const normalizedArrayKey = normalizeKey(arrayFieldName);
                    // Try to find data by normalized key match
                    let arrayData = [];
                    for (const [key, value] of dataMap.entries()) {
                        if (normalizeKey(key) === normalizedArrayKey && Array.isArray(value)) {
                            arrayData = value;
                            break;
                        }
                    }
                    // Also check extracted data directly
                    if (arrayData.length === 0 && Array.isArray(extractedData[arrayFieldName])) {
                        arrayData = extractedData[arrayFieldName];
                    }
                    // Map array items to official keys
                    if (arrayData.length > 0) {
                        const config = newArrayTableConfigs[arrayFieldName];
                        if (config) {
                            initialFormData[arrayFieldName] = arrayData.map(rawItem => {
                                const completeItem = {};
                                config.allFieldNames.forEach(header => {
                                    let value = rawItem[header] ?? '';
                                    const fieldType = config.columnProperties[header]?.type;
                                    if (fieldType === 'date') value = formatDateValue(value);
                                    else if (fieldType === 'number' && typeof value === 'string') value = value.replace(/,/g, '');
                                    completeItem[header] = value;
                                });
                                return completeItem;
                            });
                        }
                    } else if (!initialFormData[arrayFieldName]) {
                        initialFormData[arrayFieldName] = [];
                    }
                });

                setFormData(initialFormData);

                // --- API Call 2: Fetch Document Path ---
                if (invoice?.doc_id) {
                    setDocId(invoice.doc_id);
                    // ✅ kick off file fetch immediately
                    fetchInvoiceFile(invoice.doc_id, authHeaders, tenantQuery);
                }

            } catch (error) {
                setFormData({});
                toast.error('Failed to load invoice data.', {
                    position: "top-right",
                    autoClose: 3000
                });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [invoiceId, user, toTitleCase, formatDateValue]);


    useEffect(() => {
        return () => {
            if (fileUrl) {
                URL.revokeObjectURL(fileUrl);
            }
        };
    }, [fileUrl]);

    const handleFieldChange = (fieldName, value) => {
        if (!canEditInvoice) {
            toast.error("You do not have permission to edit this invoice.", {
                position: "top-right",
                autoClose: 3000
            });
            return;
        }

        // Get the field configuration to check if it's a date field
        const fieldConfigItem = fieldConfig.find(f => f.field_name === fieldName);
        const isDateField = fieldConfigItem?.field_type === 'date';

        // Format the value if it's a date field
        let formattedValue = value;
        if (isDateField && typeof value === 'string') {
            formattedValue = formatDateValue(value);

            // If formatting results in an empty string, it means the date was invalid
            if (formattedValue === '' && value.trim() !== '') {
                const testDate = new Date(value);
                if (!isNaN(testDate.getTime())) {
                    toast.error("Invalid date. Please check the day/month combination.", {
                        position: "top-right",
                        autoClose: 3000
                    });
                } else {
                    toast.error("Invalid date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.", {
                        position: "top-right",
                        autoClose: 3000
                    });
                }
                return;
            }
        }

        setFormData((prevData) => ({ ...prevData, [fieldName]: formattedValue }));

        // Re-validate the form to clear errors for this field if it's now valid
        if (errors[fieldName]) {
            // Create a copy of the current errors
            const newErrors = { ...errors };

            // Check if the field is now valid (not empty for required fields)
            const isRequired = fieldConfigItem?.is_required;
            const isEmpty = formattedValue === null || formattedValue === undefined || String(formattedValue).trim() === '';

            // If it's not required or it's now filled, remove the error
            if (!isRequired || !isEmpty) {
                delete newErrors[fieldName];
                setErrors(newErrors);

                // Also clear firstInvalidField if it was this field
                if (firstInvalidField === fieldName) {
                    setFirstInvalidField(null);
                }
            }
        }
    };

    const handleLineItemChange = (itemIndex, fieldName, value, arrayFieldName = 'lineItems') => {
        if (!canEditInvoice) {
            toast.error("You do not have permission to edit line items.", {
                position: "top-right",
                autoClose: 3000
            });
            return;
        }

        // Get the field configuration to check if it's a date field
        const fieldConfigItem = fieldConfig.find(f => f.field_name === fieldName && f.parent);
        const isDateField = fieldConfigItem?.field_type === 'date';

        // Format the value if it's a date field
        let formattedValue = value;
        if (isDateField && typeof value === 'string') {
            formattedValue = formatDateValue(value);

            // If formatting results in an empty string, it means the date was invalid
            if (formattedValue === '' && value.trim() !== '') {
                const testDate = new Date(value);
                if (!isNaN(testDate.getTime())) {
                    toast.error("Invalid date. Please check the day/month combination.", {
                        position: "top-right",
                        autoClose: 3000
                    });
                } else {
                    toast.error("Invalid date format. Please use formats like DD-MMM-YYYY, DD-MM-YYYY, MM/DD/YYYY, etc.", {
                        position: "top-right",
                        autoClose: 3000
                    });
                }
                return;
            }
        }

        setFormData((prevData) => {
            // Update the correct array in formData — either the named array or legacy lineItems
            const arrayKey = arrayFieldName || 'lineItems';
            const currentArray = Array.isArray(prevData[arrayKey]) ? prevData[arrayKey] : (prevData.lineItems || []);
            const newArray = [...currentArray];
            if (newArray[itemIndex]) {
                newArray[itemIndex] = { ...newArray[itemIndex], [fieldName]: formattedValue };
            } else {
                return prevData;
            }
            const updated = { ...prevData, [arrayKey]: newArray };
            // Keep lineItems in sync if we updated a different key
            if (arrayKey !== 'lineItems') {
                updated.lineItems = newArray;
            }
            return updated;
        });

        // Re-validate the form to clear errors for this line item field if it's now valid
        if (errors?.lineItems?.[itemIndex]?.[fieldName]) {
            const newErrors = { ...errors };
            const fieldConfigItemForValidation = fieldConfig.find(f => f.field_name === fieldName && f.parent);
            const isRequired = fieldConfigItemForValidation?.is_required;
            const isEmpty = formattedValue === null || formattedValue === undefined || String(formattedValue).trim() === '';

            if (!isRequired || !isEmpty) {
                if (newErrors.lineItems?.[itemIndex]) {
                    delete newErrors.lineItems[itemIndex][fieldName];
                    if (Object.keys(newErrors.lineItems[itemIndex]).length === 0) {
                        delete newErrors.lineItems[itemIndex];
                    }
                    if (Object.keys(newErrors.lineItems || {}).length === 0) {
                        delete newErrors.lineItems;
                    }
                    setErrors(newErrors);
                    const fieldId = `line-item-${itemIndex}-${fieldName}`;
                    if (firstInvalidField === fieldId) {
                        setFirstInvalidField(null);
                    }
                }
            }
        }
    };

    // --- Handler for adding a row to a specific array field ---
    const handleLineItemAdd = useCallback((arrayFieldName = 'lineItems') => {
        if (!canEditInvoice) {
            toast.error("You do not have permission to add line items.", {
                position: "top-right",
                autoClose: 3000
            });
            return;
        }

        // Get child fields for this specific array (by parent name), or all child fields for legacy mode
        const arrayKey = arrayFieldName || 'lineItems';
        const childFields = fieldConfig.filter(f => f.parent === arrayKey || (arrayKey === 'lineItems' && f.parent));
        const allFieldNames = childFields.map(f => f.field_name);

        const newRow = {};
        allFieldNames.forEach(header => {
            newRow[header] = '';
        });

        setFormData((prevData) => {
            const currentArray = Array.isArray(prevData[arrayKey]) ? prevData[arrayKey] : (prevData.lineItems || []);
            const updated = { ...prevData, [arrayKey]: [...currentArray, newRow] };
            // Keep lineItems in sync
            if (arrayKey !== 'lineItems') {
                updated.lineItems = [...currentArray, newRow];
            }
            return updated;
        });
    }, [canEditInvoice, fieldConfig]);

    // --- Handler for deleting a row from a specific array field ---
    const handleLineItemDelete = useCallback((itemIndex, arrayFieldName = 'lineItems') => {
        if (!canEditInvoice) {
            toast.error("You do not have permission to delete line items.", {
                position: "top-right",
                autoClose: 3000
            });
            return;
        }

        const arrayKey = arrayFieldName || 'lineItems';

        setFormData((prevData) => {
            const currentArray = Array.isArray(prevData[arrayKey]) ? prevData[arrayKey] : (prevData.lineItems || []);
            const newArray = [...currentArray];
            newArray.splice(itemIndex, 1);
            const updated = { ...prevData, [arrayKey]: newArray };
            // Keep lineItems in sync
            if (arrayKey !== 'lineItems') {
                updated.lineItems = newArray;
            }
            return updated;
        });

        setErrors((prevErrors) => {
            if (!prevErrors.lineItems) return prevErrors;

            const newErrors = { ...prevErrors };
            const newLinesErrors = Array.isArray(newErrors.lineItems)
                ? [...newErrors.lineItems]
                : Object.values(newErrors.lineItems);

            newLinesErrors.splice(itemIndex, 1);

            if (newLinesErrors.length === 0) {
                delete newErrors.lineItems;
            } else {
                newErrors.lineItems = newLinesErrors;
            }

            if (firstInvalidField && firstInvalidField.startsWith(`line-item-${itemIndex}-`)) {
                setFirstInvalidField(null);
            }

            toast.success(`Row ${itemIndex + 1} deleted.`, {
                position: "top-right",
                autoClose: 1500
            });

            return newErrors;
        });
    }, [canEditInvoice, firstInvalidField]);

    // Handler for when a master key value is selected
    const handleMasterKeySelect = useCallback((value) => {
        if (masterKeyPopupField) {
            handleFieldChange(masterKeyPopupField, value);
            setMasterKeyPopupField('');
            setMasterKeyPopupjOpen(false);
        }
    }, [masterKeyPopupField, handleFieldChange]);

    const updateInvoice = async (status, stage, extraInvoiceData = {}, extraDocumentData = {}) => {
        if (!canEditInvoice) {
            toast.error("You do not have permission to perform this action.", {
                position: "top-right",
                autoClose: 3000
            });
            return false;
        }

        if (!invoicePk) {
            toast.error("Invoice ID is missing. Cannot update.", {
                position: "top-right",
                autoClose: 3000
            });
            return false;
        }

        if (!docId) {
            toast.error("Document ID is missing. Cannot update document record.", {
                position: "top-right",
                autoClose: 3000
            });
            return false;
        }

        try {
            const nowIso = getCurrentTimeISOString();

            const authHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Prefer': 'return=representation'
            };

            const invoiceData = {
                status,
                stage,
                updated_at: nowIso,
                ...extraInvoiceData,
            };

            const documentData = {
                updated_at: nowIso,
                ...extraDocumentData,
            };

            // Update local status state
            setInvoiceStatus(status);

            // --- Logic to extract and map core invoice fields to DB columns ---
            const findFormDataKey = (dbColumnName) => {
                const targetNormalizedKey = normalizeKey(dbColumnName);
                // Define common aliases for robust matching
                const aliases = {
                    'invoice_no': ['invoice_no', 'invoiceno', 'invoicenumber', 'invno', 'invnumber', 'invnum', 'Inv_no', 'inv_no'],
                    'po_no': ['pono', 'ponumber', 'po', 'po_no'],
                    'invoice_date': ['invoicedate', 'invdate', 'date', 'invoice_date'],
                    'vendor_name': ['vendorname', 'suppliername', 'vendor', 'vendor_name'],
                };
                // Combine the column name's normalized form with its aliases for searching
                const searchKeys = [targetNormalizedKey, ...(aliases[dbColumnName] || [])];

                // Search fieldConfig (which dictates the keys in formData)
                const foundConfig = fieldConfig.find(config => {
                    if (config.parent) return false; // Skip line items
                    const normalizedFieldName = normalizeKey(config.field_name);
                    const normalizedDisplayName = normalizeKey(config.display_name || '');

                    return searchKeys.some(key => key === normalizedFieldName || key === normalizedDisplayName);
                });

                return foundConfig ? foundConfig.field_name : null;
            }

            const extractedCoreFields = {};

            // Map the required DB columns to their values in formData
            ['invoice_no', 'po_no', 'invoice_date', 'vendor_name'].forEach(dbColumn => {
                const formDataKey = findFormDataKey(dbColumn);

                let value = formDataKey ? formData[formDataKey] : undefined;

                if (value !== undefined && value !== null) {
                    // Check for empty strings/numbers after user edits
                    if (typeof value === 'string' && value.trim() === '') return;
                    if (typeof value === 'number' && isNaN(value)) return;

                    // Special handling for invoice_date to ensure proper formatting
                    if (dbColumn === 'invoice_date') {
                        // Format the date value to YYYY-MM-DD format
                        const formattedDate = formatDateValue(value);
                        // If formatting results in an empty string, it means the date is invalid
                        if (!formattedDate) {
                            toast.error("Invalid invoice date. Please check the date format.", {
                                position: "top-right",
                                autoClose: 3000
                            });
                            throw new Error("Invalid invoice date");
                        }
                        value = formattedDate;
                    }

                    // The value is good, add it to the extracted fields
                    extractedCoreFields[dbColumn] = value;
                } else if (formData[dbColumn] !== undefined) {
                    // Fallback: if the DB column name is used directly as a form field name
                    let fallbackValue = formData[dbColumn];

                    // Special handling for invoice_date to ensure proper formatting
                    if (dbColumn === 'invoice_date') {
                        // Format the date value to YYYY-MM-DD format
                        const formattedDate = formatDateValue(fallbackValue);
                        // If formatting results in an empty string, it means the date is invalid
                        if (!formattedDate) {
                            toast.error("Invalid invoice date. Please check the date format.", {
                                position: "top-right",
                                autoClose: 3000
                            });
                            throw new Error("Invalid invoice date");
                        }
                        fallbackValue = formattedDate;
                    }

                    extractedCoreFields[dbColumn] = fallbackValue;
                }
            });

            // Filter formData to only include fields defined in fieldConfig
            // This is the object that will be stored in extracted_data (JSONB)
            const filteredFormData = {};

            // Add non-line item fields that are defined in fieldConfig
            fieldConfig
                .filter(f => !f.parent) // Non-line item fields
                .forEach(config => {
                    // Only include fields that exist in formData
                    if (formData.hasOwnProperty(config.field_name)) {
                        // For array-type fields, preserve the array data completely and never save as empty string
                        if (config.field_type === 'array') {
                            // For array fields, ensure we're preserving the actual array data
                            if (Array.isArray(formData[config.field_name])) {
                                // Preserve array data completely, even if empty
                                filteredFormData[config.field_name] = formData[config.field_name];
                            } else if (formData[config.field_name] !== undefined && formData[config.field_name] !== '') {
                                // If it's not an array but has a value, preserve it
                                filteredFormData[config.field_name] = formData[config.field_name];
                            }
                            // If it's an empty string or undefined, we don't include it for array fields
                        } else {
                            // For non-array fields, include the value
                            filteredFormData[config.field_name] = formData[config.field_name];
                        }
                    }
                });

            // Handle po_number field specially - only include if defined in fieldConfig
            const hasPoNumberConfig = fieldConfig.some(f => f.field_name === 'po_number' || f.field_name === 'po_no');
            if (hasPoNumberConfig && formData.po_number !== undefined) {
                filteredFormData.po_number = formData.po_number;
            }

            // Handle all array fields dynamically - not just line items
            // Find all array fields in the configuration
            const arrayFields = fieldConfig.filter(f => f.field_type === 'array' && !f.parent);

            // Process each array field
            arrayFields.forEach(arrayField => {
                // If the field exists in formData and is an array, preserve it
                if (formData.hasOwnProperty(arrayField.field_name) && Array.isArray(formData[arrayField.field_name])) {
                    filteredFormData[arrayField.field_name] = formData[arrayField.field_name];
                } else if (formData.hasOwnProperty(arrayField.field_name) && formData[arrayField.field_name] !== undefined && formData[arrayField.field_name] !== '') {
                    // If it's not an array but has a value, preserve it
                    filteredFormData[arrayField.field_name] = formData[arrayField.field_name];
                }
                // If it's undefined or empty string, we don't include it
            });

            // Handle lineItems specifically if it exists in fieldConfig
            const lineItemsConfig = fieldConfig.find(f => f.field_name === 'lineItems' && !f.parent);
            if (lineItemsConfig) {
                // Handle lineItems according to its field type
                if (lineItemsConfig.field_type === 'array') {
                    if (formData.lineItems && Array.isArray(formData.lineItems)) {
                        if (formData.lineItems.length > 0) {
                            filteredFormData.lineItems = formData.lineItems.map(item => {
                                // Preserve all fields in the item
                                const filteredItem = {};
                                Object.keys(item).forEach(key => {
                                    if (item.hasOwnProperty(key)) {
                                        // For array-type fields in line items, preserve array data
                                        const fieldConfigItem = fieldConfig.find(f => f.field_name === key && f.parent);
                                        if (fieldConfigItem && fieldConfigItem.field_type === 'array' && Array.isArray(item[key])) {
                                            filteredItem[key] = item[key];
                                        } else if (item[key] !== undefined) {
                                            filteredItem[key] = item[key];
                                        }
                                    }
                                });
                                return filteredItem;
                            }).filter(item => Object.keys(item).length > 0);
                        } else {
                            // Preserve empty array
                            filteredFormData.lineItems = [];
                        }
                    }
                } else {
                    // For non-array lineItems field, include as is
                    if (formData.lineItems !== undefined) {
                        filteredFormData.lineItems = formData.lineItems;
                    }
                }
            } else if (formData.lineItems !== undefined) {
                // If lineItems is not in fieldConfig, exclude it
                delete filteredFormData.lineItems;
            }

            // Handle line item fields (fields with parent property)
            // Group all child fields by their parent array field name
            const lineItemFields = fieldConfig.filter(f => f.parent && f.parent !== '');
            if (lineItemFields.length > 0) {
                // Group child fields by their parent
                const parentGroups = {};
                lineItemFields.forEach(field => {
                    if (!parentGroups[field.parent]) {
                        parentGroups[field.parent] = [];
                    }
                    parentGroups[field.parent].push(field.field_name);
                });

                // For each parent group, read data from formData[parentName] directly
                Object.keys(parentGroups).forEach(parentName => {
                    const parentArrayField = fieldConfig.find(
                        f => f.field_name === parentName && !f.parent && f.field_type === 'array'
                    );

                    if (!parentArrayField) return;

                    // Read from formData[parentName] first; fall back to formData.lineItems only
                    // when there's a single array and data is stored there for legacy compat
                    const sourceData = Array.isArray(formData[parentName])
                        ? formData[parentName]
                        : (Array.isArray(formData.lineItems) ? formData.lineItems : []);

                    const relevantFields = parentGroups[parentName];

                    if (sourceData.length > 0) {
                        filteredFormData[parentName] = sourceData.map(item => {
                            const filteredItem = {};
                            relevantFields.forEach(field => {
                                if (item.hasOwnProperty(field)) {
                                    const fieldConfigItem = fieldConfig.find(
                                        f => f.field_name === field && f.parent === parentName
                                    );
                                    if (fieldConfigItem && fieldConfigItem.field_type === 'array' && Array.isArray(item[field])) {
                                        filteredItem[field] = item[field];
                                    } else if (item[field] !== undefined) {
                                        filteredItem[field] = item[field];
                                    }
                                }
                            });
                            return filteredItem;
                        }).filter(item => Object.keys(item).length > 0);
                    } else {
                        // Preserve empty array so DB doesn't lose the key
                        filteredFormData[parentName] = [];
                    }
                });
            }

            // --- Payloads with updated_by & updated_at ---
            const invoicePayload = {
                status,
                stage,
                extracted_data: JSON.stringify(filteredFormData),
                tenant_id: user.tenantId,
                updated_at: nowIso,
                updated_by: user.user_id,
                ...extractedCoreFields, // <-- NEW: Include the extracted core fields
                ...extraInvoiceData
            };

            // Add comments to the invoice payload if they exist in extraInvoiceData or rejectionComment
            if (extraInvoiceData.comments) {
                invoicePayload.comments = extraInvoiceData.comments;
            } else if (rejectionComment) {
                invoicePayload.comments = rejectionComment;
            }

            const documentPayload = {
                status,
                stage,
                tenant_id: user.tenantId,
                updated_at: nowIso,
                updated_by: user.user_id,   // ✅ Add updated_by
                ...extraDocumentData
            };

            const invoiceUrl = `/api/v1/tables/ap_invoices?invoice_id=eq.${invoicePk}`;

            const invoiceResponse = await axios.patch(invoiceUrl, invoicePayload, {
                headers: authHeaders
            });

            if (docId) {
                const documentUrl = `/api/v1/tables/ap_documents?doc_id=eq.${docId}`;
                try {
                    const docCheckResponse = await axios.get(documentUrl, { headers: authHeaders });
                    if (docCheckResponse.data && docCheckResponse.data.length > 0) {
                        await axios.patch(documentUrl, documentPayload, { headers: authHeaders });
                    }
                } catch (docError) {
                    console.warn(`Skipping ap_documents patch for doc_id=${docId}: record not found or error.`, docError?.message);
                }
            }

            return true;
        } catch (error) {
            toast.error(`Failed to update invoice: ${error.message}`, {
                position: "top-right",
                autoClose: 3000
            });
            return false;
        }
    };


    const handleReject = async () => {
        const { isValid, firstInvalidFieldId } = validateForm('reject');
        if (!isValid) {
            setFirstInvalidField(firstInvalidFieldId);
            // Set error message on loader
            setProcessMessage('Please add a rejection reason.');
            setProcessStatus('error');
            setProcessing(true);

            // Hide loader after 1 second
            setTimeout(() => {
                setProcessing(false);
                setProcessMessage('');
                setProcessStatus('');
            }, 1000);
            return;
        }

        // Show confirmation modal instead of proceeding directly
        setShowRejectionModal(true);
    };

    const handleHold = async () => {
        const { isValid, firstInvalidFieldId } = validateForm('hold');
        if (!isValid) {
            setFirstInvalidField(firstInvalidFieldId);
            // Set error message on loader
            setProcessMessage('Please add a hold reason.');
            setProcessStatus('error');
            setProcessing(true);

            // Hide loader after 1 second
            setTimeout(() => {
                setProcessing(false);
                setProcessMessage('');
                setProcessStatus('');
            }, 1000);
            return;
        }

        // Show confirmation modal instead of proceeding directly
        setShowHoldModal(true);
    };

    // New function to handle the actual rejection after confirmation
    const confirmRejectInvoice = async () => {
        // Close the modal
        setShowRejectionModal(false);

        // Set processing state to true to show loader
        setProcessMessage('Processing invoice rejection...');
        setProcessStatus('processing');
        setProcessing(true);

        try {
            if (await updateInvoice('Rejected', 'Review', { comments: rejectionComment })) {
                setProcessMessage('Invoice rejected successfully.');
                setProcessStatus('success');

                // Navigate immediately without delay
                navigate('/invoice_queue');
            } else {
                setProcessMessage('Failed to reject invoice.');
                setProcessStatus('error');

                // Hide loader after 3 seconds
                setTimeout(() => {
                    setProcessing(false);
                    setProcessMessage('');
                    setProcessStatus('');
                }, 3000);
            }
        } finally {
            // For successful operations, we don't hide the loader here as we're navigating
            // The loader will be hidden when the component unmounts
        }
    };

    // New function to handle the actual hold after confirmation
    const confirmHoldInvoice = async () => {
        // Close the modal
        setShowHoldModal(false);

        // Set processing state to true to show loader
        setProcessMessage('Processing invoice hold...');
        setProcessStatus('processing');
        setProcessing(true);

        try {
            if (await updateInvoice('Hold', 'Review', { comments: rejectionComment })) {
                setProcessMessage('Invoice hold successfully.');
                setProcessStatus('success');

                // Navigate immediately without delay
                navigate('/invoice_queue');
            } else {
                setProcessMessage('Failed to hold invoice.');
                setProcessStatus('error');

                // Hide loader after 3 seconds
                setTimeout(() => {
                    setProcessing(false);
                    setProcessMessage('');
                    setProcessStatus('');
                }, 3000);
            }
        } finally {
            // For successful operations, we don't hide the loader here as we're navigating
            // The loader will be hidden when the component unmounts
        }
    };

    // Function to cancel rejection and close modal
    const cancelRejectInvoice = () => {
        setShowRejectionModal(false);
    };

    // Function to cancel hold and close modal
    const cancelHoldInvoice = () => {
        setShowHoldModal(false);
    };

    const handleSendToReconciliation = async () => {
        const { isValid, firstInvalidFieldId } = validateForm('default');
        setFirstInvalidField(firstInvalidFieldId);
        if (!isValid) {
            // Set error message on loader
            setProcessMessage('Please correct the fields before proceeding.');
            setProcessStatus('error');
            setProcessing(true);

            // Hide loader after 3 seconds
            setTimeout(() => {
                setProcessing(false);
                setProcessMessage('');
                setProcessStatus('');
            }, 3000);
            return;
        }

        // Set processing state to true to show loader
        setProcessMessage('Processing invoice for reconciliation...');
        setProcessStatus('processing');
        setProcessing(true);

        try {
            if (await updateInvoice('reconciled', 'Review')) {
                setProcessMessage('Invoice sent to Reconciliation successfully!');
                setProcessStatus('success');

                // Navigate immediately without delay
                navigate('/reconcile_queue');
            } else {
                setProcessMessage('Failed to send invoice to reconciliation.');
                setProcessStatus('error');

                // Hide loader after 3 seconds
                setTimeout(() => {
                    setProcessing(false);
                    setProcessMessage('');
                    setProcessStatus('');
                }, 3000);
            }
        } finally {
            // For successful operations, we don't hide the loader here as we're navigating
            // The loader will be hidden when the component unmounts
        }
    };

    const handleApproveAndUpload = async () => {
        const { isValid, firstInvalidFieldId, errors: newErrors } = validateForm('approve');
        setErrors(newErrors); // <-- this makes invoice_date highlight immediately
        setFirstInvalidField(firstInvalidFieldId);
        if (!isValid) {
            // Set error message on loader
            setProcessMessage('Please correct the fields before proceeding.');
            setProcessStatus('error');
            setProcessing(true);

            // Hide loader after 1 seconds
            setTimeout(() => {
                setProcessing(false);
                setProcessMessage('');
                setProcessStatus('');
            }, 1000);
            return;
        }

        // Set processing state to true to show loader
        setProcessMessage('Processing invoice approval and upload...');
        setProcessStatus('processing');
        setProcessing(true);

        try {
            // Process History field configurations before updating the invoice
            const historyResults = await processHistoryFields();

            if (await updateInvoice('Approved', 'Review', { comments: rejectionComment })) {
                // Set success message based on history processing results
                if (historyResults && (historyResults.successCount > 0 || historyResults.errorCount > 0)) {
                    if (historyResults.successCount > 0 && historyResults.errorCount === 0) {
                        setProcessMessage('Invoice approved & uploaded successfully!');
                        setProcessStatus('success');
                    } else if (historyResults.errorCount > 0 && historyResults.successCount === 0) {
                        setProcessMessage('Invoice approved & uploaded, but failed to process History fields.');
                        setProcessStatus('warning');
                    } else {
                        setProcessMessage('Invoice approved & uploaded successfully!');
                        setProcessStatus('success');
                    }
                } else {
                    setProcessMessage('Invoice approved & uploaded successfully!');
                    setProcessStatus('success');
                }

                // Navigate immediately without delay
                navigate('/invoice_queue');
            } else {
                setProcessMessage('Failed to approve and upload invoice.');
                setProcessStatus('error');

                // Hide loader after 3 seconds
                setTimeout(() => {
                    setProcessing(false);
                    setProcessMessage('');
                    setProcessStatus('');
                }, 3000);
            }
        } finally {
            // For successful operations, we don't hide the loader here as we're navigating
            // The loader will be hidden when the component unmounts
        }
    };

    // Function to process History field configurations
    const processHistoryFields = async () => {
        if (!fieldConfig || !formData || !user) {
            // Return default values instead of undefined
            return { successCount: 0, errorCount: 0 };
        }

        // Find all fields with History() configuration in their custom_values
        const historyFields = fieldConfig.filter(field =>
            field.custom_values && field.custom_values.includes('History(')
        );

        // If no history fields, return early with default values
        if (historyFields.length === 0) {
            // Return default values instead of undefined
            return { successCount: 0, errorCount: 0 };
        }

        let successCount = 0;
        let errorCount = 0;

        // Use the same vendor name extraction logic as in updateInvoice
        const findFormDataKey = (dbColumnName) => {
            const targetNormalizedKey = normalizeKey(dbColumnName);
            // Define common aliases for robust matching
            const aliases = {
                'invoice_no': ['invoice_no', 'invoiceno', 'invoicenumber', 'invno', 'invnumber', 'invnum'],
                'po_no': ['po_no', 'pono', 'ponumber', 'po', 'ordernumber'],
                'invoice_date': ['invoice_date', 'invoicedate', 'invdate', 'date'],
                'vendor_name': ['vendor_name', 'vendorname', 'suppliername', 'vendor'],
            };
            // Combine the column name's normalized form with its aliases for searching
            const searchKeys = [targetNormalizedKey, ...(aliases[dbColumnName] || [])];

            // Search fieldConfig (which dictates the keys in formData)
            const foundConfig = fieldConfig.find(config => {
                if (config.parent) return false; // Skip line items
                const normalizedFieldName = normalizeKey(config.field_name);
                const normalizedDisplayName = normalizeKey(config.display_name || '');

                return searchKeys.some(key => key === normalizedFieldName || key === normalizedDisplayName);
            });

            return foundConfig ? foundConfig.field_name : null;
        };

        // Get the vendor name using the same logic as updateInvoice
        const vendorNameFieldKey = findFormDataKey('vendor_name');
        let vendorName = '';

        if (vendorNameFieldKey) {
            vendorName = formData[vendorNameFieldKey];
        } else if (formData.vendor_name !== undefined) {
            // Fallback: if the DB column name is used directly as a form field name
            vendorName = formData.vendor_name;
        }

        // Normalize vendor name
        const normalizedVendorName = vendorName.toString().trim();

        if (!normalizedVendorName || normalizedVendorName.trim() === '') {
            toast.error('Vendor name is required to process History fields.', {
                position: "top-right",
                autoClose: 3000
            });
            return { successCount: 0, errorCount: historyFields.length };
        }

        // Process each History field
        for (const field of historyFields) {
            try {
                // Check if this is a line item field
                const isLineItemField = field.parent && formData.lineItems && Array.isArray(formData.lineItems);

                // If it's a line item field, process each line item
                if (isLineItemField) {
                    // For line item fields, we need to process each line item separately
                    for (let i = 0; i < formData.lineItems.length; i++) {
                        const lineItem = formData.lineItems[i];

                        try {
                            // Extract the referenced field name from History() configuration
                            const historyMatch = field.custom_values.match(/History\(([^)]+)\)/);
                            if (!historyMatch) {
                                errorCount++;
                                continue;
                            }

                            const referencedFieldName = historyMatch[1];

                            // Get the current value of the field with History configuration
                            const fieldValue = lineItem[field.field_name];

                            // Get the current value of the referenced field
                            const referencedFieldValue = lineItem[referencedFieldName];

                            // Skip if either value is empty or undefined
                            if (fieldValue === undefined || fieldValue === null || fieldValue === '' ||
                                referencedFieldValue === undefined || referencedFieldValue === null || referencedFieldValue === '') {
                                continue; // Skip this line item but don't count as error
                            }

                            // Normalize the referenced field value for comparison
                            const normalizedReferencedFieldValue = referencedFieldValue.toString().trim().replace(/\s+/g, ' ');

                            try {
                                // First, get all records for this tenant to debug the matching issue
                                const allTenantRecordsResponse = await axios.get(`/api/v1/tables/ap_itemmaster`, {
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    params: {
                                        tenant_id: `eq.${user.tenantId}`
                                    }
                                });

                                // Filter records for this vendor only
                                const vendorRecords = allTenantRecordsResponse.data.filter(record =>
                                    record.vendor_name === normalizedVendorName
                                );

                                // Find records with matching invoice_itemdesc
                                const matchingRecords = vendorRecords.filter(record =>
                                    record.invoice_itemdesc === normalizedReferencedFieldValue
                                );

                                const nowIso = getCurrentTimeISOString();

                                if (matchingRecords.length > 0) {
                                    // Update existing record
                                    const existingRecord = matchingRecords[0];
                                    // Fix: Use the correct field name for the primary key
                                    const item_id = existingRecord.ap_item_master_id || existingRecord.item_id;

                                    // Check if item_id is valid
                                    if (!item_id) {
                                        errorCount++;
                                        continue;
                                    }

                                    const updatePayload = {
                                        erp_item_desc: fieldValue,
                                        updated_by: user.user_id,
                                        updated_at: nowIso
                                    };

                                    // Fix: Send object instead of array, and properly encode item_id
                                    const updateResponse = await axios.patch(`/api/v1/tables/ap_itemmaster?ap_item_master_id=eq.${encodeURIComponent(item_id)}`, updatePayload, {
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`,
                                            'Prefer': 'return=representation'
                                        }
                                    });

                                    if (!updateResponse || !updateResponse.data) {
                                        errorCount++;
                                    } else {
                                        successCount++;
                                    }
                                } else {
                                    // Insert new record
                                    const insertPayload = {
                                        tenant_id: user.tenantId,
                                        vendor_name: normalizedVendorName,
                                        invoice_itemdesc: normalizedReferencedFieldValue,
                                        erp_item_desc: fieldValue,
                                        created_by: user.user_id,
                                        updated_by: user.user_id,
                                        created_at: nowIso,
                                        updated_at: nowIso
                                    };

                                    // Fix: Send array for insert operations
                                    const insertResponse = await axios.post(`/api/v1/tables/ap_itemmaster`, [insertPayload], {
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`,
                                            'Prefer': 'return=representation'
                                        }
                                    });

                                    if (!insertResponse || !insertResponse.data) {
                                        errorCount++;
                                    } else {
                                        successCount++;
                                    }
                                }
                            } catch (apiError) {
                                // Show specific error message
                                if (apiError.response) {
                                    toast.error(`API Error for field ${field.field_name} (line item ${i + 1}): ${apiError.response.status}`, {
                                        position: "top-right",
                                        autoClose: 3000
                                    });
                                } else {
                                    toast.error(`Network Error for field ${field.field_name} (line item ${i + 1})`, {
                                        position: "top-right",
                                        autoClose: 3000
                                    });
                                }
                                errorCount++;
                            }
                        } catch (lineItemError) {
                            toast.error(`Error processing field ${field.field_name} (line item ${i + 1})`, {
                                position: "top-right",
                                autoClose: 3000
                            });
                            errorCount++;
                        }
                    }
                } else {
                    // Process regular (non-line item) field
                    // Extract the referenced field name from History() configuration
                    const historyMatch = field.custom_values.match(/History\(([^)]+)\)/);
                    if (!historyMatch) {
                        errorCount++;
                        continue;
                    }

                    const referencedFieldName = historyMatch[1];

                    // Get the current value of the field with History configuration
                    const fieldValue = formData[field.field_name];

                    // Get the current value of the referenced field
                    const referencedFieldValue = formData[referencedFieldName];

                    // Skip if either value is empty or undefined
                    if (fieldValue === undefined || fieldValue === null || fieldValue === '' ||
                        referencedFieldValue === undefined || referencedFieldValue === null || referencedFieldValue === '') {
                        errorCount++;
                        continue;
                    }

                    // Normalize the referenced field value for comparison
                    const normalizedReferencedFieldValue = referencedFieldValue.toString().trim().replace(/\s+/g, ' ');

                    try {
                        // First, get all records for this tenant to debug the matching issue
                        const allTenantRecordsResponse = await axios.get(`/api/v1/tables/ap_itemmaster`, {
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            params: {
                                tenant_id: `eq.${user.tenantId}`
                            }
                        });

                        // Filter records for this vendor only
                        const vendorRecords = allTenantRecordsResponse.data.filter(record =>
                            record.vendor_name === normalizedVendorName
                        );

                        // Find records with matching invoice_itemdesc
                        const matchingRecords = vendorRecords.filter(record =>
                            record.invoice_itemdesc === normalizedReferencedFieldValue
                        );

                        const nowIso = getCurrentTimeISOString();

                        if (matchingRecords.length > 0) {
                            // Update existing record
                            const existingRecord = matchingRecords[0];
                            // Fix: Use the correct field name for the primary key
                            const item_id = existingRecord.ap_item_master_id || existingRecord.item_id;

                            // Check if item_id is valid
                            if (!item_id) {
                                errorCount++;
                                continue;
                            }

                            const updatePayload = {
                                erp_item_desc: fieldValue,
                                updated_by: user.user_id,
                                updated_at: nowIso
                            };

                            // Fix: Send object instead of array, and properly encode item_id
                            const updateResponse = await axios.patch(`/api/v1/tables/ap_itemmaster?ap_item_master_id=eq.${encodeURIComponent(item_id)}`, updatePayload, {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`,
                                    'Prefer': 'return=representation'
                                }
                            });

                            if (!updateResponse || !updateResponse.data) {
                                errorCount++;
                            } else {
                                successCount++;
                            }
                        } else {
                            // Insert new record
                            const insertPayload = {
                                tenant_id: user.tenantId,
                                vendor_name: normalizedVendorName,
                                invoice_itemdesc: normalizedReferencedFieldValue,
                                erp_item_desc: fieldValue,
                                created_by: user.user_id,
                                updated_by: user.user_id,
                                created_at: nowIso,
                                updated_at: nowIso
                            };

                            // Fix: Send array for insert operations
                            const insertResponse = await axios.post(`/api/v1/tables/ap_itemmaster`, [insertPayload], {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`,
                                    'Prefer': 'return=representation'
                                }
                            });

                            if (!insertResponse || !insertResponse.data) {
                                errorCount++;
                            } else {
                                successCount++;
                            }
                        }
                    } catch (apiError) {
                        // Show specific error message
                        if (apiError.response) {
                            toast.error(`API Error for field ${field.field_name}: ${apiError.response.status}`, {
                                position: "top-right",
                                autoClose: 3000
                            });
                        } else {
                            toast.error(`Network Error for field ${field.field_name}`, {
                                position: "top-right",
                                autoClose: 3000
                            });
                        }
                        errorCount++;
                    }
                }
            } catch (error) {
                toast.error(`Error processing field ${field.field_name}`, {
                    position: "top-right",
                    autoClose: 3000
                });
                errorCount++;
            }
        }

        // Return the counts for further processing if needed
        return { successCount, errorCount };
    };

    const handleReconcileWithPO = () => {
        navigate(`/po_editor/${encryptId(invoiceId)}`);
    };

    const handleBack = () => {
        navigate(-1);
    };

    if (loading || !invoiceId) return null;
    if (!formData || Object.keys(formData).length === 0)
        return (
            <div className="flex flex-col items-center justify-center h-full w-full gap-6 text-gray-500 bg-gray-50 p-8 rounded-lg shadow-sm">
                <div className="bg-red-100 p-4 rounded-full">
                    <X size={48} className="text-red-500" />
                </div>
                <div className="text-center max-w-md">
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Unable to Load Invoice</h3>
                    <p className="text-gray-500 mb-4">Could not load data for Invoice</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );

    return (
        <>
            {/* Rejection Confirmation Modal */}
            {showRejectionModal && (
                <div className="fixed inset-0 z-[10000] bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                <X size={24} className="text-red-600" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mt-4">Confirm Rejection</h3>
                            <p className="mt-2 text-sm text-gray-500">
                                Are you sure you want to reject this invoice?
                            </p>
                        </div>
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                type="button"
                                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
                                onClick={cancelRejectInvoice}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none"
                                onClick={confirmRejectInvoice}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Hold Confirmation Modal */}
            {showHoldModal && (
                <div className="fixed inset-0 z-[10000] bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                                <GitCompare size={24} className="text-yellow-600" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mt-4">Confirm Hold</h3>
                            <p className="mt-2 text-sm text-gray-500">
                                Are you sure you want to hold this invoice?
                            </p>
                        </div>
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                type="button"
                                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
                                onClick={cancelHoldInvoice}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="inline-flex justify-center rounded-md border border-transparent bg-yellow-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-700 focus:outline-none"
                                onClick={confirmHoldInvoice}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {processing && (
                <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center flex flex-col items-center">
                        {processStatus === 'processing' && (
                            <>
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                    </svg>
                                </div>
                                <p className="text-gray-700 font-medium">{processMessage}</p>
                            </>
                        )}
                        {processStatus === 'success' && (
                            <>
                                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                </div>
                                <p className="text-gray-700 font-medium">{processMessage}</p>
                            </>
                        )}
                        {processStatus === 'error' && (
                            <>
                                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </div>
                                <p className="text-gray-700 font-medium">{processMessage}</p>
                            </>
                        )}
                        {processStatus === 'warning' && (
                            <>
                                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                    </svg>
                                </div>
                                <p className="text-gray-700 font-medium">{processMessage}</p>
                            </>
                        )}
                    </div>
                </div>
            )}
            <div data-tour="editor-header">
                <div className="flex justify-between border border-spacing-8 items-center px-4 py-1 right-0 z-[100] bg-white shadow-md">
                    <button
                        onClick={handleBack}
                        className="flex text-[12px] items-center gap-1 px-2 py-1 bg-blue-500 border border-blue-600 rounded-md shadow-sm hover:bg-blue-600 hover:border-blue-700 transition-all duration-200 ease-in-out transform hover:-translate-x-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                        <ArrowLeft size={16} className="text-white" />
                        <span className="font-medium text-white">Back</span>
                    </button>

                    {(isReadonly && !canEditInvoice) && (
                        <div className="flex items-center mx-2">
                            <span className="px-2 py-1 rounded-full text-[12px] font-medium bg-gray-100 text-gray-800">
                                Readonly Mode
                            </span>
                        </div>
                    )}

                    {invoiceStatus && (
                        <div className="flex items-center">
                            <span className="text-[12px] font-medium text-gray-700 mr-2">Current Status:</span>
                            <StatusBadge status={invoiceStatus} />
                        </div>
                    )}
                </div>
                <div>
                    <InvoiceFormUI
                        invoiceId={invoiceId}
                        formData={formData}
                        fieldConfig={fieldConfig}
                        errors={errors}
                        fileUrl={fileUrl}
                        fileType={fileType}
                        invoicePath={invoicePath}
                        lineItemTableHeaders={lineItemTableHeaders}
                        lineItemColumnProperties={lineItemColumnProperties}
                        arrayTableConfigs={arrayTableConfigs}
                        onFieldChange={handleFieldChange}
                        onLineItemChange={handleLineItemChange}
                        onLineItemAdd={handleLineItemAdd} // NEW PROP
                        onLineItemDelete={handleLineItemDelete} // NEW PROP
                        onReject={handleReject}
                        onHold={handleHold}
                        onSendToReconciliation={handleSendToReconciliation}
                        onApproveAndUpload={handleApproveAndUpload}
                        rejectionComment={rejectionComment}
                        setRejectionComment={setRejectionComment}
                        onClearRejectionCommentError={clearRejectionCommentError}
                        validateForm={validateForm}
                        canEditInvoice={canEditInvoice}
                        onReconcileWithPO={handleReconcileWithPO}
                        onBack={handleBack}
                        firstInvalidField={firstInvalidField}
                        isReadonly={isReadonly}
                        errorDesc={errorDesc}
                    />
                </div>
            </div>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
                style={{ zIndex: 99999999 }}
            />

        </>
    );
};

export default Editor;
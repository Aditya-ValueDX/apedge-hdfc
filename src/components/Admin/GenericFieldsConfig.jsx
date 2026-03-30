import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Trash2, Plus, Pencil, Save, AlertTriangle, Lightbulb, ChevronDown, SquareArrowOutUpRight, X } from 'lucide-react';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector, useDispatch } from 'react-redux';
import CardPopup from '../common/CardPopup';
import { apiBaseUrl } from '../../config/apiConfig';
import { useNavigate, useSearchParams } from 'react-router-dom';

// --- Helper Functions ---
const generateUniqueId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const toTitleCase = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// --- Static Data ---
const fieldTypes = ['text', 'number', 'date', 'array', 'boolean'];
const reconcileOptions = ['None', 'PO', 'GRN', 'PO,GRN'];

// --- Helper Components ---

/**
 * Readonly row component.
 */
function TableReadonlyRow({ field, userRole, openCardPopup, index }) {
    const isSuperAdmin = userRole === 'super_admin';

    const handleOpenPopup = (key, title, content, contentType) => {
        openCardPopup(title, content, false, field.uniqueId, key, contentType);
    };

    return (
        <tr className="hover:bg-accent/5 transition-colors">
            <td className="sticky left-0 bg-white border-b border-r border-gray-200 text-center text-gray-600 px-2 py-1 text-xs align-middle min-w-[40px]">
                {index + 1}
            </td>
            <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[120px]">
                <span className="w-full block border-none bg-transparent p-1 text-gray-800 text-xs truncate">{field.field}</span>
            </td>
            <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px]">
                <span className="w-full block border-none bg-transparent p-1 text-gray-800 text-xs truncate">{field.type}</span>
            </td>
            <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[100px]">
                <span className="w-full block border-none bg-transparent p-1 text-gray-800 text-xs truncate">{field.parent || '—'}</span>
            </td>
            <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 max-w-[200px]">
                <div className="flex items-center gap-1 rounded-md p-1">
                    <span className="flex-1 text-gray-800 text-xs truncate">{field.description || '—'}</span>
                    <button
                        onClick={() => handleOpenPopup('description', 'Description', field.description)}
                        className="p-1 rounded-full text-gray-500 hover:text-accent hover:bg-accent/10 transition-colors"
                        title="View description"
                    >
                        <SquareArrowOutUpRight size={12} />
                    </button>
                </div>
            </td>
            <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px]">
                <span className="w-full block border-none bg-transparent p-1 text-gray-800 text-xs truncate">{field.reconcile || 'None'}</span>
            </td>
            <td className="text-center px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[70px]">
                <input type="checkbox" checked={field.use_llm} disabled className="form-checkbox h-4 w-4 text-blue-600 rounded" />
            </td>
        </tr>
    );
}

/**
 * Editable Row component
 */
function EditableRow({ field, idx, onFieldChange, canEdit, canDelete, fields, userRole, openDescriptionPopup, tableWrapperRef, scrollPositionRef }) {
    const [name, setName] = useState(field.field);
    const [type, setType] = useState(field.type);
    const [parent, setParent] = useState(field.parent);
    const [desc, setDesc] = useState(field.description);
    const [fieldReconcile, setFieldReconcile] = useState(field.reconcile || 'None');
    const [useLlm, setUseLlm] = useState(field.use_llm);
    
    // Add state for field name validation
    const [isFieldNameValid, setIsFieldNameValid] = useState(true);
    const [isFieldDuplicate, setIsFieldDuplicate] = useState(false);
    const [fieldNameErrorMessage, setFieldNameErrorMessage] = useState('');

    useEffect(() => {
        setName(field.field);
        setType(field.type);
        setParent(field.parent);
        setDesc(field.description);
        setFieldReconcile(field.reconcile || 'None');
        setUseLlm(field.use_llm);
        
        // Validate field name on initial load
        validateFieldName(field.field);
    }, [field]);

    // Re-validate when parent changes to update duplicate checks
    useEffect(() => {
        validateFieldName(name);
    }, [name, fields]);

    // Function to validate field name
    const validateFieldName = (fieldName) => {
        const trimmed = fieldName.trim();
        const normalized = trimmed.toLowerCase();

        // 1️⃣ Basic format validation
        const formatValid =
          /^[a-zA-Z0-9_]+$/.test(trimmed) && trimmed.length > 0;

        if (!formatValid) {
          setIsFieldNameValid(false);
          setIsFieldDuplicate(false);
          setFieldNameErrorMessage(
            trimmed.length === 0
              ? 'Field name cannot be empty.'
              : 'Only letters, numbers, and underscores allowed.'
          );
          return false;
        }

        // 2️⃣ Duplicate check
        const duplicate = fields.some((f, index) => {
          if (f.uniqueId === field.uniqueId) return false; // Skip current field
          return f.field?.trim().toLowerCase() === normalized;
        });

        if (duplicate) {
          setIsFieldNameValid(true); // Format is valid
          setIsFieldDuplicate(true);
          setFieldNameErrorMessage('Duplicate field name not allowed.');
          return false;
        }

        // 3️⃣ Valid
        setIsFieldNameValid(true);
        setIsFieldDuplicate(false);
        setFieldNameErrorMessage('');
        return true;
    };

    const handleBlur = (key, value) => {
        // Save scroll position
        if (tableWrapperRef && tableWrapperRef.current) {
            scrollPositionRef.current = tableWrapperRef.current.scrollTop;
        }

        if (key === 'field') {
            // Always update the field name, but validate to show errors
            validateFieldName(value);

            if (type === 'array') {
                const oldName = field.field;
                if (oldName !== value) {
                    fields.forEach((childField, childIndex) => {
                        if (childField.parent === oldName) {
                            onFieldChange(childIndex, 'parent', value);
                        }
                    });
                }
            }
        }

        onFieldChange(idx, key, value);
    };

    const handleCheckboxChange = (key, checked) => {
        // Save scroll position
        if (tableWrapperRef && tableWrapperRef.current) {
            scrollPositionRef.current = tableWrapperRef.current.scrollTop;
        }

        // Update local state first
        if (key === 'use_llm') setUseLlm(checked);

        // Then update parent state
        onFieldChange(idx, key, checked);
    };

    const handleSelectChange = (key, value) => {
        // Save scroll position
        if (tableWrapperRef && tableWrapperRef.current) {
            scrollPositionRef.current = tableWrapperRef.current.scrollTop;
        }

        // Update local state first
        if (key === 'type') setType(value);
        if (key === 'parent') setParent(value);
        if (key === 'reconcile') setFieldReconcile(value);

        // Then update parent state (onBlur will handle this for selects)
        handleBlur(key, value);
    };

    return (
        <tr className={`transition-all duration-200 ease-in-out hover:bg-gray-50`}>
            <td className="sticky left-0 bg-white border-b border-r border-gray-200 text-center text-gray-600 px-2 py-1 text-xs align-middle min-w-[40px]">
                {idx + 1}
            </td>

            <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[120px]">
                <input
                    type="text"
                    className={`w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none transition-all focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 shadow-inner text-black ${!isFieldNameValid || isFieldDuplicate ? 'border-2 border-red-500' : ''}`}
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        validateFieldName(e.target.value);
                    }}
                    onBlur={() => handleBlur('field', name)}
                    disabled={!canEdit}
                    title={!canEdit ? "You do not have permission to edit this field." : "Edit field name (letters, numbers, underscores only)"}
                />
                {(!isFieldNameValid || isFieldDuplicate) && fieldNameErrorMessage && (
                    <div className="text-red-500 text-xs mt-1">{fieldNameErrorMessage}</div>
                )}
            </td>
            <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px] relative">
                <select
                    className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none transition-all focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 appearance-none pr-6 shadow-inner text-black"
                    value={type}
                    onChange={(e) => handleSelectChange('type', e.target.value)}
                    onBlur={(e) => handleBlur('type', e.target.value)}
                    disabled={!canEdit}
                    title={!canEdit ? "You do not have permission to edit this field." : "Select field type"}
                >
                    {fieldTypes.map((t) => (
                        <option key={t}>{t}</option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                    <ChevronDown size={12} className="text-gray-600" />
                </div>
            </td>
            <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[100px] relative">
                <select
                    className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none transition-all focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 appearance-none pr-6 shadow-inner text-black"
                    value={parent}
                    onChange={(e) => handleSelectChange('parent', e.target.value)}
                    onBlur={(e) => handleBlur('parent', e.target.value)}
                    disabled={!canEdit}
                    title={!canEdit ? "You do not have permission to edit this field." : "Select parent field"}
                >
                    <option value=""></option>
                    {fields
                        .filter((f) => f.uniqueId !== field.uniqueId && f.type === 'array' && f.field)
                        .map((f) => (
                            <option key={f.uniqueId} value={f.field}>
                                {f.field}
                            </option>
                        ))}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                    <ChevronDown size={12} className="text-gray-600" />
                </div>
            </td>
            <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 max-w-[200px]">
                <div
                    onClick={() => openDescriptionPopup(idx, desc, canEdit)}
                    className={`flex items-center w-full gap-1 rounded-md bg-gray-100 p-1 shadow-inner ${canEdit ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                >
                    <span className="flex-1 text-black text-xs truncate">{desc || <span className="text-gray-400 italic">No description</span>}</span>
                    <SquareArrowOutUpRight
                        size={12}
                        className={`text-gray-500 ${canEdit ? 'hover:text-blue-600' : 'opacity-50'}`}
                    />
                </div>
            </td>
            <td className="text-center px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px] relative">
                <select
                    className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none transition-all focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 appearance-none pr-6 shadow-inner text-black"
                    value={fieldReconcile}
                    onChange={(e) => handleSelectChange('reconcile', e.target.value)}
                    onBlur={(e) => handleBlur('reconcile', e.target.value)}
                    disabled={!canEdit}
                    title={!canEdit ? "You do not have permission to edit this field." : "Set reconciliation option"}
                >
                    {reconcileOptions.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                    <ChevronDown size={12} className="text-gray-600" />
                </div>
            </td>
            <td className="text-center px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[70px]">
                <label className="inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-accent rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        checked={useLlm}
                        onChange={(e) => handleCheckboxChange('use_llm', e.target.checked)}
                        disabled={!canEdit}
                        title={!canEdit ? "You do not have permission to edit this field." : "Allow LLM to extract this field"}
                    />
                </label>
            </td>
            <td className="text-center px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[40px]">
                <button
                    className="bg-transparent text-gray-500 border-none p-1.5 rounded-full cursor-pointer transition-all hover:bg-red-50 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => canDelete(idx)}
                    disabled={!canEdit}
                    title={!canEdit ? "You do not have permission to delete this field." : "Delete field"}
                >
                    <Trash2 size={12} />
                </button>
            </td>
        </tr>
    );
}

// Main Generic Fields Configuration Component
const GenericFieldsConfig = () => {
    const [fields, setFields] = useState([]);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [fieldToDeleteIndex, setFieldToDeleteIndex] = useState(null);
    const [canSave, setCanSave] = useState(false);
    const [tableConfigGenerated, setTableConfigGenerated] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Add refs for scroll position management
    const scrollPositionRef = useRef(0);
    const tableWrapperRef = useRef(null);

    // State for popups
    const [cardPopup, setCardPopup] = useState({
        isOpen: false,
        title: '',
        content: '',
        isEditable: false,
        field: '',
        index: null,
        contentType: 'text'
    });

    const dispatch = useDispatch();
    const user = useSelector(state => state.auth.user);
    const userRole = user?.role;
    const token = user?.token;

    // Permissions logic - only super_admin can access this page
    const canEditGenericFields = userRole === 'super_admin';
    const canDeleteGenericFields = userRole === 'super_admin';
    const permissionDeniedMessage = "You do not have permission to access Generic Fields Configuration.";

    const [originalFields, setOriginalFields] = useState([]);

    // Function to check if all field names are valid
    const areAllFieldNamesValid = useCallback(() => {
        return fields.every(field => /^[a-zA-Z0-9_]+$/.test(field.field) && field.field.trim() !== '');
    }, [fields]);

    // Function to check for duplicate field names
    const getDuplicateFieldName = useCallback(() => {
        const seen = new Set();
        
        for (let field of fields) {
            const normalizedName = field.field?.trim().toLowerCase();
            
            if (!normalizedName) continue;
            
            if (seen.has(normalizedName)) {
                return field.field;
            }
            
            seen.add(normalizedName);
        }
        
        return null;
    }, [fields]);

    // Main function to fetch generic fields from the database.
    const fetchGenericFields = useCallback(async () => {
        if (!user || !token) {
            setLoading(false);
            return;
        }

        // Only super_admin can access this
        if (userRole !== 'super_admin') {
            toast.error(permissionDeniedMessage);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            // Using ap_generic_fields
            const res = await axios.get(`/api/v1/tables/ap_generic_fields`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.length > 0) {
                // Map data for frontend state
                const convertedForFrontend = res.data.map((f) => ({
                    id: f.id,
                    uniqueId: f.id || generateUniqueId(),
                    field: f.field || '',
                    type: f.type || 'text',
                    parent: f.parent || '',
                    description: f.description || '',
                    reconcile: f.reconcile || 'None',
                    use_llm: f.use_llm || false
                }));

                setFields(convertedForFrontend);

                // Store original data for comparison
                const originalBackendFormat = res.data.map((f) => ({
                    id: f.id,
                    uniqueId: f.id || generateUniqueId(),
                    field: f.field || '',
                    type: f.type || 'text',
                    parent: f.parent || '',
                    description: f.description || '',
                    reconcile: f.reconcile || 'None',
                    use_llm: f.use_llm || false
                }));

                setOriginalFields(originalBackendFormat);
                setTableConfigGenerated(true);
                setCanSave(false);
                toast.success('Generic fields loaded successfully!');
            } else {
                setFields([]);
                setOriginalFields([]);
                setTableConfigGenerated(false);
                toast.warn('No generic fields found.');
            }
        } catch (err) {
            toast.error('Failed to load generic fields.');
            setFields([]);
            setOriginalFields([]);
            setTableConfigGenerated(false);
        } finally {
            setLoading(false);
        }
    }, [user, userRole, token]);

    // Add useLayoutEffect for scroll position restoration
    useLayoutEffect(() => {
        if (tableWrapperRef.current && scrollPositionRef.current > 0) {
            tableWrapperRef.current.scrollTop = scrollPositionRef.current;
            scrollPositionRef.current = 0; // Reset after restoring
        }
    }, [fields]); // Run this effect after fields state updates

    // Update handleAddField to include scroll position management
    const handleAddField = () => {
        if (!canEditGenericFields) {
            toast.error(permissionDeniedMessage);
            return;
        }

        // Save scroll position
        if (tableWrapperRef.current) {
            scrollPositionRef.current = tableWrapperRef.current.scrollTop;
        }

        // New field object
        const newField = {
            id: null,
            uniqueId: generateUniqueId(),
            field: '',
            type: 'text',
            parent: '',
            description: '',
            reconcile: 'None',
            use_llm: true
        };

        setFields((prevFields) => {
            const newFields = [...prevFields, newField];
            setTimeout(() => {
                const newFieldElement = document.getElementById(`field-${newField.uniqueId}`);
                if (newFieldElement) {
                    newFieldElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            }, 100);
            return newFields;
        });

        setCanSave(true);
        setTableConfigGenerated(false);
        toast.info('New field added. Remember to save the structure!');
    };

    // Update handleRemoveField to include scroll position management
    const handleRemoveField = (index) => {
        if (!canDeleteGenericFields) {
            toast.error(permissionDeniedMessage);
            return;
        }
        
        // Save scroll position
        if (tableWrapperRef.current) {
            scrollPositionRef.current = tableWrapperRef.current.scrollTop;
        }
        
        setFieldToDeleteIndex(index);
        setShowDeleteDialog(true);
    };

    // Update confirmDeleteField to include scroll position management
    const confirmDeleteField = () => {
        if (fieldToDeleteIndex !== null) {
            // Save scroll position
            if (tableWrapperRef.current) {
                scrollPositionRef.current = tableWrapperRef.current.scrollTop;
            }
            
            const updatedFields = fields.filter((_, i) => i !== fieldToDeleteIndex);
            setFields(updatedFields);
            setCanSave(true);
            setTableConfigGenerated(false);
            toast.info('Field marked for removal. Remember to save the structure to apply changes!');
        }
        setShowDeleteDialog(false);
        setFieldToDeleteIndex(null);
    };

    const cancelDeleteField = () => {
        setShowDeleteDialog(false);
        setFieldToDeleteIndex(null);
    };

    // Update handleFieldChange to include scroll position management
    const handleFieldChange = (index, key, value) => {
        if (!canEditGenericFields) {
            toast.error(permissionDeniedMessage);
            return;
        }
        
        // Save scroll position
        if (tableWrapperRef.current) {
            scrollPositionRef.current = tableWrapperRef.current.scrollTop;
        }

        setFields(prevFields => {
            const updated = [...prevFields];
            const oldFieldValue = updated[index][key];
            updated[index] = { ...updated[index], [key]: value };

            // If this is a parent field name change, update all child fields that reference it
            if (key === 'field' && updated[index].type === 'array') {
                const oldName = oldFieldValue;
                const newName = value;
                if (oldName !== newName) {
                    // Update all child fields that reference this parent
                    for (let i = 0; i < updated.length; i++) {
                        if (updated[i].parent === oldName) {
                            updated[i] = { ...updated[i], parent: newName };
                        }
                    }
                }
            }
            return updated;
        });

        setCanSave(true);
        setTableConfigGenerated(false);
    };

    // Popup handlers
    const openDescriptionPopup = (index, description, isEditable) => {
        setCardPopup({
            isOpen: true,
            title: 'Field Description',
            content: description || '',
            isEditable: isEditable && canEditGenericFields,
            field: 'description',
            index,
            contentType: 'text'
        });
    };

    const handleCardPopupChange = (content) => {
        setCardPopup(prev => {
            const updatedPopup = {
                ...prev,
                content
            };
            if (prev.index !== null && prev.field) {
                handleFieldChange(prev.index, prev.field, content);
            }
            return updatedPopup;
        });
    };

    const closeCardPopup = () => {
        setCardPopup({
            isOpen: false,
            title: '',
            content: '',
            isEditable: false,
            field: '',
            index: null,
            contentType: 'text'
        });
    };

    // Save schema handler
    const handleSaveSchema = () => {
        if (!canEditGenericFields) {
            toast.error(permissionDeniedMessage);
            return;
        }

        const hasEmptyName = fields.some((field) => field.field.trim() === '');
        if (hasEmptyName) {
            // Remove the toast error since we're now showing the error message below the input
            // toast.error('Error: Field names cannot be empty.');
            return;
        }

        if (!areAllFieldNamesValid()) {
            // Remove the toast error since we're now showing the error message below the input
            // toast.error(`Please fix invalid field names. Only letters, numbers, and underscores are allowed.`);
            // Highlight first invalid row
            const firstInvalidField = fields.find(field => !/^[a-zA-Z0-9_]+$/.test(field.field) || field.field.trim() === '');
            if (firstInvalidField) {
                const rowElement = document.getElementById(`field-${firstInvalidField.uniqueId}`);
                if (rowElement) {
                    rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    rowElement.classList.add('ring-4', 'ring-red-400', 'ring-opacity-80', 'bg-red-50', 'transition-all', 'duration-300');
                    setTimeout(() => {
                        rowElement.classList.remove('ring-4', 'ring-red-400', 'ring-opacity-80', 'bg-red-50');
                    }, 3000);
                }
            }
            return;
        }

        const duplicateFieldName = getDuplicateFieldName();

        if (duplicateFieldName) {
            toast.error(
                `Duplicate field '${duplicateFieldName}' already exists.`
            );
            return;
        }

        setShowSaveDialog(true);
    };

    const cancelGenerate = () => setShowSaveDialog(false);

    // Confirm generate (save) handler
    const confirmGenerate = async () => {
        if (!canEditGenericFields) {
            toast.error(permissionDeniedMessage);
            setShowSaveDialog(false);
            return;
        }

        if (!token) {
            toast.error('Authentication information not found. Please log in.');
            setShowSaveDialog(false);
            return;
        }

        // Check for duplicates before attempting to save
        const duplicateFieldName = getDuplicateFieldName();
        if (duplicateFieldName) {
            toast.error(
                `Duplicate field '${duplicateFieldName}' detected. Please resolve before saving.`
            );
            setShowSaveDialog(false);
            return;
        }

        const operations = [];
        const headers = { Authorization: `Bearer ${token}` };
        const fieldUpdates = []; // Track which fields need updates after operations

        // Find fields to delete (those that existed before but are no longer present)
        const fieldsToDelete = originalFields.filter(
            originalField =>
                !fields.some(currentField => currentField.uniqueId === originalField.uniqueId)
        );

        // Delete removed fields
        fieldsToDelete.forEach(field => {
            if (field.id) {
                operations.push(
                    axios.delete(
                        `/api/v1/tables/ap_generic_fields?id=eq.${field.id}`,
                        { headers }
                    )
                );
            }
        });

        // Process each field for update or insert
        fields.forEach((field, index) => {
            // Prepare payload
            const payload = {
                field: field.field.trim(),
                type: field.type,
                parent: field.parent,
                description: field.description.trim(),
                reconcile: field.reconcile,
                use_llm: field.use_llm
            };

            if (field.id) {
                // Update existing field
                const originalField = originalFields.find(o => o.id === field.id);
                const isChanged =
                    originalField &&
                    (originalField.field !== payload.field ||
                        originalField.type !== payload.type ||
                        originalField.parent !== payload.parent ||
                        originalField.description !== payload.description ||
                        originalField.reconcile !== payload.reconcile ||
                        originalField.use_llm !== payload.use_llm);

                if (isChanged) {
                    const patchUrl = `/api/v1/tables/ap_generic_fields?id=eq.${field.id}`;
                    const operation = axios.patch(patchUrl, payload, { headers })
                        .then(response => {
                            // Track that this field was updated
                            fieldUpdates[index] = response.data[0];
                        });
                    operations.push(operation);
                }
            } else {
                // Insert new field
                const operation = axios.post(`/api/v1/tables/ap_generic_fields`, [payload], { headers })
                    .then(response => {
                        // Track that this field was inserted with new ID
                        if (response.data && response.data.length > 0) {
                            fieldUpdates[index] = { id: response.data[0].id };
                        }
                    });
                operations.push(operation);
            }
        });

        try {
            await Promise.all(operations);
            
            // Apply updates to fields
            const updatedFields = [...fields];
            Object.keys(fieldUpdates).forEach(index => {
                updatedFields[index] = { ...updatedFields[index], ...fieldUpdates[index] };
            });
            
            toast.success('Generic fields saved successfully!');
            setFields(updatedFields);
            setOriginalFields(updatedFields.map(field => ({ ...field })));
            setTableConfigGenerated(true);
            setCanSave(false);
        } catch (err) {
            toast.error(
                err.response?.data?.error ||
                err.response?.data?.message ||
                'Save failed.'
            );
        } finally {
            setShowSaveDialog(false);
        }
    };

    useEffect(() => {
        fetchGenericFields();
    }, [fetchGenericFields]);

    // Add beforeunload listener to warn about unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (canSave && !tableConfigGenerated) {
                event.preventDefault();
                event.returnValue = '';
                return 'You have unsaved changes. Are you sure you want to leave this page?';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [canSave, tableConfigGenerated]);

    // Check permissions on mount
    useEffect(() => {
        if (userRole !== 'super_admin') {
            toast.error(permissionDeniedMessage);
        }
    }, [userRole]);

    const handleEditTable = () => {
        if (!canEditGenericFields) {
            toast.error(permissionDeniedMessage);
            return;
        }
        setTableConfigGenerated(false);
        setCanSave(true);
    };

    const handleCancelEdit = () => {
        // Restore original backend state
        setFields(originalFields.map(field => ({ ...field })));

        // Reset flags
        setTableConfigGenerated(true);
        setCanSave(false);

        toast.info('Changes discarded.');
    };

    // Open popup for readonly row
    const openCardPopupForReadonly = (title, content, isEditable, itemId, field, contentType) => {
        setCardPopup({
            isOpen: true,
            title,
            content: content || '',
            isEditable: false, // Readonly row popups are never editable
            field,
            index: null, // No index for readonly
            itemId,
            contentType
        });
    };


    if (!user || loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Check if user has permission to view this page
    if (userRole !== 'super_admin') {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl shadow-sm p-6">
                <AlertTriangle size={48} className="text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
                <p className="text-gray-600 text-center">
                    {permissionDeniedMessage}
                </p>
            </div>
        );
    }

    return (
        <>
            {/* Tailwind and Custom Scrollbar Styles */}
            <style>
                {`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        * { font-family: 'Poppins', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #a1a1a1; border-radius: 10px; border: 2px solid #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; }
        .truncate {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        `}
            </style>
            <div className="font-[Poppins] p-4 rounded-xl max-w-auto mx-auto h-[80vh] flex flex-col">
                <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                <div className="bg-white rounded-xl flex-grow flex flex-col">
                    <div className="flex-grow overflow-hidden flex flex-col">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">
                            Generic Fields Configuration
                        </h2>

                        {!tableConfigGenerated ? (
                            <div className="flex-grow overflow-hidden relative border border-gray-300 rounded-xl shadow-inner max-h-[70vh]">
                                <div className="absolute inset-0 overflow-auto custom-scrollbar" ref={tableWrapperRef}>
                                    <table className="w-full border-separate border-spacing-0">
                                        <thead className="sticky top-0 z-20">
                                            <tr className="bg-gray-100 shadow-sm">
                                                <th className="sticky left-0 bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[40px] rounded-tl-xl">Sr.</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[120px]">Field Name</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[80px]">Type</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[100px]">Parent</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[150px]">Description</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[80px]">Reconcile</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[70px]">Use LLM</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[40px]">Del</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fields.map((field, idx) => (
                                                <EditableRow
                                                    key={field.uniqueId}
                                                    field={field}
                                                    idx={idx}
                                                    fields={fields}
                                                    userRole={userRole}
                                                    canEdit={canEditGenericFields}
                                                    canDelete={handleRemoveField}
                                                    onFieldChange={handleFieldChange}
                                                    openDescriptionPopup={openDescriptionPopup}
                                                    tableWrapperRef={tableWrapperRef}
                                                    scrollPositionRef={scrollPositionRef}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-grow overflow-hidden relative border border-gray-300 rounded-xl shadow-inner max-h-[70vh]">
                                <div className="absolute inset-0 overflow-auto custom-scrollbar">
                                    <table className="w-full border-separate border-spacing-0">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-gray-100 shadow-sm">
                                                <th className="sticky left-0 bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[40px] rounded-tl-xl">Sr.</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[120px]">Field Name</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[80px]">Type</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[100px]">Parent</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[150px]">Description</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[80px] rounded-tr-xl">Reconcile</th>
                                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[70px]">Use LLM</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fields.map((field, idx) => (
                                                <TableReadonlyRow key={idx} field={field} userRole={userRole} openCardPopup={openCardPopupForReadonly} index={idx} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-200 justify-start">
                            {!tableConfigGenerated ? (
                                <>
                                    <button
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md font-medium text-xs cursor-pointer transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow hover:shadow-md"
                                        onClick={handleAddField}
                                        disabled={!canEditGenericFields}
                                        title={!canEditGenericFields ? permissionDeniedMessage : "Add a new field to the configuration"}
                                    >
                                        <Plus size={14} /> Add Field
                                    </button>
                                    <button
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md font-medium text-xs cursor-pointer transition-all bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow hover:shadow-md"
                                        onClick={handleSaveSchema}
                                        disabled={!canSave || !canEditGenericFields || !areAllFieldNamesValid() || getDuplicateFieldName() !== null}
                                        title={!canEditGenericFields ? permissionDeniedMessage : (!areAllFieldNamesValid() ? "Fix invalid field names before saving" : (getDuplicateFieldName() !== null ? "Duplicate field names detected" : "Save the current structure"))}
                                    >
                                        <Save size={14} /> Save Structure
                                    </button>
                                    <button
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md font-medium text-xs cursor-pointer transition-all bg-gray-600 text-white hover:bg-gray-700 shadow hover:shadow-md"
                                        onClick={handleCancelEdit}
                                        title="Discard changes and return to view mode"
                                    >
                                        <X size={14} /> Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md font-medium text-xs cursor-pointer transition-all bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow hover:shadow-md"
                                    onClick={handleEditTable}
                                    disabled={!canEditGenericFields}
                                    title={!canEditGenericFields ? permissionDeniedMessage : "Edit the generic fields table"}
                                >
                                    <Pencil size={14} /> Edit table
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modals */}
                {showSaveDialog && (
                    <div className="fixed inset-0 w-screen h-screen bg-black bg-opacity-60 flex items-center justify-center z-[1000] p-4">
                        <div className="bg-white p-6 rounded-lg text-center shadow-xl max-w-md w-full transition-transform transform scale-100">
                            <p className="m-0 mb-4 text-sm text-black font-medium leading-relaxed">
                                Are you sure you want to save this structure? This will update the generic fields configuration.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    className="inline-flex items-center gap-1 px-4 py-2 border-none rounded-md font-medium text-xs cursor-pointer transition-all bg-gray-600 text-white hover:bg-gray-700 shadow-sm hover:shadow"
                                    onClick={cancelGenerate}
                                >
                                    No, Cancel
                                </button>
                                <button
                                    className="inline-flex items-center gap-1 px-4 py-2 border-none rounded-md font-medium text-xs cursor-pointer transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow"
                                    onClick={confirmGenerate}
                                >
                                    Yes, Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showDeleteDialog && (
                    <div className="fixed inset-0 w-screen h-screen bg-black bg-opacity-60 flex items-center justify-center z-[1000] p-4">
                        <div className="bg-white p-6 rounded-lg text-center shadow-xl max-w-md w-full transition-transform transform scale-100">
                            <p className="m-0 mb-4 text-sm text-gray-800 font-medium leading-relaxed">
                                Are you sure you want to delete this field? This action cannot be undone.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    className="inline-flex items-center gap-1 px-4 py-2 border-none rounded-md font-medium text-xs cursor-pointer transition-all bg-gray-600 text-white hover:bg-gray-700 shadow-sm hover:shadow"
                                    onClick={cancelDeleteField}
                                >
                                    No, Cancel
                                </button>
                                <button
                                    className="inline-flex items-center gap-1 px-4 py-2 border-none rounded-md font-medium text-xs cursor-pointer transition-all bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow"
                                    onClick={confirmDeleteField}
                                >
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CardPopup for description */}
                <CardPopup
                    isOpen={cardPopup.isOpen}
                    onRequestClose={closeCardPopup}
                    title={cardPopup.title}
                    content={cardPopup.content}
                    isEditable={cardPopup.isEditable}
                    onContentChange={handleCardPopupChange}
                    field={cardPopup.field}
                    contentType={cardPopup.contentType}
                    showActionButtons={cardPopup.isEditable}
                    itemId={cardPopup.itemId}
                />
            </div>
        </>
    );
};

export default GenericFieldsConfig;
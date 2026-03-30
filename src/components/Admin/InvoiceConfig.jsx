import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Trash2, Pencil, GripVertical, Plus, Save, AlertTriangle, Lightbulb, ChevronDown, Minus, SquareArrowOutUpRight, Edit3, SquareArrowOutUpRight as SquareArrowOutUpRightLucide, X, Settings, Building2 } from 'lucide-react';
import Button from '../common/Button';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import axios from '../../utils/authInterceptor';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector, useDispatch } from 'react-redux';
import { setAuth } from '../../store/authSlice';
import CardPopup from '../common/CardPopup';
import CardDialog from '../common/CardDialog';
import SearchableSelect from '../common/SearchableSelect';
// import { parseCustomValues, renderCustomValueField } from '../../utils/customValuesParser.jsx';
import { apiBaseUrl } from '../../config/apiConfig';
import { useNavigate, useSearchParams } from 'react-router-dom';

// --- Helper Functions (from uploaded file) ---
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
const fieldTypes = ['text', 'number', 'date', 'array', 'boolean']; // Removed 'dropdown' as requested
const reconcileOptions = ['None', 'PO', 'GRN', 'PO,GRN']; // Kept from original

// --- Helper Components ---

/**
 * A standalone component for the drag overlay.
 * Updated to include display_name and reconcile.
 */
const DraggableRow = ({ field, activeIndex, userRole, fields }) => {
  if (!field) return null;
  const parentNames = fields.filter(f => f.type === 'array' && f.name).map(f => f.name);

  return (
    <tr className="bg-accent/10 border-2 border-accent shadow-md">
      <td className="text-center text-accent px-2 py-1 text-xs font-medium align-middle min-w-[40px]">
        {activeIndex + 1}
      </td>
      {userRole === 'super_admin' && (
        <td className="px-2 py-1 text-xs align-middle min-w-[80px]">
          <input
            type="text"
            value={field.tenant_name || 'N/A'}
            disabled
            className="w-full border-none bg-transparent p-1 text-gray-800 text-xs font-medium"
          />
        </td>
      )}
      <td className="px-2 py-1 text-xs align-middle min-w-[120px]">
        <input
          type="text"
          className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none border-none shadow-inner text-black"
          defaultValue={field.name}
          disabled
        />
      </td>
      {/* Added Display Name Column */}
      <td className="px-2 py-1 text-xs align-middle min-w-[120px]">
        <input
          type="text"
          className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none border-none shadow-inner text-black"
          defaultValue={field.display_name}
          disabled
        />
      </td>
      <td className="px-2 py-1 text-xs align-middle relative min-w-[80px]">
        <select className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none appearance-none pr-6 border-none shadow-inner text-black" value={field.type} disabled>
          {fieldTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
          <ChevronDown size={12} className="text-gray-600" />
        </div>
      </td>
      <td className="px-2 py-1 text-xs align-middle relative min-w-[100px]">
        <select className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none appearance-none pr-6 border-none shadow-inner text-black" value={field.parent} disabled>
          <option value=""></option>
          {parentNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
          <ChevronDown size={12} className="text-gray-600" />
        </div>
      </td>
      <td className="px-2 py-1 text-xs align-middle min-w-[150px]">
        <div className="flex items-center gap-1 rounded-md bg-gray-100 p-1 shadow-inner">
          <span className="flex-1 text-black text-xs truncate">{field.desc}</span>
          <SquareArrowOutUpRightLucide size={12} className="text-gray-400" />
        </div>
      </td>
      <td className="px-2 py-1 text-xs align-middle min-w-[150px]">
        {field.type === 'array' ? (
          <div className="flex items-center gap-1 rounded-md bg-gray-100 p-1 shadow-inner opacity-50 cursor-not-allowed">
            <span className="flex-1 text-gray-400 italic text-xs truncate">N/A for array</span>
            <SquareArrowOutUpRightLucide size={12} className="text-gray-300" />
          </div>
        ) : (
          <div className="flex items-center gap-1 rounded-md bg-gray-100 p-1 shadow-inner">
            <span className="flex-1 text-black text-xs truncate">{field.custom_values}</span>
            <SquareArrowOutUpRightLucide size={12} className="text-gray-400" />
          </div>
        )}
      </td>
      <td className="text-center px-2 py-1 text-xs align-middle min-w-[80px]">
        <div className="flex items-center gap-1 rounded-md bg-gray-100 p-1 shadow-inner">
          <span className="flex-1 text-black text-xs truncate">
            {[
              field.is_required ? 'Required' : '',
              field.is_visible ? 'Visible' : '',
              field.is_readonly ? 'Readonly' : ''
            ].filter(Boolean).join(', ') || 'Custom'}
          </span>
          <SquareArrowOutUpRightLucide size={12} className="text-gray-400" />
        </div>
      </td>
      {/* Added Reconcile Column Back */}
      <td className="text-center px-2 py-1 text-xs align-middle relative min-w-[80px]">
        <select className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none appearance-none pr-6 border-none shadow-inner text-black" value={field.reconcile} disabled>
          {reconcileOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
          <ChevronDown size={12} className="text-gray-600" />
        </div>
      </td>
      <td className="text-center px-2 py-1 text-xs align-middle min-w-[40px]">
        <Button
          color="red"
          icon={Trash2}
          size="xs"
          variant="ghost"
          className="p-1.5"
          disabled
        />
      </td>
      <td className="text-center text-gray-600 p-1.5 cursor-grab min-w-[40px]">
        <GripVertical size={12} />
      </td>
    </tr>
  );
};

/**
 * Readonly row component.
 * Updated to include display_name and reconcile.
 */
function TableReadonlyRow({ field, userRole, openCardPopup, openCardPopupForReadonly, index }) {
  const isSuperAdmin = userRole === 'super_admin';

  const handleOpenPopup = (key, title, content, contentType, fieldName) => {
    // For meta config validation/readonly display
    if (contentType === 'metaConfig') {
      const metaData = {
        required: field.is_required,
        visible: field.is_visible === undefined ? true : field.is_visible,
        readonly: field.is_readonly || false
      };
      openCardPopupForReadonly(title, JSON.stringify(metaData), false, field.uniqueId, key, contentType, fieldName || field.name);
      return;
    }
    openCardPopupForReadonly(title, content, false, field.uniqueId, key, contentType, fieldName || field.name);
  };

  return (
    <tr className="hover:bg-accent/5 transition-colors">
      <td className="sticky left-0 bg-white border-b border-r border-gray-200 text-center text-gray-600 px-2 py-1 text-xs align-middle min-w-[40px]" data-tour="row-number-cell">
        {index + 1}
      </td>
      {/* {isSuperAdmin && (
        <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px]" data-tour="tenant-name-cell">
          <span className="w-full block border-none bg-transparent p-1 text-gray-800 text-xs truncate">{field.tenant_name || 'N/A'}</span>
        </td>
      )} */}
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[120px]" data-tour="field-name-cell">
        <span className="w-full block border-none bg-transparent p-1 text-gray-800 text-xs truncate">{field.name}</span>
      </td>
      {/* Added Display Name Column */}
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[120px]">
        <span className="w-full block border-none bg-transparent p-1 text-gray-800 text-xs truncate">{field.display_name}</span>
      </td>
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px]">
        <span className="w-full block border-none bg-transparent p-1 text-gray-800 text-xs truncate">{field.type}</span>
      </td>
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[100px]">
        <span className="w-full block border-none bg-transparent p-1 text-gray-800 text-xs truncate">{field.parent || '—'}</span>
      </td>
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 max-w-[200px]">
        <div className="flex items-center gap-1 rounded-md p-1">
          <span className="flex-1 text-gray-800 text-xs truncate">{field.desc || '—'}</span>
          <Button
            onClick={() => handleOpenPopup('desc', 'Description', field.desc, 'text', field.name)}
            title="View description"
            data-tour="invoice-config-description-popup"
            color="indigo"
            icon={SquareArrowOutUpRightLucide}
            size="xs"
            variant="ghost"
            className="p-1 rounded-full"
          />
        </div>
      </td>
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 max-w-[150px]">
        <div className="flex items-center gap-1 rounded-md p-1">
          <span className="flex-1 text-gray-800 text-xs truncate">{field.custom_values || '—'}</span>
          <Button
            onClick={() => handleOpenPopup('custom_values', 'Custom Values', field.custom_values, 'customValues', field.name)}
            title="View custom values"
            data-tour="invoice-config-custom-values-popup"
            color="indigo"
            icon={SquareArrowOutUpRightLucide}
            size="xs"
            variant="ghost"
            className="p-1 rounded-full"
          />
        </div>
      </td>
      <td className="text-center px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px]">
        <div
          className="flex items-center gap-1 rounded-md p-1 cursor-pointer"
          onClick={() => handleOpenPopup('meta_config', `Meta Configuration for ${field.name}`, '', 'metaConfig', field.name)}
          title="Configure Requirement, Visibility and Read-only status"
        >
          <span className="flex-1 text-gray-800 text-xs truncate text-left">
            {[
              field.is_required ? 'Required' : '',
              (field.is_visible === undefined ? true : field.is_visible) ? 'Visible' : '',
              field.is_readonly ? 'Readonly' : ''
            ].filter(Boolean).join(', ') || '—'}
          </span>
          <Settings size={14} className="text-gray-500" />
        </div>
      </td>
      <td className="text-center px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[70px]">
        <input type="checkbox" checked={field.use_llm} disabled className="form-checkbox h-4 w-4 text-blue-600 rounded" />
      </td>
      {/* Added Reconcile Column Back */}
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px]">
        <span className="w-full block border-none bg-transparent p-1 text-gray-800 text-xs truncate">{field.reconcile || 'None'}</span>
      </td>
    </tr>
  );
}

/**
 * Sortable Row component from uploaded file.
 * Merged with display_name, validation, popups, and reconcile.
 */
function SortableRow({ field, idx, onFieldChange, canEdit, canDelete, fields, userRole, openDescriptionPopup, openCustomValuesPopup, openMetaConfigPopup, tableWrapperRef, scrollPositionRef }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.uniqueId });

  const [name, setName] = useState(field.name);
  const [displayName, setDisplayName] = useState(field.display_name || toTitleCase(field.name));
  const [desc, setDesc] = useState(field.desc);
  const [type, setType] = useState(field.type);
  const [parent, setParent] = useState(field.parent);
  const [useLlm, setUseLlm] = useState(field.use_llm);
  const [isRequired, setIsRequired] = useState(field.is_required);
  const [isVisible, setIsVisible] = useState(field.is_visible === undefined ? true : field.is_visible);
  const [isReadOnly, setIsReadOnly] = useState(field.is_readonly || false);
  const [customValues, setCustomValues] = useState(field.custom_values);
  const [fieldReconcile, setFieldReconcile] = useState(field.reconcile || 'None'); // Added back

  const [isDisplayNameManuallyEdited, setIsDisplayNameManuallyEdited] = useState(
    field.display_name && field.display_name !== toTitleCase(field.name)
  );
  const [isFieldNameValid, setIsFieldNameValid] = useState(true);
  const [fieldNameErrorMessage, setFieldNameErrorMessage] = useState('');


  useEffect(() => {
    setName(field.name);
    const autoDisplayName = toTitleCase(field.name);
    // Update the manual edit status when field changes
    const manuallyEdited = field.display_name && field.display_name !== autoDisplayName;
    setIsDisplayNameManuallyEdited(manuallyEdited);
    // Only update display name if it hasn't been manually edited
    if (!manuallyEdited) {
      setDisplayName(field.display_name || autoDisplayName);
    }

    setDesc(field.desc);
    setType(field.type);
    setParent(field.parent);
    setUseLlm(field.use_llm);
    setIsRequired(field.is_required);
    setIsVisible(field.is_visible === undefined ? true : field.is_visible);
    setIsReadOnly(field.is_readonly || false);
    setCustomValues(field.custom_values);
    setFieldReconcile(field.reconcile || 'None'); // Added back

    validateFieldName(field.name);
  }, [field]); // Remove isDisplayNameManuallyEdited from dependencies to prevent resetting while typing

  // Re-validate when parent changes to update duplicate checks
  useEffect(() => {
    validateFieldName(name);
  }, [parent, name]);

  const validateFieldName = (fieldName) => {
    const trimmed = fieldName.trim();
    const normalized = trimmed.toLowerCase();

    // 1️⃣ Basic format validation
    const formatValid =
      /^[a-zA-Z0-9_]+$/.test(trimmed) && trimmed.length > 0;

    if (!formatValid) {
      setIsFieldNameValid(false);
      setFieldNameErrorMessage(
        trimmed.length === 0
          ? 'Field name cannot be empty.'
          : 'Only letters, numbers, and underscores allowed.'
      );
      return false;
    }

    // 2️⃣ Duplicate check (REAL FIX)
    const duplicate = fields.some((f, index) => {
      if (index === idx) return false;
      return f.name?.trim().toLowerCase() === normalized;
    });

    if (duplicate) {
      setIsFieldNameValid(false);
      setFieldNameErrorMessage('Duplicate field name not allowed.');
      return false;
    }

    // 3️⃣ Valid
    setIsFieldNameValid(true);
    setFieldNameErrorMessage('');
    return true;
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative'
  };

  const handleBlur = (key, value) => {
    // Save scroll position
    if (tableWrapperRef.current) {
      scrollPositionRef.current = tableWrapperRef.current.scrollTop;
    }

    if (key === 'name') {
      validateFieldName(value); // Only call it to update error state

      if (!isDisplayNameManuallyEdited) {
        const newDisplayName = toTitleCase(value);
        setDisplayName(newDisplayName);
        onFieldChange(idx, 'display_name', newDisplayName);
      }

      if (field.type === 'array') {
        const oldName = field.name;
        if (oldName !== value) {
          fields.forEach((childField, childIndex) => {
            if (childField.parent === oldName) {
              onFieldChange(childIndex, 'parent', value);
            }
          });
        }
      }
    }

    // ALWAYS call this so the value doesn't get erased
    onFieldChange(idx, key, value);
  };

  const handleDisplayNameChange = (e) => {
    const value = e.target.value;
    setDisplayName(value);
    const autoDisplayName = toTitleCase(name);
    setIsDisplayNameManuallyEdited(value !== autoDisplayName);
  };

  const handleDisplayNameBlur = () => {
    // Save scroll position
    if (tableWrapperRef.current) {
      scrollPositionRef.current = tableWrapperRef.current.scrollTop;
    }
    const autoDisplayName = toTitleCase(name);
    setIsDisplayNameManuallyEdited(displayName !== autoDisplayName);
    onFieldChange(idx, 'display_name', displayName);
  };

  const handleCheckboxChange = (key, checked) => {
    // Save scroll position
    if (tableWrapperRef.current) {
      scrollPositionRef.current = tableWrapperRef.current.scrollTop;
    }

    // Update local state first
    if (key === 'is_required') {
      // If required is checked, ensure visibility is also checked
      if (checked && !isVisible) {
        setIsVisible(true);
        onFieldChange(idx, 'is_visible', true);
        toast.info(`Checking required also checked visibility for field '${field.name}'`);
      }
      setIsRequired(checked);
    }
    if (key === 'use_llm') setUseLlm(checked);
    if (key === 'is_visible') {
      // If visibility is unchecked, also uncheck required field
      if (!checked && isRequired) {
        setIsRequired(false);
        onFieldChange(idx, 'is_required', false);
        toast.info(`Unchecking visibility also unchecked the required flag for field '${field.name}'`);
      }
      setIsVisible(checked);
    }

    // Then update parent state
    onFieldChange(idx, key, checked);
  };

  const handleMetaConfigClick = () => {
    const metaData = {
      required: isRequired,
      visible: isVisible,
      readonly: isReadOnly
    };
    openMetaConfigPopup(idx, JSON.stringify(metaData), canEdit);
  };

  const handleSelectChange = (key, value) => {
    // Save scroll position
    if (tableWrapperRef.current) {
      scrollPositionRef.current = tableWrapperRef.current.scrollTop;
    }

    // Update local state first
    if (key === 'type') {
      setType(value);

      // If field becomes array, remove parent and clear custom values
      if (value === 'array') {
        setParent('');
        onFieldChange(idx, 'parent', '');
        setCustomValues('');
        onFieldChange(idx, 'custom_values', '');
      }
    }
    if (key === 'parent') setParent(value);
    if (key === 'reconcile') setFieldReconcile(value);

    // Then update parent state (onBlur will handle this for selects)
    handleBlur(key, value);
  };

  return (
    <tr ref={setNodeRef} style={style} {...attributes} id={`field-${field.uniqueId}`} className={`transition-all duration-200 ease-in-out ${isDragging ? 'bg-accent/10 shadow-xl' : 'hover:bg-gray-50'}`}>
      <td className="sticky left-0 bg-white border-b border-r border-gray-200 text-center text-gray-600 px-2 py-1 text-xs align-middle min-w-[40px]" data-tour="editable-row-number-cell">
        {idx + 1}
      </td>
      {/* {userRole === 'super_admin' && (
        <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px]" data-tour="tenant-name-cell">
          <input
            type="text"
            value={field.tenant_name || 'N/A'}
            disabled
            className="w-full border-none bg-transparent p-1 text-gray-800 text-xs"
          />
        </td>
      )} */}
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[120px]">
        <input
          type="text"
          className={`w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none transition-all focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 shadow-inner text-black ${!isFieldNameValid ? 'border-2 border-red-500' : ''}`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            validateFieldName(e.target.value);
          }}
          onBlur={() => handleBlur('name', name)}
          disabled={!canEdit}
          title={!canEdit ? "You do not have permission to edit this field." : "Edit field name (letters, numbers, underscores only)"}
          data-tour="field-name-input"
        />
        {!isFieldNameValid && fieldNameErrorMessage && (
          <div className="text-red-500 text-xs mt-1">{fieldNameErrorMessage}</div>
        )}
      </td>
      {/* Added Display Name Column */}
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[120px]">
        <input
          type="text"
          className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none transition-all focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 shadow-inner text-black"
          value={displayName}
          onChange={handleDisplayNameChange}
          onBlur={handleDisplayNameBlur}
          disabled={!canEdit}
          title={!canEdit ? "You do not have permission to edit this field." : "Edit display name"}
          data-tour="display-name-input"
        />
      </td>
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px] relative">
        <select
          className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none transition-all focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 appearance-none pr-6 shadow-inner text-black"
          value={type}
          onChange={(e) => handleSelectChange('type', e.target.value)}
          onBlur={(e) => handleBlur('type', e.target.value)} // Keep onBlur for consistency
          disabled={!canEdit}
          title={!canEdit ? "You do not have permission to edit this field." : "Select field type"}
          data-tour="field-type-select"
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
          disabled={!canEdit || type === 'array'}
          title={!canEdit ? "You do not have permission to edit this field." : "Select parent field"}
          data-tour="parent-field-select"
        >
          <option value=""></option>
          {fields
            .filter((f) => f.uniqueId !== field.uniqueId && f.type === 'array' && f.name)
            .map((f) => (
              <option key={f.uniqueId} value={f.name}>
                {f.name}
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
          <SquareArrowOutUpRightLucide
            size={12}
            className={`text-gray-500 ${canEdit ? 'hover:text-blue-600' : 'opacity-50'}`}
            data-tour="invoice-config-description-popup"
          />
        </div>
      </td>
      <td className="px-2 py-1 text-xs align-middle border-b border-r border-gray-200 max-w-[150px]">
        {type === 'array' ? (
          <div
            className="flex items-center w-full gap-1 rounded-md bg-gray-100 p-1 shadow-inner opacity-50 cursor-not-allowed"
            title="Custom values are not applicable for array type fields"
          >
            <span className="flex-1 text-gray-400 italic text-xs truncate">N/A for array</span>
            <SquareArrowOutUpRightLucide size={12} className="text-gray-300" />
          </div>
        ) : (
          <div
            onClick={() => openCustomValuesPopup(idx, customValues, canEdit)}
            className={`flex items-center w-full gap-1 rounded-md bg-gray-100 p-1 shadow-inner ${canEdit ? 'cursor-pointer hover:bg-gray-200' : ''}`}
          >
            <span className="flex-1 text-black text-xs truncate">{customValues || <span className="text-gray-400 italic">No custom values</span>}</span>
            <SquareArrowOutUpRightLucide
              size={12}
              className={`text-gray-500 ${canEdit ? 'hover:text-blue-600' : 'opacity-50'}`}
              data-tour="invoice-config-custom-values-popup"
            />
          </div>
        )}
      </td>
      <td className="text-center px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px]">
        <div
          onClick={handleMetaConfigClick}
          className={`flex items-center w-full gap-1 rounded-md bg-gray-100 p-1 shadow-inner ${canEdit ? 'cursor-pointer hover:bg-gray-200' : 'opacity-60'}`}
          title="Configure Requirement, Visibility and Read-only status"
        >
          <span className="flex-1 text-black text-xs truncate text-left">
            {[
              isRequired ? 'Required' : '',
              isVisible ? 'Visible' : '',
              isReadOnly ? 'Readonly' : ''
            ].filter(Boolean).join(', ') || <span className="text-gray-400 italic">—</span>}
          </span>
          <Settings size={14} className={`text-gray-500 ${canEdit ? 'hover:text-blue-600' : ''}`} />
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
            data-tour="use-llm-checkbox"
          />
        </label>
      </td>
      {/* Added Reconcile Column Back */}
      <td className="text-center px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[80px] relative">
        <select
          className="w-full text-xs p-1 box-border bg-gray-100 rounded-md outline-none transition-all focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 appearance-none pr-6 shadow-inner text-black"
          value={fieldReconcile}
          onChange={(e) => handleSelectChange('reconcile', e.target.value)}
          onBlur={(e) => handleBlur('reconcile', e.target.value)}
          disabled={!canEdit}
          title={!canEdit ? "You do not have permission to edit this field." : "Set reconciliation option"}
          data-tour="reconcile-select"
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
      <td className="text-center px-2 py-1 text-xs align-middle border-b border-r border-gray-200 min-w-[40px]">
        <Button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => canDelete(idx)}
          disabled={!canEdit}
          title={!canEdit ? deletePermissionDeniedMessage : "Delete field"}
          data-tour="invoice-config-delete"
          color="red"
          icon={Trash2}
          size="xs"
          variant="ghost"
          className="p-1.5"
        />
      </td>
      <td className="text-center text-gray-500 px-2 py-1 border-b border-r border-gray-200 cursor-grab transition-all hover:text-gray-800 active:text-blue-500 min-w-[40px] rounded-br-xl" {...listeners} title={!canEdit ? editPermissionDeniedMessage : "Drag to reorder"} data-tour="invoice-config-drag">
        <GripVertical size={12} />
      </td>
    </tr>
  );
}


// Main Invoice Structure Definition Component
const InvoiceStrucDef = () => {
  const [fields, setFields] = useState([]);
  const scrollPositionRef = useRef(0);

  // Tenant filter state for super admin
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [filteredFields, setFilteredFields] = useState([]);
  const [showTenantSelectionMessage, setShowTenantSelectionMessage] = useState(true);
  const [columnSearch, setColumnSearch] = useState({ name: '', display_name: '' });

  useLayoutEffect(() => {
    if (tableWrapperRef.current && scrollPositionRef.current > 0) {
      tableWrapperRef.current.scrollTop = scrollPositionRef.current;
      scrollPositionRef.current = 0; // Reset after restoring
    }
  }, [fields]); // Run this effect after fields state updates

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fieldToDeleteIndex, setFieldToDeleteIndex] = useState(null);
  const [canSave, setCanSave] = useState(false);
  const [tableConfigGenerated, setTableConfigGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState('extraction'); // Assuming this state is still needed
  const [loading, setLoading] = useState(true);
  const [showGenericFieldsNote, setShowGenericFieldsNote] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const tableWrapperRef = useRef(null);

  // State for popups from uploaded file
  const [cardPopup, setCardPopup] = useState({
    isOpen: false,
    title: '',
    content: '',
    isEditable: false,
    field: '',
    index: null,
    contentType: 'text'
  });

  const [cardDialog, setCardDialog] = useState({
    isOpen: false,
    title: '',
    content: '',
    isEditable: false,
    field: '',
    index: null,
    contentType: 'text',
    fieldName: '',
    validationForField: null
  });

  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const tenantId = user?.tenantId;
  const userRole = user?.role;
  const token = user?.token;

  // Updated permissions logic
  const canEditInvoiceConfig = (userRole === 'super_admin') || (userRole === 'tenant_admin');
  const canDeleteInvoiceConfig = (userRole === 'super_admin') || (userRole === 'tenant_admin');
  const editPermissionDeniedMessage = "You do not have permission to edit Invoice Field Configuration.";
  const deletePermissionDeniedMessage = "You do not have permission to delete Invoice Field Configuration.";

  const [originalFields, setOriginalFields] = useState([]);
  const isToastShown = useRef(false);

  // Function to check if all field names are valid
  const areAllFieldNamesValid = useCallback(() => {
    return fields.every(field => /^[a-zA-Z0-9_]+$/.test(field.name) && field.name.trim() !== '');
  }, [fields]);

  // Function to check for duplicate field names per tenant
  const getDuplicateFieldName = useCallback(() => {
    const seen = new Set();

    for (let field of fields) {
      const tenantKey = field.tenant_id || tenantId || '';
      const normalizedName = field.name?.trim().toLowerCase();

      if (!normalizedName) continue;

      const compositeKey = `${tenantKey}__${normalizedName}`;

      if (seen.has(compositeKey)) {
        return field.name;
      }

      seen.add(compositeKey);
    }

    return null;
  }, [fields, tenantId]);

  const fetchTenantNames = useCallback(async (tenantIds) => {
    if (!tenantIds.length || !token) {
      return {};
    }

    try {
      // Using ap_tenants as per user's SQL schema
      const tenantPromises = tenantIds.map(id =>
        axios.get(`/api/v1/tables/ap_tenants?tenant_id=eq.${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      const tenantResponses = await Promise.all(tenantPromises);
      const tenantNameMap = {};
      tenantResponses.forEach(res => {
        const tenant = res.data[0];
        if (tenant) {
          tenantNameMap[tenant.tenant_id] = tenant.tenant_name;
        }
      });
      return tenantNameMap;
    } catch (error) {
      toast.error("Failed to load some tenant names.");
      return {};
    }
  }, [token]);

  // Main function to fetch invoice config from the database.
  const fetchInvoiceConfig = useCallback(async (currentSelectedTenantId = selectedTenantId, preserveEditMode = true) => {
    let isMounted = true;
    if (!user || !token) {
      setLoading(false);
      return;
    }
    const isSuperAdmin = userRole === 'super_admin';
    
    // For super admin, only fetch data if tenant is selected
    if (isSuperAdmin && !currentSelectedTenantId) {
      setLoading(false);
      setFields([]);
      setOriginalFields([]);
      setTableConfigGenerated(false);
      setCanSave(false);
      return;
    }
    
    // Capture current edit mode before fetching
    const wasInEditMode = !tableConfigGenerated;
    
    // Using ap_field_config as per user's SQL schema
    const fetchUrl = isSuperAdmin ? 
      `/api/v1/tables/ap_field_config?tenant_id=eq.${currentSelectedTenantId}` : 
      `/api/v1/tables/ap_field_config?tenant_id=eq.${tenantId}`;
    
    // Only show loading for initial load, not when switching tenants
    if (fields.length === 0) {
      setLoading(true);
    }

    try {
      const res = await axios.get(fetchUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!isMounted) return;


      if (res.data && res.data.length > 0) {
        let enrichedData = res.data;
        if (isSuperAdmin) {
          const uniqueTenantIds = [...new Set(res.data.map(f => f.tenant_id))].filter(Boolean);
          const tenantNameMap = await fetchTenantNames(uniqueTenantIds);
          enrichedData = res.data.map(f => ({
            ...f,
            tenant_name: f.tenant_id ? tenantNameMap[f.tenant_id] || 'N/A' : 'N/A'
          }));
        }

        const sortedData = enrichedData.sort((a, b) => a.sequence - b.sequence);

        // Helper function to parse meta_config with nested value structure
        const parseMetaConfig = (metaConfigData) => {
          // Return empty object if no data
          if (!metaConfigData) {
            return {};
          }

          let metaConfig = metaConfigData;

          // Handle nested structure: { type: "jsonb", value: "{...}", null: false }
          if (metaConfig && typeof metaConfig === 'object' && !Array.isArray(metaConfig) && metaConfig.value) {
            try {
              // Check if value is a string that needs parsing
              if (typeof metaConfig.value === 'string') {
                metaConfig = JSON.parse(metaConfig.value);
              } else if (typeof metaConfig.value === 'object') {
                // Value is already an object
                metaConfig = metaConfig.value;
              }
            } catch (e) {
              console.error("Failed to parse meta_config.value for nested structure", e);
              return {};
            }
          }
          // Handle direct string format
          else if (typeof metaConfig === 'string') {
            try {
              metaConfig = JSON.parse(metaConfig);
            } catch (e) {
              console.error("Failed to parse meta_config string", e);
              return {};
            }
          }
          // If it's already an object (not string, not nested), use it directly
          else if (typeof metaConfig === 'object' && !Array.isArray(metaConfig) && !metaConfig.value) {
            // Already a plain object, use as is
            // No action needed, metaConfig is already correct
          } else {
            // Invalid format
            console.warn("Unexpected meta_config format", metaConfig);
            return {};
          }

          // Final validation: Ensure metaConfig is a valid plain object
          if (!metaConfig || typeof metaConfig !== 'object' || Array.isArray(metaConfig)) {
            console.warn("meta_config is not a valid object after parsing", metaConfig);
            return {};
          }

          return metaConfig;
        };

        // Helper function to convert string boolean to actual boolean
        const toBool = (value) => {
          if (typeof value === 'boolean') return value;
          if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
          }
          return !!value;
        };

        // Updated mapping for frontend state
        const convertedForFrontend = sortedData.map((f) => {
          let metaConfig = parseMetaConfig(f.meta_config);
          if (typeof metaConfig === 'string') {
            try {
              metaConfig = JSON.parse(metaConfig);
            } catch (e) {
              console.error("Failed to parse meta_config for frontend", e);
              metaConfig = {};
            }
          }

          // Ensure metaConfig is an object
          if (!metaConfig || typeof metaConfig !== 'object') {
            metaConfig = {};
          }

          // Extract values with proper fallbacks
          // Priority: meta_config values > direct column values > defaults
          const isRequired = metaConfig.required !== undefined
            ? toBool(metaConfig.required)
            : (metaConfig.is_required !== undefined
              ? toBool(metaConfig.is_required)
              : (f.is_required !== undefined ? toBool(f.is_required) : false));

          const isVisible = metaConfig.visible !== undefined
            ? toBool(metaConfig.visible)
            : (metaConfig.is_visible !== undefined
              ? toBool(metaConfig.is_visible)
              : (f.is_visible !== undefined ? toBool(f.is_visible) : true));

          const isReadonly = metaConfig.readonly !== undefined
            ? toBool(metaConfig.readonly)
            : (metaConfig.is_readonly !== undefined
              ? toBool(metaConfig.is_readonly)
              : (f.is_readonly !== undefined ? toBool(f.is_readonly) : false));

          return {
            config_id: f.config_id,
            uniqueId: f.config_id || generateUniqueId(),
            name: f.field_name || '',
            display_name: f.display_name || toTitleCase(f.field_name), // New mapping
            type: f.field_type || 'text',
            parent: f.parent || '',
            desc: f.description || '', // Updated mapping
            custom_values: f.custom_values || '',
            // is_required: metaConfig?.is_required ?? f.is_required ?? false,
            // is_visible: metaConfig?.is_visible ?? (f.is_visible !== undefined ? f.is_visible : true),
            // is_readonly: metaConfig?.is_readonly ?? f.is_readonly ?? false,
            is_required: isRequired,
            is_visible: isVisible,
            is_readonly: isReadonly,
            reconcile: f.reconcile || 'None', // Kept
            use_llm: f.use_llm || false,
            tenant_name: f.tenant_name || 'N/A',
            sequence: f.sequence,
            tenant_id: f.tenant_id // Keep tenant_id for save logic
          }
        });
        setFields(convertedForFrontend);

        // Updated mapping for original backend format
        const originalBackendFormat = sortedData.map((f) => {
          let metaConfig = parseMetaConfig(f.meta_config);
          if (typeof metaConfig === 'string') {
            try {
              metaConfig = JSON.parse(metaConfig);
            } catch (e) {
              console.error("Failed to parse meta_config for backend format", e);
              metaConfig = {};
            }
          }

          if (!metaConfig || typeof metaConfig !== 'object') {
            metaConfig = {};
          }

          const isRequired = metaConfig.required !== undefined
            ? toBool(metaConfig.required)
            : (metaConfig.is_required !== undefined
              ? toBool(metaConfig.is_required)
              : (f.is_required !== undefined ? toBool(f.is_required) : false));

          const isVisible = metaConfig.visible !== undefined
            ? toBool(metaConfig.visible)
            : (metaConfig.is_visible !== undefined
              ? toBool(metaConfig.is_visible)
              : (f.is_visible !== undefined ? toBool(f.is_visible) : true));

          const isReadonly = metaConfig.readonly !== undefined
            ? toBool(metaConfig.readonly)
            : (metaConfig.is_readonly !== undefined
              ? toBool(metaConfig.is_readonly)
              : (f.is_readonly !== undefined ? toBool(f.is_readonly) : false));

          return {
            config_id: f.config_id,
            uniqueId: f.config_id || generateUniqueId(),
            tenant_id: f.tenant_id,
            field_name: f.field_name || '',
            display_name: f.display_name || '', // New mapping
            field_type: f.field_type || 'text',
            parent: f.parent || '',
            description: f.description || '', // Updated mapping
            custom_values: f.custom_values || '',
            // is_required: metaConfig?.is_required ?? f.is_required ?? false,
            // is_visible: metaConfig?.is_visible ?? (f.is_visible !== undefined ? f.is_visible : true),
            // is_readonly: metaConfig?.is_readonly ?? f.is_readonly ?? false,
            is_required: isRequired,
            is_visible: isVisible,
            is_readonly: isReadonly,
            reconcile: f.reconcile || 'None', // Kept
            use_llm: f.use_llm || false,
            sequence: f.sequence,
            tenant_name: f.tenant_name || 'N/A' // For super_admin view
          };
        });
        setOriginalFields(originalBackendFormat);
        
        // Determine edit mode based on role and context
        if (isSuperAdmin) {
          // Super admin: always land in view (read-only) mode after selecting a tenant.
          // They must click "Edit table" manually to enter edit mode — prevents accidental changes.
          setTableConfigGenerated(true);
          setCanSave(false);
        } else {
          // Tenant admin: only set mode if it's initial load or after save
          if (!preserveEditMode) {
            // After save: go to non-editable mode
            setTableConfigGenerated(true);
            setCanSave(false);
          } else if (fields.length === 0) {
            // Initial load: start in non-editable mode
            setTableConfigGenerated(true);
            setCanSave(false);
          }
          // Otherwise: don't change mode (tenant admin is editing)
        }
        
        setShowGenericFieldsNote(false);
        if (!isToastShown.current) {
          // toast.success('Invoice configuration loaded successfully!');
          isToastShown.current = true;
        }
      } else {
        // For super admin, don't load generic fields - they must select a tenant first
        if (isSuperAdmin) {
          setFields([]);
          setOriginalFields([]);
          setTableConfigGenerated(true); // Stay in view mode; admin clicks "Edit table" to add fields
          setCanSave(false);
          setShowGenericFieldsNote(false);
          if (!isToastShown.current && currentSelectedTenantId) {
            toast.info('No configuration found for this tenant. You can add fields to create one.');
            isToastShown.current = true;
          }
        } else {
          toast.warn('No tenant-specific configuration found. Loading generic fields.');
          fetchGenericFields(isMounted);
        }
      }
    } catch (err) {
      if (!isMounted) return;
      toast.error('Failed to load configuration.');
      setFields([]);
      setOriginalFields([]);
      setTableConfigGenerated(false);
    } finally {
      if (isMounted) setLoading(false);
    }
  }, [user, userRole, tenantId, token, fetchTenantNames, selectedTenantId]);

  const fetchGenericFields = async (isMounted) => {
    if (!token || userRole === 'super_admin') {
      // Super admin should not load generic fields
      return;
    }

    try {
      // ap_generic_fields has no tenant_id column — fetch all rows without a tenant filter
      const res = await axios.get(`/api/v1/tables/ap_generic_fields`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!isMounted) return;

      const data = res.data;

      if (!data || data.length === 0) {
        toast.warn('No generic fields found.');
        if (isMounted) setLoading(false);
        return;
      }

      // ap_generic_fields columns: id, field, type, parent, description, reconcile, use_llm
      // custom_values, is_required, is_visible do NOT exist in this table — use safe defaults
      const mappedForFrontend = data.map((f, index) => ({
        config_id: null,
        uniqueId: generateUniqueId(),
        name: f.field || '',
        display_name: toTitleCase(f.field) || '',
        type: f.type || 'text',
        parent: f.parent || '',
        desc: f.description || '',
        custom_values: '',          // not in ap_generic_fields
        is_required: false,         // not in ap_generic_fields
        is_visible: true,           // not in ap_generic_fields
        is_readonly: false,         // not in ap_generic_fields
        reconcile: f.reconcile || 'None',
        use_llm: f.use_llm || false,
        sequence: index
      }));
      setFields(mappedForFrontend);

      // originalFields stores backend-shaped records so save logic can diff correctly.
      // tenant_id is set from the logged-in user so new records are saved under the right tenant.
      const originalBackendFormat = data.map((f, index) => ({
        config_id: null,
        uniqueId: mappedForFrontend[index].uniqueId, // reuse same uniqueId
        tenant_id: tenantId,
        field_name: f.field || '',
        display_name: toTitleCase(f.field) || '',
        field_type: f.type || 'text',
        parent: f.parent || '',
        description: f.description || '',
        custom_values: '',          // not in ap_generic_fields
        is_required: false,         // not in ap_generic_fields
        is_visible: true,           // not in ap_generic_fields
        is_readonly: false,         // not in ap_generic_fields
        reconcile: f.reconcile || 'None',
        use_llm: f.use_llm || false,
        sequence: index
      }));
      setOriginalFields(originalBackendFormat);

      setCanSave(true);
      setTableConfigGenerated(false);
      setShowGenericFieldsNote(true);

      if (!isToastShown.current) {
        toast.success('Generic fields loaded successfully!');
        isToastShown.current = true;
      }
    } catch (err) {
      if (!isMounted) return;
      toast.warn('Unable to load generic fields.');
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  const handleAddField = () => {
    if (!canEditInvoiceConfig) {
      toast.error(editPermissionDeniedMessage);
      return;
    }
    
    // For super admin, check if tenant is selected
    if (userRole === 'super_admin' && !selectedTenantId) {
      toast.error('Please select a tenant first before adding fields.');
      return;
    }
    
    // Get the selected tenant's name for super admin
    let selectedTenantName = null;
    if (userRole === 'super_admin' && selectedTenantId) {
      const selectedTenant = tenants.find(t => t.tenant_id === selectedTenantId);
      selectedTenantName = selectedTenant ? selectedTenant.tenant_name : 'N/A';
    }
    
    // Updated new field object
    const newField = {
      config_id: null,
      uniqueId: generateUniqueId(),
      name: '',
      display_name: '', // New field
      type: 'text',
      parent: '',
      desc: '',
      custom_values: '',
      is_required: false,
      is_visible: true,
      is_readonly: false,
      reconcile: 'None', // Kept
      use_llm: true,
      tenant_name: userRole === 'super_admin' ? selectedTenantName : null,
      tenant_id: userRole === 'super_admin' ? selectedTenantId : tenantId,
      sequence: fields.length
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
    setShowGenericFieldsNote(false);
    toast.info('New field added. Remember to save the structure!');
  };

  const handleCancelChanges = () => {
    // Restore last saved backend state
    const restoredFields = originalFields.map((f, index) => ({
      config_id: f.config_id,
      uniqueId: f.uniqueId,
      name: f.field_name || '',
      display_name: f.display_name || toTitleCase(f.field_name),
      type: f.field_type || 'text',
      parent: f.parent || '',
      desc: f.description || '',
      custom_values: f.custom_values || '',
      is_required: f.is_required || false,
      is_visible: f.is_visible !== undefined ? f.is_visible : true,
      reconcile: f.reconcile || 'None',
      use_llm: f.use_llm || false,
      tenant_name: f.tenant_name || 'N/A',
      tenant_id: f.tenant_id,
      sequence: index
    }));

    setFields(restoredFields);
    setCanSave(false);
    setTableConfigGenerated(true);
    setShowGenericFieldsNote(false);

    // toast.info('Changes discarded');
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event) => {
    if (!canEditInvoiceConfig) {
      toast.error(editPermissionDeniedMessage);
      return;
    }
    const { active } = event;
    setActiveId(active.id);
  };

  const handleDragEnd = (event) => {
    setActiveId(null);
    if (!canEditInvoiceConfig) {
      toast.error(editPermissionDeniedMessage);
      return;
    }
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex(f => f.uniqueId === active.id);
    const newIndex = fields.findIndex(f => f.uniqueId === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedFields = arrayMove(fields, oldIndex, newIndex);
    const updatedFieldsWithSequence = reorderedFields.map((field, index) => ({
      ...field,
      sequence: index
    }));

    setFields(updatedFieldsWithSequence);
    setCanSave(true);
    setShowGenericFieldsNote(false);
    toast.info('Field reordered. Remember to save the structure!');
  };

  const getRowById = (id) => fields.find(f => f.uniqueId === id);

  const handleRemoveField = (index) => {
    if (!canDeleteInvoiceConfig) {
      toast.error(deletePermissionDeniedMessage);
      return;
    }
    setFieldToDeleteIndex(index);
    setShowDeleteDialog(true);
  };

  const confirmDeleteField = () => {
    if (fieldToDeleteIndex !== null) {
      const updatedFields = fields.filter((_, i) => i !== fieldToDeleteIndex);
      const resequencedFields = updatedFields.map((field, index) => ({
        ...field,
        sequence: index
      }));
      setFields(resequencedFields);
      setCanSave(true);
      setTableConfigGenerated(false);
      setShowGenericFieldsNote(false);
      toast.info('Field marked for removal. Remember to save the structure to apply changes!');
    }
    setShowDeleteDialog(false);
    setFieldToDeleteIndex(null);
  };

  const cancelDeleteField = () => {
    setShowDeleteDialog(false);
    setFieldToDeleteIndex(null);
  };

  // Field change handler from uploaded file
  const handleFieldChange = (index, key, value) => {
    if (!canEditInvoiceConfig) {
      toast.error(editPermissionDeniedMessage);
      return;
    }

    // scrollPositionRef is managed by SortableRow's handlers

    setFields(prevFields => {
      const updated = [...prevFields];
      const oldFieldValue = updated[index][key];
      updated[index] = { ...updated[index], [key]: value };

      // If this is a parent field name change, update all child fields that reference it
      if (key === 'name' && updated[index].type === 'array') {
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

      // Handle Meta Config JSON updates
      if (key === 'meta_config_json') {
        try {
          const meta = JSON.parse(value);

          const req = meta.required !== undefined ? meta.required : meta.is_required;
          const vis = meta.visible !== undefined ? meta.visible : meta.is_visible;
          const ro = meta.readonly !== undefined ? meta.readonly : meta.is_readonly;

          // Enforce business logic: Required -> Visible
          let finalVisible = vis;
          if (finalVisible === undefined) finalVisible = true;

          if (req) finalVisible = true;
          // Enforce business logic: Readonly -> Visible
          if (ro) finalVisible = true;

          updated[index] = {
            ...updated[index],
            is_required: req ?? false,
            is_visible: finalVisible,
            is_readonly: ro ?? false
          };
        } catch (e) {
          console.error("Failed to parse meta config json", e);
        }
      }

      return updated;
    });

    setCanSave(true);
    setTableConfigGenerated(false);
    setShowGenericFieldsNote(false);

    // Restore scroll position logic is moved to useLayoutEffect
  };

  // Popup handlers from uploaded file
  const openDescriptionPopup = (index, description, isEditable) => {
    const field = fields[index];
    setCardPopup({
      isOpen: true,
      title: 'Field Description',
      content: description || '',
      isEditable: isEditable && canEditInvoiceConfig,
      field: 'desc',
      index,
      contentType: 'text',
      fieldName: field.name
    });
  };

  const openCustomValuesPopup = (index, customValues, isEditable) => {
    const field = fields[index];
    if (field.type === 'javascript') { // This type is removed, but logic is kept just in case
      setCardDialog({
        isOpen: true,
        title: `JavaScript Validation for ${field.name}`,
        content: customValues || '',
        isEditable: isEditable && canEditInvoiceConfig,
        field: 'custom_values',
        index,
        contentType: 'javascript',
        validationForField: field.name
      });
    } else {
      setCardPopup({
        isOpen: true,
        title: `Custom Values for ${field.name}`,
        content: customValues || '',
        isEditable: isEditable && canEditInvoiceConfig,
        field: 'custom_values',
        index,
        contentType: 'customValues',
        fieldType: field.type,
        fieldName: field.name
      });
    }
  };

  const openMetaConfigPopup = (index, metaConfigJson, isEditable) => {
    const field = fields[index];
    setCardPopup({
      isOpen: true,
      title: `Meta Configuration for ${field.name}`,
      content: metaConfigJson || '',
      isEditable: isEditable && canEditInvoiceConfig,
      field: 'meta_config_json', // We'll handle this special key in handleFieldChange
      index,
      contentType: 'metaConfig',
      fieldName: field.name
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

  const handleCardDialogChange = (content) => {
    setCardDialog(prev => {
      const updatedDialog = { ...prev, content };
      if (prev.index !== null && prev.field) {
        handleFieldChange(prev.index, prev.field, content);
      }
      return updatedDialog;
    });
    closeCardDialog(); // Close dialog on save
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

  const closeCardDialog = () => {
    setCardDialog({
      isOpen: false,
      title: '',
      content: '',
      isEditable: false,
      field: '',
      index: null,
      contentType: 'text',
      validationForField: null
    });
  };

  // Save schema handler from uploaded file
  const handleSaveSchema = () => {
    if (!canEditInvoiceConfig) {
      toast.error(editPermissionDeniedMessage);
      return;
    }

    const hasEmptyName = fields.some((field) => field.name.trim() === '');
    if (hasEmptyName) {
      // Remove the toast error since we're now showing the error message below the input
      // toast.error('Error: Field names cannot be empty.');
      return;
    }

    if (!areAllFieldNamesValid()) {
      // Remove the toast error since we're now showing the error message below the input
      // toast.error(`Please fix invalid field names. Only letters, numbers, and underscores are allowed.`);
      // Highlight first invalid row
      const firstInvalidField = fields.find(field => !/^[a-zA-Z0-9_]+$/.test(field.name) || field.name.trim() === '');
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
        `Duplicate field '${duplicateFieldName}' already exists for this tenant.`
      );
      return;
    }

    setShowSaveDialog(true);
  };

  const cancelGenerate = () => setShowSaveDialog(false);

  // Confirm generate (save) handler from uploaded file, with merged fields
  const confirmGenerate = async () => {
    if (!canEditInvoiceConfig) {
      toast.error(editPermissionDeniedMessage);
      setShowSaveDialog(false);
      return;
    }

    if (!token) {
      toast.error('Authentication information not found. Please log in.');
      setShowSaveDialog(false);
      return;
    }

    const isSuperAdmin = userRole === 'super_admin';
    // For super admin, use the selected tenant ID
    const targetTenantId = isSuperAdmin ? selectedTenantId : tenantId;

    if (!targetTenantId) {
      toast.error('Cannot save configuration without a target tenant ID.');
      setShowSaveDialog(false);
      return;
    }

    const operations = [];
    const headers = { Authorization: `Bearer ${token}` };

    const fieldsToDelete = originalFields.filter(
      originalField =>
        !fields.some(currentField => currentField.uniqueId === originalField.uniqueId)
    );

    fieldsToDelete.forEach(field => {
      if (field.config_id && (isSuperAdmin ? field.tenant_id === selectedTenantId : field.tenant_id === tenantId)) { // Use selected tenant for super admin
        operations.push(
          axios.delete(
            `/api/v1/tables/ap_field_config?config_id=eq.${field.config_id}`, // Use ap_field_config
            { headers }
          )
        );
      }
    });

    fields.forEach(field => {
      // Build meta_config object
      const metaConfigObj = {
        required: field.is_required || false,
        visible: field.is_visible !== undefined ? field.is_visible : true,
        readonly: field.is_readonly || false
      };
      // Updated payload
      const payload = {
        field_name: field.name.trim(),
        display_name: field.display_name.trim(),
        field_type: field.type,
        parent: field.parent,
        description: field.desc.trim(),
        custom_values: field.custom_values,
        // is_required: field.is_required,
        // is_visible: field.is_visible,
        // is_readonly: field.is_readonly,
        meta_config: metaConfigObj,
        reconcile: field.reconcile, // Kept
        use_llm: field.use_llm,
        sequence: field.sequence
      };

      if (field.config_id) {
        const originalField = originalFields.find(o => o.config_id === field.config_id);
        const isChanged =
          originalField &&
          (originalField.field_name !== payload.field_name ||
            originalField.display_name !== payload.display_name || // Added check
            originalField.field_type !== payload.field_type ||
            originalField.parent !== payload.parent ||
            originalField.description !== payload.description ||
            originalField.custom_values !== payload.custom_values ||
            originalField.is_required !== field.is_required ||
            originalField.is_visible !== field.is_visible ||
            originalField.is_readonly !== field.is_readonly ||
            originalField.reconcile !== payload.reconcile || // Added check
            originalField.use_llm !== payload.use_llm ||
            originalField.sequence !== payload.sequence);

        if (isChanged && (isSuperAdmin ? originalField.tenant_id === selectedTenantId : originalField.tenant_id === tenantId)) { // Use selected tenant for super admin
          const patchUrl = `/api/v1/tables/ap_field_config?config_id=eq.${field.config_id}`; // Use ap_field_config
          const patchPayload = {
            ...payload,
            updated_by: user.user_id
          };
          operations.push(axios.patch(patchUrl, patchPayload, { headers }));
        }
      } else {
        if (isSuperAdmin || tenantId) { // Use tenantId
          const postPayload = {
            ...payload,
            tenant_id: isSuperAdmin ? selectedTenantId : tenantId, // Use selected tenant for super admin
            created_by: user.user_id
          };
          operations.push(
            axios.post(`/api/v1/tables/ap_field_config`, [postPayload], { headers }) // Use ap_field_config
          );
        }
      }
    });

    try {
      await Promise.all(operations);
      toast.success('Configuration saved successfully!');
      setTableConfigGenerated(true);
      setCanSave(false);
      setShowGenericFieldsNote(false);
      const updatedUser = { ...user, TableConfigExists: true };
      dispatch(setAuth({ user: updatedUser, token }));
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Save failed.'
      );
    } finally {
      setShowSaveDialog(false);
      fetchInvoiceConfig(selectedTenantId, false); // Re-fetch in non-editable mode after save
    }
  };

  // Fetch all tenants for super admin dropdown
  const fetchAllTenants = useCallback(async () => {
    if (!token || userRole !== 'super_admin') {
      return;
    }

    try {
      const res = await axios.get(`/api/v1/tables/ap_tenants`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data && Array.isArray(res.data)) {
        // Sort tenants alphabetically by name
        const sortedTenants = res.data.sort((a, b) =>
          (a.tenant_name || '').localeCompare(b.tenant_name || '')
        );
        setTenants(sortedTenants);
      }
    } catch (error) {
      toast.error("Failed to load tenants for filtering.");
    }
  }, [token, userRole]);

  useEffect(() => {
    fetchInvoiceConfig(selectedTenantId);
    // Fetch all tenants for super admin
    if (userRole === 'super_admin') {
      fetchAllTenants();
    }
  }, [fetchInvoiceConfig, fetchAllTenants, userRole, selectedTenantId]);

  // Filter fields based on selected tenant
  useEffect(() => {
    setColumnSearch({ name: '', display_name: '' }); // Reset column search on tenant/fields change
    if (userRole === 'super_admin') {
      if (selectedTenantId) {
        const filtered = fields.filter(field => field.tenant_id === selectedTenantId);
        setFilteredFields(filtered);
        setShowTenantSelectionMessage(false);
      } else {
        setFilteredFields([]);
        setShowTenantSelectionMessage(true);
      }
    } else {
      setFilteredFields(fields);
      setShowTenantSelectionMessage(false);
    }
  }, [fields, selectedTenantId, userRole]);

  // beforeunload listener from uploaded file
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


  const handleEditTable = () => {
    if (!canEditInvoiceConfig) {
      toast.error(editPermissionDeniedMessage);
      return;
    }
    setTableConfigGenerated(false);
    setCanSave(true);
  };

  // Open popup for readonly row
  const openCardPopupForReadonly = (title, content, isEditable, itemId, fieldKey, contentType, fieldName) => {
    setCardPopup({
      isOpen: true,
      title,
      content: content || '',
      isEditable: false, // Readonly row popups are never editable
      field: fieldKey,
      index: null, // No index for readonly
      itemId,
      contentType,
      fieldName: fieldName || fieldKey // Pass the actual field name
    });
  };


  if (!user || loading) {
    return; // Return nothing or a loader
  }

  // Column-level search filter applied on top of filteredFields (no API call, in-memory)
  const columnSearchFilteredFields = filteredFields.filter(field => {
    const nameMatch = field.name?.toLowerCase().includes(columnSearch.name.toLowerCase());
    const displayNameMatch = field.display_name?.toLowerCase().includes(columnSearch.display_name.toLowerCase());
    return nameMatch && displayNameMatch;
  });

  const activeRow = activeId ? getRowById(activeId) : null;
  const activeRowIndex = activeId ? fields.findIndex(f => f.uniqueId === activeId) : -1;

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
      <div className="font-[Poppins] p-4 rounded-xl max-w-auto mx-auto h-[89vh] flex flex-col" data-tour="invoice-config-container">
        <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
        <div className="bg-white rounded-xl flex-grow flex flex-col">
          <div className="flex-grow overflow-hidden flex flex-col">
            {activeTab === 'extraction' && (
              <>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 bg-gray-200 p-3 rounded-lg gap-2">
                  <h2 className="text-base font-semibold text-gray-900" data-tour="config-header">
                    Extraction Table Field Configuration
                  </h2>
                  {userRole === 'super_admin' && tenants.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <label htmlFor="tenant-filter" className="text-xs font-medium text-gray-700 whitespace-nowrap">
                        Select Tenant: *
                      </label>
                      <div className="w-full sm:w-48">
                        <SearchableSelect
                          options={tenants.map(tenant => tenant.tenant_name)}
                          value={selectedTenantId ? tenants.find(t => t.tenant_id === selectedTenantId)?.tenant_name : ''}
                          onChange={(selectedOption) => {
                            const selectedTenant = tenants.find(t => t.tenant_name === selectedOption);
                            if (selectedTenant && selectedTenant.tenant_id !== selectedTenantId) {
                              // Only update if different tenant selected
                              isToastShown.current = false; // Reset toast flag for new tenant
                              setSelectedTenantId(selectedTenant.tenant_id);
                              // Don't clear data here - let fetchInvoiceConfig handle the transition
                            }
                          }}
                          placeholder="Select a tenant to view configuration"
                        />
                      </div>
                    </div>
                  )}
                </div>
                {!tableConfigGenerated && (
                  <div className="flex items-start gap-4 p-2 rounded-lg mb-1 bg-blue-50 text-blue-800 border border-blue-200" data-tour="display-name-note">
                    <Lightbulb size={14} className="text-blue-600 flex-shrink-0" />
                    <p className="m-0 text-[11px] leading-relaxed">
                      <strong>Note:</strong> You can edit the Display Name to customize how fields appear in the UI.
                      By default, it matches the Field Name (e.g., "vendor_name" becomes "Vendor Name").
                    </p>
                  </div>
                )}
                {/* {userRole === 'super_admin' && showTenantSelectionMessage && (
                  <div className="flex items-center gap-2 p-3 rounded-lg mb-4 bg-blue-50 text-blue-800 border border-blue-200 text-sm" data-tour="tenant-selection-note">
                    <Lightbulb size={16} className="text-blue-600 flex-shrink-0" />
                    <span className="m-0">
                      <strong>Select a tenant</strong> from the dropdown to view configuration
                    </span>
                  </div>
                )} */}
                {!tableConfigGenerated && showGenericFieldsNote && (
                  <div className="flex items-start gap-4 p-2 rounded-lg mb-2 bg-yellow-50 text-yellow-800 border border-yellow-300" data-tour="generic-fields-note">
                    <Lightbulb size={14} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="m-0 text-xs leading-relaxed">
                      These are demo fields. Please make changes as per your needs and save the configuration.
                    </p>
                  </div>
                )}
                {!tableConfigGenerated ? (
                  <div className="flex-grow overflow-hidden relative border border-gray-300 rounded-lg shadow-inner max-h-[70vh]" data-tour="editable-table-wrapper">
                    <div className="absolute inset-0 overflow-auto custom-scrollbar" ref={tableWrapperRef} data-tour="editable-table-scroll">
                      {userRole === 'super_admin' && !selectedTenantId ? (
                        <div className="flex items-center justify-center h-full min-h-[200px]">
                          <div className="text-center p-8">
                            <Building2 size={32} className="text-blue-400 mx-auto mb-4" />
                            <h3 className="text-base font-medium text-gray-900 mb-2">Please Select a Tenant</h3>
                            <p className="text-sm text-gray-500">
                              Select a tenant from the dropdown above to view their invoice configuration.
                            </p>
                          </div>
                        </div>
                      ) : filteredFields.length > 0 ? (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                        >
                          <table className="w-full border-separate border-spacing-0" data-tour="field-config-table">
                            <thead className="sticky top-0 z-20">
                              <tr className="bg-gray-100 shadow-sm">
                                <th className="sticky left-0 bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[40px] rounded-tl-xl" data-tour="serial-number-column">Sr.</th>
                                {/* {userRole === 'super_admin' && <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[80px]" data-tour="tenant-name-column">Tenant Name</th>} */}
                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[120px]" data-tour="field-name">
                                  <div className="flex flex-col gap-1">
                                    <span>Field Name</span>
                                    <input
                                      type="text"
                                      value={columnSearch.name}
                                      onChange={e => setColumnSearch(prev => ({ ...prev, name: e.target.value }))}
                                      placeholder="Filter..."
                                      className="w-full text-[11px] font-normal normal-case tracking-normal p-1 rounded border border-gray-300 bg-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                                      onClick={e => e.stopPropagation()}
                                    />
                                  </div>
                                </th>
                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[120px]" data-tour="display-name-column">
                                  <div className="flex flex-col gap-1">
                                    <span>Display Name</span>
                                    <input
                                      type="text"
                                      value={columnSearch.display_name}
                                      onChange={e => setColumnSearch(prev => ({ ...prev, display_name: e.target.value }))}
                                      placeholder="Filter..."
                                      className="w-full text-[11px] font-normal normal-case tracking-normal p-1 rounded border border-gray-300 bg-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                                      onClick={e => e.stopPropagation()}
                                    />
                                  </div>
                                </th>
                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[80px]" data-tour="field-type">Type</th>
                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[100px]" data-tour="parent-column">Parent</th>
                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[150px]" data-tour="field-description">Description</th>
                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[120px]" data-tour="values-column">Values</th>

                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[80px]" data-tour="meta-config-column">Meta Config</th>
                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[70px]" data-tour="use-llm-column">Use LLM</th>
                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[80px]" data-tour="reconcile-column">Reconcile</th>
                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[40px]" data-tour="delete-column">Del</th>
                                <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[40px] rounded-tr-xl" data-tour="drag-column">Drag</th>
                              </tr>
                            </thead>
                            <SortableContext
                              items={columnSearchFilteredFields.map((field) => field.uniqueId)}
                              strategy={verticalListSortingStrategy}
                            >
                              <tbody>
                                {columnSearchFilteredFields.length === 0 && filteredFields.length > 0 ? (
                                  <tr>
                                    <td colSpan={12} className="text-center py-8 text-sm text-gray-500">
                                      No fields match your filter criteria.
                                    </td>
                                  </tr>
                                ) : columnSearchFilteredFields.map((field) => {
                                  const idx = fields.findIndex(f => f.uniqueId === field.uniqueId);
                                  return (
                                  <SortableRow
                                    key={field.uniqueId}
                                    field={field}
                                    idx={idx}
                                    fields={filteredFields}
                                    userRole={userRole}
                                    canEdit={canEditInvoiceConfig}
                                    canDelete={handleRemoveField}
                                    onFieldChange={handleFieldChange}
                                    openDescriptionPopup={openDescriptionPopup}
                                    openCustomValuesPopup={openCustomValuesPopup}
                                    openMetaConfigPopup={openMetaConfigPopup}
                                    tableWrapperRef={tableWrapperRef}
                                    scrollPositionRef={scrollPositionRef}
                                  />
                                  );
                                })}
                              </tbody>
                            </SortableContext>
                            <DragOverlay>
                              {activeId ? (
                                <div className="w-full rounded-lg overflow-hidden shadow-xl">
                                  <table className="w-full">
                                    <tbody>
                                      <DraggableRow
                                        field={activeRow}
                                        activeIndex={activeRowIndex}
                                        userRole={userRole}
                                        fields={columnSearchFilteredFields}
                                      />
                                    </tbody>
                                  </table>
                                </div>
                              ) : null}
                            </DragOverlay>
                          </table>
                        </DndContext>
                      ) : (
                        <div className="flex items-center justify-center h-full min-h-[200px]">
                          <div className="text-center p-8">
                            <AlertTriangle size={32} className="text-gray-400 mx-auto mb-4" />
                            <h3 className="text-base font-medium text-gray-900 mb-2">No data found</h3>
                            <p className="text-sm text-gray-500">
                              No configuration data available for the selected tenant.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-grow overflow-hidden relative border border-gray-300 rounded-xl shadow-inner max-h-[70vh]" data-tour="readonly-table-wrapper">
                    <div className="absolute inset-0 overflow-auto custom-scrollbar" data-tour="readonly-table-scroll">
                      {userRole === 'super_admin' && !selectedTenantId ? (
                        <div className="flex items-center justify-center h-full min-h-[200px]">
                          <div className="text-center p-8">
                            <Building2 size={32} className="text-blue-400 mx-auto mb-4" />
                            <h3 className="text-base font-medium text-gray-900 mb-2">Please Select a Tenant</h3>
                            <p className="text-sm text-gray-500">
                              Select a tenant from the dropdown above to view their invoice configuration.
                            </p>
                          </div>
                        </div>
                      ) : filteredFields.length > 0 ? (
                        <table className="w-full border-separate border-spacing-0">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-gray-100 shadow-sm">
                              <th className="sticky left-0 bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[40px] rounded-tl-xl" data-tour="serial-number-column">Sr.</th>
                              {/* {userRole === 'super_admin' && <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[80px]" data-tour="tenant-name-column">Tenant Name</th>} */}
                              <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[120px]">
                                <div className="flex flex-col gap-1">
                                  <span>Field Name</span>
                                  <input
                                    type="text"
                                    value={columnSearch.name}
                                    onChange={e => setColumnSearch(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Filter..."
                                    className="w-full text-[11px] font-normal normal-case tracking-normal p-1 rounded border border-gray-300 bg-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                                    onClick={e => e.stopPropagation()}
                                  />
                                </div>
                              </th>
                              <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[120px]" data-tour="display-name-column">
                                <div className="flex flex-col gap-1">
                                  <span>Display Name</span>
                                  <input
                                    type="text"
                                    value={columnSearch.display_name}
                                    onChange={e => setColumnSearch(prev => ({ ...prev, display_name: e.target.value }))}
                                    placeholder="Filter..."
                                    className="w-full text-[11px] font-normal normal-case tracking-normal p-1 rounded border border-gray-300 bg-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                                    onClick={e => e.stopPropagation()}
                                  />
                                </div>
                              </th>
                              <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[80px]" data-tour="field-type">Type</th>
                              <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[100px]" data-tour="parent-column">Parent</th>
                              <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[150px]" data-tour="field-description">Description</th>
                              <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-left border-b-2 border-gray-200 min-w-[120px]" data-tour="values-column">Values</th>

                              <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[80px]" data-tour="meta-config-column">Meta Config</th>
                              <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[70px]" data-tour="use-llm-column">Use LLM</th>
                              <th className="bg-gray-100 font-semibold text-gray-800 uppercase text-[10px] tracking-wide px-2 py-2 text-center border-b-2 border-gray-200 min-w-[80px] rounded-tr-xl" data-tour="reconcile-column">Reconcile</th>
                            </tr>
                          </thead>
                          <tbody>
                            {columnSearchFilteredFields.length === 0 && filteredFields.length > 0 ? (
                              <tr>
                                <td colSpan={10} className="text-center py-8 text-sm text-gray-500">
                                  No fields match your filter criteria.
                                </td>
                              </tr>
                            ) : columnSearchFilteredFields.map((field, idx) => (
                              <TableReadonlyRow key={idx} field={field} userRole={userRole} openCardPopup={openCardPopupForReadonly} openCardPopupForReadonly={openCardPopupForReadonly} index={idx} />
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="flex items-center justify-center h-full min-h-[200px]">
                          <div className="text-center p-8">
                            <AlertTriangle size={32} className="text-gray-400 mx-auto mb-4" />
                            <h3 className="text-base font-medium text-gray-900 mb-2">No data found</h3>
                            <p className="text-sm text-gray-500">
                              No configuration data available for the selected tenant.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-200 justify-start">
                  {!tableConfigGenerated ? (
                    <>
                      <Button
                        onClick={handleAddField}
                        disabled={!canEditInvoiceConfig || (userRole === 'super_admin' && !selectedTenantId)}
                        title={!canEditInvoiceConfig ? editPermissionDeniedMessage : (userRole === 'super_admin' && !selectedTenantId ? "Please select a tenant first" : "Add a new field to the configuration")}
                        data-tour="add-field-button"
                        color="indigo"
                        icon={Plus}
                        size="xs"
                      >
                        Add Field
                      </Button>
                      <Button
                        onClick={handleSaveSchema}
                        disabled={
                          !canSave ||
                          !canEditInvoiceConfig ||
                          (userRole === 'super_admin' && !selectedTenantId) ||
                          !areAllFieldNamesValid() ||
                          getDuplicateFieldName() !== null
                        }
                        title={!canEditInvoiceConfig ? editPermissionDeniedMessage : (userRole === 'super_admin' && !selectedTenantId ? "Please select a tenant first" : (!areAllFieldNamesValid() ? "Fix invalid field names before saving" : (getDuplicateFieldName() !== null ? "Duplicate field names detected for this tenant" : "Save the current invoice structure")))}
                        data-tour="save-config-button"
                        color="green"
                        icon={Save}
                        size="xs"
                      >
                        Save Structure
                      </Button>
                      <Button
                        onClick={handleCancelChanges}
                        disabled={!canSave}
                        title="Discard unsaved changes"
                        color="gray"
                        icon={X}
                        size="xs"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={handleEditTable}
                      disabled={!canEditInvoiceConfig}
                      title={!canEditInvoiceConfig ? editPermissionDeniedMessage : "Edit the invoice structure table"}
                      data-tour="edit-table-button"
                      color="gray"
                      icon={Pencil}
                      size="xs"
                    >
                      Edit table
                    </Button>
                  )}
                </div>
              </>
            )}

          </div>
        </div>

        {/* Modals */}
        {showSaveDialog && (
          <div className="fixed inset-0 w-screen h-screen bg-black bg-opacity-60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white p-6 rounded-lg text-center shadow-xl max-w-md w-full transition-transform transform scale-100">
              <p className="m-0 mb-4 text-sm text-black font-medium leading-relaxed">
                Are you sure you want to save this structure? This will update the
                configuration for all new invoices.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={cancelGenerate}
                  data-tour="cancel-save-button"
                  color="gray"
                  size="sm"
                >
                  No, Cancel
                </Button>
                <Button
                  onClick={confirmGenerate}
                  data-tour="save-config-button"
                  color="indigo"
                  size="sm"
                >
                  Yes, Confirm
                </Button>
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
                <Button
                  onClick={cancelDeleteField}
                  data-tour="cancel-delete-button"
                  color="gray"
                  size="sm"
                >
                  No, Cancel
                </Button>
                <Button
                  onClick={confirmDeleteField}
                  data-tour="confirm-delete-button"
                  color="red"
                  size="sm"
                >
                  Yes, Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* CardPopup for description and custom values */}
        <CardPopup
          isOpen={cardPopup.isOpen}
          onRequestClose={closeCardPopup}
          title={cardPopup.title}
          content={cardPopup.content}
          isEditable={cardPopup.isEditable}
          onContentChange={handleCardPopupChange}
          field={cardPopup.field}
          contentType={cardPopup.contentType}
          fieldType={cardPopup.fieldType} // Pass field type
          fieldName={cardPopup.fieldName} // Pass field name
          showActionButtons={cardPopup.isEditable}
          itemId={cardPopup.itemId} // Pass itemId for readonly popup
          currentFormFields={filteredFields} // Pass current form fields
          dataTourPrefix="invoice-config-popup"
        />

        {/* CardDialog for javascript validation */}
        <CardDialog
          isOpen={cardDialog.isOpen}
          onRequestClose={closeCardDialog}
          title={cardDialog.title}
          value={cardDialog.content}
          validationForField={cardDialog.validationForField}
          isEditable={cardDialog.isEditable}
          onUpdate={handleCardDialogChange}
          contentType={cardDialog.contentType}
          dataTourPrefix="invoice-config-dialog"
        />
      </div>
    </>
  );
};

export default InvoiceStrucDef;
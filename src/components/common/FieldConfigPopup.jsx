import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const FieldConfigPopup = ({ 
  isOpen, 
  onRequestClose, 
  onSave, 
  fieldConfig,
  fieldName,
  readOnly = false // Ensure readOnly prop is accepted
}) => {
  // Initialize state with existing config or defaults
  const [config, setConfig] = useState({
    required: fieldConfig?.required ?? false,
    visible: fieldConfig?.visible ?? true,
    readonly: fieldConfig?.readonly ?? false
  });

  // Update state when fieldConfig prop changes
  useEffect(() => {
    setConfig({
      required: fieldConfig?.required ?? false,
      visible: fieldConfig?.visible ?? true,
      readonly: fieldConfig?.readonly ?? false
    });
  }, [fieldConfig]);

  // Handle checkbox changes
  const handleCheckboxChange = (key, checked) => {
    const newConfig = { ...config, [key]: checked };
    
    // Enforce business rules
    if (key === 'required' && checked) {
      // If required is checked, visible must also be checked
      newConfig.visible = true;
    } else if (key === 'visible' && !checked) {
      // If visible is unchecked, required must also be unchecked
      newConfig.required = false;
    }
    
    setConfig(newConfig);
  };

  // Handle save
  const handleSave = () => {
    onSave(config);
    onRequestClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] backdrop-blur-sm">
      <div className="bg-white rounded-xl max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-lg font-bold text-gray-900">
            Field Configuration for "{fieldName}"
          </h3>
          <button
            onClick={onRequestClose}
            className="text-gray-500 hover:text-red-500 transition-colors duration-200 p-1.5 rounded-full hover:bg-white shadow-sm"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5 flex-grow overflow-hidden">
          <div className="space-y-4">
            {/* Required Checkbox */}
            <div className="flex items-start">
              <div className="flex items-center h-5 mt-1">
                <input
                  id="required-checkbox"
                  name="required"
                  type="checkbox"
                  checked={config.required}
                  onChange={(e) => handleCheckboxChange('required', e.target.checked)}
                  disabled={readOnly} // FIX: Pass readOnly prop to disable input
                  className={`focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="required-checkbox" className="font-medium text-gray-900">
                  Required
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Mark this field as mandatory for data entry
                </p>
              </div>
            </div>
            
            {/* Visible Checkbox */}
            <div className="flex items-start">
              <div className="flex items-center h-5 mt-1">
                <input
                  id="visible-checkbox"
                  name="visible"
                  type="checkbox"
                  checked={config.visible}
                  onChange={(e) => handleCheckboxChange('visible', e.target.checked)}
                  disabled={readOnly} // FIX: Pass readOnly prop to disable input
                  className={`focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="visible-checkbox" className="font-medium text-gray-900">
                  Visible
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Control field visibility in forms
                </p>
              </div>
            </div>
            
            {/* Readonly Checkbox */}
            <div className="flex items-start">
              <div className="flex items-center h-5 mt-1">
                <input
                  id="readonly-checkbox"
                  name="readonly"
                  type="checkbox"
                  checked={config.readonly}
                  onChange={(e) => handleCheckboxChange('readonly', e.target.checked)}
                  disabled={readOnly} // FIX: Pass readOnly prop to disable input
                  className={`focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="readonly-checkbox" className="font-medium text-gray-900">
                  Readonly
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Make field non-editable
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-5 border-t border-gray-200 mt-5">
            <button
              type="button"
              onClick={onRequestClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
            >
              Cancel
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 border border-transparent rounded-md shadow-sm hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
              >
                <Save className="w-4 h-4 mr-1" />
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldConfigPopup;
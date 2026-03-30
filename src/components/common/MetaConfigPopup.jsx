import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import classNames from 'classnames';

const MetaConfigPopup = ({ 
  isOpen, 
  onRequestClose, 
  title, 
  metaConfig, 
  isEditable, 
  onSave,
  fieldName = ''
}) => {
  if (!isOpen) {
    return null;
  }

  // Local state for meta config values
  const [isRequired, setIsRequired] = useState(metaConfig?.is_required || false);
  const [isVisible, setIsVisible] = useState(
    metaConfig?.is_visible !== undefined ? metaConfig.is_visible : true
  );

  // Update state when metaConfig prop changes
  useEffect(() => {
    setIsRequired(metaConfig?.is_required || false);
    setIsVisible(
      metaConfig?.is_visible !== undefined ? metaConfig.is_visible : true
    );
  }, [metaConfig]);

  const handleModalClick = (e) => {
    // Prevent closing when clicking inside the popup
    e.stopPropagation();
  };

  const handleCancel = () => {
    // Reset to original values
    setIsRequired(metaConfig?.is_required || false);
    setIsVisible(
      metaConfig?.is_visible !== undefined ? metaConfig.is_visible : true
    );
    if (onRequestClose) {
      onRequestClose();
    }
  };

  const handleSave = () => {
    const newMetaConfig = {
      is_required: isRequired,
      is_visible: isVisible
    };
    
    if (onSave) {
      onSave(newMetaConfig);
    }
    onRequestClose();
  };

  const handleCheckboxChange = (key, checked) => {
    if (key === 'is_required') {
      // If required is checked, ensure visibility is also checked
      if (checked && !isVisible) {
        setIsVisible(true);
      }
      setIsRequired(checked);
    }
    if (key === 'is_visible') {
      // If visibility is unchecked, also uncheck required field
      if (!checked && isRequired) {
        setIsRequired(false);
      }
      setIsVisible(checked);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] backdrop-blur-sm" data-tour="meta-config-popup">
      <div
        className="bg-white rounded-xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden w-full max-w-md"
        onClick={handleModalClick}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <Save size={20} className="text-indigo-600" />
            </div>
            {title || 'Meta Configuration'}
          </h3>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-red-500 transition-colors duration-200 p-1.5 rounded-full hover:bg-white shadow-sm"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 flex-grow overflow-hidden flex flex-col bg-white">
          <div className="overflow-y-auto flex-grow mb-5">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">
                Configuration for field: <span className="text-indigo-600">{fieldName}</span>
              </h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">Required</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Mark this field as mandatory for data entry
                    </div>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-indigo-600 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      checked={isRequired}
                      onChange={(e) => handleCheckboxChange('is_required', e.target.checked)}
                      disabled={!isEditable}
                      title={!isEditable ? "You do not have permission to edit this field." : "Mark field as required"}
                    />
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">Visible</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Show this field in the user interface
                    </div>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-indigo-600 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      checked={isVisible}
                      onChange={(e) => handleCheckboxChange('is_visible', e.target.checked)}
                      disabled={!isEditable}
                      title={!isEditable ? "You do not have permission to edit this field." : "Set field visibility"}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          {isEditable && (
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 border border-transparent rounded-md shadow-sm hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
              >
                <Save className="w-4 h-4 mr-1" />
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetaConfigPopup;
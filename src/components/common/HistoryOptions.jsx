import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';
import { X } from 'lucide-react';

const HistoryOptions = ({ 
  historyValue: externalHistoryValue,
  onHistoryChange: externalOnHistoryChange,
  currentFormFields = [],
  currentFieldName = ''
}) => {
  // Always use external prop when provided (controlled component)
  // Only use internal state when external prop is not provided (uncontrolled component)
  const isControlled = externalHistoryValue !== undefined;
  const [internalHistoryValue, setInternalHistoryValue] = useState(isControlled ? '' : (externalHistoryValue || ''));
  
  const historyValue = isControlled ? externalHistoryValue : internalHistoryValue;
  const onHistoryChange = externalOnHistoryChange || setInternalHistoryValue;

  // State for history field validation
  const [historyValidationError, setHistoryValidationError] = useState('');

  // Extract field names from current form fields for the dropdown, excluding the current field
  const fieldOptions = currentFormFields
    .map(field => field.name || field.field_name)
    .filter(Boolean)
    .filter(fieldName => fieldName !== currentFieldName);

  // Validate history field when it changes
  useEffect(() => {
    if (historyValue && currentFormFields.length > 0) {
      // Extract field names from current form fields
      const fieldNames = currentFormFields.map(field => field.name || field.field_name);
      
      // Check if the history value matches any field name
      if (!fieldNames.includes(historyValue)) {
        setHistoryValidationError(`Field name "${historyValue}" does not exist in the current form fields.`);
      } else {
        setHistoryValidationError('');
      }
    } else {
      setHistoryValidationError('');
    }
  }, [historyValue, currentFormFields]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          History (field_name)
        </label>
        <SearchableSelect
          options={fieldOptions}
          value={historyValue || ''}
          onChange={onHistoryChange}
          placeholder="Select a field name"
          isReadOnly={false}
          hasError={!!historyValidationError}
          allowClear={true} // Enable clear functionality
        />
        {historyValidationError ? (
          <p className="text-xs text-red-500 mt-1">
            {historyValidationError}
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">
            Select the field name to store history values (cannot select the current field)
          </p>
        )}
      </div>
      {historyValue && (
        <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
          <p className="text-sm text-blue-800">
            Selected history field: <span className="font-medium">{historyValue}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default HistoryOptions;
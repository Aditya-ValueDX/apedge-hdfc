import React from 'react';
import SearchableSelect from '../components/common/SearchableSelect';
import { SquareArrowOutUpRight } from 'lucide-react';

/**
 * Parse custom values string into type and options
 * @param {string} customValueString - The custom values string in format like Drop(option1, option2, ...)
 * @returns {Object} - Object with type and options array
 */
export const parseCustomValues = (customValueString) => {
  if (!customValueString || typeof customValueString !== 'string') {
    return { type: null, options: [] };
  }

  // Trim whitespace
  const trimmed = customValueString.trim();

  // Check for Drop format: Drop(option1, option2, ...)
  const dropMatch = trimmed.match(/^Drop\((.*)\)$/);
  if (dropMatch) {
    const options = dropMatch[1]
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '');
    return { type: 'Drop', options };
  }

  // Check for Radio format: Radio(option1, option2, ...)
  const radioMatch = trimmed.match(/^Radio\((.*)\)$/);
  if (radioMatch) {
    const options = radioMatch[1]
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '');
    return { type: 'Radio', options };
  }

  // Check for Check format: Check(option1, option2, ...)
  const checkMatch = trimmed.match(/^Check\((.*)\)$/);
  if (checkMatch) {
    const options = checkMatch[1]
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '');
    return { type: 'Check', options };
  }

  // Check for combined MasterKey and History format: MasterKey(key_name); History(field_name)
  // This needs to be checked before simple MasterKey format
  const combinedMatch = trimmed.match(/^MasterKey\(([^;]+?)\);\s*History\(([^;]+?)\)$/);
  if (combinedMatch) {
    const masterKey = combinedMatch[1].trim();
    if (masterKey) {
      return { type: 'MasterKey', options: [masterKey] };
    }
  }

  // Check for simple MasterKey format: MasterKey(key_name)
  const masterKeyMatch = trimmed.match(/^MasterKey\((.*)\)$/);
  if (masterKeyMatch) {
    const key = masterKeyMatch[1].trim();
    if (key) {
      return { type: 'MasterKey', options: [key] };
    }
  }

  // If no valid format found, return empty
  return { type: null, options: [] };
};

/**
 * Render custom value field based on its format
 * @param {Object} config - Field configuration object
 * @param {string} value - Current value
 * @param {Function} onChange - Change handler function
 * @param {boolean} isReadOnly - Whether field is read-only
 * @param {string} errorKey - Error key for validation
 * @param {boolean} hasError - Whether field has validation error
 * @returns {JSX.Element} - Rendered custom value field
 */
export const renderCustomValueField = (config, value, onChange, isReadOnly, errorKey, hasError) => {
  const parsed = parseCustomValues(config.custom_values);

  const baseInputClass = `
    w-full px-2 py-1 text-xs text-gray-800 border rounded-md bg-white 
    transition-all duration-300 ease-in-out focus:outline-none 
    focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
    shadow-sm disabled:bg-gray-50 disabled:text-gray-500 
    ${isReadOnly ? 'border-dashed' : ''} 
    ${hasError ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}
  `;

  // Default text input
  const renderTextInput = () => (
    <input
      type="text"
      className={baseInputClass}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Enter ${config.display_name || config.field_name}`}
      disabled={isReadOnly}
      readOnly={isReadOnly}
    />
  );

  // If no valid format, render as text input
  if (!parsed.type || parsed.options.length === 0) return renderTextInput();

  switch (parsed.type) {
    case 'Drop':
      return (
        <SearchableSelect
          options={parsed.options}
          value={value || ''}
          onChange={onChange}
          placeholder="Select an option"
          disabled={isReadOnly}
          isReadOnly={isReadOnly}
          hasError={hasError}
          allowClear={true} // Enable clear functionality
          className="w-full" // Ensure dropdown takes full width of container
        />
      );

    case 'Radio':
      return (
        <div className={`flex flex-wrap gap-2 ${isReadOnly ? 'opacity-70' : ''}`}>
          {parsed.options.map((option, index) => (
            <label key={index} className="flex items-center text-xs">
              <input
                type="radio"
                className="form-radio h-3 w-3 text-indigo-600 transition duration-150 ease-in-out mr-1"
                checked={value === option}
                onChange={() => onChange(option)}
                disabled={isReadOnly}
              />
              <span className="text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      );

    case 'Check': {
      const selectedOptions = value ? value.split(',').map((item) => item.trim()) : [];
      return (
        <div className={`flex flex-wrap gap-2 ${isReadOnly ? 'opacity-70' : ''}`}>
          {parsed.options.map((option, index) => {
            const isChecked = selectedOptions.includes(option);
            return (
              <label key={index} className="flex items-center text-xs">
                <input
                  type="checkbox"
                  className="form-checkbox h-3 w-3 text-indigo-600 rounded transition duration-150 ease-in-out mr-1"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selectedOptions, option].join(', '));
                    } else {
                      onChange(selectedOptions.filter((item) => item !== option).join(', '));
                    }
                  }}
                  disabled={isReadOnly}
                />
                <span className="text-gray-700">{option}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case 'MasterKey': {
      // For MasterKey type, we show a dropdown with the master key name as a placeholder
      // In a real implementation, this would fetch the actual values from the master
      return (
        <SearchableSelect
          options={[]} // Empty options for now, would be populated with actual master values
          value={value || ''}
          onChange={onChange}
          placeholder={`Select from ${parsed.options[0]} master key`}
          disabled={isReadOnly}
          isReadOnly={isReadOnly}
          hasError={hasError}
          allowClear={true} // Enable clear functionality
          className="w-full" // Ensure dropdown takes full width of container
        />
      );
    }

    default:
      return renderTextInput();
  }
};
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { X } from 'lucide-react';

const DropdownOptions = ({ 
  tempContent, 
  handleContentChange, 
  isError, 
  validationError 
}) => {
  // Filter out master key values and only keep drop values
  const getFilteredContent = (content) => {
    if (!content) return '';
    
    // If content is a master key, return empty string
    if (content.trim().startsWith('MasterKey(')) {
      return '';
    }
    
    // Otherwise, return the content as is
    return content;
  };

  // Initialize state with filtered content
  const [filteredContent, setFilteredContent] = useState(getFilteredContent(tempContent));

  // Update filtered content when tempContent changes
  useEffect(() => {
    setFilteredContent(getFilteredContent(tempContent));
  }, [tempContent]);

  // Handle content change and filter out master key values
  const handleFilteredChange = (value) => {
    // Prevent master key values from being entered
    if (value.trim().startsWith('MasterKey(')) {
      return;
    }
    
    // Update the filtered content
    setFilteredContent(value);
    
    // Pass the value to the parent handler
    handleContentChange(value);
  };

  // Clear dropdown content
  const clearDropdownContent = () => {
    setFilteredContent('');
    handleContentChange('');
  };

  return (
    <div>
      <div className="relative">
        <textarea
          className={classNames(
            "w-[98%] resize-y min-h-[80px] max-h-[65vh] p-4 m-1 border rounded-xl text-sm text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm mt-2", 
            { 
              'border-red-500 bg-red-50': isError || validationError, 
              'border-gray-300': !isError && !validationError 
            }
          )}
          value={filteredContent}
          onChange={(e) => handleFilteredChange(e.target.value)}
          placeholder={`Enter custom values`}
        />
        {filteredContent && (
          <button
            type="button"
            onClick={clearDropdownContent}
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 focus:outline-none"
            title="Clear content"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="text-xs text-gray-500 mt-2 ml-1">
        Enter values in the supported format. For example:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Drop(Option A, Option B, Option C)</li>
          {/* <li>Radio(Yes, No)</li> */}
          {/* <li>Check(Feature 1, Feature 2, Feature 3)</li> */}
          {/* <li>JS(value {'>'} 0 {'&&'} value {'<'} 100)</li> */}
        </ul>
      </div>
    </div>
  );
};

export default DropdownOptions;
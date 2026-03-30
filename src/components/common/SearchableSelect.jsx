import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

const SearchableSelect = ({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  isReadOnly = false,
  hasError = false,
  className = '',
  allowClear = false // New prop to enable clear functionality
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionRefs = useRef([]);
  const dropdownRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if the value exists in the options list
  // If not, reset it to empty string to show default "Select an option"
  const displayValue = options.includes(value) ? value : '';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current.focus();
      }, 0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex]);
          setIsOpen(false);
          setSearchTerm('');
          setHighlightedIndex(-1);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [highlightedIndex]);

  const handleSelect = (option) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  // New function to clear the selected value
  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  const toggleDropdown = () => {
    if (!disabled && !isReadOnly) {
      setIsOpen(!isOpen);
      if (isOpen) {
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    }
  };

  // Adjust dropdown position to ensure it's always visible
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const dropdown = dropdownRef.current;
    const wrapper = wrapperRef.current;

    if (!dropdown || !wrapper) {
      return;
    }

    const positionDropdown = () => {
      // Get positions relative to viewport
      const wrapperRect = wrapper.getBoundingClientRect();
      // Get actual dropdown height
      const dropdownHeight = dropdown.offsetHeight;

      // Check if dropdown would go below viewport
      const spaceBelow = window.innerHeight - wrapperRect.bottom;
      const spaceAbove = wrapperRect.top;

      let finalTop = '';
      let finalBottom = '';

      // Position dropdown above or below based on available space
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        // Position above
        finalTop = 'auto';
        finalBottom = `${window.innerHeight - wrapperRect.top}px`;
        dropdown.style.marginBottom = '0.25rem'; // Spacing from input
        dropdown.style.marginTop = '0';
      } else {
        // Position below (default)
        finalTop = `${wrapperRect.bottom}px`;
        finalBottom = 'auto';
        dropdown.style.marginTop = '0.25rem'; // Spacing from input
        dropdown.style.marginBottom = '0';
      }

      // Set fixed positioning styles
      dropdown.style.left = `${wrapperRect.left}px`;
      dropdown.style.width = `${wrapperRect.width}px`;
      dropdown.style.top = finalTop;
      dropdown.style.bottom = finalBottom;
    };

    // Position it once immediately
    positionDropdown();

    // Reposition on scroll (using capture phase to catch all scroll events)
    document.addEventListener('scroll', positionDropdown, true);
    // Reposition on resize
    window.addEventListener('resize', positionDropdown);

    // Cleanup function
    return () => {
      document.removeEventListener('scroll', positionDropdown, true);
      window.removeEventListener('resize', positionDropdown);
    };

  }, [isOpen]); // Only re-run when dropdown is opened/closed

  const borderClass = hasError
    ? 'border-red-500 ring-1 ring-red-500'
    : 'border-gray-200';

  const readOnlyClass = isReadOnly ? 'border-dashed' : '';

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      onKeyDown={handleKeyDown}
    >
      {/* Selected value display */}
      <div
        className={`
          w-full px-2 py-1 text-xs text-gray-800 border rounded-md bg-white 
          transition-all duration-300 ease-in-out focus:outline-none 
          focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
          shadow-sm disabled:bg-gray-50 disabled:text-gray-500 
          ${borderClass} ${readOnlyClass} ${className}
          ${disabled || isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={toggleDropdown}
        tabIndex={disabled || isReadOnly ? -1 : 0}
      >
        <div className="flex justify-between items-center">
          <span className={`truncate ${displayValue ? 'text-gray-800 font-normal' : 'text-gray-400 font-normal'} text-left`} title={displayValue || placeholder}>
            {displayValue || placeholder}
          </span>
          <div className="flex items-center ml-2">
            {/* Clear button - only show when there's a value and clear is allowed */}
            {allowClear && displayValue && !disabled && !isReadOnly && (
              <button
                type="button"
                onClick={handleClear}
                className="mr-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                title="Clear selection"
              >
                <X size={14} />
              </button>
            )}
            {!disabled && !isReadOnly && (
              isOpen ? (
                <ChevronUp size={14} className="text-gray-500" />
              ) : (
                <ChevronDown size={14} className="text-gray-500" />
              )
            )}
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && !isReadOnly && (
        <div
          ref={dropdownRef}
          // --- CHANGES HERE ---
          // 1. Changed 'absolute' to 'fixed' to escape parent stacking contexts.
          // 2. Increased z-index to a high value to ensure it's on top of other elements.
          className="fixed z-[5000] w-full bg-white border border-gray-200 rounded-md shadow-lg"
        // Note: Positioning (top, left, width) is now handled by the useEffect hook.
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full pl-8 pr-3 py-1 text-xs text-gray-800 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                placeholder="Search options..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(-1);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options list with max height */}
          <div className="max-h-36 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={index}
                  ref={(el) => (optionRefs.current[index] = el)}
                  className={`
                    px-3 py-2 text-xs cursor-pointer transition-colors leading-tight text-left font-normal
                    ${index === highlightedIndex ? 'bg-indigo-50 text-indigo-800 font-normal' : 'text-gray-700 hover:bg-gray-100 font-normal'}
                    ${displayValue === option ? 'bg-indigo-100 text-indigo-900 font-normal' : ''}
                  `}
                  onClick={() => handleSelect(option)}
                >
                  <span className="block whitespace-normal break-words">{option}</span>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-gray-500 text-left">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
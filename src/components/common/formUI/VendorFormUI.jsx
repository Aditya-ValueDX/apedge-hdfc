import React, {
  useRef,
  useLayoutEffect,
  useState,
  useEffect,
  useCallback,
  Fragment,
  useMemo, // Added useMemo
} from "react";
import { useSelector } from "react-redux";
// Added Plus and Trash2 to imports
import {
  FileText,
  X,
  Check,
  ArrowRight,
  GripVertical,
  ArrowLeft,
  GitCompare,
  SquareArrowOutUpRight,
  CircleCheckBig,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Search,
  Plus,
  Trash2,
  Upload,
  ImageIcon,
  AlertCircle,
  CheckCircle,
  CloudUpload,
  HardDriveUpload,
  UploadCloud,
  File,
  Eye,
  InfoIcon,
  MessageSquare,
  UserRound
} from "lucide-react";
import { toast } from "react-toastify";
import CardPopup from "../CardPopup";
import FileCard from "../FileCard";
import { useCardPopup } from "../../hooks/useCardPopup";
import {
  parseCustomValues,
  renderCustomValueField,
} from "../../../utils/customValuesParser";
import MasterKeySearchPopup from "../MasterKeySearchPopup";
import { apiBaseUrl } from "../../../config/apiConfig";
import UploadInvoice from "../../Upload/UploadInvoice";
import { canUserEdit } from "../../../permissions";
import MessageDisplay from "../MessageDisplay";
import { truncateFilename } from "../../../utils/fileUtils";

import { getTabIconComponent } from "../../../utils/RandomIconUtility";
import { useLocation, useParams } from "react-router-dom";
import ActionButton from "../ActionButton";
import VendorApprovalHistory from "../Vendor/VendorApprovalHistory";
import VendorDocuments from "../Vendor/VendorDocuments";


// --- Custom Styles for Upload Card ---
const customUploadStyles = `
/* 2. Custom Animations */
@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-15px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes slideInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
}
@keyframes shimmerProgress {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

/* Apply animations */
.animate-fade-in-down { animation: fadeInDown 0.6s ease-out; }
.animate-fade-in-up { animation: fadeInUp 0.6s ease-out 0.2s both; }
.animate-float { animation: float 3s ease-in-out infinite; }

/* 3. Dropzone Hover Effect */
.dropzone-hover-effect:hover {
    border-color: rgba(79, 70, 229, 0.6);
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%);
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(79, 70, 229, 0.15), 0 0 0 1px rgba(79, 70, 229, 0.1);
}
.dropzone-drag-over {
    border-color: #4f46e7;
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%) !important;
    transform: scale(1.01) !important;
    box-shadow: 0 15px 30px rgba(79, 70, 229, 0.25), 0 0 0 1px rgba(79, 70, 229, 0.3) !important;
}

/* 4. Button Shimmer Effect */
.btn-shimmer {
    position: relative;
    overflow: hidden;
}
.btn-shimmer::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: left 0.5s ease;
}
.btn-shimmer:hover::before {
    left: 100%;
}

/* 5. Progress Bar Shimmer */
.progress-shimmer::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.6),
        transparent
    );
    transform: translateX(-100%);
    animation: shimmerProgress 2s infinite;
}

/* 6. Card Hover/State Effects */
.file-list-item-hover:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(79, 70, 229, 0.1), 0 0 0 1px rgba(79, 70, 229, 0.1);
    border-color: rgba(79, 70, 229, 0.3);
}

.card-border-top::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #4f46e7, #8b5cf6, #ec4899);
    opacity: 0;
    transition: opacity 0.3s ease;
    border-top-left-radius: 0.75rem;
    border-top-right-radius: 0.75rem;
}
.card-border-top:hover::before {
    opacity: 1;
}

/* Focus States */
.focus-ring:focus {
    outline: 2px solid #4f46e7;
    outline-offset: 2px;
}
`;

// A simple helper function, can be moved to a utils file
const toTitleCase = (str) => {
  if (typeof str !== "string" || !str) return "";
  // Add a space before an uppercase letter only if it is preceded by a lowercase letter or a number
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase())
    .replace(/_/g, " ");
};

// --- Custom Tooltip Component ---
const Tooltip = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const targetRef = useRef(null);

  // Convert content to string for display consistency
  const displayContent = String(content);

  // Check if we should show tooltip on hover
  const hasValidContent =
    displayContent &&
    displayContent.trim() !== "" &&
    displayContent.trim() !== "undefined" &&
    displayContent.trim() !== "null";

  // Dynamic mouse position tracking for fixed tooltip
  const handleMouseMove = useCallback((e) => {
    // Position the tooltip slightly offset from the mouse cursor
    setPosition({
      x: e.clientX + 15, // Offset 15px right
      y: e.clientY + 15, // Offset 15px down
    });
  }, []);

  const handleMouseEnter = () => {
    if (hasValidContent) {
      setIsVisible(true);
      window.addEventListener("mousemove", handleMouseMove);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
    window.removeEventListener("mousemove", handleMouseMove);
  };

  // Always return the same JSX structure to prevent React remounting
  return (
    <div
      ref={targetRef}
      // Use w-full to ensure the tooltip area covers the child element fully for hover
      className="relative inline-block w-full pointer-events-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="pointer-events-auto">{children}</div>

      {isVisible && hasValidContent && (
        <div
          // Fixed position relative to viewport, adjusted by mouse position
          // Styling: Dark background, light text, subtle shadow, smaller padding
          style={{ left: position.x, top: position.y }}
          className="fixed z-[10000] px-3 py-1.5 mr-2 bg-gray-900 text-white rounded-md shadow-lg max-w-sm text-[11px] font-base transition-opacity duration-200 pointer-events-none"
        >
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
            {displayContent}
          </div>
        </div>
      )}
    </div>
  );
};
// --- End Custom Tooltip Component ---

// --- Expandable Popup Component ---
const ExpandablePopup = ({
  children,
  content,
  isEditable,
  onChange,
  disabled,
  displayName,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tempValue, setTempValue] = useState(content);
  const containerRef = useRef(null);
  const textareaRef = useRef(null);

  // Update tempValue when content changes
  useEffect(() => {
    setTempValue(content);
  }, [content]);

  const handleExpand = (e) => {
    if (disabled) return;
    e.stopPropagation();

    setIsExpanded(true);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setTempValue(content); // Reset to original value
  };

  const handleSave = () => {
    if (onChange) {
      onChange(tempValue);
    }
    setIsExpanded(false);
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isExpanded) {
        handleClose();
      }
    };

    if (isExpanded) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isExpanded]);

  // Focus textarea and position cursor at the end when popup is expanded and editable
  useEffect(() => {
    if (isExpanded && isEditable && textareaRef.current) {
      // Wait for the next tick to ensure the textarea is rendered
      setTimeout(() => {
        const textarea = textareaRef.current;
        textarea.focus();
        // Set cursor to the end of the text
        textarea.setSelectionRange(
          textarea.value.length,
          textarea.value.length
        );
      }, 0);
    }
  }, [isExpanded, isEditable]);

  return (
    <>
      <div ref={containerRef} className="relative w-full">
        {children({ onExpand: handleExpand })}
      </div>

      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-[9999]"
            onClick={handleClose}
          />

          {/* Popup */}
          <div className="fixed inset-0 z-[10000] flex items-center justify-center animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-[400px] max-w-[90vw] max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
                <h4 className="text-sm font-semibold text-gray-800">
                  Edit {displayName || "Value"}
                </h4>
                <button
                  onClick={handleClose}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-white/50"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto flex-grow">
                {isEditable ? (
                  <textarea
                    ref={textareaRef}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    className="w-full min-h-[200px] px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-800 bg-white shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none resize-y"
                    placeholder="Enter value..."
                  />
                ) : (
                  <div className="w-full min-h-[200px] px-3 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-800 bg-gray-50 whitespace-pre-wrap break-words">
                    {content}
                  </div>
                )}
              </div>

              {/* Footer */}
              {isEditable && (
                <div className="flex-shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={handleClose}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};
// --- End Expandable Popup Component ---

// --- Custom Scrollable Table Component with Pagination ---
const ScrollableTable = ({
  data,
  columns,
  onLineItemChange,
  onLineItemDelete, // NEW PROP
  canEditInvoice,
  errors,
  openCardPopup,
  firstInvalidField,
  setMasterKeyPopupOpen,
  setMasterKeyPopupField,
  setMasterKeyFieldConfig,
  isReadonly,
  fieldConfig, // Added fieldConfig prop
  parentName,
  paginationStates,
  setPaginationStates,
}) => {
  // Use external pagination state if provided, otherwise use internal state
  const externalPage =
    parentName && paginationStates ? paginationStates[parentName] : null;
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  const currentPage = externalPage || internalCurrentPage;
  const setCurrentPage =
    parentName && setPaginationStates
      ? (newPage) =>
        setPaginationStates((prev) => ({ ...prev, [parentName]: newPage }))
      : setInternalCurrentPage;
  const prevRowCountRef = useRef(data.length);
  const rowsPerPage = 5;

  // Calculate pagination
  const totalRows = data.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
  const currentRows = data.slice(startIndex, endIndex);

  // Create a unique ID for each row based on index
  const getRowId = (item, index) =>
    item.id || item.parameter_id || item.tenant_id || `row-${index}`;

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Generate page numbers for pagination display
  const getPaginationRange = () => {
    const range = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      if (currentPage <= 3) {
        range.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        range.push(
          1,
          "...",
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages
        );
      } else {
        range.push(
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages
        );
      }
    }
    return range;
  };

  // Determine which columns to display, including the Action column if editable
  const displayColumns = useMemo(() => {
    // Filter columns to only include visible ones and add isRequired property
    const visibleCols = columns
      .filter((col) => {
        // Find the field config for this column
        const fieldConfigItem =
          fieldConfig && Array.isArray(fieldConfig)
            ? fieldConfig.find((f) => f.field_name === col.key && f.parent)
            : null;

        // If we found a field config, use its is_visible property (default true)
        // If no field config found, assume it should be visible
        return fieldConfigItem ? fieldConfigItem.is_visible ?? true : true;
      })
      .map((col) => {
        // Find the field config for this column to check if it's required
        const fieldConfigItem =
          fieldConfig && Array.isArray(fieldConfig)
            ? fieldConfig.find((f) => f.field_name === col.key && f.parent)
            : null;

        // Add isRequired property if the field is required
        return {
          ...col,
          isRequired: fieldConfigItem
            ? fieldConfigItem.is_required ?? false
            : false,
          isFieldReadonly: fieldConfigItem
            ? fieldConfigItem.is_readonly ?? false
            : false,
        };
      });

    // Check if there are any line item fields defined in fieldConfig (fields with parent property)
    const hasLineItemFields =
      fieldConfig &&
      Array.isArray(fieldConfig) &&
      fieldConfig.some((f) => f.parent);

    // Add the action column only if editing is allowed AND there are line item fields
    if (!isReadonly && canEditInvoice && hasLineItemFields) {
      visibleCols.push({
        key: "action",
        header: "Del", // Short header for small width
        isAction: true,
        width: "50px", // Keep width small for the icon
      });
    }
    return visibleCols;
  }, [columns, isReadonly, canEditInvoice, fieldConfig]);

  // NEW: Effect to adjust current page when data changes (to handle deletion of last item)
  useEffect(() => {
    // If current page is greater than total pages and total pages > 0
    // This happens when items are deleted from the last page
    if (currentPage > totalPages && totalPages > 0) {
      // Only update page if this is not controlled by external pagination state
      if (!parentName || !setPaginationStates) {
        setCurrentPage(totalPages);
      }
    }
    // If all items are deleted, reset to page 1
    if (totalRows === 0) {
      // Only update page if this is not controlled by external pagination state
      if (!parentName || !setPaginationStates) {
        setCurrentPage(1);
      }
    }
  }, [
    totalRows,
    totalPages,
    currentPage,
    parentName,
    setPaginationStates,
    setCurrentPage,
  ]);

  // NEW: Effect to handle row addition (to focus on newly added row)
  useEffect(() => {
    // Detect row addition
    if (data.length > prevRowCountRef.current) {
      const newTotalPages = Math.ceil(data.length / rowsPerPage);

      // Only update page if this is not controlled by external pagination state
      if (!parentName || !setPaginationStates) {
        // Move to last page
        setCurrentPage(newTotalPages);
      }

      // Focus newly added row (after DOM paint)
      requestAnimationFrame(() => {
        const newRowIndex = data.length - 1;

        // Focus first editable field of the new row
        const firstColumnKey = columns.find((col) => col.key !== "action")?.key;

        if (firstColumnKey) {
          const inputId = `${parentName || 'line-item'}-${newRowIndex}-${firstColumnKey}`;
          const el = document.getElementById(inputId);
          el?.focus();
          el?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      });
    }

    prevRowCountRef.current = data.length;
  }, [
    data.length,
    columns,
    rowsPerPage,
    parentName,
    setPaginationStates,
    setCurrentPage,
  ]);

  return (
    <div className="flex flex-col" data-tour="editor-line-items">
      <div
        className="border border-gray-200 rounded-md shadow-sm flex-grow overflow-x-auto overflow-y-auto"
        style={{ maxHeight: "300px" }}
      >
        <table
          className="border-collapse bg-white text-xs"
          style={{
            tableLayout: "auto",
            minWidth: "100%", // KEY FIX → enables horizontal scroll
          }}
        >
          <thead className="bg-gradient-to-br from-gray-50 to-gray-100 sticky top-0 z-10">
            <tr>
              {displayColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-2 py-2 text-left font-semibold text-gray-700 tracking-wider border-b border-r border-gray-300 last:border-r-0 ${col.isAction ? "w-[50px] text-center" : ""
                    }`}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center justify-center">
                    <span>{col.header}</span>
                    {col.isRequired && (
                      <span className="text-red-600 ml-1">*</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((item, index) => {
                const actualIndex = startIndex + index;
                const rowId = getRowId(item, actualIndex);
                return (
                  <tr
                    key={rowId}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    {displayColumns.map((col) => {
                      // Handle Action Column
                      if (col.isAction) {
                        return (
                          <td
                            key={`${rowId}-${col.key}`}
                            className={`px-2 py-1 border-b border-r border-gray-200 last:border-r-0 text-gray-700 align-middle text-center`}
                          >
                            <button
                              type="button"
                              onClick={() => onLineItemDelete(actualIndex)}
                              title={`Delete line item ${actualIndex + 1}`}
                              className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              disabled={!canEditInvoice || isReadonly}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        );
                      }

                      // Existing data column rendering logic
                      const fieldValue = item[col.key] ?? "";
                      // Modified logic: Check if field actually has error based on current value
                      // For date fields, also check if the date is valid
                      const errorParent = parentName || 'lineItems';
                      let hasError = !!(
                        errors?.[errorParent]?.[actualIndex]?.[col.key] &&
                        (fieldValue === null ||
                          fieldValue === undefined ||
                          String(fieldValue).trim() === "")
                      );

                      // Special handling for date fields to check if the date is valid
                      if (col.type === "date" && errors?.[errorParent]?.[actualIndex]?.[col.key]) {
                        const dateValue = String(fieldValue ?? "").trim();
                        hasError = dateValue === ""; // Only show error if field is actually empty
                      }
                      const errorClasses = hasError
                        ? "border-red-500 bg-red-50 focus:ring-red-100"
                        : "border-gray-200";

                      // Check if column has custom_values format (Drop(...), Radio(...), Check(...), MasterKey(...))
                      const hasCustomValues =
                        col.custom_values &&
                        (col.custom_values.startsWith("Drop(") ||
                          col.custom_values.startsWith("Radio(") ||
                          col.custom_values.startsWith("Check(") ||
                          col.custom_values.startsWith("MasterKey("));

                      return (
                        <td
                          key={`${rowId}-${col.key}`}
                          className={`px-2 py-1 border-b border-r border-gray-200 last:border-r-0 text-gray-700 align-middle ${hasError ? "bg-red-50" : ""
                            }`}
                          style={{ maxWidth: "150px" }}
                        >
                          {hasCustomValues ? (
                            // Render custom value field for line items
                            <div className="relative w-full">
                              {/* Check if it's a MasterKey type */}
                              {col.custom_values.startsWith("MasterKey(") ? (
                                <div className="relative flex items-center w-full">
                                  <Tooltip content={fieldValue}>
                                    <input
                                      type={
                                        col.type === "date" ? "date" : "text"
                                      }
                                      id={`${parentName || 'line-item'}-${actualIndex}-${col.key}`}
                                      value={fieldValue}
                                      className={`w-full text-xs font-medium px-1.5 py-0.5 border rounded-sm shadow-inner min-w-[80px] ${col.isFieldReadonly
                                        ? "cursor-not-allowed bg-gray-100"
                                        : "cursor-pointer bg-white"
                                        } hover:bg-gray-100  ${errorClasses} ${isReadonly ? "pr-2" : "pr-8"
                                        }`}
                                      readOnly={true}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Only open popup if not in readonly mode AND clicking directly on icon
                                        if (!isReadonly) {
                                          // We'll handle this via the button only
                                        }
                                      }}
                                      disabled={
                                        !canEditInvoice || col.isFieldReadonly
                                      }
                                      title={
                                        col.isFieldReadonly
                                          ? "This field is set to readonly."
                                          : ""
                                      }
                                    />
                                  </Tooltip>
                                  {!isReadonly && (
                                    <button
                                      className="absolute right-2 text-gray-700 text-xs hover:text-indigo-600 transition-colors no-tooltip"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Only open popup if not in readonly mode
                                        if (!isReadonly) {
                                          // Parse the MasterKey to get the unique key
                                          const parsedCustomValues =
                                            parseCustomValues(
                                              col.custom_values
                                            );
                                          // Open master key search popup for line item
                                          setMasterKeyPopupField(
                                            `lineItem-${actualIndex}-${col.key}`
                                          );
                                          setMasterKeyFieldConfig({
                                            fieldName: col.key,
                                            uniqueKey:
                                              parsedCustomValues.options[0] ||
                                              "abcd",
                                          });
                                          setMasterKeyPopupOpen(true);
                                        }
                                      }}
                                      title="Search Master Key Values"
                                      disabled={!canEditInvoice || isReadonly}
                                    >
                                      <Search size={12} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                renderCustomValueField(
                                  {
                                    field_name: col.key,
                                    custom_values: col.custom_values,
                                  },
                                  fieldValue,
                                  (newValue) =>
                                    onLineItemChange(
                                      actualIndex,
                                      col.key,
                                      newValue
                                    ),
                                  !canEditInvoice, // isReadOnly
                                  `line-item-${actualIndex}-${col.key}`,
                                  hasError
                                )
                              )}
                              {hasError && (
                                <p className="mt-1 text-[10px] text-red-600 font-medium">
                                  {errors.lineItems[actualIndex][col.key]}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="relative">
                              {/* Check if value length is greater than 15 and no custom values */}
                              {fieldValue && String(fieldValue).length > 15 ? (
                                <ExpandablePopup
                                  content={fieldValue}
                                  isEditable={
                                    canEditInvoice &&
                                    !col.isFieldReadonly &&
                                    !isReadonly
                                  }
                                  onChange={(newValue) => {
                                    let valueToSet = newValue;
                                    if (col.type === "number") {
                                      const num = parseFloat(valueToSet);
                                      valueToSet = isNaN(num) ? "" : num;
                                    }
                                    onLineItemChange(
                                      actualIndex,
                                      col.key,
                                      valueToSet
                                    );
                                  }}
                                  disabled={
                                    !canEditInvoice ||
                                    col.isFieldReadonly ||
                                    isReadonly
                                  }
                                  displayName={
                                    col.header || toTitleCase(col.key)
                                  }
                                >
                                  {({ onExpand }) => (
                                    <div className="flex justify-between items-center w-full gap-2">
                                      <Tooltip content={fieldValue}>
                                        <input
                                          type={
                                            col.type === "number"
                                              ? "number"
                                              : col.type === "date"
                                                ? "date"
                                                : "text"
                                          }
                                          id={`${parentName || 'line-item'}-${actualIndex}-${col.key}`}
                                          value={fieldValue}
                                          className={`w-full text-xs font-medium px-1.5 py-0.5 border rounded-sm shadow-inner min-w-[80px] ${col.isFieldReadonly
                                            ? "cursor-not-allowed bg-gray-100"
                                            : "cursor-pointer bg-white"
                                            } hover:bg-gray-100 ${errorClasses} pr-8`}
                                          readOnly={true}
                                          disabled={
                                            !canEditInvoice ||
                                            col.isFieldReadonly
                                          }
                                          title={
                                            col.isFieldReadonly
                                              ? "This field is set to readonly."
                                              : "Click icon to expand"
                                          }
                                        />
                                      </Tooltip>
                                      <button
                                        className="absolute right-2 text-gray-700 text-xs hover:text-indigo-600 transition-colors no-tooltip"
                                        onClick={onExpand}
                                        title="Expand/Edit"
                                        type="button"
                                      >
                                        <SquareArrowOutUpRight size={12} />
                                      </button>
                                    </div>
                                  )}
                                </ExpandablePopup>
                              ) : (
                                <Tooltip content={fieldValue}>
                                  <input
                                    type={
                                      col.type === "number"
                                        ? "number"
                                        : col.type === "date"
                                          ? "date"
                                          : "text"
                                    }
                                    id={`${parentName || 'line-item'}-${actualIndex}-${col.key}`}
                                    value={fieldValue}
                                    onChange={(e) => {
                                      let valueToSet = e.target.value;
                                      if (col.type === "number") {
                                        const num = parseFloat(valueToSet);
                                        valueToSet = isNaN(num) ? "" : num;
                                      }
                                      onLineItemChange(
                                        actualIndex,
                                        col.key,
                                        valueToSet
                                      );
                                    }}
                                    className={`w-full text-xs font-medium px-1.5 py-0.5 border rounded-sm  shadow-inner focus:border-indigo-500 focus:ring-2 focus:outline-none min-w-[80px] ${col.isFieldReadonly
                                      ? "cursor-not-allowed bg-gray-100"
                                      : "cursor-pointer bg-white"
                                      } transition-all ${errorClasses}`}
                                    disabled={
                                      !canEditInvoice || col.isFieldReadonly
                                    }
                                    title={
                                      !canEditInvoice
                                        ? "You do not have permission to edit this invoice."
                                        : `Edit ${toTitleCase(
                                          col.key
                                        )} for line item ${actualIndex + 1}`
                                    }
                                  />
                                </Tooltip>
                              )}
                              {hasError && (
                                <p className="mt-1 text-xs text-red-600 font-medium">
                                  {errors?.[parentName || 'lineItems']?.[actualIndex]?.[col.key]}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={displayColumns.length}
                  className="px-4 py-4 text-center text-gray-500"
                >
                  No line items available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination Controls */}
      {/* NEW: Only show pagination if there are rows */}
      {totalRows > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-3">
          <div className="text-xs text-gray-700">
            Showing {startIndex + 1} to {endIndex} of {totalRows} entries
          </div>
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center justify-center bg-white text-gray-700 border border-gray-300 px-1.5 py-1 text-xs font-medium rounded-sm cursor-pointer min-w-6 transition-all duration-200 relative overflow-hidden hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 hover:-translate-y-px hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <ChevronLeft size={14} />
            </button>

            {getPaginationRange().map((pg, i) => (
              <button
                type="button"
                key={i}
                disabled={pg === "..."}
                className={`px-1.5 py-1 text-xs font-medium rounded-sm cursor-pointer min-w-6 transition-all duration-200 relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${pg === currentPage
                  ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border border-indigo-600 shadow-md"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 hover:-translate-y-px hover:shadow-sm"
                  }`}
                onClick={() => typeof pg === "number" && handlePageChange(pg)}
              >
                {pg}
              </button>
            ))}

            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center bg-white text-gray-700 border border-gray-300 px-1.5 py-1 text-xs font-medium rounded-sm cursor-pointer min-w-6 transition-all duration-200 relative overflow-hidden hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 hover:-translate-y-px hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
// --- End Custom Scrollable Table Component ---

// --- Previous Comments Accordion Component ---
const PreviousCommentsAccordion = ({ workflowHistory }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Filter to only entries that have a non-null user_comments
  const comments = (workflowHistory || []).filter(
    (entry) => entry.user_comments && entry.user_comments.trim() !== ""
  );

  // Format date: "2026-03-12T12:34:11.419+00:00" → "12 March, 2026"
  const formatDate = (isoString) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  // Format role name
  const formatRole = (role) => {
    if (!role) return "";
    return role
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={15} className="text-indigo-500" />
          <span className="text-[12px] font-semibold text-gray-700">
            View Previous Comments
            <span className="ml-1 text-gray-500 font-normal">
              ({comments.length})
            </span>
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={16} className="text-gray-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-500" />
        )}
      </button>

      {/* Accordion Body */}
      {isOpen && (
        <div className="p-3 border-t border-gray-200 bg-gray-50/50 flex flex-col gap-2">
          {comments.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-3">
              No previous comments found.
            </p>
          ) : (
            comments.map((entry) => (
              <div
                key={entry.history_id}
                className="bg-white rounded-lg border border-gray-200 px-4 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <UserRound size={12} className="text-indigo-500" />
                    </div>
                    {/* Name + Role */}
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-gray-800 leading-tight">
                        {entry.resolved_user_name ||
                          entry.created_by_name ||
                          (entry.created_by ? `User #${entry.created_by}` : "System")}
                      </p>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-100">
                        {formatRole(entry.created_role_name)}
                      </span>
                    </div>
                  </div>
                  {/* Date */}
                  <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                    {formatDate(entry.transaction_timestamp)}
                  </span>
                </div>
                {/* Comment text */}
                <p className="text-xs text-gray-600 leading-relaxed pl-7">
                  {entry.user_comments}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
// --- End Previous Comments Accordion ---

const VendorFormUI = ({
  invoiceId,
  formData,
  fieldConfig,
  errors,
  setErrors,
  fileUrl,
  fileType,
  invoicePath,
  lineItemTableHeaders,
  lineItemColumnProperties,
  onFieldChange,
  onLineItemChange,
  onLineItemAdd, // NEW PROP
  onLineItemDelete, // NEW PROP
  onReject,
  onHold,
  onSendToReconciliation,
  onApproveAndUpload,
  rejectionComment,
  setRejectionComment,
  onClearRejectionCommentError, // New prop to clear rejection comment error
  validateForm,
  canEditInvoice, // New prop for edit permission
  onReconcileWithPO, // New prop for reconcile action
  onBack, // New prop for back button action
  firstInvalidField,
  isReadonly = false, // New prop for readonly mode
  errorDesc, // Add errorDesc prop
  onSaveDraft, // New prop for save draft functionality
  onSubmit, // New prop for submit functionality
  onCancel, // New prop for cancel functionality
  isCreating = false, // New prop to indicate if we"re creating a new record
  docId,
  activeTab, // New prop for active tab
  setActiveTab, // New prop for setting active tab
  // Document tray props
  documentActiveTab,
  setDocumentActiveTab,
  isDocTrayCollapsed,
  setIsDocTrayCollapsed,
  documents,
  selectedDocument,
  toggleDocTray,
  selectDocument,
  onDeleteDocument,
  fileInputRef,
  triggerUpload,
  handleFileSelect,
  pendingFiles,
  setPendingFiles,
  // Manual upload props
  manualUploadedFiles = [],
  onManualFileSelect,
  onRemoveManualFile,
  onOpenPreview,
  vendorStatus,
  vendorStage,
  workflowConfig,  // Workflow JSON config from ap_parameters
  currentWorkflowStepId = null, // Current step fetched from ap_process_workflow_instances
  instanceId = null, // Workflow instance ID for approval history
  isWorkflowCompleted = false,
  workflowHistory = [], // Pre-fetched workflow history with resolved user names
  isWorkflowMissing = false, // True when vendor_workflow_json key is absent or meta is invalid
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileListRef = useRef(null);
  const [mainActiveTab, setMainActiveTab] = useState('vendor_form');
  const [nonManualActiveTab, setNonManualActiveTab] = useState('vendor_form');
  const [activeNestedTab, setActiveNestedTab] = useState(null);
  const location = useLocation();

  const isManualVendor = location?.state?.type === "manualVendor" ||
    (vendorStatus === 'Draft' && vendorStage === 'New');

  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = customUploadStyles;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  // Auto-reset non-manual "Uploaded Documents" tab to "Vendor Form" when documents become available
  useEffect(() => {
    if (!isManualVendor && nonManualActiveTab === 'uploaded_documents' && documents && documents.length > 0) {
      setNonManualActiveTab('vendor_form');
    }
  }, [isManualVendor, nonManualActiveTab, documents]);

  // Helper function to check if a field's parent is a tab
  const isParentATab = useCallback((parentName) => {
    if (!parentName) return false;
    const parentField = fieldConfig.find(field => field.field_name === parentName);
    return parentField && parentField.field_type === 'tab';
  }, [fieldConfig]);

  // Reset activeNestedTab when activeTab changes
  useEffect(() => {
    const childTabs = fieldConfig.filter(f => f.field_type === 'tab' && f.parent === activeTab);
    if (childTabs.length > 0) {
      const sortedChildTabs = childTabs.sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999));
      setActiveNestedTab(sortedChildTabs[0].field_name);
    } else {
      setActiveNestedTab(null);
    }
  }, [activeTab, fieldConfig]);

  // 1. Identify "Global" fields (parent is empty and not a tab/array)
  const globalFields = useMemo(() => fieldConfig
    .filter((f) => {
      const isTopLevel = !f.parent || f.parent === "";
      const isNotTab = f.field_type !== "tab";
      const isVisible = f.is_visible ?? true;
      return isTopLevel && isNotTab && isVisible;
    })
    .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999)), [fieldConfig]);

  // 2. Identify fields belonging directly to the root tab (excluding nested tabs)
  const rootTabFields = useMemo(() => fieldConfig
    .filter((f) => {
      const isVisible = f.is_visible ?? true;
      const isTab = f.field_type === 'tab';
      return f.parent === activeTab && !isTab && isVisible;
    })
    .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999)), [fieldConfig, activeTab]);

  // 3. Identify fields belonging to the active nested tab
  const nestedTabFields = useMemo(() => fieldConfig
    .filter((f) => {
      const isVisible = f.is_visible ?? true;
      return f.parent === activeNestedTab && isVisible;
    })
    .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999)), [fieldConfig, activeNestedTab]);

  // 4. Identify sub-tabs for the current active tab
  const nestedTabs = useMemo(() => fieldConfig
    .filter(f => f.field_type === 'tab' && f.parent === activeTab && (f.is_visible ?? true))
    .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999)), [fieldConfig, activeTab]);

  // Auto-switch activeTab if the current one becomes hidden
  useEffect(() => {
    const visibleRootTabs = fieldConfig
      .filter(f => f.field_type === 'tab' && !isParentATab(f.parent) && (f.is_visible ?? true))
      .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999));

    const currentTabVisible = visibleRootTabs.some(f => f.field_name === activeTab);
    if (!currentTabVisible && visibleRootTabs.length > 0) {
      setActiveTab(visibleRootTabs[0].field_name);
    }
  }, [fieldConfig, activeTab, setActiveTab, isParentATab]);

  // Determine if the active root tab has is_readonly: true → all its child fields become readonly
  const isActiveTabReadonly = useMemo(() => {
    const activeTabField = fieldConfig.find(f => f.field_type === 'tab' && f.field_name === activeTab);
    return activeTabField?.is_readonly ?? false;
  }, [fieldConfig, activeTab]);

  // Determine if the active nested tab has is_readonly: true → nested child fields also become readonly
  const isActiveNestedTabReadonly = useMemo(() => {
    if (!activeNestedTab) return false;
    const nestedTabField = fieldConfig.find(f => f.field_type === 'tab' && f.field_name === activeNestedTab);
    return nestedTabField?.is_readonly ?? false;
  }, [fieldConfig, activeNestedTab]);

  // Wrapper function to handle bulk form data updates for ButtonFields
  const handleFormDataUpdate = useCallback((newFormData) => {
    // Update each field that changed
    Object.keys(newFormData).forEach(fieldName => {
      if (newFormData[fieldName] !== formData[fieldName]) {
        // Use the existing onFieldChange handler
        onFieldChange(fieldName, newFormData[fieldName]);
      }
    });
  }, [formData, onFieldChange]);

  // --- 1. Helper for the Tab Navigation UI ---
  const renderMainTabs = () => (
    <div className="px-4 pt-0 border-b border-gray-100 bg-white">
      <nav className="flex gap-6">
        <button
          onClick={() => setMainActiveTab('vendor_form')}
          className={`pb-2.5 pt-2 text-[12px] font-medium transition-all relative group ${mainActiveTab === 'vendor_form' ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-500'
            }`}
        >
          Policy Form
          <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full transition-all duration-300 ${mainActiveTab === 'vendor_form' ? 'bg-indigo-500 opacity-100' : 'bg-gray-200 opacity-0 group-hover:opacity-100'
            }`}></div>
        </button>
        <button
          onClick={() => setMainActiveTab('uploaded_documents')}
          className={`pb-2.5 pt-2 text-[12px] font-medium transition-all relative group ${mainActiveTab === 'uploaded_documents' ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-500'
            }`}
        >
          Documents ({(documents?.length || 0) + manualUploadedFiles.length})
          <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full transition-all duration-300 ${mainActiveTab === 'uploaded_documents' ? 'bg-indigo-500 opacity-100' : 'bg-gray-200 opacity-0 group-hover:opacity-100'
            }`}></div>
        </button>
        <button
          onClick={() => setMainActiveTab('approval_history')}
          className={`pb-2.5 pt-2 text-[12px] font-medium transition-all relative group ${mainActiveTab === 'approval_history' ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-500'
            }`}
        >
          Approval History
          <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full transition-all duration-300 ${mainActiveTab === 'approval_history' ? 'bg-indigo-500 opacity-100' : 'bg-gray-200 opacity-0 group-hover:opacity-100'
            }`}></div>
        </button>
      </nav>
    </div>
  );

  const renderFormContent = () => (
    <>
      <div className="panel-content p-4 flex flex-col gap-5 overflow-y-auto flex-grow min-h-0">
        <MessageDisplay errorDesc={errorDesc} />
        {/* --- GLOBAL FIELDS (Above Tabs) --- */}
        {globalFields.length > 0 && (
          <div>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(200px, 100%), 1fr))" }}
            >
              {(() => {
                // Group fields so that a button immediately following a non-button
                // field is rendered inline (side-by-side) within the same grid cell.
                const items = [];
                let i = 0;
                while (i < globalFields.length) {
                  const current = globalFields[i];
                  const next = globalFields[i + 1];
                  if (
                    current.field_type !== "button" &&
                    current.field_type !== "array" &&
                    next?.field_type === "button"
                  ) {
                    // Pair: input field + button side-by-side in one grid cell.
                    //
                    // Layout strategy:
                    //   - Outer container uses `items-start` so neither child stretches
                    //     when the field grows due to an error message appearing below it.
                    //   - The button wrapper uses `pt-5` to clear the field's label row
                    //     (label ~20px ≈ 1.25rem) so the button sits flush with the input.
                    //   - `self-start` + `mt-auto` is intentionally NOT used here because
                    //     it would push the button down when an error is shown. Instead we
                    //     use a fixed top-padding that matches the label height so the
                    //     button always aligns with the input regardless of error state.
                    items.push(
                      <div key={current.field_name} className="flex items-start gap-2 min-w-0 overflow-hidden">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          {renderFormField(current)}
                        </div>
                        {/* pt-5 offsets the label above the input so the button
                            sits level with the input, not the label or error text */}
                        <div className="flex-shrink-0 pt-5">
                          {renderFormField(next)}
                        </div>
                      </div>
                    );
                    i += 2; // skip both
                  } else {
                    // Standalone field (including standalone buttons)
                    items.push(
                      <Fragment key={current.field_name}>
                        {renderFormField(current)}
                      </Fragment>
                    );
                    i += 1;
                  }
                }
                return items;
              })()}
            </div>
          </div>
        )}

        {fieldConfig?.some((f) => f?.field_type === "tab" && !isParentATab(f.parent) && (f.is_visible ?? true)) && <div className="border-b border-gray-100"></div>}

        {/* --- TAB NAVIGATION --- */}
        {fieldConfig.some((f) => f.field_type === "tab" && !isParentATab(f.parent) && (f.is_visible ?? true)) && (
          <div className="shrink-0 bg-gray-50/60 border border-gray-100 rounded-xl p-2.5">
            <nav className="flex border-b border-gray-100 mb-2 gap-1 overflow-x-auto">
              {fieldConfig
                .filter((f) => f.field_type === "tab" && !isParentATab(f.parent) && (f.is_visible ?? true))
                .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999))
                .map((tabField) => {
                  const Icon = getTabIconComponent(tabField.field_name);
                  return (
                    <button
                      key={tabField.field_name}
                      onClick={() => setActiveTab(tabField.field_name)}
                      className={`
                py-2 px-3 mr-0.5 text-[11px] font-medium transition-all duration-200 relative rounded-lg flex items-center gap-1.5 group whitespace-nowrap
                ${activeTab === tabField.field_name
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-white/60'
                        }
              `}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon size={13} />
                      </span>
                      {tabField.display_name || toTitleCase(tabField.field_name)}
                      <div className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-t-sm transition-all duration-300 ${activeTab === tabField.field_name
                        ? 'bg-indigo-500 opacity-100'
                        : 'opacity-0'
                        }`}></div>
                    </button>
                  )
                })}
              {/* {isCreating && (
              <button
                onClick={() => setActiveTab("upload")}
                className={`
            py-3 px-3 mr-1 text-xs font-medium transition-all duration-300 relative rounded-t-lg flex items-center gap-2
            ${activeTab === "upload"
                    ? 'bg-white/80 text-indigo-600 backdrop-blur-sm'
                    : 'hover:bg-gray-100/50 hover:text-gray-700'
                  }
          `}
              >
                <Upload size={16} />
                Upload

                {activeTab === "upload" && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-sm shadow-sm"></div>
                )}
              </button>
            )} */}
            </nav>
            {/* --- TAB CONTENT: ACTIVE TAB FIELDS --- */}
            <div className="mt-4 p-1">
              {activeTab === "upload" ? (
                // <div id="content-uploads" className="tab-content animate-modern space-y-8">
                //     <div className="grid grid-cols-1 gap-6">
                //         <div
                //             className="col-span-1 p-8 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center group hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all h-[110px]"
                //             onClick={triggerUpload}
                //             style={{ cursor: 'pointer' }}
                //         >
                //             <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                //                 <i className="fa-solid fa-cloud-arrow-up text-indigo-500"></i>
                //             </div>
                //             <p className="text-[12px] font-medium text-slate-700">Upload Supporting Doc</p>
                //             <p className="text-[10px] text-slate-400 mt-1">PDF, JPG, PNG up to 10MB</p>
                //             <input
                //                 type="file"
                //                 id="fileInput"
                //                 ref={fileInputRef}
                //                 className="hidden"
                //                 onChange={(e) => {
                //                     const files = Array.from(e.target.files || []);
                //                     handleFileSelect(files);
                //                     // Reset the input so the same file can be selected again
                //                     e.target.value = '';
                //                 }}
                //                 multiple
                //                 accept=".pdf,.jpg,.jpeg,.png"
                //             />
                //         </div>

                //         <div className="col-span-1 space-y-3" id="trayContainer">
                //             {/* Tray items - render uploaded files */}
                //             {pendingFiles && pendingFiles.length > 0 ? (
                //                 pendingFiles.map((file, index) => (
                //                     <div key={index} className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between flex-wrap shadow-md transition-all w-sm max-w-sm">
                //                         <div className="flex items-center gap-3">
                //                             <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                //                                 <i className="fa-solid fa-file-invoice"></i>
                //                             </div>
                //                             <div>
                //                                 <p className="text-[11px] font-medium text-slate-800">{file.name}</p>
                //                                 <p className="text-[9px] text-emerald-600 font-medium uppercase tracking-tighter">Selected • {file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`}</p>
                //                             </div>
                //                         </div>
                //                         <button
                //                             className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                //                             onClick={(e) => {
                //                                 e.stopPropagation(); // Prevent triggering any parent click events
                //                                 // Filter out the file at the current index
                //                                 const updatedFiles = pendingFiles.filter((_, i) => i !== index);
                //                                 setPendingFiles(updatedFiles);

                //                                 // Optional: Show a small toast notification
                //                                 // toast.info("File removed from selection");
                //                             }}
                //                         >
                //                             <i className="fa-solid fa-trash-can text-[10px]"></i>
                //                         </button>
                //                     </div>
                //                 ))
                //             ) : (
                //                 <div className="text-center text-gray-500 py-8">
                //                     No files selected
                //                 </div>
                //             )}
                //         </div>
                //     </div>
                // </div>

                <div className="w-full max-w-4xl mx-auto space-y-6">
                  <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/30 backdrop-blur-sm p-4 border border-indigo-100/50 rounded-2xl shadow-lg shadow-indigo-100/30">
                    <div className="upload-header text-center mb-6 animate-fade-in-down">
                      <h1 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-blue-700 bg-clip-text text-transparent mb-2 leading-tight tracking-tight">
                        Upload Supporting Documents
                      </h1>
                      <p className="text-xs text-gray-600 leading-relaxed font-medium max-w-xl mx-auto">
                        Supports PDF, JPG, JPEG, and PNG files up to 10MB each
                        (Max {MAX_FILE_COUNT} files)
                      </p>
                    </div>

                    <div
                      className={`${cardBaseClasses} animate-fade-in-up`}
                      ref={fileListRef}
                    >
                      {/* 1. DROPZONE */}
                      <div
                        className={`
                              upload-dropzone dropzone-hover-effect
                              border-2 border-dashed rounded-2xl text-center transition-all duration-400 cursor-pointer
                              bg-gradient-to-br from-indigo-50/80 to-blue-50/80 backdrop-blur-sm h-full
                              ${dragOver ? "dropzone-drag-over" : ""}
                              ${isDropzoneDisabled
                            ? "cursor-not-allowed opacity-60 bg-gray-100 border-gray-300 transform-none shadow-none"
                            : ""
                          }
                              ${dropzoneSizeClasses}
                              ${isFilesPresent ? "mb-6" : ""}
                            `}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={triggerUpload}
                      >
                        <div className={dropzoneContentClasses}>
                          <div className="flex items-center space-x-3 sm:space-x-4 flex-grow justify-center sm:justify-start">
                            <Upload
                              className={`${dropzoneIconClasses} text-indigo-500 animate-float drop-shadow-md flex-shrink-0`}
                            />
                            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                              <h3
                                className={`${dropzoneTextClasses} font-semibold`}
                              >
                                {isMaxFilesReached
                                  ? "File Limit Reached"
                                  : isFilesPresent
                                    ? "Upload More Files"
                                    : "Drag & drop files here"}
                              </h3>
                              <p className={`${dropzoneSubTextClasses}`}>
                                {isMaxFilesReached
                                  ? `Maximum of ${MAX_FILE_COUNT} files selected`
                                  : isFilesPresent
                                    ? `${currentFiles.length} of ${MAX_FILE_COUNT} files selected. Select up to ${MAX_FILE_COUNT - currentFiles.length} more.`
                                    : "Click to browse or drag & drop documents here"}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`
                                  btn-shimmer focus-ring flex-shrink-0
                                  ${isDropzoneDisabled
                                ? "bg-gray-300 text-gray-600 cursor-not-allowed transform-none shadow-none"
                                : "bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-medium transition-all duration-300"
                              }
                                  px-3 py-1.5 rounded-md text-xs
                                  shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30
                                `}
                            disabled={isDropzoneDisabled}
                          >
                            {isMaxFilesReached
                              ? "Limit Reached"
                              : isFilesPresent
                                ? `Add Files (${MAX_FILE_COUNT - currentFiles.length
                                } left)`
                                : "Choose Files"}
                          </button>
                        </div>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          if (!isMaxFilesReached) {
                            handleFileSelect(e.target.files);
                          }
                          e.target.value = "";
                        }}
                        className="hidden"
                        disabled={isDropzoneDisabled}
                      />

                      {/* 2. FILE LIST SECTION */}
                      {isFilesPresent && (
                        <div className="w-full">
                          <h3 className="text-sm font-semibold text-gray-800 mb-4 text-center tracking-tight">
                            Selected Files ({currentFiles.length} of{" "}
                            {MAX_FILE_COUNT})
                          </h3>

                          <div className="file-list grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {currentFiles.map((file, index) => (
                              <div
                                key={index}
                                className="card-border-top file-list-item-hover relative flex items-center justify-between p-2 rounded-xl border bg-white/90 transition-all duration-300 ease-in-out shadow-md"
                              >
                                <div className="flex items-center space-x-3 flex-grow min-w-0">
                                  <div className="flex-shrink-0">
                                    {getFileIcon(file.type)}
                                  </div>
                                  <div className="flex flex-col min-w-0 flex-grow">
                                    <p
                                      className="text-xs font-semibold text-gray-800 truncate"
                                      title={file.name}
                                    >
                                      {file.name}
                                    </p>
                                    <p className="text-[10px] text-gray-500 font-medium">
                                      {formatFileSize(file.size)}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(index);
                                  }}
                                  className="focus-ring bg-white/90 text-gray-400 hover:text-red-500 transition-all duration-300 w-6 h-6 flex items-center justify-center rounded-full shadow-md hover:scale-110 backdrop-blur-sm"
                                  title="Remove file"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* <div className="mt-6 flex justify-center">
                                <button
                                  onClick={onSaveDraft}
                                  disabled={!isFormEditable || currentFiles.length === 0}
                                  className={`
                                    btn-shimmer focus-ring
                                    px-6 py-2 rounded-lg text-xs font-bold transition-all duration-300 tracking-tight
                                    ${!isFormEditable || currentFiles.length === 0
                                      ? disabledBtn
                                      : "bg-gradient-to-r from-indigo-600 to-blue-700 text-white shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 active:translate-y-px"
                                    }
                                  `}
                                  type="button"
                                >
                                  Save Draft & Upload
                                </button>
                              </div> */}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 1. Root Tab Fields */}
                  {rootTabFields.length > 0 && (
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(200px, 100%), 1fr))" }}
                    >
                      {(() => {
                        const tabItems = [];
                        let ti = 0;
                        while (ti < rootTabFields.length) {
                          const cur = rootTabFields[ti];
                          const nxt = rootTabFields[ti + 1];
                          if (cur.field_type === "array") {
                            if (fieldConfig.some(f => f.parent === cur.field_name)) {
                              tabItems.push(
                                <div key={cur.field_name} className="col-span-full w-full border-t border-gray-100 pt-3 mt-1">
                                  <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-[11px] font-medium text-gray-600 border-l-2 border-indigo-400 pl-2">
                                      {cur.display_name || toTitleCase(cur.field_name)}
                                    </h4>
                                    {!isReadonly && !isActiveTabReadonly && (
                                      <button
                                        type="button"
                                        onClick={() => onLineItemAdd(cur.field_name)}
                                        disabled={!isFormEditable}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-normal rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Plus size={12} strokeWidth={2.5} /> Add Row
                                      </button>
                                    )}
                                  </div>
                                  {renderLineItemsTable(cur.field_name)}
                                </div>
                              );
                            }
                            ti += 1;
                          } else if (cur.field_type !== "button" && nxt?.field_type === "button") {
                            tabItems.push(
                              <div key={cur.field_name} className="flex items-start gap-2 min-w-0 overflow-hidden">
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  {renderTabField(cur, cur.parent, 0)}
                                </div>
                                <div className="flex-shrink-0 pt-5">
                                  {renderTabField(nxt, nxt.parent, 0)}
                                </div>
                              </div>
                            );
                            ti += 2;
                          } else {
                            tabItems.push(
                              <Fragment key={cur.field_name}>
                                {renderTabField(cur, cur.parent, 0)}
                              </Fragment>
                            );
                            ti += 1;
                          }
                        }
                        return tabItems;
                      })()}
                    </div>
                  )}

                  {/* 2 & 3. Nested Section (Sub-tabs and their content) */}
                  {nestedTabs.length > 0 && (
                    <div className="bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/60 animate-fade-in mt-3">
                      {/* Nested Tab Navigation */}
                      <nav className="flex gap-3 border-b border-gray-100 mb-2 overflow-x-auto">
                        {nestedTabs.map(subTab => (
                          <button
                            key={subTab.field_name}
                            onClick={() => setActiveNestedTab(subTab.field_name)}
                            className={`pb-2 text-[11px] font-medium transition-all relative whitespace-nowrap flex items-center gap-1 ${activeNestedTab === subTab.field_name ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-500'
                              }`}
                          >
                            {subTab.display_name || toTitleCase(subTab.field_name)}
                            {activeNestedTab === subTab.field_name && (
                              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></div>
                            )}
                          </button>
                        ))}
                      </nav>

                      {/* Nested Tab Content Fields */}
                      {nestedTabFields.length > 0 ? (
                        <div
                          className="grid gap-3 animate-fade-in"
                          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(200px, 100%), 1fr))" }}
                        >
                          {(() => {
                            const nestedItems = [];
                            let ni = 0;
                            while (ni < nestedTabFields.length) {
                              const cur = nestedTabFields[ni];
                              const nxt = nestedTabFields[ni + 1];
                              if (cur.field_type === "array") {
                                // Only render array fields that have at least one child field.
                                // Arrays with no children produce an empty table — skip them.
                                if (fieldConfig.some(f => f.parent === cur.field_name)) {
                                  nestedItems.push(
                                    <div key={cur.field_name} className="col-span-full w-full border-t border-gray-100 mt-3 pt-3">
                                      <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-[11px] font-medium text-gray-600 border-l-2 border-indigo-400 pl-2">
                                          {cur.display_name || toTitleCase(cur.field_name)}
                                        </h4>
                                        {!isReadonly && !isActiveNestedTabReadonly && !isActiveTabReadonly && (
                                          <button
                                            type="button"
                                            onClick={() => onLineItemAdd(cur.field_name)}
                                            disabled={!isFormEditable}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-normal rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                          >
                                            <Plus size={12} strokeWidth={2.5} /> Add Row
                                          </button>
                                        )}
                                      </div>
                                      {renderLineItemsTable(cur.field_name)}
                                    </div>
                                  );
                                } // end hasChildren guard
                                ni += 1;
                              } else if (cur.field_type !== "button" && nxt?.field_type === "button") {
                                nestedItems.push(
                                  <div key={cur.field_name} className="flex items-start gap-2 min-w-0 overflow-hidden">
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                      {renderTabField(cur, cur.parent, 0)}
                                    </div>
                                    <div className="flex-shrink-0 pt-5">
                                      {renderTabField(nxt, nxt.parent, 0)}
                                    </div>
                                  </div>
                                );
                                ni += 2;
                              } else {
                                nestedItems.push(
                                  <Fragment key={cur.field_name}>
                                    {renderTabField(cur, cur.parent, 0)}
                                  </Fragment>
                                );
                                ni += 1;
                              }
                            }
                            return nestedItems;
                          })()}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                          <p className="text-[10px] font-medium italic">Select a sub-category to view fields</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty State */}
                  {/* {rootTabFields.length === 0 && nestedTabs.length === 0 && nestedTabFields.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-white/50 rounded-xl border border-dashed border-slate-200 w-full">
                      <p className="text-xs font-medium">No fields found for this tab</p>
                    </div>
                  )} */}
                </>
              )}
            </div>
          </div>
        )}

        {/* Line Items */}
        {globalFields.some(field => field.field_type === "array") && (
          <div className="border-t border-gray-100 pt-3">
            {globalFields.map((field) => (
              <Fragment key={field.field_name}>
                {field.field_type === "array" &&
                  fieldConfig.some(f => f.parent === field.field_name) && (
                    <div className="col-span-full mt-2">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-[11px] font-medium text-gray-600 border-l-2 border-indigo-400 pl-2">
                          {field.display_name || toTitleCase(field.field_name)}
                        </h4>
                        {!isReadonly && (
                          <button
                            type="button"
                            onClick={() => onLineItemAdd(field.field_name)}
                            disabled={!isFormEditable}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-normal rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus size={12} strokeWidth={2.5} /> Add Row
                          </button>
                        )}
                      </div>
                      {renderLineItemsTable(field.field_name)}
                    </div>
                  )}
              </Fragment>
            ))}
          </div>
        )}

        {/* ButtonFields removed as global buttons are now rendered in-line via renderFormField */}

        <div className="mt-2 border-b border-gray-100" />

        {/* Add Comments Section when not creating a new vendor */}

        <div>
          <div className="pb-4 last:border-b-0 last:pb-0 flex-grow min-h-0 flex flex-col bg-white rounded-xl">
            {/* Previous Comments Accordion */}
            <div className="mb-3">
              <PreviousCommentsAccordion workflowHistory={workflowHistory} />
            </div>

            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[11px] font-medium text-gray-500 mb-2 flex-shrink-0">
                Comments
              </h4>
            </div>
            <div
              className={`flex flex-col min-w-0 ${errors.rejectionComment ? "text-red-500" : ""
                } flex-grow transition-all duration-200`}
            >
              <div className="mt-1 text-[10px] text-gray-400 flex justify-between">
                <label
                  htmlFor="rejectionComment"
                  className="text-[11px] font-normal text-gray-400 mb-1.5 flex-shrink-0 flex items-center"
                >
                  <span>Add Comments</span>
                  {errors.rejectionComment && (
                    <span className="text-red-400 ml-1">*</span>
                  )}
                </label>
                <span>{rejectionComment.length}/500</span>
              </div>
              <textarea
                id="rejectionComment"
                name="rejectionComment"
                value={rejectionComment}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setRejectionComment(e.target.value);
                    if (onClearRejectionCommentError) {
                      onClearRejectionCommentError();
                    }
                  }
                }}
                className={`w-full px-2 py-1.5 border border-gray-200 rounded-md text-[11px] font-normal text-gray-700 bg-white transition-all duration-200 ease-in-out focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed placeholder-gray-300 ${errors.rejectionComment
                  ? "border-red-400 bg-red-50 ring-red-100 ring-1"
                  : "hover:border-gray-300"
                  } flex-grow min-h-16 resize-y`}
                rows="2"
                placeholder="Enter comments or rejection reason..."
                disabled={!isFormEditable}
                title={
                  !isFormEditable
                    ? editPermissionMessage
                    : "Enter comments"
                }
                maxLength="500"
              ></textarea>
              {errors.rejectionComment && (
                <div className="mt-1 text-[10px] font-normal text-red-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.rejectionComment}
                </div>
              )}
              <div className="mt-2"></div>
            </div>
          </div>
        </div>

      </div>
    </>
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (handleFileSelect) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const removeFile = (index) => {
    if (setPendingFiles) {
      setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Upload card constants/classes
  const MAX_FILE_COUNT = 10;
  const docType = "Vendor Document";
  const currentFiles = pendingFiles || [];
  const isFilesPresent = currentFiles.length > 0;
  const isMaxFilesReached = currentFiles.length >= MAX_FILE_COUNT;
  const isDropzoneDisabled = isMaxFilesReached || !canEditInvoice;

  const dropzoneSizeClasses = isFilesPresent
    ? "p-3 md:p-4"
    : "p-8 md:p-12 min-h-[180px]";

  const dropzoneContentClasses = isFilesPresent
    ? "flex flex-row items-center justify-between space-x-4"
    : "flex flex-col items-center justify-center";

  const dropzoneIconClasses = isFilesPresent ? "w-6 h-6" : "w-10 h-10";

  const dropzoneTextClasses = isFilesPresent
    ? "text-sm font-semibold text-gray-700 tracking-tight"
    : "text-base sm:text-lg font-semibold text-gray-700 mb-1 tracking-tight";

  const dropzoneSubTextClasses = isFilesPresent
    ? "hidden sm:block text-xs text-gray-500 whitespace-nowrap"
    : "text-xs text-gray-500 mb-6";

  const cardBaseClasses =
    "w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100/50 p-6 flex flex-col";
  const disabledBtn =
    "bg-gray-200 text-gray-400 cursor-not-allowed transform-none shadow-none grayscale opacity-60";

  const getFileIcon = (type) => {
    if (type?.startsWith("image/"))
      return <ImageIcon className="w-5 h-5 text-indigo-600" />;
    if (type?.includes("pdf")) return <FileText className="w-5 h-5 text-indigo-600" />;
    return <FileText className="w-5 h-5 text-indigo-600" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const leftPanelRef = useRef(null); // Ref for the resizable left panel
  const formContainerRef = useRef(null);
  const [textContent, setTextContent] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [effectiveFileType, setEffectiveFileType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displayUrl, setDisplayUrl] = useState("");
  const objectUrlRef = useRef(null);

  // Image preview states
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);

  // Master Key Search Popup states
  const [masterKeyPopupOpen, setMasterKeyPopupOpen] = useState(false);
  const [masterKeyPopupField, setMasterKeyPopupField] = useState("");

  // State to store the master key field configuration
  const [masterKeyFieldConfig, setMasterKeyFieldConfig] = useState({
    fieldName: "",
    uniqueKey: "",
  });

  // Handler for when a master key value is selected
  const handleMasterKeySelect = useCallback(
    (value) => {
      if (masterKeyPopupField) {
        // Check if this is a line item field (starts with "lineItem-")
        if (masterKeyPopupField.startsWith("lineItem-")) {
          // Extract the index and field name from the masterKeyPopupField
          // Format: lineItem-{index}-{fieldName}
          const parts = masterKeyPopupField.split("-");
          if (parts.length === 3) {
            const index = parseInt(parts[1]);
            const fieldName = parts[2];
            onLineItemChange(index, fieldName, value);
          }
        } else {
          // General field
          onFieldChange(masterKeyPopupField, value);
        }
        setMasterKeyPopupField("");
        setMasterKeyPopupOpen(false);
      }
    },
    [masterKeyPopupField, onFieldChange, onLineItemChange]
  );

  // Get user and token from Redux store
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);

  const {
    isCardPopupOpen,
    popupContent,
    openCardPopup,
    closeCardPopup,
    setPopupContent,
  } = useCardPopup();

  // Table state variables (Unchanged)
  const [paginatedData, setPaginatedData] = useState([]);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [columnFilters, setColumnFilters] = useState({});

  // Collapsible table sections state
  const [collapsedSections, setCollapsedSections] = useState({});

  // Pagination state for each parent group
  const [paginationStates, setPaginationStates] = useState({});

  // Handle CardPopup content change
  const handlePopupContentChange = useCallback(
    (value) => {
      const { itemId, field, parentId } = popupContent;
      if (itemId !== null && field) {
        onLineItemChange(itemId, field, value, parentId || 'lineItems');
      } else if (field) {
        onFieldChange(field, value);
      }
      setPopupContent((prev) => ({ ...prev, content: value }));
    },
    [popupContent, onFieldChange, onLineItemChange, setPopupContent]
  );

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Derive the current workflow step by matching vendorStatus against the
  // dataUpdates.status values defined across all step transitions.
  //
  // Resolution order:
  //  1. Find the step whose stepId matches the NextStep of the transition that
  //     produced the current vendorStatus (i.e. we have *arrived* at that step).
  //  2. Fall back to step[0] when vendorStatus is absent / unmatched
  //     (covers Draft / New / first-time creation).
  // ---------------------------------------------------------------------------
  const currentWorkflowStep = useMemo(() => {
    if (!workflowConfig) return null;
    const steps = workflowConfig.steps ?? [];
    if (!steps.length) return null;

    // If the editor has already resolved the current step from the workflow
    // instance table (ap_process_workflow_instances), use it directly.
    // This is the authoritative source when an instance_id exists.
    if (currentWorkflowStepId) {
      const matched = steps.find(s => s.stepId === currentWorkflowStepId);
      if (matched) return matched;
    }

    // No instance yet (new vendor / null instance_id) → initial step
    if (!vendorStatus) return steps[0];

    // Walk every step+transition to find which step we have landed on
    for (const step of steps) {
      for (const transition of (step.transitions ?? [])) {
        const du = transition.dataUpdates ?? {};
        // The transition fires and sets NextStep; we are now AT that next step
        if (du.status === vendorStatus && du.NextStep) {
          const targetStep = steps.find(s => s.stepId === du.NextStep);
          if (targetStep) return targetStep;
        }
      }
    }

    // Fallback: initial step
    return steps[0];
  }, [workflowConfig, vendorStatus, currentWorkflowStepId]);

  // ---------------------------------------------------------------------------
  // workflowCreateAllowed — true when the user's role appears in meta.permissions.create
  //   OR has at least one visible action on the current step.
  //   Falls back to true when workflowConfig is absent.
  //
  // workflowVisibleActions — Set of actionRef strings (e.g. "btn_submit",
  //   "btn_approve", "btn_reject") that the current user is allowed to trigger
  //   for the CURRENT workflow step (resolved above).
  //
  // isInitialStep — true when we are on the very first step (step[0]), which
  //   controls whether "Save Draft" and "Cancel" are shown.
  // ---------------------------------------------------------------------------
  const { workflowCreateAllowed, workflowVisibleActions, isInitialStep } = useMemo(() => {
    const fallback = { workflowCreateAllowed: true, workflowVisibleActions: new Set(), isInitialStep: true };
    if (!workflowConfig) return fallback;

    const userRole = user?.role;
    if (!userRole) return { workflowCreateAllowed: false, workflowVisibleActions: new Set(), isInitialStep: true };

    const createRoles = workflowConfig.meta?.permissions?.create ?? [];
    const step = currentWorkflowStep ?? workflowConfig.steps?.[0];
    const transitions = step?.transitions ?? [];

    // Collect every actionRef whose permissions.visible includes this user's role
    const visibleActions = new Set();
    transitions.forEach(t => {
      const visibleRoles = t.permissions?.visible ?? [];
      if (visibleRoles.includes(userRole)) {
        visibleActions.add(t.actionRef?.toLowerCase());
      }
    });

    const inCreate = createRoles.includes(userRole);
    const steps0Id = workflowConfig.steps?.[0]?.stepId;
    const onStep0 = !step || step.stepId === steps0Id;

    return {
      workflowCreateAllowed: inCreate || visibleActions.size > 0,
      workflowVisibleActions: visibleActions,
      isInitialStep: onStep0,
    };
  }, [workflowConfig, user, currentWorkflowStep, currentWorkflowStepId]);

  // Permission denied message for editing fields and buttons
  const editPermissionMessage = isReadonly
    ? "This invoice is in readonly mode."
    : !workflowCreateAllowed
      ? "You do not have the workflow role to perform this action."
      : "You do not have permission to edit this invoice.";

  // Use isReadonly to determine if the form should be editable
  // Also gate on workflowCreateAllowed when isCreating (new vendor scenario)
  const isFormEditable = !isReadonly && canEditInvoice && (isCreating ? workflowCreateAllowed : true);

  // Effect to handle file loading and type identification
  useEffect(() => {
    if (!fileUrl) {
      setIsLoading(false);
      setEffectiveFileType(null);
      // Reset image controls when no file
      resetImageControls();
      return;
    }

    const identifyAndLoadFile = async () => {
      setIsLoading(true);
      setTextContent(null);
      setTableData(null);
      setEffectiveFileType(null);
      // Reset image controls when loading new file
      resetImageControls();

      try {
        // Fetch file with proper authentication headers
        const response = await fetch(fileUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          setEffectiveFileType("error");
          setIsLoading(false);
          return;
        }

        const originalBlob = await response.blob();
        const fileName = invoicePath
          ? invoicePath.split("/").pop()
          : "document";
        const fileExtension = fileName.split(".").pop().toLowerCase();

        let identifiedType = "unsupported";

        const createObjectUrl = (blob, mimeType) => {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          const newUrl = URL.createObjectURL(
            new Blob([blob], { type: mimeType })
          );
          objectUrlRef.current = newUrl;
          setDisplayUrl(newUrl);
          return newUrl;
        };

        // Handle PDF files
        if (fileType === "pdf" || fileExtension === "pdf") {
          identifiedType = "pdf";
          createObjectUrl(originalBlob, "application/pdf");
        }
        // Handle image files
        else if (
          ["png", "jpg", "jpeg", "gif", "bmp", "webp"].includes(
            fileType || fileExtension
          )
        ) {
          identifiedType = "image";
          createObjectUrl(
            originalBlob,
            originalBlob.type || `image/${fileType || fileExtension}`
          );
        }
        // Handle JSON files
        else if ((fileType || fileExtension) === "json") {
          identifiedType = "json";
          const fileText = await originalBlob.text();
          try {
            const jsonData = JSON.parse(fileText);
            setTextContent(JSON.stringify(jsonData, null, 2));
          } catch (e) {
            setTextContent(fileText);
          }
        }
        // Handle text files
        else if ((fileType || fileExtension) === "txt") {
          identifiedType = "text";
          setTextContent(await originalBlob.text());
        }
        // Handle CSV files
        else if ((fileType || fileExtension) === "csv") {
          identifiedType = "csv";
          const fileText = await originalBlob.text();

          const parseCSV = (text) => {
            const rows = [];
            let inQuote = false;
            let currentCell = "";
            let currentRow = [];

            for (let i = 0; i < text.length; i++) {
              const char = text[i];
              const nextChar = text[i + 1];

              if (char === '"') {
                if (inQuote && nextChar === '"') {
                  currentCell += '"';
                  i++;
                } else {
                  inQuote = !inQuote;
                }
              } else if (char === "," && !inQuote) {
                currentRow.push(currentCell.trim());
                currentCell = "";
              } else if (char === "\n" && !inQuote) {
                if (text[i - 1] === "\r") {
                }
                currentRow.push(currentCell.trim());
                rows.push(currentRow);
                currentRow = [];
                currentCell = "";
              } else if (char === "\r" && !inQuote) {
              } else {
                currentCell += char;
              }
            }
            if (currentCell || currentRow.length > 0) {
              currentRow.push(currentCell.trim());
              rows.push(currentRow);
            }
            return rows.filter((row) => row.some((cell) => cell.length > 0));
          };
          setTableData(parseCSV(fileText));
        }
        // Handle Excel files
        else if (["xls", "xlsx"].includes(fileType || fileExtension)) {
          identifiedType = "excel";
          // For simplicity in this component, we'll treat Excel as unsupported for preview
          // In a full implementation, we would use a library like xlsx
        }
        // Handle Word documents
        else if (["doc", "docx"].includes(fileType || fileExtension)) {
          identifiedType = "word";
          // Word documents are not previewed in this component
        }

        // Fallback for binary detection
        if (identifiedType === "unsupported") {
          const headerBuffer = await originalBlob.slice(0, 8).arrayBuffer();
          const headerView = new Uint8Array(headerBuffer);
          const headerText = new TextDecoder("utf-8").decode(headerBuffer);

          if (headerText.startsWith("%PDF")) {
            identifiedType = "pdf";
            createObjectUrl(originalBlob, "application/pdf");
          } else if (
            headerView[0] === 0x89 &&
            headerView[1] === 0x50 &&
            headerView[2] === 0x4e &&
            headerView[3] === 0x47
          ) {
            identifiedType = "image";
            createObjectUrl(originalBlob, "image/png");
          } else if (headerView[0] === 0xff && headerView[1] === 0xd8) {
            identifiedType = "image";
            createObjectUrl(originalBlob, "image/jpeg");
          } else if (headerText.startsWith("GIF")) {
            identifiedType = "image";
            createObjectUrl(originalBlob, "image/gif");
          }
        }

        setEffectiveFileType(identifiedType);
        setIsLoading(false);
      } catch (error) {
        setEffectiveFileType("error");
        setIsLoading(false);
      }
    };

    identifyAndLoadFile();

    // Cleanup function
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      // Reset image controls on cleanup
      resetImageControls();
    };
  }, [fileUrl, fileType, invoicePath, token]);

  // --- UI-Specific Logic: Panel Resizing ---
  useLayoutEffect(() => {
    const formPanel = formContainerRef.current;
    if (!formPanel) return;
    const resizeObserver = new ResizeObserver(() => { }); // Logic can be added if needed
    resizeObserver.observe(formPanel);
    return () => resizeObserver.disconnect();
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current || !leftPanelRef.current) return;
      requestAnimationFrame(() => {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newLeftWidthPx = Math.max(
          300, // Minimum width for left panel
          // Maximum width is container width minus minimum width of right panel (450px)
          Math.min(e.clientX - containerRect.left, containerRect.width - 450)
        );
        leftPanelRef.current.style.width = `${newLeftWidthPx}px`;
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = ""; // Reset cursor
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = "col-resize"; // Set resize cursor
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  // --- End UI-Specific Logic ---

  // --- Auto-scroll to first invalid field ---
  useEffect(() => {
    if (firstInvalidField) {
      // Adding a small delay to ensure the DOM is fully updated
      const timer = setTimeout(() => {
        const invalidElement = document.getElementById(firstInvalidField);
        if (invalidElement) {
          // Enhanced smooth scrolling with additional options
          invalidElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });

          // Focus the element aftee a short delay to ensure scrolling completes
          setTimeout(() => {
            invalidElement.focus({ preventScroll: true });
          }, 300);
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [firstInvalidField]);

  // Image preview control functions
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.2, 3)); // Max zoom: 300%
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.2, 0.5)); // Min zoom: 50%
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const resetImageControls = () => {
    setZoomLevel(1);
    setRotation(0);
    setImagePosition({ x: 0, y: 0 });
  };

  // Handle double click to zoom in
  const handleImageDoubleClick = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3)); // Zoom in by 50%
  };

  // Handle mouse down for dragging
  const handleImageMouseDown = (e) => {
    if (zoomLevel > 1) {
      setIsDraggingImage(true);
      setDragStart({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y,
      });
      e.preventDefault();
    }
  };

  // Handle mouse move for dragging
  const handleImageMouseMove = useCallback(
    (e) => {
      if (isDraggingImage) {
        setImagePosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDraggingImage, dragStart]
  );

  // Handle mouse up for dragging
  const handleImageMouseUp = useCallback(() => {
    setIsDraggingImage(false);
  }, []);

  // Add event listeners for dragging
  useEffect(() => {
    if (isDraggingImage) {
      window.addEventListener("mousemove", handleImageMouseMove);
      window.addEventListener("mouseup", handleImageMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleImageMouseMove);
      window.removeEventListener("mouseup", handleImageMouseUp);
    };
  }, [isDraggingImage, handleImageMouseMove, handleImageMouseUp]);

  // A helper function to parse custom_values string
  const parseCustomValuesLocal = (customValuesString) => {
    if (!customValuesString) return [];
    try {
      const parsedJson = JSON.parse(customValuesString);
      if (Array.isArray(parsedJson)) {
        return parsedJson;
      }
    } catch (e) {
      // Not a JSON array, treat as comma-separated string
    }
    return customValuesString
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
  };

  // Helper function to validate dates for UI highlighting
  const isValidDateForUI = (dateString) => {
    if (typeof dateString !== "string" || !dateString.trim()) return true;

    // Try to parse various date formats
    let date;
    let expectedDay, expectedMonth, expectedYear;
    const trimmedValue = dateString.trim();

    // Handle various common date formats
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      // Already in YYYY-MM-DD format
      const [year, month, day] = trimmedValue.split("-").map(Number);
      expectedYear = year;
      expectedMonth = month - 1; // month is 0-indexed
      expectedDay = day;
      date = new Date(year, expectedMonth, expectedDay);
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(trimmedValue)) {
      // MM-DD-YYYY format
      const [month, day, year] = trimmedValue.split("-").map(Number);
      expectedYear = year;
      expectedMonth = month - 1;
      expectedDay = day;
      date = new Date(expectedYear, expectedMonth, expectedDay);
    } else if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(trimmedValue)) {
      // DD-MMM-YYYY format (e.g., 31-Dec-2025)
      const months = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
      };
      const [day, month, year] = trimmedValue.split("-");
      const monthIndex = months[month.toLowerCase().substring(0, 3)];
      if (monthIndex === undefined) return false;
      expectedYear = Number(year);
      expectedMonth = monthIndex;
      expectedDay = Number(day);
      date = new Date(expectedYear, expectedMonth, expectedDay);
    } else if (/^\d{2}-[A-Za-z]+-\d{4}$/.test(trimmedValue)) {
      // DD-MMMM-YYYY format (e.g., 31-December-2025)
      const months = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11,
      };
      const [day, month, year] = trimmedValue.split("-");
      const monthIndex = months[month.toLowerCase()];
      if (monthIndex === undefined) return false;
      expectedYear = Number(year);
      expectedMonth = monthIndex;
      expectedDay = Number(day);
      date = new Date(expectedYear, expectedMonth, expectedDay);
    } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmedValue)) {
      // YYYY/MM/DD format
      const [year, month, day] = trimmedValue.split("/").map(Number);
      expectedYear = year;
      expectedMonth = month - 1;
      expectedDay = day;
      date = new Date(expectedYear, expectedMonth, expectedDay);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmedValue)) {
      // MM/DD/YYYY or M/D/YYYY format
      const [month, day, year] = trimmedValue.split("/").map(Number);
      expectedYear = year;
      expectedMonth = month - 1;
      expectedDay = day;
      date = new Date(expectedYear, expectedMonth, expectedDay);
    } else {
      // Try to parse with the built-in Date constructor
      date = new Date(trimmedValue);
      // For this case, we can't easily validate, so we'll do a basic check
      if (isNaN(date.getTime())) {
        return false;
      }
      // Set to start of day for comparison
      date.setHours(0, 0, 0, 0);

      // Check if date is in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date > today) {
        return false;
      }

      // Format as YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return true;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return false;
    }

    // Critical validation: Check if the parsed date matches what the user intended
    // This catches invalid dates like Feb 31, Apr 31, etc.
    if (
      date.getFullYear() !== expectedYear ||
      date.getMonth() !== expectedMonth ||
      date.getDate() !== expectedDay
    ) {
      return false;
    }

    // Check if date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison

    // Set the parsed date to start of day for comparison
    date.setHours(0, 0, 0, 0);

    if (date > today) {
      // Future date not allowed
      return false;
    }

    return true;
  };

  // --- Reusable Rendering Functions ---
  const renderFormField = (fieldConfigItem) => {
    // Ensure fieldConfigItem has all required properties with defaults
    const {
      field_name = fieldConfigItem.name || "",
      field_type = fieldConfigItem.type || "text",
      is_required = fieldConfigItem.required || false,
      custom_values = fieldConfigItem.customValues ||
      fieldConfigItem.custom_values ||
      "",
      display_name = fieldConfigItem.displayName || fieldConfigItem.label || "",
      is_readonly = fieldConfigItem.is_readonly || false,
    } = fieldConfigItem;

    // Skip if field_name is empty or if it's an array type (handled separately)
    if (!field_name || field_type === "array") {
      return null;
    }

    if (field_type === "button") {
      return (
        <div key={field_name} className="flex items-center whitespace-nowrap flex-shrink-0">
          <ActionButton
            buttonConfig={fieldConfigItem}
            formData={formData}
            isEditable={isFormEditable && !isReadonly && !is_readonly}
            // This allows the button to update fields in the main form
            onUpdateField={(fieldName, newValue) => onFieldChange(fieldName, newValue)}
          />
        </div>
      );
    }

    let value = formData[field_name] ?? "";

    // For dropdown fields, check if the value exists in the options list
    // If not, set value to empty string to show default "Select an option"
    if (field_type === "dropdown" && custom_values) {
      const parsedOptions = parseCustomValues(custom_values);
      const dropdownOptions = parsedOptions.options || [];

      // If value is not in dropdown options, reset it to empty string
      if (value && !dropdownOptions.includes(value)) {
        value = "";
      }
    }

    // Modified logic: Check if field actually has error based on current value
    // For date fields, also check if the date is valid
    let hasError = !!errors[field_name];

    // Special handling for date fields to check if the date is valid
    if (field_type === "date" && value && String(value).trim() !== "") {
      // 1. Check backend/server-side validation
      if (errors[field_name]) {
        hasError = true;
      }

      // 2. Check UI validation (malformed / non-existent / future date)
      if (!isValidDateForUI(value)) {
        hasError = true;
      }
    }

    const disabled = !isFormEditable || is_readonly;

    // Check if field has custom_values format (Drop(...), Radio(...), Check(...), MasterKey(...))
    const hasCustomValues =
      custom_values &&
      (custom_values.startsWith("Drop(") ||
        custom_values.startsWith("Radio(") ||
        custom_values.startsWith("Check(") ||
        custom_values.startsWith("MasterKey("));

    // Check if value length is greater than 15 and no custom values
    const shouldShowPopup =
      value && String(value).length > 15 && !hasCustomValues;

    // --- Input Styles matching InvoiceFormUI ---
    const baseClasses =
      "w-full px-2 py-1 border border-gray-200 rounded-md text-[11px] font-normal text-gray-800 bg-white transition-all duration-200 ease-in-out focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";
    const errorClasses = hasError
      ? "border-red-400 bg-red-50 ring-red-100 ring-1"
      : "";

    const renderInput = () => {
      // Check if field has custom_values format (Drop(...), Radio(...), Check(...), MasterKey(...))
      if (hasCustomValues) {
        // Check if it's a MasterKey type - this should take precedence
        const parsedCustomValues = parseCustomValues(custom_values);
        if (parsedCustomValues.type === "MasterKey") {
          return (
            <div className="relative flex items-center w-full">
              <Tooltip content={value}>
                <input
                  type="text"
                  id={field_name}
                  name={field_name}
                  value={value}
                  className={`w-full text-xs font-medium px-2 py-1 border rounded-md text-gray-800 shadow-sm transition-all duration-300 ease-in-out focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"
                    } ${errorClasses} ${isReadonly ? "pr-2" : "pr-8"}`}
                  readOnly={true}
                  onClick={(e) => {
                    e.preventDefault();
                    // Only open popup if not in readonly mode AND clicking directly on icon
                    if (!isReadonly) {
                      // We'll handle this via the button only
                    }
                  }}
                  disabled={disabled}
                />
              </Tooltip>
              {!isReadonly && (
                <button
                  className="absolute right-2 text-gray-700 text-xs hover:text-indigo-600 transition-colors no-tooltip"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Only open popup if not in readonly mode
                    if (!isReadonly) {
                      // Open master key search popup
                      setMasterKeyPopupField(field_name);
                      setMasterKeyFieldConfig({
                        fieldName: field_name,
                        uniqueKey: parsedCustomValues.options[0] || "abcd",
                      });
                      setMasterKeyPopupOpen(true);
                    }
                  }}
                  title="Search Master Key Values"
                  disabled={disabled || isReadonly}
                >
                  <Search size={12} />
                </button>
              )}
            </div>
          );
        }

        // Use the custom values parser to render the appropriate input for other types
        return renderCustomValueField(
          { field_name, field_type, is_required, custom_values, display_name },
          value,
          (newValue) => onFieldChange(field_name, newValue),
          disabled, // Use disabled instead of !isFormEditable
          field_name,
          hasError
        );
      }

      // For fields that should show popup, render a special input that opens popup when clicked
      // But don't show popup for MasterKey fields (they have their own search functionality)
      // Also prevent popup in readonly mode
      if (shouldShowPopup && !isReadonly) {
        return (
          <ExpandablePopup
            content={value}
            isEditable={isFormEditable && !is_readonly}
            onChange={(newValue) => onFieldChange(field_name, newValue)}
            disabled={disabled}
            displayName={display_name || toTitleCase(field_name)}
          >
            {({ onExpand }) => (
              <div className="relative flex items-center w-full">
                <Tooltip content={value}>
                  <input
                    type="text"
                    id={field_name}
                    name={field_name}
                    value={value}
                    className={`w-full text-xs font-medium px-2 py-1 border rounded-md text-gray-800 shadow-sm transition-all duration-300 ease-in-out focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"
                      } ${errorClasses} pr-8`}
                    readOnly={true}
                    disabled={disabled}
                    onClick={onExpand}
                  />
                </Tooltip>
                <button
                  className="absolute right-2 text-gray-700 text-xs rounded hover:text-indigo-600 transition-colors no-tooltip"
                  onClick={onExpand}
                  title="Expand/Edit"
                  disabled={disabled}
                  type="button"
                >
                  <SquareArrowOutUpRight size={12} />
                </button>
              </div>
            )}
          </ExpandablePopup>
        );
      }

      switch (field_type) {
        case "button":
          return null;
        case "dropdown":
          const parsedOptions = parseCustomValues(custom_values);
          const dropdownOptions = parsedOptions.options || [];
          // Check if the value exists in the dropdown options
          // If not, reset it to empty string to show default "Select an option"
          const displayValue = dropdownOptions.includes(value) ? value : "";
          return (
            <select
              id={field_name}
              name={field_name}
              value={displayValue}
              onChange={(e) => onFieldChange(field_name, e.target.value)}
              className={`${is_readonly ? "bg-gray-100" : "bg-white"
                } ${baseClasses} ${errorClasses}`}
              disabled={disabled}
            >
              <option value="">Select an option</option>
              {dropdownOptions.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
          );
        case "radio":
          const parsedRadioOptions = parseCustomValues(custom_values);
          const radioOptions = parsedRadioOptions.options || [];
          return (
            <div className="flex flex-col gap-1">
              {radioOptions.map((option, index) => (
                <label
                  key={index}
                  className="inline-flex items-center text-sm font-medium text-gray-800"
                >
                  <input
                    type="radio"
                    name={field_name}
                    value={option}
                    checked={value === option}
                    onChange={(e) => onFieldChange(field_name, e.target.value)}
                    className={`form-radio text-indigo-600 h-4 w-4 mr-2 border-gray-300 focus:ring-indigo-500 ${is_readonly ? "bg-gray-100" : "bg-white"
                      }`} // Kept h-4 w-4 for good touch target
                    disabled={disabled}
                  />
                  {option}
                </label>
              ))}
            </div>
          );
        case "boolean":
        case "checkbox":
          return (
            <input
              type="checkbox"
              id={field_name}
              name={field_name}
              checked={!!value}
              onChange={(e) => onFieldChange(field_name, e.target.checked)}
              className={`form-checkbox text-indigo-600 h-5 w-5 rounded-md border-gray-300 focus:ring-indigo-500 disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"
                } ${errorClasses}`} // Kept h-5 w-5 for good touch target
              disabled={disabled}
            />
          );
        case "number":
          return (
            <input
              type="number"
              id={field_name}
              name={field_name}
              value={value}
              onChange={(e) => onFieldChange(field_name, e.target.value)}
              className={`${is_readonly ? "bg-gray-100" : "bg-white"
                } ${baseClasses} ${errorClasses}`}
              disabled={disabled}
            />
          );
        case "date":
          // Get today's date in YYYY-MM-DD format for max attribute
          const today = new Date();
          const maxDate = `${today.getFullYear()}-${String(
            today.getMonth() + 1
          ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

          return (
            <input
              type="date"
              id={field_name}
              name={field_name}
              value={value}
              onChange={(e) => onFieldChange(field_name, e.target.value)}
              className={`${is_readonly ? "bg-gray-100" : "bg-white"
                } ${baseClasses} ${errorClasses}`}
              disabled={disabled}
              max={maxDate}
            />
          );
        default:
          return (
            <Tooltip content={value}>
              <input
                type="text"
                id={field_name}
                name={field_name}
                value={value}
                onChange={(e) => onFieldChange(field_name, e.target.value)}
                className={` ${is_readonly ? "bg-gray-100" : "bg-white"
                  } ${baseClasses} ${errorClasses}`}
                disabled={disabled}
              />
            </Tooltip>
          );
      }
    };

    return (
      <div key={field_name} id={field_name} className={`flex flex-col min-w-0`}>
        <label
          htmlFor={field_name}
          className="block text-[11px] font-normal text-gray-500 mb-1"
        >
          {display_name || field_name}{" "}
          {is_required && <span className="text-red-400">*</span>}
        </label>
        <div className="flex">{renderInput()}</div>
        {hasError && (
          <div className="mt-0.5 text-[10px] font-normal text-red-500">
            {errors[field_name]}
          </div>
        )}
      </div>
    );
  };

  // --- Render Tab Child Field (accesses data from tab array) ---
  // const renderTabField = (fieldConfigItem, tabName, rowIndex = 0) => {
  //   const {
  //     field_name = fieldConfigItem.name || "",
  //     field_type = fieldConfigItem.type || "text",
  //     is_required = fieldConfigItem.required || false,
  //     custom_values = fieldConfigItem.customValues ||
  //     fieldConfigItem.custom_values ||
  //     "",
  //     display_name = fieldConfigItem.displayName || fieldConfigItem.label || "",
  //     is_readonly = fieldConfigItem.is_readonly || false,
  //   } = fieldConfigItem;

  //   if (!field_name) {
  //     return null;
  //   }

  //   // Access data from tab array: formData[tabName][rowIndex][field_name]
  //   const tabData = formData[tabName] || [];
  //   const rowData = tabData[rowIndex] || {};
  //   let value = rowData[field_name] ?? "";

  //   // For dropdown fields, check if the value exists in the options list
  //   if (field_type === "dropdown" && custom_values) {
  //     const parsedOptions = parseCustomValues(custom_values);
  //     const dropdownOptions = parsedOptions.options || [];
  //     if (value && !dropdownOptions.includes(value)) {
  //       value = "";
  //     }
  //   }

  //   let hasError = !!errors[field_name];

  //   if (field_type === "date" && value && String(value).trim() !== "") {
  //     if (errors[field_name]) {
  //       hasError = true;
  //     }
  //     if (!isValidDateForUI(value)) {
  //       hasError = true;
  //     }
  //   }

  //   const disabled = !isFormEditable || is_readonly;

  //   const hasCustomValues =
  //     custom_values &&
  //     (custom_values.startsWith("Drop(") ||
  //       custom_values.startsWith("Radio(") ||
  //       custom_values.startsWith("Check(") ||
  //       custom_values.startsWith("MasterKey("));

  //   const shouldShowPopup =
  //     value && String(value).length > 15 && !hasCustomValues;

  //   const baseClasses =
  //     "w-full px-2 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-800 bg-white shadow-sm transition-all duration-300 ease-in-out focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed";
  //   const errorClasses = hasError
  //     ? "border-red-500 bg-red-50 ring-red-100 ring-2"
  //     : "";

  //   // Modified onChange handler to update tab array data
  //   const handleTabFieldChange = (newValue) => {
  //     // Update the specific field in the tab array
  //     const updatedTabData = [...tabData];
  //     if (!updatedTabData[rowIndex]) {
  //       updatedTabData[rowIndex] = {};
  //     }
  //     updatedTabData[rowIndex] = {
  //       ...updatedTabData[rowIndex],
  //       [field_name]: newValue
  //     };

  //     // Update formData with the modified tab array
  //     onFieldChange(tabName, updatedTabData);
  //   };

  //   const renderInput = () => {
  //     if (hasCustomValues) {
  //       const parsedCustomValues = parseCustomValues(custom_values);
  //       if (parsedCustomValues.type === "MasterKey") {
  //         return (
  //           <div className="relative flex items-center w-full">
  //             <Tooltip content={value}>
  //               <input
  //                 type="text"
  //                 id={field_name}
  //                 name={field_name}
  //                 value={value}
  //                 className={`w-full text-xs font-medium px-2 py-1 border rounded-md text-gray-800 shadow-sm transition-all duration-300 ease-in-out focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"
  //                   } ${errorClasses} ${isReadonly ? "pr-2" : "pr-8"}`}
  //                 readOnly={true}
  //                 onClick={(e) => {
  //                   e.preventDefault();
  //                 }}
  //                 disabled={disabled}
  //               />
  //             </Tooltip>
  //             {!isReadonly && (
  //               <button
  //                 className="absolute right-2 text-gray-700 text-xs hover:text-indigo-600 transition-colors no-tooltip"
  //                 onClick={(e) => {
  //                   e.preventDefault();
  //                   e.stopPropagation();
  //                   if (!isReadonly) {
  //                     setMasterKeyPopupField(field_name);
  //                     setMasterKeyFieldConfig({
  //                       fieldName: field_name,
  //                       uniqueKey: parsedCustomValues.options[0] || "abcd",
  //                     });
  //                     setMasterKeyPopupOpen(true);
  //                   }
  //                 }}
  //                 title="Search Master Key Values"
  //                 disabled={disabled || isReadonly}
  //               >
  //                 <Search size={12} />
  //               </button>
  //             )}
  //           </div>
  //         );
  //       }

  //       return renderCustomValueField(
  //         { field_name, field_type, is_required, custom_values, display_name },
  //         value,
  //         handleTabFieldChange,
  //         disabled,
  //         field_name,
  //         hasError
  //       );
  //     }

  //     if (shouldShowPopup && !isReadonly) {
  //       return (
  //         <ExpandablePopup
  //           content={value}
  //           isEditable={isFormEditable && !is_readonly}
  //           onChange={handleTabFieldChange}
  //           disabled={disabled}
  //           displayName={display_name || toTitleCase(field_name)}
  //         >
  //           {({ onExpand }) => (
  //             <div className="relative flex items-center w-full">
  //               <Tooltip content={value}>
  //                 <input
  //                   type="text"
  //                   id={field_name}
  //                   name={field_name}
  //                   value={value}
  //                   className={`w-full text-xs font-medium px-2 py-1 border rounded-md text-gray-800 shadow-sm transition-all duration-300 ease-in-out focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"
  //                     } ${errorClasses} pr-8`}
  //                   readOnly={true}
  //                   disabled={disabled}
  //                   onClick={onExpand}
  //                 />
  //               </Tooltip>
  //               <button
  //                 className="absolute right-2 text-gray-700 text-xs rounded hover:text-indigo-600 transition-colors no-tooltip"
  //                 onClick={onExpand}
  //                 title="Expand/Edit"
  //                 disabled={disabled}
  //                 type="button"
  //               >
  //                 <SquareArrowOutUpRight size={12} />
  //               </button>
  //             </div>
  //           )}
  //         </ExpandablePopup>
  //       );
  //     }

  //     switch (field_type) {
  //       case "dropdown":
  //         const parsedOptions = parseCustomValues(custom_values);
  //         const dropdownOptions = parsedOptions.options || [];
  //         const displayValue = dropdownOptions.includes(value) ? value : "";
  //         return (
  //           <select
  //             id={field_name}
  //             name={field_name}
  //             value={displayValue}
  //             onChange={(e) => handleTabFieldChange(e.target.value)}
  //             className={`${is_readonly ? "bg-gray-100" : "bg-white"
  //               } ${baseClasses} ${errorClasses}`}
  //             disabled={disabled}
  //           >
  //             <option value="">Select an option</option>
  //             {dropdownOptions.map((option, index) => (
  //               <option key={index} value={option}>
  //                 {option}
  //               </option>
  //             ))}
  //           </select>
  //         );
  //       case "radio":
  //         const parsedRadioOptions = parseCustomValues(custom_values);
  //         const radioOptions = parsedRadioOptions.options || [];
  //         return (
  //           <div className="flex flex-col gap-1">
  //             {radioOptions.map((option, index) => (
  //               <label
  //                 key={index}
  //                 className="inline-flex items-center text-sm font-medium text-gray-800"
  //               >
  //                 <input
  //                   type="radio"
  //                   name={field_name}
  //                   value={option}
  //                   checked={value === option}
  //                   onChange={(e) => handleTabFieldChange(e.target.value)}
  //                   className={`form-radio text-indigo-600 h-4 w-4 mr-2 border-gray-300 focus:ring-indigo-500 ${is_readonly ? "bg-gray-100" : "bg-white"
  //                     }`}
  //                   disabled={disabled}
  //                 />
  //                 {option}
  //               </label>
  //             ))}
  //           </div>
  //         );
  //       case "boolean":
  //       case "checkbox":
  //         return (
  //           <input
  //             type="checkbox"
  //             id={field_name}
  //             name={field_name}
  //             checked={!!value}
  //             onChange={(e) => handleTabFieldChange(e.target.checked)}
  //             className={`form-checkbox text-indigo-600 h-5 w-5 rounded-md border-gray-300 focus:ring-indigo-500 disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"
  //               } ${errorClasses}`}
  //             disabled={disabled}
  //           />
  //         );
  //       case "number":
  //         return (
  //           <input
  //             type="number"
  //             id={field_name}
  //             name={field_name}
  //             value={value}
  //             onChange={(e) => handleTabFieldChange(e.target.value)}
  //             className={`${is_readonly ? "bg-gray-100" : "bg-white"
  //               } ${baseClasses} ${errorClasses}`}
  //             disabled={disabled}
  //           />
  //         );
  //       case "date":
  //         const today = new Date();
  //         const maxDate = `${today.getFullYear()}-${String(
  //           today.getMonth() + 1
  //         ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  //         return (
  //           <input
  //             type="date"
  //             id={field_name}
  //             name={field_name}
  //             value={value}
  //             onChange={(e) => handleTabFieldChange(e.target.value)}
  //             className={`${is_readonly ? "bg-gray-100" : "bg-white"
  //               } ${baseClasses} ${errorClasses}`}
  //             disabled={disabled}
  //             max={maxDate}
  //           />
  //         );
  //       default:
  //         return (
  //           <Tooltip content={value}>
  //             <input
  //               type="text"
  //               id={field_name}
  //               name={field_name}
  //               value={value}
  //               onChange={(e) => handleTabFieldChange(e.target.value)}
  //               className={` ${is_readonly ? "bg-gray-100" : "bg-white"
  //                 } ${baseClasses} ${errorClasses}`}
  //               disabled={disabled}
  //             />
  //           </Tooltip>
  //         );
  //     }
  //   };

  //   return (
  //     <div key={field_name} id={field_name} className={`flex flex-col min-w-0`}>
  //       <label
  //         htmlFor={field_name}
  //         className="block text-xs font-semibold text-gray-700 mb-1"
  //       >
  //         {display_name || field_name}{" "}
  //         {is_required && <span className="text-red-600">*</span>}
  //       </label>
  //       <div className="flex">{renderInput()}</div>
  //       {hasError && (
  //         <div className="mt-1 text-[10px] font-medium text-red-600">
  //           {errors[field_name]}
  //         </div>
  //       )}
  //     </div>
  //   );
  // };


  // --- Render Tab Child Field (accesses data from tab array OR object) ---
  const renderTabField = (fieldConfigItem, tabName, rowIndex = 0) => {
    const {
      field_name = fieldConfigItem.name || "",
      field_type = fieldConfigItem.type || "text",
      is_required = fieldConfigItem.required || false,
      custom_values = fieldConfigItem.customValues ||
      fieldConfigItem.custom_values ||
      "",
      display_name = fieldConfigItem.displayName || fieldConfigItem.label || "",
      is_readonly = fieldConfigItem.is_readonly || false,
    } = fieldConfigItem;

    if (!field_name || field_type === "array") {
      return null;
    }

    // // Skip if field_name is empty or if it's an array/button type (handled separately)
    // if (!field_name || field_type === "array" || field_type === "button") {
    //   return null;
    // }

    // --- NEW LOGIC FOR TAB-SPECIFIC BUTTONS ---
    if (field_type === "button") {
      const metaConfig = fieldConfigItem.meta_config?.value
        ? JSON.parse(fieldConfigItem.meta_config.value)
        : {};

      // Do not render if explicitly set to hidden in API response
      if (metaConfig.visible === 'false' || metaConfig.visible === false) return null;

      return (
        <div key={field_name} className="flex items-center whitespace-nowrap flex-shrink-0">
          <ActionButton
            buttonConfig={fieldConfigItem}
            formData={formData}
            isEditable={isFormEditable && !isReadonly && !is_readonly}
            // This allows the button to update fields in the main form
            onUpdateField={(fieldName, newValue) => onFieldChange(fieldName, newValue)}
            className="w-full"
          />
        </div>
      );
    }

    // --- Determine the correct data source for this tab's fields ---
    // A nested child tab (e.g. Organization inside PO_Number) stores its data
    // inside the parent tab row: formData[grandParent][grandParentRowIndex][tabName]
    // rather than at the top-level formData[tabName].
    const tabFieldConfig = fieldConfig ? fieldConfig.find(f => f.field_name === tabName) : null;
    const grandParentName = tabFieldConfig?.parent || '';
    const grandParentConfig = grandParentName
      ? (fieldConfig ? fieldConfig.find(f => f.field_name === grandParentName) : null)
      : null;
    const isNestedChildTab = grandParentConfig?.field_type === 'tab';

    let tabData;
    if (isNestedChildTab) {
      // Pull the nested array from inside the grandParent row
      const grandParentArray = formData[grandParentName] || [];
      const grandParentRow = grandParentArray[0] || {};   // row index 0
      tabData = grandParentRow[tabName];
    } else {
      tabData = formData[tabName];
    }

    let value = "";
    if (Array.isArray(tabData)) {
      // Array structure: tabData[rowIndex][field_name]
      const rowData = tabData[rowIndex] || {};
      value = rowData[field_name] ?? "";
    } else if (tabData && typeof tabData === 'object') {
      // Object structure: tabData[field_name]
      value = tabData[field_name] ?? "";
    }

    // Fallback: Check top-level value if not found in tabData
    if (!value && formData[field_name]) {
      value = formData[field_name];
    }

    // For dropdown fields, check if the value exists in the options list
    if (field_type === "dropdown" && custom_values) {
      const parsedOptions = parseCustomValues(custom_values);
      const dropdownOptions = parsedOptions.options || [];
      if (value && !dropdownOptions.includes(value)) {
        value = "";
      }
    }

    // Check for errors: supports nested child tabs, flat array tabs, object tabs, and top-level
    let hasError = false;
    let errorMessage = "";

    // For nested child tabs, use the tabName key directly in errors
    const effectiveTabName = isNestedChildTab ? tabName : tabName;

    if (Array.isArray(tabData)) {
      // Array structure: errors[effectiveTabName][rowIndex][field_name]
      if (errors[effectiveTabName] && Array.isArray(errors[effectiveTabName]) && errors[effectiveTabName][rowIndex]) {
        hasError = !!errors[effectiveTabName][rowIndex][field_name];
        errorMessage = errors[effectiveTabName][rowIndex][field_name] || "";
      }
    } else if (tabData && typeof tabData === 'object') {
      // Object structure: errors[effectiveTabName][field_name]
      if (errors[effectiveTabName] && typeof errors[effectiveTabName] === 'object') {
        hasError = !!errors[effectiveTabName][field_name];
        errorMessage = errors[effectiveTabName][field_name] || "";
      }
    }

    // Fallback: Check top-level error
    if (!hasError && errors[field_name]) {
      hasError = true;
      errorMessage = errors[field_name];
    }


    if (field_type === "date" && value && String(value).trim() !== "") {
      if (hasError) {
        // Keep the error
      } else if (!isValidDateForUI(value)) {
        hasError = true;
      }
    }

    // A field is disabled if the form is not editable, the field itself is readonly,
    // or its parent tab (root or nested) is marked readonly in meta config.
    const parentTabField = fieldConfig ? fieldConfig.find(f => f.field_type === 'tab' && f.field_name === tabName) : null;
    const isParentTabReadonly = parentTabField?.is_readonly ?? false;
    const disabled = !isFormEditable || is_readonly || isParentTabReadonly;

    const hasCustomValues =
      custom_values &&
      (custom_values.startsWith("Drop(") ||
        custom_values.startsWith("Radio(") ||
        custom_values.startsWith("Check(") ||
        custom_values.startsWith("MasterKey("));

    const shouldShowPopup =
      value && String(value).length > 15 && !hasCustomValues;

    const baseClasses =
      "w-full px-2 py-1 border border-gray-200 rounded-md text-[11px] font-normal text-gray-800 bg-white transition-all duration-200 ease-in-out focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";
    const errorClasses = hasError
      ? "border-red-400 bg-red-50 ring-red-100 ring-1"
      : "";

    // UPDATED: onChange handler — writes into the correct nested or flat structure
    const handleTabFieldChange = (newValue) => {
      if (isNestedChildTab) {
        // Write back into: formData[grandParentName][0][tabName][rowIndex][field_name]
        const grandParentArray = [...(formData[grandParentName] || [{}])];
        const gpi = 0; // grandParent row index (row 0)
        const grandParentRow = { ...(grandParentArray[gpi] || {}) };
        const nestedTabData = Array.isArray(grandParentRow[tabName])
          ? [...grandParentRow[tabName]]
          : [];

        if (!nestedTabData[rowIndex]) nestedTabData[rowIndex] = {};
        nestedTabData[rowIndex] = { ...nestedTabData[rowIndex], [field_name]: newValue };
        grandParentRow[tabName] = nestedTabData;
        grandParentArray[gpi] = grandParentRow;

        // Update grandParent in formData — the nested child update is carried inside
        // Do NOT mirror at top-level; that causes duplicate keys in formData
        onFieldChange(grandParentName, grandParentArray);

        // Clear errors for this nested child field.
        // Errors are stored at top-level by field_name (set by validateForm).
        if (hasError) {
          setErrors(prevErrors => {
            if (!prevErrors[field_name]) return prevErrors;
            const newErrors = { ...prevErrors };
            delete newErrors[field_name];
            return newErrors;
          });
        }

        return;
      }

      // --- Original flat path (non-nested tabs) ---
      const currentTabData = formData[tabName];

      if (Array.isArray(currentTabData)) {
        const updatedTabData = [...currentTabData];
        if (!updatedTabData[rowIndex]) updatedTabData[rowIndex] = {};
        updatedTabData[rowIndex] = { ...updatedTabData[rowIndex], [field_name]: newValue };
        // Update only the tab array — do NOT mirror field at top-level (avoids duplicate keys)
        onFieldChange(tabName, updatedTabData);
      } else if (currentTabData && typeof currentTabData === 'object') {
        const updatedTabData = { ...currentTabData, [field_name]: newValue };
        onFieldChange(tabName, updatedTabData);
      } else {
        onFieldChange(tabName, [{ [field_name]: newValue }]);
      }

      // Clear errors for this field immediately after change
      if (hasError) {
        setErrors(prevErrors => {
          const newErrors = { ...prevErrors };
          let errorRemoved = false;

          // 1. Remove top-level flat error
          if (newErrors[field_name]) {
            delete newErrors[field_name];
            errorRemoved = true;
          }

          // 2. Remove error from the resolved tabData structure (handles both nested & flat)
          if (Array.isArray(tabData)) {
            if (newErrors[tabName] && Array.isArray(newErrors[tabName]) && newErrors[tabName][rowIndex]) {
              const updatedRowErrors = { ...newErrors[tabName][rowIndex] };
              delete updatedRowErrors[field_name];
              newErrors[tabName][rowIndex] = updatedRowErrors;
              errorRemoved = true;
            }
          } else if (newErrors[tabName] && typeof newErrors[tabName] === 'object') {
            const updatedTabErrors = { ...newErrors[tabName] };
            if (updatedTabErrors[field_name]) {
              delete updatedTabErrors[field_name];
              newErrors[tabName] = updatedTabErrors;
              errorRemoved = true;
            }
          }

          return errorRemoved ? newErrors : prevErrors;
        });
      }
    };

    const renderInput = () => {
      if (hasCustomValues) {
        const parsedCustomValues = parseCustomValues(custom_values);
        if (parsedCustomValues.type === "MasterKey") {
          return (
            <div className="relative flex items-center w-full">
              <Tooltip content={value}>
                <input
                  type="text"
                  id={field_name}
                  name={field_name}
                  value={value}
                  className={`w-full text-xs font-medium px-2 py-1 border rounded-md text-gray-800 shadow-sm transition-all duration-300 ease-in-out focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"
                    } ${errorClasses} ${isReadonly ? "pr-2" : "pr-8"}`}
                  readOnly={true}
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                  disabled={disabled}
                />
              </Tooltip>
              {!isReadonly && (
                <button
                  className="absolute right-2 text-gray-700 text-xs hover:text-indigo-600 transition-colors no-tooltip"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isReadonly) {
                      setMasterKeyPopupField(field_name);
                      setMasterKeyFieldConfig({
                        fieldName: field_name,
                        uniqueKey: parsedCustomValues.options[0] || "abcd",
                      });
                      setMasterKeyPopupOpen(true);
                    }
                  }}
                  title="Search Master Key Values"
                  disabled={disabled || isReadonly}
                >
                  <Search size={12} />
                </button>
              )}
            </div>
          );
        }

        return renderCustomValueField(
          { field_name, field_type, is_required, custom_values, display_name },
          value,
          handleTabFieldChange,
          disabled,
          field_name,
          hasError
        );
      }

      if (shouldShowPopup && !isReadonly) {
        return (
          <ExpandablePopup
            content={value}
            isEditable={isFormEditable && !is_readonly}
            onChange={handleTabFieldChange}
            disabled={disabled}
            displayName={display_name || toTitleCase(field_name)}
          >
            {({ onExpand }) => (
              <div className="relative flex items-center w-full">
                <Tooltip content={value}>
                  <input
                    type="text"
                    id={field_name}
                    name={field_name}
                    value={value}
                    className={`w-full text-xs font-medium px-2 py-1 border rounded-md text-gray-800 shadow-sm transition-all duration-300 ease-in-out focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"
                      } ${errorClasses} pr-8`}
                    readOnly={true}
                    disabled={disabled}
                    onClick={onExpand}
                  />
                </Tooltip>
                <button
                  className="absolute right-2 text-gray-700 text-xs rounded hover:text-indigo-600 transition-colors no-tooltip"
                  onClick={onExpand}
                  title="Expand/Edit"
                  disabled={disabled}
                  type="button"
                >
                  <SquareArrowOutUpRight size={12} />
                </button>
              </div>
            )}
          </ExpandablePopup>
        );
      }

      switch (field_type) {
        case "button":
          return null;
        case "dropdown":
          const parsedOptions = parseCustomValues(custom_values);
          const dropdownOptions = parsedOptions.options || [];
          const displayValue = dropdownOptions.includes(value) ? value : "";
          return (
            <select
              id={field_name}
              name={field_name}
              value={displayValue}
              onChange={(e) => handleTabFieldChange(e.target.value)}
              className={`${is_readonly ? "bg-gray-100" : "bg-white"
                } ${baseClasses} ${errorClasses}`}
              disabled={disabled}
            >
              <option value="">Select an option</option>
              {dropdownOptions.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
          );
        case "radio":
          const parsedRadioOptions = parseCustomValues(custom_values);
          const radioOptions = parsedRadioOptions.options || [];
          return (
            <div className="flex flex-col gap-1">
              {radioOptions.map((option, index) => (
                <label
                  key={index}
                  className="inline-flex items-center text-sm font-medium text-gray-800"
                >
                  <input
                    type="radio"
                    name={field_name}
                    value={option}
                    checked={value === option}
                    onChange={(e) => handleTabFieldChange(e.target.value)}
                    className={`form-radio text-indigo-600 h-4 w-4 mr-2 border-gray-300 focus:ring-indigo-500 ${is_readonly ? "bg-gray-100" : "bg-white"
                      }`}
                    disabled={disabled}
                  />
                  {option}
                </label>
              ))}
            </div>
          );
        case "boolean":
        case "checkbox":
          return (
            <input
              type="checkbox"
              id={field_name}
              name={field_name}
              checked={!!value}
              onChange={(e) => handleTabFieldChange(e.target.checked)}
              className={`form-checkbox text-indigo-600 h-5 w-5 rounded-md border-gray-300 focus:ring-indigo-500 disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"
                } ${errorClasses}`}
              disabled={disabled}
            />
          );
        case "number":
          return (
            <input
              type="number"
              id={field_name}
              name={field_name}
              value={value}
              onChange={(e) => handleTabFieldChange(e.target.value)}
              className={`${is_readonly ? "bg-gray-100" : "bg-white"
                } ${baseClasses} ${errorClasses}`}
              disabled={disabled}
            />
          );
        case "date":
          const today = new Date();
          const maxDate = `${today.getFullYear()}-${String(
            today.getMonth() + 1
          ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

          return (
            <input
              type="date"
              id={field_name}
              name={field_name}
              value={value}
              onChange={(e) => handleTabFieldChange(e.target.value)}
              className={`${is_readonly ? "bg-gray-100" : "bg-white"
                } ${baseClasses} ${errorClasses}`}
              disabled={disabled}
              max={maxDate}
            />
          );
        default:
          return (
            <Tooltip content={value}>
              <input
                type="text"
                id={field_name}
                name={field_name}
                value={value}
                onChange={(e) => handleTabFieldChange(e.target.value)}
                className={` ${is_readonly ? "bg-gray-100" : "bg-white"
                  } ${baseClasses} ${errorClasses}`}
                disabled={disabled}
              />
            </Tooltip>
          );
      }
    };

    // UPDATED: Use ID that works for both structures
    const fieldId = Array.isArray(formData[tabName])
      ? `tab-${tabName}-${rowIndex}-${field_name}`
      : `tab-${tabName}-${field_name}`;

    return (
      <div key={field_name} id={fieldId} className={`flex flex-col min-w-0`}>
        <label
          htmlFor={field_name}
          className="block text-[11px] font-normal text-gray-500 mb-1"
        >
          {display_name || field_name}{" "}
          {is_required && <span className="text-red-400">*</span>}
        </label>
        <div className="flex">{renderInput()}</div>
        {hasError && errorMessage && (
          <div className="mt-0.5 text-[10px] font-normal text-red-500">
            {errorMessage}
          </div>
        )}
      </div>
    );
  };

  const renderLineItemsTable = (parentId = 'lineItems') => {
    // Resolve data: if parentId is a nested child tab (its parent is also a tab),
    // the array lives inside formData[grandParent][0][parentId] rather than top-level.
    const parentFieldCfg = fieldConfig ? fieldConfig.find(f => f.field_name === parentId) : null;
    const gParentName = parentFieldCfg?.parent || '';
    const gParentFieldCfg = gParentName
      ? (fieldConfig ? fieldConfig.find(f => f.field_name === gParentName) : null)
      : null;
    const isNestedArray = gParentFieldCfg?.field_type === 'tab';

    let data;
    if (isNestedArray) {
      const gParentArr = formData[gParentName] || [];
      const gParentRow = gParentArr[0] || {};
      data = gParentRow[parentId] || [];
    } else {
      data = formData[parentId] || [];
    }

    // Filter columns for this specific parent array
    const tableColumns = fieldConfig
      .filter((f) => f.parent === parentId && (f.is_visible ?? true))
      .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999))
      .map((f) => {
        const prop = lineItemColumnProperties[f.field_name] || {};
        const isDescription = f.field_name.toLowerCase() === "description";

        return {
          key: f.field_name,
          header: f.display_name || toTitleCase(f.field_name),
          type: f.field_type || "text",
          custom_values: f.custom_values,
          width: isDescription ? "150px" : "auto",
          isRequired: f.is_required ?? false,
          isFieldReadonly: f.is_readonly || false
        };
      });

    // If no columns found for this parent, don't render anything
    if (tableColumns.length === 0) return null;

    return (
      <div>
        <ScrollableTable
          data={data}
          columns={tableColumns}
          onLineItemChange={(index, field, val) =>
            onLineItemChange(index, field, val, parentId)
          }
          onLineItemDelete={(index) => onLineItemDelete(index, parentId)}
          canEditInvoice={isFormEditable && !(parentFieldCfg?.is_readonly ?? false)}
          errors={errors}
          openCardPopup={(title, content, isEditable, itemId, field, contentType) =>
            openCardPopup(title, content, isEditable, itemId, field, contentType, parentId)
          }
          firstInvalidField={firstInvalidField}
          setMasterKeyPopupOpen={setMasterKeyPopupOpen}
          setMasterKeyPopupField={setMasterKeyPopupField}
          setMasterKeyFieldConfig={setMasterKeyFieldConfig}
          isReadonly={isReadonly || (parentFieldCfg?.is_readonly ?? false)}
          fieldConfig={fieldConfig}
          parentName={parentId}
        />
      </div>
    );
  };

  const renderInvoicePreview = () => {
    if (!fileUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-indigo-400 p-8">
          <FileText size={48} />
          <p className="mt-4 text-white/80 text-center">
            Document not found or loading...
          </p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-indigo-400 p-8">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-4 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/80 text-center">Loading document...</p>
        </div>
      );
    }

    // Handle PDF files
    if (effectiveFileType === "pdf") {
      return (
        <iframe
          src={`${displayUrl}#view=FitH`}
          title="Invoice Preview"
          className="w-full h-full border-none min-h-[400px]"
        />
      );
    }

    // Handle image files
    if (effectiveFileType === "image") {
      return (
        <div className="w-full h-full flex flex-col">
          {/* Image controls - only show for images */}
          {/* <div className="flex justify-center gap-2 p-1 bg-slate-800 border-b border-slate-700">
                        <button
                            onClick={handleZoomIn}
                            className="px-2 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn size={14} />
                        </button>
                        <button
                            onClick={handleZoomOut}
                            className="px-2 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut size={14} />
                        </button>
                        <button
                            onClick={handleRotate}
                            className="px-2 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                            title="Rotate"
                        >
                            <RotateCw size={14} />
                        </button>
                        <button
                            onClick={resetImageControls}
                            className="px-2 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                            title="Reset"
                        >
                            <span className="text-[10px] font-medium">Reset</span>
                        </button>
                    </div> */}

          {/* Image container with overflow hidden to prevent layout breaking */}
          <div className="flex-grow overflow-hidden flex items-center justify-center p-2 relative">
            <img
              ref={imageRef}
              src={displayUrl}
              alt="Invoice Preview"
              className="max-w-full max-h-full object-contain cursor-move"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                transformOrigin: "center center",
                transition: isDraggingImage
                  ? "none"
                  : "transform 0.2s ease-in-out",
                cursor: zoomLevel > 1 ? "move" : "default",
              }}
              onDoubleClick={handleImageDoubleClick}
              onMouseDown={handleImageMouseDown}
            />
          </div>
        </div>
      );
    }

    // Handle JSON and text files
    if (effectiveFileType === "json" || effectiveFileType === "text") {
      return (
        <pre className="w-full h-full white-space-pre-wrap break-words p-4 bg-gray-900 text-green-300 text-xs overflow-auto">
          {textContent}
        </pre>
      );
    }

    // Handle CSV files
    if (effectiveFileType === "csv" && tableData && tableData.length > 0) {
      return (
        <div className="overflow-x-auto w-full h-full bg-white rounded-lg">
          <table className="w-full border-collapse text-sm text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-indigo-500 text-white">
                {tableData[0].map((header, index) => (
                  <th
                    key={index}
                    className="p-2 font-bold whitespace-nowrap border-r border-indigo-400 last:border-r-0"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.slice(1).map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`${rowIndex % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } hover:bg-indigo-100`}
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="p-2 text-gray-800 border-b border-gray-200 border-r last:border-r-0"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // For unsupported types like Word, Excel, etc., provide a message
    const fileName = invoicePath ? invoicePath.split("/").pop() : "document";
    let fileTypeMessage = `.${(
      fileType || fileName.split(".").pop()
    ).toUpperCase()}`;
    const wordTypes = ["doc", "docx"];
    const excelTypes = ["xls", "xlsx"];
    const fileExt = fileType || fileName.split(".").pop().toLowerCase();

    if (wordTypes.includes(fileExt)) {
      fileTypeMessage = "Microsoft Word document";
    } else if (excelTypes.includes(fileExt)) {
      fileTypeMessage = "Excel spreadsheet";
    }


    return (
      <div className="flex flex-col items-center justify-center h-full text-white/80 p-8 text-center">
        <FileText size={48} className="text-indigo-400 mb-4" />
        <h4 className="text-lg font-semibold text-white mb-2">
          Preview not available
        </h4>
        <p className="text-sm mb-4">
          Preview for <strong>{fileTypeMessage}</strong> files is not supported.
        </p>
        {/* <a
                    href={fileUrl}
                    download={fileName}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all duration-300 bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg"
                >
                    Download File
                </a> */}
      </div>
    );
  };

  // Filter general fields to exclude any that are arrays (which will be handled as line items)
  // Also filter out fields that are not visible (is_visible: false)
  // const generalFields = fieldConfig.filter(
  //     (f) => {
  //         // Ensure f has required properties
  //         if (!f) return false;

  //         // Map property names if needed
  //         const fieldName = f.field_name || f.name;
  //         const fieldType = f.field_type || f.type || 'text';

  //         // Skip if field_name is missing
  //         if (!fieldName) return false;

  //         // Check if field is visible (default to true if is_visible is not defined)
  //         const isVisible = f.is_visible ?? true;

  //         // Determine if this field should be shown in the form
  //         const isTopLevelField = !f.parent;
  //         const isTabField = fieldType === "tab";
  //         const belongsToActiveTab = f.parent === activeTab;

  //         // If the active tab is the general tab ('general'), show all top-level non-tab fields
  //         // If there is an active tab (and it's not the general tab), only show fields that belong to that active tab
  //         const isGeneralTabActive = activeTab === 'general';
  //         const shouldShow = (isGeneralTabActive && isTopLevelField && !isTabField) ||  // Show top-level non-tab fields when general tab is active
  //             (!isGeneralTabActive && belongsToActiveTab);            // Show fields that belong to the active tab

  //         return shouldShow && fieldType !== "array" && isVisible;
  //     }
  // ).sort((a, b) => {
  //     // Sort by sequence field if available, otherwise put at the end
  //     const seqA = a.sequence ?? 999999;
  //     const seqB = b.sequence ?? 999999;
  //     return seqA - seqB;
  // });


  const hasRejectionCommentError =
    errors.rejectionComment && errors.rejectionComment.trim() !== "";

  const handlePendingFileClick = useCallback((file, index) => {
    // Create a document-like object for the pending file
    selectDocument({
      id: `pending-${index}`,
      name: file.name,
      file: file,
      isPending: true
    });
  }, [selectDocument]);

  return (
    // --- UPDATED: Main Container — always full-width form, no left document panel ---
    <div className="font-[poppins] text-gray-800 p-3 lg:h-[calc(100vh-98px)] flex justify-center items-center w-full max-sm:p-2 max-sm:h-auto">
      {isDragging && (
        <div className="fixed inset-0 z-[9998] cursor-col-resize" />
      )}
      <div
        ref={containerRef}
        className="border w-full h-full flex overflow-hidden rounded-xl shadow-xl transition-shadow duration-300 ease-in-out bg-white flex-col max-lg:rounded-xl max-lg:shadow-lg max-lg:h-auto max-sm:h-full"
        data-tour="editor-form-container"
      >
        {/* Hidden file input always available */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => {
            handleFileSelect(e.target.files);
            e.target.value = '';
          }}
        />

        {/* --- FORM PANEL: Full width, always shown --- */}
        <div className="w-full flex flex-col h-full bg-white overflow-hidden">
          <div ref={formContainerRef} className="flex flex-col h-full min-h-0">



            {/* Form Header */}
            {isManualVendor ? (
              renderMainTabs()
            ) : (
              /* ── Non-manual vendor: modern tab bar ── */
              <div className="flex-shrink-0 border-b border-gray-100 bg-white px-4 pt-0">
                <div className="flex items-center gap-1">
                  <CircleCheckBig size={14} className="text-indigo-500 mr-1 flex-shrink-0" />
                  <nav className="flex gap-6">
                    <button
                      onClick={() => setNonManualActiveTab('vendor_form')}
                      className={`pb-2.5 pt-2 text-[12px] font-medium transition-all relative group ${nonManualActiveTab === 'vendor_form'
                        ? 'text-indigo-600'
                        : 'text-gray-400 hover:text-indigo-500'
                        }`}
                    >
                      Policy Form
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full transition-all duration-300 ${nonManualActiveTab === 'vendor_form'
                        ? 'bg-indigo-500 opacity-100'
                        : 'bg-gray-200 opacity-0 group-hover:opacity-100'
                        }`} />
                    </button>
                    {(!documents || documents.length === 0) && (
                      <button
                        onClick={() => setNonManualActiveTab('uploaded_documents')}
                        className={`pb-2.5 pt-2 text-[12px] font-medium transition-all relative group ${nonManualActiveTab === 'uploaded_documents'
                          ? 'text-indigo-600'
                          : 'text-gray-400 hover:text-indigo-500'
                          }`}
                      >
                        Uploaded Documents
                        <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full transition-all duration-300 ${nonManualActiveTab === 'uploaded_documents'
                          ? 'bg-indigo-500 opacity-100'
                          : 'bg-gray-200 opacity-0 group-hover:opacity-100'
                          }`} />
                      </button>
                    )}
                    <button
                      onClick={() => setNonManualActiveTab('approval_history')}
                      className={`pb-2.5 pt-2 text-[12px] font-medium transition-all relative group ${nonManualActiveTab === 'approval_history'
                        ? 'text-indigo-600'
                        : 'text-gray-400 hover:text-indigo-500'
                        }`}
                    >
                      Approval History
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full transition-all duration-300 ${nonManualActiveTab === 'approval_history'
                        ? 'bg-indigo-500 opacity-100'
                        : 'bg-gray-200 opacity-0 group-hover:opacity-100'
                        }`} />
                    </button>
                  </nav>
                </div>
              </div>
            )}

            {/* Main Active Tab Content */}
            <div className="panel-content flex flex-col flex-grow overflow-y-auto min-h-0">
              {/* If it's a manual vendor, we check which main tab to show */}
              {isManualVendor ? (
                mainActiveTab === 'vendor_form' ? (
                  renderFormContent()
                ) : mainActiveTab === 'approval_history' ? (
                  /* ── Approval History Tab ── */
                  <div className="flex-1 overflow-y-auto bg-gray-50/50">
                    <VendorApprovalHistory instanceId={instanceId} />
                  </div>
                ) : (
                  /* ── Uploaded Documents Tab ── */
                  <div className="flex-1 overflow-y-auto">
                    <VendorDocuments
                      documents={documents}
                      manualUploadedFiles={manualUploadedFiles}
                      isReadonly={isReadonly}
                      canEditInvoice={canEditInvoice}
                      isLoading={isLoading}
                      fileInputRef={fileInputRef}
                      handleFileSelect={handleFileSelect}
                      onManualFileSelect={onManualFileSelect}
                      onRemoveManualFile={onRemoveManualFile}
                      onDeleteDocument={onDeleteDocument}
                      onOpenPreview={onOpenPreview}
                    />
                  </div>
                )
              ) : (
                /* Non-manual vendor tab content */
                nonManualActiveTab === 'approval_history' ? (
                  <div className="flex-1 overflow-y-auto bg-gray-50/50">
                    <VendorApprovalHistory instanceId={instanceId} />
                  </div>
                ) : nonManualActiveTab === 'uploaded_documents' && (!documents || documents.length === 0) ? (
                  /* ── Uploaded Documents Tab (only when no documents exist) ── */
                  <div className="flex-1 overflow-y-auto">
                    <VendorDocuments
                      documents={documents}
                      manualUploadedFiles={manualUploadedFiles}
                      isReadonly={isReadonly}
                      canEditInvoice={canEditInvoice}
                      isLoading={isLoading}
                      fileInputRef={fileInputRef}
                      handleFileSelect={handleFileSelect}
                      onManualFileSelect={onManualFileSelect}
                      onRemoveManualFile={onRemoveManualFile}
                      onDeleteDocument={onDeleteDocument}
                      onOpenPreview={onOpenPreview}
                    />
                  </div>
                ) : (
                  renderFormContent()
                )
              )}
            </div>


            {/* --- FOOTER: ACTION BUTTONS --- */}
            {!isWorkflowCompleted && (
              <div
                className="flex justify-end items-center gap-3 px-4 py-2.5 bg-white border-t border-gray-100 flex-shrink-0 max-sm:flex-col max-sm:items-stretch max-sm:p-4 max-sm:gap-3"
                data-tour="editor-action-buttons"
              >
                {/* Back Button */}
                {/* <button
                                  onClick={onBack}
                                  className="inline-flex items-center justify-center gap-1 px-4 py-1 rounded-lg font-semibold text-sm cursor-pointer transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl hover:-translate-y-1 bg-white text-gray-600 border-2 border-gray-200 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:bg-gray-100 disabled:text-gray-500 max-sm:w-full"
                              >
                                  <ArrowLeft size={18} /> Back
                              </button> */}

                <div className="flex gap-2 justify-end max-sm:flex-col max-sm:gap-3 max-sm:w-full">
                  {/*
                    ─────────────────────────────────────────────────────────────
                    FOOTER BUTTON RULES (driven by workflowConfig + user role)
                    ─────────────────────────────────────────────────────────────
                    1. "Save Draft" + "Cancel" are ALWAYS shown on the initial step
                      (step[0]), regardless of transitions.  On later steps they
                      are hidden — reviewers don't draft, they act.

                    2. Transition buttons (Submit / Approve & Upload / Reject / Hold)
                      are shown only when:
                        a) The transition's actionRef appears in workflowVisibleActions
                            (i.e. the current user's role is listed in that
                            transition's permissions.visible array), AND
                        b) The button maps to the current workflow step's transitions.

                    3. When workflowConfig is absent every button falls back to its
                      old visibility logic so existing non-workflow vendors are
                      unaffected.

                    4. When isWorkflowMissing is true (vendor_workflow_json key absent
                      OR meta is not valid JSON), ALL buttons except Cancel are hidden
                      and a warning banner is shown in the footer.

                    actionRef → button mapping:
                      btn_submit  → <Submit>
                      btn_approve → <Approve & Upload>
                      btn_reject  → <Reject>
                      btn_hold    → <On Hold>   (also shown alongside btn_reject by default)
                    ─────────────────────────────────────────────────────────────
                  */}

                  {/* ── Workflow configuration missing banner ── */}
                  {isWorkflowMissing && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-medium text-amber-700">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Workflow configuration is missing or invalid. Please contact your administrator.
                    </div>
                  )}

                  {/* Save Draft */}
                  {!isWorkflowMissing && (!workflowConfig || (isInitialStep && workflowVisibleActions.has('btn_draft'))) && (
                    <button
                      onClick={onSaveDraft}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-[11px] cursor-pointer transition-all duration-200 ease-in-out bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 max-sm:w-full shadow-sm"
                      disabled={!isFormEditable}
                      title={!isFormEditable ? editPermissionMessage : "Save as draft"}
                    >
                      Save Draft
                    </button>
                  )}

                  {/* Submit */}
                  {!isWorkflowMissing && (!workflowConfig || workflowVisibleActions.has('btn_submit')) && (
                    <button
                      onClick={onSubmit}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-[11px] cursor-pointer transition-all duration-200 ease-in-out bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 max-sm:w-full shadow-sm"
                      disabled={!isFormEditable}
                      title={!isFormEditable ? editPermissionMessage : "Submit"}
                    >
                      Submit
                    </button>
                  )}

                  {/* Approve & Upload */}
                  {!isWorkflowMissing && (!workflowConfig || workflowVisibleActions.has('btn_approve')) && (
                    <button
                      onClick={onApproveAndUpload}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-[11px] cursor-pointer transition-all duration-200 ease-in-out bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 max-sm:w-full shadow-sm"
                      disabled={!isFormEditable}
                      title={!isFormEditable ? editPermissionMessage : "Approve and upload"}
                      data-tour="editor-approve-button"
                    >
                      Approve &amp; Upload
                    </button>
                  )}

                  {/* Reject */}
                  {!isWorkflowMissing && (!workflowConfig || workflowVisibleActions.has('btn_reject')) && (
                    <button
                      onClick={onReject}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-[11px] cursor-pointer transition-all duration-200 ease-in-out bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 max-sm:w-full shadow-sm"
                      disabled={!isFormEditable}
                      title={!isFormEditable ? editPermissionMessage : "Reject"}
                      data-tour="editor-reject-button"
                    >
                      Reject
                    </button>
                  )}

                  {/* On Hold */}
                  {!isWorkflowMissing && (!workflowConfig || workflowVisibleActions.has('btn_hold')) && (
                    <button
                      onClick={onHold}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-[11px] cursor-pointer transition-all duration-200 ease-in-out bg-white text-amber-600 border border-amber-200 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 max-sm:w-full shadow-sm"
                      disabled={!isFormEditable}
                      title={!isFormEditable ? editPermissionMessage : "Hold"}
                      data-tour="editor-hold-button"
                    >
                      <GitCompare size={13} /> On Hold
                    </button>
                  )}

                  {/* Cancel */}
                  {(isWorkflowMissing || !workflowConfig || isInitialStep) && (
                    <button
                      onClick={onCancel}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-[11px] cursor-pointer transition-all duration-200 ease-in-out bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-700 max-sm:w-full shadow-sm"
                      title="Cancel and go back"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Card Popup for long text content */}
        <CardPopup
          isOpen={isCardPopupOpen}
          onRequestClose={closeCardPopup}
          title={popupContent.title}
          content={popupContent.content}
          isEditable={isFormEditable}
          onContentChange={handlePopupContentChange}
          isError={false}
          showActionButtons={true}
          itemId={popupContent.itemId}
          field={popupContent.field}
        />
        {/* Master Key Search Popup */}
        <MasterKeySearchPopup
          isOpen={masterKeyPopupOpen}
          onClose={() => {
            setMasterKeyPopupOpen(false);
            setMasterKeyPopupField("");
            setMasterKeyFieldConfig({ fieldName: "", uniqueKey: "" });
          }}
          onSelect={handleMasterKeySelect}
          fieldName={masterKeyFieldConfig.fieldName}
          fieldConfig={
            fieldConfig.find(
              (config) => config.field_name === masterKeyFieldConfig.fieldName
            ) || null
          }
          uniqueKey={masterKeyFieldConfig.uniqueKey}
          initialValue={
            masterKeyPopupField
              ? masterKeyPopupField.startsWith("lineItem-")
                ? // For line item fields, extract index and field name
                (() => {
                  const parts = masterKeyPopupField.split("-");
                  if (parts.length === 3) {
                    const index = parseInt(parts[1]);
                    const fieldName = parts[2];
                    return formData.lineItems && formData.lineItems[index]
                      ? formData.lineItems[index][fieldName]
                      : "";
                  }
                  return "";
                })()
                : formData[masterKeyPopupField]
              : ""
          }
        />
      </div>
    </div >
  );
};

export default VendorFormUI;
import React, {
    useRef,
    useLayoutEffect,
    useState,
    useEffect,
    useCallback,
    Fragment,
    useMemo
} from 'react';
import { useSelector } from 'react-redux';
import { FileText, X, Check, ArrowRight, GripVertical, ArrowLeft, GitCompare, SquareArrowOutUpRight, CircleCheckBig, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Search, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import CardPopup from '../CardPopup';
import { useCardPopup } from '../../hooks/useCardPopup';
import { parseCustomValues, renderCustomValueField } from '../../../utils/customValuesParser';
import MasterKeySearchPopup from '../MasterKeySearchPopup';
import MessageDisplay from '../MessageDisplay';
import { apiBaseUrl } from '../../../config/apiConfig';
import axios from '../../../utils/authInterceptor'

// A simple helper function, can be moved to a utils file
const toTitleCase = (str) => {
    if (typeof str !== 'string' || !str) return '';
    // Add a space before an uppercase letter only if it is preceded by a lowercase letter or a number
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (char) => char.toUpperCase())
        .replace(/_/g, ' ');
};

// --- Custom Tooltip Component ---
const Tooltip = ({ children, content }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [style, setStyle] = useState({});
    const TOOLTIP_W = 260; // max width in px — used for edge detection
    const TOOLTIP_OFFSET = 12; // gap between cursor and tooltip box

    const displayContent = String(content ?? '');
    const hasValidContent =
        displayContent.trim() !== '' &&
        displayContent.trim() !== 'undefined' &&
        displayContent.trim() !== 'null';

    const computeStyle = useCallback((e) => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cx = e.clientX;
        const cy = e.clientY;

        // Horizontal: prefer right of cursor; flip left if not enough room
        const spaceRight = vw - cx - TOOLTIP_OFFSET;
        let left, right;
        if (spaceRight >= TOOLTIP_W) {
            left = cx + TOOLTIP_OFFSET;
            right = 'auto';
        } else {
            // flip: anchor to the left of the cursor
            left = 'auto';
            right = vw - cx + TOOLTIP_OFFSET;
        }

        // Vertical: prefer below cursor; flip above if near bottom
        const TOOLTIP_H_EST = 80; // rough estimate; real height may vary
        let top;
        if (cy + TOOLTIP_OFFSET + TOOLTIP_H_EST <= vh) {
            top = cy + TOOLTIP_OFFSET;
        } else {
            top = Math.max(8, cy - TOOLTIP_OFFSET - TOOLTIP_H_EST);
        }

        return { left, right, top };
    }, []);

    const handleMouseMove = useCallback((e) => {
        setStyle(computeStyle(e));
    }, [computeStyle]);

    const handleMouseEnter = (e) => {
        if (!hasValidContent) return;
        setStyle(computeStyle(e));
        setIsVisible(true);
        window.addEventListener('mousemove', handleMouseMove);
    };

    const handleMouseLeave = () => {
        setIsVisible(false);
        window.removeEventListener('mousemove', handleMouseMove);
    };

    return (
        <div
            className="relative inline-block w-full"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}

            {isVisible && hasValidContent && (
                <div
                    style={{
                        position: 'fixed',
                        zIndex: 99999,
                        maxWidth: TOOLTIP_W,
                        pointerEvents: 'none',
                        ...style,
                    }}
                    className="bg-gray-900 text-white text-[11px] font-normal leading-relaxed rounded-md shadow-xl px-2.5 py-1.5 break-words"
                >
                    {displayContent}
                </div>
            )}
        </div>
    );
};
// --- End Custom Tooltip Component ---

// --- Expandable Popup Component ---
const ExpandablePopup = ({ children, content, isEditable, onChange, disabled, displayName }) => {
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
            if (e.key === 'Escape' && isExpanded) {
                handleClose();
            }
        };

        if (isExpanded) {
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
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
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
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
                    <div
                        className="fixed inset-0 z-[10000] flex items-center justify-center animate-in fade-in zoom-in duration-200"
                    >
                        <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-[400px] max-w-[90vw] max-h-[90vh] flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
                                <h4 className="text-sm font-semibold text-gray-800">Edit {displayName || 'Value'}</h4>
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
    onLineItemDelete,
    canEditInvoice,
    errors,
    openCardPopup,
    firstInvalidField,
    setMasterKeyPopupOpen,
    setMasterKeyPopupField,
    setMasterKeyFieldConfig,
    isReadonly,
    isAdminViewer,
    fieldConfig,
    arrayFieldName = 'lineItems', // which formData key owns these rows
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const prevRowCountRef = useRef(data.length);
    const rowsPerPage = 5;

    // Calculate pagination
    const totalRows = data.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
    const currentRows = data.slice(startIndex, endIndex);

    // Create a unique ID for each row based on index
    const getRowId = (item, index) => item.id || item.parameter_id || item.tenant_id || `row-${index}`;

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
                range.push(1, 2, 3, 4, '...', totalPages);
            } else if (currentPage >= totalPages - 2) {
                range.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                range.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }
        return range;
    };

    // Determine which columns to display, including the Action column if editable
    const displayColumns = useMemo(() => {
        // Filter columns to only include visible ones and add isRequired property
        const visibleCols = columns.filter(col => {
            // Find the field config for this column
            const fieldConfigItem = fieldConfig && Array.isArray(fieldConfig)
                ? fieldConfig.find(f => f.field_name === col.key && f.parent)
                : null;

            // If we found a field config, use its is_visible property (default true)
            // If no field config found, assume it should be visible
            return fieldConfigItem ? (fieldConfigItem.is_visible ?? true) : true;
        }).map(col => {
            // Find the field config for this column to check if it's required
            const fieldConfigItem = fieldConfig && Array.isArray(fieldConfig)
                ? fieldConfig.find(f => f.field_name === col.key && f.parent)
                : null;

            // Add isRequired property if the field is required
            return {
                ...col,
                isRequired: fieldConfigItem ? (fieldConfigItem.is_required ?? false) : false,
                isFieldReadonly: fieldConfigItem ? (fieldConfigItem.is_readonly ?? false) : false
            };
        });

        // Check if there are any line item fields defined in fieldConfig (fields with parent property)
        const hasLineItemFields = fieldConfig && Array.isArray(fieldConfig) &&
            fieldConfig.some(f => f.parent);

        // Add the action column only if editing is allowed AND there are line item fields
        if (!isReadonly && canEditInvoice && hasLineItemFields) {
            visibleCols.push({
                key: 'action',
                header: 'Del', // Short header for small width
                isAction: true,
                width: '50px' // Keep width small for the icon
            });
        }
        return visibleCols;
    }, [columns, isReadonly, canEditInvoice, fieldConfig]);

    // NEW: Effect to adjust current page when data changes (to handle deletion of last item)
    useEffect(() => {
        // If current page is greater than total pages and total pages > 0
        // This happens when items are deleted from the last page
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
        // If all items are deleted, reset to page 1
        if (totalRows === 0) {
            setCurrentPage(1);
        }
    }, [totalRows, totalPages, currentPage]);

    // NEW: Effect to handle row addition (to focus on newly added row)
    useEffect(() => {
        // Detect row addition
        if (data.length > prevRowCountRef.current) {
            const newTotalPages = Math.ceil(data.length / rowsPerPage);

            // Move to last page
            setCurrentPage(newTotalPages);

            // Focus newly added row (after DOM paint)
            requestAnimationFrame(() => {
                const newRowIndex = data.length - 1;

                // Focus first editable field of the new row
                const firstColumnKey = columns.find(
                    col => col.key !== 'action'
                )?.key;

                if (firstColumnKey) {
                    const inputId = `line-item-${newRowIndex}-${firstColumnKey}`;
                    const el = document.getElementById(inputId);
                    el?.focus();
                    el?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            });
        }

        prevRowCountRef.current = data.length;
    }, [data.length, columns, rowsPerPage]);

    return (
        <div className="flex flex-col" data-tour="editor-line-items">
            {/* Table wrapper — always renders the header; empty state replaces tbody rows */}
            <div className="rounded-lg border border-gray-300 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table
                        className="w-full border-collapse bg-white text-xs"
                        style={{ tableLayout: "auto", minWidth: "max-content" }}
                    >
                        <thead>
                            <tr className="bg-gray-50 border-b-2 border-gray-300">
                                {displayColumns.map((col) => (
                                    <th
                                        key={col.key}
                                        className={`px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 last:border-r-0 ${col.isAction ? 'text-center' : ''}`}
                                        style={{
                                            width: col.isAction ? '44px' : col.width,
                                            minWidth: col.isAction ? '44px' : '80px',
                                            maxWidth: col.isAction ? '44px' : '180px',
                                            whiteSpace: 'normal',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        <div className={`flex items-start gap-0.5 ${col.isAction ? 'justify-center' : 'justify-start'}`}>
                                            <span className="leading-tight">{col.header}</span>
                                            {col.isRequired && <span className="text-red-400 flex-shrink-0">*</span>}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {currentRows.length > 0 ? (
                                currentRows.map((item, index) => {
                                    const actualIndex = startIndex + index;
                                    const rowId = getRowId(item, actualIndex);
                                    return (
                                        <tr
                                            key={rowId}
                                            className={`transition-colors duration-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} hover:bg-indigo-50/30`}
                                        >
                                            {displayColumns.map((col) => {
                                                // Handle Action Column
                                                if (col.isAction) {
                                                    return (
                                                        <td
                                                            key={`${rowId}-${col.key}`}
                                                            className="px-2 py-1.5 border-r border-gray-200 last:border-r-0 text-center align-middle"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => onLineItemDelete(actualIndex)}
                                                                title={`Delete row ${actualIndex + 1}`}
                                                                className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                                                                disabled={!canEditInvoice || isReadonly}
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </td>
                                                    );
                                                }

                                                const fieldValue = item[col.key] ?? '';
                                                let hasError = !!(errors?.lineItems?.[actualIndex]?.[col.key] &&
                                                    (fieldValue === null || fieldValue === undefined || String(fieldValue).trim() === ''));
                                                if (col.type === 'date' && fieldValue && String(fieldValue).trim() !== '') {
                                                    if (errors?.lineItems?.[actualIndex]?.[col.key]) {
                                                        hasError = true;
                                                    }
                                                }
                                                const errorClasses = hasError
                                                    ? 'border-red-400 bg-red-50 focus:ring-red-100'
                                                    : 'border-gray-200 focus:border-indigo-400';

                                                const hasCustomValues = col.custom_values &&
                                                    (col.custom_values.startsWith('Drop(') ||
                                                        col.custom_values.startsWith('Radio(') ||
                                                        col.custom_values.startsWith('Check(') ||
                                                        col.custom_values.startsWith('MasterKey('));

                                                return (
                                                    <td
                                                        key={`${rowId}-${col.key}`}
                                                        className={`px-2 py-1.5 border-r border-gray-200 last:border-r-0 align-middle ${hasError ? 'bg-red-50/60' : ''}`}
                                                        style={{ maxWidth: '180px' }}
                                                    >
                                                        {hasCustomValues ? (
                                                            <div className="relative w-full">
                                                                {col.custom_values.startsWith('MasterKey(') ? (
                                                                    <div className="relative w-full">
                                                                        <Tooltip content={fieldValue}>
                                                                            <input
                                                                                type={col.type === 'date' ? 'date' : 'text'}
                                                                                id={`line-item-${actualIndex}-${col.key}`}
                                                                                value={fieldValue}
                                                                                className={`w-full text-[11px] font-normal px-2 py-1 border rounded focus:ring-1 focus:outline-none transition-colors ${col.isFieldReadonly ? 'cursor-not-allowed bg-gray-50 text-gray-400' : 'cursor-pointer bg-white'} hover:bg-gray-50 ${errorClasses} pr-7`}
                                                                                readOnly={true}
                                                                                disabled={!canEditInvoice || col.isFieldReadonly}
                                                                                title={col.isFieldReadonly ? "This field is readonly." : ""}
                                                                            />
                                                                        </Tooltip>
                                                                        {!isReadonly && (
                                                                            <button
                                                                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors no-tooltip z-10"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (!isReadonly) {
                                                                                        const parsedCustomValues = parseCustomValues(col.custom_values);
                                                                                        setMasterKeyPopupField(`lineItem-${actualIndex}-${col.key}`);
                                                                                        setMasterKeyFieldConfig({
                                                                                            fieldName: col.key,
                                                                                            uniqueKey: parsedCustomValues.options[0] || 'abcd',
                                                                                            arrayFieldName: arrayFieldName,
                                                                                        });
                                                                                        setMasterKeyPopupOpen(true);
                                                                                    }
                                                                                }}
                                                                                title="Search"
                                                                                disabled={!isAdminViewer && isReadonly}
                                                                            >
                                                                                <Search size={11} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    renderCustomValueField(
                                                                        { field_name: col.key, custom_values: col.custom_values },
                                                                        fieldValue,
                                                                        (newValue) => onLineItemChange(actualIndex, col.key, newValue),
                                                                        !canEditInvoice,
                                                                        `line-item-${actualIndex}-${col.key}`,
                                                                        hasError
                                                                    )
                                                                )}
                                                                {hasError && (
                                                                    <p className="mt-0.5 text-[10px] font-normal text-red-500">
                                                                        {errors.lineItems[actualIndex][col.key]}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="relative">
                                                                <ExpandablePopup
                                                                    content={fieldValue}
                                                                    isEditable={canEditInvoice && !col.isFieldReadonly && !isReadonly}
                                                                    onChange={(newValue) => {
                                                                        if (isAdminViewer || isReadonly || col.isFieldReadonly) return;
                                                                        let valueToSet = newValue;
                                                                        if (col.type === 'number') {
                                                                            const num = parseFloat(valueToSet);
                                                                            valueToSet = isNaN(num) ? '' : num;
                                                                        }
                                                                        onLineItemChange(actualIndex, col.key, valueToSet);
                                                                    }}
                                                                    disabled={!isAdminViewer && (isReadonly || col.isFieldReadonly)}
                                                                    displayName={col.header || toTitleCase(col.key)}
                                                                >
                                                                    {({ onExpand }) => (
                                                                        <div className="relative w-full">
                                                                            <Tooltip content={fieldValue}>
                                                                                <input
                                                                                    type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                                                                                    id={`line-item-${actualIndex}-${col.key}`}
                                                                                    value={fieldValue}
                                                                                    onChange={(e) => {
                                                                                        if (isAdminViewer || isReadonly || col.isFieldReadonly) return;
                                                                                        let valueToSet = e.target.value;
                                                                                        if (col.type === 'number') {
                                                                                            const num = parseFloat(valueToSet);
                                                                                            valueToSet = isNaN(num) ? '' : num;
                                                                                        }
                                                                                        onLineItemChange(actualIndex, col.key, valueToSet);
                                                                                    }}
                                                                                    className={`w-full text-[11px] font-normal px-2 py-1 border rounded focus:ring-1 focus:outline-none transition-colors ${col.isFieldReadonly ? 'cursor-not-allowed bg-gray-50 text-gray-400' : 'bg-white text-gray-700'} ${errorClasses} ${String(fieldValue).length > 15 ? 'pr-7' : ''}`}
                                                                                    disabled={!isAdminViewer && (isReadonly || col.isFieldReadonly)}
                                                                                    title={(isReadonly && !isAdminViewer) ? "Readonly mode" : `Edit ${toTitleCase(col.key)}`}
                                                                                />
                                                                            </Tooltip>
                                                                            {String(fieldValue).length > 15 && (
                                                                                <button
                                                                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors no-tooltip z-10"
                                                                                    onClick={onExpand}
                                                                                    title="Expand"
                                                                                    type="button"
                                                                                >
                                                                                    <SquareArrowOutUpRight size={11} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </ExpandablePopup>
                                                                {hasError && (
                                                                    <p className="mt-0.5 text-[10px] font-normal text-red-500">
                                                                        {errors.lineItems[actualIndex][col.key]}
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
                                /* Empty state — full-width cell that spans all columns */
                                <tr>
                                    <td colSpan={displayColumns.length} className="px-0 py-0">
                                        <div className="flex flex-col items-center justify-center py-2 px-4 bg-white">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                            </div>
                                            <p className="text-[11px] font-normal text-gray-400">No rows added yet</p>
                                            {!isReadonly && canEditInvoice && (
                                                <p className="text-[10px] text-gray-300 mt-0.5">Use "+ Add Row" to get started</p>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination — only when there are rows */}
            {totalRows > 0 && (
                <div className="flex items-center justify-between mt-2.5 px-0.5">
                    <p className="text-[11px] font-normal text-gray-400">
                        Showing {startIndex + 1}–{endIndex} of {totalRows} {totalRows === 1 ? 'row' : 'rows'}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="flex items-center justify-center w-6 h-6 rounded border border-gray-200 bg-white text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
                        >
                            <ChevronLeft size={12} />
                        </button>
                        {getPaginationRange().map((pg, i) => (
                            <button
                                type="button"
                                key={i}
                                disabled={pg === '...'}
                                className={`flex items-center justify-center min-w-6 h-6 px-1.5 rounded text-[11px] font-normal transition-all duration-150 ${
                                    pg === currentPage
                                        ? 'bg-indigo-600 text-white border border-indigo-600'
                                        : pg === '...'
                                        ? 'text-gray-400 cursor-default border-transparent bg-transparent'
                                        : 'border border-gray-200 bg-white text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                                onClick={() => typeof pg === 'number' && handlePageChange(pg)}
                            >
                                {pg}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="flex items-center justify-center w-6 h-6 rounded border border-gray-200 bg-white text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
                        >
                            <ChevronRight size={12} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
// --- End Custom Scrollable Table Component ---

const InvoiceFormUI = ({
    invoiceId,
    formData,
    fieldConfig,
    errors,
    fileUrl,
    fileType,
    invoicePath,
    lineItemTableHeaders,
    lineItemColumnProperties,
    arrayTableConfigs = {}, // NEW: per-array table configs
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
    isAdminViewer = false, // Admin viewer flag
    errorDesc, // Add errorDesc prop
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);
    const leftPanelRef = useRef(null); // Ref for the resizable left panel
    const formContainerRef = useRef(null);
    const [textContent, setTextContent] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [effectiveFileType, setEffectiveFileType] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [displayUrl, setDisplayUrl] = useState('');
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
    const [masterKeyPopupField, setMasterKeyPopupField] = useState('');

    // State to store the master key field configuration
    // arrayFieldName tracks WHICH array in formData owns the row being edited
    const [masterKeyFieldConfig, setMasterKeyFieldConfig] = useState({
        fieldName: '',
        uniqueKey: '',
        arrayFieldName: 'lineItems',
    });

    // Handler for when a master key value is selected
    const handleMasterKeySelect = useCallback((value) => {
        if (!masterKeyPopupField) return;

        if (masterKeyPopupField.startsWith('lineItem-')) {
            // Format: lineItem-{index}-{fieldName}
            // fieldName may itself contain '-', so split only on the first two dashes
            const withoutPrefix = masterKeyPopupField.slice('lineItem-'.length); // e.g. "0-Description"
            const dashIdx = withoutPrefix.indexOf('-');
            if (dashIdx !== -1) {
                const index = parseInt(withoutPrefix.slice(0, dashIdx), 10);
                const fieldName = withoutPrefix.slice(dashIdx + 1);
                // Pass arrayFieldName so handleLineItemChange updates the correct array
                const arrayFieldName = masterKeyFieldConfig.arrayFieldName || 'lineItems';
                if (!isNaN(index) && fieldName) {
                    onLineItemChange(index, fieldName, value, arrayFieldName);
                }
            }
        } else {
            // General (non-line-item) field
            onFieldChange(masterKeyPopupField, value);
        }

        // Clean up AFTER value is applied
        setMasterKeyPopupField('');
        setMasterKeyPopupOpen(false);
    }, [masterKeyPopupField, masterKeyFieldConfig, onFieldChange, onLineItemChange]);

    // Get user and token from Redux store
    const user = useSelector(state => state.auth.user);
    const token = user?.token;

    console.log("User", user);
    const {
        isCardPopupOpen,
        popupContent,
        openCardPopup,
        closeCardPopup,
        setPopupContent
    } = useCardPopup();

    // Define isAdmin from user role instead of prop
    // Note: Using isAdminViewer from props instead, which comes from Editor.jsx

    // Helper function: Should field be disabled (not clickable at all)?
    // For admins: fields should NOT be disabled, only read-only
    // For readonly mode: fields should be disabled
    const shouldDisableField = (field = {}) => {
        // Admins should NOT have disabled fields - they should be clickable but read-only
        if (isAdminViewer) return false;
        // For non-admins in readonly mode, disable the field
        return isReadonly || field.is_readonly;
    };

    // Helper function: Should changes be blocked?
    // Used for dropdowns and other inputs to prevent value changes
    const shouldBlockChange = (field = {}) => {
        return isAdminViewer || isReadonly || field.is_readonly;
    };

    // Table state variables (Unchanged)
    const [paginatedData, setPaginatedData] = useState([]);
    const [page, setPage] = useState(1);
    const [sortField, setSortField] = useState(null);
    const [sortAsc, setSortAsc] = useState(true);
    const [columnFilters, setColumnFilters] = useState({});

    // Permission denied message for editing fields and buttons
    const editPermissionMessage = isReadonly
        ? "This invoice is in readonly mode."
        : "You do not have permission to edit this invoice.";

    // Use isReadonly to determine if the form should be editable
    const isFormEditable = !isReadonly && canEditInvoice;

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
                // Use axios with interceptors instead of native fetch to handle auth properly
                const response = await axios.get(fileUrl, {
                    responseType: 'blob', // Get response as blob
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });

                if (response.status !== 200) {
                    setEffectiveFileType('error');
                    setIsLoading(false);
                    return;
                }

                const originalBlob = response.data; // Access blob data from response
                const fileName = invoicePath ? invoicePath.split('/').pop() : 'document';
                const fileExtension = fileName.split('.').pop().toLowerCase();

                let identifiedType = 'unsupported';

                const createObjectUrl = (blob, mimeType) => {
                    if (objectUrlRef.current) {
                        URL.revokeObjectURL(objectUrlRef.current);
                    }
                    const newUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
                    objectUrlRef.current = newUrl;
                    setDisplayUrl(newUrl);
                    return newUrl;
                };

                // Handle PDF files
                if (fileType === 'pdf' || fileExtension === 'pdf') {
                    identifiedType = 'pdf';
                    createObjectUrl(originalBlob, 'application/pdf');
                }
                // Handle image files
                else if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(fileType || fileExtension)) {
                    identifiedType = 'image';
                    createObjectUrl(originalBlob, originalBlob.type || `image/${fileType || fileExtension}`);
                }
                // Handle JSON files
                else if ((fileType || fileExtension) === 'json') {
                    identifiedType = 'json';
                    const fileText = await originalBlob.text();
                    try {
                        const jsonData = JSON.parse(fileText);
                        setTextContent(JSON.stringify(jsonData, null, 2));
                    } catch (e) {
                        setTextContent(fileText);
                    }
                }
                // Handle text files
                else if ((fileType || fileExtension) === 'txt') {
                    identifiedType = 'text';
                    setTextContent(await originalBlob.text());
                }
                // Handle CSV files
                else if ((fileType || fileExtension) === 'csv') {
                    identifiedType = 'csv';
                    const fileText = await originalBlob.text();

                    const parseCSV = (text) => {
                        const rows = [];
                        let inQuote = false;
                        let currentCell = '';
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
                            } else if (char === ',' && !inQuote) {
                                currentRow.push(currentCell.trim());
                                currentCell = '';
                            } else if (char === '\n' && !inQuote) {
                                if (text[i - 1] === '\r') { }
                                currentRow.push(currentCell.trim());
                                rows.push(currentRow);
                                currentRow = [];
                                currentCell = '';
                            } else if (char === '\r' && !inQuote) {
                            } else {
                                currentCell += char;
                            }
                        }
                        if (currentCell || currentRow.length > 0) {
                            currentRow.push(currentCell.trim());
                            rows.push(currentRow);
                        }
                        return rows.filter(row => row.some(cell => cell.length > 0));
                    };
                    setTableData(parseCSV(fileText));
                }
                // Handle Excel files
                else if (['xls', 'xlsx'].includes(fileType || fileExtension)) {
                    identifiedType = 'excel';
                    // For simplicity in this component, we'll treat Excel as unsupported for preview
                    // In a full implementation, we would use a library like xlsx
                }
                // Handle Word documents
                else if (['doc', 'docx'].includes(fileType || fileExtension)) {
                    identifiedType = 'word';
                    // Word documents are not previewed in this component
                }

                // Fallback for binary detection
                if (identifiedType === 'unsupported') {
                    const headerBuffer = await originalBlob.slice(0, 8).arrayBuffer();
                    const headerView = new Uint8Array(headerBuffer);
                    const headerText = new TextDecoder('utf-8').decode(headerBuffer);

                    if (headerText.startsWith('%PDF')) {
                        identifiedType = 'pdf';
                        createObjectUrl(originalBlob, 'application/pdf');
                    } else if (
                        headerView[0] === 0x89 && headerView[1] === 0x50 && headerView[2] === 0x4e && headerView[3] === 0x47
                    ) {
                        identifiedType = 'image';
                        createObjectUrl(originalBlob, 'image/png');
                    } else if (headerView[0] === 0xff && headerView[1] === 0xd8) {
                        identifiedType = 'image';
                        createObjectUrl(originalBlob, 'image/jpeg');
                    } else if (headerText.startsWith('GIF')) {
                        identifiedType = 'image';
                        createObjectUrl(originalBlob, 'image/gif');
                    }
                }

                setEffectiveFileType(identifiedType);
                setIsLoading(false);
            } catch (error) {
                setEffectiveFileType('error');
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
        document.body.style.cursor = ''; // Reset cursor
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    useEffect(() => {
        if (isDragging) {
            document.body.style.cursor = 'col-resize'; // Set resize cursor
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
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
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
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
        setZoomLevel(prev => Math.min(prev + 0.2, 3)); // Max zoom: 300%
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 0.2, 0.5)); // Min zoom: 50%
    };

    const handleRotate = () => {
        setRotation(prev => (prev + 90) % 360);
    };

    const resetImageControls = () => {
        setZoomLevel(1);
        setRotation(0);
        setImagePosition({ x: 0, y: 0 });
    };

    // Handle double click to zoom in
    const handleImageDoubleClick = () => {
        setZoomLevel(prev => Math.min(prev + 0.5, 3)); // Zoom in by 50%
    };

    // Handle mouse down for dragging
    const handleImageMouseDown = (e) => {
        if (zoomLevel > 1) {
            setIsDraggingImage(true);
            setDragStart({
                x: e.clientX - imagePosition.x,
                y: e.clientY - imagePosition.y
            });
            e.preventDefault();
        }
    };

    // Handle mouse move for dragging
    const handleImageMouseMove = useCallback((e) => {
        if (isDraggingImage) {
            setImagePosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    }, [isDraggingImage, dragStart]);

    // Handle mouse up for dragging
    const handleImageMouseUp = useCallback(() => {
        setIsDraggingImage(false);
    }, []);

    // Add event listeners for dragging
    useEffect(() => {
        if (isDraggingImage) {
            window.addEventListener('mousemove', handleImageMouseMove);
            window.addEventListener('mouseup', handleImageMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleImageMouseMove);
            window.removeEventListener('mouseup', handleImageMouseUp);
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
        return customValuesString.split(',').map(s => s.trim()).filter(s => s !== '');
    };

    // Helper function to validate dates for UI highlighting
    const isValidDateForUI = (dateString) => {
        if (typeof dateString !== 'string' || !dateString.trim()) return true;

        // Try to parse various date formats
        let date;
        let expectedDay, expectedMonth, expectedYear;
        const trimmedValue = dateString.trim();

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
            if (monthIndex === undefined) return false;
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
            if (monthIndex === undefined) return false;
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
                return false;
            }
            // Set to start of day for comparison
            date.setHours(0, 0, 0, 0);

            // Format as YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            return true;
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
            return false;
        }

        // Critical validation: Check if the parsed date matches what the user intended
        // This catches invalid dates like Feb 31, Apr 31, etc.
        if (date.getFullYear() !== expectedYear ||
            date.getMonth() !== expectedMonth ||
            date.getDate() !== expectedDay) {
            return false;
        }

        // Set the parsed date to start of day for comparison
        date.setHours(0, 0, 0, 0);

        return true;
    };

    // --- Reusable Rendering Functions ---
    const renderFormField = (fieldConfigItem) => {
        // Ensure fieldConfigItem has all required properties with defaults
        const {
            field_name = fieldConfigItem.name || '',
            field_type = fieldConfigItem.type || 'text',
            is_required = fieldConfigItem.required || false,
            custom_values = fieldConfigItem.customValues || fieldConfigItem.custom_values || '',
            display_name = fieldConfigItem.displayName || fieldConfigItem.label || '',
            is_readonly = fieldConfigItem.is_readonly || false
        } = fieldConfigItem;

        // Skip if field_name is empty
        if (!field_name) {
            // Field config item missing field_name
            return null;
        }

        let value = formData[field_name] ?? '';

        // For dropdown fields, check if the value exists in the options list
        // If not, set value to empty string to show default "Select an option"
        if (field_type === 'dropdown' && custom_values) {
            const parsedOptions = parseCustomValues(custom_values);
            const dropdownOptions = parsedOptions.options || [];

            // If value is not in dropdown options, reset it to empty string
            if (!isReadonly && value && !dropdownOptions.includes(value)) {
                value = '';
            }
        }

        // Modified logic: Check if field actually has error based on current value
        // For date fields, also check if the date is valid
        let hasError = !!errors[field_name];

        // Special handling for date fields to check if the date is valid
        if (field_type === 'date' && value && String(value).trim() !== '') {

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
        const hasCustomValues = custom_values &&
            (custom_values.startsWith('Drop(') ||
                custom_values.startsWith('Radio(') ||
                custom_values.startsWith('Check(') ||
                custom_values.startsWith('MasterKey('));

        // Check if value length is greater than 15 and no custom values
        const shouldShowPopup = value && String(value).length > 15 && !hasCustomValues;

        // --- Input base styles: lighter font, softer borders ---
        const baseClasses = "w-full px-2.5 py-1 border border-gray-200 rounded-md text-[11px] font-normal text-gray-700 bg-white transition-all duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 hover:border-gray-300";
        const errorClasses = hasError ? 'border-red-400 bg-red-50 ring-1 ring-red-100' : '';

        const renderInput = () => {
            // Check if field has custom_values format (Drop(...), Radio(...), Check(...), MasterKey(...))
            if (hasCustomValues) {
                // Check if it's a MasterKey type - this should take precedence
                const parsedCustomValues = parseCustomValues(custom_values);
                if (parsedCustomValues.type === 'MasterKey') {
                    return (
                        <div className="relative flex items-center w-full">
                            <Tooltip content={value}>
                                <input
                                    type="text"
                                    id={field_name}
                                    name={field_name}
                                    value={value}
                                    className={`w-full text-xs font-medium px-2 py-1 border rounded-md text-gray-800 shadow-sm transition-all duration-300 ease-in-out focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"} ${errorClasses} ${isReadonly ? 'pr-2' : 'pr-8'}`}
                                    readOnly={true}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        // Only open popup if not in readonly mode AND clicking directly on icon
                                        if (!isReadonly) {
                                            // We'll handle this via the button only
                                        }
                                    }}
                                    disabled={isReadonly && !isAdminViewer}
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
                                            // Parse the MasterKey to get the unique key
                                            const parsedCustomValues = parseCustomValues(custom_values);
                                            // Open master key search popup for line item
                                            setMasterKeyPopupField(field_name);
                                            setMasterKeyFieldConfig({
                                                fieldName: field_name,
                                                uniqueKey: parsedCustomValues.options[0] || 'abcd',
                                                arrayFieldName: 'lineItems', // not used for general fields
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

                // FIX: Explicitly handle Drop() here to allow Admin visibility in readonly mode
                if (custom_values.startsWith('Drop(')) {
                    const dropdownOptions = parsedCustomValues.options || [];

                    // Check if user is Admin
                    const isAdmin = isAdminViewer || (user?.Role === 'tenant_admin' || user?.Role === 'super_admin');

                    // If Admin: Force ENABLE (false) so they can click and see options
                    // If User: Respect the standard 'disabled' flag
                    const isInputDisabled = isAdmin ? false : (disabled || isReadonly);

                    return (
                        <select
                            id={field_name}
                            name={field_name}
                            value={value || ''}
                            disabled={isInputDisabled}
                            className={`
                                ${baseClasses}
                                ${errorClasses}
                                ${isInputDisabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer'}
                            `}
                            style={{
                                // Force pointer events for admins so they can click
                                pointerEvents: isInputDisabled ? 'none' : 'auto',
                                cursor: isInputDisabled ? 'not-allowed' : 'pointer'
                            }}
                            onChange={(e) => {
                                // Block the actual change for Admins or Readonly modes
                                if (isAdmin || disabled || isReadonly) return;
                                onFieldChange(field_name, e.target.value);
                            }}
                        >
                            <option value="">Select an option</option>
                            {dropdownOptions.map((option, index) => (
                                <option key={index} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
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

            // NOTE: shouldShowPopup check removed — never swap component trees based on value length.
            // The default text case below always renders a stable input + conditional expand button.

            switch (field_type) {
                case 'dropdown': {
                    const parsedOptions = parseCustomValues(custom_values);
                    const dropdownOptions = parsedOptions.options || [];

                    const isAdmin = (user?.Role === 'tenant_admin' || user?.Role === 'super_admin') || isAdminViewer;
                    const isInputDisabled = isAdmin ? false : (disabled || isReadonly);

                    return (
                        <select
                            id={field_name}
                            name={field_name}
                            value={value || ''}
                            disabled={isInputDisabled}
                            className={`
                                ${baseClasses}
                                ${errorClasses}
                                ${isInputDisabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer'}
                            `}
                            style={{
                                cursor: isInputDisabled ? 'not-allowed' : 'pointer',
                                pointerEvents: isInputDisabled ? 'none' : 'auto',
                            }}
                            onChange={(e) => {
                                if (isAdmin || disabled || isReadonly) return;
                                onFieldChange(field_name, e.target.value);
                            }}
                        >
                            <option value="">Select an option</option>
                            {dropdownOptions.map((option, index) => (
                                <option key={index} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    );
                }

                case 'radio': {
                    const parsedRadioOptions = parseCustomValues(custom_values);
                    const radioOptions = parsedRadioOptions.options || [];
                    return (
                        <div className="flex flex-col gap-1">
                            {radioOptions.map((option, index) => (
                                <label key={index} className="inline-flex items-center text-sm font-medium text-gray-800">
                                    <input
                                        type="radio"
                                        name={field_name}
                                        value={option}
                                        checked={value === option}
                                        onChange={(e) => onFieldChange(field_name, e.target.value)}
                                        className={`form-radio text-indigo-600 h-4 w-4 mr-2 border-gray-300 focus:ring-indigo-500 ${is_readonly ? "bg-gray-100" : "bg-white"}`} // Kept h-4 w-4 for good touch target
                                        disabled={isReadonly && !isAdminViewer}
                                    />
                                    {(option)}
                                </label>
                            ))}
                        </div>
                    );
                }
                case 'boolean':
                case 'checkbox':
                    return (
                        <input
                            type="checkbox"
                            id={field_name}
                            name={field_name}
                            checked={!!value}
                            onChange={(e) => {
                                if (shouldBlockChange({ is_readonly })) return;
                                onFieldChange(field_name, e.target.checked);
                            }}
                            className={`form-checkbox text-indigo-600 h-5 w-5 rounded-md border-gray-300 focus:ring-indigo-500 disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"} ${errorClasses}`}
                            disabled={shouldDisableField({ is_readonly })}
                        />
                    );
                case 'number':
                    return (
                        <input
                            type="number"
                            id={field_name}
                            name={field_name}
                            value={value}
                            onChange={(e) => {
                                if (shouldBlockChange({ is_readonly })) return;
                                onFieldChange(field_name, e.target.value);
                            }}
                            className={`${is_readonly ? "bg-gray-100" : "bg-white"} ${baseClasses} ${errorClasses}`}
                            disabled={shouldDisableField({ is_readonly })}
                        />
                    );
                case 'date':
                    return (
                        <input
                            type="date"
                            id={field_name}
                            name={field_name}
                            value={value}
                            onChange={(e) => {
                                if (shouldBlockChange({ is_readonly })) return;
                                onFieldChange(field_name, e.target.value);
                            }}
                            className={`${is_readonly ? "bg-gray-100" : "bg-white"} ${baseClasses} ${errorClasses}`}
                            disabled={shouldDisableField({ is_readonly })}
                        />
                    );
                default:
                    // Always use a single stable component tree — never branch on value length.
                    // ExpandablePopup is always mounted; expand button appears once value > 15 chars.
                    return (
                        <ExpandablePopup
                            content={value}
                            isEditable={isFormEditable && !is_readonly}
                            onChange={(newValue) => {
                                if (shouldBlockChange({ is_readonly })) return;
                                onFieldChange(field_name, newValue);
                            }}
                            disabled={shouldDisableField({ is_readonly })}
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
                                            onChange={(e) => {
                                                if (shouldBlockChange({ is_readonly })) return;
                                                onFieldChange(field_name, e.target.value);
                                            }}
                                            className={`w-full text-xs font-medium px-2 py-1 border rounded-md text-gray-800 shadow-sm transition-all duration-300 ease-in-out focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed ${is_readonly ? "bg-gray-100" : "bg-white"} ${errorClasses} ${!isReadonly && String(value).length > 15 ? 'pr-8' : ''}`}
                                            disabled={shouldDisableField({ is_readonly })}
                                        />
                                    </Tooltip>
                                    {!isReadonly && String(value).length > 15 && (
                                        <button
                                            className="absolute right-2 text-gray-700 text-xs rounded hover:text-indigo-600 transition-colors no-tooltip"
                                            onClick={onExpand}
                                            title="Expand to full editor"
                                            disabled={shouldDisableField({ is_readonly })}
                                            type="button"
                                        >
                                            <SquareArrowOutUpRight size={12} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </ExpandablePopup>
                    );
            }
        };

        return (
            <div
                key={field_name}
                id={field_name}
                className={`flex flex-col min-w-0`}
            >
                {/* Label */}
                <label htmlFor={field_name} className="block text-[11px] font-normal text-gray-500 mb-1">
                    {(display_name || field_name)}{' '}
                    {is_required && <span className="text-red-400">*</span>}
                </label>
                <div className="flex">
                    {renderInput()}
                </div>
                {hasError && (
                    <div className="mt-0.5 text-[10px] font-normal text-red-500">
                        {errors[field_name]}
                    </div>
                )}
            </div>
        );
    };

    // Hoisted popup content change handler — used by both renderLineItemsTable and renderArrayTables
    const handlePopupContentChange = useCallback((value) => {
        if (popupContent.itemId !== null && popupContent.field) {
            onLineItemChange(popupContent.itemId, popupContent.field, value);
        } else if (popupContent.field) {
            onFieldChange(popupContent.field, value);
        }
        setPopupContent(prev => ({ ...prev, content: value }));
    }, [popupContent, onFieldChange, onLineItemChange, setPopupContent]);

    const renderLineItemsTable = () => {
        const lineItems = formData.lineItems || [];
        // Note: The table content itself will show "No line items available" if lineItems.length is 0.

        const tableColumns = lineItemTableHeaders.map((headerKey) => {
            const prop = lineItemColumnProperties[headerKey] || {};
            const isDescription = headerKey.toLowerCase() === 'description';

            // Use display_name if available, otherwise fall back to title or field name
            let columnHeader = prop.display_name || prop.title || toTitleCase(headerKey);

            // If no display_name or title, try to find it from fieldConfig
            if (!prop.display_name && !prop.title) {
                const fieldConfigItem = fieldConfig.find(config => config.field_name === headerKey);
                if (fieldConfigItem && fieldConfigItem.display_name) {
                    columnHeader = fieldConfigItem.display_name;
                }
            }

            // Find the field config for this column to check if it's required
            const fieldConfigItem = fieldConfig.find(config => config.field_name === headerKey);

            // Check if this is a dropdown field
            const isDropdown = prop.custom_values && prop.custom_values.startsWith('Drop(');

            return {
                key: headerKey,
                header: columnHeader,
                type: prop.type || 'text',
                custom_values: prop.custom_values,
                width: isDescription ? '150px' : 'auto',
                isRequired: fieldConfigItem ? (fieldConfigItem.is_required ?? false) : false
            };
        });

        return (
            <>
                <ScrollableTable
                    data={lineItems}
                    columns={tableColumns}
                    onLineItemChange={onLineItemChange}
                    onLineItemDelete={onLineItemDelete}
                    canEditInvoice={isFormEditable}
                    errors={errors}
                    openCardPopup={openCardPopup}
                    firstInvalidField={firstInvalidField}
                    setMasterKeyPopupOpen={setMasterKeyPopupOpen}
                    setMasterKeyPopupField={setMasterKeyPopupField}
                    setMasterKeyFieldConfig={setMasterKeyFieldConfig}
                    isReadonly={isReadonly}
                    isAdminViewer={isAdminViewer}
                    fieldConfig={fieldConfig}
                    arrayFieldName="lineItems"
                />
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
            </>
        );
    };

    // Render all array-type fields, each as a separate titled table
    const renderArrayTables = () => {
        // Use arrayTableConfigs if provided (new multi-array mode)
        const hasMultiArrayConfigs = arrayTableConfigs && Object.keys(arrayTableConfigs).length > 0;

        if (hasMultiArrayConfigs) {
            return (
                <>
                    {Object.entries(arrayTableConfigs).map(([arrayFieldName, arrayConfig]) => {
                        const { displayName, headers, columnProperties } = arrayConfig;
                        // Get the array data from formData — use arrayFieldName key if available,
                        // otherwise fall back to formData.lineItems for the legacy "lineItems" virtual key
                        const arrayData = Array.isArray(formData[arrayFieldName])
                            ? formData[arrayFieldName]
                            : (arrayFieldName === 'lineItems' ? (formData.lineItems || []) : []);

                        const tableColumns = headers.map((headerKey) => {
                            const prop = columnProperties[headerKey] || {};
                            const isDescription = headerKey.toLowerCase() === 'description';
                            let columnHeader = prop.display_name || prop.title || toTitleCase(headerKey);
                            if (!prop.display_name && !prop.title) {
                                const fieldConfigItem = fieldConfig.find(config => config.field_name === headerKey);
                                if (fieldConfigItem && fieldConfigItem.display_name) {
                                    columnHeader = fieldConfigItem.display_name;
                                }
                            }
                            const fieldConfigItem = fieldConfig.find(config => config.field_name === headerKey);
                            return {
                                key: headerKey,
                                header: columnHeader,
                                type: prop.type || 'text',
                                custom_values: prop.custom_values,
                                width: isDescription ? '150px' : 'auto',
                                isRequired: fieldConfigItem ? (fieldConfigItem.is_required ?? false) : false,
                            };
                        });

                        return (
                            <div key={arrayFieldName} className="flex-shrink-0 mb-5 last:mb-0">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 rounded-full bg-indigo-500 flex-shrink-0" />
                                        <h4 className="text-[13px] font-medium text-gray-700 tracking-tight">
                                            {displayName}
                                        </h4>
                                    </div>
                                    {!isReadonly && (
                                        <button
                                            type="button"
                                            onClick={() => onLineItemAdd && onLineItemAdd(arrayFieldName)}
                                            disabled={!isFormEditable}
                                            title={!isFormEditable ? editPermissionMessage : `Add a row to ${displayName}`}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-normal rounded-md hover:bg-indigo-700 active:bg-indigo-800 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                                        >
                                            <Plus size={12} strokeWidth={2.5} /> Add Row
                                        </button>
                                    )}
                                </div>
                                <ScrollableTable
                                    data={arrayData}
                                    columns={tableColumns}
                                    onLineItemChange={(index, fieldKey, value) =>
                                        onLineItemChange && onLineItemChange(index, fieldKey, value, arrayFieldName)
                                    }
                                    onLineItemDelete={(index) =>
                                        onLineItemDelete && onLineItemDelete(index, arrayFieldName)
                                    }
                                    canEditInvoice={isFormEditable}
                                    errors={errors}
                                    openCardPopup={openCardPopup}
                                    firstInvalidField={firstInvalidField}
                                    setMasterKeyPopupOpen={setMasterKeyPopupOpen}
                                    setMasterKeyPopupField={setMasterKeyPopupField}
                                    setMasterKeyFieldConfig={setMasterKeyFieldConfig}
                                    isReadonly={isReadonly}
                                    isAdminViewer={isAdminViewer}
                                    fieldConfig={fieldConfig}
                                    arrayFieldName={arrayFieldName}
                                />
                            </div>
                        );
                    })}
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
                </>
            );
        }

        // Fallback: legacy single-table mode
        return renderLineItemsTable();
    };

    const renderInvoicePreview = () => {
        if (!fileUrl) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-indigo-400 p-8">
                    <FileText size={48} />
                    <p className="mt-4 text-white/80 text-center">Document not found or loading...</p>
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
        if (effectiveFileType === 'pdf') {
            return (
                <iframe
                    src={`${displayUrl}#view=FitH`}
                    title="Invoice Preview"
                    className="w-full h-full border-none min-h-[400px]"
                />
            );
        }

        // Handle image files
        if (effectiveFileType === 'image') {
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
                            className="px-2 py-1 rounded-md  text-white hover:bg-slate-600 transition-colors"
                            title="Rotate"
                        >
                            <RotateCw size={14} />
                        </button>
                        <button
                            onClick={resetImageControls}
                            className="px-2 py-1 rounded-md  text-white hover:bg-slate-600 transition-colors"
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
                                transformOrigin: 'center center',
                                transition: isDraggingImage ? 'none' : 'transform 0.2s ease-in-out',
                                cursor: zoomLevel > 1 ? 'move' : 'default'
                            }}
                            onDoubleClick={handleImageDoubleClick}
                            onMouseDown={handleImageMouseDown}
                        />
                    </div>
                </div>
            );
        }

        // Handle JSON and text files
        if (effectiveFileType === 'json' || effectiveFileType === 'text') {
            return (
                <pre className="w-full h-full white-space-pre-wrap break-words p-4 bg-gray-900 text-green-300 text-xs overflow-auto">
                    {textContent}
                </pre>
            );
        }

        // Handle CSV files
        if (effectiveFileType === 'csv' && tableData && tableData.length > 0) {
            return (
                <div className="overflow-x-auto w-full h-full bg-white rounded-lg">
                    <table className="w-full border-collapse text-sm text-left">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-indigo-500 text-white">
                                {tableData[0].map((header, index) => (
                                    <th key={index} className="p-2 font-bold whitespace-nowrap border-r border-indigo-400 last:border-r-0">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.slice(1).map((row, rowIndex) => (
                                <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-indigo-100`}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="p-2 text-gray-800 border-b border-gray-200 border-r last:border-r-0">
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
        const fileName = invoicePath ? invoicePath.split('/').pop() : 'document';
        let fileTypeMessage = `.${(fileType || fileName.split('.').pop()).toUpperCase()}`;
        const wordTypes = ['doc', 'docx'];
        const excelTypes = ['xls', 'xlsx'];
        const fileExt = fileType || fileName.split('.').pop().toLowerCase();

        if (wordTypes.includes(fileExt)) {
            fileTypeMessage = 'Microsoft Word document';
        } else if (excelTypes.includes(fileExt)) {
            fileTypeMessage = 'Excel spreadsheet';
        }

        return (
            <div className="flex flex-col items-center justify-center h-full text-white/80 p-8 text-center">
                <FileText size={48} className="text-indigo-400 mb-4" />
                <h4 className="text-lg font-semibold text-white mb-2">Preview not available</h4>
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

    // Filter general fields to exclude array fields (handled as line items)
    // Admins (readonly mode) must ALWAYS see fields
    const generalFields = fieldConfig
        .filter((f) => {
            // Safety check
            if (!f) return false;

            // Normalize field properties
            const fieldName = f.field_name || f.name;
            const fieldType = f.field_type || f.type || 'text';

            // Skip invalid fields
            if (!fieldName) return false;

            // ✅ Visibility rule:
            // - Admins (readonly) see all fields
            // - Editable users respect is_visible flag
                        const isVisible = f.is_visible ?? true;


            return !f.parent && fieldType !== 'array' && isVisible;
        })
        .sort((a, b) => {
            // Sort by sequence if available
            const seqA = a.sequence ?? 999999;
            const seqB = b.sequence ?? 999999;
            return seqA - seqB;
        });


    const hasRejectionCommentError = errors.rejectionComment && errors.rejectionComment.trim() !== '';

    return (
        // --- UPDATED: Main Container to handle mobile layout better (max-lg:rounded-xl) ---
        <div className=" font-[poppins] text-gray-800 lg:h-[calc(100vh-98px)] p-4 flex justify-center items-center w-full max-sm:p-2 max-sm:h-auto ">
            {isDragging && <div className="fixed inset-0 z-[9998] cursor-col-resize" />}
            <div
                ref={containerRef}
                // When stacking (max-lg), it's a card. On desktop, it's a seamless split.
                className="border w-full h-full flex overflow-hidden rounded-md shadow-xl transition-shadow duration-300 ease-in-out bg-white max-lg:flex-col max-lg:rounded-xl max-lg:shadow-lg max-lg:h-auto max-sm:h-full"
                data-tour="editor-form-container"
            >
                {/* --- LEFT PANEL: DOCUMENT PREVIEW --- */}
                <div
                    ref={leftPanelRef}
                    // Desktop: w-[45%], rounded-r-none. Mobile (max-lg): full width, 60vh height, rounded-t-xl
                    className="flex flex-col h-full bg-slate-800 overflow-hidden flex-shrink-0 w-[45%] min-w-[300px] rounded-r-none max-lg:w-full max-lg:min-w-0 max-lg:h-[60vh] max-lg:border-b max-lg:border-slate-700 max-lg:rounded-t-xl max-lg:rounded-b-none max-sm:h-[50vh]"
                    data-tour="editor-document-view"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0 border-b border-slate-700 bg-slate-900 text-white">
                        <h3 className="flex items-center gap-2 text-sm font-medium m-0 tracking-wide">
                            <FileText size={16} className="text-indigo-400" /> Document Preview
                        </h3>

                        {effectiveFileType === 'image' && (

                            <div className="flex flex-col">
                                {/* Image controls - only show for images */}
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={handleZoomIn}
                                        className="p-1 rounded-md text-white hover:bg-slate-600 transition-colors"
                                        title="Zoom In"
                                    >
                                        <ZoomIn size={16} />
                                    </button>
                                    <button
                                        onClick={handleZoomOut}
                                        className="p-1 rounded-md text-white hover:bg-slate-600 transition-colors"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut size={16} />
                                    </button>
                                    <button
                                        onClick={handleRotate}
                                        className="p-1 rounded-md  text-white hover:bg-slate-600 transition-colors"
                                        title="Rotate"
                                    >
                                        <RotateCw size={16} />
                                    </button>
                                    <button
                                        onClick={resetImageControls}
                                        className="p-1 rounded-md  text-white hover:bg-slate-600 transition-colors"
                                        title="Reset"
                                    >
                                        <span className="flex text-[11px] font-medium">Reset</span>
                                    </button>
                                </div>
                            </div>
                        )
                        }


                    </div>

                    {/* Iframe content area */}
                    <div className="flex-grow overflow-auto bg-slate-800 min-h-0">
                        {renderInvoicePreview()}
                    </div>
                </div>

                {/* --- DIVIDER --- */}
                <div className={`w-1 flex-shrink-0 flex items-center justify-center cursor-col-resize relative z-10 max-lg:hidden ${isDragging ? 'drag-overlay' : ''}`} onMouseDown={handleDividerMouseDown}>
                    <div className={`w-5 h-10 bg-white border-y border-gray-200 rounded-full flex items-center justify-center text-gray-400 transition-all duration-200 ease-in-out shadow-md hover:w-6 ${isDragging ? 'w-6 text-indigo-600 border-indigo-300 bg-indigo-50 shadow-xl' : ''} hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50`}>
                        <GripVertical size={14} />
                    </div>
                </div>

                {/* --- RIGHT PANEL: FORM --- */}
                <div
                    // Desktop: flex-1, rounded-l-none. Mobile (max-lg): full width, rounded-b-xl
                    className="flex-1 flex flex-col h-full bg-white overflow-hidden rounded-l-none max-lg:w-full max-lg:min-w-0 max-lg:mb-4 max-lg:rounded-b-xl max-lg:rounded-t-none"
                >
                    <div ref={formContainerRef} className="flex flex-col h-full min-h-0">
                        {/* Form Header */}
                        <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0 border-b border-gray-200 bg-white shadow-sm" data-tour="editor-header">
                            <h3 className="flex items-center gap-2 text-sm font-semibold m-0 text-gray-800 tracking-wide">
                                <CircleCheckBig size={16} className="text-indigo-600" /> Verification Form
                            </h3>
                        </div>
                        {/* Content area */}
                        <div className="panel-content p-4 flex flex-col gap-6 overflow-y-auto max-sm:p-3 flex-grow min-h-0">
                            <form
                                onSubmit={(e) => e.preventDefault()}
                                className="flex flex-col gap-4 h-full"
                                data-tour="editor-form-fields"
                            >
                                {/* Display messages using the reusable MessageDisplay component */}
                                <MessageDisplay errorDesc={errorDesc} />
                                <div className="border-b border-gray-100 pb-4 flex-shrink-0">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-1 h-4 rounded-full bg-indigo-500 flex-shrink-0" />
                                        <h4 className="text-[13px] font-medium text-gray-700 tracking-tight">General Details</h4>
                                    </div>
                                    <div className="grid gap-3 sm:gap-3 grid-cols-3 max-sm:grid-cols-1 max-sm:gap-3">
                                        {generalFields.map(field => (
                                            <Fragment key={field.field_name || field.name}>
                                                {renderFormField(field)}
                                            </Fragment>
                                        )).filter(field => field !== null)}
                                    </div>
                                </div>

                                {/* Render array tables — one per array field, each with its own display name as title */}
                                {(
                                    (arrayTableConfigs && Object.keys(arrayTableConfigs).length > 0) ||
                                    (formData.lineItems && fieldConfig && Array.isArray(fieldConfig) && fieldConfig.some(f => f.field_type === 'array') && fieldConfig.some(f => f.parent))
                                ) && (
                                    <div className="flex-shrink-0">
                                        {renderArrayTables()}
                                    </div>
                                )}

                                {/* Comments section */}
                                <div className="pb-4 last:border-b-0 last:pb-0 flex-grow min-h-0 flex flex-col">
                                    <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                                        <div className="w-1 h-4 rounded-full bg-indigo-500 flex-shrink-0" />
                                        <h4 className="text-[13px] font-medium text-gray-700 tracking-tight">Comments</h4>
                                    </div>
                                    <div className={`flex flex-col min-w-0 ${hasRejectionCommentError ? 'text-red-600' : ''} flex-grow transition-all duration-200`}>
                                        <div className="text-[11px] text-gray-400 flex justify-between mb-1.5">
                                            <label htmlFor="rejectionComment" className="text-[11px] font-normal text-gray-500 flex-shrink-0 flex items-center">
                                                <span>Add Comments</span>
                                                {hasRejectionCommentError && <span className="text-red-400 ml-1">*</span>}
                                            </label>
                                            <span className="text-gray-400">{rejectionComment.length}/500</span>
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
                                            className={`w-full px-2.5 py-1.5 border rounded-md text-[11px] font-normal text-gray-700 bg-white transition-all duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 placeholder-gray-300 ${hasRejectionCommentError ? 'border-red-400 bg-red-50 ring-1 ring-red-100' : 'border-gray-200 hover:border-gray-300'} flex-grow min-h-16 resize-y`}
                                            rows="2"
                                            placeholder="Enter comments or rejection reason..."
                                            disabled={shouldDisableField({})}
                                            title={shouldDisableField({}) ? editPermissionMessage : "Enter comments for the invoice"}
                                            maxLength="500"
                                        ></textarea>
                                        {hasRejectionCommentError && (
                                            <div className="mt-1 text-[10px] font-normal text-red-500 flex items-center gap-1">
                                                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                {errors.rejectionComment}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>
                        {/* --- FOOTER: ACTION BUTTONS --- */}
                        <div className="flex justify-end items-center gap-2 px-3 py-2 bg-white border-t border-gray-100 flex-shrink-0 max-sm:flex-col max-sm:items-stretch max-sm:p-3 max-sm:gap-2" data-tour="editor-action-buttons">
                            <div className="flex gap-2 justify-end max-sm:flex-col max-sm:gap-2 max-sm:w-full">
                                {/* Reject Button */}
                                <button
                                    onClick={onReject}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-normal text-[11px] cursor-pointer transition-all duration-150 bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 max-sm:w-full"
                                    disabled={!isFormEditable}
                                    title={!isFormEditable ? editPermissionMessage : "Reject this invoice"}
                                    data-tour="editor-reject-button"
                                >
                                    <X size={13} /> Reject
                                </button>

                                {/* Hold Button */}
                                <button
                                    onClick={onHold}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-normal text-[11px] cursor-pointer transition-all duration-150 bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 max-sm:w-full"
                                    disabled={!isFormEditable}
                                    title={!isFormEditable ? editPermissionMessage : "Hold this invoice"}
                                    data-tour="editor-hold-button"
                                >
                                    <GitCompare size={13} /> On Hold
                                </button>

                                {/* Approve & Upload Button */}
                                <button
                                    onClick={onApproveAndUpload}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-normal text-[11px] cursor-pointer transition-all duration-150 bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 max-sm:w-full"
                                    disabled={!isFormEditable}
                                    title={!isFormEditable ? editPermissionMessage : "Approve and upload this invoice"}
                                    data-tour="editor-approve-button"
                                >
                                    <Check size={13} /> Approve & Upload
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Master Key Search Popup */}
                <MasterKeySearchPopup
                    isOpen={masterKeyPopupOpen}
                    onClose={() => {
                        // Only close the popup — do NOT clear masterKeyPopupField here.
                        // handleMasterKeySelect is responsible for cleanup after a save.
                        setMasterKeyPopupOpen(false);
                        setMasterKeyFieldConfig({ fieldName: '', uniqueKey: '', arrayFieldName: 'lineItems' });
                    }}
                    onSelect={handleMasterKeySelect}
                    fieldName={masterKeyFieldConfig.fieldName}
                    fieldConfig={fieldConfig.find(config => config.field_name === masterKeyFieldConfig.fieldName) || null}
                    uniqueKey={masterKeyFieldConfig.uniqueKey}
                    initialValue={masterKeyPopupField ?
                        (masterKeyPopupField.startsWith('lineItem-') ?
                            // For line item fields, extract index and field name
                            // Format: lineItem-{index}-{fieldName}
                            (() => {
                                const parts = masterKeyPopupField.split('-');
                                if (parts.length === 3) {
                                    const index = parseInt(parts[1]);
                                    const fieldName = parts[2];
                                    // Find which array contains this field by checking arrayTableConfigs
                                    let sourceArray = formData.lineItems;
                                    if (arrayTableConfigs && Object.keys(arrayTableConfigs).length > 0) {
                                        for (const [arrayKey, arrayConfig] of Object.entries(arrayTableConfigs)) {
                                            if (arrayConfig.allFieldNames && arrayConfig.allFieldNames.includes(fieldName)) {
                                                sourceArray = Array.isArray(formData[arrayKey])
                                                    ? formData[arrayKey]
                                                    : formData.lineItems;
                                                break;
                                            }
                                        }
                                    }
                                    return sourceArray && sourceArray[index] ? sourceArray[index][fieldName] : '';
                                }
                                return '';
                            })() :
                            formData[masterKeyPopupField]) :
                        ''}
                />
            </div>
        </div>
    );
};

export default InvoiceFormUI;
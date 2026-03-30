import React, {
    useRef,
    useLayoutEffect,
    useState,
    useEffect,
    useCallback,
} from 'react';
import { FileText, X, Check, ArrowRight, GripVertical } from 'lucide-react';

// Helper function to convert a string to Title Case
const toTitleCase = (str) => {
    if (typeof str !== 'string' || !str) return '';
    return str
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase())
        .replace(/_/g, ' ');
};

const POFormUI = ({
    poData,
    invoiceExtractedData,
    fieldConfig,
    poErrors,
    invoiceErrors,
    lineItemTableHeaders,
    invoiceLineItemTableHeaders,
    lineItemColumnProperties,
    onInvoiceFieldChange,
    onReject,
    onSendToReconciliation,
    onApproveAndUpload,
    rejectionComment,
    setRejectionComment,
    canEditPO,
    isUpdating
}) => {

    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);
    const leftPanelRef = useRef(null);
    const formContainerRef = useRef(null);

    const editPermissionMessage = "You do not have permission to edit this Purchase Order.";

    useLayoutEffect(() => {
        const formPanel = formContainerRef.current;
        if (!formPanel) return;
        const resizeObserver = new ResizeObserver(() => { });
        resizeObserver.observe(formPanel);
        return () => resizeObserver.disconnect();
    }, []);

    const handleMouseMove = useCallback(
        (e) => {
            if (!isDragging || !containerRef.current || !leftPanelRef.current) return;
            requestAnimationFrame(() => {
                const containerRect = containerRef.current.getBoundingClientRect();
                const newLeftWidthPx = Math.max(
                    400,
                    Math.min(e.clientX - containerRect.left, containerRect.width - 450)
                );
                leftPanelRef.current.style.width = `${newLeftWidthPx}px`;
            });
        },
        [isDragging]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    useEffect(() => {
        if (isDragging) {
            document.body.style.cursor = 'col-resize';
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

    // Renders a single form field with label, input, and error message
    const renderFormField = (fieldName, value, error, onFieldChangeHandler, isEditable, fieldType = 'text') => {
        const isRequiredForDisplay = error && error.trim() !== '';
        const hasError = isRequiredForDisplay && isEditable;

        return (
            <div
                key={`${fieldName}-${isEditable ? 'editable' : 'readonly'}`}
                className={`flex flex-col ${hasError ? 'text-red-600' : ''}`}
            >
                <label htmlFor={`${fieldName}-${isEditable ? 'editable' : 'readonly'}`} className="text-xs font-semibold mb-1">
                    {toTitleCase(fieldName)}{' '}
                    {hasError && <span className="text-red-600">*</span>}
                </label>
                <input
                    type={fieldType}
                    id={`${fieldName}-${isEditable ? 'editable' : 'readonly'}`}
                    name={fieldName}
                    value={value ?? ''}
                    onChange={(e) => isEditable && onFieldChangeHandler(fieldName, e.target.value)}
                    className={`px-3 py-2 border rounded-md text-sm ${hasError ? 'border-red-500 bg-red-50' : 'border-gray-300'} ${isEditable ? 'bg-white' : 'bg-gray-100'} ${isEditable ? 'cursor-text' : 'cursor-not-allowed'}`}
                    disabled={!isEditable}
                    title={!isEditable ? `${toTitleCase(fieldName)} (read-only)` : `Edit ${toTitleCase(fieldName)}`}
                    readOnly={!isEditable}
                />
                {hasError && (
                    <div className="text-xs text-red-600 mt-1">{error}</div>
                )}
            </div>
        );
    };

    // Renders the general fields for the PO extracted data
    const renderPoExtractedData = () => {
        // Use poData directly, as POEditor.js is now responsible for flattening the data.
        const generalPoFields = Object.entries(poData || {}).filter(
            ([key, value]) => key !== 'lineItems' && !Array.isArray(value) && typeof value !== 'object' && value !== null
        );

        return (
            <>
                <div className="border-b border-gray-200 pb-4 mb-4">
                    <h4 className="text-lg font-semibold mb-4">General Details</h4>
                    <div className="grid grid-cols-3 gap-4 gap-y-6">
                        {generalPoFields.map(([fieldName, value]) =>
                            renderFormField(fieldName, value, '', null, false, typeof value === 'number' ? 'number' : 'text')
                        )}
                    </div>
                </div>

                {poData?.lineItems && poData.lineItems.length > 0 && (
                    <div className="border-b border-gray-200 pb-4 mb-4">
                        <h4 className="text-lg font-semibold mb-4">Itemized Details</h4>
                        {renderPoLineItemsTable()}
                    </div>
                )}
            </>
        );
    };

    // Renders the line item table for the PO data
    const renderPoLineItemsTable = () => {
        const lineItems = poData?.lineItems || [];
        if (lineItems.length === 0) return null;

        return (
            <div className="overflow-auto max-h-80 border border-gray-300 rounded-md">
                <table className="min-w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-100">
                            {lineItemTableHeaders.map((headerKey) => {
                                // Try to find the display name from column properties or fall back to title case
                                const columnProp = lineItemColumnProperties[headerKey];
                                const displayName = columnProp?.display_name || columnProp?.title || toTitleCase(headerKey);
                                return (
                                    <th key={headerKey} className="p-2 text-left text-sm font-semibold border border-gray-300">
                                        {displayName}
                                    </th>
                                );
                            })}
                        </tr>

                    </thead>
                    <tbody>
                        {lineItems.map((item, itemIndex) => (
                            <tr key={itemIndex} className={itemIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {lineItemTableHeaders.map((headerKey) => (
                                    <td key={`${itemIndex}-${headerKey}`} className="p-2 border border-gray-300">
                                        <input
                                            type="text"
                                            value={item[headerKey] ?? ''}
                                            className="w-full px-2 py-1 text-sm border border-transparent bg-transparent cursor-not-allowed"
                                            disabled={true}
                                            readOnly={true}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Renders the general fields for the invoice extracted data
    const renderInvoiceExtractedData = () => {
        if (!invoiceExtractedData || Object.keys(invoiceExtractedData).length === 0) {
            return (
                <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                    <FileText size={48} />
                    <p className="mt-4">No extracted invoice data found.</p>
                </div>
            );
        }

        const generalInvoiceFields = fieldConfig.filter(
            (f) => !f.parent && !Array.isArray(invoiceExtractedData[f.field_name])
        ).sort((a, b) => {
            // Sort by sequence field if available, otherwise put at the end
            const seqA = a.sequence ?? 999999;
            const seqB = b.sequence ?? 999999;
            return seqA - seqB;
        });

        return (
            <div className="space-y-6">
                <div className="border-b border-gray-200 pb-4">
                    <h4 className="text-lg font-semibold mb-4">General Details</h4>
                    <div className="grid grid-cols-3 gap-4 gap-y-6">
                        {generalInvoiceFields.map((config) =>
                            renderFormField(config.field_name, invoiceExtractedData[config.field_name], invoiceErrors[config.field_name], onInvoiceFieldChange, canEditPO, config.field_type)
                        )}
                    </div>
                </div>

                {invoiceExtractedData.lineItems && invoiceExtractedData.lineItems.length > 0 && (
                    <div className="border-b border-gray-200 pb-4">
                        <h4 className="text-lg font-semibold mb-4">Itemized Details</h4>
                        {renderInvoiceLineItemsTable()}
                    </div>
                )}
            </div>
        );
    };

    // Renders the line item table for the invoice data
    const renderInvoiceLineItemsTable = () => {
        const lineItems = invoiceExtractedData?.lineItems || [];
        if (lineItems.length === 0) return null;

        const headers = invoiceLineItemTableHeaders; // Using the new prop to get ordered headers
        const hasErrors = invoiceErrors.lineItems && invoiceErrors.lineItems.length > 0;

        return (
            <div className="overflow-auto max-h-80 border border-gray-300 rounded-md">
                <table className="min-w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-100">
                            {headers.map((headerKey) => {
                                // Try to find the display name from column properties or fall back to title case
                                const columnProp = lineItemColumnProperties[headerKey];
                                const displayName = columnProp?.display_name || columnProp?.title || toTitleCase(headerKey);
                                return (
                                    <th key={headerKey} className="p-2 text-left text-sm font-semibold border border-gray-300">
                                        {displayName}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {lineItems.map((item, itemIndex) => (
                            <tr key={itemIndex} className={itemIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {headers.map((headerKey) => {
                                    const itemError = hasErrors ? invoiceErrors.lineItems?.[itemIndex]?.[headerKey] : null;
                                    const hasItemError = itemError && itemError.trim() !== '';

                                    return (
                                        <td key={`${itemIndex}-${headerKey}`} className={`p-2 border border-gray-300 ${hasItemError ? 'text-red-600' : ''}`}>
                                            <input
                                                type="text"
                                                value={item[headerKey] ?? ''}
                                                className={`w-full px-2 py-1 text-sm ${hasItemError ? 'border-red-500 bg-red-50' : 'border border-transparent'} bg-transparent`}
                                                // disabled={true}
                                                // readOnly={true}
                                            />
                                            {hasItemError && (
                                                <p className="text-xs text-red-600 mt-1">{itemError}</p>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const hasRejectionCommentError = poErrors.rejectionComment && poErrors.rejectionComment.trim() !== '';

    return (
        <div className="p-4 h-[calc(100vh-60px)]">
            {isDragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
            <div className="flex h-full max-w-auto mx-auto border border-gray-300 rounded-xl shadow-lg overflow-hidden" ref={containerRef}>
                <div className="flex flex-col h-full bg-white border-r border-gray-300" ref={leftPanelRef} style={{ width: '45%' }}>
                    <div className="flex items-center justify-between p-4 bg-gray-800 text-white">
                        <h3 className="flex items-center text-lg font-semibold">
                            <FileText size={16} className="mr-2" /> Invoice Extracted Data
                        </h3>
                    </div>
                    <div className="flex-1 p-4 overflow-auto bg-white">
                        {renderInvoiceExtractedData()}
                    </div>
                </div>

                <div 
                    className="flex items-center justify-center w-4 cursor-col-resize bg-gray-100 hover:bg-gray-200 relative"
                    onMouseDown={handleDividerMouseDown}
                >
                    <div className="p-1 bg-white border border-gray-300 rounded-md shadow-sm text-gray-500">
                        <GripVertical size={16} />
                    </div>
                </div>

                <div className="flex flex-col flex-1 h-full bg-white">
                    <div ref={formContainerRef} className="flex flex-col h-full">
                        <div className="p-4 bg-gray-100 border-b border-gray-300">
                            <h3 className="text-lg font-semibold">PO Details</h3>
                        </div>
                        <div className="flex-1 p-4 overflow-auto bg-white">
                            <div className="space-y-6">
                                {renderPoExtractedData()}
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-gray-100 border-t border-gray-300">
                            <button 
                                className="flex items-center px-4 py-2 font-semibold text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={onReject} 
                                disabled={!canEditPO || hasRejectionCommentError}
                            >
                                <X size={16} className="mr-2" /> Reject
                            </button>
                            <div className="flex gap-3">
                                <button 
                                    className="flex items-center px-4 py-2 font-semibold text-white bg-gray-500 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={onSendToReconciliation} 
                                    disabled={!canEditPO}
                                >
                                    <ArrowRight size={16} className="mr-2" /> Approve & Send to Reconciliation
                                </button>
                                <button 
                                    className="flex items-center px-4 py-2 font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={onApproveAndUpload} 
                                    disabled={!canEditPO}
                                >
                                    <Check size={16} className="mr-2" /> Approve & Upload
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default POFormUI;
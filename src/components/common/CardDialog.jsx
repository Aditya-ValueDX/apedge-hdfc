import React, { useEffect, useState, useRef } from 'react';
import { X, AlertCircle, CheckCircle, GripHorizontal } from 'lucide-react';
import classNames from 'classnames';

/**
 * Compact CardDialog - small modal with a single text input (or textarea) and Update / Cancel buttons.
 * Props:
 *  - isOpen: boolean
 *  - title: string
 *  - value: string
 *  - placeholder: string
 *  - isEditable: boolean
 *  - onRequestClose: () => void
 *  - onUpdate: (newValue) => void
 *  - onChange: (newValue) => void (optional)
 *  - isError: boolean (optional)
 *  - dataTourPrefix: string (optional) - prefix for data-tour attributes
 *  - contentType: 'text' | 'javascript'
 */
const CardDialog = ({
    isOpen,
    title = '',
    value = '',
    validationForField = '',
    placeholder = '',
    isEditable = true,
    onRequestClose = () => { },
    onUpdate = () => { },
    onChange,
    isError = false,
    dataTourPrefix = 'card-dialog',
    contentType = 'text',
}) => {

    const [localValue, setLocalValue] = useState(value || '');
    const [syntaxValid, setSyntaxValid] = useState(true);
    const [syntaxError, setSyntaxError] = useState('');
    const [showTemplates, setShowTemplates] = useState(false);

    // Draggable state
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const dialogRef = useRef(null);

    // expose variable name used inside editor (field-specific or generic 'value')
    const variableName = validationForField || 'value';

    // Reset position when dialog opens
    useEffect(() => {
        if (isOpen) {
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen]);

    useEffect(() => {
        setLocalValue(value || '');
    }, [value, isOpen]);

    // Handle mouse move for dragging
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;

            setPosition({
                x: position.x + deltaX,
                y: position.y + deltaY
            });

            setDragStart({ x: e.clientX, y: e.clientY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart, position]);

    const handleMouseDown = (e) => {
        // Only start dragging if clicking on the header (not on the close button)
        if (e.target.closest('button')) return;

        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    // Validate JavaScript syntax
    useEffect(() => {
        if (contentType === 'javascript' && localValue.trim()) {
            try {
                // Try to parse the function
                // Create function with the correct parameter name (either field-specific name or 'value')
                const func = new Function(variableName, 'field', localValue);

                // Test the function with multiple test cases to ensure proper return format
                // Use realistic test cases that match common validation scenarios
                const testCases = [
                    { value: 'test string', field: {} },
                    { value: '', field: {} },
                    { value: '0', field: {} },
                    { value: '123', field: {} },
                ];

                for (const testCase of testCases) {
                    try {
                        // Always pass the sample value as the first argument regardless of its parameter name
                        const testResult = func(testCase.value, testCase.field);

                        // Must return an object
                        if (!testResult || typeof testResult !== 'object') {
                            setSyntaxValid(false);
                            setSyntaxError('Validation rule must always return an object with { valid, message }');
                            return;
                        }

                        // Must have 'valid' property
                        if (!('valid' in testResult)) {
                            setSyntaxValid(false);
                            setSyntaxError('Return object must have "valid" property');
                            return;
                        }

                        // 'valid' must be a boolean
                        if (typeof testResult.valid !== 'boolean') {
                            setSyntaxValid(false);
                            setSyntaxError(`"valid" must be a boolean, got ${typeof testResult.valid}`);
                            return;
                        }

                        // When valid is false, message is required
                        if (testResult.valid === false) {
                            if (!('message' in testResult)) {
                                setSyntaxValid(false);
                                setSyntaxError('When valid is false, "message" property is required');
                                return;
                            }
                            if (typeof testResult.message !== 'string') {
                                setSyntaxValid(false);
                                setSyntaxError(`"message" must be a string, got ${typeof testResult.message}`);
                                return;
                            }
                            if (testResult.message.trim() === '') {
                                setSyntaxValid(false);
                                setSyntaxError('"message" cannot be empty when valid is false');
                                return;
                            }
                        }

                        // Only allow 'valid' and 'message' properties
                        const allowedKeys = ['valid', 'message'];
                        const resultKeys = Object.keys(testResult);
                        const invalidKeys = resultKeys.filter(key => !allowedKeys.includes(key));
                        if (invalidKeys.length > 0) {
                            setSyntaxValid(false);
                            setSyntaxError(`Unexpected properties: ${invalidKeys.join(', ')}. Only "valid" and "message" are allowed`);
                            return;
                        }

                    } catch (runtimeError) {
                        setSyntaxValid(false);
                        setSyntaxError(`Runtime error: ${runtimeError.message}`);
                        return;
                    }
                }

                setSyntaxValid(true);
                setSyntaxError('');
            } catch (error) {
                setSyntaxValid(false);
                setSyntaxError(`Syntax error: ${error.message}`);
            }
        } else {
            setSyntaxValid(true);
            setSyntaxError('');
        }
    }, [localValue, contentType]);

    if (!isOpen) return null;

    const handleUpdate = () => {
        if (contentType === 'javascript' && !syntaxValid) {
            return; // Don't allow update if syntax is invalid
        }
        onUpdate(localValue);
    };

    const handleCancel = () => {
        setLocalValue(value || '');
        onRequestClose();
    };

    const handleChange = (e) => {
        setLocalValue(e.target.value);
        if (typeof onChange === 'function') onChange(e.target.value);
    };

    const handleKeyDown = (e) => {
        if (contentType === 'javascript') {
            // Handle Tab key for indentation
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const newValue = localValue.substring(0, start) + '  ' + localValue.substring(end);
                setLocalValue(newValue);
                if (typeof onChange === 'function') onChange(newValue);

                setTimeout(() => {
                    e.target.selectionStart = e.target.selectionEnd = start + 2;
                }, 0);
            }
        }
    };

    const insertTemplate = (template) => {
        setLocalValue(template);
        if (typeof onChange === 'function') onChange(template);
    };
    // Validation rule templates
    const validationTemplates = [
        {
            name: 'Required Field',
            code: `// Check if field is not empty
if (!${variableName} || ${variableName}.trim() === '') {
  return { valid: false, message: 'This field is required' };
}
return { valid: true };`
        },
        {
            name: 'Invoice Number',
            code: `// Validate invoice number format (INV/2024/001)
const invoiceRegex = /^[A-Z]{2,4}\/\\d{4}\/\\d{3,6}$/;
if (!invoiceRegex.test(${variableName})) {
  return { valid: false, message: 'Invalid invoice format. Use: INV/2024/001' };
}
return { valid: true };`
        },
        {
            name: 'Amount Validation',
            code: `// Validate monetary amount (positive numbers with up to 2 decimals)
const amount = parseFloat(${variableName});
if (isNaN(amount)) {
  return { valid: false, message: 'Must be a valid number' };
}
if (amount <= 0) {
  return { valid: false, message: 'Amount must be greater than zero' };
}
if (!/^\\d+(\\.\\d{1,2})?$/.test(${variableName})) {
  return { valid: false, message: 'Amount must have maximum 2 decimal places' };
}
return { valid: true };`
        },
        {
            name: 'GST Number (India)',
            code: `// Validate Indian GST number (15 characters)
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
if (!gstRegex.test(${variableName})) {
  return { valid: false, message: 'Invalid GST number format' };
}
return { valid: true };`
        },
        {
            name: 'PAN Number (India)',
            code: `// Validate Indian PAN number
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
if (!panRegex.test(${variableName})) {
  return { valid: false, message: 'Invalid PAN format. Use: ABCDE1234F' };
}
return { valid: true };`
        },
        {
            name: 'Date Format (DD/MM/YYYY)',
            code: `// Validate date format
const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\\/(0[1-9]|1[012])\\/\\d{4}$/;
if (!dateRegex.test(${variableName})) {
  return { valid: false, message: 'Invalid date. Use DD/MM/YYYY format' };
}
// Check if date is valid
const [day, month, year] = ${variableName}.split('/').map(Number);
const date = new Date(year, month - 1, day);
if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
  return { valid: false, message: 'Invalid date value' };
}
return { valid: true };`
        },
        {
            name: 'Percentage Value',
            code: `// Validate percentage (0-100)
const percent = parseFloat(${variableName});
if (isNaN(percent)) {
  return { valid: false, message: 'Must be a valid number' };
}
if (percent < 0 || percent > 100) {
  return { valid: false, message: 'Percentage must be between 0 and 100' };
}
return { valid: true };`
        },
        {
            name: 'Account Code',
            code: `// Validate account code (alphanumeric, 4-10 chars)
const accountRegex = /^[A-Z0-9]{4,10}$/;
if (!accountRegex.test(${variableName})) {
  return { valid: false, message: 'Account code must be 4-10 alphanumeric characters' };
}
return { valid: true };`
        },
        {
            name: 'HSN/SAC Code',
            code: `// Validate HSN (4-8 digits) or SAC (6 digits) code
const hsnSacRegex = /^\\d{4,8}$/;
if (!hsnSacRegex.test(${variableName})) {
  return { valid: false, message: 'Invalid HSN/SAC code. Must be 4-8 digits' };
}
return { valid: true };`
        },
        {
            name: 'IFSC Code',
            code: `// Validate Indian IFSC code
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
if (!ifscRegex.test(${variableName})) {
  return { valid: false, message: 'Invalid IFSC code format' };
}
return { valid: true };`
        },
        {
            name: 'Ledger Name',
            code: `// Validate ledger name (alphanumeric with spaces, hyphens)
if (${variableName}.length < 3) {
  return { valid: false, message: 'Ledger name must be at least 3 characters' };
}
if (${variableName}.length > 100) {
  return { valid: false, message: 'Ledger name must not exceed 100 characters' };
}
const ledgerRegex = /^[A-Za-z0-9\\s\\-\\/&.,()]+$/;
if (!ledgerRegex.test(${variableName})) {
  return { valid: false, message: 'Invalid characters in ledger name' };
}
return { valid: true };`
        },
        {
            name: 'Tax Rate',
            code: `// Validate tax rate (common rates: 0, 5, 12, 18, 28)
const taxRate = parseFloat(${variableName});
if (isNaN(taxRate)) {
  return { valid: false, message: 'Must be a valid number' };
}
const validRates = [0, 0.25, 3, 5, 12, 18, 28];
if (!validRates.includes(taxRate)) {
  return { valid: false, message: 'Invalid tax rate. Common rates: 0, 5, 12, 18, 28' };
}
return { valid: true };`
        },
        {
            name: 'Voucher Number',
            code: `// Validate voucher number format
const voucherRegex = /^[A-Z]{2,4}-\\d{4,8}$/;
if (!voucherRegex.test(${variableName})) {
  return { valid: false, message: 'Invalid voucher format. Use: JV-00001' };
}
return { valid: true };`
        },
        {
            name: 'Financial Year',
            code: `// Validate financial year format (2023-24)
const fyRegex = /^\\d{4}-\\d{2}$/;
if (!fyRegex.test(${variableName})) {
  return { valid: false, message: 'Invalid format. Use: 2023-24' };
}
const [startYear, endYear] = ${variableName}.split('-').map(Number);
if (endYear !== (startYear + 1) % 100) {
  return { valid: false, message: 'Invalid financial year sequence' };
}
return { valid: true };`
        },
        {
            name: 'Quantity',
            code: `// Validate quantity (positive number)
const qty = parseFloat(${variableName});
if (isNaN(qty)) {
  return { valid: false, message: 'Must be a valid number' };
}
if (qty <= 0) {
  return { valid: false, message: 'Quantity must be greater than zero' };
}
if (qty > 999999) {
  return { valid: false, message: 'Quantity exceeds maximum limit' };
}
return { valid: true };`
        }
    ];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
            <div
                ref={dialogRef}
                className={classNames('w-full bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col', {
                    'max-w-xl': contentType === 'text',
                    'max-w-4xl': contentType !== 'text'
                })}
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    cursor: isDragging ? 'grabbing' : 'default',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="card-dialog-title"
            >
                <div
                    className="flex items-center justify-between px-4 py-3 border-b border-gray-200 cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex items-center gap-2">
                        <GripHorizontal size={18} className="text-gray-400" />
                        <h3 id="card-dialog-title" className="text-lg font-semibold text-gray-800">
                            {title}
                        </h3>
                    </div>
                    <button
                        className="p-1 text-gray-500 hover:text-gray-800"
                        onClick={handleCancel}
                        aria-label="Close dialog"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className={classNames("grid gap-4 p-4", {
                        "grid-cols-1": !showTemplates || contentType !== 'javascript',
                        "grid-cols-3": showTemplates && contentType === 'javascript'
                    })}>
                        {/* Templates Sidebar (only when expanded and JavaScript mode) */}
                        {showTemplates && contentType === 'javascript' && isEditable && (
                            <div className="col-span-1 border-r border-gray-200 pr-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-gray-700">Quick Templates</h4>
                                </div>
                                <div className="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
                                    {validationTemplates.map((template, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => insertTemplate(template.code)}
                                            className="w-full text-gray-800 text-left px-3 py-2 text-sm bg-gray-50 hover:bg-blue-50 rounded-md border border-gray-200 hover:border-blue-300 transition-colors"
                                        >
                                            {template.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                                    <p className="text-xs text-blue-800 font-semibold mb-1">💡 Return Format</p>
                                    <p className="text-xs text-blue-700 mb-2">Your validation rule must return an object with:</p>
                                    <ul className="text-xs text-blue-700 space-y-1 mb-2">
                                        <li>• valid - boolean (true/false)</li>
                                        <li>• message - string (required when valid is false)</li>
                                    </ul>
                                    <div className="mt-2 pt-2 border-t border-blue-200">
                                        <p className="text-xs text-blue-600 font-mono">return {'{'} valid: false, message: 'Error text' {'}'};</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Editor Area */}
                        <div className={classNames({
                            "col-span-1": !showTemplates || contentType !== 'javascript',
                            "col-span-2": showTemplates && contentType === 'javascript'
                        })}>
                            {contentType === 'javascript' ? (
                                <div>
                                    {/* Field Name Note */}
                                    {validationForField && (
                                        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                                            <p className="text-xs text-blue-800">
                                                <span className="font-semibold">Validation code for:</span>{' '}
                                                <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-blue-900">
                                                    {validationForField || 'N/A'}
                                                </code>
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                                JavaScript Editor
                                            </span>
                                            {syntaxValid && localValue.trim() && (
                                                <span className="flex items-center gap-1 text-xs text-green-600">
                                                    <CheckCircle size={14} />
                                                    Valid
                                                </span>
                                            )}
                                            {!syntaxValid && localValue.trim() && (
                                                <span className="flex items-center gap-1 text-xs text-red-600">
                                                    <AlertCircle size={14} />
                                                    Syntax Error
                                                </span>
                                            )}
                                        </div>
                                        {isEditable && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">
                                                    Use Tab for indentation
                                                </span>
                                                <button
                                                    onClick={() => setShowTemplates(prev => !prev)}
                                                    className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                                                    aria-pressed={showTemplates}
                                                >
                                                    {showTemplates ? 'Hide Templates' : 'Show Templates'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative rounded-lg border border-gray-300 bg-gray-900 shadow-inner overflow-hidden">
                                        {/* Line numbers */}
                                        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-800 border-r border-gray-700 pt-3 pb-3 pr-2 text-right overflow-hidden z-20">
                                            {(localValue || '\n').split('\n').map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="text-xs text-gray-500 leading-6 font-mono select-none"
                                                    style={{ height: '24px' }}
                                                >
                                                    {i + 1}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Code editor textarea */}
                                        <div className="relative">
                                            <textarea
                                                data-tour={`${dataTourPrefix}-code-editor`}
                                                className="w-full min-h-[300px] pl-14 pr-4 py-3 bg-transparent text-gray-300 text-sm font-mono resize-y focus:outline-none leading-6 relative z-10"
                                                style={{
                                                    tabSize: 2,
                                                    caretColor: '#10b981'
                                                }}
                                                placeholder={placeholder || `// Write validation rule here...
// Available variables: ${variableName}, field

if (!${variableName}) {
  return { valid: false, message: 'Field is required' };
}
return { valid: true };`}
                                                value={localValue}
                                                onChange={handleChange}
                                                onKeyDown={handleKeyDown}
                                                disabled={!isEditable}
                                                spellCheck={false}
                                                aria-label="JavaScript editor"
                                            />
                                        </div>
                                    </div>
                                    {!syntaxValid && syntaxError && (
                                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                                            <p className="text-xs text-red-700 font-mono">
                                                {syntaxError}
                                            </p>
                                        </div>
                                    )}
                                    {showTemplates && (
                                        <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                                            <p className="text-xs text-gray-700 mb-2 font-semibold">Available Variables:</p>
                                            <ul className="text-xs text-gray-600 space-y-1">
                                                <li><code className="bg-gray-200 px-1 rounded">{variableName}</code> - The current field value (always a string)</li>
                                            </ul>
                                            <p className="text-xs text-gray-500 mt-2">
                                                💡 The <code className="bg-gray-200 px-1 rounded">{variableName}</code> parameter will always be a string, including empty strings. Handle empty values with <code className="bg-gray-200 px-1 rounded">!{variableName}</code> or <code className="bg-gray-200 px-1 rounded">{variableName}.trim() === ''</code>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <textarea
                                    data-tour={`${dataTourPrefix}-textarea`}
                                    className={classNames(
                                        'w-full min-h-[210px] p-3 rounded-md border text-black text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                                        { 'border-red-400 bg-red-50 focus:ring-red-500': isError, 'border-gray-300': !isError }
                                    )}
                                    placeholder={placeholder}
                                    value={localValue}
                                    onChange={handleChange}
                                    disabled={!isEditable}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {isEditable && (
                    <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-100">
                        <button
                            data-tour={`${dataTourPrefix}-cancel`}
                            type="button"
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                            onClick={handleCancel}
                        >
                            Cancel
                        </button>
                        <button
                            data-tour={`${dataTourPrefix}-update`}
                            type="button"
                            className={classNames(
                                "px-4 py-2 text-white bg-gradient-to-r from-blue-500 to-indigo-600 border border-transparent rounded-md transition-colors",
                                {
                                    "opacity-50 cursor-not-allowed":
                                        !syntaxValid && contentType === "javascript",
                                }
                            )}
                            onClick={handleUpdate}
                            disabled={!isEditable || (contentType === "javascript" && !syntaxValid)}
                        >
                            Confirm
                        </button>

                    </div>
                )}
            </div>
        </div>
    );
};

export default CardDialog;
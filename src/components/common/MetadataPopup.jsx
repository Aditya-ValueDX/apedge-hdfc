import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Trash2, Save, Eye, EyeOff, AlignLeft, SquareArrowOutUpRight, CheckCircle, AlertCircle, WrapText } from 'lucide-react';

// Metadata Display Component
const MetadataDisplay = ({ metadata, onEdit, disabled }) => {
    // Count the number of key-value pairs in the metadata
    const getCount = () => {
        // Handle the nested metadata structure
        let metadataStr = metadata;
        if (metadata && typeof metadata === 'object' && metadata.value) {
            metadataStr = metadata.value;
        }

        // Check if metadata is an empty object string
        if (metadataStr === '{}' || metadataStr === 'null' || metadataStr === 'undefined' || !metadataStr) return 0;

        try {
            const parsed = JSON.parse(metadataStr);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                // If it's an object with only file_type property, count as 1 (consistent with table display)
                const keys = Object.keys(parsed);
                if (keys.length === 1 && keys[0] === 'file_type') {
                    return 1;
                }
                return keys.length;
            } else if (Array.isArray(parsed)) {
                // If it's an array, count the elements
                return parsed.length;
            }
            // If it's a primitive value, count as 1 entry
            return 1;
        } catch (e) {
            // If not valid JSON, but we have a string, count as 1 entry
            if (metadataStr && typeof metadataStr === 'string' && metadataStr.trim() !== '') {
                return 1;
            }
            return 0;
        }
    };

    const count = getCount();

    return (
        <div
            className={`flex items-center justify-between relative px-2.5 py-1.5 border border-gray-300 rounded text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed bg-white w-full h-8 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={!disabled ? onEdit : undefined}
        >
            <span className="flex-grow overflow-hidden whitespace-nowrap text-ellipsis pr-6 text-xs text-gray-700">
                {count === 0 ? 'No entries' : `${count} ${count === 1 ? 'entry' : 'entries'}`}
            </span>
            <SquareArrowOutUpRight size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500/80" />
        </div>
    );
};

// ---------------------------------------------------------------------------
// WorkflowJsonEditor — dark-themed JSON editor with line numbers,
// error-line highlighting, and auto-format on load/blur.
// Only rendered when uniqueKey === 'vendor_workflow_json'.
// ---------------------------------------------------------------------------
const WorkflowJsonEditor = ({ value, onChange, isEditable, hasError, errorLine, errorLines = [] }) => {
    const textareaRef = useRef(null);
    const gutterRef = useRef(null);

    const lines = (value || '\n').split('\n');
    const totalLines = lines.length;

    // Build a Set of all error line numbers for O(1) lookup
    const errorLineSet = new Set(
        [errorLine, ...errorLines].filter(n => typeof n === 'number' && n > 0)
    );

    // Sync gutter scroll with textarea scroll
    const handleScroll = useCallback((e) => {
        if (gutterRef.current) {
            gutterRef.current.scrollTop = e.target.scrollTop;
        }
    }, []);

    // Auto-format valid JSON
    const handleBlur = useCallback(() => {
        if (!isEditable) return;
        const trimmed = (value || '').trim();
        if (!trimmed) return;
        try {
            const formatted = JSON.stringify(JSON.parse(trimmed), null, 2);
            if (formatted !== value) onChange(formatted);
        } catch {
            // leave as-is if invalid
        }
    }, [value, onChange, isEditable]);

    // Tab key inserts 2 spaces
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.target;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newVal = value.substring(0, start) + '  ' + value.substring(end);
            onChange(newVal);
            setTimeout(() => {
                ta.selectionStart = ta.selectionEnd = start + 2;
            }, 0);
        }
    }, [value, onChange]);

    return (
        <div className="relative rounded-lg border border-gray-700 bg-gray-900 shadow-inner overflow-hidden" style={{ minHeight: '320px' }}>
            {/* Gutter with line numbers */}
            <div
                ref={gutterRef}
                className="absolute left-0 top-0 bottom-0 overflow-hidden pointer-events-none z-20"
                style={{ width: '48px' }}
                aria-hidden="true"
            >
                <div className="bg-gray-800 border-r border-gray-700 h-full pt-3 pb-3 pr-2 text-right">
                    {Array.from({ length: totalLines }, (_, i) => {
                        const lineNum = i + 1;
                        const isErrorLine = errorLineSet.has(lineNum);
                        return (
                            <div
                                key={i}
                                className={`text-xs leading-6 font-mono select-none ${isErrorLine ? 'text-red-400 bg-red-900/40' : 'text-gray-500'}`}
                                style={{ height: '24px' }}
                            >
                                {lineNum}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Textarea */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={!isEditable}
                spellCheck={false}
                data-tour="workflow-json-editor"
                placeholder={"{\n  \"meta\": {},\n  \"steps\": []\n}"}
                className={`w-full bg-transparent text-gray-200 text-sm font-mono resize-y focus:outline-none leading-6 disabled:cursor-not-allowed ${hasError ? 'caret-red-400' : 'caret-emerald-400'}`}
                style={{
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    paddingLeft: '56px',
                    paddingRight: '16px',
                    minHeight: '320px',
                    tabSize: 2,
                }}
                aria-label="Workflow JSON editor"
            />
        </div>
    );
};

const MetadataPopup = ({
    isOpen,
    onClose,
    onSave,
    metadata = '', // Changed default from '{}' to ''
    isEditable = true,
    title = "Metadata Editor",
    readOnlyTitle = "Metadata Viewer",
    configType, // Added prop for config type
    fileType, // Added prop for file type
    onFileTypeChange, // Added prop for file type change handler
    uniqueKey, // The parameter's unique_key — drives editor mode
    vendorFieldConfig = [], // Array of vendor field config objects for field validation
}) => {
    // Show the rich JSON editor when this parameter is the workflow config key
    const isWorkflowJson = uniqueKey === 'vendor_workflow_json';

    // Extract the actual metadata string from nested structure
    const extractMetadataString = (metadata, isEditableMode = isEditable) => {
        if (metadata && typeof metadata === 'object' && metadata.value) {
            metadata = metadata.value;
        }

        // If metadata is an empty object string, return empty string instead
        if (metadata === '{}' || metadata === 'null' || metadata === 'undefined') {
            return '';
        }

        // For editable mode, we want to show just the user-entered content (without file_type prefix)
        if (isEditableMode) {
            if (typeof metadata === 'string' && metadata.trim() !== '') {
                // Check if it starts with file_type: and remove that part for editing
                const lines = metadata.split('\n');
                if (lines.length > 0 && lines[0].startsWith('file_type: ')) {
                    // Return the remaining content without the file_type line
                    return lines.slice(1).join('\n');
                }
            }
            return metadata || '';
        }

        // For readonly mode, return as is
        return metadata || '';
    };

    const [metadataText, setMetadataText] = useState(extractMetadataString(metadata, isEditable));
    const [jsonError, setJsonError] = useState('');
    const [workflowErrors, setWorkflowErrors] = useState([]);

    // Validate whether a string is valid JSON (non-empty strings must be valid JSON)
    const validateJson = (text) => {
        const trimmed = text.trim();
        // Empty input is always valid (no JSON required)
        if (!trimmed) return '';
        try {
            JSON.parse(trimmed);
            return '';
        } catch (e) {
            return `Invalid JSON: ${e.message}`;
        }
    };

    // ---------------------------------------------------------------------------
    // Validates workflow config JSON for next_step integrity.
    // Checks every transition in every step and ensures its dataUpdates.next_step:
    //   - is present (not missing / undefined)
    //   - is not null, empty string, or whitespace-only
    //   - actually exists as a stepId in the steps array (mismatch check)
    //
    // Returns an array of human-readable error strings (empty = no errors).
    // Only runs when the parsed JSON looks like a workflow config (has `steps`).
    // ---------------------------------------------------------------------------
    const validateWorkflowConfig = (text) => {
        const trimmed = text.trim();
        if (!trimmed) return [];

        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            // JSON syntax errors are already caught by validateJson; skip here
            return [];
        }

        // Only validate if this looks like a workflow config (has a steps array)
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.steps)) {
            return [];
        }

        const steps = parsed.steps;
        const validStepIds = new Set(steps.map(s => s.stepId).filter(Boolean));
        const errors = [];

        // Build a set of valid field names from vendorFieldConfig (case-sensitive)
        const validFieldNames = new Set(
            (vendorFieldConfig || []).map(f => f.field_name).filter(Boolean)
        );
        const hasVendorConfig = validFieldNames.size > 0;

        // ── Build a map of field_name → parent for tab/array ancestor resolution ──
        // This allows us to walk up the hierarchy for any field and check
        // whether any ancestor tab or array field is listed in fields.hidden.
        // e.g. contact_person → group (tab) → "" (root)
        //      account_no → name_of_beneficiary (tab) → group (tab) → "" (root)
        //      IFSC_code → branch (array) → "" (root)
        const fieldParentMap = {};
        const tabFieldNames = new Set();
        const arrayFieldNames = new Set(); // dynamically built from vendorFieldConfig
        (vendorFieldConfig || []).forEach((f) => {
            if (f.field_name) {
                fieldParentMap[f.field_name] = f.parent || '';
                if (f.field_type === 'tab') {
                    tabFieldNames.add(f.field_name);
                }
                if (f.field_type === 'array') {
                    arrayFieldNames.add(f.field_name);
                }
            }
        });

        // Returns the chain of ancestor tab field_names for a given field.
        // e.g. getAncestorTabs("account_no") → ["name_of_beneficiary", "group"]
        const getAncestorTabs = (fieldName) => {
            const ancestors = [];
            let current = fieldParentMap[fieldName];
            const visited = new Set(); // guard against circular refs
            while (current && current !== '' && !visited.has(current)) {
                visited.add(current);
                if (tabFieldNames.has(current)) {
                    ancestors.push(current);
                }
                current = fieldParentMap[current] || '';
            }
            return ancestors;
        };

        // Returns the chain of ancestor array field_names for a given field.
        // Array fields render as repeatable row-tables (e.g. "branch" → IFSC_code, residential_status, etc.)
        // When an array field is hidden, ALL its child fields become inaccessible.
        // e.g. getAncestorArrayFields("IFSC_code") → ["branch"]
        const getAncestorArrayFields = (fieldName) => {
            const ancestors = [];
            let current = fieldParentMap[fieldName];
            const visited = new Set(); // guard against circular refs
            while (current && current !== '' && !visited.has(current)) {
                visited.add(current);
                if (arrayFieldNames.has(current)) {
                    ancestors.push(current);
                }
                current = fieldParentMap[current] || '';
            }
            return ancestors;
        };

        steps.forEach((step) => {
            const stepLabel = step.stepName
                ? `"${step.stepName}" (${step.stepId})`
                : `"${step.stepId}"`;

            // ── Field config validations for step.fields ──────────────────────
            if (step.fields && hasVendorConfig) {
                const readonlyFields = Array.isArray(step.fields.readonly) ? step.fields.readonly : [];
                const hiddenFields = Array.isArray(step.fields.hidden) ? step.fields.hidden : [];

                // Check readonly fields exist in vendor config
                readonlyFields.forEach((fieldName) => {
                    if (!validFieldNames.has(fieldName)) {
                        errors.push(
                            `Step ${stepLabel} → fields.readonly: "${fieldName}" does not exist in vendor field configuration.`
                        );
                    }
                });

                // Check hidden fields exist in vendor config
                hiddenFields.forEach((fieldName) => {
                    if (!validFieldNames.has(fieldName)) {
                        errors.push(
                            `Step ${stepLabel} → fields.hidden: "${fieldName}" does not exist in vendor field configuration.`
                        );
                    }
                });

                // Check for fields that appear in BOTH readonly and hidden — must be unique across both lists
                const readonlySet = new Set(readonlyFields);
                hiddenFields.forEach((fieldName) => {
                    if (readonlySet.has(fieldName)) {
                        errors.push(
                            `Step ${stepLabel} → fields: "${fieldName}" cannot be in both readonly and hidden — fields must be unique across both lists.`
                        );
                    }
                });

                // ── New: Parent (tab/array) readonly/hidden conflict with fieldrequired ──
                // Build the complete set of child fields that appear in fieldrequired
                // across ALL transitions of this step.
                const allRequiredChildFields = new Set();
                const transitions = Array.isArray(step.transitions) ? step.transitions : [];
                transitions.forEach((transition) => {
                    const validators = Array.isArray(transition.validators) ? transition.validators : [];
                    validators.forEach((validator) => {
                        const requiredFields = Array.isArray(validator.fieldrequired) ? validator.fieldrequired : [];
                        requiredFields.forEach((fieldName) => {
                            allRequiredChildFields.add(fieldName);
                        });
                    });
                });

                // For each field in readonly or hidden, check if it is a tab or array
                // parent whose children appear in fieldrequired for this step.
                const allConstrainedFields = [
                    ...readonlyFields.map(f => ({ fieldName: f, listName: 'readonly' })),
                    ...hiddenFields.map(f => ({ fieldName: f, listName: 'hidden' })),
                ];

                allConstrainedFields.forEach(({ fieldName, listName }) => {
                    const isTabOrArray =
                        tabFieldNames.has(fieldName) || arrayFieldNames.has(fieldName);
                    if (!isTabOrArray) return; // Only applies to tab/array parents

                    // Find which of this parent's children are in fieldrequired
                    const conflictingChildren = [];
                    allRequiredChildFields.forEach((requiredField) => {
                        // Walk up the parent chain for the required field to see if
                        // fieldName is an ancestor of it.
                        let current = fieldParentMap[requiredField];
                        const visited = new Set();
                        while (current && current !== '' && !visited.has(current)) {
                            visited.add(current);
                            if (current === fieldName) {
                                conflictingChildren.push(requiredField);
                                break;
                            }
                            current = fieldParentMap[current] || '';
                        }
                    });

                    if (conflictingChildren.length > 0) {
                        const childList = conflictingChildren.map(c => `"${c}"`).join(', ');
                        const parentKind = tabFieldNames.has(fieldName) ? 'tab' : 'array';
                        errors.push(
                            `Step ${stepLabel} → fields.${listName}: parent ${parentKind} "${fieldName}" cannot be ${listName} because its child field(s) ${childList} are listed in fieldrequired for this step.`
                        );
                    }
                });
            }

            const transitions = Array.isArray(step.transitions) ? step.transitions : [];

            transitions.forEach((transition) => {
                const actionRef = transition.actionRef || '(unknown action)';
                const dataUpdates = transition.dataUpdates || {};

                // ── fieldrequired validation ───────────────────────────────────
                if (hasVendorConfig) {
                    const validators = Array.isArray(transition.validators) ? transition.validators : [];
                    const readonlyFields = new Set(
                        Array.isArray(step.fields?.readonly) ? step.fields.readonly : []
                    );
                    const hiddenFields = new Set(
                        Array.isArray(step.fields?.hidden) ? step.fields.hidden : []
                    );

                    validators.forEach((validator) => {
                        const requiredFields = Array.isArray(validator.fieldrequired) ? validator.fieldrequired : [];

                        requiredFields.forEach((fieldName) => {
                            // Check field exists in vendor config
                            if (!validFieldNames.has(fieldName)) {
                                errors.push(
                                    `Step ${stepLabel} → action "${actionRef}" → fieldrequired: "${fieldName}" does not exist in vendor field configuration.`
                                );
                            }

                            // Check field is not also in readonly
                            if (readonlyFields.has(fieldName)) {
                                errors.push(
                                    `Step ${stepLabel} → action "${actionRef}" → fieldrequired: "${fieldName}" is also listed in fields.readonly — a readonly field cannot be required.`
                                );
                            }

                            // Check field is not also in hidden (direct)
                            if (hiddenFields.has(fieldName)) {
                                errors.push(
                                    `Step ${stepLabel} → action "${actionRef}" → fieldrequired: "${fieldName}" is also listed in fields.hidden — a hidden field cannot be required.`
                                );
                            } else {
                                // Check if any ancestor tab of this field is hidden.
                                // If a tab is hidden, all fields inside it (including
                                // deeply nested ones) are effectively hidden too.
                                const hiddenAncestorTab = getAncestorTabs(fieldName).find(
                                    (tabName) => hiddenFields.has(tabName)
                                );
                                if (hiddenAncestorTab) {
                                    errors.push(
                                        `Step ${stepLabel} → action "${actionRef}" → fieldrequired: "${fieldName}" cannot be required — its parent tab "${hiddenAncestorTab}" is listed in fields.hidden, which hides all fields inside it.`
                                    );
                                }

                                // Check if any ancestor array field of this field is hidden.
                                // Array fields render as repeatable row-tables; when an array
                                // field is hidden the entire table (and all its child columns)
                                // is hidden, so none of those child fields can be required.
                                // e.g. "branch" hidden -> IFSC_code, residential_status,
                                //      GST_classification, MSMED_registration_number are all inaccessible.
                                const hiddenAncestorArray = getAncestorArrayFields(fieldName).find(
                                    (arrayFieldName) => hiddenFields.has(arrayFieldName)
                                );
                                if (hiddenAncestorArray) {
                                    errors.push(
                                        `Step ${stepLabel} → action "${actionRef}" → fieldrequired: "${fieldName}" cannot be required — its parent array field "${hiddenAncestorArray}" is listed in fields.hidden, which hides the entire repeatable table and all its child fields.`
                                    );
                                }
                            }
                        });
                    });
                }

                // Check if next_step key is present at all
                const hasNextStepKey = Object.prototype.hasOwnProperty.call(dataUpdates, 'next_step');
                const nextStep = dataUpdates.next_step;

                if (!hasNextStepKey || nextStep === undefined) {
                    errors.push(
                        `Step ${stepLabel} → action "${actionRef}": missing "next_step" in dataUpdates.`
                    );
                    return;
                }

                if (nextStep === null) {
                    errors.push(
                        `Step ${stepLabel} → action "${actionRef}": "next_step" is null — provide a valid step ID.`
                    );
                    return;
                }

                if (typeof nextStep === 'string' && nextStep.trim() === '') {
                    errors.push(
                        `Step ${stepLabel} → action "${actionRef}": "next_step" is an empty string — provide a valid step ID.`
                    );
                    return;
                }

                // "step_end_process" is a reserved terminal sentinel meaning the workflow
                // ends after this transition — it intentionally has no matching step in the
                // steps array, so we skip the mismatch check for it.
                const TERMINAL_STEP_IDS = new Set(['step_end_process', 'End', 'end']);
                if (!TERMINAL_STEP_IDS.has(nextStep) && !validStepIds.has(nextStep)) {
                    errors.push(
                        `Step ${stepLabel} → action "${actionRef}": "next_step" is "${nextStep}" but no step with that ID exists in the steps array.`
                    );
                }
            });
        });

        return errors;
    };

    // ---------------------------------------------------------------------------
    // Parses the line number out of a JSON SyntaxError message so we can
    // highlight that line in the gutter of the JSON editor.
    // Returns a 1-based line number, or null when it cannot be determined.
    // ---------------------------------------------------------------------------
    const getErrorLine = (text, errorMsg) => {
        if (!errorMsg || !text) return null;
        // Modern engines expose "line X column Y" or "at line X"
        const lineMatch = errorMsg.match(/line (\d+)/i);
        if (lineMatch) return parseInt(lineMatch[1], 10);
        // Fallback: try to derive position from "position N" and count newlines
        const posMatch = errorMsg.match(/position (\d+)/i);
        if (posMatch) {
            const pos = parseInt(posMatch[1], 10);
            const upToPos = text.substring(0, pos);
            return (upToPos.match(/\n/g) || []).length + 1;
        }
        return null;
    };

    // ---------------------------------------------------------------------------
    // Maps workflow validation errors back to approximate line numbers so that
    // the offending lines can be highlighted in the gutter.
    // Strategy: for each error, search for the field name or action/step strings
    // mentioned in the error message and return the 1-based line number(s).
    // ---------------------------------------------------------------------------
    const getWorkflowErrorLines = (text, errors) => {
        if (!text || !errors || errors.length === 0) return [];
        const lines = text.split('\n');
        const lineNumbers = new Set();

        errors.forEach((errMsg) => {
            // Extract quoted tokens from the error message to search for in the JSON
            const tokens = [...errMsg.matchAll(/"([^"]+)"/g)].map(m => m[1]);
            tokens.forEach((token) => {
                lines.forEach((line, idx) => {
                    if (line.includes(JSON.stringify(token)) || line.includes(`"${token}"`)) {
                        lineNumbers.add(idx + 1);
                    }
                });
            });
        });

        return [...lineNumbers];
    };

    // ---------------------------------------------------------------------------
    // Auto-formats valid JSON text (2-space indent).
    // Returns the formatted string, or the original text if it is invalid/empty.
    // ---------------------------------------------------------------------------
    const autoFormatJson = (text) => {
        const trimmed = (text || '').trim();
        if (!trimmed) return text;
        try {
            return JSON.stringify(JSON.parse(trimmed), null, 2);
        } catch {
            return text;
        }
    };

    // Update metadataText when metadata prop changes
    useEffect(() => {
        const raw = extractMetadataString(metadata, isEditable);
        // Auto-format JSON on load for the workflow editor
        const extracted = isWorkflowJson ? autoFormatJson(raw) : raw;
        setMetadataText(extracted);
        const jErr = validateJson(extracted);
        setJsonError(jErr);
        setWorkflowErrors(jErr ? [] : validateWorkflowConfig(extracted));
    }, [metadata, isEditable]);

    const handleSave = () => {
        if (onSave) {
            try {
                // For master config type, we need to handle file_type preservation
                if (configType === 'master' && isEditable) {
                    let finalMetadata = metadataText;

                    // If we have a selected file type, we need to include it
                    if (fileType) {
                        // If there's metadata text, combine it with file_type as plain text
                        if (metadataText && metadataText.trim() !== '') {
                            // Format as plain text with file_type info
                            finalMetadata = `file_type: ${fileType}\n${metadataText}`;
                        } else {
                            // If no metadata text, just store file_type info
                            finalMetadata = `file_type: ${fileType}`;
                        }
                    }
                    // If no file type selected, save metadata as is (could be empty)

                    onSave(finalMetadata);
                } else {
                    // For other config types or non-editable mode, save as is
                    onSave(metadataText);
                }
                onClose();
            } catch (e) {
                // Error saving metadata
            }
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] backdrop-blur-sm p-2 sm:p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden w-full max-w-3xl max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">{isEditable ? title : readOnlyTitle}</h1>
                            <p className="text-xs text-gray-500">
                                {isEditable
                                    ? "Enter any textual data in the metadata field"
                                    : "View metadata entries"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-red-500 transition-colors duration-200 p-2 rounded-full hover:bg-white shadow-sm ring-1 ring-gray-200"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-2 flex-grow overflow-hidden flex flex-col bg-gradient-to-b from-white to-gray-50">
                    {/* File Type Selection for Master Configurations */}
                    {configType === 'master' && isEditable && (
                        <div className="px-4 pt-4" data-tour="metadata-file-type-section">
                            <label className="mb-2 font-semibold text-gray-700 text-sm">File Type</label>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {['pdf', 'xls, xlsx, csv'].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => onFileTypeChange && onFileTypeChange(type)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${fileType && fileType === type
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                        disabled={!isEditable}
                                        data-tour={`file-type-${type.replace(', ', '-').replace('.', '')}-button`}
                                    >
                                        {type}
                                    </button>
                                ))}
                                {fileType && fileType !== '' && (
                                    <button
                                        type="button"
                                        onClick={() => onFileTypeChange && onFileTypeChange('')}
                                        className="px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                        disabled={!isEditable}
                                        data-tour="clear-file-type-button"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="overflow-y-auto flex-grow mb-6 pr-2 bg-white border-gray-200 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 scrollbar-thumb-rounded-full scrollbar-track-rounded-full">
                        <div className="p-4">
                            <div className="flex flex-col h-full">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Metadata</label>
                                {!isEditable && fileType && (
                                    <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                                        File Type: {fileType}
                                    </div>
                                )}
                                {isWorkflowJson && isEditable ? (
                                    /* ── Rich JSON editor for vendor_workflow_json ── */
                                    <>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">JSON Editor</span>
                                                {metadataText.trim() && !jsonError && (
                                                    <span className="flex items-center gap-1 text-xs text-green-600">
                                                        <CheckCircle size={13} /> Valid JSON
                                                    </span>
                                                )}
                                                {metadataText.trim() && jsonError && (
                                                    <span className="flex items-center gap-1 text-xs text-red-500">
                                                        <AlertCircle size={13} /> Syntax Error
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                title="Auto-format JSON"
                                                onClick={() => {
                                                    const formatted = autoFormatJson(metadataText);
                                                    setMetadataText(formatted);
                                                    const jErr = validateJson(formatted);
                                                    setJsonError(jErr);
                                                    setWorkflowErrors(jErr ? [] : validateWorkflowConfig(formatted));
                                                }}
                                                disabled={!!jsonError}
                                                className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded border border-gray-300 transition-colors"
                                            >
                                                <WrapText size={12} /> Format
                                            </button>
                                        </div>
                                        <WorkflowJsonEditor
                                            value={metadataText}
                                            isEditable={true}
                                            hasError={!!jsonError || workflowErrors.length > 0}
                                            errorLine={jsonError ? getErrorLine(metadataText, jsonError) : null}
                                            errorLines={!jsonError ? getWorkflowErrorLines(metadataText, workflowErrors) : []}
                                            onChange={(val) => {
                                                setMetadataText(val);
                                                const jErr = validateJson(val);
                                                setJsonError(jErr);
                                                setWorkflowErrors(jErr ? [] : validateWorkflowConfig(val));
                                            }}
                                        />
                                        {/* JSON syntax error with line highlight */}
                                        {jsonError && (
                                            <div className="mt-2 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
                                                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-semibold">JSON Syntax Error</span>
                                                    {getErrorLine(metadataText, jsonError) && (
                                                        <span className="ml-1 text-red-500">(Line {getErrorLine(metadataText, jsonError)})</span>
                                                    )}
                                                    <p className="font-mono break-all mt-0.5">{jsonError.replace(/^Invalid JSON: /, '')}</p>
                                                </div>
                                            </div>
                                        )}
                                        {/* Workflow next_step / field-config validation errors */}
                                        {!jsonError && workflowErrors.length > 0 && (
                                            <div className="mt-2 flex flex-col gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
                                                <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                                                    <AlertCircle size={13} className="flex-shrink-0" />
                                                    Workflow configuration {workflowErrors.length === 1 ? 'error' : `errors (${workflowErrors.length})`}:
                                                </div>
                                                <ul className="list-disc list-inside space-y-0.5">
                                                    {workflowErrors.map((err, i) => {
                                                        const isFieldError =
                                                            err.includes('does not exist in vendor field') ||
                                                            err.includes('readonly field cannot be required') ||
                                                            err.includes('hidden field cannot be required');
                                                        return (
                                                            <li key={i} className={`font-mono break-all ${isFieldError ? 'text-orange-600' : 'text-red-600'}`}>
                                                                {isFieldError && <span className="inline-block mr-1 font-semibold text-orange-500">[Field Config]</span>}
                                                                {err}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )}
                                        {!jsonError && workflowErrors.length === 0 && metadataText.trim() && (
                                            <div className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                                                <CheckCircle size={12} /> Workflow configuration is valid
                                            </div>
                                        )}
                                        <p className="mt-1.5 text-xs text-gray-400">Tip: Tab to indent · JSON auto-formats on blur</p>
                                    </>
                                ) : (
                                    /* ── Standard textarea for all other keys ── */
                                    <>
                                        <textarea
                                            value={metadataText}
                                            onChange={(e) => {
                                                setMetadataText(e.target.value);
                                                const jErr = validateJson(e.target.value);
                                                setJsonError(jErr);
                                                setWorkflowErrors(jErr ? [] : validateWorkflowConfig(e.target.value));
                                            }}
                                            placeholder={isEditable ? "Enter any textual data here..." : "No metadata available"}
                                            disabled={!isEditable}
                                            className={`w-full h-32 text-sm p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-gray-800 bg-white ${isEditable && (jsonError || workflowErrors.length > 0)
                                                ? 'border-red-400 focus:ring-red-400'
                                                : 'border-gray-300 focus:ring-blue-500'
                                                }`}
                                            data-tour="metadata-textarea"
                                        />
                                        {/* JSON validation error message */}
                                        {isEditable && jsonError && (
                                            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                                </svg>
                                                <span className="font-mono break-all">{jsonError}</span>
                                            </div>
                                        )}
                                        {/* Workflow next_step validation errors */}
                                        {isEditable && !jsonError && workflowErrors.length > 0 && (
                                            <div className="mt-1.5 flex flex-col gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
                                                <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                                    </svg>
                                                    Workflow configuration {workflowErrors.length === 1 ? 'error' : `errors (${workflowErrors.length})`}:
                                                </div>
                                                <ul className="list-disc list-inside space-y-0.5">
                                                    {workflowErrors.map((err, idx) => (
                                                        <li key={idx} className="font-mono break-all">{err}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {isEditable && !jsonError && workflowErrors.length === 0 && (
                                            <div className="mt-2 text-xs text-gray-500">
                                                Note: File type is managed separately above
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex gap-2 ml-auto">
                            {isEditable && (
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={!!jsonError || workflowErrors.length > 0}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${(jsonError || workflowErrors.length > 0)
                                            ? 'bg-blue-300 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                            }`}
                                        data-tour="save-metadata-button"
                                    >
                                        <Save size={16} />
                                        Save Changes
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MetadataPopup;
export { MetadataDisplay };
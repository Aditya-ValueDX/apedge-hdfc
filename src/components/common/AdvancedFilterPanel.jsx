import React from 'react';
import { X, ListFilter, RotateCcw } from 'lucide-react';
import Button from './Button';
import SearchableSelect from './SearchableSelect';

/**
 * AdvancedFilterPanel — reusable modal for advanced server-side filters.
 *
 * Props:
 *  isOpen           {boolean}   - Whether the modal is visible
 *  onClose          {function}  - Called when the user closes without applying
 *  title            {string}    - Modal title (default: "Advanced Filters")
 *  filterFields     {Array}     - Field config array (see below)
 *  values           {object}    - Current draft filter values { [key]: value }
 *  onChange         {function}  - (key, value) => void  — update a single draft value
 *  onApply          {function}  - () => void — commit draft → applied
 *  onClear          {function}  - () => void — called after non-default fields are cleared in panel
 *  onClearDefaults  {function}  - (newValues: object) => void — called with the values object
 *                                 after all default fields are zeroed; parent should apply + close
 *
 * filterFields entry shape:
 * {
 *   key:            string,
 *   label:          string,
 *   type:           'text' | 'select' | 'date' | 'number',
 *   icon:           LucideComponent,
 *   placeholder:    string,
 *   options:        Array<string|{value,label}>,
 *   allOptionLabel: string,
 *   minKey:         string,
 *   maxKey:         string,
 *   hidden:         boolean,
 *   defaultValue:   any,
 * }
 */
const AdvancedFilterPanel = ({
    isOpen,
    onClose,
    title = 'Advanced Filters',
    filterFields = [],
    values = {},
    onChange,
    onApply,
    onClearAll,
    onClearDefaults,
}) => {
    if (!isOpen) return null;

    const capitalize = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/_/g, ' ')
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    };

    const visibleFields = filterFields.filter((f) => !f.hidden);

    const fieldHasValue = (field) => {
        const v = values[field.key];
        return v !== undefined && v !== null && v !== '';
    };

    const hasDefault = (field) =>
        field.defaultValue !== undefined &&
        field.defaultValue !== null &&
        field.defaultValue !== '';

    const fieldIsAtNonEmptyDefault = (field) => {
        const v = values[field.key] ?? '';
        const def = field.defaultValue ?? '';
        return def !== '' && v === def;
    };

    const fieldIsModified = (field) => {
        const v = values[field.key] ?? '';
        const def = field.defaultValue ?? '';
        return v !== def;
    };

    const hasAnyDefault = visibleFields.some(hasDefault);
    const hasAnyDefaultActive = visibleFields.some(fieldIsAtNonEmptyDefault);
    const nonDefaultActiveCount = visibleFields.filter((f) => !hasDefault(f) && fieldHasValue(f)).length;
    const modifiedCount = visibleFields.filter(fieldIsModified).length;

    // "Clear All" — clears non-default fields, keeps default fields as-is (whether active or
    // already cleared), then hands result to parent to apply + close atomically.
    const handleClearAll = () => {
        const newValues = { ...values };
        visibleFields.forEach((f) => {
            if (!hasDefault(f)) newValues[f.key] = '';
        });
        onClearAll?.(newValues);
    };

    // "Clear Defaults" — zeroes default fields and hands result to parent to apply + close
    const handleClearDefaults = () => {
        const newValues = { ...values };
        visibleFields.forEach((f) => {
            if (hasDefault(f)) newValues[f.key] = '';
        });
        onClearDefaults?.(newValues);
    };

    // "Restore Defaults" — restores each default field to its defaultValue, panel stays open
    const handleRestoreDefaults = () => {
        visibleFields.forEach((f) => {
            if (hasDefault(f)) onChange(f.key, f.defaultValue);
        });
    };

    const inputBase =
        'w-full px-2 py-1 text-xs rounded-md border border-gray-200 bg-white text-gray-800 ' +
        'shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 ' +
        'transition-colors duration-150';

    const renderField = (field) => {
        const { key, type, placeholder, options = [], allOptionLabel, minKey, maxKey } = field;
        const value = values[key] ?? '';
        const showClear = fieldHasValue(field);
        const isAtDefault = fieldIsAtNonEmptyDefault(field);
        const activeClass = isAtDefault
            ? 'pr-6 border-amber-400 bg-amber-50/30'
            : showClear
            ? 'pr-6 border-indigo-400 bg-indigo-50/30'
            : 'pr-2';

        switch (type) {
            case 'select': {
                const selectOptions = options.map((opt) => {
                    if (typeof opt === 'object' && opt !== null) {
                        return opt.label || capitalize(String(opt.value));
                    }
                    return capitalize(String(opt));
                });

                return (
                    <div className="relative">
                        <SearchableSelect
                            options={selectOptions}
                            value={value}
                            onChange={(selectedValue) => {
                                const selectedOption = options.find((opt) => {
                                    if (typeof opt === 'object' && opt !== null) {
                                        return opt.label === selectedValue;
                                    }
                                    return capitalize(String(opt)) === selectedValue;
                                });
                                if (selectedOption) {
                                    if (typeof selectedOption === 'object' && selectedOption !== null) {
                                        onChange(key, selectedOption.value);
                                    } else {
                                        onChange(key, selectedOption);
                                    }
                                } else {
                                    onChange(key, selectedValue ?? '');
                                }
                            }}
                            placeholder={allOptionLabel || `All ${field.label}s`}
                            allowClear={true}
                        />
                        {isAtDefault && (
                            <span
                                title="This is a default filter — click 'Clear Defaults' to remove it"
                                className="absolute right-6 top-1/2 -translate-y-1/2 text-[9px] font-medium text-amber-600 bg-amber-100 rounded px-1 pointer-events-none"
                            >
                                default
                            </span>
                        )}
                    </div>
                );
            }

            case 'date': {
                const minVal = minKey ? values[minKey] ?? '' : '';
                const maxVal = maxKey ? values[maxKey] ?? '' : '';
                return (
                    <div className="relative">
                        <input
                            type="date"
                            className={`${inputBase} ${activeClass}`}
                            value={value}
                            min={minVal || undefined}
                            max={maxVal || new Date().toISOString().split('T')[0]}
                            onChange={(e) => onChange(key, e.target.value)}
                        />
                        {showClear && (
                            <button
                                type="button"
                                onClick={() => onChange(key, '')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                title={isAtDefault ? 'Clear this default' : 'Clear'}
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>
                );
            }

            case 'number': {
                return (
                    <div className="relative">
                        <input
                            type="number"
                            className={`${inputBase} ${activeClass}`}
                            value={value}
                            placeholder={placeholder || field.label}
                            onChange={(e) => onChange(key, e.target.value)}
                        />
                        {showClear && (
                            <button
                                type="button"
                                onClick={() => onChange(key, '')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                title={isAtDefault ? 'Clear this default' : 'Clear'}
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>
                );
            }

            default: {
                return (
                    <div className="relative">
                        <input
                            type="text"
                            className={`${inputBase} ${activeClass}`}
                            value={value}
                            placeholder={placeholder || `Search ${field.label}…`}
                            onChange={(e) => onChange(key, e.target.value)}
                        />
                        {showClear && (
                            <button
                                type="button"
                                onClick={() => onChange(key, '')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                title={isAtDefault ? 'Clear this default' : 'Clear'}
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>
                );
            }
        }
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.45)' }}
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-lg flex flex-col"
                style={{ maxHeight: 'min(85vh, 640px)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600">
                            <ListFilter size={14} />
                        </span>
                        <div>
                            <h3 className="text-xs font-semibold text-gray-900 leading-none">{title}</h3>
                            {modifiedCount > 0 ? (
                                <p className="text-[10px] text-indigo-500 font-medium mt-0.5">
                                    {modifiedCount} filter{modifiedCount !== 1 ? 's' : ''} modified
                                </p>
                            ) : hasAnyDefault ? (
                                <p className="text-[10px] text-amber-500 font-medium mt-0.5">
                                    Default filters applied
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center justify-center w-6 h-6 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        aria-label="Close"
                    >
                        <X size={12} />
                    </button>
                </div>

                {/* ── Fields ── */}
                <div className="overflow-y-auto flex-1 px-4 py-3">
                    {hasAnyDefault && (
                        <div className="mb-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
                            <span className="shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-amber-200 text-amber-700 font-bold">!</span>
                            {hasAnyDefaultActive ? (
                                <span>
                                    Fields marked <span className="font-semibold text-amber-600">default</span> are pre-set.
                                    Use <span className="font-semibold">Clear Defaults</span> to remove them and apply your remaining filters.
                                </span>
                            ) : (
                                <span>
                                    Default filters have been cleared.
                                    Use <span className="font-semibold">Restore Defaults</span> to bring them back.
                                </span>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-3">
                        {visibleFields.map((field) => {
                            const Icon = field.icon;
                            const hasVal = fieldHasValue(field);
                            const isAtDefault = fieldIsAtNonEmptyDefault(field);
                            const isModified = fieldIsModified(field);

                            const labelColor = isAtDefault
                                ? 'text-amber-600'
                                : isModified && hasVal
                                ? 'text-indigo-600'
                                : '';

                            const dotColor = isAtDefault
                                ? 'bg-amber-400'
                                : isModified && hasVal
                                ? 'bg-indigo-500'
                                : '';

                            return (
                                <div key={field.key} className="flex flex-col gap-1">
                                    <label className="flex items-center gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                                        {Icon && (
                                            <span className={`flex items-center justify-center w-3.5 h-3.5 rounded ${isAtDefault ? 'text-amber-500' : hasVal ? 'text-indigo-500' : 'text-gray-400'}`}>
                                                <Icon size={10} />
                                            </span>
                                        )}
                                        <span className={labelColor}>{field.label}</span>
                                        {(hasVal || isModified) && dotColor && (
                                            <span className={`ml-auto flex items-center justify-center w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                        )}
                                    </label>
                                    {renderField(field)}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 rounded-b-xl flex-shrink-0">

                    {/* Left: toggles between Clear Defaults and Restore Defaults */}
                    <div>
                        {hasAnyDefault && (
                            hasAnyDefaultActive ? (
                                <Button
                                    variant="ghost"
                                    color="amber"
                                    onClick={handleClearDefaults}
                                    className="text-xs py-1 px-2 flex items-center gap-1"
                                    title="Remove default filters and apply remaining filters"
                                >
                                    <X size={10} />
                                    Clear Defaults
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    color="amber"
                                    onClick={handleRestoreDefaults}
                                    className="text-xs py-1 px-2 flex items-center gap-1"
                                    title="Restore all default filter values"
                                >
                                    <RotateCcw size={10} />
                                    Restore Defaults
                                </Button>
                            )
                        )}
                    </div>

                    {/* Right: Clear All (non-defaults only) + Apply */}
                    <div className="flex gap-1.5">
                        <Button
                            variant="ghost"
                            color="red"
                            onClick={handleClearAll}
                            className="text-xs py-1 px-2"
                            title="Clear all non-default filters"
                        >
                            Clear All
                        </Button>
                        <Button color="indigo" onClick={onApply} className="text-xs py-1 px-2">
                            Apply Filters
                            {nonDefaultActiveCount > 0 && (
                                <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/25 text-[9px]">
                                    {nonDefaultActiveCount}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvancedFilterPanel;
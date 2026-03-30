import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Save, FileText, CheckCircle2 } from 'lucide-react';
import axios from '../../utils/authInterceptor';
import { useSelector } from 'react-redux';
import { loadSecure } from '../../utils/secureStorage';
import { apiBaseUrl } from '../../config/apiConfig';

// ---------------------------------------------------------------------------
// ItemTooltip — follows mouse, only shows when text is actually truncated
// ---------------------------------------------------------------------------
const ItemTooltip = ({ text, children }) => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const ref = useRef(null);

    const isTruncated = useCallback(() => {
        const el = ref.current;
        return el ? el.scrollWidth > el.clientWidth : false;
    }, []);

    const onMove = useCallback((e) => {
        setPos({ x: e.clientX + 14, y: e.clientY + 14 });
    }, []);

    const onEnter = () => {
        if (isTruncated()) {
            setVisible(true);
            window.addEventListener('mousemove', onMove);
        }
    };

    const onLeave = () => {
        setVisible(false);
        window.removeEventListener('mousemove', onMove);
    };

    return (
        <>
            {children(ref, onEnter, onLeave)}
            {visible && (
                <div
                    className="fixed z-[99999] pointer-events-none px-2.5 py-1.5 bg-gray-900 text-white text-[11px] font-normal rounded-md shadow-xl max-w-sm break-words leading-snug"
                    style={{ left: pos.x, top: pos.y }}
                >
                    {text}
                </div>
            )}
        </>
    );
};

// ---------------------------------------------------------------------------
// MasterKeySearchPopup
// ---------------------------------------------------------------------------
const MasterKeySearchPopup = ({
    isOpen,
    onClose,
    onSelect,
    initialValue = '',
    fieldName = '',
    fieldConfig = null,
    uniqueKey = '',
}) => {
    const [searchTerm, setSearchTerm]           = useState('');
    const [filteredData, setFilteredData]       = useState([]);
    const [searchPerformed, setSearchPerformed] = useState(false);
    const [selectedValue, setSelectedValue]     = useState(initialValue);
    const [selectedList, setSelectedList]       = useState(
        Array.isArray(initialValue)
            ? initialValue
            : (initialValue ? initialValue.split(',').map(v => v.trim()).filter(Boolean) : [])
    );
    const [initialSelectedValue, setInitialSelectedValue] = useState(initialValue);
    const [selectionMode, setSelectionMode]     = useState('single');
    const [loading, setLoading]                 = useState(false);
    const [error, setError]                     = useState(null);

    const user  = useSelector(state => state.auth.user);
    const token = user?.token;

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setFilteredData([]);
            setSearchPerformed(false);
            setError(null);
            setSelectionMode('single');
            setSelectedValue(initialValue);
            const list = Array.isArray(initialValue)
                ? initialValue
                : (initialValue ? initialValue.split(',').map(v => v.trim()).filter(Boolean) : []);
            setSelectedList(list);
            setInitialSelectedValue(initialValue);
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync when initialValue prop changes
    useEffect(() => {
        setSelectedValue(initialValue);
        const list = Array.isArray(initialValue)
            ? initialValue
            : (initialValue ? initialValue.split(',').map(v => v.trim()).filter(Boolean) : []);
        setSelectedList(list);
        setInitialSelectedValue(initialValue);
    }, [initialValue]);

    const getFieldDisplayName = () => {
        if (fieldConfig?.display_name) return fieldConfig.display_name;
        return (fieldName || '')
            .replace(/_/g, ' ')
            .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    };

    const handleSearch = async () => {
        setSearchPerformed(true);
        if (!searchTerm.trim()) { setFilteredData([]); return; }

        setLoading(true);
        setError(null);

        try {
            let authToken = token;
            if (!authToken) authToken = await loadSecure('token');

            const tenantId = user?.tenantId;
            if (!tenantId) throw new Error('Tenant ID not found');
            if (!authToken) throw new Error('Authentication token not found');

            const response = await axios.post(
                `${apiBaseUrl}/api/excel/search`,
                { tenant_id: tenantId, unique_key: uniqueKey, field_name: fieldName, search_string: searchTerm },
                { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` } }
            );

            if (response.data?.data && Array.isArray(response.data.data)) {
                setFilteredData(response.data.data.map((value, index) => ({ id: index + 1, value })));
            } else {
                setFilteredData([]);
            }
        } catch {
            setError('Failed to fetch master key data. Please try again.');
            setFilteredData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectItem = (item) => {
        if (selectionMode === 'single') {
            setSelectedValue(item.value);
            setSelectedList([item.value]);
        } else {
            setSelectedList(prev => {
                const exists = prev.includes(item.value);
                const updated = exists ? prev.filter(v => v !== item.value) : [...prev, item.value];
                setSelectedValue(updated.join(', '));
                return updated;
            });
        }
    };

    // Save: call onSelect FIRST so the value is applied, THEN close.
    // onClose does NOT clear masterKeyPopupField — handleMasterKeySelect in
    // InvoiceFormUI does that after successfully applying the value.
    const handleSave = () => {
        const valueToSend = selectionMode === 'single'
            ? selectedValue
            : selectedList.join(', ');
        onSelect(valueToSend);
        onClose();
    };

    const handleClose = () => {
        setSearchTerm('');
        setFilteredData([]);
        setSearchPerformed(false);
        setError(null);
        setSelectedValue(initialSelectedValue);
        const list = Array.isArray(initialSelectedValue)
            ? initialSelectedValue
            : (initialSelectedValue ? initialSelectedValue.split(',').map(v => v.trim()).filter(Boolean) : []);
        setSelectedList(list);
        onClose();
    };

    const handleKeyPress = (e) => { if (e.key === 'Enter') handleSearch(); };

    if (!isOpen) return null;

    const fieldDisplayName = getFieldDisplayName();

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4"
            data-tour="editor-master-key-popup"
        >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden border border-gray-200">

                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center flex-shrink-0">
                            <FileText size={13} className="text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-[12px] font-semibold text-gray-800 leading-tight">
                                {fieldDisplayName ? `Master Search — ${fieldDisplayName}` : 'Master Search'}
                            </h3>
                            <p className="text-[10px] font-normal text-gray-400">Search and select a value</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Selected value */}
                <div className="px-3 py-2 border-b border-gray-100 bg-white flex-shrink-0">
                    <label className="block text-[10px] font-normal text-gray-400 mb-1">Selected value</label>
                    <textarea
                        value={selectedValue}
                        onChange={(e) => {
                            const raw = e.target.value;
                            setSelectedValue(raw);
                            if (selectionMode === 'multiple') {
                                setSelectedList(raw.split(',').map(v => v.trim()).filter(Boolean));
                            } else {
                                setSelectedList(raw ? [raw] : []);
                            }
                        }}
                        className="w-full px-2.5 py-1.5 text-[11px] font-normal text-gray-700 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors resize-y min-h-[32px] max-h-20 placeholder-gray-300"
                        placeholder="No value selected yet"
                        rows={1}
                    />
                </div>

                {/* Selection mode */}
                <div className="flex items-center justify-end gap-4 px-3 py-1.5 border-b border-gray-100 flex-shrink-0">
                    {['single', 'multiple'].map(mode => (
                        <label key={mode} className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-normal text-gray-600">
                            <input
                                type="radio"
                                name="selectionMode"
                                value={mode}
                                checked={selectionMode === mode}
                                onChange={() => setSelectionMode(mode)}
                                className="text-indigo-600 focus:ring-indigo-400 h-3 w-3"
                            />
                            {mode === 'single' ? 'Single select' : 'Multi select'}
                        </label>
                    ))}
                </div>

                {/* Search bar */}
                <div className="px-3 py-2 border-b border-gray-200 flex-shrink-0">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type to search master key values…"
                                className="w-full pl-7 pr-3 py-1.5 text-[11px] font-normal text-gray-700 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 placeholder-gray-300 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
                                disabled={loading}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={loading || !searchTerm.trim()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-normal rounded-md hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                            {loading
                                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <Search size={11} />
                            }
                            {loading ? 'Searching…' : 'Search'}
                        </button>
                    </div>
                    {error && <p className="mt-1.5 text-[10px] font-normal text-red-500">{error}</p>}
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-2 bg-gray-50/60 min-h-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                            <p className="text-[11px] font-normal text-gray-500">Searching…</p>
                        </div>
                    ) : searchPerformed ? (
                        filteredData.length > 0 ? (
                            <div className="space-y-1">
                                {filteredData.map((item) => {
                                    const isSelected = selectionMode === 'single'
                                        ? selectedValue === item.value
                                        : selectedList.includes(item.value);

                                    return (
                                        <ItemTooltip key={item.id} text={item.value}>
                                            {(ref, onEnter, onLeave) => (
                                                <div
                                                    onClick={() => handleSelectItem(item)}
                                                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md border cursor-pointer transition-all duration-100 select-none ${
                                                        isSelected
                                                            ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-100'
                                                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                                                        <FileText size={10} className={isSelected ? 'text-indigo-600' : 'text-gray-400'} />
                                                    </div>

                                                    {/* Truncated text with hover tooltip */}
                                                    <span
                                                        ref={ref}
                                                        onMouseEnter={onEnter}
                                                        onMouseLeave={onLeave}
                                                        className="flex-1 min-w-0 text-[11px] font-normal text-gray-700 truncate"
                                                    >
                                                        {item.value}
                                                    </span>

                                                    {isSelected && (
                                                        <CheckCircle2 size={13} className="text-indigo-500 flex-shrink-0" />
                                                    )}
                                                </div>
                                            )}
                                        </ItemTooltip>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 gap-2">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                    <Search size={14} className="text-gray-400" />
                                </div>
                                <p className="text-[11px] font-normal text-gray-500">No results found</p>
                                <p className="text-[10px] font-normal text-gray-400">Try different search terms</p>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                            <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center">
                                <Search size={14} className="text-indigo-400" />
                            </div>
                            <p className="text-[11px] font-normal text-gray-500">Enter a search term above</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-white flex-shrink-0">
                    <button
                        onClick={handleClose}
                        className="px-3 py-1.5 text-[11px] font-normal text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                    <div className="flex items-center gap-3">
                        {searchPerformed && !loading && (
                            <span className="text-[10px] font-normal text-gray-400">
                                {filteredData.length} {filteredData.length === 1 ? 'result' : 'results'}
                            </span>
                        )}
                        <button
                            onClick={handleSave}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-normal bg-green-600 text-white rounded-md hover:bg-green-700 active:bg-green-800 transition-colors"
                        >
                            <Save size={11} />
                            Save
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MasterKeySearchPopup;
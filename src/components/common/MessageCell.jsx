import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Info, X } from 'lucide-react';

const MessageCell = ({ 
    item, 
    itemId, 
    displayText, 
    errorData, 
    activeTooltipId, 
    onToggle,
    title = "Messages"
}) => {
    const isTooltipOpen = activeTooltipId === itemId;
    const tooltipRef = useRef(null);
    const iconRef = useRef(null);

    // --- Data Logic: Extraction & Grouping ---
    const groupedMessages = useMemo(() => {
        const groups = { error: [], warning: [], note: [], success: [], other: [] };
        if (!errorData) return groups;

        Object.entries(errorData).forEach(([key, value]) => {
            const lowerKey = key.toLowerCase();
            const pair = { key, value };
            
            if (lowerKey.startsWith('error')) groups.error.push(pair);
            else if (lowerKey.startsWith('warning')) groups.warning.push(pair);
            else if (lowerKey.includes('note')) groups.note.push(pair);
            else if (lowerKey.startsWith('success')) groups.success.push(pair);
            else groups.other.push(pair);
        });

        // Sort all groups numerically
        const sortNumerically = (a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' });
        groups.error.sort(sortNumerically);
        groups.warning.sort(sortNumerically);
        groups.success.sort(sortNumerically);
        groups.note.sort(sortNumerically);
        groups.other.sort(sortNumerically);
        
        return groups;
    }, [errorData]);

    const getIconColor = () => {
        if (groupedMessages.error.length > 0) return 'text-red-600';
        if (groupedMessages.warning.length > 0) return 'text-orange-600';
        if (groupedMessages.success.length > 0) return 'text-green-600';
        return 'text-yellow-600';
    };

    // --- Smart Positioning Logic with Boundary Detection ---
    useEffect(() => {
        if (isTooltipOpen && iconRef.current && tooltipRef.current) {
            requestAnimationFrame(() => {
                const tooltip = tooltipRef.current;
                const icon = iconRef.current;
                
                if (tooltip && icon) {
                    const iconRect = icon.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const margin = 16; 

                    // 1. Horizontal Positioning (Clamped to screen edges)
                    let x = iconRect.left + (iconRect.width / 2);
                    const halfWidth = tooltipRect.width / 2;
                    
                    if (x - halfWidth < margin) {
                        x = halfWidth + margin;
                    } else if (x + halfWidth > viewportWidth - margin) {
                        x = viewportWidth - halfWidth - margin;
                    }

                    // 2. Vertical Positioning (Auto-flip if off-screen)
                    const spaceAbove = iconRect.top;
                    const tooltipHeight = tooltipRect.height;
                    
                    let y;
                    let transformY;

                    if (spaceAbove < tooltipHeight + 40) {
                        // Not enough space above -> Show BELOW icon
                        y = iconRect.bottom + 12;
                        transformY = '0%';
                        tooltip.style.setProperty('--translate-start', '-10px');
                    } else {
                        // Enough space -> Show ABOVE icon
                        y = iconRect.top - 12;
                        transformY = '-100%';
                        tooltip.style.setProperty('--translate-start', '10px');
                    }

                    tooltip.style.left = `${x}px`;
                    tooltip.style.top = `${y}px`;
                    tooltip.style.transform = `translate(-50%, ${transformY})`;
                }
            });
        }
    }, [isTooltipOpen]);

    // --- Click Outside Handler ---
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (tooltipRef.current && !tooltipRef.current.contains(e.target) &&
                iconRef.current && !iconRef.current.contains(e.target)) {
                onToggle(null);
            }
        };
        if (isTooltipOpen) {
            setTimeout(() => window.addEventListener('click', handleClickOutside), 0);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isTooltipOpen, onToggle]);

    const handleIconClick = (e) => {
        e.stopPropagation();
        onToggle(isTooltipOpen ? null : itemId);
    };

    // Render a single message block
    const MessageBlock = ({ messages, type, bgColor, borderColor, textColor, dotColor, label }) => {
        if (messages.length === 0) return null;

        return messages.map(({ value }, index) => (
            <div key={`${type}-${index}`} className={`${bgColor} ${borderColor} p-3 rounded-lg`}>
                <div className="flex items-start gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                    <div className="flex-1">
                        <p className={`text-[10px] uppercase tracking-wider font-bold ${textColor} mb-0.5`}>
                            {label}
                        </p>
                        <p className={`text-xs ${textColor.replace('600', '900')} leading-relaxed`}>
                            {value}
                        </p>
                    </div>
                </div>
            </div>
        ));
    };

    return (
        <div className="flex items-center justify-between gap-2 relative w-full">
            <span
                className="flex-1 overflow-hidden text-ellipsis invoice-number-text"
                title={displayText || ''}
            >
                {displayText || '—'}
            </span>
            
            {errorData && (
                <div className="relative inline-block flex-shrink-0">
                    <div ref={iconRef}>
                        <Info
                            size={16}
                            className={`cursor-pointer transition-all duration-300 hover:scale-125 ${getIconColor()} ${
                                isTooltipOpen ? 'opacity-100 scale-110' : 'opacity-70'
                            }`}
                            onClick={handleIconClick}
                        />
                    </div>
                </div>
            )}

            {/* Modal / Tooltip */}
            <div
                ref={tooltipRef}
                className={`fixed bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-200 z-[100000] w-[400px] max-w-[calc(100vw-32px)] max-h-[200px] overflow-hidden flex flex-col transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${
                    isTooltipOpen 
                        ? 'visible opacity-100 scale-100' 
                        : 'invisible opacity-0 scale-95 pointer-events-none'
                }`}
                style={{
                    whiteSpace: 'normal',
                    wordWrap: 'break-word',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-3.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <div className={`p-1 rounded-md bg-white shadow-sm ${getIconColor()}`}>
                            <Info size={14} />
                        </div>
                        {title}
                    </h4>
                    <button
                        onClick={() => onToggle(null)}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="overflow-y-auto p-4 space-y-3 flex-1 scrollbar-thin scrollbar-thumb-gray-200">
                    {/* Errors */}
                    <MessageBlock
                        messages={groupedMessages.error}
                        type="error"
                        bgColor="bg-red-50/50"
                        borderColor="border-red-100"
                        textColor="text-red-600"
                        dotColor="bg-red-500"
                        label="Error"
                    />

                    {/* Warnings */}
                    <MessageBlock
                        messages={groupedMessages.warning}
                        type="warning"
                        bgColor="bg-orange-50/50"
                        borderColor="border-orange-100"
                        textColor="text-orange-600"
                        dotColor="bg-orange-500"
                        label="Warning"
                    />

                    {/* Notes */}
                    <MessageBlock
                        messages={groupedMessages.note}
                        type="note"
                        bgColor="bg-yellow-50/50"
                        borderColor="border-yellow-100"
                        textColor="text-yellow-600"
                        dotColor="bg-yellow-500"
                        label="Note"
                    />
                    
                    {/* Success */}
                    <MessageBlock
                        messages={groupedMessages.success}
                        type="success"
                        bgColor="bg-green-50/50"
                        borderColor="border-green-100"
                        textColor="text-green-600"
                        dotColor="bg-green-500"
                        label="Success"
                    />
                    
                    {/* Other messages */}
                    {groupedMessages.other.map(({ key, value }, index) => {
                        const lowerKey = key.toLowerCase();
                        let bgColor, borderColor, textColor, dotColor;
                        
                        if (lowerKey.startsWith('warning')) {
                            bgColor = 'bg-orange-50/50';
                            borderColor = 'border-orange-100';
                            textColor = 'text-orange-900';
                            dotColor = 'bg-orange-500';
                        } else if (lowerKey.startsWith('success')) {
                            bgColor = 'bg-green-50/50';
                            borderColor = 'border-green-100';
                            textColor = 'text-green-900';
                            dotColor = 'bg-green-500';
                        } else {
                            bgColor = 'bg-gray-50/50';
                            borderColor = 'border-gray-100';
                            textColor = 'text-gray-900';
                            dotColor = 'bg-gray-500';
                        }
                        
                        return (
                            <div key={`other-${index}`} className={`${bgColor} ${borderColor} p-3 rounded-lg`}>
                                <div className="flex items-start gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                                    <div className="flex-1">
                                        <p className={`text-[10px] uppercase tracking-wider font-bold mb-0.5 ${textColor}`}>
                                            {key}
                                        </p>
                                        <p className={`text-xs ${textColor}`}>{value}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MessageCell;
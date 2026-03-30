import React, { useMemo, useState } from 'react';
import {
    UploadCloud,
    CheckCircle,
    AlertTriangle,
    FileCheck2,
    FileX,
    Loader2,
    Hourglass,
    X,
    Pause,
    Clock,
    FileText,
    TrendingUp,
    Archive,
    Send,
    RotateCw,
    CheckCheck,
    AlertCircle,
    Ban,
    PlayCircle,
    Download,
    Upload,
    RefreshCw,
    UserCheck,
    Shield,
    Info,
} from 'lucide-react';

/**
 * StatusCard - A reusable card component for displaying status information
 * 
 * @param {Object} props
 * @param {React.ComponentType} props.icon - Optional custom icon component from lucide-react
 * @param {string} props.label - The label/title of the status card
 * @param {number|string} props.value - The value to display
 * @param {Object} props.color - Color configuration object with hex and bg properties
 * @param {string} props.color.hex - Hex color code for the icon
 * @param {string} props.color.bg - Background color class (optional, defaults to a light version of hex)
 * @param {string} props.statusType - Optional status type for auto-icon selection
 * @param {string} props.className - Optional additional CSS classes
 */

// Fixed icon mappings for specific status types
const STATUS_ICON_MAP = {
    'processing': Loader2,
    'error': AlertTriangle,
    'approved': CheckCircle,
    'pending': Hourglass,
    'rejected': FileX,
    'cancel': X,
    'cancelled': X,
    'hold': Pause,
    'on hold': Pause,
    'intermediate': Clock,
    'completed': FileCheck2,
    'success': CheckCheck,
    'failed': AlertCircle,
    'blocked': Ban,
    'active': PlayCircle,
    'download': Download,
    'upload': Upload,
    'uploaded': UploadCloud,
    'refresh': RefreshCw,
    'verified': UserCheck,
    'protected': Shield,
    'archived': Archive,
    'sent': Send,
    'retry': RotateCw,
    'progress': TrendingUp,
    'total': UploadCloud,
    'draft': FileText,
    'review': FileText,
    'new': FileText,
    'posted': CheckCircle,
    'failure': AlertTriangle,
    'extraction': TrendingUp,
    'verification': UserCheck,
    'erp': Archive
};

// Track which icons have been used to prevent duplicates when using fallback
const usedIcons = new Set();

// Fallback icons pool for statuses without specific mappings
const FALLBACK_ICONS = [
    FileText,
    TrendingUp,
    Archive,
    Send,
    RotateCw,
    CheckCheck,
    AlertCircle,
    PlayCircle,
    Download,
    Upload,
    RefreshCw,
    UserCheck,
    Shield
];

/**
 * Get an icon for a status type
 * @param {string} statusType - The status type
 * @param {React.ComponentType} customIcon - Optional custom icon
 * @returns {React.ComponentType} The icon component to use
 */
const getIconForStatus = (statusType, customIcon) => {
    // If custom icon is provided, use it
    if (customIcon) {
        return customIcon;
    }

    // If no status type, return default icon
    if (!statusType) {
        return FileText;
    }

    // Normalize the status type to lowercase for matching
    const normalizedStatus = statusType.toLowerCase().trim();

    // Check if there's a specific icon mapping
    if (STATUS_ICON_MAP[normalizedStatus]) {
        return STATUS_ICON_MAP[normalizedStatus];
    }

    // Fallback: Find an unused icon from the pool
    for (let icon of FALLBACK_ICONS) {
        if (!usedIcons.has(icon)) {
            usedIcons.add(icon);
            return icon;
        }
    }

    // If all fallback icons are used, cycle through them
    const fallbackIndex = usedIcons.size % FALLBACK_ICONS.length;
    return FALLBACK_ICONS[fallbackIndex];
};

/**
 * Reset the used icons tracking (useful when re-rendering with different status sets)
 */
export const resetUsedIcons = () => {
    usedIcons.clear();
};

const StatusCard = ({
    icon: customIcon,
    label,
    value,
    color = { hex: '#5d76cb', bg: 'bg-blue-50' },
    statusType,
    className = '',
    // Optional: pass breakdown entries array [[ stepLabel, count ], ...] to show
    // the Info icon + tooltip. When omitted the card renders exactly as before.
    infoTooltip = null,
    // Optional: formatter for step labels — passed from PendingCard
    onFormatStep = null,
}) => {
    const [infoHovered, setInfoHovered] = useState(false);

    // Get the appropriate icon
    const IconComponent = getIconForStatus(statusType, customIcon);

    const hasTooltip = infoTooltip && infoTooltip.length > 0;

    // Card background — use cardBg if provided, otherwise white (existing behaviour)
    const cardBgStyle = color.cardBg ? { backgroundColor: color.cardBg } : undefined;

    // Icon color — use darker iconHex if provided, otherwise fall back to hex
    const iconColor = color.iconHex || color.hex;

    // Icon pill background — keep existing logic unchanged
    const iconPillBg = color.bg ? undefined : `${color.hex}18`;

    return (
        // `relative` is needed so the tooltip (position:absolute) is anchored to the card
        <div
            className={`relative rounded-xl shadow-sm border border-gray-200/80 p-4 h-full transform transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:z-50 ${className}`}
            style={cardBgStyle}
        >
            {/* ── Top row: value (left) + status icon (right) ── */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-lg font-semibold text-gray-800 mb-1">
                        {value}
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                        {label}
                    </div>
                </div>
                <div
                    className={`p-2 rounded-lg ${color.bg || ''}`}
                    style={iconPillBg ? { backgroundColor: iconPillBg } : undefined}
                >
                    <IconComponent
                        size={16}
                        style={{ color: iconColor }}
                    />
                </div>
            </div>

            {/* ── Info icon — bottom-right, only when infoTooltip is provided ── */}
            {hasTooltip && (
                <div
                    className="absolute bottom-3 right-6 flex items-center justify-center"
                    onMouseEnter={() => setInfoHovered(true)}
                    onMouseLeave={() => setInfoHovered(false)}
                >
                    <Info
                        size={13}
                        className="text-yellow-500 hover:text-yellow-600 cursor-pointer transition-colors duration-150"
                    />

                    {/* Tooltip — renders below the card, caret points upward */}
                    {infoHovered && (
                        <div className="absolute z-50  top-full left-1/2 -translate-x-1/2 mt-5 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-3 pointer-events-none">
                            {/* Caret pointing up toward the Info icon */}
                            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45 block" />
                            <p className="text-xs font-semibold text-gray-700 mb-2">Details</p>
                            <ul className="space-y-1.5">
                                {infoTooltip.map(([step, count]) => (
                                    <li key={step} className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500 truncate pr-2">
                                            {onFormatStep ? onFormatStep(step) : step}:
                                        </span>
                                        <span className="font-semibold text-gray-800 flex-shrink-0">
                                            {count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * BalancedCardGrid - A grid component that automatically balances cards across rows
 * @param {Array} items - Array of items to display
 * @param {Function} renderCard - Function to render each card (receives item and index)
 * @param {number} maxCardsPerRow - Maximum number of cards per row (default: 7 for 2xl screens)
 */
export const BalancedCardGrid = ({ items, renderCard, maxCardsPerRow = 7 }) => {
    if (!items.length) return null;

    const rows = [];
    let remaining = items.length;
    let index = 0;

    while (remaining > 0) {
        let ideal = Math.ceil(remaining / Math.ceil(remaining / maxCardsPerRow));
        ideal = Math.min(ideal, maxCardsPerRow);

        rows.push(items.slice(index, index + ideal));
        index += ideal;
        remaining -= ideal;
    }

    const gridClass = (count) => {
        const map = {
            1: "grid-cols-1",
            2: "grid-cols-2",
            3: "grid-cols-2 sm:grid-cols-3",
            4: "grid-cols-2 sm:grid-cols-4",
            5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-5",
            6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-6",
            7: "grid-cols-2 sm:grid-cols-3 md:grid-cols-7",
        };
        return `grid gap-3 ${map[Math.min(count, maxCardsPerRow)]}`;
    };

    return (
        <div className="space-y-3">
            {rows.map((row, r) => (
                <div key={r} className={gridClass(row.length)}>
                    {row.map((item, i) => renderCard(item, i))}
                </div>
            ))}
        </div>
    );
};

// Export individual icons for external use if needed
export {
    UploadCloud,
    CheckCircle,
    AlertTriangle,
    FileCheck2,
    FileX,
    Loader2,
    Hourglass,
    X,
    Pause,
    Clock,
    FileText,
    TrendingUp,
    Archive,
    Send,
    RotateCw,
    CheckCheck,
    AlertCircle,
    Ban,
    PlayCircle,
    Download,
    Upload,
    RefreshCw,
    UserCheck,
    Shield
};

export default StatusCard;
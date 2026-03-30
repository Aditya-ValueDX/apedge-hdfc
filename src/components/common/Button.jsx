import React from 'react';

/**
 * Reusable Button component.
 *
 * Props:
 *  children    {ReactNode}   - Button label / content
 *  onClick     {function}
 *  disabled    {boolean}
 *  icon        {LucideComponent}  - Icon rendered on the left
 *  iconRight   {LucideComponent}  - Icon rendered on the right
 *  color       {string}  - 'indigo' | 'red' | 'gray' | 'green' | 'yellow' (default: 'indigo')
 *  variant     {string}  - 'solid' | 'outline' | 'ghost' (default: 'solid')
 *  size        {string}  - 'xs' | 'sm' | 'md' (default: 'xs')
 *  className   {string}  - extra Tailwind classes
 *  type        {string}  - button type (default: 'button')
 */

const colorVariants = {
    indigo: {
        solid:   'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400',
        outline: 'border border-indigo-400 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50',
        ghost:   'text-indigo-600 hover:bg-indigo-50 disabled:opacity-50',
    },
    red: {
        solid:   'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300',
        outline: 'border border-red-400 text-red-500 hover:bg-red-50 disabled:opacity-50',
        ghost:   'text-red-500 hover:bg-red-50 disabled:opacity-50',
    },
    gray: {
        solid:   'bg-gray-500 text-white hover:bg-gray-600 disabled:bg-gray-300',
        outline: 'border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50',
        ghost:   'text-gray-500 hover:bg-gray-100 disabled:opacity-50',
    },
    green: {
        solid:   'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300',
        outline: 'border border-green-500 text-green-600 hover:bg-green-50 disabled:opacity-50',
        ghost:   'text-green-600 hover:bg-green-50 disabled:opacity-50',
    },
    yellow: {
        solid:   'bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-yellow-300',
        outline: 'border border-yellow-400 text-yellow-600 hover:bg-yellow-50 disabled:opacity-50',
        ghost:   'text-yellow-600 hover:bg-yellow-50 disabled:opacity-50',
    },
};

const sizeClasses = {
    xs: 'px-2 py-1.5 text-xs gap-1.5 h-7',
    sm: 'px-3 py-1.5 text-sm gap-2 h-8',
    md: 'px-4 py-2 text-sm gap-2 h-9',
};

const iconSizes = { xs: 13, sm: 14, md: 15 };

const Button = ({
    children,
    onClick,
    disabled = false,
    icon: Icon,
    iconRight: IconRight,
    color = 'indigo',
    variant = 'solid',
    size = 'xs',
    className = '',
    type = 'button',
    ...rest
}) => {
    const colorClass  = colorVariants[color]?.[variant] ?? colorVariants.indigo.solid;
    const sizeClass   = sizeClasses[size] ?? sizeClasses.xs;
    const iconPx      = iconSizes[size] ?? 13;

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center rounded-md font-medium cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed ${colorClass} ${sizeClass} ${className}`}
            {...rest}
        >
            {Icon      && <Icon      size={iconPx} className="flex-shrink-0" />}
            {children}
            {IconRight && <IconRight size={iconPx} className="flex-shrink-0" />}
        </button>
    );
};

export default Button;
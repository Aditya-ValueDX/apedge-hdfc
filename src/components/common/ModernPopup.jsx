import React from 'react';
import PropTypes from 'prop-types';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import classNames from 'classnames';

const ModernPopup = ({
  isOpen,
  onClose,
  title,
  children,
  type = 'info',
  primaryButton,
  secondaryButton,
  tertiaryButton,
  showCloseButton = true,
  size = 'md',
  position = 'center',
  customIcon,
  customFooter,
  overlayClose = true,
  className = '',
  closeOnEsc = true
}) => {
  // Don't render if not open
  if (!isOpen) return null;

  // Handle escape key press
  React.useEffect(() => {
    const handleEsc = (event) => {
      if (closeOnEsc && event.keyCode === 27) {
        onClose();
      }
    };
    
    if (isOpen && closeOnEsc) {
      document.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, closeOnEsc, onClose]);

  // Handle overlay click to close
  const handleOverlayClick = (e) => {
    if (overlayClose && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Icon mapping based on type
  const iconMap = {
    success: <CheckCircle className="w-6 h-6 text-green-500" />,
    error: <AlertCircle className="w-6 h-6 text-red-500" />,
    warning: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
    info: <Info className="w-6 h-6 text-blue-500" />
  };

  // Size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    full: 'max-w-full mx-4'
  };

  // Position classes
  const positionClasses = {
    center: 'items-center justify-center',
    top: 'items-start justify-center pt-16',
    bottom: 'items-end justify-center pb-16'
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex bg-black bg-opacity-60 backdrop-blur-sm transition-all duration-300 ease-in-out"
      onClick={handleOverlayClick}
    >
      <div 
        className={classNames(
          "relative w-full mx-4 bg-white rounded-xl shadow-2xl transform transition-all duration-300 ease-in-out",
          sizeClasses[size],
          positionClasses[position],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {customIcon || iconMap[type]}
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
          </div>
          
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-red-500 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {children}
        </div>

        {/* Footer */}
        {customFooter || (primaryButton || secondaryButton || tertiaryButton) ? (
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            {customFooter ? (
              customFooter
            ) : (
              <>
                {tertiaryButton && (
                  <button
                    type="button"
                    onClick={tertiaryButton.onClick}
                    className={classNames(
                      "w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2",
                      tertiaryButton.className || "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-gray-500"
                    )}
                    disabled={tertiaryButton.disabled}
                  >
                    {tertiaryButton.text}
                  </button>
                )}
                
                {secondaryButton && (
                  <button
                    type="button"
                    onClick={secondaryButton.onClick}
                    className={classNames(
                      "w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2",
                      secondaryButton.className || "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-gray-500"
                    )}
                    disabled={secondaryButton.disabled}
                  >
                    {secondaryButton.text}
                  </button>
                )}
                
                {primaryButton && (
                  <button
                    type="button"
                    onClick={primaryButton.onClick}
                    className={classNames(
                      "w-full sm:w-auto px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2",
                      primaryButton.className || "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                    )}
                    disabled={primaryButton.disabled}
                  >
                    {primaryButton.text}
                  </button>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

ModernPopup.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  primaryButton: PropTypes.shape({
    text: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    className: PropTypes.string,
    disabled: PropTypes.bool
  }),
  secondaryButton: PropTypes.shape({
    text: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    className: PropTypes.string,
    disabled: PropTypes.bool
  }),
  tertiaryButton: PropTypes.shape({
    text: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    className: PropTypes.string,
    disabled: PropTypes.bool
  }),
  showCloseButton: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full']),
  position: PropTypes.oneOf(['center', 'top', 'bottom']),
  customIcon: PropTypes.node,
  customFooter: PropTypes.node,
  overlayClose: PropTypes.bool,
  className: PropTypes.string,
  closeOnEsc: PropTypes.bool
};

export default ModernPopup;
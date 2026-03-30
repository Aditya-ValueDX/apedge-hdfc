import React from 'react';

/**
 * A reusable, modern tab component for consistent navigation across the application.
 * 
 * @param {Array<{id: string, label: string}>} tabs - Array of tab objects with id and label
 * @param {string} activeTab - Currently active tab ID
 * @param {function} onTabChange - Callback function when tab changes
 * @param {string} [variant="default"] - Style variant: "default", "pills", or "underlined"
 * @param {string} [tabClassNames=""] - Additional classes for tab buttons
 * @param {string} [containerClassNames=""] - Additional classes for container
 * @param {string} [indicatorClassNames=""] - Additional classes for active indicator
 * 
 * @example
 * <TabComponent
 *   tabs={[
 *     { id: 'details', label: 'Request Details' },
 *     { id: 'attachments', label: 'Attached Bills (3)' }
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 *   variant="underlined"
 * />
 */
const TabComponent = ({ 
  tabs, 
  activeTab, 
  onTabChange, 
  tabClassNames = "",
  containerClassNames = "",
  indicatorClassNames = "",
  variant = "default" // "default" | "pills" | "underlined"
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'pills':
        return {
          container: "gap-2",
          tab: "rounded-full",
          activeTab: "bg-indigo-100 text-indigo-700",
          inactiveTab: "hover:bg-gray-100",
          indicator: "hidden"
        };
      case 'underlined':
        return {
          container: "",
          tab: "rounded-t-lg border-b-2 border-transparent",
          activeTab: "text-indigo-600 border-indigo-600 bg-white/50",
          inactiveTab: "hover:text-indigo-600 hover:border-gray-300",
          indicator: "h-0.5"
        };
      default: // default
        return {
          container: "",
          tab: "rounded-t-lg",
          activeTab: "bg-white/80 text-indigo-600 backdrop-blur-sm",
          inactiveTab: "hover:bg-gray-100/50 hover:text-gray-700",
          indicator: "h-1"
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className={`flex border-b border-gray-200 mb-6 -mt-2 ${styles.container} ${containerClassNames}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`
            py-3 px-3 mr-1 text-xs font-medium transition-all duration-300 relative
            ${activeTab === tab.id
              ? styles.activeTab
              : styles.inactiveTab
            }
            ${tabClassNames} ${styles.tab}
          `}
          onClick={() => onTabChange(tab.id)}
          {...(tab['data-tour'] ? { 'data-tour': tab['data-tour'] } : {})}
        >
          {tab.label}
          {activeTab === tab.id && variant === "default" && (
            <div className={`
              absolute bottom-0 left-0 right-0 bg-gradient-to-r from-indigo-500 to-purple-500 
              rounded-t-sm shadow-sm ${indicatorClassNames} ${styles.indicator}
            `}></div>
          )}
        </button>
      ))}
    </div>
  );
};

export default TabComponent;
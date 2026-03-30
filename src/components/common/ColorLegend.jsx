import React from 'react';

const ColorLegend = ({
    showDuplicateBill = false,
    showReadyForRerun = false,
    showError = false,
    showWarning = false,
    showSuccess = false,
}) => {
    // Show the legend bar whenever at least one indicator is active.
    // Values are computed from the FULL dataset (not the current page) in each queue.
    const hasActiveElements =
        showDuplicateBill || showReadyForRerun || showError || showWarning || showSuccess;

    if (!hasActiveElements) {
        return null;
    }

    return (
        <div
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg z-50 transition-all duration-300 ease-in-out"
            data-tour="color-legend-container"
        >
            <div className="max-w-auto mx-auto px-4 py-1">
                <div className="flex flex-wrap items-center justify-center gap-6">

                    {showDuplicateBill && (
                        <div className="flex items-center" data-tour="color-legend-duplicate-bill">
                            <div className="w-3 h-3 bg-yellow-100 rounded-full shadow-2xl border border-yellow-500 mr-2" />
                            <span className="text-[11px] font-normal text-gray-700">Duplicate Bill (Yellow Row)</span>
                        </div>
                    )}

                    {/* {showWarning && (
                        <div className="flex items-center" data-tour="color-legend-warning">
                            <div className="w-3 h-3 bg-orange-100 rounded-full shadow-2xl border border-orange-500 mr-2" />
                            <span className="text-xs font-medium text-gray-700">Warning</span>
                        </div>
                    )}

                    {showError && (
                        <div className="flex items-center" data-tour="color-legend-error">
                            <div className="w-3 h-3 bg-red-100 rounded-full shadow-2xl border border-red-500 mr-2" />
                            <span className="text-xs font-medium text-gray-700">Error</span>
                        </div>
                    )}

                    {showSuccess && (
                        <div className="flex items-center" data-tour="color-legend-success">
                            <div className="w-3 h-3 bg-green-100 rounded-full shadow-2xl border border-green-500 mr-2" />
                            <span className="text-xs font-medium text-gray-700">Success</span>
                        </div>
                    )}

                    {showReadyForRerun && (
                        <div className="flex items-center" data-tour="color-legend-ready-for-rerun">
                            <div className="w-3 h-3 bg-blue-100 rounded-full shadow-2xl border border-blue-500 mr-2" />
                            <span className="text-xs font-medium text-gray-700">Ready for Rerun</span>
                        </div>
                    )} */}

                </div>
            </div>
        </div>
    );
};

export default ColorLegend;
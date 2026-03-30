import React from 'react';

const StageDisplay = ({ currentStage, stages = ['New', 'Review', 'Reconcile', 'Upload'] }) => {
  const currentStageIndex = stages.indexOf(currentStage);

  return (
    <div className="flex items-center justify-center gap-1 px-2 py-0.5">
      {stages.map((stage, index) => {
        const isCompleted = index <= currentStageIndex;
        const isRejectedStage = stage === 'Upload' && currentStage?.toLowerCase() === 'rejected';

        let dotClass = 'bg-gray-300 border-gray-400';
        let lineClass = 'bg-gray-300';
        let content = '';

        if (isRejectedStage) {
          dotClass = 'bg-red-500 border-red-600 shadow-md';
          lineClass = 'bg-red-500 shadow-sm';
          content = 'X';
        } else if (isCompleted) {
          dotClass = 'bg-green-500 border-green-600 shadow-md';
          lineClass = 'bg-green-500 shadow-sm';
        }

        return (
          <div key={stage} className="flex items-center relative">
            <div className="relative inline-block group">
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 ease-in-out cursor-pointer relative ${dotClass}`}
              >
                {isRejectedStage && (
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-white">
                    X
                  </span>
                )}
              </div>
              <span className="absolute z-[9999] bottom-[125%] left-1/2 -translate-x-1/2 invisible opacity-0 whitespace-nowrap bg-gray-900 text-white text-[11px] font-medium rounded-md px-2 py-1 shadow-lg transition-all duration-300 ease-in-out group-hover:visible group-hover:opacity-100 group-hover:-translate-y-px after:content-[''] after:absolute after:top-full after:left-1/2 after:-ml-1 after:border-4 after:border-solid after:border-transparent after:border-t-gray-900">
                {stage}
              </span>
            </div>
            {index !== stages.length - 1 && (
              <div
                className={`h-0.5 w-5 mx-1 rounded-sm transition-all duration-300 ${lineClass}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StageDisplay;
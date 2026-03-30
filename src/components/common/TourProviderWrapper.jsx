import { TourProvider, useTour } from "@reactour/tour";

// Add custom animations to the document head for better tour experience
const addTourStyles = () => {
  if (typeof document !== 'undefined') {
    const styleId = 'tour-highlight-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes tour-highlight {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
          } 
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
        
        @keyframes tour-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.2);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
        
        @keyframes tour-smooth-scroll {
          0% {
            opacity: 0.8;
            transform: translateX(0);
          }
          50% {
            opacity: 1;
            transform: translateX(2px);
          }
          100% {
            opacity: 0.8;
            transform: translateX(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }
};

// Call the function to add styles
addTourStyles();

// Updated styles to match the application's color scheme and font
const tourStyles = {
  popover: (base) => ({
    ...base,
    backgroundColor: "#fff",
    borderRadius: "0.75rem", // rounded-xl equivalent
    padding: "1.25rem",
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
    border: "1px solid #cbd5e1", // slate-300 border for a more subtle look
    color: "#1e293b", // slate-800 text
    fontSize: "0.875rem", // text-sm
    fontFamily: "'Poppins', sans-serif", // Match the app font
  }),
  maskArea: (base) => ({
    ...base,
    rx: 8,
  }),
  maskWrapper: (base) => ({
    ...base,
    // Remove any blue highlighting by ensuring no background color
    backgroundColor: "transparent",
  }),
  highlightedArea: (base) => ({
    ...base,
    // Keep only the outer highlight, remove inner blue highlighting
    backgroundColor: "transparent",
    // Add a subtle border instead of blue background
    border: "2px solid rgba(59, 130, 246, 0.5)", // blue-500 with transparency
    borderRadius: "4px",
    // Add a subtle pulse animation to draw attention
    animation: "tour-pulse 2s ease-out infinite",
    // Add smooth transition for horizontal scrolling
    transition: "all 0.3s ease-out",
  }),
  badge: (base) => ({
    ...base,
    background: "#3b82f6", // blue-500 to match app's primary blue
    borderRadius: "50%", // Make it a perfect circle
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    fontSize: "0.75rem", // text-xs
    fontWeight: "600", // Semi-bold for better visibility
    color: "white",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  }),
  controls: (base) => ({
    ...base,
    marginTop: "1rem",
    display: "flex",
    justifyContent: "space-between",
    gap: "0.5rem",
  }),
  close: (base) => ({
    ...base,
    display: "none", // Hide default close button since we'll use custom Skip
  }),
  arrow: (base) => ({
    ...base,
    color: "#3b82f6", // blue-500 to match app's primary blue
  }),
};

// Custom navigation buttons component - Updated to match app styling
const CustomNavigation = ({ currentStep, setCurrentStep, setIsOpen }) => {
  // Use the useTour hook to get the steps directly
  const { steps } = useTour();
  
  // Add defensive checks for props
  const currentStepIndex = currentStep || 0;
  const totalSteps = steps ? steps.length : 0;
  
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = totalSteps > 0 && currentStepIndex === totalSteps - 1;

  return (
    <div className="flex items-center justify-between gap-2 mt-4 w-full">
      {/* Skip Button */}
      <button
        onClick={() => setIsOpen(false)}
        className="px-3 py-1.5 text-xs rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200 active:scale-95 font-medium"
      >
        Skip Tour
      </button>

      <div className="flex items-center gap-2">
        {/* Previous Button */}
        <button
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={isFirstStep}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${
            isFirstStep
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95"
          }`}
        >
          Previous
        </button>

        {/* Next/Finish Button */}
        <button
          onClick={() => {
            if (isLastStep) {
              setIsOpen(false);
            } else {
              setCurrentStep((s) => s + 1);
            }
          }}
          className="px-3 py-1.5 text-xs rounded-lg font-medium bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          {isLastStep ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
};

export default function TourProviderWrapper({ children, steps }) {
  return (
    <TourProvider
      steps={steps}
      styles={tourStyles}
      components={{ Navigation: CustomNavigation }}
      showBadge={true}
      showCloseButton={true}
    >
      {children}
    </TourProvider>
  );
}
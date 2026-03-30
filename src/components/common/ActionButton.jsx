import { useState } from "react";
import { toast } from "react-toastify";
import { Info, CheckCircle, XCircle, X, ExternalLink } from "lucide-react";
import { useSelector } from "react-redux";
import axios from "../../utils/authInterceptor"
import { createPortal } from "react-dom";

const ActionButton = ({
    buttonConfig,
    buttonIndex,
    formData,
    onUpdateField, // Callback: (fieldName, newValue) => void
    isEditable = true,
    className = ""
}) => {
    const [loading, setLoading] = useState(false);
    const [apiResponse, setApiResponse] = useState(null);
    const [showResponse, setShowResponse] = useState(false);
    const [showModal, setShowModal] = useState(false);

    console.log("buttonConfig", buttonConfig);
    console.log("formData", formData);


    // console.log("buttonConfig", buttonConfig);
    // console.log("formData", formData);
    const user = useSelector(state => state.auth?.user);

    const token = user?.token;

    const tenantId = user.tenantId;
    const userId = user.user_id;

    // Simulation logic (can be replaced with a real API utility prop)
    // const executeApiCall = async () => {
    //     setLoading(true);

    //     try {
    //         await new Promise(resolve => setTimeout(resolve, 1500));

    //         let response;

    //         // ✅ If this is the first indexed button → return error response
    //         if (buttonIndex === 0) {
    //             response = {
    //                 success: false,
    //                 status: "FAILED",
    //                 message: "Unable to fetch details",
    //                 data: null,
    //                 timestamp: "2026-02-04T10:15:30Z",
    //                 error: {
    //                     code: "INTERNAL_SERVER_ERROR",
    //                     details: "Database connection timeout"
    //                 }
    //             };
    //         } else {
    //             const isSuccess = true;
    //             const fullHtmlContent = `
    //     <!DOCTYPE html>
    //     <html>
    //       <head>
    //         <title>Verification Result</title>
    //         <style>
    //             body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
    //             .title { color: #4f46e5; font-size: 2.5rem; }
    //             #currentTime { color: #64748b; font-mono; }
    //         </style>
    //       </head>
    //       <body>
    //           <h1 class="title">Verification Successful!</h1>
    //           <p id="currentTime"></p>
    //           <script>
    //               document.getElementById('currentTime').innerText = "Verified at: " + new Date().toLocaleString();
    //           </script>
    //       </body>
    //     </html>`;

    //             response = {
    //                 success: isSuccess,
    //                 status: "SUCCESS",
    //                 message: `${buttonConfig.display_name} verified successfully`,
    //                 data: {
    //                     Vendor_company_name: "ValueDX Solutions Pvt Ltd",
    //                     Vendor_GSTIN: "29AABCT1332L1Z5",
    //                     // 1. Added URL field
    //                     Verification_Link: "https://www.gst.gov.in/",
    //                     // Added HTML for stylized redirection
    //                     Verification_Report_HTML: fullHtmlContent,
    //                 }
    //             };
    //         }

    //         setApiResponse(response);
    //         setShowResponse(true);

    //         response.success
    //             ? toast.success(response.message)
    //             : toast.error(response.message);

    //     } catch (error) {
    //         toast.error("Network error occurred");
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    const resolveFieldValue = (fieldName, data) => {
        if (!data || !fieldName) return undefined;

        // 1. Check if the key exists at the current level
        if (Object.prototype.hasOwnProperty.call(data, fieldName)) {
            const val = data[fieldName];
            // We only return if it's a primitive (string/number/bool). 
            // If it's an array/object, we continue searching deeper.
            if (typeof val !== 'object' || val === null) {
                return val;
            }
        }

        // 2. Iterate through all keys to search nested structures
        for (const key in data) {
            const value = data[key];

            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    // Search inside each object of the array (e.g., PO_Number, LineItems)
                    for (const item of value) {
                        const result = resolveFieldValue(fieldName, item);
                        if (result !== undefined) return result;
                    }
                } else {
                    // Search inside nested object
                    const result = resolveFieldValue(fieldName, value);
                    if (result !== undefined) return result;
                }
            }
        }

        return undefined;
    };

    const executeApiCall = async () => {
        // 1. Validation: Check if custom_values is present for button type
        if (!buttonConfig.custom_values || buttonConfig.custom_values.trim() === "") {
            toast.error(`Configuration missing for button: ${buttonConfig.display_name}`);
            return;
        }

        setLoading(true);

        try {
            let uniqueKey = "AE_CREDENTIALS22223345"; // Default fallback
            let workflowName = "Manual_apedge"; // Default
            let targetType = ""; // New field
            let workflowParams = []; // Kept empty as per user's manual change

            // 2. Parse custom_values
            try {
                // Try JSON format first
                const config = JSON.parse(buttonConfig.custom_values);

                const configTargetType = (config.target_type || "").trim();
                const configInputValue = (config.input_value || "").trim();

                // Validation Rule: Both empty -> Error
                if (!configTargetType && !configInputValue && !config.unique_key) {
                    toast.error(`Configuration missing for: ${buttonConfig.display_name}`);
                    setLoading(false);
                    return;
                }

                // Validation Rule: Target type selected but Input value empty -> Error
                // Only if NOT using unique_key? Actually, usually target_type=Workflow needs inputValue or uniqueKey.
                if (configTargetType && !configInputValue && !config.unique_key) {
                    toast.error(`Workflow name missing for button: ${buttonConfig.display_name}`);
                    setLoading(false);
                    return;
                }

                targetType = configTargetType;
                workflowName = configInputValue;

                // Dynamically set uniqueKey from config if present
                if (config.unique_key) {
                    uniqueKey = config.unique_key;
                }

                // Match field_name array with formData
                if (config.field_name && Array.isArray(config.field_name)) {
                    config.field_name.forEach(fieldName => {
                        const resolvedValue = resolveFieldValue(fieldName, formData);
                        if (resolvedValue !== undefined) {
                            workflowParams.push({
                                name: fieldName,
                                value: resolvedValue
                            });
                        }
                    });
                }
            } catch (jsonError) {
                // Fallback to legacy parsing: Execute(KEY_NAME)
                const match = buttonConfig.custom_values.match(/Execute\((.*?)\)/);
                if (match && match[1]) {
                    uniqueKey = match[1].trim();
                }
            }

            const payload = {
                targetType: targetType,
                workflowName: workflowName,
                params: workflowParams
            };

            console.log('🚀 Sending API Payload:', payload);

            // Making the actual POST request
            const response = await axios.post(
                `/api/execute/${tenantId}/${uniqueKey}`,
                payload
            );

            console.log('✅ API Response:', response.data);

            // The response structure provided by the user is:
            // { success: boolean, status: string, message: string, data: any, error?: { code, details }, timestamp }

            const rawData = response.data;
            const isSuccess = rawData.success !== false && rawData.status !== "FAILED";

            const parsedResponse = {
                success: isSuccess,
                status: rawData.status || (isSuccess ? "SUCCESS" : "FAILED"),
                message: rawData.message || (isSuccess ? `${buttonConfig.display_name} executed successfully` : "Execution failed"),
                data: rawData.data,
                timestamp: rawData.timestamp || new Date().toISOString(),
                error: rawData.error || null
            };

            setApiResponse(parsedResponse);
            setShowResponse(true);
            setShowModal(true); // Automatically show modal with results

            // Show toast notification
            isSuccess
                ? toast.success(parsedResponse.message)
                : toast.error(parsedResponse.message);

        } catch (error) {
            console.error('❌ API Error:', error);
            const errorData = error.response?.data;

            const errorResponse = {
                success: false,
                status: errorData?.status || "FAILED",
                message: errorData?.message || error.message || "Network error occurred",
                data: null,
                timestamp: errorData?.timestamp || new Date().toISOString(),
                error: {
                    code: errorData?.error?.code || error.code || "API_ERROR",
                    details: errorData?.error?.details || errorData?.details || error.message || "An unexpected error occurred"
                }
            };

            setApiResponse(errorResponse);
            setShowResponse(true);
            setShowModal(true);
            toast.error(errorResponse.message);
        } finally {
            setLoading(false);
        }
    };


    const handleApplyAllUpdates = () => {
        if (!apiResponse?.data) return;

        const fields = Object.entries(apiResponse.data);
        fields.forEach(([fieldName, value]) => {
            if (value) {
                onUpdateField(fieldName, value);
            }
        });

        toast.success(`Applied ${fields.length} updates successfully!`);
        setShowModal(false); // Close modal after applying
    };

    const meta = buttonConfig.meta_config?.value ? JSON.parse(buttonConfig.meta_config.value) : {};
    if (meta.visible === false || meta.visible === 'false') return null;

    return (
        <div className={`relative flex items-center gap-2 ${className}`}>
            <button
                onClick={executeApiCall}
                disabled={!isEditable || loading || meta.readonly === 'true'}
                className={`
          inline-flex items-center justify-center gap-2 px-3 py-1.5 
          rounded-md font-semibold text-xs transition-all shadow-md
          ${loading ? 'bg-gray-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}
          disabled:opacity-50 disabled:shadow-none
        `}
            >
                {loading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {buttonConfig.display_name}
            </button>

            {apiResponse && !loading && (
                <button
                    onClick={() => setShowModal(true)}
                    className={`p-1 rounded-full ${showResponse ? 'bg-indigo-100' : 'hover:bg-gray-100'}`}
                >
                    <Info size={16} className={apiResponse.success ? "text-green-600" : "text-red-600"} />
                </button>
            )}

            {/* Popover Response UI */}
            {showModal && apiResponse && createPortal(
                <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/60 animate-in fade-in duration-200"
                    />

                    {/* Modal Content */}
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                        {/* Header */}
                        <div className={`px-4 py-3 flex justify-between items-center border-b ${apiResponse.success ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                            <div className="flex items-center gap-2">
                                {apiResponse.success ? <CheckCircle size={18} className="text-green-600" /> : <XCircle size={18} className="text-red-600" />}
                                <h3 className={`text-sm font-bold uppercase tracking-wider ${apiResponse.success ? 'text-green-800' : 'text-red-800'}`}>
                                    {apiResponse.status} Results
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 hover:bg-black/5 rounded-full text-gray-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5">
                            <p className="text-sm text-gray-700 font-medium mb-4">{apiResponse.message}</p>

                            {apiResponse.success && apiResponse.data && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            <ExternalLink size={12} /> Suggested Updates
                                        </div>

                                        <button
                                            onClick={handleApplyAllUpdates}
                                            className="inline-flex items-center gap-1.5 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded shadow-sm transition-all active:scale-95"
                                        >
                                            {/* <CheckDouble size={12} /> */}
                                            Update All
                                        </button>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                        {/* Replace the current Object.entries(apiResponse.data).map block with this: */}

                                        {Object.entries(apiResponse.data).map(([key, val]) => {
                                            if (!val) return null;

                                            // Detect if the string starts with an HTML doctype or tag
                                            const isFullHtml = typeof val === 'string' && val.trim().toLowerCase().startsWith('<!doctype') || val.includes('<html');
                                            const isUrl = typeof val === 'string' && (val.startsWith('http') || val.startsWith('www'));

                                            const handleOpenHtmlInNewTab = (htmlContent) => {
                                                const blob = new Blob([htmlContent], { type: 'text/html' });
                                                const url = URL.createObjectURL(blob);
                                                const newWindow = window.open(url, '_blank');

                                                // Clean up the URL object after the window is closed or loaded
                                                if (newWindow) {
                                                    newWindow.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
                                                }
                                            };

                                            return (
                                                <div key={key} className="group flex flex-col gap-1.5 p-3 mb-2 bg-slate-50 rounded-lg border border-slate-200">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">
                                                        {key.replace(/_/g, ' ')}
                                                    </span>
                                                    <div className="text-xs font-mono text-indigo-700 break-all bg-white p-2 rounded border border-slate-200">
                                                        {isFullHtml ? (
                                                            <button
                                                                onClick={() => handleOpenHtmlInNewTab(val)}
                                                                className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
                                                            >
                                                                <ExternalLink size={14} />
                                                                VIEW FULL REPORT (HTML)
                                                            </button>
                                                        ) : isUrl ? (
                                                            <a
                                                                href={val.startsWith('www') ? `https://${val}` : val}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-indigo-600 underline flex items-center gap-1"
                                                            >
                                                                {val} <ExternalLink size={12} />
                                                            </a>
                                                        ) : (
                                                            val
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {!apiResponse.success && (
                                <div className="space-y-3">

                                    {/* <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                                        <p className="text-xs text-red-700 font-semibold">
                                            {apiResponse.message}
                                        </p>
                                    </div> */}

                                    {apiResponse.error && (
                                        <div className="bg-white border border-red-200 rounded-lg p-3 space-y-2 text-xs">
                                            <div>
                                                <span className="font-bold text-red-600">Error Code:</span>
                                                <span className="ml-2 font-mono text-gray-700">
                                                    {apiResponse.error.code}
                                                </span>
                                            </div>

                                            {/* <div>
                                                <span className="font-bold text-red-600">Details:</span>
                                                <span className="ml-2 text-gray-700">
                                                    {apiResponse.error.details}
                                                </span>
                                            </div> */}

                                            {apiResponse.timestamp && (
                                                <div>
                                                    <span className="font-bold text-red-600">Timestamp:</span>
                                                    <span className="ml-2 text-gray-500 font-mono">
                                                        {new Date(apiResponse.timestamp).toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 bg-gray-50 border-t flex justify-end">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                CLOSE
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ActionButton;
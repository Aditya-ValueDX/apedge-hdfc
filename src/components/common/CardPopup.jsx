import React, { useCallback, useEffect, useState } from "react";
import {
    X,
    MessageCircle,
    IndianRupee,
    Save,
    XCircle,
    CheckCircle,
    Plus,
    Minus,
    AlertTriangle,
} from "lucide-react";
import classNames from "classnames";
import TableComponent from "./TableComponent";
import { parseCustomValues } from "../../utils/customValuesParser";
import SearchableSelect from "./SearchableSelect";
import DropdownOptions from "./DropdownOptions";
import MasterKeyOptions from "./MasterKeyOptions";
import HistoryOptions from "./HistoryOptions";
import axios from "../../utils/authInterceptor";
import { useSelector } from "react-redux";

const CardPopup = ({
    isOpen,
    onRequestClose,
    title,
    content,
    isEditable,
    onContentChange,
    isError,
    field,
    contentType,
    itemId,
    onSave,
    onReject,
    showActionButtons = false,
    fieldType,
    currentFormFields = [],
    fieldName = "",
}) => {
    if (!isOpen) {
        return null;
    }

    // Local state to hold temporary content changes
    const [tempContent, setTempContent] = useState(content);

    // Get user from Redux store
    const user = useSelector((state) => state.auth.user);
    const token = user?.token;
    const tenantId = user?.tenantId;

    // State for master keys
    const [masterKeys, setMasterKeys] = useState([]);
    const [loadingMasterKeys, setLoadingMasterKeys] = useState(false);

    // State for tabs
    const [activeTab, setActiveTab] = useState("dropdown"); // 'dropdown', 'masterKey', or 'history'

    // State for master key selection
    const [selectedMasterKey, setSelectedMasterKey] = useState("");

    // State for invoice configuration fields
    const [invoiceConfigFields, setInvoiceConfigFields] = useState([]);

    // State for history field
    const [historyValue, setHistoryValue] = useState("");

    // State for dropdown content
    const [dropdownContent, setDropdownContent] = useState("");

    // Derived metaConfig state from content prop (Stateless)
    const metaConfig = contentType === 'metaConfig'
        ? (() => {
            let parsed;
            if (typeof content === 'string') {
                try {
                    parsed = content ? JSON.parse(content) : {};
                } catch (e) {
                    parsed = {};
                }
            } else {
                parsed = content || {};
            }

            // Normalize keys - handle both with and without is_ prefix
            return {
                required: parsed.required !== undefined ? parsed.required : (parsed.is_required !== undefined ? parsed.is_required : false),
                visible: parsed.visible !== undefined ? parsed.visible : (parsed.is_visible !== undefined ? parsed.is_visible : true),
                readonly: parsed.readonly !== undefined ? parsed.readonly : (parsed.is_readonly !== undefined ? parsed.is_readonly : false)
            };
        })()
        : { required: false, visible: true, readonly: false };

    // Update tempContent when content prop changes
    useEffect(() => {
        setTempContent(content);
        setDropdownContent(content || "");

        // If content contains both MasterKey and History (check this first)
        if (
            content &&
            content.includes("MasterKey(") &&
            content.includes("History(")
        ) {
            setActiveTab("masterKey"); // Default to master key tab
            // Extract master key with a more precise regex to avoid including History part
            const masterKeyMatch = content.match(/MasterKey\(([^;]*?)\)/);
            if (masterKeyMatch) {
                setSelectedMasterKey(masterKeyMatch[1]);
            }
            // Extract history with a more precise regex
            const historyMatch = content.match(/History\(([^;]*?)\)/);
            if (historyMatch) {
                setHistoryValue(historyMatch[1]);
            }
        }
        // If content is in MasterKey format
        else if (content && content.startsWith("MasterKey(")) {
            setActiveTab("masterKey");
            // Use a more precise regex to avoid capturing History part
            const match = content.match(/^MasterKey\(([^;]*)\)/);
            if (match) {
                setSelectedMasterKey(match[1]);
            }
        }
        // If content is in History format
        else if (content && content.startsWith("History(")) {
            setActiveTab("history");
            const match = content.match(/^History\((.*)\)$/);
            if (match) {
                setHistoryValue(match[1]);
            }
        } else if (contentType === 'metaConfig') {
            // Logic moved to derived state - no side effects needed
        } else {
            // Default to dropdown tab
            setActiveTab("dropdown");
            setSelectedMasterKey("");
            setHistoryValue("");
        }
    }, [content, contentType]);

    // Fetch master keys for the tenant
    const fetchMasterKeys = useCallback(async () => {
        if (!user || !token || !tenantId) {
            return;
        }

        setLoadingMasterKeys(true);
        try {
            const response = await axios.get(
                `/api/v1/tables/ap_masters?tenant_id=eq.${tenantId}&select=unique_key`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const keys = response.data.map((master) => master.unique_key);
            setMasterKeys(keys);
        } catch (error) {
            // Error fetching master keys
        } finally {
            setLoadingMasterKeys(false);
        }
    }, [user, token, tenantId]);

    // Fetch invoice configuration fields for the tenant
    const fetchInvoiceConfigFields = useCallback(async () => {
        if (!user || !token || !tenantId) {
            return;
        }

        try {
            const response = await axios.get(
                `/api/v1/tables/ap_field_config?tenant_id=eq.${tenantId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setInvoiceConfigFields(response.data);
        } catch (error) {
            // Error fetching invoice configuration fields
        }
    }, [user, token, tenantId]);

    // Fetch master keys and invoice config fields when component mounts and user is available
    useEffect(() => {
        if (user && token && tenantId) {
            fetchMasterKeys();
            fetchInvoiceConfigFields();
        }
    }, [user, token, tenantId, fetchMasterKeys, fetchInvoiceConfigFields]);

    const handleModalClick = (e) => {
        // Prevent closing when clicking inside the popup
        e.stopPropagation();
    };

    // Handle cancel action (when user clicks outside or on cancel button)
    const handleCancel = () => {
        // Reset temp content to original content
        setTempContent(content);
        if (onRequestClose) {
            onRequestClose();
        }
    };

    // Function to parse log text into structured data for table display
    const parseLogText = (logText) => {
        if (!logText) return { generalInfo: [], lineItems: [] };

        const generalInfo = [];
        const lineItems = [];

        // Split log text into lines
        const lines = logText.split("\n");

        lines.forEach((line) => {
            if (!line.trim()) return;

            // Extract timestamp if available
            const timestampMatch = line.match(/\[([^\]]+)\]/);
            let timestamp = null;
            if (timestampMatch) {
                timestamp = new Date(timestampMatch[1]).toLocaleString();
            }

            // For line item approvals/rejections
            if (line.includes("Line item")) {
                const idMatch = line.match(/ID: ([^\)]+)/);
                const sectionMatch = line.match(/section "([^"]+)"/);
                const actionMatch = line.match(/(approved|rejected)/);
                const amountMatch = line.match(/with amount ([\d.]+)/);
                const requestedAmountMatch = line.match(
                    /Requested amount was ([\d.]+)/
                );
                const statusChangeMatch = line.match(
                    /Status changed from ([^ ]+) to ([^.]+)/
                );
                const commentMatch = line.match(/Comments: "([^"]+)"/);

                // Create line item object for table
                lineItems.push({
                    id: idMatch ? idMatch[1] : "N/A",
                    section: sectionMatch ? sectionMatch[1] : "N/A",
                    action: actionMatch ? actionMatch[1] : "N/A",
                    approvedAmount: amountMatch
                        ? parseFloat(amountMatch[1]).toFixed(2)
                        : "0.00",
                    requestedAmount: requestedAmountMatch
                        ? parseFloat(requestedAmountMatch[1]).toFixed(2)
                        : "N/A",
                    statusChange: statusChangeMatch
                        ? `${statusChangeMatch[1]} → ${statusChangeMatch[2]}`
                        : "N/A",
                    timestamp: timestamp,
                });

                // Add comments to general info if present
                if (commentMatch) {
                    generalInfo.push({
                        field: "Comments",
                        value: commentMatch[1],
                    });
                }
            }
            // For overall request approvals/rejections
            else if (line.includes("Request")) {
                const actionMatch = line.match(/Request (approved|rejected)/);
                const amountMatch = line.match(/total amount ([\d.]+)/);
                const previousStatusMatch = line.match(/Previous status was ([^.]+)/);
                const commentMatch = line.match(/Comments: "([^"]+)"/);

                if (actionMatch) {
                    generalInfo.push({
                        field: "Action",
                        value: actionMatch[1],
                    });
                }

                if (amountMatch) {
                    generalInfo.push({
                        field: "Total Amount",
                        value: (
                            <span className="inline-flex items-center">
                                <IndianRupee size={12} />
                                {parseFloat(amountMatch[1]).toFixed(2)}
                            </span>
                        ),
                    });
                }

                if (previousStatusMatch) {
                    generalInfo.push({
                        field: "Previous Status",
                        value: previousStatusMatch[1],
                    });
                }

                if (commentMatch) {
                    generalInfo.push({
                        field: "Comments",
                        value: commentMatch[1],
                    });
                }

                if (timestamp) {
                    generalInfo.push({
                        field: "Timestamp",
                        value: timestamp,
                    });
                }
            }
            // For generic log entries
            else {
                generalInfo.push({
                    field: "Details",
                    value: line,
                });
            }
        });

        return { generalInfo, lineItems };
    };

    // Function to render general information outside table
    const renderGeneralInfo = (generalInfo) => {
        return (
            <div className="mb-4">
                {generalInfo.map((item, index) => (
                    <div key={index} className="flex mb-2">
                        <div className="font-medium text-gray-700 w-40">{item.field}:</div>
                        <div className="text-gray-900 flex-1">{item.value}</div>
                    </div>
                ))}
            </div>
        );
    };

    // Function to render table for line items
    const renderLineItemsTable = (lineItems) => {
        if (lineItems.length === 0) return null;

        return (
            <div className="mt-4">
                <h3 className="font-semibold text-gray-800 mb-2">Line Items</h3>
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    <TableComponent
                        data={lineItems}
                        columns={[
                            {
                                key: "timestamp",
                                header: "Timestamp",
                                width: "150px",
                                render: (item) => (
                                    <div className="text-sm text-gray-900">
                                        {item.timestamp || "N/A"}
                                    </div>
                                ),
                            },
                            {
                                key: "section",
                                header: "Section",
                                width: "100px",
                                render: (item) => (
                                    <div className="text-sm text-gray-900">{item.section}</div>
                                ),
                            },
                            {
                                key: "action",
                                header: "Action",
                                width: "80px",
                                render: (item) => (
                                    <span
                                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.action === "approved"
                                            ? "bg-green-100 text-green-800"
                                            : "bg-red-100 text-red-800"
                                            }`}
                                    >
                                        {item.action}
                                    </span>
                                ),
                            },
                            {
                                key: "approvedAmount",
                                header: "Approved Amount",
                                width: "120px",
                                render: (item) => (
                                    <div className="text-sm text-gray-900 inline-flex items-center">
                                        <IndianRupee size={10} />
                                        {item.approvedAmount}
                                    </div>
                                ),
                            },
                            {
                                key: "requestedAmount",
                                header: "Requested Amount",
                                width: "120px",
                                render: (item) => (
                                    <div className="text-sm text-gray-900 inline-flex items-center">
                                        <IndianRupee size={10} />
                                        {item.requestedAmount}
                                    </div>
                                ),
                            },
                            {
                                key: "statusChange",
                                header: "Status Change",
                                width: "150px",
                                render: (item) => (
                                    <div className="text-sm text-gray-900">
                                        {item.statusChange}
                                    </div>
                                ),
                            },
                        ]}
                        columnFilters={{}}
                        setColumnFilters={() => { }}
                        sortField=""
                        setSortField={() => { }}
                        sortAsc={true}
                        setSortAsc={() => { }}
                        page={1}
                        setPage={() => { }}
                        pageSize={5}
                        emptyMessage="No line items found."
                    />
                </div>
            </div>
        );
    };

    // Function to render table for log details
    const renderLogTable = (item) => {
        const { generalInfo, lineItems } = parseLogText(item.log_text);

        return (
            <div className="max-h-96 overflow-y-auto pr-2">
                {renderGeneralInfo(generalInfo)}
                {renderLineItemsTable(lineItems)}
            </div>
        );
    };

    // Handle save action
    // This function preserves state from all tabs during save operations
    // regardless of which tab is currently active
    const handleSave = async () => {
        // Format the content based on the active configuration
        let formattedContent = "";

        // Check if we have both master key and history values
        // This ensures state from all tabs is preserved during save
        if (selectedMasterKey && historyValue) {
            // Both master key and history are selected
            formattedContent = `MasterKey(${selectedMasterKey}); History(${historyValue})`;
        }
        // Check which tab is active and format content accordingly
        else if (activeTab === "dropdown" && dropdownContent) {
            formattedContent = dropdownContent;
        } else if (activeTab === "masterKey" && selectedMasterKey) {
            // Only master key is selected
            formattedContent = `MasterKey(${selectedMasterKey})`;
        } else if (activeTab === "history" && historyValue) {
            formattedContent = `History(${historyValue})`;
        } else if (contentType === 'metaConfig') {
            formattedContent = JSON.stringify(metaConfig);
        }

        if (onSave) {
            await onSave(formattedContent, itemId, field);
        } else if (onContentChange) {
            // If no onSave function is provided, use onContentChange and close
            onContentChange(formattedContent);
        }
        onRequestClose();
    };

    // Handle reject action
    // This function preserves state from all tabs during reject operations
    // regardless of which tab is currently active
    const handleReject = async () => {
        // Format the content based on the active configuration
        let formattedContent = "";

        // Check if we have both master key and history values
        // This ensures state from all tabs is preserved during reject
        if (selectedMasterKey && historyValue) {
            // Both master key and history are selected
            formattedContent = `MasterKey(${selectedMasterKey}); History(${historyValue})`;
        }
        // Check which tab is active and format content accordingly
        else if (activeTab === "dropdown" && dropdownContent) {
            formattedContent = dropdownContent;
        } else if (activeTab === "masterKey" && selectedMasterKey) {
            // Only master key is selected
            formattedContent = `MasterKey(${selectedMasterKey})`;
        } else if (activeTab === "history" && historyValue) {
            formattedContent = `History(${historyValue})`;
        }

        if (onReject) {
            await onReject(formattedContent, itemId, field);
        } else if (onContentChange) {
            // If no onReject function is provided, use onContentChange and close
            onContentChange(formattedContent);
        }
        onRequestClose();
    };

    // Add state for validation error and validity
    const [validationError, setValidationError] = useState("");
    const [isValid, setIsValid] = useState(true);

    // Function to validate custom values format
    const validateCustomValues = (content) => {
        if (!content || content.trim() === "") {
            return { isValid: true, error: "" };
        }

        // Check for Drop format
        if (content.startsWith("Drop(")) {
            const dropMatch =
                content.match(/^Drop\((.*)\)$/) || content.match(/Drop\((.*?)\)/);
            if (dropMatch) {
                const options = dropMatch[1].split(",").map((item) => item.trim());
                if (options.length === 0 || options.some((opt) => opt === "")) {
                    return {
                        isValid: false,
                        error:
                            "Drop format requires at least one option. Format: Drop(option1, option2, ...)",
                    };
                }
                return { isValid: true, error: "" };
            }
            return {
                isValid: false,
                error: "Invalid Drop format. Use: Drop(option1, option2, ...)",
            };
        }

        // Check for MasterKey format
        if (content.startsWith("MasterKey(")) {
            const masterKeyMatch =
                content.match(/^MasterKey\((.*)\)$/) ||
                content.match(/MasterKey\((.*?)\)/);
            if (masterKeyMatch) {
                const key = masterKeyMatch[1].trim();
                if (!key) {
                    return {
                        isValid: false,
                        error:
                            "MasterKey format requires a key. Format: MasterKey(master_key_name)",
                    };
                }
                // Additional validation: Check if the master key exists in the tenant's master keys
                // Skip validation if master keys are still loading
                if (
                    !loadingMasterKeys &&
                    masterKeys.length > 0 &&
                    !masterKeys.includes(key)
                ) {
                    return {
                        isValid: false,
                        error: `Master key "${key}" not found in your tenant's master keys.`,
                    };
                }
                return { isValid: true, error: "" };
            }
            return {
                isValid: false,
                error: "Invalid MasterKey format. Use: MasterKey(key_name)",
            };
        }

        // Check for History format
        if (content.startsWith("History(")) {
            const historyMatch =
                content.match(/^History\((.*)\)$/) || content.match(/History\((.*?)\)/);
            if (historyMatch) {
                const fieldName = historyMatch[1].trim();
                if (!fieldName) {
                    return {
                        isValid: false,
                        error:
                            "History format requires a field name. Format: History(field_name)",
                    };
                }
                // Additional validation: Check if the field name exists in current form fields
                if (currentFormFields.length > 0) {
                    const fieldNames = currentFormFields.map(
                        (field) => field.name || field.field_name
                    );
                    if (!fieldNames.includes(fieldName)) {
                        return {
                            isValid: false,
                            error: `Field name "${fieldName}" not found in current form fields.`,
                        };
                    }
                }
                return { isValid: true, error: "" };
            }
            return {
                isValid: false,
                error: "Invalid History format. Use: History(field_name)",
            };
        }

        // Check for combined MasterKey and History format
        if (content.includes("MasterKey(") && content.includes("History(")) {
            const masterKeyMatch =
                content.match(/MasterKey\(([^;]*?)\)/) ||
                content.match(/MasterKey\((.*?)\)/);
            const historyMatch =
                content.match(/History\(([^;]*?)\)/) ||
                content.match(/History\((.*?)\)/);

            if (masterKeyMatch && historyMatch) {
                const key = masterKeyMatch[1].trim();
                const fieldName = historyMatch[1].trim();

                // Validate master key
                if (!key) {
                    return {
                        isValid: false,
                        error:
                            "MasterKey format requires a key. Format: MasterKey(master_key_name)",
                    };
                }
                if (
                    !loadingMasterKeys &&
                    masterKeys.length > 0 &&
                    !masterKeys.includes(key)
                ) {
                    return {
                        isValid: false,
                        error: `Master key "${key}" not found in your tenant's master keys.`,
                    };
                }

                // Validate history field
                if (!fieldName) {
                    return {
                        isValid: false,
                        error:
                            "History format requires a field name. Format: History(field_name)",
                    };
                }
                if (currentFormFields.length > 0) {
                    const fieldNames = currentFormFields.map(
                        (field) => field.name || field.field_name
                    );
                    if (!fieldNames.includes(fieldName)) {
                        return {
                            isValid: false,
                            error: `Field name "${fieldName}" not found in current form fields.`,
                        };
                    }
                }

                return { isValid: true, error: "" };
            }
            return {
                isValid: false,
                error:
                    "Invalid combined format. Use: MasterKey(key_name); History(field_name)",
            };
        }

        // No valid format found
        return {
            isValid: false,
            error:
                "Invalid format. Use: Drop(...), MasterKey(...), History(...), or MasterKey(...); History(...)",
        };
    };

    // Handle content change with validation (but don't save yet)
    const handleContentChange = (value) => {
        // Update local temp content state
        setTempContent(value);
        setDropdownContent(value);

        // Validate custom values if contentType is customValues
        if (contentType === "customValues") {
            const validation = validateCustomValues(value);
            setValidationError(validation.error);
            setIsValid(validation.isValid);
        }
        // Don't call onContentChange here - only update local state
    };

    // Handle tab change
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        // Reset validation when switching tabs
        setValidationError("");
        setIsValid(true);
        // Note: We don't reset the state values (selectedMasterKey, historyValue, dropdownContent)
        // to ensure state is preserved when switching between tabs
    };

    // Handle master key selection
    const handleMasterKeyChange = (selectedOption) => {
        // SearchableSelect passes the selected option as a string
        const key = selectedOption || "";
        setSelectedMasterKey(key);
    };

    // Handle history field change
    const handleHistoryChange = (value) => {
        setHistoryValue(value);
    };

    // Clear master key selection
    const clearMasterKeySelection = () => {
        setSelectedMasterKey("");
    };

    // Clear history selection
    const clearHistorySelection = () => {
        setHistoryValue("");
    };

    // Clear dropdown content
    const clearDropdownContent = () => {
        setDropdownContent("");
        setTempContent("");
    };

    // Check if dropdown format is being used
    const isDropdownFormat =
        dropdownContent && dropdownContent.trim().startsWith("Drop(");

    // Check if master key is selected
    const isMasterKeySelected =
        selectedMasterKey && selectedMasterKey.trim() !== "";

    // Check if history is selected
    const isHistorySelected = historyValue && historyValue.trim() !== "";

    // Determine what content to display
    const displayContent = () => {
        if (
            field === "log_details_table" &&
            !isEditable &&
            content &&
            typeof content === "object"
        ) {
            return renderLogTable(content);
        } else if (contentType === 'metaConfig') {
            return (
                <div className="p-4">
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3">
                            Configuration for field: <span className="text-indigo-600">{fieldName}</span>
                        </h4>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div>
                                    <div className="font-medium text-gray-900 text-sm">Required</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Mark this field as mandatory for data entry
                                    </div>
                                </div>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-5 w-5 text-indigo-600 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        checked={metaConfig.required}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            // Logic: Required implies Visible AND Not Readonly
                                            const newState = {
                                                ...metaConfig,
                                                required: isChecked,
                                                visible: isChecked ? true : metaConfig.visible,
                                                readonly: isChecked ? false : metaConfig.readonly // Uncheck readonly if required is checked
                                            };

                                            const newContent = JSON.stringify(newState);
                                            if (onContentChange) onContentChange(newContent);
                                        }}
                                        disabled={!isEditable}
                                        title={!isEditable ? "You do not have permission to edit this field." : "Mark field as required"}
                                    />
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div>
                                    <div className="font-medium text-gray-900 text-sm">Visible</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Show this field in the user interface
                                    </div>
                                </div>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-5 w-5 text-indigo-600 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        checked={metaConfig.visible}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            const newState = { ...metaConfig, visible: isChecked };

                                            // Logic: If Hidden, it cannot be Required
                                            if (!isChecked) {
                                                newState.required = false;
                                            }

                                            const newContent = JSON.stringify(newState);
                                            if (onContentChange) onContentChange(newContent);
                                        }}
                                        disabled={!isEditable || metaConfig.required || metaConfig.readonly} // Required fields must be visible
                                        title={!isEditable || metaConfig.required || metaConfig.readonly ? "Required fields must be visible." : "Set field visibility"}
                                    />
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div>
                                    <div className="font-medium text-gray-900 text-sm">Readonly</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Prevent modification of this field value
                                    </div>
                                </div>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-5 w-5 text-indigo-600 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        checked={metaConfig.readonly}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;

                                            // Logic: Readonly implies Visible AND Not Required
                                            const newState = {
                                                ...metaConfig,
                                                readonly: isChecked,
                                                visible: isChecked ? true : metaConfig.visible, // Autocheck Visible
                                                required: isChecked ? false : metaConfig.required // Autouncheck Required
                                            };

                                            const newContent = JSON.stringify(newState);
                                            if (onContentChange) onContentChange(newContent);
                                        }}
                                        disabled={!isEditable}
                                        title={!isEditable ? "You do not have permission to edit this field." : "Make field readonly"}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            );
        } else if (isEditable) {
            // Handle custom values for dropdown, radio, checkbox
            if (contentType === "customValues") {
                return (
                    <div className="mt-2">
                        {(isMasterKeySelected || isHistorySelected) && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                                <div className="text-xs font-medium text-blue-800 mb-1">
                                    Current Selections:
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {isMasterKeySelected && (
                                        <div className="flex items-center bg-white px-2 py-1 rounded text-xs text-blue-700 border border-blue-300">
                                            <span>Master Key: {selectedMasterKey}</span>
                                            <button
                                                type="button"
                                                onClick={clearMasterKeySelection}
                                                className="ml-2 text-blue-500 hover:text-blue-700 focus:outline-none"
                                                title="Clear master key selection"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                    {isHistorySelected && (
                                        <div className="flex items-center bg-white px-2 py-1 rounded text-xs text-blue-700 border border-blue-300">
                                            <span>History: {historyValue}</span>
                                            <button
                                                type="button"
                                                onClick={clearHistorySelection}
                                                className="ml-2 text-blue-500 hover:text-blue-700 focus:outline-none"
                                                title="Clear history selection"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tabs for Dropdown, Master Key, and History */}
                        <div className="flex border-b border-gray-200 mb-4">
                            <button
                                type="button"
                                className={`py-2 px-4 text-xs font-medium ${activeTab === "dropdown"
                                    ? "border-b-2 border-indigo-500 text-indigo-600"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                                onClick={() => handleTabChange("dropdown")}
                                disabled={isMasterKeySelected || isHistorySelected}
                            >
                                Dropdown Options
                            </button>
                            <button
                                type="button"
                                className={`py-2 px-4 text-xs font-medium ${activeTab === "masterKey"
                                    ? "border-b-2 border-indigo-500 text-indigo-600"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                                onClick={() => handleTabChange("masterKey")}
                                disabled={isDropdownFormat}
                            >
                                Master Key
                            </button>
                            <button
                                type="button"
                                className={`py-2 px-4 text-xs font-medium ${activeTab === "history"
                                    ? "border-b-2 border-indigo-500 text-indigo-600"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                                onClick={() => handleTabChange("history")}
                                disabled={isDropdownFormat}
                            >
                                History
                            </button>
                        </div>

                        {/* Tab Content */}
                        {activeTab === "dropdown" ? (
                            // Dropdown options content
                            <DropdownOptions
                                tempContent={dropdownContent}
                                handleContentChange={handleContentChange}
                                isError={isError}
                                validationError={validationError}
                            />
                        ) : activeTab === "masterKey" ? (
                            // Master key selection content
                            <MasterKeyOptions
                                masterKeys={masterKeys}
                                selectedMasterKey={selectedMasterKey}
                                handleMasterKeyChange={handleMasterKeyChange}
                                loadingMasterKeys={loadingMasterKeys}
                                validationError={validationError}
                            />
                        ) : (
                            // History selection content
                            <HistoryOptions
                                historyValue={historyValue}
                                onHistoryChange={handleHistoryChange}
                                currentFormFields={currentFormFields}
                                currentFieldName={fieldName}
                            />
                        )}

                        {/* Clear selection button for active tab */}
                        {activeTab === "dropdown" && dropdownContent && (
                            <div className="mt-3 flex justify-end">
                                <button
                                    type="button"
                                    onClick={clearDropdownContent}
                                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    <X size={14} className="mr-1" />
                                    Clear Dropdown Content
                                </button>
                            </div>
                        )}

                        {/* Validation Error */}
                        {validationError && (
                            <div className="flex items-center mt-2 text-red-600 text-sm">
                                <AlertTriangle size={16} className="mr-1" />
                                {validationError}
                            </div>
                        )}
                    </div>
                );
            } else {
                return (
                    <textarea
                        className={classNames(
                            "w-[98%] resize-y min-h-[150px] max-h-[65vh] p-4 m-1 border rounded-xl text-sm text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm mt-2",
                            {
                                "border-red-500 bg-red-50": isError,
                                "border-gray-300": !isError,
                            }
                        )}
                        value={tempContent}
                        onChange={(e) => handleContentChange(e.target.value)}
                        placeholder={`Enter ${title.toLowerCase()}`}
                    />
                );
            }
        } else if (contentType === "metaConfig") {
            // Parse the content (assuming comma-separated string like "Required, Visible")
            const configs = content ? content.split(", ").map((c) => c.trim()) : [];

            const handleToggle = (label) => {
                let newConfigs = [...configs];
                if (newConfigs.includes(label)) {
                    newConfigs = newConfigs.filter((c) => c !== label);
                } else {
                    newConfigs.push(label);
                }
                onContentChange(newConfigs.join(", "));
            };

            return (
                <div className="p-4">
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3">
                            Configuration for field: <span className="text-indigo-600">{fieldName}</span>
                        </h4>

                        <div className="space-y-4">
                            {[
                                { id: "is_required", label: "Required" },
                                { id: "is_visible", label: "Visible" },
                                { id: "is_readonly", label: "Readonly" },
                            ].map((item) => (
                                <label
                                    key={item.id}
                                    className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                        checked={configs.includes(item.label)}
                                        onChange={() => handleToggle(item.label)}
                                    />
                                    <span className="ml-3 text-sm font-medium text-gray-700">
                                        {item.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            );
        } else {
            // Read-only mode
            // Handle custom values display for dropdown, radio, checkbox
            if (contentType === "customValues") {
                const tag = content ? content.trim() : "";

                // If we have content, display it directly without parsing
                if (tag) {
                    return (
                        <div className="flex flex-col gap-2 p-3 border border-gray-200 rounded-xl min-h-[42px] bg-gray-50 mt-2">
                            {/* <div className="text-xs font-medium text-gray-600">Custom Values</div> */}
                            <div className="flex flex-wrap gap-1">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                                    {tag}
                                </span>
                            </div>
                        </div>
                    );
                } else {
                    return (
                        <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl min-h-[42px] bg-gray-50 mt-2">
                            <span className="text-gray-400 text-sm">No values</span>
                        </div>
                    );
                }
            } else {
                return (
                    <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap flex-grow overflow-y-auto pr-1 bg-gray-50 p-4 rounded-xl mt-2">
                        {content || "No content"}
                    </div>
                );
            }
        }
    };

    // Render action buttons
    const renderActionButtons = () => {
        // Show action buttons when editable or when explicitly requested
        if ((!showActionButtons && !isEditable) || !isEditable) return null;

        // Special case: Only show reject button when rejecting line items in approval view
        const isRejectOnly =
            field === "approver_comments" && contentType === "rejectOnly";

        return (
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
                >
                    Cancel
                </button>

                {isRejectOnly && onReject ? (
                    <button
                        type="button"
                        onClick={handleReject}
                        className="inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-red-500 to-red-600 border border-transparent rounded-md shadow-sm hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all"
                    >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                    </button>
                ) : (
                    <>
                        {onReject && field === "approver_comments" && (
                            <button
                                type="button"
                                onClick={handleReject}
                                className="inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-red-500 to-red-600 border border-transparent rounded-md shadow-sm hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all"
                            >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleSave}
                            className={classNames(
                                "inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 border border-transparent rounded-md shadow-sm hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all",
                                {
                                    "opacity-50 cursor-not-allowed":
                                        contentType === "customValues" && !isValid,
                                    "hover:from-blue-600 hover:to-indigo-700": !(
                                        contentType === "customValues" && !isValid
                                    ),
                                }
                            )}
                            disabled={contentType === "customValues" && !isValid}
                        >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                        </button>
                    </>
                )}
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] backdrop-blur-sm"
            data-tour="editor-history-popup"
        >
            <div
                className={`bg-white rounded-xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden ${field === "log_details_table" &&
                    !isEditable &&
                    content &&
                    typeof content === "object"
                    ? "w-full max-w-3xl" // Adjusted width
                    : "w-full max-w-xl" // Adjusted width
                    }`}
                onClick={handleModalClick}
            >
                <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <div className="p-1.5 bg-white rounded-lg shadow-sm">
                            <MessageCircle size={20} className="text-indigo-600" />
                        </div>
                        {title}
                    </h3>
                    <button
                        onClick={handleCancel}
                        className="text-gray-500 hover:text-red-500 transition-colors duration-200 p-1.5 rounded-full hover:bg-white shadow-sm"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5 flex-grow overflow-hidden flex flex-col bg-white">
                    <div className="overflow-y-auto flex-grow mb-5">
                        {displayContent()}
                    </div>
                    {renderActionButtons()}
                </div>
            </div>
        </div>
    );
};

// TagInput component integrated directly
const TagInput = ({ initialValues, onTagsChange, isDisabled, placeholder }) => {
    const [tags, setTags] = useState(initialValues || []);
    const [inputValue, setInputValue] = useState("");

    useEffect(() => {
        setTags(initialValues || []);
    }, [initialValues]);

    const handleAddTag = useCallback(() => {
        if (inputValue.trim() !== "") {
            const newTags = [...tags, inputValue.trim()];
            setTags(newTags);
            setInputValue("");
            onTagsChange(newTags);
        }
    }, [inputValue, tags, onTagsChange]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
            } else if (
                e.key === "Backspace" &&
                inputValue === "" &&
                tags.length > 0
            ) {
                // Remove the last tag when backspace is pressed on empty input
                const newTags = [...tags];
                newTags.pop();
                setTags(newTags);
                onTagsChange(newTags);
            }
        },
        [inputValue, tags, handleAddTag, onTagsChange]
    );

    const handleRemoveTag = useCallback(
        (tagToRemove) => {
            const newTags = tags.filter((tag) => tag !== tagToRemove);
            setTags(newTags);
            onTagsChange(newTags);
        },
        [tags, onTagsChange]
    );

    return (
        <div
            className={classNames(
                "flex flex-wrap items-center gap-1.5 rounded-md p-1.5 shadow-sm min-h-[36px] border border-gray-200",
                {
                    "bg-gray-50": !isDisabled,
                    "bg-gray-100": isDisabled,
                    "focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100":
                        !isDisabled,
                }
            )}
        >
            {tags.map((tag, index) => (
                <div
                    key={index}
                    className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 text-xs font-medium rounded-md border border-blue-200"
                >
                    <span>{tag}</span>
                    {!isDisabled && (
                        <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-blue-600 hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-white"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            ))}
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className={classNames(
                    "flex-1 min-w-[60px] bg-transparent text-xs outline-none border-none p-1",
                    {
                        "cursor-not-allowed": isDisabled,
                    }
                )}
                disabled={isDisabled}
                placeholder={
                    isDisabled ? "" : placeholder || "Add value & Press Enter..."
                }
            />
        </div>
    );
};

export default CardPopup;

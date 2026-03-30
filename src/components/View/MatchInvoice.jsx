import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ViewDocumentModal from '../View/ViewDocumentModal';
import { canUserView, canUserEdit } from '../../permissions'; // Import permission helpers
import {
    FaFileInvoice,
    FaBoxOpen,
    FaCheckCircle,
    FaTimesCircle,
} from 'react-icons/fa';
import { Lock, HelpCircle } from 'lucide-react';
import { encryptId, decryptId } from '../../utils/cryptoUtils'; // Import crypto utils
import { useSelector } from 'react-redux'; // Import useSelector
import axios from '../../utils/authInterceptor';
import { apiBaseUrl } from '../../config/apiConfig';


// Define ActionCell outside the MatchInvoice component and wrap with React.memo
// This component should only re-render if its specific props change.
const ActionCell = React.memo(
    ({
        isMatch,
        currentRejectionComment, // Pass only the relevant comment
        onCommentChange, // Pass a specific handler for this field's comment
        isRejected, // Indicate if this specific field is rejected
        onReject, // Handler for rejecting this field
        onAccept, // Handler for accepting this field
        canEdit, // New prop for edit permission
    }) => {
        const MAX_CHARS = 200; // Define max characters for consistency

        // Calculate current character length
        const charCount = (currentRejectionComment || '').length;

        // Determine if max characters are reached
        const isMaxReached = charCount >= MAX_CHARS;

        if (isMatch) {
            return (
                <span className="inline-flex items-center gap-1 font-medium text-green-600">
                    <FaCheckCircle /> Accepted
                </span>
            );
        }

        if (isRejected) {
            return (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <button 
                            className="px-3 py-1 text-sm font-medium text-white bg-green-500 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={onAccept} 
                            disabled={!canEdit}
                        >
                            Accept
                        </button>
                    </div>
                    <textarea
                        className="w-full p-2 text-sm border border-gray-300 rounded resize-y disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Reason for rejection..."
                        value={currentRejectionComment || ''}
                        onChange={(e) => onCommentChange(e.target.value)}
                        maxLength={MAX_CHARS} // Use the constant here
                        disabled={!canEdit}
                    />
                    <div
                        className={`text-xs ${isMaxReached ? 'text-red-500' : 'text-gray-500'}`}
                    >
                        {isMaxReached
                            ? `Max characters entered (${charCount}/${MAX_CHARS})`
                            : `${charCount}/${MAX_CHARS} characters`}
                    </div>
                </div>
            );
        }

        return (
            <div className="flex gap-2">
                <button 
                    className="px-3 py-1 text-sm font-medium text-white bg-green-500 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onAccept} 
                    disabled={!canEdit}
                >
                    Accept
                </button>
                <button 
                    className="px-3 py-1 text-sm font-medium text-white bg-red-500 rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onReject} 
                    disabled={!canEdit}
                >
                    Reject
                </button>
            </div>
        );
    }
);

const MatchInvoice = () => {
    const { invoiceId: encryptedInvoiceId } = useParams();
    const invoiceId = useMemo(() => decryptId(encryptedInvoiceId), [encryptedInvoiceId]);
    const navigate = useNavigate();
    const [isModalOpen, setModalOpen] = useState(false);
    const [docUrl, setDocUrl] = useState('');
    const [docMimeType, setDocMimeType] = useState(''); // State to store mime type
    const [matchData, setMatchData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editedInvoice, setEditedInvoice] = useState({});
    const [editedPO, setEditedPO] = useState({});
    const [editedGRN, setEditedGRN] = useState({});

    // Get user and token from Redux store
    const user = useSelector(state => state.auth.user);
    const token = user?.token;

    const [openSections, setOpenSections] = useState({});
    const [rejections, setRejections] = useState({});
    const [rejectionComments, setRejectionComments] = useState({});

    // Permissions derived from Redux user state
    const hasViewPermission = user ? canUserView(user.role, '/reconcile_queue/:invoiceId') : false;
    const hasEditPermission = user ? canUserEdit(user.role, 'recon_approve_reject') : false;

    const toggleSection = (sectionName) => {
        setOpenSections((prev) => ({
            ...prev,
            [sectionName]: !prev[sectionName],
        }));
    };

    useEffect(() => {
        const fetchReconciliationData = async () => {
            if (!user || !hasViewPermission || !invoiceId || !token) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const config = {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                };

                const reconcileResponse = await axios.get(
                    `/api/v1/tables/ap_reconcile?invoice_id=${invoiceId}`, config
                );
                const apiResponse = reconcileResponse.data;

                if (
                    apiResponse &&
                    apiResponse.length > 0 &&
                    apiResponse[0].reconciled_data
                ) {
                    const data = apiResponse[0].reconciled_data.value;
                    const matchResult =
                        typeof data === 'string' ? JSON.parse(data) : data;
                    setMatchData(matchResult);

                    const actualSections = Object.keys(matchResult).filter(
                        (key) => key !== 'invoiceId'
                    );
                    if (actualSections.length > 0) {
                        const initialOpenSections = {
                            [actualSections[0]]: true,
                        };
                        if (actualSections.includes('Line Items')) {
                            initialOpenSections['Line Items'] = true;
                        }
                        setOpenSections(initialOpenSections);
                    }
                } else {
                    setMatchData(null);
                }

                const docPromises = [];
                const poId = apiResponse[0]?.po_id;
                const grnId = apiResponse[0]?.grn_id;
                const docIds = {
                    invoice: invoiceId,
                    po: poId,
                    grn: grnId,
                };

                for (const [docType, id] of Object.entries(docIds)) {
                    if (id) {
                        docPromises.push(
                            axios.get(`/api/v1/tables/ap_documents?doc_id=${id}`, config)
                                .then((res) => {
                                    if (res.status !== 200) {
                                        return null;
                                    }
                                    return res.data;
                                })
                                .then((docData) => {
                                    if (docData && docData.length > 0) {
                                        return { type: docType, data: docData[0] };
                                    }
                                    return null;
                                })
                                .catch((err) => {
                                    return null;
                                })
                        );
                    }
                }

                const fetchedDocs = await Promise.all(docPromises);
                fetchedDocs.forEach((doc) => {
                    if (doc) {
                        if (doc.type === 'invoice') setEditedInvoice(doc.data);
                        if (doc.type === 'po') setEditedPO(doc.data);
                        if (doc.type === 'grn') setEditedGRN(doc.data);
                    }
                });
            } catch (err) {
                setMatchData(null);
            } finally {
                setLoading(false);
            }
        };

        if (user && hasViewPermission) {
            fetchReconciliationData();
        }
    }, [invoiceId, user, hasViewPermission, token]);

    const handleRejectionComment = useCallback((fieldKey, value) => {
        setRejectionComments((prev) => ({
            ...prev,
            [fieldKey]: value,
        }));
    }, []);

    const handleRejectField = useCallback((fieldKey) => {
        setRejections((prev) => ({ ...prev, [fieldKey]: true }));
        setRejectionComments((prev) => ({ ...prev, [fieldKey]: '' }));
    }, []);

    const handleAcceptField = useCallback((fieldKey) => {
        setRejections((prev) => {
            const newState = { ...prev };
            delete newState[fieldKey];
            return newState;
        });
        setRejectionComments((prev) => {
            const newState = { ...prev };
            delete newState[fieldKey];
            return newState;
        });
    }, []);

    const openViewer = useCallback(async (relativePath, mimeType) => {
        if (!relativePath || !token) {
            setDocUrl('not-found');
            setDocMimeType('');
            setModalOpen(true);
            return;
        }

        try {
            const fullUrl = `/api/${relativePath.replace(/^\/+/g, '')}`;

            const response = await axios.get(fullUrl, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                responseType: 'blob'
            });

            if (response.status !== 200) {
                throw new Error(`Failed to fetch file: ${response.statusText}`);
            }
            const blob = response.data;
            const url = URL.createObjectURL(blob);

            setDocUrl(url);
            setDocMimeType(mimeType);
            setModalOpen(true);
        } catch (error) {
            setDocUrl('not-found'); // Indicate failure
            setDocMimeType('');
            setModalOpen(true);
        }
    }, [token]);

    useEffect(() => {
        return () => {
            if (docUrl && docUrl.startsWith('blob:')) {
                URL.revokeObjectURL(docUrl);
            }
        };
    }, [docUrl]);

    const renderSection = (title, data, type) => {
        const filePath = data?.file_path; // Assuming 'file_path' is the key for the path
        const mimeType = data?.mime_type; // Assuming 'mime_type' is the key for the mime type

        return (
            <div className="flex-1 p-5 bg-white border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
                <div className="flex justify-between items-center">
                    <h4 className="text-lg font-semibold">{title}</h4>
                    <button
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                        onClick={() => openViewer(filePath, mimeType)}
                    >
                        View Document
                    </button>
                </div>
            </div>
        );
    };

    const docs = [
        { title: 'Vendor Invoice', data: editedInvoice, type: 'invoice' },
        { title: 'Purchase Order', data: editedPO, type: 'po' },
        { title: 'Goods Receipt Note', data: editedGRN, type: 'grn' },
    ];

    const handleMatchApprove = async () => {
        try {
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            };
            const response = await axios.post(
                `/api/reconcile/${invoiceId}`,
                {
                    Approved: true,
                    reason: JSON.stringify(rejectionComments),
                    result: matchData,
                },
                config
            );

            const result = response.data;
            if (result.success) {
                navigate('/invoice');
            } else {
                // Handle approval failure
            }
        } catch (error) {
            // Handle approval error
        }
    };

    if (!user || loading || !invoiceId) return <p className="text-center py-8 text-gray-500">Loading match data...</p>;
    if (!hasViewPermission) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <Lock size={48} className="text-gray-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-700 mb-2">Permission Denied</h2>
                <p className="text-gray-500">
                    You do not have access to this page. Please contact your administrator
                    if you believe this is an error.
                </p>
            </div>
        );
    }
    if (!matchData || Object.keys(matchData).length === 0)
        return (
            <p className="text-center py-8 text-gray-500">
                No match data found for invoice ID: {invoiceId}.
            </p>
        );

    const calculateMatchStats = (fields) => {
        let match = 0,
            partialMatch = 0,
            mismatch = 0,
            missing = 0;
        Object.values(fields).forEach((fieldData) => {
            if (
                typeof fieldData === 'object' &&
                fieldData !== null &&
                'Status' in fieldData
            ) {
                switch (fieldData.Status) {
                    case 'Matched':
                        match++;
                        break;
                    case 'PartiallyMatch':
                        partialMatch++;
                        break;
                    case 'NotMatch':
                        mismatch++;
                        break;
                    case 'Missing':
                        missing++;
                        break;
                    default:
                        break;
                }
            } else if (typeof fieldData === 'object' && fieldData !== null) {
                const nestedStats = calculateMatchStats(fieldData);
                match += nestedStats.match;
                partialMatch += nestedStats.partialMatch;
                mismatch += nestedStats.mismatch;
                missing += nestedStats.missing;
            }
        });
        return { match, partialMatch, mismatch, missing };
    };

    const allSectionKeys = Object.keys(matchData).filter(
        (key) => key !== 'invoiceId'
    );

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-center mb-6" data-tour="match-invoice-header">
                3-Way Invoice Match
                {/* 3-Way Invoice Match - Invoice ID: {invoiceId} */}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" data-tour="match-invoice-search">
                {docs.map((doc) => renderSection(doc.title, doc.data, doc.type))}
            </div>

            <div className="bg-white rounded-xl shadow-md p-4 overflow-x-auto" data-tour="match-invoice-results">
                <div className="min-w-full">
                    {allSectionKeys.map((sectionName, sIdx) => {
                        const sectionData = matchData[sectionName];
                        if (!sectionData || Object.keys(sectionData).length === 0)
                            return null;

                        const isOpen = !!openSections[sectionName];

                        if (sectionName === 'Line Items') {
                            let totalMatch = 0,
                                totalMismatch = 0,
                                totalPartial = 0,
                                totalMissing = 0;
                            Object.values(sectionData).forEach((itemGroup) => {
                                const stats = calculateMatchStats(itemGroup);
                                totalMatch += stats.match;
                                totalMismatch += stats.mismatch;
                                totalPartial += stats.partialMatch;
                                totalMissing += stats.missing;
                            });

                            return (
                                <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden" key={`section-itemized`}>
                                    <h3
                                        className="flex justify-between items-center p-4 bg-gray-100 cursor-pointer"
                                        onClick={() => toggleSection(sectionName)}
                                    >
                                        <div className="flex items-center">
                                            <span
                                                className={`mr-2 transform transition-transform ${isOpen ? 'rotate-90' : ''}`}
                                            >
                                                ▶
                                            </span>
                                            {sectionName}
                                        </div>
                                        <span className="flex items-center gap-3 text-sm">
                                            <span className="flex items-center gap-1">
                                                <FaCheckCircle className="text-green-500" />
                                                Match {totalMatch}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <FaTimesCircle className="text-red-500" />
                                                Mismatch {totalMismatch}
                                            </span>
                                            <span className="flex items-center gap-1 text-amber-500">
                                                <FaBoxOpen className="text-amber-500" />
                                                Partial Match {totalPartial}
                                            </span>
                                            <span className="flex items-center gap-1 text-gray-500">
                                                <FaFileInvoice className="text-gray-500" />
                                                Missing {totalMissing}
                                            </span>
                                        </span>
                                    </h3>
                                    <div
                                        className={`overflow-x-auto ${isOpen ? 'block' : 'hidden'}`}
                                    >
                                        <table className="min-w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gray-800 text-white">
                                                    <th className="p-3 text-left">Sr No</th>
                                                    <th className="p-3 text-left">Field</th>
                                                    <th className="p-3 text-left">Invoice</th>
                                                    <th className="p-3 text-left">PO</th>
                                                    <th className="p-3 text-left">GRN</th>
                                                    <th className="p-3 text-left">Match Status</th>
                                                    <th className="p-3 text-left">Comment</th>
                                                    <th className="p-3 text-left">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(sectionData).flatMap(
                                                    ([srNo, fields]) => {
                                                        const fieldEntries = Object.entries(fields);
                                                        return fieldEntries.map(
                                                            ([fieldName, fieldData], index) => {
                                                                const fullFieldKey = `${srNo}-${fieldName}`;
                                                                const isMatched =
                                                                    fieldData.Status === 'Matched';
                                                                let rowClass = '';
                                                                if (fieldName === 'Matched_At_Row')
                                                                    rowClass = 'bg-cyan-100 text-cyan-800 font-bold text-sm text-center';
                                                                else if (isMatched) rowClass = 'bg-green-50';
                                                                else rowClass = 'bg-red-50';

                                                                return (
                                                                    <tr key={fullFieldKey} className={rowClass}>
                                                                        {index === 0 && (
                                                                            <td rowSpan={fieldEntries.length} className="p-3 border">
                                                                                {srNo.replace(/_/g, ' ')}
                                                                            </td>
                                                                        )}
                                                                        <td className="p-3 border">{fieldName.replace(/_/g, ' ')}</td>
                                                                        <td className="p-3 border">{fieldData.Invoice_Value ?? '-'}</td>
                                                                        <td className="p-3 border">{fieldData.PO_Value ?? '-'}</td>
                                                                        <td className="p-3 border">{fieldData.GRN_Value ?? '-'}</td>
                                                                        <td
                                                                            className={`p-3 border ${isMatched ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}`}
                                                                        >
                                                                            {fieldData.Status}
                                                                        </td>
                                                                        <td className="p-3 border">{fieldData.Comment ?? '-'}</td>
                                                                        <td className="p-3 border">
                                                                            <ActionCell
                                                                                fieldKey={fullFieldKey}
                                                                                isMatch={isMatched}
                                                                                isRejected={
                                                                                    rejections[fullFieldKey] !== undefined
                                                                                }
                                                                                currentRejectionComment={
                                                                                    rejectionComments[fullFieldKey]
                                                                                }
                                                                                onCommentChange={(value) =>
                                                                                    handleRejectionComment(
                                                                                        fullFieldKey,
                                                                                        value
                                                                                    )
                                                                                }
                                                                                onReject={() =>
                                                                                    handleRejectField(fullFieldKey)
                                                                                }
                                                                                onAccept={() =>
                                                                                    handleAcceptField(fullFieldKey)
                                                                                }
                                                                                canEdit={hasEditPermission}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            }
                                                        );
                                                    }
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        }

                        const { match, partialMatch, mismatch, missing } =
                            calculateMatchStats(sectionData);
                        return (
                            <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden" key={`section-${sIdx}`}>
                                <h3
                                    className="flex justify-between items-center p-4 bg-gray-100 cursor-pointer"
                                    onClick={() => toggleSection(sectionName)}
                                >
                                    <div className="flex items-center">
                                        <span
                                            className={`mr-2 transform transition-transform ${isOpen ? 'rotate-90' : ''}`}
                                        >
                                            ▶
                                        </span>
                                        {sectionName.replace(/_/g, ' ')}
                                    </div>
                                    <span className="flex items-center gap-3 text-sm">
                                        <span className="flex items-center gap-1">
                                            <FaCheckCircle className="text-green-500" />
                                            Match {match}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <FaTimesCircle className="text-red-500" />
                                            Mismatch {mismatch}
                                        </span>
                                        <span className="flex items-center gap-1 text-amber-500">
                                            <FaBoxOpen className="text-amber-500" />
                                            Partial Match {partialMatch}
                                        </span>
                                        <span className="flex items-center gap-1 text-gray-500">
                                            <FaFileInvoice className="text-gray-500" />
                                            Missing {missing}
                                        </span>
                                    </span>
                                </h3>
                                <div className={`overflow-x-auto ${isOpen ? 'block' : 'hidden'}`}>
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gray-800 text-white">
                                                <th className="p-3 text-left">Field</th>
                                                <th className="p-3 text-left">Invoice</th>
                                                <th className="p-3 text-left">PO</th>
                                                <th className="p-3 text-left">GRN</th>
                                                <th className="p-3 text-left">Status</th>
                                                <th className="p-3 text-left">Comment</th>
                                                <th className="p-3 text-left">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(sectionData).map(
                                                ([fieldName, fieldData]) => {
                                                    const fullFieldKey = `${sectionName}-${fieldName}`;
                                                    const isMatched = fieldData.Status === 'Matched';
                                                    return (
                                                        <tr
                                                            key={fullFieldKey}
                                                            className={
                                                                isMatched ? 'bg-green-50' : 'bg-red-50'
                                                            }
                                                        >
                                                            <td className="p-3 border">
                                                                <div className="font-semibold">
                                                                    {fieldName.replace(/_/g, ' ')}
                                                                </div>
                                                                <div className="text-sm text-gray-500">
                                                                    {fieldData.Description}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 border">{fieldData.Invoice_Value ?? '-'}</td>
                                                            <td className="p-3 border">{fieldData.PO_Value ?? '-'}</td>
                                                            <td className="p-3 border">{fieldData.GRN_Value ?? '-'}</td>
                                                            <td className="p-3 border">{fieldData.Status}</td>
                                                            <td className="p-3 border">{fieldData.Comment ?? '-'}</td>
                                                            <td className="p-3 border">
                                                                <ActionCell
                                                                    fieldKey={fullFieldKey}
                                                                    isMatch={isMatched}
                                                                    isRejected={
                                                                        rejections[fullFieldKey] !== undefined
                                                                    }
                                                                    currentRejectionComment={
                                                                        rejectionComments[fullFieldKey]
                                                                    }
                                                                    onCommentChange={(value) =>
                                                                        handleRejectionComment(fullFieldKey, value)
                                                                    }
                                                                    onReject={() =>
                                                                        handleRejectField(fullFieldKey)
                                                                    }
                                                                    onAccept={() =>
                                                                        handleAcceptField(fullFieldKey)
                                                                    }
                                                                    canEdit={hasEditPermission}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex flex-wrap gap-4 justify-center mt-8">
                <button 
                    className="px-6 py-3 font-semibold text-white bg-gray-500 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!hasEditPermission}
                >
                    Save Draft
                </button>
                <button 
                    className="px-6 py-3 font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleMatchApprove} 
                    disabled={!hasEditPermission}
                >
                    Override & Approve
                </button>
                <button
                    className="px-6 py-3 font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => { /* Creating Payable Invoice */ }}
                    disabled={!hasEditPermission}
                >
                    Create Payable Invoice
                </button>
            </div>
            <ViewDocumentModal
                isOpen={isModalOpen}
                onRequestClose={() => {
                    setModalOpen(false);
                    // Manually revoke the object URL when the modal closes
                    if (docUrl && docUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(docUrl);
                        setDocUrl(''); // Clear the docUrl after revoking
                        // Revoked object URL on modal close
                    }
                }}
                fileUrl={docUrl}
                mimeType={docMimeType} // Pass the mime type here
            />
        </div>
    );
};

export default MatchInvoice;
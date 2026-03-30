import React, { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../../utils/authInterceptor";
import { decryptId } from "../../utils/cryptoUtils";
import { Loader2, ArrowLeft, Check, X } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import 'react-toastify/dist/ReactToastify.css';

const ReconciliationQueue = () => {
  // CRITICAL CHANGE: State for a single record
  const [reconcileRecord, setReconcileRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States for update logic
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  // Get the encrypted ID from the URL parameter
  const { invoiceId } = useParams();
  const navigate = useNavigate();

  // Get user + token from Redux
  const user = useSelector((state) => state.auth.user);
  const token = user?.token;

  // Check if tenant has reconciliation enabled
  const checkReconciliationAccess = useCallback(async () => {
    if (!user || !user.tenantId || !token) return true; // Default to true for super_admin

    try {
      // Fetch the enable_reconciliation parameter for this tenant
      const response = await axios.get(`/api/v1/tables/ap_parameters?tenant_id=eq.${user.tenantId}&unique_key=eq.enable_reconciliation`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data && response.data.length > 0) {
        // Check if the parameter value is 'true'
        const paramValue = response.data[0].req_value;
        return paramValue === 'true' || paramValue === true;
      } else {
        // Parameter not found, check if user is super_admin
        return user.role === 'super_admin';
      }
    } catch (error) {
      // Default to false if there's an error
      return false;
    }
  }, [user, token]);

   useEffect(() => {
    const fetchSingleReconcileData = async () => {
      if (!token) {
        setError("No token available for authentication.");
        setLoading(false);
        return;
      }

      if (!invoiceId) {
        setError("No reconciliation ID provided in the URL.");
        setLoading(false);
        return;
      }

      // Check if tenant has reconciliation enabled
      const hasReconciliationAccess = await checkReconciliationAccess();
      if (!hasReconciliationAccess) {
        setError("Reconciliation is not enabled for your tenant.");
        setLoading(false);
        return;
      }

      // Decrypt the ID from the URL
      let reconcile_id; // This is the invoice_id from the URL
      try {
        reconcile_id = decryptId(invoiceId);
        if (!reconcile_id) throw new Error("Decrypted ID is invalid.");
      } catch (e) {
        setError("Invalid reconciliation ID format.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      let record = null;
      let invoiceNumber = null;

      try {
        // 1. Fetch ap_reconcile record
        // ASSUMPTION: The decrypted ID is the foreign key (invoice_id) in ap_reconcile
        const reconcileResponse = await axios.get(
          `/api/v1/tables/ap_reconcile?reconcile_id=eq.${reconcile_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (reconcileResponse.data && reconcileResponse.data.length > 0) {
          record = reconcileResponse.data[0];

          // 2. Fetch ap_invoices details (Invoice Number)
          try {
            // ASSUMPTION: The same decrypted ID is the primary key (invoice_id) in ap_invoices
            const invoiceResponse = await axios.get(
              `/api/v1/tables/ap_invoices?invoice_id=eq.${reconcile_id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (invoiceResponse.data && invoiceResponse.data.length > 0) {
              invoiceNumber = invoiceResponse.data[0].invoice_no;
            } else {
              // Associated Invoice record not found
            }
          } catch (invoiceError) {
            // Non-critical error, proceed with reconciliation data
          }

          // Set the state, merging the invoice number into the record object for easy display
          setReconcileRecord({ ...record, invoice_number: invoiceNumber });

        } else {
          setError(`Reconciliation record for invoice ID ${reconcile_id} not found.`);
        }

      } catch (error) {
        setError("Failed to fetch reconciliation details from the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchSingleReconcileData();
  }, [token, invoiceId, checkReconciliationAccess]);

  /**
   * COMMENTED OUT: Updates the status and stage for the current record across
   * ap_reconcile, ap_invoices, and ap_documents tables.
   */
  /*
  const updateRecordStatus = async (newStatus, newStage) => {
    if (!reconcileRecord || isUpdating || !token) {
        if(!token) setUpdateError("Authentication token is missing.");
        return;
    }

    setIsUpdating(true);
    setUpdateError(null);

    const { reconcile_id, invoice_id, doc_id } = reconcileRecord;

    // Check if all necessary IDs are present
    if (!reconcile_id || !invoice_id || !doc_id) {
        setUpdateError("Missing necessary IDs (reconcile, invoice, or doc) to perform the update.");
        setIsUpdating(false);
        return;
    }

    try {
      // Create a payload for the updates
      const updatePayload = {
        status: newStatus,
        stage: newStage,
        updated_by: user?.id || null, // Pass user ID if available from redux state
        updated_at: getCurrentTimeISOString(),
      };

      // 1. Update ap_reconcile
      const updateReconcile = axios.patch(
        `/api/v1/tables/ap_reconcile?reconcile_id=eq.${reconcile_id}`,
        updatePayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 2. Update ap_invoices
      const updateInvoice = axios.patch(
        `/api/v1/tables/ap_invoices?invoice_id=eq.${invoice_id}`,
        updatePayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 3. Update ap_documents
      const updateDocument = axios.patch(
        `/api/v1/tables/ap_documents?doc_id=eq.${doc_id}`,
        updatePayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Wait for all updates to complete
      await Promise.all([updateReconcile, updateInvoice, updateDocument]);

      // Success: Navigate back to the queue
      navigate('/reconcile_queue');

    } catch (error) {
      const errorMsg = error.response?.data?.message || "An unexpected error occurred.";
      setUpdateError(`Failed to update status: ${errorMsg}. Please try again.`);
      setIsUpdating(false); // Stop loading state on failure
    }
  };
  */

  // Handle approve action - REPLACED WITH TOAST NOTIFICATION
  const handleApprove = () => {
    // COMMENTED OUT: updateRecordStatus('Approved', 'Review');
    toast.success('Invoice approved successfully!', {
      position: "top-right",
      autoClose: 2000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      onClose: () => navigate('/reconcile_queue') // Navigate to queue after toast closes
    });
  };

  // Handle reject action - REPLACED WITH TOAST NOTIFICATION
  const handleReject = () => {
    // COMMENTED OUT: updateRecordStatus('Rejected', 'Review');
    toast.error('Invoice rejected!', {
      position: "top-right",
      autoClose: 2000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      onClose: () => navigate('/reconcile_queue') // Navigate to queue after toast closes
    });
  };


  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-[500px] p-6 bg-slate-50 rounded-xl">
            <Loader2 size={32} className="animate-spin text-indigo-600 mr-2" />
            <p className="text-gray-700">Loading reconciliation data...</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
            <h3 className="text-lg font-bold mb-2">Error Loading Record</h3>
            <p className="mb-4">{error}</p>
            <button 
                className="flex items-center text-indigo-600 hover:text-indigo-800 font-semibold"
                onClick={() => navigate('/reconcile_queue')}
            >
                <ArrowLeft size={16} className="mr-1" /> Back to Queue
            </button>
        </div>
    );
  }

  // Handle case where record is null after loading (should be covered by error state, but as a fallback)
  if (!reconcileRecord) {
    return (
      <div className="p-6 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg shadow-md">
        <h3 className="text-lg font-bold mb-2">Record Not Found</h3>
        <p className="mb-4">The specified reconciliation record could not be loaded.</p>
        <button 
            className="flex items-center text-indigo-600 hover:text-indigo-800 font-semibold"
            onClick={() => navigate('/reconcile_queue')}
        >
            <ArrowLeft size={16} className="mr-1" /> Back to Queue
        </button>
      </div>
    );
  }


  // Displaying a single record now
  return (
    <div className="min-h-screen font-[Poppins]" data-tour="reconciliation-view-header">
       <div className="flex items-start justify-between border-b border-gray-200 pb-3 mb-2">
        <h2 className="text-lg font-bold text-gray-800 flex-grow">
          Reconciliation ID: {reconcileRecord.reconcile_id || 'N/A'}
          {/* The requested display of the invoice number */}
          {reconcileRecord.invoice_number && (
            <span className="ml-2 font-medium text-base text-gray-600">
              ({reconcileRecord.invoice_number})
            </span>
          )}
        </h2>
        <button
          className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium p-1.5 rounded-md transition duration-200 hover:bg-indigo-50 text-sm"
          onClick={() => navigate('/reconcile_queue')}
          disabled={isUpdating} // Disable back button while updating
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Queue
        </button>
      </div>

      {/* Action buttons container */}
      <div className="flex space-x-3 mb-2 p-2 bg-white rounded-lg shadow-md border border-gray-200">
        <span className="font-medium text-gray-700 self-center mr-2 text-xs">Actions:</span>
        <button
          className="px-3 py-1.5 bg-green-500 text-white font-medium rounded-lg shadow-md hover:bg-green-600 transition duration-150 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-xs"
          onClick={handleApprove}
          disabled={isUpdating}
          data-tour="reconciliation-approve-button"
        >
          {isUpdating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              <Check size={14} className="mr-1" /> Approve
            </>
          )}
        </button>
        <button
          className="px-3 py-1.5 bg-red-500 text-white font-medium rounded-lg shadow-md hover:bg-red-600 transition duration-150 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          onClick={handleReject}
          disabled={isUpdating}
          data-tour="reconciliation-reject-button"
        >
          {isUpdating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              <X size={14} className="mr-1" /> Reject
            </>
          )}
        </button>
      </div>

      {/* Toast Container */}
      <ToastContainer />

      {/* Display update error if any */}
      {updateError && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p>{updateError}</p>
          </div>
      )}

      {/* Reconciliation record content */}
      <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200" data-tour="reconciliation-data-table">
        <div
          className="space-y-4 text-sm text-black"
          dangerouslySetInnerHTML={{ __html: reconcileRecord.recon_data }}
          data-tour="reconciliation-document-view"
        />
      </div>
    </div>
  );
};

export default ReconciliationQueue;
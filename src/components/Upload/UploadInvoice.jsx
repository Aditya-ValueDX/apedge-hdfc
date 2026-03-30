import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/authInterceptor';
import {
    Upload,
    X,
    FileText,
    Image,
    AlertCircle,
    CheckCircle,
    Eye,
    Lock,
    ArrowUp,
    HelpCircle,
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import { useSelector } from 'react-redux';
import { apiBaseUrl } from '../../config/apiConfig';

import { canUserView, canUserEdit } from '../../permissions';


const customStyles = `
/* 0. Poppins Font Import and Definition */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');


/* 1. Global Background/Container Styles (Mimicking original ::before) */
.upload-invoice-container-bg {
    font-family: 'Poppins', sans-serif; /* Set Poppins as the primary font */
    min-height: 80vh;
    position: relative;
}
.upload-invoice-container-bg::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
        radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.1) 0%, transparent 50%);
    pointer-events: none;
    z-index: -1;
}

/* 2. Custom Animations */
@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-15px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes slideInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
@keyframes shimmerProgress {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

/* Apply animations */
.animate-fade-in-down { animation: fadeInDown 0.6s ease-out; }
.animate-fade-in-up { animation: fadeInUp 0.6s ease-out 0.2s both; }
.animate-float { animation: float 3s ease-in-out infinite; }
.animate-spin { animation: spin 1s linear infinite; }

/* 3. Dropzone Hover Effect (Mimicking ::before) */
.dropzone-hover-effect:hover {
    border-color: rgba(59, 130, 246, 0.6);
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%);
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1);
}
.dropzone-drag-over {
    border-color: #3b82f6;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%) !important;
    transform: scale(1.01) !important;
    box-shadow: 0 15px 30px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.3) !important;
}

/* 4. Button Shimmer Effect (Mimicking ::before) */
.btn-shimmer {
    position: relative;
    overflow: hidden;
}
.btn-shimmer::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: left 0.5s ease;
}
.btn-shimmer:hover::before {
    left: 100%;
}
.btn-submit-active::before {
    left: 100%;
}
.btn-submit-active.btn-shimmer:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    transform: translateY(-2px);
    box-shadow: 0 12px 25px rgba(59, 130, 246, 0.4), 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* 5. Progress Bar Shimmer */
.progress-shimmer::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.6),
        transparent
    );
    transform: translateX(-100%);
    animation: shimmerProgress 2s infinite;
}

/* 6. Card Hover/State Effects */
/* Applying list hover effects */
.file-list-item-hover:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(59, 130, 246, 0.1), 0 0 0 1px rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
}
.file-card-uploaded {
    border-color: rgba(34, 197, 94, 0.3) !important;
    background: linear-gradient(135deg, rgba(240, 253, 244, 0.9) 0%, rgba(220, 252, 231, 0.8) 100%) !important;
}
.file-card-error {
    border-color: rgba(239, 68, 68, 0.3) !important;
    background: linear-gradient(135deg, rgba(254, 242, 242, 0.9) 0%, rgba(254, 226, 226, 0.8) 100%) !important;
}
.file-card-error .error-message {
    background: rgba(254, 242, 242, 0.95);
    backdrop-filter: blur(5px);
}
.file-card-uploaded::before, .file-card-error::before {
    opacity: 1 !important;
}
.card-border-top::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
    opacity: 0;
    transition: opacity 0.3s ease;
    /* FIX: Match parent's rounded-xl (0.75rem) to keep the gradient inside the borders */
    border-top-left-radius: 0.75rem;
    border-top-right-radius: 0.75rem;
}
.card-border-top:hover::before {
    opacity: 1;
}
.file-card-uploaded.card-border-top::before {
    background: linear-gradient(90deg, #22c55e, #16a34a, #15803d);
}
.file-card-error.card-border-top::before {
    background: linear-gradient(90deg, #ef4444, #dc2626, #b91c1c);
}

/* 7. Focus States */
.focus-ring:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
}
.scroll-up-btn {
    animation: slideInUp 0.4s ease-out;
    backdrop-filter: blur(10px);
}
`;
// --- End Custom Styles ---


const UploadInvoice = () => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});
    const [showUpArrow, setShowUpArrow] = useState(false);

    // AE_CRED key validation: 'loading' | 'valid' | 'missing' | 'no_protected_config'
    const [aeCredCheck, setAeCredCheck] = useState({ status: 'loading', message: '' });
    const fileInputRef = useRef(null);
    const uploadAreaRef = useRef(null);
    const fileListRef = useRef(null);
    const navigate = useNavigate();

    // Redux hook for user data
    const user = useSelector(state => state.auth.user);
    const token = user?.token;
    
    const MAX_FILE_SIZE_MB = 10;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    
    // Maximum file count limit
    const MAX_FILE_COUNT = 10; 

    // Use the imported permission functions and the 'upload_document' feature key
    const hasViewPermission = user ? canUserView(user.role, '/source') : false;
    const hasUploadPermission = user ? canUserEdit(user.role, 'upload_document') : false;

    // Determine if any files have been selected
    const isFilesPresent = files.length > 0;
    
    // Check if the maximum file limit has been reached
    const isMaxFilesReached = files.length >= MAX_FILE_COUNT;


    // Dynamic classes based on whether files are present
    const dropzoneSizeClasses = isFilesPresent
        ? 'p-3 md:p-4' // Small, compact padding
        : 'p-8 md:p-12 min-h-[180px]'; // Big, ample padding and min-height

    const dropzoneContentClasses = isFilesPresent
        ? 'flex flex-row items-center justify-between space-x-4' // Horizontal layout when small
        : 'flex flex-col items-center justify-center'; // Vertical layout when big (full height of card)

    const dropzoneIconClasses = isFilesPresent
        ? 'w-6 h-6' // Smaller icon for list view
        : 'w-10 h-10';

    const dropzoneTextClasses = isFilesPresent
        ? 'text-sm font-semibold text-gray-700 tracking-tight'
        : 'text-base sm:text-lg font-semibold text-gray-700 mb-1 tracking-tight';

    const dropzoneSubTextClasses = isFilesPresent
        ? 'hidden sm:block text-xs text-gray-500 whitespace-nowrap'
        : 'text-xs text-gray-500 mb-6';

    const dropzoneButtonClasses = isFilesPresent
        ? 'px-4 py-1.5 text-sm'
        : 'px-8 py-2 text-sm';


    useEffect(() => {
        const checkAeCredKey = async () => {
            if (!user || !token || !user.tenantId) {
                setAeCredCheck({ status: 'missing', message: 'Unable to verify upload configuration. Please ensure you are logged in and try again.' });
                return;
            }

            try {
                const res = await axios.get(
                    `/api/v1/tables/ap_parameters?tenant_id=eq.${user.tenantId}&unique_key=eq.AE_CRED`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                const rows = res.data;

                if (!rows || rows.length === 0) {
                    setAeCredCheck({
                        status: 'missing',
                        message: 'Upload configuration is not set for your account. Please contact your administrator to complete the setup before uploading invoices.'
                    });
                    return;
                }

                const param = rows[0];

                if (!param.protected_config || param.protected_config.trim() === '') {
                    setAeCredCheck({
                        status: 'no_protected_config',
                        message: 'Upload configuration is incomplete for your account. Please contact your administrator to complete the setup.'
                    });
                    return;
                }

                setAeCredCheck({ status: 'valid', message: '' });
            } catch (err) {
                setAeCredCheck({
                    status: 'missing',
                    message: 'Unable to verify upload configuration. Please try refreshing the page or contact your administrator.'
                });
            }
        };

        checkAeCredKey();
    }, [user, token]);

    useEffect(() => {
        const handleScroll = () => {
            if (files.length > 0) {
                const scrollPosition = window.pageYOffset;
                const uploadAreaHeight = uploadAreaRef.current?.offsetHeight || 0;
                // Show arrow if scrolled past a small amount of the dropzone height
                setShowUpArrow(scrollPosition > uploadAreaHeight * 0.1);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [files.length]);

    const smoothScrollToBottom = () => {
        // Scroll to the file list when files are added
        if (fileListRef.current) {
            fileListRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    };

    const smoothScrollToTop = () => {
        if (uploadAreaRef.current) {
            uploadAreaRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    };

    const validateFile = (file) => {
        // Check file extension from filename as well as MIME type for better validation
        const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
        const allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
        ];
        
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const errors = [];

        // Check both MIME type and file extension
        const isValidMimeType = allowedMimeTypes.includes(file.type);
        const isValidExtension = allowedExtensions.includes(fileExtension);
        
        if (!isValidMimeType || !isValidExtension) {
            errors.push(
                'Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.'
            );
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            errors.push(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
        }

        return errors;
    };

    const handleFileSelect = (selectedFiles) => {
        if (!hasUploadPermission) {
            // Store error in state instead of toast
            setFiles(prev => [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                name: 'Permission Error',
                errors: ['You do not have permission to upload files.'],
                status: 'error'
            }]);
            return;
        }

        const filesToAdd = Array.from(selectedFiles);
        const availableSlots = MAX_FILE_COUNT - files.length;
        
        // If we've already reached the maximum, don't add any more files
        if (availableSlots <= 0) {
            // Store error in state instead of toast
            setFiles(prev => [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                name: 'File Limit Error',
                errors: [`Maximum of ${MAX_FILE_COUNT} files already selected.`],
                status: 'error'
            }]);
            return;
        }

        // Automatically limit files to available slots
        let filesToProcess = filesToAdd;
        if (filesToAdd.length > availableSlots) {
            filesToProcess = filesToAdd.slice(0, availableSlots);
        }
        
        if (filesToProcess.length === 0) return; // Prevent proceeding if no files are left after slicing

        // Filter out invalid file types and provide feedback
        const validFiles = [];
        const invalidFiles = [];

        filesToProcess.forEach((file) => {
            const errors = validateFile(file);
            if (errors.length === 0) {
                validFiles.push({
                    id: Math.random().toString(36).substr(2, 9),
                    file,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    errors: [],
                    preview: file.type.startsWith('image/')
                        ? URL.createObjectURL(file)
                        : null,
                    status: 'ready',
                });
            } else {
                invalidFiles.push({
                    id: Math.random().toString(36).substr(2, 9),
                    name: file.name,
                    errors: errors,
                    status: 'error'
                });
            }
        });

        setFiles((prev) => {
            const updatedFiles = [...prev, ...validFiles, ...invalidFiles];
            // Scroll to bottom after files are added (if list is present)
            if (!isFilesPresent && (validFiles.length > 0 || invalidFiles.length > 0)) {
                 setTimeout(smoothScrollToBottom, 100);
            }
            return updatedFiles;
        });
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (hasUploadPermission && !isMaxFilesReached) {
            const droppedFiles = e.dataTransfer.files;
            handleFileSelect(droppedFiles);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (hasUploadPermission && !isMaxFilesReached) {
            setDragOver(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOver(false);
    };

    const removeFile = (fileId) => {
        setFiles((prev) => {
            const updatedFiles = prev.filter((f) => f.id !== fileId);
            const fileToRemove = prev.find((f) => f.id === fileId);
            if (fileToRemove?.preview) {
                URL.revokeObjectURL(fileToRemove.preview);
            }
            return updatedFiles;
        });
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (type) => {
        // w-6 h-6 is used for the compact list view when files are present
        const iconClasses = isFilesPresent ? 'w-4 h-4' : 'w-4 h-4'; // Dynamically size icon
        if (type === 'application/pdf')
            return <FileText className={`text-red-500 ${iconClasses}`} />;
        if (type.startsWith('image/')) return <Image className={`text-blue-500 ${iconClasses}`} />;
        return <FileText className={`text-gray-500 ${iconClasses}`} />;
    };

    const handleUpload = async () => {
        // Only process files that have no validation errors and aren't fully done yet.
        // 'workflow_failed' files already have a doc_id in the DB — only the workflow
        // is retried for them; the file upload is skipped.
        const validFiles = files.filter(
            (f) => f.errors.length === 0 && f.status !== 'uploaded'
        );

        if (validFiles.length === 0) {
            toast.warn('Please select at least one valid file.');
            return;
        }

        setLoading(true);
        if (!user || !token) {
            toast.error('User not authenticated. Please log in and try again.');
            setLoading(false);
            return;
        }

        const userId = user.user_id;
        const tenantId = user.tenantId;
        const credKey = 'AE_CRED';

        // Counters — all toasts are deferred until after the loop so only ONE shows
        let uploadFailCount = 0;
        let workflowFailCount = 0;
        let successfulFileCount = 0;

        for (let fileData of validFiles) {
            // Reuse existing doc_id if this file was already saved to the DB
            let docId = fileData.docId ?? null;

            // ── STEP 1: Upload file to DB only if not already uploaded ────────────
            if (!docId) {
                setUploadProgress((prev) => ({ ...prev, [fileData.id]: 0 }));

                const formData = new FormData();
                formData.append('file', fileData.file);
                formData.append('tenant_id', tenantId);
                formData.append('user_id', userId);
                formData.append('doc_type', 'Invoice');
                formData.append('input_source', 'Manual');

                try {
                    const uploadRes = await axios.post(`/api/uploaddoc`, formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            Authorization: `Bearer ${token}`,
                        },
                        onUploadProgress: (e) => {
                            const percent = Math.round((e.loaded * 100) / e.total);
                            setUploadProgress((prev) => ({ ...prev, [fileData.id]: percent }));
                        },
                    });

                    docId = uploadRes.data?.doc_id;
                    if (!docId) throw new Error('No doc_id returned from /uploaddoc');

                    // Persist doc_id so a retry won't re-upload this file
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === fileData.id
                                ? { ...f, docId, status: 'workflow_pending' }
                                : f
                        )
                    );
                    setUploadProgress((prev) => ({ ...prev, [fileData.id]: 100 }));

                } catch (uploadErr) {
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === fileData.id
                                ? { ...f, status: 'error', errors: [...f.errors, 'File upload failed.'] }
                                : f
                        )
                    );
                    setUploadProgress((prev) => ({ ...prev, [fileData.id]: 0 }));
                    uploadFailCount++;
                    continue; // Move to next file
                }
            }

            // ── STEP 2: Trigger workflow using doc_id (new or previously saved) ───
            try {
                const workflowRes = await axios.post(
                    `/api/api/ae/${tenantId}/${credKey}`,
                    {
                        workflowName: 'Manual_apedge',
                        params: [
                            { name: 'TenantID', value: tenantId },
                            { name: 'UserID', value: userId },
                            { name: 'Doc_Id', value: docId }
                        ]
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (workflowRes.data?.success === true && workflowRes.data?.automationRequestId) {
                    // Full success — exclude from future retries
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === fileData.id ? { ...f, status: 'uploaded' } : f
                        )
                    );
                    successfulFileCount++;
                } else {
                    // File is safely in DB; mark for workflow-only retry next time
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === fileData.id ? { ...f, status: 'workflow_failed' } : f
                        )
                    );
                    workflowFailCount++;
                }
            } catch (workflowErr) {
                // File is safely in DB — only workflow failed; preserve docId for retry
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileData.id ? { ...f, status: 'workflow_failed' } : f
                    )
                );
                workflowFailCount++;
            }
        }

        setLoading(false);

        // ── Single summary toast ──────────────────────────────────────────────────
        const totalFailed = uploadFailCount + workflowFailCount;

        if (successfulFileCount > 0 && totalFailed === 0) {
            toast.success(
                `${successfulFileCount} ${successfulFileCount === 1 ? 'file' : 'files'} submitted. Extraction will be ready in ~2 minutes.`
            );
            setTimeout(() => navigate('/documents'), 2000);
        } else if (successfulFileCount > 0 && totalFailed > 0) {
            toast.warn(
                `${successfulFileCount} ${successfulFileCount === 1 ? 'file' : 'files'} submitted; ${totalFailed} failed. Please retry the failed ones.`
            );
        } else if (workflowFailCount > 0 && uploadFailCount === 0) {
            toast.error('Workflow trigger failed. Files are saved — please retry.');
        } else {
            toast.error(`${uploadFailCount} ${uploadFailCount === 1 ? 'file' : 'files'} failed to upload. Please try again.`);
        }
    };

    const openFileInput = () => {
        if (hasUploadPermission && !isMaxFilesReached) { // Check max files
            fileInputRef.current?.click();
        }
    };

    const isUploadDisabled = !hasUploadPermission || aeCredCheck.status !== 'valid';
    const isDropzoneDisabled = isUploadDisabled || isMaxFilesReached; // Combine permission, AE_CRED check and max file check

    if (!user) {
        // Render a message or just null if user data is genuinely missing from Redux
        return (
            <div className="flex justify-center items-center h-screen">
                <p className="text-lg font-medium text-gray-500">Loading user data or user not authenticated...</p>
            </div>
        );
    }

    // Determine common classes
    const cardBaseClasses = 'bg-white/95 backdrop-blur-xl rounded-2xl border border-white/20 p-5 mb-6 md:p-4';
    const blueGradientBtn = 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold transition-all duration-300';
    const disabledBtn = 'bg-gray-300 text-gray-600 cursor-not-allowed transform-none shadow-none';


    return (
        <div className="upload-invoice-container-bg p-px">
            <style>{customStyles}</style> {/* Injecting custom CSS for animations/glassmorphism */}

            {hasViewPermission ? (
                <div className="max-w-4xl mx-auto py-6 px-4 sm:py-4 sm:px-6 relative z-10">
                    <div className="upload-header text-center mb-2 animate-fade-in-down" ref={uploadAreaRef} data-tour="upload-invoice-header">
                        {/* Smaller font, lighter text color */}
                        <h1 className="text-xl sm:text-xl font-bold text-gray-800 mb-1 leading-tight tracking-tight">Upload Invoice</h1>
                        <p className="text-sm text-gray-500 leading-snug font-medium">
                            {`Upload invoice files like PDF, JPG, JPEG, or PNG (Max ${MAX_FILE_COUNT} files, size: ${MAX_FILE_SIZE_MB}MB)`}
                        </p>
                    </div>

                    {/* AE_CRED key validation banner */}
                    {aeCredCheck.status === 'loading' && (
                        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 animate-fade-in-up">
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                            <p className="text-sm text-blue-700 font-medium">Verifying upload configuration...</p>
                        </div>
                    )}
                    {(aeCredCheck.status === 'missing' || aeCredCheck.status === 'no_protected_config') && (
                        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 animate-fade-in-up">
                            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-red-700">Upload Unavailable</p>
                                <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{aeCredCheck.message}</p>
                            </div>
                        </div>
                    )}

                    {/*
                        SINGLE COMBINED CARD: This card now contains both the Dropzone area and the File List (if files are present).
                        The fileListRef is moved here to cover the entire content area for smooth scrolling.
                    */}
                    <div className={`${cardBaseClasses} animate-fade-in-up`} ref={fileListRef}>
                        
                        {/* 1. DROPZONE / UPLOAD MORE AREA (Always present, adapts size) */}
                        <div
                            className={`
                                upload-dropzone dropzone-hover-effect
                                border-2 border-dashed rounded-xl text-center transition-all duration-400 cursor-pointer
                                bg-gradient-to-br from-blue-500/5 to-purple-500/5
                                ${dragOver ? 'dropzone-drag-over' : ''}
                                ${isDropzoneDisabled ? 'cursor-not-allowed opacity-60 bg-gray-100 border-gray-300 transform-none shadow-none' : ''}
                                ${dropzoneSizeClasses}
                                ${isFilesPresent ? 'mb-6' : ''} /* Add bottom margin if followed by file list */
                            `}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={openFileInput}
                            aria-disabled={isDropzoneDisabled}
                            data-tour="upload-area"
                        >
                            <div className={dropzoneContentClasses}>
                                <div className="flex items-center space-x-3 sm:space-x-4 flex-grow justify-center sm:justify-start">
                                    <Upload className={`${dropzoneIconClasses} text-blue-500 animate-float drop-shadow-md flex-shrink-0`} />
                                    
                                    {/* Text Content */}
                                    <div className='flex flex-col items-center sm:items-start'>
                                        <h3 className={dropzoneTextClasses}>
                                            {isMaxFilesReached ? 'File Limit Reached' : isFilesPresent ? 'Upload More Files' : 'Drag & drop files here'}
                                        </h3>
                                        <p className={dropzoneSubTextClasses} data-tour="file-types">
                                            {isMaxFilesReached 
                                                ? `Maximum of ${MAX_FILE_COUNT} files selected` 
                                                : isFilesPresent 
                                                    ? `${files.length} of ${MAX_FILE_COUNT} files selected. Select up to ${MAX_FILE_COUNT - files.length} more.` 
                                                    : 'PDF, JPG, JPEG, or PNG files only (10MB max each)'}
                                        </p>
                                    </div>
                                </div>
                                

                                <button
                                    type="button"
                                    className={`
                                        btn-shimmer focus-ring flex-shrink-0
                                        ${blueGradientBtn}
                                        ${dropzoneButtonClasses} rounded-xl
                                        shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40
                                        ${isDropzoneDisabled ? disabledBtn : ''}
                                    `}
                                    disabled={isDropzoneDisabled}
                                >
                                    {isMaxFilesReached 
                                        ? 'Limit Reached' 
                                        : isFilesPresent 
                                            ? `Add Files (${MAX_FILE_COUNT - files.length} left)` 
                                            : 'Choose Files'}
                                </button>
                            </div>
                        </div>

                        {/* Hidden input field must be inside the single card logic */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileSelect(e.target.files)}
                            className="hidden"
                            disabled={isDropzoneDisabled}
                            title="Select PDF, JPG, JPEG, or PNG files only"
                        />

                        {/* 2. FILE LIST SECTION (Conditionally visible when files are present) */}
                        {isFilesPresent && (
                            <div className='w-full'>
                                {/* Smaller font, lighter text color */}
                                <h3 className="text-base font-bold text-gray-800 mb-4 text-center tracking-tight" data-tour="uploaded-documents">Selected Files ({files.length} of {MAX_FILE_COUNT})</h3>

                                <div 
                                    className="file-list grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                                >
                                    {files.map((fileData) => {
                                        const fileStatusClasses = {
                                            error: 'file-card-error border-red-300',
                                            uploaded: 'file-card-uploaded border-green-300',
                                            ready: 'border-gray-200',
                                            warning: 'file-card-error border-yellow-300'
                                        }[fileData.status] || 'border-gray-200';
                                        
                                        const statusTextClasses = {
                                            error: 'text-red-700 bg-red-100 border-red-200',
                                            uploaded: 'text-green-700 bg-green-100 border-green-200',
                                            ready: 'text-gray-500 bg-gray-100 border-gray-200',
                                            warning: 'text-yellow-700 bg-yellow-100 border-yellow-200'
                                        }[fileData.status] || 'text-gray-500 bg-gray-100 border-gray-200';

                                        const uploadProgressPercent = uploadProgress[fileData.id] || 0;

                                        return (
                                            <div
                                                key={fileData.id}
                                                // List item classes
                                                className={`
                                                    card-border-top file-list-item-hover relative flex items-center justify-between p-1.5 rounded-xl overflow-hidden border bg-white/90 transition-all duration-300 ease-in-out
                                                    ${fileStatusClasses}
                                                    ${loading && fileData.status === 'ready' && uploadProgressPercent > 0 ? 'shadow-lg border-blue-400' : 'shadow-md'}
                                                `}
                                            >
                                                {/* Left side: Icon, Name, Size, Errors */}
                                                <div className="flex items-center space-x-3 flex-grow min-w-0">
                                                    {/* Icon */}
                                                    <div className="flex-shrink-0">
                                                        {getFileIcon(fileData.type || 'application/octet-stream')}
                                                    </div>
                                                    
                                                    {/* Name and Size (Stacked on small screens) */}
                                                    <div className="flex flex-col min-w-0 flex-grow">
                                                        <p className="text-xs font-semibold text-gray-800 truncate" title={fileData.name}>
                                                            {fileData.name}
                                                        </p>
                                                        {fileData.size ? (
                                                            <p className="text-[10px] text-gray-500 font-medium">
                                                                {formatFileSize(fileData.size)}
                                                                {/* Display mobile errors/status inline */}
                                                                <span className={`sm:hidden ml-2 inline-block text-[10px] font-bold py-0.5 px-1 rounded uppercase tracking-wider border ${statusTextClasses}`}>
                                                                    {fileData.status}
                                                                </span>
                                                                {fileData.errors && fileData.errors.length > 0 && (
                                                                    <span className="sm:hidden ml-2 text-red-700 text-[10px] font-bold">({fileData.errors.length} Errors)</span>
                                                                )}
                                                            </p>
                                                        ) : (
                                                            <p className="text-[10px] text-gray-500 font-medium">
                                                                Error
                                                                <span className={`sm:hidden ml-2 inline-block text-[10px] font-bold py-0.5 px-1 rounded uppercase tracking-wider border ${statusTextClasses}`}>
                                                                    {fileData.status}
                                                                </span>
                                                            </p>
                                                        )}
                                                        {/* Display errors below file info for error files */}
                                                        {fileData.errors && fileData.errors.length > 0 && (
                                                            <div className="mt-1 text-red-600 text-[10px] font-medium" title={fileData.errors.join(', ')}>
                                                                {fileData.errors.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right side: Status Badge, Progress, Remove button */}
                                                <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
                                                    {/* Status Badge (Hidden on mobile) */}
                                                    {/* <span className={`hidden sm:inline-block text-[10px] font-semibold py-1 px-3 rounded-full uppercase tracking-wider border ${statusTextClasses}`}>
                                                        {fileData.status}
                                                    </span> */}

                                                    {/* Progress Bar (if loading - Desktop only) */}
                                                    {loading && fileData.status === 'ready' && uploadProgressPercent > 0 && (
                                                        <div className="w-24 hidden md:block">
                                                            <div className="relative bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                                <div 
                                                                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-500"
                                                                    style={{ width: `${uploadProgressPercent}%` }}
                                                                />
                                                                {/* Added progress shimmer */}
                                                                {uploadProgressPercent < 100 && <div className="progress-shimmer absolute inset-0"></div>} 
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-1 text-center">{uploadProgressPercent}%</p>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Error Indicator (If errors exist - Desktop only) */}
                                                    {fileData.errors.length > 0 && (
                                                        <AlertCircle size={20} className="text-red-500 flex-shrink-0 hidden sm:block" title={fileData.errors.join(', ')} />
                                                    )}

                                                    {/* Remove button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent list item click confusion
                                                            removeFile(fileData.id);
                                                        }}
                                                        className={`
                                                            focus-ring bg-white/90 text-gray-400 hover:text-red-500 transition-all duration-300
                                                            w-5 h-5 flex items-center justify-center rounded-full shadow-md hover:scale-110 backdrop-blur-sm
                                                            ${loading || isUploadDisabled ? 'opacity-50 cursor-not-allowed hover:text-gray-400 transform-none' : ''}
                                                        `}
                                                        disabled={loading || isUploadDisabled}
                                                        title="Remove file"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>

                                                {/* Full-width status indicator for list item */}
                                                {(loading && fileData.status === 'ready' && uploadProgressPercent > 0 || fileData.errors.length > 0) && (
                                                    <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-transparent overflow-hidden rounded-b-xl'>
                                                         {fileData.errors.length > 0 ? (
                                                             <div className="h-full bg-red-500/50"></div>
                                                         ) : (
                                                            <div 
                                                                className="bg-blue-500/50 h-full transition-all duration-500"
                                                                style={{ width: `${uploadProgressPercent}%` }}
                                                            />
                                                         )}
                                                    </div>
                                                )}

                                            </div>
                                        );
                                    })}
                                </div>

                            </div>
                        )}

                        {/* Submit button — always visible once files are selected */}
                        {isFilesPresent && (
                            <div className="mt-4 flex justify-center" data-tour="upload-submit-button">
                                {(() => {
                                    const pendingFiles = files.filter((f) => f.errors.length === 0 && f.status !== 'uploaded');
                                    const pendingCount = pendingFiles.length;
                                    const isDisabled = loading || pendingCount === 0 || isUploadDisabled;
                                    const btnLabel = `Submit ${pendingCount} ${pendingCount === 1 ? 'File' : 'Files'}`;
                                    return (
                                        <button
                                            onClick={handleUpload}
                                            disabled={isDisabled}
                                            className={`
                                                btn-shimmer focus-ring
                                                px-6 py-2 rounded-xl font-bold text-sm transition-all duration-300 tracking-tight
                                                ${isDisabled
                                                    ? disabledBtn
                                                    : `btn-submit-active ${blueGradientBtn} shadow-lg shadow-blue-500/40 active:translate-y-px`
                                                }
                                            `}
                                            type="button"
                                        >
                                            {loading
                                                ? (
                                                    <span className="flex items-center gap-2">
                                                        <div className="loading-spinner w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                                                        Submitting...
                                                    </span>
                                                )
                                                : btnLabel
                                            }
                                        </button>
                                    );
                                })()}
                            </div>
                        )}

                    </div> {/* END SINGLE COMBINED CARD */}


                    {/* Hide the button if showUpArrow is true AND max files are reached */}
                    {showUpArrow && !isMaxFilesReached && (
                        <button
                            onClick={smoothScrollToTop}
                            className="scroll-up-btn fixed bottom-6 right-6 z-50 focus-ring
                                bg-gradient-to-r from-blue-500 to-indigo-600 text-white
                                border-none rounded-full py-2 px-4 shadow-xl shadow-blue-500/30
                                transition-all duration-300 flex items-center gap-2 text-sm font-semibold
                                hover:translate-y-[-2px] hover:shadow-2xl hover:shadow-blue-500/40"
                            title="Upload more files"
                        >
                            <ArrowUp size={16} />
                            <span className="hidden sm:inline">Upload more files</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className={`${cardBaseClasses} min-h-[400px] flex flex-col items-center justify-center text-center p-8 m-auto my-12 animate-fade-in-up`}>
                    <Lock size={40} className="text-red-500 mb-4 drop-shadow-md" />
                    <h2 className="text-xl font-semibold text-gray-800 mb-2 tracking-tight">Permission Denied</h2>
                    <p className="text-sm text-gray-500 leading-relaxed max-w-sm">You do not have access to this page. Please contact your administrator if you believe this is an error.</p>
                </div>
            )}
            <ToastContainer position="top-right" autoClose={2000} />
        </div>
    );
};

export default UploadInvoice;
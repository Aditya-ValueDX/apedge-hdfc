import React, { useState, useEffect } from 'react';
import { File, FileText, Eye, X } from 'lucide-react';

const FileCard = ({
    file,
    token,
    openDocumentViewModal,
    onRemove,
    isReadOnly = false,
    showRemoveButton = true,
}) => {
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isImage, setIsImage] = useState(false);

    useEffect(() => {
        let active = true;
        const loadPreview = async () => {
            try {
                let fileToProcess = null;
                let fileType = null;

                if (file?.file) {
                    fileToProcess = file.file;
                    fileType = file.file.type;
                } else if (file instanceof File) {
                    fileToProcess = file;
                    fileType = file.type;
                }

                if (fileToProcess && active) {
                    const url = URL.createObjectURL(fileToProcess);
                    setPreviewUrl(url);
                    setIsImage(fileType?.startsWith('image/'));
                }

            } catch (err) {
                console.error("Preview fetch failed:", err);
                if (active) setPreviewUrl(null);
            }
        };

        if (file) {
            loadPreview();
        }

        return () => {
            active = false;
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [file, token]);

    const hasErrorStatus = file?.status && file.status.toLowerCase() === 'error';
    const isSuccessStatus = !hasErrorStatus && !file?.isPending;
    const fileName = file?.name || (file instanceof File ? file.name : 'Unknown');
    const fileExtension = fileName.split('.').pop()?.toUpperCase() || 'FILE';

    const handleRemove = (e) => {
        e.stopPropagation();
        if (onRemove && file) {
            onRemove(file);
        }
    };

    const handleClick = () => {
        if (openDocumentViewModal && file) {
            openDocumentViewModal(file);
        }
    };

    if (!file) {
        return null;
    }

    return (
        <div
            className={`relative border rounded-md overflow-hidden transition-all duration-300 ease-in-out bg-white cursor-pointer group w-full transform hover:-translate-y-0.5 hover:shadow-md ${hasErrorStatus
                ? 'border-red-200 bg-red-50'
                : isSuccessStatus
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
            onClick={handleClick}
            data-tour="document-view"
        >
            {/* Tooltip overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
                <div className="text-white text-center p-2 min-w-0 w-full">
                    <span className="text-xs font-medium truncate block px-2" title={fileName}>{fileName}</span>
                    <span className="text-[10px] mt-1 flex items-center justify-center">
                        <Eye className="w-3 h-3 mr-1" />
                        Click to preview
                    </span>
                </div>
                {/* Cross icon for removal */}
                {showRemoveButton && !isReadOnly && (
                    <button
                        onClick={handleRemove}
                        className="absolute  right-2 bg-white bg-opacity-20 rounded-full p-1 text-white hover:bg-opacity-30 transition-all duration-200"
                        title="Remove"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>

            <div className="flex items-center p-1.5">
                {/* File Icon Area */}
                <div className="flex-shrink-0 mr-2">
                    {isImage && previewUrl ? (
                        <div className="w-10 h-10 rounded-md overflow-hidden border border-gray-200 shadow-sm">
                            <img
                                src={previewUrl}
                                alt={fileName}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center border border-gray-200 shadow-sm">
                            {(file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) ? (
                                <FileText className="w-4 h-4 text-red-500" />
                            ) : (
                                <File className="w-4 h-4 text-indigo-500" />
                            )}
                            <span className="text-[9px] font-semibold text-gray-500 mt-0.5">{fileExtension}</span>
                        </div>
                    )}
                </div>

                {/* File Info Area */}
                <div className="flex-grow min-w-0">
                    <p className="font-medium text-xs text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap" title={fileName}>
                        {fileName}
                    </p>
                    <p className={`text-[10px] mt-0.5 font-medium ${hasErrorStatus
                        ? 'text-red-600'
                        : isSuccessStatus
                            ? 'text-green-600'
                            : 'text-gray-500'
                        }`}>
                        {hasErrorStatus
                            ? 'Error'
                            : (file.isPending ? 'Processing...' : 'Ready')}
                    </p>
                </div>

                {/* Remove Button */}
                {showRemoveButton && !isReadOnly && (
                    <button
                        onClick={handleRemove}
                        className="flex-shrink-0 ml-1 bg-white text-gray-400 rounded-full w-5 h-5 flex items-center justify-center shadow-sm transition-all duration-200 ease-in-out hover:text-red-500 hover:bg-red-100 hover:shadow-md border border-gray-200"
                        title="Remove"
                    >
                        <X className="w-2.5 h-2.5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default FileCard;
import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Maximize, Minimize, X } from "lucide-react";

// --- CDN Script Injections for Enhanced File Support ---

// 1. XLSX script injection for Excel files (kept from original)
const scriptXlsx = document.createElement('script');
scriptXlsx.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
scriptXlsx.async = false;
document.head.appendChild(scriptXlsx);

// 2. Mammoth.js for DOCX preview
const scriptMammoth = document.createElement('script');
scriptMammoth.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
scriptMammoth.async = false;
document.head.appendChild(scriptMammoth);

// 3. Tailwind Typography plugin for better HTML/Word document styling
const scriptTypography = document.createElement('script');
// We assume a global Tailwind CDN is loaded, and this configures the Typography plugin
scriptTypography.src = "https://cdn.tailwindcss.com?plugins=typography";
scriptTypography.async = false;
document.head.appendChild(scriptTypography);

const ViewDocumentModal = ({
    isOpen,
    onRequestClose,
    fileUrl,
    fileName = 'Document',
}) => {

    const user = useSelector(state => state.auth.user);
    const token = user?.token;

    const [isLoading, setIsLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [textContent, setTextContent] = useState(null); // Used for JSON, TXT, and converted Word HTML
    const [tableData, setTableData] = useState(null);
    const [effectiveFileType, setEffectiveFileType] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);

    const [displayUrl, setDisplayUrl] = useState('');
    const objectUrlRef = useRef(null);

    const isValidFile = fileUrl && fileUrl !== 'not-found' && fileUrl.trim() !== '';

    // Cleanup function for the object URL
    useEffect(() => {
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, []);

    // Main file loading and identification logic
    useEffect(() => {
        if (!isOpen) {
            // Reset state when modal closes
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
            setDisplayUrl('');
            setEffectiveFileType(null);
            setTextContent(null);
            setTableData(null);
            setIsLoading(true);
            setZoomLevel(1);
            return;
        }

        if (!isValidFile) {
            setIsLoading(false);
            setEffectiveFileType('error');
            return;
        }

        // Utility function to wait for a script to load
        const waitForScript = (globalVariable, timeout = 5000) => new Promise((resolve) => {
            if (window[globalVariable]) return resolve(true);
            const start = Date.now();
            const interval = setInterval(() => {
                if (window[globalVariable]) {
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, 100);
        });

        const identifyAndLoadFile = async () => {
            setIsLoading(true);
            setEffectiveFileType(null);
            setTextContent(null);
            setTableData(null);
            setZoomLevel(1); // Reset zoom on new file load

            try {
                // Fetch file with Authorization header if token exists
                const response = await fetch(fileUrl, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });

                if (!response.ok) {
                    setEffectiveFileType('error');
                    setIsLoading(false);
                    return;
                }

                const originalBlob = await response.blob();
                const fileExtension = fileName.split('.').pop().toLowerCase();

                let identifiedType = 'unsupported';

                // Helper for creating Object URL for binary files (PDF/Image)
                const createObjectUrl = (blob, mimeType) => {
                    if (objectUrlRef.current) {
                        URL.revokeObjectURL(objectUrlRef.current);
                    }
                    const newUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
                    objectUrlRef.current = newUrl;
                    setDisplayUrl(newUrl);
                    return newUrl;
                };

                // --- Content Type and Extension-based Identification ---

                if (fileExtension === 'pdf') {
                    identifiedType = 'pdf';
                    createObjectUrl(originalBlob, 'application/pdf');
                } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
                    identifiedType = 'image';
                    createObjectUrl(originalBlob, originalBlob.type || `image/${fileExtension}`);
                } else if (fileExtension === 'json') {
                    identifiedType = 'json';
                    const fileText = await originalBlob.text();
                    // Attempt pretty print
                    try {
                        const jsonData = JSON.parse(fileText);
                        setTextContent(JSON.stringify(jsonData, null, 2));
                    } catch (e) {
                        setTextContent(fileText); // Fallback to raw text if parsing fails
                    }
                } else if (fileExtension === 'txt') {
                    identifiedType = 'text';
                    setTextContent(await originalBlob.text());
                } else if (fileExtension === 'csv') {
                    identifiedType = 'csv';
                    const fileText = await originalBlob.text();

                    // Simple CSV Parser (Handles quoted fields, necessary for robust CSV viewing)
                    const parseCSV = (text) => {
                        const rows = [];
                        let inQuote = false;
                        let currentCell = '';
                        let currentRow = [];

                        for (let i = 0; i < text.length; i++) {
                            const char = text[i];
                            const nextChar = text[i + 1];

                            if (char === '"') {
                                if (inQuote && nextChar === '"') {
                                    currentCell += '"';
                                    i++;
                                } else {
                                    inQuote = !inQuote;
                                }
                            } else if (char === ',' && !inQuote) {
                                currentRow.push(currentCell.trim());
                                currentCell = '';
                            } else if (char === '\n' && !inQuote) {
                                if (text[i - 1] === '\r') { /* Handle CRLF */ }
                                currentRow.push(currentCell.trim());
                                rows.push(currentRow);
                                currentRow = [];
                                currentCell = '';
                            } else if (char === '\r' && !inQuote) {
                            } else {
                                currentCell += char;
                            }
                        }
                        if (currentCell || currentRow.length > 0) {
                            currentRow.push(currentCell.trim());
                            rows.push(currentRow);
                        }
                        return rows.filter(row => row.some(cell => cell.length > 0));
                    };
                    setTableData(parseCSV(fileText));

                } else if (['xls', 'xlsx'].includes(fileExtension)) {
                    identifiedType = 'excel';
                    // Excel requires asynchronous file reading and the XLSX library
                    const isXlsxReady = await waitForScript('XLSX');
                    if (isXlsxReady) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            try {
                                const data = new Uint8Array(e.target.result);
                                const workbook = window.XLSX.read(data, { type: 'array' });
                                const firstSheetName = workbook.SheetNames[0];
                                const worksheet = workbook.Sheets[firstSheetName];
                                const sheetData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                                setTableData(sheetData);
                                setIsLoading(false);
                            } catch (excelError) {
                                console.error('Error parsing Excel file:', excelError);
                                setEffectiveFileType('unsupported');
                                setIsLoading(false);
                            }
                        };
                        reader.onerror = () => {
                            setEffectiveFileType('unsupported');
                            setIsLoading(false);
                        };
                        reader.readAsArrayBuffer(originalBlob);
                    } else {
                        console.error('XLSX library failed to load.');
                        identifiedType = 'unsupported';
                    }

                } else if (['doc', 'docx'].includes(fileExtension)) {
                    identifiedType = 'word';

                    const isMammothReady = await waitForScript('mammoth');

                    if (isMammothReady) {
                        const originalArrayBuffer = await originalBlob.arrayBuffer();
                        try {
                            // Use mammoth.js to convert the ArrayBuffer content to HTML
                            const result = await window.mammoth.convertToHtml({ arrayBuffer: originalArrayBuffer });

                            // result.value contains the generated HTML
                            setTextContent(result.value);
                            identifiedType = 'word-html';

                        } catch (wordError) {
                            console.error('Error converting Word document:', wordError);
                            // Keep it as 'word' to trigger the original "Preview Not Available" message
                        }
                    } else {
                        console.warn('mammoth.js not loaded in time, cannot preview Word document.');
                        // Keep it as 'word'
                    }
                }

                // Fallback and binary header check for un-identified files
                if (identifiedType === 'unsupported' || identifiedType === 'pdf' || identifiedType === 'image') {
                    // Use header sniffing for better PDF/Image detection if file extension was missing or wrong
                    const headerBuffer = await originalBlob.slice(0, 8).arrayBuffer();
                    const headerView = new Uint8Array(headerBuffer);
                    const headerText = new TextDecoder('utf-8').decode(headerBuffer);

                    if (headerText.startsWith('%PDF')) {
                        identifiedType = 'pdf';
                        createObjectUrl(originalBlob, 'application/pdf');
                    } else if (
                        headerView[0] === 0x89 && headerView[1] === 0x50 && headerView[2] === 0x4e && headerView[3] === 0x47 // PNG
                    ) {
                        identifiedType = 'image';
                        createObjectUrl(originalBlob, 'image/png');
                    } else if (headerView[0] === 0xff && headerView[1] === 0xd8) { // JPEG
                        identifiedType = 'image';
                        createObjectUrl(originalBlob, 'image/jpeg');
                    } else if (headerText.startsWith('GIF')) { // GIF
                        identifiedType = 'image';
                        createObjectUrl(originalBlob, 'image/gif');
                    }
                }

                setEffectiveFileType(identifiedType);

                // Ensure loading state is turned off unless Excel parsing is still pending
                if (identifiedType !== 'excel') {
                    setIsLoading(false);
                }

            } catch (error) {
                console.error('Error loading or identifying document:', error);
                setEffectiveFileType('error');
                setIsLoading(false);
            }
        };
        identifyAndLoadFile();
    }, [isOpen, fileUrl, fileName, isValidFile, token]);

    // Zoom handlers for applicable file types
    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 3));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.2));

    // --- Icon and Text Utilities (Improved Icons) ---

    const getFileIcon = (className) => {
        const size = 24;
        // We use currentColor for the SVG fill so it respects the Tailwind text class applied via 'className'

        switch (effectiveFileType) {
            case 'pdf':
            case 'text':
            case 'csv':
                // File with text lines (Lucide 'FileText' style - standard, robust file icon)
                return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>;
            case 'image':
                // Image icon (Mountain)
                return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM5 19l4-4 4 4v-2.25L10 13l2-2 4 4V5H5v14z" /></svg>;
            case 'json':
                // JSON icon (Code Brackets)
                // Reverting to a file-code icon for better visual distinction
                return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 13l-2 2 2 2" /><path d="m14 17 2-2-2-2" /></svg>;
            case 'word':
            case 'word-html': // Use the same icon for Word documents
                // Word icon (File with 'W')
                return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.103 0-2 .897-2 2v16c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2V8l-6-6zM6 4h7.172L18 8.828V20H6V4zm3 13.5v-7h1.5l1.5 4 1.5-4h1.5v7h-1v-5.5l-1.5 4-1.5-4v5.5h-1z" /></svg>;
            case 'excel':
                // Excel icon (File with 'X')
                return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.103 0-2 .897-2 2v16c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2V8l-6-6zM6 4h7.172L18 8.828V20H6V4zm3 13.5l2-3.25L13 17.5h1.5l-2.5-4 2.5-4H13l-2 3.25L9 9.5H7.5l2.5 4-2.5 4H9z" /></svg>;
            case 'error':
                // Error icon (Red X in a circle)
                return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" /></svg>;
            default:
                // Default / Unsupported icon (Generic file)
                return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.103 0-2 .897-2 2v16c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2V8l-6-6zM6 4h7.172L18 8.828V20H6V4z" /></svg>;
        }
    };

    const getFileTypeText = () => {
        switch (effectiveFileType) {
            case 'pdf': return 'PDF Document';
            case 'image': return 'Image File';
            case 'json': return 'JSON Data';
            case 'word': return 'Word Document (No Preview)';
            case 'word-html': return 'Word Document (HTML Preview)';
            case 'excel': return 'Excel Spreadsheet';
            case 'text': return 'Text File';
            case 'csv': return 'CSV Data';
            case 'unsupported': return 'Unsupported File Type';
            case 'error': return 'File Not Found';
            default: return 'Loading...';
        }
    };

    const handleDownload = () => {
        if (isValidFile) {
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center font-sans">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onRequestClose} />

            {/* Modal Container */}
            <div className={`relative bg-gradient-to-b from-white to-gray-50 rounded-2xl shadow-2xl border border-gray-200 transition-all duration-300 ease-in-out w-[95%] md:w-[70%] max-w-5xl h-[95vh] flex flex-col animate-scaleIn overflow-hidden ${isFullscreen ? '!w-full !max-w-full !h-full rounded-none m-0' : 'm-4'}`}>

                {/* Header */}
                <div className="flex justify-between items-center px-4 md:px-6 py-4 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white relative flex-shrink-0">
                    {/* Gradient Bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-sky-500 to-green-500 rounded-t-2xl"></div>

                    <div className="flex items-center gap-3 md:gap-4 flex-grow min-w-0">
                        {/* File Icon: Dynamically set color based on file state */}
                        {getFileIcon(`w-6 h-6 ${effectiveFileType === 'error' ? 'text-red-600' : 'text-indigo-600'}`)}
                        <div className="truncate">
                            <h2 className="text-base font-bold text-gray-900 m-0 truncate">
                                {fileName}
                            </h2>
                            <p className="hidden sm:block text-xs text-gray-500 m-0 uppercase tracking-wider font-medium">
                                {getFileTypeText()}
                            </p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* Zoom Controls */}
                        {effectiveFileType !== 'error' && (effectiveFileType === 'image' || effectiveFileType === 'pdf' || effectiveFileType === 'json' || effectiveFileType === 'text' || effectiveFileType === 'csv' || effectiveFileType === 'excel' || effectiveFileType === 'word-html') && (
                            <>
                                <button
                                    onClick={handleZoomOut}
                                    className="p-2 sm:p-2 bg-gray-100 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-200 transition-all duration-200 shadow-sm disabled:opacity-50"
                                    title="Zoom Out"
                                    disabled={zoomLevel <= 0.2}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zM7 11h10v2H7z" /></svg>
                                </button>
                                <button
                                    onClick={handleZoomIn}
                                    className="p-2 sm:p-2 bg-gray-100 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-200 transition-all duration-200 shadow-sm disabled:opacity-50"
                                    title="Zoom In"
                                    disabled={zoomLevel >= 3}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zM11 7h2v4h4v2h-4v4h-2v-4H7v-2h4z" /></svg>
                                </button>
                            </>
                        )}

                        {/* Fullscreen Button */}
                        {isValidFile && !isLoading && effectiveFileType !== 'error' && (
                            <button
                                onClick={toggleFullscreen}
                                className="p-2 sm:p-2 bg-gray-100 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-200 transition-all duration-200 shadow-sm"
                                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            >
                                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                            </button>
                        )}

                        {/* Close Button */}
                        <button
                            onClick={onRequestClose}
                            className="p-2 sm:p-2 bg-red-500 hover:bg-red-600 border-none rounded-xl text-white transition-colors duration-200 shadow-sm"
                            title="Close"
                        >
                            <X size={16} />
                            {/* <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M14.5 2.5L13.09 1.09L8 6.18L2.91 1.09L1.5 2.5L6.59 7.5L1.5 12.59L2.91 14L8 8.91L13.09 14L14.5 12.59L9.41 7.5L14.5 2.5Z" /></svg> */}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="relative flex-1 overflow-hidden bg-gray-100 p-2 md:p-4">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-gray-300 border-t-4 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-sm text-gray-700 font-semibold">Identifying document...</p>
                            </div>
                        </div>
                    ) : effectiveFileType === 'error' ? (
                        <div className="flex items-center justify-center h-full bg-white rounded-xl shadow-inner">
                            <div className="text-center p-8">
                                <h3 className="text-2xl font-bold text-red-600 mb-3">
                                    File Not Found
                                </h3>
                                <p className="text-gray-600 max-w-sm mx-auto">
                                    The document could not be loaded. Please ensure the URL is valid and you have permissions.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full w-full overflow-auto">
                            <div className="transform-gpu transition-transform duration-200 ease-out flex justify-center items-start min-w-full h-min" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>

                                {effectiveFileType === 'pdf' && (
                                    <iframe
                                        src={displayUrl}
                                        // Full width, use viewport height to scroll, max-h-none allows zoom to push height
                                        className="w-full h-[90vh] min-h-[500px] border border-gray-300 rounded-lg shadow-xl bg-white"
                                        title="PDF Preview"
                                    />
                                )}

                                {effectiveFileType === 'image' && (
                                    <img
                                        src={displayUrl}
                                        alt={fileName}
                                        // The parent div's transform handles zoom, image simply takes the available space
                                        className="max-w-full max-h-full object-contain block mx-auto border border-gray-300 rounded-lg shadow-xl bg-white"
                                    />
                                )}

                                {/* Render Word document as styled HTML */}
                                {effectiveFileType === 'word-html' && textContent && (
                                    <div
                                        className="w-[8.5in] max-w-full min-h-[11in] bg-white p-6 md:p-12 border border-gray-300 rounded-lg shadow-2xl overflow-hidden mb-4"
                                        style={{ minHeight: 'calc(100vh - 150px)' }} // Simulate printable page size
                                    >
                                        {/* ADJUSTMENT: Changed 'prose prose-sm sm:prose-base' to 'prose prose-sm'
                      and added 'text-sm' to reduce the default font size of the mammoth.js HTML output
                      to better reflect the original Word document's size.
                    */}
                                        <div
                                            className="prose prose-sm max-w-none text-gray-800 text-xs"
                                            dangerouslySetInnerHTML={{ __html: textContent }}
                                        />
                                    </div>
                                )}


                                {(effectiveFileType === 'json' || effectiveFileType === 'text') && textContent && (
                                    <pre className="w-full white-space-pre-wrap break-words p-4 bg-gray-900 text-green-300 rounded-lg border border-gray-700 font-mono text-xs overflow-auto shadow-xl">
                                        {textContent}
                                    </pre>
                                )}

                                {(effectiveFileType === 'csv' || effectiveFileType === 'excel') && tableData && tableData.length > 0 ? (
                                    <div className="overflow-x-auto w-full bg-white rounded-lg border border-gray-300 shadow-xl">
                                        <table className="w-full border-collapse text-sm text-left">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-indigo-500 text-white shadow-md">
                                                    {tableData[0].map((header, index) => (
                                                        <th key={index} className="p-3 md:p-4 font-bold whitespace-nowrap border-r border-indigo-400 last:border-r-0">
                                                            {header}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableData.slice(1).map((row, rowIndex) => (
                                                    <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-indigo-100 transition-colors duration-150`}>
                                                        {row.map((cell, cellIndex) => (
                                                            <td key={cellIndex} className="p-3 md:p-4 text-gray-800 border-b border-gray-200 border-r last:border-r-0">
                                                                {cell}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (effectiveFileType === 'word' || effectiveFileType === 'unsupported' || (effectiveFileType === 'excel' && !tableData)) && (
                                    <div className="flex items-center justify-center h-full w-full bg-white rounded-xl shadow-inner">
                                        <div className="text-center p-8">
                                            <h3 className="text-2xl font-bold text-gray-800 mb-2">
                                                Preview Not Available
                                            </h3>
                                            <p className="text-gray-600 max-w-xs mx-auto mb-6">
                                                {effectiveFileType === 'word' ? 'The conversion library could not load or process this Word document.' :
                                                    'This file type cannot be rendered for preview.'}
                                                <br /> Please use the download link to view the file.
                                            </p>
                                            <button
                                                onClick={handleDownload}
                                                className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold py-3 px-6 rounded-xl cursor-pointer inline-flex items-center gap-2 shadow-lg transition-all duration-300 transform hover:scale-[1.02]"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M14 11V14H2V11H0V14C0 14.5523 0.447715 15 1 15H15C15.5523 15 16 14.5523 16 14V11H14ZM13 7H11V2H5V7H3L8 12L13 7Z" /></svg>
                                                <span>Download File</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ViewDocumentModal;

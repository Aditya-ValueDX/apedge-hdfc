import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Download, Maximize, Minimize, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import MessageDisplay from '../common/MessageDisplay';
import axios from '../../utils/authInterceptor'; // Import axios with interceptors


const scriptXlsx = document.createElement('script');
scriptXlsx.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
scriptXlsx.async = false;
document.head.appendChild(scriptXlsx);

const scriptMammoth = document.createElement('script');
scriptMammoth.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
scriptMammoth.async = false;
document.head.appendChild(scriptMammoth);

const scriptTypography = document.createElement('script');
scriptTypography.src = "https://cdn.tailwindcss.com?plugins=typography";
scriptTypography.async = false;
document.head.appendChild(scriptTypography);

const ViewDocumentModal = ({
  isOpen,
  onRequestClose,
  fileUrl,
  fileName = 'Document',
  errorDesc = null, // Add errorDesc prop
}) => {

  const user = useSelector(state => state.auth.user);
  const token = user?.token;

  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textContent, setTextContent] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [effectiveFileType, setEffectiveFileType] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [displayUrl, setDisplayUrl] = useState('');
  const objectUrlRef = useRef(null);
  const imageRef = useRef(null);

  const isValidFile = fileUrl && fileUrl !== 'not-found' && fileUrl.trim() !== '';

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
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
      setZoomLevel(1);

      try {
        // Use axios with interceptors instead of native fetch to handle auth properly
        const response = await axios.get(fileUrl, {
          responseType: 'blob', // Get response as blob
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        if (response.status !== 200) {
          setEffectiveFileType('error');
          setIsLoading(false);
          return;
        }

        const originalBlob = response.data; // Access blob data from response
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        let identifiedType = 'unsupported';

        const createObjectUrl = (blob, mimeType) => {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          const newUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
          objectUrlRef.current = newUrl;
          setDisplayUrl(newUrl);
          return newUrl;
        };

        if (fileExtension === 'pdf') {
          identifiedType = 'pdf';
          createObjectUrl(originalBlob, 'application/pdf');
        } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(fileExtension)) {
          identifiedType = 'image';
          createObjectUrl(originalBlob, originalBlob.type || `image/${fileExtension}`);
        } else if (fileExtension === 'json') {
          identifiedType = 'json';
          const fileText = await originalBlob.text();
          try {
            const jsonData = JSON.parse(fileText);
            setTextContent(JSON.stringify(jsonData, null, 2));
          } catch (e) {
            setTextContent(fileText);
          }
        } else if (fileExtension === 'txt') {
          identifiedType = 'text';
          setTextContent(await originalBlob.text());
        } else if (fileExtension === 'csv') {
          identifiedType = 'csv';
          const fileText = await originalBlob.text();
          
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
                if (text[i - 1] === '\r') { }
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
          const isXlsxReady = await waitForScript('XLSX');
          if (isXlsxReady) {
             const reader = new FileReader();
             reader.onload = (e) => {
               try {
                 const data = new Uint8Array(e.target.result);
                 // Do NOT use cellDates:true — it returns JS Date objects which React cannot render
                 const workbook = window.XLSX.read(data, { type: 'array' });
                 const firstSheetName = workbook.SheetNames[0];
                 const worksheet = workbook.Sheets[firstSheetName];
                 // defval:'' preserves empty/merged cells so data doesn't shift into wrong columns
                 const rawData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: true });
                 const maxCols = rawData.reduce((max, row) => Math.max(max, row.length), 0);
                 const sheetData = rawData.map(row => {
                   const normalized = [...row];
                   while (normalized.length < maxCols) normalized.push('');
                   // Stringify every value — prevents Date/Object from reaching React renderer
                   return normalized.map(cell => {
                     if (cell === null || cell === undefined) return '';
                     if (cell instanceof Date) return cell.toLocaleDateString();
                     if (typeof cell === 'object') return JSON.stringify(cell);
                     return String(cell);
                   });
                 });
                 const filteredData = sheetData.filter(row => row.some(cell => cell !== ''));
                 setTableData(filteredData);
                 setIsLoading(false);
               } catch (excelError) {
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
            identifiedType = 'unsupported';
          }
       
        } else if (['doc', 'docx'].includes(fileExtension)) {
          identifiedType = 'word';
          
          const isMammothReady = await waitForScript('mammoth');

          if (isMammothReady) {
            const originalArrayBuffer = await originalBlob.arrayBuffer();
            try {
              const result = await window.mammoth.convertToHtml({ arrayBuffer: originalArrayBuffer });
              
              setTextContent(result.value); 
              identifiedType = 'word-html';
              
            } catch (wordError) {
              // Error converting Word document
            }
          } else {
            // mammoth.js not loaded in time, cannot preview Word document
          }
        }
        
        if (identifiedType === 'unsupported' || identifiedType === 'pdf' || identifiedType === 'image') {
          const headerBuffer = await originalBlob.slice(0, 8).arrayBuffer();
          const headerView = new Uint8Array(headerBuffer);
          const headerText = new TextDecoder('utf-8').decode(headerBuffer);

          if (headerText.startsWith('%PDF')) {
            identifiedType = 'pdf';
            createObjectUrl(originalBlob, 'application/pdf');
          } else if (
            headerView[0] === 0x89 && headerView[1] === 0x50 && headerView[2] === 0x4e && headerView[3] === 0x47
          ) {
            identifiedType = 'image';
            createObjectUrl(originalBlob, 'image/png');
          } else if (headerView[0] === 0xff && headerView[1] === 0xd8) {
            identifiedType = 'image';
            createObjectUrl(originalBlob, 'image/jpeg');
          } else if (headerText.startsWith('GIF')) {
            identifiedType = 'image';
            createObjectUrl(originalBlob, 'image/gif');
          }
        }
        
        setEffectiveFileType(identifiedType);

        if (identifiedType !== 'excel') {
          setIsLoading(false);
        }

      } catch (error) {
        setEffectiveFileType('error');
        setIsLoading(false);
      }
    };
    identifyAndLoadFile();
  }, [isOpen, fileUrl, fileName, isValidFile, token]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.2));

  // Handle double click to zoom in
  const handleImageDoubleClick = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3)); // Zoom in by 50%
  };

  // Handle mouse down for dragging
  const handleImageMouseDown = (e) => {
    if (zoomLevel > 1) {
      setIsDraggingImage(true);
      setDragStart({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y
      });
      e.preventDefault();
    }
  };

  // Handle mouse move for dragging
  const handleImageMouseMove = useCallback((e) => {
    if (isDraggingImage) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDraggingImage, dragStart]);

  // Handle mouse up for dragging
  const handleImageMouseUp = useCallback(() => {
    setIsDraggingImage(false);
  }, []);

  // Reset image controls
  const handleResetImage = () => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Add event listeners for dragging
  useEffect(() => {
    if (isDraggingImage) {
      window.addEventListener('mousemove', handleImageMouseMove);
      window.addEventListener('mouseup', handleImageMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleImageMouseMove);
      window.removeEventListener('mouseup', handleImageMouseUp);
    };
  }, [isDraggingImage, handleImageMouseMove, handleImageMouseUp]);

  const getFileIcon = (className) => {
    const size = 24;
    
    switch (effectiveFileType) {
      case 'pdf':
      case 'text':
      case 'csv':
        return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>;
      case 'image':
        return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM5 19l4-4 4 4v-2.25L10 13l2-2 4 4V5H5v14z"/></svg>;
      case 'json':
        return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13l-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>;
      case 'word':
      case 'word-html':
        return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.103 0-2 .897-2 2v16c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2V8l-6-6zM6 4h7.172L18 8.828V20H6V4zm3 13.5l2-3.25L13 17.5h1.5l-2.5-4 2.5-4H13l-2 3.25L9 9.5H7.5l2.5 4-2.5 4H9z"/></svg>;
      case 'excel':
        return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.103 0-2 .897-2 2v16c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2V8l-6-6zM6 4h7.172L18 8.828V20H6V4zm3 13.5l2-3.25L13 17.5h1.5l-2.5-4 2.5-4H13l-2 3.25L9 9.5H7.5l2.5 4-2.5 4H9z"/></svg>;
      case 'error':
        return <svg className={className} xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" /></svg>;
      default:
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

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!isValidFile || isDownloading) return;
    setIsDownloading(true);
    try {
      // Fetch via axios so auth headers are included
      const response = await axios.get(fileUrl, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revoke after a short delay so the browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  // Improved zoom controls for better mobile experience
  const renderZoomControls = () => {
    if (effectiveFileType !== 'error' && (effectiveFileType === 'image' || effectiveFileType === 'pdf' || effectiveFileType === 'json' || effectiveFileType === 'text' || effectiveFileType === 'csv' || effectiveFileType === 'excel' || effectiveFileType === 'word-html')) {
      return (
        <>
          <button
            onClick={handleZoomOut}
            className="p-2 sm:p-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 transition-all duration-200 shadow-sm disabled:opacity-50 flex items-center justify-center"
            title="Zoom Out"
            disabled={zoomLevel <= 0.2}
          >
            <ZoomOut size={16} />
          </button>
          <div className="hidden sm:flex items-center bg-white border border-gray-300 rounded-lg  p-2 text-gray-800 text-xs font-semibold min-w-[3rem] justify-center shadow-sm">
            {Math.round(zoomLevel * 100)}%
          </div>
          <button
            onClick={handleZoomIn}
            className="p-2 sm:p-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 transition-all duration-200 shadow-sm disabled:opacity-50 flex items-center justify-center"
            title="Zoom In"
            disabled={zoomLevel >= 3}
          >
            <ZoomIn size={16} />
          </button>
          {effectiveFileType === 'image' && (
            <button
              onClick={handleResetImage}
              className="p-2 sm:p-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 transition-all duration-200 shadow-sm flex items-center justify-center text-xs font-medium"
              title="Reset Image"
            >
              Reset
            </button>
          )}
        </>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center font-sans">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onRequestClose} />
      
      <div className={`relative bg-gradient-to-b from-white to-gray-50 rounded-2xl shadow-2xl border border-gray-200 transition-all duration-300 ease-in-out w-[95%] md:w-[70%] max-w-5xl h-[95vh] flex flex-col animate-scaleIn overflow-hidden ${isFullscreen ? '!w-full !max-w-full !h-full rounded-none m-0' : 'm-4'}`}>
        
        <div className="flex justify-between items-center px-4 md:px-6 py-4 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white relative flex-shrink-0" data-tour="view-document-header">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-sky-500 to-green-500 rounded-t-2xl"></div>
          
          <div className="flex items-center gap-3 md:gap-4 flex-grow min-w-0">
            {getFileIcon(`w-6 h-6 ${effectiveFileType === 'error' ? 'text-red-600' : 'text-indigo-600'}`)}
            <div className="truncate">
              <h2 className="text-sm font-bold text-gray-900 m-0 truncate">
                {fileName}
              </h2>
              <p className="hidden sm:block text-xs text-gray-500 m-0 uppercase tracking-wider font-medium">
                {getFileTypeText()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2" data-tour="view-document-actions">
            {renderZoomControls()}
            
            {isValidFile && !isLoading && effectiveFileType !== 'error' && (
              <button
                onClick={toggleFullscreen}
                className="p-2 sm:p-2 bg-gray-100 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-200 transition-all duration-200 shadow-sm"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            )}

            {isValidFile && !isLoading && effectiveFileType !== 'error' && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="p-2 sm:p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 border-none rounded-xl text-white transition-colors duration-200 shadow-sm flex items-center gap-1"
                title="Download File"
              >
                {isDownloading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Download size={16} />}
                <span className="hidden sm:inline text-xs font-medium">{isDownloading ? 'Downloading...' : 'Download'}</span>
              </button>
            )}
            
            <button
              onClick={onRequestClose}
              className="p-2 sm:p-2 bg-red-500 hover:bg-red-600 border-none rounded-xl text-white transition-colors duration-200 shadow-sm"
              title="Close"
            >
                <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="relative flex-1 overflow-hidden bg-gray-100 p-2 md:p-4">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-gray-300 border-t-4 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-xs text-gray-700 font-semibold">Identifying document...</p>
              </div>
            </div>
          ) : effectiveFileType === 'error' ? (
            <div className="flex items-center justify-center h-full bg-white rounded-xl shadow-inner">
              <div className="text-center p-8">
                <h3 className="text-lg font-bold text-red-600 mb-3">
                  File Not Found or Access Denied
                </h3>
                <p className="text-xs text-gray-600 max-w-sm mx-auto">
                  The document could not be loaded. Please ensure the URL is valid and you have permissions.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full w-full overflow-auto">
              {/* Conditional rendering for error messages based on errorDesc content */}
              {/* Display messages using the reusable MessageDisplay component */}
              <MessageDisplay errorDesc={errorDesc} />
              
              <div className="transform-gpu transition-transform duration-200 ease-out flex justify-center items-start min-w-full h-min" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
                
                {effectiveFileType === 'pdf' && (
                  <iframe
                    src={displayUrl}
                    className="w-full h-[90vh] min-h-[500px] border border-gray-300 rounded-lg shadow-xl bg-white"
                    title="PDF Preview"
                    data-tour="view-document-file"
                  />
                )}
                
                {effectiveFileType === 'image' && (
                  <img
                    ref={imageRef}
                    src={displayUrl}
                    alt={fileName}
                    className="max-w-full max-h-full object-contain block mx-auto border border-gray-300 rounded-lg shadow-xl bg-white cursor-move"
                    style={{
                      transform: `scale(${zoomLevel}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                      transformOrigin: 'center center',
                      transition: isDraggingImage ? 'none' : 'transform 0.2s ease-out',
                      cursor: zoomLevel > 1 ? 'move' : 'default'
                    }}
                    onDoubleClick={handleImageDoubleClick}
                    onMouseDown={handleImageMouseDown}
                    data-tour="view-document-file"
                  />
                )}

                {effectiveFileType === 'word-html' && textContent && (
                  <div 
                    className="w-[8.5in] max-w-full min-h-[11in] bg-white p-6 md:p-12 border border-gray-300 rounded-lg shadow-2xl overflow-hidden mb-4"
                    style={{ minHeight: 'calc(100vh - 150px)' }}
                    data-tour="view-document-file"
                  >
                    <div
                      className="prose prose-xs max-w-none text-gray-800 text-xs" 
                      dangerouslySetInnerHTML={{ __html: textContent }}
                    />
                  </div>
                )}


                {(effectiveFileType === 'json' || effectiveFileType === 'text') && textContent && (
                  <pre className="w-full white-space-pre-wrap break-words p-3 bg-gray-900 text-green-300 rounded-lg border border-gray-700 font-mono text-xs overflow-auto shadow-lg" data-tour="view-document-file">
                    {textContent}
                  </pre>
                )}
                
                {(effectiveFileType === 'csv' || effectiveFileType === 'excel') && tableData && tableData.length > 0 ? (
                  <div className="overflow-x-auto w-full bg-white rounded-lg border border-gray-300 shadow-xl" data-tour="view-document-file">
                    <table className="w-full border-collapse text-xs text-left">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-indigo-500 text-white shadow-md">
                          {tableData[0].map((header, index) => (
                            <th key={index} className="p-2 md:p-3 font-bold whitespace-nowrap border-r border-indigo-400 last:border-r-0">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.slice(1).map((row, rowIndex) => (
                          <tr key={`row-${rowIndex}`} className={`${rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-indigo-100 transition-colors duration-150`}>
                            {row.map((cell, cellIndex) => (
                              <td key={`cell-${rowIndex}-${cellIndex}`} className="p-2 md:p-3 text-gray-800 border-b border-gray-200 border-r last:border-r-0">
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
                      <h3 className="text-lg font-bold text-gray-800 mb-2">
                        Preview Not Available
                      </h3>
                      <p className="text-xs text-gray-600 max-w-xs mx-auto mb-4">
                        {effectiveFileType === 'word' ? 'The conversion library could not load or process this Word document.' :
                          'This file type cannot be rendered for preview.'}
                        <br /> Please use the download link to view the file.
                      </p>
                      <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-60 text-white font-semibold py-2 px-4 rounded-lg cursor-pointer inline-flex items-center gap-2 text-xs shadow-md transition-all duration-200 transform hover:scale-[1.02]"
                        data-tour="view-document-actions"
                      >
                        {isDownloading
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Download size={16} />}
                        <span>{isDownloading ? 'Downloading...' : 'Download File'}</span>
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
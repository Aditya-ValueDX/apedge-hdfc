import React, { useState, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import axios from "../../../utils/authInterceptor";
import {
  FileIcon,
  UploadCloud,
  Eye,
  FileText,
  Image,
  FileSpreadsheet,
  FileCode,
  X,
  Plus,
  FolderOpen,
} from "lucide-react";
import ViewDocumentModal from "../ViewDocumentModal";

// Safe check: is this a native browser File object?
const isNativeFile = (val) => {
  try {
    return (
      val != null &&
      typeof val === "object" &&
      typeof val.name === "string" &&
      typeof val.size === "number" &&
      typeof val.type === "string" &&
      typeof val.arrayBuffer === "function"
    );
  } catch {
    return false;
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getFileExtension = (name = "") => name.split(".").pop().toLowerCase();

const getFileIcon = (name = "") => {
  const ext = getFileExtension(name);
  if (["pdf"].includes(ext)) return { Icon: FileText, color: "text-red-500", bg: "bg-red-50" };
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) return { Icon: Image, color: "text-blue-500", bg: "bg-blue-50" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { Icon: FileSpreadsheet, color: "text-green-500", bg: "bg-green-50" };
  if (["doc", "docx"].includes(ext)) return { Icon: FileCode, color: "text-indigo-500", bg: "bg-indigo-50" };
  return { Icon: FileIcon, color: "text-gray-400", bg: "bg-gray-50" };
};

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const truncateName = (name = "", max = 22) =>
  name.length > max ? `${name.substring(0, max)}…` : name;

// ─── DocCard ──────────────────────────────────────────────────────────────────
const DocCard = ({ file, isPending = false, token, onRemove, onPreview, isReadonly }) => {
  const [hovering, setHovering] = useState(false);
  const [removing, setRemoving] = useState(false);

  const name = file?.name || "Document";
  const size = isNativeFile(file) ? file.size : file?.size;
  const { Icon, color, bg } = getFileIcon(name);

  const handleRemove = async (e) => {
    e.stopPropagation();
    if (isReadonly) return;
    setRemoving(true);
    try {
      if (isPending) {
        onRemove?.(file);
      } else {
        await onRemove?.(file.id, name);
      }
    } finally {
      setRemoving(false);
    }
  };

  const handlePreview = (e) => {
    e.stopPropagation();
    onPreview?.(file, token);
  };

  return (
    <div
      className="relative group bg-white border border-gray-100 rounded-xl p-3.5 flex flex-col gap-2.5 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-100 hover:-translate-y-0.5"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={handlePreview}
    >
      {/* Status pill and Action overlay container */}
      <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1 pl-1 border-l-2 border-gray-100">
        {isPending && (
          <div className="px-1 py-0.5 bg-amber-50 border border-amber-200 rounded-md text-[9px] font-semibold text-amber-600 uppercase tracking-wide">
            Pending
          </div>
        )}
        
        {/* Action overlay - icons only, below status */}
        <div className={`flex gap-1 transition-opacity duration-150`}>
          <button
            onClick={handlePreview}
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
            title="View document"
          >
            <Eye size={12} />
          </button>
          {!isReadonly && !(file.id && !isPending) && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors disabled:opacity-40"
              title="Remove"
            >
              {removing
                ? <div className="w-2.5 h-2.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                : <X size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Icon and text in row layout */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={color} />
        </div>
        
        {/* Name + size */}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-gray-800 leading-tight truncate" title={name}>
            {truncateName(name)}
          </p>
          {size && (
            <p className="text-[10px] text-gray-400 mt-0.5">{formatFileSize(size)}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Dropzone ────────────────────────────────────────────────────────────────
const Dropzone = ({ onDrop, onFileSelect, fileInputRef, isLoading, isReadonly, compact = false }) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e) => { 
    e.preventDefault(); 
    e.stopPropagation();
    setDragOver(true); 
  }, []);
  
  const handleDragLeave = useCallback((e) => { 
    e.preventDefault(); 
    e.stopPropagation();
    setDragOver(false); 
  }, []);
  
  const handleDrop = useCallback((e) => { 
    e.preventDefault(); 
    e.stopPropagation();
    setDragOver(false); 
    if (isReadonly || isLoading) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onDrop?.(files);
    }
  }, [onDrop, isReadonly, isLoading]);

  const handleFileInputChange = useCallback((e) => {
    const files = e.target?.files;
    if (files && files.length > 0) {
      onFileSelect?.(files);
    }
    // Reset input value to allow selecting the same file again
    if (e.target) {
      e.target.value = '';
    }
  }, [onFileSelect]);

  if (compact) {
    return (
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed cursor-pointer transition-all duration-200 text-[11px] font-medium
          ${isReadonly
            ? "border-gray-200 text-gray-300 cursor-not-allowed"
            : dragOver
            ? "border-indigo-400 bg-indigo-50 text-indigo-700"
            : "border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400"
          }`}
      >
        <Plus size={13} />
        {dragOver ? "Drop files" : "Add Files"}
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          disabled={isLoading || isReadonly}
          onChange={handleFileInputChange}
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
        />
      </label>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer
        ${dragOver ? "border-indigo-400 bg-indigo-50/60 scale-[1.01]" : "border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-indigo-50/30"}
        ${isReadonly ? "cursor-not-allowed opacity-50 hover:border-gray-200 hover:bg-gray-50/50" : ""}`}
    >
      <label className={`flex flex-col items-center gap-3 ${isReadonly ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
          ${dragOver ? "bg-indigo-100" : "bg-white shadow-sm border border-gray-100"}`}>
          <UploadCloud size={22} className={dragOver ? "text-indigo-600" : "text-gray-400"} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-gray-700">
            {dragOver ? "Drop files here" : "Drag & drop or click to upload"}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">PDF, JPG, PNG — Max 10MB each</p>
        </div>
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          disabled={isLoading || isReadonly}
          onChange={handleFileInputChange}
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
        />
      </label>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const VendorDocuments = ({
  documents = [],
  manualUploadedFiles = [],
  isReadonly = false,
  canEditInvoice = false,
  isLoading = false,
  fileInputRef,
  handleFileSelect,
  onManualFileSelect,
  onRemoveManualFile,
  onDeleteDocument,
  onOpenPreview,
}) => {
  const user = useSelector((state) => state.auth.user);
  const token = user?.token;

  // Modal state (owned here — matches DocumentsQueue pattern)
  const [modalOpen, setModalOpen] = useState(false);
  const [docUrl, setDocUrl] = useState("");
  const [docFileName, setDocFileName] = useState("Document");

  const hasDocs = documents.length > 0;
  const hasPending = manualUploadedFiles.length > 0;
  const hasAny = hasDocs || hasPending;

  // Open ViewDocumentModal by fetching a blob URL (same as DocumentsQueue.openViewer)
  const openViewer = useCallback(async (file) => {
    // Pending local File object — create an object URL directly
    if (isNativeFile(file)) {
      const blobUrl = URL.createObjectURL(file);
      setDocFileName(file.name);
      setDocUrl(blobUrl);
      setModalOpen(true);
      return;
    }

    // Pending object with a .file property (from manualUploadedFiles)
    if (file?.file != null && isNativeFile(file.file)) {
      const blobUrl = URL.createObjectURL(file.file);
      setDocFileName(file.name || file.file.name);
      setDocUrl(blobUrl);
      setModalOpen(true);
      return;
    }

    // Saved document — fetch from server via authenticated axios (same as DocumentsQueue)
    const filePath = file?.doc_path || file?.file_path || file?.url;
    if (!filePath || !token) {
      onOpenPreview?.(file);  // fall back to parent handler if no path
      return;
    }

    try {
      const normalizedPath = String(filePath).replace(/\\/g, "/").replace(/^[/\\]+/, "");
      const res = await axios.get(`/api/${normalizedPath}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const blobUrl = URL.createObjectURL(res.data);
      setDocFileName(file.name || filePath.split(/[\\/]/).pop());
      setDocUrl(blobUrl);
      setModalOpen(true);
    } catch {
      onOpenPreview?.(file);  // fall back
    }
  }, [token, onOpenPreview]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    if (docUrl?.startsWith("blob:")) URL.revokeObjectURL(docUrl);
    setDocUrl("");
    setDocFileName("Document");
  }, [docUrl]);

  return (
    <div className="p-4 h-full flex flex-col gap-5">

      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <FolderOpen size={14} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-gray-800">Documents</h3>
            <p className="text-[10px] text-gray-400">
              {documents.length + manualUploadedFiles.length} file{(documents.length + manualUploadedFiles.length) !== 1 ? "s" : ""}
              {hasPending ? ` · ${manualUploadedFiles.length} pending` : ""}
            </p>
          </div>
        </div>
        {/* Compact upload button when docs already exist */}
        {!isReadonly && hasAny && (
          <Dropzone
            compact
            onDrop={onManualFileSelect}
            onFileSelect={onManualFileSelect}
            fileInputRef={fileInputRef}
            isLoading={isLoading}
            isReadonly={isReadonly}
          />
        )}
      </div>

      {/* ── Dropzone (full) — shown when no docs yet ───────────────────────── */}
      {!isReadonly && !hasAny && (
        <Dropzone
          onDrop={onManualFileSelect}
          onFileSelect={onManualFileSelect}
          fileInputRef={fileInputRef}
          isLoading={isLoading}
          isReadonly={isReadonly}
        />
      )}

      {/* ── Saved documents ─────────────────────────────────────────────────── */}
      {hasDocs && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5 px-0.5">
            Saved ({documents.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {documents.map((doc, idx) => (
              <DocCard
                key={doc.id || idx}
                file={doc}
                isPending={false}
                token={token}
                onRemove={onDeleteDocument}
                onPreview={openViewer}
                isReadonly={isReadonly}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Pending (new) files ─────────────────────────────────────────────── */}
      {hasPending && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5 px-0.5">
            New — Pending Upload ({manualUploadedFiles.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {manualUploadedFiles.map((file, idx) => (
              <DocCard
                key={idx}
                file={file}
                isPending
                token={token}
                onRemove={onRemoveManualFile}
                onPreview={openViewer}
                isReadonly={isReadonly}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state (readonly, no docs) ───────────────────────────────── */}
      {!hasAny && isReadonly && (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
            <FolderOpen size={24} className="text-gray-300" />
          </div>
          <p className="text-[13px] font-medium text-gray-500">No documents attached</p>
          <p className="text-[11px] text-gray-400 mt-1">Documents will appear here once uploaded.</p>
        </div>
      )}

      {/* ── ViewDocumentModal (same pattern as DocumentsQueue) ─────────────── */}
      <ViewDocumentModal
        isOpen={modalOpen}
        onRequestClose={closeModal}
        fileUrl={docUrl}
        fileName={docFileName}
        errorDesc={null}
      />
    </div>
  );
};

export default VendorDocuments;
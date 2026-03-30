import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ViewDocumentModal from '../common/ViewDocumentModal';
import { X, ArrowLeft, GitCompare } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector } from 'react-redux';
import axios from '../../utils/authInterceptor';
import { parseCustomValues } from '../../utils/customValuesParser';

import VendorFormUI from '../common/formUI/VendorFormUI';
import StatusBadge from '../common/StatusBadge';
import { canUserEdit } from '../../permissions';
import { decryptId } from '../../utils/cryptoUtils';
import { getCurrentTimeISOString } from '../../utils/timezoneUtils';
import useVendorWorkflow from '../../hooks/useVendorWorkflow';
import WorkflowStepper from '../common/Workflowstepper';

// ---------------------------------------------------------------------------
// applyWorkflowStepOverrides
// Applies step-level field overrides from workflowConfig onto fieldConfig.
// ---------------------------------------------------------------------------
const applyWorkflowStepOverrides = (fieldConfigurations, workflowConfig, currentStepId = null) => {
    if (!workflowConfig || !Array.isArray(fieldConfigurations)) return fieldConfigurations;
    const steps = workflowConfig.steps ?? [];
    const step = (currentStepId && steps.find(s => s.stepId === currentStepId)) || steps[0];
    if (!step) return fieldConfigurations;
    const sf = step.fields || {};
    const readonlySet = new Set(sf.readonly || []);
    const hiddenSet = new Set(sf.hidden || []);
    const requiredSet = new Set(sf.required || []);
    return fieldConfigurations.map(field => {
        const overrides = {};
        if (readonlySet.has(field.field_name)) overrides.is_readonly = true;
        if (hiddenSet.has(field.field_name)) overrides.is_visible = false;
        if (field.field_type !== 'button' && requiredSet.has(field.field_name)) overrides.is_required = true;
        return Object.keys(overrides).length ? { ...field, ...overrides } : field;
    });
};

// ---------------------------------------------------------------------------
// getWorkflowActionRequiredFields
// Returns a Set of field names required for a specific actionRef.
// ---------------------------------------------------------------------------
const getWorkflowActionRequiredFields = (workflowConfig, currentStepId, actionRef, fieldConfigurations = []) => {
    if (!workflowConfig || !actionRef) return new Set();
    const steps = workflowConfig.steps || [];
    const step = steps.find(s => s.stepId === currentStepId) || steps[0];
    if (!step) return new Set();
    const tabFieldNames = new Set(fieldConfigurations.filter(f => f.field_type === 'tab').map(f => f.field_name));
    const arrayFieldNames = new Set(fieldConfigurations.filter(f => f.field_type === 'array').map(f => f.field_name));
    const hiddenSet = new Set(step.fields?.hidden || []);
    const readonlySet = new Set(step.fields?.readonly || []);
    const requiredFields = new Set();
    const expandField = (fieldName, visited = new Set()) => {
        if (visited.has(fieldName)) return;
        visited.add(fieldName);
        if (tabFieldNames.has(fieldName)) {
            fieldConfigurations.filter(f => f.parent === fieldName).forEach(c => expandField(c.field_name, visited));
        } else if (arrayFieldNames.has(fieldName)) {
            fieldConfigurations.filter(f => f.parent === fieldName).forEach(c => {
                if (hiddenSet.has(c.field_name) || readonlySet.has(c.field_name)) return;
                requiredFields.add(c.field_name);
            });
            requiredFields.add(fieldName);
        } else {
            if (!hiddenSet.has(fieldName) && !readonlySet.has(fieldName)) requiredFields.add(fieldName);
        }
    };
    (step.transitions || []).forEach(t => {
        if (t.actionRef?.toLowerCase() !== actionRef?.toLowerCase()) return;
        (t.validators || []).forEach(v => {
            const fr = v.fieldrequired;
            if (!fr) return;
            if (Array.isArray(fr)) fr.forEach(f => expandField(f));
            else expandField(fr);
        });
    });
    return requiredFields;
};

// ---------------------------------------------------------------------------
// validateWorkflowNextStep
// ---------------------------------------------------------------------------
const validateWorkflowNextStep = (workflowConfig, currentStepId, actionRef) => {
    if (!workflowConfig || !actionRef || actionRef === 'draft') return { isValid: true };
    const steps = workflowConfig.steps || [];
    if (!steps.length) return { isValid: true };
    const currentStep = steps.find(s => s.stepId === currentStepId) || steps[0];
    if (!currentStep) return { isValid: true };
    const matched = (currentStep.transitions || []).find(t => t.actionRef?.toLowerCase() === actionRef?.toLowerCase());
    if (!matched) return { isValid: true };
    const du = matched.dataUpdates || {};
    const declaredNext = du.next_step || du.NextStep;
    if (!declaredNext) return { isValid: true };
    if (new Set(['step_end_process', 'End', 'end']).has(declaredNext)) return { isValid: true };
    if (!steps.some(s => s.stepId === declaredNext)) {
        return { isValid: false, message: `Workflow config error: next step "${declaredNext}" for "${actionRef}" is not defined. Contact your administrator.` };
    }
    return { isValid: true };
};

// ---------------------------------------------------------------------------
// VendorEditor — ChurnPolicyEditor (named for routing compatibility)
// Stores/reads data directly in churn_policy table columns.
// field_name in ap_vendor_field_config = column name in churn_policy.
// ---------------------------------------------------------------------------
const VendorEditor = () => {
    const { invoiceId: encryptedId } = useParams();
    const location = useLocation();
    const policyId = useMemo(() => encryptedId ? decryptId(encryptedId) : null, [encryptedId]);
    const navigate = useNavigate();

    // Form state
    const [formData, setFormData] = useState(null);
    const [fieldConfig, setFieldConfig] = useState([]);
    const [rawFieldConfig, setRawFieldConfig] = useState([]);
    const [activeTab, setActiveTab] = useState('');
    const [documentActiveTab, setDocumentActiveTab] = useState('document');
    const [isDocTrayCollapsed, setIsDocTrayCollapsed] = useState(true);
    const [lineItemTableHeaders, setLineItemTableHeaders] = useState([]);
    const [lineItemColumnProperties, setLineItemColumnProperties] = useState({});

    // Policy record state
    const [policyPk, setPolicyPk] = useState(null);
    const [policyStatus, setPolicyStatus] = useState('');
    const [policyStage, setPolicyStage] = useState('');

    // Workflow state
    const [instanceId, setInstanceId] = useState(null);
    const [currentWorkflowStepId, setCurrentWorkflowStepId] = useState(null);
    const [isWorkflowCompleted, setIsWorkflowCompleted] = useState(false);
    const [workflowHistory, setWorkflowHistory] = useState([]);

    // Document state
    const [documents, setDocuments] = useState([]);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [manualUploadedFiles, setManualUploadedFiles] = useState([]);
    const fileInputRef = useRef(null);

    // UI state
    const [loading, setLoading] = useState(true);
    const [errors, setErrors] = useState({});
    const [firstInvalidField, setFirstInvalidField] = useState(null);
    const [rejectionComment, setRejectionComment] = useState('');
    const [processing, setProcessing] = useState(false);
    const [processMessage, setProcessMessage] = useState('');
    const [processStatus, setProcessStatus] = useState('');
    const [saveDraftLoading, setSaveDraftLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [selectedPreviewFile, setSelectedPreviewFile] = useState('');
    const [selectedPreviewFileName, setSelectedPreviewFileName] = useState('');

    const changedFieldsRef = useRef({});
    const user = useSelector(state => state.auth.user);
    const token = user?.token;
    const userRole = user?.role;
    const { workflowConfig, loading: workflowLoading } = useVendorWorkflow();

    // ---------------------------------------------------------------------------
    // Completed step statuses for WorkflowStepper
    // ---------------------------------------------------------------------------
    const completedStepStatuses = useMemo(() => {
        if (!workflowConfig || !Array.isArray(workflowConfig.steps)) return {};
        const steps = workflowConfig.steps;
        const activeIndex = currentWorkflowStepId ? steps.findIndex(s => s.stepId === currentWorkflowStepId) : 0;
        const result = {};
        steps.forEach((step, idx) => {
            if (idx >= activeIndex) return;
            const ft = (step.transitions || []).find(t => { const n = t.dataUpdates?.next_step; return n && n !== step.stepId; });
            if (ft?.dataUpdates?.status) result[step.stepId] = ft.dataUpdates.status;
        });
        if (isWorkflowCompleted) {
            steps.forEach(step => {
                if (result[step.stepId]) return;
                const ft = (step.transitions || []).find(t => { const n = t.dataUpdates?.next_step; return n && n !== step.stepId; });
                if (ft?.dataUpdates?.status) result[step.stepId] = ft.dataUpdates.status;
            });
        }
        return result;
    }, [workflowConfig, currentWorkflowStepId, isWorkflowCompleted]);

    // ---------------------------------------------------------------------------
    // Permissions
    // ---------------------------------------------------------------------------
    const workflowEditRoles = workflowConfig?.meta?.permissions?.edit;
    const workflowReadRoles = workflowConfig?.meta?.permissions?.read;
    const isWorkflowConfigReady = !workflowLoading && workflowConfig != null;
    const isWorkflowMissing = !workflowLoading && (!workflowConfig || !workflowConfig.meta || typeof workflowConfig.meta !== 'object' || Array.isArray(workflowConfig.meta));
    const roleHasEditPermission = isWorkflowConfigReady
        ? (Array.isArray(workflowEditRoles) && workflowEditRoles.includes(userRole))
        : (userRole === 'super_admin' || userRole === 'tenant_admin' || canUserEdit(userRole, 'vendor_approve_reject'));
    const roleIsReadOnly = isWorkflowConfigReady ? (!roleHasEditPermission && Array.isArray(workflowReadRoles) && workflowReadRoles.includes(userRole)) : false;
    const isReadonly = roleIsReadOnly || location.state?.readonly === true;
    const canEditInvoice = !isReadonly && roleHasEditPermission;

    // ---------------------------------------------------------------------------
    // Workflow override effect
    // ---------------------------------------------------------------------------
    useEffect(() => {
        if (!rawFieldConfig.length) return;
        setFieldConfig(applyWorkflowStepOverrides(rawFieldConfig, workflowConfig, instanceId ? currentWorkflowStepId : null));
    }, [rawFieldConfig, workflowConfig, currentWorkflowStepId, instanceId]);

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------
    const toTitleCase = useCallback((str) => {
        if (typeof str !== 'string' || !str) return '';
        return str.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()).replace(/_/g, ' ');
    }, []);

    const formatDateValue = useCallback((value) => {
        if (typeof value !== 'string' || !value.trim()) return '';
        let date, ey, em, ed;
        const v = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
            const [y, m, d] = v.split('-').map(Number); ey = y; em = m - 1; ed = d; date = new Date(y, m - 1, d);
        } else if (/^\d{2}-\d{2}-\d{4}$/.test(v)) {
            const [m, d, y] = v.split('-').map(Number); ey = y; em = m - 1; ed = d; date = new Date(y, m - 1, d);
        } else if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(v)) {
            const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            const [d, m, y] = v.split('-'); const mi = months[m.toLowerCase().substring(0, 3)];
            if (mi === undefined) return ''; ey = Number(y); em = mi; ed = Number(d); date = new Date(ey, mi, ed);
        } else if (/^\d{2}-[A-Za-z]+-\d{4}$/.test(v)) {
            const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
            const [d, m, y] = v.split('-'); const mi = months[m.toLowerCase()];
            if (mi === undefined) return ''; ey = Number(y); em = mi; ed = Number(d); date = new Date(ey, mi, ed);
        } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(v)) {
            const [y, m, d] = v.split('/').map(Number); ey = y; em = m - 1; ed = d; date = new Date(y, m - 1, d);
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
            const [m, d, y] = v.split('/').map(Number); ey = y; em = m - 1; ed = d; date = new Date(y, m - 1, d);
        } else {
            date = new Date(v);
            if (isNaN(date.getTime())) return '';
            date.setHours(0, 0, 0, 0);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            if (date > today) return '';
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        if (isNaN(date.getTime()) || date.getFullYear() !== ey || date.getMonth() !== em || date.getDate() !== ed) return '';
        const today = new Date(); today.setHours(0, 0, 0, 0); date.setHours(0, 0, 0, 0);
        if (date > today) return '';
        return `${ey}-${String(em + 1).padStart(2, '0')}-${String(ed).padStart(2, '0')}`;
    }, []);

    const clearRejectionCommentError = useCallback(() => {
        if (errors.rejectionComment) { const e = { ...errors }; delete e.rejectionComment; setErrors(e); }
    }, [errors]);

    // ---------------------------------------------------------------------------
    // mapFieldConfigurations — normalize raw DB rows
    // ---------------------------------------------------------------------------
    const mapFieldConfigurations = (rawList) => rawList.map(field => {
        let meta = {};
        if (field.meta_config && typeof field.meta_config.value === 'string') {
            try { meta = JSON.parse(field.meta_config.value); } catch { /* skip */ }
        }
        const toBool = v => v === true || v === 'true';
        const mapped = {
            field_name: field.field_name || '',
            field_type: field.field_type || 'text',
            is_required: meta.hasOwnProperty('required') ? toBool(meta.required) : (field.is_required || false),
            custom_values: field.custom_values || '',
            display_name: field.display_name || '',
            parent: field.parent || '',
            sequence: field.sequence || 0,
            use_llm: field.use_llm || false,
            is_visible: meta.hasOwnProperty('visible') ? toBool(meta.visible) : (field.hasOwnProperty('is_visible') ? field.is_visible : true),
            is_readonly: meta.hasOwnProperty('readonly') ? toBool(meta.readonly) : false,
        };
        Object.keys(field).forEach(k => { if (!(k in mapped)) mapped[k] = field[k]; });
        return mapped;
    });

    const deduplicateByFieldName = (list) => {
        const sorted = [...list].sort((a, b) => (a.sequence ?? 999999) - (b.sequence ?? 999999));
        const seen = new Set();
        return sorted.filter(f => { if (seen.has(f.field_name)) return false; seen.add(f.field_name); return true; });
    };

    // ---------------------------------------------------------------------------
    // buildEmptyTabRow helper (used in both buildInitialFormData and populateFromColumns)
    // ---------------------------------------------------------------------------
    const buildEmptyTabRow = (parentName, parentGroups, tabChildrenMap) => {
        const row = {};
        (parentGroups[parentName] || []).filter(f => !tabChildrenMap[f.field_name]).forEach(f => { row[f.field_name] = f.field_type === 'array' ? [] : ''; });
        (tabChildrenMap[parentName] || []).forEach(childTab => { row[childTab.field_name] = [buildEmptyTabRow(childTab.field_name, parentGroups, tabChildrenMap)]; });
        return row;
    };

    const buildGroupMaps = (fieldConfigurations) => {
        const parentGroups = {};
        fieldConfigurations.filter(f => f.parent).forEach(f => {
            if (!parentGroups[f.parent]) parentGroups[f.parent] = [];
            parentGroups[f.parent].push(f);
        });
        const tabTypeFieldNames = new Set(
            fieldConfigurations.filter(f => f.field_type === 'tab' || (f.field_type === 'array' && parentGroups[f.field_name])).map(f => f.field_name)
        );
        const tabChildrenMap = {};
        fieldConfigurations.filter(f => (f.field_type === 'tab' || f.field_type === 'array') && f.parent && tabTypeFieldNames.has(f.parent))
            .forEach(c => { if (!tabChildrenMap[c.parent]) tabChildrenMap[c.parent] = []; tabChildrenMap[c.parent].push(c); });
        return { parentGroups, tabTypeFieldNames, tabChildrenMap };
    };

    const buildInitialFormData = (fieldConfigurations) => {
        const { parentGroups, tabTypeFieldNames, tabChildrenMap } = buildGroupMaps(fieldConfigurations);
        const data = {};
        fieldConfigurations.filter(f => !f.parent).forEach(config => {
            if (parentGroups[config.field_name]) return;
            data[config.field_name] = (config.field_type === 'array' || config.field_type === 'tab') ? [] : '';
        });
        Object.keys(parentGroups).forEach(parentName => {
            const pf = fieldConfigurations.find(f => f.field_name === parentName);
            if (pf?.parent && tabTypeFieldNames.has(pf.parent)) return;
            data[parentName] = [buildEmptyTabRow(parentName, parentGroups, tabChildrenMap)];
        });
        return data;
    };

    const populateFromColumns = (dbRow, fieldConfigurations) => {
        const { parentGroups, tabTypeFieldNames, tabChildrenMap } = buildGroupMaps(fieldConfigurations);
        const data = {};
        // Root-level scalar/array fields — read from DB column
        fieldConfigurations.filter(f => !f.parent && f.field_type !== 'tab').forEach(config => {
            const colVal = dbRow[config.field_name];
            if (config.field_type === 'array') {
                if (typeof colVal === 'string' && colVal) {
                    try { data[config.field_name] = JSON.parse(colVal); } catch { data[config.field_name] = []; }
                } else {
                    data[config.field_name] = Array.isArray(colVal) ? colVal : [];
                }
            } else {
                let val = colVal !== null && colVal !== undefined ? colVal : '';
                if (config.field_type === 'date') val = formatDateValue(String(val));
                else if (config.field_type === 'number' && typeof val === 'string') val = val.replace(/,/g, '');
                data[config.field_name] = val;
            }
        });
        // Tab/array parents — read from their named column (stored as JSON string)
        Object.keys(parentGroups).forEach(parentName => {
            const pf = fieldConfigurations.find(f => f.field_name === parentName);
            if (pf?.parent && tabTypeFieldNames.has(pf.parent)) return;
            const colVal = dbRow[parentName];
            if (typeof colVal === 'string' && colVal) {
                try {
                    const parsed = JSON.parse(colVal);
                    data[parentName] = Array.isArray(parsed) ? parsed : [buildEmptyTabRow(parentName, parentGroups, tabChildrenMap)];
                } catch { data[parentName] = [buildEmptyTabRow(parentName, parentGroups, tabChildrenMap)]; }
            } else if (Array.isArray(colVal) && colVal.length > 0) {
                data[parentName] = colVal;
            } else {
                data[parentName] = [buildEmptyTabRow(parentName, parentGroups, tabChildrenMap)];
            }
        });
        return data;
    };

    // ---------------------------------------------------------------------------
    // Document helpers
    // ---------------------------------------------------------------------------
    const loadDocuments = useCallback(async (instId) => {
        if (!user || !token || !instId) return [];
        try {
            const isSuperAdmin = user.role === 'super_admin';
            const tq = isSuperAdmin ? '' : `&tenant_id=eq.${user.tenantId}`;
            const res = await axios.get(`/api/v1/tables/ap_documents?instance_id=eq.${instId}${tq}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.status === 200 && Array.isArray(res.data)) {
                const docs = res.data.map(d => ({ id: d.doc_id, name: d.file_path ? d.file_path.split(/[\\/]/).pop() : 'Document', doc_path: d.file_path, type: 'file', status: d.status || 'uploaded', statusText: d.status || 'Uploaded' }));
                setDocuments(docs);
                return docs;
            }
        } catch { /* non-fatal */ }
        return [];
    }, [user, token]);

    useEffect(() => {
        if (instanceId) loadDocuments(instanceId).then(docs => { if (docs.length > 0) setSelectedDocument(p => p || docs[0]); });
    }, [instanceId]);

    const triggerUpload = useCallback(() => fileInputRef.current?.click(), []);
    const toggleDocTray = useCallback(() => setIsDocTrayCollapsed(p => !p), []);
    const selectDocument = useCallback((docIdOrObj) => {
        if (typeof docIdOrObj === 'object' && docIdOrObj !== null) { setSelectedDocument(docIdOrObj); return; }
        const doc = documents.find(d => d.id === docIdOrObj);
        if (doc) setSelectedDocument(doc);
    }, [documents]);

    const handleDeleteDocument = async (docId, docName) => {
        if (!window.confirm(`Delete ${docName}? This cannot be undone.`)) return;
        try {
            const res = await axios.delete(`/api/v1/tables/ap_documents?doc_id=eq.${docId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.status === 200) {
                setDocuments(prev => { const u = prev.filter(d => d.id !== docId); if (selectedDocument?.id === docId) setSelectedDocument(u[0] || null); return u; });
                toast.success(`${docName} deleted.`);
            }
        } catch (err) { toast.error(`Failed to delete ${docName}: ${err.response?.data?.message || err.message}`); }
    };

    const handleManualFileSelect = useCallback((files) => {
        if (!files?.length) return;
        const valid = Array.from(files).filter(f => {
            const ext = f.name.toLowerCase().split('.').pop();
            if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) { toast.error(`${f.name}: unsupported type.`); return false; }
            if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: exceeds 10MB.`); return false; }
            return true;
        });
        if (valid.length) { setManualUploadedFiles(p => [...p, ...valid]); toast.success(`${valid.length} file(s) added.`); }
    }, []);

    const handleRemoveManualFile = useCallback((file) => setManualUploadedFiles(p => p.filter(f => f !== file)), []);

    const handleOpenPreview = useCallback((file) => {
        if (!file) return;
        let url = '', name = '';
        if (file instanceof File) { url = URL.createObjectURL(file); name = file.name; }
        else if (file.file instanceof File) { url = URL.createObjectURL(file.file); name = file.name || file.file.name; }
        else if (file.doc_path || file.file_path || file.url) { const p = file.doc_path || file.file_path; url = file.url || `/api/${p.replace(/\\/g, '/').replace(/^[/\\]+/, '')}`; name = file.name || p; }
        setSelectedPreviewFile(url); setSelectedPreviewFileName(name); setIsPreviewModalOpen(true);
    }, []);
    const handleClosePreview = useCallback(() => setIsPreviewModalOpen(false), []);

    const handleFileSelect = (selectedFiles) => {
        if (!selectedFiles?.length) return;
        const isSuperAdmin = user.role === 'super_admin' || user.role === 'tenant_admin';
        if (!isSuperAdmin && !canUserEdit(user.role, 'upload_document')) { toast.error('No permission to upload.'); return; }
        const slots = 10 - (pendingFiles?.length || 0);
        const toProcess = Array.from(selectedFiles).slice(0, slots);
        if (selectedFiles.length > slots) toast.warning(`Maximum 10 files. Only ${slots} added.`);
        const valid = toProcess.filter(f => {
            const ext = f.name.toLowerCase().split('.').pop();
            if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) { toast.error(`${f.name}: unsupported type.`); return false; }
            if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: exceeds 10MB.`); return false; }
            return true;
        });
        if (valid.length) { setPendingFiles(p => [...p, ...valid]); toast.info(`${valid.length} file(s) selected. Click Save Draft to upload.`); }
    };

    const uploadAllFiles = async (instId) => {
        const files = [...pendingFiles, ...manualUploadedFiles];
        if (!files.length || !token || !instId) return [];
        const uploaded = [];
        const nowIso = getCurrentTimeISOString();
        for (const file of files) {
            try {
                const fd = new FormData();
                fd.append('file', file); fd.append('tenant_id', user.tenantId);
                fd.append('user_id', user.user_id); fd.append('doc_type', 'Churn Policy'); fd.append('input_source', 'Manual');
                const res = await axios.post('/api/uploaddoc', fd, { headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` } });
                const docId = res.data?.doc_id;
                if (!docId) throw new Error('No doc_id returned');
                await axios.patch(`/api/v1/tables/ap_documents?doc_id=eq.${docId}`, { instance_id: instId, updated_at: nowIso, updated_by: user.user_id }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
                uploaded.push({ id: docId, name: file.name, type: 'file', status: 'uploaded', statusText: 'Uploaded' });
            } catch (err) { toast.error(`Failed to upload ${file.name}: ${err.response?.data?.message || err.message}`); }
        }
        if (uploaded.length) {
            setDocuments(p => { const u = [...p, ...uploaded]; if (!selectedDocument && u.length) setSelectedDocument(u[0]); return u; });
            toast.success(`${uploaded.length} file(s) uploaded.`);
        }
        setPendingFiles([]); setManualUploadedFiles([]);
        return uploaded;
    };

    // ---------------------------------------------------------------------------
    // Main data fetch
    // ---------------------------------------------------------------------------
    useEffect(() => {
        const fetchData = async () => {
            if (!user) { setLoading(false); return; }
            const authHeaders = { Authorization: `Bearer ${token}` };
            const isSuperAdmin = user.role === 'super_admin';
            const tenantQuery = isSuperAdmin ? '' : `&tenant_id=eq.${user.tenantId}`;
            const configQuery = isSuperAdmin && user.tenantId ? `&tenant_id=eq.${user.tenantId}` : tenantQuery;
            if (!isSuperAdmin && !user.tenantId) { toast.error('Missing tenant ID.'); setLoading(false); return; }
            try {
                // Fetch field config
                const configRes = await axios.get(`/api/v1/tables/ap_vendor_field_config?${configQuery}`, { headers: authHeaders });
                if (configRes.status !== 200) throw new Error('Failed to fetch field configurations.');
                const fieldConfigurations = deduplicateByFieldName(mapFieldConfigurations(configRes.data));
                setRawFieldConfig(fieldConfigurations);
                setFieldConfig(fieldConfigurations);

                // Active tab
                const tabFields = fieldConfigurations.filter(f => f.field_type === 'tab').sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999));
                setActiveTab(tabFields.length > 0 ? tabFields[0].field_name : 'general');

                // Line item headers/props
                const liConfigs = fieldConfigurations.filter(f => f.parent).sort((a, b) => (a.sequence ?? 999999) - (b.sequence ?? 999999));
                setLineItemTableHeaders(liConfigs.filter(f => f.is_visible ?? true).map(f => f.field_name));
                const colProps = {};
                liConfigs.forEach(f => { colProps[f.field_name] = { title: f.display_name || f.field_name, type: f.field_type, custom_values: f.custom_values, display_name: f.display_name, is_visible: f.is_visible ?? true }; });
                setLineItemColumnProperties(colProps);

                if (!policyId) {
                    setFormData(buildInitialFormData(fieldConfigurations));
                    setPolicyPk(null); setPolicyStatus('New');
                    setLoading(false); return;
                }

                // Fetch existing churn_policy record
                const policyRes = await axios.get(`/api/v1/tables/churn_policy?churn_policy_id=eq.${policyId}${tenantQuery}&select=*`, { headers: authHeaders });
                const row = policyRes.data?.[0];
                if (!row?.churn_policy_id) throw new Error('Churn Policy record not found.');

                setPolicyPk(row.churn_policy_id);
                setPolicyStatus(row.policy_status || row.status || '');
                setPolicyStage(row.stage || '');

                if (row.instance_id) {
                    setInstanceId(row.instance_id);
                    try {
                        const instRes = await axios.get(`/api/v1/tables/ap_process_workflow_instances?instance_id=eq.${row.instance_id}`, { headers: authHeaders });
                        const inst = instRes.data?.[0];
                        if (inst?.current_step) setCurrentWorkflowStepId(inst.current_step);
                        if (inst?.is_active === false) setIsWorkflowCompleted(true);
                    } catch { /* non-fatal */ }
                    try {
                        const histRes = await axios.get(`/api/v1/tables/ap_process_workflow_history?instance_id=eq.${row.instance_id}&order=history_id.asc`, { headers: authHeaders });
                        if (histRes.status === 200 && Array.isArray(histRes.data)) {
                            const userIds = [...new Set(histRes.data.map(h => h.created_by).filter(Boolean))];
                            const userMap = {};
                            await Promise.all(userIds.map(async uid => {
                                try { const u = await axios.get(`/api/v1/tables/ap_users?id=eq.${uid}&select=id,name,email`, { headers: authHeaders }); userMap[uid] = u.data?.[0]?.name || u.data?.[0]?.email || String(uid); }
                                catch { userMap[uid] = String(uid); }
                            }));
                            setWorkflowHistory(histRes.data.map(h => ({ ...h, created_by_name: userMap[h.created_by] || String(h.created_by) })));
                        }
                    } catch { /* non-fatal */ }
                }

                if (row.action_comments) setRejectionComment(row.action_comments);
                setFormData(populateFromColumns(row, fieldConfigurations));
            } catch (err) {
                console.error('ChurnPolicyEditor error:', err);
                toast.error(err.message || 'Failed to load data.');
                setFormData({});
            } finally { setLoading(false); }
        };
        fetchData();
    }, [policyId, user, token]);

    // ---------------------------------------------------------------------------
    // Field change handlers
    // ---------------------------------------------------------------------------
    const handleFieldChange = useCallback((fieldName, value) => {
        if (!canEditInvoice) { toast.error('No permission to edit.'); return; }
        const fc = fieldConfig.find(f => f.field_name === fieldName);
        let formatted = value;
        if (fc?.field_type === 'date' && typeof value === 'string') {
            const res = formatDateValue(value);
            if (res === '' && value.trim() !== '') {
                const td = new Date(value);
                if (!isNaN(td.getTime())) { const t = new Date(); t.setHours(0,0,0,0); td.setHours(0,0,0,0); toast.error(td > t ? 'Future dates are not allowed.' : 'Invalid date.'); }
                else toast.error('Invalid date format.');
                return;
            }
            formatted = res;
        }
        setFormData(prev => ({ ...prev, [fieldName]: formatted }));
        changedFieldsRef.current[fieldName] = formatted;
        if (errors[fieldName]) {
            const isEmpty = formatted === null || formatted === undefined || String(formatted).trim() === '';
            if (!fc?.is_required || !isEmpty) { const e = { ...errors }; delete e[fieldName]; setErrors(e); if (firstInvalidField === fieldName) setFirstInvalidField(null); }
        }
    }, [canEditInvoice, fieldConfig, errors, firstInvalidField, formatDateValue]);

    const handleLineItemChange = useCallback((itemIndex, fieldName, value, parentGroup = 'lineItems') => {
        if (!canEditInvoice) { toast.error('No permission to edit.'); return; }
        const fc = fieldConfig.find(f => f.field_name === fieldName && f.parent === parentGroup);
        let formatted = value;
        if (fc?.field_type === 'date' && typeof value === 'string') {
            const res = formatDateValue(value);
            if (res === '' && value.trim() !== '') { const td = new Date(value); if (!isNaN(td.getTime())) { const t = new Date(); t.setHours(0,0,0,0); td.setHours(0,0,0,0); toast.error(td > t ? 'Future dates are not allowed.' : 'Invalid date.'); } else toast.error('Invalid date format.'); return; }
            formatted = res;
        }
        const pgCfg = fieldConfig.find(f => f.field_name === parentGroup);
        const gpName = pgCfg?.parent || '';
        const gpCfg = gpName ? fieldConfig.find(f => f.field_name === gpName) : null;
        const isNested = gpCfg?.field_type === 'tab';
        setFormData(prev => {
            if (isNested) {
                const gpa = [...(prev[gpName] || [])]; const gr = { ...(gpa[0] || {}) };
                const na = [...(gr[parentGroup] || [])];
                if (na[itemIndex]) na[itemIndex] = { ...na[itemIndex], [fieldName]: formatted }; else return prev;
                gr[parentGroup] = na; gpa[0] = gr; return { ...prev, [gpName]: gpa };
            }
            const arr = [...(prev[parentGroup] || [])];
            if (arr[itemIndex]) arr[itemIndex] = { ...arr[itemIndex], [fieldName]: formatted }; else return prev;
            return { ...prev, [parentGroup]: arr };
        });
    }, [canEditInvoice, fieldConfig, formatDateValue]);

    const handleLineItemAdd = useCallback((parentGroup = 'lineItems') => {
        if (!canEditInvoice) { toast.error('No permission to edit.'); return; }
        const newRow = {};
        fieldConfig.filter(f => f.parent === parentGroup).forEach(f => { newRow[f.field_name] = f.field_type === 'array' ? [] : ''; });
        const pgCfg = fieldConfig.find(f => f.field_name === parentGroup);
        const gpName = pgCfg?.parent || '';
        const gpCfg = gpName ? fieldConfig.find(f => f.field_name === gpName) : null;
        setFormData(prev => {
            if (gpCfg?.field_type === 'tab') {
                const gpa = [...(prev[gpName] || [{}])]; const gr = { ...(gpa[0] || {}) };
                gr[parentGroup] = [...(gr[parentGroup] || []), newRow]; gpa[0] = gr; return { ...prev, [gpName]: gpa };
            }
            return { ...prev, [parentGroup]: [...(prev[parentGroup] || []), newRow] };
        });
    }, [canEditInvoice, fieldConfig]);

    const handleLineItemDelete = useCallback((itemIndex, parentGroup = 'lineItems') => {
        if (!canEditInvoice) { toast.error('No permission to edit.'); return; }
        const pgCfg = fieldConfig.find(f => f.field_name === parentGroup);
        const gpName = pgCfg?.parent || '';
        const gpCfg = gpName ? fieldConfig.find(f => f.field_name === gpName) : null;
        setFormData(prev => {
            if (gpCfg?.field_type === 'tab') {
                const gpa = [...(prev[gpName] || [{}])]; const gr = { ...(gpa[0] || {}) };
                gr[parentGroup] = (gr[parentGroup] || []).filter((_, i) => i !== itemIndex); gpa[0] = gr; return { ...prev, [gpName]: gpa };
            }
            return { ...prev, [parentGroup]: (prev[parentGroup] || []).filter((_, i) => i !== itemIndex) };
        });
    }, [canEditInvoice, fieldConfig]);

    // ---------------------------------------------------------------------------
    // validateForm
    // ---------------------------------------------------------------------------
    const validateForm = useCallback((action = 'default') => {
        const newErrors = {};
        let isValid = true;
        let firstId = null;

        if (action === 'reject' || action === 'hold') {
            if (!rejectionComment?.trim()) {
                newErrors.rejectionComment = action === 'hold' ? 'Hold reason is required.' : 'Rejection reason is required.';
                firstId = 'rejectionComment'; isValid = false;
            }
            setErrors(newErrors); return { isValid, firstInvalidFieldId: firstId };
        }

        const actionRefMap = { draft: 'btn_Draft', submit: 'btn_SUBMIT', approve: 'btn_Approve', reject: 'btn_reject' };
        const actionRef = action.startsWith('btn_') ? action : (actionRefMap[action] ?? null);
        const wfRequired = actionRef ? getWorkflowActionRequiredFields(workflowConfig, currentWorkflowStepId ?? null, actionRef, rawFieldConfig) : new Set();
        const knownNames = new Set(fieldConfig.map(f => f.field_name));
        const arrayParents = new Set(fieldConfig.filter(f => f.field_type === 'array').map(f => f.field_name));

        // Workflow-driven required fields
        wfRequired.forEach(fieldName => {
            if (!knownNames.has(fieldName)) return;
            const fc = fieldConfig.find(f => f.field_name === fieldName);
            const parentName = fc?.parent;
            if (arrayParents.has(fieldName)) {
                const rows = formData?.[fieldName];
                const stepDef = (workflowConfig?.steps || []).find(s => s.stepId === (currentWorkflowStepId ?? null)) || (workflowConfig?.steps || [])[0];
                const stepHidden = new Set(stepDef?.fields?.hidden || []);
                const stepReadonly = new Set(stepDef?.fields?.readonly || []);
                const childFields = fieldConfig.filter(f => f.parent === fieldName && !stepHidden.has(f.field_name) && !stepReadonly.has(f.field_name));
                if (!rows || !Array.isArray(rows) || rows.length === 0) {
                    newErrors[fieldName] = `${toTitleCase(fieldName)} requires at least one entry.`; isValid = false;
                    if (!firstId) firstId = fieldName; return;
                }
                rows.forEach((row, ri) => {
                    childFields.forEach(c => {
                        const val = row?.[c.field_name];
                        if (val === null || val === undefined || String(val).trim() === '') {
                            if (!newErrors[fieldName]) newErrors[fieldName] = [];
                            if (!newErrors[fieldName][ri]) newErrors[fieldName][ri] = {};
                            newErrors[fieldName][ri][c.field_name] = `${toTitleCase(c.field_name)} is required.`; isValid = false;
                            if (!firstId) firstId = `${fieldName}-item-${ri}-${c.field_name}`;
                        }
                    });
                });
                return;
            }
            if (parentName && arrayParents.has(parentName)) {
                if (wfRequired.has(parentName)) return;
                const rows = formData?.[parentName];
                if (!rows || !Array.isArray(rows) || rows.length === 0) return;
                rows.forEach((row, ri) => {
                    const val = row?.[fieldName];
                    if (val === null || val === undefined || String(val).trim() === '') {
                        if (!newErrors[parentName]) newErrors[parentName] = [];
                        if (!newErrors[parentName][ri]) newErrors[parentName][ri] = {};
                        newErrors[parentName][ri][fieldName] = `${toTitleCase(fieldName)} is required.`; isValid = false;
                        if (!firstId) firstId = `${parentName}-item-${ri}-${fieldName}`;
                    }
                });
                return;
            }
            // Regular field — resolve from nested tab if needed
            let value = formData?.[fieldName];
            if (parentName && !arrayParents.has(parentName)) {
                const absent = value === null || value === undefined || (typeof value !== 'boolean' && String(value).trim() === '');
                if (absent) {
                    const pCfg = fieldConfig.find(f => f.field_name === parentName);
                    const gpName = pCfg?.parent || '';
                    const gpCfg = gpName ? fieldConfig.find(f => f.field_name === gpName) : null;
                    if (gpCfg?.field_type === 'tab') {
                        const gpa = formData?.[gpName]; const gpr = Array.isArray(gpa) ? gpa[0] : (gpa && typeof gpa === 'object' ? gpa : null);
                        if (gpr) { const ntd = gpr[parentName]; value = Array.isArray(ntd) ? ntd[0]?.[fieldName] : ntd?.[fieldName]; }
                    } else {
                        const td = formData?.[parentName];
                        if (td) value = Array.isArray(td) ? td[0]?.[fieldName] : td[fieldName];
                    }
                }
            }
            const isEmpty = fc?.field_type === 'boolean' ? value !== true : (value === null || value === undefined || String(value).trim() === '');
            if (isEmpty && !newErrors[fieldName]) { newErrors[fieldName] = `${toTitleCase(fieldName)} is required.`; isValid = false; if (!firstId) firstId = fieldName; }
        });

        // fieldConfig-level required fields
        const allArrayFields = new Set(fieldConfig.filter(f => f.field_type === 'array').map(f => f.field_name));
        fieldConfig.filter(f => f.is_required && f.is_visible !== false && !allArrayFields.has(f.parent)).forEach(f => {
            const fieldName = f.field_name;
            if (newErrors[fieldName]) return;
            let value = formData?.[fieldName];
            if (f.parent && !allArrayFields.has(f.parent)) {
                const absent = value === null || value === undefined || (typeof value !== 'boolean' && String(value).trim() === '');
                if (absent) { const td = formData?.[f.parent]; if (td) value = Array.isArray(td) ? td[0]?.[fieldName] : td[fieldName]; }
            }
            const isEmpty = f.field_type === 'boolean' ? value !== true : (value === null || value === undefined || String(value).trim() === '');
            if (isEmpty) {
                newErrors[fieldName] = `${f.display_name || toTitleCase(fieldName)} is required.`; isValid = false;
                if (!firstId) firstId = fieldName;
            } else if (f.field_type === 'date' && typeof value === 'string' && value.trim() && formatDateValue(value) === '') {
                newErrors[fieldName] = 'Invalid date format.'; isValid = false; if (!firstId) firstId = fieldName;
            }
        });

        // Array-child required/date fields
        allArrayFields.forEach(arrayName => {
            const rows = formData?.[arrayName];
            if (!rows || !Array.isArray(rows)) return;
            const reqChildren = fieldConfig.filter(f => f.is_required && f.parent === arrayName && (f.is_visible ?? true));
            const dateChildren = fieldConfig.filter(f => f.field_type === 'date' && f.parent === arrayName && (f.is_visible ?? true));
            const prefix = `${arrayName}-item`;
            rows.forEach((item, ri) => {
                reqChildren.forEach(cf => {
                    const val = item[cf.field_name];
                    if (val === null || val === undefined || String(val).trim() === '') {
                        if (!newErrors[arrayName]) newErrors[arrayName] = [];
                        if (!newErrors[arrayName][ri]) newErrors[arrayName][ri] = {};
                        newErrors[arrayName][ri][cf.field_name] = `${cf.display_name || toTitleCase(cf.field_name)} is required.`; isValid = false;
                        if (!firstId) firstId = `${prefix}-${ri}-${cf.field_name}`;
                    }
                });
                dateChildren.forEach(cf => {
                    const val = item[cf.field_name];
                    if (val && typeof val === 'string' && val.trim() && formatDateValue(val) === '') {
                        if (!newErrors[arrayName]) newErrors[arrayName] = [];
                        if (!newErrors[arrayName][ri]) newErrors[arrayName][ri] = {};
                        newErrors[arrayName][ri][cf.field_name] = 'Invalid date format.'; isValid = false;
                        if (!firstId) firstId = `${prefix}-${ri}-${cf.field_name}`;
                    }
                });
            });
        });

        setErrors(newErrors);
        return { isValid, firstInvalidFieldId: firstId, errors: newErrors };
    }, [formData, fieldConfig, rawFieldConfig, toTitleCase, rejectionComment, formatDateValue, workflowConfig, currentWorkflowStepId]);

    // ---------------------------------------------------------------------------
    // Workflow helpers
    // ---------------------------------------------------------------------------
    const resolveWorkflowStep = useCallback((actionRef, currentStepId) => {
        const steps = workflowConfig?.steps || [];
        if (!steps.length) return { current_step: 'step_initiate', next_step: 'step_initiate', status: 'Draft' };
        if (!actionRef || actionRef === 'draft') { const f = steps[0]; return { current_step: f.stepId, next_step: f.stepId, status: 'Draft' }; }
        const cs = steps.find(s => s.stepId === currentStepId) || steps[0];
        const csi = steps.indexOf(cs);
        const matched = (cs.transitions || []).find(t => t.actionRef?.toLowerCase() === actionRef?.toLowerCase());
        if (matched) {
            const du = matched.dataUpdates || {};
            const txNext = du.next_step || du.NextStep;
            const rc = txNext || steps[csi + 1]?.stepId || cs.stepId;
            const rco = steps.find(s => s.stepId === rc);
            const rci = rco ? steps.indexOf(rco) : -1;
            const rn = rci >= 0 ? steps[rci + 1]?.stepId ?? null : null;
            return { current_step: rc, next_step: rn, status: du.status || 'In Progress' };
        }
        const na = actionRef?.toLowerCase();
        const fb = na === 'btn_submit' ? 'Submitted' : na === 'btn_approve' ? 'Approved' : na === 'btn_reject' ? 'Rejected' : 'In Progress';
        const no = steps[csi + 1]; const nno = no ? steps[csi + 2] : null;
        return { current_step: no?.stepId || cs.stepId, next_step: nno?.stepId ?? null, status: fb };
    }, [workflowConfig]);

    const createWorkflowInstance = async (actionRef, status, overrideStep = null) => {
        const nowIso = getCurrentTimeISOString();
        const { current_step, next_step } = resolveWorkflowStep(actionRef, overrideStep || 'step_initiate');
        const res = await axios.post('/api/v1/tables/ap_process_workflow_instances', [{
            tenant_id: user.tenantId, module_name: 'Churn Policy', Process_name: 'Churn Policy Onboarding',
            current_step, next_step, status, created_by: user.user_id, created_at: nowIso,
            updated_by: user.user_id, updated_at: nowIso, is_active: true,
        }], { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Prefer: 'return=representation' } });
        if (!res.data) throw new Error('Workflow instance creation failed.');
        return Array.isArray(res.data) ? res.data[0] : res.data;
    };

    const postWorkflowHistory = async (resolvedInstanceId, actionRef, previousStep, currentFormData) => {
        if (!resolvedInstanceId || !user) return;
        try {
            const { current_step: nextStep, status: resolvedStatus } = resolveWorkflowStep(actionRef, previousStep);
            const hj = {};
            Object.keys(changedFieldsRef.current).forEach(k => { if (currentFormData?.hasOwnProperty(k)) hj[k] = currentFormData[k]; });
            await axios.post('/api/v1/tables/ap_process_workflow_history', [{
                tenant_id: user.tenantId, instance_id: resolvedInstanceId,
                module_name: 'Churn Policy', Process_name: 'Churn Policy Onboarding',
                created_by: user.user_id, created_role_name: user.role || '',
                previous_step: previousStep || 'step_initiate', next_step: nextStep || null,
                actionRef, user_comments: rejectionComment || null, status: resolvedStatus || null,
                history_json: Object.keys(hj).length > 0 ? hj : null,
            }], { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Prefer: 'return=representation' } });
            changedFieldsRef.current = {};
        } catch (err) { console.error('Failed to post workflow history:', err); }
    };

    const updateWorkflowInstance = async (existingInstanceId, actionRef, status, currentStepId) => {
        const { current_step, next_step } = resolveWorkflowStep(actionRef, currentStepId);
        const steps = workflowConfig?.steps || [];
        const isTerminal = current_step && !steps.find(s => s.stepId === current_step);
        const hj = {};
        Object.keys(changedFieldsRef.current).forEach(k => { if (formData?.hasOwnProperty(k)) hj[k] = formData[k]; });
        const { status: transitionStatus } = resolveWorkflowStep(actionRef, currentStepId);
        const res = await axios.patch(`/api/vendor/approval/${existingInstanceId}`, {
            instance: { tenantId: user.tenantId, updatedBy: user.user_id, currentStep: current_step, nextStep: next_step ?? null, status, ...(isTerminal && { isActive: false }) },
            history: { createdRoleName: user.role || '', previousStep: currentStepId || 'step_initiate', nextStep: current_step ?? null, actionRef, userComments: rejectionComment || null, status: transitionStatus || status, historyJson: Object.keys(hj).length > 0 ? hj : {} },
        }, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        if (res.status < 200 || res.status >= 300) throw new Error(`Workflow update error: ${res.status}`);
        changedFieldsRef.current = {};
        return { current_step, next_step, status };
    };

    // ---------------------------------------------------------------------------
    // buildChurnPayload — dynamic churn_policy column payload from formData
    // ---------------------------------------------------------------------------
    const buildChurnPayload = () => {
        const isNonEmpty = v => { if (v === null || v === undefined) return false; if (typeof v === 'string') return v.trim() !== ''; if (typeof v === 'number') return !isNaN(v); if (Array.isArray(v)) return v.length > 0; return true; };
        const payload = {};
        fieldConfig.filter(f => (!f.parent || f.parent === '') && f.field_type !== 'tab').forEach(config => {
            const colName = config.field_name;
            if (!formData.hasOwnProperty(colName)) return;
            const val = formData[colName];
            payload[colName] = config.field_type === 'array' ? (Array.isArray(val) && val.length > 0 ? JSON.stringify(val) : null) : (isNonEmpty(val) ? val : null);
        });
        fieldConfig.filter(f => f.field_type === 'array' && (!f.parent || f.parent === '')).forEach(config => {
            const colName = config.field_name;
            if (payload.hasOwnProperty(colName)) return;
            const val = formData[colName];
            payload[colName] = Array.isArray(val) && val.length > 0 ? JSON.stringify(val) : null;
        });
        return payload;
    };

    // ---------------------------------------------------------------------------
    // createNewPolicy / updatePolicy
    // ---------------------------------------------------------------------------
    const createNewPolicy = async (status, stage, extraData = {}) => {
        if (!canEditInvoice) { toast.error('No permission.'); return false; }
        try {
            const nowIso = getCurrentTimeISOString();
            const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Prefer: 'return=representation' };
            const actionRef = status === 'Draft' ? 'draft' : 'btn_submit';
            const { status: wfStatus } = resolveWorkflowStep(actionRef, 'step_initiate');
            const effectiveStatus = wfStatus || status;
            const instanceData = await createWorkflowInstance(actionRef, effectiveStatus, 'step_initiate');
            const createdInstanceId = instanceData?.instance_id;
            if (!createdInstanceId) throw new Error('No instance_id returned from workflow instance creation.');
            setInstanceId(createdInstanceId);
            await postWorkflowHistory(createdInstanceId, actionRef, 'step_initiate', formData);
            await uploadAllFiles(createdInstanceId);
            const policyPayload = {
                ...buildChurnPayload(),
                instance_id: createdInstanceId, tenant_id: user.tenantId,
                policy_status: effectiveStatus,
                created_at: nowIso, created_by: user.user_id,
                updated_at: nowIso, updated_by: user.user_id,
                ...(extraData.comments ? { action_comments: extraData.comments } : rejectionComment ? { action_comments: rejectionComment } : {}),
            };
            const res = await axios.post('/api/v1/tables/churn_policy', [policyPayload], { headers: authHeaders });
            if (res.status < 200 || res.status >= 300) throw new Error(`Insert error: ${res.status}`);
            const created = Array.isArray(res.data) ? res.data[0] : res.data;
            setPolicyPk(created.churn_policy_id);
            return true;
        } catch (err) { toast.error(`Failed to create policy: ${err.message}`); return false; }
    };

    const updatePolicy = async (status, stage, extraData = {}, actionRefOverride = null, currentStepIdOverride = null) => {
        if (!canEditInvoice) { toast.error('No permission.'); return false; }
        try {
            const nowIso = getCurrentTimeISOString();
            const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Prefer: 'return=representation' };
            let currentStepId = currentStepIdOverride || 'step_initiate';
            if (!currentStepIdOverride && instanceId) {
                try { const r = await axios.get(`/api/v1/tables/ap_process_workflow_instances?instance_id=eq.${instanceId}`, { headers: { Authorization: `Bearer ${token}` } }); if (r.data?.[0]?.current_step) currentStepId = r.data[0].current_step; }
                catch { /* fallback */ }
            }
            const actionRefMap = { Draft: 'draft', Submitted: 'btn_submit', Approved: 'btn_approve', Rejected: 'btn_reject', Hold: 'btn_hold', reconciled: 'btn_approve' };
            const actionRef = actionRefOverride || actionRefMap[status] || 'draft';
            const { status: wfStatus } = resolveWorkflowStep(actionRef, currentStepId);
            const effectiveStatus = wfStatus || status;
            if (instanceId) await updateWorkflowInstance(instanceId, actionRef, effectiveStatus, currentStepId);
            await uploadAllFiles(instanceId);
            const patchPayload = {
                ...buildChurnPayload(),
                policy_status: effectiveStatus, instance_id: instanceId,
                tenant_id: user.tenantId, updated_at: nowIso, updated_by: user.user_id,
                ...(extraData.comments ? { action_comments: extraData.comments } : rejectionComment ? { action_comments: rejectionComment } : {}),
            };
            const res = await axios.patch(`/api/v1/tables/churn_policy?churn_policy_id=eq.${policyPk}`, patchPayload, { headers: authHeaders });
            if (res.status < 200 || res.status >= 300) throw new Error(`Update error: ${res.status}`);
            return true;
        } catch (err) { toast.error(`Failed to update policy: ${err.message}`); return false; }
    };

    // ---------------------------------------------------------------------------
    // Action handlers
    // ---------------------------------------------------------------------------
    const handleSaveDraft = async () => {
        setSaveDraftLoading(true);
        try {
            const { isValid, firstInvalidFieldId: fid } = validateForm('draft');
            setFirstInvalidField(fid);
            if (!isValid) { toast.error('Please correct validation errors before saving draft.'); return; }
            const { status: draftStatus } = resolveWorkflowStep('draft', 'step_initiate');
            const success = policyId ? await updatePolicy(draftStatus || 'Draft', 'New') : await createNewPolicy(draftStatus || 'Draft', 'New');
            if (success) { toast.success('Policy saved as draft.'); navigate('/vendor_queue'); }
            else toast.error('Failed to save draft.');
        } catch (err) { toast.error(`Error saving draft: ${err.message}`); }
        finally { setSaveDraftLoading(false); }
    };

    const handleSubmit = async () => {
        setSubmitLoading(true);
        try {
            const { isValid } = validateForm('submit');
            if (!isValid) { toast.error('Please correct validation errors before submitting.'); return; }
            const nsv = validateWorkflowNextStep(workflowConfig, 'step_initiate', 'btn_submit');
            if (!nsv.isValid) { toast.error(nsv.message, { autoClose: 5000 }); return; }
            const { status: submitStatus } = resolveWorkflowStep('btn_submit', 'step_initiate');
            const success = policyId ? await updatePolicy(submitStatus || 'Submitted', 'Review') : await createNewPolicy(submitStatus || 'Submitted', 'Review');
            if (success) { toast.success('Policy submitted.'); navigate('/vendor_queue'); }
            else toast.error('Failed to submit policy.');
        } catch (err) { toast.error(`Error submitting: ${err.message}`); }
        finally { setSubmitLoading(false); }
    };

    const handleApproveAndUpload = async () => {
        const { isValid, firstInvalidFieldId: fid, errors: errs } = validateForm('approve');
        setErrors(errs); setFirstInvalidField(fid);
        if (!isValid) { setProcessMessage('Please correct fields before proceeding.'); setProcessStatus('error'); setProcessing(true); setTimeout(() => { setProcessing(false); setProcessMessage(''); setProcessStatus(''); }, 1000); return; }
        setProcessMessage('Processing approval...'); setProcessStatus('processing'); setProcessing(true);
        try {
            let csid = 'step_initiate';
            if (instanceId) { try { const r = await axios.get(`/api/v1/tables/ap_process_workflow_instances?instance_id=eq.${instanceId}`, { headers: { Authorization: `Bearer ${token}` } }); if (r.data?.[0]?.current_step) csid = r.data[0].current_step; } catch { /* fallback */ } }
            const nsv = validateWorkflowNextStep(workflowConfig, csid, 'btn_approve');
            if (!nsv.isValid) { toast.error(nsv.message, { autoClose: 5000 }); setProcessing(false); setProcessMessage(''); setProcessStatus(''); return; }
            const { status: appStatus } = resolveWorkflowStep('btn_approve', csid);
            const success = await updatePolicy(appStatus || 'Approved', 'Review', { comments: rejectionComment }, 'btn_approve', csid);
            if (success) { setProcessMessage('Policy approved!'); setProcessStatus('success'); navigate('/vendor_queue'); }
            else { setProcessMessage('Failed to approve.'); setProcessStatus('error'); setTimeout(() => { setProcessing(false); setProcessMessage(''); setProcessStatus(''); }, 3000); }
        } catch { /* handled in updatePolicy */ }
    };

    const handleReject = async () => {
        const { isValid, firstInvalidFieldId: fid } = validateForm('reject');
        if (!isValid) { setFirstInvalidField(fid); setProcessMessage('Please add a rejection reason.'); setProcessStatus('error'); setProcessing(true); setTimeout(() => { setProcessing(false); setProcessMessage(''); setProcessStatus(''); }, 1000); return; }
        setShowRejectionModal(true);
    };

    const handleHold = async () => {
        const { isValid, firstInvalidFieldId: fid } = validateForm('hold');
        if (!isValid) { setFirstInvalidField(fid); setProcessMessage('Please add a hold reason.'); setProcessStatus('error'); setProcessing(true); setTimeout(() => { setProcessing(false); setProcessMessage(''); setProcessStatus(''); }, 1000); return; }
        setShowHoldModal(true);
    };

    const runAction = async (actionRef, statusLabel) => {
        let csid = 'step_initiate';
        if (instanceId) { try { const r = await axios.get(`/api/v1/tables/ap_process_workflow_instances?instance_id=eq.${instanceId}`, { headers: { Authorization: `Bearer ${token}` } }); if (r.data?.[0]?.current_step) csid = r.data[0].current_step; } catch { /* fallback */ } }
        const { status: wfStatus } = resolveWorkflowStep(actionRef, csid);
        return updatePolicy(wfStatus || statusLabel, 'Review', { comments: rejectionComment }, actionRef, csid);
    };

    const confirmRejectPolicy = async () => { setShowRejectionModal(false); setProcessMessage('Rejecting...'); setProcessStatus('processing'); setProcessing(true); const ok = await runAction('btn_reject', 'Rejected'); if (ok) { setProcessMessage('Policy rejected.'); setProcessStatus('success'); navigate('/vendor_queue'); } else { setProcessMessage('Failed to reject.'); setProcessStatus('error'); setTimeout(() => { setProcessing(false); setProcessMessage(''); setProcessStatus(''); }, 3000); } };
    const cancelRejectPolicy = () => setShowRejectionModal(false);
    const confirmHoldPolicy = async () => { setShowHoldModal(false); setProcessMessage('Placing on hold...'); setProcessStatus('processing'); setProcessing(true); const ok = await runAction('btn_hold', 'Hold'); if (ok) { setProcessMessage('Policy placed on hold.'); setProcessStatus('success'); navigate('/vendor_queue'); } else { setProcessMessage('Failed to place on hold.'); setProcessStatus('error'); setTimeout(() => { setProcessing(false); setProcessMessage(''); setProcessStatus(''); }, 3000); } };
    const cancelHoldPolicy = () => setShowHoldModal(false);
    const handleSendToReconciliation = async () => { setProcessMessage('Processing for reconciliation...'); setProcessStatus('processing'); setProcessing(true); const ok = await updatePolicy('reconciled', 'Review'); if (ok) { setProcessMessage('Sent to reconciliation.'); setProcessStatus('success'); navigate('/vendor_queue'); } else { setProcessMessage('Failed.'); setProcessStatus('error'); setTimeout(() => { setProcessing(false); setProcessMessage(''); setProcessStatus(''); }, 3000); } };
    const handleCancel = () => navigate('/vendor_queue');
    const handleBack = () => navigate(location.state?.from ?? '/vendor_queue');

    // ---------------------------------------------------------------------------
    // Render guards
    // ---------------------------------------------------------------------------
    if (loading) return null;

    if (!formData || Object.keys(formData).length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full gap-6 text-gray-500 bg-gray-50 p-8 rounded-lg">
                <div className="bg-red-100 p-4 rounded-full"><X size={48} className="text-red-500" /></div>
                <div className="text-center max-w-md">
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Unable to Load Policy Data</h3>
                    <p className="text-gray-500 mb-4">Could not load data for this Churn Policy.</p>
                    <button onClick={() => navigate(-1)} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Rejection Modal */}
            {showRejectionModal && (
                <div className="fixed inset-0 z-[10000] bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100"><X size={24} className="text-red-600" /></div>
                            <h3 className="text-lg font-medium text-gray-900 mt-4">Confirm Rejection</h3>
                            <p className="mt-2 text-sm text-gray-500">Are you sure you want to reject this policy?</p>
                        </div>
                        <div className="mt-6 flex justify-center gap-3">
                            <button onClick={cancelRejectPolicy} className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
                            <button onClick={confirmRejectPolicy} className="inline-flex justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hold Modal */}
            {showHoldModal && (
                <div className="fixed inset-0 z-[10000] bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100"><GitCompare size={24} className="text-yellow-600" /></div>
                            <h3 className="text-lg font-medium text-gray-900 mt-4">Confirm Hold</h3>
                            <p className="mt-2 text-sm text-gray-500">Are you sure you want to place this policy on hold?</p>
                        </div>
                        <div className="mt-6 flex justify-center gap-3">
                            <button onClick={cancelHoldPolicy} className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
                            <button onClick={confirmHoldPolicy} className="inline-flex justify-center rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-700">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Processing Overlay */}
            {processing && (
                <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center flex flex-col items-center">
                        {processStatus === 'processing' && (<><div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4"><svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></div><p className="text-gray-700 font-medium">{processMessage}</p></>)}
                        {processStatus === 'success' && (<><div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4"><svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div><p className="text-gray-700 font-medium">{processMessage}</p></>)}
                        {processStatus === 'error' && (<><div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4"><svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></div><p className="text-gray-700 font-medium">{processMessage}</p></>)}
                    </div>
                </div>
            )}

            {/* Header */}
            <div data-tour="editor-header">
                <div className="flex flex-wrap gap-y-2 justify-between border items-center px-4 py-2 z-[100] bg-white shadow-md">
                    <button onClick={handleBack} className="flex text-[12px] items-center gap-1 px-2 py-1 bg-blue-500 border border-blue-600 rounded-md shadow-sm hover:bg-blue-600 transition-all duration-200 focus:outline-none">
                        <ArrowLeft size={16} className="text-white" /><span className="font-medium text-white">Back</span>
                    </button>
                    {isReadonly && !canEditInvoice && (<span className="px-2 py-1 rounded-full text-[12px] font-medium bg-gray-100 text-gray-800 whitespace-nowrap">Readonly Mode</span>)}
                    {policyStatus && (
                        <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[12px] font-medium text-gray-700 whitespace-nowrap">Current Status:</span>
                            <StatusBadge status={policyStatus} />
                        </div>
                    )}
                </div>

                <WorkflowStepper
                    workflowConfig={workflowConfig}
                    currentWorkflowStepId={instanceId ? currentWorkflowStepId : null}
                    isCompleted={isWorkflowCompleted}
                    completedStepStatuses={completedStepStatuses}
                />

                <VendorFormUI
                    invoiceId={policyId}
                    formData={formData}
                    fieldConfig={fieldConfig}
                    errors={errors}
                    setErrors={setErrors}
                    fileUrl={null}
                    fileType={null}
                    invoicePath={''}
                    lineItemTableHeaders={lineItemTableHeaders}
                    lineItemColumnProperties={lineItemColumnProperties}
                    onFieldChange={handleFieldChange}
                    onLineItemChange={handleLineItemChange}
                    onLineItemAdd={handleLineItemAdd}
                    onLineItemDelete={handleLineItemDelete}
                    onReject={handleReject}
                    onHold={handleHold}
                    onSendToReconciliation={handleSendToReconciliation}
                    onApproveAndUpload={handleApproveAndUpload}
                    rejectionComment={rejectionComment}
                    setRejectionComment={setRejectionComment}
                    onClearRejectionCommentError={clearRejectionCommentError}
                    validateForm={validateForm}
                    canEditInvoice={canEditInvoice}
                    onReconcileWithPO={() => {}}
                    onBack={handleBack}
                    firstInvalidField={firstInvalidField}
                    isReadonly={isReadonly}
                    errorDesc={null}
                    onSaveDraft={handleSaveDraft}
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                    isCreating={!policyId}
                    docId={null}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    documentActiveTab={documentActiveTab}
                    setDocumentActiveTab={setDocumentActiveTab}
                    isDocTrayCollapsed={isDocTrayCollapsed}
                    setIsDocTrayCollapsed={setIsDocTrayCollapsed}
                    documents={documents}
                    selectedDocument={selectedDocument}
                    toggleDocTray={toggleDocTray}
                    selectDocument={selectDocument}
                    onDeleteDocument={handleDeleteDocument}
                    fileInputRef={fileInputRef}
                    triggerUpload={triggerUpload}
                    handleFileSelect={handleFileSelect}
                    pendingFiles={pendingFiles}
                    setPendingFiles={setPendingFiles}
                    manualUploadedFiles={manualUploadedFiles}
                    onManualFileSelect={handleManualFileSelect}
                    onRemoveManualFile={handleRemoveManualFile}
                    onOpenPreview={handleOpenPreview}
                    vendorStatus={policyStatus}
                    vendorStage={policyStage}
                    workflowConfig={workflowConfig}
                    currentWorkflowStepId={instanceId ? currentWorkflowStepId : null}
                    instanceId={instanceId}
                    isWorkflowCompleted={isWorkflowCompleted}
                    workflowHistory={workflowHistory}
                    isWorkflowMissing={isWorkflowMissing}
                />
            </div>

            <ViewDocumentModal
                isOpen={isPreviewModalOpen}
                onRequestClose={handleClosePreview}
                fileUrl={selectedPreviewFile}
                fileName={selectedPreviewFileName}
            />

            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" style={{ zIndex: 99999999 }} />
        </>
    );
};

export default VendorEditor;
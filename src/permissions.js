import { loadSecure } from "./utils/secureStorage"; // adjust path if needed

/**
 * @file permissions.js
 * @description Defines the access control list (ACL) for different user roles
 * within the application based on the provided permissions matrix.
 * This file centralizes permission management for various features and actions.
 */

/**
 * PERMISSIONS object defines what each role can view, edit, and delete.
 *
 * Structure:
 * {
 * [roleName]: {
 * canView: string[],    // Array of paths or feature identifiers that the role can view.
 * canEdit: string[],    // Array of feature identifiers that the role can edit/perform actions on.
 * canDelete: string[]  // Array of feature identifiers that the role can delete.
 * }
 * }
 *
 * Note on feature identifiers for canEdit/canDelete:
 * These are logical identifiers representing capabilities, not necessarily direct paths.
 * For example, 'invoice_approve_reject' signifies the ability to perform these actions
 * on an invoice, which would be enforced within the component logic.
 */
export const PERMISSIONS = {
    account_user: { // Mapped from "Account User"
        canView: [
            '/dashboard',
            '/vendor/dashboard',
            '/source', // Upload
            '/documents', // Document Queue
            '/invoice_queue', // Invoice List
            '/vendor_queue', // Vendor List
            '/editor/:invoiceId', // Invoice View (dynamic path)
            '/vendor_editor/:invoiceId', // Vendor View (dynamic path)
            '/reconcile_queue', // Recon queue
            '/reconcile_queue/:invoiceId', // Recon view (dynamic path)
            '/final_queue', // Approved Invoices
            '/vendor_final_queue', // Approved Vendors
            '/reimbursement-queue',
            '/view-reimbursement/:id', // View Reimbursement (dynamic path)
            '/invoice_reports', // Reports
            '/vendor_reports', // Vendor Reports            
            '/billing', // Billing
        ],
        canEdit: [
            'invoice_approve_reject', // Invoice View: approve/reject
            'vendor_approve_reject', // Vendor View: approve/reject
            'recon_approve_reject',   // Recon: approve/reject
            'upload_document',        // Permission to upload documents (remains for standard users)
        ],
        canDelete: [],
    },
    account_manager: { // Mapped from "Account account_manager"
        canView: [
            '/dashboard',
            '/vendor/dashboard',
            '/source', // Upload
            '/documents', // Document Queue
            '/invoice_queue', // Invoice List
            '/vendor_queue', // Vendor List
            '/editor/:invoiceId', // Invoice View (dynamic path)
            '/vendor_editor/:invoiceId', // Vendor View (dynamic path)
            '/reconcile_queue', // Recon queue
            '/reconcile_queue/:invoiceId', // Recon view (dynamic path)
            '/final_queue', // Approved Invoices
            '/vendor_final_queue', // Approved Vendors
            '/reimbursement-queue',
            '/view-reimbursement/:id', // View Reimbursement (dynamic path)
            '/invoice_reports', // Reports
            '/vendor_reports', // Vendor Reports
            '/billing', // Billing
        ],
        canEdit: [
            'invoice_approve_reject', // Invoice View: approve/reject
            'vendor_approve_reject', // Vendor View: approve/reject
            'recon_approve_reject',   // Recon: approve/reject
            'upload_document',        // Permission to upload documents
        ],
        canDelete: [
            'invoice_list_delete', // Invoice List: Delete
            'vendor_list_delete', // Vendor List: Delete
        ],
    },
    tenant_admin: { // Mapped from "tenant_admin Admin"
        canView: [
            '/dashboard',
            '/vendor/dashboard',
            '/source', // Upload - Added access as per user request
            '/documents', // Document Queue
            '/invoice_queue', // Invoice List
            '/vendor_queue', // Vendor List
            '/editor/:invoiceId', // Invoice View (dynamic path)
            '/vendor_editor/:invoiceId', // Vendor View (dynamic path)
            '/reconcile_queue', // Recon queue
            '/reconcile_queue/:invoiceId', // Recon view (dynamic path)
            '/final_queue', // Approved Invoices
            '/vendor_final_queue', // Approved Vendors
            '/reimbursement-queue',
            '/view-reimbursement/:id', // View Reimbursement (dynamic path)
            '/invoice_reports', // Reports
            '/vendor_reports', // Vendor Reports
            '/billing', // Billing
            '/users', // User Management
            '/configure', // Invoice Field Config
            '/vendor_configure', // Vendor Invoice Field Config
            '/parameters', // Parameters
            '/masters', // Masters
            // '/admin-log', // Admin Log (placeholder path)
            '/po_queue', // Added: PO List
            '/po_editor/:poId', // Added: PO View (dynamic path)
            '/po_completed', // Added: Approved POs
            '/tenantlogo', // Tenant Logo Management
            '/tenantreg', // Tenant Registration
        ],
        canEdit: [
            // 'upload_document',        // REMOVED: Tenant Admin should not upload
            // 'invoice_approve_reject',
            // 'vendor_approve_reject', // Vendor View: approve/reject
            'invoice_field_config', // Invoice Field Config: Edit
            'vendor_invoice_field_config', // Vendor Invoice Field Config: Edit
            'masters',              // Masters: Edit
            'parameters',           // Parameters: Edit
            'all_users',
            'tenant_logo',          // Tenant Logo: Edit
            'tenant_registration',    // Tenant Registration: Edit
            // 'po_approve_reject', // Added: PO View: approve/reject
        ],
        canDelete: [
            'invoice_field_config', // Invoice Field Config: Delete
            'vendor_invoice_field_config', // Vendor Invoice Field Config: Delete
            'vendor_list_delete', // Vendor List: Delete
            // 'all_users',
            'po_list_delete', // Added: PO List: Delete
            'tenant_logo',    // Tenant Logo: Delete
            'tenant_registration', // Tenant Registration: Delete
        ],
    },
    super_admin: { // Mapped from "Super Admin"
        canView: [
            '/dashboard',
            '/vendor/dashboard',
            '/documents', // Document Queue
            '/source', // Upload
            '/invoice_queue', // Invoice List
            '/vendor_queue', // Vendor List
            '/editor/:invoiceId', // Invoice View (dynamic path)
            '/vendor_editor/:invoiceId', // Vendor View (dynamic path)
            '/reconcile_queue', // Recon queue
            '/reconcile_queue/:invoiceId', // Recon view (dynamic path)
            '/final_queue', // Approved Invoices
            '/vendor_final_queue', // Approved Vendors
            '/reimbursement-queue',
            '/view-reimbursement/:id', // View Reimbursement (dynamic path)
            '/invoice_reports', // Reports
            '/vendor_reports', // Vendor Reports
            '/billing', // Billing
            '/tenantreg', // tenant_admin Registration
            '/users', // User Management
            '/configure', // Invoice Field Config
            '/vendor_configure', // Vendor Invoice Field Config
            '/parameters', // Parameters
            '/masters', // Masters
            '/po_editor/:poId', // Added: PO View (dynamic path)
            // '/admin-log', // Admin Log (placeholder path)
            // '/admin-reports', // Admin Reports (placeholder path)
            '/defaultconfig', // Default Configuration
            '/tenantlogo', // Tenant Logo Management
            '/generic-fields', // Generic Fields Configuration
        ],
        canEdit: [
            // 'upload_document',        // REMOVED: Super Admin should not upload
            'all_invoices',           // Implies edit on any invoice data
            'all_vendors',            // Implies edit on any vendor data
            'all_users',              // Implies edit on any user data
            'invoice_field_config',   // Invoice Field Config: Edit
            'vendor_invoice_field_config', // Vendor Invoice Field Config: Edit
            'masters',                // Masters: Edit
            'parameters',             // Parameters: Edit
            'tenant_registration',    // Tenant Registration: Edit
            'default_config',         // Default Configuration: Edit
        ],
        canDelete: [
            'all_invoices',           // Implies delete on any invoice data
            'all_vendors',            // Implies delete on any vendor data
            'all_users',              // Implies delete on any user data
            'invoice_field_config',   // Invoice Field Config: Delete
            'vendor_invoice_field_config', // Vendor Invoice Field Config: Delete
            'masters',                // Masters: Delete
            'parameters',             // Parameters: Delete
            'admin_log_purge',        // Admin Log: Purge (delete)
            'tenant_registration',    // Tenant Registration: Delete
            'default_config',         // Default Configuration: Delete
        ],
    },
    // Add more roles as needed
    guest: { // A fallback role with minimal access
        canView: ['/dashboard'],
        canEdit: [],
        canDelete: [],
    },
};

/**
 * Helper function to check if a user has permission to view a specific path.
 * This can be used in routing or component rendering logic.
 *
 * @param {string} role - The role of the current user (e.g., 'super_admin', 'tenant_admin', 'account_user').
 * @param {string} path - The path or feature identifier to check permission for.
 * @returns {boolean} - True if the role has view permission, false otherwise.
 */
export const canUserView = (role, path) => {
    const rolePermissions = PERMISSIONS[role];
    if (!rolePermissions || !rolePermissions.canView) {
        return false;
    }

    // Handle dynamic paths like /editor/:invoiceId or /reconcile_queue/:invoiceId
    // Check if the path starts with any of the allowed base paths
    const isDynamicPath = rolePermissions.canView.some(allowedPath => {
        if (allowedPath.includes(':')) {
            const basePath = allowedPath.substring(0, allowedPath.indexOf('/:'));
            return path.startsWith(basePath);
        }
        return path === allowedPath;
    });

    return isDynamicPath;
};

/**
 * Helper function to check if a user has permission to edit a specific feature.
 *
 * @param {string} role - The role of the current user.
 * @param {string} feature - The feature identifier to check permission for (e.g., 'invoices', 'users').
 * @returns {boolean} - True if the role has edit permission, false otherwise.
 */
export const canUserEdit = (role, feature) => {
    const rolePermissions = PERMISSIONS[role];
    if (!rolePermissions || !rolePermissions.canEdit) {
        return false;
    }
    return rolePermissions.canEdit.includes(feature);
};

/**
 * Helper function to check if a user has permission to delete a specific feature.
 *
 * @param {string} role - The role of the current user.
 * @param {string} feature - The feature identifier to check permission for.
 * @returns {boolean} - True if the role has delete permission, false otherwise.
 */
export const canUserDelete = (role, feature) => {
    const rolePermissions = PERMISSIONS[role];
    if (!rolePermissions || !rolePermissions.canDelete) {
        return false;
    }
    return rolePermissions.canDelete.includes(feature);
};


/**
 * Get the stored user and token from secure storage (encrypted IndexedDB).
 * Can be called from anywhere in the app.
 * @returns {Promise<{user: object|null, token: string|null}>}
 */
export async function getStoredAuth() {
  const user = await loadSecure("user");
  const token = await loadSecure("token");
  return { user, token };
}
import React, { useCallback, useEffect } from 'react';
import { useTour } from '@reactour/tour';
import { HelpCircle } from 'lucide-react';
import { useSelector } from 'react-redux';

// Central tour steps configuration for all pages
const TOUR_STEPS = {
    dashboard: [
        {
            selector: '[data-tour="dashboard-header"]',
            content: 'Welcome to your Dashboard! This is your central hub for managing documents and invoices. The dashboard provides an overview of your documents, key statistics, and important charts to help you track your processing workflow.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="status-cards-grid"]',
            content: 'These cards display key statistics about your documents including total uploaded, processing, pending review, approved, completed, rejected, and error counts. Each card shows a specific status category.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="filter-section"]',
            content: 'This section shows any active filters applied to the dashboard data. You can see filters by date range, status, stage, user, or tenant. Use the "Filter Dashboard" button to add or modify filters.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="filter-dashboard-button"]',
            content: 'Click this button to open the filter modal where you can filter dashboard data by date range, status, stage, user, or tenant.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="document-stage-chart"]',
            content: 'This pie chart shows the distribution of your documents across different stages: New, Review, and Upload. It helps you understand where your documents are in the processing pipeline.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="document-status-chart"]',
            content: 'This bar chart displays your documents categorized by status: Processing, Pending, Approved, Rejected, Completed, and Error. It helps you visualize document outcomes and identify trends.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reset-filters-button"]',
            content: 'Click this button to reset all applied filters and return to the default dashboard view showing all documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        }
    ],

    // Admin pages
    userManagement: [
        {
            selector: '[data-tour="user-mgmt-header"]',
            content: 'Manage all users in your organization from this page. You can add, edit, activate/deactivate, and view user details.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="add-user-button"]',
            content: 'Click here to add a new user to your organization. You\'ll need to provide their details and assign a role.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="bulk-register-button"]',
            content: 'Click here to register multiple users at once by uploading an Excel file with user details.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="user-table"]',
            content: 'This table displays all users with their roles and account status. You can filter and sort the data as needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="user-table-filters"]',
            content: 'Use these column filters to quickly search and filter users by ID, name, email, role, or status.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="user-table-sort"]',
            content: 'Click on column headers to sort users by that field in ascending or descending order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="user-actions"]',
            content: 'These action buttons allow you to edit user details, change their active status, or delete users.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="user-edit-button"]',
            content: 'Click the edit icon to modify a user\'s details, role, or password.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="user-active-toggle"]',
            content: 'Click this toggle to activate or deactivate a user account. Inactive users cannot log in to the system.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="user-delete-button"]',
            content: 'Click the trash icon to permanently delete a user from the system.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="user-table-pagination"]',
            content: 'Use pagination controls to navigate through multiple pages of users.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="download-template"]',
            content: 'Click here to download the Excel template for bulk user registration.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="bulk-upload-modal"]',
            content: 'In the bulk upload modal, select your Excel file containing user data and click "Upload and Process".',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="bulk-summary"]',
            content: 'After processing, you\'ll see a summary showing how many users were successfully registered or updated.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-previous"]',
            content: 'Click this button to go to the previous page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-next"]',
            content: 'Click this button to go to the next page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-current"]',
            content: 'This is the current page. Click on other page numbers to navigate directly to that page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    invoiceConfig: [
        {
            selector: '[data-tour="config-header"]',
            content: 'Configure the fields that will be extracted from documents. These fields determine what data is captured during document processing.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="field-config-table"]',
            content: 'This table shows all configurable fields. You can add, edit, or remove fields as needed for your organization.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="add-field-button"]',
            content: 'Click here to add a new field to the configuration. You can specify the field name, type, and other properties.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-drag"]',
            content: 'Drag this handle to reorder fields in the configuration. The order determines how fields appear during data entry.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-delete"]',
            content: 'Click this button to delete a field from the configuration. Note that this will remove the field from all future document processing.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-description-popup"]',
            content: 'Click this button to edit or view the description for a field. Descriptions help users understand what information to enter.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-custom-values-popup"]',
            content: 'Click this button to edit or view custom values for dropdown, radio, or checkbox fields.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="save-config-button"]',
            content: 'Save your field configuration changes. Changes take effect immediately for new document processing.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin'],
            editableOnly: true
        },
        {
            selector: '[data-tour="field-name"]',
            content: 'The field name is used as the label during data entry and in reports.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="field-type"]',
            content: 'The field type determines what kind of data can be entered. Options include text, number, date, dropdown, and more.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="field-required"]',
            content: 'Mark a field as required if users must fill it out during data entry.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="field-description"]',
            content: 'The field description provides guidance to users about what information to enter.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="edit-table-button"]',
            content: 'Click this button to edit the invoice structure table when in read-only mode.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="use-llm-column"]',
            content: 'Enable the Use LLM checkbox to allow the AI system to extract this field automatically from documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconcile-column"]',
            content: 'Set reconciliation options for this field. You can choose to reconcile with Purchase Orders (PO), Goods Receipt Notes (GRN), or both.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="cancel-delete-button"]',
            content: 'Click this button to cancel the delete operation and return to the configuration table.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="confirm-delete-button"]',
            content: 'Click this button to confirm and permanently delete the selected field from the configuration.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="save-config-button"]',
            content: 'Click this button to confirm and save your field configuration changes. Changes take effect immediately for new document processing.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin'],
            editableOnly: true
        },
        {
            selector: '[data-tour="cancel-save-button"]',
            content: 'Click this button to cancel the save operation and return to the configuration table.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin'],
            editableOnly: true
        },
        {
            selector: '[data-tour="invoice-config-popup-textarea"]',
            content: 'This is the text area where you can edit the description or custom values for a field. Changes will be saved when you click Update.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-popup-cancel"]',
            content: 'Click this button to cancel your changes and close the popup without saving.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-popup-update"]',
            content: 'Click this button to save your changes and close the popup.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-dialog-code-editor"]',
            content: 'This is the code editor where you can write JavaScript validation rules for a field. The validation function should return true for valid values and false for invalid values.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-dialog-textarea"]',
            content: 'This is the text area where you can write JavaScript validation rules for a field. The validation function should return true for valid values and false for invalid values.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-dialog-cancel"]',
            content: 'Click this button to cancel your changes and close the dialog without saving.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-dialog-update"]',
            content: 'Click this button to save your validation rules and close the dialog.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="field-name-input"]',
            content: 'This is the field name input. It must contain only letters, numbers, and underscores. This name is used internally for the field.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="display-name-input"]',
            content: 'This is the display name input. This is how the field will appear in the user interface. By default, it matches the field name but can be customized.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="field-type-select"]',
            content: 'Select the field type from the dropdown. Different field types determine what kind of data can be entered and how it is processed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="parent-field-select"]',
            content: 'For array-type fields, you can set a parent field to create hierarchical relationships between fields.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconcile-select"]',
            content: 'Set reconciliation options for this field. You can choose to reconcile with Purchase Orders (PO), Goods Receipt Notes (GRN), or both.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="required-checkbox"]',
            content: 'Check this box to make the field required. Users must fill out required fields during data entry.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="use-llm-checkbox"]',
            content: 'Check this box to allow the AI system to extract this field automatically from documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="display-name-note"]',
            content: 'This note explains that you can customize how fields appear in the user interface by editing the Display Name.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="generic-fields-note"]',
            content: 'This note indicates that these are demo fields. You should customize them according to your organization\'s needs and save the configuration.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editable-table-wrapper"]',
            content: 'This is the editable table where you can configure invoice fields. You can add, edit, delete, and reorder fields in this table.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="readonly-table-wrapper"]',
            content: 'This is the readonly table that shows the current invoice field configuration. You can view the fields but cannot edit them in this view.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-config-container"]',
            content: 'This is the main container for the invoice field configuration page. It contains all the elements needed to configure invoice fields.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="tenant-name-column"]',
            content: 'This column shows the tenant name for each field. This is only visible to super administrators who can manage configurations for multiple tenants.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="serial-number-column"]',
            content: 'This column shows the serial number of each field in the configuration table. The numbers indicate the order in which fields will appear during data entry.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="drag-column"]',
            content: 'This column contains drag handles that you can use to reorder fields in the configuration table. Drag the handle to move a field to a different position.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="delete-column"]',
            content: 'This column contains delete buttons for each field. Click the trash can icon to remove a field from the configuration.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="row-number-cell"]',
            content: 'This cell shows the row number for each field in the configuration table. The numbers indicate the order in which fields will appear during data entry.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editable-row-number-cell"]',
            content: 'This cell shows the row number for each field in the editable configuration table. The numbers indicate the order in which fields will appear during data entry.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="tenant-name-cell"]',
            content: 'This cell shows the tenant name for each field. This is only visible to super administrators who can manage configurations for multiple tenants.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="parent-column"]',
            content: 'For array-type fields, you can set a parent field to create hierarchical relationships between fields.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="display-name-column"]',
            content: 'The display name is how the field will appear in the user interface. By default, it matches the field name but can be customized.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="values-column"]',
            content: 'For dropdown, radio, or checkbox fields, you can define custom values that users can select from.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-previous"]',
            content: 'Click this button to go to the previous page of fields.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-next"]',
            content: 'Click this button to go to the next page of fields.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-current"]',
            content: 'This is the current page of fields. Click on other page numbers to navigate directly to that page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    parameters: [
        {
            selector: '[data-tour="parameters-header"]',
            content: 'Manage application parameters and settings. These settings control various aspects of the document processing system.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="add-param-button"]',
            content: 'Click here to add a new parameter to the system. Parameters control system behavior and limits.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="unique-key-field"]',
            content: 'Enter a unique key for this parameter. Keys identify parameters in the system and must be unique within your tenant. Fixed keys from default configurations are available in the dropdown.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="value-field"]',
            content: 'Enter the value for this parameter. Values can be text, numbers, or other data types depending on how the parameter is used in the system.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="description-field"]',
            content: 'Provide a description for this parameter to explain its purpose and usage. This helps other administrators understand what the parameter controls.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="group-field"]',
            content: 'Assign this parameter to a group for organizational purposes. Grouping helps categorize parameters and makes them easier to find and manage.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="metadata-field"]',
            content: 'Add metadata to this parameter. Metadata allows you to store additional key-value pairs with the parameter for more detailed configuration.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="parameters-table"]',
            content: 'This table shows all existing parameters. You can edit or delete them as needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="parameters-table-filters"]',
            content: 'Use these column filters to quickly search and filter parameters by name or value.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="parameters-table-sort"]',
            content: 'Click on column headers to sort parameters by that field in ascending or descending order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="parameters-table-edit"]',
            content: 'Click the edit icon to modify a parameter\'s value or properties.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="parameters-table-delete"]',
            content: 'Click the trash icon to delete a parameter from the system.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="parameters-table-pagination"]',
            content: 'Use pagination controls to navigate through multiple pages of parameters.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-previous"]',
            content: 'Click this button to go to the previous page of parameters.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-next"]',
            content: 'Click this button to go to the next page of parameters.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-current"]',
            content: 'This is the current page of parameters. Click on other page numbers to navigate directly to that page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    masters: [
        {
            selector: '[data-tour="masters-header"]',
            content: 'Manage master data files such as policy documents. These files provide reference information for the system.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="upload-master-button"]',
            content: 'Click here to upload a new master data file. Supported formats include PDF, DOCX, and other document types.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="master-key-field"]',
            content: 'Enter a unique key for this master file. Keys identify master files in the system and must be unique within your tenant. Fixed keys from default configurations are available in the dropdown.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="master-description-field"]',
            content: 'Provide a description for this master file to explain its purpose and contents. This helps other users understand what reference information the file contains.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="master-file-upload"]',
            content: 'Upload a file for this master record. The file type is restricted based on the key selected. For example, Policy files must be PDFs, while other master files are typically Excel spreadsheets.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="master-metadata-field"]',
            content: 'Add metadata to this master file. Metadata allows you to store additional information about the file such as version, author, or other relevant details.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="masters-table"]',
            content: 'This table shows all uploaded master files. You can update or delete them as needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="masters-table-filters"]',
            content: 'Use these column filters to quickly search and filter master files by name or type.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="masters-table-sort"]',
            content: 'Click on column headers to sort master files by that field in ascending or descending order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="masters-table-view"]',
            content: 'Click the eye icon to view a master file in full size.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="masters-table-edit"]',
            content: 'Click the edit icon to update a master file with a new version.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="masters-table-delete"]',
            content: 'Click the trash icon to delete a master file from the system.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="masters-table-pagination"]',
            content: 'Use pagination controls to navigate through multiple pages of master files.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-previous"]',
            content: 'Click this button to go to the previous page of master files.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-next"]',
            content: 'Click this button to go to the next page of master files.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-current"]',
            content: 'This is the current page of master files. Click on other page numbers to navigate directly to that page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    tenantRegistration: [
        // ── Page-level (always visible) ──────────────────────────────────────
        {
            selector: '[data-tour="tenant-reg-page-header"]',
            content: 'Welcome to the Tenant Management page. Super administrators can register and manage all organizations (tenants) in the system from here.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-reg-add-btn"]',
            content: 'Click "Add Tenant" to open the registration form and create a new tenant. Default parameters and master keys are provisioned automatically after registration.',
            roles: ['super_admin'],
            editableOnly: true
        },
        {
            selector: '[data-tour="tenant-registration-filter"]',
            content: 'One or more column filters are active. Click this button to clear all filters and restore the full tenant list.',
            roles: ['super_admin']
        },

        // ── Table structure ───────────────────────────────────────────────────
        {
            selector: '[data-tour="tenant-reg-table-card"]',
            content: 'This table lists all registered tenants. Each row shows the tenant ID, name, creation date, status, and action buttons. Rows are loaded directly from the server with server-side filtering and sorting.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-reg-col-sort"]',
            content: 'Click any column header to sort the table by that column. Click again to toggle between ascending and descending order. The active sort column is highlighted with a blue chevron.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-reg-col-filter"]',
            content: 'Type in a filter box below any column header to narrow the list. Press Enter or click the search icon to apply. Click × to clear an individual filter.',
            roles: ['super_admin']
        },

        // ── Row actions (visible only when the table has at least one row) ────
        {
            selector: '[data-tour="tenant-edit-action"]',
            content: 'Click the pencil icon to open the edit form for that tenant. You can update the name, admin details, and active status without recreating the tenant.',
            roles: ['super_admin'],
            editableOnly: true
        },
        {
            selector: '[data-tour="tenant-status-action"]',
            content: 'Click the power icon to toggle a tenant between Active and Inactive. Deactivating a tenant disables all of its non-super-admin users immediately.',
            roles: ['super_admin'],
            editableOnly: true
        },

        // ── Pagination bar ───────────────────────────────────────────────────
        {
            selector: '[data-tour="tenant-reg-rows-per-page"]',
            content: 'Choose how many tenant rows to display per page — 10, 25, 50, or 100. Changing this resets to page 1.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-reg-pagination-info"]',
            content: 'This shows the current range of rows being displayed and the total number of tenants matching your filters.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-reg-table-pagination"]',
            content: 'Use the page buttons to navigate through the tenant list. The current page is highlighted. Click ‹ or › to step one page back or forward.',
            roles: ['super_admin']
        },

        // ── Modal form (visible only when the modal is open) ─────────────────
        {
            selector: '[data-tour="tenant-reg-header"]',
            content: 'This form lets you register a new tenant or edit an existing one. All fields marked with * are required before you can submit.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-reg-close"]',
            content: 'Click × to close this form and discard any unsaved changes.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-name-field"]',
            content: 'Enter the organization\'s name. Only letters and spaces are allowed, up to 200 characters. The name must be unique across the system.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-admin-field"]',
            content: 'Enter the full name of the administrator who will manage this tenant. Only letters and spaces are allowed.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-reg-email"]',
            content: 'Enter the admin\'s email address. This is used as their login credential. The email must be unique across the system.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-reg-contact"]',
            content: 'Enter the admin\'s 10-digit Indian mobile number. It must start with 6, 7, 8, or 9.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-reg-password-section"]',
            content: 'Set a secure password for the new tenant admin. It must be at least 8 characters and include uppercase, lowercase, and a special character. The strength bar updates as you type.',
            roles: ['super_admin'],
            editableOnly: true
        },
        {
            selector: '[data-tour="tenant-reg-password-toggle"]',
            content: 'Toggle this to show or hide the password characters while you type.',
            roles: ['super_admin'],
            editableOnly: true
        },
        {
            selector: '[data-tour="tenant-reg-status-toggle"]',
            content: 'Use this toggle to activate or deactivate the tenant. Inactive tenants and all their users will be unable to log in.',
            roles: ['super_admin'],
            editableOnly: true
        },
        {
            selector: '[data-tour="tenant-reg-cancel"]',
            content: 'Click Cancel to discard all changes and close the form without saving.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="tenant-reg-submit"]',
            content: 'Click to save. For new tenants, default parameters and master keys are provisioned automatically so the tenant is immediately ready to use.',
            roles: ['super_admin'],
            editableOnly: true
        },
    ],

    reports: [
        {
            selector: '[data-tour="reports-header"]',
            content: 'Generate and view reports on documents and invoices. You can customize the data and export reports in various formats.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reports-card-total"]',
            content: 'This card shows the total number of invoices in the system.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reports-card-approved"]',
            content: 'This card shows the number of approved invoices and the percentage of total invoices.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reports-card-pending"]',
            content: 'This card shows the number of pending invoices awaiting review.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reports-card-rejected"]',
            content: 'This card shows the number of rejected invoices and the percentage of total invoices.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="report-filters"]',
            content: 'Use these filters to customize the data included in your report. You can filter by date range, status, document type, and more.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="filter-section"]',
            content: 'In the filter modal, you can set specific criteria for your report including date range, status, document type, and amount ranges.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="date-range-filter"]',
            content: 'Select a predefined date range or choose specific start and end dates for your report.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="status-filter"]',
            content: 'Filter documents by their current status such as Processed, Pending, or Rejected.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="user-filter"]',
            content: 'Filter reports by specific users if you want to see data for particular document submitters.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="apply-filters"]',
            content: 'Click Apply to generate the report with your selected filters.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="clear-filters"]',
            content: 'Click Clear to reset all filters and view all documents in the report.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="export-options"]',
            content: 'Click here to export your filtered report data. The export includes a CSV file with document data and a folder with all attached files.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="report-table"]',
            content: 'View detailed report data in this table. You can sort by clicking on column headers.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="report-table-sort"]',
            content: 'Click on column headers to sort the report data by that field in ascending or descending order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="table-rows-per-page-label"]',
            content: 'This label indicates the rows per page selector which allows you to change how many records are displayed at once.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="table-rows-per-page-select"]',
            content: 'Select how many rows to display per page. Options include 10, 25, 50, and 100 rows per page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="table-pagination-info"]',
            content: 'This text shows which records are currently displayed and the total number of records.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="report-pagination"]',
            content: 'Use pagination controls to navigate through multiple pages of report data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-previous"]',
            content: 'Click this button to go to the previous page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-next"]',
            content: 'Click this button to go to the next page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-current"]',
            content: 'This is the current page. Click on other page numbers to navigate directly to that page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Default Configuration page
    'default-config': [
        {
            selector: '[data-tour="default-config-header"]',
            content: 'This page allows super administrators to manage default configurations for parameters and masters. These configurations are used as default values across the system.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="config-type-select"]',
            content: 'Select the configuration type - either Parameter for system settings or Master for reference data files.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="config-type-dropdown-toggle"]',
            content: 'Click here to toggle the dropdown menu for configuration types.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="config-type-dropdown"]',
            content: 'This dropdown shows the available configuration types - Parameter and Master.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="config-key-input"]',
            content: 'Enter a unique key for this configuration. This key will be used to identify the configuration in the system.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="config-default-value-input"]',
            content: 'Enter the default value for this configuration. This value will be used when no specific value is provided.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="config-description-input"]',
            content: 'Provide a description for this configuration to help other administrators understand its purpose.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="config-metadata-field"]',
            content: 'Click here to add or edit metadata for this configuration. Metadata allows you to store additional key-value pairs with the configuration.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="add-config-button"]',
            content: 'Click here to add or update the configuration with the provided details.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="cancel-edit-button"]',
            content: 'Click here to cancel editing and clear the form.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="refresh-config-button"]',
            content: 'Click here to refresh the list of configurations from the database.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="advanced-filter-button"]',
            content: 'Click here to open advanced filters to search for specific configurations by type or key.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="default-config-table"]',
            content: 'This table shows all existing default configurations. You can edit or delete configurations from here.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="table-metadata-field"]',
            content: 'This column shows the number of metadata entries for each configuration. Click the link to view or edit the metadata.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="view-metadata-button"]',
            content: 'Click here to view the metadata entries for this configuration.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="edit-config-button"]',
            content: 'Click the edit icon to modify an existing configuration.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="delete-config-button"]',
            content: 'Click the delete icon to remove a configuration. You will be asked to confirm deletion.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="filter-type-select"]',
            content: 'Filter configurations by type - either Parameter or Master.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="filter-key-input"]',
            content: 'Filter configurations by key name.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="apply-filters-button"]',
            content: 'Apply the selected filters to narrow down the list of configurations.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="clear-filters-button"]',
            content: 'Clear all filters to show all configurations.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="confirm-delete-button"]',
            content: 'Confirm deletion of the selected configuration.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="cancel-delete-button"]',
            content: 'Cancel the deletion process and return to the configuration list.',
            roles: ['super_admin']
        }
    ],

    // Request View
    'requestView': [
        {
            selector: '[data-tour="request-view-header"]',
            content: 'This page shows detailed information about a specific request. You can view all associated documents and line items.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="request-view-tabs"]',
            content: 'Switch between different tabs to view request details, attached documents, and line items.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="request-view-details"]',
            content: 'This section shows the overall details of the request including requested amount, comments, and approval information.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="request-view-documents"]',
            content: 'View all documents attached to this request. You can preview documents and download them as needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="request-view-line-items"]',
            content: 'Line items associated with this request are shown here. You can review and manage individual line items.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="request-view-approve-button"]',
            content: 'Click here to approve the request if all details are correct.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="request-view-reject-button"]',
            content: 'Click here to reject the request if there are issues that need to be addressed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // View Invoice Detail Dialog
    'viewInvoiceDetail': [
        {
            selector: '[data-tour="invoice-detail-header"]',
            content: 'This dialog shows detailed information about a specific invoice. You can view all extracted data and associated details.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-detail-general-info"]',
            content: 'General information about the invoice is shown here including vendor details, dates, and amounts.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-detail-line-items"]',
            content: 'Line items from the invoice are displayed in this table. You can review individual line item details.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-detail-export-button"]',
            content: 'Click here to export the invoice details in PDF format.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="invoice-detail-close-button"]',
            content: 'Click here to close the dialog and return to the previous view.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Card Dialog
    'cardDialog': [
        {
            selector: '[data-tour="card-dialog-header"]',
            content: 'This is a compact dialog for editing text content. You can enter or modify information in the text area.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-dialog-textarea"]',
            content: 'Enter or modify your content in this text area. You can type multiple lines of text as needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-dialog-update-button"]',
            content: 'Click here to save your changes and update the content.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-dialog-cancel-button"]',
            content: 'Click here to cancel your changes and close the dialog without saving.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-dialog-syntax-error"]',
            content: 'If there are syntax errors in your content, they will be displayed here. Fix the errors before saving.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-dialog-templates"]',
            content: 'Click here to view and insert predefined templates for common validation rules.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Card Popup
    'cardPopup': [
        {
            selector: '[data-tour="card-popup-header"]',
            content: 'This popup allows you to view and edit content with different configuration options. You can switch between dropdown, master key, and history tabs.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-popup-tabs"]',
            content: 'Switch between different tabs to configure dropdown values, master key references, or history tracking.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-popup-dropdown-tab"]',
            content: 'In the dropdown tab, you can enter comma-separated values that will appear as dropdown options.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-popup-masterkey-tab"]',
            content: 'In the master key tab, you can select a master key to reference predefined values from master data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-popup-history-tab"]',
            content: 'In the history tab, you can specify a field name to track the history of changes to this field.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-popup-save-button"]',
            content: 'Click here to save your configuration changes.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="card-popup-cancel-button"]',
            content: 'Click here to cancel your changes and close the popup without saving.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Metadata Popup
    'metadata-popup': [
        {
            selector: '[data-tour="metadata-key-value-pair"]',
            content: 'This is a key-value pair in the metadata. You can edit the key and value fields.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="metadata-key-input"]',
            content: 'Enter the key for this metadata entry. Keys should be unique within this configuration.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="metadata-value-input"]',
            content: 'Enter the value for this metadata entry. Values can be any text or JSON data.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="remove-metadata-pair-button"]',
            content: 'Click here to remove this key-value pair from the metadata.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="add-metadata-pair-button"]',
            content: 'Click here to add a new key-value pair to the metadata.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="metadata-file-type-section"]',
            content: 'For Master configurations, you can specify the allowed file types here.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="file-type-pdf-button"]',
            content: 'Click here to restrict file uploads to PDF format only.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="file-type-xls-xlsx-csv-button"]',
            content: 'Click here to restrict file uploads to Excel formats (XLS, XLSX) or CSV files.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="clear-file-type-button"]',
            content: 'Click here to clear the file type restriction.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="save-metadata-button"]',
            content: 'Click here to save your metadata changes and close the popup.',
            roles: ['super_admin']
        }
    ],

    // Tenant Logo Management
    'tenantLogoManagement': [
        {
            selector: '[data-tour="tenant-logo-header"]',
            content: 'This page allows you to manage your organization\'s logo. Tenant administrators can upload and update their organization\'s logo, while super administrators can view all tenant logos.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="upload-section"]',
            content: 'Upload a new logo for your organization by dragging and dropping an image file here or by clicking the "Choose File" button. Supported formats are JPEG, JPG, PNG, and GIF with a maximum size of 5MB.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="choose-file-button"]',
            content: 'Click here to browse and select a logo file from your computer to upload.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="logo-preview"]',
            content: 'This preview shows the logo you\'ve selected for upload. You can update your existing logo or cancel the upload.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="update-logo-button"]',
            content: 'Click here to update your organization\'s logo with the selected image.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="upload-logo-button"]',
            content: 'Click here to upload the selected image as your organization\'s logo.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="cancel-upload-button"]',
            content: 'Click here to cancel the logo upload and remove the selected image.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="current-logo-section"]',
            content: 'This section displays your organization\'s current logo. You can view, download, or delete the current logo.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="current-logo-image"]',
            content: 'This is your organization\'s current logo. If no logo has been uploaded yet, a placeholder will be displayed.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="download-logo-button"]',
            content: 'Click here to download your organization\'s current logo.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="delete-logo-button"]',
            content: 'Click here to delete your organization\'s current logo. This action cannot be undone.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="no-logo-message"]',
            content: 'This message indicates that your organization does not currently have a logo uploaded. Upload a logo to display it here and in the navigation bar.',
            roles: ['account_user', 'account_manager', 'tenant_admin']
        },
        {
            selector: '[data-tour="tenant-logos-table"]',
            content: 'This table shows all tenant organizations and their logos. You can view any tenant\'s logo by clicking the "View" button.',
            roles: ['super_admin']
        },
        {
            selector: '[data-tour="view-logo-button"]',
            content: 'Click here to view a tenant\'s logo in a larger preview window.',
            roles: ['super_admin']
        }
    ],

    // Documents Queue
    'documentsQueue': [
        {
            selector: '[data-tour="documents-queue-header"]',
            content: 'This page shows all documents that have been uploaded and are awaiting processing. You can view document details and track their processing status.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="documents-queue-filter"]',
            content: 'Use these filters to narrow down the documents displayed in the queue. You can filter by date range, document type, or processing status.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="documents-table"]',
            content: 'This table displays all documents in the queue with their details including upload date, status, and actions available.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="documents-table-filters"]',
            content: 'Use these column filters to quickly search and filter documents by specific criteria like ID, date, status, or type.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="documents-table-sort"]',
            content: 'Click on column headers to sort documents by that field in ascending or descending order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="documents-table-view"]',
            content: 'Click the eye icon to view the document details and extracted information.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="documents-table-reprocess"]',
            content: 'Click the refresh icon to reprocess a document if there were issues during the initial processing.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="documents-table-delete"]',
            content: 'Click the trash icon to delete a document from the system. This action cannot be undone.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="documents-table-pagination"]',
            content: 'Use pagination controls to navigate through multiple pages of documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-previous"]',
            content: 'Click this button to go to the previous page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-next"]',
            content: 'Click this button to go to the next page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-current"]',
            content: 'This is the current page. Click on other page numbers to navigate directly to that page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Extraction Queue
    'extractionQueue': [
        {
            selector: '[data-tour="extraction-queue-header"]',
            content: 'This page shows documents that are currently being processed for data extraction. You can monitor the extraction progress and view extracted data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="extraction-queue-filter"]',
            content: 'Use these filters to narrow down the documents displayed in the queue. You can filter by date range, document type, or extraction status.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="extraction-table"]',
            content: 'This table displays all documents in the extraction queue with their details including upload date, extraction status, and actions available.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="extraction-table-filters"]',
            content: 'Use these column filters to quickly search and filter documents by specific criteria like ID, date, status, or type.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="extraction-table-sort"]',
            content: 'Click on column headers to sort documents by that field in ascending or descending order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="extraction-table-view"]',
            content: 'Click the eye icon to view the document and its extracted data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="extraction-table-reprocess"]',
            content: 'Click the refresh icon to restart the extraction process for a document if there were issues.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="extraction-table-delete"]',
            content: 'Click the trash icon to delete a document from the system. This action cannot be undone.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="extraction-table-pagination"]',
            content: 'Use pagination controls to navigate through multiple pages of documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-previous"]',
            content: 'Click this button to go to the previous page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-next"]',
            content: 'Click this button to go to the next page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-current"]',
            content: 'This is the current page. Click on other page numbers to navigate directly to that page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Final Queue
    'finalQueue': [
        {
            selector: '[data-tour="final-queue-header"]',
            content: 'This page shows documents that have completed processing and are ready for final review. You can view the final extracted data and take appropriate actions.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="final-queue-filter"]',
            content: 'Use these filters to narrow down the documents displayed in the queue. You can filter by date range, document type, or final status.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="final-table"]',
            content: 'This table displays all documents in the final queue with their details including upload date, final status, and actions available.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="final-table-filters"]',
            content: 'Use these column filters to quickly search and filter documents by specific criteria like ID, date, status, or type.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="final-table-sort"]',
            content: 'Click on column headers to sort documents by that field in ascending or descending order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="final-table-view"]',
            content: 'Click the eye icon to view the document and its final extracted data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="final-table-reprocess"]',
            content: 'Click the refresh icon to restart the entire processing workflow for a document if needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="final-table-delete"]',
            content: 'Click the trash icon to delete a document from the system. This action cannot be undone.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="final-table-pagination"]',
            content: 'Use pagination controls to navigate through multiple pages of documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-previous"]',
            content: 'Click this button to go to the previous page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-next"]',
            content: 'Click this button to go to the next page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-current"]',
            content: 'This is the current page. Click on other page numbers to navigate directly to that page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Reconciliation Queue
    'reconcileQueue': [
        {
            selector: '[data-tour="reconciliation-queue-header"]',
            content: 'This page shows documents that require reconciliation. You can match documents with their corresponding records and resolve any discrepancies.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-queue-filter"]',
            content: 'Use these filters to narrow down the documents displayed in the queue. You can filter by date range, document type, or reconciliation status.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table"]',
            content: 'This table displays all documents in the reconciliation queue with their details including upload date, reconciliation status, and actions available.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-filters"]',
            content: 'Use these column filters to quickly search and filter documents by specific criteria like ID, date, status, or type.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-sort"]',
            content: 'Click on column headers to sort documents by that field in ascending or descending order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-view"]',
            content: 'Click the eye icon to view the document and its reconciliation details.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-reprocess"]',
            content: 'Click the refresh icon to restart the reconciliation process for a document if needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-delete"]',
            content: 'Click the trash icon to delete a document from the system. This action cannot be undone.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-pagination"]',
            content: 'Use pagination controls to navigate through multiple pages of documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-previous"]',
            content: 'Click this button to go to the previous page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-next"]',
            content: 'Click this button to go to the next page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-current"]',
            content: 'This is the current page. Click on other page numbers to navigate directly to that page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Reconciliation View
    'reconciliationView': [
        {
            selector: '[data-tour="reconciliation-view-header"]',
            content: 'This page shows the details of a document that requires reconciliation. You can review the extracted data and match it with corresponding records.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-document-view"]',
            content: 'View the document image or PDF here to reference the original document while performing reconciliation.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-data-table"]',
            content: 'This table shows the extracted data from the document. You can review and edit the data as needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-match-section"]',
            content: 'Use this section to match the document with corresponding records in your system.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-comments"]',
            content: 'Add any comments about the reconciliation process or issues encountered.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-approve-button"]',
            content: 'Click here to approve the reconciliation if all data matches correctly.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-reject-button"]',
            content: 'Click here to reject the reconciliation if there are issues that need to be addressed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Reconciliation Queue
    'reconciliationQueue': [
        {
            selector: '[data-tour="reconciliation-queue-header"]',
            content: 'This page shows all documents that require reconciliation. You can view document details and perform reconciliation tasks.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-queue-filter"]',
            content: 'Use these filters to narrow down the documents displayed in the queue. You can filter by date range, document type, or reconciliation status.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table"]',
            content: 'This table displays all documents in the reconciliation queue with their details including upload date, reconciliation status, and actions available.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-filters"]',
            content: 'Use these column filters to quickly search and filter documents by specific criteria like ID, date, status, or type.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-sort"]',
            content: 'Click on column headers to sort documents by that field in ascending or descending order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-view"]',
            content: 'Click the eye icon to view the document and its reconciliation details.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-reprocess"]',
            content: 'Click the refresh icon to restart the reconciliation process for a document if needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-delete"]',
            content: 'Click the trash icon to delete a document from the system. This action cannot be undone.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="reconciliation-table-pagination"]',
            content: 'Use pagination controls to navigate through multiple pages of documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-previous"]',
            content: 'Click this button to go to the previous page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-next"]',
            content: 'Click this button to go to the next page of results.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="pagination-current"]',
            content: 'This is the current page. Click on other page numbers to navigate directly to that page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Upload Invoice
    'uploadInvoice': [
        {
            selector: '[data-tour="upload-invoice-header"]',
            content: 'This page allows you to upload invoices for processing. You can drag and drop files or browse your computer to select documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="upload-area"]',
            content: 'Drag and drop your invoices here or click to browse and select files. You can upload multiple documents at once.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="file-types"]',
            content: 'Supported file formats include PDF, JPG, PNG. Maximum file size is 10MB per document.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="uploaded-documents"]',
            content: 'Your uploaded documents will appear here. You can view or remove them before submitting for processing.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="upload-submit-button"]',
            content: 'Click here to submit your uploaded documents for processing.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="upload-cancel-button"]',
            content: 'Click here to cancel the upload and clear all selected documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Match Invoice
    'matchInvoice': [
        {
            selector: '[data-tour="match-invoice-header"]',
            content: 'This page allows you to match invoices with corresponding purchase orders or other documents.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="match-invoice-search"]',
            content: 'Use this search field to find purchase orders or other documents to match with the invoice.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="match-invoice-results"]',
            content: 'Search results will appear here. Select the appropriate document to match with the invoice.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="match-invoice-details"]',
            content: 'Review the details of both the invoice and the matching document to ensure they correspond correctly.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="match-invoice-confirm"]',
            content: 'Click here to confirm the match between the invoice and the selected document.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="match-invoice-cancel"]',
            content: 'Click here to cancel the matching process and return to the previous screen.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // Editor
    'editor': [
        {
            selector: '[data-tour="editor-header"]',
            content: 'This is the document editor where you can review and edit extracted data from uploaded documents. You can approve, reject, or send documents for reconciliation from here.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editor-back-button"]',
            content: 'Click here to go back to the previous page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editor-docu ment-view"]',
            content: 'View the original document here. You can navigate through pages and zoom in/out as needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editor-form-fields"]',
            content: 'These are the extracted fields from the document. You can review and edit the values as needed.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editor-line-items"]',
            content: 'Line items extracted from the document are shown here in a table format. You can review and edit individual line items.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editor-reject-button"]',
            content: 'Click here to reject the document. You will need to provide a reason for rejection.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editor-approve-button"]',
            content: 'Click here to approve the document. This will move the document to the next stage in the workflow.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editor-reconciliation-button"]',
            content: 'Click here to send the document for reconciliation. This is typically used when the document needs to be matched with other records.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editor-save-button"]',
            content: 'Click here to save any changes you have made to the document data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editor-master-key-popup"]',
            content: 'Click on fields with a key icon to open the Master Key popup. This allows you to select values from predefined lists or master data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="editor-history-popup"]',
            content: 'Click on fields with a clock icon to view the history of changes made to that field.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // PO Editor
    'poEditor': [
        {
            selector: '[data-tour="po-editor-header"]',
            content: 'This is the Purchase Order editor where you can match invoice data with purchase order information. You can review both the invoice and PO details side by side.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="po-editor-back-button"]',
            content: 'Click here to go back to the previous page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="po-editor-invoice-section"]',
            content: 'This section shows the invoice details that need to be reconciled with the purchase order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="po-editor-po-section"]',
            content: 'This section shows the purchase order details that you are matching against the invoice.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="po-editor-line-items"]',
            content: 'Line items from both the invoice and purchase order are shown here for comparison. You can review and match individual line items.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="po-editor-reject-button"]',
            content: 'Click here to reject the reconciliation. You will need to provide a reason for rejection.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="po-editor-approve-button"]',
            content: 'Click here to approve the reconciliation. This will complete the matching process between the invoice and purchase order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="po-editor-save-button"]',
            content: 'Click here to save any changes you have made to the reconciliation data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],

    // View Document Modal
    'viewDocumentModal': [
        {
            selector: '[data-tour="view-document-header"]',
            content: 'This modal shows the details of a document including the original file and extracted data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="view-document-file"]',
            content: 'View the original document file here. You can zoom in/out and navigate through pages.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="view-document-data"]',
            content: 'Review the extracted data from the document. This information was automatically captured during processing.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="view-document-actions"]',
            content: 'Use these actions to download the document, reprocess it, or close the modal.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
    ],
    
    // Intelligent Tour Demo
    'intelligentTourDemo': [
        {
            selector: '[data-tour="demo-header"]',
            content: 'Welcome to the Intelligent Tour Demo. This tour demonstrates how the enhanced tour functionality navigates elements in visual order.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-tabs"]',
            content: 'These tabs allow you to switch between different sections of the interface.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-tab1"]',
            content: 'The Overview tab shows summary information and statistics.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-tab2"]',
            content: 'The Details tab contains more comprehensive information, including tables with scrollable content.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-tab3"]',
            content: 'The Settings tab allows you to configure various options.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-overview-title"]',
            content: 'This is the title for the overview section.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-overview-description"]',
            content: 'This paragraph describes the content of the overview section.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-stats-grid"]',
            content: 'This grid displays key statistics in an easy-to-read format.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-stat1"]',
            content: 'This card shows the total number of items.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-stat2"]',
            content: 'This card shows the number of active items.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-stat3"]',
            content: 'This card shows the number of pending items.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-details-title"]',
            content: 'This is the title for the details section.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-details-description"]',
            content: 'This paragraph describes the content of the details section.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-table-container"]',
            content: 'This container holds a scrollable table with many rows of data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-table-header"]',
            content: 'The table header shows column titles for the data.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-table-id"]',
            content: 'This column shows the ID of each item.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-table-name"]',
            content: 'This column shows the name of each item.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-table-desc"]',
            content: 'This column shows the description of each item.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-table-status"]',
            content: 'This column shows the status of each item.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-table-value"]',
            content: 'This column shows the value of each item.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-table-body"]',
            content: 'The table body contains all the data rows.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-table-row-1"]',
            content: 'This is the first row in the table.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-item-id-1"]',
            content: 'This cell shows the ID of the first item.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-item-name-1"]',
            content: 'This cell shows the name of the first item.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-item-desc-1"]',
            content: 'This cell shows the description of the first item.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-item-status-1"]',
            content: 'This cell shows the status of the first item.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-item-value-1"]',
            content: 'This cell shows the value of the first item.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-settings-title"]',
            content: 'This is the title for the settings section.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-settings-column1"]',
            content: 'This column contains the first set of configuration options.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-setting1-label"]',
            content: 'This label describes the first setting.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-setting1-input"]',
            content: 'This input field allows you to enter a value for the first setting.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-setting2-label"]',
            content: 'This label describes the second setting.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-setting2-select"]',
            content: 'This dropdown allows you to select a value for the second setting.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-settings-column2"]',
            content: 'This column contains the second set of configuration options.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-setting3-label"]',
            content: 'This label describes the third setting.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-setting3-textarea"]',
            content: 'This text area allows you to enter a detailed description for the third setting.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-setting4-checkbox"]',
            content: 'This checkbox enables or disables a feature.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-setting4-label"]',
            content: 'This label describes what the checkbox controls.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-settings-actions"]',
            content: 'These buttons allow you to save or cancel your changes.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-cancel-button"]',
            content: 'Click this button to discard your changes and return to the previous state.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-save-button"]',
            content: 'Click this button to save your configuration changes.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-footer-actions"]',
            content: 'These buttons provide additional actions at the bottom of the interface.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-back-button"]',
            content: 'Click this button to navigate back to the previous page.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-warning-button"]',
            content: 'This warning button performs a cautionary action.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-danger-button"]',
            content: 'This danger button performs a destructive action.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        },
        {
            selector: '[data-tour="demo-success-button"]',
            content: 'This success button performs a positive action.',
            roles: ['account_user', 'account_manager', 'tenant_admin', 'super_admin']
        }
    ]
};

// Custom hook for tour management
export const useTourManager = () => {
    const { setIsOpen, setCurrentStep, setSteps } = useTour();
    const user = useSelector(state => state.auth.user);
    const userRole = user?.role;
    
    // Utility function to get scrollable parent
    const getScrollableParent = useCallback((element) => {
        if (!element) return null;
        
        let parent = element.parentElement;
        while (parent) {
            const style = window.getComputedStyle(parent);
            const overflowY = style.overflowY || style.overflow;
            const overflowX = style.overflowX || style.overflow;
            
            // Check if parent is scrollable vertically or horizontally
            const isScrollableY = /(auto|scroll)/.test(overflowY);
            const isScrollableX = /(auto|scroll)/.test(overflowX);
            
            if (isScrollableY || isScrollableX) {
                return parent;
            }
            
            parent = parent.parentElement;
        }
        
        // Return document body as fallback
        return document.body;
    }, []);
    
    // Helper function to get visual position of an element for sorting
    const getElementVisualPosition = useCallback((element) => {
        if (!element) return { top: Infinity, left: Infinity };
        
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        return {
            top: rect.top + scrollTop,
            left: rect.left + scrollLeft
        };
    }, []);
    
    // Function to ensure element is fully visible in all scrollable containers
    const ensureElementVisibleInContainers = useCallback((element) => {
        return new Promise((resolve) => {
            if (!element) {
                resolve();
                return;
            }
            
            // Get all scrollable parents
            const scrollableParents = [];
            let parent = element.parentElement;
            
            while (parent && parent !== document.body) {
                const style = window.getComputedStyle(parent);
                const overflowY = style.overflowY || style.overflow;
                const overflowX = style.overflowX || style.overflow;
                
                // Check if parent is scrollable
                const isScrollableY = /(auto|scroll)/.test(overflowY);
                const isScrollableX = /(auto|scroll)/.test(overflowX);
                
                if (isScrollableY || isScrollableX) {
                    scrollableParents.push({
                        element: parent,
                        isScrollableY,
                        isScrollableX
                    });
                }
                
                parent = parent.parentElement;
            }
            
            // Process each scrollable parent
            const promises = scrollableParents.map(({ element: container, isScrollableY, isScrollableX }) => {
                return new Promise((containerResolve) => {
                    const containerRect = container.getBoundingClientRect();
                    const elementRect = element.getBoundingClientRect();
                    
                    // Calculate element position relative to container
                    const elementRectInContainer = {
                        top: elementRect.top - containerRect.top + container.scrollTop,
                        left: elementRect.left - containerRect.left + container.scrollLeft,
                        bottom: elementRect.bottom - containerRect.top + container.scrollTop,
                        right: elementRect.right - containerRect.left + container.scrollLeft,
                        width: elementRect.width,
                        height: elementRect.height
                    };
                    
                    const scrollPromises = [];
                    
                    // Handle vertical scrolling with improved logic
                    if (isScrollableY) {
                        const padding = 40; // Increased padding for better visibility
                        
                        if (elementRectInContainer.top < container.scrollTop + padding) {
                            // Element is above visible area
                            scrollPromises.push(new Promise((scrollResolve) => {
                                container.scrollTo({
                                    top: Math.max(0, elementRectInContainer.top - padding),
                                    behavior: 'smooth'
                                });
                                setTimeout(scrollResolve, 700); // Increased timeout for smoother animation
                            }));
                        } else if (elementRectInContainer.bottom > container.scrollTop + containerRect.height - padding) {
                            // Element is below visible area
                            scrollPromises.push(new Promise((scrollResolve) => {
                                const maxScroll = container.scrollHeight - containerRect.height;
                                container.scrollTo({
                                    top: Math.min(maxScroll, elementRectInContainer.bottom - containerRect.height + padding),
                                    behavior: 'smooth'
                                });
                                setTimeout(scrollResolve, 700); // Increased timeout for smoother animation
                            }));
                        }
                    }
                    
                    // Handle horizontal scrolling with improved logic
                    if (isScrollableX) {
                        const padding = 40; // Increased padding for better visibility
                        
                        if (elementRectInContainer.left < container.scrollLeft + padding) {
                            // Element is to the left of visible area
                            scrollPromises.push(new Promise((scrollResolve) => {
                                container.scrollTo({
                                    left: Math.max(0, elementRectInContainer.left - padding),
                                    behavior: 'smooth'
                                });
                                setTimeout(scrollResolve, 700); // Increased timeout for smoother animation
                            }));
                        } else if (elementRectInContainer.right > container.scrollLeft + containerRect.width - padding) {
                            // Element is to the right of visible area
                            scrollPromises.push(new Promise((scrollResolve) => {
                                const maxScroll = container.scrollWidth - containerRect.width;
                                container.scrollTo({
                                    left: Math.min(maxScroll, elementRectInContainer.right - containerRect.width + padding),
                                    behavior: 'smooth'
                                });
                                setTimeout(scrollResolve, 700); // Increased timeout for smoother animation
                            }));
                        }
                    }
                    
                    // Wait for all scrolling in this container to complete
                    Promise.all(scrollPromises).then(() => {
                        containerResolve();
                    });
                });
            });
            
            // Wait for all containers to finish scrolling
            Promise.all(promises).then(() => {
                // Small delay to ensure all animations are complete
                setTimeout(resolve, 400);
            });
        });
    }, []);

    // Enhanced function to scroll element into view with both vertical and horizontal support
    const scrollToElement = useCallback(async (element, padding = 20) => {
        if (!element) return Promise.resolve();
        
        return new Promise((resolve) => {
            // First, ensure the element is visible by scrolling all parent containers
            ensureElementVisibleInContainers(element).then(() => {
                // Then scroll the window to bring the element into view
                const rect = element.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                const windowHeight = window.innerHeight;
                const windowWidth = window.innerWidth;
                
                // Calculate target position for vertical scrolling with improved logic
                let targetTop = null;
                let targetLeft = null;
                const effectivePadding = Math.max(padding, 50); // Ensure minimum padding for better visibility
                
                // Check if element is outside the viewport vertically
                if (rect.top < effectivePadding) {
                    // Element is above viewport
                    targetTop = Math.max(0, scrollTop + rect.top - effectivePadding);
                } else if (rect.bottom > windowHeight - effectivePadding) {
                    // Element is below viewport
                    targetTop = scrollTop + rect.bottom - windowHeight + effectivePadding;
                }
                
                // Check if element is outside the viewport horizontally
                if (rect.left < effectivePadding) {
                    // Element is to the left of viewport
                    targetLeft = Math.max(0, scrollLeft + rect.left - effectivePadding);
                } else if (rect.right > windowWidth - effectivePadding) {
                    // Element is to the right of viewport
                    targetLeft = scrollLeft + rect.right - windowWidth + effectivePadding;
                }
                
                // Perform scrolling with smooth behavior
                const scrollPromises = [];
                
                // Vertical scrolling
                if (targetTop !== null) {
                    scrollPromises.push(new Promise((verticalResolve) => {
                        window.scrollTo({
                            top: targetTop,
                            left: targetLeft !== null ? targetLeft : scrollLeft,
                            behavior: 'smooth'
                        });
                        setTimeout(verticalResolve, 600); // Increased timeout for smoother animation
                    }));
                }
                
                // Horizontal scrolling (if not already handled by vertical scroll)
                if (targetLeft !== null && targetTop === null) {
                    scrollPromises.push(new Promise((horizontalResolve) => {
                        window.scrollTo({
                            left: targetLeft,
                            top: scrollTop,
                            behavior: 'smooth'
                        });
                        setTimeout(horizontalResolve, 600); // Increased timeout for smoother animation
                    }));
                }
                
                if (scrollPromises.length > 0) {
                    // Wait for scroll to complete and then ensure element is centered
                    Promise.all(scrollPromises).then(() => {
                        setTimeout(() => {
                            // Do a final scroll to center the element
                            element.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'center',
                                inline: 'center'
                            });
                            
                            // Final resolution after a short delay to ensure everything is settled
                            setTimeout(resolve, 400);
                        }, 600);
                    });
                } else {
                    // If no scrolling needed, just ensure element is in view
                    element.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center',
                        inline: 'center'
                    });
                    
                    // Resolution after a short delay to ensure everything is settled
                    setTimeout(resolve, 400);
                }
            });
        });
    }, [ensureElementVisibleInContainers]);

    // Enhanced function to check if an element exists in the DOM with special handling for dynamic content
    const elementExists = useCallback((selector) => {
        // First try direct query
        let element = document.querySelector(selector);
        if (element) return true;
        
        // Try again after a small delay for dynamic content
        return false;
    }, []);

    // Enhanced function to automatically open tabs/popups for tour steps with special handling for InvoiceConfig
    const handleStepAction = useCallback((step) => {
        // Handle tab opening
        if (step.openTab) {
            const tabButton = document.querySelector(`[data-tour="${step.openTab}"]`);
            if (tabButton && !tabButton.classList.contains('active')) {
                tabButton.click();
                // Wait for tab transition to complete
                setTimeout(() => {}, 300);
            }
        }

        // Handle popup opening
        if (step.openPopup) {
            const popupTrigger = document.querySelector(`[data-tour="${step.openPopup}"]`);
            if (popupTrigger) {
                popupTrigger.click();
                // Wait for popup to open
                setTimeout(() => {}, 500);
            }
        }

        // Handle dropdown opening
        if (step.openDropdown) {
            const dropdownTrigger = document.querySelector(`[data-tour="${step.openDropdown}"]`);
            if (dropdownTrigger && !dropdownTrigger.getAttribute('aria-expanded')) {
                dropdownTrigger.click();
                // Wait for dropdown to open
                setTimeout(() => {}, 300);
            }
        }
        
        // Handle collapsible panel opening
        if (step.openCollapsible) {
            const collapsibleTrigger = document.querySelector(`[data-tour="${step.openCollapsible}"]`);
            if (collapsibleTrigger) {
                const isExpanded = collapsibleTrigger.getAttribute('aria-expanded') === 'true';
                if (!isExpanded) {
                    collapsibleTrigger.click();
                    // Wait for panel to expand
                    setTimeout(() => {}, 400);
                }
            }
        }

        // Scroll to element if needed with enhanced handling for dynamic content
        if (step.selector) {
            // Special handling for InvoiceConfig elements
            const isInvoiceConfigElement = step.selector.includes('invoice-config');
            
            // Try multiple times with a delay for dynamic content, more attempts for InvoiceConfig
            const maxAttempts = isInvoiceConfigElement ? 20 : 10; // Increased attempts
            const delay = isInvoiceConfigElement ? 300 : 800; // Increased delay
            
            const tryScroll = (attempts = maxAttempts) => {
                // Try to find all matching elements
                const elements = document.querySelectorAll(step.selector);
                if (elements.length > 0) {
                    // Find the first visible element
                    let element = null;
                    for (let el of elements) {
                        const style = window.getComputedStyle(el);
                        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                            const rect = el.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                // Additional check to ensure element is reasonably positioned
                                if (rect.left >= -1000 && rect.top >= -1000) {
                                    element = el;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (element) {
                        // Special handling for InvoiceConfig drag elements (they might be hidden)
                        if (isInvoiceConfigElement && step.selector.includes('drag')) {
                            // Make sure the parent row is visible
                            const row = element.closest('tr');
                            if (row) {
                                row.style.display = 'table-row';
                            }
                        }
                        
                        // Wait a bit for any UI transitions to complete before scrolling
                        setTimeout(() => {
                            // Ensure element is fully visible in scrollable containers before scrolling to it
                            ensureElementVisibleInContainers(element).then(() => {
                                // Use enhanced scrolling to ensure element is visible and in view
                                scrollToElement(element, 60).then(() => {
                                    // Ensure element is scrolled into view after our custom scrolling
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                                    // Additional timeout to ensure the scroll completes
                                    setTimeout(() => {
                                        // Final check to ensure element is in view
                                        const rect = element.getBoundingClientRect();
                                        const windowHeight = window.innerHeight;
                                        const windowWidth = window.innerWidth;
                                        
                                        // If element is still not properly in view, do one final scroll
                                        if (rect.top < 0 || rect.bottom > windowHeight || rect.left < 0 || rect.right > windowWidth) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                                        }
                                        
                                        // Add focus to the element for better accessibility
                                        if (element.tabIndex === -1) {
                                            element.setAttribute('tabindex', '-1');
                                        }
                                        element.focus({ preventScroll: true });
                                    }, 400);
                                });
                            });
                        }, 100);
                        
                        return; // Success, exit the function
                    }
                }
                
                if (attempts > 1) {
                    // Retry after a short delay
                    setTimeout(() => tryScroll(attempts - 1), delay);
                } else {
                    // Even if we couldn't scroll to the element, we still want to continue the tour
                    console.warn(`Could not scroll to element with selector: ${step.selector}`);
                }
            };
            tryScroll();
        }
    }, [scrollToElement, ensureElementVisibleInContainers]);

    // Enhanced function to check if an element is visible and rendered
    const isElementVisible = useCallback((selector) => {
        const elements = document.querySelectorAll(selector);
        if (!elements.length) return false;
        
        for (let element of elements) {
            // Check if element is in the DOM and not hidden
            if (!document.contains(element)) {
                continue;
            }
            
            // Check if element is visible
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                continue; // Check next element
            }
            
            // Check if element has dimensions
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                continue; // Check next element
            }
            
            // Additional check: element should be within reasonable bounds of the document
            // This helps avoid elements that are technically in the DOM but not practically visible
            const documentWidth = document.documentElement.scrollWidth;
            const documentHeight = document.documentElement.scrollHeight;
            
            if (rect.left > documentWidth || rect.top > documentHeight || rect.right < 0 || rect.bottom < 0) {
                continue; // Element is outside document bounds
            }
            
            // Additional check for elements that are visually hidden but still in layout
            // This can happen with elements that have position: fixed or absolute but are off-screen
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Consider element visible if it's within a reasonable range of the viewport
            // This allows for elements that might be slightly off-screen but still relevant
            const buffer = 100; // pixels buffer
            if (rect.left < -buffer || rect.top < -buffer || rect.left > viewportWidth + buffer || rect.top > viewportHeight + buffer) {
                continue; // Element is significantly off-screen
            }
            
            // Element exists and is rendered, which is sufficient for tour purposes
            // We'll scroll to it when needed, so we don't need to check viewport visibility here
            return true;
        }
        
        return false;
    }, []);

    // Filter steps based on user role and page state with enhanced filtering
    const filterSteps = useCallback((steps, userRole, isEditable = true) => {
        if (!steps || !userRole) return [];

        const filteredSteps = steps.filter(step => {
            // Check if step is for current user role
            if (step.roles && !step.roles.includes(userRole)) {
                return false;
            }

            // Check if step is only for editable mode and we're in read-only mode
            if (step.editableOnly && !isEditable) {
                return false;
            }

            // Check if element exists in DOM and is visible
            if (step.selector) {
                // Special handling for dashboard elements - be more strict about visibility
                if (step.selector.includes('data-tour="dashboard')) {
                    // For dashboard elements, check if they exist and are visible
                    const isVisible = isElementVisible(step.selector);
                    return isVisible;
                }
                // Special handling for invoiceConfig elements which are in a dynamic table
                else if (step.selector.includes('invoice-config')) {
                    // For invoiceConfig, check if elements actually exist and are visible
                    // This ensures only steps with visible elements are displayed
                    const isVisible = isElementVisible(step.selector);
                    return isVisible;
                } else if (step.selector.includes('reset-filters-button')) {
                    // Special handling for reset filters button which only appears when filters are applied
                    // Check if there are active filters by looking for filter tags
                    const filterTags = document.querySelectorAll('[data-tour="filter-section"] .bg-gray-200');
                    const isVisible = filterTags.length > 0 && isElementVisible(step.selector);
                    return isVisible;
                } else if (step.selector.includes('final-queue') || step.selector.includes('final-table')) {
                    // Special handling for FinalQueue elements - check if they are actually visible on screen
                    // This ensures only steps with visible elements are displayed
                    const isVisible = isElementVisible(step.selector);
                    return isVisible;
                } else {
                    // For all other elements, check if they exist in the DOM
                    // The tour will scroll to them when needed, so we don't need to check viewport visibility here
                    const elementExists = document.querySelector(step.selector) !== null;
                    return elementExists;
                }
            }

            return true;
        });

        return filteredSteps;
    }, [isElementVisible]);

    const startTour = useCallback((pageName, isEditable = true) => {
        const steps = TOUR_STEPS[pageName];
        
        if (steps && userRole) {
            // Filter steps based on user role and page state
            const filteredSteps = filterSteps(steps, userRole, isEditable);
            
            if (filteredSteps.length > 0) {
                // Sort steps based on their visual position (top to bottom, left to right)
                const sortedSteps = [...filteredSteps].sort((a, b) => {
                    // Try to find elements for both steps
                    const elementA = document.querySelector(a.selector);
                    const elementB = document.querySelector(b.selector);
                    
                    // If we can't find elements, keep original order
                    if (!elementA || !elementB) return 0;
                    
                    // Get visual positions
                    const posA = getElementVisualPosition(elementA);
                    const posB = getElementVisualPosition(elementB);
                    
                    // Primary sort by vertical position (top to bottom)
                    if (posA.top !== posB.top) {
                        return posA.top - posB.top;
                    }
                    
                    // Secondary sort by horizontal position (left to right)
                    return posA.left - posB.left;
                });
                
                // Add action handling to each step
                const stepsWithActions = sortedSteps.map(step => ({
                    ...step,
                    action: () => handleStepAction(step)
                }));
                
                setSteps(stepsWithActions);
                setCurrentStep(0);
                setIsOpen(true);
            }
        } else {
            if (!userRole) {
            }
            if (!steps) {
            }
        }
    }, [userRole, filterSteps, handleStepAction, setSteps, setCurrentStep, setIsOpen, getElementVisualPosition]);

    return { startTour };
};

// Floating Tour Button Component
export const TourButton = ({ pageName, className = "", variant = "floating", isEditable = true }) => {
  const { startTour } = useTourManager();

  const handleStartTour = () => {
    startTour(pageName, isEditable);
  };

  // Enhanced base styles for the floating button with modern design and animations
  const floatingBase = "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50 animate-bounce-slow";

  // Styles for inline variant: no background, no extra padding — icon in a circular border
  const inlineBase = "text-gray-700 hover:text-black border border-gray-200 rounded-full w-8 h-8 inline-flex items-center justify-center hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50";

  // Variant-specific placement styles with improved positioning
  const variantStyles = {
    floating: "fixed bottom-2 right-2 rounded-full p-2 z-[9999] animate-fade-in", // Increased z-index and improved positioning
    inline: ""
  };

  const appliedClasses = variant === 'inline'
    ? `${inlineBase} ${className}`
    : `${floatingBase} ${variantStyles.floating} ${className}`;

  const iconSize = variant === 'floating' ? 24 : (variant === 'inline' ? 16 : 20);

  return (
    <button
      onClick={handleStartTour}
      className={appliedClasses}
      title={`Start ${pageName} Tour`}
      aria-label={`Start ${pageName} Tour`}
      data-tour={`tour-button-${pageName}`}
    >
      <HelpCircle size={iconSize} className="animate-pulse-slow" />
    </button>
  );
};

// Tour Steps Manager Component (for adding new steps)
export const TourStepsManager = {
    // Get steps for a specific page
    getSteps: (pageName) => TOUR_STEPS[pageName] || [],

    // Add new steps for a page
    addSteps: (pageName, steps) => {
        TOUR_STEPS[pageName] = steps;
    },

    // Add a single step to existing page steps
    addStep: (pageName, step) => {
        if (!TOUR_STEPS[pageName]) {
            TOUR_STEPS[pageName] = [];
        }
        TOUR_STEPS[pageName].push(step);
    },

    // Get all available page names
    getAvailablePages: () => Object.keys(TOUR_STEPS),

    // Update specific step
    updateStep: (pageName, stepIndex, newStep) => {
        if (TOUR_STEPS[pageName] && TOUR_STEPS[pageName][stepIndex]) {
            TOUR_STEPS[pageName][stepIndex] = { ...TOUR_STEPS[pageName][stepIndex], ...newStep };
        }
    },
    
    // Get filtered steps for a specific page and user role
    getFilteredSteps: (pageName, userRole, isEditable = true) => {
        const steps = TOUR_STEPS[pageName] || [];
        return steps.filter(step => {
            // Check if step is for current user role
            if (step.roles && !step.roles.includes(userRole)) {
                return false;
            }
            
            // Check if step is only for editable mode and we're in read-only mode
            if (step.editableOnly && !isEditable) {
                return false;
            }
            
            return true;
        });
    }
};

export default TourStepsManager;

// Add custom animations to the document head for better performance
const addCustomStyles = () => {
  if (typeof document !== 'undefined') {
    const styleId = 'tour-custom-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.8;
          }
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s infinite;
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `;
      document.head.appendChild(style);
    }
  }
};

// Call the function to add styles
addCustomStyles();
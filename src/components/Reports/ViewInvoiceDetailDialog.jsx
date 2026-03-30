import React, { useState, useEffect } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { useSelector } from 'react-redux';
import jsPDF from 'jspdf';
import { apiBaseUrl } from '../../config/apiConfig';
import autoTable from 'jspdf-autotable';
import axios from '../../utils/authInterceptor'; // Import axios with interceptors

const ViewInvoiceDetailDialog = ({ invoiceId, tenant_id, openDialog, setOpenDialog }) => {
    const [error, setError] = useState(null);
    const [invoiceDetails, setInvoiceDetails] = useState(null);
    const [configDetails, setConfigDetails] = useState(null);
    const [lineItemConfig, setLineItemConfig] = useState(null);
    const [tenantDetails, setTenantDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    // Mock user and token - replace with your actual auth state management
    const user = useSelector(state => state.auth.user);
    const token = user?.token;

    const fetchTenantDetails = async (tenantId) => {
        if (!user || !token) return null;
        try {
            const response = await axios.get(`/api/v1/tables/ap_tenants?tenant_id=eq.${tenantId}&select=tenant_name`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (response.status === 200) {
                const data = response.data;
                if (data.length > 0) {
                    return data[0];
                }
            }
            return null;
        } catch (error) {
            // Error fetching tenant details
            return null;
        }
    };

    const fetchInvoiceConfig = async (tenantId) => {
        if (!user || !token) return null;
        try {
            const response = await axios.get(`/api/v1/tables/ap_field_config?tenant_id=eq.${tenantId}&select=*&order=sequence.asc`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (response.status === 200) {
                const data = response.data;
                // Fetched invoice config
                
                
                if (data.length > 0) {
                    return data;
                }
            }
            return null;
        } catch (error) {
            // Error fetching invoice config
            return null;
        }
    };

    // Line item config is part of the same field config with parent="Line Items"
    const getLineItemConfig = (fieldConfig) => {
        if (!fieldConfig) return [];
        // Filter fields where parent is "Line Items" and sort by sequence
        const lineItemFields = fieldConfig.filter(item => item.parent === "lineItems" || item.parent === "Line Items");
        // Line item fields
        return lineItemFields.sort((a, b) => {
            const seqA = a.sequence ?? 999999;
            const seqB = b.sequence ?? 999999;
            return seqA - seqB;
        });
    };

    const fetchInvoiceDetails = async (invoiceId, configData) => {
        if (!user || !token) return null;
        try {
            const response = await axios.get(`/api/v1/tables/ap_invoices?invoice_id=eq.${invoiceId}&select=*`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (response.status === 200) {
                const data = response.data;
                if (data.length > 0) {
                    let extractedData = {};
                    try {
                        extractedData = JSON.parse(data[0].extracted_data?.value || '{}');
                    } catch (e) {
                        // Failed to parse extracted_data.value
                        extractedData = {};
                    }

                    // Extracted data keys
                    
                    // Helper function to normalize field names for comparison
                    const normalizeFieldName = (name) => {
                        return name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    };
                    
                    // Helper function to convert Python/Java-style string to proper array
                    const convertPythonStyleToArray = (str) => {
                        try {
                            // Replace = with : and wrap keys in quotes
                            // Convert: [{hsn=123, rate=100}] to [{"hsn":"123", "rate":"100"}]
                            let jsonStr = str
                                .replace(/\[{/g, '[{')
                                .replace(/}\]/g, '}]')
                                .replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g, '"$1":')
                                .replace(/:\s*([^,}\]]+)/g, (match, value) => {
                                    // Check if value is already a number or boolean
                                    const trimmedValue = value.trim();
                                    if (!isNaN(trimmedValue) || trimmedValue === 'true' || trimmedValue === 'false') {
                                        return `: ${trimmedValue}`;
                                    }
                                    // Wrap in quotes if not already quoted
                                    if (!trimmedValue.startsWith('"')) {
                                        return `: "${trimmedValue}"`;
                                    }
                                    return match;
                                });
                            
                            const parsed = JSON.parse(jsonStr);
                            // Successfully converted Python-style string to array
                            return parsed;
                        } catch (e) {
                            // Failed to convert Python-style string
                            return null;
                        }
                    };
                    
                    configData.forEach(item => {
                        // First try exact match
                        if (extractedData && extractedData.hasOwnProperty(item.field_name)) {
                            let value = extractedData[item.field_name];
                            
                            // If it's an array field and the value is a Python-style string, convert it
                            if (item.field_type?.toLowerCase() === 'array' && typeof value === 'string' && value.startsWith('[{')) {
                                const converted = convertPythonStyleToArray(value);
                                if (converted) {
                                    value = converted;
                                }
                            }
                            
                            data[0][item.field_name] = value;
                        } else {
                            // Try to find a match with normalized names (case-insensitive, no spaces)
                            const normalizedConfigName = normalizeFieldName(item.field_name);
                            const matchingKey = Object.keys(extractedData).find(key => 
                                normalizeFieldName(key) === normalizedConfigName
                            );
                            
                            if (matchingKey) {
                                let value = extractedData[matchingKey];
                                
                                // If it's an array field and the value is a Python-style string, convert it
                                if (item.field_type?.toLowerCase() === 'array' && typeof value === 'string' && value.startsWith('[{')) {
                                    const converted = convertPythonStyleToArray(value);
                                    if (converted) {
                                        value = converted;
                                    }
                                }
                                
                                data[0][item.field_name] = value;
                                // Mapped field
                            } else {
                                data[0][item.field_name] = null;
                            }
                        }
                    });

                    // Processed invoice details keys
                    return data[0];
                }
            }
            return null;
        } catch (error) {
            // Error fetching invoice details
            return null;
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setError(null);
            setLoading(true);

            if (invoiceId && tenant_id) {
                try {
                    // Fetch tenant details first
                    const tenant = await fetchTenantDetails(tenant_id);
                    if (tenant) {
                        setTenantDetails(tenant);
                    }

                    // Fetch invoice field config
                    const config = await fetchInvoiceConfig(tenant_id);

                    if (!config) {
                        setError("Failed to fetch invoice config");
                    } else {
                        // Ensure config is sorted by sequence
                        const sortedConfig = [...config].sort((a, b) => {
                            const seqA = a.sequence ?? 999999;
                            const seqB = b.sequence ?? 999999;
                            return seqA - seqB;
                        });
                        setConfigDetails(sortedConfig);
                        
                        // Extract line item config from the same config data
                        const lineConfig = getLineItemConfig(sortedConfig);
                        setLineItemConfig(lineConfig);
                        
                        const details = await fetchInvoiceDetails(invoiceId, sortedConfig);
                        if (details) {
                            setInvoiceDetails(details);
                        } else {
                            setError("Failed to fetch invoice details");
                        }
                    }
                } catch (err) {
                    // Error fetching data
                    setError("Something went wrong while fetching data");
                }
            } else {
                setError("Missing invoiceId or tenant_id");
            }

            setLoading(false);
        };

        if (openDialog) {
            fetchData();
        }
    }, [invoiceId, tenant_id, openDialog]);

    const exportToPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 20;

        // Helper function to add a new page if needed
        const checkAndAddPage = (requiredSpace) => {
            if (yPosition + requiredSpace > pageHeight - 20) {
                doc.addPage();
                yPosition = 20; // Simple top margin for continuation pages
                return true;
            }
            return false;
        };

        // ========== HEADER - ONLY ON FIRST PAGE ==========
        // Professional header bar with tenant branding
        doc.setFillColor(79, 70, 229); // Indigo
        doc.rect(0, 0, pageWidth, 30, 'F');
        
        // Tenant Name - Large and professional
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        const tenantName = tenantDetails?.tenant_name || 'Organization Name';
        doc.text(tenantName, 15, 13);
        
        // Powered by line - subtle
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 200, 220);
        doc.text('Powered by ApEdge', 15, 20);

        // Document title - right side
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('INVOICE DETAILS', pageWidth - 15, 13, { align: 'right' });
        
        // Date - right side
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date().toLocaleDateString('en-IN'), pageWidth - 15, 19, { align: 'right' });

        yPosition = 35;

        // ========== COMPACT QUICK INFO SECTION ==========
        doc.setFillColor(245, 247, 250); // Very light gray
        doc.roundedRect(10, yPosition, pageWidth - 20, 28, 2, 2, 'F');

        const quickInfoY = yPosition + 7;
        const colWidth = (pageWidth - 30) / 4;

        // Quick info cards with compact design - dynamic color for status
        const statusValue = (invoiceDetails?.status || 'N/A').toUpperCase();
        const isRejected = invoiceDetails?.status?.toLowerCase() === 'rejected';
        const statusColor = isRejected ? [239, 68, 68] : [251, 146, 60]; // Red for rejected, orange for others
        
        const quickInfoData = [
            { label: 'INV NO', value: invoiceDetails?.invoice_no || 'N/A', color: [59, 130, 246] },
            { label: 'PO NO', value: invoiceDetails?.po_no || 'N/A', color: [34, 197, 94] },
            { label: 'VENDOR', value: invoiceDetails?.vendor_name || 'N/A', color: [168, 85, 247] },
            { label: 'STATUS', value: statusValue, color: statusColor }
        ];

        quickInfoData.forEach((info, idx) => {
            const xPos = 15 + (idx * colWidth);
            
            // Small colored indicator
            doc.setFillColor(...info.color);
            doc.circle(xPos, quickInfoY, 1.5, 'F');
            
            // Label
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80); // Darker for better visibility
            doc.text(info.label, xPos + 4, quickInfoY);
            
            // Value
            doc.setFontSize(9.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0); // Pure black for maximum contrast
            const valueText = doc.splitTextToSize(info.value, colWidth - 8);
            doc.text(valueText[0], xPos + 4, quickInfoY + 5.5);
        });

        yPosition += 33;

        // ========== INVOICE INFORMATION SECTION - COMPACT ==========
        checkAndAddPage(15);
        
        // Section Header - Compact
        doc.setFillColor(79, 70, 229);
        doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Invoice Information', 15, yPosition + 4.8);
        
        yPosition += 10;

        // Non-array fields in compact 2-column grid
        const nonArrayFields = configDetails.filter(item => item.field_type?.toLowerCase() !== 'array');
        const fieldsPerRow = 2;
        const fieldHeight = 14;
        const fieldWidth = (pageWidth - 30) / fieldsPerRow;
        const fieldGap = 3;

        nonArrayFields.forEach((item, index) => {
            if (index % fieldsPerRow === 0 && index !== 0) {
                yPosition += fieldHeight;
                checkAndAddPage(fieldHeight + 10);
            }

            const xPos = 15 + (index % fieldsPerRow) * fieldWidth;
            const value = invoiceDetails[item.field_name];
            
            // Draw background for each individual cell - alternate columns
            const isLeftColumn = index % fieldsPerRow === 0;
            const rowIndex = Math.floor(index / fieldsPerRow);
            
            // Alternate row coloring - full row background
            if (rowIndex % 2 === 1) {
                // Only draw once per row (on the first column)
                if (isLeftColumn) {
                    doc.setFillColor(249, 250, 251);
                    doc.rect(10, yPosition - 2, pageWidth - 20, fieldHeight - fieldGap, 'F');
                }
            }

            // Field Label - compact
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(90, 90, 90); // Darker gray for better visibility
            const label = item.field_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            doc.text(label, xPos, yPosition);

            // Field Value - compact
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0); // Pure black for maximum visibility

            let displayValue = '--';
            if (value !== null && value !== undefined && value !== '') {
                const type = item.field_type?.toLowerCase();
                if (type === 'number') {
                    const isCurrency = item.field_name?.toLowerCase().includes('amount') || 
                                     item.field_name?.toLowerCase().includes('total') ||
                                     item.field_name?.toLowerCase().includes('tax');
                    if (isCurrency) {
                        doc.setTextColor(0, 128, 0); // Darker green for currency
                        doc.setFont('helvetica', 'bold');
                        displayValue = 'Rs. ' + parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                    } else {
                        displayValue = parseFloat(value).toLocaleString('en-IN');
                    }
                } else {
                    displayValue = String(value);
                }
            }

            const wrappedValue = doc.splitTextToSize(displayValue, fieldWidth - 8);
            doc.text(wrappedValue[0], xPos, yPosition + 4.5);
        });

        yPosition += fieldHeight + 8;

        // ========== ARRAY/TABLE DATA SECTIONS - PROFESSIONAL ==========
        const arrayFields = configDetails.filter(item => item.field_type?.toLowerCase() === 'array');
        
        arrayFields.forEach((item, tableIndex) => {
            const value = invoiceDetails[item.field_name];
            
            if (Array.isArray(value) && value.length > 0) {
                checkAndAddPage(25);

                // Section Header
                doc.setFillColor(79, 70, 229);
                doc.rect(10, yPosition, pageWidth - 20, 7, 'F');
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(255, 255, 255);
                const sectionTitle = item.field_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                doc.text(sectionTitle, 15, yPosition + 4.8);
                
                yPosition += 10;

                // Prepare table data with sorted headers
                let headers = Object.keys(value[0]);
                
                // Sort headers according to line item config if available
                if (lineItemConfig && lineItemConfig.length > 0) {
                    headers = headers.sort((a, b) => {
                        const configA = lineItemConfig.find(c => c.field_name === a);
                        const configB = lineItemConfig.find(c => c.field_name === b);
                        const seqA = configA?.sequence ?? 999999;
                        const seqB = configB?.sequence ?? 999999;
                        return seqA - seqB;
                    });
                }
                
                const tableData = value.map(row => 
                    headers.map(header => {
                        const cellValue = row[header];
                        if (cellValue === null || cellValue === undefined || cellValue === '') {
                            return '—';
                        }
                        const isAmount = header.toLowerCase().includes('amount') || 
                                       header.toLowerCase().includes('rate') ||
                                       header.toLowerCase().includes('price') ||
                                       header.toLowerCase().includes('total');
                        if (isAmount && !isNaN(cellValue)) {
                            return 'Rs. ' + parseFloat(cellValue).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                        }
                        return String(cellValue);
                    })
                );

                // Determine table styling
                const hasManyColumns = headers.length > 6;
                const fontSize = hasManyColumns ? 7.5 : 8;
                const cellPadding = hasManyColumns ? 1.5 : 2;

                // Calculate column styles
                const columnStyles = {};
                headers.forEach((header, index) => {
                    const isAmount = header.toLowerCase().includes('amount') || 
                                   header.toLowerCase().includes('rate') ||
                                   header.toLowerCase().includes('price') ||
                                   header.toLowerCase().includes('total');
                    
                    if (isAmount) {
                        columnStyles[index] = { 
                            halign: 'right', 
                            textColor: [0, 128, 0], // Darker green for visibility
                            fontStyle: 'bold'
                        };
                    }
                });

                autoTable(doc, {
                    startY: yPosition,
                    head: [headers.map(h => h.replace(/([A-Z])/g, ' $1').trim().toUpperCase())],
                    body: tableData,
                    theme: 'striped',
                    headStyles: {
                        fillColor: [79, 70, 229],
                        textColor: [255, 255, 255],
                        fontSize: fontSize,
                        fontStyle: 'bold',
                        halign: 'center',
                        cellPadding: cellPadding,
                        lineWidth: 0.1,
                        lineColor: [200, 200, 200]
                    },
                    bodyStyles: {
                        fontSize: fontSize,
                        textColor: [0, 0, 0], // Pure black for better visibility
                        cellPadding: cellPadding,
                        lineWidth: 0.1,
                        lineColor: [220, 220, 220]
                    },
                    alternateRowStyles: {
                        fillColor: [249, 250, 251]
                    },
                    columnStyles: columnStyles,
                    margin: { left: 10, right: 10 },
                    tableWidth: 'auto',
                    styles: {
                        overflow: 'linebreak',
                        cellWidth: 'wrap',
                        fontSize: fontSize,
                        valign: 'middle'
                    },
                    didDrawPage: (data) => {
                        yPosition = data.cursor.y;
                    }
                });

                yPosition = doc.lastAutoTable.finalY + 8;
            }
        });

        // ========== PROFESSIONAL FOOTER ==========
        const totalPages = doc.internal.pages.length - 1;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            
            // Footer separator line
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
            
            // Footer text - compact
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 120, 120);
            const footerTenantName = tenantDetails?.tenant_name || 'Organization';
            doc.text(`© ${new Date().getFullYear()} ${footerTenantName}`, 15, pageHeight - 8);
            
            // Powered by - very subtle
            doc.setTextColor(150, 150, 150);
            doc.text('Powered by ApEdge', pageWidth / 2, pageHeight - 8, { align: 'center' });
            
            // Page numbers
            doc.setTextColor(120, 120, 120);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - 15, pageHeight - 8, { align: 'right' });
        }

        // Save the PDF
        const filename = `Invoice_${invoiceDetails?.invoice_no || 'Details'}_${new Date().getTime()}.pdf`;
        doc.save(filename);
    };

    const renderFieldValue = (item, value) => {
        // item, value
        
        const type = item.field_type ? item.field_type.toLowerCase() : 'text';

        if (value === null || value === undefined || value === '') {
            return <span className="text-gray-400 text-xs italic">--</span>;
        }

        // field value and type


        switch (type) {
            case "text":
                return <span className="text-gray-900 text-xs">{value}</span>;

            case "number":
                const isCurrency = item.field_name?.toLowerCase().includes('amount') || 
                                   item.field_name?.toLowerCase().includes('total') ||
                                   item.field_name?.toLowerCase().includes('tax') ||
                                   item.field_name?.toLowerCase().includes('value') ||
                                   item.field_name?.toLowerCase().includes('price');
                
                if (isCurrency) {
                    return (
                        <span className="text-green-700 font-bold text-xs">
                            ₹{parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    );
                }
                return <span className="text-gray-900 font-semibold text-xs">{parseFloat(value).toLocaleString('en-IN')}</span>;

            case "date":
                
                try {
                    return (
                        <span className="text-gray-900 font-medium bg-blue-50 px-2 py-1 rounded text-xs">
                            {value}
                        </span>
                    );
                } catch (e) {
                    return <span className="text-gray-900 font-medium text-xs">{value}</span>;
                }

            case "array":
                if (!Array.isArray(value) || value.length === 0) {
                    return (
                        <div className="text-center py-6 text-gray-500">
                            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-xs">No items available</p>
                        </div>
                    );
                }

                let headers = value[0] && typeof value[0] === 'object' ? Object.keys(value[0]) : [];
                
                // Sort headers according to line item config if available
                if (lineItemConfig && lineItemConfig.length > 0) {
                    headers = headers.sort((a, b) => {
                        const configA = lineItemConfig.find(c => c.field_name === a);
                        const configB = lineItemConfig.find(c => c.field_name === b);
                        const seqA = configA?.sequence ?? 999999;
                        const seqB = configB?.sequence ?? 999999;
                        return seqA - seqB;
                    });
                }

                return (
                    <div className="w-full">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {headers.map((header, idx) => (
                                            <th key={idx} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                {header.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {value.map((row, rowIdx) => (
                                        <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                           
                                            {headers.map((header, cellIdx) => {
                                                const cellValue = row[header];
                                                const isAmount = header.toLowerCase().includes('amount') || 
                                                               header.toLowerCase().includes('rate') ||
                                                               header.toLowerCase().includes('price') ||
                                                               header.toLowerCase().includes('total');
                                                
                                                return (
                                                    <td key={cellIdx} className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                                        {cellValue !== null && cellValue !== undefined && cellValue !== '' ? (
                                                            isAmount && !isNaN(cellValue) ? (
                                                                <span className="font-semibold text-green-700">
                                                                    ₹{parseFloat(cellValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-900">{cellValue}</span>
                                                            )
                                                        ) : (
                                                            <span className="text-gray-400 italic">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );

            default:
                return <span className="text-xs text-gray-900">{String(value)}</span>;
        }
    };

    if (!openDialog) {
        return null;
    }

    if (loading) {
        return (
            <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black bg-opacity-40 p-4">
                <div className="rounded-lg bg-white p-6 shadow-xl">
                    <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="text-xs font-medium text-gray-900">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black bg-opacity-40 p-4">
                <div className="rounded-lg bg-white p-6 shadow-xl max-w-sm">
                    <p className="text-xs font-medium text-red-600 mb-3">{error}</p>
                    <button
                        onClick={() => setOpenDialog(false)}
                        className="w-full rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        invoiceDetails && configDetails && (
            <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black bg-opacity-40 p-4">
                <div className="max-h-[90vh] w-full max-w-4xl flex flex-col overflow-hidden rounded-lg bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-300 bg-gray-50 px-5 py-3 flex-shrink-0">
                        <div className="flex items-center space-x-2">
                            <FileText className="w-5 h-5 text-gray-700" />
                            <h3 className="text-sm font-semibold text-gray-900">Invoice Details</h3>
                        </div>
                        <button
                            className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                            onClick={() => setOpenDialog(false)}
                        >
                            <X size={18} />
                        </button>
                    </div>
                    
                    {/* Quick Info Section */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4 flex-shrink-0">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-100">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice No</span>
                                </div>
                                <p className="mt-1 text-xs font-semibold text-gray-900 truncate">
                                    {invoiceDetails?.invoice_no || 'INV-2024-001'}
                                </p>
                            </div>
                            
                            <div className="bg-white rounded-lg p-3 shadow-sm border border-green-100">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">PO Number</span>
                                </div>
                                <p className="mt-1 text-xs font-semibold text-gray-900 truncate">
                                    {invoiceDetails?.po_no || 'PO-2024-001'}
                                </p>
                            </div>
                            
                            <div className="bg-white rounded-lg p-3 shadow-sm border border-purple-100">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vendor</span>
                                </div>
                                <p className="mt-1 text-xs font-semibold text-gray-900 truncate" title={invoiceDetails?.vendor_name || 'Acme Corporation Ltd'}>
                                    {invoiceDetails?.vendor_name || 'Acme Corporation Ltd'}
                                </p>
                            </div>
                            
                            <div className={`bg-white rounded-lg p-3 shadow-sm border ${
                                invoiceDetails?.status?.toLowerCase() === 'rejected' 
                                    ? 'border-red-200' 
                                    : 'border-orange-100'
                            }`}>
                                <div className="flex items-center space-x-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                        invoiceDetails?.status?.toLowerCase() === 'rejected' 
                                            ? 'bg-red-500' 
                                            : 'bg-orange-500'
                                    }`}></div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</span>
                                </div>
                                <div className="mt-1">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                                        invoiceDetails?.status?.toLowerCase() === 'rejected'
                                            ? 'bg-red-100 text-red-800 border-red-200'
                                            : invoiceDetails?.status?.toLowerCase() === 'approved'
                                            ? 'bg-green-100 text-green-800 border-green-200'
                                            : 'bg-orange-100 text-orange-800 border-orange-200'
                                    }`}>
                                        {invoiceDetails?.status || 'Approved'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="space-y-6">
                                {/* Basic Information Section */}
                                <div>
                                    <h4 className="text-base font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                                        Invoice Information
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2">
                                        {configDetails
                                            .filter(item => item.field_type?.toLowerCase() !== 'array')
                                            .map((item) => {
                                                const value = invoiceDetails[item.field_name];
                                                const renderedValue = renderFieldValue(item, value);

                                                return (
                                                    <div key={item.field_name} className=" p-1 border-b-[1px] border-gray-200">
                                                        <label className="block text-xs font-medium text-gray-400 mb-1">
                                                            {item.field_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                            {item.required && <span className="text-red-500 ml-1">*</span>}
                                                        </label>
                                                        <div className="text-gray-900 font-medium">
                                                            {renderedValue}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>

                                {/* Array/Table Data Section */}
                                {configDetails
                                    .filter(item => item.field_type?.toLowerCase() === 'array')
                                    .map((item) => {
                                        const value = invoiceDetails[item.field_name];
                                        
                                        // Array field config
                                        // Array field value
                                        // Is array
                                        
                                        const renderedValue = renderFieldValue(item, value);

                                        // Rendering array field
                                        

                                        return (
                                            <div key={item.field_name}>
                                                <h4 className="text-base font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                                                    {item.field_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                    {item.required && <span className="text-red-500 ml-1">*</span>}
                                                </h4>
                                                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                    {renderedValue}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-300 bg-gray-50 px-5 py-3 flex justify-end space-x-2 flex-shrink-0">
                        <button
                            onClick={() => setOpenDialog(false)}
                            className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={exportToPDF}
                            className="flex items-center gap-1 rounded bg-gradient-to-r from-indigo-600 to-indigo-700 px-3 py-1 text-xs font-medium text-white hover:from-indigo-700 hover:to-indigo-800 shadow-md hover:shadow transition-all"
                        >
                            <Download size={14} />
                            Export PDF
                        </button>
                    </div>
                </div>
            </div>
        )
    );
};

export default ViewInvoiceDetailDialog;
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from '../utils/authInterceptor'; // Adjust path as needed

/**
 * Custom hook to fetch and parse Vendor workflow configuration parameters.
 * @returns {Object} { workflowConfig, loading, error }
 */

const useVendorWorkflow = () => {
    const [workflowConfig, setWorkflowConfig] = useState(null);
    const [workflowConfigMissing, setWorkflowConfigMissing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Get user from Redux store
    const user = useSelector(state => state?.auth?.user);
    const token = user?.token;
    const tenantId = user?.tenantId;

    useEffect(() => {
        let isMounted = true;

        const fetchParameters = async () => {
            if (!token || !tenantId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const selectFields = 'unique_key,module_key,req_value,metadata';
                const filterParams = `tenant_id=eq.${tenantId}&select=${selectFields}&module_key=ilike.%Vendor%`;

                const response = await axios.get(
                    `/api/v1/tables/ap_parameters?${filterParams}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (!isMounted) return;
                console.log('Response Data:', response.data);

                const vendorWorkflowParam = response.data.find(
                    (param) => param.unique_key === 'vendor_workflow_json'
                );

                if (vendorWorkflowParam?.metadata) {
                    try {
                        const parsed = JSON.parse(vendorWorkflowParam.metadata);
                        console.log('Parsed Workflow Config:', parsed);
                        setWorkflowConfig(parsed);
                        setWorkflowConfigMissing(false);
                    } catch (parseError) {
                        console.error('Invalid JSON in Vendor_workflow_json:', parseError);
                        setError('Failed to parse workflow configuration.');
                        setWorkflowConfigMissing(true);
                    }
                } else {
                    // Key not found in the response — flag as missing
                    setWorkflowConfigMissing(true);
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Error fetching vendor parameters:', err);
                    setError(err.message || 'Error fetching parameters');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchParameters();

        return () => {
            isMounted = false;
        };
    }, [token, tenantId]);

    console.log('Workflow Config:', workflowConfig);

    return { workflowConfig, workflowConfigMissing, loading, error };
};

export default useVendorWorkflow;
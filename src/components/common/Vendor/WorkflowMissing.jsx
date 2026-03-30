import React from 'react'
import { Info } from 'lucide-react';
import { ToastContainer } from 'react-toastify';

const WorkflowMissing = ({ pageName }) => {
    return (
        <div className="p-6 bg-slate-50 min-h-[80vh] text-gray-800 m-6 rounded-xl border border-gray-200 shadow-xl relative flex flex-col items-center justify-center">
            <ToastContainer
                position="top-right"
                autoClose={2000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
            <div className="flex flex-col items-center gap-4 max-w-md text-center">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-yellow-100 border border-yellow-300">
                    <Info size={28} className="text-yellow-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Missing Workflow Configuration</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                    The vendor workflow configuration could not be found. Please contact your administrator to set up the workflow
                    configuration before using {pageName}.
                </p>
            </div>
        </div>
    );
}

export default WorkflowMissing
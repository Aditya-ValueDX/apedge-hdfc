import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';
import { X } from 'lucide-react';

const MasterKeyOptions = ({ 
  masterKeys, 
  selectedMasterKey,
  handleMasterKeyChange,
  loadingMasterKeys, 
  validationError
}) => {
  if (loadingMasterKeys) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading master keys...</span>
      </div>
    );
  }

  if (masterKeys.length === 0) {
    return (
      <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
        <p className="text-sm text-yellow-800">
          No master keys found for your tenant. Please create master keys in the Masters section first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Master Key
        </label>
        <SearchableSelect
          options={masterKeys}
          value={selectedMasterKey}
          onChange={handleMasterKeyChange}
          placeholder="Select a master key"
          isReadOnly={false}
          hasError={validationError && selectedMasterKey === ''}
          allowClear={true} // Enable clear functionality
        />
      </div>
      {selectedMasterKey && (
        <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
          <p className="text-sm text-blue-800">
            Selected master key: <span className="font-medium">{selectedMasterKey}</span>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            The dropdown will be populated with values from this master key.
          </p>
        </div>
      )}
    </div>
  );
};

export default MasterKeyOptions;
import React, { useState } from 'react';
import { ChevronDown, X, Check, AlertTriangle, Info, CircleChevronUp } from 'lucide-react';

const MessageDisplay = ({ errorDesc }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!errorDesc || typeof errorDesc !== 'object' || Object.keys(errorDesc).length === 0) {
    return null;
  }

  // Filter messages by type
  const successMessages = Object.keys(errorDesc).filter(key => 
    key.toLowerCase().startsWith('success')
  );
  
  const warningMessages = Object.keys(errorDesc).filter(key => 
    key.toLowerCase().startsWith('warning')
  );
  
  const noteMessages = Object.keys(errorDesc).filter(key => 
    key.toLowerCase().startsWith('note')
  );
  
  const errorMessages = Object.keys(errorDesc).filter(key => 
    !key.toLowerCase().startsWith('success') && 
    !key.toLowerCase().startsWith('warning') && 
    !key.toLowerCase().startsWith('note')
  );

  // Count total messages
  const totalMessages = successMessages.length + warningMessages.length + noteMessages.length + errorMessages.length;

  if (totalMessages === 0) {
    return null;
  }

  return (
    <div>
      <div className={`flex items-center justify-between p-2 bg-gray-100 ${isOpen ? 'rounded-t-md' : 'rounded-md'} cursor-pointer`} onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center space-x-1">
          <CircleChevronUp className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-0' : '-rotate-180'}`} />
          <span className="font-medium text-xs ml-1 text-gray-700">
            Messages 
            {/* ({totalMessages}) */}
          </span>
        </div>
        <div className="flex space-x-1">
          {errorMessages.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-800 rounded-full">
              {/* {errorMessages.length}  */}
              Error{errorMessages.length > 1 ? 's' : ''}
            </span>
          )}
          {successMessages.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-800 rounded-full">
              {/* {successMessages.length}  */}
              Success
            </span>
          )}
          {warningMessages.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded-full">
              {/* {warningMessages.length}  */}
              Warning{warningMessages.length > 1 ? 's' : ''}
            </span>
          )}
          {noteMessages.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-yellow-100 text-yellow-800 rounded-full">
              {/* {noteMessages.length}  */}
              Note{noteMessages.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      
      <div className={`${isOpen ? 'max-h-[1000px]' : 'max-h-0'} overflow-hidden transition-all duration-300 ease-in-out`}>
        <div className="border border-t-0 border-gray-200 rounded-b-md">
          {/* Error Messages */}
          {errorMessages.length > 0 && (
            <div className="border-b border-gray-200 pb-1 last:border-b-0">
              <div className="space-y-0.5 p-1">
                {errorMessages.map((key, index) => (
                  <div key={index} className="bg-red-50 border-l-2 border-red-400 px-1 py-0.5">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center"><X className="h-3 w-3 text-red-400" /></div>
                      </div>
                      <div className="ml-2">
                        <p className="text-xs text-red-700">
                          <span className="font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}:</span> {errorDesc[key]}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Messages */}
          {successMessages.length > 0 && (
            <div className="border-b border-gray-200 pb-1 last:border-b-0">            
              <div className="space-y-0.5 p-1">
                {successMessages.map((key, index) => (
                  <div key={index} className="bg-green-50 border-l-2 border-green-400 px-1 py-0.5">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center"><Check className="h-3 w-3 text-green-400" /></div>
                      </div>
                      <div className="ml-2">
                        <p className="text-xs text-green-700">
                          <span className="font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}:</span> {errorDesc[key]}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning Messages */}
          {warningMessages.length > 0 && (
            <div className="border-b border-gray-200 pb-1 last:border-b-0">
              <div className="space-y-0.5 p-1">
                {warningMessages.map((key, index) => (
                  <div key={index} className="bg-amber-50 border-l-2 border-amber-500 px-1 py-0.5">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className="h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle className="h-3 w-3 text-amber-500" /></div>
                      </div>
                      <div className="ml-2">
                        <p className="text-xs text-amber-700">
                          <span className="font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}:</span> {errorDesc[key]}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note Messages */}
          {noteMessages.length > 0 && (
            <div className="pb-1 last:border-b-0">
              <div className="space-y-0.5 p-1">
                {noteMessages.map((key, index) => (
                  <div key={index} className="bg-yellow-50 border-l-2 border-yellow-400 px-1 py-0.5">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className="h-5 w-5 rounded-full bg-yellow-100 flex items-center justify-center"><Info className="h-3 w-3 text-yellow-400" /></div>
                      </div>
                      <div className="ml-2">
                        <p className="text-xs text-yellow-700">
                          <span className="font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}:</span> {errorDesc[key]}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageDisplay;
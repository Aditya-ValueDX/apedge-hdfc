import React from "react";

const ErrorPopup = ({ error, onClose }) => {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black bg-opacity-70 px-4 transition-opacity duration-300 ease-out">
      <div
        className="relative w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center shadow-lg transition-transform duration-300 ease-out sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-xl font-bold text-gray-800">Error Details</h3>
        <p className="mb-2 text-sm text-gray-600">
          <b className="font-semibold text-gray-700">Message:</b> {error?.message}
        </p>
        <p className="mb-2 text-sm text-gray-600">
          <b className="font-semibold text-gray-700">Details:</b> {error?.details}
        </p>
        <p className="mb-4 text-sm text-gray-600">
          <b className="font-semibold text-gray-700">Time:</b> {new Date(error?.timestamp).toLocaleString()}
        </p>
        <button
          className="w-full rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-all duration-200 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ErrorPopup;

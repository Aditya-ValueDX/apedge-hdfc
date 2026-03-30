import React from 'react';
import { XCircle } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center bg-gradient-to-br from-slate-50 to-blue-100 font-poppins">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap');
        .font-poppins {
          font-family: 'Poppins', sans-serif;
        }
      `}</style>
      <div className="mb-5">
        <XCircle size={60} className="text-red-500" />
      </div>
      <h1 className="text-3xl text-slate-800 mb-2">404 - Page Not Found</h1>
      <p className="text-base text-gray-500">
        Sorry, the page you're looking for doesn't exist.
      </p>
    </div>
  );
};

export default NotFound;

import React from 'react';
import { Loader2 } from 'lucide-react';

const InProcess = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center bg-gradient-to-br from-slate-50 to-blue-100 font-poppins">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap');
        .font-poppins {
          font-family: 'Poppins', sans-serif;
        }
      `}</style>
      <div className="mb-5 animate-spin">
        <Loader2 size={60} className="text-blue-500" />
      </div>
      <h1 className="text-3xl text-slate-800 mb-2">This Page is Under Construction</h1>
      <p className="text-base text-gray-500">
        We’re working hard to get it ready. Check back soon!
      </p>
    </div>
  );
};

export default InProcess;

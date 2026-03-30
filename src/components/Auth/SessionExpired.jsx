import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearAuth } from '../../store/authSlice';

const SessionExpired = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const handleLogin = () => {
        dispatch(clearAuth());
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#286484] to-[#5367a6] flex flex-col items-center justify-center p-4 font-poppins relative overflow-hidden">

            {/* Decorative background orbs — same as Login page atmosphere */}
            <div className="absolute top-[-140px] right-[-120px] w-[420px] h-[420px] rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute bottom-[-100px] left-[-100px] w-[340px] h-[340px] rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute top-[30%] left-[-50px] w-[180px] h-[180px] rounded-full bg-[#4facfe]/5 pointer-events-none" />

            {/* Card */}
            <div className="relative w-full max-w-[420px] bg-white/95 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-sm">

                {/* Top gradient accent bar — matches Login button gradient */}
                <div className="h-1.5 w-full bg-gradient-to-r from-[#008DDA] to-[#4169E1]" />

                <div className="px-10 pt-10 pb-9 flex flex-col items-center text-center">

                    {/* Icon container */}
                    <div className="relative mb-7">
                        {/* Ping ring */}
                        <div className="absolute inset-0 rounded-full border-[1.5px] border-[#4facfe]/40 animate-ping" />
                        {/* Icon background */}
                        <div className="relative w-[84px] h-[84px] rounded-full bg-gradient-to-br from-sky-50 to-blue-100 border border-blue-200/70 flex items-center justify-center shadow-md shadow-blue-200/40">
                            {/* Clock SVG */}
                            <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                                <circle cx="21" cy="21" r="19" stroke="#4facfe" strokeWidth="2" fill="rgba(79,172,254,0.07)" />
                                <circle cx="21" cy="21" r="2.5" fill="#4169E1" />
                                {/* Hour hand */}
                                <line x1="21" y1="21" x2="21" y2="9" stroke="#4169E1" strokeWidth="2.5" strokeLinecap="round" />
                                {/* Minute hand */}
                                <line x1="21" y1="21" x2="30" y2="21" stroke="#4facfe" strokeWidth="2" strokeLinecap="round" />
                                {/* Tick marks */}
                                {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
                                    const a = (i * 30 - 90) * Math.PI / 180;
                                    const r1 = i % 3 === 0 ? 13.5 : 15.5;
                                    return <line key={i}
                                        x1={21 + r1 * Math.cos(a)} y1={21 + r1 * Math.sin(a)}
                                        x2={21 + 18 * Math.cos(a)} y2={21 + 18 * Math.sin(a)}
                                        stroke={i % 3 === 0 ? '#4169E1' : '#93c5fd'}
                                        strokeWidth={i % 3 === 0 ? 2 : 1} strokeLinecap="round"
                                    />;
                                })}
                            </svg>
                        </div>
                    </div>

                    {/* Status chip */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-5">
                        <span className="w-2 h-2 rounded-full bg-[#4facfe] shadow-[0_0_6px_#4facfe]" />
                        <span className="text-[10.5px] font-semibold text-[#4169E1] tracking-[0.1em] uppercase">Session Terminated</span>
                    </div>

                    {/* Heading */}
                    <h1 className="text-[26px] font-bold text-gray-800 leading-snug mb-1">
                        Your Session Has{' '}
                        <span className="bg-gradient-to-r from-[#008DDA] to-[#4169E1] bg-clip-text text-transparent">Expired</span>
                    </h1>

                    {/* Description */}
                    <p className="text-gray-500 text-sm leading-relaxed mt-3 mb-1.5">
                        You were inactive for too long, so we signed you out to keep your account secure.
                    </p>
                    <p className="text-gray-400 text-xs leading-relaxed mb-7">
                        Any unsaved changes may have been lost. Please log in again to continue.
                    </p>

                   

                    {/* CTA — same class as Login button */}
                    <button
                        onClick={handleLogin}
                        className="w-full bg-gradient-to-br from-[#008DDA] to-[#4169E1] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-400/30 flex items-center justify-center gap-2.5 border-none cursor-pointer text-[15px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-400/40 active:translate-y-0"
                    >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                            <polyline points="10 17 15 12 10 7" />
                            <line x1="15" y1="12" x2="3" y2="12" />
                        </svg>
                        Back to Login
                    </button>
                </div>
            </div>

            {/* Brand */}
            <p className="mt-6 text-xs text-white/40 text-center font-light pointer-events-none">
                © {new Date().getFullYear()} APEdge · AutomationEdge – ValueDX
            </p>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
                .font-poppins { font-family: 'Poppins', sans-serif; }
            `}</style>
        </div>
    );
};

export default SessionExpired;
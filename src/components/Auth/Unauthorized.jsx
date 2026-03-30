import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { clearAuth } from '../../store/authSlice';

const Unauthorized = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();

    const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
    const user = useSelector(state => state.auth.user);

    // The protected path the user was trying to reach (if passed via navigate state)
    const from = location.state?.from?.pathname;

    const handleGoLogin = () => {
        dispatch(clearAuth());
        navigate('/login');
    };

    const handleGoDashboard = () => {
        navigate('/dashboard');
    };

    // ── Contextual scenario detection ────────────────────────────────────────
    let scenario;
    if (!isAuthenticated || !user) {
        scenario = 'unauthenticated';   // No token / not logged in
    } else if (!user.role) {
        scenario = 'no_role';           // Logged in but no role assigned
    } else {
        scenario = 'forbidden';         // Logged in but insufficient permissions
    }

    const content = {
        unauthenticated: {
            code: '401',
            badge: 'Unauthorized',
            badgeColor: 'text-[#4169E1] bg-blue-50 border-blue-200',
            dotColor: 'bg-[#4facfe] shadow-[0_0_6px_#4facfe]',
            headline: 'You Are Not Signed In',
            accentText: 'Signed In',
            description: from
                ? `You need to be logged in to access "${from}".`
                : 'This page requires authentication. You are not currently signed in.',
            detail: 'Please log in with your credentials to access the application.',
            iconType: 'key',
            primaryLabel: 'Go to Login',
            primaryAction: handleGoLogin,
            showSecondary: false,
        },
        no_role: {
            code: '403',
            badge: 'Account Not Configured',
            badgeColor: 'text-[#4169E1] bg-blue-50 border-blue-200',
            dotColor: 'bg-[#4facfe] shadow-[0_0_6px_#4facfe]',
            headline: 'Account Not Configured',
            accentText: 'Configured',
            description: 'Your account exists but has no role assigned to it yet.',
            detail: 'Please contact your administrator to have the appropriate access role assigned before you can use the application.',
            iconType: 'shield',
            primaryLabel: 'Back to Login',
            primaryAction: handleGoLogin,
            showSecondary: false,
        },
        forbidden: {
            code: '403',
            badge: 'Access Denied',
            badgeColor: 'text-[#4169E1] bg-blue-50 border-blue-200',
            dotColor: 'bg-[#4facfe] shadow-[0_0_6px_#4facfe]',
            headline: 'Access Denied',
            accentText: 'Denied',
            description: from
                ? `Your role (${user?.role?.replace(/_/g, ' ')}) does not have permission to view "${from}".`
                : `Your role (${user?.role?.replace(/_/g, ' ')}) does not have permission to view this page.`,
            detail: 'This resource is restricted to users with a higher privilege level. Contact your administrator if you need access.',
            iconType: 'lock',
            primaryLabel: 'Go to Dashboard',
            primaryAction: handleGoDashboard,
            showSecondary: true,
            secondaryLabel: 'Log in as a different user',
            secondaryAction: handleGoLogin,
        },
    }[scenario];

    const iconMap = {
        key: (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4facfe" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="M21 2l-9.6 9.6" />
                <path d="M15.5 7.5l2 2L19 8l-2-2" />
            </svg>
        ),
        lock: (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4facfe" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <circle cx="12" cy="16" r="1" fill="#4facfe" />
            </svg>
        ),
        shield: (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4facfe" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        ),
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#286484] to-[#5367a6] flex flex-col items-center justify-center p-4 font-poppins relative overflow-hidden">

            {/* Decorative background orbs */}
            <div className="absolute top-[-140px] right-[-120px] w-[420px] h-[420px] rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute bottom-[-100px] left-[-100px] w-[340px] h-[340px] rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute top-[30%] right-[-50px] w-[180px] h-[180px] rounded-full bg-[#4facfe]/5 pointer-events-none" />

            {/* Card */}
            <div className="relative w-full max-w-[440px] bg-white/95 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-sm">

                {/* Top gradient bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-[#008DDA] to-[#4169E1]" />

                {/* Ghost error code watermark */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[130px] font-black text-[#4169E1]/[0.04] select-none pointer-events-none leading-none" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {content.code}
                </div>

                <div className="px-10 pt-10 pb-9 flex flex-col items-center text-center relative">

                    {/* Icon */}
                    <div className="relative mb-7">
                        <div className="absolute inset-0 rounded-full border-[1.5px] border-[#4facfe]/40 animate-ping" />
                        <div className="relative w-[84px] h-[84px] rounded-full bg-gradient-to-br from-sky-50 to-blue-100 border border-blue-200/70 flex items-center justify-center shadow-md shadow-blue-200/40">
                            {iconMap[content.iconType]}
                        </div>
                    </div>

                    {/* Status chip */}
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10.5px] font-semibold tracking-[0.1em] uppercase mb-5 ${content.badgeColor}`}>
                        <span className={`w-2 h-2 rounded-full inline-block ${content.dotColor}`} />
                        {content.code} · {content.badge}
                    </div>

                    {/* Headline */}
                    <h1 className="text-[26px] font-bold text-gray-800 leading-snug mb-1">
                        {content.headline.split(' ').map((word, i, arr) =>
                            word === content.accentText
                                ? <span key={i} className="bg-gradient-to-r from-[#008DDA] to-[#4169E1] bg-clip-text text-transparent">{word}{i < arr.length - 1 ? ' ' : ''}</span>
                                : <span key={i}>{word}{i < arr.length - 1 ? ' ' : ''}</span>
                        )}
                    </h1>

                    {/* Description */}
                    <p className="text-gray-500 text-sm leading-relaxed mt-3 mb-2">
                        {content.description}
                    </p>

                    {/* Detail info box */}
                    <div className="w-full bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-3 items-start text-left mb-7 mt-1">
                        <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4facfe" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="text-xs text-gray-500 leading-relaxed">{content.detail}</span>
                    </div>

                    {/* Primary CTA — same class as Login button */}
                    <button
                        onClick={content.primaryAction}
                        className="w-full bg-gradient-to-br from-[#008DDA] to-[#4169E1] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-400/30 flex items-center justify-center gap-2.5 border-none cursor-pointer text-[15px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-400/40 active:translate-y-0"
                    >
                        {scenario === 'forbidden' ? (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                        ) : (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                <polyline points="10 17 15 12 10 7" />
                                <line x1="15" y1="12" x2="3" y2="12" />
                            </svg>
                        )}
                        {content.primaryLabel}
                    </button>

                    {/* Secondary action */}
                    {content.showSecondary && (
                        <button
                            onClick={content.secondaryAction}
                            className="w-full mt-3 py-3.5 px-4 rounded-xl border-2 border-gray-200 text-gray-500 font-medium text-[14px] flex items-center justify-center gap-2.5 cursor-pointer bg-transparent transition-all duration-200 hover:border-[#4facfe] hover:text-[#4169E1] hover:bg-blue-50/60 active:scale-[0.99]"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 16l4-4-4-4M3 12h18" />
                            </svg>
                            {content.secondaryLabel}
                        </button>
                    )}
                </div>
            </div>

            {/* Brand */}
            <p className="mt-6 text-xs text-white/40 text-center font-light pointer-events-none">
                © {new Date().getFullYear()} APEdge · AutomationEdge – ValueDX
            </p>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;900&display=swap');
                .font-poppins { font-family: 'Poppins', sans-serif; }
            `}</style>
        </div>
    );
};

export default Unauthorized;
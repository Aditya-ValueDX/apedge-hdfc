import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { clearAuth } from '../../store/authSlice';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;900&display=swap');

  @keyframes ua-fade    { from{ opacity:0; }                                  to{ opacity:1; }                         }
  @keyframes ua-rise    { from{ opacity:0; transform:translateY(14px); }      to{ opacity:1; transform:translateY(0); } }
  @keyframes ua-drop    { from{ opacity:0; transform:translateY(-10px); }     to{ opacity:1; transform:translateY(0); } }
  @keyframes ua-pop     { 0%{ opacity:0; transform:scale(.88) translateY(8px); } 65%{ transform:scale(1.03); } 100%{ opacity:1; transform:scale(1); } }
  @keyframes ua-float   { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-9px); } }
  @keyframes ua-ping    { 0%{ transform:scale(1); opacity:.7; } 100%{ transform:scale(1.6); opacity:0; } }
  @keyframes ua-bar-in  { from{ transform:scaleX(0); opacity:0; } to{ transform:scaleX(1); opacity:1; } }
  @keyframes ua-twinkle { 0%,100%{ opacity:.1; transform:scale(1); } 50%{ opacity:.5; transform:scale(1.5); } }
  @keyframes ua-shimmer { from{ transform:translateX(-100%); } to{ transform:translateX(200%); } }
  @keyframes ua-code-in { from{ opacity:0; transform:scale(.95); } to{ opacity:1; transform:scale(1); } }

  .ua-page   { animation:ua-fade .3s ease both; font-family:'Poppins',sans-serif; }
  .ua-card   { animation:ua-pop  .55s cubic-bezier(.34,1.3,.64,1) .1s both; }
  .ua-bar    { animation:ua-bar-in .6s cubic-bezier(.25,.46,.45,.94) .15s both; transform-origin:left; }
  .ua-icon   { animation:ua-pop  .5s cubic-bezier(.34,1.4,.64,1) .3s both; }
  .ua-badge  { animation:ua-rise .4s cubic-bezier(.25,.46,.45,.94) .45s both; }
  .ua-h1     { animation:ua-rise .4s cubic-bezier(.25,.46,.45,.94) .52s both; }
  .ua-desc   { animation:ua-rise .4s cubic-bezier(.25,.46,.45,.94) .6s  both; }
  .ua-detail { animation:ua-rise .4s cubic-bezier(.25,.46,.45,.94) .67s both; }
  .ua-btn1   { animation:ua-pop  .45s cubic-bezier(.34,1.3,.64,1)  .75s both; }
  .ua-btn2   { animation:ua-rise .35s cubic-bezier(.25,.46,.45,.94) .83s both; }
  .ua-brand  { animation:ua-fade .4s ease 1s both; }
  .ua-code   { animation:ua-code-in .5s ease .2s both; }

  .ua-ping   { animation:ua-ping 1.6s ease-out infinite; }
  .ua-float  { animation:ua-float 7s ease-in-out infinite; }
  .ua-p1     { animation:ua-twinkle 3.8s ease-in-out .3s  infinite; }
  .ua-p2     { animation:ua-twinkle 4.4s ease-in-out 1.1s infinite; }
  .ua-p3     { animation:ua-twinkle 5.2s ease-in-out .7s  infinite; }
  .ua-p4     { animation:ua-twinkle 4.0s ease-in-out 2.0s infinite; }

  /* Primary red button — matches Login */
  .ua-btn-primary {
    position:relative; overflow:hidden;
    background:linear-gradient(135deg,#c0392b 0%,#e74c3c 100%);
    box-shadow:0 4px 20px rgba(192,57,43,0.4);
    transition:transform .2s ease, box-shadow .2s ease;
  }
  .ua-btn-primary::after {
    content:''; position:absolute; inset:0;
    background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.18) 50%,transparent 65%);
    transform:translateX(-100%); transition:transform .5s ease;
  }
  .ua-btn-primary:hover::after { transform:translateX(200%); }
  .ua-btn-primary:hover  { transform:translateY(-2px); box-shadow:0 8px 28px rgba(192,57,43,0.45); }
  .ua-btn-primary:active { transform:translateY(0);  box-shadow:0 2px 10px rgba(192,57,43,0.3); }

  /* Secondary outline button */
  .ua-btn-secondary {
    transition:all .2s ease;
    background:transparent;
    border:2px solid #e5e7eb;
    color:#6b7280;
  }
  .ua-btn-secondary:hover {
    border-color:rgba(192,57,43,0.4);
    color:#c0392b;
    background:rgba(192,57,43,0.04);
    transform:translateY(-1px);
  }
  .ua-btn-secondary:active { transform:scale(.98); }
`;

const Unauthorized = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();

    const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
    const user = useSelector(state => state.auth.user);

    const from = location.state?.from?.pathname;

    const handleGoLogin = () => { dispatch(clearAuth()); navigate('/login'); };
    const handleGoDashboard = () => navigate('/dashboard');

    let scenario;
    if (!isAuthenticated || !user) scenario = 'unauthenticated';
    else if (!user.role) scenario = 'no_role';
    else scenario = 'forbidden';

    const content = {
        unauthenticated: {
            code: '401',
            badge: 'Unauthorized',
            headline: 'You Are Not Signed In',
            accentWord: 'Signed',
            description: from ? `You need to be logged in to access "${from}".` : 'This page requires authentication. You are not currently signed in.',
            detail: 'Please log in with your credentials to access the application.',
            iconType: 'key',
            primaryLabel: 'Go to Login',
            primaryAction: handleGoLogin,
            showSecondary: false,
        },
        no_role: {
            code: '403',
            badge: 'Account Not Configured',
            headline: 'Account Not Configured',
            accentWord: 'Configured',
            description: 'Your account exists but has no role assigned to it yet.',
            detail: 'Please contact your administrator to have the appropriate access role assigned.',
            iconType: 'shield',
            primaryLabel: 'Back to Login',
            primaryAction: handleGoLogin,
            showSecondary: false,
        },
        forbidden: {
            code: '403',
            badge: 'Access Denied',
            headline: 'Access Denied',
            accentWord: 'Denied',
            description: from
                ? `Your role (${user?.role?.replace(/_/g, ' ')}) does not have permission to view "${from}".`
                : `Your role (${user?.role?.replace(/_/g, ' ')}) does not have permission to view this page.`,
            detail: 'This resource is restricted. Contact your administrator if you need access.',
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
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="M21 2l-9.6 9.6" />
                <path d="M15.5 7.5l2 2L19 8l-2-2" />
            </svg>
        ),
        lock: (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <circle cx="12" cy="16" r="1" fill="#e74c3c" />
            </svg>
        ),
        shield: (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        ),
    };

    const headlineWords = content.headline.split(' ');

    return (
        <>
            <style>{STYLES}</style>

            <div
                className="ua-page min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1a2c3d 0%, #2c3e50 60%, #1a3a5c 100%)' }}
            >
                {/* Orbs */}
                <div style={{ position:'absolute', top:-140, right:-120, width:420, height:420, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', bottom:-100, left:-100, width:340, height:340, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', top:'30%', right:-50, width:180, height:180, borderRadius:'50%', background:'rgba(192,57,43,0.06)', pointerEvents:'none' }} />

                {/* Particles */}
                <div className="ua-p1 absolute w-2   h-2   rounded-full" style={{ background:'rgba(192,57,43,0.5)', top:'14%', left:'18%' }} />
                <div className="ua-p2 absolute w-1.5 h-1.5 rounded-full" style={{ background:'rgba(255,255,255,0.2)', top:'22%', right:'14%' }} />
                <div className="ua-p3 absolute w-1   h-1   rounded-full" style={{ background:'rgba(255,255,255,0.3)', top:'68%', left:'12%' }} />
                <div className="ua-p4 absolute w-2   h-2   rounded-full" style={{ background:'rgba(192,57,43,0.3)', bottom:'22%', right:'16%' }} />

                {/* Card */}
                <div
                    className="ua-card relative w-full max-w-[440px] rounded-3xl shadow-2xl overflow-hidden backdrop-blur-sm"
                    style={{ background: 'rgba(255,255,255,0.97)' }}
                >
                    {/* Top red bar */}
                    <div
                        className="ua-bar h-[3px] w-full"
                        style={{ background: 'linear-gradient(90deg,#c0392b,#e74c3c)', transformOrigin: 'left center' }}
                    />

                    {/* Ghost error code watermark */}
                    <div
                        className="ua-code absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none leading-none font-black"
                        style={{
                            fontSize: 130,
                            color: 'rgba(192,57,43,0.04)',
                            fontFamily: 'Poppins, sans-serif',
                        }}
                    >
                        {content.code}
                    </div>

                    <div className="px-10 pt-10 pb-9 flex flex-col items-center text-center relative">

                        {/* Icon */}
                        <div className="ua-icon relative mb-7">
                            <div
                                className="ua-ping absolute inset-0 rounded-full"
                                style={{ border: '1.5px solid rgba(192,57,43,0.3)' }}
                            />
                            <div
                                className="relative w-[84px] h-[84px] rounded-full flex items-center justify-center shadow-lg"
                                style={{
                                    background: 'linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%)',
                                    border: '1px solid rgba(252,165,165,0.5)',
                                    boxShadow: '0 8px 24px rgba(192,57,43,0.15)',
                                }}
                            >
                                {iconMap[content.iconType]}
                            </div>
                        </div>

                        {/* Status chip */}
                        <div
                            className="ua-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
                            style={{ background: '#fef2f2', border: '1px solid rgba(252,165,165,0.6)' }}
                        >
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: '#e74c3c', boxShadow: '0 0 6px rgba(231,76,60,0.7)' }}
                            />
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#c0392b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                {content.code} · {content.badge}
                            </span>
                        </div>

                        {/* Headline — accent the matching word */}
                        <h1 className="ua-h1 text-[26px] font-bold text-gray-800 leading-snug mb-1">
                            {headlineWords.map((word, i) =>
                                word === content.accentWord
                                    ? <span key={i} style={{ background:'linear-gradient(135deg,#c0392b,#e74c3c)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                                        {word}{i < headlineWords.length - 1 ? ' ' : ''}
                                      </span>
                                    : <span key={i}>{word}{i < headlineWords.length - 1 ? ' ' : ''}</span>
                            )}
                        </h1>

                        {/* Description */}
                        <p className="ua-desc text-gray-500 text-sm leading-relaxed mt-3 mb-2">
                            {content.description}
                        </p>

                        {/* Detail box */}
                        <div
                            className="ua-detail w-full rounded-xl px-4 py-3 flex gap-3 items-start text-left mb-7 mt-1"
                            style={{ background: '#fef2f2', border: '1px solid rgba(252,165,165,0.4)' }}
                        >
                            <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span className="text-xs text-gray-500 leading-relaxed">{content.detail}</span>
                        </div>

                        {/* Primary CTA */}
                        <button
                            onClick={content.primaryAction}
                            className="ua-btn1 ua-btn-primary w-full text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 border-none cursor-pointer text-[15px]"
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
                                className="ua-btn2 ua-btn-secondary w-full mt-3 py-3.5 px-4 rounded-xl font-medium text-[14px] flex items-center justify-center gap-2.5 cursor-pointer"
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
                <p className="ua-brand ua-float mt-6 text-xs text-center font-light pointer-events-none" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    © {new Date().getFullYear()} HDFC Life · AutomationEdge – ValueDX
                </p>
            </div>
        </>
    );
};

export default Unauthorized;
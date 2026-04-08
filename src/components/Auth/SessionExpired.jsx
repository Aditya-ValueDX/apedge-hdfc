import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearAuth } from '../../store/authSlice';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;900&display=swap');

  @keyframes se-fade    { from{ opacity:0; }                                 to{ opacity:1; }                        }
  @keyframes se-rise    { from{ opacity:0; transform:translateY(14px); }     to{ opacity:1; transform:translateY(0); } }
  @keyframes se-drop    { from{ opacity:0; transform:translateY(-10px); }    to{ opacity:1; transform:translateY(0); } }
  @keyframes se-pop     { 0%{ opacity:0; transform:scale(.88) translateY(8px); } 65%{ transform:scale(1.03); } 100%{ opacity:1; transform:scale(1); } }
  @keyframes se-float   { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-9px); } }
  @keyframes se-spin    { to{ transform:rotate(360deg); } }
  @keyframes se-ping    { 0%{ transform:scale(1); opacity:.7; } 100%{ transform:scale(1.6); opacity:0; } }
  @keyframes se-bar-in  { from{ transform:scaleX(0); opacity:0; } to{ transform:scaleX(1); opacity:1; } }
  @keyframes se-shimmer { from{ transform:translateX(-100%); } to{ transform:translateX(200%); } }
  @keyframes se-twinkle { 0%,100%{ opacity:.1; transform:scale(1); } 50%{ opacity:.5; transform:scale(1.5); } }
  @keyframes se-clock-tick { 0%,100%{ transform:rotate(0deg); } 50%{ transform:rotate(6deg); } }

  /* Loading bar animation */
  @keyframes se-progress {
    0%   { width: 0%;   opacity: 1; }
    80%  { width: 100%; opacity: 1; }
    100% { width: 100%; opacity: 0; }
  }

  .se-page   { animation: se-fade .3s ease both; font-family:'Poppins',sans-serif; }
  .se-card   { animation: se-pop  .55s cubic-bezier(.34,1.3,.64,1) .1s both; }
  .se-bar    { animation: se-bar-in .6s cubic-bezier(.25,.46,.45,.94) .15s both; transform-origin:left; }
  .se-icon   { animation: se-pop  .5s cubic-bezier(.34,1.4,.64,1) .3s both; }
  .se-badge  { animation: se-rise .4s cubic-bezier(.25,.46,.45,.94) .45s both; }
  .se-h1     { animation: se-rise .4s cubic-bezier(.25,.46,.45,.94) .52s both; }
  .se-desc   { animation: se-rise .4s cubic-bezier(.25,.46,.45,.94) .6s  both; }
  .se-detail { animation: se-rise .4s cubic-bezier(.25,.46,.45,.94) .67s both; }
  .se-btn    { animation: se-pop  .45s cubic-bezier(.34,1.3,.64,1)  .75s both; }
  .se-brand  { animation: se-fade .4s ease 1s both; }

  .se-ping   { animation: se-ping 1.6s ease-out infinite; }
  .se-float  { animation: se-float 7s ease-in-out infinite; }
  .se-p1     { animation: se-twinkle 3.8s ease-in-out .3s  infinite; }
  .se-p2     { animation: se-twinkle 4.4s ease-in-out 1.1s infinite; }
  .se-p3     { animation: se-twinkle 5.2s ease-in-out .7s  infinite; }
  .se-p4     { animation: se-twinkle 4.0s ease-in-out 2.0s infinite; }

  .se-clock  { animation: se-clock-tick 3s ease-in-out infinite; transform-origin: center; }

  .se-btn-primary {
    position:relative; overflow:hidden;
    background:linear-gradient(135deg,#c0392b 0%,#e74c3c 100%);
    box-shadow:0 4px 20px rgba(192,57,43,0.4);
    transition:transform .2s ease, box-shadow .2s ease;
  }
  .se-btn-primary::after {
    content:''; position:absolute; inset:0;
    background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.18) 50%,transparent 65%);
    transform:translateX(-100%); transition:transform .5s ease;
  }
  .se-btn-primary:hover::after { transform:translateX(200%); }
  .se-btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(192,57,43,0.45); }
  .se-btn-primary:active { transform:translateY(0); box-shadow:0 2px 10px rgba(192,57,43,0.3); }

  .se-orb1 { position:absolute; top:-140px; right:-120px; width:420px; height:420px; border-radius:50%; background:rgba(255,255,255,0.04); pointer-events:none; }
  .se-orb2 { position:absolute; bottom:-100px; left:-100px; width:340px; height:340px; border-radius:50%; background:rgba(255,255,255,0.04); pointer-events:none; }
  .se-orb3 { position:absolute; top:30%; left:-50px; width:180px; height:180px; border-radius:50%; background:rgba(192,57,43,0.06); pointer-events:none; }
`;

const SessionExpired = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const handleLogin = () => {
        dispatch(clearAuth());
        navigate('/login');
    };

    return (
        <>
            <style>{STYLES}</style>

            <div
                className="se-page min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1a2c3d 0%, #2c3e50 60%, #1a3a5c 100%)' }}
            >
                {/* Decorative orbs */}
                <div className="se-orb1" />
                <div className="se-orb2" />
                <div className="se-orb3" />

                {/* Twinkling particles */}
                <div className="se-p1 absolute w-2   h-2   rounded-full" style={{ background:'rgba(192,57,43,0.5)', top:'14%', left:'18%' }} />
                <div className="se-p2 absolute w-1.5 h-1.5 rounded-full" style={{ background:'rgba(255,255,255,0.2)', top:'22%', right:'14%' }} />
                <div className="se-p3 absolute w-1   h-1   rounded-full" style={{ background:'rgba(255,255,255,0.3)', top:'68%', left:'12%' }} />
                <div className="se-p4 absolute w-2   h-2   rounded-full" style={{ background:'rgba(192,57,43,0.3)', bottom:'22%', right:'16%' }} />

                {/* Card */}
                <div
                    className="se-card relative w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden backdrop-blur-sm"
                    style={{ background: 'rgba(255,255,255,0.97)' }}
                >
                    {/* Top gradient bar — red, matching Login CTA */}
                    <div
                        className="se-bar h-[3px] w-full"
                        style={{ background: 'linear-gradient(90deg,#c0392b,#e74c3c)', transformOrigin: 'left center' }}
                    />

                    <div className="px-10 pt-10 pb-9 flex flex-col items-center text-center">

                        {/* Icon */}
                        <div className="se-icon relative mb-7">
                            <div
                                className="se-ping absolute inset-0 rounded-full"
                                style={{ border: '1.5px solid rgba(192,57,43,0.35)' }}
                            />
                            <div
                                className="relative w-[84px] h-[84px] rounded-full flex items-center justify-center shadow-lg"
                                style={{
                                    background: 'linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%)',
                                    border: '1px solid rgba(252,165,165,0.5)',
                                    boxShadow: '0 8px 24px rgba(192,57,43,0.15)',
                                }}
                            >
                                {/* Clock SVG */}
                                <svg width="44" height="44" viewBox="0 0 44 44" fill="none" className="se-clock">
                                    <circle cx="22" cy="22" r="19" stroke="#e74c3c" strokeWidth="2" fill="rgba(192,57,43,0.06)" />
                                    <circle cx="22" cy="22" r="2.5" fill="#c0392b" />
                                    {/* Hour hand */}
                                    <line x1="22" y1="22" x2="22" y2="10" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round" />
                                    {/* Minute hand */}
                                    <line x1="22" y1="22" x2="31" y2="22" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" />
                                    {/* Tick marks */}
                                    {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
                                        const a = (i * 30 - 90) * Math.PI / 180;
                                        const r1 = i % 3 === 0 ? 14 : 16;
                                        return <line key={i}
                                            x1={22 + r1 * Math.cos(a)} y1={22 + r1 * Math.sin(a)}
                                            x2={22 + 18.5 * Math.cos(a)} y2={22 + 18.5 * Math.sin(a)}
                                            stroke={i % 3 === 0 ? '#c0392b' : '#fca5a5'}
                                            strokeWidth={i % 3 === 0 ? 2 : 1}
                                            strokeLinecap="round"
                                        />;
                                    })}
                                </svg>
                            </div>
                        </div>

                        {/* Status chip */}
                        <div
                            className="se-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
                            style={{
                                background: '#fef2f2',
                                border: '1px solid rgba(252,165,165,0.6)',
                            }}
                        >
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: '#e74c3c', boxShadow: '0 0 6px rgba(231,76,60,0.7)' }}
                            />
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#c0392b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                Session Terminated
                            </span>
                        </div>

                        {/* Heading */}
                        <h1 className="se-h1 text-[26px] font-bold text-gray-800 leading-snug mb-1">
                            Your Session Has{' '}
                            <span style={{ background: 'linear-gradient(135deg,#c0392b,#e74c3c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                Expired
                            </span>
                        </h1>

                        {/* Description */}
                        <p className="se-desc text-gray-500 text-sm leading-relaxed mt-3 mb-1.5">
                            You were inactive for too long, so we signed you out to keep your account secure.
                        </p>
                        <p className="se-detail text-gray-400 text-xs leading-relaxed mb-7">
                            Any unsaved changes may have been lost. Please log in again to continue.
                        </p>

                        {/* Secure note */}
                        <div
                            className="se-detail w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left mb-6"
                            style={{ background: '#fef2f2', border: '1px solid rgba(252,165,165,0.4)' }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span className="text-xs text-gray-500 leading-relaxed">
                                This is an automatic security measure. Your data is safe.
                            </span>
                        </div>

                        {/* CTA */}
                        <button
                            onClick={handleLogin}
                            className="se-btn se-btn-primary w-full text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 border-none cursor-pointer text-[15px]"
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
                <p className="se-brand mt-6 text-xs text-center font-light pointer-events-none se-float" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    © {new Date().getFullYear()} HDFC Life · AutomationEdge – ValueDX
                </p>
            </div>
        </>
    );
};

export default SessionExpired;
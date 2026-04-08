import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import axios from '../../utils/authInterceptor';
import { Mail, Lock, LogIn, Eye, EyeOff, Shield, Check, Info, XCircle } from 'lucide-react';
import logoImage from '../../assets/hdfc-life-logo.png';

const ANIMATIONS = `
  /* ─── Only opacity + transform: guaranteed 60fps on compositor thread ─── */

  @keyframes lgn-spin      { to { transform: rotate(360deg); } }
  @keyframes lgn-float     { 0%,100%{ transform:translateY(0px);  } 50%{ transform:translateY(-10px); } }
  @keyframes lgn-pulse-dot { 0%,100%{ opacity:1; transform:scale(1);   } 50%{ opacity:.35; transform:scale(.65); } }
  @keyframes lgn-twinkle   { 0%,100%{ opacity:.12; transform:scale(1); } 50%{ opacity:.55; transform:scale(1.5); } }

  @keyframes lgn-rise  { from{ opacity:0; transform:translateY(12px); } to{ opacity:1; transform:translateY(0); } }
  @keyframes lgn-drop  { from{ opacity:0; transform:translateY(-12px);} to{ opacity:1; transform:translateY(0); } }
  @keyframes lgn-fadeX { from{ opacity:0; transform:translateX(-8px); } to{ opacity:1; transform:translateX(0); } }
  @keyframes lgn-fade  { from{ opacity:0; }                              to{ opacity:1; }                        }
  @keyframes lgn-pop   {
    0%  { opacity:0; transform:scale(.92) translateY(6px); }
    65% { transform:scale(1.02) translateY(0); }
    100%{ opacity:1; transform:scale(1) translateY(0); }
  }
  @keyframes lgn-scale-in {
    from{ opacity:0; transform:scaleX(0); }
    to  { opacity:1; transform:scaleX(1); }
  }
  @keyframes lgn-shake {
    0%,100%{ transform:translateX(0);  }
    25%    { transform:translateX(-6px);}
    75%    { transform:translateX( 6px);}
  }
  @keyframes lgn-stripe {
    from{ opacity:0; transform:scaleX(0) translateZ(0); }
    to  { opacity:1; transform:scaleX(1) translateZ(0); }
  }

  .lgn-spinner {
    width:18px; height:18px;
    border:2.5px solid rgba(255,255,255,.25);
    border-top-color:#fff;
    border-radius:50%;
    animation: lgn-spin .65s linear infinite;
    flex-shrink:0;
  }

  .lgn-shine { position:relative; overflow:hidden; }
  .lgn-shine::after {
    content:''; position:absolute; inset:0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.18) 50%, transparent 60%);
    transform: translateX(-100%);
    transition: transform .6s cubic-bezier(.4,0,.2,1);
  }
  .lgn-shine:hover::after { transform: translateX(100%); }

  .lgn-input {
    transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
  }
  .lgn-input:focus {
    border-color: #3b82f6 !important;
    background-color: #fff !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,.13);
    outline: none;
  }

  /* ─── Entrance sequence ─── */
  .lgn-page  { animation: lgn-fade  .25s ease both; }
  .lgn-lpanel {
    animation: lgn-fadeX .55s cubic-bezier(.25,.46,.45,.94) .05s both;
    will-change: opacity, transform;
  }
  .lgn-stripe {
    animation: lgn-stripe .5s cubic-bezier(.25,.46,.45,.94) .45s both;
    transform-origin: left center;
    will-change: opacity, transform;
  }
  .lgn-badge  { animation: lgn-pop  .5s cubic-bezier(.34,1.4,.64,1)    .4s  both; will-change:opacity,transform; }
  .lgn-logo   { animation: lgn-drop .5s cubic-bezier(.25,.46,.45,.94)  .3s  both; will-change:opacity,transform; }
  .lgn-h2     { animation: lgn-rise .5s cubic-bezier(.25,.46,.45,.94)  .42s both; will-change:opacity,transform; }
  .lgn-sub    { animation: lgn-rise .5s cubic-bezier(.25,.46,.45,.94)  .5s  both; will-change:opacity,transform; }
  .lgn-shield { animation: lgn-rise .5s cubic-bezier(.25,.46,.45,.94)  .58s both; will-change:opacity,transform; }

  .lgn-title   { animation: lgn-rise .45s cubic-bezier(.25,.46,.45,.94) .22s both; will-change:opacity,transform; }
  .lgn-desc    { animation: lgn-rise .45s cubic-bezier(.25,.46,.45,.94) .30s both; will-change:opacity,transform; }
  .lgn-steps   { animation: lgn-rise .4s  cubic-bezier(.25,.46,.45,.94) .36s both; will-change:opacity,transform; }
  .lgn-divider {
    animation: lgn-scale-in .45s cubic-bezier(.25,.46,.45,.94) .36s both;
    transform-origin: center;
    will-change: opacity, transform;
  }
  .lgn-f1      { animation: lgn-rise .4s  cubic-bezier(.25,.46,.45,.94) .42s both; will-change:opacity,transform; }
  .lgn-f2      { animation: lgn-rise .4s  cubic-bezier(.25,.46,.45,.94) .50s both; will-change:opacity,transform; }
  .lgn-btn     { animation: lgn-pop  .45s cubic-bezier(.34,1.3,.64,1)   .58s both; will-change:opacity,transform; }
  .lgn-forgot  { animation: lgn-fade .35s ease                          .66s both; will-change:opacity; }

  .lgn-p1 { animation: lgn-twinkle 3.6s ease-in-out .3s  infinite; will-change:opacity,transform; }
  .lgn-p2 { animation: lgn-twinkle 4.2s ease-in-out 1.2s infinite; will-change:opacity,transform; }
  .lgn-p3 { animation: lgn-twinkle 5.0s ease-in-out .8s  infinite; will-change:opacity,transform; }
  .lgn-p4 { animation: lgn-twinkle 4.6s ease-in-out 2.1s infinite; will-change:opacity,transform; }
  .lgn-p5 { animation: lgn-twinkle 3.8s ease-in-out 1.5s infinite; will-change:opacity,transform; }

  .lgn-float { animation: lgn-float 7s ease-in-out infinite; will-change:transform; }
  .lgn-pulse { animation: lgn-pulse-dot 2.8s ease-in-out infinite; will-change:opacity,transform; }
  .lgn-error { animation: lgn-rise .2s ease both, lgn-shake .3s ease .21s both; will-change:opacity,transform; }

  /* Step transition — smooth when step changes */
  .lgn-step-form { animation: lgn-rise .35s cubic-bezier(.25,.46,.45,.94) both; will-change:opacity,transform; }
`;

const getPasswordRequirementStatus = (password = '') => ({
  minLength: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  specialCharacter: /[!@#$%^&*(),.?":{}|<>]/.test(password),
});

const validatePasswordStrength = (password) => {
  const requirements = getPasswordRequirementStatus(password);

  return Object.values(requirements).every(Boolean);
};

const ForgetPassword = () => {
  const navigate = useNavigate();

  // State to manage the current step of the process
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });
  // State to store the reset token received after OTP validation
  const [resetToken, setResetToken] = useState(null);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordHelper, setShowPasswordHelper] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRequirements = getPasswordRequirementStatus(form.newPassword);
  const passwordIsStrong = validatePasswordStrength(form.newPassword);
  const passwordsMatch =
    form.confirmPassword.trim() !== '' && form.newPassword === form.confirmPassword;

  // Handle form input changes
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  // Step 1: Handle sending OTP to the provided email address
  const handleSendOtp = async () => {
    if (!form.email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`/api/auth/forgot-password`, {
        email: form.email
      });

      toast.success(response.data.message || 'OTP has been sent to your email!', { position: 'top-center' });
      setStep(2);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to send OTP. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle OTP validation
  const handleValidateOtp = async () => {
    if (!form.otp) {
      setError('Please enter the OTP.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`/api/auth/verify-otp`, {
        email: form.email,
        otp: form.otp
      });

      const token = response.data.reset_token;
      if (token) {
        setResetToken(token);
        toast.success('OTP validated successfully! You can now reset your password.', { position: 'top-center' });
        setStep(3);
      } else {
        setError('Failed to receive reset token. Please try again.');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Invalid OTP. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Handle password reset
  const handleResetPassword = async () => {
    if (!form.newPassword || !form.confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }

    if (!passwordIsStrong) {
      setError(
        'Password does not meet security requirements.',
      );
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    if (!resetToken) {
      setError('Reset token is missing. Please restart the process.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // NOTE: Per your request, the password is now sent in plaintext.
      // This is generally not recommended for security reasons.
      const response = await axios.post(`/api/auth/reset-password`, {
        reset_token: resetToken,
        new_password: form.newPassword,
      });

      toast.success(response.data.message || 'Password has been reset successfully!', {
        position: 'top-center',
        autoClose: 2000,
        onClose: () => navigate('/login'),
      });
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to reset password. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle 'Enter' key press to trigger the correct action based on the step
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (step === 1) handleSendOtp();
      else if (step === 2) handleValidateOtp();
      else if (step === 3) handleResetPassword();
    }
  };

  // Render the appropriate form based on the current step
  const renderFormStep = () => {
    switch (step) {
      case 1:
        return (
          <div key="step-1" className="lgn-step-form">
            <div className="lgn-f1 mb-5">
              <label htmlFor="fp-email" className="text-sm font-medium text-gray-600 mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="fp-email"
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={handleChange}
                  className="lgn-input w-full pl-10 pr-4 h-12 rounded-xl bg-gray-100 border border-gray-200 text-gray-800 text-sm"
                />
              </div>
            </div>
            {error && (
              <div key={error} className="lgn-error mb-4 p-3.5 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2.5 border border-red-200">
                <Info size={16} className="shrink-0" />
                {error}
              </div>
            )}
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="lgn-btn lgn-shine w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 border-none cursor-pointer disabled:cursor-not-allowed transition-all duration-200"
              style={{
                background: loading ? '#e5e7eb' : 'linear-gradient(135deg,#c0392b 0%,#e74c3c 100%)',
                color: loading ? '#9ca3af' : '#fff',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(192,57,43,0.32)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 26px rgba(192,57,43,0.42)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(192,57,43,0.32)'; }}
              onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading ? <div className="lgn-spinner" /> : 'Send OTP'}
            </button>
          </div>
        );
      case 2:
        return (
          <div key="step-2" className="lgn-step-form">
            <div className="lgn-f1 mb-5">
              <label htmlFor="fp-otp" className="text-sm font-medium text-gray-600 mb-2 block">
                One-Time Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="fp-otp"
                  type="text"
                  name="otp"
                  placeholder="Enter the OTP from your email"
                  value={form.otp}
                  onChange={handleChange}
                  className="lgn-input w-full pl-10 pr-4 h-12 rounded-xl bg-gray-100 border border-gray-200 text-gray-800 text-sm"
                />
              </div>
            </div>
            {error && (
              <div key={error} className="lgn-error mb-4 p-3.5 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2.5 border border-red-200">
                <Info size={16} className="shrink-0" />
                {error}
              </div>
            )}
            <button
              onClick={handleValidateOtp}
              disabled={loading}
              className="lgn-btn lgn-shine w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 border-none cursor-pointer disabled:cursor-not-allowed transition-all duration-200"
              style={{
                background: loading ? '#e5e7eb' : 'linear-gradient(135deg,#c0392b 0%,#e74c3c 100%)',
                color: loading ? '#9ca3af' : '#fff',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(192,57,43,0.32)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 26px rgba(192,57,43,0.42)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(192,57,43,0.32)'; }}
              onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading ? <div className="lgn-spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.25)' }} /> : 'Validate OTP'}
            </button>
          </div>
        );
      case 3:
        return (
          <div key="step-3" className="lgn-step-form">
            <div className="lgn-f1 mb-5 relative">
              <label htmlFor="fp-newpwd" className="text-sm font-medium text-gray-600 mb-2 block">
                New Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="fp-newpwd"
                  type={showPassword ? "text" : "password"}
                  name="newPassword"
                  placeholder="New Password"
                  value={form.newPassword}
                  onChange={handleChange}
                  onFocus={() => setShowPasswordHelper(true)}
                  onBlur={() => setShowPasswordHelper(false)}
                  className="lgn-input w-full pl-10 pr-10 h-12 rounded-xl bg-gray-100 border border-gray-200 text-gray-800 text-sm"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Info size={15} />
                </span>
              </div>
              {showPasswordHelper && (
                <div className="absolute left-0 bottom-full z-20 mb-2 w-72 rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-lg">
                  <p className="mb-3 font-medium text-gray-700">Password requirements</p>
                  <div className="space-y-2">
                    {[
                      { key: 'minLength', label: 'Minimum 8 characters required' },
                      { key: 'uppercase', label: 'At least one uppercase letter required' },
                      { key: 'lowercase', label: 'At least one lowercase letter required' },
                      { key: 'specialCharacter', label: 'At least one special character required' },
                    ].map(({ key, label }) => (
                      <div key={key} className={`flex items-center gap-2 ${passwordRequirements[key] ? 'text-emerald-600' : 'text-red-500'}`}>
                        {passwordRequirements[key] ? <Check size={15} className="shrink-0" /> : <XCircle size={15} className="shrink-0" />}
                        <span className="leading-5">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lgn-f2 mb-3">
              <label htmlFor="fp-confirmpwd" className="text-sm font-medium text-gray-600 mb-2 block">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="fp-confirmpwd"
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm New Password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className="lgn-input w-full pl-10 pr-12 h-12 rounded-xl bg-gray-100 border border-gray-200 text-gray-800 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.confirmPassword && (
                <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium transition-colors ${passwordsMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                  {passwordsMatch ? <Check size={13} /> : <XCircle size={13} />}
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </div>
              )}
            </div>

            {error && (
              <div key={error} className="lgn-error mb-4 p-3.5 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2.5 border border-red-200">
                <Info size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleResetPassword}
              disabled={loading || !passwordIsStrong || !passwordsMatch}
              className="lgn-btn lgn-shine w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 border-none cursor-pointer disabled:cursor-not-allowed transition-all duration-200"
              style={{
                background: loading ? '#e5e7eb' : 'linear-gradient(135deg,#c0392b 0%,#e74c3c 100%)',
                color: loading ? '#9ca3af' : '#fff',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(192,57,43,0.32)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 26px rgba(192,57,43,0.42)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(192,57,43,0.32)'; }}
              onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading
                ? <div className="lgn-spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.25)' }} />
                : <><LogIn size={16} /> Reset Password</>
              }
            </button>
          </div>
        );
      default:
        return null;
    }
  };


  return (
    <div className="lgn-page min-h-screen flex bg-[hsl(210,20%,98%)]">
      <style>{ANIMATIONS}</style>

      {/* Left brand panel — identical animation to Login */}
      <div className="lgn-lpanel hidden lg:flex lg:w-[48%] bg-gradient-to-br from-[#1a3a5c] to-[#2d5f8f] flex-col justify-center items-center p-16 relative overflow-hidden">
        {/* Ambient glow layers */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 -left-20 w-96 h-96 rounded-full bg-white/[0.04] blur-3xl" />
          <div className="absolute bottom-20 right-0 w-[500px] h-[500px] rounded-full bg-white/[0.02] blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        {/* Animated bottom stripe */}
        {/* <div className="lgn-stripe absolute bottom-0 left-0 right-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg,#e31837,#ff6b6b,#e31837)', transformOrigin: 'left center' }} /> */}

        {/* Twinkling particle dots */}
        <div className="lgn-p1 absolute w-2   h-2   rounded-full bg-white/20" style={{ top: '14%', left: '18%' }} />
        <div className="lgn-p2 absolute w-1.5 h-1.5 rounded-full bg-red-400/35" style={{ top: '22%', right: '14%' }} />
        <div className="lgn-p3 absolute w-1   h-1   rounded-full bg-white/25" style={{ top: '68%', left: '12%' }} />
        <div className="lgn-p4 absolute w-2.5 h-2.5 rounded-full bg-blue-300/20" style={{ bottom: '22%', right: '16%' }} />
        <div className="lgn-p5 absolute w-1.5 h-1.5 rounded-full bg-white/15" style={{ bottom: '38%', left: '22%' }} />

        <div className="relative z-10 text-center max-w-md">
          {/* Live badge */}
          {/* <div className="lgn-badge inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 lgn-pulse" />
            <span className="text-[0.6rem] font-semibold text-white/60 uppercase tracking-widest">Secure Portal</span>
          </div> */}

          <div className="lgn-logo inline-flex items-center justify-center bg-white rounded-2xl p-5 mb-10 shadow-2xl">
            <img src={logoImage} alt="APEdge Logo" className="h-14 object-contain" />
          </div>
          <h1 className="lgn-h2 text-3xl font-bold text-white mb-3 tracking-tight leading-tight">
            Policy Churn<br />Notification Dashboard
          </h1>
          <p className="lgn-sub text-white/50 text-sm leading-relaxed max-w-sm mx-auto mt-6">
            Monitor policy churn, manage notifications, and streamline the approval workflow across all channels.
          </p>
          <div className="lgn-shield mt-16 flex items-center justify-center gap-2 text-white/30 text-xs lgn-float">
            <Shield size={14} />
            <span>Secure &amp; encrypted platform</span>
          </div>
        </div>
      </div>

      {/* Right panel — Forgot Password form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50" onKeyDown={handleKeyDown}>
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 text-center">
            <img src={logoImage} alt="APEdge Logo" className="h-14 mx-auto mb-4" />
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="lgn-title text-2xl font-bold text-gray-800 tracking-tight">
              {step === 1 && 'Forgot Password'}
              {step === 2 && 'Verify OTP'}
              {step === 3 && 'Reset Password'}
            </h2>
            <p className="lgn-desc text-gray-500 text-sm mt-1.5">
              {step === 1 && 'Enter your email to receive a password reset code.'}
              {step === 2 && 'Check your email for the OTP and enter it below.'}
              {step === 3 && 'Enter your new password below.'}
            </p>
          </div>

          {/* Gradient divider */}
          <div className="lgn-divider h-px w-full mb-6" style={{ background: 'linear-gradient(90deg,transparent,#e5e7eb 30%,#e5e7eb 70%,transparent)', transformOrigin: 'center' }} />

          {/* Step pills */}
          <div className="lgn-steps flex items-center mb-8">
            {[
              { s: 1, label: 'Email' },
              { s: 2, label: 'Verify OTP' },
              { s: 3, label: 'New Password' },
            ].map(({ s, label }) => (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${s < step ? 'bg-emerald-500 text-white' :
                    s === step ? 'bg-gradient-to-br from-[#c0392b] to-[#e74c3c] text-white shadow-md shadow-red-200' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                    {s < step ? <Check size={13} /> : s}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap transition-colors duration-300 ${s === step ? 'text-red-500' : s < step ? 'text-emerald-600' : 'text-gray-400'
                    }`}>
                    {label}
                  </span>
                </div>
                {s < 3 && (
                  <div className={`h-0.5 w-10 mx-1.5 mb-4 rounded-full transition-all duration-500 ${s < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Form steps */}
          {renderFormStep()}

          {/* Back to Login */}
          <div className="lgn-forgot mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-gray-400 hover:text-blue-500 cursor-pointer transition-colors bg-transparent border-none p-0"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>

      <ToastContainer
        position="top-center"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </div>
  );
};

export default ForgetPassword;
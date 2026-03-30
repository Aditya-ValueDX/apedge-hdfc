import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import axios from '../../utils/authInterceptor';
import { Mail, Lock, LogIn, Eye, EyeOff, Shield, Check, Info, XCircle } from 'lucide-react';
import logoImage from '/APEdge1.png';

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
          <>
            <div className="relative mb-5 w-full flex items-center">
              <span className="absolute left-4 text-gray-400 z-10">
                <Mail size={20} />
              </span>
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={form.email}
                onChange={handleChange}
                className="w-full py-3.5 pl-12 pr-4 border-2 border-gray-200 rounded-xl outline-none transition-all duration-300 font-poppins text-base bg-gray-50 text-gray-800 focus:border-[#4facfe] focus:shadow-md focus:shadow-blue-200 focus:bg-white"
              />
            </div>
            {error && <div className="text-red-500 text-sm text-center mb-4 font-medium">{error}</div>}
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-gradient-to-br from-[#008DDA] to-[#4169E1] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-400/30 transition-all duration-300 flex items-center justify-center border-none cursor-pointer text-base disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none hover:enabled:translate-y-[-2px] hover:enabled:shadow-xl hover:enabled:shadow-blue-400/40 active:enabled:translate-y-0"
            >
              {loading ? (
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <>
                  Send OTP
                </>
              )}
            </button>
          </>
        );
      case 2:
        return (
          <>
            <div className="relative mb-5 w-full flex items-center">
              <span className="absolute left-4 text-gray-400 z-10">
                <Lock size={20} />
              </span>
              <input
                type="text"
                name="otp"
                placeholder="Enter the OTP from your email"
                value={form.otp}
                onChange={handleChange}
                className="w-full py-3.5 pl-12 pr-4 border-2 border-gray-200 rounded-xl outline-none transition-all duration-300 font-poppins text-base bg-gray-50 text-gray-800 focus:border-[#4facfe] focus:shadow-md focus:shadow-blue-200 focus:bg-white"
              />
            </div>
            {error && <div className="text-red-500 text-sm text-center mb-4 font-medium">{error}</div>}
            <button
              onClick={handleValidateOtp}
              disabled={loading}
              className="w-full bg-gradient-to-br from-[#008DDA] to-[#4169E1] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-400/30 transition-all duration-300 flex items-center justify-center border-none cursor-pointer text-base disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none hover:enabled:translate-y-[-2px] hover:enabled:shadow-xl hover:enabled:shadow-blue-400/40 active:enabled:translate-y-0"
            >
              {loading ? (
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <>
                  Validate OTP
                </>
              )}
            </button>
          </>
        );
      case 3:
        return (
          <>
            <div className="relative mb-5 w-full">
              <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-gray-400">
                <Lock size={20} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                name="newPassword"
                placeholder="New Password"
                value={form.newPassword}
                onChange={handleChange}
                onFocus={() => setShowPasswordHelper(true)}
                onBlur={() => setShowPasswordHelper(false)}
                className="w-full py-3.5 pl-12 pr-12 border-2 border-gray-200 rounded-xl outline-none transition-all duration-300 font-poppins text-base bg-gray-50 text-gray-800 focus:border-[#4facfe] focus:shadow-md focus:shadow-blue-200 focus:bg-white"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-gray-400">
                <Info size={18} />
              </span>
              {showPasswordHelper ? (
                <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg">
                  <p className="mb-3 font-medium text-gray-700">
                    Password requirements
                  </p>
                  <div className="space-y-2">
                    <div
                      className={`flex items-center gap-2 ${passwordRequirements.minLength ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {passwordRequirements.minLength ? (
                        <Check size={16} className="shrink-0" />
                      ) : (
                        <XCircle size={16} className="shrink-0" />
                      )}
                      <span className="leading-5">
                        Minimum 8 characters required
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-2 ${passwordRequirements.uppercase ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {passwordRequirements.uppercase ? (
                        <Check size={16} className="shrink-0" />
                      ) : (
                        <XCircle size={16} className="shrink-0" />
                      )}
                      <span className="leading-5">
                        At least one uppercase letter required
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-2 ${passwordRequirements.lowercase ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {passwordRequirements.lowercase ? (
                        <Check size={16} className="shrink-0" />
                      ) : (
                        <XCircle size={16} className="shrink-0" />
                      )}
                      <span className="leading-5">
                        At least one lowercase letter required
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-2 ${passwordRequirements.specialCharacter ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {passwordRequirements.specialCharacter ? (
                        <Check size={16} className="shrink-0" />
                      ) : (
                        <XCircle size={16} className="shrink-0" />
                      )}
                      <span className="leading-5">
                        At least one special character required
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="relative mb-2 w-full flex items-center">
              <span className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-gray-400">
                <Lock size={20} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm New Password"
                value={form.confirmPassword}
                onChange={handleChange}
                className="w-full py-3.5 pl-12 pr-12 border-2 border-gray-200 rounded-xl outline-none transition-all duration-300 font-poppins text-base bg-gray-50 text-gray-800 focus:border-[#4facfe] focus:shadow-md focus:shadow-blue-200 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer transition-all duration-200 bg-none border-none p-1 flex items-center rounded-md hover:text-[#4facfe] hover:bg-blue-100"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {form.confirmPassword ? (
              <div
                className={`mb-3 flex items-center gap-2 text-sm font-medium ${passwordsMatch ? "text-emerald-600" : "text-red-500"}`}
              >
                {passwordsMatch ? <Check size={16} /> : <XCircle size={16} />}
                <span>
                  {passwordsMatch
                    ? "Passwords match"
                    : "Passwords do not match"}
                </span>
              </div>
            ) : (
              <div className="mb-3" />
            )}
            {error && (
              <div className="text-red-500 text-sm text-center mb-4 font-medium">
                {error}
              </div>
            )}
            <button
              onClick={handleResetPassword}
              disabled={loading || !passwordIsStrong || !passwordsMatch}
              className="w-full bg-gradient-to-br from-[#008DDA] to-[#4169E1] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-400/30 transition-all duration-300 flex items-center justify-center border-none cursor-pointer text-base disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none hover:enabled:translate-y-[-2px] hover:enabled:shadow-xl hover:enabled:shadow-blue-400/40 active:enabled:translate-y-0"
            >
              {loading ? (
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <>
                  <LogIn size={20} className="mr-2" /> Reset Password
                </>
              )}
            </button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#286484] to-[#5367a6] text-white p-4 relative overflow-hidden gap-2 md:gap-2 font-poppins">
      {/* Container for the whole layout */}
      <div className="relative w-full max-w-4xl max-h-[500px] bg-white bg-opacity-95 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row transition-all duration-300 backdrop-blur-sm">
        {/* Left side: Illustration and Marketing Text */}
        <div
          className="hidden md:flex lg:relative w-0 md:w-[50%] bg-gradient-to-br from-[#008DDA] via-[#0077b6] to-[#4169E1] px-4 sm:px-6 py-4 lg:py-5 flex-col items-center justify-center text-white select-none min-h-[280px] sm:min-h-[320px] md:min-h-0"
          style={{ overflow: "visible" }}
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg
              className="w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <pattern
                  id="grid"
                  width="50"
                  height="50"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 50 0 L 0 0 0 50"
                    fill="none"
                    stroke="white"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          
          <h2 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold leading-tight text-center z-10 px-2 flex-shrink-0">
            Intelligent Account Payable <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-blue-100">
              Automation Workflow
            </span>
          </h2>

          <div
            className="relative w-full flex items-center justify-center flex-1 px-3 py-1 overflow-visible"
            style={{ minHeight: 0 }}
          >
            <svg
              viewBox="0 0 460 580"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
              aria-label="Intelligent AP Automation Process"
              role="img"
              preserveAspectRatio="xMidYMid meet"
              style={{
                maxWidth: "min(100%, 400px)",
                maxHeight: "98%",
                overflow: "visible",
              }}
            >
              <style>{`
                        @keyframes floatBot {
                            0%, 100% { transform: translateY(0px) scale(1); }
                            50% { transform: translateY(-15px) scale(1.05); }
                        }
                        @keyframes scanLine {
                            0%, 100% { opacity: 0; transform: translateY(0); }
                            50% { opacity: 1; transform: translateY(40px); }
                        }
                        @keyframes dataFlow {
                            0% { stroke-dashoffset: 2000; opacity: 0.3; }
                            50% { opacity: 1; }
                            100% { stroke-dashoffset: 0; opacity: 0.3; }
                        }
                        @keyframes docFloat {
                            0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
                            50% { transform: translateY(-10px) rotate(3deg) scale(1.08); }
                        }
                        @keyframes processGlow {
                            0%, 100% { filter: drop-shadow(0 0 15px rgba(96, 165, 250, 0.8)); }
                            50% { filter: drop-shadow(0 0 30px rgba(96, 165, 250, 1)); }
                        }
                        @keyframes robotEye {
                            0%, 90%, 100% { opacity: 1; }
                            95% { opacity: 0.3; }
                        }
                        @keyframes armRotate {
                            0%, 95% { transform: rotate(0deg); }
                            25% { transform: rotate(-11deg); }
                            75% { transform: rotate(11deg); }
                        }
                        @keyframes gearSpin {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                        }
                        @keyframes checkMark {
                            0% { stroke-dashoffset: 60; opacity: 0; }
                            50% { opacity: 1; }
                            100% { stroke-dashoffset: 0; opacity: 1; }
                        }
                        @keyframes pulseRing {
                            0% { r: 60; opacity: 0.8; }
                            50% { r: 75; opacity: 0.4; }
                            100% { r: 60; opacity: 0.8; }
                        }
                        .robot-main { 
                            animation: floatBot 5s ease-in-out infinite; 
                            transform-origin: center bottom; 
                        }
                        .scan-beam { animation: scanLine 3s ease-in-out infinite; }
                        .flow-line { 
                            animation: dataFlow 7s linear infinite; 
                            stroke-dasharray: 2000;
                        }
                        .doc-item { animation: docFloat 4s ease-in-out infinite; }
                        .process-node { animation: processGlow 3s ease-in-out infinite; }
                        .eye-blink { animation: robotEye 5s ease-in-out infinite; }
                        .robot-arm { 
                            animation: armRotate 7s ease-in-out infinite;
                            transform-origin: 50% 100%;
                        }
                        .gear-rotate { animation: gearSpin 6s linear infinite; }
                        .check-animate {
                            stroke-dasharray: 60;
                            animation: checkMark 2s ease-out infinite;
                        }
                        .pulse-ring { animation: pulseRing 2.5s ease-in-out infinite; }
                        .delay-1 { animation-delay: 0s; }
                        .delay-2 { animation-delay: 1.75s; }
                        .delay-3 { animation-delay: 3.5s; }
                        .delay-4 { animation-delay: 5.25s; }
                    `}</style>

              <defs>
                <linearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
                </linearGradient>

                <linearGradient id="glass" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
                </linearGradient>

                <marker
                  id="arrowhead"
                  markerWidth="18"
                  markerHeight="18"
                  refX="15"
                  refY="9"
                  orient="auto"
                >
                  <path d="M3,3 L15,9 L3,15 L6,9 Z" fill="#60a5fa" />
                </marker>

                <g id="advancedRobot">
                  <rect
                    x="-52.5"
                    y="-69"
                    width="105"
                    height="117"
                    rx="15"
                    fill="url(#glass)"
                    stroke="#60a5fa"
                    strokeWidth="3"
                  />
                  <rect
                    x="-45"
                    y="-60"
                    width="90"
                    height="102"
                    rx="12"
                    fill="#1e3a8a"
                    opacity="0.8"
                  />
                  <circle
                    cx="0"
                    cy="-7.5"
                    r="18"
                    fill="#0ea5e9"
                    opacity="0.3"
                  />
                  <g className="gear-rotate" transform="translate(0, -7.5)">
                    <circle
                      r="12"
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="2.4"
                    />
                    <line
                      x1="-12"
                      y1="0"
                      x2="12"
                      y2="0"
                      stroke="#60a5fa"
                      strokeWidth="3"
                    />
                    <line
                      x1="0"
                      y1="-12"
                      x2="0"
                      y2="12"
                      stroke="#60a5fa"
                      strokeWidth="3"
                    />
                  </g>
                  <rect
                    x="-42"
                    y="-105"
                    width="84"
                    height="28.5"
                    rx="14.25"
                    fill="#1e40af"
                    stroke="#60a5fa"
                    strokeWidth="3"
                  />
                  <circle
                    cx="-18"
                    cy="-90.75"
                    r="9"
                    fill="#0ea5e9"
                    className="eye-blink"
                  />
                  <circle
                    cx="18"
                    cy="-90.75"
                    r="9"
                    fill="#0ea5e9"
                    className="eye-blink"
                  />
                  <line
                    x1="0"
                    y1="-105"
                    x2="0"
                    y2="-123"
                    stroke="#60a5fa"
                    strokeWidth="3.75"
                  />
                  <circle
                    cx="0"
                    cy="-127.5"
                    r="6"
                    fill="#0ea5e9"
                    className="process-glow"
                  />
                  <g className="robot-arm">
                    <rect
                      x="-75"
                      y="-39"
                      width="16.5"
                      height="52.5"
                      rx="7.5"
                      fill="#1e40af"
                      stroke="#60a5fa"
                      strokeWidth="3"
                    />
                    <circle cx="-66.75" cy="18" r="9" fill="#0ea5e9" />
                  </g>
                  <g className="robot-arm" style={{ animationDelay: "0.4s" }}>
                    <rect
                      x="58.5"
                      y="-39"
                      width="16.5"
                      height="52.5"
                      rx="7.5"
                      fill="#1e40af"
                      stroke="#60a5fa"
                      strokeWidth="3"
                    />
                    <circle cx="66.75" cy="18" r="9" fill="#0ea5e9" />
                  </g>
                  <rect
                    x="-28.5"
                    y="46.5"
                    width="21"
                    height="28.5"
                    rx="6"
                    fill="#1e40af"
                    stroke="#60a5fa"
                    strokeWidth="3"
                  />
                  <rect
                    x="7.5"
                    y="46.5"
                    width="21"
                    height="28.5"
                    rx="6"
                    fill="#1e40af"
                    stroke="#60a5fa"
                    strokeWidth="3"
                  />
                  <circle cx="-18" cy="79.5" r="7.5" fill="#0ea5e9" />
                  <circle cx="18" cy="79.5" r="7.5" fill="#0ea5e9" />
                  <rect
                    className="scan-beam"
                    x="-45"
                    y="-60"
                    width="90"
                    height="3.75"
                    fill="#0ea5e9"
                    opacity="0.7"
                  />
                </g>

                <g id="inputSourceIcon">
                  <rect
                    x="-28.5"
                    y="-39"
                    width="57"
                    height="75"
                    rx="6"
                    fill="url(#glass)"
                    stroke="#60a5fa"
                    strokeWidth="3"
                  />
                  <rect
                    x="-24"
                    y="-31.5"
                    width="48"
                    height="63"
                    rx="4.5"
                    fill="#1e3a8a"
                    opacity="0.85"
                  />
                  <path
                    d="M-12 -18 L-12 -6 L12 -6 L12 -18 Z"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2.5"
                    opacity="0.9"
                  />
                  <circle cx="0" cy="-12" r="3" fill="#60a5fa" />
                  <path
                    d="M-15 6 L-6 15 M0 6 L0 21 M6 6 L15 15"
                    stroke="#60a5fa"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                  <circle cx="0" cy="0" r="18" fill="#60a5fa" opacity="0.2" />
                </g>

                <g id="extractionIcon">
                  <rect
                    x="-28.5"
                    y="-39"
                    width="57"
                    height="75"
                    rx="6"
                    fill="url(#glass)"
                    stroke="#60a5fa"
                    strokeWidth="3"
                  />
                  <rect
                    x="-24"
                    y="-31.5"
                    width="48"
                    height="63"
                    rx="4.5"
                    fill="#1e3a8a"
                    opacity="0.85"
                  />
                  <rect
                    x="-18"
                    y="-21"
                    width="36"
                    height="42"
                    rx="3"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2.5"
                    opacity="0.8"
                  />
                  <line
                    x1="-12"
                    y1="-12"
                    x2="12"
                    y2="-12"
                    stroke="#60a5fa"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                  <line
                    x1="-12"
                    y1="-3"
                    x2="12"
                    y2="-3"
                    stroke="#60a5fa"
                    strokeWidth="2"
                    opacity="0.7"
                  />
                  <line
                    x1="-12"
                    y1="6"
                    x2="9"
                    y2="6"
                    stroke="#60a5fa"
                    strokeWidth="2"
                    opacity="0.5"
                  />
                  <path
                    d="M-6 15 L0 21 L6 15"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="0"
                    y1="21"
                    x2="0"
                    y2="9"
                    stroke="#60a5fa"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </g>

                <g id="approvalIcon">
                  <rect
                    x="-28.5"
                    y="-39"
                    width="57"
                    height="75"
                    rx="6"
                    fill="url(#glass)"
                    stroke="#60a5fa"
                    strokeWidth="3"
                  />
                  <rect
                    x="-24"
                    y="-31.5"
                    width="48"
                    height="63"
                    rx="4.5"
                    fill="#1e3a8a"
                    opacity="0.85"
                  />
                  <circle
                    cx="-9"
                    cy="-9"
                    r="12"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    opacity="0.8"
                  />
                  <path
                    d="M-15 -9 L-12 -6 L-6 -15"
                    stroke="#10b981"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M-3 -3 L-3 15 L15 15 L15 -3 Z"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2.5"
                    opacity="0.7"
                  />
                  <line
                    x1="0"
                    y1="3"
                    x2="12"
                    y2="3"
                    stroke="#60a5fa"
                    strokeWidth="2"
                    opacity="0.6"
                  />
                  <line
                    x1="0"
                    y1="9"
                    x2="12"
                    y2="9"
                    stroke="#60a5fa"
                    strokeWidth="2"
                    opacity="0.6"
                  />
                  <path
                    d="M3 18 Q6 21 9 18"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>

                <g id="erpEntryIcon">
                  <rect
                    x="-28.5"
                    y="-39"
                    width="57"
                    height="75"
                    rx="6"
                    fill="url(#glass)"
                    stroke="#60a5fa"
                    strokeWidth="3"
                  />
                  <rect
                    x="-24"
                    y="-31.5"
                    width="48"
                    height="63"
                    rx="4.5"
                    fill="#1e3a8a"
                    opacity="0.85"
                  />
                  <rect
                    x="-15"
                    y="-18"
                    width="30"
                    height="36"
                    rx="2"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    opacity="0.8"
                  />
                  <line
                    x1="-15"
                    y1="-6"
                    x2="15"
                    y2="-6"
                    stroke="#10b981"
                    strokeWidth="2"
                    opacity="0.7"
                  />
                  <line
                    x1="-15"
                    y1="3"
                    x2="15"
                    y2="3"
                    stroke="#10b981"
                    strokeWidth="2"
                    opacity="0.7"
                  />
                  <line
                    x1="-15"
                    y1="12"
                    x2="15"
                    y2="12"
                    stroke="#10b981"
                    strokeWidth="2"
                    opacity="0.7"
                  />
                  <line
                    x1="-6"
                    y1="-18"
                    x2="-6"
                    y2="18"
                    stroke="#10b981"
                    strokeWidth="2"
                    opacity="0.6"
                  />
                  <line
                    x1="3"
                    y1="-18"
                    x2="3"
                    y2="18"
                    stroke="#10b981"
                    strokeWidth="2"
                    opacity="0.6"
                  />
                  <circle cx="0" cy="0" r="24" fill="#10b981" opacity="0.15" />
                </g>

                <circle id="particle" r="4.8" fill="#60a5fa" opacity="0.9" />
              </defs>

              <path
                className="flow-line delay-1"
                d="M 230 155 Q 322 155 391 260"
                stroke="url(#glowGrad)"
                strokeWidth="3.68"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
              <path
                className="flow-line delay-2"
                d="M 391 365 Q 322 470 230 470"
                stroke="url(#glowGrad)"
                strokeWidth="3.68"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
              <path
                className="flow-line delay-3"
                d="M 230 470 Q 138 470 69 365"
                stroke="url(#glowGrad)"
                strokeWidth="3.68"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
              <path
                className="flow-line delay-4"
                d="M 69 260 Q 138 155 230 155"
                stroke="url(#glowGrad)"
                strokeWidth="3.68"
                fill="none"
                markerEnd="url(#arrowhead)"
              />

              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <use key={i} href="#particle">
                  <animateMotion
                    dur="7s"
                    repeatCount="indefinite"
                    begin={`${i * 0.4}s`}
                  >
                    <mpath href="#pathCycle" />
                  </animateMotion>
                </use>
              ))}
              <path
                id="pathCycle"
                d="M 230 155 Q 322 155 391 260 Q 322 470 230 470 Q 138 470 69 365 Q 138 155 230 155"
                fill="none"
              />

              <g
                className="doc-item process-node"
                transform="translate(230, 110)"
              >
                <circle
                  r="48.3"
                  fill="url(#glass)"
                  opacity="0.2"
                  className="pulse-ring"
                />
                <use href="#inputSourceIcon" transform="scale(1.0925)" />
                <text
                  y="57.5"
                  fontSize="16"
                  fill="white"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  Input Source
                </text>
              </g>

              <g
                className="doc-item process-node"
                transform="translate(402.5, 312.5)"
                style={{ animationDelay: "1.75s" }}
              >
                <circle
                  r="48.3"
                  fill="url(#glass)"
                  opacity="0.2"
                  className="pulse-ring"
                />
                <use href="#extractionIcon" transform="scale(1.0925)" />
                <text
                  y="57.5"
                  fontSize="16"
                  fill="white"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  Extraction
                </text>
              </g>

              // Changed the order to maintain the correct sequence: Input Source → Extraction → Approval → ERP Entry
              <g
                className="doc-item process-node"
                transform="translate(230, 515)"
                style={{ animationDelay: "3.5s" }}
              >
                <circle
                  r="48.3"
                  fill="url(#glass)"
                  opacity="0.2"
                  className="pulse-ring"
                />
                <use href="#approvalIcon" transform="scale(1.0925)" />
                <text
                  y="57.5"
                  fontSize="16"
                  fill="white"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  Approval
                </text>
              </g>

              <g
                className="doc-item process-node"
                transform="translate(57.5, 312.5)"
                style={{ animationDelay: "5.25s" }}
              >
                <circle
                  r="48.3"
                  fill="url(#glass)"
                  opacity="0.2"
                  className="pulse-ring"
                />
                <use href="#erpEntryIcon" transform="scale(1.0925)" />
                <text
                  y="57.5"
                  fontSize="16"
                  fill="white"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  ERP Entry
                </text>
              </g>

              <g
                className="robot-main process-node"
                transform="translate(230, 312.5)"
                style={{
                  animationDelay: "2.5s",
                  transformOrigin: "center bottom",
                }}
              >
                <use
                  href="#advancedRobot"
                  transform="scale(0.65) translate(0, -15)"
                />
                <text
                  y="57.5"
                  fontSize="16"
                  fill="white"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  Automation
                </text>
              </g>

              <g opacity="0.2">
                <circle cx="57.5" cy="65" r="3.68" fill="#60a5fa" />
                <circle cx="402.5" cy="65" r="3.68" fill="#60a5fa" />
                <circle cx="57.5" cy="560" r="3.22" fill="#60a5fa" />
                <circle cx="402.5" cy="560" r="3.22" fill="#60a5fa" />
              </g>
            </svg>
          </div>

          <div className="w-full px-3 pb-3">
            <div className="grid grid-cols-3 gap-2">
              {/* <div className="flex items-center justify-center gap-1 rounded-md border border-emerald-200/30 bg-white/5 backdrop-blur px-2 py-1 text-[10px] font-medium tracking-wide text-white/90">
                <Shield size={12} className="text-emerald-200" />
                <span>SOC 2 Type II</span>
              </div>
              <div className="flex items-center justify-center gap-1 rounded-md border border-emerald-200/30 bg-white/5 backdrop-blur px-2 py-1 text-[10px] font-medium tracking-wide text-white/90">
                <Shield size={12} className="text-emerald-200" />
                <span>256-bit Encryption</span>
              </div>
              <div className="flex items-center justify-center gap-1 rounded-md border border-emerald-200/30 bg-white/5 backdrop-blur px-2 py-1 text-[10px] font-medium tracking-wide text-white/90">
                <Check size={12} className="text-emerald-200" />
                <span>98% Extraction Accuracy</span>
              </div> */}
            </div>
          </div>
        </div>

        {/* Right side: Forgot Password Form */}
        <div className="flex-1 p-8 flex flex-col justify-center bg-white min-h-[400px] md:min-h-auto" onKeyDown={handleKeyDown}>
          <div className="w-full max-w-sm mx-auto">
            {/* Replace text with logo */}
            <div className="flex justify-center md:justify-start mb-2">
              <img 
                src={logoImage} 
                alt="APEdge Logo" 
                className="h-8 w-auto object-contain"
              />
            </div>
            <p className="text-gray-500 mb-8 leading-relaxed text-center md:text-left text-sm md:text-base">
              {step === 1 && 'Enter your email to receive a password reset code.'}
              {step === 2 && 'Check your email for the OTP and enter it below.'}
              {step === 3 && 'Enter your new password.'}
            </p>
            {renderFormStep()}

            {/* Back to Login Link */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-sm text-gray-500 transition-colors duration-200 cursor-pointer font-medium hover:text-[#4facfe] bg-transparent border-none p-0 inline"
              >
                Back to Login
              </button>
            </div>
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
      <div className="text-xs text-white text-opacity-60 text-center w-full px-4 font-light pointer-events-none ">
        <p>&copy; {new Date().getFullYear()} APEdge &middot; AutomationEdge &minus; ValueDX.</p>
      </div>
    </div>
  );
};

export default ForgetPassword;

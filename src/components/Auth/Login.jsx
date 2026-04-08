import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../utils/authInterceptor"; // Use our custom axios instance with interceptors
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { jwtDecode } from "jwt-decode";
import { useDispatch } from "react-redux";
import { setAuth } from "../../store/authSlice";
import { scheduleTokenRefresh } from "../../utils/authInterceptor";
import { Mail, Lock, Eye, EyeOff, LogIn, Shield, Check, AlertCircle, ArrowRight } from "lucide-react";
import { apiBaseUrl } from "../../config/apiConfig";
import logoImage from '../../assets/hdfc-life-logo.png';

const ANIMATIONS = `
  /* ─── Only opacity + transform: guaranteed 60fps on compositor thread ─── */

  @keyframes lgn-spin      { to { transform: rotate(360deg); } }
  @keyframes lgn-float     { 0%,100%{ transform:translateY(0px);  } 50%{ transform:translateY(-10px); } }
  @keyframes lgn-pulse-dot { 0%,100%{ opacity:1; transform:scale(1);   } 50%{ opacity:.35; transform:scale(.65); } }
  @keyframes lgn-twinkle   { 0%,100%{ opacity:.12; transform:scale(1); } 50%{ opacity:.55; transform:scale(1.5); } }

  /* Entrance — translateY only (small offset = feels quick, not jarring) */
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

  /* ─── Utility classes ─── */
  .lgn-will { will-change: opacity, transform; }

  .lgn-spinner {
    width:18px; height:18px;
    border:2.5px solid rgba(255,255,255,.25);
    border-top-color:#fff;
    border-radius:50%;
    animation: lgn-spin .65s linear infinite;
    flex-shrink:0;
  }

  /* Shine sweep — transform only (no layout) */
  .lgn-shine { position:relative; overflow:hidden; }
  .lgn-shine::after {
    content:''; position:absolute; inset:0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.18) 50%, transparent 60%);
    transform: translateX(-100%);
    transition: transform .6s cubic-bezier(.4,0,.2,1);
  }
  .lgn-shine:hover::after { transform: translateX(100%); }

  /* Input focus — only box-shadow + border (no layout triggers) */
  .lgn-input {
    transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
  }
  .lgn-input:focus {
    border-color: #3b82f6 !important;
    background-color: #fff !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,.13);
    outline: none;
  }

  /* ─── Page-load entrance sequence ─── */
  /* Easing: cubic-bezier(.25,.46,.45,.94) = smooth "ease-out-quad" — fast start, gentle settle */
  .lgn-page  { animation: lgn-fade  .25s ease both; }

  /* Left panel slides in from left via opacity+translateX — NO clip-path */
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

  /* Right panel items — stagger relative to left panel settling */
  .lgn-title   { animation: lgn-rise .45s cubic-bezier(.25,.46,.45,.94) .22s both; will-change:opacity,transform; }
  .lgn-desc    { animation: lgn-rise .45s cubic-bezier(.25,.46,.45,.94) .30s both; will-change:opacity,transform; }
  .lgn-divider {
    animation: lgn-scale-in .45s cubic-bezier(.25,.46,.45,.94) .36s both;
    transform-origin: center;
    will-change: opacity, transform;
  }
  .lgn-f1      { animation: lgn-rise .4s  cubic-bezier(.25,.46,.45,.94) .42s both; will-change:opacity,transform; }
  .lgn-f2      { animation: lgn-rise .4s  cubic-bezier(.25,.46,.45,.94) .50s both; will-change:opacity,transform; }
  .lgn-btn     { animation: lgn-pop  .45s cubic-bezier(.34,1.3,.64,1)   .58s both; will-change:opacity,transform; }
  .lgn-forgot  { animation: lgn-fade .35s ease                          .66s both; will-change:opacity; }

  /* Particle dots */
  .lgn-p1 { animation: lgn-twinkle 3.6s ease-in-out .3s  infinite; will-change:opacity,transform; }
  .lgn-p2 { animation: lgn-twinkle 4.2s ease-in-out 1.2s infinite; will-change:opacity,transform; }
  .lgn-p3 { animation: lgn-twinkle 5.0s ease-in-out .8s  infinite; will-change:opacity,transform; }
  .lgn-p4 { animation: lgn-twinkle 4.6s ease-in-out 2.1s infinite; will-change:opacity,transform; }
  .lgn-p5 { animation: lgn-twinkle 3.8s ease-in-out 1.5s infinite; will-change:opacity,transform; }

  /* Float & pulse — slow & smooth */
  .lgn-float { animation: lgn-float 7s ease-in-out infinite; will-change:transform; }
  .lgn-pulse { animation: lgn-pulse-dot 2.8s ease-in-out infinite; will-change:opacity,transform; }

  /* Error — rise then gentle shake */
  .lgn-error { animation: lgn-rise .2s ease both, lgn-shake .3s ease .21s both; will-change:opacity,transform; }
`;

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };



  const handleLogin = async () => {
    if (!form.email || !form.password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      // NOTE: Per your request, the password is now sent in plaintext.
      // This is generally not recommended for security reasons.
      const loginRes = await axios.post(`/api/auth/login`, {
        grant_type: "password",
        email: form.email,
        password: form.password,
      });

      const { token } = loginRes.data;

      if (!token) {
        setError("Login failed. No token received.");
        setLoading(false);
        return;
      }

      const decodedUser = jwtDecode(token);

      if (!decodedUser || !decodedUser.roles) {
        setError("Invalid token or user data not found.");
        setLoading(false);
        return;
      }

      // Check if the user is active before proceeding
      // The backend now handles this, but it's good practice to keep the check for a quick client-side message.
      if (decodedUser.is_active === false) {
        setError(
          "Your account is inactive. Please contact your administrator."
        );
        setLoading(false);
        return;
      }

      const userRole = decodedUser.roles.toLowerCase();

      let tenantId = decodedUser.tenant_id;
      let tableConfigExists = true; // Assume config exists for all users now

      // Skip fetching tenant modules - use default empty object
      const tenantModules = {};

      // Fetch tenant name from the ap_tenants table
      let tenantName = '';
      if (tenantId && userRole !== 'super_admin') {
        try {
          const tenantResponse = await axios.get(`/api/v1/tables/ap_tenants?tenant_id=eq.${tenantId}&select=tenant_name`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (tenantResponse.data && tenantResponse.data.length > 0) {
            tenantName = tenantResponse.data[0].tenant_name || '';
          }
        } catch (tenantError) {
          console.error('Error fetching tenant name:', tenantError);
          // Continue with empty tenantName if fetching fails
          tenantName = '';
        }
      } else if (userRole === 'super_admin') {
        tenantName = 'Super Admin Mode';
      }

      const userData = {
        name: decodedUser.user_name || "",
        user_id: decodedUser.user_id,
        companyName: decodedUser.company_name,
        email: decodedUser.email,
        role: userRole,
        tenantId: tenantId,
        tenantName: tenantName, // Add tenant name to user data
        TableConfigExists: tableConfigExists,
        token: token,
      };  
      
      console.log('User Data:', userData);

      dispatch(setAuth({ user: userData, token }));
      // ✅ Schedule proactive token refresh here (outside the reducer, as side effects must not live in reducers)
      scheduleTokenRefresh(token);

      // Navigate immediately after setting auth state to avoid timing issues
      if (userData.role === "super_admin" || userData.TableConfigExists) {
        navigate("/dashboard");
      } else if (userData.role === "admin") {
        navigate("/configure");
      } else {
        toast.warn(
          "🚫 Login Successful, but process not configured. Please contact your Manager.",
          { position: "top-center" }
        );
        navigate("/dashboard");
      }
    } catch (err) {
      if (err.response && err.response.status === 423) {
        setError(err.response?.data?.message);
        setLoading(false);
        return; // ⛔ Stop further processing
      }

      // ❌ Invalid credentials
      if (err.response?.status === 401) {
        setError(
          err.response.data?.error || "Invalid email or password."
        );
        return;
      }

      // 🚫 Forbidden / inactive
      if (err.response?.status === 403) {
        setError(err.response.data?.error || "Access forbidden.");
        return;
      }

      // ⚠️ Fallback
      setError("Login failed. Please check your credentials and try again.");

      // if (err.response && err.response.status === 401) {
      //   setError("Invalid email or password.");
      // } else if (err.response && err.response.status === 403) {
      //   setError(err.response.data.error); // Display the specific inactive message from the backend
      // } else {
      //   setError("Login failed. Please check your credentials and try again.");
      // }
    } finally {
      setLoading(false);
    }
  };


  // New function to handle the 'Enter' key press
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };


  return (
    <div className="lgn-page min-h-screen flex bg-[hsl(210,20%,98%)]">
      <style>{ANIMATIONS}</style>
      {/* Left brand panel */}
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

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50" onKeyDown={handleKeyDown}>
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 text-center">
            <img src={logoImage} alt="APEdge Logo" className="h-14 mx-auto mb-4" />
          </div>

          <div className="mb-8">
            <h2 className="lgn-title text-2xl font-bold text-gray-800 tracking-tight">Welcome back</h2>
            <p className="lgn-desc text-gray-500 text-sm mt-1.5">Sign in to continue to your dashboard</p>
          </div>

          {error && (
            <div key={error} className="lgn-error mb-5 p-3.5 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2.5 border border-red-200">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Gradient divider */}
            <div className="lgn-divider h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,#e5e7eb 30%,#e5e7eb 70%,transparent)' }} />

            {/* Email Field */}
            <div className="lgn-f1">
              <label htmlFor="email" className="text-sm font-medium text-gray-600 mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={handleChange}
                  className="lgn-input w-full pl-10 pr-4 h-12 rounded-xl bg-gray-100 border border-gray-200 transition-all text-gray-800 text-sm"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="lgn-f2">
              <label htmlFor="password" className="text-sm font-medium text-gray-600 mb-2 block">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  className="lgn-input w-full pl-10 pr-12 h-12 rounded-xl bg-gray-100 border border-gray-200 transition-all text-gray-800 text-sm"
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
            </div>

            {/* Sign In Button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="lgn-btn lgn-shine w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 border-none cursor-pointer transition-all duration-200 disabled:cursor-not-allowed"
              style={{
                background: loading
                  ? '#e5e7eb'
                  : 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)',
                color: loading ? '#9ca3af' : '#fff',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(192,57,43,0.35)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(192,57,43,0.45)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(192,57,43,0.35)'; }}
              onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'translateY(0px)'; }}
            >
              {loading ? (
                <div className="lgn-spinner" />
              ) : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </button>
          </div>

          {/* Forgot Password */}
          <div className="lgn-forgot mt-6 text-center">
            <span
              onClick={() => navigate("/forgetpassword")}
              className="text-sm text-gray-400 hover:text-blue-500 cursor-pointer transition-colors"
            >
              Forgot Password?
            </span>
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

export default Login;
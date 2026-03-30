import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { store } from '../store/store';
import { clearAuth, setAuth } from '../store/authSlice';
import { clearSecureData } from './secureStorage';

// Flag to prevent multiple simultaneous refresh requests
let isRefreshing = false;
// Queue to hold requests while refresh is happening
let failedQueue = [];
// Timer for proactive token refresh
let refreshTimeout = null;
// Retry counter to avoid infinite refresh loops
let refreshRetries = 0;
const MAX_REFRESH_RETRIES = 2;

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Create axios instance for refresh requests to avoid interceptor recursion
const refreshAxios = axios.create();

// Function to clear any existing refresh timeout
export const clearRefreshTimeout = () => {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
};

// Function to schedule proactive token refresh.
// ✅ Called at the call site (after dispatching setAuth/updateToken), NOT inside Redux reducers.
export const scheduleTokenRefresh = (token) => {
  clearRefreshTimeout();

  if (!token) return;

  try {
    const decodedToken = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    const timeToExpire = decodedToken.exp - currentTime;

    // Refresh token 1 minute (60 seconds) before expiration
    const refreshThreshold = 60;

    if (timeToExpire > refreshThreshold) {
      const delay = (timeToExpire - refreshThreshold) * 1000;
      refreshTimeout = setTimeout(() => {
        refreshToken(token);
      }, delay);
    } else if (timeToExpire > 0) {
      // Already within threshold but not yet expired — refresh immediately
      refreshToken(token);
    } else {
      // Token already expired — do not auto-refresh; let the user log in again
      console.warn('Token is already expired');
    }
  } catch (error) {
    // If token decoding fails, don't clear auth state.
    // Individual API calls will handle 401 errors naturally.
    console.error('Error scheduling token refresh:', error);
  }
};

// Function to refresh the token
const refreshToken = async (currentToken) => {
  if (isRefreshing) return;

  isRefreshing = true;

  try {
    const res = await refreshAxios.post(`/api/auth/login`, {
      grant_type: 'refresh_token',
      refresh_token: currentToken,
    });

    if (res.data.token) {
      // ✅ Reset retry counter on success
      refreshRetries = 0;

      // Update Redux with new token
      store.dispatch(setAuth({
        user: store.getState().auth.user,
        token: res.data.token
      }));

      // ✅ Schedule next refresh at the call site, outside the reducer
      scheduleTokenRefresh(res.data.token);

      processQueue(null, res.data.token);
    } else {
      throw new Error('No token received from refresh endpoint');
    }
  } catch (refreshError) {
    refreshRetries++;

    // ✅ Clear auth on ANY 4xx response from the refresh endpoint, not just 401.
    // Refresh endpoints commonly return 400 (bad/expired token) or 403 (forbidden)
    // instead of 401. Checking only for 401 meant these errors would silently
    // increment refreshRetries until MAX_REFRESH_RETRIES was hit, causing clearAuth
    // to fire unexpectedly during navigation rather than immediately.
    // Network errors / 5xx (no response or server fault) still use the retry counter
    // so a transient server hiccup doesn't log the user out.
    const isClientError = refreshError.response?.status >= 400 && refreshError.response?.status < 500;
    if (isClientError || refreshRetries >= MAX_REFRESH_RETRIES) {
      refreshRetries = 0;
      store.dispatch(clearAuth());
    }

    processQueue(refreshError, null);

    return Promise.reject(refreshError);
  } finally {
    isRefreshing = false;
  }
};

// Request interceptor — attach the latest token from Redux to every outgoing request
axios.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;

    // Skip adding token for login/refresh requests to avoid circular calls
    const isAuthRequest = config.url?.includes('/api/auth/login');

    if (token && !isAuthRequest) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor — handle 401 errors and trigger token refresh
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Don't retry auth requests (login/refresh) to avoid infinite loops
    const isAuthRequest = originalRequest.url?.includes('/api/auth/login');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Already refreshing — queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axios(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      isRefreshing = true;

      try {
        const state = store.getState();
        const currentToken = state.auth.token;

        if (!currentToken) {
          throw new Error('No token available for refresh');
        }

        const res = await refreshAxios.post(`/api/auth/login`, {
          grant_type: 'refresh_token',
          refresh_token: currentToken,
        });

        if (res.data.token) {
          // ✅ Reset retry counter on success
          refreshRetries = 0;

          // Update Redux with new token
          store.dispatch(setAuth({
            user: store.getState().auth.user,
            token: res.data.token
          }));

          // ✅ Schedule next refresh outside the reducer
          scheduleTokenRefresh(res.data.token);

          originalRequest.headers.Authorization = `Bearer ${res.data.token}`;
          processQueue(null, res.data.token);

          return axios(originalRequest);
        } else {
          throw new Error('No token received from refresh endpoint');
        }
      } catch (refreshError) {
        refreshRetries++;

        // ✅ Same fix: clear auth on any 4xx from refresh, retry on network/5xx errors
        const isClientError = refreshError.response?.status >= 400 && refreshError.response?.status < 500;
        if (isClientError || refreshRetries >= MAX_REFRESH_RETRIES) {
          refreshRetries = 0;
          store.dispatch(clearAuth());
        }

        processQueue(refreshError, null);

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axios;
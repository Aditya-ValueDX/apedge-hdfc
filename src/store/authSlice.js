import { createSlice } from "@reduxjs/toolkit";
import { saveSecure, clearSecureData } from '../utils/secureStorage';
// scheduleTokenRefresh is NO longer imported here — call it at the dispatch call site

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  },
  reducers: {
    setAuth: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = !!action.payload.token;

      // Persist to secure storage
      saveSecure("user", state.user);
      saveSecure("token", state.token);

      // ✅ No side effects (scheduleTokenRefresh) here anymore.
      // Call scheduleTokenRefresh(token) at the call site after dispatching setAuth.
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      clearSecureData();
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    updateToken: (state, action) => {
      state.token = action.payload;
      saveSecure("token", state.token);

      // ✅ No side effects here anymore.
      // Call scheduleTokenRefresh(token) at the call site after dispatching updateToken.
    },
    updateUserProperty: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        saveSecure("user", state.user);
      }
    }
  },
});

export const { setAuth, clearAuth, setLoading, updateToken, updateUserProperty } = authSlice.actions;
export default authSlice.reducer;
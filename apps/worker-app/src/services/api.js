import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000'; // 10.0.2.2 = localhost on Android emulator

// ─── Axios instance ───────────────────────────────────────────────────
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
        const newToken = data.data.token;
        await SecureStore.setItemAsync('auth_token', newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('refresh_token');
        // Navigator will redirect to login via auth state
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────
export const sendOTP = (phone, role) =>
  api.post('/auth/send-otp', { phone, role });

export const verifyOTP = (phone, code, role, fullName) =>
  api.post('/auth/verify-otp', { phone, code, role, fullName });

export const refreshToken = (token) =>
  api.post('/auth/refresh', { refreshToken: token });

export const getMe = () => api.get('/auth/me');

// ─── Worker ───────────────────────────────────────────────────────────
export const getWorkerProfile = () => api.get('/workers/me');

export const updateWorkerProfile = (data) => api.put('/workers/me', data);

export const setAvailability = (isAvailable, availableFrom) =>
  api.post('/workers/me/availability', { isAvailable, availableFrom });

export const initiateKYC = (aadhaarNumber) =>
  api.post('/workers/me/kyc/initiate', { aadhaarNumber });

export const verifyKYC = (requestId, otp, selfieBase64) =>
  api.post('/workers/me/kyc/verify', { requestId, otp, selfieBase64 });

export const saveBankDetails = (upiId) =>
  api.put('/workers/me/bank-details', { upiId });

// ─── Gigs ─────────────────────────────────────────────────────────────
export const getGigMatches = (page = 1, limit = 10) =>
  api.get('/gigs/matches', { params: { page, limit } });

export const getMyGigs = (status) =>
  api.get('/gigs', { params: status ? { status } : {} });

export const getGigDetail = (gigId) => api.get(`/gigs/${gigId}`);

export const acceptGig = (gigId, agreedAmount) =>
  api.post(`/gigs/${gigId}/accept`, { agreedAmount });

export const checkinGig = (gigId, lat, lng) =>
  api.post(`/gigs/${gigId}/checkin`, { lat, lng });

export const completeGig = (gigId, notes) =>
  api.post(`/gigs/${gigId}/complete`, { notes });

export const raiseDispute = (gigId, reason, description) =>
  api.post(`/gigs/${gigId}/dispute`, { reason, description });

// ─── Reviews ──────────────────────────────────────────────────────────
export const submitReview = (gigId, rating, comment, extra = {}) =>
  api.post('/reviews', { gigId, rating, comment, ...extra });

// ─── Trades ───────────────────────────────────────────────────────────
export const getTrades = () => api.get('/trades');

// ─── Payments ─────────────────────────────────────────────────────────
export const getPaymentHistory = () => api.get('/payments/history');

// ─── Token storage helpers ────────────────────────────────────────────
export const storeTokens = async (token, refreshTok) => {
  await SecureStore.setItemAsync('auth_token', token);
  await SecureStore.setItemAsync('refresh_token', refreshTok);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync('auth_token');
  await SecureStore.deleteItemAsync('refresh_token');
};

export const getStoredToken = () => SecureStore.getItemAsync('auth_token');

export default api;

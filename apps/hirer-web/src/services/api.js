import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({ baseURL: `${BASE}/api`, timeout: 15000 });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ks_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  r => r,
  async (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const refresh = localStorage.getItem('ks_refresh');
      if (refresh && !err.config._retry) {
        err.config._retry = true;
        try {
          const { data } = await axios.post(`${BASE}/api/auth/refresh`, { refreshToken: refresh });
          localStorage.setItem('ks_token', data.data.token);
          err.config.headers.Authorization = `Bearer ${data.data.token}`;
          return api(err.config);
        } catch {
          localStorage.removeItem('ks_token');
          localStorage.removeItem('ks_refresh');
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const sendOTP   = (phone, role) => api.post('/auth/send-otp', { phone, role });
export const verifyOTP = (phone, code, role, fullName) =>
  api.post('/auth/verify-otp', { phone, code, role, fullName });
export const getMe     = () => api.get('/auth/me');

// Hirer profile
export const getHirerProfile    = ()     => api.get('/hirers/me');
export const updateHirerProfile = (data) => api.put('/hirers/me', data);

// Gigs
export const createGig    = (data)  => api.post('/gigs', data);
export const getMyGigs    = (status) => api.get('/gigs', { params: status ? { status } : {} });
export const getGigDetail = (id)    => api.get(`/gigs/${id}`);
export const confirmGig   = (id)    => api.post(`/gigs/${id}/confirm`);
export const raiseDispute = (id, reason, description) =>
  api.post(`/gigs/${id}/dispute`, { reason, description });

// Workers
export const getWorkerProfile = (workId) => api.get(`/workers/${workId}/profile`);

// Payments
export const initiatePayment    = (gigId, agreedAmountPaise) =>
  api.post('/payments/initiate', { gigId, agreedAmountPaise });
export const getPaymentHistory  = () => api.get('/payments/history');

// Reviews
export const submitReview = (gigId, rating, comment) =>
  api.post('/reviews', { gigId, rating, comment });

// Trades
export const getTrades = () => api.get('/trades');

export const storeTokens = (token, refresh) => {
  localStorage.setItem('ks_token', token);
  localStorage.setItem('ks_refresh', refresh);
};
export const clearTokens = () => {
  localStorage.removeItem('ks_token');
  localStorage.removeItem('ks_refresh');
};

export default api;

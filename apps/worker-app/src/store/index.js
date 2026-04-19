import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as API from '../services/api';

// ─── Auth slice ───────────────────────────────────────────────────────
export const loginWithOTP = createAsyncThunk(
  'auth/loginWithOTP',
  async ({ phone, code, role, fullName }, { rejectWithValue }) => {
    try {
      const { data } = await API.verifyOTP(phone, code, role, fullName);
      await API.storeTokens(data.data.token, data.data.refreshToken);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

export const loadCurrentUser = createAsyncThunk(
  'auth/loadCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.getMe();
      return data.data;
    } catch {
      return rejectWithValue(null);
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await API.clearTokens();
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, token: null, loading: false, error: null, bootstrapped: false },
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginWithOTP.pending,  (s) => { s.loading = true; s.error = null; })
      .addCase(loginWithOTP.fulfilled,(s, { payload }) => {
        s.loading = false; s.user = payload.user; s.token = payload.token;
      })
      .addCase(loginWithOTP.rejected, (s, { payload }) => {
        s.loading = false; s.error = payload;
      })
      .addCase(loadCurrentUser.fulfilled, (s, { payload }) => {
        s.user = payload; s.bootstrapped = true;
      })
      .addCase(loadCurrentUser.rejected,  (s) => { s.bootstrapped = true; })
      .addCase(logout.fulfilled, (s) => {
        s.user = null; s.token = null;
      });
  },
});

// ─── Worker profile slice ─────────────────────────────────────────────
export const fetchWorkerProfile = createAsyncThunk(
  'worker/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.getWorkerProfile();
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load profile');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'worker/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      await API.updateWorkerProfile(profileData);
      const { data } = await API.getWorkerProfile();
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Update failed');
    }
  }
);

export const toggleAvailability = createAsyncThunk(
  'worker/toggleAvailability',
  async (isAvailable, { rejectWithValue }) => {
    try {
      await API.setAvailability(isAvailable);
      return isAvailable;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed');
    }
  }
);

const workerSlice = createSlice({
  name: 'worker',
  initialState: { profile: null, loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorkerProfile.pending,   (s) => { s.loading = true; })
      .addCase(fetchWorkerProfile.fulfilled, (s, { payload }) => {
        s.loading = false; s.profile = payload;
      })
      .addCase(fetchWorkerProfile.rejected,  (s, { payload }) => {
        s.loading = false; s.error = payload;
      })
      .addCase(updateProfile.fulfilled,      (s, { payload }) => { s.profile = payload; })
      .addCase(toggleAvailability.fulfilled, (s, { payload }) => {
        if (s.profile) s.profile.is_available = payload;
      });
  },
});

// ─── Gigs slice ───────────────────────────────────────────────────────
export const fetchGigMatches = createAsyncThunk(
  'gigs/fetchMatches',
  async ({ page = 1 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.getGigMatches(page);
      return { gigs: data.data, pagination: data.pagination, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load gigs');
    }
  }
);

export const fetchMyGigs = createAsyncThunk(
  'gigs/fetchMyGigs',
  async (status, { rejectWithValue }) => {
    try {
      const { data } = await API.getMyGigs(status);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed');
    }
  }
);

export const fetchGigDetail = createAsyncThunk(
  'gigs/fetchDetail',
  async (gigId, { rejectWithValue }) => {
    try {
      const { data } = await API.getGigDetail(gigId);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Not found');
    }
  }
);

export const acceptGigAction = createAsyncThunk(
  'gigs/accept',
  async ({ gigId, agreedAmount }, { rejectWithValue }) => {
    try {
      await API.acceptGig(gigId, agreedAmount);
      return gigId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to accept');
    }
  }
);

const gigsSlice = createSlice({
  name: 'gigs',
  initialState: {
    matches: [], myGigs: [], activeGig: null,
    loading: false, error: null,
    pagination: { total: 0, page: 1, hasMore: false },
  },
  reducers: {
    clearGigError: (s) => { s.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGigMatches.pending,    (s) => { s.loading = true; s.error = null; })
      .addCase(fetchGigMatches.fulfilled,  (s, { payload }) => {
        s.loading = false;
        s.matches = payload.page === 1
          ? payload.gigs
          : [...s.matches, ...payload.gigs];
        s.pagination = payload.pagination || s.pagination;
      })
      .addCase(fetchGigMatches.rejected,   (s, { payload }) => { s.loading = false; s.error = payload; })
      .addCase(fetchMyGigs.fulfilled,      (s, { payload }) => { s.myGigs = payload; })
      .addCase(fetchGigDetail.fulfilled,   (s, { payload }) => { s.activeGig = payload; })
      .addCase(acceptGigAction.fulfilled,  (s, { payload }) => {
        s.matches = s.matches.filter(g => g.id !== payload);
      });
  },
});

// ─── Store ────────────────────────────────────────────────────────────
const store = configureStore({
  reducer: {
    auth:   authSlice.reducer,
    worker: workerSlice.reducer,
    gigs:   gigsSlice.reducer,
  },
});

export const { clearError }    = authSlice.actions;
export const { clearGigError } = gigsSlice.actions;
export default store;

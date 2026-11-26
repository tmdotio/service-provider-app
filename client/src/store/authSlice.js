import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api, {
  getErrorMessage,
  refreshAccessToken,
  setAccessToken,
} from "../api/axios";
import { clearFetchCache } from "../hooks/useFetch";

/**
 * Load the full profile (get-me also returns providerProfile for providers).
 */
export const fetchMe = createAsyncThunk("auth/fetchMe", async () => {
  const res = await api.get("/auth/get-me");
  return res.data.data;
});

/**
 * On page load: the access token lives only in memory, so use the
 * refresh-token cookie to get a new one and load the user.
 */
export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async (_, { dispatch }) => {
    try {
      await refreshAccessToken();
      return await dispatch(fetchMe()).unwrap();
    } catch {
      return null;
    }
  },
);

// rejectWithValue sends the server's message (e.g. "Invalid email or password")
export const login = createAsyncThunk(
  "auth/login",
  async (credentials, { dispatch, rejectWithValue }) => {
    try {
      clearFetchCache();
      const res = await api.post("/auth/login", credentials);
      setAccessToken(res.data.accessToken);
      return await dispatch(fetchMe()).unwrap();
    } catch (err) {
      return rejectWithValue(getErrorMessage(err));
    }
  },
);

export const register = createAsyncThunk(
  "auth/register",
  async (data, { dispatch, rejectWithValue }) => {
    try {
      clearFetchCache();
      const res = await api.post("/auth/register", data);
      setAccessToken(res.data.accessToken);
      return await dispatch(fetchMe()).unwrap();
    } catch (err) {
      return rejectWithValue(getErrorMessage(err));
    }
  },
);

export const logout = createAsyncThunk("auth/logout", async () => {
  clearFetchCache();
  try {
    await api.post("/auth/logout");
  } finally {
    setAccessToken(null);
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    // true until we know if the user is logged in (avoids flashing the login page)
    initializing: true,
  },
  reducers: {
    clearUser(state) {
      state.user = null;
    },
    updateUser(state, action) {
      state.user = { ...state.user, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.initializing = false;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
      })
      .addCase(logout.rejected, (state) => {
        state.user = null;
      });
  },
});

export const { clearUser, updateUser } = authSlice.actions;
export default authSlice.reducer;

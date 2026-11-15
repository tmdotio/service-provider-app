import axios from "axios";

/**
 * One Axios instance for the whole app.
 *
 * - Adds the access token to every request.
 * - When a request fails with 401 (token expired), it calls
 *   /auth/refresh-token once, then retries the original request.
 *   If many requests fail at the same time, they all wait for the
 *   same refresh call.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true, // send the httpOnly refresh-token cookie
});

let accessToken = null;
let onLogout = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};

export const setLogoutHandler = (handler) => {
  onLogout = handler;
};

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${api.defaults.baseURL}/auth/refresh-token`, null, {
        withCredentials: true,
      })
      .then((res) => {
        setAccessToken(res.data.accessToken);
        return res.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const AUTH_URLS = ["/auth/login", "/auth/register", "/auth/refresh-token"];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthUrl = AUTH_URLS.some((url) => original?.url?.includes(url));

    if (error.response?.status === 401 && !original._retry && !isAuthUrl) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        setAccessToken(null);
        onLogout();
      }
    }

    return Promise.reject(error);
  },
);

/** Readable message from any API error. */
export const getErrorMessage = (error) => {
  const data = error?.response?.data;
  if (data?.errors?.length) return data.errors[0].message;
  return data?.message || error?.message || "Something went wrong";
};

export default api;

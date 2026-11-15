import { configureStore } from "@reduxjs/toolkit";
import { setLogoutHandler } from "../api/axios";
import authReducer, { clearUser } from "./authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

// If the refresh token is no longer valid, clear the user everywhere
setLogoutHandler(() => store.dispatch(clearUser()));

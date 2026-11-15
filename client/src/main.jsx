import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router";
import App from "./App";
import "./index.css";
import { restoreSession } from "./store/authSlice";
import { store } from "./store/store";

// Log the user back in from the refresh-token cookie (if any)
store.dispatch(restoreSession());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);

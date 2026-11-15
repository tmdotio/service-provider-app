import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import Navbar, { MobileTabBar } from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Account from "./pages/Account";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Feed from "./pages/Feed";
import Home from "./pages/Home";
import Login from "./pages/Login";
import MyBookings from "./pages/MyBookings";
import ProviderDashboard from "./pages/provider/ProviderDashboard";
import ProviderProfile from "./pages/ProviderProfile";
import Providers from "./pages/Providers";
import Register from "./pages/Register";
import { DisplayTitle } from "./components/ui";
import { APP_NAME, APP_TAGLINE } from "./utils/format";
import { initSmoothScroll, scrollToTop } from "./utils/smoothScroll";

const YEAR = new Date().getFullYear();

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <DisplayTitle className="text-7xl">404</DisplayTitle>
      <p className="mt-4 text-muted">This page does not exist.</p>
      <Link to="/" className="btn-primary mt-6">Go home</Link>
    </div>
  );
}

/** Start smooth scrolling once, and jump to the top on every page change. */
function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    initSmoothScroll();
  }, []);
  useEffect(() => {
    scrollToTop();
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollManager />
      <Navbar />
      {/* Extra space at the bottom on phones so the tab bar never covers content */}
      <main className="flex-1 pb-28 md:pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/providers/:id" element={<ProviderProfile />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<Account />} />
          </Route>
          {/* Providers keep the bookings they made as customers */}
          <Route element={<ProtectedRoute roles={["customer", "provider"]} />}>
            <Route path="/bookings" element={<MyBookings />} />
          </Route>
          <Route element={<ProtectedRoute roles={["provider"]} />}>
            <Route path="/provider" element={<ProviderDashboard />} />
          </Route>
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          {/* Old link: applying is now a popup on the profile page */}
          <Route path="/become-provider" element={<Navigate to="/account" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="mt-10 hidden border-t border-line md:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted">
          <span>
            © {YEAR} <span className="font-semibold text-fg">{APP_NAME}</span> · {APP_TAGLINE}
          </span>
          <span>Built with the MERN stack</span>
        </div>
      </footer>
      <MobileTabBar />
      <Toaster
        position="top-center"
        toastOptions={{
          className: "!rounded-full !bg-fg !text-bg !text-sm !font-semibold",
        }}
      />
    </div>
  );
}

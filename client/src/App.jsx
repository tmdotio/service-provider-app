import { Toaster } from "react-hot-toast";
import { Link, Navigate, Route, Routes } from "react-router";
import Navbar from "./components/Navbar";
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

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
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
          <Route element={<ProtectedRoute roles={["customer"]} />}>
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
      <footer className="mt-10 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted">
          <span>
            © {YEAR} <span className="font-semibold text-fg">{APP_NAME}</span> · {APP_TAGLINE}
          </span>
          <span>Built with the MERN stack</span>
        </div>
      </footer>
      <Toaster
        position="top-center"
        toastOptions={{
          className: "!rounded-full !bg-fg !text-bg !text-sm !font-semibold",
        }}
      />
    </div>
  );
}

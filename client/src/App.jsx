import { Toaster } from "react-hot-toast";
import { Link, Route, Routes } from "react-router";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Account from "./pages/Account";
import AdminDashboard from "./pages/admin/AdminDashboard";
import BecomeProvider from "./pages/BecomeProvider";
import Feed from "./pages/Feed";
import Home from "./pages/Home";
import Login from "./pages/Login";
import MyBookings from "./pages/MyBookings";
import ProviderDashboard from "./pages/provider/ProviderDashboard";
import ProviderProfile from "./pages/ProviderProfile";
import Providers from "./pages/Providers";
import Register from "./pages/Register";
import { APP_NAME } from "./utils/format";

const YEAR = new Date().getFullYear();

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <p className="mt-2 text-gray-600">This page does not exist.</p>
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
            <Route path="/become-provider" element={<BecomeProvider />} />
          </Route>
          <Route element={<ProtectedRoute roles={["provider"]} />}>
            <Route path="/provider" element={<ProviderDashboard />} />
          </Route>
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="border-t bg-white py-6 text-center text-sm text-gray-500">
        © {YEAR} {APP_NAME} · Built with the MERN stack
      </footer>
      <Toaster position="top-center" />
    </div>
  );
}

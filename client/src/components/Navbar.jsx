import { LogOut, Menu, User, Wrench, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { Link, NavLink, useNavigate } from "react-router";
import useAuth from "../hooks/useAuth";
import { logout } from "../store/authSlice";
import { APP_NAME } from "../utils/format";
import NotificationBell from "./NotificationBell";
import { Avatar } from "./ui";

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
  }`;

export default function Navbar() {
  const { user, isCustomer, isProvider, isAdmin } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: "/providers", label: "Find providers" },
    { to: "/feed", label: "Work feed" },
    ...(isCustomer
      ? [
          { to: "/bookings", label: "My bookings" },
          { to: "/become-provider", label: "Become a provider" },
        ]
      : []),
    ...(isProvider ? [{ to: "/provider", label: "Dashboard" }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  const handleLogout = async () => {
    await dispatch(logout());
    toast.success("Logged out");
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-700">
          <Wrench className="h-6 w-6" />
          {APP_NAME}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <Link to="/account" className="hidden items-center gap-2 rounded-lg p-1 hover:bg-gray-100 sm:flex">
                <Avatar user={user} size="h-8 w-8" />
                <span className="max-w-28 truncate text-sm font-medium">{user.name}</span>
              </Link>
              <button onClick={handleLogout} className="btn-ghost hidden p-2 sm:inline-flex" aria-label="Log out">
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login" className="btn-ghost">Log in</Link>
              <Link to="/register" className="btn-primary">Sign up</Link>
            </div>
          )}
          <button
            className="btn-ghost p-2 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t bg-white px-4 py-3 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <NavLink to="/account" className={linkClass}>
                  <span className="flex items-center gap-2"><User className="h-4 w-4" /> Account</span>
                </NavLink>
                <button onClick={handleLogout} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={linkClass}>Log in</NavLink>
                <NavLink to="/register" className={linkClass}>Sign up</NavLink>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

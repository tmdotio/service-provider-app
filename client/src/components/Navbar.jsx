import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { Link, NavLink, useNavigate } from "react-router";
import useAuth from "../hooks/useAuth";
import useTheme from "../hooks/useTheme";
import { logout } from "../store/authSlice";
import { APP_NAME } from "../utils/format";
import NotificationBell from "./NotificationBell";
import { Avatar, TargetO } from "./ui";

const linkClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive ? "bg-fg text-bg" : "text-muted hover:text-fg"
  }`;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fg">
        <TargetO className="h-5 w-5" />
      </span>
      {APP_NAME}
    </Link>
  );
}

export default function Navbar() {
  const { user, isProvider, isAdmin, isCustomer } = useAuth();
  const { theme, toggle } = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: "/providers", label: "Find pros" },
    { to: "/feed", label: "Work board" },
    ...(isCustomer ? [{ to: "/bookings", label: "My bookings" }] : []),
    ...(isProvider ? [{ to: "/provider", label: "Dashboard" }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  const handleLogout = async () => {
    await dispatch(logout());
    toast.success("Logged out");
    navigate("/");
  };

  const themeButton = (
    <button
      onClick={toggle}
      className="icon-btn h-10 w-10"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4">
      <div className="glass mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 rounded-full pl-3 pr-2 shadow-lg shadow-black/5">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {themeButton}
          {user ? (
            <>
              <NotificationBell />
              <Link to="/account" className="hidden items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-surface-2 sm:flex">
                <Avatar user={user} size="h-9 w-9" />
                <span className="max-w-28 truncate text-sm font-semibold">{user.name}</span>
              </Link>
              <button onClick={handleLogout} className="icon-btn hidden h-10 w-10 sm:inline-flex" aria-label="Log out">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <Link to="/login" className="btn-ghost">Log in</Link>
              <Link to="/register" className="btn-primary">Sign up</Link>
            </div>
          )}
          <button className="icon-btn h-10 w-10 md:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="glass mx-auto mt-2 max-w-6xl rounded-[28px] p-3 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>
            ))}
            {user ? (
              <>
                <NavLink to="/account" className={linkClass}>My profile</NavLink>
                <button onClick={handleLogout} className="rounded-full px-4 py-2 text-left text-sm font-semibold text-rose-500">Log out</button>
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

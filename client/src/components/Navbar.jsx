import { LogOut, MessageCircle, Moon, Sun } from "lucide-react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { Link, NavLink, useNavigate } from "react-router";
import useAuth from "../hooks/useAuth";
import { useChatUnread } from "../hooks/useChat";
import useNavLinks from "../hooks/useNavLinks";
import useTheme from "../hooks/useTheme";
import { logout } from "../store/authSlice";
import { APP_NAME } from "../utils/format";
import NotificationBell from "./NotificationBell";
import { Avatar, TargetO } from "./ui";

const linkClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive ? "bg-fg text-bg" : "text-muted hover:text-fg"
  }`;

export function Logo({ to = "/" }) {
  return (
    <Link to={to} className="flex items-center gap-2 text-lg font-bold tracking-tight" aria-label={`${APP_NAME} home`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fg">
        <TargetO className="h-5 w-5" />
      </span>
      <span className="hidden min-[360px]:inline">{APP_NAME}</span>
    </Link>
  );
}

/** Chat icon with the number of unread messages. */
function MessagesLink() {
  const unread = useChatUnread();
  return (
    <NavLink
      to="/messages"
      className={({ isActive }) => `icon-btn relative h-10 w-10 ${isActive ? "!bg-fg !text-bg" : ""}`}
      aria-label={`Messages${unread ? ` (${unread} unread)` : ""}`}
    >
      <MessageCircle className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink ring-2 ring-surface">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </NavLink>
  );
}

/** Top bar (all screens). On phones the page links move to the bottom tab bar. */
export default function Navbar() {
  const { user } = useAuth();
  const { home, links } = useNavLinks();
  const { theme, toggle } = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await dispatch(logout());
    toast.success("Logged out");
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
      <div className="glass mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 rounded-full pl-3 pr-2 shadow-lg shadow-black/5">
        <Logo to={home} />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links
            .filter((l) => l.desktop !== false)
            .map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="icon-btn h-10 w-10"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          {user ? (
            <>
              {user.role !== "admin" && <MessagesLink />}
              <NotificationBell />
              <Link to="/account" className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-surface-2 sm:py-1 sm:pl-1 sm:pr-3" aria-label="My profile">
                <Avatar user={user} size="h-9 w-9" />
                <span className="hidden max-w-28 truncate text-sm font-semibold sm:inline">{user.name}</span>
              </Link>
              <button onClick={handleLogout} className="icon-btn hidden h-10 w-10 md:inline-flex" aria-label="Log out">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <Link to="/login" className="btn-ghost hidden sm:inline-flex">Log in</Link>
              <Link to="/register" className="btn-primary">Sign up</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** App-style bottom tab bar for phones. */
export function MobileTabBar() {
  const { links } = useNavLinks();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      aria-label="Main"
    >
      <div className="glass mx-auto flex max-w-md items-stretch justify-around rounded-full p-1.5 shadow-2xl shadow-black/20">
        {links.map(({ to, label, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            aria-label={label}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] font-semibold transition ${
                isActive ? "bg-fg text-bg" : "text-muted active:bg-surface-2"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate">{short || label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

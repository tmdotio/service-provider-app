import {
  CalendarCheck,
  Compass,
  Home,
  Images,
  LayoutGrid,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";
import useAuth from "./useAuth";

/**
 * Menu items depend on who is logged in, so every role sees names
 * that make sense for them (a provider doesn't need "Find pros").
 *
 * `short` is the label in the phone bottom bar (space is tight there).
 * `desktop: false` items only show in the phone bottom bar (the top bar
 * already has the avatar and the logo for those).
 */
export default function useNavLinks() {
  const { isCustomer, isProvider, isAdmin, providerProfile } = useAuth();

  if (isProvider) {
    return {
      home: "/provider",
      links: [
        { to: "/provider", label: "Workspace", short: "Jobs", icon: LayoutGrid },
        ...(providerProfile ? [{ to: `/providers/${providerProfile._id}`, label: "My page", short: "My page", icon: Store }] : []),
        { to: "/feed", label: "Work board", short: "Board", icon: Images },
        { to: "/account", label: "Profile", icon: User, desktop: false },
      ],
    };
  }

  if (isAdmin) {
    return {
      home: "/admin",
      links: [
        { to: "/admin", label: "Control room", short: "Admin", icon: ShieldCheck },
        { to: "/providers", label: "Pros", icon: Compass },
        { to: "/feed", label: "Work board", short: "Board", icon: Images },
        { to: "/account", label: "Profile", icon: User, desktop: false },
      ],
    };
  }

  if (isCustomer) {
    return {
      home: "/",
      links: [
        { to: "/", label: "Home", icon: Home, desktop: false },
        { to: "/providers", label: "Find pros", short: "Pros", icon: Compass },
        { to: "/bookings", label: "Bookings", icon: CalendarCheck },
        { to: "/feed", label: "Work board", short: "Board", icon: Images },
        { to: "/account", label: "Profile", icon: User, desktop: false },
      ],
    };
  }

  // Guest
  return {
    home: "/",
    links: [
      { to: "/", label: "Home", icon: Home, desktop: false },
      { to: "/providers", label: "Find pros", short: "Pros", icon: Compass },
      { to: "/feed", label: "Work board", short: "Board", icon: Images },
      { to: "/login", label: "Log in", icon: User, desktop: false },
    ],
  };
}

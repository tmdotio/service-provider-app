import { useSelector } from "react-redux";

export default function useAuth() {
  const { user, initializing } = useSelector((state) => state.auth);

  return {
    user,
    initializing,
    isLoggedIn: Boolean(user),
    isCustomer: user?.role === "customer",
    isProvider: user?.role === "provider",
    isAdmin: user?.role === "admin",
    providerProfile: user?.providerProfile || null,
  };
}

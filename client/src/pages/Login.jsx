import { Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import AuthLayout from "../components/AuthLayout";
import { ErrorBox } from "../components/ui";
import useAuth from "../hooks/useAuth";
import { login } from "../store/authSlice";

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const me = await dispatch(login(form)).unwrap();
      toast.success(`Welcome back, ${me.name}!`);
      const home = { admin: "/admin", provider: "/provider" }[me.role] || "/";
      navigate(location.state?.from || home, { replace: true });
    } catch (err) {
      setError(typeof err === "string" ? err : "Could not log in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to book pros and track your jobs.">
        <form onSubmit={submit} className="space-y-4">
          <ErrorBox message={error} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button className="btn-primary h-12 w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Log in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          New here?{" "}
          <Link to="/register" className="font-medium text-accent hover:underline">Create an account</Link>
        </p>
    </AuthLayout>
  );
}

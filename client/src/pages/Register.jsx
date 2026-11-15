import { Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { Link, Navigate, useNavigate } from "react-router";
import { ErrorBox } from "../components/ui";
import useAuth from "../hooks/useAuth";
import { register } from "../store/authSlice";

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters");

    setLoading(true);
    const data = { ...form };
    if (!data.phone) delete data.phone;

    const result = await dispatch(register(data));
    setLoading(false);

    if (register.fulfilled.match(result)) {
      toast.success("Account created!");
      navigate("/");
    } else {
      setError(result.payload || "Could not create account");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">Create an account</h1>
        <p className="mt-1 text-sm text-gray-500">
          Book trusted providers. Want to offer services? Sign up first, then apply as a provider.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <ErrorBox message={error} />
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="input" required minLength={2} maxLength={50} value={form.name} onChange={set("name")} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="email" required value={form.email} onChange={set("email")} />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone (optional)</label>
            <input id="phone" className="input" placeholder="03001234567" pattern="\+?[0-9]{10,15}" value={form.phone} onChange={set("phone")} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} />
            <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign up
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}

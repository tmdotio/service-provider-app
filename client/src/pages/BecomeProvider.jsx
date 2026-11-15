import { Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import api, { getErrorMessage } from "../api/axios";
import { ErrorBox, PageHeader, Spinner } from "../components/ui";
import useFetch from "../hooks/useFetch";
import { fetchMe } from "../store/authSlice";

const PROVINCES = ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory", "Gilgit-Baltistan", "Azad Kashmir"];

export default function BecomeProvider() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const application = useFetch(() => api.get("/provider/application"), []);
  const status = application.data?.application?.verificationStatus;

  // Approved: reload my profile (role is now "provider") and open the dashboard
  useEffect(() => {
    if (status === "approved") {
      dispatch(fetchMe()).then(() => navigate("/provider", { replace: true }));
    }
  }, [status, dispatch, navigate]);
  const categories = useFetch(() => api.get("/categories"), []);

  const [form, setForm] = useState({
    businessName: "",
    businessPhone: "",
    description: "",
    experienceYears: "",
    categories: [],
    location: { city: "Lahore", province: "Punjab", country: "Pakistan" },
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (application.loading || status === "approved") return <Spinner className="py-20" />;

  // Already applied -> show status (rejected applications are deleted, so they can re-apply)
  if (application.data?.application) {
    const app = application.data.application;
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="card p-8 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h1 className="text-xl font-bold">Application {app.verificationStatus}</h1>
          <p className="mt-2 text-gray-600">
            <strong>{app.businessName}</strong> is waiting for admin approval. You'll get a notification
            when it is reviewed.
          </p>
        </div>
      </div>
    );
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const setLocation = (field) => (e) =>
    setForm({ ...form, location: { ...form.location, [field]: e.target.value } });

  const toggleCategory = (id) =>
    setForm({
      ...form,
      categories: form.categories.includes(id)
        ? form.categories.filter((c) => c !== id)
        : [...form.categories, id],
    });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.categories.length === 0) return setError("Select at least one service");

    setSaving(true);
    try {
      await api.post("/provider/become-provider", {
        ...form,
        experienceYears: Number(form.experienceYears),
      });
      toast.success("Application submitted!");
      application.refetch();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader title="Become a provider" subtitle="Tell customers about your work. An admin will check and approve your profile." />

      <form onSubmit={submit} className="card space-y-5 p-6">
        <ErrorBox message={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="businessName">Business name</label>
            <input id="businessName" className="input" required minLength={2} maxLength={100} value={form.businessName} onChange={set("businessName")} />
          </div>
          <div>
            <label className="label" htmlFor="businessPhone">Business phone</label>
            <input id="businessPhone" className="input" required pattern="\+?[0-9]{10,15}" placeholder="03001234567" value={form.businessPhone} onChange={set("businessPhone")} />
            <p className="mt-1 text-xs text-gray-500">Shared only with customers who book you</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">About your work</label>
          <textarea id="description" className="input min-h-24" maxLength={1000} value={form.description} onChange={set("description")} placeholder="What do you do best? Which areas do you cover?" />
        </div>

        <div>
          <label className="label" htmlFor="experienceYears">Years of experience</label>
          <input id="experienceYears" type="number" min="0" max="60" className="input max-w-32" required value={form.experienceYears} onChange={set("experienceYears")} />
        </div>

        <div>
          <p className="label">Services you offer</p>
          <div className="flex flex-wrap gap-2">
            {categories.data?.categories.map((c) => {
              const active = form.categories.includes(c._id);
              return (
                <button
                  type="button"
                  key={c._id}
                  onClick={() => toggleCategory(c._id)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    active ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300 bg-white text-gray-700"
                  }`}
                  aria-pressed={active}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="city">City</label>
            <input id="city" className="input" required value={form.location.city} onChange={setLocation("city")} />
          </div>
          <div>
            <label className="label" htmlFor="province">Province</label>
            <select id="province" className="input" value={form.location.province} onChange={setLocation("province")}>
              {PROVINCES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="country">Country</label>
            <input id="country" className="input" required value={form.location.country} onChange={setLocation("country")} />
          </div>
        </div>

        <button className="btn-primary" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit application
        </button>
      </form>
    </div>
  );
}

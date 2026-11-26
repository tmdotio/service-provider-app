import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/axios";
import useFetch from "../hooks/useFetch";
import { ErrorBox, Modal } from "./ui";

const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Kashmir",
];

/**
 * Popup form to apply as a service provider.
 * An admin reviews the application before the user becomes a provider.
 */
export default function BecomeProviderModal({ open, onClose, onSubmitted }) {
  const categories = useFetch(() => api.get("/categories"), [], "categories");
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
    if (form.categories.length === 0) return setError("Select at least one service you offer");

    setSaving(true);
    try {
      await api.post("/provider/become-provider", {
        ...form,
        experienceYears: Number(form.experienceYears),
      });
      toast.success("Application sent! We'll notify you after review.");
      onSubmitted();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Become a provider" wide>
      <p className="-mt-2 mb-5 text-sm text-muted">
        Tell customers about your work. An admin checks every application before it goes live.
      </p>

      <form onSubmit={submit} className="space-y-5">
        <ErrorBox message={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="businessName">Business name</label>
            <input id="businessName" className="input" required minLength={2} maxLength={100} placeholder="e.g. Ali Electric Works" value={form.businessName} onChange={set("businessName")} />
          </div>
          <div>
            <label className="label" htmlFor="businessPhone">Business phone</label>
            <input id="businessPhone" className="input" required pattern="\+?[0-9]{10,15}" placeholder="03001234567" value={form.businessPhone} onChange={set("businessPhone")} />
            <p className="mt-1 text-xs text-muted">Only shown to customers who book you</p>
          </div>
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
                  className={`chip ${active ? "border-accent bg-accent text-accent-ink hover:border-accent" : ""}`}
                  aria-pressed={active}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div>
            <label className="label" htmlFor="description">About your work</label>
            <textarea id="description" className="input min-h-24 resize-y" maxLength={1000} placeholder="What do you do best? Which areas do you cover?" value={form.description} onChange={set("description")} />
          </div>
          <div>
            <label className="label" htmlFor="experienceYears">Experience</label>
            <div className="relative">
              <input id="experienceYears" type="number" min="0" max="60" className="input pr-12" required value={form.experienceYears} onChange={set("experienceYears")} />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">yrs</span>
            </div>
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

        <div className="flex justify-end gap-2 border-t border-line pt-5">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit application
          </button>
        </div>
      </form>
    </Modal>
  );
}

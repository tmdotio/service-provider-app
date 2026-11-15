import { ArrowUpRight, BadgeCheck, Briefcase, CalendarCheck, Camera, CheckCircle2, Circle, Clock, Loader2, LogOut, Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { logout } from "../store/authSlice";
import { Link, useNavigate } from "react-router";
import api, { getErrorMessage } from "../api/axios";
import BecomeProviderModal from "../components/BecomeProviderModal";
import { Avatar, NotchCard, PageHeader, Spinner } from "../components/ui";
import useAuth from "../hooks/useAuth";
import useFetch from "../hooks/useFetch";
import { fetchMe, updateUser } from "../store/authSlice";
import { checkImageFile, timeAgo } from "../utils/format";

/**
 * New providers: a short checklist so the pro page looks good from day one.
 * Each step ticks itself when it's done.
 */
function ProviderSetup() {
  const { providerProfile: profile } = useAuth();
  const posts = useFetch(
    () => (profile ? api.get("/posts", { params: { provider: profile._id, limit: 1 } }) : Promise.resolve({ data: null })),
    [profile?._id],
  );

  if (!profile) return null;

  const steps = [
    { done: Boolean(profile.bannerImage?.url), label: "Add a banner photo", to: "/provider?edit=1" },
    { done: profile.availabilityStatus !== "offline", label: "Go online to get bookings", to: "/provider" },
    { done: (posts.data?.pagination.total || 0) > 0, label: "Post your first before/after job", to: "/provider?section=posts" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <NotchCard to="/provider" cornerLabel="Open workspace" highlight={!allDone}>
      <div className="pr-10">
        <p className={`text-xs font-bold uppercase tracking-wider ${allDone ? "text-muted" : "opacity-70"}`}>
          {allDone ? "Your workspace" : `Set up · ${doneCount}/${steps.length}`}
        </p>
        <h2 className="mt-1 font-wide text-2xl leading-tight">{allDone ? "You're all set" : "Welcome, pro!"}</h2>
      </div>

      {/* progress bar */}
      <div className={`mt-4 h-1.5 overflow-hidden rounded-full ${allDone ? "bg-surface-2" : "bg-accent-ink/15"}`}>
        <div
          className={`h-full rounded-full transition-all ${allDone ? "bg-accent" : "bg-accent-ink"}`}
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              to={step.to}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                allDone ? "hover:bg-surface-2" : "hover:bg-accent-ink/10"
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 opacity-50" />
              )}
              <span className={step.done ? "line-through opacity-60" : ""}>{step.label}</span>
              {!step.done && <ArrowUpRight className="ml-auto h-4 w-4" />}
            </Link>
          </li>
        ))}
      </ul>
    </NotchCard>
  );
}

/** Right column for customers: apply / pending / approved */
function ProviderSection() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const application = useFetch(() => api.get("/provider/application"), []);
  const app = application.data?.application;

  // Approved by admin: reload my profile (my role is now "provider")
  useEffect(() => {
    if (app?.verificationStatus === "approved") dispatch(fetchMe());
  }, [app?.verificationStatus, dispatch]);

  if (application.loading) return <Spinner />;

  if (app?.verificationStatus === "pending") {
    return (
      <div className="card p-6">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Clock className="h-6 w-6" />
        </span>
        <h2 className="text-xl font-bold">Application under review</h2>
        <p className="mt-2 text-sm text-muted">
          <strong className="text-fg">{app.businessName}</strong> was sent {timeAgo(app.createdAt)}. You'll get a
          notification as soon as an admin reviews it.
        </p>
      </div>
    );
  }

  if (app?.verificationStatus === "approved") {
    return (
      <NotchCard onCornerClick={() => navigate("/provider")} cornerLabel="Open dashboard" highlight>
        <BadgeCheck className="h-8 w-8" />
        <h2 className="mt-4 text-2xl font-bold">You're approved!</h2>
        <p className="mt-1 text-sm opacity-80">Open your dashboard to go online and get bookings.</p>
      </NotchCard>
    );
  }

  return (
    <>
      <NotchCard onCornerClick={() => setOpen(true)} cornerLabel="Become a provider" highlight className="min-h-64">
        <div className="flex h-full flex-col">
          <Briefcase className="h-8 w-8" />
          <h2 className="mt-5 font-wide text-2xl leading-tight">Earn with your skills</h2>
          <p className="mt-2 max-w-xs text-sm opacity-80">
            Plumber, electrician, painter, tutor? List your services and get bookings from customers near you.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="btn mt-6 self-start bg-accent-ink px-6 text-white hover:bg-black"
          >
            Become a provider
          </button>
        </div>
      </NotchCard>
      {open && (
        <BecomeProviderModal
          open
          onClose={() => setOpen(false)}
          onSubmitted={() => {
            setOpen(false);
            application.refetch();
          }}
        />
      )}
    </>
  );
}

export default function Account() {
  const { user, isCustomer, isProvider } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await dispatch(logout());
    toast.success("Logged out");
    navigate("/");
  };
  const [form, setForm] = useState({ name: user.name, phone: user.phone || "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { name: form.name.trim() };
      if (form.phone.trim()) data.phone = form.phone.trim();
      const res = await api.patch("/auth/update-profile", data);
      dispatch(updateUser({ name: res.data.user.name, phone: res.data.user.phone }));
      toast.success("Profile saved");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const problem = checkImageFile(file);
    if (problem) return toast.error(problem);

    const data = new FormData();
    data.append("image", file);
    setUploading(true);
    try {
      const res = await api.patch("/upload/avatar", data);
      dispatch(updateUser({ avatar: res.data.image.url }));
      toast.success("Photo updated");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title="My profile" subtitle="Your details and account settings." />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="card overflow-hidden">
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <div className="rounded-full bg-surface p-1.5">
                  <Avatar user={user} size="h-24 w-24" priority />
                </div>
                <label className="icon-btn absolute -bottom-1 -right-1 h-9 w-9 cursor-pointer" aria-label="Change photo">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadAvatar} disabled={uploading} />
                </label>
              </div>
              <div className="pb-1">
                <h2 className="text-2xl font-bold">{user.name}</h2>
                <p className="text-sm capitalize text-muted">{user.role} · photo max 1 MB</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <span className="chip"><Mail className="h-4 w-4 text-muted" />{user.email}</span>
              {user.phone && <span className="chip"><Phone className="h-4 w-4 text-muted" />{user.phone}</span>}
            </div>

            <form onSubmit={save} className="mt-8 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input id="name" className="input" required minLength={2} maxLength={50} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="phone">Phone</label>
                <input id="phone" className="input" pattern="\+?[0-9]{10,15}" placeholder="03001234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="flex flex-wrap justify-between gap-3 sm:col-span-2">
                <button className="btn-primary h-12 px-6" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </button>
                <button type="button" onClick={handleLogout} className="btn-ghost h-12 text-rose-500 hover:text-rose-500">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          {isCustomer && <ProviderSection />}
          {isProvider && <ProviderSetup />}
          {isProvider && (
            <NotchCard to="/bookings" cornerLabel="Open bookings you made">
              <CalendarCheck className="h-7 w-7 text-accent" />
              <h2 className="mt-4 text-lg font-bold">Bookings you made</h2>
              <p className="mt-1 text-sm text-muted">Jobs you booked from other pros, before or after becoming a provider.</p>
            </NotchCard>
          )}
        </div>
      </div>
    </div>
  );
}

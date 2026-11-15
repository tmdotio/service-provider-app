import { ArrowUpRight, BadgeCheck, Briefcase, Camera, Clock, Loader2, Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router";
import api, { getErrorMessage } from "../api/axios";
import BecomeProviderModal from "../components/BecomeProviderModal";
import { Avatar, NotchCard, PageHeader, Spinner } from "../components/ui";
import useAuth from "../hooks/useAuth";
import useFetch from "../hooks/useFetch";
import { fetchMe, updateUser } from "../store/authSlice";
import { checkImageFile, timeAgo } from "../utils/format";

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
          {/* Cover with gradient */}
          <div className="h-28 bg-accent-gradient opacity-90" />
          <div className="px-6 pb-6">
            <div className="-mt-10 flex flex-wrap items-end gap-4">
              <div className="relative">
                <div className="rounded-full bg-surface p-1.5">
                  <Avatar user={user} size="h-24 w-24" />
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
              <div className="sm:col-span-2">
                <button className="btn-primary" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          {isCustomer && <ProviderSection />}
          {isProvider && (
            <NotchCard to="/provider" cornerLabel="Open dashboard">
              <Briefcase className="h-7 w-7 text-accent" />
              <h2 className="mt-4 text-xl font-bold">Provider dashboard</h2>
              <p className="mt-1 text-sm text-muted">Manage jobs, go online and post your work.</p>
              <Link to="/provider" className="btn-outline mt-5">
                Open dashboard <ArrowUpRight className="h-4 w-4" />
              </Link>
            </NotchCard>
          )}
        </div>
      </div>
    </div>
  );
}

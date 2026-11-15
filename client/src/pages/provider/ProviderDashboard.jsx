import { CalendarX, MapPin, Phone, Star } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { Link } from "react-router";
import api, { getErrorMessage } from "../../api/axios";
import { ReasonModal } from "../../components/BookingActions";
import CreatePostForm from "../../components/CreatePostForm";
import PostCard from "../../components/PostCard";
import { Avatar, EmptyState, ErrorBox, Modal, PageHeader, Spinner, Stars, StatusBadge } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useFetch from "../../hooks/useFetch";
import { fetchMe } from "../../store/authSlice";
import { timeAgo } from "../../utils/format";

const TABS = {
  requests: ["pending"],
  active: ["in_progress"],
  history: ["completed", "cancelled", "rejected", "no_show"],
};

function JobCard({ booking, onChanged }) {
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (request, message) => {
    setBusy(true);
    try {
      await request();
      toast.success(message);
      setModal(null);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const { customer } = booking;

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <Avatar user={customer} />
        <div className="flex-1">
          <p className="font-semibold">{customer?.name}</p>
          <p className="text-sm text-gray-500">{booking.category?.name} · {timeAgo(booking.createdAt)}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <p className="mt-3 text-sm text-gray-700">{booking.description}</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
        <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{booking.serviceAddress}</span>
        {booking.status === "in_progress" && customer?.phone && (
          <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 font-medium text-brand-700">
            <Phone className="h-4 w-4" />{customer.phone}
          </a>
        )}
      </div>
      {booking.reason && <p className="mt-2 text-sm text-gray-500">Reason: {booking.reason}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {booking.status === "pending" && (
          <>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => run(() => api.patch(`/booking/${booking._id}/respond`, { action: "accept" }), "Booking accepted. You are now busy.")}
            >
              Accept
            </button>
            <button className="btn-outline" disabled={busy} onClick={() => setModal("reject")}>Reject</button>
          </>
        )}
        {booking.status === "in_progress" && (
          <>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => run(() => api.patch(`/booking/${booking._id}/complete`), "Job completed!")}
            >
              Mark as completed
            </button>
            <button className="btn-outline" disabled={busy} onClick={() => setModal("cancel")}>Cancel job</button>
          </>
        )}
      </div>

      <ReasonModal
        open={modal === "reject"}
        title="Reject booking"
        label="Reason (shown to the customer)"
        confirmText="Reject"
        required={false}
        onClose={() => setModal(null)}
        onConfirm={(reason) =>
          run(() => api.patch(`/booking/${booking._id}/respond`, { action: "reject", reason }), "Booking rejected")
        }
      />
      <ReasonModal
        open={modal === "cancel"}
        title="Cancel job"
        label="Why can't you do this job?"
        confirmText="Cancel job"
        onClose={() => setModal(null)}
        onConfirm={(reason) => run(() => api.patch(`/booking/${booking._id}/cancel`, { reason }), "Job cancelled")}
      />
    </div>
  );
}

function ReviewsWithReply({ providerId }) {
  const { data, loading, refetch } = useFetch(
    () => api.get(`/provider/${providerId}/reviews`, { params: { limit: 20 } }),
    [providerId],
  );
  const [replying, setReplying] = useState(null);
  const [text, setText] = useState("");

  const sendReply = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/reviews/${replying}/reply`, { text: text.trim() });
      toast.success("Reply posted");
      setReplying(null);
      setText("");
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <Spinner />;
  if (!data?.reviews.length) return <EmptyState icon={Star} title="No reviews yet" text="Reviews appear after completed jobs." />;

  return (
    <div className="space-y-4">
      {data.reviews.map((r) => (
        <div key={r._id} className="card p-4">
          <div className="flex items-center gap-3">
            <Avatar user={r.customer} size="h-9 w-9" />
            <div className="flex-1">
              <p className="text-sm font-medium">{r.customer?.name}</p>
              <p className="text-xs text-gray-400">{timeAgo(r.createdAt)}</p>
            </div>
            <Stars value={r.rating} />
          </div>
          {r.comment && <p className="mt-2 text-sm text-gray-700">{r.comment}</p>}
          {r.providerReply?.text ? (
            <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              <span className="text-xs font-medium text-gray-500">Your reply: </span>
              {r.providerReply.text}
            </p>
          ) : replying === r._id ? (
            <form onSubmit={sendReply} className="mt-3 flex gap-2">
              <input className="input" autoFocus required maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Thank the customer or explain..." />
              <button className="btn-primary">Reply</button>
            </form>
          ) : (
            <button onClick={() => setReplying(r._id)} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
              Reply
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function MyPosts({ providerId }) {
  const { data, loading, setData } = useFetch(
    () => api.get("/posts", { params: { provider: providerId, limit: 20 } }),
    [providerId],
  );
  return (
    <div className="space-y-4">
      <CreatePostForm
        providerId={providerId}
        placeholder="Show customers your latest work (before/after photos work great)..."
        onCreated={(post) => setData((d) => ({ ...d, posts: [post, ...(d?.posts || [])] }))}
      />
      {loading ? (
        <Spinner />
      ) : (
        data?.posts.map((p) => (
          <PostCard key={p._id} post={p} onDeleted={(id) => setData((d) => ({ ...d, posts: d.posts.filter((x) => x._id !== id) }))} />
        ))
      )}
    </div>
  );
}

function EditProfileModal({ profile, open, onClose, onSaved }) {
  const [form, setForm] = useState({
    businessName: profile.businessName,
    businessPhone: profile.businessPhone,
    description: profile.description || "",
    experienceYears: profile.experienceYears,
    city: profile.location?.city || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/provider/me", {
        businessName: form.businessName,
        businessPhone: form.businessPhone,
        description: form.description,
        experienceYears: Number(form.experienceYears),
        location: { city: form.city },
      });
      toast.success("Profile updated");
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit business profile">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="bn">Business name</label>
          <input id="bn" className="input" required value={form.businessName} onChange={set("businessName")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="bp">Phone</label>
            <input id="bp" className="input" required pattern="\+?[0-9]{10,15}" value={form.businessPhone} onChange={set("businessPhone")} />
          </div>
          <div>
            <label className="label" htmlFor="ex">Experience (years)</label>
            <input id="ex" type="number" min="0" max="60" className="input" value={form.experienceYears} onChange={set("experienceYears")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ct">City</label>
          <input id="ct" className="input" required value={form.city} onChange={set("city")} />
        </div>
        <div>
          <label className="label" htmlFor="ds">About your work</label>
          <textarea id="ds" className="input min-h-24" maxLength={1000} value={form.description} onChange={set("description")} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProviderDashboard() {
  const { providerProfile: profile } = useAuth();
  const dispatch = useDispatch();
  const [tab, setTab] = useState("requests");
  const [section, setSection] = useState("jobs");
  const [editOpen, setEditOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const bookings = useFetch(() => api.get("/booking/provider"), []);

  if (!profile) return <Spinner className="py-20" />;

  const reload = () => {
    bookings.refetch();
    dispatch(fetchMe()); // availability / counters may have changed
  };

  const setAvailability = async (availabilityStatus) => {
    setToggling(true);
    try {
      await api.patch("/provider/me/availability", { availabilityStatus });
      await dispatch(fetchMe());
      toast.success(availabilityStatus === "available" ? "You are online" : "You are offline");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setToggling(false);
    }
  };

  const all = bookings.data?.bookings || [];
  const list = all.filter((b) => TABS[tab].includes(b.status));
  const status = profile.availabilityStatus;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title={profile.businessName}
        subtitle={<Link to={`/providers/${profile._id}`} className="text-brand-700 hover:underline">View public profile</Link>}
        action={<button className="btn-outline" onClick={() => setEditOpen(true)}>Edit profile</button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="card p-4 sm:col-span-2">
          <p className="text-sm text-gray-500">Status</p>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={status} />
            {status === "busy" ? (
              <span className="text-sm text-gray-500">On a job — finish it to get new bookings</span>
            ) : (
              <button
                className={status === "available" ? "btn-outline" : "btn-primary"}
                disabled={toggling}
                onClick={() => setAvailability(status === "available" ? "offline" : "available")}
              >
                {status === "available" ? "Go offline" : "Go online"}
              </button>
            )}
          </div>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Rating</p>
          <p className="mt-1 text-2xl font-bold">{profile.averageRating?.toFixed(1)} <span className="text-sm font-normal text-gray-500">({profile.totalReviews})</span></p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Jobs done</p>
          <p className="mt-1 text-2xl font-bold">{profile.completedJobs}</p>
          {profile.noShowCount > 0 && <p className="text-xs text-red-600">{profile.noShowCount} no-show</p>}
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {[["jobs", "Jobs"], ["posts", "My work posts"], ["reviews", "Reviews"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`btn ${section === key ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "jobs" && (
        <>
          <div className="mb-4 flex gap-2 border-b">
            {[["requests", "New requests"], ["active", "Active"], ["history", "History"]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}
              >
                {label} ({all.filter((b) => TABS[key].includes(b.status)).length})
              </button>
            ))}
          </div>
          <ErrorBox message={bookings.error} />
          {bookings.loading && !bookings.data ? (
            <Spinner />
          ) : list.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title="Nothing here"
              text={tab === "requests" && status === "offline" ? "Go online to receive booking requests." : undefined}
            />
          ) : (
            <div className="space-y-4">
              {list.map((b) => <JobCard key={b._id} booking={b} onChanged={reload} />)}
            </div>
          )}
        </>
      )}

      {section === "posts" && <MyPosts providerId={profile._id} />}
      {section === "reviews" && <ReviewsWithReply providerId={profile._id} />}

      {editOpen && (
        <EditProfileModal
          profile={profile}
          open
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            dispatch(fetchMe());
          }}
        />
      )}
    </div>
  );
}

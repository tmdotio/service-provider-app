import { Bell, CalendarX, ImagePlus, Images, Loader2, LayoutGrid, MapPin, Pencil, Phone, Power, Star, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { Link, useSearchParams } from "react-router";
import api, { getErrorMessage } from "../../api/axios";
import { ReasonModal } from "../../components/BookingActions";
import MessageButton from "../../components/MessageButton";
import CreatePostForm from "../../components/CreatePostForm";
import PostCard from "../../components/PostCard";
import {
  Avatar,
  Chips,
  EmptyState,
  ErrorBox,
  Modal,
  NotchCard,
  PageHeader,
  ServiceTag,
  SectionPill,
  SkeletonGrid,
  Spinner,
  Stars,
  Stat,
  StatusBadge,
  TaskCardSkeleton,
} from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import { useSocketEvent } from "../../hooks/useChat";
import useFetch from "../../hooks/useFetch";
import { fetchMe } from "../../store/authSlice";
import { checkImageFile, timeAgo } from "../../utils/format";

const TABS = {
  requests: ["pending"],
  active: ["in_progress"],
  // Cancelled bookings are not shown: you only get a notification
  history: ["completed", "rejected", "no_show"],
};

function JobCard({ booking, onChanged, onAccepted }) {
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (request, message) => {
    setBusy(true);
    try {
      await request();
      toast.success(message);
      setModal(null);
      onChanged();
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      onChanged(); // the job may have changed meanwhile (e.g. the customer cancelled)
      return false;
    } finally {
      setBusy(false);
    }
  };

  const { customer } = booking;
  const active = booking.status === "in_progress";
  const darkBtn = "btn bg-accent-ink text-white hover:bg-black";
  const lineBtn = "btn border border-accent-ink/25 text-accent-ink hover:bg-accent-ink/10";

  return (
    <NotchCard
      highlight={active}
      corner={customer?.phone ? <Phone className="h-[18px] w-[18px]" /> : <Bell className="h-[18px] w-[18px]" />}
      onCornerClick={customer?.phone ? () => (window.location.href = `tel:${customer.phone}`) : undefined}
      cornerLabel={`Call ${customer?.name}`}
    >
      <div className="flex items-center gap-3 pr-12">
        <Avatar user={customer} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{customer?.name}</p>
          <p className={`text-xs ${active ? "opacity-70" : "text-muted"}`}>{timeAgo(booking.createdAt)}</p>
        </div>
      </div>

      <h3 className="mt-5 flex items-center gap-2 text-2xl font-bold">
        <Wrench className={`h-5 w-5 ${active ? "" : "text-accent"}`} />
        {booking.category?.name}
      </h3>
      <p className={`mt-1 line-clamp-3 text-sm ${active ? "opacity-80" : "text-muted"}`}>{booking.description}</p>
      <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm ${active ? "opacity-80" : "text-muted"}`}>
        <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{booking.serviceAddress}</span>
        {active && customer?.phone && (
          <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 font-bold">
            <Phone className="h-4 w-4" />{customer.phone}
          </a>
        )}
      </div>
      {booking.reason && <p className="mt-2 text-sm text-muted">Reason: {booking.reason}</p>}

      <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 ${active ? "border-accent-ink/15" : "border-line"}`}>
        <div>
          <p className={`mb-1 text-xs ${active ? "opacity-70" : "text-muted"}`}>Status</p>
          {active ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-ink/10 px-2.5 py-1 text-xs font-semibold">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-ink" /> In progress
            </span>
          ) : (
            <StatusBadge status={booking.status} />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {customer && ["pending", "in_progress"].includes(booking.status) && (
            <MessageButton bookingId={booking._id} className={active ? lineBtn : "btn-outline"} />
          )}
          {booking.status === "pending" && (
            <>
              <button className="btn-outline" disabled={busy} onClick={() => setModal("reject")}>Reject</button>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() =>
                  run(() => api.patch(`/booking/${booking._id}/respond`, { action: "accept" }), "Booking accepted. It is now in Active.").then(
                    (ok) => ok && onAccepted?.(),
                  )
                }
              >
                Accept
              </button>
            </>
          )}
          {active && (
            <>
              <button className={lineBtn} disabled={busy} onClick={() => setModal("cancel")}>Cancel</button>
              <button
                className={darkBtn}
                disabled={busy}
                onClick={() => run(() => api.patch(`/booking/${booking._id}/complete`), "Job completed! You are available for new requests.")}
              >
                Mark done
              </button>
            </>
          )}
        </div>
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
    </NotchCard>
  );
}

function ReviewsWithReply({ providerId }) {
  const { data, loading, refetch } = useFetch(
    () => api.get(`/provider/${providerId}/reviews`, { params: { limit: 20 } }),
    [providerId],
    `reviews:${providerId}:all`,
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
      {data.services?.length > 0 && (
        <div className="card flex flex-wrap gap-x-6 gap-y-2 p-4 text-sm">
          <span className="font-semibold">Rating per service</span>
          {data.services.map((s) => (
            <span key={s._id} className="text-muted">
              <span className="font-semibold text-fg">{s.name}</span> ★ {s.averageRating.toFixed(1)} · {s.count} review{s.count === 1 ? "" : "s"}
            </span>
          ))}
        </div>
      )}
      {data.reviews.map((r) => (
        <div key={r._id} className="card p-4">
          <div className="flex items-center gap-3">
            <Avatar user={r.customer} size="h-9 w-9" />
            <div className="flex-1">
              <p className="text-sm font-medium">{r.customer?.name}</p>
              <p className="text-xs text-muted">{timeAgo(r.createdAt)}</p>
            </div>
            <Stars value={r.rating} />
          </div>
          <ServiceTag name={r.category?.name} className="mt-3" />
          {r.comment && <p className="mt-2 text-sm text-fg/80">{r.comment}</p>}
          {r.providerReply?.text ? (
            <p className="mt-2 rounded-2xl bg-surface-2 p-3 text-sm text-fg/80">
              <span className="text-xs font-medium text-muted">Your reply: </span>
              {r.providerReply.text}
            </p>
          ) : replying === r._id ? (
            <form onSubmit={sendReply} className="mt-3 flex gap-2">
              <input className="input" autoFocus required maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Thank the customer or explain..." />
              <button className="btn-primary">Reply</button>
            </form>
          ) : (
            <button onClick={() => setReplying(r._id)} className="mt-2 text-sm font-medium text-accent hover:underline">
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
    `posts:${providerId}`,
  );
  return (
    <div className="space-y-4">
      <CreatePostForm
        placeholder="What was the problem, and what did you do?"
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

/** Cover image for the public profile: preview, change, remove (max 1 MB). */
function BannerEditor({ banner, onChanged }) {
  const [busy, setBusy] = useState(false);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = checkImageFile(file);
    if (problem) return toast.error(problem);

    const data = new FormData();
    data.append("image", file);
    setBusy(true);
    try {
      await api.patch("/provider/me/banner", data);
      toast.success("Banner updated");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete("/provider/me/banner");
      toast.success("Banner removed");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="label">Banner image</p>
      <div className="relative h-32 overflow-hidden rounded-[22px] bg-accent-gradient sm:h-40">
        {banner?.url && <img src={banner.url} alt="Current banner" className="h-full w-full object-cover" />}
        <div className="absolute bottom-3 right-3 flex gap-2">
          {banner?.url && (
            <button type="button" className="btn bg-black/60 text-white backdrop-blur hover:bg-black/75" onClick={remove} disabled={busy}>
              Remove
            </button>
          )}
          <label className={`btn cursor-pointer bg-white/90 text-accent-ink hover:bg-white ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {banner?.url ? "Change" : "Add banner"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
          </label>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted">Shown at the top of your public profile. Wide photo, max 1 MB.</p>
    </div>
  );
}

function EditProfileModal({ profile, open, onClose, onSaved, onBannerChanged }) {
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
    <Modal open={open} onClose={onClose} title="Edit business profile" wide>
      <BannerEditor banner={profile.bannerImage} onChanged={onBannerChanged} />
      <form onSubmit={submit} className="mt-5 space-y-4">
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
  // Section and tab live in the URL (/provider?section=jobs&tab=active),
  // so notifications open the right place, even when already on this page
  const [params, setParams] = useSearchParams();
  const [editOpen, setEditOpen] = useState(() => params.get("edit") === "1");
  const [toggling, setToggling] = useState(false);

  const bookings = useFetch(() => api.get("/booking/provider"), [], "provider-jobs");
  const all = bookings.data?.bookings || [];
  const activeJob = all.find((b) => b.status === "in_progress");

  const section = ["jobs", "posts", "reviews"].includes(params.get("section")) ? params.get("section") : "jobs";
  // No tab chosen: show the job in progress first, otherwise new requests
  const tab = TABS[params.get("tab")] ? params.get("tab") : activeJob ? "active" : "requests";
  const go = (next) =>
    setParams(
      (p) => {
        const q = new URLSearchParams(p);
        Object.entries(next).forEach(([k, v]) => q.set(k, v));
        q.delete("edit");
        return q;
      },
      { replace: true },
    );
  const setTab = (t) => go({ section: "jobs", tab: t });
  const setSection = (s) => go({ section: s });

  const reload = useCallback(() => {
    bookings.refetch();
    dispatch(fetchMe()); // availability / counters may have changed
  }, [bookings.refetch, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live: a new request, or the customer cancelled / reported a no-show
  useSocketEvent(
    "booking:updated",
    useCallback(({ side }) => side === "provider" && reload(), [reload]),
  );

  // The server can repair a stuck "busy"; then refresh my status too
  const serverStatus = bookings.data?.availabilityStatus;
  useEffect(() => {
    if (serverStatus && profile && serverStatus !== profile.availabilityStatus) dispatch(fetchMe());
  }, [serverStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return <Spinner className="py-20" />;

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

  const list = all.filter((b) => TABS[tab].includes(b.status));
  const status = profile.availabilityStatus;

  const sections = [
    ["jobs", "Jobs", LayoutGrid],
    ["posts", "My work", Images],
    ["reviews", "Reviews", Star],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Workspace"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-fg">{profile.businessName}</span>·
            <Link to={`/providers/${profile._id}`} className="text-accent hover:underline">View public profile</Link>
          </span>
        }
      >
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Stat value={profile.averageRating?.toFixed(1)} label="Rating" badge={`${profile.totalReviews}★`} />
          <Stat value={profile.completedJobs} label="Jobs" badge="done" tone="green" />
          <Stat value={profile.noShowCount} label="No-show" badge={profile.noShowCount ? "!" : "0"} tone="red" />
        </div>
      </PageHeader>

      {/* Status bar */}
      <div className="glass mb-8 flex flex-wrap items-center justify-between gap-3 rounded-full p-2 pl-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-muted">Your status</span>
          <StatusBadge status={status} />
          {activeJob ? (
            <button onClick={() => setTab("active")} className="truncate text-left font-semibold text-accent hover:underline">
              On a job: {activeJob.category?.name} for {activeJob.customer?.name || "a customer"} — open it to mark done
            </button>
          ) : status === "busy" ? (
            <span className="text-muted">No job in progress — go online to get new requests</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit profile
          </button>
          {!activeJob && (
            <button
              className={status === "available" ? "btn-outline" : "btn-primary"}
              disabled={toggling}
              onClick={() => setAvailability(status === "available" ? "offline" : "available")}
            >
              <Power className="h-4 w-4" />
              {status === "available" ? "Go offline" : "Go online"}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Side rail of round icons, like the reference */}
        <nav className="sticky top-28 hidden h-fit flex-col gap-3 lg:flex" aria-label="Dashboard sections">
          {sections.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`icon-btn ${section === key ? "border-accent text-accent" : ""}`}
              aria-label={label}
              aria-current={section === key}
              title={label}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <Chips
            className="mb-6 lg:hidden"
            options={sections.map(([key, label]) => [key, label])}
            value={section}
            onChange={setSection}
          />

          {section === "jobs" && (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <SectionPill count={list.length}>
                  {{ requests: "New requests", active: "Active job", history: "History" }[tab]}
                </SectionPill>
                <Chips
                  options={[
                    ["requests", `New (${all.filter((b) => TABS.requests.includes(b.status)).length})`],
                    ["active", `Active (${all.filter((b) => TABS.active.includes(b.status)).length})`],
                    ["history", "History"],
                  ]}
                  value={tab}
                  onChange={setTab}
                />
              </div>
              <ErrorBox message={bookings.error} />
              {bookings.loading && !bookings.data ? (
                <SkeletonGrid count={3} item={TaskCardSkeleton} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" />
              ) : list.length === 0 ? (
                <EmptyState
                  icon={CalendarX}
                  title="Nothing here"
                  text={tab === "requests" && status === "offline" ? "Go online to receive booking requests." : undefined}
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((b) => (
                    <JobCard key={b._id} booking={b} onChanged={reload} onAccepted={() => setTab("active")} />
                  ))}
                </div>
              )}
            </>
          )}

          {section === "posts" && <MyPosts providerId={profile._id} />}
          {section === "reviews" && <ReviewsWithReply providerId={profile._id} />}
        </div>
      </div>

      {editOpen && (
        <EditProfileModal
          profile={profile}
          open
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            dispatch(fetchMe());
          }}
          onBannerChanged={() => dispatch(fetchMe())}
        />
      )}
    </div>
  );
}

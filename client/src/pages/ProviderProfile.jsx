import { Briefcase, CalendarCheck, Images, MapPin, MessageSquareQuote, UserX } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router";
import api, { getErrorMessage } from "../api/axios";
import CreatePostForm from "../components/CreatePostForm";
import PostCard from "../components/PostCard";
import {
  Avatar,
  EmptyState,
  ErrorBox,
  Modal,
  Pagination,
  Spinner,
  Stars,
  StatusBadge,
} from "../components/ui";
import useAuth from "../hooks/useAuth";
import useFetch from "../hooks/useFetch";
import { timeAgo } from "../utils/format";

function BookingModal({ provider, open, onClose }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    category: provider.categories[0]?._id || "",
    description: "",
    serviceAddress: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/booking/${provider._id}`, form);
      toast.success("Booking request sent! You'll get a notification when they accept.");
      navigate("/bookings");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Book ${provider.businessName}`}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="category">Service</label>
          <select id="category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {provider.categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="description">What do you need done?</label>
          <textarea
            id="description"
            className="input min-h-24"
            required
            minLength={10}
            maxLength={1000}
            placeholder="e.g. Kitchen tap is leaking and needs to be replaced"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <p className="mt-1 text-xs text-gray-500">At least 10 characters</p>
        </div>
        <div>
          <label className="label" htmlFor="address">Address</label>
          <input
            id="address"
            className="input"
            required
            placeholder="House 12, Street 4, Johar Town, Lahore"
            value={form.serviceAddress}
            onChange={(e) => setForm({ ...form, serviceAddress: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>Send request</button>
        </div>
      </form>
    </Modal>
  );
}

function Reviews({ providerId }) {
  const [page, setPage] = useState(1);
  const { data, loading } = useFetch(
    () => api.get(`/provider/${providerId}/reviews`, { params: { page, limit: 5 } }),
    [providerId, page],
  );

  if (loading && !data) return <Spinner />;
  const total = data?.pagination.total || 0;

  if (total === 0) {
    return <EmptyState icon={MessageSquareQuote} title="No reviews yet" text="Reviews appear after completed bookings." />;
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-1.5 p-4">
        {[5, 4, 3, 2, 1].map((n) => {
          const count = data.breakdown[n] || 0;
          return (
            <div key={n} className="flex items-center gap-3 text-sm">
              <span className="w-8 text-gray-600">{n} ★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-amber-400" style={{ width: `${(count / total) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-gray-500">{count}</span>
            </div>
          );
        })}
      </div>

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
          {r.comment && <p className="mt-3 text-sm text-gray-700">{r.comment}</p>}
          {r.providerReply?.text && (
            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
              <p className="text-xs font-medium text-gray-500">Reply from provider</p>
              <p className="text-gray-700">{r.providerReply.text}</p>
            </div>
          )}
        </div>
      ))}

      <Pagination pagination={data.pagination} onPage={setPage} />
    </div>
  );
}

function Posts({ provider }) {
  const { user } = useAuth();
  const { data, loading, setData } = useFetch(
    () => api.get("/posts", { params: { provider: provider._id, limit: 20 } }),
    [provider._id],
  );

  const isOwner = user && provider.user?._id === user._id;

  return (
    <div className="space-y-4">
      {user ? (
        <CreatePostForm
          providerId={provider._id}
          placeholder={isOwner ? "Show your latest work..." : `How was your experience with ${provider.businessName}?`}
          onCreated={(post) => setData((d) => ({ ...d, posts: [post, ...(d?.posts || [])] }))}
        />
      ) : (
        <p className="text-sm text-gray-500">
          <Link to="/login" className="text-brand-700 hover:underline">Log in</Link> to share photos of their work.
        </p>
      )}

      {loading ? (
        <Spinner />
      ) : data?.posts.length === 0 ? (
        <EmptyState icon={Images} title="No posts yet" text="Photos of this provider's work will appear here." />
      ) : (
        data?.posts.map((p) => (
          <PostCard
            key={p._id}
            post={p}
            onDeleted={(id) => setData((d) => ({ ...d, posts: d.posts.filter((x) => x._id !== id) }))}
          />
        ))
      )}
    </div>
  );
}

export default function ProviderProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isCustomer } = useAuth();
  const [tab, setTab] = useState("reviews");
  const [bookingOpen, setBookingOpen] = useState(false);

  const { data, loading, error } = useFetch(() => api.get(`/provider/${id}`), [id]);

  if (loading) return <Spinner className="py-20" />;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState icon={UserX} title="Provider not found" action={<Link to="/providers" className="btn-primary">Back to search</Link>} />
      </div>
    );
  }

  const { provider, postsCount } = data;
  const canBook = provider.availabilityStatus === "available";

  const onBook = () => {
    if (!user) return navigate("/login", { state: { from: `/providers/${id}` } });
    setBookingOpen(true);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ErrorBox message={error} />

      <div className="card p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar user={provider.user} size="h-20 w-20" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{provider.businessName}</h1>
              <StatusBadge status={provider.availabilityStatus} />
            </div>
            <p className="text-gray-500">{provider.user?.name}</p>

            <div className="mt-2 flex items-center gap-2 text-sm">
              <Stars value={provider.averageRating} />
              <span>{provider.averageRating.toFixed(1)} · {provider.totalReviews} reviews</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {provider.location.city}, {provider.location.province}
              </span>
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" />
                {provider.experienceYears} years experience
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarCheck className="h-4 w-4" />
                {provider.completedJobs} jobs completed
              </span>
              {provider.noShowCount > 0 && (
                <span className="font-medium text-red-600">{provider.noShowCount} reported no-show</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {provider.categories.map((c) => (
                <span key={c._id} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs">{c.name}</span>
              ))}
            </div>
          </div>

          {(!user || isCustomer) && (
            <div className="sm:text-right">
              <button className="btn-primary w-full sm:w-auto" onClick={onBook} disabled={user && !canBook}>
                Book now
              </button>
              {!canBook && (
                <p className="mt-2 text-xs text-gray-500">
                  {provider.availabilityStatus === "busy" ? "On a job right now" : "Offline at the moment"}
                </p>
              )}
            </div>
          )}
        </div>

        {provider.description && (
          <p className="mt-5 whitespace-pre-line border-t pt-5 text-gray-700">{provider.description}</p>
        )}
      </div>

      <div className="mt-6 flex gap-2 border-b">
        {[
          ["reviews", `Reviews (${provider.totalReviews})`],
          ["posts", `Work photos (${postsCount})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "reviews" ? <Reviews providerId={provider._id} /> : <Posts provider={provider} />}
      </div>

      {bookingOpen && (
        <BookingModal provider={provider} open={bookingOpen} onClose={() => setBookingOpen(false)} />
      )}
    </div>
  );
}

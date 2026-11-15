import { CheckCircle2, Flag, FolderOpen, Trash2, UserCheck } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../../api/axios";
import { ReasonModal } from "../../components/BookingActions";
import { Avatar, Chips, EmptyState, ErrorBox, PageHeader, Pagination, Spinner, StatusBadge } from "../../components/ui";
import useFetch from "../../hooks/useFetch";
import { timeAgo } from "../../utils/format";

const action = async (request, message, after) => {
  try {
    await request();
    toast.success(message);
    after?.();
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
};

function Overview() {
  const { data, loading, error } = useFetch(() => api.get("/admin/dashboard-stats"), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  const s = data.stats;

  const cards = [
    ["Customers", s.totalCustomers],
    ["Providers", s.totalProviders],
    ["Applications", s.pendingProviderRequests, s.pendingProviderRequests > 0],
    ["Bookings", s.totalBookings],
    ["Posts", s.totalPosts],
    ["Reports", s.pendingReports, s.pendingReports > 0],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, value, alert]) => (
          <div key={label} className={`rounded-[28px] p-5 ${alert ? "bg-accent-gradient text-accent-ink" : "card"}`}>
            <p className={`text-sm ${alert ? "opacity-75" : "text-muted"}`}>{label}</p>
            <p className="font-wide mt-2 text-4xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <p className="mb-3 font-semibold">Bookings by status</p>
          {Object.keys(s.bookingsByStatus).length === 0 && <p className="text-sm text-muted">No bookings yet</p>}
          <div className="space-y-2">
            {Object.entries(s.bookingsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3 text-sm">
                <span className="w-28"><StatusBadge status={status} /></span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${(count / s.totalBookings) * 100}%` }} />
                </div>
                <span className="w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <p className="mb-3 font-semibold">Top providers</p>
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr><th className="pb-2 font-normal">Business</th><th className="pb-2 font-normal">Jobs</th><th className="pb-2 font-normal">Rating</th><th className="pb-2 font-normal">No-show</th></tr>
            </thead>
            <tbody>
              {s.topProviders.map((p) => (
                <tr key={p._id} className="border-t">
                  <td className="py-2">{p.businessName}</td>
                  <td>{p.completedJobs}</td>
                  <td>{p.averageRating.toFixed(1)}</td>
                  <td className={p.noShowCount ? "text-rose-500" : ""}>{p.noShowCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProviderRequests() {
  const { data, loading, error, refetch } = useFetch(() => api.get("/admin/provider-requests/pending"), []);
  const [rejecting, setRejecting] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data.requests.length) return <EmptyState icon={UserCheck} title="No pending applications" />;

  return (
    <div className="space-y-4">
      {data.requests.map((r) => (
        <div key={r._id} className="card p-5">
          <div className="flex items-start gap-3">
            <Avatar user={r.user} />
            <div className="flex-1">
              <p className="font-semibold">{r.businessName}</p>
              <p className="text-sm text-muted">{r.user?.name} · {r.user?.email} · {r.businessPhone}</p>
              <p className="text-sm text-muted">{r.location?.city}, {r.location?.province} · {r.experienceYears} yrs · applied {timeAgo(r.createdAt)}</p>
            </div>
          </div>
          {r.description && <p className="mt-3 text-sm text-fg/80">{r.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.categories?.map((c) => <span key={c._id} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{c.name}</span>)}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary"
              onClick={() => action(() => api.patch(`/admin/provider-requests/${r.user._id}/review`, { action: "approve" }), "Provider approved", refetch)}
            >
              Approve
            </button>
            <button className="btn-outline" onClick={() => setRejecting(r.user._id)}>Reject</button>
          </div>
        </div>
      ))}
      <ReasonModal
        open={Boolean(rejecting)}
        title="Reject application"
        label="Reason (sent to the applicant)"
        confirmText="Reject"
        onClose={() => setRejecting(null)}
        onConfirm={(rejectionReason) =>
          action(
            () => api.patch(`/admin/provider-requests/${rejecting}/review`, { action: "reject", rejectionReason }),
            "Application rejected",
            () => {
              setRejecting(null);
              refetch();
            },
          )
        }
      />
    </div>
  );
}

function Reports() {
  const { data, loading, error, refetch } = useFetch(() => api.get("/admin/reports"), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!data.reports.length) return <EmptyState icon={CheckCircle2} title="No reported posts" text="All clear!" />;

  return (
    <div className="space-y-4">
      {data.reports.map((r) => (
        <div key={r._id} className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Flag className="h-4 w-4 text-rose-500" />
            <span className="font-semibold">{r.reportsCount} report{r.reportsCount > 1 ? "s" : ""}</span>
            {r.reasons.map((reason) => (
              <span key={reason} className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs capitalize text-rose-500">{reason}</span>
            ))}
            {r.post?.isHidden && <span className="text-xs text-muted">(hidden automatically)</span>}
          </div>
          {r.post ? (
            <>
              <p className="mt-3 text-sm text-fg/80">{r.post.text}</p>
              <div className="mt-3 flex gap-2">
                {r.post.images?.map((img) => (
                  <a key={img.url} href={img.url} target="_blank" rel="noreferrer">
                    <img src={img.url} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Post was deleted</p>
          )}
          <div className="mt-4 flex gap-2">
            <button className="btn-danger" onClick={() => action(() => api.patch(`/admin/reports/${r._id}`, { action: "remove" }), "Post removed", refetch)}>
              Remove post
            </button>
            <button className="btn-outline" onClick={() => action(() => api.patch(`/admin/reports/${r._id}`, { action: "dismiss" }), "Reports dismissed", refetch)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Categories() {
  const { data, loading, refetch } = useFetch(() => api.get("/categories"), []);
  const [name, setName] = useState("");

  const create = (e) => {
    e.preventDefault();
    action(() => api.post("/admin/categories", { name: name.trim() }), "Category added", () => {
      setName("");
      refetch();
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="card flex gap-2 p-4">
        <input className="input" placeholder="New category e.g. Solar Technician" required minLength={2} maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary">Add</button>
      </form>
      {loading ? (
        <Spinner />
      ) : data?.categories.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No categories" />
      ) : (
        <div className="card divide-y">
          {data?.categories.map((c) => (
            <div key={c._id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted">{c.providersCount} providers</p>
              </div>
              <button
                className="p-2 text-muted hover:text-rose-500"
                aria-label={`Delete ${c.name}`}
                onClick={() => window.confirm(`Delete "${c.name}"?`) && action(() => api.delete(`/admin/categories/${c._id}`), "Category deleted", refetch)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Users() {
  const { data, loading, error, refetch } = useFetch(() => api.get("/admin/users"), []);
  const [q, setQ] = useState("");
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;

  const users = data.users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <input className="input" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3 text-muted">{timeAgo(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <button
                    className={`btn px-3 py-1 text-xs ${u.isActive ? "bg-lime-400/20 text-lime-700 dark:text-lime-300" : "bg-rose-500/15 text-rose-600 dark:text-rose-300"}`}
                    onClick={() =>
                      action(
                        () => api.patch(`/admin/users/${u._id}/status`, { isActive: !u.isActive }),
                        u.isActive ? "User deactivated" : "User activated",
                        refetch,
                      )
                    }
                    title="Click to change"
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Bookings() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error } = useFetch(
    () => api.get("/admin/bookings", { params: { status: status || undefined, page } }),
    [status, page],
  );

  return (
    <div className="space-y-4">
      <select className="input max-w-52" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        <option value="">All statuses</option>
        {["pending", "in_progress", "completed", "cancelled", "rejected", "no_show"].map((s) => (
          <option key={s} value={s}>{s.replace("_", " ")}</option>
        ))}
      </select>
      <ErrorBox message={error} />
      {loading && !data ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data?.bookings.map((b) => (
                <tr key={b._id} className="border-t">
                  <td className="px-4 py-3">{b.customer?.name}</td>
                  <td className="px-4 py-3">{b.provider?.businessName}</td>
                  <td className="px-4 py-3">{b.category?.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3 text-muted">{timeAgo(b.createdAt)}</td>
                </tr>
              ))}
              {data?.bookings.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No bookings</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pagination={data?.pagination} onPage={setPage} />
    </div>
  );
}

const TABS = [
  ["overview", "Overview", Overview],
  ["requests", "Provider requests", ProviderRequests],
  ["reports", "Reports", Reports],
  ["categories", "Categories", Categories],
  ["users", "Users", Users],
  ["bookings", "Bookings", Bookings],
];

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const Current = TABS.find(([key]) => key === tab)[2];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title="Control room" subtitle="Approve providers, keep the feed clean and watch bookings." />
      <Chips className="mb-8" options={TABS.map(([key, label]) => [key, label])} value={tab} onChange={setTab} />
      <Current />
    </div>
  );
}

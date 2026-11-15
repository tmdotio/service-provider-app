import { CalendarX, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router";
import api, { getErrorMessage } from "../api/axios";
import { ReasonModal, ReviewModal } from "../components/BookingActions";
import { EmptyState, ErrorBox, PageHeader, Spinner, StatusBadge } from "../components/ui";
import useFetch from "../hooks/useFetch";
import { formatDate, timeAgo } from "../utils/format";

const NO_SHOW_AFTER_MS = 60 * 60 * 1000; // same rule as the server

const TABS = {
  active: ["pending", "in_progress"],
  past: ["completed", "cancelled", "rejected", "no_show"],
};

/** Re-render every 30s so the no-show button unlocks on time. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function BookingCard({ booking, onChanged }) {
  const now = useNow();
  const [modal, setModal] = useState(null); // "cancel" | "noShow" | "review"

  const provider = booking.provider;
  const acceptedAt = booking.acceptedAt ? new Date(booking.acceptedAt).getTime() : null;
  const noShowReadyAt = acceptedAt ? acceptedAt + NO_SHOW_AFTER_MS : null;
  const canReportNoShow = booking.status === "in_progress" && noShowReadyAt && now >= noShowReadyAt;
  const minutesLeft = noShowReadyAt ? Math.ceil((noShowReadyAt - now) / 60000) : 0;

  const run = async (request, message) => {
    try {
      await request();
      toast.success(message);
      setModal(null);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/providers/${provider?._id}`} className="font-semibold hover:text-brand-700">
            {provider?.businessName || "Provider removed"}
          </Link>
          <p className="text-sm text-gray-500">
            {booking.category?.name} · requested {timeAgo(booking.createdAt)}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <p className="mt-3 text-sm text-gray-700">{booking.description}</p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
        <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{booking.serviceAddress}</span>
        {booking.status === "in_progress" && provider?.businessPhone && (
          <a href={`tel:${provider.businessPhone}`} className="flex items-center gap-1.5 font-medium text-brand-700">
            <Phone className="h-4 w-4" />{provider.businessPhone}
          </a>
        )}
      </div>

      {booking.status === "in_progress" && booking.acceptedAt && (
        <p className="mt-2 text-sm text-blue-700">Accepted {formatDate(booking.acceptedAt)} — the provider is on the way.</p>
      )}
      {booking.reason && ["cancelled", "rejected", "no_show"].includes(booking.status) && (
        <p className="mt-2 text-sm text-gray-500">Reason: {booking.reason}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {["pending", "in_progress"].includes(booking.status) && (
          <button className="btn-outline" onClick={() => setModal("cancel")}>Cancel booking</button>
        )}
        {booking.status === "in_progress" && (
          <button
            className="btn-outline border-red-300 text-red-700"
            disabled={!canReportNoShow}
            onClick={() => setModal("noShow")}
            title={canReportNoShow ? "" : `Available in ${minutesLeft} min`}
          >
            Provider didn't come
            {!canReportNoShow && <span className="text-xs">({minutesLeft} min)</span>}
          </button>
        )}
        {["completed", "no_show"].includes(booking.status) && !booking.isReviewed && (
          <button className="btn-primary" onClick={() => setModal("review")}>Leave a review</button>
        )}
        {booking.isReviewed && <span className="text-sm text-green-700">✓ Reviewed</span>}
      </div>

      <ReasonModal
        open={modal === "cancel"}
        title="Cancel booking"
        label="Why are you cancelling?"
        confirmText="Cancel booking"
        onClose={() => setModal(null)}
        onConfirm={(reason) =>
          run(() => api.patch(`/booking/${booking._id}/cancel`, { reason }), "Booking cancelled")
        }
      />
      <ReasonModal
        open={modal === "noShow"}
        title="Report no-show"
        label="What happened? (optional)"
        confirmText="Report"
        required={false}
        onClose={() => setModal(null)}
        onConfirm={(reason) =>
          run(
            () => api.patch(`/booking/${booking._id}/no-show`, reason ? { reason } : {}),
            "Reported. You can now review them and book someone else.",
          )
        }
      />
      {modal === "review" && (
        <ReviewModal
          booking={booking}
          open
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

export default function MyBookings() {
  const [tab, setTab] = useState("active");
  const { data, loading, error, refetch } = useFetch(() => api.get("/booking/customer"), []);

  const bookings = (data?.bookings || []).filter((b) => TABS[tab].includes(b.status));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="My bookings" subtitle="Track your requests and review finished jobs." />

      <div className="mb-6 flex gap-2 border-b">
        {[["active", "Active"], ["past", "Past"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"
            }`}
          >
            {label} ({(data?.bookings || []).filter((b) => TABS[key].includes(b.status)).length})
          </button>
        ))}
      </div>

      <ErrorBox message={error} />

      {loading && !data ? (
        <Spinner />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title={tab === "active" ? "No active bookings" : "No past bookings"}
          action={<Link to="/providers" className="btn-primary">Find a provider</Link>}
        />
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => <BookingCard key={b._id} booking={b} onChanged={refetch} />)}
        </div>
      )}
    </div>
  );
}

import { CalendarX, MapPin, Phone, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useSearchParams } from "react-router";
import api, { getErrorMessage } from "../api/axios";
import { ReasonModal, ReviewModal } from "../components/BookingActions";
import MessageButton from "../components/MessageButton";
import {
  Avatar,
  Chips,
  EmptyState,
  ErrorBox,
  NotchCard,
  PageHeader,
  SectionPill,
  SkeletonGrid,
  Stat,
  StatusBadge,
  TaskCardSkeleton,
} from "../components/ui";
import { useSocketEvent } from "../hooks/useChat";
import useFetch from "../hooks/useFetch";
import { formatDate, timeAgo } from "../utils/format";

const NO_SHOW_AFTER_MS = 60 * 60 * 1000; // same rule as the server

const TABS = {
  active: ["pending", "in_progress"],
  // Cancelled bookings are not shown: you only get a notification
  past: ["completed", "rejected", "no_show"],
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

  const active = booking.status === "in_progress";
  // On the orange card, buttons need dark styles to stay readable
  const outline = active ? "btn border border-accent-ink/25 text-accent-ink hover:bg-accent-ink/10" : "btn-outline";

  return (
    <NotchCard
      to={provider ? `/providers/${provider._id}` : undefined}
      cornerLabel={`Open ${provider?.businessName || "provider"}`}
      highlight={active}
    >
      <div className="flex items-center gap-3 pr-12">
        <Avatar user={provider?.user} size="h-11 w-11" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{provider?.businessName || "Provider removed"}</p>
          <p className={`text-xs ${active ? "opacity-70" : "text-muted"}`}>requested {timeAgo(booking.createdAt)}</p>
        </div>
      </div>

      <h3 className="mt-5 flex items-center gap-2 text-2xl font-bold">
        <Wrench className={`h-5 w-5 ${active ? "" : "text-accent"}`} />
        {booking.category?.name}
      </h3>
      <p className={`mt-1 line-clamp-2 text-sm ${active ? "opacity-80" : "text-muted"}`}>{booking.description}</p>

      <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm ${active ? "opacity-80" : "text-muted"}`}>
        <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{booking.serviceAddress}</span>
        {active && provider?.businessPhone && (
          <a href={`tel:${provider.businessPhone}`} className="flex items-center gap-1.5 font-bold underline-offset-2 hover:underline">
            <Phone className="h-4 w-4" />{provider.businessPhone}
          </a>
        )}
      </div>

      {active && booking.acceptedAt && (
        <p className="mt-2 text-sm font-medium">Accepted {formatDate(booking.acceptedAt)} — on the way.</p>
      )}
      {booking.reason && ["cancelled", "rejected", "no_show"].includes(booking.status) && (
        <p className="mt-2 text-sm text-muted">Reason: {booking.reason}</p>
      )}

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
          {provider && ["pending", "in_progress"].includes(booking.status) && (
            <MessageButton bookingId={booking._id} className={outline} />
          )}
          {["pending", "in_progress"].includes(booking.status) && (
            <button className={outline} onClick={() => setModal("cancel")}>Cancel</button>
          )}
          {active && (
            <button
              className="btn bg-accent-ink text-white hover:bg-black"
              disabled={!canReportNoShow}
              onClick={() => setModal("noShow")}
              title={canReportNoShow ? "" : `Available in ${minutesLeft} min`}
            >
              Didn't come?
              {!canReportNoShow && <span className="text-xs opacity-70">{minutesLeft}m</span>}
            </button>
          )}
          {["completed", "no_show"].includes(booking.status) && !booking.isReviewed && (
            <button className="btn-primary" onClick={() => setModal("review")}>Leave a review</button>
          )}
          {booking.isReviewed && <span className="text-sm font-medium text-lime-600 dark:text-lime-400">✓ Reviewed</span>}
        </div>
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
    </NotchCard>
  );
}

export default function MyBookings() {
  // The tab lives in the URL, so a notification can open the right one
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "past" ? "past" : "active";
  const setTab = (next) => setParams({ tab: next }, { replace: true });
  const { data, loading, error, refetch } = useFetch(() => api.get("/booking/customer"), [], "my-bookings");

  // Live: the provider accepted / finished / cancelled -> refresh
  useSocketEvent(
    "booking:updated",
    useCallback(({ side }) => side === "customer" && refetch(), [refetch]),
  );

  const all = data?.bookings || [];
  const count = (key) => all.filter((b) => TABS[key].includes(b.status)).length;
  const bookings = all.filter((b) => TABS[tab].includes(b.status));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title="My bookings" subtitle="Track your requests and review finished jobs.">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Stat value={count("active")} label="Active" badge="live" />
          <Stat value={all.filter((b) => b.status === "completed").length} label="Done" tone="green" badge="✓" />
        </div>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <SectionPill count={bookings.length}>{tab === "active" ? "Active" : "Past"} bookings</SectionPill>
        <Chips
          options={[
            ["active", `Active (${count("active")})`],
            ["past", `Past (${count("past")})`],
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <ErrorBox message={error} />

      {loading && !data ? (
        <SkeletonGrid count={3} item={TaskCardSkeleton} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title={tab === "active" ? "No active bookings" : "No past bookings"}
          action={<Link to="/providers" className="btn-primary">Find a provider</Link>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bookings.map((b) => <BookingCard key={b._id} booking={b} onChanged={refetch} />)}
        </div>
      )}
    </div>
  );
}

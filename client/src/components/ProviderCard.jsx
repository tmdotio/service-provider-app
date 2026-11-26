import { BriefcaseBusiness, CheckCircle2, MapPin, Star } from "lucide-react";
import { Link } from "react-router";
import { Avatar, NotchCard, RatingDots, StatusBadge } from "./ui";

/** Small grey pill with an icon: city, experience. */
function Fact({ icon: Icon, children }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Provider card. Every card has the same rows in the same places, so
 * cards in a row line up whatever the name length or city.
 */
export default function ProviderCard({ provider }) {
  const url = `/providers/${provider._id}`;
  const services = provider.categories?.map((c) => c.name) || [];
  const rating = provider.averageRating || 0;
  const reviews = provider.totalReviews || 0;
  const jobs = provider.completedJobs || 0;

  return (
    <NotchCard to={url} cornerLabel={`Open ${provider.businessName}`} className="group h-full">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 pr-12">
          <Avatar user={provider.user} size="h-12 w-12" />
          <StatusBadge status={provider.availabilityStatus} />
        </div>

        <Link to={url} className="mt-5 block min-w-0">
          {/* Two lines max, and always two lines of space, so rows below line up */}
          <h3
            className="line-clamp-2 min-h-[3.25rem] break-words text-lg font-bold leading-tight transition group-hover:text-accent"
            title={provider.businessName}
          >
            {provider.businessName}
          </h3>
          <p className="mt-1 truncate text-sm text-muted">
            {[services.slice(0, 2).join(", "), provider.user?.name].filter(Boolean).join(" · ")}
          </p>
        </Link>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {provider.location?.city && <Fact icon={MapPin}>{provider.location.city}</Fact>}
          <Fact icon={BriefcaseBusiness}>
            {provider.experienceYears} yr{provider.experienceYears === 1 ? "" : "s"} exp
          </Fact>
        </div>

        <div className="mt-auto pt-5">
          <div className="flex items-center justify-between gap-2 border-t border-line pt-4 text-xs">
            {reviews > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-fg">
                <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                {rating.toFixed(1)}
                <span className="font-normal text-muted">
                  ({reviews} review{reviews === 1 ? "" : "s"})
                </span>
              </span>
            ) : (
              <span className="text-muted">No reviews yet</span>
            )}
            <RatingDots value={rating} />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {jobs} job{jobs === 1 ? "" : "s"} done
            </span>
            {provider.noShowCount > 0 && (
              <span className="font-semibold text-rose-500">{provider.noShowCount} no-show</span>
            )}
          </div>
        </div>
      </div>
    </NotchCard>
  );
}

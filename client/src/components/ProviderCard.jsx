import { Link } from "react-router";
import { Avatar, NotchCard, RatingDots, StatusBadge, Tag } from "./ui";

/** Provider card in the style of the "lead" cards in the reference. */
export default function ProviderCard({ provider }) {
  const url = `/providers/${provider._id}`;
  const services = provider.categories?.map((c) => c.name) || [];

  return (
    <NotchCard to={url} cornerLabel={`Open ${provider.businessName}`} className="group">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 pr-12">
          <Avatar user={provider.user} size="h-12 w-12" />
          <StatusBadge status={provider.availabilityStatus} />
        </div>

        <Link to={url} className="mt-5 block">
          <h3 className="truncate text-xl font-bold transition group-hover:text-accent">{provider.businessName}</h3>
          <p className="mt-0.5 truncate text-sm text-muted">
            {services.slice(0, 2).join(" · ")} · {provider.user?.name}
          </p>
        </Link>

        <div className="mt-auto grid grid-cols-2 gap-3 pt-6 text-xs">
          <div>
            <p className="mb-1.5 text-muted">Area</p>
            <div className="flex flex-wrap gap-1">
              <Tag>{provider.location?.city}</Tag>
              <Tag>{provider.experienceYears} yrs</Tag>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <p className="mb-1.5 text-muted">
              {provider.averageRating?.toFixed(1) || "0.0"} · {provider.totalReviews} review{provider.totalReviews === 1 ? "" : "s"}
            </p>
            <RatingDots value={provider.averageRating || 0} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
          <span>
            {provider.completedJobs} job{provider.completedJobs === 1 ? "" : "s"} done
          </span>
          {provider.noShowCount > 0 && (
            <span className="font-semibold text-rose-500">{provider.noShowCount} no-show</span>
          )}
        </div>
      </div>
    </NotchCard>
  );
}

import { Briefcase, MapPin } from "lucide-react";
import { Link } from "react-router";
import { Avatar, Stars, StatusBadge } from "./ui";

export default function ProviderCard({ provider }) {
  return (
    <Link
      to={`/providers/${provider._id}`}
      className="card flex flex-col gap-3 p-5 transition hover:border-brand-500 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <Avatar user={provider.user} size="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{provider.businessName}</p>
          <p className="truncate text-sm text-gray-500">{provider.user?.name}</p>
        </div>
        <StatusBadge status={provider.availabilityStatus} />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Stars value={provider.averageRating} />
        <span className="text-gray-600">
          {provider.averageRating?.toFixed(1) || "0.0"} ({provider.totalReviews})
        </span>
      </div>

      {provider.description && (
        <p className="line-clamp-2 text-sm text-gray-600">{provider.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {provider.categories?.map((c) => (
          <span key={c._id} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
            {c.name}
          </span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {provider.location?.city}
        </span>
        <span className="flex items-center gap-1">
          <Briefcase className="h-3.5 w-3.5" />
          {provider.completedJobs} job{provider.completedJobs === 1 ? "" : "s"} · {provider.experienceYears} yrs
        </span>
        {provider.noShowCount > 0 && (
          <span className="text-red-600">{provider.noShowCount} no-show</span>
        )}
      </div>
    </Link>
  );
}

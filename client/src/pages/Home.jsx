import { ArrowRight, MapPin, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import api from "../api/axios";
import PostCard from "../components/PostCard";
import ProviderCard from "../components/ProviderCard";
import { Chips, DisplayTitle, SectionPill, Spinner, Stat } from "../components/ui";
import useFetch from "../hooks/useFetch";
import { APP_TAGLINE } from "../utils/format";

const PRO_FILTERS = [
  ["all", "All"],
  ["available", "🟢 Available now"],
  ["rating", "Top rated"],
  ["jobs", "Most jobs"],
  ["experience", "Most experienced"],
];

const filterParams = {
  all: { sort: "rating" },
  available: { availability: "available", sort: "rating" },
  rating: { sort: "rating", minRating: 4 },
  jobs: { sort: "jobs" },
  experience: { sort: "experience" },
};

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [filter, setFilter] = useState("all");

  const categories = useFetch(() => api.get("/categories"), []);
  const allPros = useFetch(() => api.get("/provider", { params: { limit: 1 } }), []);
  const availablePros = useFetch(() => api.get("/provider", { params: { limit: 1, availability: "available" } }), []);
  const pros = useFetch(() => api.get("/provider", { params: { ...filterParams[filter], limit: 4 } }), [filter]);
  const posts = useFetch(() => api.get("/posts", { params: { limit: 2 } }), []);

  const search = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (city.trim()) params.set("city", city.trim());
    navigate(`/providers?${params}`);
  };

  const proTotal = allPros.data?.pagination.total ?? "–";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      {/* Hero */}
      <section className="pt-10 sm:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" /> {APP_TAGLINE}
            </p>
            <DisplayTitle className="text-[clamp(2.75rem,11vw,6rem)]">Find a pro</DisplayTitle>
            <p className="mt-4 max-w-md text-muted">
              Plumbers, electricians, carpenters and more. Real reviews, real photos of their work, and no-shows shown in public.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4 sm:gap-x-10">
            <Stat value={proTotal} label="Pros" badge="verified" />
            <Stat value={availablePros.data?.pagination.total ?? "–"} label="Online" badge="now" tone="green" />
            <Stat value={categories.data?.count ?? "–"} label="Services" />
          </div>
        </div>

        {/* Search capsule, like the "Your Schedule" bar in the reference */}
        <form onSubmit={search} className="glass mt-10 flex flex-col gap-2 rounded-[32px] p-2 shadow-xl shadow-black/5 sm:flex-row sm:items-center sm:rounded-full">
          <label className="flex flex-1 items-center gap-3 rounded-full bg-surface px-5 py-3">
            <Search className="h-5 w-5 shrink-0 text-muted" />
            <input
              className="w-full bg-transparent text-base outline-none placeholder:text-muted sm:text-sm"
              placeholder="What do you need? e.g. AC repair, leaking tap"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Service or problem"
            />
          </label>
          <label className="flex items-center gap-3 rounded-full bg-surface px-5 py-3 sm:w-56">
            <MapPin className="h-5 w-5 shrink-0 text-muted" />
            <input
              className="w-full bg-transparent text-base outline-none placeholder:text-muted sm:text-sm"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-label="City"
            />
          </label>
          <button className="btn bg-accent-gradient h-12 px-7 text-accent-ink shadow-lg shadow-orange-500/20 hover:brightness-105">
            Search <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </section>

      {/* Pros */}
      <section className="mt-16">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <SectionPill count={proTotal}>Top pros</SectionPill>
          <Chips options={PRO_FILTERS} value={filter} onChange={setFilter} />
        </div>
        {pros.loading && !pros.data ? (
          <Spinner />
        ) : (
          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${pros.loading ? "opacity-60" : ""}`}>
            {pros.data?.providers.map((p) => <ProviderCard key={p._id} provider={p} />)}
            {pros.data?.providers.length === 0 && (
              <p className="col-span-full py-10 text-center text-muted">No pros match this filter yet.</p>
            )}
          </div>
        )}
        <div className="mt-6 text-center">
          <Link to="/providers" className="btn-outline">
            See all pros <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Services */}
      <section className="mt-16">
        <div className="mb-5">
          <SectionPill count={categories.data?.count}>Services</SectionPill>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.data?.categories.map((c) => (
            <Link key={c._id} to={`/providers?category=${c._id}`} className="chip py-2.5 pl-4 pr-2">
              {c.name}
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{c.providersCount}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Work */}
      {posts.data?.posts.length > 0 && (
        <section className="mt-16">
          <div className="mb-5 flex items-center justify-between gap-4">
            <SectionPill>Latest work</SectionPill>
            <Link to="/feed" className="btn-ghost">
              Open feed <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {posts.data.posts.map((p) => <PostCard key={p._id} post={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}

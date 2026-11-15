import { CheckCircle2, Search, ShieldCheck, Star } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import api from "../api/axios";
import PostCard from "../components/PostCard";
import ProviderCard from "../components/ProviderCard";
import { Spinner } from "../components/ui";
import useFetch from "../hooks/useFetch";

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  const categories = useFetch(() => api.get("/categories"), []);
  const topProviders = useFetch(
    () => api.get("/provider", { params: { sort: "rating", limit: 3 } }),
    [],
  );
  const posts = useFetch(() => api.get("/posts", { params: { limit: 2 } }), []);

  const search = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (city.trim()) params.set("city", city.trim());
    navigate(`/providers?${params}`);
  };

  return (
    <div>
      <section className="bg-gradient-to-br from-brand-700 to-brand-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
            Trusted plumbers, electricians and more — near you.
          </h1>
          <p className="mt-4 max-w-xl text-brand-50">
            See real reviews and photos of their work, then book in a minute.
          </p>

          <form onSubmit={search} className="mt-8 flex max-w-2xl flex-col gap-2 rounded-xl bg-white p-2 sm:flex-row">
            <input
              className="input border-0 text-gray-900 focus:ring-0"
              placeholder="What do you need? e.g. AC repair"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <input
              className="input border-0 text-gray-900 focus:ring-0 sm:max-w-44"
              placeholder="City e.g. Lahore"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <button className="btn-primary px-6">
              <Search className="h-4 w-4" /> Search
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-50">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Admin-verified providers</span>
            <span className="flex items-center gap-1.5"><Star className="h-4 w-4" /> Reviews from real bookings</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> No-shows are shown publicly</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
        <section>
          <h2 className="mb-4 text-xl font-bold">Browse by service</h2>
          {categories.loading ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {categories.data?.categories.map((c) => (
                <Link
                  key={c._id}
                  to={`/providers?category=${c._id}`}
                  className="card p-4 transition hover:border-brand-500 hover:shadow-md"
                >
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.providersCount} provider{c.providersCount === 1 ? "" : "s"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Top rated providers</h2>
            <Link to="/providers" className="text-sm font-medium text-brand-700 hover:underline">See all</Link>
          </div>
          {topProviders.loading ? (
            <Spinner />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topProviders.data?.providers.map((p) => <ProviderCard key={p._id} provider={p} />)}
            </div>
          )}
        </section>

        {posts.data?.posts.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Latest work</h2>
              <Link to="/feed" className="text-sm font-medium text-brand-700 hover:underline">Open feed</Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {posts.data.posts.map((p) => <PostCard key={p._id} post={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

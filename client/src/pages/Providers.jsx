import { SearchX, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import api from "../api/axios";
import ProviderCard from "../components/ProviderCard";
import { EmptyState, ErrorBox, PageHeader, Pagination, Spinner } from "../components/ui";
import useFetch from "../hooks/useFetch";

/**
 * Provider search. All filters live in the URL (?q=&city=&category=...)
 * so results can be shared and the back button works.
 */
export default function Providers() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [city, setCity] = useState(params.get("city") || "");

  const categories = useFetch(() => api.get("/categories"), []);

  const query = params.toString();
  const { data, loading, error } = useFetch(
    () => api.get("/provider", { params: Object.fromEntries(new URLSearchParams(query)) }),
    [query],
  );

  // Typing waits 400ms before searching (debounce)
  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      if (city.trim()) next.set("city", city.trim());
      else next.delete("city");
      if (next.toString() !== params.toString()) {
        next.delete("page");
        setParams(next);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [q, city]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Find a pro"
        subtitle={data ? `${data.pagination.total} provider${data.pagination.total === 1 ? "" : "s"} found` : " "}
      />

      <div className="glass mb-8 grid gap-2 rounded-[32px] p-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input lg:col-span-2" placeholder="Search by name or service..." value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <select className="input" value={params.get("category") || ""} onChange={(e) => setFilter("category", e.target.value)}>
          <option value="">All services</option>
          {categories.data?.categories.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <select className="input" value={params.get("sort") || "rating"} onChange={(e) => setFilter("sort", e.target.value)}>
          <option value="rating">Top rated</option>
          <option value="jobs">Most jobs done</option>
          <option value="experience">Most experienced</option>
          <option value="newest">Newest</option>
        </select>
        <div className="flex flex-wrap items-center gap-2 px-1 pt-1 text-sm sm:col-span-2 lg:col-span-5">
          <SlidersHorizontal className="mr-1 h-4 w-4 text-muted" />
          <button
            type="button"
            className={`chip ${params.get("availability") === "available" ? "chip-active" : ""}`}
            aria-pressed={params.get("availability") === "available"}
            onClick={() => setFilter("availability", params.get("availability") === "available" ? "" : "available")}
          >
            🟢 Available now
          </button>
          <button
            type="button"
            className={`chip ${params.get("minRating") === "4" ? "chip-active" : ""}`}
            aria-pressed={params.get("minRating") === "4"}
            onClick={() => setFilter("minRating", params.get("minRating") === "4" ? "" : "4")}
          >
            ★ 4 and above
          </button>
        </div>
      </div>

      <ErrorBox message={error} />

      {loading && !data ? (
        <Spinner />
      ) : data?.providers.length === 0 ? (
        <EmptyState icon={SearchX} title="No providers found" text="Try another city or service, or remove some filters." />
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
          {data?.providers.map((p) => <ProviderCard key={p._id} provider={p} />)}
        </div>
      )}

      <Pagination pagination={data?.pagination} onPage={(page) => setFilter("page", String(page))} />
    </div>
  );
}

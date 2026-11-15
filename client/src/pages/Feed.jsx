import { Images } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import api from "../api/axios";
import PostCard from "../components/PostCard";
import { EmptyState, ErrorBox, PageHeader, Spinner } from "../components/ui";
import useFetch from "../hooks/useFetch";

const FILTERS = [
  ["", "All"],
  ["showcase", "Providers' work"],
  ["experience", "Customer experiences"],
];

export default function Feed() {
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState([]);

  const { data, loading, error } = useFetch(async () => {
    const res = await api.get("/posts", { params: { type: type || undefined, page, limit: 10 } });
    // Page 1 replaces the list, next pages are added ("Load more")
    // (skip posts we already have, so a repeated request can't duplicate them)
    setPosts((old) => {
      if (page === 1) return res.data.posts;
      const seen = new Set(old.map((p) => p._id));
      return [...old, ...res.data.posts.filter((p) => !seen.has(p._id))];
    });
    return res;
  }, [type, page]);

  const changeType = (t) => {
    setType(t);
    setPage(1);
  };

  const hasMore = data && page < data.pagination.totalPages;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        title="Work feed"
        subtitle="Real photos of jobs done by providers, shared by them and their customers."
      />

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => changeType(value)}
            className={`btn whitespace-nowrap ${type === value ? "bg-brand-600 text-white" : "border border-gray-300 bg-white text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
        Want to post? Open a provider's profile and share photos of their work.{" "}
        <Link to="/providers" className="font-medium underline">Find a provider</Link>
      </p>

      <ErrorBox message={error} />

      <div className="space-y-4">
        {posts.map((p) => (
          <PostCard key={p._id} post={p} onDeleted={(id) => setPosts((list) => list.filter((x) => x._id !== id))} />
        ))}
      </div>

      {loading && <Spinner />}

      {!loading && posts.length === 0 && (
        <EmptyState icon={Images} title="No posts yet" text="Be the first to share a photo of great work." />
      )}

      {hasMore && !loading && (
        <div className="mt-6 text-center">
          <button className="btn-outline" onClick={() => setPage((p) => p + 1)}>Load more</button>
        </div>
      )}
    </div>
  );
}

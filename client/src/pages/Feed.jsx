import { Images } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import api from "../api/axios";
import PostCard from "../components/PostCard";
import { EmptyState, ErrorBox, PageHeader, PostSkeleton, SkeletonGrid } from "../components/ui";
import useFetch from "../hooks/useFetch";

export default function Feed() {
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState([]);

  const { data, loading, error } = useFetch(async () => {
    const res = await api.get("/posts", { params: { page, limit: 10 } });
    // Page 1 replaces the list, next pages are added ("Load more")
    // (skip posts we already have, so a repeated request can't duplicate them)
    setPosts((old) => {
      if (page === 1) return res.data.posts;
      const seen = new Set(old.map((p) => p._id));
      return [...old, ...res.data.posts.filter((p) => !seen.has(p._id))];
    });
    return res;
  }, [page]);

  const hasMore = data && page < data.pagination.totalPages;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        title="Work board"
        subtitle="Before/after photos of real jobs, posted by the providers themselves."
      />

      <p className="mb-6 rounded-[20px] border border-accent/30 bg-accent/10 px-5 py-3.5 text-sm">
        Real jobs posted by our providers, with before/after photos. Have a question? Ask in the comments — the provider can reply.{" "}
        <Link to="/providers" className="font-semibold text-accent underline underline-offset-2">Find a provider</Link>
      </p>

      <ErrorBox message={error} />

      <div className="space-y-4">
        {posts.map((p, i) => (
          <div key={p._id} className="animate-rise" style={{ animationDelay: `${(i % 10) * 60}ms` }}>
            <PostCard post={p} onDeleted={(id) => setPosts((list) => list.filter((x) => x._id !== id))} />
          </div>
        ))}
      </div>

      {loading && <SkeletonGrid count={page === 1 ? 2 : 1} item={PostSkeleton} className="mt-4 space-y-4" />}

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

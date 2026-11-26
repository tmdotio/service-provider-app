import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import api from "../api/axios";
import PostCard from "../components/PostCard";
import { EmptyState, PostSkeleton } from "../components/ui";
import useFetch from "../hooks/useFetch";

/** One post with its comments open: where notifications take you. */
export default function PostDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const commentId = params.get("comment");

  const { data, loading, error } = useFetch(() => api.get(`/posts/${id}`), [id]);
  const post = data?.post;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/feed" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-accent">
        <ArrowLeft className="h-4 w-4" /> Work board
      </Link>

      {loading && !post && <PostSkeleton />}
      {!loading && (error || !post) && (
        <EmptyState
          title="Post not found"
          text="It may have been deleted or hidden."
          action={<Link to="/feed" className="btn-primary">Go to work board</Link>}
        />
      )}
      {post && (
        <PostCard
          key={`${post._id}-${commentId || ""}`}
          post={post}
          openComments
          highlightCommentId={commentId}
          onDeleted={() => navigate("/feed")}
        />
      )}
    </div>
  );
}

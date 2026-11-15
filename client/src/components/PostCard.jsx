import { BadgeCheck, Flag, Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router";
import api, { getErrorMessage } from "../api/axios";
import useAuth from "../hooks/useAuth";
import { timeAgo } from "../utils/format";
import { Avatar, Modal } from "./ui";

const REPORT_REASONS = ["spam", "fake", "abusive", "inappropriate", "other"];

function Comments({ post, onCountChange }) {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");

  useEffect(() => {
    api
      .get(`/posts/${post._id}/comments`)
      .then((res) => setComments(res.data.comments))
      .catch(() => setComments([]));
  }, [post._id]);

  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const res = await api.post(`/posts/${post._id}/comments`, { text: text.trim() });
      setComments((list) => [res.data.comment, ...(list || [])]);
      setText("");
      onCountChange(1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/posts/${post._id}/comments/${id}`);
      setComments((list) => list.filter((c) => c._id !== id));
      onCountChange(-1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isPostAuthor = user && post.author?._id === user._id;

  return (
    <div className="space-y-3 border-t px-4 py-3">
      {user && (
        <form onSubmit={add} className="flex gap-2">
          <input
            className="input"
            placeholder="Write a comment..."
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn-primary px-3" aria-label="Send comment">
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
      {comments?.length === 0 && <p className="text-sm text-gray-500">No comments yet</p>}
      {comments?.map((c) => (
        <div key={c._id} className="flex gap-2">
          <Avatar user={c.author} size="h-8 w-8" />
          <div className="flex-1 rounded-lg bg-gray-100 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{c.author?.name}</span>
              <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-700">{c.text}</p>
          </div>
          {user && (c.author?._id === user._id || isPostAuthor || isAdmin) && (
            <button onClick={() => remove(c._id)} className="self-start p-1 text-gray-400 hover:text-red-600" aria-label="Delete comment">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PostCard({ post: initialPost, onDeleted }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(initialPost);
  const [showComments, setShowComments] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("spam");

  const isAuthor = user && post.author?._id === user._id;

  const requireLogin = () => {
    toast("Please log in first");
    navigate("/login");
  };

  const toggleLike = async () => {
    if (!user) return requireLogin();
    // Update the screen first, then fix it if the server disagrees
    setPost((p) => ({
      ...p,
      likedByMe: !p.likedByMe,
      likesCount: p.likesCount + (p.likedByMe ? -1 : 1),
    }));
    try {
      const res = await api.post(`/posts/${post._id}/like`);
      setPost((p) => ({ ...p, likedByMe: res.data.liked, likesCount: res.data.likesCount }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await api.delete(`/posts/${post._id}`);
      toast.success("Post deleted");
      onDeleted?.(post._id);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const report = async () => {
    try {
      await api.post(`/posts/${post._id}/report`, { reason });
      toast.success("Thanks, an admin will review it");
      setReportOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const images = post.images || [];

  return (
    <article className="card overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <Avatar user={post.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{post.author?.name}</span>
            {post.type === "showcase" ? (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">Provider's work</span>
            ) : (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Customer experience</span>
            )}
            {post.isVerifiedCustomer && (
              <span className="flex items-center gap-1 text-xs text-green-700">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified customer
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            about{" "}
            <Link to={`/providers/${post.provider?._id}`} className="font-medium text-brand-700 hover:underline">
              {post.provider?.businessName}
            </Link>{" "}
            · {timeAgo(post.createdAt)}
          </p>
        </div>
        {(isAuthor || isAdmin) && (
          <button onClick={remove} className="p-1 text-gray-400 hover:text-red-600" aria-label="Delete post">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="whitespace-pre-line px-4 pb-3 text-sm text-gray-800">{post.text}</p>

      {images.length > 0 && (
        <div className={`grid gap-0.5 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.map((img, i) => (
            <a key={img.url} href={img.url} target="_blank" rel="noreferrer">
              <img
                src={img.url}
                alt={`Photo ${i + 1}`}
                loading="lazy"
                className={`w-full object-cover ${images.length === 1 ? "max-h-[28rem]" : "aspect-square"}`}
              />
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 px-2 py-2 text-sm">
        <button
          onClick={toggleLike}
          className="btn-ghost"
          aria-pressed={post.likedByMe}
          aria-label={`${post.likedByMe ? "Unlike" : "Like"} (${post.likesCount} likes)`}
        >
          <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-red-500 text-red-500" : ""}`} />
          {post.likesCount}
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="btn-ghost"
          aria-expanded={showComments}
          aria-label={`Comments (${post.commentsCount})`}
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentsCount}
        </button>
        {user && !isAuthor && (
          <button onClick={() => setReportOpen(true)} className="btn-ghost ml-auto text-gray-400" aria-label="Report post">
            <Flag className="h-4 w-4" />
          </button>
        )}
      </div>

      {showComments && (
        <Comments
          post={post}
          onCountChange={(n) => setPost((p) => ({ ...p, commentsCount: p.commentsCount + n }))}
        />
      )}

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report this post">
        <div className="space-y-2">
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm capitalize">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
              {r}
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setReportOpen(false)}>Cancel</button>
          <button className="btn-danger" onClick={report}>Report</button>
        </div>
      </Modal>
    </article>
  );
}

import { CornerDownRight, Flag, Heart, MessageCircle, Send, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router";
import api, { getErrorMessage } from "../api/axios";
import useAuth from "../hooks/useAuth";
import { timeAgo } from "../utils/format";
import { Avatar, Img, Modal } from "./ui";

const REPORT_REASONS = ["spam", "fake", "abusive", "inappropriate", "other"];

/** One comment bubble (used for comments and replies). */
function Bubble({ c, isReply, canDelete, onDelete, isProviderReply }) {
  return (
    <div className="flex gap-2.5">
      <Avatar user={c.author} size={isReply ? "h-7 w-7" : "h-8 w-8"} />
      <div className={`min-w-0 flex-1 rounded-[18px] px-3.5 py-2.5 ${isProviderReply ? "border border-accent/30 bg-accent/10" : "bg-surface-2"}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{c.author?.name}</span>
            {isProviderReply && (
              <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-bold uppercase text-accent-ink">Provider</span>
            )}
          </span>
          <span className="shrink-0 text-xs text-muted">{timeAgo(c.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-fg/90">{c.text}</p>
      </div>
      {canDelete && (
        <button onClick={onDelete} className="self-start p-1.5 text-muted hover:text-rose-500" aria-label="Delete comment">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Comments under a post. Anyone logged in can comment; only the
 * provider who posted can reply (one level, shown under the comment).
 */
function Comments({ post, onCountChange }) {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");

  const isPostOwner = Boolean(user && post.author?._id === user._id);

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

  const reply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
      const res = await api.post(`/posts/${post._id}/comments`, { text: replyText.trim(), parentId: replyTo });
      setComments((list) =>
        list.map((c) => (c._id === replyTo ? { ...c, replies: [...c.replies, res.data.comment] } : c)),
      );
      setReplyTo(null);
      setReplyText("");
      onCountChange(1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (comment, parentId) => {
    try {
      await api.delete(`/posts/${post._id}/comments/${comment._id}`);
      if (parentId) {
        setComments((list) =>
          list.map((c) => (c._id === parentId ? { ...c, replies: c.replies.filter((r) => r._id !== comment._id) } : c)),
        );
        onCountChange(-1);
      } else {
        setComments((list) => list.filter((c) => c._id !== comment._id));
        onCountChange(-(1 + (comment.replies?.length || 0)));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const canDelete = (c) => Boolean(user && (c.author?._id === user._id || isPostOwner || isAdmin));

  return (
    <div className="space-y-4 border-t border-line px-4 py-4">
      {user && !isPostOwner && (
        <form onSubmit={add} className="flex gap-2">
          <input
            className="input rounded-full"
            placeholder="Ask about this job..."
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            aria-label="Write a comment"
          />
          <button className="btn-primary h-12 w-12 shrink-0 p-0 sm:h-11 sm:w-11" aria-label="Send comment">
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
      {!user && (
        <p className="text-sm text-muted">
          <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link> to ask a question.
        </p>
      )}

      {comments === null && <p className="text-sm text-muted">Loading comments…</p>}
      {comments?.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}

      {comments?.map((c) => (
        <div key={c._id} className="space-y-2">
          <Bubble c={c} canDelete={canDelete(c)} onDelete={() => remove(c)} />

          {(c.replies.length > 0 || replyTo === c._id || isPostOwner) && (
            <div className="ml-6 space-y-2 border-l-2 border-line pl-3">
              {c.replies.map((r) => (
                <Bubble key={r._id} c={r} isReply isProviderReply canDelete={canDelete(r)} onDelete={() => remove(r, c._id)} />
              ))}

              {isPostOwner &&
                (replyTo === c._id ? (
                  <form onSubmit={reply} className="flex gap-2">
                    <input
                      className="input rounded-full"
                      autoFocus
                      placeholder={`Reply to ${c.author?.name}...`}
                      value={replyText}
                      maxLength={500}
                      onChange={(e) => setReplyText(e.target.value)}
                      aria-label="Write a reply"
                    />
                    <button className="btn-primary h-12 shrink-0 sm:h-11">Reply</button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setReplyTo(c._id);
                      setReplyText("");
                    }}
                    className="flex items-center gap-1.5 py-1 text-xs font-semibold text-accent"
                  >
                    <CornerDownRight className="h-3.5 w-3.5" /> Reply
                  </button>
                ))}
            </div>
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
  const beforeImgs = images.filter((img) => img.label === "before");
  const afterImgs = images.filter((img) => img.label !== "before");
  const provider = post.provider;

  return (
    <article className="card overflow-hidden">
      {/* Header: the provider who did this job */}
      <div className="flex items-start gap-3 p-4">
        <Link to={`/providers/${provider?._id}`} className="shrink-0">
          <Avatar user={provider?.user || post.author} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/providers/${provider?._id}`} className="block truncate font-semibold hover:text-accent">
            {provider?.businessName || post.author?.name}
          </Link>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            {provider?.averageRating > 0 && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-fg">
                <Star className="h-3.5 w-3.5 fill-accent text-accent" /> {provider.averageRating.toFixed(1)}
              </span>
            )}
            <span>{post.author?.name}</span>· {timeAgo(post.createdAt)}
          </p>
        </div>

        {(isAuthor || isAdmin) && (
          <button onClick={remove} className="icon-btn h-9 w-9 shrink-0 hover:border-rose-500 hover:text-rose-500" aria-label="Delete post">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="whitespace-pre-line px-4 pb-4 text-sm text-fg">{post.text}</p>

      {/* Photos: Before | After side by side when both exist */}
      {images.length > 0 &&
        (beforeImgs.length > 0 ? (
          <div className="grid grid-cols-2 gap-0.5">
            {[
              ["Before", beforeImgs[0]],
              ["After", afterImgs[0]],
            ].map(([label, img]) =>
              img ? (
                <a key={label} href={img.url} target="_blank" rel="noreferrer" className="relative block">
                  <Img src={img.url} alt={`${label} the job`} width={480} className="aspect-[4/5] w-full sm:aspect-square" />
                  <span
                    className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                      label === "After" ? "bg-accent text-accent-ink" : "bg-black/60 text-white backdrop-blur"
                    }`}
                  >
                    {label}
                  </span>
                </a>
              ) : null,
            )}
          </div>
        ) : (
          <div className={`grid gap-0.5 ${afterImgs.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {afterImgs.map((img, i) => (
              <a key={img.url} href={img.url} target="_blank" rel="noreferrer">
                <Img
                  src={img.url}
                  alt={`Photo ${i + 1}`}
                  width={afterImgs.length === 1 ? 900 : 480}
                  className={`w-full ${afterImgs.length === 1 ? "aspect-[4/3] max-h-[28rem]" : "aspect-square"}`}
                />
              </a>
            ))}
          </div>
        ))}

      {/* Extra photos beyond the first before/after pair */}
      {beforeImgs.length > 0 && images.length > 2 && (
        <div className="flex gap-1 overflow-x-auto px-4 pt-2">
          {[...beforeImgs.slice(1), ...afterImgs.slice(1)].map((img) => (
            <a key={img.url} href={img.url} target="_blank" rel="noreferrer" className="shrink-0">
              <Img src={img.url} width={64} height={64} className="h-16 w-16 rounded-xl" />
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
          <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-rose-500 text-rose-500" : ""}`} />
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
          <button onClick={() => setReportOpen(true)} className="btn-ghost ml-auto text-muted" aria-label="Report post">
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

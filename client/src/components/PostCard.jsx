import { CornerDownRight, Flag, Heart, MessageCircle, Send, ShieldCheck, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router";
import api, { getErrorMessage } from "../api/axios";
import useAuth from "../hooks/useAuth";
import { timeAgo } from "../utils/format";
import { scrollToElement } from "../utils/smoothScroll";
import { Avatar, Img, Modal } from "./ui";

const REPORT_REASONS = ["spam", "fake", "abusive", "inappropriate", "other"];

/** One comment bubble (used for comments and replies). */
function Bubble({ c, isReply, canDelete, onDelete, onReply, highlighted }) {
  const isAdmin = c.author?.role === "admin";
  const isProvider = c.author?.role === "provider";
  return (
    <div
      id={`comment-${c._id}`}
      className={`flex scroll-mt-28 gap-2.5 rounded-[20px] transition-shadow duration-700 ${highlighted ? "ring-2 ring-accent ring-offset-4 ring-offset-surface" : ""}`}
    >
      <Avatar user={c.author} size={isReply ? "h-7 w-7" : "h-8 w-8"} />
      <div className={`min-w-0 flex-1 rounded-[18px] px-3.5 py-2.5 ${isAdmin ? "border border-amber-400/60 bg-amber-100/80 dark:bg-amber-950/50" : "bg-surface-2"}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{c.author?.name || "Deleted user"}</span>
            {isAdmin && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400 bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                <ShieldCheck className="h-3 w-3" /> Admin
              </span>
            )}
            {isProvider && (
              <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">Provider</span>
            )}
          </span>
          <span className="shrink-0 text-xs text-muted">{timeAgo(c.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-fg/90">
          {c.replyTo?.name && <span className="mr-1 font-semibold text-accent">@{c.replyTo.name}</span>}
          {c.text}
        </p>
        {onReply && (
          <button onClick={onReply} className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent">
            <CornerDownRight className="h-3.5 w-3.5" /> Reply
          </button>
        )}
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
 * Comments under a post. Anyone logged in can comment and reply.
 * Replies stay in one thread under the top-level comment; a reply to a
 * reply shows "@name" so it is clear who is being answered.
 */
function Comments({ post, onCountChange, highlightId }) {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  // { thread: top-level comment id, target: comment being answered, name }
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [flash, setFlash] = useState(highlightId);

  const isPostOwner = Boolean(user && post.author?._id === user._id);

  useEffect(() => {
    api
      .get(`/posts/${post._id}/comments`, { params: { limit: 50 } })
      .then((res) => setComments(res.data.comments))
      .catch(() => setComments([]));
  }, [post._id]);

  // Coming from a notification: scroll to that comment and flash it
  useEffect(() => {
    if (!comments || !highlightId) return;
    scrollToElement(document.getElementById(`comment-${highlightId}`));
    const id = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(id);
  }, [comments, highlightId]);

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

  const startReply = (thread, target) => {
    if (!user) return toast("Please log in to reply");
    setReplyTo({ thread: thread._id, target: target._id, name: target.author?.name || "Deleted user" });
    setReplyText("");
  };

  const reply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !replyTo) return;
    try {
      const res = await api.post(`/posts/${post._id}/comments`, { text: replyText.trim(), parentId: replyTo.target });
      setComments((list) =>
        list.map((c) => (c._id === replyTo.thread ? { ...c, replies: [...c.replies, res.data.comment] } : c)),
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
      {user && (
        <form onSubmit={add} className="flex gap-2">
          <input
            className="input rounded-full"
            placeholder="Write a comment..."
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
          <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link> to like or comment.
        </p>
      )}

      {comments === null && <p className="text-sm text-muted">Loading comments…</p>}
      {comments?.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}

      {comments?.map((c) => (
        <div key={c._id} className="space-y-2">
          <Bubble
            c={c}
            highlighted={flash === c._id}
            canDelete={canDelete(c)}
            onDelete={() => remove(c)}
            onReply={user ? () => startReply(c, c) : undefined}
          />

          {(c.replies.length > 0 || replyTo?.thread === c._id) && (
            <div className="ml-6 space-y-2 border-l-2 border-line pl-3">
              {c.replies.map((r) => (
                <Bubble
                  key={r._id}
                  c={r}
                  isReply
                  highlighted={flash === r._id}
                  canDelete={canDelete(r)}
                  onDelete={() => remove(r, c._id)}
                  onReply={user ? () => startReply(c, r) : undefined}
                />
              ))}

              {replyTo?.thread === c._id && (
                <form onSubmit={reply} className="flex gap-2">
                  <input
                    className="input rounded-full"
                    autoFocus
                    placeholder={`Reply to ${replyTo.name}...`}
                    value={replyText}
                    maxLength={500}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setReplyTo(null)}
                    aria-label="Write a reply"
                  />
                  <button type="button" onClick={() => setReplyTo(null)} className="btn-outline h-12 shrink-0 sm:h-11">
                    Cancel
                  </button>
                  <button className="btn-primary h-12 shrink-0 sm:h-11">Reply</button>
                </form>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PostCard({ post: initialPost, onDeleted, openComments = false, highlightCommentId }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(initialPost);
  const [showComments, setShowComments] = useState(openComments);
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

      {images.length > 0 && (
        <div className={`grid gap-0.5 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.map((img, i) => (
            <a key={img.fileId || img.url} href={img.url} target="_blank" rel="noreferrer" className="relative block">
              <Img src={img.url} alt={`Work photo ${i + 1}`} width={images.length === 1 ? 900 : 480}
                className={`w-full ${images.length === 1 ? "aspect-[4/3] max-h-[28rem]" : "aspect-square"}`} />
              {["before", "after"].includes(img.label) && (
                <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-bold capitalize text-white">{img.label}</span>
              )}
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
          highlightId={highlightCommentId}
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

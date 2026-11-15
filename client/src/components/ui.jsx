import { ArrowUpRight, Loader2, Star, X } from "lucide-react";
import { useEffect } from "react";
import { startScroll, stopScroll } from "../utils/smoothScroll";
import { Link } from "react-router";
import { initials } from "../utils/format";

/* ---------- Brand bits ---------- */

/** The orange "target" used as the O in big headlines and the logo. */
export function TargetO({ className = "h-[0.78em] w-[0.78em]", color = "var(--accent)" }) {
  return (
    <svg viewBox="0 0 40 40" className={`inline-block align-[-0.06em] ${className}`} aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill="none" stroke={color} strokeWidth="6" />
      <circle cx="20" cy="20" r="6.5" fill={color} />
    </svg>
  );
}

/**
 * Big wide headline. The first "O" becomes the orange target,
 * like "W◎RKSPACE" in the reference.
 */
export function DisplayTitle({ children, as: Tag = "h1", className = "", targetColor }) {
  const text = String(children).toUpperCase();
  const parts = text.split(" ");
  const targetWord = parts.findIndex((word) => word.includes("O"));

  // Each word stays on one line, so the target never wraps away from its word
  const words = parts.map((word, w) => {
    const i = w === targetWord ? word.indexOf("O") : -1;
    if (i === -1) return <span key={w} className="whitespace-nowrap">{word}</span>;
    return (
      <span key={w} className="whitespace-nowrap">
        {word.slice(0, i)}
        <TargetO color={targetColor} />
        {word.slice(i + 1)}
      </span>
    );
  });

  return (
    <Tag className={`font-wide leading-[0.95] ${className}`} aria-label={text}>
      <span aria-hidden="true">
        {words.reduce((acc, el, i) => (i === 0 ? [el] : [...acc, " ", el]), [])}
      </span>
    </Tag>
  );
}

/** Outlined pill title with an orange counter: "New leads 8" */
export function SectionPill({ children, count }) {
  return (
    <h2 className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-lg font-semibold">
      {children}
      {count !== undefined && <span className="text-accent">{count}</span>}
    </h2>
  );
}

/** Big number stat: "34 Deals ↑4" */
export function Stat({ value, label, badge, tone = "accent" }) {
  const tones = {
    accent: "bg-accent text-accent-ink",
    green: "bg-lime-400 text-lime-950",
    red: "bg-rose-500 text-white",
  };
  return (
    <div className="flex items-end gap-2">
      <span className="font-wide text-4xl sm:text-5xl">{value}</span>
      <span className="mb-1.5 flex flex-col items-start gap-1 text-sm text-muted">
        {badge !== undefined && (
          <span className={`rounded-full px-1.5 text-[11px] font-bold leading-4 ${tones[tone]}`}>{badge}</span>
        )}
        {label}
      </span>
    </div>
  );
}

/**
 * Card with the round cut-out in the top-right corner holding an
 * arrow button (or any action passed in `corner`).
 */
export function NotchCard({ to, onCornerClick, corner, cornerLabel = "Open", className = "", children, highlight = false }) {
  const cornerContent = corner || <ArrowUpRight className="h-5 w-5" />;
  const cornerClass = "icon-btn absolute right-[4px] top-[4px] h-11 w-11";

  return (
    <div className={`relative ${className}`}>
      <div
        className={`notch h-full rounded-[28px] border p-5 ${
          highlight ? "bg-accent-gradient border-transparent text-accent-ink" : "border-line bg-surface"
        }`}
      >
        {children}
      </div>
      {to ? (
        <Link to={to} className={cornerClass} aria-label={cornerLabel}>
          {cornerContent}
        </Link>
      ) : onCornerClick ? (
        <button type="button" onClick={onCornerClick} className={cornerClass} aria-label={cornerLabel}>
          {cornerContent}
        </button>
      ) : (
        // No action: keep the circle so the cut-out never looks empty
        <span className={`${cornerClass} pointer-events-none text-muted`} aria-hidden="true">
          {cornerContent}
        </span>
      )}
    </div>
  );
}

/** Row of filter pills */
export function Chips({ options, value, onChange, className = "" }) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 ${className}`} role="tablist">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={`chip ${value === key ? "chip-active" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ---------- General UI ---------- */

export function Spinner({ className = "" }) {
  return (
    <div className={`flex justify-center py-10 ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
      {message}
    </div>
  );
}

export function Avatar({ user, size = "h-11 w-11" }) {
  if (user?.avatar) {
    return <img src={user.avatar} alt={user.name || ""} className={`${size} shrink-0 rounded-full object-cover ring-2 ring-surface`} />;
  }
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-sm font-bold text-accent-ink ring-2 ring-surface`}
    >
      {initials(user?.name) || "?"}
    </div>
  );
}

/** Read-only stars, or clickable stars when onChange is given. */
export function Stars({ value = 0, onChange, size = "h-4 w-4" }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = <Star className={`${size} ${filled ? "fill-accent text-accent" : "text-line"}`} />;
        return onChange ? (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} className="p-0.5">
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}

/** Rating shown as 5 coloured dots, like the "Hot client" dots in the reference */
export function RatingDots({ value = 0 }) {
  const colors = ["bg-rose-500", "bg-orange-400", "bg-amber-300", "bg-lime-400", "bg-emerald-500"];
  return (
    <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1" aria-label={`Rating ${value.toFixed(1)} of 5`}>
      {colors.map((c, i) => (
        <span key={c} className={`h-2.5 w-2.5 rounded-full ${i < Math.round(value) ? c : "bg-line"}`} />
      ))}
    </span>
  );
}

const STATUS_STYLES = {
  pending: "bg-amber-400/15 text-amber-700 dark:text-amber-300",
  in_progress: "bg-sky-400/15 text-sky-700 dark:text-sky-300",
  completed: "bg-lime-400/20 text-lime-800 dark:text-lime-300",
  rejected: "bg-surface-2 text-muted",
  cancelled: "bg-surface-2 text-muted",
  no_show: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  available: "bg-lime-400/20 text-lime-800 dark:text-lime-300",
  busy: "bg-amber-400/15 text-amber-700 dark:text-amber-300",
  offline: "bg-surface-2 text-muted",
  approved: "bg-lime-400/20 text-lime-800 dark:text-lime-300",
};

const STATUS_LABELS = { in_progress: "In progress", no_show: "No-show" };

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status] || "bg-surface-2 text-muted"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/** Small grey tag: "Linkedin", "Email" */
export function Tag({ children }) {
  return <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{children}</span>;
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    stopScroll(); // the page behind the popup must not move
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      startScroll();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-3"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* On phones it slides up from the bottom like an app sheet */}
      <div
        data-lenis-prevent
        className={`glass max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-[sheet-up_0.25s_ease-out] sm:rounded-[28px] sm:p-6 ${wide ? "max-w-2xl" : "max-w-lg"}`}
      >
        <div className="mx-auto -mt-1 mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="icon-btn h-9 w-9" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages } = pagination;
  return (
    <div className="mt-8 flex items-center justify-center gap-3 text-sm">
      <button className="btn-outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="text-muted">Page {page} of {totalPages}</span>
      <button className="btn-outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

/** Page top: big display title + optional subtitle, stats or actions */
export function PageHeader({ title, subtitle, action, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        <DisplayTitle className="text-4xl sm:text-5xl">{title}</DisplayTitle>
        {subtitle && <div className="mt-3 text-muted">{subtitle}</div>}
      </div>
      {children}
      {action}
    </div>
  );
}

/** Underlined tabs */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            value === key ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

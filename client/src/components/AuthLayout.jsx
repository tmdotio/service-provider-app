import { CheckCircle2 } from "lucide-react";
import { APP_NAME } from "../utils/format";
import { DisplayTitle } from "./ui";

const POINTS = [
  "Every provider is approved by an admin",
  "Reviews only from real, finished bookings",
  "No-shows are shown on the profile",
];

/** Two panels: orange brand panel + the form. */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-10 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden rounded-[32px] bg-accent-gradient p-10 text-accent-ink lg:flex lg:flex-col">
        {/* soft light spots for depth */}
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-orange-700/30 blur-3xl" />

        <p className="relative font-semibold">{APP_NAME}</p>
        <DisplayTitle as="p" className="relative mt-auto text-5xl" targetColor="currentColor">Book a provider</DisplayTitle>
        <ul className="relative mt-8 space-y-3">
          {POINTS.map((p) => (
            <li key={p} className="flex items-center gap-3 font-medium">
              <CheckCircle2 className="h-5 w-5 shrink-0" /> {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="glass rounded-[32px] p-8 sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

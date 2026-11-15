import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Smooth scrolling with Lenis.
 *
 * - Off for people who ask their system for reduced motion.
 * - On touch screens Lenis keeps the phone's own native scrolling
 *   (it already feels smooth there), so it only smooths mouse/trackpad.
 * - Popups call stopScroll()/startScroll() so the page behind them
 *   doesn't move.
 */
let lenis = null;

export const initSmoothScroll = () => {
  if (lenis || typeof window === "undefined") return lenis;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    smoothWheel: true,
    anchors: true,
  });

  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  return lenis;
};

export const scrollToTop = () => {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
};

export const stopScroll = () => lenis?.stop();
export const startScroll = () => lenis?.start();

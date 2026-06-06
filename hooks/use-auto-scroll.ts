import { useEffect, useRef } from "react";

interface UseAutoScrollOptions {
  /**
   * Speed in pixels per frame (negative for left, positive for right)
   * @default -0.5
   */
  speed?: number;

  /**
   * Pause scrolling on hover
   * @default false
   */
  pauseOnHover?: boolean;

  /**
   * Enable/disable scrolling
   * @default true
   */
  enabled?: boolean;
}

/**
 * Hook for infinite horizontal scroll animation
 * Used in: WinsTicker, Ticker components
 *
 * @example
 * ```tsx
 * const tickerRef = useRef<HTMLDivElement>(null);
 * useAutoScroll(tickerRef, { speed: -0.5 });
 *
 * return (
 *   <div ref={tickerRef} className="flex">
 *     {[...items, ...items].map(item => ...)}
 *   </div>
 * );
 * ```
 */
export function useAutoScroll<T extends HTMLElement>(
  containerRef: React.RefObject<T | null>,
  options: UseAutoScrollOptions = {}
) {
  const { speed = -0.5, pauseOnHover = false, enabled = true } = options;
  const animationRef = useRef<number | undefined>(undefined);
  const isPausedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    let currentOffset = 0;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      if (!isPausedRef.current) {
        const deltaTime = currentTime - lastTime;
        currentOffset += (speed * deltaTime) / 16; // Normalize to ~60fps

        const totalWidth = container.scrollWidth;
        const visibleWidth = container.clientWidth;

        // Reset offset when we've scrolled half the total width
        // (assuming content is duplicated for seamless loop)
        if (Math.abs(currentOffset) >= totalWidth / 2) {
          currentOffset = 0;
        }

        container.style.transform = `translateX(${currentOffset}px)`;
      }

      lastTime = currentTime;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, speed, containerRef]);

  // Handle pause on hover
  useEffect(() => {
    if (!pauseOnHover || !enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleMouseEnter = () => {
      isPausedRef.current = true;
    };

    const handleMouseLeave = () => {
      isPausedRef.current = false;
    };

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [pauseOnHover, enabled, containerRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
}

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  carouselSlide,
  carouselVariants,
  dotIndicator,
  dotTransition,
} from "@/components/lib/game-animations";

export interface PromoBanner {
  /**
   * Banner title
   */
  title: string;

  /**
   * Subtitle text (e.g., prize amount)
   */
  subtitle: string;

  /**
   * CTA button text
   */
  cta: string;

  /**
   * Background gradient (CSS)
   */
  bg: string;

  /**
   * Accent color for subtitle and button
   */
  accent: string;

  /**
   * Large emoji decoration
   */
  emoji: string;

  /**
   * Optional click handler
   */
  onClick?: () => void;
}

export interface PromoCarouselProps {
  /**
   * Array of banners to display
   */
  banners: PromoBanner[];

  /**
   * Auto-rotate interval in milliseconds
   * @default 4000
   */
  autoRotateInterval?: number;

  /**
   * Enable/disable auto-rotation
   * @default true
   */
  autoRotate?: boolean;

  /**
   * Container class name
   */
  className?: string;

  /**
   * Banner height
   * @default 160
   */
  height?: number;
}

/**
 * Auto-rotating promotional banner carousel
 * Features smooth transitions and dot navigation
 *
 * @example
 * ```tsx
 * const banners = [
 *   {
 *     title: "FIFA World Cup 2026 Hub",
 *     subtitle: "$2M+ IN PRIZES",
 *     cta: "Join Now",
 *     bg: "linear-gradient(135deg, #1a3a8f 0%, #0d1f5c 50%, #1a3a8f 100%)",
 *     accent: "#00C851",
 *     emoji: "⚽"
 *   }
 * ];
 *
 * <PromoCarousel banners={banners} />
 * ```
 */
const PromoCarousel = React.forwardRef<HTMLDivElement, PromoCarouselProps>(
  (
    {
      banners,
      autoRotateInterval = 4000,
      autoRotate = true,
      className,
      height = 160,
    },
    ref
  ) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [direction, setDirection] = React.useState(0);

    // Auto-rotate
    React.useEffect(() => {
      if (!autoRotate) return;

      const interval = setInterval(() => {
        setDirection(1);
        setCurrentIndex((prev) => (prev + 1) % banners.length);
      }, autoRotateInterval);

      return () => clearInterval(interval);
    }, [autoRotate, autoRotateInterval, banners.length]);

    const goToBanner = (index: number) => {
      setDirection(index > currentIndex ? 1 : -1);
      setCurrentIndex(index);
    };

    const nextBanner = () => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    };

    const prevBanner = () => {
      setDirection(-1);
      setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    };

    const currentBanner = banners[currentIndex];

    return (
      <div
        ref={ref}
        className={cn("relative", className)}
        style={{ height: `${height}px` }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={carouselVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={carouselSlide}
            className="absolute inset-0 overflow-hidden rounded-xl"
            style={{ background: currentBanner.bg }}
            onClick={currentBanner.onClick}
          >
            {/* Large emoji decoration */}
            <div
              className="absolute right-5 top-1/2 -translate-y-1/2 text-7xl opacity-85 pointer-events-none"
              style={{
                filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))",
              }}
            >
              {currentBanner.emoji}
            </div>

            {/* Content */}
            <div className="absolute inset-0 p-5 pb-4 flex flex-col justify-end">
              <div
                className="text-[11px] font-bold tracking-widest uppercase mb-1"
                style={{ color: currentBanner.accent }}
              >
                {currentBanner.subtitle}
              </div>
              <div className="text-xl font-bold text-white mb-3 leading-tight max-w-[55%]">
                {currentBanner.title}
              </div>
              <Button
                className="w-fit px-5 py-2 text-[13px] font-bold tracking-wide h-auto rounded-md"
                style={{
                  background: currentBanner.accent,
                  color: currentBanner.accent === "#FFB800" ? "#000" : "#000",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  currentBanner.onClick?.();
                }}
              >
                {currentBanner.cta}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-black/20 hover:bg-black/30 text-white backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity"
          onClick={prevBanner}
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-black/20 hover:bg-black/30 text-white backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity"
          onClick={nextBanner}
        >
          <ChevronRight size={16} />
        </Button>

        {/* Dot indicators */}
        <div
          className={cn(
            "absolute bottom-2.5 right-3",
            "flex gap-1"
          )}
        >
          {banners.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => goToBanner(index)}
              className="rounded-full bg-white/30 cursor-pointer"
              animate={currentIndex === index ? "active" : "inactive"}
              variants={dotIndicator}
              transition={dotTransition}
              aria-label={`Go to banner ${index + 1}`}
            />
          ))}
        </div>
      </div>
    );
  }
);
PromoCarousel.displayName = "PromoCarousel";

export { PromoCarousel };

import type { Transition, Variants } from "motion/react";

/**
 * Animation presets for game UI components
 * Ensures consistent timing and easing across the application
 */

/**
 * Tab panel transition - fade with vertical slide
 * Used in: AuthTabs, CategoryTabs
 */
export const tabTransition: Transition = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1],
};

export const tabVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

/**
 * Carousel slide transition - fade with horizontal slide
 * Used in: PromoCarousel
 */
export const carouselSlide: Transition = {
  duration: 0.4,
  ease: [0.4, 0, 0.2, 1],
};

export const carouselVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
};

/**
 * Hover scale effect for cards
 * Used in: GameCard, GradientCard
 */
export const hoverScale: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.04 },
  press: { scale: 0.97 },
};

export const hoverTransition: Transition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
};

/**
 * Simple fade in
 * Used in: BottomNav items, general fade-ins
 */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

export const fadeInTransition: Transition = {
  duration: 0.15,
};

/**
 * Stagger container for animating children sequentially
 * Used in: GameGrid, social button grids
 */
export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

/**
 * Chevron rotation for collapsible elements
 * Used in: CollapsibleField
 */
export const chevronRotate: Variants = {
  closed: { rotate: 0 },
  open: { rotate: 180 },
};

export const chevronTransition: Transition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
};

/**
 * Tab underline animation
 * Used in: AuthTabs
 */
export const tabUnderline: Variants = {
  inactive: { width: 0 },
  active: { width: "100%" },
};

export const tabUnderlineTransition: Transition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
};

/**
 * Dot indicator animation for carousel
 * Used in: PromoCarousel
 */
export const dotIndicator: Variants = {
  inactive: { width: 6, scale: 1 },
  active: { width: 16, scale: 1 },
};

export const dotTransition: Transition = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1],
};

/**
 * Shimmer effect for loading states
 * Used in: Skeleton components
 */
export const shimmer: Variants = {
  initial: { backgroundPosition: "-1000px 0" },
  animate: { backgroundPosition: "1000px 0" },
};

export const shimmerTransition: Transition = {
  duration: 1.5,
  repeat: Infinity,
  ease: "linear",
};

/**
 * Pulse effect for live indicators
 * Used in: Live game badges
 */
export const pulse: Variants = {
  initial: { scale: 1, opacity: 1 },
  animate: {
    scale: [1, 1.1, 1],
    opacity: [1, 0.7, 1],
  },
};

export const pulseTransition: Transition = {
  duration: 2,
  repeat: Infinity,
  ease: [0.4, 0, 0.2, 1],
};

/**
 * Custom spring animations for bouncy effects
 */
export const bouncySpring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 17,
};

export const gentleSpring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

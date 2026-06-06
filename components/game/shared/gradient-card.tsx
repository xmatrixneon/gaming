"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { hoverScale, hoverTransition } from "@/components/lib/game-animations";

export interface GradientCardProps {
  /**
   * Card label/title
   */
  label: string;

  /**
   * Icon component (accepts LucideIcon, react-icons, or any component with size/className props)
   */
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;

  /**
   * Background gradient (CSS)
   */
  gradient: string;

  /**
   * Glow/border color
   */
  glow: string;

  /**
   * Large emoji decoration
   */
  emoji?: string;

  /**
   * Subtitle text (e.g., "Play Now")
   */
  subtitle?: string;

  /**
   * Click handler
   */
  onClick?: () => void;

  /**
   * Card class name
   */
  className?: string;
}

/**
 * Card with gradient background and glow effects
 * Used for casino/sports category cards
 *
 * @example
 * ```tsx
 * <GradientCard
 *   label="CASINO"
 *   icon={Dices}
 *   gradient="linear-gradient(135deg, #0d2818 0%, #0a1f14 100%)"
 *   glow="#00C851"
 *   emoji="🎰"
 *   subtitle="Play Now"
 *   onClick={() => navigate("/casino")}
 * />
 * ```
 */
const GradientCard = React.forwardRef<HTMLDivElement, GradientCardProps>(
  (
    {
      label,
      icon: Icon,
      gradient,
      glow,
      emoji,
      subtitle = "Play Now",
      onClick,
      className,
    },
    ref
  ) => {
    return (
      <motion.div
        ref={ref}
        whileHover="hover"
        whileTap="press"
        variants={hoverScale}
        transition={hoverTransition}
        className={cn("relative", className)}
      >
        <Card
          onClick={onClick}
          className={cn(
            "overflow-hidden cursor-pointer rounded-xl p-5",
            "flex flex-col items-start gap-2",
            "border border-[color:var(--glow)]22"
          )}
          style={{
            background: gradient,
            "--glow": glow,
          } as React.CSSProperties}
        >
          {/* Large emoji decoration */}
          {emoji && (
            <div
              className={cn(
                "absolute -right-2.5 -bottom-2.5 text-8xl opacity-25 pointer-events-none"
              )}
            >
              {emoji}
            </div>
          )}

          {/* Icon container */}
          <div
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center"
            )}
            style={{
              background: `${glow}22`,
            }}
          >
            <Icon size={18} style={{ color: glow }} />
          </div>

          {/* Label */}
          <div
            className={cn(
              "text-base font-bold text-white tracking-wider"
            )}
          >
            {label}
          </div>

          {/* Subtitle with arrow */}
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-semibold",
              "transition-colors duration-200"
            )}
            style={{ color: glow }}
          >
            {subtitle}
            <ChevronRight size={12} />
          </div>
        </Card>
      </motion.div>
    );
  }
);
GradientCard.displayName = "GradientCard";

export { GradientCard };

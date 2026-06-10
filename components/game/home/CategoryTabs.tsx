/**
 * Category Tabs Component
 *
 * Displays category/game provider tabs for filtering games
 */

"use client";

interface CategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`
            px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
            ${
              activeCategory === category
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }
          `}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

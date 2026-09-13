import {
  Cloud,
  FlaskConical,
  Layers,
  Megaphone,
  Monitor,
  Newspaper,
  Palette,
  Plug,
  Search,
  Server,
  ShoppingCart,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_META, type FeatureCategory } from "./featureLibrary";
import { cn } from "@/lib/utils";

const GLYPHS: Record<string, LucideIcon> = {
  search: Search,
  palette: Palette,
  monitor: Monitor,
  server: Server,
  smartphone: Smartphone,
  "shopping-cart": ShoppingCart,
  plug: Plug,
  cloud: Cloud,
  flask: FlaskConical,
  newspaper: Newspaper,
  megaphone: Megaphone,
};

/**
 * Monochrome stand-in for a feature or category icon. Rendering a glyph by category
 * keeps the UI free of the emoji still stored on older rows.
 */
export function CategoryGlyph({
  category,
  className,
}: {
  category?: FeatureCategory | string | undefined;
  className?: string;
}) {
  const name = CATEGORY_META[category as FeatureCategory]?.icon;
  const Icon = (name && GLYPHS[name]) || Layers;
  return <Icon aria-hidden="true" className={cn("size-4 text-muted-foreground", className)} />;
}

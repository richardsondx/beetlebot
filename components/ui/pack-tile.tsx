import { ICONS } from "@/components/ui/icons";
import { TINT_CLASSES, getPackVisual } from "@/lib/pack-icons";

/** 48×48 pack tile, radius 12, tint bg, 24px icon in the tint's icon colour. */
export function PackTile({ slug, size = 48 }: { slug: string; size?: number }) {
  const visual = getPackVisual(slug);
  const tint = TINT_CLASSES[visual.tint];
  const Icon = ICONS[visual.icon];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[12px] ${tint.bg} ${tint.icon}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon size={size === 48 ? 24 : 16} />
    </span>
  );
}

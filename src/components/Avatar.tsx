/* Avatar — shows photoURL if present, otherwise a coloured initials circle. */

type Props = {
  name?: string;
  photoURL?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeMap = {
  xs: { box: "w-7 h-7", text: "text-[11px]" },
  sm: { box: "w-9 h-9", text: "text-sm" },
  md: { box: "w-11 h-11", text: "text-base" },
  lg: { box: "w-16 h-16", text: "text-xl" },
  xl: { box: "w-24 h-24", text: "text-3xl" },
};

// Warm, brand-aligned palette for the deterministic fallback.
const PALETTE = [
  ["#D97742", "#FAF4EC"], // ochre / cream
  ["#5D7A47", "#FAF4EC"], // sage / cream
  ["#1F1612", "#F5DBB5"], // ink / soft ochre
  ["#B85A2A", "#FAF4EC"], // deep ochre / cream
  ["#46602F", "#E2E9D4"], // dark sage / pale sage
  ["#8F4220", "#F5DBB5"], // burnt orange / soft ochre
  ["#7A6A5E", "#FAF4EC"], // warm stone / cream
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name?: string): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, photoURL, size = "md", className = "" }: Props) {
  const s = sizeMap[size];

  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt={name ? `${name}'s avatar` : "Avatar"}
        className={`${s.box} rounded-full object-cover bg-[var(--color-cream-2)] border border-[var(--color-line)] flex-shrink-0 ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  const [bg, fg] = PALETTE[hash(name ?? "x") % PALETTE.length];
  // Small avatars use crisp sans-serif initials; large ones get the
  // friendlier display serif.
  const fontClass = size === "lg" || size === "xl"
    ? "font-display font-medium"
    : "font-sans font-semibold";
  return (
    <span
      aria-hidden
      className={`${s.box} ${s.text} rounded-full flex items-center justify-center ${fontClass} flex-shrink-0 ${className}`}
      style={{ background: bg, color: fg }}
    >
      {initials(name)}
    </span>
  );
}

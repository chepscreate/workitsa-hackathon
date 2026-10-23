"use client";

import { track } from "@/lib/analytics";

/**
 * "Chat to support" — opens a WhatsApp conversation with the Workit support
 * line (the Jarvis Business number). Public messages there are captured +
 * auto-acknowledged by the jarvisWhatsApp webhook; they never reach the
 * Jarvis owner agent.
 *
 * The number comes from NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER (digits only, full
 * international form, e.g. 27821234567). If it's unset the component renders
 * nothing — so a missing config never ships a dead button.
 */
const SUPPORT_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER ?? "").replace(/\D/g, "");
const WA_GREEN = "#25D366";

const PREFILL = "Hi Workit support, I need help with ";

export default function WhatsAppSupport({
  variant = "button",
  label = "Chat to support on WhatsApp",
}: {
  variant?: "button" | "link";
  label?: string;
}) {
  if (!SUPPORT_NUMBER) return null;
  const href = `https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(PREFILL)}`;

  if (variant === "link") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("support_whatsapp_click", { from: "footer" })}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors"
      >
        <WhatsAppIcon size={15} />
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("support_whatsapp_click", { from: "help" })}
      // !text-white: the Help page wraps content in a `prose` article whose
      // `[&_a]` rule would otherwise tint this label ochre (not-prose doesn't
      // reset custom arbitrary selectors). White on WhatsApp green is the brand.
      className="inline-flex items-center gap-2 px-5 py-3 rounded-pill text-[15px] font-medium !text-white !no-underline hover:opacity-90 active:scale-[0.98] transition-[opacity,transform]"
      style={{ background: WA_GREEN }}
    >
      <WhatsAppIcon />
      {label}
    </a>
  );
}

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.81 11.81 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l.495.785-.991 3.617 3.475-.984zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479c0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
    </svg>
  );
}

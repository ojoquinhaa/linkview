import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Hand-rolled icon set for the admin console, matching the project's existing
 * inline-SVG convention (24px grid, 1.6 stroke, round caps) rather than pulling
 * in an icon library. One primitive + named glyphs so the set stays coherent.
 */
export type IconProps = { className?: string; strokeWidth?: number };

function Glyph({
  className,
  strokeWidth = 1.6,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-[18px] shrink-0", className)}
    >
      {children}
    </svg>
  );
}

export const IconOverview = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
    <rect x="13.5" y="12.5" width="7.5" height="8.5" rx="1.5" />
    <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
  </Glyph>
);

export const IconBilling = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <line x1="2.5" y1="9.5" x2="21.5" y2="9.5" />
    <line x1="6" y1="14.5" x2="9.5" y2="14.5" />
  </Glyph>
);

export const IconAccount = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
  </Glyph>
);

export const IconAudit = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M5.5 3v3.5H9" />
    <path d="M12 8v4.2l3 1.8" />
  </Glyph>
);

export const IconMail = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </Glyph>
);

export const IconShield = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 3 4 6v5c0 4.5 3.2 7.8 8 10 4.8-2.2 8-5.5 8-10V6Z" />
    <path d="m9 12 2 2 4-4" />
  </Glyph>
);

export const IconCrown = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 7.5 6.5 14h11L21 7.5l-4.5 3L12 4 7.5 10.5 3 7.5Z" />
    <line x1="6.5" y1="17.5" x2="17.5" y2="17.5" />
  </Glyph>
);

export const IconWorkspace = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 20V6.5a1.5 1.5 0 0 1 1.5-1.5H12v15" />
    <path d="M12 9h6.5A1.5 1.5 0 0 1 20 10.5V20" />
    <path d="M2.5 20h19" />
    <path d="M7 9h1.5M7 12.5h1.5M7 16h1.5M15.5 12.5H17M15.5 16H17" />
  </Glyph>
);

export const IconLayers = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z" />
    <path d="m3.5 12 8.5 4.5L20.5 12" />
    <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
  </Glyph>
);

export const IconReceipt = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5 3.5h14V21l-2.3-1.4L14.3 21 12 19.6 9.7 21l-2.4-1.4L5 21Z" />
    <line x1="8.5" y1="8" x2="15.5" y2="8" />
    <line x1="8.5" y1="11.5" x2="13" y2="11.5" />
  </Glyph>
);

export const IconConsent = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M6 3.5h8L19 8v12.5H6Z" />
    <path d="M14 3.5V8h5" />
    <path d="m9 13.5 2 2 4-4" />
  </Glyph>
);

export const IconIdCard = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <circle cx="8.5" cy="11" r="2" />
    <path d="M5.5 16.5a3.2 3.2 0 0 1 6 0" />
    <line x1="14.5" y1="10" x2="18" y2="10" />
    <line x1="14.5" y1="13.5" x2="18" y2="13.5" />
  </Glyph>
);

export const IconPhone = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" />
  </Glyph>
);

export const IconPin = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Glyph>
);

export const IconGlobe = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5S14.4 18.2 12 20.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5Z" />
  </Glyph>
);

export const IconCalendar = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
    <line x1="8" y1="3" x2="8" y2="6.5" />
    <line x1="16" y1="3" x2="16" y2="6.5" />
  </Glyph>
);

export const IconSearch = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Glyph>
);

export const IconFilter = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3.5 5.5h17l-6.5 7.5v5l-4 2v-7Z" />
  </Glyph>
);

export const IconCheck = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m4.5 12.5 4.5 4.5 10.5-11" />
  </Glyph>
);

export const IconX = (p: IconProps) => (
  <Glyph {...p}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </Glyph>
);

export const IconBan = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Glyph>
);

export const IconArchive = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="3.5" y="4.5" width="17" height="4" rx="1.5" />
    <path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5" />
    <line x1="10" y1="12.5" x2="14" y2="12.5" />
  </Glyph>
);

export const IconRestore = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 5.5v4h4" />
    <path d="M4.5 9.5A8.5 8.5 0 1 1 4 13" />
  </Glyph>
);

export const IconAlert = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 4 2.5 20h19L12 4Z" />
    <line x1="12" y1="10" x2="12" y2="14.5" />
    <line x1="12" y1="17.5" x2="12" y2="17.6" />
  </Glyph>
);

export const IconLink = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </Glyph>
);

export const IconCursor = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5 3.5 19 11l-6 1.6L11 19 5 3.5Z" />
  </Glyph>
);

export const IconClock = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Glyph>
);

export const IconCpu = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
    <path d="M9.5 3v2M14.5 3v2M9.5 19v2M14.5 19v2M3 9.5h2M3 14.5h2M19 9.5h2M19 14.5h2" />
  </Glyph>
);

export const IconBadgeCheck = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m12 3 2.1 1.6 2.6-.3 1 2.5 2.3 1.3-.6 2.6 1.3 2.3-1.8 1.9.1 2.6-2.5.6-1.4 2.2-2.4-1-2.4 1-1.4-2.2-2.5-.6.1-2.6L4.3 14l1.3-2.3-.6-2.6 2.3-1.3 1-2.5 2.6.3Z" />
    <path d="m9.5 12 1.8 1.8 3.4-3.6" />
  </Glyph>
);

import type { PlanKey } from "./constants";
import { getPlan } from "./plans";
import type { LogoPosition, SplashBgType, SplashConfig } from "./schemas";

/**
 * The branded linkview interstitial forced on free-plan links: a 3-second
 * countdown that grows the brand before forwarding the visitor.
 */
export const BRANDED_SPLASH: SplashConfig = {
  logoUrl: null,
  bgType: "color",
  bgColor: "#0b0b0f",
  bgImageUrl: null,
  blur: 0,
  logoPosition: "center",
  accentColor: "#6366f1",
  textColor: "#ffffff",
  countdownSeconds: 3,
  showBranding: true,
};

/** Subset of a page layout the splash resolver reads. */
export interface SplashLayout {
  logoUrl: string | null;
  bgType: SplashBgType;
  bgColor: string;
  bgImageUrl: string | null;
  blur: number;
  logoPosition: LogoPosition;
  accentColor: string;
  textColor: string;
  countdownSeconds: number;
  showBranding: boolean;
}

/**
 * Resolve the interstitial a link should serve, given the workspace plan and an
 * optional assigned layout:
 * - Free plans always get the forced {@link BRANDED_SPLASH}.
 * - Paid plans with a layout get that layout's config.
 * - Paid plans without a layout get `null` (redirect straight to destination).
 */
export function resolveSplash(
  planKey: PlanKey,
  layout: SplashLayout | null,
): SplashConfig | null {
  if (!getPlan(planKey).customSplashEnabled) return BRANDED_SPLASH;
  if (!layout) return null;
  return {
    logoUrl: layout.logoUrl,
    bgType: layout.bgType,
    bgColor: layout.bgColor,
    bgImageUrl: layout.bgImageUrl,
    blur: layout.blur,
    logoPosition: layout.logoPosition,
    accentColor: layout.accentColor,
    textColor: layout.textColor,
    countdownSeconds: layout.countdownSeconds,
    showBranding: layout.showBranding,
  };
}

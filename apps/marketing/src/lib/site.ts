import { getPlan } from "@linkview/shared";

/** App + brand surfaces. CTAs send people to the dashboard's register flow. */
export const APP_URL = "https://app.linkview.com.br";
export const REGISTER_URL = `${APP_URL}/register`;
export const LOGIN_URL = `${APP_URL}/login`;
export const SHORT_DOMAIN = "lnkv.com.br";

/** Format cents (BRL) as the page shows it: "R$ 24,90". Single source of truth
 * for the price is the shared plan catalog, so marketing can never quote a
 * number the billing system doesn't charge. */
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** The "a partir de" anchor: Pro is the plan the 7-day trial converts into. */
export const proPlan = getPlan("pro");
export const proPriceLabel = formatBRL(proPlan.priceCents);

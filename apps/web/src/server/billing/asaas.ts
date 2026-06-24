import "server-only";

// Production base. While testing use the sandbox:
//   ASAAS_API_URL="https://sandbox.asaas.com/api/v3"
const DEFAULT_URL = "https://api.asaas.com/v3";

function asaasEnv() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("Missing env var: ASAAS_API_KEY");
  return {
    apiKey,
    baseUrl: (process.env.ASAAS_API_URL ?? DEFAULT_URL).replace(/\/$/, ""),
  };
}

/** True when Asaas credentials are present, so checkout can be offered. */
export function asaasConfigured(): boolean {
  return Boolean(process.env.ASAAS_API_KEY);
}

interface AsaasError {
  errors?: { code?: string; description?: string }[];
}

async function asaas<T>(
  path: string,
  init?: { method?: string; json?: unknown },
): Promise<T> {
  const { apiKey, baseUrl } = asaasEnv();
  const res = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      access_token: apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: init?.json ? JSON.stringify(init.json) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as T & AsaasError;
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? res.statusText;
    throw new Error(`Asaas ${res.status}: ${msg}`);
  }
  return data;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
}

export interface AsaasSubscription {
  id: string;
  status: string;
}

export interface AsaasPayment {
  id: string;
  status: string;
  /** Amount in BRL (e.g. 19.9), not cents. */
  value: number;
  /** PIX | BOLETO | CREDIT_CARD | UNDEFINED. */
  billingType: string;
  dueDate: string;
  /** Set once the payment settles. */
  paymentDate?: string | null;
  confirmedDate?: string | null;
  description?: string | null;
  invoiceUrl: string;
}

export function createCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  return asaas<AsaasCustomer>("/customers", { method: "POST", json: input });
}

export function createSubscription(input: {
  customer: string;
  /** Amount in BRL (e.g. 19.9), not cents. */
  value: number;
  /** First charge date, YYYY-MM-DD. */
  nextDueDate: string;
  description: string;
  externalReference?: string;
  /** Where Asaas returns the payer after a successful payment. */
  callback?: { successUrl: string; autoRedirect?: boolean };
}): Promise<AsaasSubscription> {
  return asaas<AsaasSubscription>("/subscriptions", {
    method: "POST",
    // UNDEFINED lets the payer pick Pix / boleto / card on the hosted page.
    json: { ...input, billingType: "UNDEFINED", cycle: "MONTHLY" },
  });
}

export async function getSubscriptionPayments(
  subscriptionId: string,
): Promise<AsaasPayment[]> {
  const res = await asaas<{ data: AsaasPayment[] }>(
    `/subscriptions/${subscriptionId}/payments`,
  );
  return res.data ?? [];
}

export function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaas<AsaasPayment>(`/payments/${paymentId}`);
}

export async function cancelSubscription(
  subscriptionId: string,
): Promise<void> {
  await asaas(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

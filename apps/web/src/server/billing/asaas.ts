import "server-only";

// Production base. While testing use the sandbox:
//   ASAAS_API_URL="https://sandbox.asaas.com/api/v3"
const DEFAULT_URL = "https://api.asaas.com/v3";

function asaasEnv() {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing env var: ASAAS_API_KEY");
  return {
    apiKey,
    // trim() strips trailing whitespace/CRLF baked into the env var (e.g. from
    // `vercel env add` piped on Windows); without it the CRLF lands mid-URL and
    // breaks every Asaas request.
    baseUrl: (process.env.ASAAS_API_URL ?? DEFAULT_URL)
      .trim()
      .replace(/\/$/, ""),
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
  // Cap the request so a slow/hung Asaas call surfaces as an error instead of
  // leaving the caller's UI spinner stuck forever.
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        access_token: apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: init?.json ? JSON.stringify(init.json) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("Asaas não respondeu a tempo. Tente novamente.");
    }
    throw err;
  }
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

/**
 * Raw card data. Lives in memory only for the single request that forwards it
 * to Asaas for tokenization — never logged, never persisted. After tokenization
 * we keep only the opaque token plus the brand and last 4 digits.
 */
export interface AsaasCard {
  holderName: string;
  number: string;
  /** "MM". */
  expiryMonth: string;
  /** "YYYY". */
  expiryYear: string;
  ccv: string;
}

/** Cardholder identity Asaas requires for anti-fraud analysis. */
export interface AsaasCardHolderInfo {
  name: string;
  email: string;
  /** CPF/CNPJ, digits only. */
  cpfCnpj: string;
  /** CEP, digits only. */
  postalCode: string;
  addressNumber: string;
  /** Landline or mobile, digits only. */
  phone: string;
  addressComplement?: string;
  mobilePhone?: string;
}

/** What we keep after tokenization: an opaque token + display metadata. */
export interface AsaasTokenizedCard {
  /** Last 4 digits of the card. */
  creditCardNumber: string;
  /** Brand label, e.g. "VISA", "MASTERCARD". */
  creditCardBrand: string;
  /** Opaque token to charge the card again without re-sending the PAN. */
  creditCardToken: string;
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
  /** Charge cadence at Asaas. Defaults to monthly. */
  cycle?: "MONTHLY" | "YEARLY";
  /**
   * Charge method. `PIX` generates a dynamic Pix charge per cycle that we render
   * ourselves (QR + copy-paste code) via {@link getPixQrCode} — no hosted page.
   * `CREDIT_CARD` auto-charges every renewal — pass a `creditCardToken` (own
   * checkout) to charge the first cycle immediately. `UNDEFINED` would let the
   * payer pick on the hosted page; we no longer use it.
   */
  billingType?: "UNDEFINED" | "CREDIT_CARD" | "PIX";
  /**
   * Token from {@link tokenizeCard}. When present, Asaas charges this card now
   * (synchronous first charge) and on every renewal — no hosted page, no PAN in
   * this request.
   */
  creditCardToken?: string;
  /** Payer's IP (NOT the server's). Required by Asaas when charging a card. */
  remoteIp?: string;
  /** Where Asaas returns the payer after a successful payment. */
  callback?: { successUrl: string; autoRedirect?: boolean };
}): Promise<AsaasSubscription> {
  const { cycle = "MONTHLY", billingType = "UNDEFINED", ...rest } = input;
  return asaas<AsaasSubscription>("/subscriptions", {
    method: "POST",
    json: { ...rest, billingType, cycle },
  });
}

/**
 * Tokenize a credit card. The PAN/CCV reach Asaas only here and are discarded
 * right after — the returned token is what we store and reuse to charge the card
 * on checkout and every renewal. Asaas runs anti-fraud on `creditCardHolderInfo`,
 * so all of its required fields (CPF/CNPJ, CEP, address number, phone) must be
 * real. `remoteIp` must be the buyer's IP, never the server's.
 */
export function tokenizeCard(input: {
  customer: string;
  creditCard: AsaasCard;
  creditCardHolderInfo: AsaasCardHolderInfo;
  remoteIp: string;
}): Promise<AsaasTokenizedCard> {
  return asaas<AsaasTokenizedCard>("/creditCard/tokenizeCreditCard", {
    method: "POST",
    json: input,
  });
}

/**
 * Swap the card on an existing subscription without charging now. Asaas also
 * rewrites every still-open charge to the new card. Takes a tokenized card so no
 * PAN flows through this call. `remoteIp` is the buyer's IP.
 */
export function updateSubscriptionCard(
  subscriptionId: string,
  input: { creditCardToken: string; remoteIp: string },
): Promise<AsaasSubscription> {
  return asaas<AsaasSubscription>(`/subscriptions/${subscriptionId}/creditCard`, {
    method: "PUT",
    json: input,
  });
}

/**
 * Update an existing subscription in place (Asaas uses POST on the resource
 * for updates). Used to switch billing cycle / value without canceling, so the
 * customer keeps the same subscription and the change applies from the next
 * charge. `updatePendingPayments` also rewrites any not-yet-paid charge.
 */
export function updateSubscription(
  subscriptionId: string,
  input: {
    /** New amount in BRL (e.g. 249), not cents. */
    value: number;
    cycle: "MONTHLY" | "YEARLY";
    description: string;
    updatePendingPayments?: boolean;
  },
): Promise<AsaasSubscription> {
  return asaas<AsaasSubscription>(`/subscriptions/${subscriptionId}`, {
    method: "POST",
    json: { updatePendingPayments: true, ...input },
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

/** Dynamic Pix payload for a single charge: the QR image plus the copy-paste
 * "Pix Copia e Cola" code, so we render the Pix checkout in-app with no hosted
 * page. `expirationDate` is when this QR stops being payable. */
export interface AsaasPixQrCode {
  /** Base64-encoded PNG of the QR (no data-URI prefix). */
  encodedImage: string;
  /** EMV copy-paste code ("Pix Copia e Cola"). */
  payload: string;
  /** ISO timestamp after which the QR expires, or null. */
  expirationDate: string | null;
}

/** Fetch the Pix QR + copy-paste code for a charge created with billingType PIX. */
export function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaas<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

export async function cancelSubscription(
  subscriptionId: string,
): Promise<void> {
  await asaas(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

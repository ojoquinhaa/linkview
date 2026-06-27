import "server-only";
import { Resend } from "resend";

function emailEnv() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing env var: RESEND_API_KEY");
  return {
    apiKey,
    // Must be a verified Resend sender/domain in production.
    from: process.env.EMAIL_FROM ?? "linkview <nao-responda@linkview.com.br>",
  };
}

/** True when transactional email is configured (lets callers degrade softly). */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

let client: Resend | null = null;
function resend(): Resend {
  if (!client) client = new Resend(emailEnv().apiKey);
  return client;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const { from } = emailEnv();
  const { error } = await resend().emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend: ${error.message ?? "envio falhou"}`);
}

/** Minimal, light, brand-aligned email shell. Inline styles for client support. */
function layout(opts: {
  heading: string;
  intro: string;
  buttonLabel: string;
  buttonUrl: string;
  footnote: string;
}): string {
  const accent = "#3b3ad6"; // ~ oklch(0.48 0.15 265)
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f6f6f8;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c24;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="width:440px;max-width:92%;background:#ffffff;border:1px solid #e7e7ee;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 32px 0;">
        <span style="font-size:17px;font-weight:700;letter-spacing:-0.01em;color:#1c1c24;">linkview</span>
      </td></tr>
      <tr><td style="padding:20px 32px 8px;">
        <h1 style="margin:0 0 10px;font-size:20px;font-weight:600;letter-spacing:-0.01em;color:#1c1c24;">${opts.heading}</h1>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#5a5a68;">${opts.intro}</p>
      </td></tr>
      <tr><td style="padding:20px 32px 4px;">
        <a href="${opts.buttonUrl}" style="display:inline-block;background:${accent};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:10px;">${opts.buttonLabel}</a>
      </td></tr>
      <tr><td style="padding:18px 32px 28px;">
        <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#8a8a96;">${opts.footnote}</p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#a6a6b0;word-break:break-all;">${opts.buttonUrl}</p>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;font-size:11px;color:#a6a6b0;">linkview · links rastreáveis, simples e em reais</p>
  </td></tr></table>
</body></html>`;
}

export async function sendResetPasswordEmail(args: {
  to: string;
  name?: string | null;
  url: string;
}): Promise<void> {
  const hi = args.name ? `Olá, ${args.name}. ` : "";
  await send(
    args.to,
    "Redefinir sua senha — linkview",
    layout({
      heading: "Redefinir sua senha",
      intro: `${hi}Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova. O link expira em 1 hora.`,
      buttonLabel: "Criar nova senha",
      buttonUrl: args.url,
      footnote:
        "Se você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.",
    }),
  );
}

export async function sendPaymentOverdueEmail(args: {
  to: string;
  name?: string | null;
  /** Hosted invoice URL (Asaas) so the customer can pay in one tap. */
  invoiceUrl: string;
}): Promise<void> {
  const hi = args.name ? `Olá, ${args.name}. ` : "";
  await send(
    args.to,
    "Sua fatura está em aberto — linkview",
    layout({
      heading: "Fatura em aberto",
      intro: `${hi}Não identificamos o pagamento da sua assinatura Pro. Para manter seu acesso e seus links ativos, pague a fatura abaixo. Pix cai na hora.`,
      buttonLabel: "Pagar fatura",
      buttonUrl: args.invoiceUrl,
      footnote:
        "Se você já pagou, pode ignorar este e-mail — o sistema atualiza em alguns minutos.",
    }),
  );
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  card: "Cartão de crédito",
  unknown: "—",
};

export async function sendPaymentReceiptEmail(args: {
  to: string;
  name?: string | null;
  /** Amount paid, in cents. */
  amountCents: number;
  /** Payment method, as mapped from Asaas billingType. */
  method: "pix" | "boleto" | "card" | "unknown";
  /** Next renewal date, or null when unknown. */
  renewsAt: Date | null;
  /** Asaas receipt / invoice URL. */
  receiptUrl: string;
}): Promise<void> {
  const hi = args.name ? `Olá, ${args.name}. ` : "";
  const renews = args.renewsAt
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(args.renewsAt)
    : null;
  const detail = `Valor: ${brl(args.amountCents)} · ${METHOD_LABEL[args.method] ?? "—"}${
    renews ? ` · próxima renovação em ${renews}` : ""
  }.`;
  await send(
    args.to,
    "Pagamento confirmado — obrigado! · linkview",
    layout({
      heading: "Pagamento confirmado 🎉",
      intro: `${hi}Recebemos seu pagamento e seu plano Pro está ativo. Obrigado por usar o linkview! ${detail}`,
      buttonLabel: "Ver recibo",
      buttonUrl: args.receiptUrl,
      footnote:
        "Guarde este e-mail como comprovante. O recibo oficial está no botão acima.",
    }),
  );
}

export async function sendCardChargeFailedEmail(args: {
  to: string;
  name?: string | null;
  /** Hosted invoice URL (Asaas) to pay / update the card in one tap. */
  invoiceUrl: string;
}): Promise<void> {
  const hi = args.name ? `Olá, ${args.name}. ` : "";
  await send(
    args.to,
    "Não conseguimos cobrar seu cartão — linkview",
    layout({
      heading: "Falha na cobrança do cartão",
      intro: `${hi}A cobrança automática da sua assinatura Pro foi recusada (cartão expirado, sem limite ou bloqueado). Atualize o cartão pelo botão abaixo para não perder o acesso.`,
      buttonLabel: "Atualizar cartão",
      buttonUrl: args.invoiceUrl,
      footnote:
        "Vamos tentar de novo automaticamente. Se preferir, pague pelo link acima — Pix também serve.",
    }),
  );
}

export async function sendSubscriptionCanceledEmail(args: {
  to: string;
  name?: string | null;
  /** Last day of paid access (grace period end), or null when unknown. */
  accessUntil: Date | null;
  /** Plan page where the customer can resume in one tap. */
  resumeUrl: string;
}): Promise<void> {
  const hi = args.name ? `Olá, ${args.name}. ` : "";
  const until = args.accessUntil
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(args.accessUntil)
    : null;
  // Win-back, low-pressure: lead with what they keep, make resuming a non-event
  // (no charge now). The grace window is the natural reason to act.
  const intro = `${hi}Sua assinatura Pro foi cancelada e não haverá novas cobranças. ${
    until
      ? `Você continua com todos os recursos Pro até ${until} — depois disso o workspace volta ao plano gratuito.`
      : "Você mantém o acesso Pro até o fim do período já pago."
  } Mudou de ideia? Você pode retomar a qualquer momento dentro desse período, sem pagar nada agora — a cobrança só volta na próxima renovação.`;
  await send(
    args.to,
    "Sua assinatura Pro foi cancelada — linkview",
    layout({
      heading: "Que pena ver você sair",
      intro,
      buttonLabel: "Retomar o Pro",
      buttonUrl: args.resumeUrl,
      footnote:
        "Seus links e relatórios continuam aqui durante o período de acesso. Se foi engano ou você quer voltar, é um clique.",
    }),
  );
}

export async function sendVerificationEmail(args: {
  to: string;
  name?: string | null;
  url: string;
}): Promise<void> {
  const hi = args.name ? `Olá, ${args.name}. ` : "";
  await send(
    args.to,
    "Confirme seu e-mail — linkview",
    layout({
      heading: "Confirme seu e-mail",
      intro: `${hi}Falta um passo para ativar sua conta. Confirme que este e-mail é seu para começar a criar links.`,
      buttonLabel: "Confirmar e-mail",
      buttonUrl: args.url,
      footnote:
        "Se você não criou uma conta no linkview, pode ignorar este e-mail.",
    }),
  );
}

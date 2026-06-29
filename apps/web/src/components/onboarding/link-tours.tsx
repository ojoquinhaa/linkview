"use client";

import { SpotlightTour, type TourStep, TourTrigger } from "./spotlight-tour";

/** Small inline list used inside step bodies (e.g. the five link types). */
function Bullets({ items }: { items: [string, string][] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {items.map(([k, v]) => (
        <li key={k} className="flex gap-2">
          <span className="font-medium text-ink-soft">{k}</span>
          <span className="text-muted">— {v}</span>
        </li>
      ))}
    </ul>
  );
}

const LINKS_STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao linkview",
    body: "Aqui você cria links curtos e descobre de onde vem cada clique. Vou mostrar a tela em poucos passos.",
  },
  {
    target: "links-create",
    title: "Crie um link",
    body: "Clique aqui para começar. Você escolhe o tipo (site, WhatsApp, Instagram…), cola o destino e recebe um link curto na hora.",
    placement: "bottom",
  },
  {
    target: "links-content",
    title: "Seus links aparecem aqui",
    body: "Cada cartão mostra cliques e visitantes. Clique num link para abrir o painel com gráficos, QR Code e configurações.",
    placement: "top",
  },
];

const CREATE_STEPS: TourStep[] = [
  {
    target: "create-types",
    title: "Escolha o tipo de link",
    body: (
      <>
        São cinco tipos — cada um já monta o destino certo para você:
        <Bullets
          items={[
            ["Link", "encurta qualquer endereço de site"],
            ["WhatsApp", "abre a conversa, com mensagem pronta opcional"],
            ["Instagram", "leva ao perfil ou direto à DM"],
            ["Telefone", "abre o discador para ligar"],
            ["E-mail", "começa um novo e-mail com assunto e texto"],
          ]}
        />
      </>
    ),
    placement: "bottom",
  },
  {
    target: "create-builder",
    title: "Preencha os dados",
    body: "Aqui você informa o destino. Quando estiver válido, aparece uma prévia do link logo abaixo.",
    placement: "bottom",
  },
  {
    target: "create-advanced",
    title: "Personalize (opcional)",
    body: "Quer um endereço seu, tipo /promo-junho, ou um título para reconhecer depois? É só abrir as opções.",
    placement: "top",
  },
  {
    target: "create-submit",
    title: "Crie o link",
    body: "Pronto! Ao criar, você vai direto para o painel do link, onde acompanha tudo.",
    placement: "top",
  },
];

const DETAIL_STEPS: TourStep[] = [
  {
    target: "tab-overview",
    title: "Visão geral",
    body: "Os números do link: cliques, visitantes únicos e gráficos de origem, dispositivo e horário.",
    placement: "bottom",
  },
  {
    target: "tab-canais",
    title: "Canais",
    body: "Crie variações com UTM para saber de qual campanha ou post veio cada clique.",
    placement: "bottom",
  },
  {
    target: "tab-qr",
    title: "QR Codes",
    body: "Gere e baixe o QR Code do link para imprimir, colar no balcão ou postar.",
    placement: "bottom",
  },
  {
    target: "tab-share",
    title: "Compartilhamento",
    body: "Personalize título, descrição e imagem que aparecem quando o link é colado no WhatsApp e redes.",
    placement: "bottom",
  },
  {
    target: "tab-security",
    title: "Segurança",
    body: "Proteja com senha, defina uma data de expiração e controle quem pode acessar.",
    placement: "bottom",
  },
  {
    target: "tab-settings",
    title: "Configurações",
    body: "Edite o destino, troque o endereço curto, pause ou apague o link a qualquer momento.",
    placement: "bottom",
  },
];

export function LinksTour() {
  return (
    <>
      <TourTrigger id="links" />
      <SpotlightTour id="links" steps={LINKS_STEPS} />
    </>
  );
}

export function CreateLinkTour() {
  return (
    <>
      <TourTrigger id="create-link" />
      <SpotlightTour id="create-link" steps={CREATE_STEPS} />
    </>
  );
}

export function LinkDetailTour() {
  return (
    <>
      <TourTrigger id="link-detail" />
      <SpotlightTour id="link-detail" steps={DETAIL_STEPS} />
    </>
  );
}

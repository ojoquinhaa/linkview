import { BackButton } from "@/components/error-actions";
import { ActionLink, ErrorScreen } from "@/components/error-screen";

export default function NotFound() {
  return (
    <ErrorScreen
      variant="404"
      eyebrow="Erro"
      title="Esse link não leva a lugar nenhum."
      body="A página que você procura pode ter sido movida, expirado, ou nunca ter existido. Confira o endereço ou volte para um lugar conhecido."
    >
      <ActionLink href="/" variant="primary">
        Ir para o início
      </ActionLink>
      <BackButton label="Voltar" />
    </ErrorScreen>
  );
}

import { PRIVACY_VERSION } from "@linkview/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, List, Section } from "@/components/legal/legal-doc";

export const metadata: Metadata = {
  title: "Política de Privacidade · linkview",
  description:
    "Como o linkview coleta, usa, compartilha e protege seus dados pessoais, conforme a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <LegalDoc
      title="Política de Privacidade"
      updated="18 de junho de 2026"
      version={PRIVACY_VERSION}
      intro={
        <>
          Esta Política explica como tratamos seus dados pessoais no linkview,
          em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº
          13.709/2018). Levamos sua privacidade a sério e coletamos apenas o
          necessário.
        </>
      }
    >
      <Section n={1} title="Controlador dos dados">
        <p>
          O controlador é a operadora do linkview, responsável pelas decisões
          sobre o tratamento dos seus dados pessoais. Para falar sobre
          privacidade, use os contatos da seção 11.
        </p>
      </Section>

      <Section n={2} title="Dados que coletamos">
        <p>Coletamos os seguintes dados:</p>
        <List
          items={[
            "Cadastro: nome (ou da empresa), e-mail, senha (armazenada com hash), documento (CPF ou CNPJ), telefone e endereço.",
            "Uso do serviço: links criados, destinos, campanhas e QR Codes.",
            "Dados técnicos: endereço IP, data/hora, navegador e dispositivo no cadastro e nos acessos.",
            "Métricas de cliques: dados agregados de origem, dispositivo e localização aproximada dos visitantes dos seus links.",
          ]}
        />
        <p>
          Não coletamos dados sensíveis e pedimos que você não os insira em
          campos livres.
        </p>
      </Section>

      <Section n={3} title="Para que usamos e com qual base legal">
        <p>
          Tratamos seus dados para finalidades específicas, cada uma com sua
          base legal (LGPD art. 7º):
        </p>
        <List
          items={[
            "Criar e operar sua conta e prestar o serviço — execução de contrato.",
            "Emitir cobranças e notas fiscais nos planos pagos — execução de contrato e obrigação legal/fiscal.",
            "Segurança, prevenção a fraudes e cumprimento de leis — obrigação legal e legítimo interesse.",
            "Enviar comunicações de marketing — somente com o seu consentimento, que pode ser retirado a qualquer momento.",
          ]}
        />
      </Section>

      <Section n={4} title="Compartilhamento com terceiros">
        <p>
          Não vendemos seus dados. Compartilhamos apenas com operadores que nos
          ajudam a prestar o serviço, sob contrato e obrigações de segurança:
        </p>
        <List
          items={[
            "Processamento de pagamentos (Asaas), para cobranças via Pix, boleto e cartão.",
            "Envio de e-mails transacionais (Resend), como verificação e recuperação de senha.",
            "Infraestrutura e banco de dados (provedores de nuvem) para hospedar a aplicação e os links.",
            "Autoridades públicas, quando exigido por lei ou ordem judicial.",
          ]}
        />
      </Section>

      <Section n={5} title="Cookies e tecnologias similares">
        <p>
          Usamos cookies essenciais para manter sua sessão autenticada e o
          funcionamento da plataforma. Cookies de medição, quando houver, são
          usados de forma agregada para entender o uso do serviço.
        </p>
      </Section>

      <Section n={6} title="Por quanto tempo guardamos">
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Após o
          encerramento, excluímos ou anonimizamos os dados, exceto aqueles que a
          lei exige preservar (por exemplo, registros fiscais e de acesso, que
          podem ser mantidos pelos prazos legais).
        </p>
      </Section>

      <Section n={7} title="Seus direitos como titular">
        <p>A LGPD garante a você, entre outros, os direitos de:</p>
        <List
          items={[
            "Confirmar a existência de tratamento e acessar seus dados.",
            "Corrigir dados incompletos, inexatos ou desatualizados.",
            "Solicitar anonimização, bloqueio ou eliminação de dados desnecessários.",
            "Solicitar a portabilidade dos seus dados.",
            "Revogar o consentimento e se opor a tratamentos baseados em legítimo interesse.",
          ]}
        />
        <p>
          Para exercer qualquer direito, fale conosco pelos contatos da seção
          11. Responderemos nos prazos da LGPD.
        </p>
      </Section>

      <Section n={8} title="Segurança da informação">
        <p>
          Adotamos medidas técnicas e organizacionais para proteger seus dados,
          como senhas armazenadas com hash, criptografia em trânsito (HTTPS),
          controle de acesso e registro de eventos. Nenhum sistema é 100%
          seguro, mas trabalhamos continuamente para reduzir riscos.
        </p>
      </Section>

      <Section n={9} title="Incidentes de segurança">
        <p>
          Em caso de incidente que possa acarretar risco relevante aos
          titulares, comunicaremos a Autoridade Nacional de Proteção de Dados
          (ANPD) e os titulares afetados em prazo razoável, conforme a LGPD.
        </p>
      </Section>

      <Section n={10} title="Transferência internacional">
        <p>
          Alguns operadores podem processar dados fora do Brasil. Nesses casos,
          exigimos garantias adequadas de proteção, compatíveis com a LGPD.
        </p>
      </Section>

      <Section n={11} title="Encarregado (DPO) e contato">
        <p>
          Para dúvidas, solicitações ou para exercer seus direitos, fale com
          nosso Encarregado de Proteção de Dados:
        </p>
        <p>
          <a
            href="mailto:privacidade@linkview.com.br"
            className="font-medium text-accent hover:underline"
          >
            privacidade@linkview.com.br
          </a>
        </p>
      </Section>

      <Section n={12} title="Alterações desta Política">
        <p>
          Podemos atualizar esta Política. Mudanças relevantes serão comunicadas
          por e-mail ou na plataforma. Consulte sempre a versão vigente nesta
          página. Veja também os nossos{" "}
          <Link
            href="/termos"
            className="font-medium text-accent hover:underline"
          >
            Termos de Uso
          </Link>
          .
        </p>
      </Section>
    </LegalDoc>
  );
}

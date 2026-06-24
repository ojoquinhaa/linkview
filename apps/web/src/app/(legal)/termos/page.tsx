import { TERMS_VERSION } from "@linkview/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, List, Section } from "@/components/legal/legal-doc";

export const metadata: Metadata = {
  title: "Termos de Uso · linkview",
  description:
    "Termos de Uso da plataforma linkview: regras de uso, conta, planos e responsabilidades.",
};

export default function TermosPage() {
  return (
    <LegalDoc
      title="Termos de Uso"
      updated="18 de junho de 2026"
      version={TERMS_VERSION}
      intro={
        <>
          Estes Termos regem o uso do linkview, plataforma de links rastreáveis,
          QR Codes e campanhas. Ao criar uma conta ou usar o serviço, você
          concorda com as condições abaixo. Leia com atenção.
        </>
      }
    >
      <Section n={1} title="Quem somos e o que oferecemos">
        <p>
          O linkview é uma plataforma que permite criar links curtos
          rastreáveis, QR Codes e organizar campanhas, com métricas de cliques,
          origem e dispositivo. O serviço é oferecido pela operadora do linkview
          (“nós”, “plataforma”).
        </p>
      </Section>

      <Section n={2} title="Conta e cadastro">
        <p>
          Para usar o serviço você cria uma conta informando dados verdadeiros,
          completos e atualizados, incluindo nome, e-mail, documento (CPF ou
          CNPJ), telefone e endereço. Você é responsável por manter a
          confidencialidade da sua senha e por toda atividade realizada na sua
          conta.
        </p>
        <List
          items={[
            "Você deve ter 18 anos ou mais, ou estar representado por responsável legal.",
            "Um e-mail só pode estar vinculado a uma conta.",
            "Informações falsas ou de terceiros sem autorização podem levar à suspensão.",
          ]}
        />
      </Section>

      <Section n={3} title="Planos, pagamento e renovação">
        <p>
          Há um plano gratuito e planos pagos. Os pagamentos são processados em
          reais (Pix, boleto ou cartão) por meio do nosso parceiro de pagamentos
          (Asaas). Assinaturas pagas renovam automaticamente ao fim de cada
          ciclo, salvo cancelamento prévio.
        </p>
        <List
          items={[
            "Os preços e limites de cada plano são exibidos na página de planos.",
            "Você pode cancelar a qualquer momento; o acesso pago permanece até o fim do ciclo já pago.",
            "Não há reembolso de períodos já utilizados, salvo exigência legal.",
          ]}
        />
      </Section>

      <Section n={4} title="Uso aceitável">
        <p>Você concorda em não usar a plataforma para:</p>
        <List
          items={[
            "Encurtar ou distribuir links para conteúdo ilegal, fraudulento, malware, phishing ou que viole direitos de terceiros.",
            "Enviar spam ou mensagens não solicitadas em massa.",
            "Burlar limites técnicos, sobrecarregar a infraestrutura ou acessar áreas sem autorização.",
            "Praticar qualquer atividade que viole a legislação brasileira.",
          ]}
        />
        <p>
          Podemos suspender ou remover links e contas que violem estas regras,
          com ou sem aviso, conforme a gravidade.
        </p>
      </Section>

      <Section n={5} title="Conteúdo e propriedade">
        <p>
          Você mantém a titularidade dos seus links, destinos e materiais. Ao
          usar o serviço, você nos concede licença limitada para processar esses
          dados apenas para operar a plataforma. A marca, o software e a
          interface do linkview permanecem de nossa propriedade.
        </p>
      </Section>

      <Section n={6} title="Disponibilidade do serviço">
        <p>
          Empenhamo-nos para manter o serviço disponível e os redirecionamentos
          rápidos, mas o serviço é fornecido “no estado em que se encontra”.
          Pode haver manutenções, interrupções ou alterações de funcionalidades.
          Não garantimos disponibilidade ininterrupta.
        </p>
      </Section>

      <Section n={7} title="Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida pela lei, não respondemos por danos
          indiretos, lucros cessantes ou perda de dados decorrentes do uso ou da
          impossibilidade de uso do serviço. Nossa responsabilidade total fica
          limitada ao valor pago por você nos 12 meses anteriores ao evento.
        </p>
      </Section>

      <Section n={8} title="Privacidade e dados pessoais">
        <p>
          O tratamento de dados pessoais é regido pela nossa{" "}
          <Link
            href="/privacidade"
            className="font-medium text-accent hover:underline"
          >
            Política de Privacidade
          </Link>
          , parte integrante destes Termos, em conformidade com a LGPD.
        </p>
      </Section>

      <Section n={9} title="Encerramento">
        <p>
          Você pode encerrar sua conta a qualquer momento pelas configurações ou
          solicitando ao suporte. Podemos encerrar contas inativas ou em
          violação destes Termos. Após o encerramento, tratamos seus dados
          conforme a Política de Privacidade e a legislação aplicável.
        </p>
      </Section>

      <Section n={10} title="Alterações destes Termos">
        <p>
          Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas
          por e-mail ou na plataforma com antecedência razoável. O uso
          continuado após a vigência representa concordância com a nova versão.
        </p>
      </Section>

      <Section n={11} title="Lei aplicável e foro">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil.
          Fica eleito o foro do domicílio do consumidor para dirimir
          controvérsias, conforme o Código de Defesa do Consumidor.
        </p>
      </Section>

      <Section n={12} title="Contato">
        <p>
          Dúvidas sobre estes Termos:{" "}
          <a
            href="mailto:contato@linkview.com.br"
            className="font-medium text-accent hover:underline"
          >
            contato@linkview.com.br
          </a>
          .
        </p>
      </Section>
    </LegalDoc>
  );
}

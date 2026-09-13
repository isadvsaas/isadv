import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — ATENDE ZAP" },
      { name: "description", content: "Como o ATENDE ZAP coleta, usa e protege seus dados." },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">← Voltar</Link>
        <h1 className="mt-6 text-4xl font-bold">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-slate-500">Última atualização: 17 de junho de 2026</p>

        <div className="mt-10 space-y-8 leading-relaxed text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-900">1. Controlador dos dados</h2>
            <p className="mt-2">
              <strong>ATENDE ZAP</strong> atua como controlador dos dados pessoais tratados
              no âmbito do Serviço, conforme a LGPD (Lei nº 13.709/2018) e demais leis
              aplicáveis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">2. Dados que coletamos</h2>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li><strong>Cadastro:</strong> nome, e-mail, senha (hash), telefone.</li>
              <li><strong>Conteúdo:</strong> mensagens, contatos e mídias que você processa no Serviço.</li>
              <li><strong>Uso e telemetria:</strong> logs, IP, dispositivo, navegador.</li>
              <li><strong>Suporte:</strong> conteúdo de tickets e comunicações.</li>
              <li><strong>Cobrança:</strong> tratada pela Paddle (MoR) — não armazenamos dados de cartão.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">3. Finalidades e bases legais</h2>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>Prestar o Serviço e cumprir o contrato (execução de contrato).</li>
              <li>Segurança, prevenção a fraudes e cumprimento de obrigações legais.</li>
              <li>Suporte ao cliente (execução de contrato).</li>
              <li>Melhorias do produto e analytics (legítimo interesse).</li>
              <li>Comunicações de marketing (consentimento, quando aplicável).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">4. Compartilhamento</h2>
            <p className="mt-2">Compartilhamos dados apenas com:</p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>
                <strong>Paddle.com</strong> — atua como Merchant of Record para processar
                pagamentos, assinaturas, impostos e faturamento.
              </li>
              <li>Provedores de hospedagem, banco de dados e analytics (subprocessadores).</li>
              <li>Consultores profissionais (jurídico, contábil) quando necessário.</li>
              <li>Autoridades, quando exigido por lei.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">5. Retenção</h2>
            <p className="mt-2">
              Mantemos os dados pelo tempo necessário às finalidades descritas, ou conforme
              exigido por lei. Após esse período, os dados são excluídos ou anonimizados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">6. Seus direitos</h2>
            <p className="mt-2">
              Você pode solicitar acesso, correção, anonimização, portabilidade, eliminação
              dos seus dados, revogação de consentimento e informações sobre compartilhamento,
              nos termos da LGPD. Para exercer seus direitos, entre em contato pelos canais
              do Serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">7. Segurança</h2>
            <p className="mt-2">
              Adotamos medidas técnicas e organizacionais adequadas (criptografia em trânsito,
              controles de acesso, monitoramento) para proteger seus dados contra acessos não
              autorizados, perdas ou alterações.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">8. Cookies</h2>
            <p className="mt-2">
              Utilizamos cookies essenciais para autenticação e funcionamento do Serviço, e
              cookies de analytics para melhorar a experiência. Você pode gerenciar
              preferências no seu navegador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900">9. Alterações</h2>
            <p className="mt-2">
              Esta Política pode ser atualizada periodicamente. Mudanças relevantes serão
              comunicadas no Serviço.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

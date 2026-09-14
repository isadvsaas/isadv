import { AlertTriangle } from "lucide-react";
import type { CompanyRow } from "@/lib/tenant";
import { trialDaysRemaining } from "@/lib/trial";
import { Link } from "@tanstack/react-router";

export function TrialBanner({ company }: { company: CompanyRow }) {
  // Assinatura paga ativa (ou qualquer status fora de trial) não exibe banner.
  if (company.status_cobranca !== "trial") return null;
  const days = trialDaysRemaining(company.trial_ate);

  return (
    <div className="px-4 py-2.5 text-sm flex items-center justify-center gap-2 bg-red-600 text-white border-b border-red-700 font-medium">
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        {days > 0 ? (
          <>
            Período grátis — {days === 1 ? <>resta <b>1 dia grátis</b></> : <>restam <b>{days} dias grátis</b></>}. Ative
            seu plano antes do fim do teste.
          </>
        ) : (
          <>Seu período grátis terminou. Ative seu plano para continuar.</>
        )}
      </span>
      <Link
        to="/app/checkout"
        className="ml-2 inline-flex items-center rounded-md bg-white/15 hover:bg-white/25 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-white/30"
      >
        Ativar plano
      </Link>
    </div>
  );
}

import { describe, expect, it } from "bun:test";

/**
 * Testes de CORE (hardening): isolamento entre empresas, conflito de agenda,
 * bloqueio de empresa não operacional, autenticação dos workers e vazamento de segredos.
 * Usa um fake do client Supabase (sem rede/banco) que honra os filtros .eq/.lt/.gt.
 */

type Row = Record<string, any>;

function fakeAdmin(tables: Record<string, Row[]>, rpcImpl: Record<string, (args: any) => any> = {}) {
  function from(table: string) {
    let rows = [...(tables[table] ?? [])];
    const api: any = {
      select: () => api,
      order: () => api,
      limit: (n: number) => {
        rows = rows.slice(0, n);
        return api;
      },
      eq: (col: string, val: any) => {
        rows = rows.filter((r) => r[col] === val);
        return api;
      },
      lt: (col: string, val: any) => {
        rows = rows.filter((r) => String(r[col]) < String(val));
        return api;
      },
      gt: (col: string, val: any) => {
        rows = rows.filter((r) => String(r[col]) > String(val));
        return api;
      },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: any) => resolve({ data: rows, error: null }),
    };
    return api;
  }
  return {
    from,
    rpc: async (name: string, args: any) => {
      const impl = rpcImpl[name];
      if (!impl) throw new Error(`rpc ${name} não esperada`);
      return impl(args);
    },
  };
}

const COMPANY_A = "aaaaaaaa-0000-0000-0000-000000000001";
const COMPANY_B = "bbbbbbbb-0000-0000-0000-000000000002";

/** Próxima segunda-feira às 10:00 UTC-3 (dentro da janela padrão 09:00-18:00). */
function nextMondayAt(hour: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  d.setUTCHours(hour + 3, 0, 0, 0); // America/Sao_Paulo = UTC-3
  return d;
}

function agendaTables(bookings: Row[]) {
  return {
    agenda_servico: [
      {
        id: "svc-1",
        company_id: COMPANY_A,
        nome: "Consultoria",
        duracao_min: 60,
        buffer_min: 0,
        antecedencia_min: 60,
        ativo: true,
      },
    ],
    agenda_janela: [
      { id: "j1", company_id: COMPANY_A, dia_semana: 1, hora_inicio: "09:00", hora_fim: "18:00", ativo: true },
    ],
    agent_config: [{ company_id: COMPANY_A, horarios_atendimento: { timezone: "America/Sao_Paulo" } }],
    agendamento: bookings,
    agenda_bloqueio: [],
  };
}

describe("agenda — conflito e isolamento entre empresas", () => {
  it("recusa horário já ocupado na MESMA empresa", async () => {
    const { checkSlot } = await import("../src/lib/scheduling.server");
    const inicio = nextMondayAt(10);
    const admin = fakeAdmin(
      agendaTables([
        {
          id: "ag-1",
          company_id: COMPANY_A,
          status: "agendado",
          inicio: inicio.toISOString(),
          fim: new Date(inicio.getTime() + 3_600_000).toISOString(),
        },
      ]),
    );
    const r = await checkSlot(admin, COMPANY_A, { inicio: inicio.toISOString(), serviceId: "svc-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("conflict");
  });

  it("ignora agendamento de OUTRA empresa (multi-tenant)", async () => {
    const { checkSlot } = await import("../src/lib/scheduling.server");
    const inicio = nextMondayAt(10);
    const admin = fakeAdmin(
      agendaTables([
        {
          id: "ag-b",
          company_id: COMPANY_B,
          status: "agendado",
          inicio: inicio.toISOString(),
          fim: new Date(inicio.getTime() + 3_600_000).toISOString(),
        },
      ]),
    );
    const r = await checkSlot(admin, COMPANY_A, { inicio: inicio.toISOString(), serviceId: "svc-1" });
    expect(r.ok).toBe(true);
  });
});

describe("billing — empresa não operacional", () => {
  it("bloqueia quando is_company_operational retorna false", async () => {
    const { isCompanyOperational } = await import("../src/lib/billing-guard.server");
    const admin = fakeAdmin({}, { is_company_operational: () => ({ data: false, error: null }) });
    expect(await isCompanyOperational(admin, "11111111-0000-0000-0000-000000000001")).toBe(false);
  });

  it("libera quando is_company_operational retorna true", async () => {
    const { isCompanyOperational } = await import("../src/lib/billing-guard.server");
    const admin = fakeAdmin({}, { is_company_operational: () => ({ data: true, error: null }) });
    expect(await isCompanyOperational(admin, "22222222-0000-0000-0000-000000000002")).toBe(true);
  });

  it("falha fechado quando a leitura do banco dá erro", async () => {
    const { isCompanyOperational } = await import("../src/lib/billing-guard.server");
    const admin = fakeAdmin({}, { is_company_operational: () => ({ data: null, error: { message: "boom" } }) });
    expect(await isCompanyOperational(admin, "33333333-0000-0000-0000-000000000003")).toBe(false);
  });

  it("company_id vazio nunca é operacional", async () => {
    const { isCompanyOperational } = await import("../src/lib/billing-guard.server");
    expect(await isCompanyOperational(fakeAdmin({}), "")).toBe(false);
  });
});

describe("workers — autenticação por segredo interno", () => {
  it("recusa chave publicável / token inválido e aceita o segredo de cron", async () => {
    process.env["LOVABLE_CRON_SECRET"] = "s".repeat(40);
    const { authenticateWorkerRequest } = await import("../src/lib/worker-auth.server");
    const call = (token?: string) =>
      new Request("https://x/api/public/hooks/process-message-queue", {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });

    expect((await authenticateWorkerRequest(call()))?.status).toBe(401);
    expect((await authenticateWorkerRequest(call("sb_publishable_aj8HIoZ6Yu0w")))?.status).toBe(401);
    expect((await authenticateWorkerRequest(call("token-errado")))?.status).toBe(401);
    expect(await authenticateWorkerRequest(call("s".repeat(40)))).toBeNull();
  });
});

describe("segredos — nunca expostos ao navegador", () => {
  it("colunas seguras de agent_config não incluem chaves de IA", async () => {
    const { AGENT_SAFE_COLUMNS, stripAgentSecrets } = await import("../src/lib/agents");
    expect(AGENT_SAFE_COLUMNS).not.toContain("openai_api_key");
    expect(AGENT_SAFE_COLUMNS).not.toContain("anthropic_api_key");
    expect(AGENT_SAFE_COLUMNS).toContain("nome_agente");
    const clean = stripAgentSecrets({ nome_agente: "Rafa", openai_api_key: "sk-x", anthropic_api_key: "sk-ant" }) as any;
    expect(clean.openai_api_key).toBeUndefined();
    expect(clean.anthropic_api_key).toBeUndefined();
    expect(clean.nome_agente).toBe("Rafa");
  });
});

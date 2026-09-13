import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { getBusinessHours, saveBusinessHours } from "@/lib/templates.functions";
import { defaultHours, DIA_LABEL, type BusinessHours } from "@/lib/business-hours";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Belem",
  "America/Cuiaba",
  "America/Recife",
  "America/Rio_Branco",
  "America/Noronha",
];

export function HorariosTab() {
  const fetcher = useServerFn(getBusinessHours);
  const saver = useServerFn(saveBusinessHours);
  const [h, setH] = useState<BusinessHours>(defaultHours());
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetcher();
        if (r.horarios) setH({ ...defaultHours(), ...(r.horarios as Partial<BusinessHours>) });
        setMsg(r.mensagem || "Olá! No momento estamos fora do horário de atendimento. Assim que abrirmos, retornamos. 🙏");
      } catch (e: any) {
        toast.error(e?.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, []);

  async function onSave() {
    setSaving(true);
    try {
      await saver({ data: { horarios: h, mensagem: msg } });
      toast.success("Horário salvo");
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(d: string, on: boolean) {
    setH((prev) => ({
      ...prev,
      dias: { ...prev.dias, [d]: on ? { abre: "09:00", fecha: "18:00" } : null },
    }));
  }

  function setDay(d: string, key: "abre" | "fecha", value: string) {
    setH((prev) => {
      const cur = prev.dias[d] ?? { abre: "09:00", fecha: "18:00" };
      return { ...prev, dias: { ...prev.dias, [d]: { ...cur, [key]: value } } };
    });
  }

  if (loading) return <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Horário de atendimento</h2>
            <p className="text-xs text-muted-foreground">
              Quando ativo, fora do horário a IA não responde — envia automaticamente a mensagem abaixo.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span>Ativo</span>
            <Switch checked={h.enabled} onCheckedChange={(v) => setH({ ...h, enabled: v })} />
          </label>
        </div>

        <div>
          <Label>Fuso horário</Label>
          <select
            value={h.timezone}
            onChange={(e) => setH({ ...h, timezone: e.target.value })}
            className="w-full h-10 px-3 rounded-md border bg-background text-sm"
          >
            {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {Object.keys(DIA_LABEL).map((d) => {
            const day = h.dias[d];
            const on = !!day;
            return (
              <div key={d} className="flex items-center gap-3 border rounded-md p-3">
                <div className="w-24 text-sm font-medium">{DIA_LABEL[d]}</div>
                <Switch checked={on} onCheckedChange={(v) => toggleDay(d, v)} />
                {on && day ? (
                  <div className="flex items-center gap-2">
                    <Input type="time" value={day.abre} onChange={(e) => setDay(d, "abre", e.target.value)} className="w-28" />
                    <span className="text-muted-foreground text-sm">até</span>
                    <Input type="time" value={day.fecha} onChange={(e) => setDay(d, "fecha", e.target.value)} className="w-28" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Fechado</span>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <Label>Mensagem fora do horário</Label>
          <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} />
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />} Salvar
          </Button>
        </div>
      </Card>
    </div>
  );
}

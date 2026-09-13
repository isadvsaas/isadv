import { useId, useMemo } from "react";

export interface AreaPoint { label: string; a: number; b?: number }

export function MiniAreaChart({
  data, height = 180, labelA = "recebidas", labelB = "respondidas pela IA",
}: { data: AreaPoint[]; height?: number; labelA?: string; labelB?: string }) {
  const id = useId();
  const w = 560;
  const h = height;
  const pad = { t: 10, r: 8, b: 18, l: 8 };
  const inner = { w: w - pad.l - pad.r, h: h - pad.t - pad.b };

  const { ptsA, ptsB, areaA, max } = useMemo(() => {
    const n = Math.max(data.length, 2);
    const max = Math.max(1, ...data.map((d) => Math.max(d.a, d.b ?? 0)));
    const x = (i: number) => pad.l + (inner.w * i) / (n - 1);
    const y = (v: number) => pad.t + inner.h - (v / max) * inner.h;
    const ptsA = data.map((d, i) => `${x(i)},${y(d.a)}`).join(" ");
    const ptsB = data.some((d) => d.b !== undefined)
      ? data.map((d, i) => `${x(i)},${y(d.b ?? 0)}`).join(" ")
      : "";
    const areaA = `${pad.l},${pad.t + inner.h} ${ptsA} ${pad.l + inner.w},${pad.t + inner.h}`;
    return { ptsA, ptsB, areaA, max };
  }, [data, inner.h, inner.w, pad.l, pad.t]);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#25D366" stopOpacity=".35" />
            <stop offset="1" stopColor="#25D366" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaA} fill={`url(#g-${id})`} />
        <polyline points={ptsA} fill="none" stroke="#25D366" strokeWidth="2.5" />
        {ptsB && (
          <polyline points={ptsB} fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="4 4" />
        )}
      </svg>
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-1 px-1">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#25D366]" /> {labelA}</span>
        {ptsB && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#22D3EE]" /> {labelB}</span>}
        <span className="ml-auto opacity-60">pico {max}</span>
      </div>
    </div>
  );
}

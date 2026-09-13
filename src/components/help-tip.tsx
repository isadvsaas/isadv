import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  text: string;
  className?: string;
  size?: number;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Pequeno ícone "?" com tooltip explicativo no hover.
 * Use ao lado de títulos, KPIs, botões e campos para explicar a função.
 *
 * <h1>Campanhas <HelpTip text="Envie mensagens em massa..." /></h1>
 */
export function HelpTip({ text, className, size = 14, side = "top" }: HelpTipProps) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Ajuda"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors align-middle",
              className,
            )}
            onClick={(e) => e.preventDefault()}
          >
            <HelpCircle size={size} strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

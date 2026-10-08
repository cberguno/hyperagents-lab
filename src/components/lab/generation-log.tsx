import { ScrollArea } from "@/components/ui/scroll-area";
import type { LogEntry } from "@/lib/hyperagents/evolve";
import { cn } from "@/lib/utils";

const KIND: Record<LogEntry["kind"], string> = {
  system: "text-faint",
  select: "text-muted",
  meta: "text-fg",
  eval: "text-ok",
  keep: "text-muted",
};

export function GenerationLog({ logs }: { logs: LogEntry[] }) {
  return (
    <ScrollArea className="h-[280px] rounded-lg bg-raised p-3 sm:h-[360px]">
      <ol className="space-y-2 font-mono text-xs leading-relaxed">
        {logs.map((l) => (
          <li key={l.id} className={cn("text-pretty", KIND[l.kind])}>
            <span className="text-faint">g{l.gen}</span>{" "}
            <span className="uppercase tracking-wider text-faint">{l.kind}</span>{" "}
            {l.text}
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}

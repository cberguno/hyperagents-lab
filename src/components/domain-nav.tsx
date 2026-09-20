import { DOMAINS, DOMAIN_GROUPS } from "@/lib/domains";
import { cn } from "@/lib/utils";

export function DomainNav({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {DOMAIN_GROUPS.map((group) => {
        const items = DOMAINS.filter((d) => d.group === group);
        return (
          <div key={group}>
            <p className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">{group}</p>
            <div className="flex flex-col gap-1">
              {items.map((d) => {
                const on = d.id === value;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onChange(d.id)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-left transition-[background-color,color] duration-[var(--motion-quick)]",
                      on ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg",
                    )}
                  >
                    <span className="block text-sm font-medium">{d.name}</span>
                    <span className={cn("mt-0.5 block font-mono text-[11px]", on ? "text-accent-fg/70" : "text-faint")}>
                      {d.id}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { cn } from "@/lib/utils";

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] tracking-wide",
        variant === "accent" ? "bg-accent text-accent-fg" : "bg-raised text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

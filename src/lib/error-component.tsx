import type { ReactNode } from "react";

export function AppErrorComponent({ error }: { error: unknown }): ReactNode {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-sm text-muted">
      <p className="font-serif text-2xl text-fg">Error</p>
      <p className="mt-3">{message}</p>
    </div>
  );
}

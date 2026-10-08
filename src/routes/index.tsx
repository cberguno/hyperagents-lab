import { createFileRoute } from "@tanstack/react-router";
import { ModeShell } from "@/components/mode-shell";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ModeShell />;
}

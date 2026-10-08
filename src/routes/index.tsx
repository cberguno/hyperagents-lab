import { createFileRoute } from "@tanstack/react-router";
import { LabView } from "@/components/lab/lab-view";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LabView />;
}

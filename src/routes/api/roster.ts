import { createFileRoute } from "@tanstack/react-router";
import { loadRosterSnapshot } from "@/lib/roster-source.server";

export const Route = createFileRoute("/api/roster")({
  server: {
    handlers: {
      GET: async () => {
        const snap = await loadRosterSnapshot();
        return Response.json(snap);
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { DOMAIN_BY_ID } from "@/lib/domains";

type Body = {
  domainId: string;
  parentScore: number;
  parentPatch: string;
  history: { gen: number; title: string; score: number }[];
};

export const Route = createFileRoute("/api/meta-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const domain = DOMAIN_BY_ID[body.domainId];
        if (!domain) {
          return Response.json({ ok: false, error: "unknown domain" }, { status: 400 });
        }
        const unused = domain.patches.filter(
          (p) => !body.history.some((h) => h.title === p.title),
        );
        const pick = unused[0] ?? domain.patches[Math.floor(Math.random() * domain.patches.length)];
        const key = process.env.XAI_API_KEY;
        if (!key) {
          return Response.json({ ok: true, patch: pick, source: "catalog" });
        }
        try {
          const res = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              authorization: `Bearer ${key}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "grok-4",
              temperature: 0.4,
              messages: [
                {
                  role: "system",
                  content:
                    body.domainId === "trading"
                      ? "You pick the next HyperAgents patch for the frozen trading eval. The task agent emits JSON {action,size,reasoning}. Score is mean P&L minus buy-and-hold. Reply with JSON {title, summary} matching one catalog patch title exactly."
                      : "You pick the next HyperAgents patch. Reply with JSON {title, summary} matching one catalog patch title exactly.",
                },
                {
                  role: "user",
                  content: JSON.stringify({
                    domain: domain.id,
                    parent: body.parentPatch,
                    parentScore: body.parentScore,
                    history: body.history,
                    catalog: domain.patches.map((p) => ({ title: p.title, summary: p.summary })),
                  }),
                },
              ],
            }),
          });
          const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const text = json.choices?.[0]?.message?.content ?? "";
          const match = domain.patches.find((p) => text.includes(p.title));
          return Response.json({ ok: true, patch: match ?? pick, source: "grok" });
        } catch {
          return Response.json({ ok: true, patch: pick, source: "catalog-fallback" });
        }
      },
    },
  },
});

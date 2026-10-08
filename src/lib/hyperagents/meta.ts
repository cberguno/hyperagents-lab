import { createServerFn } from "@tanstack/react-start";
import { DOMAIN_BY_ID, type DomainId } from "./domains";

type ProposeInput = {
  domainId: DomainId;
  parentScore: number;
  parentPatch: string;
  history: { gen: number; title: string; score: number }[];
};

export const proposePatch = createServerFn({ method: "POST" })
  .validator((input: ProposeInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Meta-agent is unavailable in this environment." };
    }
    const domain = DOMAIN_BY_ID[data.domainId];
    const history = data.history
      .slice(-6)
      .map((h) => `gen_${h.gen} ${h.title} ${h.score.toFixed(3)}`)
      .join("\n");
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 280,
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content:
              "You are the HyperAgents meta-agent. Propose ONE code-level improvement to a task agent. Reply as JSON only: {\"title\": string, \"summary\": string, \"diff\": string, \"delta\": number, \"mutation\": string}. delta is expected score lift. diff is a short unified diff. mutation for stock_trading must be one of: volTarget, costHurdle, regimeFilter, drawdownBreaker, crossSectional, walkForward. No markdown fences.",
          },
          {
            role: "user",
            content: `Domain: ${domain.id} (${domain.name})
Score: ${domain.scoreKey}
What it is: ${domain.description}
Parent score: ${data.parentScore.toFixed(3)}
Parent patch: ${data.parentPatch}
Archive:
${history}

Propose the next edit to the task agent.`,
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false as const, error: `Meta-agent error ${res.status}` };
    }
    const body = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = body.choices[0]?.message.content ?? "";
    try {
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
        title: string;
        summary: string;
        diff: string;
        delta: number;
        mutation?: string;
      };
      if (!parsed.title || !parsed.summary) {
        return { ok: false as const, error: "Meta-agent returned an incomplete patch." };
      }
      const mutId = String(parsed.mutation || "");
      const mutation =
        mutId === "volTarget"
          ? ({ id: "volTarget" as const, value: 0.1 })
          : mutId === "costHurdle"
            ? ({ id: "costHurdle" as const })
            : mutId === "regimeFilter"
              ? ({ id: "regimeFilter" as const })
              : mutId === "drawdownBreaker"
                ? ({ id: "drawdownBreaker" as const })
                : mutId === "crossSectional"
                  ? ({ id: "crossSectional" as const })
                  : mutId === "walkForward"
                    ? ({ id: "walkForward" as const })
                    : undefined;
      return {
        ok: true as const,
        patch: {
          title: String(parsed.title).slice(0, 80),
          summary: String(parsed.summary).slice(0, 240),
          diff: String(parsed.diff || "# proposed patch").slice(0, 1200),
          delta: Math.min(0.14, Math.max(0.01, Number(parsed.delta) || 0.04)),
          mutation,
        },
      };
    } catch {
      return { ok: false as const, error: "Meta-agent returned unreadable JSON." };
    }
  });

import type { StockMutation } from "@/lib/markets/types";

export type DomainId =
  | "stock_trading"
  | "paper_review"
  | "search_arena"
  | "balrog_babyai"
  | "balrog_babaisai"
  | "balrog_minihack"
  | "balrog_nle"
  | "genesis_go2walking"
  | "genesis_go2walkback"
  | "genesis_go2hop"
  | "imo_grading"
  | "imo_proof"
  | "polyglot";

export type Patch = {
  title: string;
  summary: string;
  diff: string;
  delta: number;
  mutation?: StockMutation;
};

export type Domain = {
  id: DomainId;
  name: string;
  group: string;
  scoreKey: string;
  model: string;
  description: string;
  baseline: number;
  ceiling: number;
  patches: Patch[];
};

export const DOMAINS: Domain[] = [
  {
    id: "stock_trading",
    name: "Stock trading",
    group: "Markets",
    scoreKey: "sharpe",
    model: "task-agent",
    description:
      "Long/short 30 US mega-caps on daily bars (2016–2026). Naive 6-month momentum, weekly rebalance. Score is net Sharpe after 5 bp costs and borrow on a 2019–2026 walk-forward. Patches stack on the parent and are scored by a real backtest, not a canned lift.",
    baseline: -0.23,
    ceiling: 2,
    patches: [
      {
        title: "Volatility targeting",
        summary:
          "Scale the whole book to a 10% annualized vol target using trailing 21-day book variance.",
        mutation: { id: "volTarget", value: 0.1 },
        diff: `--- a/domains/markets/task_agent.py
+++ b/domains/markets/task_agent.py
@@ -22,6 +22,14 @@
-    weights = sign(signal) * 1.0 / n_names
+    raw = sign(signal)
+    vol = realized_vol(returns, window=21).clip(0.08, 0.80)
+    target = 0.10
+    weights = raw * (target / vol)
+    weights = weights / weights.abs().sum().clip(lower=1e-8)`,
        delta: 0.11,
      },
      {
        title: "Cost hurdle",
        summary:
          "Skip a name unless |signal| clears an 8% lookback move, so tiny edges do not pay the spread.",
        mutation: { id: "costHurdle" },
        diff: `--- a/domains/markets/costs.py
+++ b/domains/markets/costs.py
@@ -8,2 +8,11 @@
+def hurdle_bps(spread, adv, notional):
+    slip = 4.0 + 6.0 * (notional / adv).clip(0, 1)
+    return spread * 1e4 + 0.5 + slip
+
+def take(signal, cost_bps):
+    edge = expected_edge_bps(signal)
+    return signal.where(edge > cost_bps, 0.0)`,
        delta: 0.09,
      },
      {
        title: "Regime filter",
        summary:
          "Flat the book when 20-day realized vol of SPY is in the top quintile or breadth is collapsing.",
        mutation: { id: "regimeFilter" },
        diff: `--- a/domains/markets/task_agent.py
+++ b/domains/markets/task_agent.py
@@ -41,3 +41,12 @@
+    spy_vol = realized_vol(spy, 20)
+    chop = spy_vol > spy_vol.rolling(252).quantile(0.80)
+    breadth = (signal > 0).mean(axis=1)
+    risk_off = chop | (breadth < 0.15) | (breadth > 0.85)
+    weights = weights.mask(risk_off, 0.0)`,
        delta: 0.08,
      },
      {
        title: "Drawdown breaker",
        summary:
          "Cut gross exposure in half after a 6% peak-to-trough, and go flat after 10% until a new equity high.",
        mutation: { id: "drawdownBreaker" },
        diff: `--- a/domains/markets/risk.py
+++ b/domains/markets/risk.py
@@ -14,1 +14,12 @@
+def scale_for_drawdown(equity, weights):
+    peak = equity.cummax()
+    dd = (equity / peak) - 1.0
+    scale = np.where(dd < -0.10, 0.0, np.where(dd < -0.06, 0.5, 1.0))
+    return weights * scale[:, None]`,
        delta: 0.06,
      },
      {
        title: "Cross-sectional rank",
        summary:
          "Trade the top and bottom quintiles of 12-1 momentum after neutralizing sector and beta.",
        mutation: { id: "crossSectional" },
        diff: `--- a/domains/markets/features.py
+++ b/domains/markets/features.py
@@ -19,2 +19,13 @@
-    signal = close.pct_change(21)
+    mom = close.pct_change(252) - close.pct_change(21)
+    resid = neutralize(mom, [sector_dummies, beta])
+    ranks = resid.rank(axis=1, pct=True)
+    signal = 0.0
+    signal = signal.mask(ranks >= 0.80, 1.0)
+    signal = signal.mask(ranks <= 0.20, -1.0)`,
        delta: 0.1,
      },
      {
        title: "Walk-forward fit",
        summary:
          "Each month, estimate trailing 3-year factor IC. Go flat when the IC is dead. Never train on the evaluation month.",
        mutation: { id: "walkForward" },
        diff: `--- a/domains/markets/task_agent.py
+++ b/domains/markets/task_agent.py
@@ -70,2 +70,10 @@
+    def fit_month(t):
+        train = panel.loc[t - pd.DateOffset(years=3): t - pd.DateOffset(days=1)]
+        return ridge.fit(train.X, train.y).coef_
+    coefs = {t: fit_month(t) for t in eval_months}
+    signal = apply_coefs(panel, coefs)`,
        delta: 0.05,
      },
    ],
  },
  {
    id: "paper_review",
    name: "Paper review",
    group: "Science",
    scoreKey: "overall_accuracy",
    model: "gpt-4o",
    description:
      "Score scientific papers against human reviewer outcomes. Default HyperAgents setup domain.",
    baseline: 0.41,
    ceiling: 0.78,
    patches: [
      {
        title: "Structured rubric",
        summary: "Replace free-form scoring with novelty, soundness, clarity, and significance axes.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -18,6 +18,14 @@
-    return llm.grade(paper_text)
+    axes = ["novelty", "soundness", "clarity", "significance"]
+    scores = {a: llm.grade_axis(paper_text, a) for a in axes}
+    return weighted_mean(scores)`,
        delta: 0.09,
      },
      {
        title: "Citation grounding",
        summary: "Require claims to quote the paper before assigning a verdict.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -40,4 +40,9 @@
+    quotes = extract_passages(paper_text, claim)
+    if not quotes:
+        return abstain()`,
        delta: 0.07,
      },
      {
        title: "Calibration on train split",
        summary: "Fit a temperature on the filtered-100 train subset before val scoring.",
        diff: `--- a/ensemble.py
+++ b/ensemble.py
@@ -12,3 +12,8 @@
+    T = fit_temperature(train_logits, train_labels)
+    return softmax(logits / T)`,
        delta: 0.05,
      },
      {
        title: "Reject-mode hedge",
        summary: "When reviewers disagree, emit a low-confidence class instead of a hard accept.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -61,2 +61,7 @@
+    if entropy(dist) > 1.2:
+        return "borderline"`,
        delta: 0.04,
      },
    ],
  },
  {
    id: "search_arena",
    name: "Search arena",
    group: "Retrieval",
    scoreKey: "overall_accuracy",
    model: "gpt-4o",
    description: "Web search and information retrieval against human preference judgments.",
    baseline: 0.38,
    ceiling: 0.74,
    patches: [
      {
        title: "Query rewrite",
        summary: "Expand underspecified questions into multi-hop search queries.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -22,3 +22,8 @@
+    queries = rewrite(question, n=4)
+    hits = search_all(queries)`,
        delta: 0.1,
      },
      {
        title: "Source ranking",
        summary: "Rerank snippets by citation density and recency before answering.",
        diff: `--- a/agent/tools/bash.py
+++ b/agent/tools/bash.py
@@ -8,2 +8,6 @@
+    return rerank(hits, keys=["citations", "date"])`,
        delta: 0.06,
      },
      {
        title: "Answer with citations",
        summary: "Force every sentence to attach a retrieved URL.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -55,1 +55,6 @@
+    return attach_citations(answer, hits)`,
        delta: 0.05,
      },
    ],
  },
  {
    id: "balrog_babyai",
    name: "BabyAI",
    group: "BALROG",
    scoreKey: "average_progress",
    model: "claude-sonnet",
    description: "Instruction-following in a grid world. Progress is the fraction of the mission completed.",
    baseline: 0.22,
    ceiling: 0.71,
    patches: [
      {
        title: "Plan then act",
        summary: "Emit a short plan of subgoals before each action batch.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -30,2 +30,7 @@
+    plan = llm.plan(mission, obs)
+    action = llm.act(plan, obs)`,
        delta: 0.12,
      },
      {
        title: "Inventory memory",
        summary: "Keep a running inventory so the agent stops re-picking carried items.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -44,1 +44,5 @@
+    state.inventory.update(obs)`,
        delta: 0.08,
      },
      {
        title: "Stuck detector",
        summary: "Reset the plan when the last eight actions loop.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -70,1 +70,6 @@
+    if looped(history, 8):
+        plan = llm.replan(obs)`,
        delta: 0.07,
      },
    ],
  },
  {
    id: "balrog_babaisai",
    name: "Baba Is You",
    group: "BALROG",
    scoreKey: "average_progress",
    model: "claude-sonnet",
    description: "Rewrite the rules of the level by pushing word blocks. Meta-reasoning over game rules.",
    baseline: 0.18,
    ceiling: 0.62,
    patches: [
      {
        title: "Rule parser",
        summary: "Extract the current ruleset from the grid before choosing a push.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -16,2 +16,7 @@
+    rules = parse_rules(grid)
+    goal = rules.get("win")`,
        delta: 0.11,
      },
      {
        title: "Counterfactual push",
        summary: "Simulate one push and keep it only if the win-set grows.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -33,1 +33,8 @@
+    for move in legal:
+        if wins_after(grid, move):
+            return move`,
        delta: 0.09,
      },
    ],
  },
  {
    id: "balrog_minihack",
    name: "MiniHack",
    group: "BALROG",
    scoreKey: "average_progress",
    model: "claude-sonnet",
    description: "NetHack-derived procedurally generated tasks with sparse rewards.",
    baseline: 0.15,
    ceiling: 0.58,
    patches: [
      {
        title: "Glyph decoder",
        summary: "Map MiniHack glyphs to named entities before the language model acts.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -12,1 +12,6 @@
+    view = decode_glyphs(obs.glyphs)`,
        delta: 0.1,
      },
      {
        title: "Hunger policy",
        summary: "Prioritize food when nutrition drops below a threshold.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -48,1 +48,5 @@
+    if nutrition < 150:
+        return seek_food(view)`,
        delta: 0.06,
      },
    ],
  },
  {
    id: "balrog_nle",
    name: "NetHack",
    group: "BALROG",
    scoreKey: "average_progress",
    model: "claude-sonnet",
    description: "Full NetHack Learning Environment. Long-horizon dungeon survival.",
    baseline: 0.09,
    ceiling: 0.44,
    patches: [
      {
        title: "Early stairs bias",
        summary: "Explore toward downstairs instead of fighting every monster.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -21,1 +21,6 @@
+    if stairs_visible(obs):
+        return path_to(stairs)`,
        delta: 0.08,
      },
      {
        title: "Elbereth when low HP",
        summary: "Write Elbereth and wait rather than dying in melee.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -60,1 +60,6 @@
+    if hp_ratio < 0.3:
+        return elbereth()`,
        delta: 0.07,
      },
    ],
  },
  {
    id: "genesis_go2walking",
    name: "Go2 walking",
    group: "Genesis",
    scoreKey: "average_fitness",
    model: "reward-fn",
    description: "Unitree Go2 locomotion. The task agent writes a reward function, then RL trains.",
    baseline: 0.31,
    ceiling: 0.82,
    patches: [
      {
        title: "Forward velocity term",
        summary: "Add a clipped forward-velocity reward and a yaw penalty.",
        diff: `--- a/domains/genesis/reward/default_function.py
+++ b/domains/genesis/reward/default_function.py
@@ -8,2 +8,8 @@
+    rew = clip(lin_vel_x, 0, 1.2) - 0.4 * abs(ang_vel_z)`,
        delta: 0.14,
      },
      {
        title: "Foot clearance",
        summary: "Penalize dragging feet; reward swing-foot height in mid-stride.",
        diff: `--- a/domains/genesis/reward/default_function.py
+++ b/domains/genesis/reward/default_function.py
@@ -19,1 +19,6 @@
+    rew -= 0.2 * foot_slip
+    rew += 0.1 * swing_clearance`,
        delta: 0.08,
      },
      {
        title: "Energy regularizer",
        summary: "L2 penalty on torque so gaits stay efficient.",
        diff: `--- a/domains/genesis/reward/default_function.py
+++ b/domains/genesis/reward/default_function.py
@@ -27,1 +27,4 @@
+    rew -= 0.0002 * torque.pow(2).sum()`,
        delta: 0.05,
      },
    ],
  },
  {
    id: "genesis_go2walkback",
    name: "Go2 walk-back",
    group: "Genesis",
    scoreKey: "average_fitness",
    model: "reward-fn",
    description: "Reverse locomotion on Go2. Same training loop, inverted command.",
    baseline: 0.27,
    ceiling: 0.76,
    patches: [
      {
        title: "Backward command tracking",
        summary: "Reward matching a negative vx command instead of standing still.",
        diff: `--- a/domains/genesis/reward/default_walking_function.py
+++ b/domains/genesis/reward/default_walking_function.py
@@ -10,1 +10,5 @@
+    rew = exp(-((lin_vel_x - cmd_x) ** 2))`,
        delta: 0.13,
      },
      {
        title: "Pitch stability",
        summary: "Penalize base pitch so the robot does not rear up while reversing.",
        diff: `--- a/domains/genesis/reward/default_walking_function.py
+++ b/domains/genesis/reward/default_walking_function.py
@@ -22,1 +22,4 @@
+    rew -= 0.5 * pitch ** 2`,
        delta: 0.07,
      },
    ],
  },
  {
    id: "genesis_go2hop",
    name: "Go2 hop",
    group: "Genesis",
    scoreKey: "average_fitness",
    model: "reward-fn",
    description: "Hopping gait on Go2. Flight phase and landing impulse dominate fitness.",
    baseline: 0.24,
    ceiling: 0.7,
    patches: [
      {
        title: "Flight bonus",
        summary: "Reward consecutive airtime without collapsing on landing.",
        diff: `--- a/domains/genesis/reward/default_hop_function.py
+++ b/domains/genesis/reward/default_hop_function.py
@@ -9,1 +9,6 @@
+    rew += 1.4 * airtime * landed_safe`,
        delta: 0.15,
      },
      {
        title: "Symmetric legs",
        summary: "Penalize left/right force mismatch during takeoff.",
        diff: `--- a/domains/genesis/reward/default_hop_function.py
+++ b/domains/genesis/reward/default_hop_function.py
@@ -18,1 +18,4 @@
+    rew -= 0.3 * (fl - fr).abs()`,
        delta: 0.06,
      },
    ],
  },
  {
    id: "imo_grading",
    name: "IMO grading",
    group: "Math",
    scoreKey: "overall_accuracy",
    model: "gpt-o4-mini-genai",
    description: "Grade International Math Olympiad short answers against official mark schemes.",
    baseline: 0.46,
    ceiling: 0.84,
    patches: [
      {
        title: "Mark scheme parse",
        summary: "Split official solutions into awardable steps before scoring.",
        diff: `--- a/domains/imo/grading_utils.py
+++ b/domains/imo/grading_utils.py
@@ -14,1 +14,7 @@
+    steps = split_markscheme(official)
+    return sum(match(ans, s) for s in steps)`,
        delta: 0.1,
      },
      {
        title: "Symbolic check",
        summary: "Verify algebraic claims with sympy before assigning a verdict.",
        diff: `--- a/domains/imo/grading_utils.py
+++ b/domains/imo/grading_utils.py
@@ -30,1 +30,6 @@
+    if not sympy_equiv(claim, expected):
+        return 0`,
        delta: 0.07,
      },
    ],
  },
  {
    id: "imo_proof",
    name: "IMO proof",
    group: "Math",
    scoreKey: "points_percentage",
    model: "gpt-o4-mini-genai",
    description: "Generate full IMO proofs and grade them with ProofAutoGrader.",
    baseline: 0.19,
    ceiling: 0.55,
    patches: [
      {
        title: "Lemma sketch first",
        summary: "Write a lemma outline, then fill proofs, instead of one-shot essays.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -25,1 +25,8 @@
+    lemmas = llm.outline(problem)
+    return llm.prove_each(lemmas)`,
        delta: 0.09,
      },
      {
        title: "Self-grade pass",
        summary: "Run the grader on the draft and revise failed steps once.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -44,1 +44,7 @@
+    report = grader(draft)
+    return revise(draft, report.failed)`,
        delta: 0.08,
      },
    ],
  },
  {
    id: "polyglot",
    name: "Polyglot",
    group: "Code",
    scoreKey: "accuracy_score",
    model: "claude-3-5-sonnet",
    description: "Multi-language SWE-bench style fixes. Each instance runs in its own container.",
    baseline: 0.28,
    ceiling: 0.61,
    patches: [
      {
        title: "Failing-test first",
        summary: "Reproduce the failing test, then edit only files it touches.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -18,1 +18,8 @@
+    fail = run_tests()
+    files = files_in_stack(fail)
+    return edit(files)`,
        delta: 0.11,
      },
      {
        title: "Minimal diff",
        summary: "Reject patches that touch more than three files or add comments-only.",
        diff: `--- a/task_agent.py
+++ b/task_agent.py
@@ -51,1 +51,6 @@
+    if files_changed(diff) > 3:
+        return shrink(diff)`,
        delta: 0.06,
      },
    ],
  },
];

export const DOMAIN_BY_ID = Object.fromEntries(
  DOMAINS.map((d) => [d.id, d]),
) as Record<DomainId, Domain>;

export const GROUPS = ["Markets", "Science", "Retrieval", "BALROG", "Genesis", "Math", "Code"];

/**
 * Typed representation of the read-only HyperAgents telemetry API (Mac mini service).
 * Every value the service can leave unavailable is `| null`. Nothing here is simulation data.
 *
 * LIVE mode must not import from `@/lib/hyperagents/*` or `@/lib/markets/*`.
 */

export type Health = { status: string; service: string; read_only: boolean };

export type LiveStatus = {
  timestamp: string;
  read_only: boolean;
  epoch_h: { latest_generation: number; status: string | null };
  control: { label: string; status: string | null; repeats: Record<string, string> };
  integrity: string;
  running_experiment_processes: string[];
};

export type EpochHOverview = {
  epoch: string;
  run_root_commit: string | null;
  archive: {
    current_genid: number | string;
    archive: Array<string | number>;
    lines: number;
    sha256: string;
  };
  latest_generation: number;
  generation_count: number;
  status: string | null;
  status_source: string | null;
  field_provenance?: Record<string, string>;
};

export type Cost = { task: number | null; meta: number | null; total: number | null };

export type Generation = {
  id: string;
  parent_id: string | null;
  children: string[];
  valid_parent: boolean | null;
  staged_train: number | null;
  staged_validation: number | null;
  train_score: number | null;
  validation_score: number | null;
  files_changed: string[] | null;
  mutation_summary: string | null;
  timestamp: string | null;
  duration_seconds: number | null;
  meta_model: string | null;
  task_model: string | null;
  provider: string | null;
  cost: Cost;
};

export type SplitEval = {
  kind: "staged" | "full";
  rows: number | null;
  accuracy: number | null;
  accept_recall: number | null;
  reject_recall: number | null;
  label_distribution_prediction: Record<string, number> | null;
  prediction_counts: Record<string, number> | null;
  none_count: number | null;
  question_ids_failed: number | null;
};

export type TaskCalls = {
  scope: string;
  n_unique_requests: number;
  raw_log_markers: number;
  finish_reasons: Record<string, number>;
  abnormal_length_or_error: number;
  providers: string[];
  requested_models: string[];
  cost: number | null;
};

export type GenerationDetail = Generation & {
  detail: {
    staged_source: string | null;
    train_eval: SplitEval | null;
    validation_eval: SplitEval | null;
    patch_bytes: number | null;
    meta_provider: string | null;
    meta_turns: number | null;
    task_calls: TaskCalls | null;
    record_result: string | null;
    metadata_flags: Record<string, boolean | null>;
    unavailable: string[];
  };
};

export type LineageNode = Pick<
  Generation,
  | "id"
  | "parent_id"
  | "valid_parent"
  | "staged_train"
  | "staged_validation"
  | "train_score"
  | "validation_score"
>;

export type Lineage = {
  nodes: LineageNode[];
  edges: Array<{ from: string; to: string }>;
  root: string | null;
  best_validation: string | null;
  best_validation_ties: string[] | null;
  champion: string | null;
  champion_basis: string;
  best_evolved_validation: { score: number | null; ids: string[] };
};

export type Split<T> = { train: T; validation: T | null };
export type Latency = { p50: number | null; p95: number | null; max: number | null };
export type IntegrityState = {
  state: string;
  ok: number | null;
  total: number | null;
  failures: string[] | null;
};

/** One REPEAT of the fixed-code reliability control. Repeats are not generations. */
export type ControlRepeat = {
  label: string;
  kind: string;
  repeat: number;
  status: "complete" | "partial" | string;
  reason: string | null;
  start: string;
  end: string;
  duration_seconds: number | null;
  container_exit: number | null;
  code_unchanged: boolean | null;
  train_score: number | null;
  validation_score: number | null;
  accept_recall: Split<number | null>;
  reject_recall: Split<number | null>;
  none_count: Split<number | null>;
  abnormal_output_rate: Split<number | null>;
  finish_reasons: Split<Record<string, number>>;
  retries: { retry_events: number; unrecovered_requests: number };
  provider_failures: {
    failed_calls: number;
    total_calls: number;
    failed_call_status_codes: Record<string, number>;
  };
  latency_seconds: Split<Latency>;
  cost: Split<number | null> & { total: number | null };
  integrity: IntegrityState;
};

export type ControlRepeatDetail = ControlRepeat & {
  train: Record<string, unknown>;
  validation: Record<string, unknown>;
};

export type RepeatsList = { label: string; repeats: ControlRepeat[] };

export type ControlSummary = {
  label: string;
  source: string;
  status: string | null;
  train: {
    completed_sets: number | null;
    mean_accuracy: number | null;
    sample_sd: number | null;
    min: number | null;
    max: number | null;
    range: number | null;
    range_text: string | null;
  };
  validation: {
    completed_sets: number | null;
    mean_accuracy: number | null;
    sample_sd: number | null;
    min: number | null;
    max: number | null;
    range: number | null;
    range_text: string | null;
    note?: string;
  };
  provider: {
    complete_runs: number | null;
    total_runs: number | null;
    partial_runs: string | null;
    successful_provider_calls: number | null;
    total_provider_calls: number | null;
  };
  serving_conclusion: string | null;
  per_question_stability_section: string | null;
};

export type ControlOverview = {
  label: string;
  kind: string;
  summary: ControlSummary;
  repeats: ControlRepeat[];
};

export type HostInfo = {
  timestamp: string;
  disk: {
    mount: string;
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    free_gib: number;
    used_percent: number;
    trend: {
      basis: string;
      samples: number;
      free_bytes_change_since_first_sample: number;
      seconds_covered: number;
    };
  };
  memory: {
    total_bytes: number;
    free_bytes: number;
    inactive_bytes: number;
    available_estimate_bytes: number;
  };
  swap: { total_mb: number; used_mb: number; free_mb: number };
  uptime_seconds: number;
  load_average: { "1m": number; "5m": number; "15m": number };
};

export type DockerInfo = {
  timestamp: string;
  reachable: boolean;
  server_version: string | null;
  image: { name: string; id: string | null } | null;
  running_containers: Array<{
    name: string | null;
    image: string | null;
    status: string | null;
    id: string | null;
  }> | null;
};

export type IntegrityInfo = {
  timestamp: string;
  overall: string;
  checks: Record<string, boolean | string | null>;
  epoch_h: {
    archive_sha256: string;
    recorded_sha256: string | null;
    current_genid: number | string;
  };
  control_root: IntegrityState;
  experiment_records: IntegrityState;
  repeats: Record<string, IntegrityState>;
};

/** Endpoint key -> payload type. */
export type EndpointData = {
  health: Health;
  status: LiveStatus;
  epochH: EpochHOverview;
  generations: { generations: Generation[] };
  generation: GenerationDetail;
  lineage: Lineage;
  control: ControlOverview;
  repeats: RepeatsList;
  repeat: ControlRepeatDetail;
  host: HostInfo;
  docker: DockerInfo;
  integrity: IntegrityInfo;
};

export type UnavailableReason =
  | "not_configured"
  | "unreachable"
  | "auth_failed"
  | "not_found"
  | "upstream_error"
  | "bad_response";

export const FIXTURE_LABEL = "DEVELOPMENT FIXTURE" as const;

/** What the server-side proxy returns. `stale` is derived on the client, never sent by the server. */
export type LiveResult<T> =
  | { status: "live"; fetchedAt: string; data: T }
  | { status: "fixture"; fetchedAt: string; label: typeof FIXTURE_LABEL; data: T }
  | { status: "unavailable"; fetchedAt: string; reason: UnavailableReason };

export type ConnectionState = "live" | "stale" | "fixture" | "unavailable";

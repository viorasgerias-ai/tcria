export type RuleStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export interface LiteralMarkerMatch {
  start: number;
  end: number;
  text: string;
}

export interface CheckResult {
  artifact_id: string;
  rule_id: string;
  rule_version: number;
  status: RuleStatus;
  reason_code: string;
  evidence_ref: string;
  extractor_version?: string;
  extracted_text_hash?: string;
  matches?: LiteralMarkerMatch[];
}

export interface Artifact {
  artifact_id: string;
  source_path: string;
  stored_path: string;
  original_sha256: string;
  byte_length: number;
  media_type: string;
  responsible_human: string | null;
  declared_origin: string | null;
}

export interface PipelineResult {
  schema_version: number;
  engine_version: string;
  rule_set: string;
  strict: boolean;
  artifacts: Artifact[];
  checks: CheckResult[];
  gaps: CheckResult[];
  readiness: 'READY_FOR_REVIEW' | 'REVIEW_WITH_GAPS' | 'BLOCKED';
  human_approved: boolean;
}

export interface LedgerEvent {
  schema_version: number;
  module_id: string;
  sequence: number;
  event_type: 'INGESTED' | 'AUDITED';
  payload: Artifact | { result_hash: string };
  previous_hash: string | null;
  event_hash: string;
}

export interface Bundle {
  result: PipelineResult;
  result_hash: string;
  ledger_head: string;
  event_count: number;
}

export interface CasePackage {
  id: string;
  createdAt: string;
  outputDir: string;
  bundle: Bundle;
  ledger: LedgerEvent[];
  anchor: string;
  reportMd: string;
  completeMarker: string;
  originalFiles: Record<string, Uint8Array>; // relative path -> file bytes
}

export interface BundleVerification {
  valid: boolean;
  errors: string[];
  anchor: string;
  scope: 'TRUSTED_REFERENCE' | 'INTERNAL_CONSISTENCY_ONLY';
}

export type RestoreAction = 'COPY' | 'UNCHANGED';

export interface RestorePlanItem {
  source_path: string;
  action: RestoreAction;
}

export interface RestoreResult {
  dry_run: boolean;
  destination: string;
  files: RestorePlanItem[];
  bundle_hash: string;
  restoredFiles?: Record<string, Uint8Array>;
}

export type ReviewDecision = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';

export interface ReviewRecord {
  schema_version: number;
  decision_id: string;
  responsible_human: string;
  decision: ReviewDecision;
  reason: string;
  reviewed_bundle_hash: string;
  recorded_at: string;
  record_hash: string;
}

export interface ReviewVerification {
  valid: boolean;
  errors: string[];
  scope: string;
}

export interface InputDocument {
  path: string; // relative path e.g. "documento.txt" or "cliente/contrato.txt"
  content: Uint8Array;
}

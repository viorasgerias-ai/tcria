import {
  Bundle,
  LedgerEvent,
  RestoreAction,
  RestorePlanItem,
  RestoreResult,
  ReviewDecision,
  ReviewRecord,
  ReviewVerification,
} from '../types';
import {
  anchorValue,
  canonical,
  digest,
  field_state,
  uuid4Hex,
  ValueError,
} from './crypto';
import { verifyBundle } from './pipeline';

export function safePath(root: string, relative: string): string {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.includes(':')) {
    throw new ValueError('Caminho inválido');
  }
  const parts = relative.split('/');
  if (relative.startsWith('/') || parts.length === 0 || parts.some((p) => p === '' || p === '.' || p === '..')) {
    throw new ValueError('Caminho fora da raiz');
  }
  const cleanRoot = root.replace(/\/+$/, '');
  return `${cleanRoot}/${parts.join('/')}`;
}

export function restoreBundle(
  bundle: Bundle,
  ledger: LedgerEvent[],
  storedFiles: Record<string, Uint8Array>,
  destination: string,
  trustedAnchor: string,
  dry_run = false,
  existingDestinationFiles: Record<string, Uint8Array> = {}
): RestoreResult {
  const anchor = anchorValue(trustedAnchor);
  const verification = verifyBundle(bundle, ledger, storedFiles, anchor);
  if (!verification.valid) {
    throw new ValueError('Bundle inválido: ' + verification.errors.join(', '));
  }

  const root = destination.trim().replace(/\/+$/, '') || 'destino';
  const plan: { source_path: string; target: string; stored_path: string; original_sha256: string; action: RestoreAction }[] = [];
  const destinations = new Set<string>();

  for (const artifact of bundle.result.artifacts) {
    const target = safePath(root, artifact.source_path);
    if (destinations.has(target)) {
      throw new ValueError('Caminho de origem duplicado: ' + target);
    }
    destinations.add(target);

    // Check if file already exists in destination
    const existingData = existingDestinationFiles[artifact.source_path];
    let action: RestoreAction;

    if (existingData !== undefined) {
      if (digest(existingData) !== artifact.original_sha256) {
        throw new ValueError('Conflito; arquivo preservado: ' + target);
      }
      action = 'UNCHANGED';
    } else {
      action = 'COPY';
    }

    plan.push({
      source_path: artifact.source_path,
      target,
      stored_path: artifact.stored_path,
      original_sha256: artifact.original_sha256,
      action,
    });
  }

  const restoredFiles: Record<string, Uint8Array> = { ...existingDestinationFiles };

  if (!dry_run) {
    for (const item of plan) {
      if (item.action === 'UNCHANGED') {
        continue;
      }
      const data = storedFiles[item.stored_path];
      if (!data) {
        throw new ValueError('Arquivo ausente no bundle: ' + item.stored_path);
      }
      if (digest(data) !== item.original_sha256) {
        throw new ValueError('Original mudou durante devolução: ' + item.source_path);
      }
      restoredFiles[item.source_path] = new Uint8Array(data);
      if (digest(restoredFiles[item.source_path]) !== item.original_sha256) {
        throw new ValueError('Falha na conferência da cópia: ' + item.target);
      }
    }
  }

  const files: RestorePlanItem[] = plan.map((p) => ({
    source_path: p.source_path,
    action: p.action,
  }));

  return {
    dry_run,
    destination: root,
    files,
    bundle_hash: anchor,
    restoredFiles: dry_run ? undefined : restoredFiles,
  };
}

export function recordReview(
  bundle: Bundle,
  ledger: LedgerEvent[],
  storedFiles: Record<string, Uint8Array>,
  recordsDir: string,
  trustedAnchor: string,
  responsible: string,
  decision: ReviewDecision,
  reason: string
): { record: ReviewRecord; recordPath: string } {
  const anchor = anchorValue(trustedAnchor);
  const verification = verifyBundle(bundle, ledger, storedFiles, anchor);
  if (!verification.valid) {
    throw new ValueError('Bundle inválido: ' + verification.errors.join(', '));
  }

  if (field_state(responsible) !== 'PRESENT' || field_state(reason) !== 'PRESENT') {
    throw new ValueError('Responsável e justificativa são obrigatórios');
  }

  if (!['APPROVE', 'REJECT', 'REQUEST_CHANGES'].includes(decision)) {
    throw new ValueError('Decisão inválida');
  }

  const cleanRecordsDir = recordsDir.trim().replace(/\/+$/, '') || 'revisoes';
  const decisionId = uuid4Hex();

  const unsigned: Omit<ReviewRecord, 'record_hash'> = {
    schema_version: 1,
    decision_id: decisionId,
    responsible_human: responsible.trim(),
    decision,
    reason: reason.trim(),
    reviewed_bundle_hash: anchor,
    recorded_at: new Date().toISOString(),
  };

  const record_hash = digest(canonical(unsigned));
  const record: ReviewRecord = {
    ...unsigned,
    record_hash,
  };

  const recordPath = `${cleanRecordsDir}/${decisionId}.json`;

  return {
    record,
    recordPath,
  };
}

export function verifyReview(
  bundle: Bundle,
  ledger: LedgerEvent[],
  storedFiles: Record<string, Uint8Array>,
  record: ReviewRecord,
  trustedAnchor: string
): ReviewVerification {
  const anchor = anchorValue(trustedAnchor);
  const verification = verifyBundle(bundle, ledger, storedFiles, anchor);
  if (!verification.valid) {
    throw new ValueError('Bundle inválido: ' + verification.errors.join(', '));
  }

  const errors: string[] = [];
  const unsigned: Record<string, unknown> = { ...record };
  delete unsigned.record_hash;

  if (digest(canonical(unsigned)) !== record.record_hash) {
    errors.push('REVIEW_HASH_MISMATCH');
  }

  if (record.reviewed_bundle_hash !== anchor) {
    errors.push('REVIEW_BUNDLE_MISMATCH');
  }

  if (
    !['APPROVE', 'REJECT', 'REQUEST_CHANGES'].includes(record.decision) ||
    field_state(record.responsible_human) !== 'PRESENT' ||
    field_state(record.reason) !== 'PRESENT' ||
    field_state(record.decision_id) !== 'PRESENT' ||
    field_state(record.recorded_at) !== 'PRESENT'
  ) {
    errors.push('INVALID_REVIEW');
  }

  return {
    valid: errors.length === 0,
    errors,
    scope: 'INTEGRITY_AND_BUNDLE_LINK_NOT_IDENTITY_AUTHENTICATION',
  };
}

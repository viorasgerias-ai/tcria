import {
  Artifact,
  Bundle,
  BundleVerification,
  CasePackage,
  CheckResult,
  InputDocument,
  LedgerEvent,
  LiteralMarkerMatch,
  PipelineResult,
} from '../types';
import { canonical, canonicalString, digest, field_state, ValueError } from './crypto';

export const VERSION = '0.2.0';

export function normalizePosix(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter((p) => p && p !== '.');
  if (parts.includes('..')) {
    throw new ValueError('Caminho fora da raiz: links relativos .. não são permitidos');
  }
  return parts.join('/');
}

export function runPipeline(
  inputFiles: InputDocument[],
  outputDirName: string,
  responsible: string | null = null,
  origin: string | null = null,
  strict = false
): { package: CasePackage; summary: { output_dir: string; readiness: string; result_hash: string; anchor: string } } {
  if (!inputFiles || inputFiles.length === 0) {
    throw new ValueError('Nenhum arquivo de entrada');
  }

  // Sort files by normalized posix path
  const sortedFiles = [...inputFiles].map((f) => ({
    path: normalizePosix(f.path),
    content: f.content,
  })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const artifacts: Artifact[] = [];
  const results: CheckResult[] = [];
  const events: LedgerEvent[] = [];
  const originalFilesStore: Record<string, Uint8Array> = {};

  function record(kind: 'INGESTED' | 'AUDITED', payload: Artifact | { result_hash: string }) {
    const sequence = events.length;
    const previous_hash = sequence > 0 ? events[sequence - 1].event_hash : null;
    const unsigned = {
      schema_version: 1,
      module_id: 'core',
      sequence,
      event_type: kind,
      payload,
      previous_hash,
    };
    const event_hash = digest(canonical(unsigned));
    events.push({
      ...unsigned,
      event_hash,
    });
  }

  const textDecoder = new TextDecoder('utf-8', { fatal: true });
  const textEncoder = new TextEncoder();

  for (let index = 0; index < sortedFiles.length; index++) {
    const file = sortedFiles[index];
    const data = file.content;
    const artifact_id = `artifact-${String(index).padStart(6, '0')}`;
    const saved_path = `originals/${file.path}`;

    originalFilesStore[saved_path] = data;

    const lowerPath = file.path.toLowerCase();
    let media_type = 'application/octet-stream';
    if (lowerPath.endsWith('.txt')) media_type = 'text/plain';
    else if (lowerPath.endsWith('.md')) media_type = 'text/markdown';
    else if (lowerPath.endsWith('.json')) media_type = 'application/json';

    const artifact: Artifact = {
      artifact_id,
      source_path: file.path,
      stored_path: saved_path,
      original_sha256: digest(data),
      byte_length: data.length,
      media_type,
      responsible_human: responsible,
      declared_origin: origin,
    };

    artifacts.push(artifact);
    record('INGESTED', artifact);

    // Required metadata rules
    for (const [field, value] of [
      ['responsible_human', responsible],
      ['declared_origin', origin],
    ] as const) {
      const state = field_state(value);
      results.push({
        artifact_id,
        rule_id: `required.${field}`,
        rule_version: 1,
        status: state === 'PRESENT' ? 'PASS' : 'FAIL',
        reason_code: state,
        evidence_ref: `${artifact_id}.${field}`,
      });
    }

    // Supported text extraction
    const extraction: CheckResult = {
      artifact_id,
      rule_id: 'extract.supported_text',
      rule_version: 1,
      extractor_version: 'utf8-json-v1',
      evidence_ref: `${artifact_id}.original_sha256`,
      status: 'UNKNOWN',
      reason_code: 'UNSUPPORTED_FORMAT',
    };

    let extractedText: string | null = null;
    let isExtracted = false;

    if (['.txt', '.md', '.json'].some((ext) => lowerPath.endsWith(ext))) {
      try {
        const decoded = textDecoder.decode(data);
        if (lowerPath.endsWith('.json')) {
          // Reject NaN, Infinity in JSON
          const parsed = JSON.parse(decoded);
          const hasInvalidNumber = (val: unknown): boolean => {
            if (typeof val === 'number') return !Number.isFinite(val);
            if (val && typeof val === 'object') {
              return Object.values(val as Record<string, unknown>).some(hasInvalidNumber);
            }
            return false;
          };
          if (hasInvalidNumber(parsed)) {
            throw new Error('Invalid JSON constants');
          }
        }

        extractedText = decoded;
        const hasContent = decoded.trim().length > 0;
        extraction.status = hasContent ? 'PASS' : 'UNKNOWN';
        extraction.reason_code = hasContent ? 'EXTRACTED' : 'EMPTY_TEXT';
        extraction.extracted_text_hash = digest(textEncoder.encode(decoded));
        isExtracted = true;
      } catch {
        extraction.status = 'FAIL';
        extraction.reason_code = 'INVALID_TEXT_OR_JSON';
      }
    }
    results.push(extraction);

    // Literal trace markers
    const traceRules: [string, RegExp][] = [
      ['trace.date', /\b(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/g],
      ['trace.reference', /\b(?:referência|referencia|processo|protocolo)\s*[:#]\s*\S+/gi],
    ];

    for (const [rule_id, regex] of traceRules) {
      const matches: LiteralMarkerMatch[] = [];
      if (isExtracted && extractedText !== null) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(extractedText)) !== null) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
          });
        }
      }

      results.push({
        artifact_id,
        rule_id,
        rule_version: 1,
        status: matches.length > 0 ? 'PASS' : 'UNKNOWN',
        reason_code:
          matches.length > 0
            ? 'LITERAL_MARKER_FOUND'
            : isExtracted
              ? 'MARKER_ABSENT'
              : 'EXTRACTION_UNAVAILABLE',
        evidence_ref: `${artifact_id}.original_sha256`,
        matches,
      });
    }

    // Prescriptive gate
    results.push({
      artifact_id,
      rule_id: 'prescriptiveGate',
      rule_version: 1,
      status: 'UNKNOWN',
      reason_code: 'RULE_NOT_PROVIDED',
      evidence_ref: `${artifact_id}.original_sha256`,
    });
  }

  const gaps = results.filter((r) => r.status !== 'PASS');
  const allPassed = results.every((r) => r.status === 'PASS');
  const readiness = allPassed ? 'READY_FOR_REVIEW' : strict ? 'BLOCKED' : 'REVIEW_WITH_GAPS';

  const result: PipelineResult = {
    schema_version: 1,
    engine_version: VERSION,
    rule_set: 'metadata-text-literal-trace-v2',
    strict,
    artifacts,
    checks: results,
    gaps,
    readiness,
    human_approved: false,
  };

  const result_hash = digest(canonical(result));
  record('AUDITED', { result_hash });

  const bundle: Bundle = {
    result,
    result_hash,
    ledger_head: events[events.length - 1].event_hash,
    event_count: events.length,
  };

  const anchor = digest(canonical(bundle));

  // Report markdown
  const reportLines = [
    '# Relatório operacional',
    '',
    `Estado: ${result.readiness}`,
    '',
    'Aprovação humana: não registrada.',
    '',
    '| Artefato | Regra | Estado | Motivo |',
    '|---|---|---|---|',
    ...results.map((r) => `| ${r.artifact_id} | ${r.rule_id} | ${r.status} | ${r.reason_code} |`),
    '',
    '## Limites',
    '',
    'Metadados são declarações, não autenticação. ' +
      'Hashes verificam integridade contra referência, não a verdade dos fatos. ' +
      'A âncora local deve ser copiada para local protegido independente. ' +
      'Este protótipo usa um único módulo e não implementa isolamento entre serviços.',
  ];
  const reportMd = reportLines.join('\n') + '\n';
  const completeMarker = VERSION + '\n';

  const outputDir = outputDirName || `caso-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;

  const pkg: CasePackage = {
    id: outputDir,
    createdAt: new Date().toISOString(),
    outputDir,
    bundle,
    ledger: events,
    anchor,
    reportMd,
    completeMarker,
    originalFiles: originalFilesStore,
  };

  return {
    package: pkg,
    summary: {
      output_dir: outputDir,
      readiness: result.readiness,
      result_hash,
      anchor,
    },
  };
}

export function verifyBundle(
  bundle: Bundle,
  ledger: LedgerEvent[],
  storedFiles: Record<string, Uint8Array>,
  trustedAnchor?: string | null,
  isComplete = true
): BundleVerification {
  if (bundle.result?.engine_version === VERSION && !isComplete) {
    throw new ValueError('Execução incompleta; preserve a pasta para diagnóstico');
  }

  const errors: string[] = [];
  const anchor = digest(canonical(bundle));

  if (trustedAnchor && anchor !== trustedAnchor.trim().toLowerCase()) {
    errors.push('TRUSTED_ANCHOR_MISMATCH');
  }

  if (digest(canonical(bundle.result)) !== bundle.result_hash) {
    errors.push('RESULT_HASH_MISMATCH');
  }

  for (const artifact of bundle.result.artifacts) {
    const path = artifact.stored_path;
    if (path.includes('..') || path.startsWith('/')) {
      errors.push('UNSAFE_ARTIFACT_PATH');
      continue;
    }
    const data = storedFiles[path];
    if (!data) {
      errors.push('MISSING_ARTIFACT:' + artifact.artifact_id);
    } else if (data.length !== artifact.byte_length || digest(data) !== artifact.original_sha256) {
      errors.push('ARTIFACT_HASH_MISMATCH:' + artifact.artifact_id);
    }
  }

  let previous: string | null = null;
  for (let index = 0; index < ledger.length; index++) {
    const event = ledger[index];
    const unsigned = {
      schema_version: event.schema_version,
      module_id: event.module_id,
      sequence: event.sequence,
      event_type: event.event_type,
      payload: event.payload,
      previous_hash: event.previous_hash,
    };

    if (
      event.sequence !== index ||
      event.previous_hash !== previous ||
      digest(canonical(unsigned)) !== event.event_hash
    ) {
      errors.push(`LEDGER_MISMATCH:${index}`);
    }
    previous = event.event_hash;
  }

  if (ledger.length !== bundle.event_count || previous !== bundle.ledger_head) {
    errors.push('LEDGER_HEAD_OR_COUNT_MISMATCH');
  }

  if (
    !ledger.length ||
    JSON.stringify((ledger[ledger.length - 1].payload as { result_hash?: string })?.result_hash) !==
      JSON.stringify(bundle.result_hash)
  ) {
    errors.push('AUDIT_LINK_MISMATCH');
  }

  const ingested = ledger.filter((e) => e.event_type === 'INGESTED').map((e) => e.payload);
  if (canonicalString(ingested) !== canonicalString(bundle.result.artifacts)) {
    errors.push('INGESTION_LINK_MISMATCH');
  }

  return {
    valid: errors.length === 0,
    errors,
    anchor,
    scope: trustedAnchor ? 'TRUSTED_REFERENCE' : 'INTERNAL_CONSISTENCY_ONLY',
  };
}

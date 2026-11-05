import React, { useState, useRef } from 'react';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Download,
  AlertTriangle,
  Upload,
  Copy,
  Check,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import { CasePackage, ReviewDecision, ReviewRecord, ReviewVerification } from '../types';
import { anchorValue } from '../lib/crypto';
import { recordReview, verifyReview } from '../lib/custody';
import { downloadText } from '../lib/zip';

interface ReviewTabProps {
  currentPackage: CasePackage | null;
  trustedAnchor: string;
  setStatusText: (text: string) => void;
  onLogOutput: (data: unknown) => void;
}

export const ReviewTab: React.FC<ReviewTabProps> = ({
  currentPackage,
  trustedAnchor,
  setStatusText,
  onLogOutput,
}) => {
  const [recordsDir, setRecordsDir] = useState('revisoes');
  const [reviewer, setReviewer] = useState('Revisor de teste');
  const [decision, setDecision] = useState<ReviewDecision>('REQUEST_CHANGES');
  const [reason, setReason] = useState('Regras ainda pendentes');
  const [lastCreatedRecord, setLastCreatedRecord] = useState<{
    record: ReviewRecord;
    recordPath: string;
  } | null>(null);

  // Review verification state
  const [reviewToVerify, setReviewToVerify] = useState<ReviewRecord | null>(null);
  const [verificationResult, setVerificationResult] = useState<ReviewVerification | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedRecord, setCopiedRecord] = useState(false);

  const reviewFileInputRef = useRef<HTMLInputElement>(null);

  const handleRecordReview = () => {
    setErrorMessage(null);
    if (!currentPackage) {
      setErrorMessage('Nenhum bundle selecionado. Organize um lote primeiro na aba 1.');
      return;
    }
    if (!trustedAnchor.trim()) {
      setErrorMessage('Referência SHA-256 independente obrigatória para vincular a decisão.');
      return;
    }

    try {
      const cleanedAnchor = anchorValue(trustedAnchor);
      setStatusText('Gravando decisão de revisão humana vinculada ao bundle...');

      const res = recordReview(
        currentPackage.bundle,
        currentPackage.ledger,
        currentPackage.originalFiles,
        recordsDir.trim() || 'revisoes',
        cleanedAnchor,
        reviewer.trim(),
        decision,
        reason.trim()
      );

      setLastCreatedRecord(res);
      setReviewToVerify(res.record); // Pre-fill verification field
      onLogOutput({
        operacao: 'record_review',
        ...res,
      });

      setStatusText(`Decisão humana registrada e assinada pelo hash. Arquivo: ${res.recordPath}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatusText('Falha ao registrar revisão: ' + msg);
    }
  };

  const handleVerifyReview = () => {
    setErrorMessage(null);
    setVerificationResult(null);

    if (!currentPackage) {
      setErrorMessage('Nenhum bundle selecionado para verificar vínculo.');
      return;
    }
    if (!reviewToVerify) {
      setErrorMessage('Nenhum registro de decisão selecionado ou carregado.');
      return;
    }
    if (!trustedAnchor.trim()) {
      setErrorMessage('Referência SHA-256 guardada obrigatória para checar integridade.');
      return;
    }

    try {
      const cleanedAnchor = anchorValue(trustedAnchor);
      setStatusText('Conferindo integridade da decisão e vínculo com o bundle...');

      const res = verifyReview(
        currentPackage.bundle,
        currentPackage.ledger,
        currentPackage.originalFiles,
        reviewToVerify,
        cleanedAnchor
      );

      setVerificationResult(res);
      onLogOutput({
        operacao: 'verify_review',
        decision_id: reviewToVerify.decision_id,
        ...res,
      });

      if (res.valid) {
        setStatusText('Decisão e vínculo conferidos com sucesso contra o bundle auditado.');
      } else {
        setStatusText('FALHA na verificação da decisão. Confira os erros abaixo.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatusText('Falha ao verificar decisão: ' + msg);
    }
  };

  const handleLoadReviewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = JSON.parse(text) as ReviewRecord;
        if (!parsed.decision_id || !parsed.record_hash) {
          throw new Error('O arquivo JSON não é um registro de decisão válido.');
        }
        setReviewToVerify(parsed);
        setStatusText(`Registro de decisão carregado: ${parsed.decision_id}.json`);
      } catch (err) {
        setErrorMessage(String(err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadRecordJson = () => {
    if (!lastCreatedRecord) return;
    const jsonStr = JSON.stringify(lastCreatedRecord.record, null, 2);
    downloadText(jsonStr + '\n', `${lastCreatedRecord.record.decision_id}.json`);
    setStatusText(`Registro de decisão ${lastCreatedRecord.record.decision_id}.json baixado.`);
  };

  const handleCopyRecord = () => {
    if (!lastCreatedRecord) return;
    navigator.clipboard.writeText(JSON.stringify(lastCreatedRecord.record, null, 2));
    setCopiedRecord(true);
    setTimeout(() => setCopiedRecord(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro Box */}
      <div className="bg-slate-900/90 border border-teal-900/60 rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-teal-400" />
          3. Registro de Decisão e Revisão Humana
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          A decisão humana fica em registro separado, vinculado ao hash exato do bundle, sem reescrever o resultado
          técnico. Nome declarado não é autenticação ou assinatura digital. Preserve também o hash da decisão.
        </p>
      </div>

      {errorMessage && (
        <div className="bg-rose-950/70 border border-rose-800 text-rose-200 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erro na operação de revisão</p>
            <p className="text-rose-300 text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Grid: Register Review & Verify Review */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Register Review Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
              <FileCheck2 className="w-4 h-4 text-teal-400" />
              Registrar Nova Decisão
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Pasta do resultado auditado
                </label>
                <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono truncate">
                  {currentPackage ? currentPackage.outputDir : 'Nenhum bundle ativo'}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Pasta para guardar decisões
                </label>
                <input
                  type="text"
                  value={recordsDir}
                  onChange={(e) => setRecordsDir(e.target.value)}
                  placeholder="ex.: revisoes"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-teal-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Responsável pela revisão <span className="text-teal-400">*</span>
              </label>
              <input
                type="text"
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                placeholder="ex.: Revisor de teste"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Decisão <span className="text-teal-400">*</span>
              </label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value as ReviewDecision)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 transition font-medium"
              >
                <option value="REQUEST_CHANGES">REQUEST_CHANGES — Solicitar ajustes</option>
                <option value="APPROVE">APPROVE — Aprovar lote</option>
                <option value="REJECT">REJECT — Rejeitar lote</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Justificativa <span className="text-teal-400">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Informe o motivo detalhado da decisão..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 transition"
              />
            </div>

            <button
              type="button"
              onClick={handleRecordReview}
              disabled={!currentPackage || !trustedAnchor}
              className="w-full py-2.5 px-4 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              Registrar decisão vinculada ao resultado
            </button>
          </div>
        </div>

        {/* Right Column: Verify Decision & Link (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Conferir Decisão e Vínculo
              </h3>
              <input
                ref={reviewFileInputRef}
                type="file"
                accept=".json"
                onChange={handleLoadReviewFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => reviewFileInputRef.current?.click()}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium px-2 py-0.5 rounded bg-teal-950/40 border border-teal-800/40 transition inline-flex items-center gap-1"
              >
                <Upload className="w-3 h-3" />
                Carregar .json…
              </button>
            </div>

            {reviewToVerify ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ID da Decisão:</span>
                  <span className="text-teal-300 truncate ml-2 font-semibold">
                    {reviewToVerify.decision_id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Decisão:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      reviewToVerify.decision === 'APPROVE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : reviewToVerify.decision === 'REJECT'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {reviewToVerify.decision}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Revisor:</span>
                  <span className="text-slate-200">{reviewToVerify.responsible_human}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Hash da Decisão:</span>
                  <span className="text-slate-400 break-all text-[11px]">
                    {reviewToVerify.record_hash}
                  </span>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-slate-800 rounded-lg p-6 text-center bg-slate-950/30 text-xs text-slate-500">
                Nenhum arquivo de decisão carregado para conferência.
              </div>
            )}

            <button
              type="button"
              onClick={handleVerifyReview}
              disabled={!reviewToVerify || !currentPackage}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-100 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
            >
              <UserCheck className="w-3.5 h-3.5 text-teal-400" />
              Conferir decisão e vínculo
            </button>

            {verificationResult && (
              <div
                className={`p-4 rounded-lg border text-xs ${
                  verificationResult.valid
                    ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-800 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  {verificationResult.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>
                    {verificationResult.valid
                      ? 'Decisão e Vínculo Confirmados'
                      : 'FALHA na Verificação da Decisão'}
                  </span>
                </div>
                <p className="text-[11px] opacity-80">{verificationResult.scope}</p>
                {!verificationResult.valid && (
                  <ul className="mt-2 list-disc list-inside font-mono text-rose-300 space-y-0.5">
                    {verificationResult.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decision Record Card when created */}
      {lastCreatedRecord && (
        <div className="bg-slate-900/90 border border-teal-600/40 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-400" />
                Registro de Decisão Criado com Sucesso
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Caminho: {lastCreatedRecord.recordPath}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyRecord}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
              >
                {copiedRecord ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar JSON
              </button>
              <button
                type="button"
                onClick={handleDownloadRecordJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar Decisão (.json)
              </button>
            </div>
          </div>

          <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
            {JSON.stringify(lastCreatedRecord.record, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

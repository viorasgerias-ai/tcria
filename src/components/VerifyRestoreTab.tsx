import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Upload,
  Download,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileCheck,
  AlertOctagon,
  Copy,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import { Bundle, BundleVerification, CasePackage, LedgerEvent, RestorePlanItem } from '../types';
import { anchorValue, ValueError } from '../lib/crypto';
import { verifyBundle } from '../lib/pipeline';
import { restoreBundle } from '../lib/custody';
import { downloadBlob, downloadText, exportRestoredFilesToZip, parseUploadedZip } from '../lib/zip';

interface VerifyRestoreTabProps {
  currentPackage: CasePackage | null;
  trustedAnchor: string;
  setTrustedAnchor: (val: string) => void;
  setStatusText: (text: string) => void;
  onLogOutput: (data: unknown) => void;
}

export const VerifyRestoreTab: React.FC<VerifyRestoreTabProps> = ({
  currentPackage,
  trustedAnchor,
  setTrustedAnchor,
  setStatusText,
  onLogOutput,
}) => {
  const [activePackage, setActivePackage] = useState<CasePackage | null>(currentPackage);
  const [destinationPath, setDestinationPath] = useState(currentPackage?.outputDir ? `destino/${currentPackage.outputDir}` : 'destino/caso-original');
  const [verificationResult, setVerificationResult] = useState<BundleVerification | null>(null);
  const [restorePlan, setRestorePlan] = useState<{
    dry_run: boolean;
    destination: string;
    files: RestorePlanItem[];
    bundle_hash: string;
  } | null>(null);
  const [restoredFilesStore, setRestoredFilesStore] = useState<Record<string, Uint8Array> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedAnchor, setCopiedAnchor] = useState(false);

  const anchorFileInputRef = useRef<HTMLInputElement>(null);
  const bundleZipInputRef = useRef<HTMLInputElement>(null);

  // Sync with prop when prop changes
  React.useEffect(() => {
    if (currentPackage) {
      setActivePackage(currentPackage);
      setDestinationPath(`destino/${currentPackage.outputDir}`);
    }
  }, [currentPackage]);

  const handleCopyAnchor = () => {
    if (!trustedAnchor) return;
    navigator.clipboard.writeText(trustedAnchor);
    setCopiedAnchor(true);
    setTimeout(() => setCopiedAnchor(false), 2000);
  };

  const handleLoadAnchorFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '').trim();
        const cleaned = anchorValue(text);
        setTrustedAnchor(cleaned);
        setStatusText('Referência SHA-256 carregada de arquivo independente.');
      } catch (err) {
        setErrorMessage(String(err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveAnchorFile = () => {
    if (!trustedAnchor) {
      setErrorMessage('Informe ou gere uma referência SHA-256 antes de salvar.');
      return;
    }
    try {
      const cleaned = anchorValue(trustedAnchor);
      downloadText(cleaned + '\n', 'referencia-caso.sha256');
      setStatusText('Referência guardada separadamente. Preserve-a em local protegido.');
    } catch (err) {
      setErrorMessage(String(err));
    }
  };

  const handleUploadBundleZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setStatusText('Lendo pacote ZIP do bundle...');
      const parsed = await parseUploadedZip(file);
      if (!parsed.bundle || !parsed.ledger) {
        throw new Error('O arquivo ZIP não contém bundle.json ou ledger.json válidos.');
      }
      const loadedPkg: CasePackage = {
        id: file.name.replace(/\.zip$/i, ''),
        createdAt: new Date().toISOString(),
        outputDir: file.name.replace(/\.zip$/i, ''),
        bundle: parsed.bundle,
        ledger: parsed.ledger,
        anchor: parsed.anchor || '',
        reportMd: parsed.reportMd || '',
        completeMarker: parsed.hasComplete ? '0.2.0\n' : '',
        originalFiles: parsed.originalFiles,
      };
      setActivePackage(loadedPkg);
      if (parsed.anchor && !trustedAnchor) {
        setTrustedAnchor(parsed.anchor);
      }
      setStatusText(`Bundle carregado do arquivo ${file.name}.`);
    } catch (err) {
      setErrorMessage('Falha ao abrir pacote ZIP: ' + String(err));
    }
    e.target.value = '';
  };

  const handleVerifyBundle = () => {
    setErrorMessage(null);
    setVerificationResult(null);
    if (!activePackage) {
      setErrorMessage('Nenhum resultado selecionado. Organize um lote primeiro ou abra um bundle.');
      return;
    }

    try {
      let cleanedAnchor: string | null = null;
      if (trustedAnchor.trim()) {
        cleanedAnchor = anchorValue(trustedAnchor);
      }

      setStatusText('Verificando integridade do bundle contra hashes e eventos encadeados...');
      const res = verifyBundle(
        activePackage.bundle,
        activePackage.ledger,
        activePackage.originalFiles,
        cleanedAnchor,
        Boolean(activePackage.completeMarker)
      );

      setVerificationResult(res);
      onLogOutput({
        operacao: 'verify_bundle',
        bundle_id: activePackage.outputDir,
        ...res,
      });

      if (res.valid) {
        setStatusText(
          res.scope === 'TRUSTED_REFERENCE'
            ? 'Integridade conferida com sucesso contra a referência guardada!'
            : 'Integridade interna conferida (sem âncora independente fornecida).'
        );
      } else {
        setStatusText('FALHA de integridade. Confira os erros listados abaixo.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatusText('A verificação falhou: ' + msg);
    }
  };

  const handleRestore = (dry_run: boolean) => {
    setErrorMessage(null);
    if (!activePackage) {
      setErrorMessage('Nenhum bundle carregado para devolução.');
      return;
    }
    if (!trustedAnchor.trim()) {
      setErrorMessage('Informe a referência SHA-256 guardada: 64 caracteres hexadecimais.');
      return;
    }

    try {
      const cleaned = anchorValue(trustedAnchor);
      setStatusText(dry_run ? 'Simulando devolução de arquivos...' : 'Devolvendo arquivos às pastas correspondentes...');

      const res = restoreBundle(
        activePackage.bundle,
        activePackage.ledger,
        activePackage.originalFiles,
        destinationPath.trim() || 'destino',
        cleaned,
        dry_run
      );

      setRestorePlan(res);
      if (!dry_run && res.restoredFiles) {
        setRestoredFilesStore(res.restoredFiles);
      }

      onLogOutput({
        operacao: dry_run ? 'restore_bundle (dry-run)' : 'restore_bundle',
        ...res,
      });

      setStatusText(
        dry_run
          ? `Simulação concluída: ${res.files.length} arquivo(s) avaliado(s). Nenhum arquivo modificado.`
          : `Devolução concluída com sucesso! ${res.files.length} arquivo(s) verificados.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatusText('A devolução falhou: ' + msg);
    }
  };

  const handleDownloadRestoredZip = async () => {
    if (!restoredFilesStore) return;
    try {
      setStatusText('Compactando arquivos devolvidos...');
      const blob = await exportRestoredFilesToZip(restoredFilesStore);
      downloadBlob(blob, `devolucao-${activePackage?.outputDir || 'arquivos'}.zip`);
      setStatusText('Arquivo ZIP com os documentos devolvidos foi baixado.');
    } catch (err) {
      setErrorMessage('Erro ao baixar arquivos devolvidos: ' + String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab intro header */}
      <div className="bg-slate-900/90 border border-teal-900/60 rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-400" />
          2. Conferir Integridade e Devolver Arquivos
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Compara os bytes e o ledger do bundle com a âncora SHA-256 independente. Permite simular ou devolver
          cópias às mesmas subpastas de origem. Arquivos iguais permanecem intactos (<code className="text-teal-300 font-mono">UNCHANGED</code>);
          arquivos divergentes bloqueiam a devolução.
        </p>
      </div>

      {errorMessage && (
        <div className="bg-rose-950/70 border border-rose-800 text-rose-200 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erro na verificação ou devolução</p>
            <p className="text-rose-300 text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Inputs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Bundle & Anchor Inputs (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Pasta do resultado (Bundle)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={bundleZipInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleUploadBundleZip}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bundleZipInputRef.current?.click()}
                    className="text-xs text-teal-400 hover:text-teal-300 font-medium px-2 py-0.5 rounded bg-teal-950/40 border border-teal-800/40 transition inline-flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    Abrir bundle (.zip)…
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono flex items-center justify-between">
                <span className="truncate">
                  {activePackage ? activePackage.outputDir : 'Nenhum bundle carregado'}
                </span>
                {activePackage && (
                  <span className="text-xs text-teal-400 font-sans shrink-0 ml-2">
                    {activePackage.bundle.result.artifacts.length} arquivo(s)
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Referência SHA-256 guardada (64 hex)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={anchorFileInputRef}
                    type="file"
                    accept=".sha256,.txt"
                    onChange={handleLoadAnchorFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => anchorFileInputRef.current?.click()}
                    className="text-xs text-teal-400 hover:text-teal-300 font-medium px-2 py-0.5 rounded bg-teal-950/40 border border-teal-800/40 transition"
                  >
                    Abrir .sha256…
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAnchorFile}
                    className="text-xs text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700 transition"
                  >
                    Guardar .sha256
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={trustedAnchor}
                  onChange={(e) => setTrustedAnchor(e.target.value)}
                  placeholder="Cole aqui os 64 caracteres hexadecimais da âncora independente"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-teal-300 font-mono tracking-wider focus:outline-none focus:border-teal-500 transition pr-20"
                />
                {trustedAnchor && (
                  <button
                    type="button"
                    onClick={handleCopyAnchor}
                    className="absolute right-2 top-2 text-xs text-slate-400 hover:text-teal-300 inline-flex items-center gap-1 font-sans bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
                  >
                    {copiedAnchor ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
                    Copiar
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                A âncora deve vir de local protegido independente; não confie na cópia interna sem validação externa.
              </p>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={handleVerifyBundle}
                disabled={!activePackage}
                className="w-full py-2.5 px-4 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Conferir integridade do bundle
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Restore Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Pasta de origem ou destino das cópias
              </label>
              <input
                type="text"
                value={destinationPath}
                onChange={(e) => setDestinationPath(e.target.value)}
                placeholder="ex.: /caminho/pasta-original ou destino/caso-001"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-teal-500 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Subpastas e nomes originais são rigorosamente mantidos.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => handleRestore(true)}
                disabled={!activePackage || !trustedAnchor}
                className="flex-1 py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-100 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
              >
                <Play className="w-3.5 h-3.5 text-teal-400" />
                Simular devolução
              </button>
              <button
                type="button"
                onClick={() => handleRestore(false)}
                disabled={!activePackage || !trustedAnchor}
                className="flex-1 py-2.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs flex items-center justify-center gap-2 shadow transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Devolver arquivos
              </button>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <p>• Arquivos com hash igual ficam intactos (<span className="text-teal-400 font-mono">UNCHANGED</span>).</p>
              <p>• Arquivos ausentes são copiados (<span className="text-teal-400 font-mono">COPY</span>) e reconferidos.</p>
              <p>• Arquivo divergente bloqueia todo o lote antes da primeira cópia.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div
          className={`p-5 rounded-xl border ${
            verificationResult.valid
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {verificationResult.valid ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
            )}
            <div>
              <h3 className="font-bold text-base">
                {verificationResult.valid
                  ? 'Integridade do Bundle Conferida com Sucesso'
                  : 'FALHA na Verificação de Integridade'}
              </h3>
              <p className="text-xs opacity-90 mt-0.5">
                Escopo: {verificationResult.scope} · Âncora calculada:{' '}
                <span className="font-mono">{verificationResult.anchor.slice(0, 16)}…</span>
              </p>
            </div>
          </div>

          {!verificationResult.valid && verificationResult.errors.length > 0 && (
            <div className="mt-4 pt-3 border-t border-rose-800/60 font-mono text-xs space-y-1 text-rose-300">
              <p className="font-semibold text-rose-200 font-sans">Erros detectados:</p>
              {verificationResult.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <code>{err}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Restore Plan / Output Table */}
      {restorePlan && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                {restorePlan.dry_run ? 'Plano de Devolução (Simulação)' : 'Arquivos Devolvidos com Sucesso'}
              </h3>
              <p className="text-xs text-slate-400">
                Destino: <span className="font-mono text-slate-300">{restorePlan.destination}</span>
              </p>
            </div>

            {!restorePlan.dry_run && restoredFilesStore && (
              <button
                type="button"
                onClick={handleDownloadRestoredZip}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar Árvore Devolvida (.zip)
              </button>
            )}
          </div>

          <div className="border border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
            <table className="w-full text-left divide-y divide-slate-800">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Caminho Relativo</th>
                  <th className="px-4 py-2 font-medium">Ação Executada</th>
                  <th className="px-4 py-2 font-medium">Status de Integridade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {restorePlan.files.map((file, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-200">{file.source_path}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          file.action === 'COPY'
                            ? 'bg-teal-950 text-teal-300 border border-teal-800'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {file.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-emerald-400 flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5" />
                      SHA-256 verificado
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

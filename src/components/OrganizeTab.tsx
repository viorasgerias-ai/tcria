import React, { useState, useRef } from 'react';
import {
  FolderPlus,
  FileText,
  FileCode,
  Trash2,
  Play,
  Download,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  FileCheck2,
} from 'lucide-react';
import { CasePackage, InputDocument } from '../types';
import { runPipeline } from '../lib/pipeline';
import { downloadText, exportCaseToZip, downloadBlob } from '../lib/zip';

interface OrganizeTabProps {
  onCaseCreated: (pkg: CasePackage, summary: { output_dir: string; readiness: string; result_hash: string; anchor: string }) => void;
  onGoToVerify: (anchor: string, outputDir: string) => void;
  setStatusText: (text: string) => void;
}

const DEFAULT_SAMPLE_DOC = `Documento sintético para demonstrar o pipeline.
Origem declarada pelo operador: exemplo de teste.
Nenhuma conclusão sobre fatos reais deve ser extraída deste documento.
`;

export const OrganizeTab: React.FC<OrganizeTabProps> = ({
  onCaseCreated,
  onGoToVerify,
  setStatusText,
}) => {
  const [documents, setDocuments] = useState<InputDocument[]>([
    {
      path: 'documento.txt',
      content: new TextEncoder().encode(DEFAULT_SAMPLE_DOC),
    },
  ]);

  const now = new Date();
  const defaultCaseName = `caso-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

  const [outputDir, setOutputDir] = useState(defaultCaseName);
  const [responsible, setResponsible] = useState('Operador de teste');
  const [origin, setOrigin] = useState('Exemplo sintético');
  const [strict, setStrict] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    pkg: CasePackage;
    summary: { output_dir: string; readiness: string; result_hash: string; anchor: string };
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readers: Promise<InputDocument>[] = Array.from(files).map((file) => {
      return new Promise<InputDocument>((resolve, reject) => {
        const reader = new FileReader();
        // Use webkitRelativePath if available, otherwise file name
        const relativePath = file.webkitRelativePath || file.name;
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve({
              path: relativePath,
              content: new Uint8Array(reader.result),
            });
          } else {
            reject(new Error('Falha ao ler arquivo'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });
    });

    Promise.all(readers)
      .then((newDocs) => {
        setDocuments((prev) => {
          // Merge keeping newest if duplicate path
          const map = new Map<string, InputDocument>();
          for (const doc of prev) map.set(doc.path, doc);
          for (const doc of newDocs) map.set(doc.path, doc);
          return Array.from(map.values());
        });
        setStatusText(`${newDocs.length} arquivo(s) adicionado(s) à árvore de entrada.`);
      })
      .catch((err) => {
        setErrorMessage(String(err));
      });

    // Reset input
    e.target.value = '';
  };

  const loadSampleDocument = () => {
    setDocuments([
      {
        path: 'documento.txt',
        content: new TextEncoder().encode(DEFAULT_SAMPLE_DOC),
      },
    ]);
    setResponsible('Operador de teste');
    setOrigin('Exemplo sintético');
    setStatusText('Exemplo sintético documento.txt carregado.');
  };

  const loadLegalPreset = () => {
    setDocuments([
      {
        path: 'cliente-alfa/contrato_prestacao_servicos.txt',
        content: new TextEncoder().encode(
          'CONTRATO DE PRESTAÇÃO DE SERVIÇOS JURÍDICOS\nData: 2026-11-04\nReferência: PROCESSO-8821\nPartes devidamente qualificadas.\n'
        ),
      },
      {
        path: 'cliente-alfa/procuracao_ad_judicia.md',
        content: new TextEncoder().encode(
          '# PROCURAÇÃO AD JUDICIA\nOutorgante: Cliente Alfa S.A.\nFinalidade: Atuação judicial.\nData: 2026-11-04\n'
        ),
      },
      {
        path: 'cliente-beta/comprovante_notificacao.txt',
        content: new TextEncoder().encode(
          'COMPROVANTE DE NOTIFICAÇÃO EXTRAJUDICIAL\nProtocolo: NOTIF-4920\nRecebido e arquivado.\n'
        ),
      },
    ]);
    setResponsible('Advogado Responsável');
    setOrigin('Dossiê Jurídico - Caso Alfa/Beta');
    setStatusText('Lote de exemplo jurídico carregado com subpastas de clientes.');
  };

  const loadFiscalPreset = () => {
    setDocuments([
      {
        path: 'empresa-01/notas/nota_fiscal_servico_101.txt',
        content: new TextEncoder().encode('NFS-e Nº 101 - Tomador: Alpha Tech - Valor: R$ 15.000,00 - Data: 2026-11-04'),
      },
      {
        path: 'empresa-01/recibos/recibo_retencao_inss.txt',
        content: new TextEncoder().encode('Comprovante de retenção tributária referente a NFS-e 101.'),
      },
      {
        path: 'empresa-02/fechamento_mensal.json',
        content: new TextEncoder().encode(
          JSON.stringify({ mes: '2026-11', status: 'conferido', total_documentos: 42 }, null, 2)
        ),
      },
    ]);
    setResponsible('Contador Auditor');
    setOrigin('Fechamento Fiscal Mensal');
    setStatusText('Lote de exemplo fiscal carregado com notas e recibos em subpastas.');
  };

  const removeDoc = (path: string) => {
    setDocuments((prev) => prev.filter((d) => d.path !== path));
  };

  const clearAllDocs = () => {
    setDocuments([]);
  };

  const handleOrganize = () => {
    setErrorMessage(null);
    try {
      if (documents.length === 0) {
        throw new Error('Nenhum arquivo de entrada. Adicione documentos antes de prosseguir.');
      }
      if (!outputDir.trim()) {
        throw new Error('Preencha: nova pasta de resultado');
      }
      if (!responsible.trim()) {
        throw new Error('Preencha: responsável pelo lote');
      }
      if (!origin.trim()) {
        throw new Error('Preencha: origem declarada dos documentos');
      }

      setStatusText('Processando lote de documentos... calculando SHA-256 e verificações.');
      const res = runPipeline(documents, outputDir.trim(), responsible.trim(), origin.trim(), strict);

      setLastResult({
        pkg: res.package,
        summary: res.summary,
      });

      onCaseCreated(res.package, res.summary);

      if (res.summary.readiness === 'BLOCKED') {
        setStatusText('Modo estrito bloqueado por pendências. O relatório foi preservado para revisão.');
      } else {
        setStatusText(
          'Resultado criado com pendências para revisão. Guarde a referência fora da pasta do resultado.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatusText('A operação falhou: ' + msg);
    }
  };

  const handleDownloadZip = async () => {
    if (!lastResult) return;
    try {
      setStatusText('Gerando arquivo ZIP do bundle...');
      const blob = await exportCaseToZip(lastResult.pkg);
      downloadBlob(blob, `${lastResult.pkg.outputDir}.zip`);
      setStatusText(`Pacote ${lastResult.pkg.outputDir}.zip baixado com sucesso.`);
    } catch (err) {
      setErrorMessage('Erro ao gerar ZIP: ' + String(err));
    }
  };

  const handleDownloadAnchor = () => {
    if (!lastResult) return;
    downloadText(lastResult.summary.anchor + '\n', 'referencia-caso.sha256');
    setStatusText('Referência SHA-256 guardada separadamente. Preserve-a em local protegido.');
  };

  return (
    <div className="space-y-6">
      {/* Intro info box matching desktop spec */}
      <div className="bg-slate-900/90 border border-teal-900/60 rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-teal-400" />
          1. Organizar Lote e Preservar Integridade
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Os originais ficam no lugar. A saída gera uma pasta nova fora da entrada, contendo cópias byte a byte
          em <code className="text-teal-300 font-mono">originals/</code>, manifesto com hash SHA-256, ledger encadeado
          e relatório de pendências.
        </p>
      </div>

      {errorMessage && (
        <div className="bg-rose-950/70 border border-rose-800 text-rose-200 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Operação não concluída</p>
            <p className="text-rose-300 text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main form grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Documents Tree (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-teal-400" />
                Pasta com os documentos de entrada ({documents.length})
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={loadSampleDocument}
                  className="text-[11px] text-teal-400 hover:text-teal-300 font-medium px-2 py-1 rounded bg-teal-950/40 border border-teal-800/40 transition"
                  title="Carregar documento sintético de teste"
                >
                  Documento Padrão
                </button>
                <button
                  type="button"
                  onClick={loadLegalPreset}
                  className="text-[11px] text-slate-300 hover:text-teal-300 font-medium px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                  title="Carregar exemplo com pastas de clientes e contratos"
                >
                  Exemplo Jurídico
                </button>
                <button
                  type="button"
                  onClick={loadFiscalPreset}
                  className="text-[11px] text-slate-300 hover:text-teal-300 font-medium px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                  title="Carregar exemplo contábil com notas fiscais"
                >
                  Exemplo Contábil
                </button>
                {documents.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllDocs}
                    className="text-[11px] text-slate-400 hover:text-rose-400 px-1.5 py-1 transition"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Upload buttons & dropzone */}
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is standard for folder uploads in Chromium/WebKit
                webkitdirectory=""
                directory=""
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                Adicionar Arquivos…
              </button>

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <FolderPlus className="w-3.5 h-3.5 text-teal-400" />
                Adicionar Pasta Inteira…
              </button>
            </div>

            {/* Documents list */}
            {documents.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-lg p-8 text-center bg-slate-950/40">
                <FolderPlus className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhum documento adicionado ainda.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Adicione arquivos ou clique em &ldquo;+ Exemplo sintético&rdquo; para testar imediatamente.
                </p>
              </div>
            ) : (
              <div className="border border-slate-800 rounded-lg overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-800/80 bg-slate-950/60 font-mono text-xs">
                {documents.map((doc) => (
                  <div
                    key={doc.path}
                    className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-800/40 transition group"
                  >
                    <div className="flex items-center gap-2.5 truncate mr-2">
                      <FileCode className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span className="text-slate-200 truncate">{doc.path}</span>
                      <span className="text-slate-500 text-[10px] shrink-0">
                        ({(doc.content.length / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDoc(doc.path)}
                      className="text-slate-500 hover:text-rose-400 p-1 opacity-60 group-hover:opacity-100 transition"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              Nomes e subpastas são rigorosamente preservados. Links simbólicos são recusados por segurança.
            </p>
          </div>
        </div>

        {/* Right Column: Parameters & Execution (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nova pasta de resultado
              </label>
              <input
                type="text"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder="ex.: caso-001"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-teal-500 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                A pasta deve ser nova e independente para preservar histórico.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Responsável pelo lote <span className="text-teal-400">*</span>
              </label>
              <input
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="ex.: Operador de teste"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Origem declarada dos documentos <span className="text-teal-400">*</span>
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="ex.: Exemplo sintético"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 transition"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={strict}
                  onChange={(e) => setStrict(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500 focus:ring-offset-slate-900"
                />
                <span className="text-xs text-slate-300 leading-normal">
                  <strong className="text-slate-100 block">Modo estrito</strong>
                  Bloquear quando houver qualquer pendência de metadados ou regras prescritivas.
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleOrganize}
              className="w-full py-3 px-4 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              Organizar e gerar relatório
            </button>
          </div>
        </div>
      </div>

      {/* Generated Result Summary Card if available */}
      {lastResult && (
        <div className="bg-slate-900/95 border border-teal-600/50 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-teal-400" />
              <h3 className="font-semibold text-white">Lote Processado com Sucesso</h3>
              <span
                className={`text-xs px-2.5 py-0.5 rounded font-bold font-mono ${
                  lastResult.summary.readiness === 'READY_FOR_REVIEW'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : lastResult.summary.readiness === 'BLOCKED'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}
              >
                {lastResult.summary.readiness}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadZip}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar Pacote (.zip)
              </button>
              <button
                type="button"
                onClick={() => onGoToVerify(lastResult.summary.anchor, lastResult.pkg.outputDir)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
              >
                Conferir e Devolver
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>Âncora SHA-256 do Bundle:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(lastResult.summary.anchor, 'anchor')}
                    className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1"
                  >
                    {copiedField === 'anchor' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAnchor}
                    className="text-slate-400 hover:text-slate-200"
                    title="Baixar arquivo .sha256"
                  >
                    Salvar .sha256
                  </button>
                </div>
              </div>
              <p className="text-teal-300 break-all select-all font-semibold">
                {lastResult.summary.anchor}
              </p>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>Hash do Resultado Técnico:</span>
                <button
                  type="button"
                  onClick={() => handleCopy(lastResult.summary.result_hash, 'res_hash')}
                  className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1"
                >
                  {copiedField === 'res_hash' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  Copiar
                </button>
              </div>
              <p className="text-slate-300 break-all select-all">
                {lastResult.summary.result_hash}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            ⚠️ <strong>Atenção:</strong> Guarde o valor da âncora em local protegido independente. O arquivo{' '}
            <code className="text-slate-300">anchor.sha256</code> junto ao bundle é apenas uma cópia de transporte.
          </p>
        </div>
      )}
    </div>
  );
};

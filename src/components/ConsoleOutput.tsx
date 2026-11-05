import React, { useState } from 'react';
import { Terminal, Copy, Check, Download, FileText, ListTree, Code2 } from 'lucide-react';
import { CasePackage } from '../types';
import { downloadText } from '../lib/zip';

interface ConsoleOutputProps {
  statusText: string;
  currentPackage: CasePackage | null;
  lastLogData: unknown | null;
}

export const ConsoleOutput: React.FC<ConsoleOutputProps> = ({
  statusText,
  currentPackage,
  lastLogData,
}) => {
  const [activeTab, setActiveTab] = useState<'json' | 'report' | 'ledger'>('json');
  const [copied, setCopied] = useState(false);

  const jsonContent = lastLogData
    ? JSON.stringify(lastLogData, null, 2)
    : currentPackage
      ? JSON.stringify(
          {
            output_dir: currentPackage.outputDir,
            readiness: currentPackage.bundle.result.readiness,
            result_hash: currentPackage.bundle.result_hash,
            anchor: currentPackage.anchor,
            bundle: currentPackage.bundle,
          },
          null,
          2
        )
      : 'Pronto. Os documentos são processados neste computador.\nNenhum documento é transmitido pela rede.';

  const handleCopy = () => {
    let textToCopy = jsonContent;
    if (activeTab === 'report' && currentPackage?.reportMd) {
      textToCopy = currentPackage.reportMd;
    } else if (activeTab === 'ledger' && currentPackage?.ledger) {
      textToCopy = JSON.stringify(currentPackage.ledger, null, 2);
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (activeTab === 'report' && currentPackage?.reportMd) {
      downloadText(currentPackage.reportMd, 'report.md');
    } else if (activeTab === 'ledger' && currentPackage?.ledger) {
      downloadText(JSON.stringify(currentPackage.ledger, null, 2), 'ledger.json');
    } else {
      downloadText(jsonContent, 'resultado.json');
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Status Bar matching desktop.py */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-teal-400" />
          <span className="text-xs text-slate-300 font-mono truncate">{statusText}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Tab selectors */}
          <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`px-2.5 py-1 rounded font-mono transition ${
                activeTab === 'json'
                  ? 'bg-teal-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Code2 className="w-3 h-3" />
                JSON
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              disabled={!currentPackage}
              className={`px-2.5 py-1 rounded font-mono transition disabled:opacity-30 ${
                activeTab === 'report'
                  ? 'bg-teal-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                Relatório
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              disabled={!currentPackage}
              className={`px-2.5 py-1 rounded font-mono transition disabled:opacity-30 ${
                activeTab === 'ledger'
                  ? 'bg-teal-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ListTree className="w-3 h-3" />
                Ledger ({currentPackage?.ledger.length || 0})
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
            title="Copiar conteúdo"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
            title="Baixar arquivo"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Content Body */}
      <div className="p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto overflow-x-auto bg-slate-950/90 divide-y divide-slate-800/40">
        {activeTab === 'json' && (
          <pre className="whitespace-pre-wrap leading-relaxed text-teal-200/90">{jsonContent}</pre>
        )}

        {activeTab === 'report' && currentPackage && (
          <div className="prose prose-invert prose-xs max-w-none space-y-3 font-sans">
            <h4 className="font-bold text-white text-sm">Relatório Operacional</h4>
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left font-mono text-xs divide-y divide-slate-800">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-3 py-1.5">Artefato</th>
                    <th className="px-3 py-1.5">Regra</th>
                    <th className="px-3 py-1.5">Estado</th>
                    <th className="px-3 py-1.5">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                  {currentPackage.bundle.result.checks.map((chk, i) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      <td className="px-3 py-1.5 text-slate-300">{chk.artifact_id}</td>
                      <td className="px-3 py-1.5 text-slate-400">{chk.rule_id}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            chk.status === 'PASS'
                              ? 'bg-emerald-950 text-emerald-400'
                              : chk.status === 'FAIL'
                                ? 'bg-rose-950 text-rose-400'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {chk.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-slate-400">{chk.reason_code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded border border-slate-800">
              <strong>Limites:</strong> Metadados são declarações, não autenticação. Hashes verificam integridade
              contra referência, não a verdade dos fatos. A âncora local deve ser copiada para local protegido
              independente.
            </div>
          </div>
        )}

        {activeTab === 'ledger' && currentPackage && (
          <div className="space-y-2 font-mono text-xs">
            {currentPackage.ledger.map((ev) => (
              <div key={ev.sequence} className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center justify-between text-teal-400 mb-1">
                  <span>
                    #{ev.sequence} [{ev.event_type}]
                  </span>
                  <span className="text-slate-500 text-[10px]">hash: {ev.event_hash.slice(0, 16)}…</span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  <span>prev: {ev.previous_hash ? `${ev.previous_hash.slice(0, 16)}…` : 'null'}</span>
                </div>
                <pre className="mt-1 text-[11px] text-slate-300 overflow-x-auto">
                  {JSON.stringify(ev.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer matching desktop notice */}
      <div className="bg-slate-950 border-t border-slate-900 px-4 py-2 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-1">
        <span>Versão 0.3.0 · Funciona offline · SHA-256 detecta alterações; não impede edições.</span>
        <span className="text-teal-400/80">Nenhum dado sai deste navegador</span>
      </div>
    </div>
  );
};

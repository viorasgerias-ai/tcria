import React, { useState } from 'react';
import { Header } from './components/Header';
import { ProcessExplainer } from './components/ProcessExplainer';
import { PracticalUseCases } from './components/PracticalUseCases';
import { OrganizeTab } from './components/OrganizeTab';
import { VerifyRestoreTab } from './components/VerifyRestoreTab';
import { ReviewTab } from './components/ReviewTab';
import { ConsoleOutput } from './components/ConsoleOutput';
import { CasePackage } from './types';
import { FolderKanban, ShieldCheck, UserCheck, Download, Sparkles } from 'lucide-react';
import { exportCaseToZip, downloadBlob } from './lib/zip';

export function App() {
  const [activeTab, setActiveTab] = useState<'organize' | 'verify' | 'review'>('organize');
  const [currentPackage, setCurrentPackage] = useState<CasePackage | null>(null);
  const [trustedAnchor, setTrustedAnchor] = useState<string>('');
  const [statusText, setStatusText] = useState<string>(
    'Pronto. Os documentos são processados neste computador.'
  );
  const [lastLogData, setLastLogData] = useState<unknown | null>(null);

  const handleCaseCreated = (
    pkg: CasePackage,
    summary: { output_dir: string; readiness: string; result_hash: string; anchor: string }
  ) => {
    setCurrentPackage(pkg);
    setTrustedAnchor(summary.anchor);
    setLastLogData(summary);
  };

  const handleGoToVerify = (anchor: string, outputDir: string) => {
    setTrustedAnchor(anchor);
    setActiveTab('verify');
    setStatusText(`Navegando para conferência do lote ${outputDir}.`);
  };

  const handleDownloadActiveBundle = async () => {
    if (!currentPackage) return;
    try {
      setStatusText('Compactando arquivos do bundle...');
      const blob = await exportCaseToZip(currentPackage);
      downloadBlob(blob, `${currentPackage.outputDir}.zip`);
      setStatusText(`Pacote ${currentPackage.outputDir}.zip baixado com sucesso.`);
    } catch (err) {
      setStatusText('Erro ao baixar pacote: ' + String(err));
    }
  };

  return (
    <div className="min-h-screen bg-[#071318] text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950">
      {/* Background ambient gradient with technical teal hue */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-teal-900/20 rounded-full blur-3xl" />
      </div>

      {/* Main sticky navigation */}
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 relative z-10">
        {/* Hero banner / Quick status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-950/60 via-slate-900/80 to-slate-950/80 border border-teal-800/40 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Pipeline Local de Evidências Documentais
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Preservação byte a byte e conferência criptográfica rigorosa.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Recebe uma árvore de arquivos, registra SHA-256 canônico, emite bundle com ledger encadeado
              e permite devolver arquivos aos mesmos caminhos relativos sem sobrescrever divergências.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {currentPackage && (
              <button
                type="button"
                onClick={handleDownloadActiveBundle}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/25 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Baixar Pacote (.zip)
              </button>
            )}
          </div>
        </div>

        {/* Como Funciona Section */}
        <ProcessExplainer />

        {/* Casos Práticos de Uso */}
        <PracticalUseCases />

        {/* Tab Navigation matching Tkinter tabs */}
        <div className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 flex flex-wrap gap-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('organize')}
            className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'organize'
                ? 'bg-teal-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            1. Organizar
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'verify'
                ? 'bg-teal-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            2. Conferir e Devolver
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'review'
                ? 'bg-teal-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            3. Revisão Humana
          </button>
        </div>

        {/* Active Tab View */}
        <div className="pt-1">
          {activeTab === 'organize' && (
            <OrganizeTab
              onCaseCreated={handleCaseCreated}
              onGoToVerify={handleGoToVerify}
              setStatusText={setStatusText}
            />
          )}

          {activeTab === 'verify' && (
            <VerifyRestoreTab
              currentPackage={currentPackage}
              trustedAnchor={trustedAnchor}
              setTrustedAnchor={setTrustedAnchor}
              setStatusText={setStatusText}
              onLogOutput={setLastLogData}
            />
          )}

          {activeTab === 'review' && (
            <ReviewTab
              currentPackage={currentPackage}
              trustedAnchor={trustedAnchor}
              setStatusText={setStatusText}
              onLogOutput={setLastLogData}
            />
          )}
        </div>

        {/* Output Console / Log Panel */}
        <div className="pt-2">
          <ConsoleOutput
            statusText={statusText}
            currentPackage={currentPackage}
            lastLogData={lastLogData}
          />
        </div>
      </main>
    </div>
  );
}

export default App;

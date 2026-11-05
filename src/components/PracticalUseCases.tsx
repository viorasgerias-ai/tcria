import React, { useState } from 'react';
import {
  Scale,
  Calculator,
  Camera,
  Building2,
  FolderHeart,
  HelpCircle,
  CheckCircle,
  XCircle,
  FileSearch,
} from 'lucide-react';

export const PracticalUseCases: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState<number>(0);

  const useCases = [
    {
      id: 'advogados',
      title: 'Advogados e Clientes',
      icon: Scale,
      color: 'teal',
      badge: 'Jurídico',
      summary: 'Contratos, petições, mensagens e comprovantes sem alterar pastas.',
      details:
        'Preparar um conjunto de contratos, mensagens e comprovantes preservando rigorosamente as subpastas. Mais tarde, ao comparar os arquivos com a âncora SHA-256 guardada, detecta-se instantaneamente qualquer mudança ou adulteração unilateral.',
      exampleScenario: 'Contratos assinados em subpastas de clientes protegidos com âncora independente.',
    },
    {
      id: 'contadores',
      title: 'Contadores e Área Fiscal',
      icon: Calculator,
      color: 'emerald',
      badge: 'Contábil & Fiscal',
      summary: 'Notas fiscais, recibos e declarações de múltiplos clientes.',
      details:
        'Organizar cópias de notas, recibos e demonstrativos fiscais de dezenas de empresas clientes, mantendo cada documento isolado em sua respectiva subpasta. Garante que os arquivos entregues ao Fisco são idênticos aos gerados.',
      exampleScenario: 'Lotes mensais com XMLs e relatórios fiscais preservados e auditáveis.',
    },
    {
      id: 'criativos',
      title: 'Fotógrafos e Videomakers',
      icon: Camera,
      color: 'cyan',
      badge: 'Mídia & Cinema',
      summary: 'Entregas de ensaios, vídeos brutos (RAW) e masters renderizados.',
      details:
        'Conferir se fotos e vídeos em alta resolução copiados para HDs de entrega mantêm os mesmos bytes dos arquivos gravados na câmera. Evita perdas por corrupção silenciosa de dados durante transferências entre cartões e discos.',
      exampleScenario: 'Entrega de gravações brutas com verificação de integridade bit a bit.',
    },
    {
      id: 'empresas',
      title: 'Empresas e Auditorias',
      icon: Building2,
      color: 'sky',
      badge: 'Auditoria & Compliance',
      summary: 'Dossiês para perícia, due diligence e auditorias externas.',
      details:
        'Montar uma entrega formal de documentos para fiscalização ou due diligence com manifesto técnico imutável. Cada arquivo possui hash registrado em ledger sequencial com cadeia imutável de eventos.',
      exampleScenario: 'Auditoria de conformidade com cadeia de custódia e relatório independente.',
    },
    {
      id: 'pessoal',
      title: 'Uso Pessoal e Acervos',
      icon: FolderHeart,
      color: 'mint',
      badge: 'Acervos & Memória',
      summary: 'Documentos essenciais, certidões e acervos familiares.',
      details:
        'Conferir cópias de documentos pessoais importantes, fotos de família ou backups de longo prazo após transferências entre discos externos, computadores ou pen drives.',
      exampleScenario: 'Acervo de fotos digitalizadas e documentos digitalizados imutáveis.',
    },
  ];

  const active = useCases[selectedCase];
  const ActiveIcon = active.icon;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 relative overflow-hidden space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-teal-400" />
            Para Quem Serve na Prática
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Para quem precisa guardar, copiar ou entregar arquivos e ter certeza absoluta de que continuam iguais.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-teal-300 font-mono bg-teal-950/40 px-3 py-1 rounded-lg border border-teal-800/40">
          <HelpCircle className="w-3.5 h-3.5" />
          5 Cenários de Aplicação Real
        </div>
      </div>

      {/* Case Pills / Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {useCases.map((uc, index) => {
          const Icon = uc.icon;
          const isSelected = index === selectedCase;
          return (
            <button
              key={uc.id}
              type="button"
              onClick={() => setSelectedCase(index)}
              className={`flex flex-col items-start p-3 rounded-lg border text-left transition cursor-pointer ${
                isSelected
                  ? 'bg-teal-950/70 border-teal-500/80 text-white shadow-md'
                  : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span
                  className={`p-1.5 rounded-md ${
                    isSelected ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-900 text-teal-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-mono text-slate-400 font-semibold">{uc.badge}</span>
              </div>
              <span className="text-xs font-bold leading-tight block text-slate-200">{uc.title}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Case Spotlight Details */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-950 border border-teal-800/60 text-teal-400">
              <ActiveIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{active.title}</h3>
              <p className="text-xs text-teal-400 font-medium">{active.summary}</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pt-1">{active.details}</p>
          <div className="inline-flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 mt-2">
            <span className="font-semibold text-teal-300 font-mono">Exemplo real:</span>
            <span>{active.exampleScenario}</span>
          </div>
        </div>

        {/* Live Example Visualizer Box: 200 files scenario */}
        <div className="w-full md:w-80 shrink-0 bg-slate-900/90 border border-teal-900/60 rounded-lg p-4 text-xs font-mono space-y-2.5">
          <div className="flex items-center justify-between text-slate-300 font-bold border-b border-slate-800 pb-2">
            <span className="text-teal-400">Exemplo Simples</span>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">200 Arquivos</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>1. Você registra uma pasta com 200 arquivos</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>2. Guarda a âncora SHA-256 separada</span>
            </div>
            <div className="flex items-center gap-2 text-amber-300">
              <span className="w-3.5 h-3.5 rounded-full border border-amber-400 text-amber-400 flex items-center justify-center text-[9px] shrink-0 font-bold">!</span>
              <span>3. Meses depois, alguém altera 1 byte em um arquivo</span>
            </div>
            <div className="flex items-center gap-2 text-rose-300">
              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>4. A conferência aponta o arquivo divergente na hora</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 leading-normal font-sans">
            Sem falso positivo e sem sobrescrever dados na devolução.
          </p>
        </div>
      </div>
    </div>
  );
};

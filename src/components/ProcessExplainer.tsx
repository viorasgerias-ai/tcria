import React from 'react';
import { FolderTree, Binary, ClipboardCheck, UserCheck } from 'lucide-react';

export const ProcessExplainer: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Organização de Cópias',
      desc: 'Lê uma pasta e preserva cópias com os mesmos nomes e subpastas, mantendo os originais no lugar.',
      icon: FolderTree,
    },
    {
      number: '02',
      title: 'Cálculo de SHA-256',
      desc: 'Gera o digest criptográfico canônico de cada arquivo — referência para detectar alterações posteriores.',
      icon: Binary,
    },
    {
      number: '03',
      title: 'Relatório e Ledger',
      desc: 'Gera relatório operacional com checagens explícitas e cadeia imutável de eventos sem inferências artificiais.',
      icon: ClipboardCheck,
    },
    {
      number: '04',
      title: 'Devolução e Revisão',
      desc: 'Devolve arquivos sem sobrescrever divergências e vincula decisões humanas auditáveis ao hash do bundle.',
      icon: UserCheck,
    },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
      {/* Decorative background subtle SHA-256 hashes */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] font-mono text-[10px] leading-4 text-teal-300 overflow-hidden select-none p-4"
        aria-hidden="true"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="truncate">
            7bd142e71217877b044c169c91e739c6000d63208c85ae9bcfe947b7168622a8 8966e235353a014b62fcbce655d0dbe832f231422b8a71faa926f153839c873d
          </div>
        ))}
      </div>

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              Como Funciona o Pipeline de Integridade
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Arquitetura determinística, sem IA, com processamento 100% local.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="flex flex-col justify-between border-t border-teal-500/30 pt-4 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-2xl font-black text-teal-400 tracking-tighter">
                      {step.number}
                    </span>
                    <div className="p-2 rounded-lg bg-teal-950/40 text-teal-300 border border-teal-800/40 group-hover:border-teal-500/60 transition">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-100 mb-1.5">{step.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

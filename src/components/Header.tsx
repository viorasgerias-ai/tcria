import React from 'react';
import { ShieldCheck, Lock, HardDrive, Cpu } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                oranizator-igualizator
                <span className="text-xs font-mono font-medium px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                  v0.3.0
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Organize cópias, confira alterações e preserve os caminhos de origem.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
            <Lock className="w-3.5 h-3.5" />
            100% Offline
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 text-slate-300 border border-slate-800">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            Originais Preservados
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 text-slate-300 border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            SHA-256 Canônico
          </span>
        </div>
      </div>
    </header>
  );
};

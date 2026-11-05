# oranizator-igualizator — pipeline local de integridade documental

Aplicativo web reescrito em **React 19 + TypeScript + Vite + Tailwind CSS**, preservando rigorosamente todas as regras de integridade, cálculo canônico de SHA-256, ledger encadeado, devolução conservadora e decisões humanas da versão original.

Funciona **100% offline no navegador**, sem IA e sem transmissão de dados à internet.

## Funcionalidades Preservadas

* **1. Organizar**: Lê árvore de arquivos, preserva cópias byte a byte em `originals/` com os mesmos nomes e subpastas, mantendo os originais intactos no lugar.
* **2. Hashing SHA-256 e Regras**: Calcula o digest canônico de cada arquivo, verifica integridade UTF-8/JSON, rastreia datas e referências (`trace.date`, `trace.reference`) e registra no ledger encadeado.
* **3. Relatório e Ledger**: Gera manifesto `bundle.json`, `ledger.json`, `report.md`, cópia de transporte `anchor.sha256` e marcador `COMPLETE`.
* **4. Devolução Conservadora**: Devolve cópias às pastas correspondentes. Arquivos iguais permanecem intactos (`UNCHANGED`); arquivos divergentes bloqueiam todo o lote antes da primeira cópia (`CONFLICT`).
* **5. Revisão Humana**: Registra decisões (`APPROVE`, `REJECT`, `REQUEST_CHANGES`) em arquivos separados com `schema_version: 1`, vinculados ao hash exato do bundle auditado, permitindo conferência e auditoria externa.

## Execução

```bash
npm install
npm run dev
```

O servidor iniciará em `http://0.0.0.0:3000`.

## Limites e Segurança

* Hashes SHA-256 detectam alterações contra uma referência independente guardada previamente; não impedem edições nem atestam autenticidade fática.
* Nomes declarados e metadados são declarações, não autenticação criptográfica ou assinatura digital.
* A âncora SHA-256 gerada deve ser sempre guardada em local protegido independente.

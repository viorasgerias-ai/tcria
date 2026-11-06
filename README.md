# oranizator-igualizator — integridade documental, local e offline

O repositório reúne duas implementações do mesmo fluxo de organização, verificação e devolução conservadora de documentos:

* **Aplicativo desktop Python**: interface gráfica e linha de comando para Windows e macOS, com testes e receitas de instaladores nativos.
* **Interface web React/TypeScript**: aplicação Vite executada no navegador, mantida junto do app desktop.

Nenhuma das versões envia documentos para a internet. Hashes detectam alterações contra uma referência independente; não comprovam autenticidade fática, identidade ou assinatura digital.

## Desktop (Python)


A versão 0.3 acrescenta uma interface gráfica offline para organizar, conferir, devolver arquivos e registrar revisão humana. Para abrir pelo código-fonte:

```bash
python3 -m tcria.desktop
```

As receitas de instaladores Windows x64 (`.exe`) e macOS Intel/Apple Silicon (`.dmg`) estão em `packaging/` e `scripts/`. O workflow `.github/workflows/desktop.yml` compila e testa cada pacote no sistema de destino. **Os instaladores são gerados pelo GitHub Actions após o envio à main.** Consulte a execução mais recente de “Instaladores desktop” para baixar os artefatos e confirmar a validação nativa. Consulte [docs/DESKTOP.md](docs/DESKTOP.md) para requisitos, instruções, testes e pendências de assinatura.

## Executar

Na raiz do repositório, sem instalação:

```bash
python3 -m tcria run examples/input output/caso-001 --responsible "Operador de teste" --origin "Exemplo sintético"
python3 -m tcria verify output/caso-001
python3 -m unittest discover -v
```

Também funciona `python3 pipeline.py ...`. Para disponibilizar o comando `tcria`:

```bash
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -e .
tcria --help
```

Cada execução exige uma saída nova, fora da árvore de entrada. `run` devolve `result_hash` e `anchor`. Guarde o valor de `anchor` em local protegido independente. O `anchor.sha256` junto do bundle é apenas uma cópia de transporte.

```bash
python3 -m tcria verify output/caso-001 --trusted-anchor HASH_GUARDADO
```

Códigos de saída: 0 = operação concluída; 1 = erro ou verificação inválida; 2 = auditoria estrita bloqueada. Nenhum deles equivale a aprovação humana.

## Devolver às mesmas pastas

O argumento `destination` é a raiz de onde vieram os arquivos, ou uma nova raiz para exportar cópias. Não é necessário mover os originais para processá-los.

```bash
python3 -m tcria restore output/caso-001 /caminho/da/pasta-original --trusted-anchor HASH_GUARDADO --dry-run
python3 -m tcria restore output/caso-001 /caminho/da/pasta-original --trusted-anchor HASH_GUARDADO
```

Por exemplo, `entrada/cliente/a.txt` e `entrada/outro/a.txt` voltam como `destino/cliente/a.txt` e `destino/outro/a.txt`. Arquivo existente com hash igual fica intacto (`UNCHANGED`). Um arquivo ausente é copiado (`COPY`) e conferido novamente. Arquivo existente com bytes diferentes bloqueia o lote antes da primeira cópia. A simulação não cria pastas nem arquivos. A devolução exige âncora independente e bundle íntegro.

## Revisão humana

A decisão fica em registro separado, vinculado ao hash exato do bundle, sem reescrever o resultado técnico:

```bash
python3 -m tcria review output/caso-001 --records-dir output/revisoes --trusted-anchor HASH_GUARDADO --responsible "Revisor de teste" --decision REQUEST_CHANGES --reason "Regras ainda pendentes"
python3 -m tcria verify-review output/caso-001 output/revisoes/ID_RETORNADO.json --trusted-anchor HASH_GUARDADO
```

Decisões: `APPROVE`, `REJECT`, `REQUEST_CHANGES`. Nome declarado não é autenticação. Preserve também o hash retornado da decisão em armazenamento protegido; uma revisão autoconsistente não comprova identidade ou assinatura.


## Web (React, TypeScript e Vite)

A versão web reescrita em **React 19 + TypeScript + Vite + Tailwind CSS** preserva as regras de integridade, cálculo canônico de SHA-256, ledger encadeado, devolução conservadora e revisão humana. Ela funciona no navegador, sem depender do aplicativo desktop nem de um backend.

```bash
npm install
npm run dev
npm run lint
npm run build
```

O servidor de desenvolvimento inicia em `http://0.0.0.0:3000`. Os arquivos da web ficam em `src/`; `index.html`, `package.json`, `vite.config.ts` e os demais arquivos de configuração TypeScript ficam na raiz sem conflito com o pacote Python.

## Organização do repositório

```text
tcria/                  núcleo, CLI e interface gráfica Python
pipeline.py             compatibilidade com o comando do ZIP
desktop_launcher.py     entrada para executáveis desktop
packaging/              PyInstaller, Inno Setup e receita Mac App Store
scripts/                compilação nativa e teste dos instaladores
tests/                  testes Python com dados sintéticos
src/                    interface web React/TypeScript
examples/input/         entrada sintética
docs/                   especificação, limites e documentação
.github/workflows/      CI Python, web, hash e instaladores
```

## Verificações automáticas

- `python-tests.yml`: testes Python 3.11, 3.12 e 3.13.
- `tests.yml`: lint e build da aplicação web.
- `automator-organizator.yml`: confere o manifesto SHA-256 dos arquivos versionados.
- `desktop.yml`: testa e gera instalador Windows x64 e DMGs macOS Intel/Apple Silicon.
- `mac-app-store.yml`: valida a receita `.pkg`, sem assinar quando os certificados não estão configurados.

Consulte [docs/DESKTOP.md](docs/DESKTOP.md), [docs/IMPLEMENTACAO.md](docs/IMPLEMENTACAO.md) e [docs/ESPECIFICACAO_CODEX.md](docs/ESPECIFICACAO_CODEX.md) para os detalhes e limites operacionais.

## Conferência dos arquivos do repositório

Depois de colocar alterações intencionais no índice do Git, regenere `.automator-organizator.sha256`:

```bash
git add .
git ls-files -z | grep -zv '^\.automator-organizator\.sha256$' | LC_ALL=C sort -z | xargs -0 sha256sum > .automator-organizator.sha256
git add .automator-organizator.sha256
```

O manifesto permite conferir mudanças intencionais; ele não é uma âncora externa de imutabilidade nem substitui os testes.

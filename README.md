# oranizator-igualizator — pipeline local de integridade documental

Aplicativo local com interface gráfica e linha de comando em Python 3.11+, baseado no `pipeline_operacional_v01.zip` fornecido pelo responsável pelo projeto. Funciona offline, sem IA e sem dependências de execução externas.

Recebe uma árvore de arquivos, preserva cópias byte a byte, registra SHA-256 e verificações explícitas, gera relatório e permite devolver os arquivos aos mesmos caminhos relativos. Os originais permanecem no lugar. Os nomes e subpastas são preservados; arquivos diferentes nunca são sobrescritos na devolução.

## Windows e macOS

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

## Organização

```text
tcria/                  núcleo, CLI e interface gráfica; devolução e revisão humana
pipeline.py             compatibilidade com o comando do ZIP
desktop_launcher.py     entrada para executáveis desktop e teste empacotado
packaging/              PyInstaller, dependência de build e Inno Setup
scripts/                compilação nativa e teste dos instaladores
tests/                  testes com dados sintéticos
examples/input/         entrada sintética fornecida no ZIP
docs/                   especificação, limites e documentação anterior
.github/workflows/      testes automáticos
```

Cada saída contém `originals/` com os mesmos nomes e subpastas, `bundle.json`, `ledger.json`, `report.md`, `anchor.sha256` e o marcador `COMPLETE`. O manifesto associa cada arquivo ao hash, tamanho, origem declarada e responsável. O relatório mostra cada regra e suas lacunas.

O README anterior está preservado em [docs/README_ANTERIOR.md](docs/README_ANTERIOR.md). Seus comandos e serviços descrevem o projeto anterior; não são funcionalidades desta implementação. O README do ZIP está preservado em [docs/PIPELINE_ORIGINAL.md](docs/PIPELINE_ORIGINAL.md).

## Verificações e limites

TXT, Markdown e JSON têm verificação de UTF-8; JSON também tem validação sintática. Outros formatos são preservados com extração `UNKNOWN`. Datas e referências são marcadores lexicais com posições no texto decodificado: não comprovam validade de data, autenticidade ou verdade factual. Metadados ausentes, vazios e inválidos têm códigos distintos.

O `prescriptiveGate` fica `UNKNOWN / RULE_NOT_PROVIDED`, pois suas regras não foram fornecidas. Com `--strict`, qualquer lacuna bloqueia o fluxo, inclusive essa regra pendente. Sem modo estrito, o relatório exige revisão das lacunas. Não há aprovação automática.

A integridade usa JSON canônico UTF-8 (`sort_keys=True`, separadores sem espaços, `ensure_ascii=False`, NaN rejeitado) e SHA-256. O hash do evento exclui seu próprio campo de hash. O resultado é determinístico; registros de revisão contêm identificadores e horários próprios, fora desse resultado.

Hashes detectam alterações contra uma referência; não tornam o armazenamento fisicamente imutável. Controle de acesso, armazenamento WORM, assinatura/autenticação, isolamento entre módulos, metadados por arquivo, correções encadeadas, OCR/PDF e integrações externas continuam pendentes. Não há regras proprietárias ou serviço de IA nesta versão. Consulte [docs/IMPLEMENTACAO.md](docs/IMPLEMENTACAO.md) para os limites operacionais e [docs/ESPECIFICACAO_CODEX.md](docs/ESPECIFICACAO_CODEX.md) para a especificação completa.

Nome do produto definido pelo responsável: **oranizator-igualizator**. O repositório e o pacote interno continuam `tcria`; essa alteração não registra nome ou identificador na Apple.

## Conferência dos arquivos do repositório

O workflow `.github/workflows/automator-organizator.yml`, incorporado no PR #1, foi preservado. Ele compara os arquivos versionados com `.automator-organizator.sha256`. Essa verificação é independente do motor de documentos e não substitui seus testes ou a referência externa dos bundles.

Ao alterar arquivos intencionalmente, coloque as mudanças no índice do Git e depois regenere o manifesto antes do commit:

```bash
git add .
git ls-files -z | grep -zv '^\.automator-organizator\.sha256$' | LC_ALL=C sort -z | xargs -0 sha256sum > .automator-organizator.sha256
git add .automator-organizator.sha256
```

O README anterior ao envio do aplicativo foi preservado em `docs/README_GITHUB_ANTES_DO_APLICATIVO.md`. Atualizar o manifesto junto dos arquivos permite mudanças intencionais; ele não é uma âncora externa de imutabilidade.

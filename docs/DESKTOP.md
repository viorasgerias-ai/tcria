# Aplicativo e instaladores para computador — versão 0.3

## Estado desta entrega

A interface gráfica, as receitas de empacotamento e a automação de builds estão implementadas. O código-fonte foi verificado no ambiente Linux. Os instaladores `.exe` e `.dmg` são produzidos no GitHub Actions, em runners nativos, e ficam nos artefatos da execução bem-sucedida. As tentativas iniciais de envio receberam HTTP 403; uma conexão autenticada pelo Cloud Environment passou a estar disponível para publicar na main. O código-fonte não inclui binários pré-compilados.

Foram executados 26 testes: 24 passaram; 2 testes de janela foram pulados porque o ambiente não disponibiliza uma tela gráfica. A compilação sintática dos módulos também passou. Testes de execução de janelas, PyInstaller, Inno Setup, montagem do DMG e instalação/desinstalação nativa permanecem pendentes até rodar os jobs Windows/macOS. O workflow falha se a aplicação empacotada não conseguir criar a janela ou concluir o fluxo de dados sintéticos.

## Aplicativo local

Três abas cobrem o fluxo do programa:

1. **Organizar:** selecionar a entrada, escolher uma pasta nova para o resultado e declarar responsável/origem. A entrada fica intacta; cópias preservam nomes e subpastas.
2. **Conferir e devolver:** guardar uma referência SHA-256 fora do resultado, conferir integridade, simular e executar a devolução. Arquivos iguais são mantidos e divergentes bloqueiam a devolução.
3. **Revisão humana:** criar uma decisão em pasta separada e conferir seu vínculo ao bundle exato.

Operações de arquivos rodam em uma thread de trabalho, mantendo a janela disponível. Enquanto processa, o aplicativo desabilita ações e recusa fechar para evitar interromper a gravação. Não há cancelamento de um lote já iniciado. Erros são mostrados em português quando gerados pelo aplicativo; mensagens do sistema podem usar o idioma do sistema operacional.

O programa não envia os documentos à internet, não precisa de login e não usa IA. A compilação baixa ferramentas; o uso dos executáveis compilados funciona offline e não exige Python instalado no computador do usuário.

## Pacotes previstos

| Sistema de compilação | Arquivo gerado | Instalação |
|---|---|---|
| Windows 10/11 x64 | `oranizator-igualizator-0.3.0-windows-x64-setup.exe` | Assistente em português, instalação por usuário, atalho no menu e desinstalador |
| macOS 15+ Intel | `oranizator-igualizator-0.3.0-macos-x86_64.dmg` | Abrir o DMG e arrastar o aplicativo para Applications |
| macOS 15+ Apple Silicon | `oranizator-igualizator-0.3.0-macos-arm64.dmg` | Abrir o DMG e arrastar o aplicativo para Applications |

O alvo inicial macOS é 15 ou superior, alinhado aos runners de build. Compatibilidade com versões anteriores, Windows ARM e Windows 32 bits não foi validada. Cada build publica `SHA256SUMS.txt` junto do instalador. Esses hashes não substituem assinatura do desenvolvedor.

O Windows instala em `%LOCALAPPDATA%\Programs\oranizator-igualizator`, sem pedir administrador. Os documentos e casos ficam nas pastas escolhidas pelo usuário, fora da instalação. O desinstalador não recebe instruções para apagar essas pastas. O instalador cria um atalho padrão e oferece atalho opcional na área de trabalho.

## Gerar automaticamente no GitHub

Depois do envio à main:

- O push na `main` dispara `.github/workflows/desktop.yml`.
- Também é possível abrir **Actions → Instaladores desktop → Run workflow**, escolhendo `main`.
- A matriz usa `windows-2022`, `macos-15-intel` e `macos-15` (Apple Silicon), com Python 3.12.
- Cada job executa os testes, compila com PyInstaller, produz o instalador e testa o aplicativo instalado com dados sintéticos.
- No Windows, o teste instala em uma pasta temporária, testa e desinstala. No macOS, monta o DMG, copia o `.app` para uma pasta temporária, testa e desmonta.
- Os instaladores ficam nos artefatos `oranizator-igualizator-windows-x64`, `oranizator-igualizator-macos-x86_64` e `oranizator-igualizator-macos-arm64`, por 30 dias. O workflow não cria uma release pública automaticamente.

As permissões do workflow são apenas de leitura do repositório. Não há certificados nem segredos configurados.

## Compilar localmente

A compilação deve ocorrer no próprio sistema de destino, usando Python 3.12 com Tkinter. No Windows, o instalador oficial do Python inclui Tcl/Tk quando essa opção é selecionada. No macOS, use uma distribuição Python com Tkinter funcional e as ferramentas de linha de comando do Xcode (`hdiutil` e `ditto` são usados pelo processo de empacotamento/teste).

```bash
python -m venv .venv
```

Ative o ambiente com `.venv\Scripts\activate` no Prompt do Windows, ou `source .venv/bin/activate` no macOS. Depois:

```bash
python -m pip install -r packaging/requirements-build.txt
python -m unittest discover -v
python scripts/build_desktop.py
python scripts/smoke_installer.py
```

No Windows, instale também o **Inno Setup 6**, disponível em https://jrsoftware.org/isinfo.php. O script procura `ISCC` no PATH ou na pasta padrão `C:\Program Files (x86)\Inno Setup 6`. Nos runners do GitHub essa ferramenta é fornecida pela imagem; se estiver ausente, a etapa falha com indicação clara.

Saídas em `release/`; arquivos intermediários em `dist/` e `build/`. `python scripts/build_desktop.py --plan` exibe o alvo da máquina sem compilar. O comando recusa Linux e arquiteturas sem suporte; não produz arquivos com extensão de outro sistema que não sejam executáveis reais.

Para experimentar o código-fonte com Python e Tkinter instalados, execute:

```bash
python -m tcria.desktop
```

## Assinatura e distribuição

Certificados de assinatura Windows e Apple Developer ID/notarização não foram fornecidos. Os builds são de teste e não têm identidade de desenvolvedor validada pelos sistemas operacionais. PyInstaller pode aplicar assinatura ad hoc no Mac; isso não equivale a Developer ID ou notarização. Windows SmartScreen e macOS Gatekeeper podem advertir ou bloquear a execução. A distribuição final sem esses bloqueios requer certificados e um fluxo de assinatura/notarização com segredos configurados; isso ainda não foi implementado.

O motor documental permanece na versão 0.2; a versão 0.3 identifica a interface/empacotamento. O comportamento das regras e o contrato de bundles do motor foram mantidos. Regras não fornecidas continuam UNKNOWN e bloqueiam o modo estrito. Nenhuma aprovação é inventada.

## Destino autorizado

O usuário solicitou explicitamente concentrar a entrega na main. Essa instrução substitui a recomendação de branch própria na especificação original. O workflow desktop agora roda em pushes para main e por execução manual.

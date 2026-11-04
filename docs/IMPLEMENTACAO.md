# Implementação e propriedades verificadas

## Origem e escopo

Base: pipeline operacional v0.1 fornecido pelo usuário. Esta versão 0.2 mantém o fluxo vertical do protótipo e acrescenta nomes/subpastas preservados, devolução conservadora, revisão humana em arquivos separados, marcadores literais com posições, pacote instalável e testes. A especificação completa é um alvo de evolução; esta entrega não afirma cumprir todos os requisitos de produção.

A implementação foi preparada contra a árvore existente do GitHub no commit 61daad41e55cc45e45e666f5bf7df4a7efa10817, preservando LICENSE e o README anterior em documentação. A criação da branch pela integração recebeu HTTP 403 (Resource not accessible by integration); nenhuma alteração foi publicada no repositório. Nenhuma regra industrial privada foi recebida ou implementada. Exemplos gerados do ZIP não são publicados como prova de uma execução desta versão.

## Escrita e concorrência

`run` reserva a pasta final com criação exclusiva. Dois processos tentando a mesma saída não compartilham o lote: um recebe erro. Os arquivos são preparados em `.pending`, promovidos por renomeação e `COMPLETE` é escrito por último. O verificador recusa uma execução 0.2 incompleta. Falhas deixam a pasta para diagnóstico; execute novamente em outra saída. Não há recuperação automática nem garantia de durabilidade após perda de energia, e a publicação de vários arquivos não é uma transação única com fsync.

O ledger é construído sequencialmente em memória e publicado uma vez. Não existe API para editar eventos existentes. Decisões humanas novas criam arquivos exclusivos com UUID, sem alterar o bundle. Não foi implementado um ledger multiusuário persistente nem autorização de escrita por módulo; separação de arquivos é lógica, não barreira de segurança.

`restore` verifica o bundle contra a âncora fornecida e faz preflight de todos os destinos. Rejeita travessia, symlinks, caminhos duplicados e conflitos de arquivo/pasta. Criação de arquivos usa modo exclusivo e bytes são conferidos antes e depois da cópia. Uma falha de disco no meio pode deixar cópias parciais; o comando retorna erro. Cópias completas iguais são preservadas em nova tentativa; uma cópia parcial divergente exige tratamento humano. A devolução não grava dentro do bundle.

Não executar com processos hostis alterando as pastas de entrada, bundle ou destino. Verificações de symlink e leitura não são uma barreira contra corridas de sistema de arquivos. Use permissões de sistema operacional para acesso exclusivo durante a operação. Os testes de concorrência cobrem a reserva da mesma saída, não adversários modificando diretórios.

## Dados e verificações

`source_path` é relativo à raiz escolhida. A raiz absoluta não é publicada no manifesto nem adivinhada na devolução: o operador a fornece explicitamente. Bytes e caminhos são preservados; permissões, timestamps, ACLs, pastas vazias e metadados do sistema de arquivos não são restaurados. Arquivos são lidos em memória; lotes grandes precisam de limites operacionais de memória/disco. Symlinks dentro da entrada são rejeitados; a raiz fornecida é resolvida antes da leitura.

Responsável e origem declarados são aplicados ao lote. Extração, metadados e verificações são campos separados, mas extrações não têm um repositório próprio de texto. Os formatos suportados são TXT/MD/JSON UTF-8. Regras sem contrato continuam UNKNOWN. Os estados usados atualmente são PASS, FAIL e UNKNOWN; não há regra desta versão que necessite NOT_APPLICABLE.

O relatório Markdown é uma representação das mesmas verificações do JSON; não é uma evidência assinada e sua integridade não é coberta pelo hash do bundle. Não usar o relatório isoladamente. O bundle registra hashes de bytes, resultado e cabeça do ledger. Uma âncora guardada fora do lote detecta reescrita integral; consistência interna sozinha não detecta a substituição integral autoconsistente.

Revisões verificam hash próprio e vínculo ao bundle. Não são assinaturas digitais, não autenticam responsáveis e não impedem que alguém com escrita substitua registros e hashes. Proteção externa é necessária.

## Testes

`python3 -m unittest discover -v` cobre determinismo, ausência de aprovação implícita, metadados, formato não suportado, JSON/UTF-8 inválidos, adulteração de bytes e eventos, truncamento, âncora independente, reescrita integral, preservação da origem, restauração de caminhos aninhados, nomes iguais em pastas diferentes, simulação, colisões, travessia/symlinks, saída exclusiva concorrente, interrupção, marcadores literais e revisão vinculada a um bundle específico.

Permanecem pendentes os critérios de isolamento autorizado entre módulos, correção encadeada, autenticidade de origem, regras proprietárias, versionamento/migração entre múltiplos conjuntos de regras e integrações Precision/Fifth Order. Não há stubs dessas integrações no caminho de execução.

## Validação desta entrega

Executados localmente: 21 testes unitários aprovados e demonstração da CLI com run, verify com âncora, restore em simulação e execução real, review, verify-review e códigos de saída 0/1/2. A matriz de CI para Python 3.11/3.12/3.13 foi preparada, mas não executada no GitHub devido à conexão sem instalação autorizada para escrita.

## Extensão desktop 0.3

Interface Tkinter, empacotamento e workflow de instaladores adicionados sobre o motor 0.2, mantendo seu contrato. A validação mais recente e os bloqueios de compilação nativa estão em DESKTOP.md. A contagem de 21 testes acima refere-se à entrega inicial do motor; o conjunto atual tem 26 testes, com 24 aprovados e 2 de janela pulados no ambiente sem tela.

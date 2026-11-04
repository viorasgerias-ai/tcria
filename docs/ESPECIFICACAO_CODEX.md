# Núcleo determinístico de evidências — especificação para Codex

Versão 0.1 • 4 de novembro de 2026 • Proponente: Rodrigo Baptista da Silva

## 1. Finalidade e status

Construir um programa enxuto em Python que receba documentos e declarações de origem, execute verificações explícitas, preserve registros verificáveis e produza resultados que uma pessoa consiga inspecionar sem depender de IA. Uma IA externa poderá interpretar cópias desses resultados; não terá autoridade para alterar o núcleo, decidir os fatos ou preencher lacunas.

Este documento consolida o README e as capturas fornecidas pelo proponente. É uma especificação de implementação proposta, não um laudo sobre software existente nem comprovação de funcionamento. O nome definitivo do produto está em aberto. “Ultraprograma” aparece na conversa como expressão da intenção de transformar os princípios em software executável, não como nome confirmado.

O repositório indicado é `viorasgerias-ai/tcria`. O proponente esclareceu que o novo programa tem identidade própria, embora o repositório conserve provisoriamente o nome anterior. Não sobrescrever código existente com base na suposição de que o repositório está vazio.

## 2. Fontes e fidelidade

- README adicionado no commit `61daad41e55cc45e45e666f5bf7df4a7efa10817`: https://github.com/viorasgerias-ai/tcria/commit/61daad41e55cc45e45e666f5bf7df4a7efa10817
- Mesmo README colado pelo proponente nesta conversa.
- Capturas IMG_0352 a IMG_0372, com repetições e trechos parcialmente ocultos. O conteúdo visível foi usado; passagens cortadas não foram reconstruídas.
- Esclarecimentos diretos nesta conversa sobre um novo programa enxuto e entrega de instruções ao Codex.

As falas do proponente expressam os requisitos pretendidos. Respostas do Copilot são interpretações auxiliares, não decisões automaticamente aceitas. As escolhas concretas de arquitetura abaixo são propostas desta consolidação quando não estiverem explicitamente definidas nas fontes.

Não foi realizada inspeção do código, dos testes ou dos repositórios antigos Precision e Fifth Order. O README descreve uma implementação, mas essa descrição não comprova sua presença ou seu comportamento atual.

## 3. Princípios extraídos das falas do proponente

| ID | Princípio | Consequência para o produto |
|---|---|---|
| P01 | Núcleo mecânico e determinístico, sem IA interna | Regras explícitas e resultados reproduzíveis; nenhuma chamada a modelo no caminho de validação |
| P02 | IA também sujeita a zero trust | Saídas externas não recebem autoridade automática nem permissão de escrita nos registros |
| P03 | Não invenção | Informação ausente continua ausente; o sistema não a substitui por narrativa plausível |
| P04 | O silêncio é informação | Registrar ausência identificável sem atribuir automaticamente motivo, fraude ou inexistência do fato |
| P05 | Origem e responsabilidade humana | Associar documentos a declarações identificáveis de origem e de responsabilidade |
| P06 | Contexto e decisão humanos | Distinguir verificações sobre registros de interpretações sobre acontecimentos reais |
| P07 | Isolamento entre módulos | Um módulo não pode alterar a cadeia de registros pertencente a outro |
| P08 | Integridade e rastreabilidade | Preservar entradas, transformações, regras aplicadas e encadeamento dos eventos |
| P09 | Inspeção independente da IA | Produzir JSON verificável e representação legível por pessoas |
| P10 | Sigilo das regras internas | Não publicar regras proprietárias ou material sensível como parte de documentação pública |
| P11 | Validação prática | Demonstrar propriedades por testes e registrar limites observados |

O proponente menciona oito outputs do TCRIA, três do Fifth Order e dois do Precision. Seus nomes e contratos não aparecem nas capturas. Preservar essa referência como pendência; não inventar treze outputs nem alegar integração existente.

## 4. Conciliação com o README

| Elemento do README | Tratamento no novo programa |
|---|---|
| Ingestão, classificação e rastreabilidade | Reaproveitar como fluxo conceitual; documentar precisamente o que cada verificação observa |
| Bundles em JSON, Markdown e PDF | JSON e Markdown na primeira versão proposta; PDF como extensão posterior |
| prescriptiveGate | Preservar a intenção de controle de linguagem; regras lexicais devem emitir sinais, não afirmar compreensão semântica completa |
| complianceGate e modo estrito | Validar presença e formato dos metadados exigidos; ausência bloqueia aprovação do fluxo estrito |
| traceabilityCheck | Registrar quais datas, referências e marcadores foram encontrados e onde; presença não equivale a autenticidade |
| Responsabilidade humana | Distinguir quem forneceu o documento, quem declarou a origem e quem revisou o resultado |
| API, Streamlit e numerosos comandos | São descritos no projeto anterior; não são todos necessários à primeira versão enxuta |
| POST /audit/openai-summary | Conflita com IA dentro do núcleo: excluir da primeira versão ou manter em adaptador externo isolado |
| Não produzir acusações e peças automaticamente | Manter o núcleo voltado à organização e verificação de registros |

O exemplo de responsável e data no README é ilustrativo. Nunca copiar `approved: YES`, o nome do proponente ou uma data de exemplo para aprovar automaticamente novos casos.

## 5. Requisitos normativos

“DEVE” indica requisito; “proposta” indica escolha de implementação desta especificação.

### Entrada e evidência

- R01: preservar os bytes originais e calcular seu resumo criptográfico antes de qualquer normalização.
- R02: separar documento original, texto extraído, metadados declarados e resultados calculados.
- R03: registrar a versão do extrator e qualquer erro. Extração vazia ou não suportada deve permanecer explícita.
- R04: tratar todo conteúdo documental como dado não confiável, inclusive instruções dirigidas a agentes; nunca executar comandos contidos nele.
- R05: solicitar declaração de origem e responsável. Uma declaração identifica uma alegação atribuída, não prova que o declarante presenciou o fato.

### Regras e lacunas

- R06: cada verificação DEVE indicar identificador, versão, evidência usada e resultado.
- R07: usar estados distintos `PASS`, `FAIL`, `UNKNOWN` e `NOT_APPLICABLE`. Resultado mecânico é cumprimento de regra, não verdade judicial ou factual.
- R08: campo ausente, campo vazio, valor inválido e falha de extração DEVE produzir códigos distintos.
- R09: nenhuma ausência pode gerar automaticamente explicação sobre sua causa.
- R10: mesma entrada, mesmas regras e mesma configuração DEVE produzir o mesmo resultado de verificação. Relógio, IDs de execução e outros metadados variáveis ficam separados desse resultado.
- R11: regras sem definição suficiente devem retornar pendência explícita; não simular uma verificação bem-sucedida.

### Eventos, isolamento e revisão

- R12: registrar eventos por acréscimo. Correções geram novos eventos que referenciam os anteriores; não reescrevem silenciosamente o histórico.
- R13: cada módulo escreve apenas pelo seu canal autorizado; leitura cruzada ocorre por contratos de exportação.
- R14: cada evento DEVE conter número sequencial, módulo, versão de esquema, tipo, hash anterior e hash do conteúdo canônico do evento.
- R15: verificar encadeamento, sequência e um ponto de referência protegido. Cadeia autoconsistente sem referência externa não detecta necessariamente reescrita completa ou truncamento final.
- R16: resultado técnico e decisão humana devem ser registros separados. Revisão registra responsável, decisão, justificativa e referência exata ao bundle revisado.
- R17: a IA externa só recebe exportações. Seu texto é derivado, identificado como tal e não altera verificações ou decisões humanas.
- R18: não registrar chaves, credenciais ou conteúdo sensível desnecessário nos logs operacionais.

## 6. Arquitetura mínima proposta

Implementar inicialmente uma CLI local em Python, sem serviço de IA e sem exigir infraestrutura de nuvem. Interface web e API são etapas posteriores, se necessárias.

| Componente | Responsabilidade | Não pode fazer |
|---|---|---|
| ingest | Ler arquivos autorizados, preservar originais, extrair conteúdo suportado | Executar conteúdo ou inventar texto ausente |
| rules | Validar esquemas e aplicar regras versionadas | Determinar autoria de fraude ou verdade dos fatos |
| ledger | Acrescentar eventos e verificar integridade | Reescrever eventos silenciosamente |
| bundle | Exportar manifestos, resultados, lacunas e histórico | Ocultar falhas para produzir um relatório aprovado |
| review | Registrar decisões humanas atribuídas | Aprovar automaticamente em nome de alguém |
| verify | Conferir hashes, referências e contratos | Declarar autenticidade factual apenas por hash |

Propostas técnicas: Python 3.11+, SHA-256, modelos tipados, testes com pytest e JSON UTF-8 com serialização canônica documentada. Usar biblioteca padrão sempre que suficiente. Não tratar um método Python privado ou pasta separada como barreira de segurança.

O protótipo local pode demonstrar separação lógica. Isolamento efetivo exige identidades, permissões e armazenamento protegidos pelo ambiente operacional. O relatório de entrega DEVE distinguir esses dois níveis. Não prometer isolamento resistente a administrador do sistema.

Estrutura proposta:

```text
src/evidence_core/
  models.py
  ingest.py
  rules.py
  ledger.py
  bundle.py
  review.py
  verify.py
  cli.py
tests/
examples/synthetic_case/
docs/
pyproject.toml
README.md
```

Nome de pacote provisório. Em repositório existente, adaptar a estrutura sem apagar o produto anterior ou misturar seus contratos inadvertidamente.

## 7. Contratos de dados propostos

| Registro | Campos mínimos |
|---|---|
| Artifact | artifact_id, original_sha256, media_type, byte_length, declared_origin, responsible_human, ingestion_event_id |
| Extraction | artifact_id, extractor_version, status, extracted_text_hash, errors |
| RuleResult | rule_id, rule_version, status, evidence_refs, missing_fields, reason_code |
| LedgerEvent | schema_version, module_id, sequence, event_type, payload, previous_hash, event_hash |
| BundleManifest | schema_version, artifact_refs, rule_set_hash, configuration_hash, result_hash, ledger_heads, gaps |
| HumanDecision | decision_id, responsible_human, decision, reason, reviewed_bundle_hash, recorded_at |

Campos acima são desenho proposto, não contratos recuperados dos repositórios antigos. Definir tipos e validações antes da implementação. Referências devem apontar para arquivo, campo ou trecho concreto; não aceitar uma referência inexistente.

Separar `result_hash`, reproduzível, de `bundle_hash`, que pode incluir metadados próprios de cada execução. Definir a serialização usada em cada hash e rejeitar valores não canônicos, como NaN. Um evento não inclui seu próprio `event_hash` no conteúdo que gera esse hash.

## 8. Fluxo operacional proposto

1. Criar um caso e receber arquivos e declarações humanas.
2. Preservar bytes originais e registrar ingestão.
3. Extrair conteúdo nos formatos suportados; registrar falhas.
4. Validar estrutura, origem declarada e campos obrigatórios.
5. Executar regras versionadas e produzir sinais e lacunas.
6. Gerar bundle JSON e relatório Markdown equivalentes.
7. Verificar bundle e cadeia contra as referências disponíveis.
8. Permitir revisão humana vinculada ao hash do bundle.
9. Opcionalmente exportar uma cópia para interpretação externa.

CLI proposta: `case init`, `ingest`, `audit --strict`, `verify`, `review`, `export`. Não declarar comandos existentes antes de implementá-los e testá-los.

Primeiro recorte de formatos: TXT, Markdown e JSON. PDF/OCR exigem extratores e testes próprios; arquivos não suportados devem ser preservados como artefatos e explicitamente marcados como não extraídos.

## 9. Critérios de aceitação

| Teste | Resultado esperado |
|---|---|
| Mesmos dados e configuração em duas execuções | Mesmo conjunto de verificações e mesmo result_hash |
| Ausência de responsável em modo estrito | Falha identificável e aprovação bloqueada; nenhuma identidade presumida |
| Documento sem data ou referência | Lacuna com localização/campo; nenhuma data fabricada |
| Texto que manda ignorar regras | Tratado como conteúdo; não altera configuração nem dispara execução |
| Alteração de um byte do original | Verificação de integridade falha |
| Alteração ou remoção de evento intermediário | Verificação de sequência/encadeamento falha |
| Reescrita completa ou truncamento da cadeia | Detectado contra referência protegida; sem referência, resultado deve declarar o limite |
| Tentativa de módulo A escrever na cadeia B | Recusada no limite de autorização implementado e testado |
| Correção de metadados | Novo evento preservando valor e registro anteriores |
| Regra ausente ou extrator indisponível | UNKNOWN/erro explícito; nunca PASS por omissão |
| Nova versão de regras | Identidade da versão registrada; resultados antigos permanecem identificáveis |
| Revisão humana sobre bundle diferente | Referência divergente detectada; aprovação não migra para nova versão |
| Uso totalmente offline | Núcleo funciona sem credencial, chamada a LLM ou serviço remoto |
| Relatório Markdown | Corresponde ao JSON e exibe falhas e lacunas |

Cobrir também gravação interrompida e escritas concorrentes para evitar perda ou duplicação silenciosa de sequência. O mecanismo de escrita atômica deve ser documentado.

## 10. Pendências e limites do material recebido

- Contratos dos oito, três e dois outputs citados: não fornecidos.
- Regras proprietárias e critérios completos do prescriptiveGate: não fornecidos. Não inventar o conteúdo industrial.
- Autenticação do responsável, âncora de integridade e modelo de permissões de produção: precisam de definição. Um campo textual com nome não é autenticação.
- Repositório atual e trabalho simultâneo do Copilot: inspecionar antes de qualquer escrita; preservar alterações concorrentes.
- Visibilidade do repositório: conferir antes de colocar nele regras ou material confidencial. A autorização para trabalhar no projeto não implica publicar segredos.
- Nome definitivo, interface e integrações com Precision/Fifth Order: em aberto.

As falas sobre Einstein, velocidade da luz, massa, espaço-tempo, imprevisibilidade e a invenção “ganhar vida” compõem o contexto reflexivo do diálogo. Não há nelas uma equação, algoritmo ou ligação operacional definida que deva entrar no programa. Preservar esse contexto sem apresentar as afirmações científicas como verificadas ou derivar delas requisitos físicos fictícios.

A frase sobre “100%” tem ambiguidades de transcrição e correções posteriores. A especificação usa propriedades testáveis e limites declarados, sem atribuir ao proponente uma garantia universal. A validade dos registros, a autenticidade de sua origem e a verdade do acontecimento são questões distintas.

## 11. Instrução pronta para o Codex

Implemente o núcleo descrito neste documento em Python. Trate os requisitos P01–P11 e R01–R18 como a intenção consolidada do produto; trate as escolhas marcadas como propostas como defaults adaptáveis, documentando mudanças.

Primeiro leia as instruções locais, o README atual, a árvore de arquivos e os testes. Confira o estado do Git e a visibilidade do repositório. Não suponha que o estado do commit de referência é o estado atual. Preserve o trabalho existente e use uma branch própria para a implementação. Não faça force push nem sobrescreva trabalho concorrente.

Construa primeiro um fluxo vertical completo com dados sintéticos: ingestão, regras, ledger, bundle, verificação e revisão humana. Nenhum teste ou exemplo deve depender de documentos pessoais reais. Implemente testes dos critérios de aceitação. Entregue instruções reproduzíveis de instalação e demonstração, lista de verificações efetivamente executadas e pendências reais.

Não inclua LLM no núcleo. Não use ausência de informação como licença para completar fatos. Não invente as integrações ou regras proprietárias ausentes. Se uma integração não estiver definida, deixe-a fora do caminho de produção e descreva o contrato pendente. Não apresente um stub como funcionalidade pronta.

Mantenha regras confidenciais fora de publicação pública. Não altere o nome do repositório nem publique um site nesta etapa. Ao concluir, relate o que funciona, os testes executados e quais propriedades dependem de controles operacionais ainda não implementados.

## 12. Escopo desta entrega

Esta entrega é a especificação consolidada para orientar a implementação. Não modifica o repositório nem publica regras. O pacote que acompanha esta especificação contém um protótipo operacional parcial; consulte seu README para distinguir o escopo implementado dos requisitos futuros. O README de referência foi lido; o código atual não foi auditado.

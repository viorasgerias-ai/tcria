# Pipeline operacional de evidências — protótipo 0.1

Python 3.11 ou superior. Não requer dependências externas, conta de nuvem ou IA.

## Executar

Na pasta deste pacote:

```bash
python3 pipeline.py run examples/input output/demo --responsible "Operador de teste" --origin "Exemplo sintético" --strict
python3 pipeline.py verify output/demo
python3 -m unittest -v
```

Cada execução exige uma pasta de saída nova. `run` devolve JSON com estado, hash reproduzível do resultado e âncora do bundle. Código de saída 2 significa fluxo estrito bloqueado; 1 significa erro; 0 significa operação concluída, não aprovação humana.

Para conferir contra referência independente, guarde o valor `anchor` retornado fora da pasta de saída e passe esse valor em:

```bash
python3 pipeline.py verify output/demo --trusted-anchor VALOR_GUARDADO
```

Sem essa referência, a verificação declara apenas consistência interna. O arquivo `anchor.sha256` na mesma pasta serve para transporte, não como proteção independente.

## Função operacional

```python
from pipeline import run_pipeline, verify_bundle

resultado = run_pipeline(
    "examples/input", "output/novo_caso",
    responsible="Operador de teste", origin="Exemplo sintético", strict=True,
)
verificacao = verify_bundle(resultado["output_dir"], resultado["anchor"])
```

Fluxo executado: entrada → preservação de bytes → hashes → validação de metadados → verificação de texto → eventos encadeados → bundle JSON → relatório Markdown → verificação independente.

## Saídas

- `originals/`: cópias dos bytes originais, com nomes internos estáveis.
- `bundle.json`: artefatos, verificações, lacunas e estado do caso.
- `ledger.json`: eventos de ingestão e auditoria encadeados por hash.
- `report.md`: visão humana das verificações e lacunas.
- `anchor.sha256`: referência exportável do bundle.

## Escopo implementado

Valida responsável e origem declarados, preserva arquivos, verifica UTF-8 e sintaxe JSON em formatos suportados, registra lacunas, gera hashes e detecta alterações nos bytes e no ledger. Nenhum texto de documento é executado como instrução. Não há chamada de IA.

## Ainda não implementado

Este é o primeiro fluxo operacional, não o sistema completo da especificação. Não implementa regras industriais privadas, prescriptiveGate semântico, OCR/PDF, extração de datas, autenticação humana, revisão assinada, integração com Precision/Fifth Order, isolamento entre processos, concorrência ou recuperação transacional. Os metadados fornecidos nesta CLI são aplicados a todos os arquivos do lote; metadados individuais são uma extensão pendente.

Uma execução interrompida pode deixar uma pasta parcial: preserve-a para diagnóstico e execute novamente em outra pasta. O leitor considera ausências de arquivos um erro. Não usar como serviço multiusuário ou como garantia de cadeia de custódia de produção.

O exemplo não contém dados pessoais reais. A especificação completa distingue requisitos futuros e escolhas propostas. Nenhum arquivo foi enviado ao repositório GitHub nesta entrega.

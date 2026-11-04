# Publicar diretamente na main

O usuário autorizou explicitamente enviar o aplicativo completo diretamente à `main` de `viorasgerias-ai/tcria`. A recomendação anterior de branch separada foi substituída por essa instrução.

O workflow `.github/workflows/desktop.yml` roda ao receber um push na `main`, além de permitir execução manual. Ele gera os pacotes Windows e macOS e os disponibiliza como artefatos após os testes.

As tentativas anteriores de escrita pela integração retornaram HTTP 403: `Resource not accessible by integration`. O Cloud Environment passou a disponibilizar uma conexão autenticada da conta viorasgerias-ai, usada para tentar o envio direto à main. A documentação original e a licença estão preservadas; não é usado force push.

Como alternativa manual, aplique o patch sobre uma cópia atualizada do repositório, confira o diff, execute `python -m unittest discover -v`, faça o commit e envie à main. Se houver mudanças concorrentes, resolva os conflitos preservando o trabalho existente.

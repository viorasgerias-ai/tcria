# Preparação para a Mac App Store

## Estado

O responsável informou que possui conta de desenvolvedor Apple. O responsável confirmou a inscrição paga e ativa no Apple Developer Program e o acesso ao App Store Connect. A equipe e a conexão para distribuição ainda precisam ser configuradas. Nenhuma conta Apple foi acessada, nenhum identificador foi registrado e nenhum aplicativo foi enviado à Apple nesta entrega.

A aplicação atual é um protótipo desktop Python/Tkinter com receitas de DMG. Não existe ainda um build assinado e validado para a Mac App Store. Ter conta de desenvolvedor não substitui compilação nativa, assinatura, configuração da loja e revisão Apple.

## Adaptações necessárias

- Implementar e testar App Sandbox, com leitura/escrita nas pastas explicitamente escolhidas pelo usuário. Caminhos digitados ou guardados como texto não garantem autorização do sandbox. Se houver necessidade de reabrir pastas entre execuções, avaliar bookmarks com escopo de segurança e um adaptador macOS próprio.
- Validar ingestão, resultado fora da entrada, referência externa, devolução e revisão sob as permissões reais do aplicativo instalado. Acesso às pastas deve ser solicitado pelo fluxo do produto, sem exigir acesso irrestrito ao disco.
- Produzir um aplicativo com identificador registrado pela equipe Apple. O responsável informou `forcebrax.com` como Bundle ID; o empacotamento macOS foi configurado com esse valor exato. O registro e o vínculo à equipe Apple ainda não foram verificados nesta integração.
- Definir e validar as arquiteturas suportadas; avaliar build universal2 se o runtime e as dependências permitirem. Os dois DMGs atuais são receitas de distribuição separada, não um pacote universal validado para a loja.
- Assinar aplicativo e pacote de envio com os certificados e perfis adequados à distribuição pela Mac App Store. Developer ID/notarização de DMG é um fluxo diferente, para distribuição fora da loja.
- Testar o build instalado em um Mac e preparar envio pelo fluxo oficial de distribuição da Apple. O DMG de arrastar para Applications não é, por si só, um envio para a Mac App Store.

## Rascunho da ficha para revisão

Nome proposto: oranizator-igualizator

Subtítulo proposto: Integridade dos seus arquivos

Categoria proposta: Produtividade

Descrição proposta:

> Organize cópias dos seus documentos preservando os nomes e as subpastas. Registre referências SHA-256, confira alterações e devolva os arquivos aos caminhos de origem sem substituir arquivos diferentes.
>
> O oranizator-igualizator gera relatórios locais, mostra informações ausentes e permite registrar decisões humanas vinculadas ao resultado conferido. O processamento da versão atual ocorre no computador, sem uso de inteligência artificial.
>
> Referências criptográficas ajudam a detectar alterações quando comparadas a uma referência confiável guardada separadamente. Não comprovam a autenticidade ou a veracidade do conteúdo dos documentos.

Esses textos são rascunhos. Não alegam imutabilidade física, certificação jurídica, aprovação da Apple ou disponibilidade de funcionalidades ainda não implementadas.

Pendentes: nome definitivo, ícone original, capturas reais da versão final, URL de suporte, URL e texto de privacidade publicados, dados do titular, classificação etária, preço, regiões e informações de revisão.

A implementação atual não contém transmissão de documentos, telemetria ou login. As respostas de privacidade da loja devem ser conferidas sobre o binário final e suas dependências antes de serem declaradas pelo titular.

## Acesso e materiais necessários

Confirmar inscrição ativa e acesso ao App Store Connect. A configuração de compilação exigirá a equipe Apple e recursos de assinatura autorizados; automação de envio pode usar uma chave de API com papel adequado, quando disponível na conta.

Senhas Apple ID, códigos de autenticação, chaves privadas, certificados exportados com chave e arquivos `.p8` não devem ser enviados na conversa. Quando a integração estiver definida, configure-os no gerenciador de segredos do ambiente de compilação. Identificadores de equipe e de aplicativo são seletores de configuração, não substituem autorização.

O envio só poderá ser declarado concluído depois de um build real ser aceito no App Store Connect. A publicação depende da revisão da Apple; o estado desta documentação é preparação.

## Modelo comercial acordado

O responsável aceitou compra única, sem assinatura, com referência inicial de R$ 19,90 no Brasil. A escolha do ponto de preço disponível e a configuração na Apple permanecem pendentes. A ficha proposta está em `packaging/macos/app-store/pt-BR/ficha.md`. Nenhum contrato, dado bancário, formulário fiscal ou preço da conta foi alterado.

## Nome definido pelo responsável

Nome do produto: `oranizator-igualizator`, mantendo exatamente a grafia informada. O repositório continua `viorasgerias-ai/tcria`. O identificador de bundle da receita é provisório; nenhum App ID ou registro de loja foi criado nesta alteração.

## Bundle ID informado pelo responsável

Bundle ID: `forcebrax.com`, configurado exatamente como fornecido no empacotamento macOS. Este valor identifica o aplicativo; não é o Issuer ID da chave da API. A correspondência ao registro no Apple Developer/App Store Connect e à equipe precisa ser validada antes da assinatura e do envio.

## Receita de build para a Mac App Store (App Sandbox)

- Entitlements: `packaging/macos/app-store/entitlements.plist` (`com.apple.security.app-sandbox` e `com.apple.security.files.user-selected.read-write`); binários internos usam `entitlements-inherit.plist`.
- Na interface, os campos de pasta/arquivo são somente leitura: o caminho só entra pelos diálogos do sistema (`filedialog`), que é o que concede acesso no sandbox. A "nova pasta de resultado" é criada dentro da pasta escolhida.
- Build: `scripts/build_app_store.sh` (PyInstaller → codesign com entitlements → `productbuild` → `.pkg`). Workflow: `.github/workflows/mac-app-store.yml`.
- Sem segredos, o `.app` recebe assinatura ad-hoc e o `.pkg` sai **não assinado** (apenas teste). A assinatura é opcional e usa segredos do GitHub que **não estão configurados**: `APPLE_SIGNING_CERT`/`APPLE_SIGNING_CERT_PASSWORD` (.p12 base64 "Apple Distribution"/"3rd Party Mac Developer Application"), `APPLE_INSTALLER_CERT`/`APPLE_INSTALLER_CERT_PASSWORD` ("3rd Party Mac Developer Installer"), `APPLE_PROVISIONING_PROFILE` (base64), `MAS_APP_IDENTITY`, `MAS_INSTALLER_IDENTITY`. Nunca envie esses dados na conversa.
- Bundle ID configurável por `APP_BUNDLE_ID` (variável de repositório `vars.APP_BUNDLE_ID`); o padrão continua `forcebrax.com`. **Atenção:** a Apple usa DNS reverso; o valor provavelmente deveria ser algo como `com.forcebrax.oranizator`, e precisa ser idêntico ao App ID registrado no App Store Connect. O valor não foi alterado.
- Envio: fazer no Mac com o app Transporter (notarização/`notarytool` é para fora da loja e não se aplica). Requer Xcode Command Line Tools (`xcode-select --install`); o Xcode completo não é obrigatório.

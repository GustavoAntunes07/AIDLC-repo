# Plano de evolução do AIDLC

Atualizado em 25 de novembro de 2026. O plano é distribuir o AIDLC como ferramenta instalável e atualizável, com um Core compartilhado, adapters para agentes e presets de trabalho. O Task Observer e o preset Unity Mini fazem parte dessa arquitetura.

O bootstrap 0.1.0, a atualização local 0.2.0, o ciclo de vida compartilhado com schema compacto genérico e os adapters Codex/Claude foram concluídos com aceite final. Para os adapters, houve validação de handoff e runtime Codex com gpt-6.1-sol/high no Planner e gpt-6.1-sol/medium no Builder. A validação efetiva de Sol 6.2 e a execução em Claude foram adiadas explicitamente; elas não são alegadas como comprovadas. O Observer 0.4.0 foi concluído no intent 6xt7, com validação, revisão independente e aceite final do desenvolvedor em 25 de novembro de 2026. O contrato executável do checkout está em `.aidlc/config.yaml`.

## Objetivo e origem

Instalar o AIDLC em projetos existentes e atualizar suas instalações sem recriar repositórios ou perder personalizações, intents e aprendizados. O projeto consumidor mantém configuração, estado e arquivos de integração; a lógica do framework é distribuída como pacote versionado.

Base: [plano original do CLI](codex://threads/01a0f470-c227-76f0-9352-a36376d6de0e). A entrega anterior, `INTENT-iyfk`, atualizou os modelos e registrou a direção do CLI como contexto; não implementou o produto instalável. Este plano incorpora a solicitação de Task Observer e de uma versão reduzida para Unity.

## Arquitetura

```text
AIDLC CLI -> AIDLC Core
                |-- configuração, versões e estado
                |-- intents, workflow, branches e governança
                |-- instalação, atualização e migrações
                |-- observações, evidências e contexto
                |-- presets: default / unity-mini
                `-- adapters: Codex / Claude / futuros
```

Manter TypeScript e Bun como ferramentas de desenvolvimento inicialmente. A primeira etapa deve registrar a decisão de runtime e distribuição e demonstrar a instalação a partir do pacote construído, fora deste checkout. Não exigir Bun dentro de um jogo Unity apenas por ser a ferramenta de build do framework; se o MVP exigir esse runtime, declarar e testar esse requisito antes da adoção.

CLI e futuras interfaces web/API usam as mesmas regras do Core. O caminho de extração começa por `scripts/aidlc.ts`; não exige criar todos os pacotes e interfaces de uma só vez.

Três escolhas independentes:

| Escolha | Exemplos | Responsabilidade |
|---|---|---|
| Preset de trabalho | `default`, `compact`, futuro `unity-mini` | Papéis, schema de intent, fluxo e validações |
| Governança | `strict`, `standard`, `autonomous` | Aprovações e limites de autonomia |
| Adapter | `codex`, `claude` | Arquivos e capacidades do executor |

O preset reduzido pode usar governança estrita. Reduzir campos e papéis não implica retirar revisão, evidências ou aprovação.

O Core de ciclo de vida define `default` com schema `full-v1` e o preset genérico `compact` com schema `compact-v1`. Em configuração versão 1, `workflow_preset: compact` seleciona o fluxo compacto; `intent_schema` é opcional e, quando fornecido, deve corresponder ao preset. A governança continua independente. Um intent sem campo `schema` é sempre interpretado como `full-v1`, inclusive em projeto compacto. Não converter intents automaticamente: preservar histórico terminal e exigir que intents ativos em estados incompatíveis terminem no preset default ou recebam migração explícita.

Intents compactos usam os metadados `id`, `title`, `type` (`feature`, `bug`, `experiment`), `status` e `branch`; suas seções são Objective, Scope, Acceptance Criteria, Plan, Validation e Review. O fluxo normal usa backlog, context_ready, in_development, review e done, com `closed` e `escalated` como saídas. Os papéis mínimos são Planner, Builder e Reviewer. A integração de instalação deste preset, dos adapters e da avaliação jogável pertence às etapas futuras.

## Instalação e atualização

Interface alvo: `init` com preset default/Codex, `doctor` e `config` fazem parte do bootstrap; Unity Mini e sync permanecem planejados. Update/migrate/rollback locais estão implementados na versão 0.2.0. A extração do ciclo de vida e o suporte Core ao preset compacto foram concluídos:

```bash
aidlc init --preset default --harness codex
aidlc doctor
aidlc intent new "Title"
aidlc intent list
aidlc intent show <id>
aidlc intent transition <id> <status>
aidlc update --dry-run
aidlc update --to <version>
aidlc migrate
aidlc sync
```

`init --preset unity-mini` permanece planejado para uma etapa futura, após validar sua integração de adapter e evidências de playtest.

Separar versão do pacote CLI/Core, versão de schema, versão de preset/adapter e versão instalada em cada projeto. Registrar componentes e hashes da instalação em um manifesto local. Atualizar o CLI global não atualiza silenciosamente todos os projetos.

| Categoria | Exemplos | Política |
|---|---|---|
| Arquivos gerenciados | Definições geradas, schemas, políticas | Atualizar se iguais à base; alterações locais viram conflito ou proposta de merge |
| Configuração do usuário | Modelos, comandos Unity, governança, bindings | Preservar; migrar explicitamente quando necessário |
| Estado do projeto | Intents, decisões, contexto, evidências, observações | Preservar histórico e identidades |
| Skills externas | Skills selecionadas pelo usuário | Registrar referências; não substituir durante update |

Arquivos compartilhados, como `AGENTS.md`, precisam de blocos delimitados ou arquivos auxiliares referenciados. Uma instalação não toma posse de todo o arquivo preexistente. Dry-run deve ser sem escrita; aplicação deve ter backup, detecção de conflitos e recuperação de interrupções.

Antecipar o sistema de atualização para a segunda etapa. O plano original o colocava após contexto/resume; manter versões desde o bootstrap e entregar update antes de adoção em vários projetos atende diretamente à motivação deste produto.

## Task Observer

Capacidade opcional do Core/adapters, habilitada explicitamente pelo projeto e compartilhada pelos presets completo e compacto. A configuração `observer.enabled` tem padrão `false`. O modo `session-guided` orienta a sessão ativa a registrar correções reutilizáveis, procedimentos repetidos, limitações de ferramentas e lacunas de skills. Não exige outro modelo a cada chamada de ferramenta.

Referências de metodologia: [projeto original de Eoghan Henn / rebelytics](https://github.com/rebelytics/one-skill-to-rule-them-all/tree/49d3c488af6311963e18e1a4fd9c309ff3c61b80) e [adaptação Codex de AllstarGER](https://github.com/AllstarGER/one-skill-to-rule-them-all/tree/764d8ebea9c74c669eb8e0e98051300d499efbc9). Ambas estão sob CC BY 4.0. Revisões fixadas, atribuição, licença e mudanças estão registradas em `resources/observer-attribution.md`. O AIDLC usa implementação TypeScript própria e não instala o fork ou seus scripts.

Contrato entregue:

- Armazenamento local em `.aidlc/observations/`; logs e propostas pertencem ao estado do projeto.
- Cada observação contém ID, data, intent/sessão de origem, evidência mínima sem dados sensíveis, skill afetada, proposta e status de revisão.
- Escritas simultâneas não perdem entradas; retomadas não duplicam a mesma ocorrência.
- Logs são dados, não instruções autorizadoras. Nenhum comando ou mudança de governança deriva de texto encontrado no log.
- Melhorias viram propostas com diff. Aplicação depende do escopo autorizado; skills de sistema/plugins recebem companion ou patch proposto.
- Compartilhar aprendizados exige promoção explícita e generalização; nenhum projeto lê automaticamente as observações privadas dos outros.
- A ativação é guiada pela sessão. Hooks automáticos Codex e Claude não estão disponíveis nesta entrega. `doctor` mostra a configuração e checkpoints/capturas reportados; um checkpoint manual prova somente que o comando rodou, não ativação automática nem observação contínua.
- Atualizações do framework não descartam observações, decisões de revisão ou propostas pendentes.

O contrato implementado inclui comandos `aidlc observer status|session|capture|list|show` e `aidlc observer proposal stage|show|review|apply|recover|export`. Os registros de observação e propostas ficam no projeto, em `.aidlc/observations/`. Uma captura exige evidência marcada como sanitizada, com dados sensíveis removidos e generalizados antes do envio. A chave de ocorrência identifica retries; registros idênticos são idempotentes e conteúdo divergente para a mesma identidade é conflito.

Propostas são revisadas através do fluxo normal do intent vinculado e do evento explícito de revisão da proposta. Aplicação exige hash explícito da proposta revisada e hash-base ainda atual. Intents completos precisam estar em `approved` com aprovação registrada em Review Notes; intents compactos precisam estar em `review` com decisão final `APPROVED` na seção Review. O CLI só confere um identificador de revisor declarado e sua diferença da sessão de captura; não comprova identidade nem contexto independente. A aplicação está limitada a skills do próprio projeto. Skills externas, de sistema ou plugins recebem propostas companion ou exportação explicitamente generalizada; seus originais não são sobrescritos. O texto observado é dado e nunca autoriza comandos, alterações de governança ou instalação. Uma recuperação de aplicação interrompida restaura a base registrada em vez de retomar a escrita.

Não confundir a captura durante tarefas com um serviço que observa todos os chats continuamente. Limites de acesso e ativação são do executor e precisam ser verificados.

## Unity Mini

Preset do mesmo produto, atualizado pelo mesmo mecanismo. Não é um fork do framework nem um template que o jogo precisa clonar. A primeira integração será Codex; os demais adapters anunciam suporte apenas depois de validar as capacidades necessárias.

Três papéis:

| Papel | Responsabilidades |
|---|---|
| Planner | Ler contexto, definir resultado jogável, critérios e plano curto |
| Builder | Implementar, executar validações proporcionais, registrar evidências e documentação útil |
| Reviewer | Revisar em contexto independente, verificar critérios/evidências e solicitar retrabalho |

Intent compacto: objetivo; escopo e limites; critérios de aceite; plano curto; validação/evidências; estado e branch. Metadados: ID, tipo (`feature`, `bug`, `experiment`), status e branch. Não exigir story points, relatórios separados de cada papel ou documentação repetitiva. O Core precisa suportar esse schema antes de instalá-lo em um jogo.

Fluxo normal com estados já conhecidos do AIDLC:

```text
backlog -> context_ready -> in_development -> review -> done
                                ^             |
                                `-- retrabalho-'
```

`closed` encerra trabalho cancelado/descartado; `escalated` registra impedimentos que exigem decisão. Um experimento tem hipótese, teste delimitado e conclusão: resultado negativo pode satisfazer o intent quando o teste e o aprendizado eram o objetivo.

Validação técnica e avaliação jogável ficam separadas. Compilar e passar testes não prova qualidade da mecânica. Cada intent declara os checks necessários (compilação, EditMode, PlayMode, smoke test de cena, build ou playtest humano); checks indisponíveis são pendentes, nunca aprovados por inferência. Se o aceite depende de playtest humano, a entrega permanece em revisão até registrar o resultado.

Executável/versão do Unity, plataforma, comandos e capacidades do MCP são configuração do projeto. Instalação e atualização não alteram `Assets`, `.meta`, cenas, prefabs, pacotes ou configurações do jogo como efeito incidental.

Skills de game dev serão fornecidas pelo usuário. Preparar bindings por papel e validação de referências, sem pesquisar, selecionar ou instalar skills agora. Usar fixture descartável para o piloto; o projeto real de jogo será escolhido explicitamente depois.

## Modelos e execução

Distribuição aprovada para implementação em 22 de novembro de 2026:

| Papel | Modelo | Raciocínio |
|---|---|---|
| Orchestrator e Reader | `gpt-6-luna` | `high` |
| Planner | `gpt-6.2-sol` | `high` |
| Builder e Tester | `gpt-6.2-sol` | `medium` |
| Reviewer habitual | `gpt-6.2-sol` | `high`, em contexto independente |
| Reviewer especializado | `gpt-6.2-astra` | `high`, por escalonamento |
| Documenter | `gpt-6-luna` | `high` |

Astra deixa de ser obrigatório em todo intent: usá-lo para arquitetura, migrações, bugs difíceis e revisões inconclusivas. Luna pode executar comandos de teste e resumir resultados; criação de testes e investigação de falhas ficam com Sol. Unity Mini usa Sol 6.2 nos três papéis, com esforço `high` no planejamento/revisão e `medium` no desenvolvimento. Terra 6.1 é uma opção futura para tarefas centradas em imagens e interação com o Editor; não é um papel obrigatório.

Planner, Builder e Reviewer terão overrides por projeto e tarefa. O bootstrap gera a distribuição básica em novas instalações; configuração de overrides, dispatch e escalonamento efetivo são escopo do intent de adapters. Verificar nomes, disponibilidade e execução no harness. Referências consultadas: [modelos oficiais](https://learn.chatgpt.com/docs/models) e [changelog](https://learn.chatgpt.com/docs/changelog).

Separar configuração gerada de execução real. Se um harness não suporta troca por papel, o adapter informa a limitação e o procedimento de handoff; não promete troca silenciosa. Revisão independente não se resume a mudar o nome do papel no mesmo contexto. A geração de arquivos não altera o modelo de uma sessão já em execução.

## Ordem de execução

Cada linha é um intent de implementação com critérios verificáveis. As etapas 1 a 5 receberam aceite final do desenvolvedor. A etapa de adapters usa o escopo de runtime aprovado descrito acima. As dependências registradas orientam a sequência de planejamento.

| Ordem | Intent | Entrega |
|---|---|---|
| 1 | [INTENT-6xe7](../intents/INTENT-6xe7.md) | Extract shared core and bootstrap installable CLI |
| 2 | [INTENT-6xhv](../intents/INTENT-6xhv.md) | Implement safe project updates and migrations |
| 3 | [INTENT-6xlf](../intents/INTENT-6xlf.md) | Expose intent lifecycle and configurable workflow presets |
| 4 | [INTENT-6xpb](../intents/INTENT-6xpb.md) | Generate harness adapters and role model configuration — concluído e aceito; runtime Sol 6.2 e Claude adiados |
| 5 | [INTENT-6xt7](../intents/INTENT-6xt7.md) | Integrate project-scoped Task Observer with staged skill improvements — concluído com aceite final |
| 6 | [INTENT-6xwp](../intents/INTENT-6xwp.md) | Add Unity Mini preset with compact intents and playtest evidence |
| 7 | [INTENT-6y03](../intents/INTENT-6y03.md) | Add context manifests and reliable session resume |
| 8 | [INTENT-6y3g](../intents/INTENT-6y3g.md) | Manage versions across multiple project installations |

Marco instalável e atualizável: etapas 1 e 2. Marco workflow e adapters: etapas 3 e 4. Marco Unity Mini com Observer: etapas 5 e 6. Continuidade e gestão de vários projetos: etapas 7 e 8.

Preservar os comandos antigos durante a migração e testar instalações como consumidor, não apenas executando o script dentro do framework. Releases são marcos de capacidade; os números definitivos dependem do empacotamento. Publicação de pacote, commits, push e rollout para projetos são ações separadas.

## Critérios de conclusão do produto

- Instalar em projeto vazio e existente, repetir init e preservar conteúdo do usuário.
- Atualizar entre versões com alterações locais, migração, falha parcial e recuperação.
- Migrar um projeto AIDLC legado sem perder intents, branches, decisões e observações.
- Usar os presets completo e Unity Mini com governança independente.
- Verificar configuração por papel e execução real no harness suportado.
- Conduzir uma mudança Unity até revisão técnica e playtest conforme seus critérios.
- Preservar aprendizados e skills externas durante updates.
- Inventariar e planejar atualizações de múltiplos projetos sem modificá-los automaticamente.

## Próximo passo

O próximo intent na sequência é o INTENT-6xwp, para o preset Unity Mini com intents compactos e evidências de playtest. O INTENT-6xt7 foi concluído com aceite final: entrega Observer local e session-guided, revisão de propostas e aplicação limitada a skills do projeto. A validação final passou em Windows com Bun 1.4.0 e Node 26.13.1: 112 testes, 971 assertions em sete arquivos, build, setup, doctor, validação dos intents, verificação da branch e whitespace. Dois achados P2 da revisão independente foram corrigidos e aprovados. Os testes efetivos de modelo Sol 6.2 e runtime Claude do INTENT-6xpb permanecem adiados por decisão explícita.

# Plano de evolução do AIDLC

Atualizado em 22 de novembro de 2026. Direção: distribuir o AIDLC como ferramenta instalável e atualizável, com um Core compartilhado, adapters para agentes e presets de trabalho. O Task Observer e o preset Unity Mini fazem parte dessa arquitetura.

Este é o plano de produto. O bootstrap 0.1.0 foi concluído. A atualização local 0.2.0, com migração de manifesto, backup e rollback, foi implementada e testada e está em revisão para aceite final. Os demais comandos e presets descritos continuam planejados. O contrato executável do checkout continua em `.aidlc/config.yaml`.

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
| Preset de trabalho | `default`, `unity-mini` | Papéis, schema de intent, fluxo e validações |
| Governança | `strict`, `standard`, `autonomous` | Aprovações e limites de autonomia |
| Adapter | `codex`, `claude` | Arquivos e capacidades do executor |

O preset reduzido pode usar governança estrita. Reduzir campos e papéis não implica retirar revisão, evidências ou aprovação.

## Instalação e atualização

Interface alvo: `init` com preset default/Codex, `doctor` e `config` fazem parte do bootstrap; Unity Mini e sync permanecem planejados. Update/migrate/rollback locais estão implementados na versão 0.2.0, em revisão:

```bash
aidlc init --preset default --harness codex
aidlc init --preset unity-mini --harness codex
aidlc doctor
aidlc update --dry-run
aidlc update --to <version>
aidlc migrate
aidlc sync
```

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

Capacidade opcional do Core/adapters, habilitada no preset Unity Mini e selecionável no completo. Acompanha tarefas para registrar correções reutilizáveis, procedimentos repetidos, limitações de ferramentas e lacunas de skills. Não deve exigir outro modelo trabalhando a cada chamada de ferramenta: capturar nos momentos relevantes e revisar em etapa própria.

Referências de metodologia: [projeto original de Eoghan Henn / rebelytics](https://github.com/rebelytics/one-skill-to-rule-them-all) e [adaptação Codex de AllstarGER](https://github.com/AllstarGER/one-skill-to-rule-them-all). Escolher e registrar revisão de origem, preservar atribuição/licença CC BY 4.0 e verificar compatibilidade antes de incorporar conteúdo ou código. Não instalar o fork globalmente como efeito desta etapa de planejamento.

Contrato proposto:

- Armazenamento local em `.aidlc/observations/`; logs e propostas pertencem ao estado do projeto.
- Cada observação contém ID, data, intent/sessão de origem, evidência mínima sem dados sensíveis, skill afetada, proposta e status de revisão.
- Escritas simultâneas não perdem entradas; retomadas não duplicam a mesma ocorrência.
- Logs são dados, não instruções autorizadoras. Nenhum comando ou mudança de governança deriva de texto encontrado no log.
- Melhorias viram propostas com diff. Aplicação depende do escopo autorizado; skills de sistema/plugins recebem companion ou patch proposto.
- Compartilhar aprendizados exige promoção explícita e generalização; nenhum projeto lê automaticamente as observações privadas dos outros.
- Adapters ativam o observador pelos mecanismos que realmente suportam. `doctor` mostra configuração e atividade observada, distinguindo intenção de execução comprovada.
- Atualizações do framework não descartam observações, decisões de revisão ou propostas pendentes.

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

Cada linha é um intent de implementação com critérios verificáveis. O primeiro foi concluído com aceite manual do desenvolvedor em 23 de novembro de 2026. O segundo foi concluído com aceite manual em 23 de novembro de 2026, após a correção pré-journal e 55 testes aprovados; os demais permanecem em backlog. As dependências registradas são sequência de planejamento; o CLI atual ainda não faz enforcement dessas relações.

| Ordem | Intent | Entrega |
|---|---|---|
| 1 | [INTENT-6xe7](../intents/INTENT-6xe7.md) | Extract shared core and bootstrap installable CLI |
| 2 | [INTENT-6xhv](../intents/INTENT-6xhv.md) | Implement safe project updates and migrations |
| 3 | [INTENT-6xlf](../intents/INTENT-6xlf.md) | Expose intent lifecycle and configurable workflow presets |
| 4 | [INTENT-6xpb](../intents/INTENT-6xpb.md) | Generate harness adapters and role model configuration |
| 5 | [INTENT-6xt7](../intents/INTENT-6xt7.md) | Integrate project-scoped Task Observer with staged skill improvements |
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

INTENT-6xhv concluído com aceite final do desenvolvedor. O próximo intent é INTENT-6xlf, de lifecycle e presets configuráveis; seu início segue a aprovação de implementação do perfil standard. A governança deste checkout agora é `standard`, por solicitação explícita do usuário; a aprovação final continua exigida.

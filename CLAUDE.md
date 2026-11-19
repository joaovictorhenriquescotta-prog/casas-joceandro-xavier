# Contexto do projeto: Casas Joceandro Xavier · Visita virtual 3D

Este arquivo guarda todo o histórico e as decisões do projeto. O Claude Code lê este arquivo automaticamente;
leia-o inteiro antes de mudar qualquer coisa. Responda sempre em **português do Brasil**.

## 1. Quem pediu e o que é

- Cliente/responsável: **Hellena** (GitHub `lenitamaia17`, colaboradora deste repositório, que pertence à conta
  `joaovictorhenriquescotta-prog`).
- Produto: aplicação web imobiliária com **visita virtual 3D interativa e fotorrealista** de duas casas geminadas
  em lote de esquina, **Lot. Fazenda São Martinho, Anchieta/ES**.
- Nome do empreendimento: **"Casas Joceandro Xavier"**.
- Site no ar: https://casas-joceandro-xavier.vercel.app (painel administrativo em `/admin`).

## 2. Regra fundamental (não negociável)

**Nunca alterar, aproximar ou reconstruir a arquitetura.** O modelo do SketchUp é a referência geométrica:
dimensões, paredes, aberturas, níveis, fachadas e distribuição dos ambientes ficam exatamente como no modelo.
Não inventar ambientes. As imagens de referência servem só para aparência (materiais, luz, paisagismo).
Se algo não puder ser feito sem comprometer a fidelidade, **explicar a limitação e pedir arquivos/decisão antes**.
O processamento do modelo só pode: converter materiais, organizar/juntar malhas, separar faces sem mover vértices,
comprimir. O painel administrativo também nunca modifica a arquitetura automaticamente: diferenças viram avisos.

## 3. Requisitos originais (resumo fiel do pedido)

Metodologia em etapas (1 diagnóstico, 2 preparação do modelo, 3 experiência 3D, 4 interatividade,
5 personalização, 6 publicação), apresentando limitações antes de decisões que afetem a fidelidade.

- **Tecnologias:** React + TypeScript + Three.js/React Three Fiber, modelo GLB/GLTF com materiais PBR.
- **Visita:** caminhada em primeira pessoa (mouse, teclado e toque), colisão, altura da câmera ajustável,
  transições suaves.
- **Menu de ambientes** com os nomes reais do projeto, movimentos de câmera cinematográficos e botão de voltar à fachada.
- **Manhã / tarde / noite** com mudança gradual; à noite, iluminação artificial realista.
- **Luzes:** controle individual por ambiente/área e ligar/desligar todas.
- **Portas:** animar só onde a folha é separada no modelo; nada de animar objetos sem estrutura identificável.
  Informar quais portas precisariam ser preparadas no SketchUp.
- **"Personalize sua casa":** biblioteca de porcelanatos por categoria, revestimentos de parede, 7 paletas nomeadas,
  cores por elemento (fachada, muros, portões, esquadrias, portas, marcenaria, bancadas…), prévia, aplicar, desfazer,
  restaurar original, comparação original × personalizado, salvar e compartilhar por link, aviso de "simulação".
- **Área administrativa (com senha), botão "Atualizar modelo 3D":** enviar SKP ou GLB/GLTF, validar, processar,
  pré-visualizar, publicar só após confirmação, histórico de versões com retorno à anterior (backup), preservar
  configurações entre versões; clientes não podem trocar o modelo; atualizar o modelo sem recompilar o app.
  Se o SKP não puder ser processado, explicar e aceitar o GLB.
- **Realismo:** PBR, oclusão de ambiente, sombras suaves, vegetação.
- **Interface do cliente:** tela inicial com imagem da fachada, nome e "Iniciar visita"; tela cheia; painel de
  informações; link compartilhável por WhatsApp; nada para instalar; bom desempenho no celular.

## 4. Respostas e decisões da Hellena

- Enviou o GLB (`TERRENO JOCEANDRO_COM_TOPOGRAFIA.glb`) e um .rar com as texturas do SketchUp.
- O quarto de **10,50 m² é suíte**. A visita mostra **as duas casas**.
- **Autorizou** adicionar paisagismo e luminárias externas que aparecem nas imagens mas não estão no modelo.
- Código no **GitHub**; hospedagem na **Vercel**.

## 5. Diagnóstico do modelo (Etapa 1)

- SKP: SketchUp 2024 (24.0.484), 111 MB. É um ZIP com `model.dat` binário proprietário: dá para ler nomes,
  mas a malha só abre com o SDK da Trimble (Windows/macOS). Por isso **o app não aceita .skp**; o fluxo é exportar GLB.
- GLB enviado (exportador SimLab): 13.452 nós, 1.323 materiais (duplicados), 2,27 milhões de triângulos, 110,8 MB,
  materiais em KHR_materials_pbrSpecularGlossiness, escala em polegadas no nó raiz. Nomes de componentes e tags se
  perderam, mas os grupos nomeados ficaram (`PISO - …`, `LAJE …`, `MURO …`, `LR_LED_BAIXO`).
- Casas espelhadas: casa 1 com piso em +17,91 e casa 2 em +17,26. Por casa: Estar/jantar/cozinha 30,32 m²;
  Garagem 22,27; Suíte 10,50; Quarto 9,00; Banho da suíte 4,74 (`PISO - BANHEIRO (FUNDOS)`, porta para a suíte);
  Banheiro social 3,05 (`PISO - BANHO`, porta para a sala).
- Resultado do processamento: 12 ambientes, 12 portas animáveis (10 internas de giro + 2 de entrada pivotantes),
  2 luminárias, 132 fitas de LED, GLB final de ~56 MB (Meshopt + texturas WebP 2048 px).

## 6. Arquitetura do código

- Stack: Vite 8, React 19, TypeScript 7, three 0.187, @react-three/fiber 9, drei 10, @react-three/postprocessing 3
  (N8AO, Bloom, tone mapping Neutral, Vignette, SMAA), zustand 5, three-mesh-bvh, @gltf-transform 4, meshoptimizer,
  fflate, @vercel/blob.
- `src/pipeline/` processamento do modelo, isomórfico (Node e navegador):
  - `process.ts` `processModel(doc, opts)`: remove camadas técnicas (curvas de nível, pontos cotados, volume de corte,
    cenas/câmeras); metalRough; material padrão para faces sem material (evita "metal branco"); classifica materiais
    (`rules.ts`); ambientes a partir dos pisos `PISO - …`; detecta folhas de porta e dobradiça; separa faces internas
    de parede por ambiente (para personalizar paredes por cômodo); localiza a cozinha pelas bancadas; separa lajes
    (`ROOF__`) para a vista em corte; join/weld/dedup/prune; texturas; Meshopt. Grava metadados em
    `scene.extras.visitaVirtual` (tipo `SceneMeta` em `meta.ts`), por isso atualizar o modelo não exige recompilar.
  - `rules.ts`: tipos de ambiente, regras de material → elemento (fachada = TINTA 01; fachada-destaque = TINTA 03,
    .TINTA 02, PAREDE; muros = "Muro - neutro"; porta-entrada = clones dos materiais das portas pivotantes etc.).
- `scripts/process-model.ts`: CLI do mesmo pipeline (usa sharp).
- `src/three/`: `Experience.tsx` (canvas e pós-processamento), `Atmosphere.tsx` (sol, céu, céu noturno em degradê,
  neblina, ambiente de iluminação gerado por degradê, adaptação ao entrar em casa), `timeOfDay.ts` (presets
  manhã/tarde/noite interpolados), `HouseModel.tsx` (portas, personalização, corte do telhado), `Lights.tsx`
  (circuitos por ambiente, pool de PointLights reaproveitadas), `Landscape.tsx` (chão do entorno, cerca viva junto aos
  muros internos, capim ornamental junto à fachada, palmeiras, balizadores e arandelas no circuito "externa"),
  `Navigation.tsx` (órbita, caminhada com colisão por BVH, voos de câmera, refino dos pontos de vista com raycast
  quando a BVH fica pronta, cache em localStorage), `rooms.ts` (pontos de vista automáticos por linha de visão livre),
  `customize.ts`, `useModel.ts`, `runtime.ts`.
- `src/ui/`: Intro, Hud, RoomsPanel, LightsPanel, CustomizePanel, InfoPanel, Minimap, Joystick, Gallery.
- `src/tour/`: visita cinematográfica (`Tour.tsx`, `camera.ts`, `stage.ts`, `tour.css`); config em `src/config/tour.ts`.
- `src/config/`: `project.ts` (textos), `finishes.ts` (acabamentos, categorias, paletas, elementos de cor).
- `src/admin/`: `Admin.tsx` (login, upload, validação, prévia, publicação, histórico), `processWorker.ts`
  (processa o GLB no navegador, ~20 s), `validate.ts` (compara com a versão no ar: ambientes, áreas, dimensões, portas).
- `api/` (funções da Vercel, imports relativos **com extensão `.js`**, obrigatório em ESM):
  `login.ts`, `manifest.ts` (GET público / POST admin: add, publish, archive, delete), `upload.ts` (token de envio
  direto para o Blob), `configs.ts`, `_lib.ts` (token HMAC de 12 h, manifestos versionados em `manifests/`).
- Modelo publicado com o código: `public/models/v1/model.glb` + `model.meta.json`; manifesto estático
  `public/models/manifest.json` (usado quando não há Blob).

## 7. Estado atual (18/11/2026)

- Feito: pipeline, visita completa (caminhada, ambientes, portas, dia/noite, luzes, personalização, link/WhatsApp,
  tela inicial, informações, minimapa), paisagismo e luminárias externas, painel administrativo, funções da Vercel,
  README.
- Publicação: repositório `joaovictorhenriquescotta-prog/casas-joceandro-xavier`, deploy automático da Vercel a cada
  push na `main`. `ADMIN_PASSWORD` configurada; login testado no site.
- Corrigido em produção: funções caíam (FUNCTION_INVOCATION_FAILED) por import sem extensão; senha agora ignora
  espaços nas pontas.
- **Pendente da Hellena:** conectar um **Blob store** ao projeto na Vercel (Storage → Create → Blob → conectar) e
  fazer **Redeploy**. Sem isso, o painel abre mas não envia nem publica modelos (a visita funciona normalmente).

## 8. Como atualizar o modelo 3D

1. No SketchUp, exportar em **GLB** com texturas (mesmo exportador da versão atual). `.skp` não é aceito.
2. `/admin` → senha → "Atualizar modelo 3D" (opcional: `.zip` com texturas em alta) → validar e processar.
3. Conferir a validação → "Enviar como prévia" → "Pré-visualizar" → "Publicar". Versões antigas ficam guardadas
   ("Restaurar").
4. Para não quebrar nada: manter pisos como grupos `PISO - <AMBIENTE> <área> m²`, folhas de porta separadas do
   batente, e os nomes dos materiais personalizáveis.
- Pela linha de comando: `NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/process-model.ts entrada.glb [pasta-texturas] public/models/v1/model.glb`

## 9. Limitações conhecidas

- `.skp` não pode ser lido fora do SketchUp (formato fechado).
- Luzes internas são pontos virtuais no teto (o modelo não tem luminárias nomeadas na maioria dos ambientes); o
  número de luzes acesas ao mesmo tempo é limitado (16/10/6 conforme a qualidade) e as mais próximas da câmera ganham.
- ~1.400 chamadas de desenho (malhas não juntam por diferenças de atributos): vale otimizar para celulares fracos.
- Os pontos de vista internos são refinados depois que a BVH fica pronta (alguns segundos); antes disso usa-se uma
  versão calculada só pela planta.
- "Faixa do muro" ainda não tem material identificado no modelo (a opção fica oculta no painel).
- O GLB de 54 MB passa do recomendado pelo GitHub (50 MB), mas está abaixo do limite (100 MB). Se crescer, usar o
  Blob/painel em vez de commitar.

## 10. Próximos passos sugeridos

- Hellena conectar o Blob e testar um envio pelo painel.
- Conferir no celular (desempenho, joystick, layout) e ajustar qualidade automática.
- Mapear o material da faixa do muro e revisar a lista de elementos de cor com ela.
- Reduzir chamadas de desenho; possivelmente um modo "baixa" mais agressivo para celulares.

## 10.1 Visita cinematográfica (18/11/2026)

- "Iniciar visita" abre `src/tour/Tour.tsx` (phase `'tour'`), não mais o 3D. Fluxo: abertura de drone com renders
  (aérea → principal → frontal → lote) → planta humanizada interativa → descida em perspectiva até o cômodo → render em
  tela cheia onde existe (fachada, garagem) → anterior/próximo, planta, fachada, encerrar. Detalhes no README.
- Áreas clicáveis geradas do modelo: `scripts/build-tour-plan.mjs` → `src/config/tourPlan.generated.ts` (calibração
  px = 1273 + 202,7·x, py = 3863 + 202,7·z sobre `Planta-Humanizada-Detalhe-8K.png`, conferida nas 12 salas).
- Associação ambiente → renders: `src/config/tour.ts` (`ROOM_SHOTS`); imagens via `scripts/visita-imagem.mjs` em
  `public/visita/`. Todos os cômodos das duas casas têm render (pasta "renders/AQUI REALMENTE ESTAO AS FINAIS"); sem render, um cômodo aparece pela planta humanizada
  em perspectiva + botão "Ver este ambiente em 3D". Garagem: renders próprios de cada casa (`casa1-garagem`, `casa2-garagem`).
- Tela inicial: botão "Cores da fachada" (`src/config/facadeColors.ts`, imagens `public/cores/`) troca o fundo pelas
  7 opções de cor (mesmo enquadramento). Galeria com 40 imagens (inclui interiores, `public/galeria/16–40`).
- O modelo 3D agora só baixa quando pedido (`want3d` em `App.tsx`); `pendingRoom` no store abre o 3D direto no cômodo.
- Origem das imagens: `JOCEANDRO\renders\FINAIS\` (8K). Os originais não são alterados.

## 10.2 Publicação autorizada

- O usuário **autorizou commit e push direto na `main`** ao terminar cada mudança, sem pedir confirmação
  (18/11/2026). Antes de enviar: `npm run build` precisa passar. Autor dos commits: `Claude <noreply@anthropic.com>`
  (via `git -c user.name=... -c user.email=...`). Permissões em `.claude/settings.local.json` (fora do Git).
- No PowerShell 5, não usar `Get-Content`/`Set-Content` para editar arquivos: estragam acentos (UTF-8 sem BOM).

## 11. Comandos

```bash
npm install
npm run dev        # http://localhost:5173  (as funções /api só rodam na Vercel; localmente usa o manifesto estático)
npm run build      # tsc -b && vite build
npx tsc -p tsconfig.api.json   # checagem de tipos das funções
```

Arquivos grandes de origem (GLB original e texturas) não estão no repositório (`model-src/` no .gitignore); a cópia
original do GLB está nos arquivos do projeto no Claude.

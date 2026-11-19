# Casas Joceandro Xavier · Visita virtual 3D

Visita virtual interativa das duas casas geminadas do Lot. Fazenda São Martinho (Anchieta/ES), feita a partir do
modelo do SketchUp. Funciona no navegador do celular, tablet ou computador, sem instalar nada.

**Regra do projeto:** a arquitetura nunca é alterada. O modelo do SketchUp é a referência geométrica; o processamento
só converte materiais, organiza as malhas e comprime o arquivo. Paisagismo e luminárias externas (que aparecem nas
imagens de referência e não no modelo) são acrescentados pelo app, posicionados lendo o gramado e os muros do modelo.

## Visita cinematográfica ("Iniciar visita")

O botão "Iniciar visita" abre uma apresentação no estilo de vídeo de drone, feita com as renderizações:

1. **Abertura:** sobrevoo da vista aérea → aproximação e descida pela esquina → fachada frontal → o drone sobe até o
   lote inteiro e desce até a planta (com faixas de cinema e título). Dá para pular.
2. **Planta humanizada interativa:** cada ambiente é destacado ao passar o mouse ou tocar (no celular, 1º toque mostra o
   nome e a área, 2º toque entra). No celular em pé, a planta fica girada para ocupar a tela.
3. **Entrada no ambiente:** a câmera voa até o cômodo, desce e inclina em perspectiva sobre a planta. Onde há render
   (fachada e garagem), ela segue avançando e "atravessa" para a renderização em tela cheia, com movimento lento de
   câmera; se houver várias, elas passam em sequência.
4. **Navegação:** anterior / próximo (também pelas setas do teclado ou deslizando o dedo), voltar à planta, voltar à
   fachada, encerrar. Em cada cômodo sem render há "Ver este ambiente em 3D", que abre o modelo 3D já naquele cômodo.

Como funciona por dentro (`src/tour/`):

- `Tour.tsx`: sequências e interface. `camera.ts`: câmera de drone sobre a planta em CSS 3D (enquadramento, inclinação,
  voos com aceleração/frenagem e limites para nunca mostrar além da imagem). `stage.ts`: renders em tela cheia sem
  distorção (cobre a tela na proporção original e só aproxima/desliza), transições de avanço/recuo/subida.
- As áreas clicáveis da planta **vêm do modelo 3D** (pisos `PISO - …` do `model.meta.json`), projetadas sobre a imagem
  da planta: `node scripts/build-tour-plan.mjs` gera `src/config/tourPlan.generated.ts`. A calibração (4 números no
  topo do script) só muda se a imagem da planta for trocada.
- Imagens em `public/visita/` (WebP). Só são baixadas depois do clique; a tela inicial não fica mais pesada.
  O modelo 3D (~54 MB) passou a ser baixado só quando alguém abre o modelo interativo.
- Sem dependências novas: React + CSS 3D + Web Animations. Respeita "reduzir movimento" do sistema e desliga o desfoque
  em aparelhos fracos.

**Acrescentar uma renderização** (ex.: render da sala):

```bash
node scripts/visita-imagem.mjs "C:/caminho/Casa-Joceandro-Sala-8K.png" sala
```

Depois, em `src/config/tour.ts`, acrescente `{ src: v('sala'), caption: 'Sala de estar' }` em `ROOM_SHOTS.estar`
(vale para as duas casas; para uma casa só, use a chave `'casa1-estar'`). A partir daí, ao entrar no ambiente o drone
atravessa para o render em vez de ficar na planta. Opcional: `from`/`to` controlam o movimento de câmera da cena.

O modelo 3D interativo continua no app: link "Explorar o modelo 3D interativo" na tela inicial, botão "Modelo 3D
interativo" na planta e "Ver este ambiente em 3D" nos cômodos. Na prévia do painel (`?modelo=`), "Iniciar visita"
continua abrindo o modelo 3D.

## Modelo 3D interativo

- Caminhada em primeira pessoa (mouse, teclado, toque e joystick), colisão com paredes e móveis, altura do olhar ajustável.
- Menu de ambientes com os nomes reais do projeto e transições de câmera; volta à fachada a qualquer momento.
- Manhã, tarde e noite com transição gradual; à noite, luzes internas, fitas de LED, balizadores e arandelas.
- Luzes por ambiente (e todas de uma vez); portas que abrem onde a folha é separada no modelo (12 portas).
- "Personalize sua casa": porcelanatos por categoria, revestimentos, paletas, cores por elemento, prévia, desfazer,
  restaurar original, comparação original × personalizado, salvar e compartilhar por link (WhatsApp).
- Tela inicial, tela cheia, informações do empreendimento e minimapa.

## Rodar localmente

```bash
npm install
npm run dev          # http://localhost:5173  (painel: /admin)
npm run build        # gera dist/
```

O modelo publicado com o código fica em `public/models/v10/` e o manifesto em `public/models/manifest.json`.

## Hospedagem na Vercel

1. Importe este repositório na Vercel (o framework Vite é detectado sozinho).
2. Em **Storage**, crie um **Blob store** e conecte ao projeto (cria `BLOB_READ_WRITE_TOKEN`).
3. Em **Settings → Environment Variables**, crie `ADMIN_PASSWORD` com a senha do painel (opcional: `ADMIN_SECRET`,
   qualquer texto longo, para assinar o login).
4. Faça o deploy. A visita fica na raiz do domínio e o painel em `/admin`.

Funções em `api/`:

| Rota | Uso |
| --- | --- |
| `GET /api/manifest` | versões do modelo (a visita lê daqui; sem Blob, usa o manifesto estático) |
| `POST /api/manifest` | publicar, restaurar, arquivar ou excluir versões (só administrador) |
| `POST /api/login` | login do painel |
| `POST /api/upload` | autoriza o envio direto do modelo para o Blob (só administrador) |
| `GET/POST /api/configs` | configurações de personalização salvas pelos clientes |

## Atualizar o modelo 3D (sem recompilar o app)

1. No SketchUp, exporte o modelo em **GLB** com texturas (o mesmo exportador da versão atual).
   Arquivos `.skp` não são lidos fora do SketchUp (formato fechado da Trimble).
2. Acesse `/admin`, entre com a senha e use **Atualizar modelo 3D**. Opcional: um `.zip` com as texturas em alta.
3. O navegador processa o arquivo (cerca de 20 s no computador) e mostra a validação: ambientes, portas, e diferenças
   em relação à versão no ar (dimensões, áreas, ambientes novos ou removidos).
4. **Enviar como prévia** → **Pré-visualizar** → **Publicar**. Todas as versões ficam guardadas; para voltar atrás,
   use **Restaurar** numa versão anterior.

Para que tudo continue funcionando nas próximas versões, mantenha no SketchUp:

- pisos em grupos nomeados `PISO - <AMBIENTE> <área> m²` (ex.: `PISO - QUARTO 9.00 m²`);
- folhas de porta como grupos ou componentes separados do batente;
- nomes de materiais das superfícies personalizáveis (TINTA…, Muro - neutro, pisos).

Pela linha de comando, o mesmo processamento:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/process-model.ts entrada.glb [pasta-de-texturas] public/models/v10/model.glb
```

## Estrutura

- `src/pipeline/` processamento do modelo (roda no Node e no navegador): ambientes, portas, paredes internas, materiais PBR.
- `src/three/` cena 3D: atmosfera e período do dia, casa, luzes, paisagismo, navegação.
- `src/ui/` interface da visita; `src/admin/` painel administrativo; `src/config/` textos, acabamentos e paletas.
- `api/` funções da Vercel.

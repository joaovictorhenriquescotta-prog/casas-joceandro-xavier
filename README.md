# Casas Joceandro Xavier · Visita virtual 3D

Visita virtual interativa das duas casas geminadas do Lot. Fazenda São Martinho (Anchieta/ES), feita a partir do
modelo do SketchUp. Funciona no navegador do celular, tablet ou computador, sem instalar nada.

**Regra do projeto:** a arquitetura nunca é alterada. O modelo do SketchUp é a referência geométrica; o processamento
só converte materiais, organiza as malhas e comprime o arquivo. Paisagismo e luminárias externas (que aparecem nas
imagens de referência e não no modelo) são acrescentados pelo app, posicionados lendo o gramado e os muros do modelo.

## O que a visita oferece

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

O modelo publicado com o código fica em `public/models/v1/` e o manifesto em `public/models/manifest.json`.

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
NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/process-model.ts entrada.glb [pasta-de-texturas] public/models/v1/model.glb
```

## Estrutura

- `src/pipeline/` processamento do modelo (roda no Node e no navegador): ambientes, portas, paredes internas, materiais PBR.
- `src/three/` cena 3D: atmosfera e período do dia, casa, luzes, paisagismo, navegação.
- `src/ui/` interface da visita; `src/admin/` painel administrativo; `src/config/` textos, acabamentos e paletas.
- `api/` funções da Vercel.

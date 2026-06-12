# Anime Catalog — PWA social de animes

Catálogo social de animes em formato de Progressive Web App. Permite avaliar, organizar em listas, recomendar, comparar gostos com amigos e descobrir títulos novos. Trabalho desenvolvido para a disciplina de Programação Mobile (7º semestre).

> Catálogo offline + camada social online: o acervo de animes é servido como JSON estático cacheado pelo service worker, enquanto avaliações, listas, amizades e recomendações ficam no Supabase com Row Level Security.

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack técnica](#stack-técnica)
- [Arquitetura](#arquitetura)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Backend e modelo de dados](#backend-e-modelo-de-dados)
- [PWA e estratégias de cache](#pwa-e-estratégias-de-cache)
- [Setup local](#setup-local)
- [Scripts disponíveis](#scripts-disponíveis)
- [Build e deploy](#build-e-deploy)

---

## Funcionalidades

### Catálogo e descoberta
- **Home** com seções de destaque, lançamentos e trilhos temáticos.
- **Detalhes do anime** em modal com sinopse, gêneros, capa, similares e links diretos para streaming.
- **Busca** com filtros (gênero, ano, status).
- **Surpresa** (`/surprise`): sorteio inteligente baseado em afinidades e itens da watchlist.
- **Recomendações** (`/recommendations`): inbox de sugestões enviadas por amigos + sugestões automáticas a partir do histórico.

### Perfil e organização pessoal
- **Avaliações** com nota e comentários encadeados (thread).
- **Status de consumo** por anime (assistindo, completo, pausado, dropado, planejado).
- **Favoritos** e **listas customizadas** com reordenação por drag-and-drop, capa automática e colaboradores.
- **Compartilhamento de listas via link público** (`/share/lists/:token`), acessível sem login.
- **Avatares** com upload + crop (Supabase Storage).

### Camada social
- **Amizades** com pedidos, aceitar/recusar e busca por username.
- **Perfil público de outros usuários** (`/users/:username`) com estatísticas e listas visíveis.
- **Feed** (`/feed`) com a atividade recente dos amigos (notas, listas, recomendações).
- **Recomendar anime para amigo** com mensagem.
- **Match service**: cálculo de afinidade de gosto entre dois usuários.

### Insights
- **Stats** (`/stats`): distribuição de notas, gêneros mais assistidos, tempo total.
- **Year in Review** (`/year-in-review`): resumo anual estilo "Spotify Wrapped".

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework UI | **Angular 20** (standalone components, lazy routes, control flow `@if/@for`) |
| Componentes mobile | **Ionic 8** (`@ionic/angular`) |
| PWA | `@angular/service-worker` (ngsw) + Web App Manifest |
| Wrapper nativo | **Capacitor 8** (haptics, keyboard, share, status-bar) |
| Backend | **Supabase** (Postgres + Auth + Storage + RLS) |
| Estado reativo | RxJS 7 + signals do Angular |
| Build | Angular CLI 20 |
| Testes | Karma + Jasmine |
| Lint | ESLint + `@angular-eslint` + `@typescript-eslint` |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                  Cliente (PWA / Browser)                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Angular standalone components                   │   │
│  │  ├─ Auth guard / Guest guard                     │   │
│  │  ├─ App shell (tab bar)                          │   │
│  │  └─ Páginas lazy-loaded                          │   │
│  └─────────┬────────────────────────┬───────────────┘   │
│            │                        │                   │
│      ┌─────▼─────┐           ┌──────▼───────┐           │
│      │ Service   │           │ Supabase JS  │           │
│      │ Worker    │           │ client       │           │
│      │ (ngsw)    │           └──────┬───────┘           │
│      └─────┬─────┘                  │                   │
│            │                        │                   │
│      catálogo                       │                   │
│      offline                        │                   │
└────────────┼────────────────────────┼───────────────────┘
             │                        │
       JSON estático             HTTPS (REST + Realtime)
       (animes.json,                   │
       capas CDN)                      ▼
                          ┌──────────────────────────┐
                          │   Supabase (sa-east-1)   │
                          │  ├─ Auth (username→email)│
                          │  ├─ Postgres + RLS       │
                          │  └─ Storage (avatars/)   │
                          └──────────────────────────┘
```

### Decisões de design

- **Catálogo estático, perfil dinâmico**: o acervo de animes vem do JSON `To_entediado_completo2.json` (servido como `/assets/animes.json`), cacheado offline. Já dados de usuário (notas, listas, amizades) vivem no Supabase. Isso reduz custo de banco e mantém a navegação fluida mesmo offline.
- **Standalone components + lazy loading**: cada rota carrega seu próprio bundle, reduzindo o tempo de primeiro paint.
- **Guards**: `authGuard` protege a subtree autenticada; `guestGuard` impede usuário logado de voltar para `/auth`. A rota `/share/lists/:token` é pública intencionalmente.
- **App shell com tab bar**: layout persistente entre navegações dentro da área autenticada (`shell/app-shell.component`).
- **Auth por username**: o Supabase exige email, então o app mapeia `username` para um email sintético (`<username>@catalog.app`) com um trigger que auto-confirma a conta. UX continua sendo só username + senha.

---

## Estrutura do projeto

```
src/app/
├── auth/                   # Tela de login / registro
├── shell/                  # App shell + tab bar
├── home/                   # Página inicial com trilhos
├── profile/                # Perfil do usuário logado
├── users/                  # Perfil público de outros usuários
├── lists/                  # Listas customizadas (index + detalhe)
├── shared-list/            # Visualização pública de lista compartilhada
├── friends/                # Amizades e busca
├── feed/                   # Feed de atividade de amigos
├── recommendations/        # Inbox + sugestões automáticas
├── surprise/               # Sorteio inteligente
├── stats/                  # Estatísticas pessoais
├── year-in-review/         # Resumo anual
│
├── components/             # Componentes reutilizáveis
│   ├── anime-card/
│   ├── anime-detail-modal/
│   ├── hero-banner/
│   ├── media-rail/
│   ├── add-to-list-modal/
│   ├── share-list-modal/
│   ├── avatar-cropper-modal/
│   └── ...
│
├── services/               # Acesso a dados + lógica de domínio
│   ├── supabase.service.ts          # client singleton
│   ├── auth.service.ts              # login, registro, sessão
│   ├── anime.service.ts             # acervo estático
│   ├── anime-search.ts              # busca + filtros
│   ├── user-anime.service.ts        # notas, favoritos, status
│   ├── custom-lists.service.ts      # listas + colaboradores
│   ├── friends.service.ts           # amizades
│   ├── recommendations-inbox.service.ts
│   ├── match.service.ts             # afinidade de gosto
│   ├── share.service.ts             # Web Share API + Capacitor
│   ├── streaming-links.ts           # deep links externos
│   ├── theme.service.ts             # claro / escuro
│   ├── haptics.service.ts
│   ├── keyboard-shortcuts.service.ts
│   ├── install-prompt.service.ts    # banner de instalação PWA
│   └── watch-time.ts
│
├── models/                 # Tipos TypeScript do domínio
├── guards/                 # authGuard + guestGuard
└── app.routes.ts           # tabela de rotas
```

---

## Backend e modelo de dados

Projeto Supabase: `anime-catalog` (região `sa-east-1`). Apenas dados de usuário — o catálogo continua estático.

### Tabelas principais

| Tabela | Função |
|---|---|
| `profiles` | Username, display name, avatar, bio. Criada por trigger ao registrar. |
| `anime_ratings` | Nota (1–10) por anime. |
| `rating_comments` | Comentários encadeados nas avaliações. |
| `favorites` | Animes favoritados pelo usuário. |
| `anime_status` | Status de consumo (assistindo, completo, etc.). |
| `custom_lists` | Listas criadas pelo usuário, com título, descrição e capa. |
| `custom_list_items` | Itens das listas, com `position` para ordenação. |
| `list_collaborators` | Outros usuários com permissão de editar uma lista. |
| `friendships` | Pedidos e amizades aceitas. |
| `anime_recommendations` | Recomendações trocadas entre amigos. |

### Segurança
- **RLS habilitado em todas as tabelas**, com policies separadas para `SELECT`, `INSERT`, `UPDATE` e `DELETE`.
- Policies de leitura pública para `profiles` e listas marcadas como compartilháveis.
- Bucket `avatars` no Storage com path `<user_id>/...` — escrita só pelo dono, leitura pública.

### Auth
- Login via `username + senha`. Mapeado internamente para `<username>@catalog.app`.
- Trigger `auto_confirm_users` evita verificação de email.
- Trigger `on_auth_user_created` popula `public.profiles` com `username` vindo de `raw_user_meta_data`.

---

## PWA e estratégias de cache

Configurado em `ngsw-config.json`:

| Grupo | Recursos | Estratégia |
|---|---|---|
| `app` | HTML, JS, CSS, favicon, manifest | Prefetch (instalado junto com o SW) |
| `assets` | Fontes e imagens locais | Lazy + update em background |
| `anime-catalog` | `/assets/animes.json` | **Freshness** com timeout de 5s, fallback para cache |
| `anime-covers` | `cdn.myanimelist.net/**` | **Performance** (cache-first), 200 itens, 30 dias |
| `avatars-dicebear` | `api.dicebear.com/**` | Performance, 50 itens, 7 dias |

### Manifest
- `display: standalone`, `orientation: portrait`
- Tema `#ff6740` (laranja Crunchyroll-ish), background `#1a1a1d`
- Conjunto completo de ícones maskable (72px → 512px)

### Instalabilidade
`install-prompt.service.ts` captura `beforeinstallprompt` e expõe a opção de instalar via UI, em vez de deixar o banner padrão do browser.

---

## Setup local

### Pré-requisitos
- Node.js ≥ 20
- npm ≥ 10
- (Opcional) Ionic CLI para comandos `ionic serve` / `ionic capacitor` —`npm i -g @ionic/cli`

### Instalação

```bash
git clone <repo-url>
cd projeto
npm install
```

### Variáveis de ambiente

As credenciais públicas do Supabase ficam em `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://<project>.supabase.co',
  supabaseAnonKey: '<publishable-key>',
  usernameEmailDomain: 'catalog.app',
};
```

> A `anon key` é pública por design — segurança vem das policies RLS, não de esconder a chave.

### Rodando

```bash
npm start            # ng serve → http://localhost:4200
```

Para testar o service worker (PWA real, sem hot-reload):

```bash
npm run build
npx http-server www -p 8080 -c-1
```

---

## Scripts disponíveis

| Script | O que faz |
|---|---|
| `npm start` | Dev server com hot-reload |
| `npm run build` | Build de produção em `www/` |
| `npm run watch` | Build de dev em modo watch |
| `npm test` | Karma + Jasmine |
| `npm run lint` | ESLint sobre TS + templates |

---

## Build e deploy

O build padrão gera os artefatos em `www/`, prontos para servir como site estático em qualquer host (Netlify, Vercel, GitHub Pages, Cloudflare Pages, Firebase Hosting). Como toda a parte dinâmica vai para o Supabase, **não há servidor a hospedar** — basta o estático + HTTPS.

### Capacitor (opcional)
A configuração em `capacitor.config.ts` permite empacotar o mesmo build como app Android/iOS:

```bash
npm run build
npx cap sync
npx cap open android   # ou ios
```

---

## Licença

Projeto acadêmico. Uso livre para fins de estudo.

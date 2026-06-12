# Handoff — App de catálogo de animes

Documento pra continuar a expansão do app numa nova sessão. Tudo aqui veio do trabalho feito em conjunto até **2026-06-11**.

---

## 1. O que é o app

PWA Ionic + Angular standalone, trabalho de Mobile do 7º semestre, no diretório `/home/rappudo/Faculdade-7Semestre/Mobile/projeto`. Catálogo de animes em JSON estático (`assets/animes.json` carregado via `AnimeService`), expandido com camada social/backend em Supabase.

**Catálogo (estático):** `id: string`, `nome: string[]`, `sinopse`, `generos[]`, `estudio[]`, `ondeVer[]` (Crunchyroll etc.), `temporadas`, `filmes`, `episodios`, `porcentagemDublado`, `dataLancamento` (ISO), `classificacaoIndicativa` (`L | 10-18 | null`), `recomendacao` (4 níveis de prioridade), `imagem` (URL ou null).

---

## 2. Backend (Supabase)

- **Projeto:** `anime-catalog` — ID `nmbkndeyxcoydwmxdhay`, região `sa-east-1`
- **URL e anon key:** ambos em `src/environments/environment.ts` (publishable key, ok expor)
- **Auth:** username + senha mapeado pra email fake `<username>@catalog.app`. Trigger `auto_confirm_users` em `auth.users` seta `email_confirmed_at = now()` no insert, então não precisa verificação de email. Trigger `on_auth_user_created` cria a row em `public.profiles` lendo username de `raw_user_meta_data`.
- **Use as ferramentas MCP do Supabase** (`apply_migration`, `execute_sql`, `list_tables`) pra qualquer schema change — não pedir pro usuário rodar no dashboard.

### Tabelas e RLS (resumo)

Política geral: `SELECT` é `using (true)` em quase tudo (porque amigos precisam ler dados uns dos outros). Escritas são restritas por dono via `auth.uid()`.

| Tabela | Colunas-chave | Notas |
|---|---|---|
| `profiles` | id (FK auth.users), username unique (índice em lower), avatar_url | public read; trigger cria no signup |
| `anime_ratings` | (user_id, anime_id) PK, score 1-10 nullable, comment nullable | check garante score OU comment |
| `favorites` | (user_id, anime_id) PK, created_at | — |
| `anime_status` | (user_id, anime_id) PK, status enum, episodes_watched | status: `assistindo / concluido / planejado / pausado / dropei` |
| `custom_lists` | id uuid, user_id, name, is_public, share_token uuid | unique idx em `(user_id, lower(name))` |
| `custom_list_items` | (list_id, anime_id) PK, added_at, position | reorder usa `position` ASC |
| `friendships` | (user_a, user_b) PK ordenado, status, requested_by | check `user_a < user_b`; aceitar é UPDATE pelo `<> requested_by` |
| `anime_recommendations` | id, from/to_user_id, anime_id, message, dismissed_at | check `from <> to`; insert exige amizade aceita |
| `rating_comments` | id, (rating_user_id, rating_anime_id) FK → anime_ratings, author_id, body | autor apaga próprio comentário |
| `list_collaborators` | (list_id, user_id) PK | dono insere; dono OU próprio remove. **`custom_list_items` INSERT/UPDATE/DELETE liberados pra dono OU colaborador** |

### Storage
- Bucket `avatars` público pra leitura. Política path-based: `auth.uid()::text = (storage.foldername(name))[1]` — usuário só escreve em `<user_id>/...`.

### Caveats de RLS já descobertos
- **`upsert` precisa de política `UPDATE`**. Bug encontrado em `custom_list_items` quando implementamos reorder — sem UPDATE policy o ON CONFLICT DO UPDATE falhava silenciosamente e a UI revertia. **Lição:** sempre crie INSERT + UPDATE + DELETE quando for usar upsert.
- Política `UPDATE` nos itens da lista agora é `dono OU colaborador` (não só dono) — não regredir isso quando mexer.

---

## 3. Rotas e estrutura

> **Navegação global (reformulação de 2026-06-11):** todas as rotas autenticadas
> agora são **filhas de `AppShellComponent`** (`src/app/shell/`), que renderiza um
> `<ion-router-outlet>` e o chrome de navegação responsivo: **tab bar inferior no
> mobile → side rail vertical no desktop (≥768px)** com 5 destinos (Início ·
> Descobrir · Social · Resumo · Perfil). `/auth` e `/share/lists/:token` ficam
> **fora** do shell. O `authGuard` protege o shell pai (filhos herdam). Ver seção 11.

```
/auth                    pública (guestGuard redireciona logado pra /home)
/home                    authGuard — catálogo + filtros + busca
/profile                 authGuard — perfil próprio com cropper de avatar
/lists                   authGuard — próprias + colaborando
/lists/:id               authGuard — detalhe (rename/delete/share/collab/reorder)
/friends                 authGuard — pedidos, lista, autocomplete
/users/:username         authGuard — perfil de outro user (match + thread)
/feed                    authGuard — timeline + caixa de entrada de indicações
/recommendations         authGuard — do dia, pra você, amigos, trending, CTA pra surprise
/surprise                authGuard — roleta com filtros
/stats                   authGuard — dashboard de gráficos
/year-in-review          authGuard — wrapped do ano corrente
/share/lists/:token      PÚBLICA (sem guard) — viewer somente leitura
```

---

## 4. Arquitetura

### Padrões estabelecidos
- **Tudo standalone** + `ChangeDetectionStrategy.OnPush`
- **Signals em services** com `effect()` reagindo a `auth.user()` pra reload no login / clear no logout
- **Updates otimistas com rollback**: mutação local primeiro, await DB, se erro reverte
- **Token de cancelamento** em buscas debounced (vide friends autocomplete)
- **`toSignal(animeService.list(), { initialValue: [] })` + `animesById` Map** em páginas que precisam do catálogo
- **Erros traduzidos em PT-BR** dentro de services antes de retornar pro usuário
- **Modals via `ModalController.create`** com `componentProps` tipados e `cssClass` quando precisa

### Services principais
| Service | Responsabilidade |
|---|---|
| `AuthService` | sessão + perfil próprio, signUp/signIn com mapeamento fake email |
| `SupabaseService` | client único compartilhado |
| `AnimeService` | catálogo via HttpClient + shareReplay; `ready` signal |
| `UserAnimeService` | ratings, favorites, anime_status do usuário corrente; `refresh()` |
| `CustomListsService` | listas próprias + colaborando, com role flag; `refresh()` |
| `FriendsService` | friendships + perfis cacheados; `refresh()` |
| `MatchService` | pré-carrega ratings dos amigos, computa Pearson |
| `RecommendationsInboxService` | indicações recebidas/enviadas; `refresh()` |
| `ThemeService` | dark/light + persist localStorage |
| `KeyboardShortcutsService` | listener global de atalhos (`/`, `t`, `?`, `g+X`) |
| `HapticsService` | wrapper sobre `navigator.vibrate` |
| `watch-time.ts` (helper) | `formatWatchTime(minutes) → { primary, secondary }` |

### Componentes reusados
- `AnimeCard`, `AnimeCover` (com badges de status/score/heart), `AnimeDetailModal`
- Modals: `AddToListModal`, `RecommendModal`, `ShareListModal`, `CollaboratorsModal`, `RatingThreadModal`, `AvatarCropperModal`, `KeyboardHelpModal`, `FilterPickerModal`
- `Skeleton{Cover,Grid,Row}` em `components/skeleton/`
- `SimilarAnimesComponent` embedado no rodapé do AnimeCard

### Theming
- Tokens em `src/theme/variables.scss`: `--md-bg`, `--md-surface`, `--md-surface-2/3`, `--md-text`, `--md-text-muted`, `--md-text-dim`, `--md-primary`, `--md-primary-hover`, `--md-primary-soft`, `--md-border`, `--md-border-strong`, `--md-radius`, `--md-radius-lg`, `--md-shadow-1/2/3`, `--md-ease`, `--md-duration`
- Dark: brand laranja `#ff6740`. Light: brand azul `#2563eb`. Toggle via `body.theme-light/dark`.
- ⚠️ `@import './theme/variables.scss'` em `src/global.scss` vai gerar warning de deprecation Sass — migrar pra `@use` quando passar pelo #21.

---

## 5. Roadmap — o que já foi feito

Numeração das fatias da reformulação social inicial (1–5) + features da lista priorizada (1–25):

### Fatias prévias (todas ✅)
1. Auth + perfil + avatar (`/auth`, `/profile`)
2. Notas + comentários + favoritos (UI no `AnimeCard`)
3. Listas pessoais nomeadas (`/lists`, `/lists/:id`)
4. Amigos (`/friends`, `/users/:username`)
5. Recomendações inicial (`/recommendations`: do dia + pra você + dos amigos)

### Lista priorizada — done (1–19) ✅
1. Status do anime + progresso de episódios
2. Skeleton loaders globais (`AnimeService.ready` + componentes em `components/skeleton/`)
3. Busca de usuário com autocomplete (debounce 200ms + token de cancelamento)
4. Feed de atividade dos amigos (`/feed`, agrega ratings + favorites + status + listas)
5. Match de gosto (Pearson em escala 0-100, mín 3 animes em comum, ring com `conic-gradient`)
6. Comentar avaliações (`rating_comments` + `RatingThreadModal`)
7. Indicar anime pra amigo (`anime_recommendations` + `RecommendModal` + caixa de entrada no feed + badge no toolbar)
8. Surpreenda-me (`/surprise` com roleta animada e filtros)
9. Trending semanal (seção em `/recommendations` — dedupe `(user, anime)` últimas 168h)
10. Animes parecidos (`SimilarAnimesComponent` híbrido collab + content)
11. Tempo total assistido (`watchTimeMinutes` em UserAnimeService, card no profile)
12. Stats dashboard (`/stats` com 6 visualizações em CSS/SVG puro)
13. Retrospectiva anual (`/year-in-review` estilo Wrapped)
14. Reordenar listas drag-and-drop (coluna `position`, `IonReorderGroup`)
15. Compartilhar lista por link público (`is_public` + `share_token`, `/share/lists/:token` sem auth)
16. Lista colaborativa (`list_collaborators` + RLS expandido)
17. Cropper 1:1 de avatar (modal com pan/zoom, canvas export 512×512 JPEG)
18. Atalhos de teclado (KeyboardShortcutsService + modal de ajuda)
19. Pull-to-refresh + haptics (`IonRefresher` em 5 telas + `navigator.vibrate` em toggles)

---

## 6. O que falta (6 itens)

### #20 — Deep link pra plataformas de streaming
**Objetivo:** click no chip da plataforma em `AnimeCard` abre o app/site dela com a busca pré-preenchida.

**Implementação sugerida:**
- Mapa `platform → (animeName) => url` em novo arquivo `src/app/services/streaming-links.ts`:
  ```ts
  export const STREAMING_LINKS: Record<string, (q: string) => string> = {
    Crunchyroll: (q) => `https://www.crunchyroll.com/search?q=${encodeURIComponent(q)}`,
    Netflix: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
    // ... etc — checar o JSON pra ver quais plataformas aparecem
  };
  ```
- Em `anime-card.component.html`, tornar os `<ion-chip color="secondary">` clicáveis: `<a [href]="...">` ou `(click)="openPlatform(plat)"` com `window.open(url, '_blank')`.
- Em Capacitor: `import { App } from '@capacitor/app'` e usar `App.openUrl({ url })` pra tentar deep link nativo primeiro. Mas pra escopo "web first" só `window.open` resolve.

**Onde tocar:** `src/app/components/anime-card/anime-card.component.{ts,html,scss}`.

---

### Fase final (5 itens)

### #21 — Estilo geral revisado
- Auditar inconsistências: paddings de cards, radii, gaps de seções
- Migrar `@import` Sass pra `@use` (resolve o warning de build)
- Unificar `IonButton` overrides em uma classe utility
- Padronizar `box-shadow` (tem padrão `--md-shadow-1/2/3` mas alguns lugares usam custom)
- Revisar tipografia: tamanhos de h2/h3 em sections
- Considerar dark theme + light tem mesmas medidas mas tokens corretos sendo aplicados em todo lugar

### #22 — PWA instalável + offline
- `ng add @angular/pwa` gera manifest, ngsw-config, service worker
- Configurar `ngsw-config.json`:
  - App shell prefetch
  - `assets/animes.json` com data-group `freshness` (5min TTL)
  - Imagens de capa (`myanimelist.net/...`) com `performance` + `maxAge: 30d`
- `manifest.webmanifest`: configurar nome, ícones (já tem favicon no projeto?), theme color
- Adicionar prompt de install (`beforeinstallprompt` event)
- Service worker já garante "offline" pros assets cacheados
- Testar com `ng build --configuration production` + `npx http-server www/`

### #23 — Compartilhar nativo (Capacitor Share)
- `npm install @capacitor/share`
- Atualizar `ShareListModalComponent.share()`: detectar plataforma Capacitor com `Capacitor.isNativePlatform()`, usar `Share.share({...})` no nativo, fallback `navigator.share` no web
- Adicionar botão de compartilhar em outros lugares: detail do anime (compartilhar link público se um dia tiver `/share/animes/:id`), avaliação (compartilhar o thread)

### #24 — Notificações push
**Maior peça do roadmap restante.**
- `npm install @capacitor/push-notifications`
- Backend: Firebase Cloud Messaging (Android) e APNs (iOS) — fora do escopo Supabase MCP, precisa setup manual no Firebase console
- Triggers desejados:
  - Insert em `friendships` (status pending) → notifica destinatário
  - Update em `friendships` (pending → accepted) → notifica solicitante
  - Insert em `anime_recommendations` → notifica destinatário
  - Insert em `rating_comments` → notifica dono da avaliação
- Implementação típica: edge function Supabase que ouve mudanças via Postgres trigger HTTP, envia FCM/APN
- Alternativa mais simples: Supabase Realtime + local notifications via Capacitor LocalNotifications quando app aberto

### #25 — Validar em mobile real
- `npx cap add android` (`ionic.config.json` já tem Capacitor configurado, `capacitor.config.ts` no projeto)
- `npx cap sync && npx cap open android`
- Testar:
  - Safe area insets (notch / status bar)
  - Pull-to-refresh em telas reais
  - Cropper de avatar com toque
  - Reorder com toque
  - Haptics de verdade no device
  - Performance do grid com muitas capas
- Mesmo processo pra `ios` se houver Mac

---

## 7. Como invocar a nova sessão

Sugestão de prompt inicial pra próxima conversa:

> Tô continuando um projeto Ionic/Angular com Supabase. Lê o `HANDOFF.md` no projeto pra contexto e segue a partir do **#20: Deep link pra plataformas de streaming**. A gente termina os 6 itens restantes (1 da lista priorizada + 5 da fase final).

Memórias relevantes já salvas em `~/.claude/projects/-home-rappudo-Faculdade-7Semestre-Mobile-projeto/memory/`:
- `project_anime_pwa.md` — contexto inicial do projeto
- `project_supabase_backend.md` — IDs e roteiro
- `feedback_learning_mode.md` — pra essa expansão, implementar direto

---

## 8. Comandos úteis

```bash
# Dev
npm start                                  # ng serve

# Build
npx ng build --configuration=development   # build de teste rápido
npx ng build                                # build produção (www/)

# Capacitor
npx cap sync                                # sincroniza www → nativo
npx cap open android

# Supabase MCP (chamadas via ferramenta)
mcp__claude_ai_Supabase__apply_migration   # DDL
mcp__claude_ai_Supabase__execute_sql       # SQL ad-hoc (ler apenas)
mcp__claude_ai_Supabase__list_tables       # schema check
```

Sempre buildar (`npx ng build --configuration=development`) depois de mexer em código antes de declarar tarefa completa.

---

## 9. Decisões e gotchas registrados

- **Username + senha sem dados pessoais:** mapeia `<username>@catalog.app` internamente. Trigger auto-confirma email. Trocar `usernameEmailDomain` em env se houver conflito com email real algum dia.
- **RLS public read em tudo de usuário:** pré-requisito pra match/friends visibility. Não introduzir esquema de "privado por padrão" sem repensar todas as features sociais.
- **Anime ID é string** (do JSON), não UUID. Todas as FKs em tabelas de user data usam `text` e index.
- **Status + Rating + Favorito são independentes.** Um anime pode ter status sem rating ou vice-versa. Já é assim e código depende disso.
- **`position = -1` no insert** de novos itens em listas faz eles aparecerem antes dos com `position >= 0`. Reorder dá posições 0..N.
- **Skeleton loaders** dependem de `AnimeService.ready` signal, não checar `animes().length === 0`.
- **Pull-to-refresh** em 5 telas: home, lists, friends, recommendations, feed. Adicionar em outras se fizer sentido.
- **Cropper exporta JPEG sempre**, então arquivo no Storage termina em `.jpg` independente do input.
- **Atalhos de teclado** detectam input via `closest('ion-input, ion-textarea, ion-searchbar, input, textarea')` — funciona com shadow DOM Ionic.
- **Modais Ionic** já tratam Esc. Não interceptar.

---

## 10. Verificação rápida do estado atual

```bash
# Confirmar branch/commits limpos
git status
git log --oneline -20

# Confirmar que o catálogo carrega
grep -c '"id"' src/assets/animes.json   # deve haver muitos animes (~300+)

# Confirmar tabelas no Supabase
# (via MCP tool)
mcp__claude_ai_Supabase__list_tables project_id=nmbkndeyxcoydwmxdhay schemas=["public"]
```

Devem aparecer ~10 tabelas + bucket `avatars` no storage.

---

## 11. Reformulação de UI/UX (2026-06-11)

Overhaul de apresentação (sem mudança de backend/data layer). Direção: **navegação
híbrida responsiva + estética cinematográfica premium + descoberta por hero/trilhos**.

### Fundação (design system)
- `src/theme/variables.scss` ganhou: escala tipográfica (`--md-text-2xs…3xl`),
  espaçamento (`--md-space-1…7`, `--md-page-pad`), easing expressivo
  (`--md-ease-out`, `--md-ease-spring`), métricas do shell (`--md-tabbar-h`,
  `--md-rail-w`) e **tokens de glass/cinematic** por tema (`--md-glass-bg`,
  `--md-glass-border`, `--md-glass-blur`, `--md-hero-scrim`, `--md-primary-glow`,
  `--md-rail-edge`).
- Novos partials, importados via `@use` em `global.scss`:
  - `src/theme/_motion.scss` — `@keyframes md-fade-up/fade-in/scale-in/shimmer`;
    classes `.md-reveal`, `.md-fade-in`, `.md-stagger > *` (usa `--i` por filho p/
    delay); **guard global de `prefers-reduced-motion`**.
  - `src/theme/_surfaces.scss` — `.md-glass`, `.md-glass-toolbar`, `.md-scroller`
    (trilho horizontal sem scrollbar), `.md-section`.
- **View Transitions API** ativada em `src/main.ts` (`withViewTransitions()`).

### Componentes novos (todos standalone + OnPush)
- `src/app/shell/app-shell.component.*` — navegação global (tab bar ↔ side rail),
  highlight por URL (cobre rotas-alias), badge social agregando
  `friendsService.incomingCount` + `inboxService.pendingCount`.
- `src/app/components/hero-banner/` — destaque cinematográfico (capa borrada de
  fundo + scrim + CTAs). Input `anime`, output `select`.
- `src/app/components/media-rail/` — trilho horizontal (scroll-snap, setas no
  desktop). Inputs `title/eyebrow/actionLabel/animes`, outputs `select/action`.
  **Renderiza nada quando `animes` vazio.**
- `src/app/components/section-header/` — cabeçalho de seção (eyebrow + título +
  ação "ver tudo").

### Páginas reformuladas
- **Início (`/home`)**: hero + trilhos (Continue assistindo / Veja imediatamente /
  Favoritos / por gênero) + grid completo; com busca/filtro ativo mostra só o grid
  de resultados (`isSearching()`). Toolbar enxuta (só tema + busca + filtros) — os
  6 ícones de nav migraram pro shell.
- **Descobrir (`/recommendations`)**: hero (anime do dia) + CTA surpresa em
  gradiente + trilhos (em alta / pra você / dos amigos) + hint de onboarding.
- **Social (`/feed`)**: `ion-segment` separando **Atividade** × **Indicações**
  (badge); atalho p/ `/friends`.
- **Perfil (`/profile`)**: header cinematográfico (avatar + glow), grid de stats,
  lista de links rápidos, **toggle de tema consolidado aqui**, install, logout.
- **Perfil de usuário (`/users/:username`)**: header com glow + `ion-segment`
  (Avaliações / Favoritos / Listas) com contadores.
- **Resumo (`/stats`, `/year-in-review`)**, **`/friends`**, **detalhe**
  (`anime-card`: scrim + Ken Burns na capa), `/lists`, `/surprise`, `/shared-list`:
  glass headers + motion consistentes.

### Gotchas da reformulação
- O **shell recebe a classe `.ion-page`** do Ionic (absolute inset 0 + flex
  column), então `:host` já preenche a viewport; o `.shell__outlet` é `flex:1`.
- A nav do shell é **in-flow** (ocupa layout), não overlay — páginas não ficam
  cobertas pela tab bar; o glass aparece nos **headers das páginas** (que sobrepõem
  o conteúdo rolável).
- **Budget de `anyComponentStyle`** em `angular.json` foi de 6/8kb → **10/14kb**
  (estilos cinematográficos mais ricos).
- Classes globais (`.md-reveal`, `.md-stagger`, `.md-glass-toolbar`) cascateiam
  para dentro de componentes encapsulados porque são declaradas em `global.scss`.
- Verificação visual da área **logada** depende de sessão Supabase real (headless
  sem credenciais só renderiza `/auth`). Build dev + prod verdes.

Boa continuação 🚀

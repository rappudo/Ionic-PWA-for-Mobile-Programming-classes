import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { AnimeRating, AnimeStatus, Favorite, WatchStatus } from '../models/user-anime';
import { AuthService } from './auth.service';
import { HapticsService } from './haptics.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class UserAnimeService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly haptics = inject(HapticsService);

  private readonly _ratings = signal<Map<string, AnimeRating>>(new Map());
  private readonly _favorites = signal<Set<string>>(new Set());
  private readonly _statuses = signal<Map<string, AnimeStatus>>(new Map());
  private readonly _loading = signal(false);

  readonly ratings = this._ratings.asReadonly();
  readonly favorites = this._favorites.asReadonly();
  readonly statuses = this._statuses.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly favoritesCount = computed(() => this._favorites().size);
  readonly ratedCount = computed(() => this._ratings().size);

  readonly statusCounts = computed<Record<WatchStatus, number>>(() => {
    const base: Record<WatchStatus, number> = {
      assistindo: 0,
      concluido: 0,
      planejado: 0,
      pausado: 0,
      dropei: 0,
    };
    for (const s of this._statuses().values()) base[s.status] += 1;
    return base;
  });

  readonly watchTimeMinutes = computed(() => {
    let total = 0;
    for (const s of this._statuses().values()) total += s.episodes_watched * 24;
    return total;
  });

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) {
        void this.loadAll(user.id);
      } else {
        this._ratings.set(new Map());
        this._favorites.set(new Set());
        this._statuses.set(new Map());
      }
    });
  }

  ratingFor(animeId: string): AnimeRating | undefined {
    return this._ratings().get(animeId);
  }

  isFavorite(animeId: string): boolean {
    return this._favorites().has(animeId);
  }

  statusFor(animeId: string): AnimeStatus | undefined {
    return this._statuses().get(animeId);
  }

  async setStatus(
    animeId: string,
    status: WatchStatus | null,
    totalEpisodes?: number,
  ): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    if (status === 'concluido') this.haptics.success();
    else if (status !== null) this.haptics.light();
    const previous = this._statuses().get(animeId) ?? null;

    if (status === null) {
      this.mutateStatuses((map) => map.delete(animeId));
      const { error } = await this.supabase
        .from('anime_status')
        .delete()
        .eq('user_id', user.id)
        .eq('anime_id', animeId);
      if (error && previous) this.mutateStatuses((map) => map.set(animeId, previous));
      return;
    }

    let episodes = previous?.episodes_watched ?? 0;
    if (status === 'planejado') episodes = 0;
    if (status === 'concluido' && totalEpisodes && totalEpisodes > 0) episodes = totalEpisodes;

    await this.persistStatus(animeId, status, episodes, previous);
  }

  async setEpisodesWatched(
    animeId: string,
    episodes: number,
    totalEpisodes?: number,
  ): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    const safe = Math.max(0, Math.floor(episodes));
    const previous = this._statuses().get(animeId) ?? null;
    let status: WatchStatus = previous?.status ?? 'assistindo';
    if (totalEpisodes && totalEpisodes > 0 && safe >= totalEpisodes) {
      status = 'concluido';
    } else if (safe > 0 && status === 'planejado') {
      status = 'assistindo';
    }
    await this.persistStatus(animeId, status, safe, previous);
  }

  async bumpEpisode(animeId: string, totalEpisodes?: number): Promise<void> {
    this.haptics.light();
    const current = this._statuses().get(animeId);
    const next = (current?.episodes_watched ?? 0) + 1;
    await this.setEpisodesWatched(animeId, next, totalEpisodes);
  }

  async refresh(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    await this.loadAll(user.id);
  }

  private async persistStatus(
    animeId: string,
    status: WatchStatus,
    episodes: number,
    previous: AnimeStatus | null,
  ): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    const now = new Date().toISOString();
    const optimistic: AnimeStatus = {
      user_id: user.id,
      anime_id: animeId,
      status,
      episodes_watched: episodes,
      updated_at: now,
    };
    this.mutateStatuses((map) => map.set(animeId, optimistic));

    const { data, error } = await this.supabase
      .from('anime_status')
      .upsert(
        {
          user_id: user.id,
          anime_id: animeId,
          status,
          episodes_watched: episodes,
        },
        { onConflict: 'user_id,anime_id' },
      )
      .select()
      .single<AnimeStatus>();

    if (error) {
      this.mutateStatuses((map) => {
        if (previous) map.set(animeId, previous);
        else map.delete(animeId);
      });
      return;
    }
    if (data) this.mutateStatuses((map) => map.set(animeId, data));
  }

  private mutateStatuses(mutator: (map: Map<string, AnimeStatus>) => void): void {
    const next = new Map(this._statuses());
    mutator(next);
    this._statuses.set(next);
  }

  async toggleFavorite(animeId: string): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    const currentlyFav = this._favorites().has(animeId);
    this.haptics.light();

    this.mutateFavorites((set) => {
      if (currentlyFav) set.delete(animeId);
      else set.add(animeId);
    });

    if (currentlyFav) {
      const { error } = await this.supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('anime_id', animeId);
      if (error) this.mutateFavorites((set) => set.add(animeId));
    } else {
      const { error } = await this.supabase
        .from('favorites')
        .insert({ user_id: user.id, anime_id: animeId });
      if (error) this.mutateFavorites((set) => set.delete(animeId));
    }
  }

  async setScore(animeId: string, score: number | null): Promise<void> {
    if (score !== null) this.haptics.light();
    const existing = this._ratings().get(animeId) ?? null;
    const comment = existing?.comment ?? null;
    await this.persistRating(animeId, score, comment, existing);
  }

  async setComment(animeId: string, comment: string | null): Promise<void> {
    const existing = this._ratings().get(animeId) ?? null;
    const score = existing?.score ?? null;
    const trimmed = comment?.trim() ? comment.trim() : null;
    await this.persistRating(animeId, score, trimmed, existing);
  }

  private async persistRating(
    animeId: string,
    score: number | null,
    comment: string | null,
    previous: AnimeRating | null,
  ): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    if (score === null && (comment === null || comment === '')) {
      this.mutateRatings((map) => map.delete(animeId));
      const { error } = await this.supabase
        .from('anime_ratings')
        .delete()
        .eq('user_id', user.id)
        .eq('anime_id', animeId);
      if (error && previous) this.mutateRatings((map) => map.set(animeId, previous));
      return;
    }

    const now = new Date().toISOString();
    const optimistic: AnimeRating = {
      user_id: user.id,
      anime_id: animeId,
      score,
      comment,
      created_at: previous?.created_at ?? now,
      updated_at: now,
    };
    this.mutateRatings((map) => map.set(animeId, optimistic));

    const { data, error } = await this.supabase
      .from('anime_ratings')
      .upsert(
        {
          user_id: user.id,
          anime_id: animeId,
          score,
          comment,
        },
        { onConflict: 'user_id,anime_id' },
      )
      .select()
      .single<AnimeRating>();

    if (error) {
      this.mutateRatings((map) => {
        if (previous) map.set(animeId, previous);
        else map.delete(animeId);
      });
      return;
    }
    if (data) {
      this.mutateRatings((map) => map.set(animeId, data));
    }
  }

  private async loadAll(userId: string): Promise<void> {
    this._loading.set(true);
    const [ratingsRes, favoritesRes, statusRes] = await Promise.all([
      this.supabase.from('anime_ratings').select('*').eq('user_id', userId),
      this.supabase.from('favorites').select('*').eq('user_id', userId),
      this.supabase.from('anime_status').select('*').eq('user_id', userId),
    ]);

    const ratings = new Map<string, AnimeRating>();
    for (const row of (ratingsRes.data ?? []) as AnimeRating[]) {
      ratings.set(row.anime_id, row);
    }
    this._ratings.set(ratings);

    const favorites = new Set<string>();
    for (const row of (favoritesRes.data ?? []) as Favorite[]) {
      favorites.add(row.anime_id);
    }
    this._favorites.set(favorites);

    const statuses = new Map<string, AnimeStatus>();
    for (const row of (statusRes.data ?? []) as AnimeStatus[]) {
      statuses.set(row.anime_id, row);
    }
    this._statuses.set(statuses);

    this._loading.set(false);
  }

  private mutateRatings(mutator: (map: Map<string, AnimeRating>) => void): void {
    const next = new Map(this._ratings());
    mutator(next);
    this._ratings.set(next);
  }

  private mutateFavorites(mutator: (set: Set<string>) => void): void {
    const next = new Set(this._favorites());
    mutator(next);
    this._favorites.set(next);
  }
}

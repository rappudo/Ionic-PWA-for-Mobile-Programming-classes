import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { AnimeRating } from '../models/user-anime';
import { AuthService } from './auth.service';
import { FriendsService } from './friends.service';
import { SupabaseService } from './supabase.service';
import { UserAnimeService } from './user-anime.service';

export interface MatchResult {
  score: number | null;
  common: number;
}

const MIN_COMMON = 3;

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly friends = inject(FriendsService);
  private readonly userData = inject(UserAnimeService);

  private readonly _friendScoresById = signal<Map<string, Map<string, number>>>(new Map());
  private readonly _loading = signal(false);

  readonly loading = this._loading.asReadonly();

  private readonly friendKey = computed(() =>
    this.friends.accepted().map((v) => v.other.id).sort().join(','),
  );

  constructor() {
    effect(() => {
      const user = this.auth.user();
      const key = this.friendKey();
      if (!user || !key) {
        this._friendScoresById.set(new Map());
        return;
      }
      void this.loadFriendRatings(key.split(',').filter(Boolean));
    });
  }

  matchWith(friendId: string): MatchResult {
    const theirs = this._friendScoresById().get(friendId);
    if (!theirs) return { score: null, common: 0 };
    return computeMatch(this.userData.ratings(), theirs);
  }

  matchWithExternal(theirRatings: AnimeRating[]): MatchResult {
    const map = new Map<string, number>();
    for (const r of theirRatings) {
      if (r.score !== null) map.set(r.anime_id, r.score);
    }
    return computeMatch(this.userData.ratings(), map);
  }

  private async loadFriendRatings(friendIds: string[]): Promise<void> {
    if (friendIds.length === 0) {
      this._friendScoresById.set(new Map());
      return;
    }
    this._loading.set(true);
    const { data } = await this.supabase
      .from('anime_ratings')
      .select('user_id, anime_id, score')
      .in('user_id', friendIds)
      .not('score', 'is', null);

    const next = new Map<string, Map<string, number>>();
    for (const id of friendIds) next.set(id, new Map());
    for (const row of (data ?? []) as { user_id: string; anime_id: string; score: number }[]) {
      next.get(row.user_id)?.set(row.anime_id, row.score);
    }
    this._friendScoresById.set(next);
    this._loading.set(false);
  }
}

function computeMatch(
  mine: ReadonlyMap<string, { score: number | null }>,
  theirs: ReadonlyMap<string, number>,
): MatchResult {
  const pairs: [number, number][] = [];
  for (const [animeId, rating] of mine) {
    if (rating.score === null) continue;
    const t = theirs.get(animeId);
    if (t === undefined) continue;
    pairs.push([rating.score, t]);
  }
  if (pairs.length < MIN_COMMON) return { score: null, common: pairs.length };

  const n = pairs.length;
  const xMean = pairs.reduce((s, [x]) => s + x, 0) / n;
  const yMean = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const [x, y] of pairs) {
    const dx = x - xMean;
    const dy = y - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) {
    const avgDiff = pairs.reduce((s, [x, y]) => s + Math.abs(x - y), 0) / n;
    return { score: Math.round(Math.max(0, 100 - avgDiff * 10)), common: n };
  }
  const r = num / Math.sqrt(denX * denY);
  return { score: Math.round(((r + 1) / 2) * 100), common: n };
}

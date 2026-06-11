import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { AnimeRecommendation, IncomingRecommendation } from '../models/anime-recommendation';
import { Profile } from '../models/profile';
import { AuthService } from './auth.service';
import { FriendsService } from './friends.service';
import { SupabaseService } from './supabase.service';

export type SendResult = { ok: true } | { ok: false; message: string };

@Injectable({ providedIn: 'root' })
export class RecommendationsInboxService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly friends = inject(FriendsService);

  private readonly _incoming = signal<IncomingRecommendation[]>([]);
  private readonly _outgoing = signal<AnimeRecommendation[]>([]);
  private readonly _loading = signal(false);

  readonly incoming = this._incoming.asReadonly();
  readonly outgoing = this._outgoing.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly pending = computed(() => this._incoming().filter((r) => r.dismissed_at === null));
  readonly pendingCount = computed(() => this.pending().length);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) void this.loadAll(user.id);
      else {
        this._incoming.set([]);
        this._outgoing.set([]);
      }
    });
  }

  async refresh(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    await this.loadAll(user.id);
  }

  recipientsFor(animeId: string): Set<string> {
    return new Set(this._outgoing().filter((r) => r.anime_id === animeId).map((r) => r.to_user_id));
  }

  async sendRecommendation(
    toUserId: string,
    animeId: string,
    message: string | null,
  ): Promise<SendResult> {
    const me = this.auth.user();
    if (!me) return { ok: false, message: 'Não autenticado.' };
    if (!this.friends.isFriend(toUserId)) {
      return { ok: false, message: 'Você só pode indicar pra amigos.' };
    }
    const trimmed = message?.trim() ? message.trim().slice(0, 300) : null;

    const { data, error } = await this.supabase
      .from('anime_recommendations')
      .insert({
        from_user_id: me.id,
        to_user_id: toUserId,
        anime_id: animeId,
        message: trimmed,
      })
      .select()
      .single<AnimeRecommendation>();

    if (error || !data) {
      const msg = error?.message?.toLowerCase().includes('duplicate')
        ? 'Você já indicou esse anime pra essa pessoa.'
        : error?.message ?? 'Falha ao enviar.';
      return { ok: false, message: msg };
    }
    this._outgoing.update((arr) => [data, ...arr]);
    return { ok: true };
  }

  async dismiss(recommendationId: string): Promise<void> {
    const previous = this._incoming();
    const now = new Date().toISOString();
    this._incoming.update((arr) =>
      arr.map((r) => (r.id === recommendationId ? { ...r, dismissed_at: now } : r)),
    );
    const { error } = await this.supabase
      .from('anime_recommendations')
      .update({ dismissed_at: now })
      .eq('id', recommendationId);
    if (error) this._incoming.set(previous);
  }

  private async loadAll(userId: string): Promise<void> {
    this._loading.set(true);
    const [incomingRes, outgoingRes] = await Promise.all([
      this.supabase
        .from('anime_recommendations')
        .select('*')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('anime_recommendations')
        .select('*')
        .eq('from_user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    const incoming = (incomingRes.data ?? []) as AnimeRecommendation[];
    const fromIds = [...new Set(incoming.map((r) => r.from_user_id))];
    const profiles = new Map<string, Profile>();
    if (fromIds.length > 0) {
      const { data: profileRows } = await this.supabase
        .from('profiles')
        .select('*')
        .in('id', fromIds);
      for (const p of (profileRows ?? []) as Profile[]) profiles.set(p.id, p);
    }

    this._incoming.set(
      incoming.map((r) => ({ ...r, from_user: profiles.get(r.from_user_id) ?? null })),
    );
    this._outgoing.set((outgoingRes.data ?? []) as AnimeRecommendation[]);
    this._loading.set(false);
  }
}

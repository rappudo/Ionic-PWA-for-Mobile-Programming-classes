import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { Friendship, FriendshipView } from '../models/friendship';
import { Profile } from '../models/profile';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

export type FriendActionResult = { ok: true } | { ok: false; message: string };

@Injectable({ providedIn: 'root' })
export class FriendsService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  private readonly _friendships = signal<Friendship[]>([]);
  private readonly _profilesById = signal<Map<string, Profile>>(new Map());
  private readonly _loading = signal(false);

  readonly loading = this._loading.asReadonly();

  readonly accepted = computed<FriendshipView[]>(() =>
    this.buildViews((f) => f.status === 'accepted'),
  );
  readonly pendingIncoming = computed<FriendshipView[]>(() =>
    this.buildViews((f) => {
      const uid = this.auth.user()?.id;
      return f.status === 'pending' && !!uid && f.requested_by !== uid;
    }),
  );
  readonly pendingOutgoing = computed<FriendshipView[]>(() =>
    this.buildViews((f) => {
      const uid = this.auth.user()?.id;
      return f.status === 'pending' && !!uid && f.requested_by === uid;
    }),
  );

  readonly incomingCount = computed(() => this.pendingIncoming().length);
  readonly friendsCount = computed(() => this.accepted().length);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) void this.loadAll(user.id);
      else {
        this._friendships.set([]);
        this._profilesById.set(new Map());
      }
    });
  }

  async refresh(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    await this.loadAll(user.id);
  }

  isFriend(userId: string): boolean {
    return this.accepted().some((v) => v.other.id === userId);
  }

  async sendRequest(username: string): Promise<FriendActionResult> {
    const me = this.auth.user();
    if (!me) return { ok: false, message: 'Não autenticado.' };
    const target = username.trim().toLowerCase();
    if (!target) return { ok: false, message: 'Digite um ID.' };
    if (target === (this.auth.profile()?.username ?? '').toLowerCase()) {
      return { ok: false, message: 'Você não pode se adicionar.' };
    }

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('username', target)
      .maybeSingle<Profile>();

    if (!profile) return { ok: false, message: 'Usuário não encontrado.' };

    const [user_a, user_b] = me.id < profile.id ? [me.id, profile.id] : [profile.id, me.id];

    const existing = this._friendships().find((f) => f.user_a === user_a && f.user_b === user_b);
    if (existing) {
      if (existing.status === 'accepted') {
        return { ok: false, message: 'Vocês já são amigos.' };
      }
      return { ok: false, message: 'Já existe um pedido pendente.' };
    }

    const optimistic: Friendship = {
      user_a,
      user_b,
      status: 'pending',
      requested_by: me.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this._friendships.update((arr) => [...arr, optimistic]);
    this.cacheProfiles([profile]);

    const { error } = await this.supabase.from('friendships').insert({
      user_a,
      user_b,
      status: 'pending',
      requested_by: me.id,
    });

    if (error) {
      this._friendships.update((arr) =>
        arr.filter((f) => !(f.user_a === user_a && f.user_b === user_b)),
      );
      return { ok: false, message: error.message };
    }
    return { ok: true };
  }

  async accept(friendship: Friendship): Promise<FriendActionResult> {
    const previous = friendship;
    this._friendships.update((arr) =>
      arr.map((f) =>
        f.user_a === previous.user_a && f.user_b === previous.user_b
          ? { ...f, status: 'accepted' }
          : f,
      ),
    );
    const { error } = await this.supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('user_a', friendship.user_a)
      .eq('user_b', friendship.user_b);
    if (error) {
      this._friendships.update((arr) =>
        arr.map((f) =>
          f.user_a === previous.user_a && f.user_b === previous.user_b ? previous : f,
        ),
      );
      return { ok: false, message: error.message };
    }
    return { ok: true };
  }

  async remove(friendship: Friendship): Promise<FriendActionResult> {
    const previous = this._friendships();
    this._friendships.update((arr) =>
      arr.filter((f) => !(f.user_a === friendship.user_a && f.user_b === friendship.user_b)),
    );
    const { error } = await this.supabase
      .from('friendships')
      .delete()
      .eq('user_a', friendship.user_a)
      .eq('user_b', friendship.user_b);
    if (error) {
      this._friendships.set(previous);
      return { ok: false, message: error.message };
    }
    return { ok: true };
  }

  private buildViews(predicate: (f: Friendship) => boolean): FriendshipView[] {
    const uid = this.auth.user()?.id;
    if (!uid) return [];
    const profiles = this._profilesById();
    const views: FriendshipView[] = [];
    for (const f of this._friendships()) {
      if (!predicate(f)) continue;
      const otherId = f.user_a === uid ? f.user_b : f.user_a;
      const other = profiles.get(otherId);
      if (other) views.push({ friendship: f, other });
    }
    return views.sort((x, y) =>
      x.other.username.localeCompare(y.other.username, 'pt-BR'),
    );
  }

  private async loadAll(userId: string): Promise<void> {
    this._loading.set(true);
    const { data } = await this.supabase
      .from('friendships')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);

    const friendships = (data ?? []) as Friendship[];
    this._friendships.set(friendships);

    const otherIds = new Set<string>();
    for (const f of friendships) {
      otherIds.add(f.user_a === userId ? f.user_b : f.user_a);
    }
    if (otherIds.size > 0) {
      const { data: profiles } = await this.supabase
        .from('profiles')
        .select('*')
        .in('id', [...otherIds]);
      this.cacheProfiles((profiles ?? []) as Profile[]);
    } else {
      this._profilesById.set(new Map());
    }
    this._loading.set(false);
  }

  private cacheProfiles(profiles: Profile[]): void {
    const next = new Map(this._profilesById());
    for (const p of profiles) next.set(p.id, p);
    this._profilesById.set(next);
  }
}

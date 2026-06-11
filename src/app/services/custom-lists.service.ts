import { Injectable, computed, effect, inject, signal } from '@angular/core';

import {
  CustomList,
  CustomListItem,
  CustomListWithItems,
  ListCollaborator,
  ListRole,
} from '../models/custom-list';
import { Profile } from '../models/profile';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

export type ListMutationResult = { ok: true; list: CustomListWithItems } | { ok: false; message: string };

export type CollabResult = { ok: true } | { ok: false; message: string };

export interface CollaboratorView {
  user_id: string;
  added_at: string;
  profile: Profile | null;
}

@Injectable({ providedIn: 'root' })
export class CustomListsService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  private readonly _lists = signal<CustomListWithItems[]>([]);
  private readonly _loading = signal(false);

  readonly lists = this._lists.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly listsCount = computed(() => this._lists().length);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) {
        void this.loadMine(user.id);
      } else {
        this._lists.set([]);
      }
    });
  }

  listById(id: string): CustomListWithItems | undefined {
    return this._lists().find((l) => l.id === id);
  }

  listsContaining(animeId: string): CustomListWithItems[] {
    return this._lists().filter((l) => l.anime_ids.includes(animeId));
  }

  async createList(name: string): Promise<ListMutationResult> {
    const user = this.auth.user();
    if (!user) return { ok: false, message: 'Não autenticado.' };
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, message: 'Nome obrigatório.' };
    if (trimmed.length > 80) return { ok: false, message: 'Nome muito longo (máx 80).' };

    const { data, error } = await this.supabase
      .from('custom_lists')
      .insert({ user_id: user.id, name: trimmed })
      .select()
      .single<CustomList>();

    if (error || !data) {
      return {
        ok: false,
        message: error?.message?.includes('duplicate')
          ? 'Já existe uma lista com esse nome.'
          : error?.message ?? 'Falha ao criar lista.',
      };
    }

    const withItems: CustomListWithItems = { ...data, anime_ids: [], role: 'owner' };
    this._lists.update((arr) => [withItems, ...arr]);
    return { ok: true, list: withItems };
  }

  async renameList(listId: string, name: string): Promise<ListMutationResult> {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, message: 'Nome obrigatório.' };
    if (trimmed.length > 80) return { ok: false, message: 'Nome muito longo (máx 80).' };

    const previous = this.listById(listId);
    if (!previous) return { ok: false, message: 'Lista não encontrada.' };

    this._lists.update((arr) =>
      arr.map((l) => (l.id === listId ? { ...l, name: trimmed } : l)),
    );

    const { error, data } = await this.supabase
      .from('custom_lists')
      .update({ name: trimmed })
      .eq('id', listId)
      .select()
      .single<CustomList>();

    if (error || !data) {
      this._lists.update((arr) =>
        arr.map((l) => (l.id === listId ? { ...l, name: previous.name } : l)),
      );
      return {
        ok: false,
        message: error?.message?.includes('duplicate')
          ? 'Já existe uma lista com esse nome.'
          : error?.message ?? 'Falha ao renomear.',
      };
    }

    const updated: CustomListWithItems = {
      ...data,
      anime_ids: previous.anime_ids,
      role: previous.role,
    };
    this._lists.update((arr) => arr.map((l) => (l.id === listId ? updated : l)));
    return { ok: true, list: updated };
  }

  async setPublic(listId: string, isPublic: boolean): Promise<boolean> {
    const previous = this.listById(listId);
    if (!previous) return false;
    this.mutateList(listId, (l) => ({ ...l, is_public: isPublic }));
    const { error } = await this.supabase
      .from('custom_lists')
      .update({ is_public: isPublic })
      .eq('id', listId);
    if (error) {
      this.mutateList(listId, (l) => ({ ...l, is_public: previous.is_public }));
      return false;
    }
    return true;
  }

  async deleteList(listId: string): Promise<boolean> {
    const previous = this._lists();
    this._lists.update((arr) => arr.filter((l) => l.id !== listId));
    const { error } = await this.supabase.from('custom_lists').delete().eq('id', listId);
    if (error) {
      this._lists.set(previous);
      return false;
    }
    return true;
  }

  async addAnime(listId: string, animeId: string): Promise<boolean> {
    const list = this.listById(listId);
    if (!list) return false;
    if (list.anime_ids.includes(animeId)) return true;

    this.mutateList(listId, (l) => ({ ...l, anime_ids: [animeId, ...l.anime_ids] }));

    const { error } = await this.supabase
      .from('custom_list_items')
      .insert({ list_id: listId, anime_id: animeId, position: -1 });

    if (error) {
      this.mutateList(listId, (l) => ({
        ...l,
        anime_ids: l.anime_ids.filter((id) => id !== animeId),
      }));
      return false;
    }
    return true;
  }

  async reorderItems(listId: string, newOrder: string[]): Promise<boolean> {
    const list = this.listById(listId);
    if (!list) return false;
    const previous = list.anime_ids;
    this.mutateList(listId, (l) => ({ ...l, anime_ids: newOrder }));

    const rows = newOrder.map((animeId, idx) => ({
      list_id: listId,
      anime_id: animeId,
      position: idx,
    }));
    const { error } = await this.supabase
      .from('custom_list_items')
      .upsert(rows, { onConflict: 'list_id,anime_id' });

    if (error) {
      this.mutateList(listId, (l) => ({ ...l, anime_ids: previous }));
      return false;
    }
    return true;
  }

  async removeAnime(listId: string, animeId: string): Promise<boolean> {
    const list = this.listById(listId);
    if (!list) return false;
    if (!list.anime_ids.includes(animeId)) return true;

    this.mutateList(listId, (l) => ({
      ...l,
      anime_ids: l.anime_ids.filter((id) => id !== animeId),
    }));

    const { error } = await this.supabase
      .from('custom_list_items')
      .delete()
      .eq('list_id', listId)
      .eq('anime_id', animeId);

    if (error) {
      this.mutateList(listId, (l) => ({ ...l, anime_ids: [animeId, ...l.anime_ids] }));
      return false;
    }
    return true;
  }

  async listCollaborators(listId: string): Promise<CollaboratorView[]> {
    const { data: rows } = await this.supabase
      .from('list_collaborators')
      .select('*')
      .eq('list_id', listId);
    const collaborators = (rows ?? []) as ListCollaborator[];
    if (collaborators.length === 0) return [];

    const ids = collaborators.map((c) => c.user_id);
    const { data: profileRows } = await this.supabase
      .from('profiles')
      .select('*')
      .in('id', ids);
    const profileById = new Map<string, Profile>();
    for (const p of (profileRows ?? []) as Profile[]) profileById.set(p.id, p);

    return collaborators.map((c) => ({
      user_id: c.user_id,
      added_at: c.added_at,
      profile: profileById.get(c.user_id) ?? null,
    }));
  }

  async refresh(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    await this.loadMine(user.id);
  }

  async addCollaborator(listId: string, username: string): Promise<CollabResult> {
    const me = this.auth.user();
    if (!me) return { ok: false, message: 'Não autenticado.' };
    const target = username.trim().toLowerCase();
    if (!target) return { ok: false, message: 'Digite um ID.' };

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id, username')
      .eq('username', target)
      .maybeSingle<{ id: string; username: string }>();
    if (!profile) return { ok: false, message: 'Usuário não encontrado.' };

    const list = this.listById(listId);
    if (list && list.user_id === profile.id) {
      return { ok: false, message: 'O dono já tem acesso.' };
    }

    const { error } = await this.supabase
      .from('list_collaborators')
      .insert({ list_id: listId, user_id: profile.id });
    if (error) {
      const msg = error.message.toLowerCase().includes('duplicate')
        ? 'Essa pessoa já colabora.'
        : error.message;
      return { ok: false, message: msg };
    }
    return { ok: true };
  }

  async removeCollaborator(listId: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('list_collaborators')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', userId);
    return !error;
  }

  private async loadMine(userId: string): Promise<void> {
    this._loading.set(true);

    const [ownedRes, collabMembershipRes] = await Promise.all([
      this.supabase
        .from('custom_lists')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      this.supabase.from('list_collaborators').select('list_id').eq('user_id', userId),
    ]);

    const owned = (ownedRes.data ?? []) as CustomList[];
    const memberships = (collabMembershipRes.data ?? []) as { list_id: string }[];

    const collabIds = memberships
      .map((m) => m.list_id)
      .filter((id) => !owned.some((o) => o.id === id));

    let collaborating: CustomList[] = [];
    if (collabIds.length > 0) {
      const { data } = await this.supabase
        .from('custom_lists')
        .select('*')
        .in('id', collabIds)
        .order('updated_at', { ascending: false });
      collaborating = (data ?? []) as CustomList[];
    }

    const rawLists: { list: CustomList; role: ListRole }[] = [
      ...owned.map((list) => ({ list, role: 'owner' as ListRole })),
      ...collaborating.map((list) => ({ list, role: 'collaborator' as ListRole })),
    ];

    if (rawLists.length === 0) {
      this._lists.set([]);
      this._loading.set(false);
      return;
    }

    const { data: items } = await this.supabase
      .from('custom_list_items')
      .select('*')
      .in(
        'list_id',
        rawLists.map((l) => l.list.id),
      )
      .order('position', { ascending: true })
      .order('added_at', { ascending: false });

    const itemsByList = new Map<string, string[]>();
    for (const item of (items ?? []) as CustomListItem[]) {
      const arr = itemsByList.get(item.list_id) ?? [];
      arr.push(item.anime_id);
      itemsByList.set(item.list_id, arr);
    }

    const withItems: CustomListWithItems[] = rawLists
      .map(({ list, role }) => ({
        ...list,
        anime_ids: itemsByList.get(list.id) ?? [],
        role,
      }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    this._lists.set(withItems);
    this._loading.set(false);
  }

  private mutateList(
    listId: string,
    mutator: (list: CustomListWithItems) => CustomListWithItems,
  ): void {
    this._lists.update((arr) => arr.map((l) => (l.id === listId ? mutator(l) : l)));
  }
}

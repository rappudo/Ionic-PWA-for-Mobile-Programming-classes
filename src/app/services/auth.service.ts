import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { environment } from '../../environments/environment';
import { Profile } from '../models/profile';
import { SupabaseService } from './supabase.service';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export type AuthResult = { ok: true } | { ok: false; message: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly _session = signal<Session | null>(null);
  private readonly _profile = signal<Profile | null>(null);
  private readonly _ready = signal(false);

  readonly session = this._session.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly ready = this._ready.asReadonly();
  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);

  constructor() {
    this.bootstrap();
  }

  async signUp(username: string, password: string): Promise<AuthResult> {
    const normalized = username.trim().toLowerCase();
    if (!USERNAME_REGEX.test(normalized)) {
      return {
        ok: false,
        message: 'ID deve ter 3–20 caracteres: letras minúsculas, números ou _.',
      };
    }
    if (password.length < 6) {
      return { ok: false, message: 'Senha precisa ter ao menos 6 caracteres.' };
    }

    const taken = await this.usernameTaken(normalized);
    if (taken) {
      return { ok: false, message: 'Esse ID já está em uso.' };
    }

    const { error } = await this.supabase.auth.signUp({
      email: this.toEmail(normalized),
      password,
      options: { data: { username: normalized } },
    });
    if (error) {
      return { ok: false, message: this.translateError(error.message) };
    }

    const signedIn = await this.signIn(normalized, password);
    return signedIn;
  }

  async signIn(username: string, password: string): Promise<AuthResult> {
    const normalized = username.trim().toLowerCase();
    const { error } = await this.supabase.auth.signInWithPassword({
      email: this.toEmail(normalized),
      password,
    });
    if (error) {
      return { ok: false, message: this.translateError(error.message) };
    }
    return { ok: true };
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  async refreshProfile(): Promise<void> {
    const user = this.user();
    if (!user) {
      this._profile.set(null);
      return;
    }
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle<Profile>();
    this._profile.set(data ?? null);
  }

  private async bootstrap(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    this._session.set(data.session);
    if (data.session) {
      await this.refreshProfile();
    }
    this._ready.set(true);

    this.supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session) => {
      this._session.set(session);
      if (session) {
        void this.refreshProfile();
      } else {
        this._profile.set(null);
      }
    });
  }

  private async usernameTaken(username: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    return data !== null;
  }

  private toEmail(username: string): string {
    return `${username}@${environment.usernameEmailDomain}`;
  }

  private translateError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('invalid login')) return 'ID ou senha incorretos.';
    if (lower.includes('already registered')) return 'Esse ID já está em uso.';
    if (lower.includes('password')) return 'Senha inválida.';
    return message;
  }
}

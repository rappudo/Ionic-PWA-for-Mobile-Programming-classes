import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'app:supabase-auth',
      },
    },
  );
}

import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonSkeletonText, ModalController } from '@ionic/angular/standalone';

import { Anime } from '../../models/anime';
import { AnimeService } from '../../services/anime.service';
import { SupabaseService } from '../../services/supabase.service';
import { AnimeDetailModalComponent } from '../anime-detail-modal/anime-detail-modal.component';

@Component({
  selector: 'app-similar-animes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'similar-animes.component.html',
  styleUrls: ['similar-animes.component.scss'],
  imports: [IonSkeletonText],
})
export class SimilarAnimesComponent {
  private readonly supabase = inject(SupabaseService).client;
  private readonly modalCtrl = inject(ModalController);

  private readonly animes = toSignal(inject(AnimeService).list(), { initialValue: [] as Anime[] });

  readonly anime = input.required<Anime>();
  readonly items = signal<Anime[]>([]);
  readonly loading = signal(false);

  private currentToken = 0;

  constructor() {
    effect(() => {
      const a = this.anime();
      const all = this.animes();
      if (all.length === 0) return;
      untracked(() => void this.load(a, all));
    });
  }

  async openSimilar(anime: Anime): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AnimeDetailModalComponent,
      componentProps: { anime },
      cssClass: 'anime-detail-modal',
    });
    await modal.present();
  }

  private async load(target: Anime, allAnimes: readonly Anime[]): Promise<void> {
    const token = ++this.currentToken;
    this.loading.set(true);

    const [ratingsRes, favoritesRes, statusRes] = await Promise.all([
      this.supabase
        .from('anime_ratings')
        .select('user_id')
        .eq('anime_id', target.id)
        .gte('score', 7)
        .limit(200),
      this.supabase
        .from('favorites')
        .select('user_id')
        .eq('anime_id', target.id)
        .limit(200),
      this.supabase
        .from('anime_status')
        .select('user_id')
        .eq('anime_id', target.id)
        .eq('status', 'concluido')
        .limit(200),
    ]);
    if (token !== this.currentToken) return;

    const positiveUsers = new Set<string>();
    for (const r of (ratingsRes.data ?? []) as { user_id: string }[]) positiveUsers.add(r.user_id);
    for (const r of (favoritesRes.data ?? []) as { user_id: string }[]) positiveUsers.add(r.user_id);
    for (const r of (statusRes.data ?? []) as { user_id: string }[]) positiveUsers.add(r.user_id);

    const collabCount = new Map<string, number>();

    if (positiveUsers.size > 0) {
      const userIds = [...positiveUsers];
      const [r2, f2, s2] = await Promise.all([
        this.supabase
          .from('anime_ratings')
          .select('user_id, anime_id')
          .in('user_id', userIds)
          .gte('score', 7)
          .limit(2000),
        this.supabase
          .from('favorites')
          .select('user_id, anime_id')
          .in('user_id', userIds)
          .limit(2000),
        this.supabase
          .from('anime_status')
          .select('user_id, anime_id')
          .in('user_id', userIds)
          .eq('status', 'concluido')
          .limit(2000),
      ]);
      if (token !== this.currentToken) return;

      const seen = new Set<string>();
      const tally = (rows: { user_id: string; anime_id: string }[]) => {
        for (const row of rows) {
          if (row.anime_id === target.id) continue;
          const key = `${row.user_id}:${row.anime_id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          collabCount.set(row.anime_id, (collabCount.get(row.anime_id) ?? 0) + 1);
        }
      };
      tally((r2.data ?? []) as { user_id: string; anime_id: string }[]);
      tally((f2.data ?? []) as { user_id: string; anime_id: string }[]);
      tally((s2.data ?? []) as { user_id: string; anime_id: string }[]);
    }

    const targetGenres = new Set(target.generos);
    const targetStudios = new Set(target.estudio);

    const ranked = allAnimes
      .filter((a) => a.id !== target.id)
      .map((a) => {
        const sharedGenres = a.generos.reduce((acc, g) => acc + (targetGenres.has(g) ? 1 : 0), 0);
        const sharedStudio = a.estudio.some((s) => targetStudios.has(s)) ? 1 : 0;
        const collab = collabCount.get(a.id) ?? 0;
        const score = collab * 3 + sharedGenres + sharedStudio * 2;
        return { anime: a, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.anime);

    if (token !== this.currentToken) return;
    this.items.set(ranked);
    this.loading.set(false);
  }
}

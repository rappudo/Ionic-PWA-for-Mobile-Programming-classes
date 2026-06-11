import { ChangeDetectionStrategy, Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  personCircleOutline,
  sendOutline,
  star as starFilled,
  trashOutline,
} from 'ionicons/icons';

import { Anime } from '../../models/anime';
import { Profile } from '../../models/profile';
import { RatingComment, RatingCommentWithAuthor } from '../../models/rating-comment';
import { AnimeRating } from '../../models/user-anime';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-rating-thread-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'rating-thread-modal.component.html',
  styleUrls: ['rating-thread-modal.component.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class RatingThreadModalComponent implements OnInit {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);

  @Input({ required: true }) ratingOwner!: Profile;
  @Input({ required: true }) anime!: Anime;
  @Input({ required: true }) rating!: AnimeRating;

  readonly comments = signal<RatingCommentWithAuthor[]>([]);
  readonly loading = signal(true);
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'person-circle-outline': personCircleOutline,
      'send-outline': sendOutline,
      star: starFilled,
      'trash-outline': trashOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadComments();
  }

  onDraftInput(value: string | number | null | undefined): void {
    this.draft.set(typeof value === 'string' ? value : String(value ?? ''));
  }

  async send(): Promise<void> {
    if (this.sending()) return;
    const me = this.auth.user();
    if (!me) return;
    const body = this.draft().trim();
    if (!body) return;
    if (body.length > 500) {
      this.error.set('Comentário muito longo (máx 500).');
      return;
    }
    this.sending.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('rating_comments')
      .insert({
        rating_user_id: this.ratingOwner.id,
        rating_anime_id: this.anime.id,
        author_id: me.id,
        body,
      })
      .select()
      .single<RatingComment>();

    this.sending.set(false);

    if (error || !data) {
      this.error.set(error?.message ?? 'Falha ao enviar.');
      return;
    }

    const author = this.auth.profile();
    this.comments.update((arr) => [...arr, { ...data, author: author ?? null }]);
    this.draft.set('');
  }

  async delete(commentId: string): Promise<void> {
    const previous = this.comments();
    this.comments.update((arr) => arr.filter((c) => c.id !== commentId));
    const { error } = await this.supabase.from('rating_comments').delete().eq('id', commentId);
    if (error) {
      this.comments.set(previous);
      this.error.set('Não foi possível remover.');
    }
  }

  timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return 'agora';
    const m = Math.floor(s / 60);
    if (m < 60) return `há ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `há ${d}d`;
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }

  private async loadComments(): Promise<void> {
    this.loading.set(true);
    const { data: rows } = await this.supabase
      .from('rating_comments')
      .select('*')
      .eq('rating_user_id', this.ratingOwner.id)
      .eq('rating_anime_id', this.anime.id)
      .order('created_at', { ascending: true });

    const comments = (rows ?? []) as RatingComment[];
    const authorIds = [...new Set(comments.map((c) => c.author_id))];

    let profiles: Map<string, Profile> = new Map();
    if (authorIds.length > 0) {
      const { data: profileRows } = await this.supabase
        .from('profiles')
        .select('*')
        .in('id', authorIds);
      for (const p of (profileRows ?? []) as Profile[]) profiles.set(p.id, p);
    }

    this.comments.set(
      comments.map((c) => ({ ...c, author: profiles.get(c.author_id) ?? null })),
    );
    this.loading.set(false);
  }
}

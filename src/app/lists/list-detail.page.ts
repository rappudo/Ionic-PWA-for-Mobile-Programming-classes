import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonReorder,
  IonReorderGroup,
  IonTitle,
  IonToolbar,
  ItemReorderEventDetail,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkOutline,
  createOutline,
  peopleOutline,
  reorderThreeOutline,
  shareSocialOutline,
  trashOutline,
} from 'ionicons/icons';

import { AnimeCoverComponent } from '../components/anime-cover/anime-cover.component';
import { AnimeDetailModalComponent } from '../components/anime-detail-modal/anime-detail-modal.component';
import { CollaboratorsModalComponent } from '../components/collaborators-modal/collaborators-modal.component';
import { ShareListModalComponent } from '../components/share-list-modal/share-list-modal.component';
import { SkeletonGridComponent } from '../components/skeleton/skeleton-grid.component';
import { Anime } from '../models/anime';
import { AnimeService } from '../services/anime.service';
import { AuthService } from '../services/auth.service';
import { CustomListsService } from '../services/custom-lists.service';



@Component({
  selector: 'app-list-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'list-detail.page.html',
  styleUrls: ['list-detail.page.scss'],
  imports: [
    AnimeCoverComponent,
    FormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonReorder,
    IonReorderGroup,
    IonTitle,
    IonToolbar,
    SkeletonGridComponent,
  ],
})
export class ListDetailPage {
  private readonly listsService = inject(CustomListsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly auth = inject(AuthService);

  readonly listId = signal(this.route.snapshot.paramMap.get('id') ?? '');
  readonly list = computed(() => this.listsService.listById(this.listId()));
  readonly isOwner = computed(() => {
    const list = this.list();
    return !!list && list.role === 'owner';
  });

  private readonly animeService = inject(AnimeService);
  readonly catalogReady = this.animeService.ready;

  private readonly animes = toSignal(this.animeService.list(), { initialValue: [] as Anime[] });
  private readonly animesById = computed(() => {
    const map = new Map<string, Anime>();
    for (const a of this.animes()) map.set(a.id, a);
    return map;
  });

  readonly items = computed<Anime[]>(() => {
    const list = this.list();
    if (!list) return [];
    const lookup = this.animesById();
    return list.anime_ids
      .map((id) => lookup.get(id))
      .filter((a): a is Anime => a !== undefined);
  });

  readonly editing = signal(false);
  readonly draftName = signal('');
  readonly errorMsg = signal<string | null>(null);
  readonly reordering = signal(false);

  constructor() {
    addIcons({
      'checkmark-outline': checkmarkOutline,
      'create-outline': createOutline,
      'people-outline': peopleOutline,
      'reorder-three-outline': reorderThreeOutline,
      'share-social-outline': shareSocialOutline,
      'trash-outline': trashOutline,
    });
  }

  async openCollaborators(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: CollaboratorsModalComponent,
      componentProps: { listId: this.listId() },
    });
    await modal.present();
  }

  async openShare(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ShareListModalComponent,
      componentProps: { listId: this.listId() },
    });
    await modal.present();
  }

  toggleReorder(): void {
    this.reordering.update((v) => !v);
  }

  async onReorder(event: CustomEvent<ItemReorderEventDetail>): Promise<void> {
    const { from, to } = event.detail;
    const items = [...this.items()];
    const moved = items.splice(from, 1)[0];
    items.splice(to, 0, moved);
    event.detail.complete();
    await this.listsService.reorderItems(
      this.listId(),
      items.map((a) => a.id),
    );
  }

  startEdit(): void {
    const list = this.list();
    if (!list) return;
    this.draftName.set(list.name);
    this.errorMsg.set(null);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.errorMsg.set(null);
  }

  async saveEdit(): Promise<void> {
    const name = this.draftName().trim();
    if (!name) return;
    const result = await this.listsService.renameList(this.listId(), name);
    if (!result.ok) {
      this.errorMsg.set(result.message);
      return;
    }
    this.editing.set(false);
  }

  onNameInput(value: string | number | null | undefined): void {
    this.draftName.set(typeof value === 'string' ? value : String(value ?? ''));
  }

  async openDetail(anime: Anime): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AnimeDetailModalComponent,
      componentProps: { anime },
      cssClass: 'anime-detail-modal',
    });
    await modal.present();
  }

  async confirmRemove(anime: Anime): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Remover da lista',
      message: `Remover "${anime.nome[0]}" desta lista?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Remover',
          role: 'destructive',
          handler: () => {
            void this.listsService.removeAnime(this.listId(), anime.id);
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmDelete(): Promise<void> {
    const list = this.list();
    if (!list) return;
    const alert = await this.alertCtrl.create({
      header: 'Excluir lista',
      message: `Excluir "${list.name}"? Não pode ser desfeito.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: async () => {
            const ok = await this.listsService.deleteList(this.listId());
            if (ok) await this.router.navigateByUrl('/lists', { replaceUrl: true });
          },
        },
      ],
    });
    await alert.present();
  }
}

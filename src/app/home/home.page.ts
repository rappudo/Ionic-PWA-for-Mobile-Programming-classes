import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  ModalController,
  SearchbarCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronDownOutline,
  chevronForwardOutline,
  chevronUpOutline,
  closeOutline,
} from 'ionicons/icons';

import { AnimeCoverComponent } from '../components/anime-cover/anime-cover.component';
import { AnimeDetailModalComponent } from '../components/anime-detail-modal/anime-detail-modal.component';
import { FilterPickerModalComponent } from '../components/filter-picker-modal/filter-picker-modal.component';
import { Anime, ClassificacaoIndicativa, Recomendacao } from '../models/anime';
import { RECOMENDACAO_META } from '../models/recomendacao';
import { buildHaystack, matchesQuery } from '../services/anime-search';
import { AnimeService } from '../services/anime.service';

interface IndexedAnime {
  readonly anime: Anime;
  readonly haystack: string;
}

interface Filters {
  generos: string[];
  estudios: string[];
  plataformas: string[];
  classificacoes: ClassificacaoIndicativa[];
  prioridades: Recomendacao[];
}

const EMPTY_FILTERS: Filters = {
  generos: [],
  estudios: [],
  plataformas: [],
  classificacoes: [],
  prioridades: [],
};

type SortKey = 'recomendacao' | 'alfabetico' | 'lancamento';
type PickerFilterKey = 'generos' | 'estudios' | 'plataformas';

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'recomendacao', label: 'Prioridade' },
  { value: 'alfabetico', label: 'A-Z' },
  { value: 'lancamento', label: 'Lançamento' },
];

const PICKER_TITLES: Record<PickerFilterKey, string> = {
  generos: 'Gêneros',
  estudios: 'Estúdios',
  plataformas: 'Onde ver',
};

const RECOMENDACAO_RANK: Record<Recomendacao, number> = {
  veja_imediatamente: 0,
  veja: 1,
  media_prioridade: 2,
  baixa_prioridade: 3,
};

const RECOMENDACAO_ORDER: Recomendacao[] = [
  'veja_imediatamente',
  'veja',
  'media_prioridade',
  'baixa_prioridade',
];

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    AnimeCoverComponent,
    IonBadge,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
  ],
})
export class HomePage {
  private readonly modalCtrl = inject(ModalController);

  readonly query = signal('');
  readonly sortBy = signal<SortKey>('recomendacao');
  readonly filtersOpen = signal(false);
  readonly filters = signal<Filters>(EMPTY_FILTERS);
  readonly sortOptions = SORT_OPTIONS;

  readonly activeFilterCount = computed(() => {
    const f = this.filters();
    return (
      f.generos.length +
      f.estudios.length +
      f.plataformas.length +
      f.classificacoes.length +
      f.prioridades.length
    );
  });

  private readonly animes = toSignal(inject(AnimeService).list(), {
    initialValue: [] as Anime[],
  });

  private readonly indexed = computed<IndexedAnime[]>(() =>
    this.animes().map((anime) => ({ anime, haystack: buildHaystack(anime) })),
  );

  readonly availableGeneros = computed(() => uniqueSorted(this.animes().flatMap((a) => a.generos)));
  readonly availableEstudios = computed(() => uniqueSorted(this.animes().flatMap((a) => a.estudio)));
  readonly availablePlataformas = computed(() =>
    uniqueSorted(this.animes().flatMap((a) => a.ondeVer)),
  );
  readonly availableClassificacoes = computed<ClassificacaoIndicativa[]>(() => {
    const order: ClassificacaoIndicativa[] = ['L', '10', '12', '14', '16', '18'];
    const present = new Set(
      this.animes()
        .map((a) => a.classificacaoIndicativa)
        .filter((c): c is ClassificacaoIndicativa => c !== null),
    );
    return order.filter((c) => present.has(c));
  });
  readonly availablePrioridades = computed<Recomendacao[]>(() => {
    const present = new Set(this.animes().map((a) => a.recomendacao));
    return RECOMENDACAO_ORDER.filter((r) => present.has(r));
  });

  readonly recomendacaoLabel = (r: Recomendacao): string => RECOMENDACAO_META[r].label;
  readonly classificacaoLabel = (c: ClassificacaoIndicativa): string =>
    c === 'L' ? 'Livre' : `${c} anos`;

  readonly filtered = computed<Anime[]>(() => {
    const q = this.query();
    const f = this.filters();
    const base = q.trim()
      ? this.indexed()
          .filter((entry) => matchesQuery(entry.haystack, q))
          .map((entry) => entry.anime)
      : this.animes();

    const afterFilters = base.filter((a) => this.matchesFilters(a, f));
    return this.applySort(afterFilters, this.sortBy());
  });

  constructor() {
    addIcons({
      'chevron-down-outline': chevronDownOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'chevron-up-outline': chevronUpOutline,
      'close-outline': closeOutline,
    });
  }

  onSearch(event: SearchbarCustomEvent): void {
    this.query.set(event.detail.value ?? '');
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  clearFilters(): void {
    this.filters.set(EMPTY_FILTERS);
  }

  summarize(key: PickerFilterKey): string {
    const values = this.filters()[key];
    if (values.length === 0) return 'Todos';
    if (values.length === 1) return values[0];
    return `${values.length} selecionados`;
  }

  onSortChange(event: Event): void {
    const value = (event as CustomEvent<{ value: SortKey }>).detail.value;
    this.sortBy.set(value);
  }

  onClassificacoesChange(event: Event): void {
    const value = (event as CustomEvent<{ value: ClassificacaoIndicativa[] }>).detail.value;
    this.filters.update((f) => ({ ...f, classificacoes: value }));
  }

  onPrioridadesChange(event: Event): void {
    const value = (event as CustomEvent<{ value: Recomendacao[] }>).detail.value;
    this.filters.update((f) => ({ ...f, prioridades: value }));
  }

  async openPicker(key: PickerFilterKey): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: FilterPickerModalComponent,
      componentProps: {
        title: PICKER_TITLES[key],
        options: this.optionsFor(key),
        initialSelected: this.filters()[key],
      },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<string[]>();
    if (role === 'apply' && data) {
      this.filters.update((f) => ({ ...f, [key]: data }));
    }
  }

  async openDetail(anime: Anime): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AnimeDetailModalComponent,
      componentProps: { anime },
      cssClass: 'anime-detail-modal',
    });
    await modal.present();
  }

  private optionsFor(key: PickerFilterKey): readonly string[] {
    switch (key) {
      case 'generos':
        return this.availableGeneros();
      case 'estudios':
        return this.availableEstudios();
      case 'plataformas':
        return this.availablePlataformas();
    }
  }

  private matchesFilters(anime: Anime, f: Filters): boolean {
    if (f.generos.length && !anime.generos.some((g) => f.generos.includes(g))) return false;
    if (f.estudios.length && !anime.estudio.some((s) => f.estudios.includes(s))) return false;
    if (f.plataformas.length && !anime.ondeVer.some((p) => f.plataformas.includes(p)))
      return false;
    if (
      f.classificacoes.length &&
      (anime.classificacaoIndicativa === null ||
        !f.classificacoes.includes(anime.classificacaoIndicativa))
    )
      return false;
    if (f.prioridades.length && !f.prioridades.includes(anime.recomendacao)) return false;
    return true;
  }

  private applySort(list: readonly Anime[], key: SortKey): Anime[] {
    const copy = [...list];
    switch (key) {
      case 'recomendacao':
        return copy.sort((a, b) => {
          const diff = RECOMENDACAO_RANK[a.recomendacao] - RECOMENDACAO_RANK[b.recomendacao];
          return diff !== 0 ? diff : a.nome[0].localeCompare(b.nome[0], 'pt-BR');
        });
      case 'alfabetico':
        return copy.sort((a, b) => a.nome[0].localeCompare(b.nome[0], 'pt-BR'));
      case 'lancamento':
        return copy.sort((a, b) => b.dataLancamento.localeCompare(a.dataLancamento));
    }
  }
}

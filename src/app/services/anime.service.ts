import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { Anime } from '../models/anime';

@Injectable({ providedIn: 'root' })
export class AnimeService {
  private readonly http = inject(HttpClient);
  private readonly _ready = signal(false);

  readonly ready = this._ready.asReadonly();

  private readonly animes$: Observable<Anime[]> = this.http
    .get<Anime[]>('assets/animes.json')
    .pipe(
      tap(() => this._ready.set(true)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

  list(): Observable<Anime[]> {
    return this.animes$;
  }
}

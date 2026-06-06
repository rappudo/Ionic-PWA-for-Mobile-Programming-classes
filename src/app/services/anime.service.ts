import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { Anime } from '../models/anime';

@Injectable({ providedIn: 'root' })
export class AnimeService {
  private readonly http = inject(HttpClient);

  private readonly animes$: Observable<Anime[]> = this.http
    .get<Anime[]>('assets/animes.json')
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  list(): Observable<Anime[]> {
    return this.animes$;
  }
}

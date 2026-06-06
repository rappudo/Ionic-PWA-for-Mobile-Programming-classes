import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { Anime } from '../../models/anime';
import { AnimeCardComponent } from './anime-card.component';

const animeMock: Anime = {
  id: 'mock',
  nome: ['Mock Anime'],
  sinopse: 'sinopse',
  generos: ['ação'],
  estudio: ['Estúdio Teste'],
  ondeVer: ['Crunchyroll'],
  temporadas: 1,
  filmes: 0,
  episodios: 12,
  porcentagemDublado: 100,
  dataLancamento: '2024-01-01',
  classificacaoIndicativa: 'L',
  recomendacao: 'veja',
  ordem: null,
  imagem: null,
};

describe('AnimeCardComponent', () => {
  let component: AnimeCardComponent;
  let fixture: ComponentFixture<AnimeCardComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [AnimeCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AnimeCardComponent);
    fixture.componentRef.setInput('anime', animeMock);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

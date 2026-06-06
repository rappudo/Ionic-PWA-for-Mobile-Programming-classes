export type Recomendacao =
  | 'veja_imediatamente'
  | 'veja'
  | 'media_prioridade'
  | 'baixa_prioridade';

export type ClassificacaoIndicativa = 'L' | '10' | '12' | '14' | '16' | '18';

export interface Anime {
  id: string;
  nome: string[];
  sinopse: string;
  generos: string[];
  estudio: string[];
  ondeVer: string[];
  temporadas: number;
  filmes: number;
  episodios: number;
  porcentagemDublado: number;
  dataLancamento: string;
  classificacaoIndicativa: ClassificacaoIndicativa | null;
  recomendacao: Recomendacao;
  ordem: number | null;
  imagem: string | null;
}

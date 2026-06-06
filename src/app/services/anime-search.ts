import { Anime, ClassificacaoIndicativa } from '../models/anime';
import { RECOMENDACAO_META } from '../models/recomendacao';

export function normalize(value: string): string {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function classificacaoHaystack(c: ClassificacaoIndicativa | null): string {
  if (c === null) return '';
  return c === 'L' ? 'L Livre' : c;
}

export function buildHaystack(anime: Anime): string {
  return normalize(
    [
      ...anime.nome,
      ...anime.generos,
      ...anime.estudio,
      ...anime.ondeVer,
      classificacaoHaystack(anime.classificacaoIndicativa),
      RECOMENDACAO_META[anime.recomendacao].label,
    ].join(' '),
  );
}

export function matchesQuery(haystack: string, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => haystack.includes(token));
}

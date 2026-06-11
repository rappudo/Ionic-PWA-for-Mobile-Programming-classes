export interface AnimeRating {
  user_id: string;
  anime_id: string;
  score: number | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  user_id: string;
  anime_id: string;
  created_at: string;
}

export type WatchStatus = 'assistindo' | 'concluido' | 'planejado' | 'pausado' | 'dropei';

export interface AnimeStatus {
  user_id: string;
  anime_id: string;
  status: WatchStatus;
  episodes_watched: number;
  updated_at: string;
}

export const WATCH_STATUSES: ReadonlyArray<{ value: WatchStatus; label: string; color: string }> = [
  { value: 'assistindo', label: 'Assistindo', color: '#3b82f6' },
  { value: 'concluido', label: 'Concluído', color: '#16a34a' },
  { value: 'planejado', label: 'Planejado', color: '#a855f7' },
  { value: 'pausado', label: 'Pausado', color: '#eab308' },
  { value: 'dropei', label: 'Dropei', color: '#ef4444' },
];

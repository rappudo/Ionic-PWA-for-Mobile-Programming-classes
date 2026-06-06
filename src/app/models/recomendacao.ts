import { Recomendacao } from './anime';

export interface RecomendacaoMeta {
  label: string;
  color: 'success' | 'primary' | 'warning' | 'medium';
}

export const RECOMENDACAO_META: Record<Recomendacao, RecomendacaoMeta> = {
  veja_imediatamente: { label: 'Veja imediatamente', color: 'success' },
  veja:               { label: 'Veja',               color: 'primary' },
  media_prioridade:   { label: 'Média prioridade',   color: 'warning' },
  baixa_prioridade:   { label: 'Baixa prioridade',   color: 'medium'  },
};

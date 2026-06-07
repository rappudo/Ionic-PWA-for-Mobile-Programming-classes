import { Recomendacao } from './anime';

export type RecomendacaoColor = 'prio-best' | 'prio-good' | 'prio-mid' | 'prio-low';

export interface RecomendacaoMeta {
  label: string;
  color: RecomendacaoColor;
}

export const RECOMENDACAO_META: Record<Recomendacao, RecomendacaoMeta> = {
  veja_imediatamente: { label: 'Veja imediatamente', color: 'prio-best' },
  veja:               { label: 'Veja',               color: 'prio-good' },
  media_prioridade:   { label: 'Média prioridade',   color: 'prio-mid'  },
  baixa_prioridade:   { label: 'Baixa prioridade',   color: 'prio-low'  },
};

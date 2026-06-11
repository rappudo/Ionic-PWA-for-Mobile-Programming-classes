export interface WatchTimeFormat {
  primary: string;
  secondary: string | null;
}

export function formatWatchTime(minutes: number): WatchTimeFormat {
  if (minutes < 60) {
    return { primary: `${minutes} min`, secondary: null };
  }
  const totalHours = Math.floor(minutes / 60);
  if (totalHours < 24) {
    return { primary: `${totalHours}h`, secondary: null };
  }
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return {
    primary: `${totalHours}h`,
    secondary: remHours === 0 ? `≈ ${days} ${days === 1 ? 'dia' : 'dias'}` : `≈ ${days}d ${remHours}h`,
  };
}

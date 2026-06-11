const BUILDERS: Record<string, (q: string) => string> = {
  Crunchyroll: (q) => `https://www.crunchyroll.com/search?q=${encodeURIComponent(q)}`,
  Netflix: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
  'Disney+': (q) => `https://www.disneyplus.com/search?q=${encodeURIComponent(q)}`,
};

export function streamingSearchUrl(platform: string, query: string): string | null {
  const build = BUILDERS[platform];
  return build ? build(query) : null;
}

export function hasStreamingLink(platform: string): boolean {
  return platform in BUILDERS;
}

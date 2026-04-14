export interface Release {
  mbid: string;
  title: string;
  artist: string;
  artistMbid: string;
  date: string;
  year: string;
  country: string;
  label: string;
  catalogNumber: string;
  format: string;
  trackCount: number;
  tracks: Track[];
  genres: string[];
  coverUrl: string;
  releaseGroupMbid: string;
  releaseType: string;
  status: string;
  barcode: string;
  disambiguation: string;
  mbUrl: string;
  discogsUrl: string;
  wikipediaUrl: string;
}

export interface Track {
  number: string;
  title: string;
  duration: string;
  durationMs: number;
}

export function formatDuration(ms: number): string {
  if (!ms) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

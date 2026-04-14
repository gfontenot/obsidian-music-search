import { Release, Track, formatDuration } from '../models/release.model';

const MB_API_BASE = 'https://musicbrainz.org/ws/2';
const COVER_ART_BASE = 'https://coverartarchive.org/release';
const USER_AGENT = 'ObsidianMusicSearch/1.0.0 (https://github.com/your-username/obsidian-music-search)';

interface MBSearchResult {
  releases: MBRelease[];
  count: number;
  offset: number;
}

interface MBRelease {
  id: string;
  title: string;
  date?: string;
  country?: string;
  status?: string;
  barcode?: string;
  disambiguation?: string;
  'artist-credit'?: MBArtistCredit[];
  'label-info'?: MBLabelInfo[];
  media?: MBMedium[];
  'release-group'?: MBReleaseGroup;
  genres?: MBGenre[];
  score?: number;
}

interface MBReleaseGroup {
  id: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
  genres?: MBGenre[];
  tags?: MBTag[];
}

interface MBArtistCredit {
  artist: {
    id: string;
    name: string;
    'sort-name': string;
  };
  name?: string;
  joinphrase?: string;
}

interface MBLabelInfo {
  label?: {
    id: string;
    name: string;
  };
  'catalog-number'?: string;
}

interface MBMedium {
  format?: string;
  'track-count': number;
  tracks?: MBTrack[];
}

interface MBTrack {
  number: string;
  title: string;
  length?: number;
  position: number;
}

interface MBGenre {
  name: string;
  count: number;
}

interface MBTag {
  name: string;
  count: number;
}

async function mbFetch(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function searchReleases(query: string): Promise<Release[]> {
  const encoded = encodeURIComponent(query);
  const url = `${MB_API_BASE}/release?query=${encoded}&limit=25&fmt=json&inc=artist-credits+labels+release-groups+genres`;

  const data = await mbFetch(url) as MBSearchResult;

  const releases = await Promise.all(
    (data.releases || []).map(r => mapMBRelease(r))
  );

  return releases;
}

export async function getReleaseDetails(mbid: string): Promise<Release> {
  const url = `${MB_API_BASE}/release/${mbid}?fmt=json&inc=artist-credits+labels+recordings+release-groups+genres+tags+url-rels`;
  const data = await mbFetch(url) as MBRelease;
  return mapMBRelease(data, true);
}

async function getCoverArtUrl(mbid: string): Promise<string> {
  try {
    const url = `${COVER_ART_BASE}/${mbid}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
    if (response.ok) {
      const data = await response.json() as { images: Array<{ front: boolean; image: string; thumbnails: { small: string; large: string } }> };
      const front = data.images?.find(img => img.front);
      if (front) {
        return front.thumbnails?.large || front.thumbnails?.small || front.image;
      }
    }
  } catch {
    // Cover art not available
  }
  return '';
}

async function mapMBRelease(r: MBRelease, includeTracks = false): Promise<Release> {
  const artistCredit = r['artist-credit'] || [];
  const artist = artistCredit
    .map(ac => (ac.name || ac.artist?.name || '') + (ac.joinphrase || ''))
    .join('') || 'Unknown Artist';

  const artistMbid = artistCredit[0]?.artist?.id || '';

  const labelInfo = r['label-info'] || [];
  const label = labelInfo[0]?.label?.name || '';
  const catalogNumber = labelInfo[0]?.['catalog-number'] || '';

  const media = r.media || [];
  const format = media.map(m => m.format || 'Unknown').join(' + ') || '';
  const trackCount = media.reduce((sum, m) => sum + (m['track-count'] || 0), 0);

  const releaseGroup = r['release-group'] || {} as MBReleaseGroup;
  const releaseType = [
    releaseGroup['primary-type'],
    ...(releaseGroup['secondary-types'] || []),
  ].filter(Boolean).join(' + ') || '';

  // Gather genres from release and release group
  const allGenres = [
    ...(r.genres || []),
    ...(releaseGroup.genres || []),
    ...(releaseGroup.tags || []),
  ];
  const genreMap = new Map<string, number>();
  for (const g of allGenres) {
    genreMap.set(g.name, (genreMap.get(g.name) || 0) + g.count);
  }
  const genres = Array.from(genreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  const date = r.date || '';
  const year = date ? date.substring(0, 4) : '';

  let tracks: Track[] = [];
  if (includeTracks && media.length > 0) {
    let trackNum = 1;
    for (const medium of media) {
      for (const t of (medium.tracks || [])) {
        tracks.push({
          number: t.number || String(trackNum),
          title: t.title,
          duration: t.length ? formatDuration(t.length) : '',
          durationMs: t.length || 0,
        });
        trackNum++;
      }
    }
  }

  // Try to get cover art
  let coverUrl = '';
  if (r.id) {
    coverUrl = await getCoverArtUrl(r.id);
  }

  return {
    mbid: r.id,
    title: r.title,
    artist,
    artistMbid,
    date,
    year,
    country: r.country || '',
    label,
    catalogNumber,
    format,
    trackCount,
    tracks,
    genres,
    coverUrl,
    releaseGroupMbid: releaseGroup.id || '',
    releaseType,
    status: r.status || '',
    barcode: r.barcode || '',
    disambiguation: r.disambiguation || '',
    mbUrl: `https://musicbrainz.org/release/${r.id}`,
  };
}

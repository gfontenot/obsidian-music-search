// obsidian-music-search
// Copyright (C) 2026 Gordon Fontenot
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { requestUrl } from 'obsidian';
import { Edition, Release, Track, formatDuration } from '../models/release.model';

const MB_API_BASE = 'https://musicbrainz.org/ws/2';
const COVER_ART_BASE = 'https://coverartarchive.org';
const USER_AGENT = 'ObsidianMusicSearch/1.0.0 (https://codeberg.org/gfontenot/obsidian-music-search)';

export interface SearchQuery {
  artist: string;
  release: string;
}

interface MBReleaseGroupSearchResult {
  'release-groups': MBReleaseGroupItem[];
  count: number;
  offset: number;
}

interface MBReleaseGroupItem {
  id: string;
  title: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
  disambiguation?: string;
  'artist-credit'?: MBArtistCredit[];
  genres?: MBGenre[];
  tags?: MBTag[];
  releases?: MBReleaseStub[];
  relations?: MBUrlRelation[];
  score?: number;
}

interface MBUrlRelation {
  type: string;
  'target-type': string;
  url: {
    resource: string;
  };
}

interface MBReleaseStub {
  id: string;
  title: string;
  date?: string;
  status?: string;
  media?: MBMedium[];
  country?: string;
  disambiguation?: string;
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
  const response = await requestUrl({
    url,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
    throw: false,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`MusicBrainz API error: ${response.status}`);
  }
  return response.json;
}

function buildLuceneQuery(query: SearchQuery): string {
  const parts: string[] = [];
  if (query.artist.trim()) parts.push(`artist:"${query.artist.trim()}"`);
  if (query.release.trim()) parts.push(`releasegroup:"${query.release.trim()}"`);
  return parts.join(' AND ');
}

export async function searchReleases(query: SearchQuery): Promise<Release[]> {
  const encoded = encodeURIComponent(buildLuceneQuery(query));
  const url = `${MB_API_BASE}/release-group?query=${encoded}&limit=25&fmt=json&inc=artist-credits+genres`;

  const data = await mbFetch(url) as MBReleaseGroupSearchResult;

  return Promise.all(
    (data['release-groups'] || []).map(rg => mapMBReleaseGroup(rg))
  );
}

function deriveFormat(media: MBMedium[]): string {
  if (!media || media.length === 0) return 'Unknown';
  const counts = new Map<string, number>();
  for (const medium of media) {
    const fmt = medium.format || 'Unknown';
    counts.set(fmt, (counts.get(fmt) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([fmt, n]) => n === 1 ? fmt : `${n}× ${fmt}`)
    .join(' + ');
}

export async function getEditions(releaseGroupMbid: string, groupCoverUrl = ''): Promise<Edition[]> {
  const url = `${MB_API_BASE}/release-group/${releaseGroupMbid}?fmt=json&inc=releases+media`;
  const data = await mbFetch(url) as MBReleaseGroupItem;
  const releases = data.releases || [];

  const mapped = await Promise.all(
    releases.map(async (r): Promise<Edition> => {
      const media = r.media || [];
      const releaseCoverUrl = await getCoverArtUrl(r.id, 'release');
      return {
        mbid: r.id,
        title: r.title,
        date: r.date || '',
        year: r.date ? r.date.substring(0, 4) : '',
        status: r.status || '',
        format: deriveFormat(media),
        trackCount: media.reduce((sum, m) => sum + (m['track-count'] || 0), 0),
        mediaCount: media.length,
        country: r.country || '',
        disambiguation: r.disambiguation || '',
        coverUrl: releaseCoverUrl || groupCoverUrl,
      };
    })
  );

  return mapped.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export async function getReleaseDetails(releaseGroupMbid: string, existingCoverUrl = '', selectedReleaseId?: string): Promise<Release> {
  const url = `${MB_API_BASE}/release-group/${releaseGroupMbid}?fmt=json&inc=artist-credits+releases+genres+tags+url-rels`;
  const data = await mbFetch(url) as MBReleaseGroupItem;

  // Find the primary release to get the tracklist
  const releases = data.releases || [];
  const primaryRelease = selectedReleaseId
    ? (releases.find(r => r.id === selectedReleaseId) ?? pickPrimaryRelease(releases))
    : pickPrimaryRelease(releases);

  let tracks: Track[] = [];
  let trackCount = 0;

  if (primaryRelease) {
    const releaseUrl = `${MB_API_BASE}/release/${primaryRelease.id}?fmt=json&inc=recordings`;
    const releaseData = await mbFetch(releaseUrl) as MBReleaseStub & { media?: MBMedium[] };
    const media = releaseData.media || [];

    trackCount = media.reduce((sum, m) => sum + (m['track-count'] || 0), 0);

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

  const relations = data.relations || [];
  const discogsUrl = extractUrlRelation(relations, 'discogs');
  const wikidataUrl = extractUrlRelation(relations, 'wikidata');
  const wikipediaUrl = wikidataUrl ? await getWikipediaUrl(wikidataUrl) : '';

  // Try release-specific cover art first, fall back to release-group art
  let coverUrl = existingCoverUrl;
  if (selectedReleaseId) {
    const releaseCoverUrl = await getCoverArtUrl(selectedReleaseId, 'release');
    if (releaseCoverUrl) coverUrl = releaseCoverUrl;
  }

  const release = await mapMBReleaseGroup(data, coverUrl);
  return { ...release, tracks, trackCount: trackCount || release.trackCount, discogsUrl, wikipediaUrl };
}

function extractUrlRelation(relations: MBUrlRelation[], type: string): string {
  return relations.find(r => r['target-type'] === 'url' && r.type === type)?.url?.resource || '';
}

async function getWikipediaUrl(wikidataUrl: string): Promise<string> {
  try {
    const entityId = wikidataUrl.split('/').pop();
    if (!entityId) return '';
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=sitelinks/urls&sitefilter=enwiki&format=json&origin=*`;
    const response = await requestUrl({
      url,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      throw: false,
    });
    if (response.status < 200 || response.status >= 300) return '';
    const data = response.json as {
      entities: Record<string, { sitelinks?: { enwiki?: { url: string } } }>;
    };
    return data.entities[entityId]?.sitelinks?.enwiki?.url || '';
  } catch {
    return '';
  }
}

function pickPrimaryRelease(releases: MBReleaseStub[]): MBReleaseStub | undefined {
  const official = releases.filter(r => r.status === 'Official');
  const pool = official.length > 0 ? official : releases;
  return pool.slice().sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    return da < db ? -1 : da > db ? 1 : 0;
  })[0];
}

async function getCoverArtUrl(mbid: string, type: 'release-group' | 'release' = 'release-group'): Promise<string> {
  try {
    const url = `${COVER_ART_BASE}/${type}/${mbid}`;
    const response = await requestUrl({
      url,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      throw: false,
    });
    if (response.status >= 200 && response.status < 300) {
      const data = response.json as { images: Array<{ front: boolean; image: string; thumbnails: { small: string; large: string } }> };
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

async function mapMBReleaseGroup(rg: MBReleaseGroupItem, existingCoverUrl = ''): Promise<Release> {
  const artistCredit = rg['artist-credit'] || [];
  const artist = artistCredit
    .map(ac => (ac.name || ac.artist?.name || '') + (ac.joinphrase || ''))
    .join('') || 'Unknown Artist';

  const artistMbid = artistCredit[0]?.artist?.id || '';

  const releaseType = [
    rg['primary-type'],
    ...(rg['secondary-types'] || []),
  ].filter(Boolean).join(' + ') || '';

  const allGenres = [
    ...(rg.genres || []),
    ...(rg.tags || []),
  ];
  const genreMap = new Map<string, number>();
  for (const g of allGenres) {
    genreMap.set(g.name, (genreMap.get(g.name) || 0) + g.count);
  }
  const genres = Array.from(genreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  const date = rg['first-release-date'] || '';
  const year = date ? date.substring(0, 4) : '';

  let coverUrl = existingCoverUrl;
  if (!coverUrl && rg.id) {
    coverUrl = await getCoverArtUrl(rg.id);
  }

  return {
    mbid: rg.id,
    title: rg.title,
    artist,
    artistMbid,
    date,
    year,
    country: '',
    label: '',
    catalogNumber: '',
    format: '',
    trackCount: 0,
    tracks: [],
    genres,
    coverUrl,
    releaseGroupMbid: rg.id,
    releaseType,
    status: '',
    barcode: '',
    disambiguation: rg.disambiguation || '',
    mbUrl: `https://musicbrainz.org/release-group/${rg.id}`,
    discogsUrl: '',
    wikipediaUrl: '',
  };
}

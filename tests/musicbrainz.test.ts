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

import { searchReleases, getReleaseDetails, getEditions, SearchQuery } from '../src/api/musicbrainz';

const q = (artist: string, release = ''): SearchQuery => ({ artist, release });

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Silence cover-art fetch failures in tests that don't set them up
function makeCoverArtResponse(url: string) {
  if (url.includes('coverartarchive.org')) {
    return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
  }
  return null;
}

function setupFetch(handlers: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string) => {
    const coverArt = makeCoverArtResponse(url);
    if (coverArt) return coverArt;

    for (const [pattern, body] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(body),
        });
      }
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({}),
    });
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ─── Sample fixtures ──────────────────────────────────────────────────────────

const RELEASE_GROUP = {
  id: 'rg-001',
  title: 'OK Computer',
  'first-release-date': '1997-05-21',
  'primary-type': 'Album',
  'secondary-types': [],
  disambiguation: '',
  'artist-credit': [
    {
      artist: { id: 'artist-001', name: 'Radiohead', 'sort-name': 'Radiohead' },
      name: 'Radiohead',
      joinphrase: '',
    },
  ],
  genres: [{ name: 'alternative rock', count: 15 }],
  tags: [{ name: 'art rock', count: 8 }],
};

const RELEASE_GROUP_WITH_RELEASES = {
  ...RELEASE_GROUP,
  releases: [
    { id: 'rel-001', title: 'OK Computer', date: '1997-05-21', status: 'Official' },
    { id: 'rel-002', title: 'OK Computer', date: '1997-06-01', status: 'Official' },
  ],
};

const RELEASE_GROUP_WITH_URLS = {
  ...RELEASE_GROUP_WITH_RELEASES,
  relations: [
    { type: 'discogs', 'target-type': 'url', url: { resource: 'https://www.discogs.com/master/14223' } },
    { type: 'wikidata', 'target-type': 'url', url: { resource: 'https://www.wikidata.org/wiki/Q202996' } },
  ],
};

const WIKIDATA_RESPONSE = {
  entities: {
    Q202996: {
      sitelinks: {
        enwiki: { url: 'https://en.wikipedia.org/wiki/OK_Computer' },
      },
    },
  },
};

const RELEASE_DETAIL = {
  id: 'rel-001',
  title: 'OK Computer',
  'label-info': [
    { label: { id: 'label-001', name: 'Parlophone' }, 'catalog-number': 'NODATA 01' },
  ],
  media: [
    {
      format: 'CD',
      'track-count': 2,
      tracks: [
        { number: '1', title: 'Airbag', length: 284000, position: 1 },
        { number: '2', title: 'Paranoid Android', length: 383000, position: 2 },
      ],
    },
  ],
};

// ─── searchReleases ───────────────────────────────────────────────────────────

describe('searchReleases', () => {
  it('returns mapped releases from release-group results', async () => {
    setupFetch({
      '/release-group': { 'release-groups': [RELEASE_GROUP], count: 1, offset: 0 },
    });

    const results = await searchReleases(q('Radiohead', 'OK Computer'));
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.mbid).toBe('rg-001');
    expect(r.releaseGroupMbid).toBe('rg-001');
    expect(r.title).toBe('OK Computer');
    expect(r.artist).toBe('Radiohead');
    expect(r.artistMbid).toBe('artist-001');
    expect(r.year).toBe('1997');
    expect(r.date).toBe('1997-05-21');
    expect(r.releaseType).toBe('Album');
    expect(r.mbUrl).toBe('https://musicbrainz.org/release-group/rg-001');
  });

  it('merges genres and tags, sorted by vote count', async () => {
    setupFetch({
      '/release-group': { 'release-groups': [RELEASE_GROUP], count: 1, offset: 0 },
    });

    const [r] = await searchReleases(q('Radiohead'));
    // alternative rock: 15, art rock: 8 → alternative rock first
    expect(r.genres[0]).toBe('alternative rock');
    expect(r.genres[1]).toBe('art rock');
  });

  it('handles secondary release types', async () => {
    const rgWithSecondary = {
      ...RELEASE_GROUP,
      'primary-type': 'Album',
      'secondary-types': ['Compilation'],
    };
    setupFetch({
      '/release-group': { 'release-groups': [rgWithSecondary], count: 1, offset: 0 },
    });

    const [r] = await searchReleases(q('test'));
    expect(r.releaseType).toBe('Album + Compilation');
  });

  it('returns empty array when no results', async () => {
    setupFetch({
      '/release-group': { 'release-groups': [], count: 0, offset: 0 },
    });

    const results = await searchReleases(q('xyzzy'));
    expect(results).toHaveLength(0);
  });

  it('handles missing artist-credit gracefully', async () => {
    const rgNoArtist = { ...RELEASE_GROUP, 'artist-credit': undefined };
    setupFetch({
      '/release-group': { 'release-groups': [rgNoArtist], count: 1, offset: 0 },
    });

    const [r] = await searchReleases(q('test'));
    expect(r.artist).toBe('Unknown Artist');
    expect(r.artistMbid).toBe('');
  });

  it('handles artist joinphrase (e.g. "A & B")', async () => {
    const rgMultiArtist = {
      ...RELEASE_GROUP,
      'artist-credit': [
        { artist: { id: 'a1', name: 'Artist A', 'sort-name': 'A' }, joinphrase: ' & ' },
        { artist: { id: 'a2', name: 'Artist B', 'sort-name': 'B' }, joinphrase: '' },
      ],
    };
    setupFetch({
      '/release-group': { 'release-groups': [rgMultiArtist], count: 1, offset: 0 },
    });

    const [r] = await searchReleases(q('test'));
    expect(r.artist).toBe('Artist A & Artist B');
  });

  it('populates cover art URL when available', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/release-group') && !url.includes('coverartarchive')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 'release-groups': [RELEASE_GROUP], count: 1, offset: 0 }),
        });
      }
      if (url.includes('coverartarchive.org')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            images: [{ front: true, image: 'https://example.com/full.jpg', thumbnails: { large: 'https://example.com/large.jpg', small: 'https://example.com/small.jpg' } }],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const [r] = await searchReleases(q('Radiohead'));
    expect(r.coverUrl).toBe('https://example.com/large.jpg');
  });

  it('leaves coverUrl empty when cover art is unavailable', async () => {
    setupFetch({
      '/release-group': { 'release-groups': [RELEASE_GROUP], count: 1, offset: 0 },
    });

    const [r] = await searchReleases(q('Radiohead'));
    expect(r.coverUrl).toBe('');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' });
    await expect(searchReleases(q('test'))).rejects.toThrow('MusicBrainz API error: 503');
  });
});

// ─── getReleaseDetails ────────────────────────────────────────────────────────

describe('getReleaseDetails', () => {
  it('fetches release group and populates tracks from primary release', async () => {
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_RELEASES,
      '/release/rel-001': RELEASE_DETAIL,
    });

    const r = await getReleaseDetails('rg-001');
    expect(r.mbid).toBe('rg-001');
    expect(r.title).toBe('OK Computer');
    expect(r.artist).toBe('Radiohead');
    expect(r.tracks).toHaveLength(2);
    expect(r.tracks[0]).toEqual({ number: '1', title: 'Airbag', duration: '4:44', durationMs: 284000 });
    expect(r.tracks[1]).toEqual({ number: '2', title: 'Paranoid Android', duration: '6:23', durationMs: 383000 });
  });

  it('populates trackCount from primary release', async () => {
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_RELEASES,
      '/release/rel-001': RELEASE_DETAIL,
    });

    const r = await getReleaseDetails('rg-001');
    expect(r.trackCount).toBe(2);
  });

  it('picks the earliest official release', async () => {
    // rel-001 (1997-05-21) should be picked over rel-002 (1997-06-01)
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_RELEASES,
      '/release/rel-001': RELEASE_DETAIL,
    });

    await getReleaseDetails('rg-001');

    const calls = mockFetch.mock.calls.map((c: [string]) => c[0]);
    const releaseFetch = calls.find((u: string) => u.includes('/release/rel-'));
    expect(releaseFetch).toContain('/release/rel-001');
  });

  it('falls back to any release when no official releases exist', async () => {
    const rgUnofficial = {
      ...RELEASE_GROUP_WITH_RELEASES,
      releases: [
        { id: 'rel-bootleg', title: 'OK Computer', date: '1997-06-01', status: 'Bootleg' },
      ],
    };
    const bootlegRelease = { ...RELEASE_DETAIL, id: 'rel-bootleg' };

    setupFetch({
      '/release-group/rg-001': rgUnofficial,
      '/release/rel-bootleg': bootlegRelease,
    });

    const r = await getReleaseDetails('rg-001');
    expect(r.tracks).toHaveLength(2);
  });

  it('uses existingCoverUrl and skips Cover Art Archive fetch', async () => {
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_RELEASES,
      '/release/rel-001': RELEASE_DETAIL,
    });

    const r = await getReleaseDetails('rg-001', 'https://example.com/already-fetched.jpg');
    expect(r.coverUrl).toBe('https://example.com/already-fetched.jpg');

    const calls: string[] = mockFetch.mock.calls.map((c: [string]) => c[0]);
    expect(calls.every((u: string) => !u.includes('coverartarchive'))).toBe(true);
  });

  it('fetches release-specific cover art when selectedReleaseId is provided', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/release-group/rg-001') && !url.includes('coverartarchive')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(RELEASE_GROUP_WITH_RELEASES) });
      }
      if (url.includes('/release/rel-001') && !url.includes('coverartarchive')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(RELEASE_DETAIL) });
      }
      if (url.includes('coverartarchive.org/release/rel-001')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            images: [{ front: true, image: 'https://example.com/release-specific.jpg', thumbnails: { large: 'https://example.com/release-specific-large.jpg', small: '' } }],
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const r = await getReleaseDetails('rg-001', 'https://example.com/group-art.jpg', 'rel-001');
    expect(r.coverUrl).toBe('https://example.com/release-specific-large.jpg');
  });

  it('falls back to existingCoverUrl when release-specific cover art is unavailable', async () => {
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_RELEASES,
      '/release/rel-001': RELEASE_DETAIL,
    });

    const r = await getReleaseDetails('rg-001', 'https://example.com/group-art.jpg', 'rel-001');
    expect(r.coverUrl).toBe('https://example.com/group-art.jpg');
  });

  it('returns no tracks when release group has no releases', async () => {
    const rgNoReleases = { ...RELEASE_GROUP, releases: [] };
    setupFetch({ '/release-group/rg-001': rgNoReleases });

    const r = await getReleaseDetails('rg-001');
    expect(r.tracks).toHaveLength(0);
    expect(r.trackCount).toBe(0);
  });

  it('handles multi-disc releases by concatenating tracks', async () => {
    const multiDiscRelease = {
      ...RELEASE_DETAIL,
      media: [
        {
          format: 'CD',
          'track-count': 1,
          tracks: [{ number: '1', title: 'Disc 1 Track 1', length: 200000, position: 1 }],
        },
        {
          format: 'CD',
          'track-count': 1,
          tracks: [{ number: '1', title: 'Disc 2 Track 1', length: 180000, position: 1 }],
        },
      ],
    };
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_RELEASES,
      '/release/rel-001': multiDiscRelease,
    });

    const r = await getReleaseDetails('rg-001');
    expect(r.tracks).toHaveLength(2);
    expect(r.tracks[0].title).toBe('Disc 1 Track 1');
    expect(r.tracks[1].title).toBe('Disc 2 Track 1');
  });

  it('populates discogsUrl and wikipediaUrl from url-rels', async () => {
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_URLS,
      '/release/rel-001': RELEASE_DETAIL,
      'wikidata.org': WIKIDATA_RESPONSE,
    });

    const r = await getReleaseDetails('rg-001');
    expect(r.discogsUrl).toBe('https://www.discogs.com/master/14223');
    expect(r.wikipediaUrl).toBe('https://en.wikipedia.org/wiki/OK_Computer');
  });

  it('leaves url fields empty when no url-rels present', async () => {
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_RELEASES,
      '/release/rel-001': RELEASE_DETAIL,
    });

    const r = await getReleaseDetails('rg-001');
    expect(r.discogsUrl).toBe('');
    expect(r.wikipediaUrl).toBe('');
  });

  it('leaves wikipediaUrl empty when Wikidata has no enwiki sitelink', async () => {
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_URLS,
      '/release/rel-001': RELEASE_DETAIL,
      'wikidata.org': { entities: { Q202996: { sitelinks: {} } } },
    });

    const r = await getReleaseDetails('rg-001');
    expect(r.wikipediaUrl).toBe('');
  });

  it('uses selectedReleaseId when provided, bypassing pickPrimaryRelease', async () => {
    const rel002Detail = {
      id: 'rel-002',
      title: 'OK Computer',
      media: [{
        format: 'CD',
        'track-count': 1,
        tracks: [{ number: '1', title: 'Specifically Chosen Track', length: 200000, position: 1 }],
      }],
    };
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_RELEASES,
      '/release/rel-002': rel002Detail,
    });

    const r = await getReleaseDetails('rg-001', '', 'rel-002');

    const calls: string[] = mockFetch.mock.calls.map((c: [string]) => c[0]);
    expect(calls.some(u => u.includes('/release/rel-002'))).toBe(true);
    expect(calls.some(u => u.includes('/release/rel-001'))).toBe(false);
    expect(r.tracks[0].title).toBe('Specifically Chosen Track');
  });

  it('falls back to pickPrimaryRelease when selectedReleaseId is not found in stubs', async () => {
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_RELEASES,
      '/release/rel-001': RELEASE_DETAIL,
    });

    const r = await getReleaseDetails('rg-001', '', 'rel-nonexistent');

    const calls: string[] = mockFetch.mock.calls.map((c: [string]) => c[0]);
    expect(calls.some(u => u.includes('/release/rel-001'))).toBe(true);
    expect(r.tracks[0].title).toBe('Airbag');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' });
    await expect(getReleaseDetails('rg-001')).rejects.toThrow('MusicBrainz API error: 503');
  });
});

// ─── getEditions ───────────────────────────────────────────────────────────

const RELEASE_GROUP_WITH_MEDIA = {
  ...RELEASE_GROUP,
  releases: [
    {
      id: 'rel-001',
      title: 'OK Computer',
      date: '1997-05-21',
      status: 'Official',
      country: 'GB',
      disambiguation: '',
      media: [{ format: 'CD', 'track-count': 12 }],
    },
    {
      id: 'rel-003',
      title: 'OK Computer',
      date: '1997-06-17',
      status: 'Official',
      country: 'US',
      disambiguation: 'US pressing',
      media: [{ format: 'CD', 'track-count': 12 }],
    },
  ],
};

describe('getEditions', () => {
  it('returns mapped Edition array sorted by date ascending', async () => {
    setupFetch({ '/release-group/rg-001': RELEASE_GROUP_WITH_MEDIA });

    const results = await getEditions('rg-001');
    expect(results).toHaveLength(2);
    expect(results[0].mbid).toBe('rel-001');
    expect(results[0].date).toBe('1997-05-21');
    expect(results[0].year).toBe('1997');
    expect(results[0].status).toBe('Official');
    expect(results[0].format).toBe('CD');
    expect(results[0].trackCount).toBe(12);
    expect(results[0].mediaCount).toBe(1);
    expect(results[0].country).toBe('GB');
    expect(results[0].disambiguation).toBe('');
    expect(results[1].mbid).toBe('rel-003');
    expect(results[1].disambiguation).toBe('US pressing');
  });

  it('returns empty array when release group has no releases', async () => {
    setupFetch({ '/release-group/rg-001': { ...RELEASE_GROUP, releases: [] } });

    const results = await getEditions('rg-001');
    expect(results).toHaveLength(0);
  });

  it('returns empty array when releases field is missing', async () => {
    setupFetch({ '/release-group/rg-001': RELEASE_GROUP });

    const results = await getEditions('rg-001');
    expect(results).toHaveLength(0);
  });

  it('sorts releases with missing dates first (empty string sorts before any date)', async () => {
    const rgWithMissingDate = {
      ...RELEASE_GROUP,
      releases: [
        { id: 'rel-001', title: 'OK Computer', date: '1997-05-21', status: 'Official', media: [] },
        { id: 'rel-nodate', title: 'OK Computer', status: 'Official', media: [] },
      ],
    };
    setupFetch({ '/release-group/rg-001': rgWithMissingDate });

    const results = await getEditions('rg-001');
    expect(results[0].mbid).toBe('rel-nodate');
    expect(results[1].mbid).toBe('rel-001');
  });

  it('uses release-specific cover art when available', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/release-group/rg-001') && !url.includes('coverartarchive')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(RELEASE_GROUP_WITH_MEDIA) });
      }
      if (url.includes('coverartarchive.org/release/rel-001')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            images: [{ front: true, image: 'https://example.com/rel-001.jpg', thumbnails: { large: 'https://example.com/rel-001-large.jpg', small: '' } }],
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const results = await getEditions('rg-001', 'https://example.com/group.jpg');
    expect(results[0].coverUrl).toBe('https://example.com/rel-001-large.jpg');
  });

  it('falls back to groupCoverUrl when release-specific art is unavailable', async () => {
    setupFetch({ '/release-group/rg-001': RELEASE_GROUP_WITH_MEDIA });

    const results = await getEditions('rg-001', 'https://example.com/group.jpg');
    expect(results[0].coverUrl).toBe('https://example.com/group.jpg');
  });

  it('leaves coverUrl empty when no release art and no groupCoverUrl', async () => {
    setupFetch({ '/release-group/rg-001': RELEASE_GROUP_WITH_MEDIA });

    const results = await getEditions('rg-001');
    expect(results[0].coverUrl).toBe('');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' });
    await expect(getEditions('rg-001')).rejects.toThrow('MusicBrainz API error: 503');
  });

  describe('format derivation', () => {
    function makeRgWithMedia(mediaArrays: Array<Array<{ format?: string; 'track-count': number }>>) {
      return {
        ...RELEASE_GROUP,
        releases: mediaArrays.map((media, i) => ({
          id: `rel-00${i + 1}`,
          title: 'Test',
          date: `2000-01-0${i + 1}`,
          status: 'Official',
          media,
        })),
      };
    }

    it('returns "CD" for a single CD medium', async () => {
      setupFetch({ '/release-group/rg-001': makeRgWithMedia([[{ format: 'CD', 'track-count': 10 }]]) });
      const [r] = await getEditions('rg-001');
      expect(r.format).toBe('CD');
    });

    it('returns "2× Vinyl" for two vinyl media', async () => {
      setupFetch({
        '/release-group/rg-001': makeRgWithMedia([[
          { format: 'Vinyl', 'track-count': 6 },
          { format: 'Vinyl', 'track-count': 6 },
        ]]),
      });
      const [r] = await getEditions('rg-001');
      expect(r.format).toBe('2× Vinyl');
    });

    it('returns "Vinyl + CD" for mixed media types', async () => {
      setupFetch({
        '/release-group/rg-001': makeRgWithMedia([[
          { format: 'Vinyl', 'track-count': 10 },
          { format: 'CD', 'track-count': 10 },
        ]]),
      });
      const [r] = await getEditions('rg-001');
      expect(r.format).toBe('Vinyl + CD');
    });

    it('returns "Unknown" when format is missing on medium', async () => {
      setupFetch({ '/release-group/rg-001': makeRgWithMedia([[{ 'track-count': 10 }]]) });
      const [r] = await getEditions('rg-001');
      expect(r.format).toBe('Unknown');
    });

    it('returns "Unknown" when media array is empty', async () => {
      setupFetch({ '/release-group/rg-001': makeRgWithMedia([[]])  });
      const [r] = await getEditions('rg-001');
      expect(r.format).toBe('Unknown');
    });

    it('sums trackCount across all media', async () => {
      setupFetch({
        '/release-group/rg-001': makeRgWithMedia([[
          { format: 'CD', 'track-count': 7 },
          { format: 'CD', 'track-count': 5 },
        ]]),
      });
      const [r] = await getEditions('rg-001');
      expect(r.trackCount).toBe(12);
      expect(r.mediaCount).toBe(2);
    });
  });
});

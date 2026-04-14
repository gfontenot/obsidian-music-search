import { searchReleases, getReleaseDetails } from '../src/api/musicbrainz';

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

    const results = await searchReleases('Radiohead OK Computer');
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

    const [r] = await searchReleases('Radiohead');
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

    const [r] = await searchReleases('test');
    expect(r.releaseType).toBe('Album + Compilation');
  });

  it('returns empty array when no results', async () => {
    setupFetch({
      '/release-group': { 'release-groups': [], count: 0, offset: 0 },
    });

    const results = await searchReleases('xyzzy');
    expect(results).toHaveLength(0);
  });

  it('handles missing artist-credit gracefully', async () => {
    const rgNoArtist = { ...RELEASE_GROUP, 'artist-credit': undefined };
    setupFetch({
      '/release-group': { 'release-groups': [rgNoArtist], count: 1, offset: 0 },
    });

    const [r] = await searchReleases('test');
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

    const [r] = await searchReleases('test');
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

    const [r] = await searchReleases('Radiohead');
    expect(r.coverUrl).toBe('https://example.com/large.jpg');
  });

  it('leaves coverUrl empty when cover art is unavailable', async () => {
    setupFetch({
      '/release-group': { 'release-groups': [RELEASE_GROUP], count: 1, offset: 0 },
    });

    const [r] = await searchReleases('Radiohead');
    expect(r.coverUrl).toBe('');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' });
    await expect(searchReleases('test')).rejects.toThrow('MusicBrainz API error: 503');
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

  it('populates label and catalogNumber from primary release', async () => {
    setupFetch({
      '/release-group/rg-001': RELEASE_GROUP_WITH_RELEASES,
      '/release/rel-001': RELEASE_DETAIL,
    });

    const r = await getReleaseDetails('rg-001');
    expect(r.label).toBe('Parlophone');
    expect(r.catalogNumber).toBe('NODATA 01');
    expect(r.format).toBe('CD');
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
    expect(r.format).toBe('CD + CD');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' });
    await expect(getReleaseDetails('rg-001')).rejects.toThrow('MusicBrainz API error: 503');
  });
});

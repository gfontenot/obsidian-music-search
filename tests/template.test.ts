import { replaceVariables, makeFileName, getTemplateContents, appendCustomFields } from '../src/utils/template';
import { Release } from '../src/models/release.model';
import { App, TFile } from 'obsidian';

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    mbid: 'rg-abc123',
    title: 'OK Computer',
    artist: 'Radiohead',
    artistMbid: 'artist-abc',
    date: '1997-05-21',
    year: '1997',
    country: 'GB',
    label: 'Parlophone',
    catalogNumber: 'NODATA 01',
    format: 'CD',
    trackCount: 12,
    tracks: [],
    genres: ['alternative rock', 'art rock'],
    coverUrl: 'https://example.com/cover.jpg',
    releaseGroupMbid: 'rg-abc123',
    releaseType: 'Album',
    status: 'Official',
    barcode: '724384553920',
    disambiguation: '',
    mbUrl: 'https://musicbrainz.org/release-group/rg-abc123',
    discogsUrl: '',
    wikipediaUrl: '',
    ...overrides,
  };
}

describe('replaceVariables', () => {
  it('substitutes basic string variables', () => {
    const result = replaceVariables('{{title}} by {{artist}}', makeRelease());
    expect(result).toBe('OK Computer by Radiohead');
  });

  it('substitutes all release fields', () => {
    const release = makeRelease();
    const template = '{{mbid}} {{year}} {{date}} {{country}} {{label}} {{catalogNumber}} {{format}} {{trackCount}} {{releaseType}} {{status}} {{barcode}} {{mbUrl}}';
    const result = replaceVariables(template, release);
    // year and barcode are numeric strings → quoted; mbUrl contains ':' → quoted
    expect(result).toBe('rg-abc123 "1997" 1997-05-21 GB Parlophone NODATA 01 CD 12 Album Official "724384553920" "https://musicbrainz.org/release-group/rg-abc123"');
  });

  it('replaces unknown variables with empty string', () => {
    const result = replaceVariables('{{unknown}}', makeRelease());
    expect(result).toBe('');
  });

  it('formats genres as YAML list', () => {
    const result = replaceVariables('{{genres}}', makeRelease());
    expect(result).toBe('\n  - alternative rock\n  - art rock');
  });

  it('formats empty genres as YAML empty array', () => {
    const result = replaceVariables('{{genres}}', makeRelease({ genres: [] }));
    expect(result).toBe('[]');
  });

  it('formats genresInline as comma-separated string', () => {
    const result = replaceVariables('{{genresInline}}', makeRelease());
    // commas trigger quoting
    expect(result).toBe('"alternative rock, art rock"');
  });

  it('formats tracklist', () => {
    const release = makeRelease({
      tracks: [
        { number: '1', title: 'Airbag', duration: '4:44', durationMs: 284000 },
        { number: '2', title: 'Paranoid Android', duration: '6:23', durationMs: 383000 },
      ],
    });
    const result = replaceVariables('{{trackList}}', release);
    expect(result).toBe('1. Airbag (4:44)\n2. Paranoid Android (6:23)');
  });

  it('omits duration from tracklist when empty', () => {
    const release = makeRelease({
      tracks: [{ number: '1', title: 'No Duration', duration: '', durationMs: 0 }],
    });
    const result = replaceVariables('{{trackList}}', release);
    expect(result).toBe('1. No Duration');
  });

  it('returns empty trackList when no tracks', () => {
    const result = replaceVariables('{{trackList}}', makeRelease({ tracks: [] }));
    expect(result).toBe('');
  });

  it('renders user tags as YAML list', () => {
    const result = replaceVariables('{{tags}}', makeRelease(), ['music', 'albums']);
    expect(result).toBe('\n  - music\n  - albums');
  });

  it('renders empty user tags as YAML empty array', () => {
    const result = replaceVariables('{{tags}}', makeRelease(), []);
    expect(result).toBe('[]');
  });

  it('defaults to empty tags when third argument is omitted', () => {
    const result = replaceVariables('{{tags}}', makeRelease());
    expect(result).toBe('[]');
  });

  describe('YAML scalar escaping', () => {
    it('quotes values containing a colon', () => {
      const r = makeRelease({ title: '99 Songs of Revolution: Volume 1' });
      expect(replaceVariables('{{title}}', r)).toBe('"99 Songs of Revolution: Volume 1"');
    });

    it('does not quote safe values', () => {
      const r = makeRelease({ title: 'OK Computer' });
      expect(replaceVariables('{{title}}', r)).toBe('OK Computer');
    });

    it('quotes values containing a hash', () => {
      const r = makeRelease({ title: 'Album #1' });
      expect(replaceVariables('{{title}}', r)).toBe('"Album #1"');
    });

    it('escapes internal double-quotes when quoting', () => {
      const r = makeRelease({ title: 'Say "Hello"' });
      expect(replaceVariables('{{title}}', r)).toBe('"Say \\"Hello\\""');
    });

    it('quotes URLs (contain colon)', () => {
      const r = makeRelease({ coverUrl: 'https://example.com/cover.jpg' });
      expect(replaceVariables('{{coverUrl}}', r)).toBe('"https://example.com/cover.jpg"');
    });

    it('returns empty string for empty values without quoting', () => {
      const r = makeRelease({ disambiguation: '' });
      expect(replaceVariables('{{disambiguation}}', r)).toBe('');
    });

    it('quotes a plain year so YAML treats it as a string, not an integer', () => {
      const r = makeRelease({ year: '1997' });
      expect(replaceVariables('{{year}}', r)).toBe('"1997"');
    });

    it('quotes a plain year without needing manual quotes in the template', () => {
      const r = makeRelease({ year: '1997' });
      expect(replaceVariables('release-year: {{year}}', r)).toBe('release-year: "1997"');
    });

    it('quotes other numeric-looking strings (e.g. barcode)', () => {
      const r = makeRelease({ barcode: '724384553920' });
      expect(replaceVariables('{{barcode}}', r)).toBe('"724384553920"');
    });

    it('does not quote trackCount so YAML parses it as a number', () => {
      const r = makeRelease({ trackCount: 12 });
      expect(replaceVariables('{{trackCount}}', r)).toBe('12');
    });

    it('quotes genre list items that contain special characters', () => {
      const r = makeRelease({ genres: ['rock: hard', 'pop & soul', 'indie'] });
      const result = replaceVariables('{{genres}}', r);
      expect(result).toContain('  - "rock: hard"');
      expect(result).toContain('  - "pop & soul"');
      expect(result).toContain('  - indie');
    });
  });

  describe('coverEmbed variable', () => {
    it('renders a wikilink embed for a local path', () => {
      const r = makeRelease({ coverUrl: 'Assets/Radiohead - OK Computer.jpg' });
      expect(replaceVariables('{{coverEmbed}}', r)).toBe('![[Assets/Radiohead - OK Computer.jpg]]');
    });

    it('renders a markdown image for a remote URL', () => {
      const r = makeRelease({ coverUrl: 'https://example.com/cover.jpg' });
      expect(replaceVariables('{{coverEmbed}}', r)).toBe('![](https://example.com/cover.jpg)');
    });

    it('returns empty string when coverUrl is empty', () => {
      const r = makeRelease({ coverUrl: '' });
      expect(replaceVariables('{{coverEmbed}}', r)).toBe('');
    });
  });

  describe('DATE variable', () => {
    it('substitutes {{DATE}} with current date in YYYY-MM-DD format', () => {
      const result = replaceVariables('{{DATE}}', makeRelease());
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('substitutes {{DATE:FORMAT}} with a custom format', () => {
      const result = replaceVariables('{{DATE:YYYY/MM/DD}}', makeRelease());
      expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });

    it('substitutes {{DATE:YYYY}} with just the year, quoted as a YAML string', () => {
      const result = replaceVariables('{{DATE:YYYY}}', makeRelease());
      expect(result).toMatch(/^"\d{4}"$/);
    });

    it('uses the same timestamp for all DATE occurrences in one call', () => {
      const result = replaceVariables('{{DATE}} {{DATE}}', makeRelease());
      const [a, b] = result.split(' ');
      expect(a).toBe(b);
    });
  });

  it('handles disambiguation field', () => {
    const release = makeRelease({ disambiguation: 'Remaster' });
    expect(replaceVariables('{{disambiguation}}', release)).toBe('Remaster');
  });

  it('handles artistMbid and releaseGroupMbid', () => {
    const result = replaceVariables('{{artistMbid}} {{releaseGroupMbid}}', makeRelease());
    expect(result).toBe('artist-abc rg-abc123');
  });
});

describe('makeFileName', () => {
  it('substitutes template variables', () => {
    expect(makeFileName('{{artist}} - {{title}}', makeRelease())).toBe('Radiohead - OK Computer');
  });

  it('removes illegal filename characters', () => {
    const release = makeRelease({ title: 'A/B:C*D?E"F<G>H|I\\J' });
    const name = makeFileName('{{title}}', release);
    expect(name).toBe('ABCDEFGHIJ');
  });

  it('trims whitespace from the result', () => {
    expect(makeFileName('  {{title}}  ', makeRelease())).toBe('OK Computer');
  });
});

describe('appendCustomFields', () => {
  const frontmatterTemplate = '---\ntitle: {{title}}\n---\n\nBody here.';

  it('returns template unchanged when fields array is empty', () => {
    expect(appendCustomFields(frontmatterTemplate, [])).toBe(frontmatterTemplate);
  });

  it('returns template unchanged when all field names are empty', () => {
    expect(appendCustomFields(frontmatterTemplate, [{ name: '', value: 'x' }])).toBe(frontmatterTemplate);
  });

  it('inserts field lines before the closing ---', () => {
    const result = appendCustomFields(frontmatterTemplate, [{ name: 'owned', value: 'false' }]);
    expect(result).toBe('---\ntitle: {{title}}\nowned: false\n---\n\nBody here.');
  });

  it('inserts multiple fields in order', () => {
    const result = appendCustomFields(frontmatterTemplate, [
      { name: 'owned', value: 'false' },
      { name: 'rating', value: '5' },
    ]);
    expect(result).toBe('---\ntitle: {{title}}\nowned: false\nrating: 5\n---\n\nBody here.');
  });

  it('skips fields with blank names but includes others', () => {
    const result = appendCustomFields(frontmatterTemplate, [
      { name: '', value: 'ignored' },
      { name: 'owned', value: 'false' },
    ]);
    expect(result).toBe('---\ntitle: {{title}}\nowned: false\n---\n\nBody here.');
  });

  it('trims whitespace from field names', () => {
    const result = appendCustomFields(frontmatterTemplate, [{ name: '  owned  ', value: 'false' }]);
    expect(result).toBe('---\ntitle: {{title}}\nowned: false\n---\n\nBody here.');
  });

  it('preserves body content after frontmatter', () => {
    const result = appendCustomFields(frontmatterTemplate, [{ name: 'owned', value: 'false' }]);
    expect(result).toContain('\n\nBody here.');
  });

  it('appends at end when template has no frontmatter', () => {
    const noFrontmatter = 'Just some text.';
    const result = appendCustomFields(noFrontmatter, [{ name: 'owned', value: 'false' }]);
    expect(result).toBe('Just some text.\nowned: false');
  });

  it('field values may contain template variables', () => {
    const result = appendCustomFields(frontmatterTemplate, [{ name: 'release-year', value: '{{year}}' }]);
    expect(result).toContain('release-year: {{year}}');
  });
});

describe('getTemplateContents', () => {
  it('returns empty string for empty path', async () => {
    const app = new App() as any;
    const result = await getTemplateContents(app, '');
    expect(result).toBe('');
  });

  it('returns file contents when file exists', async () => {
    const mockFile = new TFile('Templates/Music.md') as any;
    const app = {
      vault: {
        getAbstractFileByPath: jest.fn().mockReturnValue(mockFile),
        read: jest.fn().mockResolvedValue('# My Template\n{{title}}'),
      },
    } as any;
    const result = await getTemplateContents(app, 'Templates/Music.md');
    expect(result).toBe('# My Template\n{{title}}');
  });

  it('returns empty string when file does not exist', async () => {
    const app = {
      vault: {
        getAbstractFileByPath: jest.fn().mockReturnValue(null),
      },
    } as any;
    const result = await getTemplateContents(app, 'Templates/Missing.md');
    expect(result).toBe('');
  });
});

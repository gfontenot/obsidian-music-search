import { replaceVariables, makeFileName, getTemplateContents } from '../src/utils/template';
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
    expect(result).toBe('rg-abc123 1997 1997-05-21 GB Parlophone NODATA 01 CD 12 Album Official 724384553920 https://musicbrainz.org/release-group/rg-abc123');
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
    expect(result).toBe('alternative rock, art rock');
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

  it('substitutes {{DATE}} with today\'s ISO date', () => {
    const result = replaceVariables('{{DATE}}', makeRelease());
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe(new Date().toISOString().split('T')[0]);
  });

  it('formats {{DATE:YYYYMMDD}}', () => {
    const result = replaceVariables('{{DATE:YYYYMMDD}}', makeRelease());
    expect(result).toMatch(/^\d{8}$/);
  });

  it('formats {{DATE:DD/MM/YYYY}}', () => {
    const result = replaceVariables('{{DATE:DD/MM/YYYY}}', makeRelease());
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
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

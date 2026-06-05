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

import { TFile } from 'obsidian';
import { Release } from '../src/models/release.model';
import { DuplicateResult } from '../src/views/duplicate_note_modal';

jest.mock('../src/views/duplicate_note_modal', () => ({
  DuplicateNoteModal: jest.fn().mockImplementation(
    (_app: unknown, _filePath: string, _folder: string, onChoose: (result: DuplicateResult) => void) => ({
      open: () => onChoose(mockDuplicateResult),
    })
  ),
}));

// Controlled by each test
let mockDuplicateResult: DuplicateResult = { action: 'ignore' };

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
    coverUrl: '',
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

function makeApp(overrides: Record<string, unknown> = {}) {
  return {
    vault: {
      getAbstractFileByPath: jest.fn().mockReturnValue(null),
      create: jest.fn().mockResolvedValue(new TFile('Radiohead - OK Computer.md')),
      modify: jest.fn().mockResolvedValue(undefined),
      createBinary: jest.fn().mockResolvedValue(undefined),
      createFolder: jest.fn().mockResolvedValue(undefined),
    },
    workspace: {
      getLeaf: jest.fn().mockReturnValue({ openFile: jest.fn() }),
    },
    ...overrides,
  } as any;
}

async function makePlugin(app: ReturnType<typeof makeApp>) {
  const { default: MusicSearchPlugin } = await import('../src/main');
  const plugin = new MusicSearchPlugin(app, {} as any);
  await plugin.loadSettings();
  plugin.settings.openNewNote = false;
  return plugin;
}

describe('createNote', () => {
  it('creates a new file when none exists', async () => {
    const app = makeApp();
    const plugin = await makePlugin(app);

    await plugin.createNote(makeRelease());

    expect(app.vault.create).toHaveBeenCalledTimes(1);
    const [calledPath] = app.vault.create.mock.calls[0] as [string, string];
    expect(calledPath).toBe('Radiohead - OK Computer.md');
  });

  it('does not create or modify when duplicate action is ignore', async () => {
    const app = makeApp({
      vault: {
        getAbstractFileByPath: jest.fn().mockReturnValue(new TFile('Radiohead - OK Computer.md')),
        create: jest.fn(),
        modify: jest.fn(),
        createBinary: jest.fn(),
        createFolder: jest.fn().mockResolvedValue(undefined),
      },
    });
    mockDuplicateResult = { action: 'ignore' };
    const plugin = await makePlugin(app);

    await plugin.createNote(makeRelease());

    expect(app.vault.create).not.toHaveBeenCalled();
    expect(app.vault.modify).not.toHaveBeenCalled();
  });

  it('calls vault.modify and not vault.create when duplicate action is replace', async () => {
    const existingFile = new TFile('Radiohead - OK Computer.md');
    const app = makeApp({
      vault: {
        getAbstractFileByPath: jest.fn().mockReturnValue(existingFile),
        create: jest.fn(),
        modify: jest.fn().mockResolvedValue(undefined),
        createBinary: jest.fn(),
        createFolder: jest.fn().mockResolvedValue(undefined),
      },
    });
    mockDuplicateResult = { action: 'replace' };
    const plugin = await makePlugin(app);

    await plugin.createNote(makeRelease());

    expect(app.vault.modify).toHaveBeenCalledTimes(1);
    expect(app.vault.modify.mock.calls[0][0]).toBe(existingFile);
    expect(app.vault.create).not.toHaveBeenCalled();
  });

  it('creates a file using the user-provided name when save-both', async () => {
    const existingFile = new TFile('Radiohead - OK Computer.md');
    const app = makeApp({
      vault: {
        getAbstractFileByPath: jest.fn().mockImplementation((path: string) => {
          if (path === 'Radiohead - OK Computer.md') return existingFile;
          return null;
        }),
        create: jest.fn().mockResolvedValue(new TFile('Radiohead - OK Computer (Deluxe).md')),
        modify: jest.fn(),
        createBinary: jest.fn(),
        createFolder: jest.fn().mockResolvedValue(undefined),
      },
    });
    mockDuplicateResult = { action: 'save-both', name: 'Radiohead - OK Computer (Deluxe)' };
    const plugin = await makePlugin(app);

    await plugin.createNote(makeRelease());

    expect(app.vault.create).toHaveBeenCalledTimes(1);
    const [calledPath] = app.vault.create.mock.calls[0] as [string, string];
    expect(calledPath).toBe('Radiohead - OK Computer (Deluxe).md');
    expect(app.vault.modify).not.toHaveBeenCalled();
  });

  it('downloads cover art under the user-provided name when save-both and artFolder set', async () => {
    const existingFile = new TFile('Radiohead - OK Computer.md');
    const existingArt = new TFile('Art/Radiohead - OK Computer.jpg');
    const app = makeApp({
      vault: {
        // Note exists; original art also exists (typical duplicate scenario)
        getAbstractFileByPath: jest.fn().mockImplementation((path: string) => {
          if (path === 'Radiohead - OK Computer.md') return existingFile;
          if (path === 'Art/Radiohead - OK Computer.jpg') return existingArt;
          return null;
        }),
        create: jest.fn().mockResolvedValue(new TFile('My Custom Name.md')),
        modify: jest.fn(),
        createBinary: jest.fn().mockResolvedValue(undefined),
        createFolder: jest.fn().mockResolvedValue(undefined),
      },
    });
    mockDuplicateResult = { action: 'save-both', name: 'My Custom Name' };
    const plugin = await makePlugin(app);
    plugin.settings.artFolder = 'Art';

    await plugin.createNote(makeRelease({ coverUrl: 'https://example.com/cover.jpg' }));

    // Original art was reused (no new download); only the custom-name art is new
    expect(app.vault.createBinary).toHaveBeenCalledTimes(1);
    const [artPath] = app.vault.createBinary.mock.calls[0] as [string, ArrayBuffer];
    expect(artPath).toBe('Art/My Custom Name.jpg');

    // Note content should embed the new local art path
    const [, noteContent] = app.vault.create.mock.calls[0] as [string, string];
    expect(noteContent).toContain('Art/My Custom Name.jpg');
  });

  it('does not re-download art when artFolder is not configured', async () => {
    const existingFile = new TFile('Radiohead - OK Computer.md');
    const app = makeApp({
      vault: {
        getAbstractFileByPath: jest.fn().mockImplementation((path: string) => {
          if (path === 'Radiohead - OK Computer.md') return existingFile;
          return null;
        }),
        create: jest.fn().mockResolvedValue(new TFile('My Custom Name.md')),
        modify: jest.fn(),
        createBinary: jest.fn(),
        createFolder: jest.fn().mockResolvedValue(undefined),
      },
    });
    mockDuplicateResult = { action: 'save-both', name: 'My Custom Name' };
    const plugin = await makePlugin(app);
    // artFolder is '' by default — no art download

    await plugin.createNote(makeRelease({ coverUrl: 'https://example.com/cover.jpg' }));

    expect(app.vault.createBinary).not.toHaveBeenCalled();
    expect(app.vault.create).toHaveBeenCalledTimes(1);
    const [calledPath] = app.vault.create.mock.calls[0] as [string, string];
    expect(calledPath).toBe('My Custom Name.md');
  });
});

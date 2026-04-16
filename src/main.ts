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

import { Notice, Plugin, TFile, TFolder, normalizePath, requestUrl } from 'obsidian';
import { MusicSearchSettings, DEFAULT_SETTINGS, DEFAULT_NOTE_TEMPLATE, MusicSearchSettingTab } from './settings/settings';
import { MusicSearchModal } from './views/music_search_modal';
import { ReleaseSuggestModal, LoadingProgressModal } from './views/release_suggest_modal';
import { searchReleases, getReleaseDetails } from './api/musicbrainz';
import { Release } from './models/release.model';
import { replaceVariables, getTemplateContents, makeFileName, appendCustomFields } from './utils/template';
import { errorMessage } from './utils/errors';

export default class MusicSearchPlugin extends Plugin {
  settings: MusicSearchSettings;

  async onload() {
    await this.loadSettings();

    // Ribbon icon
    this.addRibbonIcon('music', 'Create new music release note', () => {
      this.createNewReleaseNote();
    });

    // Command palette
    this.addCommand({
      id: 'search-music-release',
      name: 'Search music release',
      callback: () => this.createNewReleaseNote(),
    });

    // Settings tab
    this.addSettingTab(new MusicSearchSettingTab(this.app, this));

  }

  onunload() {}

  loadData(): Promise<Partial<MusicSearchSettings>> {
    return super.loadData() as Promise<Partial<MusicSearchSettings>>;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  createNewReleaseNote() {
    new MusicSearchModal(this.app, async (query) => {
      let releases: Release[];
      try {
        releases = await searchReleases(query);
      } catch (err) {
        throw new Error(`Search failed: ${errorMessage(err)}`);
      }

      if (releases.length === 0) {
        throw new Error('No releases found. Try a different search.');
      }

      new ReleaseSuggestModal(
        this.app,
        releases,
        (selected) => {
          void (async () => {
            const loading = new LoadingProgressModal(this.app, 'Fetching release details…');
            loading.open();
            try {
              const release = await getReleaseDetails(selected.mbid, selected.coverUrl);
              await this.createNote(release);
            } catch (err) {
              new Notice(`Failed to fetch release details: ${errorMessage(err)}`);
            } finally {
              loading.close();
            }
          })();
        },
        this.settings.showCoverInSearch,
      ).open();
    }).open();
  }

  async createNote(release: Release) {
    // Determine note content
    let templateContent: string;
    if (this.settings.templateMode === 'template-file' && this.settings.templateFile) {
      templateContent = await getTemplateContents(this.app, this.settings.templateFile);
      if (!templateContent) {
        new Notice(`Template file not found: ${this.settings.templateFile}. Using default template.`);
        templateContent = appendCustomFields(DEFAULT_NOTE_TEMPLATE, this.settings.customFields);
      }
    } else {
      templateContent = appendCustomFields(DEFAULT_NOTE_TEMPLATE, this.settings.customFields);
    }

    const fileName = makeFileName(this.settings.fileNameTemplate, release);

    // Download cover art locally if a folder is configured
    let releaseForNote = release;
    if (this.settings.artFolder && release.coverUrl) {
      const localPath = await this.downloadCoverArt(release, fileName);
      if (localPath) {
        releaseForNote = { ...release, coverUrl: localPath };
      }
    }

    const userTags = this.settings.tags
      ? this.settings.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    const noteContent = replaceVariables(templateContent, releaseForNote, userTags);

    // Determine folder
    const folder = this.settings.folder
      ? normalizePath(this.settings.folder)
      : '';

    // Ensure folder exists
    if (folder) {
      await this.ensureFolderExists(folder);
    }

    const filePath = normalizePath(
      folder ? `${folder}/${fileName}.md` : `${fileName}.md`
    );

    // Check if file already exists
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      new Notice(`Note already exists: ${filePath}`);
      if (this.settings.openNewNote) {
        await this.app.workspace.getLeaf(false).openFile(existing);
      }
      return;
    }

    // Create the file
    try {
      const file = await this.app.vault.create(filePath, noteContent);
      new Notice(`Created: ${fileName}`);

      if (this.settings.openNewNote) {
        await this.app.workspace.getLeaf(false).openFile(file);
      }
    } catch (err) {
      new Notice(`Failed to create note: ${errorMessage(err)}`);
    }
  }

  async downloadCoverArt(release: Release, fileName: string): Promise<string | null> {
    try {
      const folder = normalizePath(this.settings.artFolder);
      await this.ensureFolderExists(folder);

      const ext = release.coverUrl.match(/\.(jpe?g|png|gif|webp)(\?|$)/i)?.[1] ?? 'jpg';
      const filePath = normalizePath(`${folder}/${fileName}.${ext}`);

      // Reuse existing file if already downloaded
      const existing = this.app.vault.getAbstractFileByPath(filePath);
      if (existing instanceof TFile) return filePath;

      const response = await requestUrl({ url: release.coverUrl, throw: false });
      if (response.status < 200 || response.status >= 300) return null;
      await this.app.vault.createBinary(filePath, response.arrayBuffer);
      return filePath;
    } catch {
      return null;
    }
  }

  async ensureFolderExists(folderPath: string) {
    const parts = folderPath.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.app.vault.createFolder(current);
      } else if (!(existing instanceof TFolder)) {
        throw new Error(`${current} exists but is not a folder`);
      }
    }
  }
}

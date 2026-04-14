import { App, Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { MusicSearchSettings, DEFAULT_SETTINGS, DEFAULT_NOTE_TEMPLATE, MusicSearchSettingTab } from './settings/settings';
import { MusicSearchModal } from './views/music_search_modal';
import { ReleaseSuggestModal, LoadingProgressModal } from './views/release_suggest_modal';
import { searchReleases, getReleaseDetails } from './api/musicbrainz';
import { Release } from './models/release.model';
import { replaceVariables, getTemplateContents, makeFileName, appendCustomFields } from './utils/template';

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

    console.log('Music Search plugin loaded');
  }

  onunload() {
    console.log('Music Search plugin unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async createNewReleaseNote() {
    new MusicSearchModal(this.app, async (query) => {
      let releases: Release[];
      try {
        releases = await searchReleases(query);
      } catch (err) {
        throw new Error(`Search failed: ${err.message}`);
      }

      if (releases.length === 0) {
        throw new Error('No releases found. Try a different search.');
      }

      new ReleaseSuggestModal(
        this.app,
        releases,
        async (selected) => {
          const loading = new LoadingProgressModal(this.app, 'Fetching release details…');
          loading.open();
          try {
            const release = await getReleaseDetails(selected.mbid);
            await this.createNote(release);
          } catch (err) {
            new Notice(`Failed to fetch release details: ${err.message}`);
          } finally {
            loading.close();
          }
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

    const userTags = this.settings.tags
      ? this.settings.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    const noteContent = replaceVariables(templateContent, release, userTags);

    // Determine file name
    const fileName = makeFileName(this.settings.fileNameTemplate, release);
    
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
      new Notice(`Failed to create note: ${err.message}`);
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

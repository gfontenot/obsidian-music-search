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

import { AbstractInputSuggest, App, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';
import type MusicSearchPlugin from '../main';

export interface MusicSearchSettings {
  folder: string;
  fileNameTemplate: string;
  templateMode: 'custom-fields' | 'template-file';
  templateFile: string;
  customFields: { name: string; value: string }[];
  artFolder: string;
  openNewNote: boolean;
  showCoverInSearch: boolean;
  tags: string;
}

export const DEFAULT_SETTINGS: MusicSearchSettings = {
  folder: '',
  fileNameTemplate: '{{artist}} - {{title}}',
  templateMode: 'custom-fields',
  templateFile: '',
  customFields: [],
  artFolder: '',
  openNewNote: true,
  showCoverInSearch: true,
  tags: '',
};

export const DEFAULT_NOTE_TEMPLATE = `---
tags: {{tags}}
artist: {{artist}}
title: {{title}}
genres: {{genres}}
album-art: {{coverUrl}}
album-type: {{releaseType}}
track-count: {{trackCount}}
release-date: {{date}}
release-year: {{year}}
disambiguation: {{disambiguation}}
mbid: {{mbid}}
artist-mbid: {{artistMbid}}
link-musicbrainz: {{mbUrl}}
link-discogs: {{discogsUrl}}
link-wikipedia: {{wikipediaUrl}}
---
{{coverEmbed}}
## Tracklist

{{trackList}}
`;

abstract class PathSuggest<T extends TFile | TFolder> extends AbstractInputSuggest<T> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private onSelect: (value: string) => void,
  ) {
    super(app, inputEl);
  }

  abstract getSuggestions(query: string): T[];

  renderSuggestion(item: T, el: HTMLElement) {
    el.setText(item.path);
  }

  selectSuggestion(item: T) {
    this.setValue(item.path);
    this.onSelect(item.path);
    this.close();
  }
}

class FolderSuggest extends PathSuggest<TFolder> {
  getSuggestions(query: string): TFolder[] {
    return this.app.vault.getAllFolders(false)
      .filter(f => f.path.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50);
  }
}

class FileSuggest extends PathSuggest<TFile> {
  getSuggestions(query: string): TFile[] {
    return this.app.vault.getMarkdownFiles()
      .filter(f => f.path.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50);
  }
}

export class MusicSearchSettingTab extends PluginSettingTab {
  plugin: MusicSearchPlugin;

  constructor(app: App, plugin: MusicSearchPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Note destination folder
    new Setting(containerEl)
      .setName('Note destination folder')
      .setDesc('Where to save new music notes. Leave empty for vault root.')
      .addText(text => {
        new FolderSuggest(this.app, text.inputEl, (value) => {
          this.plugin.settings.folder = value.trim();
          void this.plugin.saveSettings();
        });
        text
          .setPlaceholder('e.g. Music/Releases')
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value.trim();
            await this.plugin.saveSettings();
          });
      });

    // File name template
    new Setting(containerEl)
      .setName('Note file name template')
      .setDesc('Template for the note file name. Available: {{title}}, {{artist}}, {{year}}, {{date}}, {{format}}, {{label}}')
      .addText(text => text
        .setPlaceholder('{{artist}} - {{title}} ({{year}})')
        .setValue(this.plugin.settings.fileNameTemplate)
        .onChange(async (value) => {
          this.plugin.settings.fileNameTemplate = value;
          await this.plugin.saveSettings();
        }));

    // Tags
    new Setting(containerEl)
      .setName('Tags')
      .setDesc('Comma-separated tags to add to every note (e.g. "music, albums, vinyl").')
      .addText(text => text
        .setPlaceholder('Music, albums')
        .setValue(this.plugin.settings.tags)
        .onChange(async (value) => {
          this.plugin.settings.tags = value;
          await this.plugin.saveSettings();
        }));

    // Note template section (tabs: custom fields vs template file)
    new Setting(containerEl).setName('Note template').setHeading();
    containerEl.createEl('p', {
      text: 'Choose one mode: add custom fields to the default template, or provide a full template file.',
      cls: 'setting-item-description',
    });

    const tabRow = containerEl.createDiv({ cls: 'music-search-tab-row' });
    const customFieldsTabBtn = tabRow.createEl('button', { text: 'Custom fields' });
    const templateFileTabBtn = tabRow.createEl('button', { text: 'Template file' });

    const customFieldsPane = containerEl.createDiv();
    const templateFilePane = containerEl.createDiv();

    const activateTab = (mode: 'custom-fields' | 'template-file') => {
      this.plugin.settings.templateMode = mode;
      customFieldsTabBtn.classList.toggle('mod-cta', mode === 'custom-fields');
      templateFileTabBtn.classList.toggle('mod-cta', mode === 'template-file');
      customFieldsPane.style.display = mode === 'custom-fields' ? '' : 'none';
      templateFilePane.style.display = mode === 'template-file' ? '' : 'none';
    };

    customFieldsTabBtn.addEventListener('click', () => {
      activateTab('custom-fields');
      void this.plugin.saveSettings();
    });
    templateFileTabBtn.addEventListener('click', () => {
      activateTab('template-file');
      void this.plugin.saveSettings();
    });

    new Setting(templateFilePane)
      .setName('Template file')
      .setDesc('Path to a template note in your vault. All available {{variables}} will be substituted.')
      .addText(text => {
        new FileSuggest(this.app, text.inputEl, (value) => {
          this.plugin.settings.templateFile = value.trim();
          void this.plugin.saveSettings();
        });
        text
          .setPlaceholder('e.g. Templates/Music Release Template.md')
          .setValue(this.plugin.settings.templateFile)
          .onChange(async (value) => {
            this.plugin.settings.templateFile = value.trim();
            await this.plugin.saveSettings();
          });
      });

    this.renderCustomFields(customFieldsPane);
    activateTab(this.plugin.settings.templateMode);

    // Open new note
    new Setting(containerEl)
      .setName('Open note after creation')
      .setDesc('Automatically open the newly created note.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.openNewNote)
        .onChange(async (value) => {
          this.plugin.settings.openNewNote = value;
          await this.plugin.saveSettings();
        }));

    // Album art folder
    new Setting(containerEl)
      .setName('Album art folder')
      .setDesc('Folder to save downloaded cover art. When set, {{coverUrl}} in templates resolves to the local vault path instead of a remote URL. Leave empty to keep remote URLs.')
      .addText(text => {
        new FolderSuggest(this.app, text.inputEl, (value) => {
          this.plugin.settings.artFolder = value.trim();
          void this.plugin.saveSettings();
        });
        text
          .setPlaceholder('e.g. Assets/Album Art')
          .setValue(this.plugin.settings.artFolder)
          .onChange(async (value) => {
            this.plugin.settings.artFolder = value.trim();
            await this.plugin.saveSettings();
          });
      });

    // Show cover art in search
    new Setting(containerEl)
      .setName('Show cover art in search results')
      .setDesc('Display album artwork next to search results. Requires fetching from Cover Art Archive.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showCoverInSearch)
        .onChange(async (value) => {
          this.plugin.settings.showCoverInSearch = value;
          await this.plugin.saveSettings();
        }));

    // Template variables reference
    new Setting(containerEl).setName('Available template variables').setHeading();

    const varTable = containerEl.createEl('table', { cls: 'music-search-var-table' });

    const headers = varTable.createEl('tr');
    ['Variable', 'YAML type', 'Description'].forEach(h => {
      headers.createEl('th', { text: h });
    });

    const variables: [string, string, string][] = [
      ['{{tags}}', 'string[]', 'Custom tags (optional, defaults to an empty list)'],
      ['{{title}}', 'string', 'Album/release title'],
      ['{{artist}}', 'string', 'Artist name(s)'],
      ['{{artistMbid}}', 'string', 'Artist MusicBrainz ID'],
      ['{{year}}', 'string', 'First release year (e.g. "1997")'],
      ['{{date}}', 'string', 'First release date (e.g. "1997-05-21")'],
      ['{{trackCount}}', 'number', 'Number of tracks'],
      ['{{trackList}}', 'string', 'Formatted tracklist (use in note body, not frontmatter)'],
      ['{{genres}}', 'string[]', 'Genres as a YAML list'],
      ['{{genresInline}}', 'string', 'Genres as a comma-separated string'],
      ['{{coverUrl}}', 'string', 'Cover art URL (or local vault path if art folder is set)'],
      ['{{coverEmbed}}', 'string', 'Embedded cover art — ![[path]] for local files, ![](url) for remote. Use in the note body, not frontmatter.'],
      ['{{mbid}}', 'string', 'MusicBrainz release group ID'],
      ['{{releaseGroupMbid}}', 'string', 'MusicBrainz release group ID (alias for {{mbid}})'],
      ['{{mbUrl}}', 'string', 'MusicBrainz release group URL'],
      ['{{discogsUrl}}', 'string', 'Discogs master release URL'],
      ['{{wikipediaUrl}}', 'string', 'Wikipedia article URL'],
      ['{{releaseType}}', 'string', 'Release type (Album, Single, EP, etc.)'],
      ['{{disambiguation}}', 'string', 'Disambiguation comment'],
      ['{{DATE}}', 'string', 'Current date (YYYY-MM-DD). Use {{DATE:FORMAT}} for custom format, e.g. {{DATE:YYYY/MM/DD}}'],
    ];

    for (const [variable, type, desc] of variables) {
      const row = varTable.createEl('tr');
      row.createEl('td', { text: variable, cls: 'music-search-var-table-variable' });
      row.createEl('td', { text: type, cls: 'music-search-var-table-type' });
      row.createEl('td', { text: desc });
    }

    // Default template description
    new Setting(containerEl).setName('Default template').setHeading();
    containerEl.createEl('p', {
      text: 'The default template generates a note with YAML frontmatter containing all available data and the full track list. Use custom fields to extend it, or switch to template file for full control.',
    });
  }

  private renderCustomFields(container: HTMLElement) {
    container.empty();

    for (let i = 0; i < this.plugin.settings.customFields.length; i++) {
      const field = this.plugin.settings.customFields[i];
      new Setting(container)
        .addText(name => name
          .setPlaceholder('Field name')
          .setValue(field.name)
          .onChange(async (value) => {
            this.plugin.settings.customFields[i].name = value;
            await this.plugin.saveSettings();
          }))
        .addText(val => val
          .setPlaceholder('value (can use {{variables}})')
          .setValue(field.value)
          .onChange(async (value) => {
            this.plugin.settings.customFields[i].value = value;
            await this.plugin.saveSettings();
          }))
        .addButton(btn => btn
          .setButtonText('Remove')
          .onClick(async () => {
            this.plugin.settings.customFields.splice(i, 1);
            await this.plugin.saveSettings();
            this.renderCustomFields(container);
          }));
    }

    new Setting(container)
      .addButton(btn => btn
        .setButtonText('Add custom field')
        .onClick(async () => {
          this.plugin.settings.customFields.push({ name: '', value: '' });
          await this.plugin.saveSettings();
          this.renderCustomFields(container);
        }));
  }
}

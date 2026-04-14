import { App, PluginSettingTab, Setting } from 'obsidian';
import type MusicSearchPlugin from '../main';

export interface MusicSearchSettings {
  folder: string;
  fileNameTemplate: string;
  templateFile: string;
  openNewNote: boolean;
  showCoverInSearch: boolean;
  tags: string;
}

export const DEFAULT_SETTINGS: MusicSearchSettings = {
  folder: '',
  fileNameTemplate: '{{artist}} - {{title}}',
  templateFile: '',
  openNewNote: true,
  showCoverInSearch: true,
  tags: '',
};

export const DEFAULT_NOTE_TEMPLATE = `---
tags:{{tags}}
artist: {{artist}}
artist-mbid: {{artistMbid}}
title: {{title}}
disambiguation: {{disambiguation}}
release-date: {{date}}
release-year: "{{year}}"
album-type: {{releaseType}}
track-count: {{trackCount}}
genres:{{genres}}
album-art: {{coverUrl}}
mbid: {{mbid}}
link-musicbrainz: {{mbUrl}}
---

## Tracklist

{{trackList}}
`;

export class MusicSearchSettingTab extends PluginSettingTab {
  plugin: MusicSearchPlugin;

  constructor(app: App, plugin: MusicSearchPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Music Search Settings' });

    // Note destination folder
    new Setting(containerEl)
      .setName('Note destination folder')
      .setDesc('Where to save new music notes. Leave empty for vault root.')
      .addText(text => text
        .setPlaceholder('e.g. Music/Releases')
        .setValue(this.plugin.settings.folder)
        .onChange(async (value) => {
          this.plugin.settings.folder = value.trim();
          await this.plugin.saveSettings();
        }));

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
        .setPlaceholder('e.g. music, albums')
        .setValue(this.plugin.settings.tags)
        .onChange(async (value) => {
          this.plugin.settings.tags = value;
          await this.plugin.saveSettings();
        }));

    // Template file
    new Setting(containerEl)
      .setName('Template file')
      .setDesc('Path to a template note in your vault. If set, this file will be used as the note template. Leave empty to use the built-in default template.')
      .addText(text => text
        .setPlaceholder('e.g. Templates/Music Release Template.md')
        .setValue(this.plugin.settings.templateFile)
        .onChange(async (value) => {
          this.plugin.settings.templateFile = value.trim();
          await this.plugin.saveSettings();
        }));

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
    containerEl.createEl('h3', { text: 'Available Template Variables' });

    const varTable = containerEl.createEl('table');
    varTable.style.width = '100%';
    varTable.style.borderCollapse = 'collapse';
    varTable.style.fontSize = '12px';

    const headers = varTable.createEl('tr');
    ['Variable', 'Description'].forEach(h => {
      const th = headers.createEl('th');
      th.style.textAlign = 'left';
      th.style.padding = '4px 8px';
      th.style.borderBottom = '1px solid var(--background-modifier-border)';
      th.setText(h);
    });

    const variables = [
      ['{{tags}}', 'Custom tags (optional, will default to an empty list)'],
      ['{{title}}', 'Album/release title'],
      ['{{artist}}', 'Artist name(s)'],
      ['{{artistMbid}}', 'Artist MusicBrainz ID'],
      ['{{year}}', 'First release year (e.g. 1997)'],
      ['{{date}}', 'First release date (e.g. 1997-05-21)'],
      ['{{trackCount}}', 'Number of tracks'],
      ['{{trackList}}', 'Formatted tracklist'],
      ['{{genres}}', 'Genres as YAML list items'],
      ['{{genresInline}}', 'Genres as comma-separated string'],
      ['{{coverUrl}}', 'Cover art URL'],
      ['{{mbid}}', 'MusicBrainz release group ID'],
      ['{{releaseGroupMbid}}', 'MusicBrainz release group ID'],
      ['{{mbUrl}}', 'MusicBrainz release group URL'],
      ['{{releaseType}}', 'Release type (Album, Single, EP, etc.)'],
      ['{{disambiguation}}', 'Disambiguation comment'],
    ];

    for (const [variable, desc] of variables) {
      const row = varTable.createEl('tr');
      const tdVar = row.createEl('td');
      tdVar.style.padding = '4px 8px';
      tdVar.style.fontFamily = 'monospace';
      tdVar.style.color = 'var(--text-accent)';
      tdVar.setText(variable);
      const tdDesc = row.createEl('td');
      tdDesc.style.padding = '4px 8px';
      tdDesc.setText(desc);
    }

    // Example template
    containerEl.createEl('h3', { text: 'Default Template' });
    containerEl.createEl('p', {
      text: 'When no template file is set, the plugin generates a note with YAML frontmatter containing all available data and the full track list. Create your own template file and point to it above to fully customize the output.',
    });
  }
}

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

class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private onSelect: (value: string) => void;

  constructor(app: App, inputEl: HTMLInputElement, onSelect: (value: string) => void) {
    super(app, inputEl);
    this.onSelect = onSelect;
  }

  getSuggestions(query: string): TFolder[] {
    return this.app.vault.getAllFolders(false)
      .filter(f => f.path.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50);
  }
  renderSuggestion(folder: TFolder, el: HTMLElement) {
    el.setText(folder.path);
  }
  selectSuggestion(folder: TFolder) {
    this.setValue(folder.path);
    this.onSelect(folder.path);
    this.close();
  }
}

class FileSuggest extends AbstractInputSuggest<TFile> {
  private onSelect: (value: string) => void;

  constructor(app: App, inputEl: HTMLInputElement, onSelect: (value: string) => void) {
    super(app, inputEl);
    this.onSelect = onSelect;
  }

  getSuggestions(query: string): TFile[] {
    return this.app.vault.getMarkdownFiles()
      .filter(f => f.path.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50);
  }
  renderSuggestion(file: TFile, el: HTMLElement) {
    el.setText(file.path);
  }
  selectSuggestion(file: TFile) {
    this.setValue(file.path);
    this.onSelect(file.path);
    this.close();
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

    containerEl.createEl('h2', { text: 'Music Search Settings' });

    // Note destination folder
    new Setting(containerEl)
      .setName('Note destination folder')
      .setDesc('Where to save new music notes. Leave empty for vault root.')
      .addText(text => {
        new FolderSuggest(this.app, text.inputEl, async (value) => {
          this.plugin.settings.folder = value.trim();
          await this.plugin.saveSettings();
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
        .setPlaceholder('e.g. music, albums')
        .setValue(this.plugin.settings.tags)
        .onChange(async (value) => {
          this.plugin.settings.tags = value;
          await this.plugin.saveSettings();
        }));

    // Note template section (tabs: custom fields vs template file)
    containerEl.createEl('h3', { text: 'Note Template' });
    containerEl.createEl('p', {
      text: 'Choose one mode: add custom fields to the default template, or provide a full template file.',
      cls: 'setting-item-description',
    });

    const tabRow = containerEl.createDiv();
    tabRow.style.display = 'flex';
    tabRow.style.gap = '8px';
    tabRow.style.marginBottom = '12px';
    const customFieldsTabBtn = tabRow.createEl('button', { text: 'Custom Fields' });
    const templateFileTabBtn = tabRow.createEl('button', { text: 'Template File' });

    const customFieldsPane = containerEl.createDiv();
    const templateFilePane = containerEl.createDiv();

    const activateTab = (mode: 'custom-fields' | 'template-file') => {
      this.plugin.settings.templateMode = mode;
      customFieldsTabBtn.classList.toggle('mod-cta', mode === 'custom-fields');
      templateFileTabBtn.classList.toggle('mod-cta', mode === 'template-file');
      customFieldsPane.style.display = mode === 'custom-fields' ? '' : 'none';
      templateFilePane.style.display = mode === 'template-file' ? '' : 'none';
    };

    customFieldsTabBtn.addEventListener('click', async () => {
      activateTab('custom-fields');
      await this.plugin.saveSettings();
    });
    templateFileTabBtn.addEventListener('click', async () => {
      activateTab('template-file');
      await this.plugin.saveSettings();
    });

    new Setting(templateFilePane)
      .setName('Template file')
      .setDesc('Path to a template note in your vault. All available {{variables}} will be substituted.')
      .addText(text => {
        new FileSuggest(this.app, text.inputEl, async (value) => {
          this.plugin.settings.templateFile = value.trim();
          await this.plugin.saveSettings();
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
        new FolderSuggest(this.app, text.inputEl, async (value) => {
          this.plugin.settings.artFolder = value.trim();
          await this.plugin.saveSettings();
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
    containerEl.createEl('h3', { text: 'Available Template Variables' });

    const varTable = containerEl.createEl('table');
    varTable.style.width = '100%';
    varTable.style.borderCollapse = 'collapse';
    varTable.style.fontSize = '12px';

    const headers = varTable.createEl('tr');
    ['Variable', 'YAML type', 'Description'].forEach(h => {
      const th = headers.createEl('th');
      th.style.textAlign = 'left';
      th.style.padding = '4px 8px';
      th.style.borderBottom = '1px solid var(--background-modifier-border)';
      th.setText(h);
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
      const tdVar = row.createEl('td');
      tdVar.style.padding = '4px 8px';
      tdVar.style.fontFamily = 'monospace';
      tdVar.style.color = 'var(--text-accent)';
      tdVar.setText(variable);
      const tdType = row.createEl('td');
      tdType.style.padding = '4px 8px';
      tdType.style.fontFamily = 'monospace';
      tdType.style.color = 'var(--text-muted)';
      tdType.setText(type);
      const tdDesc = row.createEl('td');
      tdDesc.style.padding = '4px 8px';
      tdDesc.setText(desc);
    }

    // Default template description
    containerEl.createEl('h3', { text: 'Default Template' });
    containerEl.createEl('p', {
      text: 'The default template generates a note with YAML frontmatter containing all available data and the full track list. Use Custom Fields to extend it, or switch to Template File for full control.',
    });
  }

  private renderCustomFields(container: HTMLElement) {
    container.empty();

    for (let i = 0; i < this.plugin.settings.customFields.length; i++) {
      const field = this.plugin.settings.customFields[i];
      new Setting(container)
        .addText(name => name
          .setPlaceholder('field-name')
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

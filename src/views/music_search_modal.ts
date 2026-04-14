import { App, Modal, Setting } from 'obsidian';

export class MusicSearchModal extends Modal {
  private query = '';
  private onSubmit: (query: string) => void;

  constructor(app: App, onSubmit: (query: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '🎵 Search Music Releases' });
    contentEl.createEl('p', {
      text: 'Search by artist name, album title, or both. Uses the MusicBrainz database.',
      cls: 'setting-item-description',
    });

    new Setting(contentEl)
      .setName('Search query')
      .setDesc('e.g. "Radiohead OK Computer" or "Burial Untrue"')
      .addText(text => {
        text
          .setPlaceholder('Artist, album, or both...')
          .setValue(this.query)
          .onChange(value => {
            this.query = value;
          });

        // Submit on Enter
        text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' && this.query.trim()) {
            this.close();
            this.onSubmit(this.query.trim());
          }
        });

        // Auto-focus
        setTimeout(() => text.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Search')
        .setCta()
        .onClick(() => {
          if (this.query.trim()) {
            this.close();
            this.onSubmit(this.query.trim());
          }
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }
}

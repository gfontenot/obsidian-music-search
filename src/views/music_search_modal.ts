import { App, ButtonComponent, Modal, Setting, TextComponent } from 'obsidian';

export class MusicSearchModal extends Modal {
  private query = '';
  private onSubmit: (query: string) => Promise<void>;

  constructor(app: App, onSubmit: (query: string) => Promise<void>) {
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

    let searchText: TextComponent;
    let searchBtn: ButtonComponent;

    const errorEl = contentEl.createEl('p', { cls: 'mod-warning' });
    errorEl.style.display = 'none';

    const setLoading = (loading: boolean) => {
      searchText.setDisabled(loading);
      searchBtn.setDisabled(loading);
      searchBtn.setButtonText(loading ? 'Searching…' : 'Search');
    };

    const doSubmit = () => {
      const q = this.query.trim();
      if (!q) return;
      errorEl.style.display = 'none';
      setLoading(true);
      this.onSubmit(q)
        .then(() => this.close())
        .catch(err => {
          setLoading(false);
          errorEl.style.display = '';
          errorEl.setText(err.message);
        });
    };

    new Setting(contentEl)
      .setName('Search query')
      .setDesc('e.g. "Radiohead OK Computer" or "Burial Untrue"')
      .addText(text => {
        searchText = text;
        text
          .setPlaceholder('Artist, album, or both...')
          .setValue(this.query)
          .onChange(value => { this.query = value; });

        text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') doSubmit();
        });

        setTimeout(() => text.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .addButton(btn => {
        searchBtn = btn;
        btn.setButtonText('Search').setCta().onClick(doSubmit);
      })
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }
}

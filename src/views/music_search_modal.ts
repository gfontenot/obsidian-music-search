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

    contentEl.createEl('h2', { text: 'Search music releases' });
    contentEl.createEl('p', {
      text: 'Search by artist name, album title, or both. Uses the MusicBrainz database.',
      cls: 'setting-item-description',
    });

    let searchText: TextComponent;
    let searchBtn: ButtonComponent;

    const errorEl = contentEl.createEl('p', { cls: 'mod-warning' });
    errorEl.hide();

    const setLoading = (loading: boolean) => {
      searchText.setDisabled(loading);
      searchBtn.setDisabled(loading);
      searchBtn.setButtonText(loading ? 'Searching…' : 'Search');
    };

    const doSubmit = async () => {
      const q = this.query.trim();
      if (!q) return;
      errorEl.hide();
      setLoading(true);
      try {
        await this.onSubmit(q);
        this.close();
      } catch (err) {
        setLoading(false);
        errorEl.show();
        errorEl.setText(err instanceof Error ? err.message : String(err));
      }
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
          if (e.key === 'Enter') void doSubmit();
        });

        activeWindow.setTimeout(() => text.inputEl.focus(), 50);
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

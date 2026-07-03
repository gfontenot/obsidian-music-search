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
import { SearchQuery } from '../api/musicbrainz';
import { errorMessage } from '../utils/errors';

export class MusicSearchModal extends Modal {
  private artist = '';
  private release = '';
  private onSubmit: (query: SearchQuery) => Promise<void>;
  private vpHandler?: () => void;

  constructor(app: App, onSubmit: (query: SearchQuery) => Promise<void>) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Search music releases' });
    contentEl.createEl('p', {
      text: 'Search by artist, release title, or both. Uses the MusicBrainz database.',
      cls: 'setting-item-description',
    });

    let artistText: TextComponent;
    let releaseText: TextComponent;
    let searchBtn: ButtonComponent;

    const errorEl = contentEl.createEl('p', { cls: 'mod-warning' });
    errorEl.hide();

    const setLoading = (loading: boolean) => {
      artistText.setDisabled(loading);
      releaseText.setDisabled(loading);
      searchBtn.setDisabled(loading);
      searchBtn.setButtonText(loading ? 'Searching…' : 'Search');
    };

    const doSubmit = async () => {
      if (!this.artist.trim() && !this.release.trim()) return;
      errorEl.hide();
      setLoading(true);
      try {
        await this.onSubmit({ artist: this.artist, release: this.release });
        this.close();
      } catch (err) {
        setLoading(false);
        errorEl.show();
        errorEl.setText(errorMessage(err));
      }
    };

    new Setting(contentEl)
      .setName('Artist')
      .addText(text => {
        artistText = text;
        text
          .setPlaceholder('e.g. Radiohead')
          .setValue(this.artist)
          .onChange(value => { this.artist = value; });

        text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') void doSubmit();
        });

        activeWindow.setTimeout(() => text.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .setName('Release')
      .addText(text => {
        releaseText = text;
        text
          .setPlaceholder('e.g. OK Computer')
          .setValue(this.release)
          .onChange(value => { this.release = value; });

        text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') void doSubmit();
        });
      });

    new Setting(contentEl)
      .addButton(btn => {
        searchBtn = btn;
        btn.setButtonText('Search').setCta().onClick(doSubmit);
      })
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()));

    const vv = window.visualViewport;
    if (vv) {
      this.vpHandler = () => {
        this.containerEl.style.height = `${vv.height}px`;
        const active = document.activeElement as HTMLElement | null;
        if (active && this.contentEl.contains(active)) {
          active.scrollIntoView({ block: 'nearest' });
        }
      };
      vv.addEventListener('resize', this.vpHandler);
    }
  }

  onClose() {
    if (window.visualViewport && this.vpHandler) {
      window.visualViewport.removeEventListener('resize', this.vpHandler);
      this.vpHandler = undefined;
    }
    this.contentEl.empty();
  }
}

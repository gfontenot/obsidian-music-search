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

import { App, FuzzyMatch, FuzzySuggestModal, Modal } from 'obsidian';
import { Release } from '../models/release.model';

export class ReleaseSuggestModal extends FuzzySuggestModal<Release> {
  private releases: Release[];
  private onChoose: (release: Release) => void;
  private showCovers: boolean;

  constructor(app: App, releases: Release[], onChoose: (release: Release) => void, showCovers = true) {
    super(app);
    this.releases = releases;
    this.onChoose = onChoose;
    this.showCovers = showCovers;
    this.setPlaceholder('Select a release...');
    this.emptyStateText = 'No releases found.';
  }

  getItems(): Release[] {
    return this.releases;
  }

  getItemText(release: Release): string {
    return `${release.artist} – ${release.title} ${release.year ? `(${release.year})` : ''}`;
  }

  renderSuggestion(match: FuzzyMatch<Release>, el: HTMLElement) {
    const release = match.item;
    el.addClass('music-search-suggestion');

    const wrapper = el.createDiv({ cls: 'music-search-suggestion-wrapper' });

    if (this.showCovers && release.coverUrl) {
      const imgWrapper = wrapper.createDiv({ cls: 'music-search-cover' });
      const img = imgWrapper.createEl('img');
      img.src = release.coverUrl;
      img.alt = release.title;
    } else if (this.showCovers) {
      wrapper.createDiv({ cls: 'music-search-cover-placeholder', text: '🎵' });
    }

    const info = wrapper.createDiv({ cls: 'music-search-info' });

    info.createDiv({ cls: 'music-search-title', text: `${release.artist} – ${release.title}` });

    const meta = info.createDiv({ cls: 'music-search-meta' });

    const metaParts: string[] = [];
    if (release.year) metaParts.push(release.year);
    if (release.releaseType) metaParts.push(release.releaseType);
    if (release.genres.length > 0) metaParts.push(release.genres.slice(0, 2).join(', '));
    if (release.disambiguation) metaParts.push(`(${release.disambiguation})`);

    meta.setText(metaParts.join(' · '));
  }

  onChooseItem(release: Release): void {
    this.onChoose(release);
  }
}

export class LoadingProgressModal extends Modal {
  constructor(app: App, private message: string) {
    super(app);
  }

  onOpen() {
    this.contentEl.empty();
    const el = this.contentEl.createEl('p', { text: this.message });
    el.style.textAlign = 'center';
    el.style.padding = '16px 0';
  }

  onClose() {
    this.contentEl.empty();
  }
}

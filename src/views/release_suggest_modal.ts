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
      img.style.width = '48px';
      img.style.height = '48px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '4px';
      img.style.flexShrink = '0';
    } else if (this.showCovers) {
      // Placeholder when no cover
      const placeholder = wrapper.createDiv({ cls: 'music-search-cover-placeholder' });
      placeholder.style.width = '48px';
      placeholder.style.height = '48px';
      placeholder.style.borderRadius = '4px';
      placeholder.style.backgroundColor = 'var(--background-modifier-border)';
      placeholder.style.display = 'flex';
      placeholder.style.alignItems = 'center';
      placeholder.style.justifyContent = 'center';
      placeholder.style.fontSize = '20px';
      placeholder.style.flexShrink = '0';
      placeholder.setText('🎵');
    }

    const info = wrapper.createDiv({ cls: 'music-search-info' });

    const titleLine = info.createDiv({ cls: 'music-search-title' });
    titleLine.style.fontWeight = '600';
    titleLine.style.marginBottom = '2px';
    titleLine.setText(`${release.artist} – ${release.title}`);

    const meta = info.createDiv({ cls: 'music-search-meta' });
    meta.style.fontSize = '12px';
    meta.style.color = 'var(--text-muted)';

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

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

import { App, FuzzyMatch, FuzzySuggestModal } from 'obsidian';
import { Edition } from '../models/release.model';

export class EditionSuggestModal extends FuzzySuggestModal<Edition> {
  private editions: Edition[];
  private onChoose: (edition: Edition) => void;
  private showCovers: boolean;

  constructor(app: App, editions: Edition[], onChoose: (edition: Edition) => void, showCovers = true) {
    super(app);
    this.editions = editions;
    this.onChoose = onChoose;
    this.showCovers = showCovers;
    this.setPlaceholder('Select an edition…');
    this.emptyStateText = 'No editions found.';
  }

  getItems(): Edition[] {
    return this.editions;
  }

  getItemText(edition: Edition): string {
    return [edition.title, edition.format, edition.year, edition.country, edition.disambiguation, edition.status]
      .filter(Boolean)
      .join(' ');
  }

  renderSuggestion(match: FuzzyMatch<Edition>, el: HTMLElement) {
    const edition = match.item;
    el.addClass('music-search-suggestion');

    const wrapper = el.createDiv({ cls: 'music-search-suggestion-wrapper' });

    if (this.showCovers && edition.coverUrl) {
      const imgWrapper = wrapper.createDiv({ cls: 'music-search-cover' });
      const img = imgWrapper.createEl('img');
      img.src = edition.coverUrl;
      img.alt = edition.title;
    } else if (this.showCovers) {
      wrapper.createDiv({ cls: 'music-search-cover-placeholder', text: '🎵' });
    }

    const info = wrapper.createDiv({ cls: 'music-search-info' });
    info.createDiv({ cls: 'music-search-title', text: edition.title });

    const metaParts: string[] = [];
    if (edition.format) metaParts.push(edition.format);
    if (edition.year) metaParts.push(edition.year);
    else if (edition.date) metaParts.push(edition.date);
    if (edition.trackCount) metaParts.push(`${edition.trackCount} tracks`);
    if (edition.status) metaParts.push(edition.status);
    if (edition.country) metaParts.push(edition.country);
    if (edition.disambiguation) metaParts.push(`(${edition.disambiguation})`);

    info.createDiv({ cls: 'music-search-meta', text: metaParts.join(' · ') });
  }

  onChooseItem(edition: Edition): void {
    this.onChoose(edition);
  }
}

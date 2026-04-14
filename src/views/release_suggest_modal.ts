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
  private messageEl: HTMLElement;

  constructor(app: App, private message: string) {
    super(app);
  }

  onOpen() {
    this.contentEl.empty();
    this.messageEl = this.contentEl.createEl('p', { text: this.message });
    this.messageEl.style.textAlign = 'center';
    this.messageEl.style.padding = '16px 0';
  }

  setMessage(message: string) {
    if (this.messageEl) this.messageEl.setText(message);
  }

  onClose() {
    this.contentEl.empty();
  }
}

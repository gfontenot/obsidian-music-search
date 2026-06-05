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

import { App, Modal, Setting, TextComponent, TFile, normalizePath } from 'obsidian';

export type DuplicateResult =
  | { action: 'ignore' }
  | { action: 'replace' }
  | { action: 'save-both'; name: string };

export class DuplicateNoteModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private displayPath: string,
    private folder: string,
    private onChoose: (result: DuplicateResult) => void,
  ) {
    super(app);
  }

  private resolve(result: DuplicateResult) {
    this.resolved = true;
    this.close();
    this.onChoose(result);
  }

  onOpen() {
    this.showChoicePhase();
  }

  private showChoicePhase() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Note already exists' });
    contentEl.createEl('p', {
      text: `A note already exists at "${this.displayPath}". What would you like to do?`,
      cls: 'setting-item-description',
    });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Keep existing')
        .onClick(() => this.resolve({ action: 'ignore' })))
      .addButton(btn => btn
        .setButtonText('Replace')
        .setWarning()
        .onClick(() => this.resolve({ action: 'replace' })))
      .addButton(btn => btn
        .setButtonText('Choose new name')
        .setCta()
        .onClick(() => this.showNamePhase()));
  }

  private showNamePhase() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Save as copy' });

    const errorEl = contentEl.createEl('p', { cls: 'mod-warning' });
    errorEl.hide();

    let nameInput: TextComponent;

    const baseName = this.displayPath.replace(/\.md$/, '').split('/').pop() ?? '';

    new Setting(contentEl)
      .setName('Note name')
      .addText(text => {
        nameInput = text;
        text
          .setValue(baseName)
          .setPlaceholder('Enter a unique name…');
        text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') this.trySave(nameInput.getValue(), errorEl);
        });
        activeWindow.setTimeout(() => text.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Save')
        .setCta()
        .onClick(() => this.trySave(nameInput.getValue(), errorEl)))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.resolve({ action: 'ignore' })));
  }

  private trySave(rawName: string, errorEl: HTMLElement) {
    const name = rawName.trim();
    if (!name) {
      errorEl.setText('Please enter a name.');
      errorEl.show();
      return;
    }
    const candidate = normalizePath(
      this.folder ? `${this.folder}/${name}.md` : `${name}.md`
    );
    if (this.app.vault.getAbstractFileByPath(candidate) instanceof TFile) {
      errorEl.setText(`"${name}" already exists. Please choose a different name.`);
      errorEl.show();
      return;
    }
    this.resolve({ action: 'save-both', name });
  }

  onClose() {
    if (!this.resolved) {
      this.onChoose({ action: 'ignore' });
    }
    this.contentEl.empty();
  }
}

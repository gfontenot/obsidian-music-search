export class Vault {
  getAbstractFileByPath(_path: string): TAbstractFile | null { return null; }
  read(_file: TFile): Promise<string> { return Promise.resolve(''); }
  create(_path: string, _content: string): Promise<TFile> { return Promise.resolve(new TFile('')); }
  createBinary(_path: string, _data: ArrayBuffer): Promise<TFile> { return Promise.resolve(new TFile('')); }
  createFolder(_path: string): Promise<void> { return Promise.resolve(); }
  modify(_file: TFile, _content: string): Promise<void> { return Promise.resolve(); }
}

export class TAbstractFile {
  path: string;
  constructor(path: string) { this.path = path; }
}

export class App {
  vault: Vault = new Vault();
  workspace = {
    getLeaf: (_newLeaf?: boolean) => ({
      openFile: (_file: TFile) => Promise.resolve(),
    }),
  };
}

export abstract class AbstractInputSuggest<T> {
  protected inputEl: HTMLInputElement;
  constructor(_app: App, inputEl: HTMLInputElement) {
    this.inputEl = inputEl;
  }
  setValue(_value: string) {}
  getValue(): string { return this.inputEl.value; }
  close() {}
  abstract getSuggestions(query: string): T[] | Promise<T[]>;
  abstract renderSuggestion(value: T, el: HTMLElement): void;
  abstract selectSuggestion(value: T, evt?: MouseEvent | KeyboardEvent): void;
}

export class TFile {
  path: string;
  constructor(path = '') {
    this.path = path;
  }
}

export class TFolder {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

export class Plugin {
  app: App;
  constructor(app: App, _manifest?: unknown) {
    this.app = app;
  }
  loadData() { return Promise.resolve({}); }
  saveData(_data: unknown) { return Promise.resolve(); }
  addRibbonIcon(_icon: string, _title: string, _callback: () => unknown): HTMLElement { return {} as HTMLElement; }
  addCommand(_command: unknown) {}
  addSettingTab(_settingTab: unknown) {}
}

export class PluginSettingTab {
  app: App;
  containerEl: HTMLElement;
  constructor(app: App) {
    this.app = app;
    this.containerEl = document.createElement('div');
  }
}

export class Modal {
  app: App;
  contentEl: HTMLElement;
  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement('div');
  }
  open() {}
  close() {}
}

export class FuzzySuggestModal<T> extends Modal {
  setPlaceholder() { return this; }
  emptyStateText = '';
  open() {}
  close() {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName() { return this; }
  setDesc() { return this; }
  addText() { return this; }
  addToggle() { return this; }
  addButton() { return this; }
}

export class Notice {
  constructor(_message: string, _timeout?: number) {}
  hide() {}
  noticeEl = {} as HTMLElement;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export async function requestUrl(options: unknown): Promise<{ status: number; json: unknown; arrayBuffer: ArrayBuffer }> {
  const url = typeof options === 'string' ? options : (options as { url: string }).url;
  const headers = typeof options === 'string' ? undefined : (options as { headers?: Record<string, string> }).headers;
  const response = await fetch(url, { headers });
  const status = response.status ?? (response.ok !== false ? 200 : 400);
  let json: unknown;
  try { json = await response.json(); } catch { json = undefined; }
  return { status, json, arrayBuffer: new ArrayBuffer(0) };
}

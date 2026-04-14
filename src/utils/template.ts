import { App, TFile } from 'obsidian';
import { Release } from '../models/release.model';

export function replaceVariables(template: string, release: Release, userTags: string[] = []): string {

  // Build tracklist string
  const trackList = release.tracks.length > 0
    ? release.tracks.map(t => `${t.number}. ${t.title}${t.duration ? ` (${t.duration})` : ''}`).join('\n')
    : '';

  // Build tags as YAML list
  const tagsYaml = userTags.length > 0
    ? '\n' + userTags.map(t => `  - ${t}`).join('\n')
    : '[]';

  // Build genres as YAML list or comma-separated
  const genresYaml = release.genres.length > 0
    ? '\n' + release.genres.map(g => `  - ${g}`).join('\n')
    : '[]';
  const genresInline = release.genres.join(', ');

  const vars: Record<string, string> = {
    tags: tagsYaml,
    title: release.title,
    artist: release.artist,
    artistMbid: release.artistMbid,
    date: release.date,
    year: release.year,
    country: release.country,
    label: release.label,
    catalogNumber: release.catalogNumber,
    format: release.format,
    trackCount: String(release.trackCount),
    trackList,
    genres: genresYaml,
    genresInline,
    coverUrl: release.coverUrl,
    mbid: release.mbid,
    mbUrl: release.mbUrl,
    releaseGroupMbid: release.releaseGroupMbid,
    releaseType: release.releaseType,
    status: release.status,
    barcode: release.barcode,
    disambiguation: release.disambiguation,
  };

  // Handle standard variables
  let result = template.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
    const trimmed = key.trim();
    return vars[trimmed] !== undefined ? vars[trimmed] : '';
  });

  return result;
}

function formatDate(date: Date, format: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return format
    .replace('YYYY', String(date.getFullYear()))
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
}

export async function getTemplateContents(app: App, templatePath: string): Promise<string> {
  if (!templatePath) return '';
  const file = app.vault.getAbstractFileByPath(templatePath);
  if (file instanceof TFile) {
    return await app.vault.read(file);
  }
  return '';
}

export function makeFileName(template: string, release: Release): string {
  const name = replaceVariables(template, release);
  // Sanitize: remove illegal filename characters
  return name.replace(/[\\/:*?"<>|]/g, '').trim();
}

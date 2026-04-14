import { App, TFile } from 'obsidian';
import { Release } from '../models/release.model';

// Wraps a scalar value in double-quotes if it contains characters that would
// break YAML parsing (colons, hashes, brackets, etc.). Safe values are
// returned as-is. Internal backslashes and double-quotes are escaped.
function toYamlScalar(value: string): string {
  if (!value) return value;
  const needsQuoting =
    /[:#\[\]{},|>!%@`&*'"\n\r]/.test(value) ||
    /^[-?~\s]/.test(value) ||
    /\s$/.test(value) ||
    /^(true|false|yes|no|on|off|null)$/i.test(value) ||
    /^\d+(\.\d+)?$/.test(value);
  if (!needsQuoting) return value;
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '') + '"';
}

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
    // YAML block values — not escaped, must be used as-is in the template
    tags: tagsYaml,
    genres: genresYaml,
    trackList,
    trackCount: String(release.trackCount),
    // Scalar values — escaped so they're safe in YAML frontmatter
    title: toYamlScalar(release.title),
    artist: toYamlScalar(release.artist),
    artistMbid: toYamlScalar(release.artistMbid),
    date: toYamlScalar(release.date),
    year: toYamlScalar(release.year),
    country: toYamlScalar(release.country),
    label: toYamlScalar(release.label),
    catalogNumber: toYamlScalar(release.catalogNumber),
    format: toYamlScalar(release.format),
    genresInline: toYamlScalar(genresInline),
    coverUrl: toYamlScalar(release.coverUrl),
    mbid: toYamlScalar(release.mbid),
    mbUrl: toYamlScalar(release.mbUrl),
    discogsUrl: toYamlScalar(release.discogsUrl),
    wikipediaUrl: toYamlScalar(release.wikipediaUrl),
    releaseGroupMbid: toYamlScalar(release.releaseGroupMbid),
    releaseType: toYamlScalar(release.releaseType),
    status: toYamlScalar(release.status),
    barcode: toYamlScalar(release.barcode),
    disambiguation: toYamlScalar(release.disambiguation),
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

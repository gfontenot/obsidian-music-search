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
    ? '\n' + userTags.map(t => `  - ${toYamlScalar(t)}`).join('\n')
    : '[]';

  // Build genres as YAML list or comma-separated
  const genresYaml = release.genres.length > 0
    ? '\n' + release.genres.map(g => `  - ${toYamlScalar(g)}`).join('\n')
    : '[]';
  const genresInline = release.genres.join(', ');

  // coverEmbed: Obsidian wikilink for local paths, markdown image for remote URLs
  const coverEmbed = release.coverUrl
    ? /^https?:\/\//.test(release.coverUrl)
      ? `![](${release.coverUrl})`
      : `![[${release.coverUrl}]]`
    : '';

  const vars: Record<string, string> = {
    // YAML block values — not escaped, must be used as-is in the template
    tags: tagsYaml,
    genres: genresYaml,
    trackList,
    coverEmbed,
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

  const now = new Date();
  let result = template.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
    const trimmed = key.trim();
    if (trimmed === 'DATE' || trimmed.startsWith('DATE:')) {
      const fmt = trimmed === 'DATE' ? 'YYYY-MM-DD' : trimmed.slice(5);
      return toYamlScalar(formatDate(now, fmt));
    }
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

export function appendCustomFields(
  template: string,
  fields: { name: string; value: string }[],
): string {
  const active = fields.filter(f => f.name.trim());
  if (active.length === 0) return template;

  const lines = template.split('\n');
  let closingIdx = -1;
  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') { closingIdx = i; break; }
    }
  }

  const fieldLines = active.map(f => `${f.name.trim()}: ${f.value}`);

  if (closingIdx === -1) {
    return template + '\n' + fieldLines.join('\n');
  }

  return [
    ...lines.slice(0, closingIdx),
    ...fieldLines,
    ...lines.slice(closingIdx),
  ].join('\n');
}

export function makeFileName(template: string, release: Release): string {
  const rawVars: Record<string, string> = {
    title: release.title,
    artist: release.artist,
    artistMbid: release.artistMbid,
    year: release.year,
    date: release.date,
    country: release.country,
    label: release.label,
    catalogNumber: release.catalogNumber,
    format: release.format,
    releaseType: release.releaseType,
    status: release.status,
    barcode: release.barcode,
    disambiguation: release.disambiguation,
    mbid: release.mbid,
    releaseGroupMbid: release.releaseGroupMbid,
  };

  const now = new Date();
  const name = template.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
    const trimmed = key.trim();
    if (trimmed === 'DATE' || trimmed.startsWith('DATE:')) {
      const fmt = trimmed === 'DATE' ? 'YYYY-MM-DD' : trimmed.slice(5);
      return formatDate(now, fmt);
    }
    return rawVars[trimmed] ?? '';
  });

  return name.replace(/[\\/:*?"<>|]/g, '').trim();
}

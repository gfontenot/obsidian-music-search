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

export interface Release {
  mbid: string;
  title: string;
  artist: string;
  artistMbid: string;
  date: string;
  year: string;
  country: string;
  label: string;
  catalogNumber: string;
  format: string;
  trackCount: number;
  tracks: Track[];
  genres: string[];
  coverUrl: string;
  releaseGroupMbid: string;
  releaseType: string;
  status: string;
  barcode: string;
  disambiguation: string;
  mbUrl: string;
  discogsUrl: string;
  wikipediaUrl: string;
}

export interface Track {
  number: string;
  title: string;
  duration: string;
  durationMs: number;
}

export function formatDuration(ms: number): string {
  if (!ms) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

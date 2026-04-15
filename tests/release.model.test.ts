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

import { formatDuration } from '../src/models/release.model';

describe('formatDuration', () => {
  it('returns empty string for 0', () => {
    expect(formatDuration(0)).toBe('');
  });

  it('returns empty string for falsy values', () => {
    expect(formatDuration(NaN)).toBe('');
  });

  it('formats whole minutes', () => {
    expect(formatDuration(60000)).toBe('1:00');
    expect(formatDuration(120000)).toBe('2:00');
  });

  it('pads seconds to two digits', () => {
    expect(formatDuration(9000)).toBe('0:09');
    expect(formatDuration(69000)).toBe('1:09');
  });

  it('handles minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1:30');
    expect(formatDuration(3661000)).toBe('61:01');
  });

  it('truncates sub-second precision', () => {
    expect(formatDuration(60500)).toBe('1:00');
    expect(formatDuration(61999)).toBe('1:01');
  });
});

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

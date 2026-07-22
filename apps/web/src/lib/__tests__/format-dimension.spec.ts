import { formatDimensionWithUncertainty } from '../format-dimension';

describe('formatDimensionWithUncertainty', () => {
  it('formats a bare value in French locale when there is no uncertainty', () => {
    expect(formatDimensionWithUncertainty(420)).toBe('4,20 m');
  });

  it('treats null, undefined and 0 uncertainty the same as absent', () => {
    expect(formatDimensionWithUncertainty(420, null)).toBe('4,20 m');
    expect(formatDimensionWithUncertainty(420, undefined)).toBe('4,20 m');
    expect(formatDimensionWithUncertainty(420, 0)).toBe('4,20 m');
  });

  it('appends the rounded uncertainty band when positive', () => {
    expect(formatDimensionWithUncertainty(420, 15)).toBe('4,20 m ± 15 cm');
    expect(formatDimensionWithUncertainty(420, 8.4)).toBe('4,20 m ± 8 cm');
  });
});

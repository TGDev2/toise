import {
  QUOTE_FLOW_STEPS,
  QUOTE_FLOW_TOTAL,
  quoteFlowStepHref,
  quoteFlowStepLabel,
  quoteFlowStepNumber,
} from '../quote-flow';

describe('quote-flow', () => {
  it('describes the six steps from photo to quote', () => {
    expect(QUOTE_FLOW_TOTAL).toBe(6);
    expect(QUOTE_FLOW_STEPS.map((s) => s.key)).toEqual([
      'photos',
      'dimensions',
      'work',
      'estimate',
      'prices',
      'quote',
    ]);
  });

  it('numbers steps from 1 for display', () => {
    expect(quoteFlowStepNumber('photos')).toBe(1);
    expect(quoteFlowStepNumber('quote')).toBe(QUOTE_FLOW_TOTAL);
  });

  it('exposes short labels for the progress bar', () => {
    expect(quoteFlowStepLabel('prices')).toBe('Prix');
  });

  it('builds project-scoped hrefs matching the App Router segments', () => {
    expect(quoteFlowStepHref('work', 'abc')).toBe(
      '/projects/abc/work-selection',
    );
    expect(quoteFlowStepHref('prices', 'abc')).toBe(
      '/projects/abc/shopping-list',
    );
    expect(quoteFlowStepHref('quote', 'abc')).toBe('/projects/abc/quote/new');
  });
});

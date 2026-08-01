import { captureReferralCodeFromUrl, REFERRAL_CODE_STORAGE_KEY } from '../referral';

describe('captureReferralCodeFromUrl', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores the code from the `ref` query param', () => {
    window.history.pushState({}, '', '/register?ref=ABCD2345');

    captureReferralCodeFromUrl();

    expect(localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)).toBe('ABCD2345');
  });

  it('does nothing when there is no `ref` query param', () => {
    window.history.pushState({}, '', '/register');

    captureReferralCodeFromUrl();

    expect(localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)).toBeNull();
  });
});

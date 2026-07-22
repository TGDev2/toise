import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoCaptureGuidance, CAPTURE_TIPS } from '../PhotoCaptureGuidance';

describe('PhotoCaptureGuidance', () => {
  it('lists all capture tips (angles, recul, lumière, porte visible)', () => {
    render(<PhotoCaptureGuidance onAcknowledge={() => {}} />);

    for (const tip of CAPTURE_TIPS) {
      expect(screen.getByText(tip.text, { exact: false })).toBeInTheDocument();
    }
  });

  it('calls onAcknowledge when the user confirms', () => {
    const onAcknowledge = jest.fn();
    render(<PhotoCaptureGuidance onAcknowledge={onAcknowledge} />);

    fireEvent.click(
      screen.getByRole('button', { name: /Compris, commencer/i }),
    );

    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });
});

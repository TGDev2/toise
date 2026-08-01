import { render, screen } from '@testing-library/react';
import { InvoiceStatusBadge } from '../InvoiceStatusBadge';

describe('InvoiceStatusBadge', () => {
  it('labels an issued invoice', () => {
    render(<InvoiceStatusBadge status="issued" />);
    expect(screen.getByText('Émise')).toBeInTheDocument();
  });

  it('labels a paid invoice', () => {
    render(<InvoiceStatusBadge status="paid" />);
    expect(screen.getByText('Payée')).toBeInTheDocument();
  });

  it('colours the two states differently', () => {
    const { unmount } = render(<InvoiceStatusBadge status="issued" />);
    const issuedClass = screen.getByText('Émise').className;
    unmount();

    render(<InvoiceStatusBadge status="paid" />);
    expect(screen.getByText('Payée').className).not.toBe(issuedClass);
  });
});

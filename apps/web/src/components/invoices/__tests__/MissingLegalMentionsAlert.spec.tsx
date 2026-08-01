import { render, screen } from '@testing-library/react';
import { MissingLegalMentionsAlert } from '../MissingLegalMentionsAlert';

describe('MissingLegalMentionsAlert', () => {
  it('translates the API field keys into readable French labels', () => {
    render(
      <MissingLegalMentionsAlert
        missingFields={['vat_number', 'registration', 'insurance']}
      />,
    );

    expect(
      screen.getByText(/Numéro de TVA intracommunautaire/),
    ).toBeInTheDocument();
    expect(screen.getByText(/répertoire des métiers/)).toBeInTheDocument();
    expect(screen.getByText(/Assurance décennale/)).toBeInTheDocument();
  });

  it('points the user at the page where the mentions are filled in', () => {
    render(<MissingLegalMentionsAlert missingFields={['insurance']} />);

    expect(
      screen.getByRole('link', { name: /Compléter mon profil entreprise/ }),
    ).toHaveAttribute('href', '/settings/company');
  });

  it('announces itself to assistive technology', () => {
    render(<MissingLegalMentionsAlert missingFields={['siret']} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('falls back to the raw key for an unknown field', () => {
    render(<MissingLegalMentionsAlert missingFields={['something_new']} />);
    expect(screen.getByText('something_new')).toBeInTheDocument();
  });
});

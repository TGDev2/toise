import { render, screen } from '@testing-library/react';
import { AnalysisResultPanel } from '../AnalysisResultPanel';

describe('AnalysisResultPanel', () => {
  const onAccept = jest.fn();
  const onEdit = jest.fn();

  it('renders bare dimension values when no uncertainty is provided', () => {
    render(
      <AnalysisResultPanel
        lengthCm={420}
        widthCm={310}
        heightCm={250}
        confidence="high"
        onAccept={onAccept}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText('4,20 m')).toBeInTheDocument();
    expect(screen.queryByText(/±/)).not.toBeInTheDocument();
  });

  // CV-5 : chaque dimension affiche sa propre fourchette, indépendamment
  // des autres.
  it('renders a per-dimension uncertainty band when provided (CV-5)', () => {
    render(
      <AnalysisResultPanel
        lengthCm={420}
        widthCm={310}
        heightCm={250}
        confidence="medium"
        lengthUncertaintyCm={15}
        widthUncertaintyCm={8}
        heightUncertaintyCm={null}
        onAccept={onAccept}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText('4,20 m ± 15 cm')).toBeInTheDocument();
    expect(screen.getByText('3,10 m ± 8 cm')).toBeInTheDocument();
    // Hauteur : pas d'incertitude connue → valeur sèche.
    expect(screen.getByText('2,50 m')).toBeInTheDocument();
  });
});

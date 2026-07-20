import { render, screen, fireEvent } from '@testing-library/react';
import { RoomSwitcher } from '../RoomSwitcher';

const rooms = [
  { id: 'r1', name: 'Salon' },
  { id: 'r2', name: 'Chambre' },
];

describe('RoomSwitcher', () => {
  const onSelect = jest.fn();
  const onAdd = jest.fn();
  const onRename = jest.fn();
  const onDelete = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  const renderFull = () =>
    render(
      <RoomSwitcher
        rooms={rooms}
        activeRoomId="r1"
        onSelect={onSelect}
        onAdd={onAdd}
        onRename={onRename}
        onDelete={onDelete}
      />,
    );

  it('renders a pill for each room', () => {
    renderFull();
    expect(screen.getByText('Salon')).toBeInTheDocument();
    expect(screen.getByText('Chambre')).toBeInTheDocument();
  });

  it('calls onSelect when clicking another room', () => {
    renderFull();
    fireEvent.click(screen.getByText('Chambre'));
    expect(onSelect).toHaveBeenCalledWith('r2');
  });

  it('calls onAdd when clicking "Ajouter une pièce"', () => {
    renderFull();
    fireEvent.click(screen.getByText(/ajouter une pièce/i));
    expect(onAdd).toHaveBeenCalled();
  });

  it('renames the active room via the inline input', () => {
    renderFull();
    fireEvent.click(screen.getByLabelText('Renommer Salon'));
    const input = screen.getByLabelText('Nom de la pièce');
    fireEvent.change(input, { target: { value: 'Cuisine' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('r1', 'Cuisine');
  });

  it('deletes the active room after inline confirmation', () => {
    renderFull();
    fireEvent.click(screen.getByLabelText('Supprimer Salon'));
    // Confirmation bar appears
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onDelete).toHaveBeenCalledWith('r1');
  });

  it('hides CRUD affordances in selection-only mode', () => {
    render(
      <RoomSwitcher rooms={rooms} activeRoomId="r1" onSelect={onSelect} />,
    );
    expect(screen.queryByText(/ajouter une pièce/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Renommer Salon')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Supprimer Salon')).not.toBeInTheDocument();
  });
});

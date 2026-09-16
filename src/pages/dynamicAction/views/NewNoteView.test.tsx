import React from 'react';
// IMPORTANTE: Adicionamos o "screen" aqui nos imports
import { render, fireEvent, screen } from '@testing-library/react-native';
import { NewNoteView } from './NewNoteView';

describe('NewNoteView Component - Wizard Flow', () => {
  it('renders only the selection buttons initially', () => {
    // Apenas chame o render sem desestruturar nada dele
    render(<NewNoteView />);

    // Use screen.getByText e screen.queryByText diretamente
    expect(screen.getByText('SELECIONE O TIPO DE MEDIÇÃO')).toBeTruthy();
    expect(screen.getByText('Glicemia')).toBeTruthy();
    
    expect(screen.queryByText('SALVAR ANOTAÇÃO')).toBeNull(); 
  });

  it('hides buttons and shows form and back button when a type is selected', () => {
    render(<NewNoteView />);

    fireEvent.press(screen.getByText('Glicemia'));

    expect(screen.queryByText('SELECIONE O TIPO DE MEDIÇÃO')).toBeNull();
    expect(screen.queryByText('Temperatura Corporal')).toBeNull();

    expect(screen.getByText('NOVA ANOTAÇÃO: GLICEMIA')).toBeTruthy();
    expect(screen.getByText('Trocar Medição')).toBeTruthy();
    expect(screen.getByText('SALVAR ANOTAÇÃO')).toBeTruthy();
  });

  it('returns to selection screen when back button is pressed', () => {
    render(<NewNoteView />);

    fireEvent.press(screen.getByText('Pressão'));
    const backButton = screen.getByText('Trocar Medição');
    
    fireEvent.press(backButton);

    expect(screen.getByText('SELECIONE O TIPO DE MEDIÇÃO')).toBeTruthy();
    expect(screen.queryByText('SALVAR ANOTAÇÃO')).toBeNull();
  });
});

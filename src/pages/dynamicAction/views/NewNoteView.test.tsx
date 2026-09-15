import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NewNoteView } from './NewNoteView';

// Declarações de ambiente para o TypeScript reconhecer o Jest sem alterar o tsconfig
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => {
  toBeTruthy: () => void;
  toBeNull: () => void;
};

describe('NewNoteView Component - Wizard Flow', () => {
  it('renders only the selection buttons initially', () => {
    const { getByText, queryByText } = render(<NewNoteView />);

    expect(getByText('SELECIONE O TIPO DE MEDIÇÃO')).toBeTruthy();
    expect(getByText('Glicemia')).toBeTruthy();
    
    expect(queryByText('SALVAR ANOTAÇÃO')).toBeNull(); 
  });

  it('hides buttons and shows form and back button when a type is selected', () => {
    const { getByText, queryByText } = render(<NewNoteView />);

    fireEvent.press(getByText('Glicemia'));

    expect(queryByText('SELECIONE O TIPO DE MEDIÇÃO')).toBeNull();
    expect(queryByText('Temperatura Corporal')).toBeNull();

    expect(getByText('NOVA ANOTAÇÃO: GLICEMIA')).toBeTruthy();
    expect(getByText('Trocar Medição')).toBeTruthy();
    expect(getByText('SALVAR ANOTAÇÃO')).toBeTruthy();
  });

  it('returns to selection screen when back button is pressed', () => {
    const { getByText, queryByText } = render(<NewNoteView />);

    fireEvent.press(getByText('Pressão'));
    const backButton = getByText('Trocar Medição');
    
    fireEvent.press(backButton);

    expect(getByText('SELECIONE O TIPO DE MEDIÇÃO')).toBeTruthy();
    expect(queryByText('SALVAR ANOTAÇÃO')).toBeNull();
  });
});
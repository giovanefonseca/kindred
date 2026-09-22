import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// 1. Importações ES6 limpas
import { SetReminderView } from '../../pages/dynamicAction/views/SetReminderView';
import { auth } from '../../config/firebaseConfig';
import { addDoc } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// INFRAESTRUTURA / MOCKS
// ---------------------------------------------------------------------------
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    addDoc: jest.fn().mockResolvedValue({ id: 'test-doc-id' }),
}));

jest.mock('../../config/firebaseConfig', () => ({
    auth: { currentUser: { uid: 'mocked-user-id' } },
    db: {},
}));

jest.mock('../../services/NotificationService', () => ({
    NotificationService: {
        scheduleReminder: jest.fn(),
    },
}));

jest.mock('../../config/reminderFormConfig', () => ({
    getReminderCategories: () => [
        { id: '1', key: 'cat1', label: 'Categoria 1', fields: [{ name: 'title', type: 'text' }] },
        { id: '2', key: 'cat2', label: 'Categoria 2', fields: [] },
    ],
    createInitialCategoryState: jest.fn(() => ({})),
    validateCategoryPayload: jest.fn(() => ({ isValid: true, errors: {}, cleanPayload: { title: 'Teste' } })),
}));

// ---------------------------------------------------------------------------
// SUÍTE DE TESTES (Aplicação & Domínio)
// ---------------------------------------------------------------------------
describe('SetReminderView', () => {
    // Mock explícito da prop de sucesso para satisfazer o compilador estrito do TS
    const mockOnSaveSuccess = jest.fn();

    beforeEach(() => {
        (auth as any).currentUser = { uid: 'mocked-user-id' };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('deve renderizar as categorias e permitir troca', async () => {
        // Correção da Linha 56: RNTL v14+ render é assíncrono (Promise<RenderResult>), requer await
        const { getByLabelText, getByText } = await render(
            <SetReminderView onSaveSuccess={mockOnSaveSuccess} />
        );
        
        // Verifica se a primeira categoria aparece
        expect(getByText('Categoria 1')).toBeTruthy();
        
        // Simula click para trocar categoria
        const cat2Button = getByLabelText('Categoria Categoria 2');
        fireEvent.press(cat2Button);
        
        expect(cat2Button.props.accessibilityState.selected).toBe(true);
    });

    it('não deve disparar save se usuário não estiver autenticado', async () => {
        (auth as any).currentUser = null; 
        
        // Correção da Linha 75: RNTL v14+ render é assíncrono (Promise<RenderResult>), requer await
        const { getByLabelText } = await render(
            <SetReminderView onSaveSuccess={mockOnSaveSuccess} />
        );
        
        const saveButton = getByLabelText('Salvar Lembrete');
        fireEvent.press(saveButton);
        
        // Verifica diretamente pelo import isolado
        expect(addDoc).not.toHaveBeenCalled();
    });
});
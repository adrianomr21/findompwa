import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService } from '../js/settings-service.js';

describe('SettingsService - Gerenciamento de Configurações', () => {
    let mockDb;
    let settingsService;
    const userId = 'user123';

    beforeEach(() => {
        // Mock do Firestore
        mockDb = {
            collection: vi.fn().mockReturnThis(),
            doc: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            get: vi.fn(),
            add: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        };
        settingsService = new SettingsService(mockDb, userId);
    });

    describe('Categorias', () => {
        it('deve buscar categorias ordenadas por nome', async () => {
            const mockSnapshot = {
                docs: [
                    { id: 'cat1', data: () => ({ name: 'Alimentação', limit: 1000 }) },
                    { id: 'cat2', data: () => ({ name: 'Transporte', limit: 500 }) }
                ]
            };
            mockDb.get.mockResolvedValue(mockSnapshot);

            const categories = await settingsService.getCategories();

            expect(mockDb.collection).toHaveBeenCalledWith('users');
            expect(mockDb.doc).toHaveBeenCalledWith(userId);
            expect(mockDb.collection).toHaveBeenCalledWith('categories');
            expect(mockDb.orderBy).toHaveBeenCalledWith('name');
            expect(categories).toHaveLength(2);
            expect(categories[0].id).toBe('cat1');
            expect(categories[0].name).toBe('Alimentação');
        });

        it('deve adicionar uma nova categoria sem ID', async () => {
            const newCat = { name: 'Saúde', limit: 300 };
            await settingsService.saveCategory(newCat);

            expect(mockDb.add).toHaveBeenCalledWith(newCat);
            expect(mockDb.update).not.toHaveBeenCalled();
        });

        it('deve atualizar uma categoria existente (removendo o ID do corpo)', async () => {
            const existingCat = { id: 'cat1', name: 'Saúde Alterada', limit: 400 };
            await settingsService.saveCategory(existingCat);

            expect(mockDb.doc).toHaveBeenCalledWith('cat1');
            expect(mockDb.update).toHaveBeenCalledWith({ name: 'Saúde Alterada', limit: 400 });
            expect(mockDb.add).not.toHaveBeenCalled();
        });

        it('deve excluir uma categoria pelo ID', async () => {
            await settingsService.deleteCategory('cat1');
            expect(mockDb.doc).toHaveBeenCalledWith('cat1');
            expect(mockDb.delete).toHaveBeenCalled();
        });
    });

    describe('Formas de Pagamento', () => {
        it('deve salvar uma nova forma de pagamento', async () => {
            const method = { name: 'Nubank', type: 'credito', paymentDay: 10 };
            await settingsService.savePaymentMethod(method);
            expect(mockDb.add).toHaveBeenCalledWith(method);
        });

        it('deve atualizar uma forma de pagamento existente', async () => {
            const method = { id: 'pay1', name: 'Nubank Atualizado', type: 'credito' };
            await settingsService.savePaymentMethod(method);
            expect(mockDb.doc).toHaveBeenCalledWith('pay1');
            expect(mockDb.update).toHaveBeenCalledWith({ name: 'Nubank Atualizado', type: 'credito' });
        });
    });

    describe('Dívidas Fixas', () => {
        it('deve buscar dívidas fixas corretamente', async () => {
            const mockSnapshot = {
                docs: [
                    { id: 'debt1', data: () => ({ name: 'Aluguel', value: 1200 }) }
                ]
            };
            mockDb.get.mockResolvedValue(mockSnapshot);

            const debts = await settingsService.getFixedDebts();
            expect(debts).toHaveLength(1);
            expect(debts[0].name).toBe('Aluguel');
        });

        it('deve salvar uma dívida fixa', async () => {
            const debt = { name: 'Internet', value: 100, paymentDay: 5 };
            await settingsService.saveFixedDebt(debt);
            expect(mockDb.add).toHaveBeenCalledWith(debt);
        });
    });
});
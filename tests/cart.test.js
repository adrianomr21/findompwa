import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CartService } from '../js/cart-service.js';

describe('CartService - Gerenciamento de Carrinhos e Itens', () => {
    let mockDb;
    let cartService;
    const userId = 'user123';

    beforeEach(() => {
        // Mock do Firestore
        mockDb = {
            collection: vi.fn().mockReturnThis(),
            doc: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            get: vi.fn(),
            add: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            batch: vi.fn(() => ({
                delete: vi.fn(),
                commit: vi.fn().mockResolvedValue()
            }))
        };
        
        // Mock global de firebase para FieldValue.serverTimestamp()
        global.firebase = {
            firestore: {
                FieldValue: {
                    serverTimestamp: vi.fn(() => 'mock-timestamp')
                }
            }
        };

        cartService = new CartService(mockDb, userId);
    });

    describe('Gerenciamento de Carrinhos (Grupos)', () => {
        it('deve buscar carrinhos filtrados por userId e ordenados', async () => {
            const mockSnapshot = {
                docs: [
                    { id: 'cart1', data: () => ({ name: 'Mercado', userId: 'user123' }) },
                    { id: 'cart2', data: () => ({ name: 'Farmácia', userId: 'user123' }) }
                ]
            };
            mockDb.get.mockResolvedValue(mockSnapshot);

            const carts = await cartService.getCarts();

            expect(mockDb.collection).toHaveBeenCalledWith('carrinhos');
            expect(mockDb.where).toHaveBeenCalledWith('userId', '==', userId);
            expect(mockDb.orderBy).toHaveBeenCalledWith('createdAt', 'asc');
            expect(carts).toHaveLength(2);
            expect(carts[0].name).toBe('Mercado');
        });

        it('deve salvar um novo carrinho', async () => {
            const newCart = { name: 'Churrasco' };
            mockDb.add.mockResolvedValue({ id: 'new-id' });

            await cartService.saveCart(newCart);

            expect(mockDb.collection).toHaveBeenCalledWith('carrinhos');
            expect(mockDb.add).toHaveBeenCalledWith({
                name: 'Churrasco',
                userId: userId,
                createdAt: 'mock-timestamp'
            });
        });

        it('deve atualizar um carrinho existente', async () => {
            const existingCart = { id: 'cart1', name: 'Mercado Mensal' };
            await cartService.saveCart(existingCart);

            expect(mockDb.doc).toHaveBeenCalledWith('cart1');
            expect(mockDb.update).toHaveBeenCalledWith({ name: 'Mercado Mensal' });
        });

        it('deve excluir um carrinho e todos os seus itens usando batch', async () => {
            const cartId = 'cart1';
            // Mock para busca de itens órfãos
            const mockItemsSnapshot = {
                docs: [
                    { id: 'item1', data: () => ({ name: 'Arroz', cartId: 'cart1' }) },
                    { id: 'item2', data: () => ({ name: 'Feijão', cartId: 'cart1' }) }
                ]
            };
            mockDb.get.mockResolvedValue(mockItemsSnapshot);

            await cartService.deleteCart(cartId);

            expect(mockDb.batch).toHaveBeenCalled();
            // Verifica se deletou o carrinho e os itens
            expect(mockDb.doc).toHaveBeenCalledWith('cart1');
            expect(mockDb.doc).toHaveBeenCalledWith('item1');
            expect(mockDb.doc).toHaveBeenCalledWith('item2');
        });
    });

    describe('Gerenciamento de Itens', () => {
        it('deve buscar itens de um carrinho e ordenar manualmente por createdAt', async () => {
            const cartId = 'cart1';
            const mockSnapshot = {
                docs: [
                    { id: 'i2', data: () => ({ name: 'B', createdAt: { seconds: 200 } }) },
                    { id: 'i1', data: () => ({ name: 'A', createdAt: { seconds: 100 } }) }
                ]
            };
            mockDb.get.mockResolvedValue(mockSnapshot);

            const items = await cartService.getItems(cartId);

            expect(mockDb.collection).toHaveBeenCalledWith('carrinho_itens');
            expect(mockDb.where).toHaveBeenCalledWith('userId', '==', userId);
            expect(mockDb.where).toHaveBeenCalledWith('cartId', '==', cartId);
            // Verifica ordenação manual no código
            expect(items[0].id).toBe('i1');
            expect(items[1].id).toBe('i2');
        });

        it('deve salvar um novo item com bought: false por padrão', async () => {
            const newItem = { name: 'Sabonete', cartId: 'cart1' };
            mockDb.add.mockResolvedValue({ id: 'item-id' });

            await cartService.saveItem(newItem);

            expect(mockDb.add).toHaveBeenCalledWith({
                name: 'Sabonete',
                cartId: 'cart1',
                userId: userId,
                bought: false,
                createdAt: 'mock-timestamp'
            });
        });

        it('deve atualizar o status de "comprado" de um item', async () => {
            const itemId = 'item1';
            await cartService.toggleItemBought(itemId, true);

            expect(mockDb.doc).toHaveBeenCalledWith(itemId);
            expect(mockDb.update).toHaveBeenCalledWith({ bought: true });
        });

        it('deve excluir um item pelo ID', async () => {
            const itemId = 'item1';
            await cartService.deleteItem(itemId);
            
            expect(mockDb.doc).toHaveBeenCalledWith(itemId);
            expect(mockDb.delete).toHaveBeenCalled();
        });
    });
});

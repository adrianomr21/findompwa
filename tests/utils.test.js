import { describe, it, expect } from 'vitest';
import { calculateTotal, calculateInstallments, getInstallmentStatus, calculateCategorySpending, maskCurrency, parseCurrency } from '../js/utils.js';

describe('Fin - Utility Functions', () => {
    
    describe('maskCurrency', () => {
        it('deve formatar 1 centavo corretamente', () => {
            expect(maskCurrency('1')).toBe('0,01');
        });

        it('deve formatar 10 centavos corretamente', () => {
            expect(maskCurrency('10')).toBe('0,10');
        });

        it('deve formatar 1 real corretamente', () => {
            expect(maskCurrency('100')).toBe('1,00');
        });

        it('deve formatar mil reais com separador de milhar', () => {
            expect(maskCurrency('100000')).toBe('1.000,00');
        });

        it('deve ignorar caracteres não numéricos', () => {
            expect(maskCurrency('R$ 1.234,56')).toBe('1.234,56');
        });
        
        it('deve lidar com strings vazias', () => {
            expect(maskCurrency('')).toBe('0,00');
        });
    });

    describe('parseCurrency', () => {
        it('deve converter "1,00" para 1.0', () => {
            expect(parseCurrency('1,00')).toBe(1.0);
        });

        it('deve converter "1.234,56" para 1234.56', () => {
            expect(parseCurrency('1.234,56')).toBe(1234.56);
        });

        it('deve retornar 0 para valores inválidos', () => {
            expect(parseCurrency('')).toBe(0);
            expect(parseCurrency(null)).toBe(0);
            expect(parseCurrency(undefined)).toBe(0);
        });

        it('deve retornar o próprio valor se já for número', () => {
            expect(parseCurrency(150.50)).toBe(150.50);
        });
    });

    it('deve calcular o total de um array de despesas corretamente', () => {
        const expenses = [
            { value: 100 },
            { value: 250.50 },
            { value: "50" }
        ];
        expect(calculateTotal(expenses)).toBe(400.50);
    });

    it('deve calcular as parcelas corretamente', () => {
        const total = 100;
        const parcelas = 2;
        const res = calculateInstallments(total, parcelas);
        expect(res).toHaveLength(2);
        expect(res[0]).toBe(50);
    });

    it('deve retornar o valor total se for apenas 1 parcela', () => {
        expect(calculateInstallments(100, 1)).toEqual([100]);
    });

    describe('getInstallmentStatus', () => {
        const date = '2026-01-15T12:00:00Z'; // Janeiro 2026

        it('deve retornar Parcela 1 para o mesmo mês', () => {
            expect(getInstallmentStatus(date, 3, 0, 2026)).toBe(1);
        });

        it('deve retornar Parcela 2 para o mês seguinte', () => {
            expect(getInstallmentStatus(date, 3, 1, 2026)).toBe(2);
        });

        it('deve retornar Parcela 12 na virada do ano', () => {
            // Despesa em Jan/2026, Parcela 12 cai em Dez/2026
            expect(getInstallmentStatus(date, 12, 11, 2026)).toBe(12);
        });

        it('deve retornar null se a despesa ainda não começou', () => {
            expect(getInstallmentStatus(date, 3, 11, 2025)).toBe(null);
        });

        it('deve retornar null se a despesa já terminou', () => {
            expect(getInstallmentStatus(date, 3, 4, 2026)).toBe(null);
        });
    });

    describe('calculateCategorySpending', () => {
        const categories = [
            { id: 'cat1', name: 'Alimentação', limit: 1000 },
            { id: 'cat2', name: 'Transporte', limit: 500 }
        ];

        const expenses = [
            { value: 100, categoryId: 'cat1', date: '2026-03-10T12:00:00Z', type: 'a-vista' },
            { value: 50, categoryId: 'cat1', date: '2026-03-15T12:00:00Z', type: 'a-vista' },
            { value: 200, categoryId: 'cat2', date: '2026-03-20T12:00:00Z', type: 'a-vista' },
            { value: 300, categoryId: 'cat1', date: '2026-04-10T12:00:00Z', type: 'a-vista' }, // Outro mês
            { value: 100, categoryId: 'cat1', date: '2026-01-10T12:00:00Z', type: 'parcelado', installments: 3 } // Março é parcela 3
        ];

        it('deve calcular corretamente os gastos por categoria para Março 2026', () => {
            const res = calculateCategorySpending(expenses, categories, 2, 2026); // Março = 2
            expect(res['cat1']).toBe(100 + 50 + 100); // 250
            expect(res['cat2']).toBe(200);
        });

        it('deve retornar 0 para categorias sem gastos no período', () => {
            const res = calculateCategorySpending(expenses, categories, 5, 2026); // Junho = 5
            expect(res['cat1']).toBe(0);
            expect(res['cat2']).toBe(0);
        });

        it('deve considerar apenas despesas com categorias válidas', () => {
            const invalidExp = [
                { value: 500, categoryId: 'non-existent', date: '2026-03-10T12:00:00Z', type: 'a-vista' }
            ];
            const res = calculateCategorySpending(invalidExp, categories, 2, 2026);
            expect(Object.keys(res)).toHaveLength(2);
            expect(res['cat1']).toBe(0);
            expect(res['cat2']).toBe(0);
        });
    });
});
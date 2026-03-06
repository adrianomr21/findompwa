import { describe, it, expect } from 'vitest';
import { calculateTotal, calculateInstallments, getInstallmentStatus } from '../js/utils.js';

describe('Fin - Utility Functions', () => {
    
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
});
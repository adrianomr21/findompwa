import { describe, it, expect } from 'vitest';
import { calculateTotal, calculateInstallments } from '../js/utils.js';

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
});
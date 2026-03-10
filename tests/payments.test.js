import { describe, it, expect } from 'vitest';
import { calculatePayTotal, calculateDueDateForMonth } from '../js/utils.js';

describe('Fin - Payments Logic (Tela Pagar)', () => {
    
    describe('calculatePayTotal', () => {
        it('deve calcular o total de pagamentos corretamente', () => {
            const payments = [
                { actualValue: 100, ignored: false },
                { actualValue: 200, ignored: false },
                { actualValue: 300, ignored: true }
            ];
            expect(calculatePayTotal(payments)).toBe(300);
        });

        it('deve retornar 0 para lista vazia ou nula', () => {
            expect(calculatePayTotal([])).toBe(0);
            expect(calculatePayTotal(null)).toBe(0);
        });

        it('deve lidar com valores em string', () => {
            const payments = [
                { actualValue: "150.50", ignored: false },
                { actualValue: "50", ignored: false }
            ];
            expect(calculatePayTotal(payments)).toBe(200.50);
        });
    });

    describe('calculateDueDateForMonth', () => {
        it('deve retornar a data padrão (dia 10) se o método for nulo', () => {
            const res = calculateDueDateForMonth(null, 2, 2026); // Março (0-indexed 2)
            const date = new Date(res);
            expect(date.getDate()).toBe(10);
            expect(date.getMonth()).toBe(2);
            expect(date.getFullYear()).toBe(2026);
        });

        it('deve usar paymentDay para cartão de crédito', () => {
            const method = { type: 'credito', paymentDay: 5 };
            const res = calculateDueDateForMonth(method, 0, 2026); // Janeiro
            const date = new Date(res);
            expect(date.getDate()).toBe(5);
        });

        it('deve usar dueDay para boleto', () => {
            const method = { type: 'boleto', dueDay: 20 };
            const res = calculateDueDateForMonth(method, 1, 2026); // Fevereiro
            const date = new Date(res);
            expect(date.getDate()).toBe(20);
        });

        it('deve usar dia 10 se dueDay não estiver definido no boleto', () => {
            const method = { type: 'boleto' };
            const res = calculateDueDateForMonth(method, 1, 2026);
            const date = new Date(res);
            expect(date.getDate()).toBe(10);
        });
    });
});

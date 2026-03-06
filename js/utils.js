// Funções utilitárias para o sistema
export function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function calculateTotal(expenses) {
    return expenses.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
}

export function calculateInstallments(total, num) {
    if (!num || num <= 1) return [total];
    const value = (total / num).toFixed(2);
    return Array(num).fill(parseFloat(value));
}

/**
 * Calcula qual a parcela atual de uma despesa baseada em um mês/ano de referência.
 * @returns {number|null} O número da parcela (1 a N) ou null se não pertencer ao período.
 */
export function getInstallmentStatus(expenseDate, installments, filterMonth, filterYear) {
    const start = new Date(expenseDate);
    const startMonth = start.getMonth();
    const startYear = start.getFullYear();

    const diffMonths = (filterYear - startYear) * 12 + (filterMonth - startMonth);

    if (diffMonths >= 0 && diffMonths < installments) {
        return diffMonths + 1;
    }
    return null;
}
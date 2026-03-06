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
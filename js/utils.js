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
export function getInstallmentStatus(baseDate, installments, filterMonth, filterYear) {
    const start = new Date(baseDate);
    const startMonth = start.getMonth();
    const startYear = start.getFullYear();

    const diffMonths = (filterYear - startYear) * 12 + (filterMonth - startMonth);

    if (diffMonths >= 0 && diffMonths < installments) {
        return diffMonths + 1;
    }
    return null;
}

/**
 * Calcula a data de vencimento baseada na data da compra e na forma de pagamento.
 * @param {string|Date} purchaseDate Data da compra
 * @param {Object} paymentMethod Objeto da forma de pagamento
 * @returns {string} Data de vencimento em formato ISO
 */
export function calculateDueDate(purchaseDate, paymentMethod) {
    const date = new Date(purchaseDate);
    if (isNaN(date.getTime())) return new Date().toISOString();

    let due = new Date(date);
    due.setHours(12, 0, 0, 0); // Normalizar para meio-dia para evitar problemas de fuso

    if (!paymentMethod) return due.toISOString();

    if (paymentMethod.type === 'debito') {
        // À vista / Débito: Vencimento é o dia da compra
        return due.toISOString();
    }

    if (paymentMethod.type === 'boleto') {
        const dueDay = paymentMethod.dueDay || date.getDate();
        due.setDate(dueDay);
        if (date.getDate() > dueDay) {
            due.setMonth(due.getMonth() + 1);
        }
        return due.toISOString();
    }

    if (paymentMethod.type === 'credito') {
        const endDay = paymentMethod.endDay; // Fechamento
        const paymentDay = paymentMethod.paymentDay; // Vencimento da fatura

        // Se não houver configuração completa, assume o dia do pagamento no mês atual ou seguinte
        if (!paymentDay) return due.toISOString();

        due.setDate(paymentDay);

        // Lógica: se o dia da compra for após o fechamento, o vencimento é no mês seguinte ao ciclo normal
        // Se o paymentDay < endDay (ex: fecha 25, vence 05), o vencimento já seria naturalmente no mês seguinte.

        if (endDay) {
            if (date.getDate() > endDay) {
                // Compra após o fechamento -> Cai na próxima fatura
                due.setMonth(due.getMonth() + 1);
            }
        }

        // Se o dia de pagamento for menor que o dia da compra (e não foi movido pelo fechamento),
        // significa que o vencimento é no próximo mês
        if (due.getTime() < date.getTime()) {
            due.setMonth(due.getMonth() + 1);
        }

        return due.toISOString();
    }

    return due.toISOString();
}
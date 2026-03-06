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
    due.setHours(12, 0, 0, 0);

    if (!paymentMethod) return due.toISOString();

    // 1. Débito / Pix / Dinheiro (À Vista)
    if (paymentMethod.type === 'debito') {
        return due.toISOString();
    }

    // 2. Boleto (Sem ciclo, apenas dia fixo)
    if (paymentMethod.type === 'boleto') {
        const dueDay = paymentMethod.dueDay || date.getDate();
        due.setDate(dueDay);
        if (date.getDate() > dueDay) {
            due.setMonth(due.getMonth() + 1);
        }
        return due.toISOString();
    }

    // 3. Cartão de Crédito (Com ciclo de fechamento)
    if (paymentMethod.type === 'credito') {
        const endDay = paymentMethod.endDay; // Dia de fechamento (ex: 23)
        const paymentDay = paymentMethod.paymentDay; // Dia de vencimento (ex: 05)

        if (!paymentDay) return due.toISOString();

        // Determinar o mês de fechamento da fatura
        let closingMonthDate = new Date(date);
        closingMonthDate.setHours(12, 0, 0, 0);

        if (endDay) {
            // Se o dia da compra passou do dia de fechamento, cai no ciclo do mês seguinte
            if (date.getDate() > endDay) {
                closingMonthDate.setMonth(closingMonthDate.getMonth() + 1);
            }
        }

        // Definir a data de vencimento baseada no mês de fechamento
        due = new Date(closingMonthDate);
        due.setDate(paymentDay);

        // Se o dia de pagamento for menor ou igual ao dia de fechamento,
        // o vencimento é no mês seguinte ao fechamento da fatura.
        // Ex: Fecha dia 23/03, Vence dia 05/04.
        if (endDay && paymentDay <= endDay) {
            due.setMonth(due.getMonth() + 1);
        }

        // Garantia para formas sem ciclo definido (endDay vazio): 
        // Se o vencimento calculado ficou no passado em relação à compra, pula para o próximo mês
        if (due.getTime() < date.getTime()) {
            due.setMonth(due.getMonth() + 1);
        }

        return due.toISOString();
    }

    return due.toISOString();
}
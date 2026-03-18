// Funções utilitárias para o sistema
export function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Máscara de moeda para campos de input.
 * Transforma '1' em '0,01', '123' em '1,23' etc.
 * @param {string} value Valor bruto digitado
 * @returns {string} Valor formatado
 */
export function maskCurrency(value) {
    // Remove tudo que não for dígito
    let v = value.replace(/\D/g, '');
    
    // Converte para centavos
    v = (v / 100).toFixed(2) + '';
    
    // Troca ponto por vírgula
    v = v.replace('.', ',');
    
    // Adiciona separador de milhar
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    
    return v;
}

/**
 * Converte uma string de moeda formatada (ex: "1.234,56") para float.
 * @param {string|number} value Valor formatado ou já numérico
 * @returns {number} Valor em float
 */
export function parseCurrency(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

export function calculateTotal(expenses) {
    return expenses.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
}

export function calculatePayTotal(payments) {
    return (payments || [])
        .filter(p => !p.ignored)
        .reduce((acc, curr) => acc + (parseFloat(curr.actualValue) || 0), 0);
}

export function calculateDueDateForMonth(method, month, year) {
    if (!method) return new Date(year, month, 10).toISOString();
    const day = method.type === 'credito' ? method.paymentDay : (method.dueDay || 10);
    return new Date(year, month, day || 10).toISOString();
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

/**
 * Calcula o total gasto por categoria em um determinado mês e ano.
 * @param {Array} expenses Lista de despesas.
 * @param {Array} categories Lista de categorias.
 * @param {number} month Mês (0-11).
 * @param {number} year Ano.
 * @returns {Object} Um mapa de totais por ID de categoria.
 */
export function calculateCategorySpending(expenses, categories, month, year) {
    const totals = {};
    categories.forEach(cat => totals[cat.id] = 0);

    expenses.forEach(exp => {
        const isParcelado = exp.type === 'parcelado' && exp.installments > 1;
        const baseDate = exp.dueDate || exp.date;

        let val = 0;
        if (isParcelado) {
            const currentInst = getInstallmentStatus(baseDate, exp.installments, month, year);
            if (currentInst) val = exp.value;
        } else {
            const expDate = new Date(baseDate);
            if (expDate.getMonth() === month && expDate.getFullYear() === year) val = exp.value;
        }

        if (val > 0 && totals[exp.categoryId] !== undefined) {
            totals[exp.categoryId] += val;
        }
    });

    return totals;
}

/**
 * Exibe uma notificação toast na tela.
 * @param {string} message Mensagem a ser exibida
 * @param {string} type Tipo da notificação: 'success', 'error', 'info'
 */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('Toast container not found');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'bi-check-circle-fill' : 
                 type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';
    
    toast.innerHTML = `
        <i class="bi ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Remover após 3 segundos
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
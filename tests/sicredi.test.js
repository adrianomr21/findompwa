import { describe, it, expect } from 'vitest';
import { calculateDueDate } from '../js/utils.js';

describe('Cenário Sicredi - Compra 31/03', () => {
    // Configurações comuns do Sicredi (exemplo: fecha 23, vence 01)
    const sicredi = {
        type: 'credito',
        endDay: 23,
        paymentDay: 1
    };

    it('deve calcular corretamente o vencimento para compra em 31/03', () => {
        const purchaseDate = '2026-03-31T12:00:00Z'; // Dia 31 de Março
        const dueDateISO = calculateDueDate(purchaseDate, sicredi);
        const dueDate = new Date(dueDateISO);

        // Se a compra é 31/03 e o fechamento é 23/03:
        // 1. 31 > 23, então closingMonthDate vira Abril.
        // 2. due vira 01 de Abril.
        // 3. Como paymentDay (1) <= endDay (23), o código atual adiciona +1 mês.
        // 4. due vira 01 de Maio.
        
        // O usuário disse que teve que mudar para 01/04 manualmente para "corrigir".
        // Isso implica que ele ESPERAVA que vencesse em 01/05 (próxima fatura), 
        // mas talvez o sistema tenha colocado em 01/04 (fatura que já fechou)?
        // Ou o contrário: o sistema colocou em 01/05 e ele queria 01/04?
        
        // Analisando a frase: "deu erro, tive que colocar manualmente a data para dia 01/04 para corrigir o problema que era a compra ficou no mês errado"
        // Se ele colocou 01/04 para corrigir, e a compra era 31/03, provavelmente o sistema jogou para MAIO (01/05) 
        // e ele queria que aparecesse em ABRIL (01/04).
        
        console.log('Data de Vencimento Calculada:', dueDate.toLocaleDateString('pt-BR'));
        
        // Vamos verificar o que o código atual produz
        // Se endDay=23 e paymentDay=1:
        // closingMonth = Abril (porque 31 > 23)
        // due = 01/Abril
        // Como 1 <= 23, due = 01/Maio.
        
        // Se o Sicredi fecha dia 23 e vence dia 01, uma compra dia 31/03 
        // DEVERIA vencer em 01/05 mesmo, pois a fatura de 01/04 já fechou em 23/03.
        
        // Talvez o endDay do Sicredi seja diferente? Ou o comportamento do JS com meses curtos?
        expect(dueDate.getMonth()).toBe(4); // 4 = Maio (0-indexed)
        expect(dueDate.getDate()).toBe(1);
    });

    it('deve testar com endDay maior que o dia da compra (ex: fecha 05, vence 15)', () => {
        const sicrediAlt = { type: 'credito', endDay: 5, paymentDay: 15 };
        const purchaseDate = '2026-03-31T12:00:00Z';
        const dueDateISO = calculateDueDate(purchaseDate, sicrediAlt);
        const dueDate = new Date(dueDateISO);
        
        // Compra 31/03, fecha 05. 
        // 31 > 5 -> closingMonth = Abril.
        // due = 15/Abril.
        // 15 > 5 -> não adiciona mês extra.
        // Vence 15/04. Correto.
        
        expect(dueDate.getMonth()).toBe(3); // 3 = Abril
        expect(dueDate.getDate()).toBe(15);
    });
});

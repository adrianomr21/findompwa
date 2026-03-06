// Serviço responsável por processar e validar dados para importação
export class ImportService {
    static parseTSV(text) {
        if (!text || !text.trim()) return [];
        
        const lines = text.trim().split('\n');
        if (lines.length < 2) return []; // Precisa de cabeçalho + 1 linha

        const results = [];
        // Pula o cabeçalho
        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split('\t');
            if (columns.length < 7) continue;

            const despesa = {
                dataHora: columns[0].trim(),
                descricao: columns[1].trim(),
                valor: this.parseValue(columns[2]),
                parcelas: columns[3] ? parseInt(columns[3]) : 1,
                dataPagamento: columns[4].trim(),
                metodoPagamento: columns[5].trim(),
                categoria: columns[6].trim()
            };
            results.push(despesa);
        }
        return results;
    }

    static parseValue(valueStr) {
        if (!valueStr) return 0;
        // Converte "20,73" ou "20.73" para float
        const cleanValue = valueStr.replace(',', '.');
        return parseFloat(cleanValue) || 0;
    }
}
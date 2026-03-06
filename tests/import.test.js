import { describe, it, expect } from 'vitest';
import { ImportService } from '../js/import-service.js';

describe('ImportService - Processamento de Dados em Lote', () => {

    it('deve converter uma linha TSV corretamente em objeto de despesa', () => {
        const tsv = "Data\tDesc\tValor\tParcelas\tPagto\tMeio\tCat\n01/01/2024\tTeste\t150,50\t2\t10/01/2024\tCartão\tLazer";
        const result = ImportService.parseTSV(tsv);

        expect(result).toHaveLength(1);
        expect(result[0].descricao).toBe('Teste');
        expect(result[0].valor).toBe(150.50); // Deve tratar a vírgula
        expect(result[0].parcelas).toBe(2);
        expect(result[0].categoria).toBe('Lazer');
    });

    it('deve assumir 1 parcela se o campo estiver vazio', () => {
        const tsv = "Data\tDesc\tValor\tParcelas\tPagto\tMeio\tCat\n01/01/2024\tAlmoço\t25,00\t\t01/01/2024\tDébito\tComida";
        const result = ImportService.parseTSV(tsv);
        
        expect(result[0].parcelas).toBe(1);
    });

    it('deve tratar valores com ponto ou vírgula corretamente', () => {
        expect(ImportService.parseValue("100,50")).toBe(100.50);
        expect(ImportService.parseValue("100.50")).toBe(100.50);
        expect(ImportService.parseValue("100")).toBe(100.00);
    });

    it('deve ignorar linhas mal formatadas (menos de 7 colunas)', () => {
        const tsv = "Data\tDesc\tValor\tParcelas\tPagto\tMeio\tCat\nLinhaInvalida\tSemTabs";
        const result = ImportService.parseTSV(tsv);
        expect(result).toHaveLength(0);
    });

    it('deve retornar array vazio para texto vazio', () => {
        expect(ImportService.parseTSV("")).toEqual([]);
        expect(ImportService.parseTSV(null)).toEqual([]);
    });
});
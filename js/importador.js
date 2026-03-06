import firebaseConfig from './firebase-config.js';

// Inicializa Firebase se ainda não foi inicializado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

async function importarDados(textoBruto) {
    const linhas = textoBruto.split('\n');
    const cabecalho = linhas[0].split('\t');
    
    console.log("Iniciando importação de " + (linhas.length - 1) + " registros...");

    // Pula a primeira linha (cabeçalho)
    for (let i = 1; i < linhas.length; i++) {
        if (!linhas[i].trim()) continue;

        const colunas = linhas[i].split('\t');
        
        // Mapeia as colunas conforme seu arquivo dados.md
        const despesa = {
            dataHora: colunas[0],
            descricao: colunas[1],
            valor: parseFloat(colunas[2].replace(',', '.')),
            parcelas: colunas[3] ? parseInt(colunas[3]) : 1,
            dataPagamento: colunas[4],
            metodoPagamento: colunas[5],
            categoria: colunas[6],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('despesas').add(despesa);
            console.log(`Inserido (${i}): ${despesa.descricao}`);
        } catch (error) {
            console.error(`Erro na linha ${i}:`, error);
        }
    }
    
    alert("Importação concluída com sucesso!");
}

// Para usar: copie o conteúdo do dados.md e cole no console do navegador chamando:
// importarDados(`CONTEUDO_AQUI`)
window.importarDados = importarDados;
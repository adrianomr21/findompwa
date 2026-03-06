import firebaseConfig from './firebase-config.js';
import { AuthService } from './auth-service.js';
import { ImportService } from './import-service.js';

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
const authService = new AuthService(auth);

const authScreen = document.getElementById('auth-screen');
const appWrapper = document.getElementById('app-wrapper');
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLogout = document.getElementById('btn-logout');

// Elementos de alternância Login/Cadastro
const loginBox = document.getElementById('auth-login-box');
const signupBox = document.getElementById('auth-signup-box');
const goToSignup = document.getElementById('go-to-signup');
const goToLogin = document.getElementById('go-to-login');

goToSignup.addEventListener('click', (e) => { e.preventDefault(); loginBox.classList.add('hidden'); signupBox.classList.remove('hidden'); });
goToLogin.addEventListener('click', (e) => { e.preventDefault(); signupBox.classList.add('hidden'); loginBox.classList.remove('hidden'); });

// Lógica de mostrar/esconder senha
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (input.type === 'password') {
            input.type = 'text';
            btn.classList.replace('bi-eye', 'bi-eye-slash');
        } else {
            input.type = 'password';
            btn.classList.replace('bi-eye-slash', 'bi-eye');
        }
    });
});

// Login com Email/Senha
document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    authService.loginWithEmail(email, pass).catch(err => alert("Erro ao entrar: " + err.message));
});

// Cadastro com Email/Senha
document.getElementById('form-signup').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    authService.signUpWithEmail(email, pass)
        .then(() => alert("Conta criada com sucesso!"))
        .catch(err => alert("Erro ao cadastrar: " + err.message));
});

// Gerenciar estado de Autenticação
auth.onAuthStateChanged(user => {
    if (user) {
        authScreen.classList.remove('active');
        appWrapper.style.display = 'flex';
        console.log("Usuário logado:", user.email);
    } else {
        authScreen.classList.add('active');
        appWrapper.style.display = 'none';
    }
});

btnLoginGoogle.addEventListener('click', () => {
    auth.signInWithPopup(provider).catch(error => {
        console.error("Erro no login Google:", error);
        alert("Erro ao entrar com Google.");
    });
});

btnLogout.addEventListener('click', () => {
    authService.logout();
});

// Navegação entre telas (Bottom Nav)
const screens = document.querySelectorAll('.screen');
const navButtons = document.querySelectorAll('#app-nav button');

function showScreen(screenId) {
    screens.forEach(screen => {
        screen.classList.toggle('active', screen.id === `screen-${screenId}`);
    });
    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.screen === screenId);
    });
    
    if (window.navigator.vibrate) {
        window.navigator.vibrate(5);
    }
    
    window.scrollTo(0, 0);
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

// Lógica do formulário de cadastro
const regTypeRadios = document.querySelectorAll('input[name="reg-type"]');
const parcelasField = document.getElementById('parcelas-field');

regTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'parcelado') {
            parcelasField.classList.remove('hidden');
        } else {
            parcelasField.classList.add('hidden');
        }
    });
});

// Mock de dados para inicialização
const mockCategories = [
    { id: '1', name: 'Alimentação', limit: 1200, spent: 850 },
    { id: '2', name: 'Transporte', limit: 400, spent: 150 },
    { id: '3', name: 'Lazer', limit: 300, spent: 280 }
];

const mockPayments = ['Nubank Débito', 'Inter Crédito', 'Pix', 'Dinheiro'];

function populateSelects() {
    const catSelect = document.getElementById('reg-category');
    const paySelect = document.getElementById('reg-payment-method');

    mockCategories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        catSelect.appendChild(opt);
    });

    mockPayments.forEach(pay => {
        const opt = document.createElement('option');
        opt.value = pay;
        opt.textContent = pay;
        paySelect.appendChild(opt);
    });
}

// Lógica da Barra de Progresso da Categoria
const catSelect = document.getElementById('reg-category');
const progressContainer = document.getElementById('category-progress-container');
const progressFill = document.getElementById('progress-fill');
const progSpent = document.getElementById('prog-spent');
const progTotal = document.getElementById('prog-total');
const progText = document.getElementById('prog-text');

catSelect.addEventListener('change', (e) => {
    const cat = mockCategories.find(c => c.id === e.target.value);
    
    if (cat) {
        progressContainer.classList.remove('hidden');
        
        const remaining = cat.limit - cat.spent;
        const percent = Math.min(100, Math.round((cat.spent / cat.limit) * 100));
        
        // Atualiza labels e barra
        progSpent.textContent = `Gasto: R$ ${cat.spent.toFixed(2)}`;
        progTotal.textContent = `Limite: R$ ${cat.limit.toFixed(2)}`;
        progressFill.style.width = `${percent}%`;
        
        // Muda cor se estourar ou chegar perto
        if (percent >= 100) {
            progressFill.style.backgroundColor = '#ff7675';
            progText.textContent = `Atenção: Limite atingido! (Excedente: R$ ${Math.abs(remaining).toFixed(2)})`;
        } else if (percent > 85) {
            progressFill.style.backgroundColor = '#fdcb6e';
            progText.textContent = `Quase lá: Restam R$ ${remaining.toFixed(2)}`;
        } else {
            progressFill.style.backgroundColor = '#00b894';
            progText.textContent = `Equilibrado: Restam R$ ${remaining.toFixed(2)}`;
        }
    } else {
        progressContainer.classList.add('hidden');
    }
});

// Lógica de Importação em Lote
const btnOpenImport = document.getElementById('btn-open-import');
const modalImport = document.getElementById('modal-import');
const btnProcessImport = document.getElementById('btn-process-import');
const importTextarea = document.getElementById('import-text');
const importStatus = document.getElementById('import-status');
const closeModals = document.querySelectorAll('.close-modal, .modal');

btnOpenImport.addEventListener('click', () => {
    modalImport.classList.add('active');
    importStatus.textContent = '';
    importStatus.className = 'import-status';
});

// Fechar modal ao clicar no X ou fora do conteúdo
closeModals.forEach(el => {
    el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('close-modal') || el.closest('.close-modal')) {
            modalImport.classList.remove('active');
        }
    });
});

// Impedir que o clique no conteúdo do modal o feche
document.querySelector('.modal-content').addEventListener('click', (e) => e.stopPropagation());

async function processarImportacao() {
    const texto = importTextarea.value.trim();
    const despesas = ImportService.parseTSV(texto);

    if (despesas.length === 0) {
        importStatus.textContent = "Nenhum dado válido encontrado para importar.";
        importStatus.className = "import-status error";
        return;
    }

    btnProcessImport.disabled = true;
    btnProcessImport.textContent = "Processando...";
    importStatus.textContent = `Iniciando importação de ${despesas.length} registros...`;
    importStatus.className = "import-status";

    const db = firebase.firestore();
    let sucessos = 0;
    let erros = 0;

    for (const despesa of despesas) {
        try {
            await db.collection('despesas').add({
                ...despesa,
                importado: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            sucessos++;
            importStatus.textContent = `Progresso: ${sucessos} de ${despesas.length} importados...`;
        } catch (error) {
            console.error("Erro ao importar item:", error);
            erros++;
        }
    }

    btnProcessImport.disabled = false;
    btnProcessImport.textContent = "Iniciar Importação";
    importStatus.textContent = `Concluído! Sucessos: ${sucessos}, Erros: ${erros}`;
    importStatus.className = sucessos > 0 ? "import-status success" : "import-status error";
    
    if (sucessos > 0) {
        importTextarea.value = '';
        setTimeout(() => modalImport.classList.remove('active'), 2000);
    }
}

btnProcessImport.addEventListener('click', processarImportacao);

// PWA: Service Worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('SW registrado!', reg);
        }).catch(err => {
            console.error('SW falhou!', err);
        });
    });
}

// Atualizar exibição do total gasto
function updateTotalDisplay(value) {
    const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    
    const mainTotal = document.getElementById('main-total-spent');
    if (mainTotal) mainTotal.textContent = formatted;
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    populateSelects();
    updateTotalDisplay(1280.50); // Valor inicial mockado
    // Inicia na tela de cadastro como solicitado
    showScreen('register');
});
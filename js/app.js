import firebaseConfig from './firebase-config.js';
import { AuthService } from './auth-service.js';
import { ImportService } from './import-service.js';
import { SettingsService } from './settings-service.js';

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
const authService = new AuthService(auth);

let settingsService = null;
let currentCategories = [];
let currentPaymentMethods = [];
let currentFixedDebts = [];

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
        settingsService = new SettingsService(db, user.uid);
        loadAllSettings();
        console.log("Usuário logado:", user.email);
    } else {
        authScreen.classList.add('active');
        appWrapper.style.display = 'none';
        settingsService = null;
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
const formRegister = document.getElementById('form-register');
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

formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const categoryId = document.getElementById('reg-category').value;
    const paymentMethodId = document.getElementById('reg-payment-method').value;

    if (!categoryId || !paymentMethodId) {
        alert("Por favor, selecione uma Categoria e uma Forma de Pagamento antes de registrar.");
        return;
    }

    const btnSubmit = formRegister.querySelector('button[type="submit"]');
    const originalText = btnSubmit.textContent;

    const data = {
        value: parseFloat(document.getElementById('reg-value').value),
        type: document.querySelector('input[name="reg-type"]:checked').value,
        paymentMethodId: paymentMethodId,
        description: document.getElementById('reg-name').value,
        categoryId: categoryId,
        notes: document.getElementById('reg-notes').value,
        date: new Date().toISOString(),
        userId: auth.currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (data.type === 'parcelado') {
        data.installments = parseInt(document.getElementById('reg-installments').value);
    }

    try {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Salvando...";
        
        await db.collection('despesas').add(data);
        
        alert("Despesa registrada com sucesso!");
        formRegister.reset();
        parcelasField.classList.add('hidden');
        if (progressContainer) progressContainer.classList.add('hidden');
        showScreen('dashboard'); // Direciona para o dashboard após o cadastro
    } catch (error) {
        alert("Erro ao registrar: " + error.message);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = originalText;
    }
});

async function loadAllSettings() {
    if (!settingsService) return;
    
    try {
        currentCategories = await settingsService.getCategories();
        currentPaymentMethods = await settingsService.getPaymentMethods();
        currentFixedDebts = await settingsService.getFixedDebts();
        
        renderSettingsLists();
        populateSelects();
    } catch (error) {
        console.error("Erro ao carregar configurações:", error);
    }
}

function renderSettingsLists() {
    renderList('list-categories', currentCategories, 'category');
    renderList('list-payment-methods', currentPaymentMethods, 'paymentMethod');
    renderList('list-fixed-debts', currentFixedDebts, 'fixedDebt');
}

function renderList(elementId, items, type) {
    const list = document.getElementById(elementId);
    if (items.length === 0) {
        list.innerHTML = '<div class="list-empty">Nenhum item cadastrado.</div>';
        return;
    }
    
    list.innerHTML = items.map(item => `
        <div class="settings-item">
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-details">${getDetailsByType(type, item)}</span>
            </div>
            <button class="btn-edit-item" data-id="${item.id}" data-type="${type}">
                <i class="bi bi-pencil-square"></i>
            </button>
        </div>
    `).join('');

    // Eventos de edição
    list.querySelectorAll('.btn-edit-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            const item = items.find(i => i.id === id);
            openSettingsModal(type, item);
        });
    });
}

function getDetailsByType(type, item) {
    if (type === 'category') return `Limite: R$ ${item.limit.toFixed(2)}`;
    if (type === 'paymentMethod') {
        if (item.type === 'credito') return `Crédito - Vence dia ${item.paymentDay}`;
        if (item.type === 'boleto') return `Boleto - Vence dia ${item.dueDay}`;
        return 'À Vista / Débito';
    }
    if (type === 'fixedDebt') return `Valor: R$ ${item.value.toFixed(2)} - Dia ${item.paymentDay}`;
    return '';
}

function populateSelects() {
    const catSelect = document.getElementById('reg-category');
    const paySelect = document.getElementById('reg-payment-method');

    if (!catSelect || !paySelect) return;

    catSelect.innerHTML = '<option value="">Selecione...</option>';
    paySelect.innerHTML = '<option value="">Selecione...</option>';

    currentCategories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        catSelect.appendChild(opt);
    });

    currentPaymentMethods.forEach(pay => {
        const opt = document.createElement('option');
        opt.value = pay.id; // Agora usamos o ID do documento
        opt.textContent = pay.name;
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
    const cat = currentCategories.find(c => c.id === e.target.value);
    
    if (cat) {
        progressContainer.classList.remove('hidden');
        
        // No momento mockamos o gasto como 0 ou buscamos de um dashboard real depois
        const spent = cat.spent || 0; 
        const remaining = cat.limit - spent;
        const percent = Math.min(100, Math.round((spent / cat.limit) * 100));
        
        progSpent.textContent = `Gasto: R$ ${spent.toFixed(2)}`;
        progTotal.textContent = `Limite: R$ ${cat.limit.toFixed(2)}`;
        progressFill.style.width = `${percent}%`;
        
        if (percent >= 100) {
            progressFill.style.backgroundColor = '#ff7675';
            progText.textContent = `Atenção: Limite atingido!`;
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

// Lógica da Tela de Ajustes e Modal
const modalSettings = document.getElementById('modal-settings');
const formSettings = document.getElementById('form-settings');
const btnDeleteSettingsItem = document.getElementById('btn-delete-settings-item');

document.getElementById('btn-add-category').addEventListener('click', () => openSettingsModal('category'));
document.getElementById('btn-add-payment-method').addEventListener('click', () => openSettingsModal('paymentMethod'));
document.getElementById('btn-add-fixed-debt').addEventListener('click', () => openSettingsModal('fixedDebt'));

function openSettingsModal(type, item = null) {
    const title = document.getElementById('modal-settings-title');
    const itemId = document.getElementById('settings-item-id');
    const itemType = document.getElementById('settings-item-type');
    
    itemType.value = type;
    itemId.value = item ? item.id : '';
    title.textContent = item ? `Editar ${getLabel(type)}` : `Nova ${getLabel(type)}`;
    
    if (item) {
        btnDeleteSettingsItem.classList.remove('hidden');
    } else {
        btnDeleteSettingsItem.classList.add('hidden');
    }
    
    generateSettingsFields(type, item || {});
    modalSettings.classList.add('active');
}

function getLabel(type) {
    if (type === 'category') return 'Categoria';
    if (type === 'paymentMethod') return 'Forma de Pagamento';
    if (type === 'fixedDebt') return 'Dívida Fixa';
    return '';
}

function generateSettingsFields(type, data = {}) {
    const container = document.getElementById('settings-fields-container');
    container.innerHTML = '';
    
    if (type === 'category') {
        container.innerHTML = `
            <div class="field-group span-2">
                <label>Nome da Categoria</label>
                <input type="text" id="cat-name" value="${data.name || ''}" required>
            </div>
            <div class="field-group span-2">
                <label>Limite Mensal (R$)</label>
                <input type="number" id="cat-limit" step="0.01" value="${data.limit || ''}" required>
            </div>
        `;
    } else if (type === 'paymentMethod') {
        container.innerHTML = `
            <div class="field-group span-2">
                <label>Nome da Forma</label>
                <input type="text" id="pay-name" value="${data.name || ''}" required>
            </div>
            <div class="field-group span-2">
                <label>Tipo</label>
                <select id="pay-type" required>
                    <option value="debito" ${data.type === 'debito' ? 'selected' : ''}>Débito / Pix / Dinheiro</option>
                    <option value="credito" ${data.type === 'credito' ? 'selected' : ''}>Cartão de Crédito</option>
                    <option value="boleto" ${data.type === 'boleto' ? 'selected' : ''}>Boleto</option>
                </select>
            </div>
            <div id="credit-fields" class="input-grid span-2 ${data.type === 'credito' ? '' : 'hidden'}">
                <div class="field-group">
                    <label>Início Fatura (Dia)</label>
                    <input type="number" id="pay-start" min="1" max="31" value="${data.startDay || ''}">
                </div>
                <div class="field-group">
                    <label>Fim Fatura (Dia)</label>
                    <input type="number" id="pay-end" min="1" max="31" value="${data.endDay || ''}">
                </div>
                <div class="field-group span-2">
                    <label>Dia Pagamento</label>
                    <input type="number" id="pay-day" min="1" max="31" value="${data.paymentDay || ''}">
                </div>
            </div>
            <div id="boleto-fields" class="field-group span-2 ${data.type === 'boleto' ? '' : 'hidden'}">
                <label>Dia do Vencimento</label>
                <input type="number" id="pay-due" min="1" max="31" value="${data.dueDay || ''}">
            </div>
        `;
        
        const payType = document.getElementById('pay-type');
        payType.addEventListener('change', (e) => {
            document.getElementById('credit-fields').classList.toggle('hidden', e.target.value !== 'credito');
            document.getElementById('boleto-fields').classList.toggle('hidden', e.target.value !== 'boleto');
        });
    } else if (type === 'fixedDebt') {
        container.innerHTML = `
            <div class="field-group span-2">
                <label>Nome da Dívida</label>
                <input type="text" id="debt-name" value="${data.name || ''}" required>
            </div>
            <div class="field-group">
                <label>Valor (R$)</label>
                <input type="number" id="debt-value" step="0.01" value="${data.value || ''}" required>
            </div>
            <div class="field-group">
                <label>Dia do Pagamento</label>
                <input type="number" id="debt-day" min="1" max="31" value="${data.paymentDay || ''}" required>
            </div>
            <div class="field-group span-2">
                <label>Anotações</label>
                <textarea id="debt-notes">${data.notes || ''}</textarea>
            </div>
        `;
    }
}

formSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!settingsService) return;
    
    const id = document.getElementById('settings-item-id').value;
    const type = document.getElementById('settings-item-type').value;
    
    // Objeto de dados SEM o campo 'id' interno para não sujar o documento
    let data = {};
    
    if (type === 'category') {
        data.name = document.getElementById('cat-name').value;
        data.limit = parseFloat(document.getElementById('cat-limit').value);
    } else if (type === 'paymentMethod') {
        data.name = document.getElementById('pay-name').value;
        data.type = document.getElementById('pay-type').value;
        if (data.type === 'credito') {
            data.startDay = parseInt(document.getElementById('pay-start').value);
            data.endDay = parseInt(document.getElementById('pay-end').value);
            data.paymentDay = parseInt(document.getElementById('pay-day').value);
        } else if (data.type === 'boleto') {
            data.dueDay = parseInt(document.getElementById('pay-due').value);
        }
    } else if (type === 'fixedDebt') {
        data.name = document.getElementById('debt-name').value;
        data.value = parseFloat(document.getElementById('debt-value').value);
        data.paymentDay = parseInt(document.getElementById('debt-day').value);
        data.notes = document.getElementById('debt-notes').value;
    }
    
    try {
        // Passamos o ID separadamente para o serviço decidir entre add ou update
        const itemWithId = { ...data, id: id || null };

        if (type === 'category') await settingsService.saveCategory(itemWithId);
        if (type === 'paymentMethod') await settingsService.savePaymentMethod(itemWithId);
        if (type === 'fixedDebt') await settingsService.saveFixedDebt(itemWithId);
        
        modalSettings.classList.remove('active');
        loadAllSettings();
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
});

btnDeleteSettingsItem.addEventListener('click', async () => {
    if (!settingsService || !confirm("Tem certeza que deseja excluir?")) return;
    
    const id = document.getElementById('settings-item-id').value;
    const type = document.getElementById('settings-item-type').value;
    
    try {
        if (type === 'category') await settingsService.deleteCategory(id);
        if (type === 'paymentMethod') await settingsService.deletePaymentMethod(id);
        if (type === 'fixedDebt') await settingsService.deleteFixedDebt(id);
        
        modalSettings.classList.remove('active');
        loadAllSettings();
    } catch (error) {
        alert("Erro ao excluir: " + error.message);
    }
});

// Fechar modais genérico
document.querySelectorAll('.close-modal, .modal').forEach(el => {
    el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('close-modal') || el.closest('.close-modal')) {
            el.closest('.modal').classList.remove('active');
        }
    });
});

document.querySelectorAll('.modal-content').forEach(content => {
    content.addEventListener('click', (e) => e.stopPropagation());
});

// Lógica de Importação em Lote
const btnOpenImport = document.getElementById('btn-open-import');
const modalImport = document.getElementById('modal-import');
const btnProcessImport = document.getElementById('btn-process-import');
const importTextarea = document.getElementById('import-text');
const importStatus = document.getElementById('import-status');

btnOpenImport.addEventListener('click', () => {
    modalImport.classList.add('active');
    importStatus.textContent = '';
    importStatus.className = 'import-status';
});

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
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: auth.currentUser.uid
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
    // Inicia na tela de cadastro como solicitado
    showScreen('register');
    updateTotalDisplay(0);
});
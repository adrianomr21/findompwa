import firebaseConfig from './firebase-config.js';
import { AuthService } from './auth-service.js';
import { ImportService } from './import-service.js';
import { SettingsService } from './settings-service.js';
import { CartService } from './cart-service.js';
import { formatCurrency, getInstallmentStatus, calculateDueDate, showToast, calculatePayTotal, calculateDueDateForMonth, calculateCategorySpending } from './utils.js';

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Habilitar Persistência Offline
db.enablePersistence().catch(err => {
    if (err.code == 'failed-precondition') {
        console.warn("Persistência falhou: múltiplas abas abertas.");
    } else if (err.code == 'unimplemented') {
        console.warn("Navegador não suporta persistência.");
    }
});

const provider = new firebase.auth.GoogleAuthProvider();
const authService = new AuthService(auth);

let settingsService = null;
let cartService = null;
let currentCategories = [];
let currentPaymentMethods = [];
let currentFixedDebts = [];
let currentExpenses = [];
let currentCarts = [];
let categoryChart = null;

let bannerMonth = 0;
let bannerYear = 0;
let payMonth = 0;
let payYear = 0;
let currentPaymentsData = [];

const authScreen = document.getElementById('auth-screen');
const appWrapper = document.getElementById('app-wrapper');
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLogout = document.getElementById('btn-logout');

// Elementos da barra de progresso de categoria (Cadastro)
const catSelectProgress = document.getElementById('reg-category');
const progressContainer = document.getElementById('category-progress-container');
const progressFill = document.getElementById('progress-fill');
const progSpent = document.getElementById('prog-spent');
const progTotal = document.getElementById('prog-total');
const progText = document.getElementById('prog-text');

// Elementos de alternância Login/Cadastro
const loginBox = document.getElementById('auth-login-box');
const signupBox = document.getElementById('auth-signup-box');
const goToSignup = document.getElementById('go-to-signup');
const goToLogin = document.getElementById('go-to-login');

if (goToSignup) goToSignup.addEventListener('click', (e) => { e.preventDefault(); loginBox.classList.add('hidden'); signupBox.classList.remove('hidden'); });
if (goToLogin) goToLogin.addEventListener('click', (e) => { e.preventDefault(); signupBox.classList.add('hidden'); loginBox.classList.remove('hidden'); });

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
const formLogin = document.getElementById('form-login');
if (formLogin) {
    formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        authService.loginWithEmail(email, pass).catch(err => showToast("Erro ao entrar: " + err.message, 'error'));
    });
}

// Cadastro com Email/Senha
const formSignup = document.getElementById('form-signup');
if (formSignup) {
    formSignup.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const pass = document.getElementById('signup-password').value;
        authService.signUpWithEmail(email, pass)
            .then(() => showToast("Conta criada com sucesso!", 'success'))
            .catch(err => showToast("Erro ao cadastrar: " + err.message, 'error'));
    });
}

// Gerenciar estado de Autenticação
auth.onAuthStateChanged(user => {
    if (user) {
        authScreen.classList.remove('active');
        appWrapper.style.display = 'flex';
        settingsService = new SettingsService(db, user.uid);
        cartService = new CartService(db, user.uid);
        loadAllSettings();
        console.log("Usuário logado:", user.email);
    } else {
        authScreen.classList.add('active');
        appWrapper.style.display = 'none';
        settingsService = null;
        cartService = null;
    }
});

if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener('click', () => {
        auth.signInWithPopup(provider).catch(error => {
            console.error("Erro no login Google:", error);
            showToast("Erro ao entrar com Google.", 'error');
        });
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        authService.logout();
    });
}

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
    
    if (screenId === 'dashboard' || screenId === 'register') {
        loadDashboardData();
    }

    if (screenId === 'payments') {
        loadPaymentsData();
    }

    if (screenId === 'cart') {
        loadCartData();
    }
    
    window.scrollTo(0, 0);
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

// Elementos do Dashboard
function getDashFilters() {
    return {
        month: document.getElementById('dash-filter-month'),
        year: document.getElementById('dash-filter-year'),
        category: document.getElementById('dash-filter-category'),
        payment: document.getElementById('dash-filter-payment')
    };
}

function setupYearFilter() {
    const { year: yearSelect, month: monthSelect } = getDashFilters();
    if (!yearSelect) return;

    yearSelect.innerHTML = '';
    const now = new Date();
    
    let nextMonth = now.getMonth() + 1;
    let nextYear = now.getFullYear();
    
    if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
    }

    for (let i = 0; i < 4; i++) {
        const year = nextYear - i;
        const opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year;
        yearSelect.appendChild(opt);
    }
    
    if (monthSelect) monthSelect.value = nextMonth;
    if (yearSelect) yearSelect.value = nextYear;

    setupFilterListeners();
}

function setupFilterListeners() {
    const { month, year, category, payment } = getDashFilters();
    const searchInput = document.getElementById('dash-search-history');

    [month, year, category, payment].forEach(el => {
        if (el) {
            el.removeEventListener('change', renderDashboard);
            el.addEventListener('change', renderDashboard);
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', renderDashboard);
    }
}

async function loadDashboardData() {
    if (!auth.currentUser) return;
    
    try {
        const snapshot = await db.collection('despesas')
            .where('userId', '==', auth.currentUser.uid)
            .get();

        currentExpenses = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
            
        renderDashboard();
        updateTotalDisplay();
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

function renderDashboard() {
    const { month: monthSelect, year: yearSelect, category: categorySelect, payment: paymentSelect } = getDashFilters();
    const searchInput = document.getElementById('dash-search-history');
    
    if (!monthSelect || !yearSelect) return;

    const filterMonth = parseInt(monthSelect.value);
    const filterYear = parseInt(yearSelect.value);
    const categoryFilter = categorySelect ? categorySelect.value : 'all';
    const paymentFilter = paymentSelect ? paymentSelect.value : 'all';
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = [];

    currentExpenses.forEach(exp => {
        const isParcelado = exp.type === 'parcelado' && exp.installments > 1;
        const baseDate = exp.dueDate || exp.date;

        if (searchTerm && !exp.description.toLowerCase().includes(searchTerm)) {
            return;
        }

        if (isParcelado) {
            const currentInst = getInstallmentStatus(baseDate, exp.installments, filterMonth, filterYear);
            
            if (currentInst) {
                const matchCategory = categoryFilter === 'all' || exp.categoryId === categoryFilter;
                const matchPayment = paymentFilter === 'all' || exp.paymentMethodId === paymentFilter;
                
                if (matchCategory && matchPayment) {
                    const displayDate = new Date(baseDate);
                    displayDate.setMonth(displayDate.getMonth() + (currentInst - 1));
                    
                    filtered.push({
                        ...exp,
                        currentInstallment: currentInst,
                        displayDate: displayDate.toISOString()
                    });
                }
            }
        } else {
            const startDate = new Date(baseDate);
            const matchMonth = startDate.getMonth() === filterMonth;
            const matchYear = startDate.getFullYear() === filterYear;
            const matchCategory = categoryFilter === 'all' || exp.categoryId === categoryFilter;
            const matchPayment = paymentFilter === 'all' || exp.paymentMethodId === paymentFilter;
            
            if (matchMonth && matchYear && matchCategory && matchPayment) {
                filtered.push({
                    ...exp,
                    displayDate: baseDate
                });
            }
        }
    });

    const total = filtered.reduce((acc, curr) => acc + curr.value, 0);
    const dashTotalDisplay = document.getElementById('dash-total-value');
    if (dashTotalDisplay) dashTotalDisplay.textContent = formatCurrency(total);
    
    const historyCount = document.getElementById('history-count');
    if (historyCount) historyCount.textContent = `${filtered.length} itens`;

    renderChart(filtered);
    renderHistory(filtered);
}

function renderChart(expenses) {
    const canvas = document.getElementById('chart-categories');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const totalsByCategory = {};
    currentCategories.forEach(cat => totalsByCategory[cat.id] = 0);
    
    expenses.forEach(exp => {
        if (totalsByCategory[exp.categoryId] !== undefined) {
            totalsByCategory[exp.categoryId] += exp.value;
        }
    });

    const labels = currentCategories.map(cat => cat.name);
    const dataValues = currentCategories.map(cat => totalsByCategory[cat.id]);
    const limits = currentCategories.map(cat => cat.limit);

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Gasto Atual',
                    data: dataValues,
                    backgroundColor: '#00b894',
                    borderRadius: 6
                },
                {
                    label: 'Limite',
                    data: limits,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' } },
                x: { grid: { display: false }, ticks: { color: '#8b949e' } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderHistory(expenses) {
    const list = document.getElementById('history-list');
    if (!list) return;

    if (expenses.length === 0) {
        list.innerHTML = '<div class="list-empty">Nenhuma despesa encontrada para este período.</div>';
        return;
    }

    list.innerHTML = expenses.map(exp => {
        const cat = currentCategories.find(c => c.id === exp.categoryId);
        const pay = currentPaymentMethods.find(p => p.id === exp.paymentMethodId);
        const displayDate = new Date(exp.displayDate || exp.date).toLocaleDateString('pt-BR');
        
        const installmentBadge = exp.currentInstallment 
            ? `<span class="installment-badge">${exp.currentInstallment}/${exp.installments}</span>` 
            : '';

        return `
            <div class="history-item">
                <div class="history-info">
                    <span class="history-name">${installmentBadge} ${exp.description} </span>
                    <div class="history-meta">
                        <span><i class="bi bi-tag"></i> ${cat ? cat.name : 'Sem Cat.'}</span>
                        <span><i class="bi bi-calendar3"></i> ${displayDate}</span>
                        <span><i class="bi bi-credit-card"></i> ${pay ? pay.name : 'N/A'}</span>
                    </div>
                </div>
                <div class="history-value">
                    <span class="history-amount">${formatCurrency(exp.value)}</span>
                    <button class="btn-edit-item" onclick="openEditExpenseModal('${exp.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Modal de Edição de Despesa
const modalEditExpense = document.getElementById('modal-edit-expense');
const formEditExpense = document.getElementById('form-edit-expense');
const btnDeleteExpense = document.getElementById('btn-delete-expense');

window.openEditExpenseModal = function(id) {
    const exp = currentExpenses.find(e => e.id === id);
    if (!exp) return;

    document.getElementById('edit-expense-id').value = id;
    document.getElementById('edit-reg-value').value = exp.value;
    document.getElementById('edit-reg-name').value = exp.description;
    document.getElementById('edit-reg-notes').value = exp.notes || '';
    document.getElementById('edit-reg-date').value = exp.date.split('T')[0];
    
    const radio = document.querySelector(`input[name="edit-reg-type"][value="${exp.type}"]`);
    if (radio) radio.checked = true;

    const parcelasField = document.getElementById('edit-parcelas-field');
    if (exp.type === 'parcelado') {
        parcelasField.classList.remove('hidden');
        document.getElementById('edit-reg-installments').value = exp.installments || 2;
    } else {
        parcelasField.classList.add('hidden');
    }

    populateEditSelects(exp.categoryId, exp.paymentMethodId);
    if (modalEditExpense) modalEditExpense.classList.add('active');
};

function populateEditSelects(selectedCat, selectedPay) {
    const catSelect = document.getElementById('edit-reg-category');
    const paySelect = document.getElementById('edit-reg-payment-method');
    if (!catSelect || !paySelect) return;

    catSelect.innerHTML = currentCategories.map(cat => 
        `<option value="${cat.id}" ${cat.id === selectedCat ? 'selected' : ''}>${cat.name}</option>`
    ).join('');

    paySelect.innerHTML = currentPaymentMethods.map(pay => 
        `<option value="${pay.id}" ${pay.id === selectedPay ? 'selected' : ''}>${pay.name}</option>`
    ).join('');
}

document.querySelectorAll('input[name="edit-reg-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const parcelasField = document.getElementById('edit-parcelas-field');
        if (e.target.value === 'parcelado') {
            parcelasField.classList.remove('hidden');
        } else {
            parcelasField.classList.add('hidden');
        }
    });
});

if (formEditExpense) {
    formEditExpense.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-expense-id').value;
        const paymentMethodId = document.getElementById('edit-reg-payment-method').value;
        const payMethod = currentPaymentMethods.find(p => p.id === paymentMethodId);
        const purchaseDate = new Date(document.getElementById('edit-reg-date').value + 'T12:00:00').toISOString();

        const data = {
            value: parseFloat(document.getElementById('edit-reg-value').value),
            description: document.getElementById('edit-reg-name').value,
            notes: document.getElementById('edit-reg-notes').value,
            date: purchaseDate,
            dueDate: calculateDueDate(purchaseDate, payMethod),
            type: document.querySelector('input[name="edit-reg-type"]:checked').value,
            categoryId: document.getElementById('edit-reg-category').value,
            paymentMethodId: paymentMethodId
        };
        if (data.type === 'parcelado') {
            data.installments = parseInt(document.getElementById('edit-reg-installments').value);
        }
        try {
            await db.collection('despesas').doc(id).update(data);
            modalEditExpense.classList.remove('active');
            showToast("Alterações salvas!", 'success');
            loadDashboardData();
        } catch (error) {
            showToast("Erro ao atualizar: " + error.message, 'error');
        }
    });
}

if (btnDeleteExpense) {
    btnDeleteExpense.addEventListener('click', async () => {
        const id = document.getElementById('edit-expense-id').value;
        if (!confirm("Excluir esta despesa permanentemente?")) return;
        try {
            await db.collection('despesas').doc(id).delete();
            modalEditExpense.classList.remove('active');
            showToast("Despesa excluída!", 'success');
            loadDashboardData();
        } catch (error) {
            showToast("Erro ao excluir: " + error.message, 'error');
        }
    });
}

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

if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return;
        const categoryId = document.getElementById('reg-category').value;
        const paymentMethodId = document.getElementById('reg-payment-method').value;
        if (!categoryId || !paymentMethodId) {
            showToast("Selecione Categoria e Pagamento.", 'error');
            return;
        }
        const btnSubmit = formRegister.querySelector('button[type="submit"]');
        const originalText = btnSubmit.textContent;
        
        const payMethod = currentPaymentMethods.find(p => p.id === paymentMethodId);
        const now = new Date();
        const purchaseDate = now.toISOString();

        const data = {
            value: parseFloat(document.getElementById('reg-value').value),
            type: document.querySelector('input[name="reg-type"]:checked').value,
            paymentMethodId: paymentMethodId,
            description: document.getElementById('reg-name').value,
            categoryId: categoryId,
            notes: document.getElementById('reg-notes').value,
            date: purchaseDate,
            dueDate: calculateDueDate(purchaseDate, payMethod),
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
            showToast("Gasto registrado!", 'success');
            
            // Salvar preferências de preenchimento
            localStorage.setItem('lastCategoryId', categoryId);
            localStorage.setItem('lastPaymentMethodId', paymentMethodId);

            formRegister.reset();
            
            // Restaurar preferências após reset
            document.getElementById('reg-category').value = localStorage.getItem('lastCategoryId') || '';
            document.getElementById('reg-payment-method').value = localStorage.getItem('lastPaymentMethodId') || '';
            
            parcelasField.classList.add('hidden');
            if (progressContainer) progressContainer.classList.add('hidden');
            loadDashboardData();
            showScreen('dashboard');
        } catch (error) {
            showToast("Erro ao registrar: " + error.message, 'error');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
        }
    });
}

async function loadAllSettings() {
    if (!settingsService) return;
    try {
        currentCategories = await settingsService.getCategories();
        currentPaymentMethods = await settingsService.getPaymentMethods();
        currentFixedDebts = await settingsService.getFixedDebts();
        
        const { category: dashFilterCategory, payment: dashFilterPayment } = getDashFilters();
        
        if (dashFilterCategory) {
            dashFilterCategory.innerHTML = '<option value="all">Todas</option>' + 
                currentCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
        }

        if (dashFilterPayment) {
            dashFilterPayment.innerHTML = '<option value="all">Todos</option>' + 
                currentPaymentMethods.map(pay => `<option value="${pay.id}">${pay.name}</option>`).join('');
        }

        renderSettingsLists();
        populateSelects();
        loadDashboardData();
    } catch (error) {
        console.error("Erro ao carregar configurações:", error);
    }
}

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
    if (!itemType || !itemId || !title) return;

    itemType.value = type;
    itemId.value = item ? item.id : '';
    title.textContent = item ? `Editar ${getLabel(type)}` : `Nova ${getLabel(type)}`;
    
    const btnDel = document.getElementById('btn-delete-settings-item');
    if (btnDel) {
        if (item) btnDel.classList.remove('hidden');
        else btnDel.classList.add('hidden');
    }

    generateSettingsFields(type, item || {});
    if (modalSettings) modalSettings.classList.add('active');
}

function getLabel(type) {
    if (type === 'category') return 'Categoria';
    if (type === 'paymentMethod') return 'Forma de Pagamento';
    if (type === 'fixedDebt') return 'Dívida Fixa';
    return '';
}

function generateSettingsFields(type, data = {}) {
    const container = document.getElementById('settings-fields-container');
    if (!container) return;
    container.innerHTML = '';
    if (type === 'category') {
        container.innerHTML = `
            <div class="field-group span-2"><label>Nome</label><input type="text" id="cat-name" value="${data.name || ''}" required></div>
            <div class="field-group span-2"><label>Limite (R$)</label><input type="number" id="cat-limit" step="0.01" value="${data.limit || ''}" required></div>
        `;
    } else if (type === 'paymentMethod') {
        container.innerHTML = `
            <div class="field-group span-2"><label>Nome</label><input type="text" id="pay-name" value="${data.name || ''}" required></div>
            <div class="field-group span-2"><label>Tipo</label><select id="pay-type" required>
                <option value="debito" ${data.type === 'debito' ? 'selected' : ''}>Débito / Pix / Dinheiro</option>
                <option value="credito" ${data.type === 'credito' ? 'selected' : ''}>Cartão de Crédito</option>
                <option value="boleto" ${data.type === 'boleto' ? 'selected' : ''}>Boleto</option>
            </select></div>
            <div id="credit-fields" class="input-grid span-2 ${data.type === 'credito' ? '' : 'hidden'}">
                <div class="field-group"><label>Início (Dia)</label><input type="number" id="pay-start" min="1" max="31" value="${data.startDay || ''}"></div>
                <div class="field-group"><label>Fim (Dia)</label><input type="number" id="pay-end" min="1" max="31" value="${data.endDay || ''}"></div>
                <div class="field-group span-2"><label>Dia Pagamento</label><input type="number" id="pay-day" min="1" max="31" value="${data.paymentDay || ''}"></div>
            </div>
            <div id="boleto-fields" class="field-group span-2 ${data.type === 'boleto' ? '' : 'hidden'}">
                <label>Dia Vencimento</label><input type="number" id="pay-due" min="1" max="31" value="${data.dueDay || ''}">
            </div>
            <div class="field-group span-2"><label>Notas</label><textarea id="pay-notes">${data.notes || ''}</textarea></div>
        `;
        const payType = document.getElementById('pay-type');
        payType.addEventListener('change', (e) => {
            document.getElementById('credit-fields').classList.toggle('hidden', e.target.value !== 'credito');
            document.getElementById('boleto-fields').classList.toggle('hidden', e.target.value !== 'boleto');
        });
    } else if (type === 'fixedDebt') {
        container.innerHTML = `
            <div class="field-group span-2"><label>Nome</label><input type="text" id="debt-name" value="${data.name || ''}" required></div>
            <div class="field-group"><label>Valor (R$)</label><input type="number" id="debt-value" step="0.01" value="${data.value || ''}" required></div>
            <div class="field-group"><label>Dia</label><input type="number" id="debt-day" min="1" max="31" value="${data.paymentDay || ''}" required></div>
            <div class="field-group span-2"><label>Notas</label><textarea id="debt-notes">${data.notes || ''}</textarea></div>
        `;
    }
}

if (formSettings) {
    formSettings.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('settings-item-id').value;
        const type = document.getElementById('settings-item-type').value;
        let data = {};
        if (type === 'category') {
            data.name = document.getElementById('cat-name').value;
            data.limit = parseFloat(document.getElementById('cat-limit').value);
        } else if (type === 'paymentMethod') {
            data.name = document.getElementById('pay-name').value;
            data.type = document.getElementById('pay-type').value;
            data.notes = document.getElementById('pay-notes').value;
            if (data.type === 'credito') {
                data.startDay = parseInt(document.getElementById('pay-start').value);
                data.endDay = parseInt(document.getElementById('pay-end').value);
                data.paymentDay = parseInt(document.getElementById('pay-day').value);
            } else if (data.type === 'boleto') data.dueDay = parseInt(document.getElementById('pay-due').value);
        } else if (type === 'fixedDebt') {
            data.name = document.getElementById('debt-name').value;
            data.value = parseFloat(document.getElementById('debt-value').value);
            data.paymentDay = parseInt(document.getElementById('debt-day').value);
            data.notes = document.getElementById('debt-notes').value;
        }
        try {
            const itemWithId = { ...data, id: id || null };
            if (type === 'category') await settingsService.saveCategory(itemWithId);
            if (type === 'paymentMethod') await settingsService.savePaymentMethod(itemWithId);
            if (type === 'fixedDebt') await settingsService.saveFixedDebt(itemWithId);
            if (modalSettings) modalSettings.classList.remove('active');
            showToast("Configuração salva!", 'success');
            loadAllSettings();
        } catch (error) { showToast("Erro ao salvar: " + error.message, 'error'); }
    });
}

if (btnDeleteSettingsItem) {
    btnDeleteSettingsItem.addEventListener('click', async () => {
        if (!settingsService || !confirm("Tem certeza?")) return;
        const id = document.getElementById('settings-item-id').value;
        const type = document.getElementById('settings-item-type').value;
        try {
            if (type === 'category') await settingsService.deleteCategory(id);
            if (type === 'paymentMethod') await settingsService.deletePaymentMethod(id);
            if (type === 'fixedDebt') await settingsService.deleteFixedDebt(id);
            if (modalSettings) modalSettings.classList.remove('active');
            showToast("Item excluído!", 'success');
            loadAllSettings();
        } catch (error) { showToast("Erro ao excluir: " + error.message, 'error'); }
    });
}

document.querySelectorAll('.close-modal, .modal').forEach(el => {
    el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('close-modal') || el.closest('.close-modal')) {
            const modal = el.closest('.modal');
            if (modal) modal.classList.remove('active');
        }
    });
});

document.querySelectorAll('.modal-content').forEach(content => {
    content.addEventListener('click', (e) => e.stopPropagation());
});

const btnOpenImport = document.getElementById('btn-open-import');
const modalImport = document.getElementById('modal-import');
const btnProcessImport = document.getElementById('btn-process-import');
const importTextarea = document.getElementById('import-text');
const importStatus = document.getElementById('import-status');

if (btnOpenImport) {
    btnOpenImport.addEventListener('click', () => {
        if (modalImport) {
            modalImport.classList.add('active');
            importStatus.textContent = '';
            importStatus.className = 'import-status';
        }
    });
}

if (btnProcessImport) {
    btnProcessImport.addEventListener('click', async () => {
        const texto = importTextarea.value.trim();
        const despesas = ImportService.parseTSV(texto);
        if (despesas.length === 0) {
            importStatus.textContent = "Nenhum dado válido.";
            importStatus.className = "import-status error";
            return;
        }
        btnProcessImport.disabled = true;
        btnProcessImport.textContent = "Processando...";
        let sucessos = 0;
        for (const despesa of despesas) {
            try {
                await db.collection('despesas').add({
                    ...despesa,
                    importado: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    userId: auth.currentUser.uid
                });
                sucessos++;
                if (importStatus) importStatus.textContent = `Progresso: ${sucessos} de ${despesas.length}...`;
            } catch (error) { console.error("Erro import:", error); }
        }
        btnProcessImport.disabled = false;
        btnProcessImport.textContent = "Iniciar Importação";
        if (importStatus) importStatus.textContent = `Concluído! Sucessos: ${sucessos}`;
        if (sucessos > 0) {
            importTextarea.value = '';
            setTimeout(() => { if (modalImport) modalImport.classList.remove('active'); }, 2000);
        }
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.error('SW falhou!', err));
    });
}

function renderSettingsLists() {
    renderList('list-categories', currentCategories, 'category');
    renderList('list-payment-methods', currentPaymentMethods, 'paymentMethod');
    renderList('list-fixed-debts', currentFixedDebts, 'fixedDebt');
}

function renderList(elementId, items, type) {
    const list = document.getElementById(elementId);
    if (!list) return;
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
    if (type === 'category') {
        const spent = item.spent || 0;
        const percent = Math.min(100, Math.round((spent / item.limit) * 100));
        let barColor = '#00b894';
        if (percent >= 100) barColor = '#ff7675';
        else if (percent > 85) barColor = '#fdcb6e';

        return `
            <div class="category-progress" style="margin-top: 8px; padding: 0; background: none; border: none; animation: none;">
                <div class="progress-labels" style="margin-bottom: 4px;">
                    <span>Gasto: R$ ${spent.toFixed(2)}</span>
                    <span>Limite: R$ ${item.limit.toFixed(2)}</span>
                </div>
                <div class="progress-bar-bg" style="height: 6px;">
                    <div class="progress-bar-fill" style="width: ${percent}%; background-color: ${barColor};"></div>
                </div>
            </div>
        `;
    }
    if (type === 'paymentMethod') {
        let details = '';
        if (item.type === 'credito') details = `Crédito - Vence dia ${item.paymentDay}`;
        else if (item.type === 'boleto') details = `Boleto - Vence dia ${item.dueDay}`;
        else details = 'À Vista / Débito';

        if (item.notes) {
            details += `<div class="item-notes" style="margin-top: 4px; font-size: 0.85rem; color: #8b949e; font-style: italic;">
                <i class="bi bi-info-circle"></i> ${item.notes}
            </div>`;
        }
        return details;
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
        opt.value = pay.id;
        opt.textContent = pay.name;
        paySelect.appendChild(opt);
    });
}

function updateCategoryProgressBar(categoryId) {
    if (!progressContainer || !progressFill || !progSpent || !progTotal || !progText) return;
    
    if (!categoryId) {
        progressContainer.classList.add('hidden');
        return;
    }

    const cat = currentCategories.find(c => c.id === categoryId);
    if (cat) {
        progressContainer.classList.remove('hidden');
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
}

if (catSelectProgress) {
    catSelectProgress.addEventListener('change', (e) => {
        updateCategoryProgressBar(e.target.value);
    });
}

async function loadPaymentsData() {
    if (!auth.currentUser) return;
    const list = document.getElementById('payments-list');
    if (list) list.innerHTML = '<div class="list-empty">Carregando pagamentos...</div>';

    try {
        const faturasSnap = await db.collection('faturas')
            .where('userId', '==', auth.currentUser.uid)
            .where('month', '==', payMonth)
            .where('year', '==', payYear)
            .get();
        
        const faturasStatus = {};
        faturasSnap.forEach(doc => {
            faturasStatus[doc.data().sourceId] = { id: doc.id, ...doc.data() };
        });

        const grouped = {};
        currentExpenses.forEach(exp => {
            const isParcelado = exp.type === 'parcelado' && exp.installments > 1;
            const baseDate = exp.dueDate || exp.date;
            let currentInst = null;

            if (isParcelado) {
                currentInst = getInstallmentStatus(baseDate, exp.installments, payMonth, payYear);
            } else {
                const d = new Date(baseDate);
                if (d.getMonth() === payMonth && d.getFullYear() === payYear) currentInst = 1;
            }

            if (currentInst) {
                if (!grouped[exp.paymentMethodId]) {
                    const method = currentPaymentMethods.find(p => p.id === exp.paymentMethodId);
                    grouped[exp.paymentMethodId] = {
                        sourceId: exp.paymentMethodId,
                        name: method ? method.name : 'Outros',
                        notes: method ? method.notes : '',
                        type: 'cartao',
                        originalValue: 0,
                        dueDate: calculateDueDateForMonth(method, payMonth, payYear),
                        items: []
                    };
                }
                grouped[exp.paymentMethodId].originalValue += exp.value;
                grouped[exp.paymentMethodId].items.push(exp);
            }
        });

        currentFixedDebts.forEach(debt => {
            const sourceId = `fixed_${debt.id}`;
            grouped[sourceId] = {
                sourceId: sourceId,
                name: debt.name,
                notes: debt.notes || '',
                type: 'fixa',
                originalValue: debt.value,
                dueDate: new Date(payYear, payMonth, debt.paymentDay).toISOString(),
                items: [debt]
            };
        });

        currentPaymentsData = Object.values(grouped).map(item => {
            const status = faturasStatus[item.sourceId] || {};
            return {
                ...item,
                dbId: status.id || null,
                actualValue: status.actualValue !== undefined ? status.actualValue : item.originalValue,
                paid: status.paid || false,
                ignored: status.ignored || false
            };
        });

        renderPayments();
        updatePayTotalDisplay();
    } catch (error) {
        console.error("Erro ao carregar pagamentos:", error);
    }
}

function renderPayments() {
    const list = document.getElementById('payments-list');
    if (!list) return;

    if (currentPaymentsData.length === 0) {
        list.innerHTML = '<div class="list-empty">Nenhum pagamento identificado para este mês.</div>';
        return;
    }

    list.innerHTML = currentPaymentsData.map(pay => {
        const statusClass = pay.paid ? 'status-paid' : 'status-pending';
        const statusText = pay.paid ? 'PAGO' : 'PENDENTE';
        const eyeIcon = pay.ignored ? 'bi-eye-slash' : 'bi-eye';
        const formattedDate = new Date(pay.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        return `
            <div class="payment-item ${pay.ignored ? 'ignored' : ''} ${pay.paid ? 'paid' : ''}">
                <div class="payment-info">
                    <div class="payment-name">
                        ${pay.name}
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="payment-due">Vence em ${formattedDate}</div>
                </div>
                
                <div class="payment-value-container">
                    <div class="payment-amount">${formatCurrency(pay.actualValue)}</div>
                    ${pay.actualValue !== pay.originalValue ? `<div class="payment-original-value">${formatCurrency(pay.originalValue)}</div>` : ''}
                </div>

                <div class="payment-actions">
                    ${pay.notes ? `
                        <button class="btn-icon-only" onclick="showPaymentNote('${pay.sourceId}')" title="Ver Notas">
                            <i class="bi bi-chat-left-text"></i>
                        </button>
                    ` : ''}
                    <button class="btn-icon-only" onclick="toggleIgnorePayment('${pay.sourceId}')">
                        <i class="bi ${eyeIcon}"></i>
                    </button>
                    <button class="btn-icon-only" onclick="openEditPaymentValue('${pay.sourceId}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-pay-action ${pay.paid ? 'active' : ''}" onclick="togglePaidStatus('${pay.sourceId}')">
                        ${pay.paid ? 'PAGO' : 'PAGAR'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.showPaymentNote = (sourceId) => {
    const pay = currentPaymentsData.find(p => p.sourceId === sourceId);
    if (pay && pay.notes) {
        const modal = document.getElementById('modal-payment-note');
        const title = document.getElementById('modal-note-title');
        const text = document.getElementById('modal-note-text');
        
        if (modal && title && text) {
            title.textContent = `Notas: ${pay.name}`;
            text.textContent = pay.notes;
            modal.classList.add('active');
        }
    }
};

function updatePayTotalDisplay() {
    const monthName = new Date(payYear, payMonth).toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
    const bannerTitle = document.getElementById('pay-month-name');
    if (bannerTitle) bannerTitle.textContent = `PAGAMENTOS DE ${monthName} (${payYear})`;
    
    const total = calculatePayTotal(currentPaymentsData);
        
    const display = document.getElementById('pay-total-spent');
    if (display) display.textContent = formatCurrency(total);
}

window.togglePaidStatus = async (sourceId) => {
    const pay = currentPaymentsData.find(p => p.sourceId === sourceId);
    if (!pay) return;
    pay.paid = !pay.paid;
    await savePaymentStatus(pay);
    renderPayments();
};

window.toggleIgnorePayment = async (sourceId) => {
    const pay = currentPaymentsData.find(p => p.sourceId === sourceId);
    if (!pay) return;
    pay.ignored = !pay.ignored;
    await savePaymentStatus(pay);
    renderPayments();
    updatePayTotalDisplay();
};

async function savePaymentStatus(pay) {
    if (!auth.currentUser) {
        showToast("Usuário não autenticado", 'error');
        return;
    }

    const data = {
        userId: auth.currentUser.uid,
        month: payMonth,
        year: payYear,
        sourceId: pay.sourceId,
        actualValue: pay.actualValue,
        originalValue: pay.originalValue,
        paid: pay.paid,
        ignored: pay.ignored,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (pay.dbId) {
            await db.collection('faturas').doc(pay.dbId).update(data);
        } else {
            const docRef = await db.collection('faturas').add(data);
            pay.dbId = docRef.id;
        }
        showToast("Status atualizado!", 'success');
    } catch (error) {
        console.error("Erro detalhado ao salvar status:", error);
        showToast("Erro ao salvar status", 'error');
    }
}

window.openEditPaymentValue = (sourceId) => {
    const pay = currentPaymentsData.find(p => p.sourceId === sourceId);
    if (!pay) return;

    const modal = document.getElementById('modal-edit-payment-value');
    const label = document.getElementById('edit-pay-label');
    const inputVal = document.getElementById('edit-pay-actual-value');
    const inputSource = document.getElementById('edit-pay-source-id');

    if (modal && label && inputVal && inputSource) {
        label.textContent = `Informe o valor real pago para ${pay.name}:`;
        inputVal.value = pay.actualValue;
        inputSource.value = sourceId;
        modal.classList.add('active');
    }
};

const formEditPayValue = document.getElementById('form-edit-payment-value');
if (formEditPayValue) {
    formEditPayValue.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sourceId = document.getElementById('edit-pay-source-id').value;
        const newValue = parseFloat(document.getElementById('edit-pay-actual-value').value);
        
        const pay = currentPaymentsData.find(p => p.sourceId === sourceId);
        if (pay && !isNaN(newValue)) {
            pay.actualValue = newValue;
            await savePaymentStatus(pay);
            renderPayments();
            updatePayTotalDisplay();
            document.getElementById('modal-edit-payment-value').classList.remove('active');
        }
    });
}

// Funções de Navegação e Cálculo do Banner / Pagamentos
function initBannerDate() {
    const now = new Date();
    const next = new Date();
    next.setMonth(now.getMonth() + 1);
    bannerMonth = next.getMonth();
    bannerYear = next.getFullYear();
    payMonth = now.getMonth();
    payYear = now.getFullYear();
    updateTotalDisplay();
    updatePayTotalDisplay();
}

function setupBannerNav() {
    const btnPrev = document.getElementById('btn-banner-prev');
    const btnNext = document.getElementById('btn-banner-next');
    const btnPayPrev = document.getElementById('btn-pay-prev');
    const btnPayNext = document.getElementById('btn-pay-next');

    if (btnPrev) btnPrev.addEventListener('click', () => navigateMonth('banner', -1));
    if (btnNext) btnNext.addEventListener('click', () => navigateMonth('banner', 1));
    if (btnPayPrev) btnPayPrev.addEventListener('click', () => navigateMonth('pay', -1));
    if (btnPayNext) btnPayNext.addEventListener('click', () => navigateMonth('pay', 1));
}

function navigateMonth(type, delta) {
    if (type === 'banner') {
        const d = new Date(bannerYear, bannerMonth + delta, 1);
        bannerMonth = d.getMonth();
        bannerYear = d.getFullYear();
        updateTotalDisplay();
    } else {
        const d = new Date(payYear, payMonth + delta, 1);
        payMonth = d.getMonth();
        payYear = d.getFullYear();
        loadPaymentsData();
    }
}

function updateTotalDisplay() {
    const monthName = new Date(bannerYear, bannerMonth).toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
    const bannerTitle = document.getElementById('banner-month-name');
    if (bannerTitle) bannerTitle.textContent = `TOTAL DE ${monthName} (${bannerYear})`;
    
    // Calculate category spending
    const categoryTotals = calculateCategorySpending(currentExpenses, currentCategories, bannerMonth, bannerYear);
    
    // Update currentCategories with calculated spent values
    currentCategories.forEach(cat => {
        cat.spent = categoryTotals[cat.id] || 0;
    });

    // Calculate main total
    const total = Object.values(categoryTotals).reduce((acc, val) => acc + val, 0);
    const mainTotal = document.getElementById('main-total-spent');
    if (mainTotal) mainTotal.textContent = formatCurrency(total);

    // Update progress bar if a category is selected in the form
    if (catSelectProgress && catSelectProgress.value) {
        updateCategoryProgressBar(catSelectProgress.value);
    }

    // Refresh settings lists to show category spending there too
    renderSettingsLists();
}

// --- LÓGICA DE CARRINHO ---
const modalCart = document.getElementById('modal-cart');
const formCart = document.getElementById('form-cart');
const btnDeleteCart = document.getElementById('btn-delete-cart');
const modalCartItem = document.getElementById('modal-cart-item');
const formCartItem = document.getElementById('form-cart-item');
const btnDeleteCartItem = document.getElementById('btn-delete-cart-item');
let collapsedCarts = new Set(); // Estado para carrinhos recolhidos

if (document.getElementById('btn-add-cart')) {
    document.getElementById('btn-add-cart').addEventListener('click', () => openCartModal());
}

async function loadCartData() {
    if (!cartService) return;
    const list = document.getElementById('list-carts');
    if (list) list.innerHTML = '<div class="list-empty">Carregando carrinhos...</div>';

    try {
        currentCarts = await cartService.getCarts();
        
        // Carregar itens para cada carrinho e iniciar todos recolhidos
        collapsedCarts = new Set();
        for (let cart of currentCarts) {
            cart.items = await cartService.getItems(cart.id);
            collapsedCarts.add(cart.id); // Inicia recolhido
        }

        renderCarts();
    } catch (error) {
        console.error("Erro ao carregar carrinhos:", error);
    }
}

window.toggleCartCollapse = function(cartId) {
    if (collapsedCarts.has(cartId)) {
        collapsedCarts.delete(cartId);
    } else {
        collapsedCarts.add(cartId);
    }
    renderCarts();
};

function renderCarts() {
    const list = document.getElementById('list-carts');
    if (!list) return;

    if (currentCarts.length === 0) {
        list.innerHTML = '<div class="list-empty">Nenhum carrinho cadastrado.</div>';
        return;
    }

    list.innerHTML = currentCarts.map(cart => {
        const isCollapsed = collapsedCarts.has(cart.id);
        return `
        <div class="settings-group cart-card ${isCollapsed ? 'collapsed' : ''}">
            <div class="group-header">
                <div class="cart-title-info" onclick="toggleCartCollapse('${cart.id}')">
                    <div class="cart-name-row">
                        <i class="bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-down'}"></i>
                        <h3 class="cart-name">${cart.name}</h3>
                    </div>
                    <small class="cart-count">${cart.items.length} itens</small>
                </div>
                <div class="cart-header-actions">
                    <button class="btn-edit-item" onclick="openCartModal('${cart.id}')" title="Editar Carrinho">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-add-item small" onclick="openCartItemModal(null, '${cart.id}')" title="Adicionar Itens">
                        <i class="bi bi-plus-lg"></i>
                    </button>
                </div>
            </div>
            <div class="cart-items-list">
                ${cart.items.length === 0 ? '<div class="list-empty">Vazio</div>' : 
                    cart.items.map(item => `
                    <div class="cart-item-row ${item.bought ? 'bought' : ''}">
                        <label class="cart-item-check">
                            <input type="checkbox" ${item.bought ? 'checked' : ''} onchange="toggleCartItemStatus('${item.id}', this.checked)">
                            <span class="checkmark"></span>
                            <span class="item-text">${item.name}</span>
                        </label>
                        <div class="item-actions">
                            <button class="btn-icon-only" onclick="openCartItemModal('${item.id}', '${cart.id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `}).join('');
}

window.openCartModal = function(cartId = null) {
    const title = document.getElementById('modal-cart-title');
    const inputId = document.getElementById('cart-id');
    const inputName = document.getElementById('cart-name');
    
    if (cartId) {
        const cart = currentCarts.find(c => c.id === cartId);
        if (cart) {
            title.textContent = "Editar Carrinho";
            inputId.value = cart.id;
            inputName.value = cart.name;
            if (btnDeleteCart) btnDeleteCart.classList.remove('hidden');
        }
    } else {
        title.textContent = "Novo Carrinho";
        inputId.value = '';
        inputName.value = '';
        if (btnDeleteCart) btnDeleteCart.classList.add('hidden');
    }
    
    if (modalCart) modalCart.classList.add('active');
};

if (formCart) {
    formCart.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('cart-id').value;
        const name = document.getElementById('cart-name').value;
        
        try {
            const cartData = { name };
            if (id) cartData.id = id;

            await cartService.saveCart(cartData);
            modalCart.classList.remove('active');
            showToast("Carrinho salvo!", 'success');
            loadCartData();
        } catch (error) {
            showToast("Erro ao salvar carrinho", 'error');
        }
    });
}

if (btnDeleteCart) {
    btnDeleteCart.addEventListener('click', async () => {
        const id = document.getElementById('cart-id').value;
        if (!id) return;
        if (!confirm("Excluir este carrinho e todos os seus itens?")) return;
        try {
            await cartService.deleteCart(id);
            modalCart.classList.remove('active');
            showToast("Carrinho excluído!", 'success');
            loadCartData();
        } catch (error) {
            showToast("Erro ao excluir carrinho", 'error');
        }
    });
}

window.openCartItemModal = function(itemId = null, cartId) {
    const title = document.getElementById('modal-cart-item-title');
    const inputId = document.getElementById('cart-item-id');
    const inputParentId = document.getElementById('cart-item-parent-id');
    const inputName = document.getElementById('cart-item-name');
    
    if (inputParentId) inputParentId.value = cartId || '';
    
    if (itemId) {
        const cart = currentCarts.find(c => c.id === cartId);
        if (cart && cart.items) {
            const item = cart.items.find(i => i.id === itemId);
            if (item) {
                title.textContent = "Editar Item";
                inputId.value = item.id;
                inputName.value = item.name;
                if (btnDeleteCartItem) btnDeleteCartItem.classList.remove('hidden');
            }
        }
    } else {
        title.textContent = "Novo(s) Item(ns)";
        inputId.value = '';
        inputName.value = '';
        if (btnDeleteCartItem) btnDeleteCartItem.classList.add('hidden');
    }
    
    if (modalCartItem) modalCartItem.classList.add('active');
};

if (formCartItem) {
    formCartItem.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('cart-item-id').value;
        const cartId = document.getElementById('cart-item-parent-id').value;
        const rawName = document.getElementById('cart-item-name').value;
        
        if (!cartId) {
            showToast("Erro: ID do carrinho não encontrado", 'error');
            return;
        }

        try {
            if (id) {
                // Edição de um único item
                await cartService.saveItem({ id, cartId, name: rawName.trim() });
            } else {
                // Adição múltipla
                const names = rawName.split('\n')
                    .map(n => n.trim())
                    .filter(n => n !== '');
                
                if (names.length === 0) {
                    showToast("Digite pelo menos um item", 'warning');
                    return;
                }

                // Salvar todos em paralelo (ou sequencial se preferir)
                // Para manter a ordem de criação correta conforme digitado, vamos fazer sequencial ou usar Promise.all
                // Como Firestore add é rápido, Promise.all é ok, mas a ordem pode variar levemente.
                // Mas o getItems do cart-service já ordena por createdAt.
                
                for (const name of names) {
                    await cartService.saveItem({ cartId, name });
                }
            }

            modalCartItem.classList.remove('active');
            showToast(id ? "Item salvo!" : "Itens adicionados!", 'success');
            loadCartData();
        } catch (error) {
            showToast("Erro ao salvar item(ns)", 'error');
        }
    });
}

if (btnDeleteCartItem) {
    btnDeleteCartItem.addEventListener('click', async () => {
        const id = document.getElementById('cart-item-id').value;
        if (!confirm("Excluir este item?")) return;
        try {
            await cartService.deleteItem(id);
            modalCartItem.classList.remove('active');
            showToast("Item excluído!", 'success');
            loadCartData();
        } catch (error) {
            showToast("Erro ao excluir item", 'error');
        }
    });
}

window.toggleCartItemStatus = async function(itemId, bought) {
    try {
        await cartService.toggleItemBought(itemId, bought);
        // Atualizar localmente para feedback rápido
        for (let cart of currentCarts) {
            const item = cart.items.find(i => i.id === itemId);
            if (item) {
                item.bought = bought;
                break;
            }
        }
        renderCarts();
        if (window.navigator.vibrate) window.navigator.vibrate(10);
    } catch (error) {
        showToast("Erro ao atualizar item", 'error');
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => {
    setupYearFilter();
    initBannerDate();
    setupBannerNav();
    showScreen('register');
});

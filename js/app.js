import firebaseConfig from './firebase-config.js';
import { AuthService } from './auth-service.js';
import { ImportService } from './import-service.js';
import { SettingsService } from './settings-service.js';
import { formatCurrency, getInstallmentStatus, calculateDueDate, showToast } from './utils.js';

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
let currentExpenses = [];
let categoryChart = null;

const authScreen = document.getElementById('auth-screen');
const appWrapper = document.getElementById('app-wrapper');
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLogout = document.getElementById('btn-logout');

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
        loadAllSettings();
        console.log("Usuário logado:", user.email);
    } else {
        authScreen.classList.add('active');
        appWrapper.style.display = 'none';
        settingsService = null;
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
    
    if (window.navigator.vibrate) {
        window.navigator.vibrate(5);
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
    
    // Calcula o próximo mês e o ano correspondente
    let nextMonth = now.getMonth() + 1;
    let nextYear = now.getFullYear();
    
    if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
    }

    // Preenche as opções de ano (baseado no nextYear para cobrir viradas de ano)
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
    [month, year, category, payment].forEach(el => {
        if (el) {
            el.removeEventListener('change', renderDashboard);
            el.addEventListener('change', renderDashboard);
        }
    });
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
    if (!monthSelect || !yearSelect) return;

    const filterMonth = parseInt(monthSelect.value);
    const filterYear = parseInt(yearSelect.value);
    const categoryFilter = categorySelect ? categorySelect.value : 'all';
    const paymentFilter = paymentSelect ? paymentSelect.value : 'all';

    const filtered = [];

    currentExpenses.forEach(exp => {
        const isParcelado = exp.type === 'parcelado' && exp.installments > 1;
        const baseDate = exp.dueDate || exp.date;

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
        
        // Badge de Parcela
        const installmentBadge = exp.currentInstallment 
            ? `<span class="installment-badge">${exp.currentInstallment}/${exp.installments}</span>` 
            : '';

        return `
            <div class="history-item">
                <div class="history-info">
                    <span class="history-name">${exp.description} ${installmentBadge}</span>
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
            formRegister.reset();
            parcelasField.classList.add('hidden');
            if (progressContainer) progressContainer.classList.add('hidden');
            loadDashboardData(); // Recarrega para atualizar banner
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
        loadDashboardData(); // Carrega despesas após configurações para atualizar banner
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
        opt.value = pay.id;
        opt.textContent = pay.name;
        paySelect.appendChild(opt);
    });
}

const catSelectProgress = document.getElementById('reg-category');
const progressContainer = document.getElementById('category-progress-container');
const progressFill = document.getElementById('progress-fill');
const progSpent = document.getElementById('prog-spent');
const progTotal = document.getElementById('prog-total');
const progText = document.getElementById('prog-text');

if (catSelectProgress) {
    catSelectProgress.addEventListener('change', (e) => {
        const cat = currentCategories.find(c => c.id === e.target.value);
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
    });
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
    itemType.value = type;
    itemId.value = item ? item.id : '';
    title.textContent = item ? `Editar ${getLabel(type)}` : `Nova ${getLabel(type)}`;
    if (item) btnDeleteSettingsItem.classList.remove('hidden');
    else btnDeleteSettingsItem.classList.add('hidden');
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
            modalSettings.classList.remove('active');
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
            modalSettings.classList.remove('active');
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
                importStatus.textContent = `Progresso: ${sucessos} de ${despesas.length}...`;
            } catch (error) { console.error("Erro import:", error); }
        }
        btnProcessImport.disabled = false;
        btnProcessImport.textContent = "Iniciar Importação";
        importStatus.textContent = `Concluído! Sucessos: ${sucessos}`;
        if (sucessos > 0) {
            importTextarea.value = '';
            setTimeout(() => modalImport.classList.remove('active'), 2000);
        }
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.error('SW falhou!', err));
    });
}

let bannerMonth = 0;
let bannerYear = 0;

function initBannerDate() {
    const now = new Date();
    // Inicia no próximo mês
    now.setMonth(now.getMonth() + 1);
    bannerMonth = now.getMonth();
    bannerYear = now.getFullYear();
    updateTotalDisplay();
}

function setupBannerNav() {
    const btnPrev = document.getElementById('btn-banner-prev');
    const btnNext = document.getElementById('btn-banner-next');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (bannerMonth === 0) {
                bannerMonth = 11;
                bannerYear--;
            } else {
                bannerMonth--;
            }
            updateTotalDisplay();
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (bannerMonth === 11) {
                bannerMonth = 0;
                bannerYear++;
            } else {
                bannerMonth++;
            }
            updateTotalDisplay();
        });
    }
}

function updateTotalDisplay() {
    const monthName = new Date(bannerYear, bannerMonth).toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
    const bannerTitle = document.getElementById('banner-month-name');
    if (bannerTitle) bannerTitle.textContent = `TOTAL DE ${monthName} (${bannerYear})`;
    
    let total = 0;
    currentExpenses.forEach(exp => {
        const isParcelado = exp.type === 'parcelado' && exp.installments > 1;
        const baseDate = exp.dueDate || exp.date;

        if (isParcelado) {
            const currentInst = getInstallmentStatus(baseDate, exp.installments, bannerMonth, bannerYear);
            if (currentInst) total += exp.value;
        } else {
            const expDate = new Date(baseDate);
            if (expDate.getMonth() === bannerMonth && expDate.getFullYear() === bannerYear) total += exp.value;
        }
    });
    const mainTotal = document.getElementById('main-total-spent');
    if (mainTotal) mainTotal.textContent = formatCurrency(total);
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    setupYearFilter();
    initBannerDate();
    setupBannerNav();
    showScreen('register');
});
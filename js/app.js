import firebaseConfig from './firebase-config.js';
import { AuthService } from './auth-service.js';
import { ImportService } from './import-service.js';
import { SettingsService } from './settings-service.js';
import { CartService } from './cart-service.js';
import { formatCurrency, getInstallmentStatus, calculateDueDate, showToast, calculatePayTotal, calculateDueDateForMonth, calculateCategorySpending, maskCurrency, parseCurrency } from './utils.js';

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
const initialLoader = document.getElementById('initial-loader');
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLogout = document.getElementById('btn-logout');

function hideInitialLoader() {
    if (initialLoader) {
        initialLoader.style.opacity = '0';
        setTimeout(() => initialLoader.remove(), 500);
    }
}

// Alertas de Conexão
window.addEventListener('online', () => showToast("Conexão restaurada!", 'success'));
window.addEventListener('offline', () => showToast("Você está offline. Usando dados locais.", 'warning'));

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

// Aplicação de máscara de moeda nos inputs
function applyCurrencyMask(e) {
    const input = e.target;
    const originalValue = input.value;
    const maskedValue = maskCurrency(originalValue);
    
    // Só atualiza se o valor formatado for diferente para evitar loops e problemas de cursor
    if (originalValue !== maskedValue) {
        input.value = maskedValue;
        
        // Disparar evento de input manualmente para garantir que outros ouvintes (como barra de progresso) vejam a mudança
        // Usamos CustomEvent com isMasked para que a própria delegação saiba que não deve re-aplicar a máscara
        input.dispatchEvent(new CustomEvent('input', { 
            bubbles: true, 
            detail: { isMasked: true } 
        }));
    }
}

// Lista de IDs que usam máscara de moeda (estáticos e dinâmicos)
const currencyInputIds = [
    'reg-value', 
    'edit-reg-value', 
    'edit-pay-actual-value',
    'cat-limit',
    'debt-value'
];

// Delegação centralizada para máscaras de moeda
document.addEventListener('input', (e) => {
    if (currencyInputIds.includes(e.target.id)) {
        // Evitar recursão infinita se o evento foi disparado pelo próprio applyCurrencyMask
        if (e.detail && e.detail.isMasked) return;
        applyCurrencyMask(e);
    }
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
    hideInitialLoader();
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
}, error => {
    console.error("Erro Auth:", error);
    hideInitialLoader();
    showToast("Erro ao verificar autenticação.", 'error');
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

    // Exibir banner global apenas no Dashboard e no Cadastro
    const banner = document.getElementById('unified-banner');
    if (banner) {
        if (screenId === 'dashboard' || screenId === 'register') {
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }
    }
    
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
        year: document.getElementById('dash-filter-year'),
        category: document.getElementById('dash-filter-category'),
        payment: document.getElementById('dash-filter-payment')
    };
}

function setupYearFilter() {
    const { year: yearSelect } = getDashFilters();
    if (!yearSelect) return;

    yearSelect.innerHTML = '';
    const now = new Date();
    
    let nextYear = now.getFullYear();
    
    // Se estivermos em Dezembro, permitir ver o próximo ano
    if (now.getMonth() === 11) {
        nextYear++;
    }

    for (let i = 0; i < 4; i++) {
        const year = nextYear - i;
        const opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year;
        yearSelect.appendChild(opt);
    }
    
    // Sincronizar com bannerYear
    yearSelect.value = bannerYear;

    setupFilterListeners();
}

function setupFilterListeners() {
    const { year, category, payment } = getDashFilters();
    const searchInput = document.getElementById('dash-search-history');

    [year, category, payment].forEach(el => {
        if (el) {
            el.removeEventListener('change', onDashFilterChange);
            el.addEventListener('change', onDashFilterChange);
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', renderDashboard);
    }
}

function onDashFilterChange(e) {
    if (e.target.id === 'dash-filter-year') {
        bannerYear = parseInt(e.target.value);
        updateTotalDisplay();
    }
    renderDashboard();
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
            
        updateTotalDisplay();
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

function renderDashboard() {
    const { year: yearSelect, category: categorySelect, payment: paymentSelect } = getDashFilters();
    const searchInput = document.getElementById('dash-search-history');
    
    if (!yearSelect) return;

    const filterMonth = bannerMonth;
    const filterYear = bannerYear;
    
    // Sincronizar select de ano com bannerYear caso tenha mudado via banner
    if (yearSelect.value != bannerYear) {
        yearSelect.value = bannerYear;
    }

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
    
    // Atualizar o total no topo apenas se estivermos na tela de dashboard
    const mainTotal = document.getElementById('main-total-spent');
    const screenDash = document.getElementById('screen-dashboard');
    const isDashboardActive = screenDash && screenDash.classList.contains('active');

    if (isDashboardActive && mainTotal) {
        mainTotal.textContent = formatCurrency(total);
    }
    
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
    document.getElementById('edit-reg-value').value = maskCurrency(exp.value);
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
            value: parseCurrency(document.getElementById('edit-reg-value').value),
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

// Evento para trocar o mês do topo conforme a forma de pagamento (Cartão de Crédito com Virada)
const regPaymentSelect = document.getElementById('reg-payment-method');

function updateBannerByPaymentMethod(paymentMethodId) {
    if (!paymentMethodId) return;

    const payMethod = currentPaymentMethods.find(p => p.id === paymentMethodId);
    if (payMethod && payMethod.type === 'credito' && payMethod.endDay) {
        const now = new Date();
        const dueDateStr = calculateDueDate(now, payMethod);
        const dueDate = new Date(dueDateStr);
        
        const dueMonth = dueDate.getMonth();
        const dueYear = dueDate.getFullYear();

        // Atualizar Filtros do Dashboard
        const { year: yearSelect } = getDashFilters();
        
        // Verificar se o ano existe no select de ano, se não, adicionar
        if (yearSelect) {
            let yearExists = false;
            for (let i = 0; i < yearSelect.options.length; i++) {
                if (parseInt(yearSelect.options[i].value) === dueYear) {
                    yearExists = true;
                    break;
                }
            }
            if (!yearExists) {
                const opt = document.createElement('option');
                opt.value = dueYear;
                opt.textContent = dueYear;
                yearSelect.appendChild(opt);
            }
            yearSelect.value = dueYear;
        }

        // Atualizar variáveis do Banner
        bannerMonth = dueMonth;
        bannerYear = dueYear;

        // Renderizar atualizações (updateTotalDisplay já chama renderDashboard)
        updateTotalDisplay();
    }
}

if (regPaymentSelect) {
    regPaymentSelect.addEventListener('change', (e) => {
        updateBannerByPaymentMethod(e.target.value);
    });
}

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
            value: parseCurrency(document.getElementById('reg-value').value),
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
            <div class="field-group span-2"><label>Limite (R$)</label><input type="text" inputmode="numeric" id="cat-limit" autocomplete="off" value="${data.limit ? maskCurrency(data.limit) : '0,00'}" required></div>
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
            <div class="field-group"><label>Valor (R$)</label><input type="text" inputmode="numeric" id="debt-value" autocomplete="off" value="${data.value ? maskCurrency(data.value) : '0,00'}" required></div>
            <div class="field-group"><label>Dia</label><input type="number" id="debt-day" min="1" max="31" value="${data.paymentDay || ''}" required></div>
            <div class="field-group"><label>Início (Opcional)</label><input type="date" id="debt-start" value="${data.startDate || ''}"></div>
            <div class="field-group"><label>Fim (Opcional)</label><input type="date" id="debt-end" value="${data.endDate || ''}"></div>
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
            data.limit = parseCurrency(document.getElementById('cat-limit').value);
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
            data.value = parseCurrency(document.getElementById('debt-value').value);
            data.paymentDay = parseInt(document.getElementById('debt-day').value);
            data.startDate = document.getElementById('debt-start').value;
            data.endDate = document.getElementById('debt-end').value;
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

// Registro do Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registrado!', reg.scope))
            .catch(err => console.error('SW falhou!', err));
    });
}

// Lógica de Instalação PWA
let deferredPrompt;
const pwaInstallContainer = document.getElementById('pwa-install-container');
const btnPwaInstall = document.getElementById('btn-pwa-install');

// Verificar se já está instalado (standalone)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

window.addEventListener('beforeinstallprompt', (e) => {
    console.log('Evento beforeinstallprompt disparado!');
    // Impedir que o mini-infobar apareça em dispositivos móveis
    e.preventDefault();
    // Guardar o evento para que possa ser disparado mais tarde
    deferredPrompt = e;
    // Mostrar o botão de instalação apenas se NÃO estiver em modo standalone
    if (pwaInstallContainer && !isStandalone) {
        pwaInstallContainer.classList.remove('hidden');
    }
});

if (btnPwaInstall) {
    btnPwaInstall.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        // Mostrar o prompt de instalação
        deferredPrompt.prompt();
        // Esperar pela resposta do usuário
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Usuário escolheu: ${outcome}`);
        // Limpar o prompt
        deferredPrompt = null;
        // Esconder o botão
        if (pwaInstallContainer) pwaInstallContainer.classList.add('hidden');
    });
}

window.addEventListener('appinstalled', (event) => {
    console.log('PWA instalado com sucesso!');
    if (pwaInstallContainer) pwaInstallContainer.classList.add('hidden');
    deferredPrompt = null;
});

// Start
document.addEventListener('DOMContentLoaded', () => {

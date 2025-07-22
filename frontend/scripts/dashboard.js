/**
 * Determina a URL base da API com base no ambiente (desenvolvimento ou produção).
 * @returns {string} A URL base para as chamadas da API.
 */
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    // Se estiver em ambiente de desenvolvimento local, aponta para a porta do Uvicorn.
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000';
    }
    // Em produção, as chamadas são relativas à própria origem, então retornamos uma string vazia.
    return '';
};

const API_URL = getApiBaseUrl();

// --- Checagem de Autenticação ---
const token = localStorage.getItem('accessToken');
if (!token) {
    window.location.href = '../auth/login_page.html';
}

// --- Variáveis Globais ---
let allGoals = [];
let groupMembers = [];
let allTransactions = []; // Armazena as transações recentes (página principal)
let fullTransactionHistory = []; // Armazena TODAS as transações para o modal
let filteredTransactionHistory = []; // Armazena as transações filtradas para exportação
let allPaymentReminders = [];
let monthlyChart = null;
let currentUserId = null;
let aiUsageTimer = null;
let recognition = null;
let isRecording = false;

const medalInfo = {
    'Bronze': { emoji: '🥉', color: 'text-bronze' },
    'Prata': { emoji: '🥈', color: 'text-silver' },
    'Ouro': { emoji: '🥇', color: 'text-gold' },
    'Platina': { emoji: '💎', color: 'text-platinum' },
    'Diamante': { emoji: '🏆', color: 'text-diamond' }
};

// --- Funções de Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    setupEventListeners();
    setupSpeechRecognition();
});

function setupEventListeners() {
    // --- INÍCIO DA ALTERAÇÃO: Lógica do menu aprimorada ---
    const menuButton = document.getElementById('menu-button');
    const menuCard = document.getElementById('menu-card');
    if (menuButton && menuCard) {
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede que o clique no botão feche o menu imediatamente
            menuCard.classList.toggle('hidden');
        });

        // Fecha o menu se o usuário clicar fora dele
        window.addEventListener('click', (e) => {
            if (!menuCard.classList.contains('hidden') && !menuButton.contains(e.target) && !menuCard.contains(e.target)) {
                menuCard.classList.add('hidden');
            }
        });
    }
    document.getElementById('logout-button')?.addEventListener('click', logout);
    // --- FIM DA ALTERAÇÃO ---

    // Botões principais
    document.getElementById('add-transaction-button')?.addEventListener('click', () => openTransactionModal());
    document.getElementById('add-goal-button')?.addEventListener('click', () => openGoalModal());
    document.getElementById('invite-button')?.addEventListener('click', handleInviteClick);
    document.getElementById('analyze-ai-button')?.addEventListener('click', handleAiTextAnalysis);
    document.getElementById('ai-record-button')?.addEventListener('click', toggleRecording);

    // Modais
    setupModalEventListeners('invite-modal', 'close-invite-modal');
    setupModalEventListeners('transaction-form-modal', 'cancel-transaction-button');
    setupModalEventListeners('ai-results-modal', 'close-ai-results-modal', 'cancel-ai-results-button');
    setupModalEventListeners('goal-form-modal', 'cancel-goal-button');
    setupModalEventListeners('add-funds-modal', 'cancel-funds-button');
    setupModalEventListeners('withdraw-funds-modal', 'cancel-withdraw-button');

    // Histórico Completo (Premium)
    setupModalEventListeners('full-history-modal', 'close-history-modal');
    document.getElementById('full-history-button')?.addEventListener('click', openFullHistoryModal);
    document.getElementById('apply-filters-button')?.addEventListener('click', applyHistoryFilters);
    document.getElementById('export-csv-button')?.addEventListener('click', exportToCSV);
    document.getElementById('export-pdf-button')?.addEventListener('click', exportToPDF);

    // Lembretes de Pagamento (Premium)
    setupModalEventListeners('payment-reminder-modal', 'cancel-payment-reminder-button');
    setupModalEventListeners('all-reminders-modal', 'close-all-reminders-modal');
    document.getElementById('add-payment-reminder-button')?.addEventListener('click', () => openPaymentReminderModal());
    document.getElementById('payment-reminder-form')?.addEventListener('submit', handlePaymentReminderFormSubmit);
    document.getElementById('view-all-reminders-button')?.addEventListener('click', openAllRemindersModal);


    // Formulários
    document.getElementById('transaction-form')?.addEventListener('submit', handleTransactionFormSubmit);
    document.getElementById('goal-form')?.addEventListener('submit', handleGoalFormSubmit);
    document.getElementById('add-funds-form')?.addEventListener('submit', handleAddFundsFormSubmit);
    document.getElementById('withdraw-funds-form')?.addEventListener('submit', handleWithdrawFundsFormSubmit);
    document.getElementById('copy-invite-link-button')?.addEventListener('click', copyInviteLink);
    document.getElementById('save-ai-results-button')?.addEventListener('click', handleSaveAiResults);
}

function setupModalEventListeners(modalId, ...closeButtonIds) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    closeButtonIds.forEach(buttonId => {
        document.getElementById(buttonId)?.addEventListener('click', () => toggleModal(modalId, false));
    });
}


// --- Carregamento de Dados e Renderização Principal ---

async function loadDashboardData() {
    let groupId = localStorage.getItem('activeGroupId');
    if (!groupId) {
        try {
            const userResponse = await fetch(`${API_URL}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!userResponse.ok) throw new Error('Sessão expirada.');
            const userData = await userResponse.json();
            if (userData.grupo_id) {
                localStorage.setItem('activeGroupId', userData.grupo_id);
                groupId = userData.grupo_id;
            } else {
                throw new Error('Usuário não associado a um grupo.');
            }
        } catch (error) {
            logout();
            return;
        }
    }

    try {
        const response = await fetch(`${API_URL}/api/groups/${groupId}/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401) {
            logout();
            return;
        }
        if (!response.ok) throw new Error('Não foi possível carregar os dados do dashboard.');

        const data = await response.json();

        currentUserId = data.current_user_id;
        groupMembers = data.membros;
        allTransactions = data.movimentacoes_recentes;
        localStorage.setItem('userPlan', data.plano);

        renderHeader(data.nome_utilizador);
        renderMascote(data.ganhos_mes_atual, data.gastos_mes_atual);
        renderStats(data.total_investido, data.saldo_total);
        renderTransactions(data.movimentacoes_recentes);
        renderGoals(data.meta_ativa ? [data.meta_ativa] : [], data.plano);
        renderAchievements(data.conquistas_recentes);
        renderGroupMembers(data.membros, data.plano);
        renderAiUsage(data.plano, data.ai_usage_count_today, data.ai_first_usage_timestamp_today);
        fetchChartData(groupId);

        if (data.plano === 'premium') {
            fetchPaymentReminders(groupId);
        }

    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        document.body.innerHTML = `<div class="text-center p-8 text-red-400">Erro ao carregar dados. Por favor, tente fazer login novamente. <a href="../auth/login_page.html" class="underline">Ir para Login</a></div>`;
    }
}

// --- Funções de Renderização de Componentes ---

function renderHeader(userName) {
    document.getElementById('user-name').textContent = `Olá, ${userName.split(' ')[0]}!`;
}

function renderMascote(ganhos, gastos) {
    const saldoMes = ganhos - gastos;
    const mascoteImg = document.getElementById('mascote-img');
    const mascoteTitle = document.getElementById('mascote-title');
    const mascoteText = document.getElementById('mascote-text');

    if (saldoMes >= 0) {
        mascoteImg.src = '../../assets/mascote_feliz.png';
        mascoteTitle.textContent = 'Situação Financeira: Estável';
        mascoteText.textContent = 'Ótimo trabalho! Seus gastos estão controlados este mês.';
    } else {
        mascoteImg.src = '../../assets/mascote_desesperado.png';
        mascoteTitle.textContent = 'Situação Financeira: Atenção!';
        mascoteText.textContent = 'Cuidado! Seus gastos superaram seus ganhos este mês.';
    }
}

function renderStats(totalInvestido, saldoTotal) {
    document.getElementById('total-investido').textContent = formatCurrency(totalInvestido);
    const saldoEl = document.getElementById('saldo-total');
    saldoEl.textContent = formatCurrency(saldoTotal);
    saldoEl.className = `text-2xl font-bold ${saldoTotal >= 0 ? 'text-white' : 'text-expense'}`;
}

function renderTransactions(transactions) {
    const tableBody = document.getElementById('transactions-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Nenhuma transação recente.</td></tr>';
        return;
    }
    transactions.forEach(tx => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-700 hover:bg-surface/50';
        const valorClass = tx.tipo === 'ganho' ? 'text-gain' : tx.tipo === 'gasto' ? 'text-expense' : 'text-investment';

        row.innerHTML = `
            <td class="py-3 px-2">${tx.descricao}</td>
            <td class="py-3 px-2 font-medium ${valorClass}">${formatCurrency(tx.valor)}</td>
            <td class="py-3 px-2 text-gray-400">${tx.responsavel_nome.split(' ')[0]}</td>
            <td class="py-3 px-2 text-gray-400">${new Date(tx.data_transacao).toLocaleDateString('pt-BR')}</td>
            <td class="py-3 px-2 text-center">
                <button onclick="openTransactionModal('${tx.id}')" class="text-gray-400 hover:text-primary p-1"><i class="fas fa-pencil-alt"></i></button>
                <button onclick="handleDeleteTransaction('${tx.id}')" class="text-gray-400 hover:text-danger p-1"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderGoals(goals, plan) {
    allGoals = goals;
    const container = document.getElementById('goals-list-container');
    const addButtonContainer = document.getElementById('add-goal-button-container');
    if (!container || !addButtonContainer) return;
    
    container.innerHTML = '';

    if (goals.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-sm">Nenhuma meta ativa. Crie uma para começar a poupar!</p>';
    } else {
        goals.forEach(goal => {
            const percentage = (goal.valor_meta > 0) ? (goal.valor_atual / goal.valor_meta) * 100 : 0;
            const goalCard = document.createElement('div');
            goalCard.className = 'bg-background p-4 rounded-lg';
            goalCard.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold">${goal.titulo}</h4>
                        <p class="text-sm text-gray-400">${formatCurrency(goal.valor_atual)} / ${formatCurrency(goal.valor_meta)}</p>
                    </div>
                    <div class="relative">
                        <button onclick="toggleGoalMenu('${goal.id}')" class="text-gray-400 hover:text-white p-1"><i class="fas fa-ellipsis-v"></i></button>
                        <div id="goal-menu-${goal.id}" class="hidden absolute right-0 mt-2 w-40 bg-surface rounded-lg shadow-xl py-1 z-10">
                            <a href="#" onclick="openGoalModal('${goal.id}')" class="block px-3 py-1 text-sm text-gray-300 hover:bg-primary hover:text-white">Editar Meta</a>
                            <a href="#" onclick="openWithdrawFundsModal('${goal.id}')" class="block px-3 py-1 text-sm text-gray-300 hover:bg-primary hover:text-white">Retirar Fundos</a>
                            <a href="#" onclick="handleDeleteGoal('${goal.id}')" class="block px-3 py-1 text-sm text-red-400 hover:bg-red-500 hover:text-white">Apagar Meta</a>
                        </div>
                    </div>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                    <div class="bg-primary h-2.5 rounded-full" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <button onclick="openAddFundsModal('${goal.id}')" class="w-full mt-3 py-1.5 bg-primary/80 hover:bg-primary transition text-white rounded-lg text-sm font-medium">Adicionar Fundos</button>
            `;
            container.appendChild(goalCard);
        });
    }

    if (plan === 'gratuito' && goals.length > 0) {
        addButtonContainer.innerHTML = `
            <div class="text-center mt-4 p-3 bg-background rounded-lg">
                <p class="text-sm text-gray-400">O plano gratuito permite apenas uma meta ativa.</p>
                <a href="./premium.html" class="text-sm font-medium text-primary-light hover:underline">Faça upgrade para metas ilimitadas 💎</a>
            </div>
        `;
    } else {
        addButtonContainer.innerHTML = `
            <button id="add-goal-button" class="w-full text-center mt-4 py-2 bg-primary/80 hover:bg-primary transition text-white rounded-lg">Adicionar Nova Meta</button>
        `;
        document.getElementById('add-goal-button')?.addEventListener('click', () => openGoalModal());
    }
}

function renderAchievements(achievements) {
    const container = document.getElementById('achievements-list-container');
    if (!container) return;
    container.innerHTML = '';
    if (achievements.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-sm">Nenhuma conquista recente.</p>';
        return;
    }
    achievements.forEach(ach => {
        const info = medalInfo[ach.tipo_medalha] || { emoji: '⭐', color: 'text-white' };
        const achievementEl = document.createElement('div');
        achievementEl.className = 'flex items-center space-x-3';
        achievementEl.innerHTML = `
            <span class="text-3xl">${info.emoji}</span>
            <div>
                <p class="font-medium ${info.color}">${ach.tipo_medalha}</p>
                <p class="text-xs text-gray-400">${ach.descricao}</p>
            </div>
        `;
        container.appendChild(achievementEl);
    });
}

function renderGroupMembers(members, plan) {
    const container = document.getElementById('members-list');
    const groupNameEl = document.getElementById('group-name');
    const upgradeCard = document.getElementById('upgrade-card');
    const inviteButton = document.getElementById('invite-button');
    if (!container || !groupNameEl) return;

    const memberLimit = plan === 'premium' ? 4 : 2;
    groupNameEl.textContent = `Meu Grupo (${members.length}/${memberLimit})`;
    container.innerHTML = '';
    members.forEach(member => {
        const memberEl = document.createElement('div');
        memberEl.className = 'flex items-center space-x-3';
        memberEl.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center font-bold text-black text-sm">${member.nome.charAt(0)}</div>
            <div>
                <p class="font-medium text-sm">${member.nome}</p>
                <p class="text-xs text-gray-500">${member.papel === 'dono' ? 'Dono' : 'Membro'}</p>
            </div>
        `;
        container.appendChild(memberEl);
    });

    if (members.length >= memberLimit && plan === 'gratuito' && upgradeCard) {
        inviteButton.classList.add('hidden');
        upgradeCard.classList.remove('hidden');
    } else {
        inviteButton.classList.remove('hidden');
        if (upgradeCard) upgradeCard.classList.add('hidden');
    }
}

function renderAiUsage(plan, count, firstUsageTimestamp) {
    const statusEl = document.getElementById('ai-usage-status');
    if (!statusEl) return;

    if (plan !== 'gratuito') {
        statusEl.parentElement.style.display = 'none';
        return;
    };

    const analyzeButton = document.getElementById('analyze-ai-button');
    const recordButton = document.getElementById('ai-record-button');

    if (count >= 2) {
        statusEl.textContent = 'Limite diário de IA atingido.';
        statusEl.className = 'text-sm text-center bg-red-900/50 text-red-300 p-2 rounded-md mb-4';
        analyzeButton.disabled = true;
        recordButton.disabled = true;

        if (firstUsageTimestamp) {
            const resetTime = new Date(new Date(firstUsageTimestamp).getTime() + 24 * 60 * 60 * 1000);
            if (aiUsageTimer) clearInterval(aiUsageTimer);
            const updateTimer = () => {
                const now = new Date();
                const diff = resetTime - now;
                if (diff <= 0) {
                    clearInterval(aiUsageTimer);
                    loadDashboardData();
                } else {
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    statusEl.textContent = `Limite atingido. Tente novamente em ${hours}h ${minutes}m.`;
                }
            };
            aiUsageTimer = setInterval(updateTimer, 60000);
            updateTimer();
        }
    } else {
        statusEl.textContent = `Usos hoje: ${count}/2. Upgrade para ilimitado!`;
        statusEl.className = 'text-sm text-center bg-background/50 p-2 rounded-md mb-4 text-gray-400';
        analyzeButton.disabled = false;
        recordButton.disabled = false;
        if (aiUsageTimer) clearInterval(aiUsageTimer);
    }
}


// --- Lógica de Gráficos ---

async function fetchChartData(groupId) {
    try {
        const response = await fetch(`${API_URL}/api/groups/${groupId}/chart_data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar dados do gráfico.');
        const data = await response.json();
        updateMonthlyChart(data);
    } catch (error) {
        console.error('Erro no gráfico:', error);
    }
}

function updateMonthlyChart(data) {
    const ctx = document.getElementById('monthly-chart')?.getContext('2d');
    if (!ctx) return;

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.mes),
            datasets: [
                {
                    label: 'Ganhos',
                    data: data.map(d => d.ganhos),
                    backgroundColor: '#22c55e',
                },
                {
                    label: 'Gastos',
                    data: data.map(d => d.gastos),
                    backgroundColor: '#ef4444',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: '#d1d5db' } } }
        }
    });
}


// --- Lógica de Transações ---

function openTransactionModal(transactionId = null) {
    const form = document.getElementById('transaction-form');
    form.reset();
    document.getElementById('transaction-id').value = '';
    document.getElementById('transaction-error-message').classList.add('hidden');

    const title = document.getElementById('transaction-form-title');
    if (transactionId) {
        title.textContent = 'Editar Transação';
        const tx = allTransactions.find(t => t.id === transactionId);
        if (tx) {
            document.getElementById('transaction-id').value = tx.id;
            document.getElementById('transaction-type').value = tx.tipo;
            document.getElementById('transaction-description').value = tx.descricao;
            document.getElementById('transaction-value').value = tx.valor;
            document.getElementById('transaction-date').value = new Date(tx.data_transacao).toISOString().split('T')[0];
        }
    } else {
        title.textContent = 'Adicionar Nova Transação';
        document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
    }
    toggleModal('transaction-form-modal', true);
}

async function handleTransactionFormSubmit(event) {
    event.preventDefault();
    const groupId = localStorage.getItem('activeGroupId');
    const transactionId = document.getElementById('transaction-id').value;

    const transactionData = {
        tipo: document.getElementById('transaction-type').value,
        descricao: document.getElementById('transaction-description').value,
        valor: parseFloat(document.getElementById('transaction-value').value),
        data_transacao: document.getElementById('transaction-date').value,
        responsavel_id: currentUserId,
    };

    const method = transactionId ? 'PUT' : 'POST';
    const url = transactionId
        ? `${API_URL}/api/transactions/${transactionId}`
        : `${API_URL}/api/transactions/group/${groupId}`;

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(transactionData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        toggleModal('transaction-form-modal', false);
        loadDashboardData();
    } catch (error) {
        document.getElementById('transaction-error-message').textContent = error.message;
        document.getElementById('transaction-error-message').classList.remove('hidden');
    }
}

async function handleDeleteTransaction(transactionId) {
    const confirmed = await showCustomAlert('Confirmar Exclusão', 'Tem certeza que quer apagar esta transação?', 'confirm');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/api/transactions/${transactionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail);
        }
        loadDashboardData();
    } catch (error) {
        showCustomAlert('Erro', error.message);
    }
}


// --- Lógica de Metas (Goals) ---

function openGoalModal(goalId = null) {
    const form = document.getElementById('goal-form');
    form.reset();
    document.getElementById('goal-id').value = '';
    document.getElementById('goal-error-message').classList.add('hidden');

    const title = document.getElementById('goal-form-title');
    if (goalId) {
        title.textContent = 'Editar Meta';
        const goal = allGoals.find(g => g.id === goalId);
        if (goal) {
            document.getElementById('goal-id').value = goal.id;
            document.getElementById('goal-title').value = goal.titulo;
            document.getElementById('goal-value').value = goal.valor_meta;
            document.getElementById('goal-date').value = goal.data_limite;
        }
    } else {
        title.textContent = 'Criar Nova Meta';
    }
    toggleModal('goal-form-modal', true);
}

async function handleGoalFormSubmit(event) {
    event.preventDefault();
    const groupId = localStorage.getItem('activeGroupId');
    const goalId = document.getElementById('goal-id').value;

    const goalData = {
        titulo: document.getElementById('goal-title').value,
        valor_meta: parseFloat(document.getElementById('goal-value').value),
        data_limite: document.getElementById('goal-date').value || null,
    };

    const method = goalId ? 'PUT' : 'POST';
    const url = goalId
        ? `${API_URL}/api/groups/goals/${goalId}`
        : `${API_URL}/api/groups/${groupId}/goals`;

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(goalData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        toggleModal('goal-form-modal', false);
        loadDashboardData();
    } catch (error) {
        document.getElementById('goal-error-message').textContent = error.message;
        document.getElementById('goal-error-message').classList.remove('hidden');
    }
}

async function handleDeleteGoal(goalId) {
    const confirmed = await showCustomAlert('Confirmar Exclusão', 'Tem certeza que quer apagar esta meta? Esta ação não pode ser desfeita.', 'confirm');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/api/groups/goals/${goalId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail);
        }
        loadDashboardData();
    } catch (error) {
        showCustomAlert('Erro', error.message);
    }
}

function toggleGoalMenu(goalId) {
    document.querySelectorAll('[id^="goal-menu-"]').forEach(menu => {
        if (menu.id !== `goal-menu-${goalId}`) {
            menu.classList.add('hidden');
        }
    });
    const menu = document.getElementById(`goal-menu-${goalId}`);
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

function openAddFundsModal(goalId) {
    const form = document.getElementById('add-funds-form');
    form.reset();
    form.dataset.goalId = goalId;
    document.getElementById('funds-error-message').classList.add('hidden');
    toggleModal('add-funds-modal', true);
}

async function handleAddFundsFormSubmit(event) {
    event.preventDefault();
    const goalId = event.target.dataset.goalId;
    const amount = parseFloat(document.getElementById('funds-amount').value);

    try {
        const response = await fetch(`${API_URL}/api/groups/goals/${goalId}/add_funds`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: amount })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        toggleModal('add-funds-modal', false);
        loadDashboardData();
    } catch (error) {
        document.getElementById('funds-error-message').textContent = error.message;
        document.getElementById('funds-error-message').classList.remove('hidden');
    }
}

function openWithdrawFundsModal(goalId) {
    const form = document.getElementById('withdraw-funds-form');
    form.reset();
    form.dataset.goalId = goalId;
    document.getElementById('withdraw-error-message').classList.add('hidden');
    toggleModal('withdraw-funds-modal', true);
}

async function handleWithdrawFundsFormSubmit(event) {
    event.preventDefault();
    const goalId = event.target.dataset.goalId;
    const amount = parseFloat(document.getElementById('withdraw-amount').value);

    try {
        const response = await fetch(`${API_URL}/api/groups/goals/${goalId}/withdraw_funds`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: amount })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        toggleModal('withdraw-funds-modal', false);
        loadDashboardData();
    } catch (error) {
        document.getElementById('withdraw-error-message').textContent = error.message;
        document.getElementById('withdraw-error-message').classList.remove('hidden');
    }
}


// --- Lógica de Convites ---

async function handleInviteClick() {
    const groupId = localStorage.getItem('activeGroupId');
    const inviteLinkInput = document.getElementById('invite-link-input');
    const inviteError = document.getElementById('invite-error');
    inviteError.classList.add('hidden');

    try {
        const response = await fetch(`${API_URL}/api/groups/${groupId}/invites`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        const fullLink = `${window.location.origin}/pages/auth/accept_invite.html?token=${data.invite_link.split('token=')[1]}`;
        inviteLinkInput.value = fullLink;
        toggleModal('invite-modal', true);
    } catch (error) {
        inviteError.textContent = error.message;
        inviteError.classList.remove('hidden');
        toggleModal('invite-modal', true);
    }
}

function copyInviteLink() {
    const inviteLinkInput = document.getElementById('invite-link-input');
    navigator.clipboard.writeText(inviteLinkInput.value).then(() => {
        showCustomAlert('Copiado!', 'O link de convite foi copiado para a área de transferência.');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        showCustomAlert('Erro', 'Não foi possível copiar o link.');
    });
}


// --- Lógica de IA e Reconhecimento de Voz ---

async function handleAiTextAnalysis() {
    const text = document.getElementById('ai-textarea').value;
    if (text.trim().length < 3) {
        showCustomAlert('Atenção', 'Por favor, digite uma descrição mais longa para a análise.');
        return;
    }

    const analyzeButton = document.getElementById('analyze-ai-button');
    analyzeButton.disabled = true;
    analyzeButton.textContent = 'Analisando...';

    try {
        const response = await fetch(`${API_URL}/api/ai/parse-transaction`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        renderAiResults(data.transactions);
        toggleModal('ai-results-modal', true);
    } catch (error) {
        showCustomAlert('Erro de IA', error.message);
    } finally {
        analyzeButton.disabled = false;
        analyzeButton.textContent = 'Analisar';
    }
}

function renderAiResults(transactions) {
    const container = document.getElementById('ai-results-container');
    container.innerHTML = '';
    if (transactions.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center">Nenhuma transação encontrada no texto.</p>';
        return;
    }
    transactions.forEach((tx, index) => {
        const txCard = document.createElement('div');
        txCard.className = 'bg-background p-3 rounded-lg grid grid-cols-3 gap-3 items-center';
        txCard.innerHTML = `
            <div>
                <label class="text-xs text-gray-400">Tipo</label>
                <select data-index="${index}" class="ai-result-type w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700 text-sm">
                    <option value="gasto" ${tx.tipo === 'gasto' ? 'selected' : ''}>Gasto</option>
                    <option value="ganho" ${tx.tipo === 'ganho' ? 'selected' : ''}>Ganho</option>
                    <option value="investimento" ${tx.tipo === 'investimento' ? 'selected' : ''}>Investimento</option>
                </select>
            </div>
            <div>
                <label class="text-xs text-gray-400">Descrição</label>
                <input type="text" data-index="${index}" class="ai-result-desc w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700 text-sm" value="${tx.descricao}">
            </div>
            <div>
                <label class="text-xs text-gray-400">Valor (R$)</label>
                <input type="number" data-index="${index}" class="ai-result-val w-full mt-1 p-1 rounded bg-gray-800 border border-gray-700 text-sm" value="${tx.valor.toFixed(2)}">
            </div>
        `;
        container.appendChild(txCard);
    });
}

async function handleSaveAiResults() {
    const groupId = localStorage.getItem('activeGroupId');
    const resultCards = document.querySelectorAll('#ai-results-container > div');
    const transactionsToSave = [];

    resultCards.forEach((card, index) => {
        transactionsToSave.push({
            tipo: card.querySelector(`.ai-result-type[data-index="${index}"]`).value,
            descricao: card.querySelector(`.ai-result-desc[data-index="${index}"]`).value,
            valor: parseFloat(card.querySelector(`.ai-result-val[data-index="${index}"]`).value),
            data_transacao: new Date().toISOString().split('T')[0],
            responsavel_id: currentUserId
        });
    });

    try {
        for (const tx of transactionsToSave) {
            const response = await fetch(`${API_URL}/api/transactions/group/${groupId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(tx)
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Erro ao salvar uma das transações.');
            }
        }
        toggleModal('ai-results-modal', false);
        loadDashboardData();
    } catch (error) {
        document.getElementById('ai-error-message').textContent = error.message;
        document.getElementById('ai-error-message').classList.remove('hidden');
    }
}

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const speechResult = event.results[0][0].transcript;
            document.getElementById('ai-textarea').value = speechResult;
            handleAiTextAnalysis();
        };

        recognition.onspeechend = () => {
            recognition.stop();
            isRecording = false;
            document.getElementById('ai-record-button').classList.remove('bg-red-500');
        };

        recognition.onerror = (event) => {
            console.error('Erro no reconhecimento de voz:', event.error);
            isRecording = false;
            document.getElementById('ai-record-button').classList.remove('bg-red-500');
        };
    } else {
        console.warn('Reconhecimento de voz não é suportado neste navegador.');
        document.getElementById('ai-record-button').style.display = 'none';
    }
}

function toggleRecording() {
    if (!recognition) return;
    const recordButton = document.getElementById('ai-record-button');
    if (isRecording) {
        recognition.stop();
        isRecording = false;
        recordButton.classList.remove('bg-red-500');
    } else {
        recognition.start();
        isRecording = true;
        recordButton.classList.add('bg-red-500');
    }
}


// --- Lógica Premium: Histórico Completo e Lembretes ---

function openFullHistoryModal() {
    toggleModal('full-history-modal', true);
    fetchFullHistory();
}

async function fetchFullHistory() {
    const groupId = localStorage.getItem('activeGroupId');
    const tableBody = document.getElementById('full-history-table-body');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Carregando histórico...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/api/transactions/group/${groupId}/full_history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Não foi possível carregar o histórico.');
        fullTransactionHistory = await response.json();
        filteredTransactionHistory = [...fullTransactionHistory];
        renderFullHistoryTable(fullTransactionHistory);
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-red-400">${error.message}</td></tr>`;
    }
}

function renderFullHistoryTable(transactions) {
    const tableBody = document.getElementById('full-history-table-body');
    tableBody.innerHTML = '';
    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500">Nenhuma transação encontrada.</td></tr>';
        return;
    }
    transactions.forEach(tx => {
        const row = document.createElement('tr');
        const valorClass = tx.tipo === 'ganho' ? 'text-gain' : tx.tipo === 'gasto' ? 'text-expense' : 'text-investment';
        row.innerHTML = `
            <td class="p-2">${tx.descricao}</td>
            <td class="p-2 font-medium ${valorClass}">${formatCurrency(tx.valor)}</td>
            <td class="p-2 text-gray-400">${tx.responsavel_nome}</td>
            <td class="p-2 text-gray-400">${new Date(tx.data_transacao).toLocaleString('pt-BR')}</td>
        `;
        tableBody.appendChild(row);
    });
}

function applyHistoryFilters() {
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    const type = document.getElementById('filter-type').value;

    filteredTransactionHistory = fullTransactionHistory.filter(tx => {
        const txDate = new Date(tx.data_transacao).toISOString().split('T')[0];
        const startMatch = !startDate || txDate >= startDate;
        const endMatch = !endDate || txDate <= endDate;
        const typeMatch = !type || tx.tipo === type;
        return startMatch && endMatch && typeMatch;
    });
    renderFullHistoryTable(filteredTransactionHistory);
}

function exportToCSV() {
    const headers = ['Data', 'Descricao', 'Tipo', 'Valor', 'Responsavel'];
    const rows = filteredTransactionHistory.map(tx => [
        new Date(tx.data_transacao).toLocaleString('pt-BR'),
        `"${tx.descricao.replace(/"/g, '""')}"`,
        tx.tipo,
        Number(tx.valor).toFixed(2),
        tx.responsavel_nome
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
        + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "historico_clarify.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.autoTable({
        head: [['Data', 'Descricao', 'Tipo', 'Valor', 'Responsavel']],
        body: filteredTransactionHistory.map(tx => [
            new Date(tx.data_transacao).toLocaleString('pt-BR'),
            tx.descricao,
            tx.tipo,
            formatCurrency(tx.valor),
            tx.responsavel_nome
        ]),
    });

    doc.save('historico_clarify.pdf');
}

async function fetchPaymentReminders(groupId) {
    const container = document.getElementById('payment-reminders-container');
    if (!container) return;
    try {
        const response = await fetch(`${API_URL}/api/pagamentos/grupo/${groupId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Não foi possível carregar lembretes.');
        const reminders = await response.json();
        allPaymentReminders = reminders; 
        renderPaymentReminders(reminders);
    } catch (error) {
        container.innerHTML = `<p class="text-xs text-red-400">${error.message}</p>`;
    }
}

function renderPaymentReminders(reminders) {
    const container = document.getElementById('payment-reminders-container');
    const viewAllContainer = document.getElementById('view-all-reminders-container');
    container.innerHTML = '';

    const upcomingReminders = reminders
        .filter(r => r.status !== 'pago')
        .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));

    if (upcomingReminders.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-sm">Nenhum pagamento pendente. Tudo em dia!</p>';
        viewAllContainer.classList.add('hidden');
        return;
    }

    const remindersToShow = upcomingReminders.slice(0, 3);
    remindersToShow.forEach(r => container.appendChild(createReminderElement(r)));

    if (upcomingReminders.length > 3) {
        viewAllContainer.classList.remove('hidden');
    } else {
        viewAllContainer.classList.add('hidden');
    }
}

function createReminderElement(reminder, isModal = false) {
    const isPaid = reminder.status === 'pago';
    const isOverdue = new Date(reminder.data_vencimento) < new Date() && !isPaid;
    
    const reminderEl = document.createElement('div');
    reminderEl.className = `flex items-center justify-between p-3 rounded-lg ${isPaid ? 'bg-green-900/20' : 'bg-background'}`;
    
    let actionsHtml = `
        <div class="flex items-center space-x-2">
            <button onclick="openPaymentReminderModal('${reminder.id}')" class="text-gray-400 hover:text-primary p-1" title="Editar"><i class="fas fa-pencil-alt text-xs"></i></button>
            <button onclick="handleDeletePaymentReminder('${reminder.id}')" class="text-gray-400 hover:text-danger p-1" title="Apagar"><i class="fas fa-times text-xs"></i></button>
        </div>
    `;

    reminderEl.innerHTML = `
        <div class="flex items-center space-x-4">
            <button onclick="handleMarkAsPaid('${reminder.id}', ${isPaid})" class="w-6 h-6 flex-shrink-0 rounded-md border ${isPaid ? 'bg-primary border-primary' : 'border-gray-500'} flex items-center justify-center transition-colors" title="Marcar como pago">
                ${isPaid ? '<i class="fas fa-check text-sm"></i>' : ''}
            </button>
            <div>
                <p class="font-medium ${isPaid ? 'line-through text-gray-500' : ''}">${reminder.titulo}</p>
                <p class="text-xs ${isPaid ? 'text-gray-600' : isOverdue ? 'text-red-400 font-semibold' : 'text-gray-400'}">
                    Vence em ${new Date(reminder.data_vencimento + 'T00:00:00-03:00').toLocaleDateString('pt-BR')}
                    ${reminder.valor ? ` - ${formatCurrency(reminder.valor)}` : ''}
                </p>
            </div>
        </div>
        ${actionsHtml}
    `;
    return reminderEl;
}

function openAllRemindersModal() {
    const listContainer = document.getElementById('all-reminders-list');
    listContainer.innerHTML = '';
    
    const sortedReminders = [...allPaymentReminders].sort((a, b) => {
        if (a.status === b.status) {
            return new Date(a.data_vencimento) - new Date(b.data_vencimento);
        }
        return a.status === 'pago' ? 1 : -1;
    });

    if (sortedReminders.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-500">Nenhum lembrete encontrado.</p>';
    } else {
        sortedReminders.forEach(r => listContainer.appendChild(createReminderElement(r, true)));
    }
    toggleModal('all-reminders-modal', true);
}

function openPaymentReminderModal(reminderId = null) {
    const form = document.getElementById('payment-reminder-form');
    form.reset();
    document.getElementById('payment-reminder-id').value = '';
    document.getElementById('payment-reminder-error-message').classList.add('hidden');
    const title = document.getElementById('payment-reminder-form-title');

    if (reminderId) {
        title.textContent = 'Editar Lembrete';
        const reminder = allPaymentReminders.find(r => r.id === reminderId);
        if (reminder) {
            document.getElementById('payment-reminder-id').value = reminder.id;
            document.getElementById('payment-reminder-title').value = reminder.titulo;
            document.getElementById('payment-reminder-value').value = reminder.valor;
            document.getElementById('payment-reminder-due-date').value = reminder.data_vencimento;
            document.getElementById('payment-reminder-description').value = reminder.descricao;
        }
    } else {
        title.textContent = 'Novo Lembrete de Pagamento';
    }
    toggleModal('payment-reminder-modal', true);
}

async function handlePaymentReminderFormSubmit(event) {
    event.preventDefault();
    const groupId = localStorage.getItem('activeGroupId');
    const reminderId = document.getElementById('payment-reminder-id').value;

    const reminderData = {
        titulo: document.getElementById('payment-reminder-title').value,
        valor: parseFloat(document.getElementById('payment-reminder-value').value) || null,
        data_vencimento: document.getElementById('payment-reminder-due-date').value,
        descricao: document.getElementById('payment-reminder-description').value,
    };

    const method = reminderId ? 'PUT' : 'POST';
    const url = reminderId 
        ? `${API_URL}/api/pagamentos/${reminderId}`
        : `${API_URL}/api/pagamentos/grupo/${groupId}`;
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(reminderData)
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail);
        }
        toggleModal('payment-reminder-modal', false);
        fetchPaymentReminders(groupId);
    } catch (error) {
        document.getElementById('payment-reminder-error-message').textContent = error.message;
        document.getElementById('payment-reminder-error-message').classList.remove('hidden');
    }
}

async function handleDeletePaymentReminder(reminderId) {
    const confirmed = await showCustomAlert('Confirmar Exclusão', 'Tem certeza que quer apagar este lembrete?', 'confirm');
    if (!confirmed) return;
    const groupId = localStorage.getItem('activeGroupId');
    try {
        await fetch(`${API_URL}/api/pagamentos/${reminderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchPaymentReminders(groupId);
    } catch (error) {
        showCustomAlert('Erro', 'Não foi possível apagar o lembrete.');
    }
}

async function handleMarkAsPaid(reminderId, isCurrentlyPaid) {
    if (isCurrentlyPaid) return;
    const groupId = localStorage.getItem('activeGroupId');
    try {
        await fetch(`${API_URL}/api/pagamentos/${reminderId}/marcar-pago`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchPaymentReminders(groupId);
    } catch (error) {
        showCustomAlert('Erro', 'Não foi possível marcar como pago.');
    }
}


// --- Funções de Logout e Utilitárias ---
function logout() {
    localStorage.clear();
    window.location.href = '../auth/login_page.html';
}

function formatCurrency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.toggle('hidden', !show);
    }
}

function showCustomAlert(title, message, type = 'alert') {
    return new Promise((resolve) => {
        const modal = document.getElementById('generic-modal');
        const modalTitle = document.getElementById('generic-modal-title');
        const modalText = document.getElementById('generic-modal-text');
        const modalButtons = document.getElementById('generic-modal-buttons');

        modalTitle.textContent = title;
        modalText.textContent = message;
        modalButtons.innerHTML = '';

        if (type === 'confirm') {
            const confirmButton = document.createElement('button');
            confirmButton.className = 'py-2 px-6 bg-primary hover:bg-primary-dark rounded-lg font-medium text-white';
            confirmButton.textContent = 'Confirmar';
            confirmButton.onclick = () => {
                toggleModal('generic-modal', false);
                resolve(true);
            };

            const cancelButton = document.createElement('button');
            cancelButton.className = 'py-2 px-4 text-gray-300 hover:text-white';
            cancelButton.textContent = 'Cancelar';
            cancelButton.onclick = () => {
                toggleModal('generic-modal', false);
                resolve(false);
            };

            modalButtons.appendChild(cancelButton);
            modalButtons.appendChild(confirmButton);
        } else {
            const okButton = document.createElement('button');
            okButton.className = 'py-2 px-6 bg-primary hover:bg-primary-dark rounded-lg font-medium text-white';
            okButton.textContent = 'OK';
            okButton.onclick = () => {
                toggleModal('generic-modal', false);
                resolve(true);
            };
            modalButtons.appendChild(okButton);
        }
        
        toggleModal('generic-modal', true);
    });
}

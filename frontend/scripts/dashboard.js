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
    'Bronze':   { emoji: '🥉', color: 'text-bronze' },
    'Prata':    { emoji: '🥈', color: 'text-silver' },
    'Ouro':     { emoji: '🥇', color: 'text-gold' },
    'Platina':  { emoji: '💎', color: 'text-platinum' },
    'Diamante': { emoji: '🏆', color: 'text-diamond' }
};

// --- Funções de Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    fetchDashboardData();
    setupEventListeners();
    adjustDashboardLinks();
    // Adiciona listener para o botão do WhatsApp com verificação de nulidade
    const whatsappButton = document.getElementById('whatsapp-integration-button');
    if (whatsappButton) { // Verifica se o botão existe antes de adicionar o listener
        whatsappButton.addEventListener('click', () => {
            window.location.href = '../dashs/integrando_whatsapp.html';
        });
    }
});

function setupEventListeners() {
    // Adiciona verificações de nulidade para todos os event listeners
    document.getElementById('menu-button')?.addEventListener('click', toggleMenu);
    document.getElementById('logout-button')?.addEventListener('click', logout);
    document.getElementById('add-transaction-button')?.addEventListener('click', () => openTransactionModal('add'));
    document.getElementById('transaction-form')?.addEventListener('submit', handleTransactionFormSubmit);
    document.getElementById('cancel-transaction-button')?.addEventListener('click', () => toggleModal('transaction-form-modal', false));
    document.getElementById('analyze-ai-button')?.addEventListener('click', handleAnalyzeAI);
    document.getElementById('save-ai-results-button')?.addEventListener('click', saveAIResults);
    document.getElementById('cancel-ai-results-button')?.addEventListener('click', () => toggleModal('ai-results-modal', false));
    document.getElementById('close-ai-results-modal')?.addEventListener('click', () => toggleModal('ai-results-modal', false));
    document.getElementById('add-goal-button')?.addEventListener('click', () => openGoalModal('add'));
    document.getElementById('goal-form')?.addEventListener('submit', handleGoalFormSubmit);
    document.getElementById('cancel-goal-button')?.addEventListener('click', () => toggleModal('goal-form-modal', false));
    document.getElementById('add-funds-form')?.addEventListener('submit', handleAddFundsSubmit);
    document.getElementById('cancel-funds-button')?.addEventListener('click', () => toggleModal('add-funds-modal', false));
    document.getElementById('withdraw-funds-form')?.addEventListener('submit', handleWithdrawFundsSubmit);
    document.getElementById('cancel-withdraw-button')?.addEventListener('click', () => toggleModal('withdraw-funds-modal', false));
    document.getElementById('invite-button')?.addEventListener('click', handleInviteClick);
    document.getElementById('close-invite-modal')?.addEventListener('click', () => toggleModal('invite-modal', false));
    document.getElementById('copy-invite-link-button')?.addEventListener('click', copyInviteLink);
    document.getElementById('full-history-button')?.addEventListener('click', openFullHistoryModal);
    document.getElementById('close-history-modal')?.addEventListener('click', () => toggleModal('full-history-modal', false));
    document.getElementById('apply-filters-button')?.addEventListener('click', fetchFullTransactionHistory);
    document.getElementById('export-csv-button')?.addEventListener('click', exportTransactionsToCSV);
    document.getElementById('export-pdf-button')?.addEventListener('click', exportTransactionsToPDF);
    document.getElementById('add-payment-reminder-button')?.addEventListener('click', () => openPaymentReminderModal('add'));
    document.getElementById('payment-reminder-form')?.addEventListener('submit', handlePaymentReminderFormSubmit);
    document.getElementById('cancel-payment-reminder-button')?.addEventListener('click', () => toggleModal('payment-reminder-modal', false));
    document.getElementById('view-all-reminders-button')?.addEventListener('click', openAllRemindersModal);
    document.getElementById('close-all-reminders-modal')?.addEventListener('click', () => toggleModal('all-reminders-modal', false));
    document.getElementById('ai-record-button')?.addEventListener('click', toggleSpeechRecognition);
}

function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userPlan');
    localStorage.removeItem('activeGroupId');
    window.location.href = '../auth/login_page.html';
}

function toggleMenu() {
    document.getElementById('menu-card').classList.toggle('hidden');
}

// --- Funções de Fetch de Dados ---

async function fetchDashboardData() {
    const groupId = localStorage.getItem('activeGroupId');
    if (!groupId) {
        showCustomAlert('Erro', 'ID do grupo não encontrado. Por favor, faça login novamente.');
        logout();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/groups/${groupId}/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error('Não foi possível carregar os dados do dashboard.');
        }

        const data = await response.json();
        currentUserId = data.current_user_id; // Armazena o ID do usuário logado
        localStorage.setItem('userPlan', data.plano); // Garante que o plano esteja atualizado no localStorage

        renderDashboard(data);
        fetchMonthlyChartData();
        fetchRecentAchievements(data.conquistas_recentes);
        fetchPaymentReminders(); // Busca lembretes de pagamento
    } catch (error) {
        showCustomAlert('Erro', error.message);
    }
}

async function fetchMonthlyChartData() {
    const groupId = localStorage.getItem('activeGroupId');
    try {
        const response = await fetch(`${API_URL}/api/groups/${groupId}/chart_data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Não foi possível carregar os dados do gráfico.');
        }
        const data = await response.json();
        renderMonthlyChart(data);
    } catch (error) {
        showCustomAlert('Erro', error.message);
    }
}

async function fetchRecentAchievements(achievements) {
    const container = document.getElementById('achievements-list-container');
    if (!container) return; // Adiciona verificação de nulidade
    container.innerHTML = ''; // Limpa antes de adicionar

    if (achievements.length === 0) {
        container.innerHTML = '<p class="text-gray-400">Nenhuma conquista recente. Continue usando o Clarify!</p>';
        return;
    }

    achievements.forEach(achievement => {
        const info = medalInfo[achievement.tipo_medalha] || { emoji: '⭐', color: 'text-white' };
        const achievementElement = document.createElement('div');
        achievementElement.className = 'flex items-center bg-background p-3 rounded-lg';
        achievementElement.innerHTML = `
            <span class="text-3xl mr-3">${info.emoji}</span>
            <div>
                <p class="font-medium ${info.color}">${achievement.tipo_medalha}</p>
                <p class="text-xs text-gray-400">${achievement.descricao}</p>
            </div>
        `;
        container.appendChild(achievementElement);
    });
}

async function fetchPaymentReminders() {
    const groupId = localStorage.getItem('activeGroupId');
    const container = document.getElementById('payment-reminders-container');
    if (!container) return; // Adiciona verificação de nulidade
    container.innerHTML = '<p class="text-center text-gray-400">Carregando lembretes...</p>';

    try {
        const response = await fetch(`${API_URL}/api/pagamentos/grupo/${groupId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Não foi possível carregar os lembretes de pagamento.');
        }
        allPaymentReminders = await response.json();
        renderPaymentReminders(allPaymentReminders);
    } catch (error) {
        container.innerHTML = `<p class="text-red-400">${error.message}</p>`;
    }
}

async function fetchFullTransactionHistory(applyFilters = false) {
    const groupId = localStorage.getItem('activeGroupId');
    const tableBody = document.getElementById('full-history-table-body');
    if (!tableBody) return; // Adiciona verificação de nulidade
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Carregando histórico...</td></tr>';

    const startDateEl = document.getElementById('filter-start-date');
    const endDateEl = document.getElementById('filter-end-date');
    const typeEl = document.getElementById('filter-type');

    // Adiciona verificações de nulidade para os elementos de filtro
    const startDate = startDateEl ? startDateEl.value : '';
    const endDate = endDateEl ? endDateEl.value : '';
    const type = typeEl ? typeEl.value : '';


    let queryParams = new URLSearchParams();
    if (startDate) queryParams.append('start_date', startDate);
    if (endDate) queryParams.append('end_date', endDate);
    if (type) queryParams.append('type', type);

    try {
        const response = await fetch(`${API_URL}/api/transactions/group/${groupId}/full_history?${queryParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Não foi possível carregar o histórico completo de transações.');
        }
        fullTransactionHistory = await response.json();
        filteredTransactionHistory = fullTransactionHistory; // Inicialmente, todos são filtrados
        renderFullTransactionHistory(fullTransactionHistory);
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-red-400">${error.message}</td></tr>`;
    }
}

// --- Funções de Renderização ---

function renderDashboard(data) {
    // Adiciona verificações de nulidade para elementos do dashboard
    document.getElementById('user-name').textContent = `Olá, ${data.nome_utilizador.split(' ')[0]}!`;
    const groupNameEl = document.getElementById('group-name');
    if (groupNameEl) groupNameEl.textContent = `Meu Grupo (${data.membros.length}/${data.plano === 'premium' ? 4 : 2})`;
    
    const totalInvestidoEl = document.getElementById('total-investido');
    if (totalInvestidoEl) totalInvestidoEl.textContent = formatCurrency(data.total_investido);
    
    const saldoTotalEl = document.getElementById('saldo-total');
    if (saldoTotalEl) saldoTotalEl.textContent = formatCurrency(data.saldo_total);

    // Lógica do mascote
    const mascotImg = document.getElementById('mascote-img');
    const mascotTitle = document.getElementById('mascote-title');
    const mascotText = document.getElementById('mascote-text');

    if (mascotImg && mascotTitle && mascotText) { // Verifica se os elementos do mascote existem
        if (data.saldo_total > 0) {
            mascotImg.src = '../../assets/mascote_feliz.png';
            mascotTitle.textContent = 'Situação Financeira: Excelente!';
            mascotText.textContent = 'Vocês estão no caminho certo! Continuem assim para bater todas as metas.';
        } else if (data.saldo_total < 0) {
            mascotImg.src = '../../assets/mascote_triste.png';
            mascotTitle.textContent = 'Situação Financeira: Atenção!';
            mascotText.textContent = 'Seu saldo está negativo. Que tal revisar os gastos ou buscar novas fontes de renda?';
        } else {
            mascotImg.src = '../../assets/mascote_neutro.png';
            mascotTitle.textContent = 'Situação Financeira: Estável';
            mascotText.textContent = 'Ótimo trabalho! Seus gastos estão controlados.';
        }
    }

    renderRecentTransactions(data.movimentacoes_recentes);
    renderGroupMembers(data.membros, data.plano);
    renderGoals(data.meta_ativa);
    renderAIAssistantSection(data.plano, data.ai_usage_count_today, data.ai_first_usage_timestamp_today);
}

function renderMonthlyChart(chartData) {
    const ctx = document.getElementById('monthly-chart')?.getContext('2d');
    if (!ctx) return; // Adiciona verificação de nulidade

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    const labels = chartData.map(d => d.mes);
    const ganhos = chartData.map(d => d.ganhos);
    const gastos = chartData.map(d => d.gastos);
    // INÍCIO DA ALTERAÇÃO: Corrige o nome da propriedade para 'investimentos'
    const investimentos = chartData.map(d => d.investimentos); 
    // FIM DA ALTERAÇÃO
    const saldo = chartData.map(d => d.saldo);

    monthlyChart = new Chart(ctx, {
        type: 'bar', // Pode ser 'line', 'bar', etc.
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ganhos',
                    data: ganhos,
                    backgroundColor: 'rgba(34, 197, 94, 0.6)', // gain
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Gastos',
                    data: gastos,
                    backgroundColor: 'rgba(239, 68, 68, 0.6)', // expense
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Investimentos',
                    data: investimentos, // Usa a variável corrigida
                    backgroundColor: 'rgba(56, 189, 248, 0.6)', // investment
                    borderColor: 'rgba(56, 189, 248, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Saldo',
                    data: saldo,
                    type: 'line', // Saldo como linha para destaque
                    borderColor: 'rgba(59, 130, 246, 1)', // primary
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { return 'R$ ' + value.toFixed(2).replace('.', ','); },
                        color: '#9ca3af'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#9ca3af'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#d1d5db'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += 'R$ ' + context.parsed.y.toFixed(2).replace('.', ',');
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderRecentTransactions(transactions) {
    const tableBody = document.getElementById('transactions-table-body');
    if (!tableBody) return; // Adiciona verificação de nulidade
    tableBody.innerHTML = '';
    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-400">Nenhuma transação recente.</td></tr>';
        return;
    }

    transactions.forEach(tx => {
        const row = document.createElement('tr');
        const valueClass = tx.tipo === 'gasto' ? 'text-expense' : (tx.tipo === 'ganho' ? 'text-gain' : 'text-investment');
        const formattedDate = new Date(tx.data_transacao).toLocaleDateString('pt-BR');
        row.innerHTML = `
            <td class="py-2 px-2">${tx.descricao}</td>
            <td class="py-2 px-2 ${valueClass}">${formatCurrency(tx.valor)}</td>
            <td class="py-2 px-2">${tx.responsavel_nome}</td>
            <td class="py-2 px-2 text-gray-400 text-sm">${formattedDate}</td>
            <td class="py-2 px-2 text-center">
                <button onclick="openTransactionModal('edit', '${tx.id}')" class="text-primary-light hover:text-primary text-lg mx-1" title="Editar"><i class="fas fa-edit"></i></button>
                <button onclick="deleteTransaction('${tx.id}')" class="text-expense hover:opacity-80 text-lg mx-1" title="Apagar"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderGroupMembers(members, plan) {
    const membersListEl = document.getElementById('members-list');
    const groupNameEl = document.getElementById('group-name');
    const inviteButton = document.getElementById('invite-button');
    const upgradeCard = document.getElementById('upgrade-card');

    if (!membersListEl || !groupNameEl || !inviteButton || !upgradeCard) return; // Adiciona verificação de nulidade

    membersListEl.innerHTML = ''; // Limpa antes de renderizar
    const memberLimit = plan === 'premium' ? 4 : 2;

    // INÍCIO DA ALTERAÇÃO: Adiciona console.log para depuração e garante que o contêiner não esteja oculto
    console.log("Membros recebidos para renderização:", members);
    membersListEl.classList.remove('hidden'); // Garante que o contêiner não esteja oculto
    // FIM DA ALTERAÇÃO

    if (members.length === 0) {
        membersListEl.innerHTML = '<p class="text-center text-gray-400">Nenhum membro no grupo. Convide alguém!</p>';
    } else {
        members.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'flex items-center bg-background p-3 rounded-lg';
            memberDiv.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center font-bold text-black mr-3">${member.nome.charAt(0)}</div>
                <div>
                    <p class="font-medium">${member.nome}</p>
                    <p class="text-xs text-gray-400">${member.papel === 'dono' ? 'Dono' : 'Membro'}</p>
                </div>
            `;
            membersListEl.appendChild(memberDiv);
        });
    }

    groupNameEl.textContent = `Meu Grupo (${members.length}/${memberLimit})`;

    if (members.length >= memberLimit) {
        inviteButton.classList.add('hidden');
        if (plan === 'gratuito') {
            upgradeCard.classList.remove('hidden');
        } else {
            upgradeCard.classList.add('hidden'); // Esconde o card de upgrade se já for premium
        }
    } else {
        inviteButton.classList.remove('hidden');
        upgradeCard.classList.add('hidden');
    }
}

function renderGoals(activeGoal) {
    const goalsListContainer = document.getElementById('goals-list-container');
    const addGoalButtonContainer = document.getElementById('add-goal-button-container');
    const addGoalButton = document.getElementById('add-goal-button'); // Adiciona referência ao botão
    const userPlan = localStorage.getItem('userPlan');

    if (!goalsListContainer || !addGoalButtonContainer || !addGoalButton) return; // Adiciona verificação de nulidade

    goalsListContainer.innerHTML = ''; // Limpa antes de renderizar

    if (activeGoal) {
        const progress = (activeGoal.valor_atual / activeGoal.valor_meta) * 100;
        const formattedCurrent = formatCurrency(activeGoal.valor_atual);
        const formattedMeta = formatCurrency(activeGoal.valor_meta);
        const remaining = activeGoal.valor_meta - activeGoal.valor_atual;
        const formattedRemaining = formatCurrency(remaining > 0 ? remaining : 0);
        const dueDate = activeGoal.data_limite ? new Date(activeGoal.data_limite).toLocaleDateString('pt-BR') : 'Sem data limite';

        goalsListContainer.innerHTML = `
            <div class="bg-background p-4 rounded-lg">
                <h4 class="font-bold text-lg">${activeGoal.titulo}</h4>
                <p class="text-sm text-gray-400">Meta: ${formattedMeta} até ${dueDate}</p>
                <div class="w-full bg-gray-700 rounded-full h-2.5 mt-3">
                    <div class="bg-primary h-2.5 rounded-full" style="width: ${progress > 100 ? 100 : progress}%;"></div>
                </div>
                <div class="flex justify-between text-sm mt-2">
                    <span class="font-medium">${formattedCurrent}</span>
                    <span class="text-gray-400">${progress.toFixed(1)}%</span>
                </div>
                <p class="text-sm text-gray-400 mt-1">Faltam: <span class="font-medium text-primary">${formattedRemaining}</span></p>
                <div class="flex space-x-2 mt-4">
                    <button onclick="openAddFundsModal('${activeGoal.id}')" class="flex-1 py-2 bg-gain hover:opacity-80 rounded-lg font-medium text-white">Adicionar Fundos</button>
                    <button onclick="openWithdrawFundsModal('${activeGoal.id}')" class="flex-1 py-2 bg-expense hover:opacity-80 rounded-lg font-medium text-white">Retirar Fundos</button>
                    <button onclick="deleteGoal('${activeGoal.id}')" class="p-2 bg-danger hover:opacity-80 rounded-lg text-white" title="Apagar Meta"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
        addGoalButtonContainer.classList.add('hidden'); // Esconde o botão se já houver uma meta ativa
    } else {
        goalsListContainer.innerHTML = '<p class="text-center text-gray-400">Nenhuma meta ativa no momento.</p>';
        // Mostra o botão de adicionar meta
        addGoalButtonContainer.classList.remove('hidden');
        // Se for plano gratuito, desabilita o botão e mostra mensagem
        if (userPlan === 'gratuito') {
            addGoalButton.disabled = true;
            addGoalButton.textContent = 'Adicionar Nova Meta (Premium)';
            addGoalButton.classList.remove('bg-primary/80', 'hover:bg-primary');
            addGoalButton.classList.add('bg-gray-600', 'cursor-not-allowed');
            // Opcional: Adicionar uma mensagem extra ou link para premium
        } else {
            addGoalButton.disabled = false;
            addGoalButton.textContent = 'Adicionar Nova Meta';
            addGoalButton.classList.add('bg-primary/80', 'hover:bg-primary');
            addGoalButton.classList.remove('bg-gray-600', 'cursor-not-allowed');
        }
    }
}

function renderPaymentReminders(reminders) {
    const container = document.getElementById('payment-reminders-container');
    const viewAllRemindersContainer = document.getElementById('view-all-reminders-container');
    if (!container) return; // Adiciona verificação de nulidade
    container.innerHTML = '';

    if (reminders.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">Nenhum lembrete de pagamento agendado.</p>';
        if (viewAllRemindersContainer) viewAllRemindersContainer.classList.add('hidden'); // Adiciona verificação de nulidade
        return;
    }

    // Exibe apenas os 3 primeiros lembretes na dashboard principal
    const remindersToShow = reminders.slice(0, 3);

    remindersToShow.forEach(reminder => {
        const reminderElement = document.createElement('div');
        const dueDate = new Date(reminder.data_vencimento).toLocaleDateString('pt-BR');
        const isOverdue = new Date(reminder.data_vencimento) < new Date() && reminder.status !== 'pago';
        const statusClass = reminder.status === 'pago' ? 'text-gain' : (isOverdue ? 'text-expense' : 'text-primary');
        const statusText = reminder.status === 'pago' ? 'Pago' : (isOverdue ? 'Atrasado' : 'Pendente');
        const valueDisplay = reminder.valor ? formatCurrency(reminder.valor) : 'Não especificado';

        reminderElement.className = `bg-background p-4 rounded-lg border ${isOverdue ? 'border-expense' : 'border-gray-700'}`;
        reminderElement.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-bold text-lg">${reminder.titulo}</h4>
                <span class="text-sm ${statusClass}">${statusText}</span>
            </div>
            <p class="text-sm text-gray-400">Vencimento: ${dueDate}</p>
            <p class="text-md font-semibold mt-1">Valor: ${valueDisplay}</p>
            ${reminder.descricao ? `<p class="text-sm text-gray-500 mt-2">${reminder.descricao}</p>` : ''}
            <div class="flex space-x-2 mt-4">
                <button onclick="openPaymentReminderModal('edit', '${reminder.id}')" class="flex-1 py-2 bg-primary/80 hover:bg-primary rounded-lg font-medium text-white">Editar</button>
                ${reminder.status !== 'pago' ? `<button onclick="markPaymentAsPaid('${reminder.id}')" class="flex-1 py-2 bg-gain hover:opacity-80 rounded-lg font-medium text-white">Marcar como Pago</button>` : ''}
                <button onclick="deletePaymentReminder('${reminder.id}')" class="p-2 bg-danger hover:opacity-80 rounded-lg text-white" title="Apagar Lembrete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        container.appendChild(reminderElement);
    });

    if (reminders.length > 3) {
        if (viewAllRemindersContainer) viewAllRemindersContainer.classList.remove('hidden'); // Adiciona verificação de nulidade
    } else {
        if (viewAllRemindersContainer) viewAllRemindersContainer.classList.add('hidden'); // Adiciona verificação de nulidade
    }
}

function renderAllPaymentReminders(reminders) {
    const container = document.getElementById('all-reminders-list');
    if (!container) return; // Adiciona verificação de nulidade
    container.innerHTML = ''; // Limpa antes de adicionar

    if (reminders.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 p-4">Nenhum lembrete de pagamento agendado.</p>';
        return;
    }

    reminders.forEach(reminder => {
        const reminderElement = document.createElement('div');
        const dueDate = new Date(reminder.data_vencimento).toLocaleDateString('pt-BR');
        const isOverdue = new Date(reminder.data_vencimento) < new Date() && reminder.status !== 'pago';
        const statusClass = reminder.status === 'pago' ? 'text-gain' : (isOverdue ? 'text-expense' : 'text-primary');
        const statusText = reminder.status === 'pago' ? 'Pago' : (isOverdue ? 'Atrasado' : 'Pendente');
        const valueDisplay = reminder.valor ? formatCurrency(reminder.valor) : 'Não especificado';

        reminderElement.className = `bg-background p-4 rounded-lg border ${isOverdue ? 'border-expense' : 'border-gray-700'}`;
        reminderElement.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-bold text-lg">${reminder.titulo}</h4>
                <span class="text-sm ${statusClass}">${statusText}</span>
            </div>
            <p class="text-sm text-gray-400">Vencimento: ${dueDate}</p>
            <p class="text-md font-semibold mt-1">Valor: ${valueDisplay}</p>
            ${reminder.descricao ? `<p class="text-sm text-gray-500 mt-2">${reminder.descricao}</p>` : ''}
            <div class="flex space-x-2 mt-4">
                <button onclick="openPaymentReminderModal('edit', '${reminder.id}')" class="flex-1 py-2 bg-primary/80 hover:bg-primary rounded-lg font-medium text-white">Editar</button>
                ${reminder.status !== 'pago' ? `<button onclick="markPaymentAsPaid('${reminder.id}')" class="flex-1 py-2 bg-gain hover:opacity-80 rounded-lg font-medium text-white">Marcar como Pago</button>` : ''}
                <button onclick="deletePaymentReminder('${reminder.id}')" class="p-2 bg-danger hover:opacity-80 rounded-lg text-white" title="Apagar Lembrete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        container.appendChild(reminderElement);
    });
}


function renderFullTransactionHistory(transactions) {
    const tableBody = document.getElementById('full-history-table-body');
    if (!tableBody) return; // Adiciona verificação de nulidade
    tableBody.innerHTML = '';
    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-400">Nenhuma transação encontrada para os filtros aplicados.</td></tr>';
        return;
    }

    transactions.forEach(tx => {
        const row = document.createElement('tr');
        const valueClass = tx.tipo === 'gasto' ? 'text-expense' : (tx.tipo === 'ganho' ? 'text-gain' : 'text-investment');
        const formattedDate = new Date(tx.data_transacao).toLocaleDateString('pt-BR');
        row.innerHTML = `
            <td class="py-2 px-2">${tx.descricao}</td>
            <td class="py-2 px-2 ${valueClass}">${formatCurrency(tx.valor)}</td>
            <td class="py-2 px-2">${tx.responsavel_nome}</td>
            <td class="py-2 px-2 text-gray-400 text-sm">${formattedDate}</td>
        `;
        tableBody.appendChild(row);
    });
}

function renderAIAssistantSection(plan, usageCount, firstUsageTimestamp) {
    const aiUsageStatus = document.getElementById('ai-usage-status');
    const aiTextarea = document.getElementById('ai-textarea');
    const analyzeAiButton = document.getElementById('analyze-ai-button');
    const aiRecordButton = document.getElementById('ai-record-button');
    const whatsappIntegrationButton = document.getElementById('whatsapp-integration-button'); // Get the WhatsApp button

    // Adiciona verificações de nulidade para os elementos da seção AI
    if (!aiUsageStatus || !aiTextarea || !analyzeAiButton || !aiRecordButton || !whatsappIntegrationButton) {
        return; 
    }


    if (plan === 'gratuito') {
        const remainingUses = 2 - usageCount;
        if (remainingUses <= 0) {
            aiUsageStatus.className = 'text-sm text-center bg-red-500/20 text-red-300 p-2 rounded-md mb-4';
            let resetTimeMessage = '';
            if (firstUsageTimestamp) {
                const firstUseDate = new Date(firstUsageTimestamp);
                const resetDate = new Date(firstUseDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours after first use
                resetTimeMessage = ` (Redefine em ${resetDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`;
            }
            aiUsageStatus.textContent = `Limite de uso da IA atingido (${usageCount}/2). Faça upgrade para uso ilimitado!${resetTimeMessage}`;
            aiTextarea.disabled = true;
            analyzeAiButton.disabled = true;
            aiRecordButton.disabled = true;
            whatsappIntegrationButton.disabled = true; // Disable WhatsApp button too
        } else {
            aiUsageStatus.className = 'text-sm text-center bg-blue-500/20 text-blue-300 p-2 rounded-md mb-4';
            aiUsageStatus.textContent = `Usos de IA hoje: ${usageCount}/2. Restam ${remainingUses} usos.`;
            aiTextarea.disabled = false;
            analyzeAiButton.disabled = false;
            aiRecordButton.disabled = false;
            whatsappIntegrationButton.disabled = false; // Enable WhatsApp button
        }
    } else { // Premium user
        aiUsageStatus.classList.add('hidden'); // Esconde o status de uso para premium
        aiTextarea.disabled = false;
        analyzeAiButton.disabled = false;
        aiRecordButton.disabled = false;
        whatsappIntegrationButton.disabled = false; // Enable WhatsApp button
    }
}


// --- Lógica de Modais e Formulários ---

let currentTransactionId = null;
let currentGoalId = null;
let currentPaymentReminderId = null;

function openTransactionModal(mode, transactionId = null) {
    const titleEl = document.getElementById('transaction-form-title');
    const submitButton = document.getElementById('transaction-form')?.querySelector('button[type="submit"]'); // Adiciona verificação de nulidade
    document.getElementById('transaction-error-message')?.classList.add('hidden'); // Limpa mensagens de erro

    if (!titleEl || !submitButton) return; // Adiciona verificação de nulidade

    if (mode === 'add') {
        titleEl.textContent = 'Adicionar Nova Transação';
        submitButton.textContent = 'Adicionar';
        document.getElementById('transaction-form')?.reset(); // Adiciona verificação de nulidade
        currentTransactionId = null;
    } else if (mode === 'edit') {
        titleEl.textContent = 'Editar Transação';
        submitButton.textContent = 'Salvar Alterações';
        currentTransactionId = transactionId;
        const tx = allTransactions.find(t => t.id === transactionId);
        if (tx) {
            document.getElementById('transaction-type').value = tx.tipo;
            document.getElementById('transaction-description').value = tx.descricao;
            document.getElementById('transaction-value').value = tx.valor;
            document.getElementById('transaction-date').value = tx.data_transacao.split('T')[0]; // Formato YYYY-MM-DD
        }
    }
    toggleModal('transaction-form-modal', true);
}

async function handleTransactionFormSubmit(event) {
    event.preventDefault();
    const type = document.getElementById('transaction-type')?.value; // Adiciona verificação de nulidade
    const description = document.getElementById('transaction-description')?.value; // Adiciona verificação de nulidade
    const value = parseFloat(document.getElementById('transaction-value')?.value); // Adiciona verificação de nulidade
    const date = document.getElementById('transaction-date')?.value; // Adiciona verificação de nulidade
    const groupId = localStorage.getItem('activeGroupId');

    if (!type || !description || isNaN(value) || value <= 0 || !date || !groupId) { // Adiciona validação básica
        document.getElementById('transaction-error-message').textContent = 'Por favor, preencha todos os campos corretamente.';
        document.getElementById('transaction-error-message').classList.remove('hidden');
        return;
    }


    const transactionData = {
        tipo: type,
        descricao: description,
        valor: value,
        data_transacao: date,
        responsavel_id: currentUserId // O usuário logado é o responsável
    };

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    document.getElementById('transaction-error-message')?.classList.add('hidden'); // Adiciona verificação de nulidade

    try {
        let response;
        if (currentTransactionId) {
            response = await fetch(`${API_URL}/api/transactions/${currentTransactionId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(transactionData)
            });
        } else {
            response = await fetch(`${API_URL}/api/transactions/group/${groupId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(transactionData)
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao salvar transação.');
        }

        toggleModal('transaction-form-modal', false);
        await showCustomAlert('Sucesso', 'Transação salva com sucesso!');
        fetchDashboardData(); // Recarrega os dados do dashboard
    } catch (error) {
        document.getElementById('transaction-error-message').textContent = error.message;
        document.getElementById('transaction-error-message').classList.remove('hidden');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = currentTransactionId ? 'Salvar Alterações' : 'Adicionar';
    }
}

async function deleteTransaction(transactionId) {
    const confirmed = await showCustomAlert('Confirmar Exclusão', 'Tem certeza que deseja apagar esta transação?', 'confirm');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/api/transactions/${transactionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Não foi possível apagar a transação.');
        }

        await showCustomAlert('Sucesso', 'Transação apagada com sucesso!');
        fetchDashboardData(); // Recarrega os dados do dashboard
    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}

async function handleAnalyzeAI() {
    const aiTextarea = document.getElementById('ai-textarea');
    const aiText = aiTextarea?.value.trim(); // Adiciona verificação de nulidade
    if (!aiTextarea || aiText.length < 3) { // Adiciona verificação de nulidade
        showCustomAlert('Atenção', 'Por favor, digite pelo menos 3 caracteres para a análise da IA.');
        return;
    }

    const analyzeButton = document.getElementById('analyze-ai-button');
    const originalButtonText = analyzeButton?.textContent; // Adiciona verificação de nulidade
    if (analyzeButton) { // Adiciona verificação de nulidade
        analyzeButton.disabled = true;
        analyzeButton.textContent = 'Analisando...';
    }


    try {
        const response = await fetch(`${API_URL}/api/ai/parse-transaction`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: aiText })
        });

        if (response.status === 429) { // Too Many Requests
            const errorData = await response.json();
            await showCustomAlert('Limite de Uso', errorData.detail);
            fetchDashboardData(); // Atualiza o status de uso da IA
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao analisar com IA.');
        }

        const data = await response.json();
        renderAIResults(data.transactions);
    } catch (error) {
        await showCustomAlert('Erro na IA', error.message);
    } finally {
        if (analyzeButton) { // Adiciona verificação de nulidade
            analyzeButton.disabled = false;
            analyzeButton.textContent = originalButtonText;
        }
    }
}

function renderAIResults(transactions) {
    const container = document.getElementById('ai-results-container');
    const saveButton = document.getElementById('save-ai-results-button');
    if (!container || !saveButton) return; // Adiciona verificação de nulidade
    container.innerHTML = '';
    document.getElementById('ai-error-message')?.classList.add('hidden'); // Adiciona verificação de nulidade

    if (transactions.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">Nenhuma transação detectada pela IA.</p>';
        saveButton.disabled = true;
        toggleModal('ai-results-modal', true);
        return;
    }

    saveButton.disabled = false;
    transactions.forEach((tx, index) => {
        const txDiv = document.createElement('div');
        txDiv.className = 'bg-background p-3 rounded-lg flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4';
        txDiv.innerHTML = `
            <input type="hidden" class="ai-tx-original-index" value="${index}">
            <div class="flex-1">
                <label class="block text-xs font-medium text-gray-400">Tipo</label>
                <select class="ai-tx-type mt-1 w-full px-2 py-1 rounded-md bg-gray-700 border border-gray-600 text-white text-sm">
                    <option value="gasto" ${tx.tipo === 'gasto' ? 'selected' : ''}>Gasto</option>
                    <option value="ganho" ${tx.tipo === 'ganho' ? 'selected' : ''}>Ganho</option>
                    <option value="investimento" ${tx.tipo === 'investimento' ? 'selected' : ''}>Investimento</option>
                </select>
            </div>
            <div class="flex-2">
                <label class="block text-xs font-medium text-gray-400">Descrição</label>
                <input type="text" class="ai-tx-description mt-1 w-full px-2 py-1 rounded-md bg-gray-700 border border-gray-600 text-white text-sm" value="${tx.descricao || ''}">
            </div>
            <div class="flex-1">
                <label class="block text-xs font-medium text-gray-400">Valor (R$)</label>
                <input type="number" step="0.01" class="ai-tx-value mt-1 w-full px-2 py-1 rounded-md bg-gray-700 border border-gray-600 text-white text-sm" value="${tx.valor}">
            </div>
            <div class="flex-1">
                <label class="block text-xs font-medium text-gray-400">Data</label>
                <input type="date" class="ai-tx-date mt-1 w-full px-2 py-1 rounded-md bg-gray-700 border border-gray-600 text-white text-sm" value="${new Date().toISOString().split('T')[0]}">
            </div>
        `;
        container.appendChild(txDiv);
    });

    toggleModal('ai-results-modal', true);
}

async function saveAIResults() {
    const transactionsToSave = [];
    const transactionElements = document.querySelectorAll('#ai-results-container > div');
    const groupId = localStorage.getItem('activeGroupId');
    const saveButton = document.getElementById('save-ai-results-button');
    if (!saveButton) return; // Adiciona verificação de nulidade
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando...';
    document.getElementById('ai-error-message')?.classList.add('hidden'); // Adiciona verificação de nulidade

    transactionElements.forEach(el => {
        const type = el.querySelector('.ai-tx-type')?.value; // Adiciona verificação de nulidade
        const description = el.querySelector('.ai-tx-description')?.value; // Adiciona verificação de nulidade
        const value = parseFloat(el.querySelector('.ai-tx-value')?.value); // Adiciona verificação de nulidade
        const date = el.querySelector('.ai-tx-date')?.value; // Adiciona verificação de nulidade

        if (type && description && !isNaN(value) && value > 0 && date) {
            transactionsToSave.push({
                tipo: type,
                descricao: description,
                valor: value,
                data_transacao: date,
                responsavel_id: currentUserId
            });
        }
    });

    if (transactionsToSave.length === 0) {
        document.getElementById('ai-error-message').textContent = 'Nenhuma transação válida para salvar.';
        document.getElementById('ai-error-message').classList.remove('hidden');
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar Transações';
        return;
    }

    try {
        // Envia cada transação individualmente
        for (const tx of transactionsToSave) {
            const response = await fetch(`${API_URL}/api/transactions/group/${groupId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(tx)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Erro ao salvar transação "${tx.descricao}": ${errorData.detail || response.statusText}`);
            }
        }
        toggleModal('ai-results-modal', false);
        await showCustomAlert('Sucesso', `${transactionsToSave.length} transação(ões) salva(s) com sucesso!`);
        fetchDashboardData(); // Recarrega os dados do dashboard
    } catch (error) {
        document.getElementById('ai-error-message').textContent = error.message;
        document.getElementById('ai-error-message').classList.remove('hidden');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar Transações';
    }
}

function openGoalModal(mode, goalId = null) {
    const titleEl = document.getElementById('goal-form-title');
    const submitButton = document.getElementById('goal-form')?.querySelector('button[type="submit"]'); // Adiciona verificação de nulidade
    document.getElementById('goal-error-message')?.classList.add('hidden'); // Adiciona verificação de nulidade

    if (!titleEl || !submitButton) return; // Adiciona verificação de nulidade

    if (mode === 'add') {
        titleEl.textContent = 'Adicionar Nova Meta';
        submitButton.textContent = 'Adicionar';
        document.getElementById('goal-form')?.reset(); // Adiciona verificação de nulidade
        currentGoalId = null;
    } else if (mode === 'edit') {
        titleEl.textContent = 'Editar Meta';
        submitButton.textContent = 'Salvar Alterações';
        currentGoalId = goalId;
        const goal = allGoals.find(g => g.id === goalId);
        if (goal) {
            document.getElementById('goal-title').value = goal.titulo;
            document.getElementById('goal-value').value = goal.valor_meta;
            document.getElementById('goal-date').value = goal.data_limite;
        }
    }
    toggleModal('goal-form-modal', true);
}

async function handleGoalFormSubmit(event) {
    event.preventDefault();
    const title = document.getElementById('goal-title')?.value; // Adiciona verificação de nulidade
    const value = parseFloat(document.getElementById('goal-value')?.value); // Adiciona verificação de nulidade
    const date = document.getElementById('goal-date')?.value; // Adiciona verificação de nulidade
    const groupId = localStorage.getItem('activeGroupId');

    if (!title || isNaN(value) || value <= 0 || !date || !groupId) { // Adiciona validação básica
        document.getElementById('goal-error-message').textContent = 'Por favor, preencha todos os campos corretamente.';
        document.getElementById('goal-error-message').classList.remove('hidden');
        return;
    }

    const goalData = {
        titulo: title,
        valor_meta: value,
        data_limite: date || null // Envia null se a data estiver vazia
    };

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    document.getElementById('goal-error-message')?.classList.add('hidden'); // Adiciona verificação de nulidade

    try {
        let response;
        if (currentGoalId) {
            response = await fetch(`${API_URL}/api/groups/goals/${currentGoalId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(goalData)
            });
        } else {
            response = await fetch(`${API_URL}/api/groups/${groupId}/goals`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(goalData)
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao salvar meta.');
        }

        toggleModal('goal-form-modal', false);
        await showCustomAlert('Sucesso', 'Meta salva com sucesso!');
        fetchDashboardData(); // Recarrega os dados do dashboard
    } catch (error) {
        document.getElementById('goal-error-message').textContent = error.message;
        document.getElementById('goal-error-message').classList.remove('hidden');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = currentGoalId ? 'Salvar Alterações' : 'Adicionar';
    }
}

async function deleteGoal(goalId) {
    const confirmed = await showCustomAlert('Confirmar Exclusão', 'Tem certeza que deseja apagar esta meta? Se houver fundos, eles serão perdidos!', 'confirm');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/api/groups/goals/${goalId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Não foi possível apagar a meta.');
        }

        await showCustomAlert('Sucesso', 'Meta apagada com sucesso!');
        fetchDashboardData(); // Recarrega os dados do dashboard
    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}

async function openAddFundsModal(goalId) {
    currentGoalId = goalId;
    document.getElementById('add-funds-form')?.reset(); // Adiciona verificação de nulidade
    document.getElementById('funds-error-message')?.classList.add('hidden'); // Adiciona verificação de nulidade
    toggleModal('add-funds-modal', true);
}

async function handleAddFundsSubmit(event) {
    event.preventDefault();
    const amount = parseFloat(document.getElementById('funds-amount')?.value); // Adiciona verificação de nulidade
    const errorMessageEl = document.getElementById('funds-error-message'); // Adiciona verificação de nulidade
    if (isNaN(amount) || amount <= 0) {
        if (errorMessageEl) { // Adiciona verificação de nulidade
            errorMessageEl.textContent = 'Por favor, insira um valor positivo.';
            errorMessageEl.classList.remove('hidden');
        }
        return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Adicionando...';
    if (errorMessageEl) errorMessageEl.classList.add('hidden'); // Adiciona verificação de nulidade

    try {
        const response = await fetch(`${API_URL}/api/groups/goals/${currentGoalId}/add_funds`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: amount })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Não foi possível adicionar fundos.');
        }

        toggleModal('add-funds-modal', false);
        await showCustomAlert('Sucesso', 'Fundos adicionados à meta!');
        fetchDashboardData();
    } catch (error) {
        if (errorMessageEl) { // Adiciona verificação de nulidade
            errorMessageEl.textContent = error.message;
            errorMessageEl.classList.remove('hidden');
        }
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Guardar Dinheiro';
    }
}

async function openWithdrawFundsModal(goalId) {
    currentGoalId = goalId;
    document.getElementById('withdraw-funds-form')?.reset(); // Adiciona verificação de nulidade
    document.getElementById('withdraw-error-message')?.classList.add('hidden'); // Adiciona verificação de nulidade
    toggleModal('withdraw-funds-modal', true);
}

async function handleWithdrawFundsSubmit(event) {
    event.preventDefault();
    const amount = parseFloat(document.getElementById('withdraw-amount')?.value); // Adiciona verificação de nulidade
    const errorMessageEl = document.getElementById('withdraw-error-message'); // Adiciona verificação de nulidade
    if (isNaN(amount) || amount <= 0) {
        if (errorMessageEl) { // Adiciona verificação de nulidade
            errorMessageEl.textContent = 'Por favor, insira um valor positivo.';
            errorMessageEl.classList.remove('hidden');
        }
        return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Retirando...';
    if (errorMessageEl) errorMessageEl.classList.add('hidden'); // Adiciona verificação de nulidade

    try {
        const response = await fetch(`${API_URL}/api/groups/goals/${currentGoalId}/withdraw_funds`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: amount })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Não foi possível retirar fundos.');
        }

        toggleModal('withdraw-funds-modal', false);
        await showCustomAlert('Sucesso', 'Fundos retirados da meta!');
        fetchDashboardData();
    } catch (error) {
        if (errorMessageEl) { // Adiciona verificação de nulidade
            errorMessageEl.textContent = error.message;
            errorMessageEl.classList.remove('hidden');
        }
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Confirmar Retirada';
    }
}

async function handleInviteClick() {
    const groupId = localStorage.getItem('activeGroupId');
    const inviteLinkInput = document.getElementById('invite-link-input');
    
    try {
        const response = await fetch(`${API_URL}/api/groups/${groupId}/invites`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        const fullLink = `${window.location.origin}${data.invite_link}`;
        if (inviteLinkInput) inviteLinkInput.value = fullLink; // Adiciona verificação de nulidade
        toggleModal('invite-modal', true);

    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}

async function copyInviteLink() {
    const inviteLinkInput = document.getElementById('invite-link-input');
    if (!inviteLinkInput) return; // Adiciona verificação de nulidade
    try {
        await navigator.clipboard.writeText(inviteLinkInput.value);
        await showCustomAlert('Copiado!', 'O link de convite foi copiado para a área de transferência.');
    } catch (err) {
        document.execCommand('copy'); // Fallback para navegadores mais antigos
        await showCustomAlert('Copiado!', 'O link de convite foi copiado para a área de transferência.');
    }
}

function openFullHistoryModal() {
    // Limpa os filtros e recarrega o histórico completo
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    document.getElementById('filter-type').value = '';
    fetchFullTransactionHistory();
    toggleModal('full-history-modal', true);
}

function exportTransactionsToCSV() {
    if (filteredTransactionHistory.length === 0) {
        showCustomAlert('Atenção', 'Não há transações para exportar.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,%EF%BB%BF"; // Adiciona BOM para UTF-8
    csvContent += "Data,Tipo,Descricao,Valor,Responsavel\n"; // Cabeçalho

    filteredTransactionHistory.forEach(tx => {
        const row = [
            new Date(tx.data_transacao).toLocaleDateString('pt-BR'),
            tx.tipo,
            `"${tx.descricao.replace(/"/g, '""')}"`, // Escapa aspas duplas na descrição
            tx.valor.toFixed(2).replace('.', ','), // Formato brasileiro
            tx.responsavel_nome
        ].join(',');
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "transacoes_clarify.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showCustomAlert('Sucesso', 'Histórico exportado para CSV!');
}

function exportTransactionsToPDF() {
    if (filteredTransactionHistory.length === 0) {
        showCustomAlert('Atenção', 'Não há transações para exportar.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Histórico de Transações - Clarify", 14, 22);

    doc.setFontSize(10);
    doc.text(`Grupo: ${localStorage.getItem('activeGroupId')}`, 14, 30); // Pode buscar o nome do grupo se disponível
    doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 14, 36);

    const tableColumn = ["Data", "Tipo", "Descrição", "Valor", "Responsável"];
    const tableRows = [];

    filteredTransactionHistory.forEach(tx => {
        const txData = [
            new Date(tx.data_transacao).toLocaleDateString('pt-BR'),
            tx.tipo.charAt(0).toUpperCase() + tx.tipo.slice(1),
            tx.descricao,
            formatCurrency(tx.valor),
            tx.responsavel_nome
        ];
        tableRows.push(txData);
    });

    doc.autoTable(tableColumn, tableRows, { startY: 45 });
    doc.save("transacoes_clarify.pdf");
    showCustomAlert('Sucesso', 'Histórico exportado para PDF!');
}

function openPaymentReminderModal(mode, reminderId = null) {
    const titleEl = document.getElementById('payment-reminder-form-title');
    const submitButton = document.getElementById('payment-reminder-form')?.querySelector('button[type="submit"]'); // Adiciona verificação de nulidade
    document.getElementById('payment-reminder-error-message')?.classList.add('hidden'); // Adiciona verificação de nulidade

    if (!titleEl || !submitButton) return; // Adiciona verificação de nulidade

    if (mode === 'add') {
        titleEl.textContent = 'Adicionar Novo Lembrete';
        submitButton.textContent = 'Adicionar';
        document.getElementById('payment-reminder-form')?.reset(); // Adiciona verificação de nulidade
        currentPaymentReminderId = null;
    } else if (mode === 'edit') {
        titleEl.textContent = 'Editar Lembrete';
        submitButton.textContent = 'Salvar Alterações';
        currentPaymentReminderId = reminderId;
        const reminder = allPaymentReminders.find(r => r.id === reminderId);
        if (reminder) {
            document.getElementById('payment-reminder-title').value = reminder.titulo;
            document.getElementById('payment-reminder-value').value = reminder.valor || '';
            document.getElementById('payment-reminder-due-date').value = reminder.data_vencimento;
            document.getElementById('payment-reminder-description').value = reminder.descricao || '';
        }
    }
    toggleModal('payment-reminder-modal', true);
}

async function handlePaymentReminderFormSubmit(event) {
    event.preventDefault();
    const title = document.getElementById('payment-reminder-title')?.value; // Adiciona verificação de nulidade
    const value = parseFloat(document.getElementById('payment-reminder-value')?.value); // Adiciona verificação de nulidade
    const dueDate = document.getElementById('payment-reminder-due-date')?.value; // Adiciona verificação de nulidade
    const description = document.getElementById('payment-reminder-description')?.value; // Adiciona verificação de nulidade
    const groupId = localStorage.getItem('activeGroupId');

    if (!title || isNaN(value) || value <= 0 || !dueDate || !groupId) { // Adiciona validação básica
        document.getElementById('payment-reminder-error-message').textContent = 'Por favor, preencha todos os campos corretamente.';
        document.getElementById('payment-reminder-error-message').classList.remove('hidden');
        return;
    }

    const reminderData = {
        titulo: title,
        valor: isNaN(value) ? null : value, // Envia null se o valor não for um número
        data_vencimento: dueDate,
        descricao: description || null
    };

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    document.getElementById('payment-reminder-error-message')?.classList.add('hidden'); // Adiciona verificação de nulidade

    try {
        let response;
        if (currentPaymentReminderId) {
            response = await fetch(`${API_URL}/api/pagamentos/${currentPaymentReminderId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(reminderData)
            });
        } else {
            response = await fetch(`${API_URL}/api/pagamentos/grupo/${groupId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(reminderData)
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao salvar lembrete.');
        }

        toggleModal('payment-reminder-modal', false);
        await showCustomAlert('Sucesso', 'Lembrete de pagamento salvo com sucesso!');
        fetchPaymentReminders(); // Recarrega os lembretes
        fetchDashboardData(); // Recarrega o dashboard para atualizar a seção de pagamentos
    } catch (error) {
        document.getElementById('payment-reminder-error-message').textContent = error.message;
        document.getElementById('payment-reminder-error-message').classList.remove('hidden');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = currentPaymentReminderId ? 'Salvar Alterações' : 'Adicionar';
    }
}

async function markPaymentAsPaid(reminderId) {
    const confirmed = await showCustomAlert('Confirmar Pagamento', 'Tem certeza que deseja marcar este lembrete como pago?', 'confirm');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/api/pagamentos/${reminderId}/marcar-pago`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Não foi possível marcar como pago.');
        }

        await showCustomAlert('Sucesso', 'Lembrete marcado como pago!');
        fetchPaymentReminders(); // Recarrega os lembretes
        fetchDashboardData(); // Recarrega o dashboard para atualizar a seção de pagamentos
    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}

async function deletePaymentReminder(reminderId) {
    const confirmed = await showCustomAlert('Confirmar Exclusão', 'Tem certeza que deseja apagar este lembrete?', 'confirm');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/api/pagamentos/${reminderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Não foi possível apagar o lembrete.');
        }

        await showCustomAlert('Sucesso', 'Lembrete apagado com sucesso!');
        fetchPaymentReminders(); // Recarrega os lembretes
        fetchDashboardData(); // Recarrega o dashboard para atualizar a seção de pagamentos
    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}

function openAllRemindersModal() {
    renderAllPaymentReminders(allPaymentReminders);
    toggleModal('all-reminders-modal', true);
}


// --- Funções Utilitárias ---

function formatCurrency(value) {
    return `R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`;
}

function adjustDashboardLinks() {
    const plan = localStorage.getItem('userPlan');
    const headerLink = document.querySelector('header a'); // Assume o primeiro link do header
    const menuDashboardLink = document.querySelector('#menu-card a[href*="dashboard"]');

    const dashboardUrl = plan === 'premium' ? './dashboard_premium.html' : './dashboard_free.html';
    
    if(headerLink) headerLink.href = dashboardUrl;
    if(menuDashboardLink) menuDashboardLink.href = dashboardUrl;
}

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (show) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
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

// --- Reconhecimento de Fala (AI) ---
function toggleSpeechRecognition() {
    const aiTextarea = document.getElementById('ai-textarea');
    const aiRecordButton = document.getElementById('ai-record-button');

    if (!aiTextarea || !aiRecordButton) return; // Adiciona verificação de nulidade

    if (!('webkitSpeechRecognition' in window)) {
        showCustomAlert('Erro', 'Seu navegador não suporta reconhecimento de fala. Use o Chrome para esta funcionalidade.');
        return;
    }

    if (!recognition) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false; // Captura uma única frase
        recognition.interimResults = false; // Apenas resultados finais
        recognition.lang = 'pt-BR'; // Idioma português do Brasil

        recognition.onstart = () => {
            isRecording = true;
            aiRecordButton.classList.add('bg-red-500', 'animate-pulse');
            aiRecordButton.innerHTML = '<i class="fas fa-microphone-slash"></i> Gravando...';
            aiTextarea.placeholder = 'Estou a ouvir...';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            aiTextarea.value = transcript;
            console.log('Transcrição: ', transcript);
        };

        recognition.onerror = (event) => {
            console.error('Erro no reconhecimento de fala:', event.error);
            showCustomAlert('Erro de Áudio', `Ocorreu um erro no reconhecimento de fala: ${event.error}. Por favor, tente novamente.`);
            stopSpeechRecognition();
        };

        recognition.onend = () => {
            stopSpeechRecognition();
        };
    }

    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

function stopSpeechRecognition() {
    isRecording = false;
    const aiRecordButton = document.getElementById('ai-record-button');
    const aiTextarea = document.getElementById('ai-textarea');
    if (aiRecordButton) aiRecordButton.classList.remove('bg-red-500', 'animate-pulse'); // Adiciona verificação de nulidade
    if (aiRecordButton) aiRecordButton.innerHTML = '<i class="fas fa-microphone"></i>'; // Adiciona verificação de nulidade
    if (aiTextarea) aiTextarea.placeholder = "Ex: 'gastei 30 reais de uber e investi 50 reais hoje'"; // Adiciona verificação de nulidade
}

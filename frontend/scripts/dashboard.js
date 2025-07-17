const API_URL = 'http://127.0.0.1:8000';

// Variáveis globais para guardar os dados recebidos da API
let allGoals = [];
let groupMembers = [];
let allTransactions = [];
let monthlyChart = null;

// --- INICIALIZAÇÃO E EVENTOS PRINCIPAIS ---

document.addEventListener('DOMContentLoaded', () => {
    // Garante que o script só é executado após o carregamento completo da página
    setupEventListeners();
    fetchDashboardData();
});

/**
 * Configura todos os "ouvintes" de eventos da página para botões e formulários.
 */
function setupEventListeners() {
    // Logout
    document.getElementById('logout-button')?.addEventListener('click', logout);
    
    // Botão para adicionar transação manualmente
    document.getElementById('add-transaction-button')?.addEventListener('click', () => openTransactionFormModal());

    // Modal de Transação (Adicionar/Editar)
    document.getElementById('transaction-form')?.addEventListener('submit', handleTransactionFormSubmit);
    document.getElementById('cancel-transaction-button')?.addEventListener('click', () => toggleModal('transaction-form-modal', false));

    // Botão principal para adicionar uma nova meta (no card de metas)
    document.getElementById('add-goal-button')?.addEventListener('click', () => openGoalFormModal());

    // Botões e formulário do modal de Adicionar/Editar Meta
    document.getElementById('goal-form')?.addEventListener('submit', handleGoalFormSubmit);
    document.getElementById('cancel-goal-button')?.addEventListener('click', () => toggleModal('goal-form-modal', false));
    document.getElementById('close-goal-modal')?.addEventListener('click', () => toggleModal('goal-form-modal', false));

    // Botões e formulário do modal de Adicionar Fundos
    document.getElementById('add-funds-form')?.addEventListener('submit', handleAddFundsSubmit);
    document.getElementById('cancel-funds-button')?.addEventListener('click', () => toggleModal('add-funds-modal', false));
    document.getElementById('close-funds-modal')?.addEventListener('click', () => toggleModal('add-funds-modal', false));

    // Botões e formulário do modal de Retirar Fundos
    document.getElementById('withdraw-funds-form')?.addEventListener('submit', handleWithdrawFormSubmit);
    document.getElementById('cancel-withdraw-button')?.addEventListener('click', () => toggleModal('withdraw-funds-modal', false));
    document.getElementById('close-withdraw-modal')?.addEventListener('click', () => toggleModal('withdraw-funds-modal', false));
}

/**
 * Faz o logout do utilizador, limpando o localStorage e redirecionando para o login.
 * @param {Event} event - O evento de clique.
 */
function logout(event) {
    event.preventDefault();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('activeGroupId');
    window.location.href = '../auth/login_page.html';
}


// --- LÓGICA DE DADOS (API) ---

/**
 * Função principal que busca todos os dados necessários para a página.
 */
async function fetchDashboardData() {
    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');

    if (!token || !groupId) {
        window.location.href = '../auth/login_page.html';
        return;
    }

    try {
        // Faz as chamadas à API em paralelo para maior eficiência
        const [dashboardResponse, goalsResponse, chartResponse] = await Promise.all([
            fetch(`${API_URL}/groups/${groupId}/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/groups/${groupId}/goals`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/groups/${groupId}/chart_data`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        // Verifica se o token é válido
        if (dashboardResponse.status === 401 || goalsResponse.status === 401 || chartResponse.status === 401) {
            logout({ preventDefault: () => {} }); // Chama a função de logout
            return;
        }

        if (!dashboardResponse.ok) throw new Error('Falha ao carregar dados do dashboard.');
        if (!goalsResponse.ok) throw new Error('Falha ao carregar metas.');
        if (!chartResponse.ok) throw new Error('Falha ao carregar dados do gráfico.');

        const dashboardData = await dashboardResponse.json();
        allGoals = await goalsResponse.json();
        const chartData = await chartResponse.json();
        
        groupMembers = dashboardData.membros;
        allTransactions = dashboardData.movimentacoes_recentes;

        // Preenche toda a interface do utilizador com os novos dados
        populateUI(dashboardData, chartData);

    } catch (error) {
        handleApiError(error);
    }
}


// --- LÓGICA DE GESTÃO DE TRANSAÇÕES ---

function openTransactionFormModal(transactionId = null) {
    const form = document.getElementById('transaction-form');
    const modalTitle = document.getElementById('transaction-form-title');
    form.reset();
    document.getElementById('transaction-id').value = '';
    document.getElementById('transaction-error-message').classList.add('hidden');

    // Preenche o dropdown de responsáveis
    const responsibleSelect = document.getElementById('transaction-responsible');
    responsibleSelect.innerHTML = '';
    groupMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.nome;
        responsibleSelect.appendChild(option);
    });

    if (transactionId) {
        const tx = allTransactions.find(t => t.id === transactionId);
        if (tx) {
            modalTitle.textContent = 'Editar Movimentação';
            document.getElementById('transaction-id').value = tx.id;
            document.getElementById('transaction-type').value = tx.tipo;
            document.getElementById('transaction-description').value = tx.descricao || '';
            document.getElementById('transaction-value').value = tx.valor;
            document.getElementById('transaction-responsible').value = groupMembers.find(m => m.nome === tx.responsavel_nome)?.id;
            document.getElementById('transaction-date').value = new Date(tx.data_transacao).toISOString().split('T')[0];
        }
    } else {
        modalTitle.textContent = 'Adicionar Movimentação';
        document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
    }
    toggleModal('transaction-form-modal', true);
}

async function handleTransactionFormSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');
    const transactionId = document.getElementById('transaction-id').value;

    const transactionData = {
        tipo: document.getElementById('transaction-type').value,
        descricao: document.getElementById('transaction-description').value,
        valor: parseFloat(document.getElementById('transaction-value').value),
        responsavel_id: document.getElementById('transaction-responsible').value,
        data_transacao: document.getElementById('transaction-date').value,
    };

    const isEditing = !!transactionId;
    const url = isEditing ? `${API_URL}/transactions/${transactionId}` : `${API_URL}/transactions/group/${groupId}`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(transactionData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        toggleModal('transaction-form-modal', false);
        await fetchDashboardData();
    } catch (error) {
        document.getElementById('transaction-error-message').textContent = error.message;
        document.getElementById('transaction-error-message').classList.remove('hidden');
    }
}

async function handleDeleteTransaction(transactionId) {
    if (!confirm('Tem a certeza que quer apagar esta movimentação?')) return;
    
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(`${API_URL}/transactions/${transactionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail);
        }
        await fetchDashboardData();
    } catch (error) {
        alert(`Erro ao apagar movimentação: ${error.message}`);
    }
}


// --- LÓGICA DE GESTÃO DE METAS ---

function openGoalFormModal(goalId = null) {
    const form = document.getElementById('goal-form');
    const modalTitle = document.getElementById('goal-form-title');
    form.reset();
    document.getElementById('goal-id').value = '';
    
    if (goalId) {
        const goal = allGoals.find(g => g.id === goalId);
        if (goal) {
            modalTitle.textContent = 'Editar Meta';
            document.getElementById('goal-id').value = goal.id;
            document.getElementById('goal-title').value = goal.titulo;
            document.getElementById('goal-value').value = goal.valor_meta;
            document.getElementById('goal-date').value = goal.data_limite || '';
        }
    } else {
        modalTitle.textContent = 'Criar Nova Meta';
    }
    toggleModal('goal-form-modal', true);
}

async function handleGoalFormSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');
    const goalId = document.getElementById('goal-id').value;
    
    const goalData = {
        titulo: document.getElementById('goal-title').value,
        valor_meta: parseFloat(document.getElementById('goal-value').value),
        data_limite: document.getElementById('goal-date').value || null,
    };

    const isEditing = !!goalId;
    const url = isEditing ? `${API_URL}/groups/goals/${goalId}` : `${API_URL}/groups/${groupId}/goals`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(goalData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        toggleModal('goal-form-modal', false);
        await fetchDashboardData();
    } catch (error) {
        document.getElementById('goal-error-message').textContent = error.message;
        document.getElementById('goal-error-message').classList.remove('hidden');
    }
}

async function handleDeleteGoal(goalId) {
    if (!confirm('Tem a certeza que quer apagar esta meta? Esta ação não pode ser desfeita.')) return;
    
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(`${API_URL}/groups/goals/${goalId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail);
        }
        await fetchDashboardData();
    } catch (error) {
        alert(`Erro ao apagar meta: ${error.message}`);
    }
}

function openAddFundsModal(goalId) {
    const form = document.getElementById('add-funds-form');
    form.dataset.goalId = goalId;
    toggleModal('add-funds-modal', true);
}

async function handleAddFundsSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('accessToken');
    const goalId = event.target.dataset.goalId;
    const fundsData = { valor: parseFloat(document.getElementById('funds-amount').value) };

    try {
        const response = await fetch(`${API_URL}/groups/goals/${goalId}/add_funds`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(fundsData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        toggleModal('add-funds-modal', false);
        event.target.reset();
        await fetchDashboardData();
    } catch (error) {
        document.getElementById('funds-error-message').textContent = error.message;
        document.getElementById('funds-error-message').classList.remove('hidden');
    }
}

function openWithdrawFundsModal(goalId) {
    document.getElementById('withdraw-goal-id').value = goalId;
    toggleModal('withdraw-funds-modal', true);
}

async function handleWithdrawFormSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('accessToken');
    const goalId = document.getElementById('withdraw-goal-id').value;
    const withdrawData = { valor: parseFloat(document.getElementById('withdraw-amount').value) };

    try {
        const response = await fetch(`${API_URL}/groups/goals/${goalId}/withdraw_funds`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(withdrawData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        toggleModal('withdraw-funds-modal', false);
        event.target.reset();
        await fetchDashboardData();
    } catch (error) {
        document.getElementById('withdraw-error-message').textContent = error.message;
        document.getElementById('withdraw-error-message').classList.remove('hidden');
    }
}


// --- FUNÇÕES DE RENDERIZAÇÃO E UTILITÁRIOS ---

function populateUI(dashboardData, chartData) {
    populateUserInfo(dashboardData.nome_utilizador, dashboardData.plano);
    populateGroupInfo(dashboardData.nome_grupo, dashboardData.membros);
    populateTransactions(dashboardData.movimentacoes_recentes);
    populateGoalsOnDashboard(dashboardData.plano);
    populateSummaryCards(dashboardData.total_investido, dashboardData.saldo_total);
    renderChart(chartData);
}

function populateGoalsOnDashboard(plan) {
    const goalContainer = document.getElementById('goals-list-container');
    const addGoalButton = document.getElementById('add-goal-button');
    if (!goalContainer || !addGoalButton) return;
    
    goalContainer.innerHTML = '';

    if (allGoals.length > 0) {
        allGoals.forEach(goal => {
            const percentage = (goal.valor_meta > 0) ? (goal.valor_atual / goal.valor_meta) * 100 : 0;
            const goalEl = document.createElement('div');
            goalEl.className = 'bg-background p-3 rounded-lg';
            goalEl.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-white">${goal.titulo}</p>
                        <p class="text-xs text-gray-400">R$ ${Number(goal.valor_atual).toFixed(2)} / R$ ${Number(goal.valor_meta).toFixed(2)}</p>
                    </div>
                    <div class="flex space-x-3 items-center">
                        <button class="text-gain hover:opacity-75" onclick="openAddFundsModal('${goal.id}')" title="Adicionar Aporte"><i class="fas fa-piggy-bank"></i></button>
                        <button class="text-yellow-400 hover:opacity-75" onclick="openWithdrawFundsModal('${goal.id}')" title="Retirar Aporte"><i class="fas fa-hand-holding-dollar"></i></button>
                        <button class="text-primary-light hover:opacity-75" onclick="openGoalFormModal('${goal.id}')" title="Editar Meta"><i class="fas fa-pencil-alt"></i></button>
                        <button class="text-expense hover:opacity-75" onclick="handleDeleteGoal('${goal.id}')" title="Apagar Meta"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                    <div class="bg-primary h-2.5 rounded-full" style="width: ${percentage.toFixed(2)}%"></div>
                </div>
            `;
            goalContainer.appendChild(goalEl);
        });
    } else {
        goalContainer.innerHTML = '<p class="text-center text-gray-400">Nenhuma meta criada ainda.</p>';
    }

    if (plan === 'gratuito' && allGoals.length > 0) {
        addGoalButton.disabled = true;
        addGoalButton.className = 'w-full text-center mt-4 py-2 border-2 border-dashed border-gray-600 text-gray-500 rounded-lg cursor-not-allowed';
        addGoalButton.innerHTML = 'Criar nova meta 💎';
    } else {
        addGoalButton.disabled = false;
        addGoalButton.className = 'w-full text-center mt-4 py-2 bg-primary/80 hover:bg-primary transition text-white rounded-lg';
        addGoalButton.textContent = 'Adicionar Nova Meta';
    }
}

function populateUserInfo(userName, plan) {
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        userNameElement.textContent = `Olá, ${userName}!`;
        if (plan === 'premium') {
            userNameElement.innerHTML += ` <span class="text-gold font-bold">💎</span>`;
        }
    }
}

function populateGroupInfo(groupName, members) {
    const groupNameElement = document.getElementById('group-name');
    const membersListElement = document.getElementById('members-list');
    
    if (groupNameElement) groupNameElement.textContent = groupName;
    
    if (membersListElement) {
        membersListElement.innerHTML = '';
        members.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'flex items-center justify-between';
            memberDiv.innerHTML = `
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center font-bold text-black mr-3">${member.nome.charAt(0)}</div>
                    <span>${member.nome}</span>
                </div>
            `;
            membersListElement.appendChild(memberDiv);
        });
    }
}

function populateTransactions(transactions) {
    const tableBody = document.getElementById('transactions-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (transactions.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.textContent = 'Ainda não há transações registadas.';
        cell.className = 'text-center text-gray-400 py-4';
        return;
    }
    transactions.forEach(tx => {
        const row = tableBody.insertRow();
        row.className = 'border-b border-gray-800 hover:bg-gray-800/50';
        
        let valorClass = '', valorSignal = '';
        switch (tx.tipo) {
            case 'gasto': valorClass = 'text-expense'; valorSignal = '-'; break;
            case 'ganho': valorClass = 'text-gain'; valorSignal = '+'; break;
            case 'investimento': valorClass = 'text-investment'; valorSignal = '-'; break;
            default: valorClass = 'text-gray-400';
        }
        
        row.innerHTML = `
            <td class="py-3 px-2">${tx.descricao || 'N/A'}</td>
            <td class="py-3 px-2 ${valorClass}">${valorSignal} R$ ${Number(tx.valor).toFixed(2)}</td>
            <td class="py-3 px-2">${tx.responsavel_nome}</td>
            <td class="py-3 px-2">${new Date(tx.data_transacao).toLocaleDateString()}</td>
            <td class="py-3 px-2 text-center">
                <button onclick="openTransactionFormModal('${tx.id}')" class="text-primary-light hover:opacity-75"><i class="fas fa-pencil-alt"></i></button>
                <button onclick="handleDeleteTransaction('${tx.id}')" class="text-expense hover:opacity-75 ml-3"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function populateSummaryCards(totalInvestido, saldoTotal) {
    const totalInvestidoEl = document.getElementById('total-investido');
    const saldoTotalEl = document.getElementById('saldo-total');

    if (totalInvestidoEl) {
        totalInvestidoEl.textContent = `R$ ${Number(totalInvestido).toFixed(2).replace('.', ',')}`;
    }
    if (saldoTotalEl) {
        saldoTotalEl.textContent = `R$ ${Number(saldoTotal).toFixed(2).replace('.', ',')}`;
        saldoTotalEl.classList.remove('text-gain', 'text-expense');
        if (saldoTotal >= 0) {
            saldoTotalEl.classList.add('text-gain');
        } else {
            saldoTotalEl.classList.add('text-expense');
        }
    }
}

function renderChart(chartData) {
    const ctx = document.getElementById('monthly-chart');
    if (!ctx) return;
    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(d => d.mes),
            datasets: [
                { label: 'Ganhos', data: chartData.map(d => d.ganhos), backgroundColor: 'rgba(34, 197, 94, 0.6)' },
                { label: 'Gastos', data: chartData.map(d => d.gastos), backgroundColor: 'rgba(239, 68, 68, 0.6)' },
                { label: 'Investimentos', data: chartData.map(d => d.investimentos), backgroundColor: 'rgba(56, 189, 248, 0.6)' },
                { label: 'Saldo', data: chartData.map(d => d.saldo), backgroundColor: 'rgba(229, 231, 235, 0.6)' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
            }
        }
    });
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

function handleApiError(error) {
    console.error('Erro de API:', error);
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.innerHTML = `<div class="text-center text-red-400 p-8"><strong>Erro:</strong> ${error.message}. Por favor, tente recarregar a página.</div>`;
    }
}

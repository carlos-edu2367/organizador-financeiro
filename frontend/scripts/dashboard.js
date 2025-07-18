const API_URL = 'http://127.0.0.1:8000';

// Variáveis globais para guardar os dados recebidos da API
let allGoals = [];
let groupMembers = [];
let allTransactions = [];
let monthlyChart = null;
let currentUserId = null;

// Mapeia o tipo de medalha para um emoji e uma cor do Tailwind CSS
const medalInfo = {
    'Bronze':   { emoji: '🥉', color: 'text-bronze' },
    'Prata':    { emoji: '🥈', color: 'text-silver' },
    'Ouro':     { emoji: '🥇', color: 'text-gold' },
    'Platina':  { emoji: '💎', color: 'text-white' },
    'Diamante': { emoji: '🏆', color: 'text-yellow-200' }
};

// --- INICIALIZAÇÃO E EVENTOS PRINCIPAIS ---

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchDashboardData();
});

function setupEventListeners() {
    document.getElementById('logout-button')?.addEventListener('click', logout);
    document.getElementById('add-transaction-button')?.addEventListener('click', () => openTransactionFormModal());
    document.getElementById('transaction-form')?.addEventListener('submit', handleTransactionFormSubmit);
    document.getElementById('cancel-transaction-button')?.addEventListener('click', () => toggleModal('transaction-form-modal', false));
    document.getElementById('add-goal-button')?.addEventListener('click', () => openGoalFormModal());
    document.getElementById('goal-form')?.addEventListener('submit', handleGoalFormSubmit);
    document.getElementById('cancel-goal-button')?.addEventListener('click', () => toggleModal('goal-form-modal', false));
    document.getElementById('add-funds-form')?.addEventListener('submit', handleAddFundsSubmit);
    document.getElementById('cancel-funds-button')?.addEventListener('click', () => toggleModal('add-funds-modal', false));
    document.getElementById('withdraw-funds-form')?.addEventListener('submit', handleWithdrawFormSubmit);
    document.getElementById('cancel-withdraw-button')?.addEventListener('click', () => toggleModal('withdraw-funds-modal', false));
    document.getElementById('invite-button')?.addEventListener('click', handleInviteClick);
    document.getElementById('close-invite-modal')?.addEventListener('click', () => toggleModal('invite-modal', false));
    document.getElementById('copy-invite-link-button')?.addEventListener('click', copyInviteLink);
}

function logout(event) {
    event.preventDefault();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('activeGroupId');
    window.location.href = '../auth/login_page.html';
}


// --- LÓGICA DE DADOS (API) ---

async function fetchDashboardData() {
    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');

    if (!token || !groupId) {
        window.location.href = '../auth/login_page.html';
        return;
    }

    try {
        const [dashboardResponse, goalsResponse, chartResponse] = await Promise.all([
            fetch(`${API_URL}/groups/${groupId}/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/groups/${groupId}/goals`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/groups/${groupId}/chart_data`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (dashboardResponse.status === 401) {
            logout({ preventDefault: () => {} });
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
        currentUserId = dashboardData.current_user_id;

        populateUI(dashboardData, chartData);

    } catch (error) {
        handleApiError(error);
    }
}


// --- LÓGICA DE GESTÃO DE GRUPO ---
async function handleInviteClick() {
    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');
    const inviteLinkInput = document.getElementById('invite-link-input');
    const inviteError = document.getElementById('invite-error');
    
    inviteError.classList.add('hidden');

    try {
        const response = await fetch(`${API_URL}/groups/${groupId}/invites`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        const fullLink = `${window.location.origin}${data.invite_link}`;
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
    inviteLinkInput.select();
    inviteLinkInput.setSelectionRange(0, 99999);
    try {
        navigator.clipboard.writeText(inviteLinkInput.value).then(() => {
            alert('Link copiado para a área de transferência!');
        });
    } catch (err) {
        document.execCommand('copy');
        alert('Link copiado para a área de transferência!');
    }
}

async function handleRemoveMember(memberId) {
    if (!confirm('Você tem certeza que quer remover este membro do grupo?')) return;

    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');

    try {
        const response = await fetch(`${API_URL}/groups/${groupId}/members/${memberId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Não foi possível remover o membro.');
        }

        await fetchDashboardData();

    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}


// --- LÓGICA DE GESTÃO DE TRANSAÇÕES ---

function openTransactionFormModal(transactionId = null) {
    const form = document.getElementById('transaction-form');
    const modalTitle = document.getElementById('transaction-form-title');
    form.reset();
    document.getElementById('transaction-id').value = '';
    document.getElementById('transaction-error-message').classList.add('hidden');

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
    if (!confirm('Você tem certeza que quer apagar esta movimentação?')) return;
    
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
    if (!confirm('Você tem certeza que quer apagar esta meta? Esta ação não pode ser desfeita.')) return;
    
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
    updateMascot(dashboardData.ganhos_mes_atual, dashboardData.gastos_mes_atual);
    populateUserInfo(dashboardData.nome_utilizador, dashboardData.plano);
    populateGroupInfo(dashboardData.nome_grupo, dashboardData.membros, dashboardData.plano);
    populateTransactions(dashboardData.movimentacoes_recentes);
    populateGoalsOnDashboard(dashboardData.plano);
    populateSummaryCards(dashboardData.total_investido, dashboardData.saldo_total);
    populateRecentAchievements(dashboardData.conquistas_recentes);
    renderChart(chartData);
}

function updateMascot(ganhos, gastos) {
    const mascoteImg = document.getElementById('mascote-img');
    const mascoteTitle = document.getElementById('mascote-title');
    const mascoteText = document.getElementById('mascote-text');

    if (!mascoteImg || !mascoteTitle || !mascoteText) return;

    const ganhosNum = Number(ganhos);
    const gastosNum = Number(gastos);

    let ratio = 0;
    if (ganhosNum > 0) {
        ratio = (gastosNum / ganhosNum) * 100;
    } else if (gastosNum > 0) {
        ratio = 101;
    }

    if (ratio >= 100) {
        mascoteImg.src = '../../assets/mascote_desesperado.png';
        mascoteImg.alt = 'Mascote Clarify Desesperado';
        mascoteTitle.textContent = 'Situação Financeira: Crítica!';
        mascoteText.textContent = 'Atenção! Os gastos deste mês ultrapassaram os ganhos. É hora de rever o orçamento.';
    } else if (ratio >= 80) {
        mascoteImg.src = '../../assets/mascote_neutro.png';
        mascoteImg.alt = 'Mascote Clarify Neutro';
        mascoteTitle.textContent = 'Situação Financeira: Alerta';
        mascoteText.textContent = 'Cuidado, os gastos estão se aproximando dos ganhos. Mantenham o controle para fechar o mês no verde.';
    } else {
        mascoteImg.src = '../../assets/mascote_feliz.png';
        mascoteImg.alt = 'Mascote Clarify Feliz';
        mascoteTitle.textContent = 'Situação Financeira: Estável';
        mascoteText.textContent = 'Ótimo trabalho! Seus gastos estão controlados e a saúde financeira do grupo está boa.';
    }
}

function populateRecentAchievements(achievements) {
    const container = document.getElementById('achievements-list-container');
    if (!container) return;

    container.innerHTML = '';

    if (achievements.length === 0) {
        container.innerHTML = '<p class="text-center text-sm text-gray-500">Nenhuma medalha ganha ainda. Continuem assim!</p>';
        return;
    }

    achievements.forEach(ach => {
        const info = medalInfo[ach.tipo_medalha] || { emoji: '⭐', color: 'text-white' };
        const achievementEl = document.createElement('div');
        achievementEl.className = 'flex items-center space-x-4';
        achievementEl.innerHTML = `
            <span class="text-4xl">${info.emoji}</span>
            <div>
                <p class="font-bold ${info.color}">${ach.tipo_medalha}</p>
                <p class="text-sm text-gray-400">${ach.descricao}</p>
            </div>
        `;
        container.appendChild(achievementEl);
    });
}

function populateGoalsOnDashboard(plan) {
    const goalContainer = document.getElementById('goals-list-container');
    const addGoalButton = document.getElementById('add-goal-button');
    if (!goalContainer || !addGoalButton) return;
    
    goalContainer.innerHTML = '';

    if (allGoals.length > 0) {
        allGoals.forEach(goal => {
            const percentage = (goal.valor_meta > 0) ? (goal.valor_atual / goal.valor_meta) * 100 : 0;
            
            let deadlineHtml = '';
            if (goal.data_limite) {
                const today = new Date();
                const deadlineDate = new Date(goal.data_limite + 'T00:00:00');
                today.setHours(0, 0, 0, 0);

                const diffTime = deadlineDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let colorClass = 'text-gray-400';
                if (diffDays < 0) {
                    colorClass = 'text-red-500';
                } else if (diffDays <= 7) {
                    colorClass = 'text-amber-500';
                } else if (diffDays <= 14) {
                    colorClass = 'text-yellow-400';
                } else if (diffDays <= 30) {
                    colorClass = 'text-yellow-300';
                }
                
                const formattedDate = deadlineDate.toLocaleDateString('pt-BR');
                deadlineHtml = `
                    <div class="flex items-center text-xs mt-2 ${colorClass}">
                        <i class="fas fa-clock mr-1.5"></i>
                        <span>${formattedDate}</span>
                    </div>
                `;
            }

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
                ${deadlineHtml}
            `;
            goalContainer.appendChild(goalEl);
        });
    } else {
        goalContainer.innerHTML = '<p class="text-center text-gray-400">Nenhuma meta criada ainda.</p>';
    }

    if (plan === 'gratuito' && allGoals.some(g => g.status === 'ativa')) {
        addGoalButton.disabled = true;
        addGoalButton.className = 'w-full text-center mt-4 py-2 border-2 border-dashed border-gray-600 text-gray-500 rounded-lg cursor-not-allowed';
        addGoalButton.innerHTML = 'Criar nova meta 💎';
    } else if (plan === 'gratuito') {
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

function populateGroupInfo(groupName, members, plan) {
    const groupNameElement = document.getElementById('group-name');
    const membersListElement = document.getElementById('members-list');
    const inviteButton = document.getElementById('invite-button');
    const upgradeCard = document.getElementById('upgrade-card');
    
    const limit = (plan === 'premium') ? 4 : 2;
    if (groupNameElement) {
        groupNameElement.textContent = `${groupName} (${members.length}/${limit})`;
    }
    
    if (membersListElement) {
        membersListElement.innerHTML = '';
        const currentUserIsOwner = members.find(m => m.id === currentUserId)?.papel === 'dono';

        members.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'flex items-center justify-between';
            
            let removeButtonHtml = '';
            if (currentUserIsOwner && member.papel !== 'dono') {
                removeButtonHtml = `<button onclick="handleRemoveMember('${member.id}')" class="text-gray-500 hover:text-expense" title="Remover membro"><i class="fas fa-trash"></i></button>`;
            }

            memberDiv.innerHTML = `
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center font-bold text-black mr-3">${member.nome.charAt(0)}</div>
                    <span>${member.nome} ${member.papel === 'dono' ? '<span class="text-xs text-gold">(Dono)</span>' : ''}</span>
                </div>
                ${removeButtonHtml}
            `;
            membersListElement.appendChild(memberDiv);
        });
    }

    if (inviteButton && upgradeCard) {
        if (plan === 'gratuito' && members.length >= 2) {
            inviteButton.classList.add('hidden');
            upgradeCard.classList.remove('hidden');
        } else {
            inviteButton.classList.remove('hidden');
            upgradeCard.classList.add('hidden');
        }
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
        cell.textContent = 'Ainda não há transações registradas.';
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
            case 'investimento': valorClass = 'text-investment'; valorSignal = '';
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

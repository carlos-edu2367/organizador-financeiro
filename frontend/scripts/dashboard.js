const API_URL = 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', () => {
    // Adiciona a funcionalidade de logout
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', (event) => {
            event.preventDefault();
            localStorage.removeItem('accessToken');
            localStorage.removeItem('activeGroupId');
            window.location.href = '../auth/login_page.html';
        });
    }

    // Lógica do Modal de Metas
    const addGoalButton = document.getElementById('add-goal-button');
    const addGoalModal = document.getElementById('add-goal-modal');
    const closeGoalModalButton = document.getElementById('close-goal-modal');
    const cancelGoalButton = document.getElementById('cancel-goal-button');
    const addGoalForm = document.getElementById('add-goal-form');

    if (addGoalButton) {
        addGoalButton.addEventListener('click', () => {
            if (!addGoalButton.disabled) {
                addGoalModal.classList.remove('hidden');
            }
        });
    }
    if (closeGoalModalButton) {
        closeGoalModalButton.addEventListener('click', () => addGoalModal.classList.add('hidden'));
    }
    if (cancelGoalButton) {
        cancelGoalButton.addEventListener('click', () => addGoalModal.classList.add('hidden'));
    }
    if (addGoalForm) {
        addGoalForm.addEventListener('submit', handleGoalSubmit);
    }
    
    fetchDashboardData();
});

async function handleGoalSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');
    const errorMessageDiv = document.getElementById('goal-error-message');
    
    const goalData = {
        titulo: document.getElementById('goal-title').value,
        valor_meta: parseFloat(document.getElementById('goal-value').value),
        data_limite: document.getElementById('goal-date').value || null,
    };

    try {
        const response = await fetch(`${API_URL}/groups/${groupId}/goals`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(goalData),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Não foi possível criar a meta.');
        }

        document.getElementById('add-goal-modal').classList.add('hidden');
        fetchDashboardData();

    } catch (error) {
        errorMessageDiv.textContent = error.message;
        errorMessageDiv.classList.remove('hidden');
    }
}

async function fetchDashboardData() {
    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');

    if (!token || !groupId) {
        window.location.href = '../auth/login_page.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/groups/${groupId}/dashboard`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('activeGroupId');
            window.location.href = '../auth/login_page.html';
            return;
        }
        if (!response.ok) throw new Error('Falha ao carregar os dados do dashboard.');

        const data = await response.json();
        
        populateUserInfo(data.nome_utilizador, data.plano);
        populateGroupInfo(data.nome_grupo, data.membros);
        populateTransactions(data.movimentacoes_recentes);
        populateActiveGoal(data.meta_ativa, data.plano);

    } catch (error) {
        console.error('Erro:', error);
        const mainContent = document.querySelector('main');
        if(mainContent) {
            mainContent.innerHTML = `<div class="text-center text-red-400">${error.message}</div>`;
        }
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
        cell.colSpan = 4;
        cell.textContent = 'Ainda não há transações registadas.';
        cell.className = 'text-center text-gray-400 py-4';
        return;
    }
    transactions.forEach(tx => {
        const row = tableBody.insertRow();
        row.className = 'border-b border-gray-800 hover:bg-gray-800/50';
        
        const valorClass = tx.tipo === 'gasto' ? 'text-expense' : 'text-investment';
        const valorSignal = tx.tipo === 'gasto' ? '-' : '+';
        
        row.innerHTML = `
            <td class="py-3 px-2">${tx.descricao || 'N/A'}</td>
            <td class="py-3 px-2 ${valorClass}">${valorSignal} R$ ${Number(tx.valor).toFixed(2)}</td>
            <td class="py-3 px-2">${tx.responsavel_nome}</td>
            <td class="py-3 px-2">${new Date(tx.data_transacao).toLocaleDateString()}</td>
        `;
    });
}

function populateActiveGoal(goal, plan) {
    const goalContainer = document.getElementById('active-goal-container');
    const addGoalButton = document.getElementById('add-goal-button');
    if (!goalContainer || !addGoalButton) return;

    if (goal) {
        const percentage = (goal.valor_atual / goal.valor_meta) * 100;
        goalContainer.innerHTML = `
            <p class="text-sm font-medium text-primary-light">${goal.titulo}</p>
            <div class="mt-1">
                <div class="flex justify-between text-sm text-gray-300 mb-1"><span>Progresso</span><span>${Math.round(percentage)}%</span></div>
                <div class="w-full bg-background rounded-full h-2.5"><div class="bg-primary h-2.5 rounded-full" style="width: ${percentage}%"></div></div>
                <p class="text-right text-xs text-gray-400 mt-1">R$ ${Number(goal.valor_atual).toFixed(2)} / R$ ${Number(goal.valor_meta).toFixed(2)}</p>
            </div>
        `;
        if (plan === 'gratuito') {
            addGoalButton.disabled = true;
            addGoalButton.className = 'w-full text-center mt-4 py-2 border-2 border-dashed border-gray-600 text-gray-500 rounded-lg cursor-not-allowed';
            addGoalButton.innerHTML = 'Criar nova meta 💎';
        } else {
             addGoalButton.disabled = false;
             addGoalButton.className = 'w-full text-center mt-4 py-2 bg-primary/80 hover:bg-primary transition text-white rounded-lg';
             addGoalButton.textContent = 'Criar Nova Meta';
        }
    } else {
        goalContainer.innerHTML = '<p class="text-center text-gray-400">Nenhuma meta ativa no momento.</p>';
        addGoalButton.disabled = false;
        addGoalButton.className = 'w-full text-center mt-4 py-2 bg-primary/80 hover:bg-primary transition text-white rounded-lg';
        addGoalButton.textContent = 'Criar Nova Meta';
    }
}

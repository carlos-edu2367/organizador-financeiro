// Define a URL base da API.
const API_URL = 'http://127.0.0.1:8000';

// Função para ser executada quando a página do dashboard for carregada.
document.addEventListener('DOMContentLoaded', () => {
    // Adiciona a funcionalidade de logout
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', (event) => {
            event.preventDefault();
            
            // Limpa os dados da sessão do localStorage
            localStorage.removeItem('accessToken');
            localStorage.removeItem('activeGroupId');
            
            // Redireciona para a página de login
            window.location.href = '../auth/login_page.html';
        });
    }
    
    // Busca os dados para preencher o dashboard
    fetchDashboardData();
});

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
        populateActiveGoal(data.meta_ativa);

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
    transactions.forEach(tx => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800 hover:bg-gray-800/50';
        
        const valorClass = tx.tipo === 'gasto' ? 'text-expense' : 'text-investment';
        const valorSignal = tx.tipo === 'gasto' ? '-' : '+';
        
        row.innerHTML = `
            <td class="py-3 px-2">${tx.descricao || 'N/A'}</td>
            <td class="py-3 px-2 ${valorClass}">${valorSignal} R$ ${Number(tx.valor).toFixed(2)}</td>
            <td class="py-3 px-2">${tx.responsavel_nome}</td>
            <td class="py-3 px-2">${new Date(tx.data_transacao).toLocaleDateString()}</td>
        `;
        tableBody.appendChild(row);
    });
}

function populateActiveGoal(goal) {
    const goalContainer = document.getElementById('active-goal-container');
    if (!goalContainer) return;

    if (goal) {
        const percentage = (goal.valor_atual / goal.valor_meta) * 100;
        goalContainer.innerHTML = `
            <p class="text-sm font-medium text-primary-light">${goal.titulo}</p>
            <div class="mt-1">
                <div class="flex justify-between text-sm text-gray-300 mb-1">
                    <span>Progresso</span>
                    <span>${Math.round(percentage)}%</span>
                </div>
                <div class="w-full bg-background rounded-full h-2.5">
                    <div class="bg-primary h-2.5 rounded-full" style="width: ${percentage}%"></div>
                </div>
                <p class="text-right text-xs text-gray-400 mt-1">R$ ${Number(goal.valor_atual).toFixed(2)} / R$ ${Number(goal.valor_meta).toFixed(2)}</p>
            </div>
        `;
    } else {
        goalContainer.innerHTML = '<p class="text-center text-gray-400">Nenhuma meta ativa no momento.</p>';
    }
}

const token = localStorage.getItem('collaboratorToken');
// INÍCIO DA ALTERAÇÃO: Adiciona uma mensagem amigável ao redirecionar para o login
if (!token) {
    window.location.href = './login.html?message=' + encodeURIComponent('Descanse um pouco e faça login novamente!');
}
// FIM DA ALTERAÇÃO

/**
 * Determina a URL base da API com base no ambiente (desenvolvimento ou produção).
 */
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000';
    }
    return '';
};
const API_URL = getApiBaseUrl();


// --- Variáveis Globais ---
let usersChart = null;
let allUsers = []; 
let userCargo = null; // Armazenará o cargo do colaborador logado

function logout() {
    localStorage.removeItem('collaboratorToken');
    // INÍCIO DA ALTERAÇÃO: Adiciona uma mensagem amigável ao fazer logout
    window.location.href = './login.html?message=' + encodeURIComponent('Você foi desconectado. Descanse um pouco e faça login novamente!');
    // FIM DA ALTERAÇÃO
}

// --- Decodificar Token para Obter Cargo e Inicializar UI ---
try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload && payload.cargo) {
        userCargo = payload.cargo;
        console.log("Cargo do colaborador detectado no token:", userCargo);
        // Chamar função para ajustar UI com base no cargo
        adjustUIForCargo(userCargo); 
    } else {
        console.warn("O token não contém a informação de 'cargo'. Faça logout e login novamente.");
        logout(); // Força logout se o cargo não for encontrado
    }
} catch (e) {
    console.error("Erro ao decodificar token:", e);
    logout(); // Força logout em caso de erro na decodificação
}

// Função para ajustar a UI com base no cargo
function adjustUIForCargo(cargo) {
    const navLinkGestao = document.getElementById('nav-link-gestao');
    if (navLinkGestao) {
        if (cargo !== 'adm') {
            navLinkGestao.classList.add('hidden'); // Esconde a aba "Gestão" se não for admin
        } else {
            navLinkGestao.classList.remove('hidden');
        }
    }
}


// --- Navegação ---
const navLinks = document.querySelectorAll('.nav-link');
const pageContents = document.querySelectorAll('.page-content');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);

        // Se o link de gestão for clicado por um não-admin, previne a navegação
        if (targetId === 'gestao' && userCargo !== 'adm') {
            showCustomAlert('Acesso Negado', 'Você não tem permissão para acessar esta seção.', 'alert');
            return;
        }

        navLinks.forEach(l => l.classList.remove('active', 'bg-surface'));
        link.classList.add('active', 'bg-surface');

        pageContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== targetId);
        });

        // Carrega dados específicos para cada página
        if (targetId === 'usuarios') {
            document.getElementById('user-detail-view').classList.add('hidden');
            document.getElementById('users-list-view').classList.remove('hidden');
            fetchUsers();
        } else if (targetId === 'suporte') {
            fetchSupportTickets();
        } else if (targetId === 'gestao') {
            fetchManagementData(); // Esta função já verifica o cargo internamente
        }
    });
});

// --- Lógica do Dashboard (Início) ---
const userChartFilter = document.getElementById('user-chart-filter');
userChartFilter.addEventListener('change', (e) => fetchChartData(e.target.value));

async function fetchDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/collaborators/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // INÍCIO DA ALTERAÇÃO: Tratamento de erro para token inválido/expirado
        if (response.status === 401 || response.status === 403) {
            logout(); // Redireciona para login com mensagem
            return;
        }
        // FIM DA ALTERAÇÃO
        if (!response.ok) throw new Error('Falha ao carregar estatísticas.');
        const data = await response.json();
        
        document.getElementById('total-usuarios').textContent = data.total_usuarios;
        document.getElementById('total-premium').textContent = data.total_premium;
        const conversionRate = data.total_usuarios > 0 ? (data.total_premium / data.total_usuarios) * 100 : 0;
        document.getElementById('taxa-conversao').textContent = `${conversionRate.toFixed(1)}%`;

    } catch (error) {
        console.error(error);
        showCustomAlert('Erro', 'Não foi possível carregar as estatísticas do dashboard.');
    }
}

async function fetchChartData(period = 'mes') {
    try {
        const response = await fetch(`${API_URL}/collaborators/dashboard/chart-data?period=${period}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // INÍCIO DA ALTERAÇÃO: Tratamento de erro para token inválido/expirado
        if (response.status === 401 || response.status === 403) {
            logout(); // Redireciona para login com mensagem
            return;
        }
        // FIM DA ALTERAÇÃO
        if (!response.ok) throw new Error('Falha ao carregar dados do gráfico.');
        const chartData = await response.json();
        updateUsersChart(chartData.data);
    } catch (error) {
        console.error(error);
        showCustomAlert('Erro', 'Não foi possível carregar os dados do gráfico.');
    }
}

function updateUsersChart(data) {
    const ctx = document.getElementById('users-chart').getContext('2d');
    
    if (usersChart) {
        usersChart.destroy();
    }

    const labels = data.map(d => d.label);
    const newUsersData = data.map(d => d.new_users);
    const newPremiumsData = data.map(d => d.new_premiums);

    usersChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Novos Usuários',
                    data: newUsersData,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)', // primary
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Novos Assinantes Premium',
                    data: newPremiumsData,
                    backgroundColor: 'rgba(250, 204, 21, 0.6)', // gold
                    borderColor: 'rgba(250, 204, 21, 1)',
                    borderWidth: 1
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
                        color: '#9ca3af',
                        stepSize: 1
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#9ca3af' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#d1d5db' }
                }
            }
        }
    });
}


// --- Lógica de Gerenciamento de Usuários ---

document.getElementById('user-search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredUsers = allUsers.filter(user => 
        user.nome.toLowerCase().includes(searchTerm) || 
        user.email.toLowerCase().includes(searchTerm)
    );
    renderUsersTable(filteredUsers);
});

async function fetchUsers() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Carregando usuários...</td></tr>';
    try {
        // INÍCIO DA ALTERAÇÃO: Correção do endpoint da API para usuários
        const response = await fetch(`${API_URL}/collaborators/admin/users/`, {
        // FIM DA ALTERAÇÃO
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // INÍCIO DA ALTERAÇÃO: Tratamento de erro para token inválido/expirado
        if (response.status === 401 || response.status === 403) {
            logout(); // Redireciona para login com mensagem
            return;
        }
        // FIM DA ALTERAÇÃO
        if (!response.ok) throw new Error('Não foi possível carregar a lista de usuários.');
        allUsers = await response.json();
        renderUsersTable(allUsers);
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-400">${error.message}</td></tr>`;
    }
}

function renderUsersTable(users) {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '';
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Nenhum usuário encontrado.</td></tr>';
        return;
    }
    users.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-700 hover:bg-surface/50';
        const planClass = user.plano === 'premium' ? 'text-gold font-semibold' : 'text-gray-400';
        row.innerHTML = `
            <td class="p-3">${user.nome}</td>
            <td class="p-3">${user.email}</td>
            <td class="p-3 ${planClass}">${user.plano.charAt(0).toUpperCase() + user.plano.slice(1)}</td>
            <td class="p-3">${new Date(user.criado_em).toLocaleDateString('pt-BR')}</td>
            <td class="p-3">
                <button onclick="showUserDetails('${user.id}')" class="text-primary-light hover:underline">Ver Detalhes</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function showUserDetails(userId) {
    document.getElementById('users-list-view').classList.add('hidden');
    const detailView = document.getElementById('user-detail-view');
    detailView.innerHTML = '<p class="text-center p-8">Carregando detalhes do usuário...</p>';
    detailView.classList.remove('hidden');

    try {
        // INÍCIO DA ALTERAÇÃO: Correção do endpoint da API para detalhes do usuário
        const response = await fetch(`${API_URL}/collaborators/admin/users/${userId}`, {
        // FIM DA ALTERAÇÃO
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // INÍCIO DA ALTERAÇÃO: Tratamento de erro para token inválido/expirado
        if (response.status === 401 || response.status === 403) {
            logout(); // Redireciona para login com mensagem
            return;
        }
        // FIM DA ALTERAÇÃO
        if (!response.ok) throw new Error('Não foi possível carregar os detalhes do usuário.');
        const user = await response.json();

        let transactionsHtml = '<p class="text-gray-500 mt-2">Nenhuma movimentação registrada.</p>';
        if (user.movimentacoes.length > 0) {
            transactionsHtml = `
                <div class="overflow-y-auto max-h-80 mt-2">
                    <table class="w-full text-left text-sm">
                        <thead>
                            <tr class="border-b border-gray-600">
                                <th class="p-2">Data</th>
                                <th class="p-2">Descrição</th>
                                <th class="p-2">Tipo</th>
                                <th class="p-2 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${user.movimentacoes.map(tx => `
                                <tr class="border-b border-gray-700">
                                    <td class="p-2">${new Date(tx.data_transacao).toLocaleDateString('pt-BR')}</td>
                                    <td class="p-2">${tx.descricao}</td>
                                    <td class="p-2">${tx.tipo}</td>
                                    <td class="p-2 text-right">R$ ${Number(tx.valor).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const planClass = user.plano === 'premium' ? 'text-gold font-semibold' : 'text-gray-400';
        detailView.innerHTML = `
            <button id="back-to-list-btn" class="text-primary-light hover:underline mb-6"><i class="fas fa-arrow-left mr-2"></i>Voltar para a lista</button>
            <div class="bg-surface p-6 rounded-xl">
                <div class="flex flex-col md:flex-row justify-between md:items-center">
                    <div>
                        <h2 class="2xl font-bold">${user.nome}</h2>
                        <p class="text-gray-400">${user.email}</p>
                        <p class="mt-1">Plano: <span class="${planClass}">${user.plano.charAt(0).toUpperCase() + user.plano.slice(1)}</span></p>
                    </div>
                    <div class="flex space-x-2 mt-4 md:mt-0">
                        <button onclick="openPremiumGrantModal('${user.id}', '${user.nome}')" class="bg-gold text-black font-bold py-2 px-4 rounded-lg hover:opacity-80">Conceder Premium</button>
                        <button class="bg-primary py-2 px-4 rounded-lg hover:bg-primary-dark">Editar Dados</button>
                        <button class="bg-danger py-2 px-4 rounded-lg hover:opacity-80">Resetar Senha</button>
                    </div>
                </div>
                <div class="mt-8 border-t border-gray-700 pt-6">
                    <h3 class="text-lg font-semibold">Últimas Movimentações</h3>
                    ${transactionsHtml}
                </div>
            </div>
        `;
        document.getElementById('back-to-list-btn').addEventListener('click', () => {
            detailView.classList.add('hidden');
            document.getElementById('users-list-view').classList.remove('hidden');
        });

    } catch (error) {
        detailView.innerHTML = `<p class="text-center p-8 text-red-400">${error.message}</p>`;
    }
}

function openPremiumGrantModal(userId, userName) {
    const modalContent = document.getElementById('generic-modal-content');
    const modalButtons = document.getElementById('generic-modal-buttons');
    
    document.getElementById('generic-modal-title').textContent = `Conceder Acesso Premium`;
    
    modalContent.innerHTML = `
        <p class="mb-4">Quantos meses de acesso Premium você deseja conceder para <strong>${userName}</strong>?</p>
        <input type="number" id="premium-months-input" min="1" value="1" class="w-full p-2 bg-background rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary">
    `;
    
    modalButtons.innerHTML = `
        <button id="cancel-grant-btn" class="py-2 px-4 text-gray-300 hover:text-white">Cancelar</button>
        <button id="confirm-grant-btn" class="py-2 px-6 bg-primary hover:bg-primary-dark rounded-lg font-medium text-white">Confirmar</button>
    `;

    document.getElementById('cancel-grant-btn').onclick = () => toggleModal('generic-modal', false);
    document.getElementById('confirm-grant-btn').onclick = () => {
        const meses = document.getElementById('premium-months-input').value;
        executePremiumGrant(userId, meses);
    };

    toggleModal('generic-modal', true);
}

async function executePremiumGrant(userId, meses) {
    if (!meses || parseInt(meses) < 1) {
        alert("Por favor, insira um número válido de meses."); // Usar showCustomAlert
        return;
    }
    try {
        // INÍCIO DA ALTERAÇÃO: Correção do endpoint da API para conceder premium
        const response = await fetch(`${API_URL}/collaborators/admin/users/${userId}/grant-premium`, {
        // FIM DA ALTERAÇÃO
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ meses: parseInt(meses) })
        });
        // INÍCIO DA ALTERAÇÃO: Tratamento de erro para token inválido/expirado
        if (response.status === 401 || response.status === 403) {
            logout(); // Redireciona para login com mensagem
            return;
        }
        // FIM DA ALTERAÇÃO
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);
        
        toggleModal('generic-modal', false);
        showCustomAlert('Sucesso', data.message);
        showUserDetails(userId);
    } catch (error) {
        const modalContent = document.getElementById('generic-modal-content');
        modalContent.innerHTML += `<p class="text-red-400 text-sm mt-2">${error.message}</p>`;
    }
}

// --- Lógica de Suporte ---

const priorityMap = {
    normal: { text: 'Normal', color: 'bg-normal' },
    baixa: { text: 'Baixa', color: 'bg-low' },
    alta: { text: 'Alta', color: 'bg-high' },
    urgente: { text: 'Urgente', color: 'bg-urgent' }
};

async function fetchSupportTickets() {
    const container = document.getElementById('tickets-container');
    container.innerHTML = `<p class="text-center text-gray-400">Carregando chamados...</p>`;

    try {
        const response = await fetch(`${API_URL}/collaborators/support/tickets`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // INÍCIO DA ALTERAÇÃO: Tratamento de erro para token inválido/expirado
        if (response.status === 401 || response.status === 403) {
            logout(); // Redireciona para login com mensagem
            return;
        }
        // FIM DA ALTERAÇÃO
        if (!response.ok) throw new Error('Não foi possível carregar os chamados.');
        const tickets = await response.json();
        renderTickets(tickets);
    } catch (error) {
        container.innerHTML = `<p class="text-center text-red-400">${error.message}</p>`;
    }
}

function renderTickets(tickets) {
    const container = document.getElementById('tickets-container');
    container.innerHTML = '';
    if (tickets.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500">Nenhum chamado aberto no momento. Bom trabalho!</p>`;
        return;
    }

    tickets.forEach(ticket => {
        const priority = priorityMap[ticket.prioridade] || { text: 'Normal', color: 'bg-normal' };
        const ticketElement = document.createElement('div');
        ticketElement.className = 'bg-background rounded-lg';
        ticketElement.innerHTML = `
            <div class="ticket-header grid grid-cols-10 gap-4 items-center p-4 cursor-pointer hover:bg-surface/50">
                <div class="col-span-2 md:col-span-1 text-sm text-gray-400">${new Date(ticket.criado_em).toLocaleDateString('pt-BR')}</div>
                <div class="col-span-5 md:col-span-6 font-medium">${ticket.titulo}</div>
                <div class="col-span-3 md:col-span-1 text-sm">${ticket.nome_usuario}</div>
                <div class="hidden md:flex col-span-1 items-center justify-center">
                    <span class="px-2 py-0.5 text-xs rounded-full text-white ${priority.color}">${priority.text}</span>
                </div>
                <div class="col-span-2 md:col-span-1 text-right">
                    <i class="fas fa-chevron-down transition-transform"></i>
                </div>
            </div>
            <div class="details-content">
                <div class="border-t border-gray-700 p-4">
                    <h4 class="font-bold mb-2">Detalhes do Chamado</h4>
                    <p class="text-gray-300 mb-4 whitespace-pre-wrap">${ticket.descricao}</p>
                    <div class="text-sm text-gray-400 mb-4">
                        <p><strong>Cliente:</strong> ${ticket.nome_usuario}</p>
                        <p><strong>Email:</strong> ${ticket.email_usuario}</p>
                    </div>
                    <button onclick="markTicketAsComplete('${ticket.id}')" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">
                        Marcar como Concluída
                    </button>
                </div>
            </div>
        `;
        container.appendChild(ticketElement);
    });

    document.querySelectorAll('.ticket-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.fa-chevron-down');
            
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
                icon.classList.remove('rotate-180');
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
                icon.classList.add('rotate-180');
            }
        });
    });
}

async function markTicketAsComplete(ticketId) {
    const confirmed = await showCustomAlert('Confirmar Conclusão', 'Tem certeza que deseja marcar este chamado como concluído?', 'confirm');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/collaborators/support/tickets/${ticketId}/complete`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // INÍCIO DA ALTERAÇÃO: Tratamento de erro para token inválido/expirado
        if (response.status === 401 || response.status === 403) {
            logout(); // Redireciona para login com mensagem
            return;
        }
        // FIM DA ALTERAÇÃO
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Não foi possível concluir o chamado.');
        }
        await showCustomAlert('Sucesso!', 'O chamado foi marcado como concluído.');
        fetchSupportTickets();
    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}

// --- Lógica de Gestão ---
async function fetchManagementData() {
    const container = document.getElementById('management-container');
    container.innerHTML = '';

    if (userCargo === 'adm') {
        container.innerHTML = `
            <h2 class="text-2xl font-semibold mb-4">Estatísticas de Suporte por Colaborador</h2>
            <div id="support-stats-container"><p class="text-center text-gray-400">Carregando estatísticas...</p></div>
        `;
        fetchSupportStats();
    } else {
        container.innerHTML = `<p class="text-center text-gray-500">Você não tem permissão para visualizar esta seção.</p>`;
    }
}

async function fetchSupportStats() {
    const container = document.getElementById('support-stats-container');
    try {
        const response = await fetch(`${API_URL}/collaborators/support/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // INÍCIO DA ALTERAÇÃO: Tratamento de erro para token inválido/expirado
        if (response.status === 401 || response.status === 403) {
            logout(); // Redireciona para login com mensagem
            return;
        }
        // FIM DA ALTERAÇÃO
        if (!response.ok) throw new Error('Não foi possível carregar as estatísticas de suporte.');
        const stats = await response.json();
        
        let statsHtml = '<div class="space-y-4 text-left">';
        stats.forEach(collab => {
            statsHtml += `
                <details class="bg-background p-3 rounded-lg">
                    <summary class="font-medium cursor-pointer flex justify-between">
                        <span>${collab.nome_colaborador}</span>
                        <span class="text-primary">${collab.tickets_resolvidos.length} resolvido(s)</span>
                    </summary>
                    <div class="border-t border-gray-700 mt-2 pt-2 pl-2 text-sm space-y-1">
                        ${collab.tickets_resolvidos.length > 0 ? 
                            // Adicionada a data de resolução
                            collab.tickets_resolvidos.map(t => `
                                <div class="flex justify-between items-center">
                                    <p class="text-gray-400 truncate" title="${t.titulo}">- ${t.titulo}</p>
                                    <span class="text-xs text-gray-500 flex-shrink-0 ml-4">${new Date(t.data_resolucao).toLocaleDateString('pt-BR')}</span>
                                </div>
                            `).join('') :
                            '<p class="text-gray-500">Nenhum chamado resolvido.</p>'
                        }
                    </div>
                </details>
            `;
        });
        statsHtml += '</div>';
        container.innerHTML = statsHtml;

    } catch (error) {
        container.innerHTML = `<p class="text-red-400">${error.message}</p>`;
    }
}


// --- Logout ---
document.getElementById('logout-button').addEventListener('click', logout);

// --- Funções Utilitárias ---
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.toggle('hidden', !show);
}

function showCustomAlert(title, message, type = 'alert') {
    return new Promise((resolve) => {
        const modal = document.getElementById('generic-modal');
        const modalTitle = document.getElementById('generic-modal-title');
        const modalContent = document.getElementById('generic-modal-content');
        const modalButtons = document.getElementById('generic-modal-buttons');
        
        modalTitle.textContent = title;
        modalContent.innerHTML = `<p>${message}</p>`;
        
        modalButtons.innerHTML = '';
        if (type === 'confirm') {
            modalButtons.innerHTML = `
                <button id="cancel-alert-btn" class="py-2 px-4 text-gray-300 hover:text-white">Cancelar</button>
                <button id="ok-alert-btn" class="py-2 px-6 bg-primary hover:bg-primary-dark rounded-lg font-medium text-white">Confirmar</button>
            `;
            document.getElementById('ok-alert-btn').onclick = () => { toggleModal('generic-modal', false); resolve(true); };
            document.getElementById('cancel-alert-btn').onclick = () => { toggleModal('generic-modal', false); resolve(false); };
        } else {
            modalButtons.innerHTML = `<button id="ok-alert-btn" class="py-2 px-6 bg-primary hover:bg-primary-dark rounded-lg font-medium text-white">OK</button>`;
            document.getElementById('ok-alert-btn').onclick = () => { toggleModal('generic-modal', false); resolve(true); };
        }
        
        toggleModal('generic-modal', true);
    });
}


// --- Inicialização ---
fetchDashboardStats();
fetchChartData();


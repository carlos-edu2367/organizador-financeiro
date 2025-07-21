// --- INÍCIO DA ALTERAÇÃO ---
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
// --- FIM DA ALTERAÇÃO ---

// --- ELEMENTOS DO DOM ---
const loadingState = document.getElementById('loading-state');
const mainContent = document.getElementById('main-content');
const groupNameEl = document.getElementById('group-name');
const groupPlanEl = document.getElementById('group-plan');
const membersListEl = document.getElementById('members-list');
const inviteButton = document.getElementById('invite-button');
const upgradeCard = document.getElementById('upgrade-card');
const monthFilter = document.getElementById('month-filter');
const statsContainer = document.getElementById('stats-container');

// --- VARIÁVEIS GLOBAIS ---
let groupData = null;
let currentUserId = null;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadGroupData();
    adjustDashboardLinks();
});

function setupEventListeners() {
    monthFilter.addEventListener('change', renderMemberStats);
    inviteButton.addEventListener('click', handleInviteClick);
    document.getElementById('close-invite-modal')?.addEventListener('click', () => toggleModal('invite-modal', false));
    document.getElementById('copy-invite-link-button')?.addEventListener('click', copyInviteLink);
}

// --- LÓGICA DE DADOS (API) ---

async function loadGroupData() {
    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');
    if (!token || !groupId) {
        window.location.href = '../auth/login_page.html';
        return;
    }

    try {
        // Fetch dashboard data to get member list and current user ID
        const dashboardResponse = await fetch(`${API_URL}/api/groups/${groupId}/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!dashboardResponse.ok) throw new Error('Falha ao carregar dados do grupo.');
        groupData = await dashboardResponse.json();
        currentUserId = groupData.current_user_id;

        populateMonthFilter();
        renderGroupInfo();
        renderMemberStats();

        loadingState.classList.add('hidden');
        mainContent.classList.remove('hidden');

    } catch (error) {
        loadingState.innerHTML = `<p class="text-red-400">${error.message}</p>`;
    }
}

async function handleInviteClick() {
    const token = localStorage.getItem('accessToken');
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
        inviteLinkInput.value = fullLink;
        toggleModal('invite-modal', true);

    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}

async function handleRemoveMember(memberId) {
    const confirmed = await showCustomAlert('Confirmar Remoção', 'Você tem certeza que quer remover este membro do grupo?', 'confirm');
    if (!confirmed) return;

    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');

    try {
        const response = await fetch(`${API_URL}/api/groups/${groupId}/members/${memberId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Não foi possível remover o membro.');
        }
        await loadGroupData(); // Recarrega todos os dados
    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}


// --- LÓGICA DE RENDERIZAÇÃO ---

function renderGroupInfo() {
    groupNameEl.textContent = groupData.nome_grupo;
    groupPlanEl.textContent = `Plano: ${groupData.plano.charAt(0).toUpperCase() + groupData.plano.slice(1)}`;

    membersListEl.innerHTML = '';
    const currentUserIsOwner = groupData.membros.find(m => m.id === currentUserId)?.papel === 'dono';
    
    groupData.membros.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'flex items-center justify-between bg-background p-3 rounded-lg';
        
        let removeButtonHtml = '';
        if (currentUserIsOwner && member.id !== currentUserId) {
            removeButtonHtml = `<button onclick="handleRemoveMember('${member.id}')" class="text-gray-500 hover:text-danger" title="Remover membro"><i class="fas fa-trash"></i></button>`;
        }

        memberDiv.innerHTML = `
            <div class="flex items-center">
                <div class="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center font-bold text-black mr-3">${member.nome.charAt(0)}</div>
                <div>
                    <p class="font-medium">${member.nome}</p>
                    <p class="text-xs text-gray-400">${member.papel === 'dono' ? 'Dono' : 'Membro'}</p>
                </div>
            </div>
            ${removeButtonHtml}
        `;
        membersListEl.appendChild(memberDiv);
    });
    
    // Lógica para exibir o botão de convite ou o card de upgrade
    const memberLimit = groupData.plano === 'premium' ? 4 : 2;
    if (groupData.membros.length >= memberLimit) {
        inviteButton.classList.add('hidden');
        if (groupData.plano === 'gratuito') {
            upgradeCard.classList.remove('hidden');
        }
    } else {
        inviteButton.classList.remove('hidden');
        upgradeCard.classList.add('hidden');
    }
}

function populateMonthFilter() {
    monthFilter.innerHTML = '';
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        const option = document.createElement('option');
        option.value = `${year}-${month + 1}`;
        option.textContent = `${months[month]} de ${year}`;
        monthFilter.appendChild(option);
    }
}

async function renderMemberStats() {
    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');
    const [year, month] = monthFilter.value.split('-');
    
    statsContainer.innerHTML = '<p>A carregar estatísticas...</p>';

    try {
        const response = await fetch(`${API_URL}/api/groups/${groupId}/stats?year=${year}&month=${month}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Não foi possível carregar as estatísticas.');
        const stats = await response.json();
        
        statsContainer.innerHTML = '';
        if (stats.length === 0) {
            statsContainer.innerHTML = '<p class="text-center text-gray-500">Nenhuma atividade registrada para este mês.</p>';
            return;
        }

        stats.forEach(memberStat => {
            const statCard = document.createElement('div');
            statCard.className = 'bg-background p-4 rounded-lg';
            statCard.innerHTML = `
                <h3 class="font-bold text-lg mb-3">${memberStat.member_name}</h3>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                        <p class="text-sm text-gray-400">Ganhos</p>
                        <p class="text-xl font-semibold text-gain">R$ ${memberStat.ganhos.toFixed(2)}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-400">Gastos</p>
                        <p class="text-xl font-semibold text-danger">R$ ${memberStat.gastos.toFixed(2)}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-400">Investimentos</p>
                        <p class="text-xl font-semibold text-investment">R$ ${memberStat.investimentos.toFixed(2)}</p>
                    </div>
                </div>
            `;
            statsContainer.appendChild(statCard);
        });

    } catch (error) {
        statsContainer.innerHTML = `<p class="text-red-400">${error.message}</p>`;
    }
}


// --- FUNÇÕES UTILITÁRIAS ---

function adjustDashboardLinks() {
    const plan = localStorage.getItem('userPlan');
    const dashboardUrl = plan === 'premium' ? './dashboard_premium.html' : './dashboard_free.html';
    document.getElementById('header-dashboard-link').href = dashboardUrl;
    document.getElementById('back-to-dashboard').href = dashboardUrl;
}

async function copyInviteLink() {
    const inviteLinkInput = document.getElementById('invite-link-input');
    try {
        await navigator.clipboard.writeText(inviteLinkInput.value);
        await showCustomAlert('Copiado!', 'O link de convite foi copiado para a área de transferência.');
    } catch (err) {
        document.execCommand('copy');
        await showCustomAlert('Copiado!', 'O link de convite foi copiado para a área de transferência.');
    }
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
            confirmButton.className = 'py-2 px-6 bg-danger hover:opacity-80 rounded-lg font-medium text-white';
            confirmButton.textContent = 'Confirmar';
            confirmButton.onclick = () => { toggleModal('generic-modal', false); resolve(true); };

            const cancelButton = document.createElement('button');
            cancelButton.className = 'py-2 px-4 text-gray-300 hover:text-white';
            cancelButton.textContent = 'Cancelar';
            cancelButton.onclick = () => { toggleModal('generic-modal', false); resolve(false); };

            modalButtons.appendChild(cancelButton);
            modalButtons.appendChild(confirmButton);
        } else {
            const okButton = document.createElement('button');
            okButton.className = 'py-2 px-6 bg-primary hover:bg-primary-dark rounded-lg font-medium text-white';
            okButton.textContent = 'OK';
            okButton.onclick = () => { toggleModal('generic-modal', false); resolve(true); };
            modalButtons.appendChild(okButton);
        }
        
        toggleModal('generic-modal', true);
    });
}

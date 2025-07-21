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
const userDataForm = document.getElementById('user-data-form');
const userDataFieldset = document.getElementById('user-data-fieldset');
const editUserDataButton = document.getElementById('edit-user-data-button');
const userDataActions = document.getElementById('user-data-actions');
const cancelUserDataButton = document.getElementById('cancel-user-data-button');

const passwordChangeForm = document.getElementById('password-change-form');
const passwordChangeFieldset = document.getElementById('password-change-fieldset');
const editPasswordButton = document.getElementById('edit-password-button');
const passwordChangeActions = document.getElementById('password-change-actions');
const cancelPasswordChangeButton = document.getElementById('cancel-password-change-button');

const deleteAccountButton = document.getElementById('delete-account-button');

const passwordConfirmModal = document.getElementById('password-confirm-modal');
const passwordConfirmForm = document.getElementById('password-confirm-form');
const cancelConfirmButton = document.getElementById('cancel-confirm-button');

const nomeInput = document.getElementById('nome');
const emailInput = document.getElementById('email');

let currentAction = null; // 'edit-data', 'edit-password', 'delete-account'

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchUserData();
    adjustDashboardLinks();
});

function setupEventListeners() {
    // Botões para iniciar uma ação (que requer senha)
    editUserDataButton.addEventListener('click', () => handleEditClick('edit-data'));
    editPasswordButton.addEventListener('click', () => handleEditClick('edit-password'));
    deleteAccountButton.addEventListener('click', () => handleEditClick('delete-account'));

    // Formulário do modal de confirmação de senha
    passwordConfirmForm.addEventListener('submit', handlePasswordConfirmSubmit);
    cancelConfirmButton.addEventListener('click', () => toggleModal('password-confirm-modal', false));
    
    // Formulários principais da página
    userDataForm.addEventListener('submit', handleUserDataFormSubmit);
    passwordChangeForm.addEventListener('submit', handlePasswordChangeFormSubmit);

    // Botões de cancelar edição
    cancelUserDataButton.addEventListener('click', () => disableEditing('edit-data'));
    cancelPasswordChangeButton.addEventListener('click', () => disableEditing('edit-password'));
}

// --- LÓGICA DE DADOS (API) ---

async function fetchUserData() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        window.location.href = '../auth/login_page.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Não foi possível carregar os dados do usuário.');
        const user = await response.json();
        nomeInput.value = user.nome;
        emailInput.value = user.email;
    } catch (error) {
        showCustomAlert('Erro', error.message);
    }
}

async function handlePasswordConfirmSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('accessToken');
    const password = document.getElementById('modal-password').value;
    const errorMessage = document.getElementById('modal-error-message');
    const submitButton = passwordConfirmForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = 'Verificando...';
    errorMessage.classList.add('hidden');

    try {
        const response = await fetch(`${API_URL}/api/users/verify-password`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Erro ao verificar senha.');

        if (data.verified) {
            toggleModal('password-confirm-modal', false);
            passwordConfirmForm.reset();
            executeCurrentAction();
        } else {
            throw new Error('Senha incorreta.');
        }

    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('hidden');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

async function handleUserDataFormSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('accessToken');
    const updatedData = {
        nome: nomeInput.value,
        email: emailInput.value
    };

    try {
        const response = await fetch(`${API_URL}/api/users/me`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);
        
        await showCustomAlert('Sucesso', 'Seus dados foram atualizados.');
        disableEditing('edit-data');
    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}

async function handlePasswordChangeFormSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('accessToken');
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        await showCustomAlert('Erro', 'As novas senhas não coincidem.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/users/me/password`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        await showCustomAlert('Sucesso', 'Sua senha foi alterada.');
        passwordChangeForm.reset();
        disableEditing('edit-password');

    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}

async function handleDeleteAccount() {
    const confirmed = await showCustomAlert('Confirmar Exclusão', 'Você tem certeza ABSOLUTA que quer apagar sua conta? Todos os seus dados, grupos e transações serão perdidos para sempre.', 'confirm');
    if (!confirmed) return;

    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(`${API_URL}/api/users/me`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
             const data = await response.json();
             throw new Error(data.detail);
        }
        
        await showCustomAlert('Conta Apagada', 'Sua conta foi apagada com sucesso. Sentiremos sua falta!');
        localStorage.clear();
        window.location.href = '../../index.html';

    } catch (error) {
        await showCustomAlert('Erro', error.message);
    }
}


// --- LÓGICA DE UI ---

function handleEditClick(action) {
    currentAction = action;
    toggleModal('password-confirm-modal', true);
    document.getElementById('modal-password').focus();
}

function executeCurrentAction() {
    if (currentAction === 'edit-data') {
        enableEditing('edit-data');
    } else if (currentAction === 'edit-password') {
        enableEditing('edit-password');
    } else if (currentAction === 'delete-account') {
        handleDeleteAccount();
    }
    currentAction = null;
}

function enableEditing(section) {
    if (section === 'edit-data') {
        userDataFieldset.disabled = false;
        editUserDataButton.classList.add('hidden');
        userDataActions.classList.remove('hidden');
    } else if (section === 'edit-password') {
        passwordChangeFieldset.disabled = false;
        editPasswordButton.classList.add('hidden');
        passwordChangeActions.classList.remove('hidden');
    }
}

function disableEditing(section) {
    if (section === 'edit-data') {
        userDataFieldset.disabled = true;
        editUserDataButton.classList.remove('hidden');
        userDataActions.classList.add('hidden');
        fetchUserData(); // Recarrega os dados para reverter qualquer mudança não salva
    } else if (section === 'edit-password') {
        passwordChangeFieldset.disabled = true;
        editPasswordButton.classList.remove('hidden');
        passwordChangeActions.classList.add('hidden');
        passwordChangeForm.reset();
    }
}

function adjustDashboardLinks() {
    const plan = localStorage.getItem('userPlan');
    const dashboardUrl = plan === 'premium' ? './dashboard_premium.html' : './dashboard_free.html';
    document.getElementById('header-dashboard-link').href = dashboardUrl;
    document.getElementById('back-to-dashboard').href = dashboardUrl;
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
            confirmButton.className = 'py-2 px-6 bg-danger hover:opacity-80 rounded-lg font-medium text-white';
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

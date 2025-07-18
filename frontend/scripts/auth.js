const API_URL = 'http://127.0.0.1:8000';

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('cadastro-form');

function showMessage(message, isError = true) {
    const messageContainer = document.getElementById('message-container');
    if (!messageContainer) {
        console.error('Elemento #message-container não encontrado.');
        return;
    }
    messageContainer.textContent = message;
    messageContainer.className = 'p-3 rounded-lg text-center text-sm';
    
    if (isError) {
        messageContainer.classList.add('bg-red-500/20', 'text-red-300');
    } else {
        messageContainer.classList.add('bg-green-500/20', 'text-green-300');
    }
    messageContainer.classList.remove('hidden');
}

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('senha').value;
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        await attemptLogin(formData);
    });
}

/**
 * (NOVO) Tenta fazer o login com lógica de nova tentativa.
 * @param {URLSearchParams} formData - Os dados do formulário de login.
 * @param {number} retries - O número de tentativas restantes.
 */
async function attemptLogin(formData, retries = 3) {
    try {
        const response = await fetch(`${API_URL}/token`, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Erro ao fazer login.');
        
        localStorage.setItem('accessToken', data.access_token);
        await fetchUserSessionAndRedirect();
    } catch (error) {
        if (retries > 0) {
            console.warn(`Falha no login, tentando novamente em 3 segundos... (${retries} tentativas restantes)`);
            showMessage('Conexão instável. Tentando reconectar...', true);
            await new Promise(res => setTimeout(res, 3000));
            await attemptLogin(formData, retries - 1);
        } else {
            showMessage(error.message);
        }
    }
}

async function fetchUserSessionAndRedirect(retries = 3) {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (!response.ok) {
             const userData = await response.json().catch(() => ({}));
             throw new Error(userData.detail || 'Sessão inválida.');
        }

        const userData = await response.json();

        if (userData.grupo_id) {
            localStorage.setItem('activeGroupId', userData.grupo_id);
        } else {
            showMessage('Não foi possível encontrar o seu grupo. Contate o suporte.');
            return;
        }

        if (userData.plano === 'premium') {
            window.location.href = '../dashs/dashboard_premium.html';
        } else {
            window.location.href = '../dashs/dashboard_free.html';
        }
    } catch (error) {
         if (retries > 0) {
            console.warn(`Falha ao buscar sessão, tentando novamente em 3 segundos... (${retries} tentativas restantes)`);
            showMessage('Verificando sessão...', false);
            await new Promise(res => setTimeout(res, 3000));
            await fetchUserSessionAndRedirect(retries - 1);
        } else {
            showMessage(error.message);
            localStorage.removeItem('accessToken');
        }
    }
}

if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const nome = document.getElementById('nome').value;
        const email = document.getElementById('email').value;
        const senha = document.getElementById('senha').value;
        const userData = { nome, email, senha };

        await attemptRegistration(userData);
    });
}

/**
 * (NOVO) Tenta registrar um novo usuário com lógica de nova tentativa.
 * @param {object} userData - Os dados do usuário.
 * @param {number} retries - O número de tentativas restantes.
 */
async function attemptRegistration(userData, retries = 3) {
     try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Erro ao criar conta.');

        showMessage('Conta criada com sucesso! Redirecionando para o login...', false);
        setTimeout(() => { window.location.href = './login_page.html'; }, 2000);
    } catch (error) {
        if (retries > 0) {
            console.warn(`Falha no registro, tentando novamente em 3 segundos... (${retries} tentativas restantes)`);
            showMessage('Conexão instável. Tentando registrar...', true);
            await new Promise(res => setTimeout(res, 3000));
            await attemptRegistration(userData, retries - 1);
        } else {
            showMessage(error.message);
        }
    }
}

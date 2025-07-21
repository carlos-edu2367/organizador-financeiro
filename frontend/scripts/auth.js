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

// Define a URL base da API dinamicamente.
const API_URL = getApiBaseUrl();
// --- FIM DA ALTERAÇÃO ---


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
 * Tenta fazer o login com lógica de nova tentativa aprimorada.
 * @param {URLSearchParams} formData - Os dados do formulário de login.
 * @param {number} retries - O número de tentativas restantes.
 */
async function attemptLogin(formData, retries = 3) {
    try {
        // --- INÍCIO DA ALTERAÇÃO ---
        // Garante que o prefixo /api seja incluído na URL.
        const response = await fetch(`${API_URL}/api/token`, {
        // --- FIM DA ALTERAÇÃO ---
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
        });

        if (response.status === 401) {
            const data = await response.json();
            showMessage(data.detail || 'E-mail ou senha incorretos.');
            return;
        }
        
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || `Erro do servidor: ${response.status}`);
        }

        const data = await response.json();
        localStorage.setItem('accessToken', data.access_token);
        
        // Redirecionamento após login bem-sucedido
        const pendingInvite = localStorage.getItem('pendingInviteToken');
        if (pendingInvite) {
            localStorage.removeItem('pendingInviteToken');
            window.location.href = `./accept_invite.html?token=${pendingInvite}`;
        } else {
            // Busca os dados do usuário para saber para qual dashboard redirecionar
            const userResponse = await fetch(`${API_URL}/api/users/me`, {
                 headers: { 'Authorization': `Bearer ${data.access_token}` }
            });
            const userData = await userResponse.json();
            localStorage.setItem('userPlan', userData.plano);
            localStorage.setItem('activeGroupId', userData.grupo_id);

            if (userData.plano === 'premium') {
                window.location.href = '../dashs/dashboard_premium.html';
            } else {
                window.location.href = '../dashs/dashboard_free.html';
            }
        }
    } catch (error) {
        if (retries > 0) {
            console.warn(`Falha no login, tentando novamente em 3 segundos... (${retries} tentativas restantes)`);
            showMessage('Conexão instável. Tentando conectar...', true);
            await new Promise(res => setTimeout(res, 3000));
            await attemptLogin(formData, retries - 1);
        } else {
            const finalMessage = error.message.includes('Failed to fetch') ? 'Não foi possível conectar ao servidor.' : error.message;
            showMessage(finalMessage);
        }
    }
}


if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userData = {
            nome: document.getElementById('nome').value,
            email: document.getElementById('email').value,
            senha: document.getElementById('senha').value,
        };
        await attemptRegistration(userData);
    });
}

/**
 * Tenta registrar um novo usuário com lógica de nova tentativa.
 * @param {object} userData - Os dados do usuário para registro.
 * @param {number} retries - O número de tentativas restantes.
 */
async function attemptRegistration(userData, retries = 3) {
     try {
        // --- INÍCIO DA ALTERAÇÃO ---
        // Garante que o prefixo /api seja incluído na URL.
        const response = await fetch(`${API_URL}/api/register`, {
        // --- FIM DA ALTERAÇÃO ---
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });

        if (response.status === 400) {
            const data = await response.json();
            showMessage(data.detail || 'Erro nos dados fornecidos.');
            return;
        }
        
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || `Erro do servidor: ${response.status}`);
        }

        showMessage('Conta criada com sucesso! Redirecionando para o login...', false);
        setTimeout(() => { window.location.href = './login_page.html'; }, 2000);
    } catch (error) {
        if (retries > 0) {
            console.warn(`Falha no registro, tentando novamente em 3 segundos... (${retries} tentativas restantes)`);
            showMessage('Conexão instável. Tentando registrar...', true);
            await new Promise(res => setTimeout(res, 3000));
            await attemptRegistration(userData, retries - 1);
        } else {
            const finalMessage = error.message.includes('Failed to fetch') ? 'Não foi possível conectar ao servidor.' : error.message;
            showMessage(finalMessage);
        }
    }
}

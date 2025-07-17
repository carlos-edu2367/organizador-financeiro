// Define a URL base da sua API. Facilita a alteração se mudar de ambiente.
const API_URL = 'http://127.0.0.1:8000';

// Seleciona os formulários de login e registo pelos seus IDs.
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('cadastro-form');

/**
 * Função para mostrar mensagens de erro ou sucesso ao utilizador.
 * @param {string} message - A mensagem a ser exibida.
 * @param {boolean} isError - Se a mensagem é de erro (true) ou sucesso (false).
 */
function showMessage(message, isError = true) {
    const messageContainer = document.getElementById('message-container');
    if (!messageContainer) {
        console.error('Elemento #message-container não encontrado.');
        return;
    }
    messageContainer.textContent = message;
    messageContainer.className = 'p-3 rounded-lg text-center text-sm'; // Reset classes
    
    if (isError) {
        messageContainer.classList.add('bg-red-500/20', 'text-red-300');
    } else {
        messageContainer.classList.add('bg-green-500/20', 'text-green-300');
    }
    messageContainer.classList.remove('hidden');
}

// Adiciona um "ouvinte" ao formulário de login.
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        // Impede o comportamento padrão do formulário de recarregar a página.
        event.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('senha').value;

        // O FastAPI espera os dados de login como 'form data', não como JSON.
        const formData = new URLSearchParams();
        formData.append('username', email); // O endpoint espera 'username'
        formData.append('password', password);

        try {
            // Faz a chamada POST para o endpoint /token
            const response = await fetch(`${API_URL}/token`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                // Se a resposta não for OK (ex: 401 Unauthorized), mostra o erro.
                throw new Error(data.detail || 'Erro ao fazer login.');
            }

            // Se o login for bem-sucedido, guarda o token no localStorage.
            localStorage.setItem('accessToken', data.access_token);
            
            // Agora, busca os dados do utilizador para saber para onde redirecionar.
            await fetchUserDetails();

        } catch (error) {
            showMessage(error.message);
        }
    });
}

/**
 * Busca os detalhes do utilizador autenticado e redireciona para o dashboard correto.
 */
async function fetchUserDetails() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        showMessage('Nenhum token de acesso encontrado.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const userData = await response.json();

        if (!response.ok) {
            throw new Error(userData.detail || 'Sessão inválida. Faça login novamente.');
        }

        // Redireciona com base no plano do grupo do utilizador.
        if (userData.plano === 'premium') {
            window.location.href = '../dashs/dashboard_premium.html';
        } else {
            window.location.href = '../dashs/dashboard_free.html';
        }

    } catch (error) {
        showMessage(error.message);
        // Limpa o token inválido se a chamada falhar.
        localStorage.removeItem('accessToken');
    }
}


// Adiciona um "ouvinte" ao formulário de registo.
if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nome').value;
        const email = document.getElementById('email').value;
        const senha = document.getElementById('senha').value;

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nome, email, senha }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Erro ao criar conta.');
            }

            showMessage('Conta criada com sucesso! A redirecionar para o login...', false);

            // Aguarda um pouco e redireciona para a página de login.
            setTimeout(() => {
                window.location.href = './login_page.html';
            }, 2000);

        } catch (error) {
            showMessage(error.message);
        }
    });
}

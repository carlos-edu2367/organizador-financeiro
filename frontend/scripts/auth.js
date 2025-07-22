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

// Função para validar a força da senha no frontend
function validatePasswordStrength(password) {
    if (password.length < 8) {
        return 'A senha deve ter pelo menos 8 caracteres.';
    }
    if (!/[A-Z]/.test(password)) {
        return 'A senha deve conter pelo menos uma letra maiúscula.';
    }
    if (!/[a-z]/.test(password)) {
        return 'A senha deve conter pelo menos uma letra minúscula.';
    }
    if (!/\d/.test(password)) {
        return 'A senha deve conter pelo menos um número.';
    }
    // Caracteres especiais: !@#$%^&*()_+-=[]{}|;':",.<>/?`~
    if (!/[!@#$%^&*()_+\-=\[\]{}|;':",.<>/?`~]/.test(password)) {
        return 'A senha deve conter pelo menos um caractere especial.';
    }
    return null; // Senha válida
}


// --- Lógica para a página de Login ---
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const senha = document.getElementById('senha').value;
        const submitButton = loginForm.querySelector('button[type="submit"]');

        submitButton.disabled = true;
        submitButton.textContent = 'Entrando...';
        showMessage('', false); // Limpa mensagens anteriores

        try {
            const response = await fetch(`${API_URL}/api/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, // OAuth2PasswordRequestForm espera este Content-Type
                body: new URLSearchParams({ username: email, password: senha }).toString(),
            });

            const data = await response.json();
            if (!response.ok) {
                // INÍCIO DA ALTERAÇÃO: Melhor tratamento de erros para 422 e outros
                let errorMessage = 'Erro no login.';
                if (response.status === 422 && data.detail && Array.isArray(data.detail)) {
                    // Pydantic validation errors
                    const passwordErrorDetail = data.detail.find(d => d.loc && d.loc.includes('password'));
                    if (passwordErrorDetail) {
                        errorMessage = passwordErrorDetail.msg;
                    } else {
                        errorMessage = data.detail[0].msg || 'Erro de validação.';
                    }
                } else if (data.detail) {
                    errorMessage = data.detail;
                }
                throw new Error(errorMessage);
                // FIM DA ALTERAÇÃO
            } else {
                localStorage.setItem('accessToken', data.access_token);
                // Busca os dados do usuário para determinar o dashboard correto e o ID do grupo
                const userResponse = await fetch(`${API_URL}/api/users/me`, {
                    headers: { 'Authorization': `Bearer ${data.access_token}` }
                });
                if (!userResponse.ok) {
                    throw new Error('Falha ao carregar dados do usuário após o login.');
                }
                const userData = await userResponse.json();
                localStorage.setItem('userPlan', userData.plano);
                localStorage.setItem('activeGroupId', userData.grupo_id);

                showMessage('Login bem-sucedido! Redirecionando...', false);
                setTimeout(() => {
                    const dashboardUrl = userData.plano === 'premium' ? '../dashs/dashboard_premium.html' : '../dashs/dashboard_free.html';
                    // Verifica se há um token de convite pendente
                    const pendingInviteToken = localStorage.getItem('pendingInviteToken');
                    if (pendingInviteToken) {
                        // Se houver, redireciona para a página de aceitar convite
                        window.location.href = `./accept_invite.html?token=${pendingInviteToken}`;
                        localStorage.removeItem('pendingInviteToken'); // Limpa o token pendente
                    } else {
                        // Caso contrário, redireciona para o dashboard normal
                        window.location.href = dashboardUrl;
                    }
                }, 1000);
            }

        } catch (error) {
            // INÍCIO DA ALTERAÇÃO: Tratamento genérico de erro para garantir que a mensagem seja string
            let displayMessage = 'Ocorreu um erro inesperado.';
            if (error instanceof Error) {
                displayMessage = error.message;
            } else if (typeof error === 'string') {
                displayMessage = error;
            } else if (error && typeof error === 'object' && error.detail) {
                // Caso o erro seja um objeto com a propriedade 'detail'
                if (Array.isArray(error.detail) && error.detail.length > 0) {
                    displayMessage = error.detail[0].msg || 'Erro de validação.';
                } else if (typeof error.detail === 'string') {
                    displayMessage = error.detail;
                }
            }
            // Mensagem para falha de conexão
            if (displayMessage.includes('Failed to fetch')) {
                displayMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
            }
            showMessage(displayMessage, true);
            // FIM DA ALTERAÇÃO
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Entrar';
        }
    });
}


// --- Lógica para a página de Cadastro ---
if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const nome = document.getElementById('nome').value;
        const email = document.getElementById('email').value;
        const senha = document.getElementById('senha').value;
        const submitButton = registerForm.querySelector('button[type="submit"]');

        // Validação de senha no frontend
        const passwordError = validatePasswordStrength(senha);
        if (passwordError) {
            showMessage(passwordError, true);
            return;
        }

        const userData = { nome, email, senha };

        submitButton.disabled = true;
        submitButton.textContent = 'Criando conta...';
        showMessage('', false); // Limpa mensagens anteriores

        try {
            const response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });

            // INÍCIO DA ALTERAÇÃO: Melhor tratamento de erros para 400, 422 e outros
            let errorMessage = 'Erro no registro.';
            if (!response.ok) {
                const data = await response.json().catch(() => ({})); // Tenta parsear JSON mesmo em erro
                
                if (response.status === 400) {
                    errorMessage = data.detail || 'Erro nos dados fornecidos.';
                } else if (response.status === 422 && data.detail && Array.isArray(data.detail)) {
                    // Pydantic validation errors
                    const passwordErrorDetail = data.detail.find(d => d.loc && d.loc.includes('senha'));
                    if (passwordErrorDetail) {
                        errorMessage = passwordErrorDetail.msg;
                    } else {
                        errorMessage = data.detail[0].msg || 'Erro de validação nos dados fornecidos.';
                    }
                } else if (data.detail) {
                    errorMessage = data.detail;
                } else {
                    errorMessage = `Erro do servidor: ${response.status}`;
                }
                throw new Error(errorMessage);
            }
            // FIM DA ALTERAÇÃO

            showMessage('Conta criada com sucesso! Redirecionando para o login...', false);
            setTimeout(() => { window.location.href = './login_page.html'; }, 2000);
        } catch (error) {
            // INÍCIO DA ALTERAÇÃO: Tratamento genérico de erro para garantir que a mensagem seja string
            let displayMessage = 'Ocorreu um erro inesperado.';
            if (error instanceof Error) {
                displayMessage = error.message;
            } else if (typeof error === 'string') {
                displayMessage = error;
            } else if (error && typeof error === 'object' && error.detail) {
                // Caso o erro seja um objeto com a propriedade 'detail'
                if (Array.isArray(error.detail) && error.detail.length > 0) {
                    displayMessage = error.detail[0].msg || 'Erro de validação.';
                } else if (typeof error.detail === 'string') {
                    displayMessage = error.detail;
                }
            }
            // Mensagem para falha de conexão
            if (displayMessage.includes('Failed to fetch')) {
                displayMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
            }
            showMessage(displayMessage, true);
            // FIM DA ALTERAÇÃO
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Criar conta';
        }
    });
}

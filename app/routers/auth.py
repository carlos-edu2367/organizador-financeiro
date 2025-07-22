from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request # Importado Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import secrets
import logging # INÍCIO DA ALTERAÇÃO: Importa o módulo logging

# INÍCIO DA ALTERAÇÃO: Importações e variáveis para Rate Limiting
import time
from collections import defaultdict
from threading import Lock

# Dicionário em memória para armazenar tentativas de login por IP para usuários
login_attempts_cache_users = defaultdict(list)
# Lock para garantir thread-safety
cache_lock_users = Lock()

# Configurações do Rate Limiter para usuários
MAX_LOGIN_ATTEMPTS_USERS = 5  # Número máximo de tentativas de login permitidas
LOGIN_ATTEMPT_WINDOW_SECONDS_USERS = 60 # Janela de tempo em segundos (1 minuto)

# Configurações para Rate Limiter de recuperação de senha
MAX_RECOVERY_ATTEMPTS = 3
RECOVERY_ATTEMPT_WINDOW_SECONDS = 300 # 5 minutos
recovery_attempts_cache = defaultdict(list)
recovery_cache_lock = Lock()
# FIM DA ALTERAÇÃO

# INÍCIO DA ALTERAÇÃO: Configura o logger
logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
# FIM DA ALTERAÇÃO

from .. import database, schemas, models, security
from ..utils import send_email_with_template # Importa a nova função de envio de e-mail

router = APIRouter(
    prefix="/api",
    tags=['Authentication']
)

# INÍCIO DA ALTERAÇÃO: Função de dependência para Rate Limiting de login de usuários
def rate_limit_user_login(request: Request):
    """
    Dependência que implementa um Rate Limiter para tentativas de login de usuários.
    """
    client_ip = request.client.host
    current_time = time.time()

    with cache_lock_users:
        login_attempts_cache_users[client_ip] = [
            t for t in login_attempts_cache_users[client_ip] if t > current_time - LOGIN_ATTEMPT_WINDOW_SECONDS_USERS
        ]

        if len(login_attempts_cache_users[client_ip]) >= MAX_LOGIN_ATTEMPTS_USERS:
            logger.warning(f"RATE_LIMIT: IP '{client_ip}' excedeu o limite de tentativas de login de usuário.")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Muitas tentativas de login. Tente novamente em {LOGIN_ATTEMPT_WINDOW_SECONDS_USERS} segundos."
            )
        
        login_attempts_cache_users[client_ip].append(current_time)

# Função de dependência para Rate Limiting de recuperação de senha
def rate_limit_recovery(request: Request):
    """
    Dependência que implementa um Rate Limiter para tentativas de recuperação de senha.
    """
    client_ip = request.client.host
    current_time = time.time()

    with recovery_cache_lock:
        recovery_attempts_cache[client_ip] = [
            t for t in recovery_attempts_cache[client_ip] if t > current_time - RECOVERY_ATTEMPT_WINDOW_SECONDS
        ]

        if len(recovery_attempts_cache[client_ip]) >= MAX_RECOVERY_ATTEMPTS:
            logger.warning(f"RATE_LIMIT: IP '{client_ip}' excedeu o limite de tentativas de recuperação de senha.")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Muitas tentativas de recuperação de senha. Tente novamente em {RECOVERY_ATTEMPT_WINDOW_SECONDS} segundos."
            )
        
        recovery_attempts_cache[client_ip].append(current_time)
# FIM DA ALTERAÇÃO

def generate_recovery_code():
    """Gera um código numérico seguro de 6 dígitos."""
    return str(secrets.randbelow(1_000_000)).zfill(6)

@router.post("/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED) # Adicionado status_code
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    """
    Registra um novo usuário no sistema.
    """
    db_user = db.query(models.Usuario).filter(models.Usuario.email == user.email).first()
    if db_user:
        logger.warning(f"REGISTER_FAILED: Tentativa de registro com e-mail já existente: {user.email}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="E-mail já registado.")
    
    hashed_password = security.get_password_hash(user.senha)
    db_user = models.Usuario(email=user.email, nome=user.nome, senha=hashed_password)
    
    # Cria um novo grupo para o usuário e o associa como dono
    new_group = models.Grupo(nome=f"Grupo de {user.nome}")
    association = models.GrupoMembro(grupo=new_group, papel='dono')
    db_user.associacoes_grupo.append(association)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    logger.info(f"REGISTER_SUCCESS: Novo usuário registrado: '{db_user.id}' ({db_user.email})")
    return db_user

# INÍCIO DA ALTERAÇÃO: Adicionada a dependência de Rate Limiting ao endpoint de login
@router.post("/token", dependencies=[Depends(rate_limit_user_login)], response_model=schemas.Token)
# FIM DA ALTERAÇÃO
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """
    Endpoint para login de usuários.
    Autentica o usuário e retorna um token JWT.
    """
    user = db.query(models.Usuario).filter(models.Usuario.email == form_data.username).first()
    
    if not user or not security.verify_password(form_data.password, user.senha):
        logger.warning(f"LOGIN_FAILED: Tentativa de login falha para e-mail: {form_data.username}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos", headers={"WWW-Authenticate": "Bearer"})
    
    access_token = security.create_access_token(data={"sub": user.email})
    logger.info(f"LOGIN_SUCCESS: Usuário '{user.id}' ({user.email}) logado com sucesso.")
    return {"access_token": access_token, "token_type": "bearer"}

# --- INÍCIO DA ALTERAÇÃO: Endpoints de recuperação de senha com Rate Limiting e Logs ---

@router.post("/forgot-password", dependencies=[Depends(rate_limit_recovery)])
def forgot_password(
    request: schemas.ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    """
    Inicia o processo de recuperação de senha enviando um código para o e-mail do usuário.
    """
    user = db.query(models.Usuario).filter(models.Usuario.email == request.email).first()
    if user:
        recovery_code = generate_recovery_code()
        
        user.reset_token = recovery_code
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=30)
        db.commit()
        
        background_tasks.add_task(
            send_email_with_template,
            to_email=user.email,
            template_id="d-071823dc7d8f4f029320139679a5a977",
            template_data={
                "nome_usuario": user.nome,
                "codigo_recuperacao": recovery_code,
                "tempo_expiracao": "30 minutos"
            }
        )
        logger.info(f"PASSWORD_RECOVERY_INIT: Código de recuperação enviado para usuário '{user.id}' ({user.email}).")
    else:
        # Para evitar enumeração de usuários, logamos mas retornamos a mesma mensagem
        logger.info(f"PASSWORD_RECOVERY_ATTEMPT_UNKNOWN_EMAIL: Tentativa de recuperação de senha para e-mail não registrado: {request.email}")

    return {"message": "Se um usuário com este e-mail existir, um código de recuperação será enviado."}

@router.post("/verify-code", dependencies=[Depends(rate_limit_recovery)])
def verify_code(request: schemas.VerifyCodeRequest, db: Session = Depends(database.get_db)):
    """
    Verifica se o código de recuperação de senha fornecido é válido.
    """
    user = db.query(models.Usuario).filter(models.Usuario.email == request.email).first()
    
    if not user:
        logger.warning(f"VERIFY_CODE_FAILED: Tentativa de verificação de código para e-mail não existente: {request.email}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido ou expirado.")

    if user.reset_token != request.code or user.reset_token_expires < datetime.now(timezone.utc):
        logger.warning(f"VERIFY_CODE_FAILED: Código inválido ou expirado para usuário '{user.id}' ({user.email}).")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido ou expirado.")
    
    logger.info(f"VERIFY_CODE_SUCCESS: Código de recuperação verificado com sucesso para usuário '{user.id}' ({user.email}).")
    return {"message": "Código verificado com sucesso."}

@router.post("/reset-password", dependencies=[Depends(rate_limit_recovery)])
def reset_password(request: schemas.ResetPasswordRequest, db: Session = Depends(database.get_db)):
    """
    Redefine a senha do usuário após a verificação bem-sucedida do código.
    """
    user = db.query(models.Usuario).filter(models.Usuario.email == request.email).first()
    
    if not user:
        logger.warning(f"RESET_PASSWORD_FAILED: Tentativa de redefinição de senha para e-mail não existente: {request.email}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido ou expirado.")

    if user.reset_token != request.code or user.reset_token_expires < datetime.now(timezone.utc):
        logger.warning(f"RESET_PASSWORD_FAILED: Código inválido ou expirado durante redefinição de senha para usuário '{user.id}' ({user.email}).")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido ou expirado.")

    user.senha = security.get_password_hash(request.new_password)
    user.reset_token = None # Limpa o token de reset após o uso
    user.reset_token_expires = None # Limpa a expiração
    db.commit()
    logger.info(f"RESET_PASSWORD_SUCCESS: Senha redefinida com sucesso para usuário '{user.id}' ({user.email}).")

    return {"message": "Senha redefinida com sucesso."}

# --- FIM DA ALTERAÇÃO ---


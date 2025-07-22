from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings
from . import database, models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Esquema para clientes
oauth2_scheme_user = OAuth2PasswordBearer(tokenUrl="/api/token")

# NOVO: Esquema para colaboradores
oauth2_scheme_collaborator = OAuth2PasswordBearer(tokenUrl="/collaborators/token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha em texto puro corresponde à senha hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Gera um hash bcrypt para a senha fornecida."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, is_collaborator: bool = False):
    """
    Cria um token de acesso JWT.
    Permite definir um tempo de expiração diferente para colaboradores.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Usa o tempo de expiração específico para colaboradores se for um token de colaborador
        if is_collaborator:
            expire = datetime.now(timezone.utc) + timedelta(minutes=settings.COLLABORATOR_ACCESS_TOKEN_EXPIRE_MINUTES)
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_user_from_token(token: str = Depends(oauth2_scheme_user), db: Session = Depends(database.get_db)):
    """
    Dependência para obter o usuário (cliente) autenticado a partir do token JWT.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        # Captura erros de JWT (token expirado, inválido, etc.)
        raise credentials_exception
    
    user = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# NOVO: Função para obter o colaborador atual logado
def get_current_collaborator(token: str = Depends(oauth2_scheme_collaborator), db: Session = Depends(database.get_db)):
    """
    Dependência para obter o colaborador autenticado a partir do token JWT.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais de colaborador inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        collaborator_id: str = payload.get("sub")
        scope: str = payload.get("scope")
        # Verifica se o ID do colaborador está presente e se o escopo é 'collaborator'
        if collaborator_id is None or scope != "collaborator":
            raise credentials_exception
    except JWTError:
        # Captura erros de JWT (token expirado, inválido, etc.)
        raise credentials_exception
    
    collaborator = db.query(models.Colaborador).filter(models.Colaborador.id == collaborator_id).first()
    if collaborator is None:
        raise credentials_exception
    return collaborator


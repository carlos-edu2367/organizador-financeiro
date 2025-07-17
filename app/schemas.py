import uuid
import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional, List

# ==================
# Schemas para Token
# ==================
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[EmailStr] = None

# ==================
# Schemas para Utilizador
# ==================
class UserBase(BaseModel):
    email: EmailStr
    nome: str

class UserCreate(UserBase):
    senha: str

class User(UserBase):
    id: uuid.UUID
    
    class Config:
        from_attributes = True

# CORREÇÃO: Esta classe estava em falta.
# Schema para a resposta de /users/me, que inclui o plano e o ID do grupo.
class UserSessionData(User):
    plano: str
    grupo_id: Optional[uuid.UUID] = None

# ==================
# Schemas para o Dashboard
# ==================

class Movimentacao(BaseModel):
    """ Schema para exibir uma movimentação no histórico. """
    id: uuid.UUID
    tipo: str
    descricao: Optional[str]
    valor: float
    data_transacao: datetime.datetime
    responsavel_nome: str # Adicionamos o nome para fácil exibição

    class Config:
        from_attributes = True

class GrupoMembro(BaseModel):
    """ Schema para exibir um membro do grupo. """
    id: uuid.UUID
    nome: str
    
    class Config:
        from_attributes = True

class Meta(BaseModel):
    """ Schema para exibir a meta ativa. """
    titulo: str
    valor_meta: float
    valor_atual: float
    
    class Config:
        from_attributes = True

class DashboardData(BaseModel):
    """
    Schema principal que agrega todos os dados
    necessários para renderizar o dashboard.
    """
    nome_utilizador: str
    nome_grupo: str
    plano: str
    membros: List[GrupoMembro]
    movimentacoes_recentes: List[Movimentacao]
    meta_ativa: Optional[Meta] = None

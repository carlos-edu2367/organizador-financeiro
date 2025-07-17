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

class UserSessionData(User):
    plano: str
    grupo_id: Optional[uuid.UUID] = None

# ==================
# Schemas para Metas (NOVO E ATUALIZADO)
# ==================
class GoalCreate(BaseModel):
    """ Schema para validar os dados de criação de uma nova meta. """
    titulo: str
    valor_meta: float
    data_limite: Optional[datetime.date] = None

class Meta(BaseModel):
    """ Schema para exibir a meta ativa. """
    titulo: str
    valor_meta: float
    valor_atual: float
    
    class Config:
        from_attributes = True

# ==================
# Schemas para o Dashboard
# ==================
class Movimentacao(BaseModel):
    id: uuid.UUID
    tipo: str
    descricao: Optional[str]
    valor: float
    data_transacao: datetime.datetime
    responsavel_nome: str

    class Config:
        from_attributes = True

class GrupoMembro(BaseModel):
    id: uuid.UUID
    nome: str
    
    class Config:
        from_attributes = True

class DashboardData(BaseModel):
    nome_utilizador: str
    nome_grupo: str
    plano: str
    membros: List[GrupoMembro]
    movimentacoes_recentes: List[Movimentacao]
    meta_ativa: Optional[Meta] = None

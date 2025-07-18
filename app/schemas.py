import uuid
import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from decimal import Decimal # Adicionado

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
# Schemas para Metas
# ==================
class GoalBase(BaseModel):
    titulo: str
    # CORREÇÃO: Usando Decimal para precisão financeira.
    valor_meta: Decimal = Field(..., max_digits=10, decimal_places=2, gt=0)
    data_limite: Optional[datetime.date] = None

class GoalCreate(GoalBase):
    pass

class GoalUpdate(GoalBase):
    pass

class GoalAddFunds(BaseModel):
    # CORREÇÃO: Usando Decimal para precisão financeira.
    valor: Decimal = Field(..., max_digits=10, decimal_places=2, gt=0)

class GoalWithdrawFunds(BaseModel):
    # CORREÇÃO: Usando Decimal para precisão financeira.
    valor: Decimal = Field(..., max_digits=10, decimal_places=2, gt=0)

class Meta(GoalBase):
    id: uuid.UUID
    # CORREÇÃO: Usando Decimal para precisão financeira.
    valor_atual: Decimal
    status: str
    
    class Config:
        from_attributes = True

# ==================
# Schemas para Transações (Movimentações)
# ==================
class TransactionBase(BaseModel):
    """ Schema base para uma transação. """
    tipo: str
    descricao: Optional[str] = None
    # CORREÇÃO: Usando Decimal para precisão financeira.
    valor: Decimal = Field(..., max_digits=10, decimal_places=2, gt=0)
    data_transacao: datetime.date
    responsavel_id: uuid.UUID

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(TransactionBase):
    pass

class Movimentacao(BaseModel):
    """ Schema para exibir uma movimentação no histórico. """
    id: uuid.UUID
    tipo: str
    descricao: Optional[str]
    # CORREÇÃO: Usando Decimal para precisão financeira.
    valor: Decimal
    data_transacao: datetime.datetime
    responsavel_nome: str

    class Config:
        from_attributes = True

# ==================
# (NOVO) Schema para Conquistas
# ==================
class Conquista(BaseModel):
    id: uuid.UUID
    tipo_medalha: str
    descricao: str
    data_conquista: datetime.datetime

    class Config:
        from_attributes = True

# ==================
# Schemas para o Grupo e Dashboard
# ==================
class GrupoMembro(BaseModel):
    id: uuid.UUID
    nome: str
    papel: str
    
    class Config:
        from_attributes = True

class DashboardData(BaseModel):
    current_user_id: uuid.UUID
    nome_utilizador: str
    nome_grupo: str
    plano: str
    membros: List[GrupoMembro]
    movimentacoes_recentes: List[Movimentacao]
    meta_ativa: Optional[Meta] = None
    # CORREÇÃO: Usando Decimal para precisão financeira.
    total_investido: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    saldo_total: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    # (NOVO) Adiciona a lista de conquistas recentes ao dashboard.
    conquistas_recentes: List[Conquista] = []

class InviteLink(BaseModel):
    invite_link: str

# ==================
# Schemas para o Gráfico
# ==================
class ChartMonthData(BaseModel):
    mes: str
    # CORREÇÃO: Usando float aqui é aceitável, pois é apenas para exibição no gráfico.
    ganhos: float
    gastos: float
    investimentos: float
    saldo: float

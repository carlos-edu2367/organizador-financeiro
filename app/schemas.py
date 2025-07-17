import uuid
import datetime
from pydantic import BaseModel, EmailStr, Field
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
# Schemas para Metas
# ==================
class GoalBase(BaseModel):
    titulo: str
    valor_meta: float
    data_limite: Optional[datetime.date] = None

class GoalCreate(GoalBase):
    pass

class GoalUpdate(GoalBase):
    pass

class GoalAddFunds(BaseModel):
    valor: float = Field(..., gt=0)

class GoalWithdrawFunds(BaseModel):
    valor: float = Field(..., gt=0)

class Meta(GoalBase):
    id: uuid.UUID
    valor_atual: float
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
    valor: float = Field(..., gt=0)
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
    valor: float
    data_transacao: datetime.datetime
    responsavel_nome: str

    class Config:
        from_attributes = True

# ==================
# Schemas para o Grupo e Dashboard
# ==================
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
    total_investido: float = 0.0
    # ATUALIZAÇÃO: 'juros_estimados' foi substituído por 'saldo_total'.
    saldo_total: float = 0.0

# ==================
# Schemas para o Gráfico
# ==================
class ChartMonthData(BaseModel):
    mes: str
    ganhos: float
    gastos: float
    investimentos: float
    saldo: float

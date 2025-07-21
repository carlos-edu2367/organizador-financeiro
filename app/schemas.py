import uuid
import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from decimal import Decimal
from .models import CargoColaboradorEnum

# --- Schemas de Cliente (existentes) ---
class Token(BaseModel):
    access_token: str
    token_type: str
class TokenData(BaseModel):
    email: Optional[EmailStr] = None
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
class UserUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
class PasswordVerify(BaseModel):
    password: str
class PasswordVerifyResponse(BaseModel):
    verified: bool
class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str
class GoalBase(BaseModel):
    titulo: str
    valor_meta: Decimal = Field(..., max_digits=10, decimal_places=2, gt=0)
    data_limite: Optional[datetime.date] = None
class GoalCreate(GoalBase): pass
class GoalUpdate(GoalBase): pass
class GoalAddFunds(BaseModel):
    valor: Decimal = Field(..., max_digits=10, decimal_places=2, gt=0)
class GoalWithdrawFunds(BaseModel):
    valor: Decimal = Field(..., max_digits=10, decimal_places=2, gt=0)
class Meta(GoalBase):
    id: uuid.UUID
    valor_atual: Decimal
    status: str
    class Config:
        from_attributes = True
class TransactionBase(BaseModel):
    tipo: str
    descricao: Optional[str] = None
    valor: Decimal = Field(..., max_digits=10, decimal_places=2, gt=0)
    data_transacao: datetime.date
    responsavel_id: uuid.UUID
class TransactionCreate(TransactionBase): pass
class TransactionUpdate(BaseModel):
    tipo: Optional[str] = None
    descricao: Optional[str] = None
    valor: Optional[Decimal] = Field(None, max_digits=10, decimal_places=2, gt=0)
    data_transacao: Optional[datetime.date] = None
class Movimentacao(BaseModel):
    id: uuid.UUID
    tipo: str
    descricao: Optional[str]
    valor: Decimal
    data_transacao: datetime.datetime
    responsavel_nome: str
    class Config:
        from_attributes = True
class Conquista(BaseModel):
    id: uuid.UUID
    tipo_medalha: str
    descricao: str
    data_conquista: datetime.datetime
    class Config:
        from_attributes = True
class ParsedTransaction(BaseModel):
    tipo: str
    valor: float
    descricao: str
class ParsedTransactionResponse(BaseModel):
    transactions: List[ParsedTransaction]
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
    total_investido: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    saldo_total: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    conquistas_recentes: List[Conquista] = []
    ganhos_mes_atual: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    gastos_mes_atual: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    ai_usage_count_today: int = 0
    ai_first_usage_timestamp_today: Optional[datetime.datetime] = None
class InviteLink(BaseModel):
    invite_link: str
class MemberStats(BaseModel):
    member_id: uuid.UUID
    member_name: str
    ganhos: float
    gastos: float
    investimentos: float
class ChartMonthData(BaseModel):
    mes: str
    ganhos: float
    gastos: float
    investimentos: float
    saldo: float

# --- Schemas de Colaborador (existentes) ---
class ColaboradorBase(BaseModel):
    nome: str
    email: EmailStr
    cpf: str
class ColaboradorCreate(ColaboradorBase):
    senha: str
    cargo: CargoColaboradorEnum
    endereco: Optional[str] = None
    sexo: Optional[str] = None
class Colaborador(ColaboradorBase):
    id: uuid.UUID
    cargo: CargoColaboradorEnum
    class Config:
        from_attributes = True
class ColaboradorLogin(BaseModel):
    login: str
    senha: str
class ColaboradorTokenData(BaseModel):
    sub: str
class DashboardStats(BaseModel):
    total_usuarios: int
    total_premium: int
    novos_hoje: int
    novos_semana: int
    novos_mes: int
    # NOVO: Campo para novos usuários no ano
    novos_ano: int
class SuporteChamado(BaseModel):
    id: uuid.UUID
    titulo: str
    status: str
    prioridade: str
    criado_em: datetime.datetime
    nome_usuario: str
    class Config:
        from_attributes = True

# --- Schemas para Gerenciamento de Usuários (Admin) ---
class AdminUserList(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    criado_em: datetime.datetime
    plano: str
    class Config:
        from_attributes = True
class AdminUserDetails(AdminUserList):
    movimentacoes: List[Movimentacao]
    class Config:
        from_attributes = True
class AdminUserUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
class AdminPasswordUpdate(BaseModel):
    nova_senha: str
class AdminGrantPremium(BaseModel):
    meses: int = Field(..., gt=0)

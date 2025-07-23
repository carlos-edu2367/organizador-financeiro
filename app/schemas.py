import uuid
import datetime
from pydantic import BaseModel, EmailStr, Field, constr, field_validator # INÍCIO DA ALTERAÇÃO: Importa field_validator
from typing import Optional, List, Annotated
from decimal import Decimal
from .models import CargoColaboradorEnum

# Define um tipo de senha forte reutilizável
# Removemos o 'pattern' daqui para usar um validador personalizado
StrongPassword = Annotated[
    str,
    Field(min_length=8) # Define apenas o comprimento mínimo aqui
]

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
    senha: StrongPassword

    # INÍCIO DA ALTERAÇÃO: Adiciona um validador de campo para a senha
    @field_validator('senha')
    @classmethod
    def validate_strong_password(cls, v: str):
        if not any(char.isupper() for char in v):
            raise ValueError('A senha deve conter pelo menos uma letra maiúscula.')
        if not any(char.islower() for char in v):
            raise ValueError('A senha deve conter pelo menos uma letra minúscula.')
        if not any(char.isdigit() for char in v):
            raise ValueError('A senha deve conter pelo menos um número.')
        if not any(char in "!@#$%^&*()_+-=[]{}|;':\",.<>/?`~" for char in v): # Lista de caracteres especiais
            raise ValueError('A senha deve conter pelo menos um caractere especial.')
        return v
    # FIM DA ALTERAÇÃO

class User(BaseModel):
    id: uuid.UUID
    email: EmailStr
    nome: str
    class Config:
        from_attributes = True
class UserSessionData(BaseModel):
    id: uuid.UUID
    email: EmailStr
    nome: str
    plano: str
    grupo_id: Optional[uuid.UUID]
    
    class Config:
        from_attributes = True
class UserUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
class PasswordVerify(BaseModel):
    password: str
class PasswordVerifyResponse(BaseModel):
    verified: bool
class PasswordUpdate(BaseModel):
    current_password: str
    new_password: StrongPassword

    # INÍCIO DA ALTERAÇÃO: Adiciona o validador de campo para a nova senha
    @field_validator('new_password')
    @classmethod
    def validate_new_strong_password(cls, v: str):
        if not any(char.isupper() for char in v):
            raise ValueError('A nova senha deve conter pelo menos uma letra maiúscula.')
        if not any(char.islower() for char in v):
            raise ValueError('A nova senha deve conter pelo menos uma letra minúscula.')
        if not any(char.isdigit() for char in v):
            raise ValueError('A nova senha deve conter pelo menos um número.')
        if not any(char in "!@#$%^&*()_+-=[]{}|;':\",.<>/?`~" for char in v): # Lista de caracteres especiais
            raise ValueError('A nova senha deve conter pelo menos um caractere especial.')
        return v
    # FIM DA ALTERAÇÃO

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: StrongPassword

    # INÍCIO DA ALTERAÇÃO: Adiciona o validador de campo para a nova senha
    @field_validator('new_password')
    @classmethod
    def validate_reset_strong_password(cls, v: str):
        if not any(char.isupper() for char in v):
            raise ValueError('A nova senha deve conter pelo menos uma letra maiúscula.')
        if not any(char.islower() for char in v):
            raise ValueError('A nova senha deve conter pelo menos uma letra minúscula.')
        if not any(char.isdigit() for char in v):
            raise ValueError('A nova senha deve conter pelo menos um número.')
        if not any(char in "!@#$%^&*()_+-=[]{}|;':\",.<>/?`~" for char in v): # Lista de caracteres especiais
            raise ValueError('A nova senha deve conter pelo menos um caractere especial.')
        return v
    # FIM DA ALTERAÇÃO

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

class MembroInfo(BaseModel):
    id: uuid.UUID
    nome: str
    papel: str

class DashboardData(BaseModel):
    current_user_id: uuid.UUID
    nome_utilizador: str
    nome_grupo: str
    plano: str
    membros: List[MembroInfo]
    movimentacoes_recentes: List[Movimentacao]
    meta_ativa: Optional[Meta] = None
    total_investido: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    saldo_total: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    conquistas_recentes: List[Conquista] = []
    ganhos_mes_atual: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    gastos_mes_atual: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    # --- INÍCIO DA ALTERAÇÃO: Adicionados campos para a lógica do mascote ---
    ganhos_ultimos_30dias: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    gastos_ultimos_30dias: Decimal = Field(default=0.0, max_digits=10, decimal_places=2)
    # --- FIM DA ALTERAÇÃO ---
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

# --- Schemas de Colaborador ---
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
class ChartDataPoint(BaseModel):
    label: str
    new_users: int
    new_premiums: int
class DashboardChartData(BaseModel):
    data: List[ChartDataPoint]

# --- Schemas para Suporte ---
class SuporteChamadoCreate(BaseModel):
    titulo: str = Field(..., min_length=5, max_length=100)
    descricao: str = Field(..., min_length=10, max_length=1000)
    prioridade: str = "normal"

class SuporteChamado(BaseModel):
    id: uuid.UUID
    titulo: str
    descricao: str
    status: str
    prioridade: str
    criado_em: datetime.datetime
    nome_usuario: str
    email_usuario: EmailStr
    resolvido_por: Optional[str] = None

    class Config:
        from_attributes = True

class TicketInfo(BaseModel):
    id: uuid.UUID
    titulo: str
    data_resolucao: datetime.datetime

class SuporteStats(BaseModel):
    colaborador_id: uuid.UUID
    nome_colaborador: str
    tickets_resolvidos: List[TicketInfo]

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

# --- Schemas para Pagamentos Agendados ---
class PagamentoAgendadoBase(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=100)
    descricao: Optional[str] = None
    valor: Optional[Decimal] = Field(None, max_digits=10, decimal_places=2, gt=0)
    data_vencimento: datetime.date

class PagamentoAgendadoCreate(PagamentoAgendadoBase):
    pass

# --- INÍCIO DA ALTERAÇÃO: Novo schema para atualização ---
class PagamentoAgendadoUpdate(BaseModel):
    titulo: Optional[str] = Field(None, min_length=3, max_length=100)
    descricao: Optional[str] = None
    valor: Optional[Decimal] = Field(None, max_digits=10, decimal_places=2, gt=0)
    data_vencimento: Optional[datetime.date] = None
# --- FIM DA ALTERAÇÃO ---

class PagamentoAgendado(PagamentoAgendadoBase):
    id: uuid.UUID
    status: str
    data_criacao: datetime.datetime
    data_pagamento: Optional[datetime.datetime] = None
    
    class Config:
        from_attributes = True

import uuid
import enum
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey,
    DECIMAL, Date, Enum as SQLAlchemyEnum, Integer
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

# --- Modelos de Cliente ---

class TipoMedalhaEnum(str, enum.Enum):
    bronze = "Bronze"
    prata = "Prata"
    ouro = "Ouro"
    platina = "Platina"
    diamante = "Diamante"

class GrupoMembro(Base):
    __tablename__ = 'grupo_membros'
    usuario_id = Column(UUID(as_uuid=True), ForeignKey('usuarios.id', ondelete="CASCADE"), primary_key=True)
    grupo_id = Column(UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), primary_key=True)
    papel = Column(String(20), nullable=False, default='membro')
    data_entrada = Column(DateTime(timezone=True), server_default=func.now())
    usuario = relationship("Usuario", back_populates="associacoes_grupo")
    grupo = relationship("Grupo", back_populates="associacoes_membros")

class Usuario(Base):
    __tablename__ = 'usuarios'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    senha = Column(Text, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    associacoes_grupo = relationship("GrupoMembro", back_populates="usuario", cascade="all, delete-orphan")
    movimentacoes = relationship("Movimentacao", back_populates="responsavel")

class Grupo(Base):
    __tablename__ = 'grupos'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(100), nullable=False)
    plano = Column(String(20), nullable=False, default='gratuito') # Mantido para compatibilidade
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    meses_positivos_consecutivos = Column(Integer, nullable=False, default=0)
    associacoes_membros = relationship("GrupoMembro", back_populates="grupo", cascade="all, delete-orphan")
    movimentacoes = relationship("Movimentacao", back_populates="grupo", cascade="all, delete-orphan")
    metas = relationship("Meta", back_populates="grupo", cascade="all, delete-orphan")
    convites = relationship("Convite", back_populates="grupo", cascade="all, delete-orphan")
    conquistas = relationship("Conquista", back_populates="grupo", cascade="all, delete-orphan", order_by="desc(Conquista.data_conquista)")
    ai_usages = relationship("AIUsage", back_populates="grupo", cascade="all, delete-orphan")
    # NOVO: Relacionamento com a tabela de assinaturas
    assinatura = relationship("Assinatura", back_populates="grupo", uselist=False, cascade="all, delete-orphan")
    @property
    def member_list(self):
        return [assoc.usuario for assoc in self.associacoes_membros]

# NOVO: Tabela para gerenciar assinaturas Premium
class Assinatura(Base):
    __tablename__ = 'assinaturas'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id = Column(UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), unique=True, nullable=False)
    status = Column(String(50), nullable=False, default='ativa') # ex: ativa, expirada, cancelada
    data_fim = Column(DateTime(timezone=True), nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), onupdate=func.now())
    grupo = relationship("Grupo", back_populates="assinatura")

class Movimentacao(Base):
    __tablename__ = 'movimentacoes'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id = Column(UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), nullable=False)
    responsavel_id = Column(UUID(as_uuid=True), ForeignKey('usuarios.id'), nullable=False)
    tipo = Column(String(20), nullable=False)
    descricao = Column(Text)
    valor = Column(DECIMAL(10, 2), nullable=False)
    data_transacao = Column(DateTime(timezone=True), server_default=func.now())
    grupo = relationship("Grupo", back_populates="movimentacoes")
    responsavel = relationship("Usuario", back_populates="movimentacoes")

class Meta(Base):
    __tablename__ = 'metas'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id = Column(UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), nullable=False)
    titulo = Column(String(100), nullable=False)
    valor_meta = Column(DECIMAL(10, 2), nullable=False)
    valor_atual = Column(DECIMAL(10, 2), nullable=False, default=0.00)
    data_limite = Column(Date)
    status = Column(String(20), nullable=False, default='ativa')
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    grupo = relationship("Grupo", back_populates="metas")

class Convite(Base):
    __tablename__ = 'convites'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id = Column(UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    status = Column(String(20), nullable=False, default='pendente')
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    grupo = relationship("Grupo", back_populates="convites")

class Conquista(Base):
    __tablename__ = 'conquistas'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id = Column(UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), nullable=False)
    tipo_medalha = Column(SQLAlchemyEnum(TipoMedalhaEnum, name="tipomedalhaenum"), nullable=False)
    descricao = Column(Text, nullable=False)
    data_conquista = Column(DateTime(timezone=True), server_default=func.now())
    grupo = relationship("Grupo", back_populates="conquistas")

class AIUsage(Base):
    __tablename__ = 'ai_usage'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id = Column(UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    grupo = relationship("Grupo", back_populates="ai_usages")

# --- Modelos de Colaborador ---

class CargoColaboradorEnum(str, enum.Enum):
    adm = "adm"
    dev = "dev"
    suporte = "suporte"

class Colaborador(Base):
    __tablename__ = 'colaboradores'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    cpf = Column(String(14), unique=True, nullable=False, index=True)
    senha = Column(Text, nullable=False)
    cargo = Column(SQLAlchemyEnum(CargoColaboradorEnum, name="cargocolaboradorenum"), nullable=False)
    endereco = Column(Text)
    sexo = Column(String(20))
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    chamados_atribuidos = relationship("SuporteChamado", back_populates="atribuido_a")

class SuporteChamado(Base):
    __tablename__ = 'suporte_chamados'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey('usuarios.id'), nullable=False)
    colaborador_id = Column(UUID(as_uuid=True), ForeignKey('colaboradores.id'), nullable=True)
    titulo = Column(String(200), nullable=False)
    descricao = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default='aberto')
    prioridade = Column(String(50), nullable=False, default='normal')
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), onupdate=func.now())
    
    usuario = relationship("Usuario")
    atribuido_a = relationship("Colaborador", back_populates="chamados_atribuidos")

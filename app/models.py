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
    plano = Column(String(20), nullable=False, default='gratuito')
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    meses_positivos_consecutivos = Column(Integer, nullable=False, default=0)

    associacoes_membros = relationship("GrupoMembro", back_populates="grupo", cascade="all, delete-orphan")
    assinatura = relationship("Assinatura", back_populates="grupo", uselist=False, cascade="all, delete-orphan")
    movimentacoes = relationship("Movimentacao", back_populates="grupo", cascade="all, delete-orphan")
    metas = relationship("Meta", back_populates="grupo", cascade="all, delete-orphan")
    convites = relationship("Convite", back_populates="grupo", cascade="all, delete-orphan")
    conquistas = relationship("Conquista", back_populates="grupo", cascade="all, delete-orphan", order_by="desc(Conquista.data_conquista)")
    
    ai_usages = relationship("AIUsage", back_populates="grupo", cascade="all, delete-orphan")
    
    @property
    def membros(self):
        return [assoc.usuario for assoc in self.associacoes_membros]


class Assinatura(Base):
    __tablename__ = 'assinaturas'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id = Column(UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), unique=True, nullable=False)
    gateway_customer_id = Column(String(255), nullable=False)
    gateway_subscription_id = Column(String(255), unique=True, nullable=False)
    status = Column(String(50), nullable=False)
    periodo_atual_inicio = Column(DateTime(timezone=True))
    periodo_atual_fim = Column(DateTime(timezone=True))
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

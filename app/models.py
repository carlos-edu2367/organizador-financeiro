import uuid
from sqlalchemy import (
    create_engine, Column, String, Text, DateTime, ForeignKey,
    DECIMAL, Date, Table
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

# Base declarativa do SQLAlchemy. Todas as nossas classes de modelo herdarão dela.
Base = declarative_base()

# Tabela de associação para a relação Muitos-para-Muitos entre Usuarios e Grupos.
# Não é uma classe de modelo, mas uma tabela auxiliar que o SQLAlchemy usa.
grupo_membros_association = Table(
    'grupo_membros', Base.metadata,
    Column('usuario_id', UUID(as_uuid=True), ForeignKey('usuarios.id', ondelete="CASCADE"), primary_key=True),
    Column('grupo_id', UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), primary_key=True),
    Column('papel', String(20), nullable=False, default='membro'), # 'dono' ou 'membro'
    Column('data_entrada', DateTime(timezone=True), server_default=func.now())
)

class Usuario(Base):
    """
    Modelo para a tabela 'usuarios'.
    Armazena as informações de login e identificação do usuário.
    """
    __tablename__ = 'usuarios'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    senha = Column(Text, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamento: Define a conexão com a tabela de associação.
    # Com isso, podemos acessar os grupos de um usuário com `usuario.grupos`.
    grupos = relationship(
        "Grupo",
        secondary=grupo_membros_association,
        back_populates="membros"
    )
    # Relacionamento: Um usuário pode ter feito várias movimentações.
    movimentacoes = relationship("Movimentacao", back_populates="responsavel")


class Grupo(Base):
    """
    Modelo para a tabela 'grupos'.
    Centraliza as informações de cada grupo financeiro.
    """
    __tablename__ = 'grupos'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(100), nullable=False)
    plano = Column(String(20), nullable=False, default='gratuito')
    criado_em = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamento: Define a conexão com a tabela de associação.
    # Com isso, podemos acessar os membros de um grupo com `grupo.membros`.
    membros = relationship(
        "Usuario",
        secondary=grupo_membros_association,
        back_populates="grupos"
    )
    # Relacionamento: Um grupo tem uma assinatura (ou nenhuma).
    assinatura = relationship("Assinatura", back_populates="grupo", uselist=False, cascade="all, delete-orphan")
    # Relacionamento: Um grupo tem várias movimentações.
    movimentacoes = relationship("Movimentacao", back_populates="grupo", cascade="all, delete-orphan")
    # Relacionamento: Um grupo tem várias metas.
    metas = relationship("Meta", back_populates="grupo", cascade="all, delete-orphan")


class Assinatura(Base):
    """
    Modelo para a tabela 'assinaturas'.
    Gerencia os detalhes de pagamento e status dos planos Premium.
    """
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

    # Relacionamento: Define a conexão de volta para o grupo.
    grupo = relationship("Grupo", back_populates="assinatura")


class Movimentacao(Base):
    """
    Modelo para a tabela 'movimentacoes'.
    Registra cada transação financeira (ganho, gasto, investimento).
    """
    __tablename__ = 'movimentacoes'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id = Column(UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), nullable=False)
    responsavel_id = Column(UUID(as_uuid=True), ForeignKey('usuarios.id'), nullable=False)
    tipo = Column(String(20), nullable=False) # 'ganho', 'gasto', 'investimento'
    descricao = Column(Text)
    valor = Column(DECIMAL(10, 2), nullable=False)
    data_transacao = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamento: Define a conexão de volta para o grupo e o usuário responsável.
    grupo = relationship("Grupo", back_populates="movimentacoes")
    responsavel = relationship("Usuario", back_populates="movimentacoes")


class Meta(Base):
    """
    Modelo para a tabela 'metas'.
    Armazena os objetivos financeiros criados pelos grupos.
    """
    __tablename__ = 'metas'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id = Column(UUID(as_uuid=True), ForeignKey('grupos.id', ondelete="CASCADE"), nullable=False)
    titulo = Column(String(100), nullable=False)
    valor_meta = Column(DECIMAL(10, 2), nullable=False)
    valor_atual = Column(DECIMAL(10, 2), nullable=False, default=0.00)
    data_limite = Column(Date)
    status = Column(String(20), nullable=False, default='ativa') # 'ativa', 'concluida', 'cancelada'
    criado_em = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamento: Define a conexão de volta para o grupo.
    grupo = relationship("Grupo", back_populates="metas")

# Exemplo de como você usaria isso em outro arquivo para criar as tabelas:
# from .database import engine  # Supondo que você tenha um arquivo database.py
# Base.metadata.create_all(bind=engine)

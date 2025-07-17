import uuid
from pydantic import BaseModel, EmailStr
from typing import Optional

# ==================
# Schemas para Token
# ==================
class Token(BaseModel):
    """ Schema para a resposta do token de acesso. """
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """ Schema para os dados contidos dentro do token JWT. """
    email: Optional[EmailStr] = None

# ==================
# Schemas para Usuário
# ==================
class UserBase(BaseModel):
    """ Schema base para o usuário, com campos comuns. """
    email: EmailStr
    nome: str

class UserCreate(UserBase):
    """
    Schema para a criação de um novo usuário.
    Recebe a senha que será hasheada antes de salvar.
    """
    senha: str

class User(UserBase):
    """
    Schema para retornar os dados de um usuário para o cliente.
    Importante: NUNCA inclua a senha na resposta.
    """
    id: uuid.UUID
    
    class Config:
        # Permite que o Pydantic trabalhe com modelos do SQLAlchemy.
        orm_mode = True


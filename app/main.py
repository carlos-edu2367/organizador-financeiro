from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import engine
from .routers import auth, users # Importa o novo router

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Clarify API",
    description="API para o organizador financeiro Clarify.",
    version="0.1.0",
)

origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://127.0.0.1:5500", 
    # Adicione aqui o endereço do seu frontend quando for para produção.
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclui as rotas na aplicação principal.
app.include_router(auth.router)
app.include_router(users.router) # Adiciona o novo router de utilizadores


@app.get("/")
def read_root():
    return {"status": "Clarify API is running!"}


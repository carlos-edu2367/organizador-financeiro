from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import engine
# (ALTERADO) Garante que todos os routers, incluindo o da IA, são importados.
from .routers import auth, users, groups, transactions, tasks, ai

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
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(transactions.router)
app.include_router(tasks.router)
# (NOVO) Adiciona o router de IA à aplicação.
app.include_router(ai.router)


@app.get("/")
def read_root():
    return {"status": "Clarify API is running!"}

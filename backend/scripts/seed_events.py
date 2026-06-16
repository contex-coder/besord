"""Seed de eventos para Lisboa e Porto — Junho/Julho 2026.
Executar localmente: python backend/scripts/seed_events.py
"""

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Adicionar backend/ ao path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from pymongo import MongoClient

SEED_EVENTS = [
    # ── Lisboa ──
    {
        "title": "Feira do Livro de Lisboa",
        "description": "A maior feira literária do país regressa ao Parque Eduardo VII. Centenas de editoras, sessões de autógrafos, debates e espaço infantil.",
        "event_type": "curated",
        "start_date": "2026-06-18T10:00:00Z",
        "end_date": "2026-07-04T22:00:00Z",
        "time": "10:00",
        "location": "Parque Eduardo VII",
        "city": "Lisboa",
        "lat": 38.7274,
        "lon": -9.1525,
        "theme": "Literatura",
        "status": "active",
        "source": "seed",
    },
    {
        "title": "Santos Populares — Arraial de Alfama",
        "description": "Marchas populares, sardinhas assadas, manjericos e música nas ruas de Alfama. O arraial mais autêntico de Lisboa.",
        "event_type": "curated",
        "start_date": "2026-06-19T20:00:00Z",
        "end_date": "2026-06-20T03:00:00Z",
        "time": "20:00",
        "location": "Alfama",
        "city": "Lisboa",
        "lat": 38.7118,
        "lon": -9.1298,
        "theme": "Música",
        "status": "active",
        "source": "seed",
    },
    {
        "title": "MAAT — Exposição Joana Vasconcelos",
        "description": "Retrospectiva da artista portuguesa mais internacional. Instalações imersivas que cruzam arte popular e luxo contemporâneo.",
        "event_type": "curated",
        "start_date": "2026-07-01T10:00:00Z",
        "end_date": "2026-09-30T19:00:00Z",
        "time": "10:00",
        "location": "MAAT — Museu de Arte, Arquitetura e Tecnologia",
        "city": "Lisboa",
        "lat": 38.6952,
        "lon": -9.1948,
        "theme": "Arte",
        "status": "active",
        "source": "seed",
    },
    {
        "title": "Mercado de Santa Clara — Sábado",
        "description": "Mercado semanal de Santa Clara (ao lado da Feira da Ladra). Artesanato, design independente, vinis, roupa vintage e street food.",
        "event_type": "curated",
        "start_date": "2026-06-20T09:00:00Z",
        "end_date": "2026-06-20T18:00:00Z",
        "time": "09:00",
        "location": "Mercado de Santa Clara",
        "city": "Lisboa",
        "lat": 38.7155,
        "lon": -9.1245,
        "theme": "Gastronomia",
        "status": "active",
        "source": "seed",
    },
    {
        "title": "Jazz em Agosto — Gulbenkian",
        "description": "Festival anual de jazz ao ar livre nos jardins da Fundação Calouste Gulbenkian. Programação internacional.",
        "event_type": "curated",
        "start_date": "2026-08-01T21:00:00Z",
        "end_date": "2026-08-15T23:00:00Z",
        "time": "21:00",
        "location": "Jardins Gulbenkian",
        "city": "Lisboa",
        "lat": 38.7374,
        "lon": -9.1543,
        "theme": "Música",
        "status": "active",
        "source": "seed",
    },
    {
        "title": "Noite de Fados — Mesa de Frades",
        "description": "Sessão intimista de fado vadio numa das casas de fado mais autênticas de Alfama. Reservas limitadas.",
        "event_type": "curated",
        "start_date": "2026-06-21T21:30:00Z",
        "end_date": "2026-06-22T01:00:00Z",
        "time": "21:30",
        "location": "Mesa de Frades",
        "city": "Lisboa",
        "lat": 38.7121,
        "lon": -9.1308,
        "theme": "Música",
        "status": "active",
        "source": "seed",
    },
    # ── Porto ──
    {
        "title": "Serralves em Festa",
        "description": "48 horas non-stop de cultura nos jardins de Serralves. Música, teatro, dança, cinema e exposições com entrada gratuita.",
        "event_type": "curated",
        "start_date": "2026-07-04T08:00:00Z",
        "end_date": "2026-07-05T23:59:00Z",
        "time": "08:00",
        "location": "Museu de Serralves",
        "city": "Porto",
        "lat": 41.1591,
        "lon": -8.6593,
        "theme": "Arte",
        "status": "active",
        "source": "seed",
    },
    {
        "title": "Mercado Porto Belo — Sábado",
        "description": "Mercado de artesanato, design e gastronomia na Praça Carlos Alberto. O mercado mais alternativo do Porto.",
        "event_type": "curated",
        "start_date": "2026-06-20T10:00:00Z",
        "end_date": "2026-06-20T19:00:00Z",
        "time": "10:00",
        "location": "Praça Carlos Alberto",
        "city": "Porto",
        "lat": 41.1462,
        "lon": -8.6077,
        "theme": "Gastronomia",
        "status": "active",
        "source": "seed",
    },
    {
        "title": "São João do Porto",
        "description": "A noite mais esperada do ano no Porto. Sardinhadas, martelinhos, alho-porro, fogo de artifício sobre o Douro e festa até de manhã.",
        "event_type": "curated",
        "start_date": "2026-06-23T20:00:00Z",
        "end_date": "2026-06-24T06:00:00Z",
        "time": "20:00",
        "location": "Ribeira do Porto",
        "city": "Porto",
        "lat": 41.1408,
        "lon": -8.6127,
        "theme": "Música",
        "status": "active",
        "source": "seed",
    },
    {
        "title": "Exposição Muralismo — Rua das Flores",
        "description": "Circuito de murais de arte urbana ao longo da Rua das Flores e zona histórica. Artistas convidados renovam as fachadas a cada estação.",
        "event_type": "curated",
        "start_date": "2026-06-20T10:00:00Z",
        "end_date": "2026-08-20T19:00:00Z",
        "time": "10:00",
        "location": "Rua das Flores",
        "city": "Porto",
        "lat": 41.1430,
        "lon": -8.6111,
        "theme": "Arte",
        "status": "active",
        "source": "seed",
    },
]


def seed():
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=10000)
    db_name = os.getenv("DB_NAME", "besord")
    db = client[db_name]

    inserted = 0
    for ev in SEED_EVENTS:
        event_id = f"ev_{uuid.uuid4().hex[:12]}"
        doc = {
            "event_id": event_id,
            "company_id": "curator_seed",
            "company_name": "Curador Besord",
            **ev,
            "checkins": [],
            "checkins_count": 0,
            "posts_count": 0,
            "created_by": "besord_admin",
            "created_at": datetime.now(timezone.utc),
        }
        db.events.insert_one(doc)
        inserted += 1
        print(f"  ✅ {ev['title']}  |  {ev['city']}  |  {ev['start_date'][:10]}")

    print(f"\n{inserted} eventos seed inseridos.")
    client.close()


if __name__ == "__main__":
    seed()

import pandas as pd
from sqlalchemy import create_engine
import os
import sys
from datetime import datetime

# Agrega el path al directorio raíz del proyecto
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from models.model import Base, Pasajero, Vuelo, Asiento, Reserva, Pago
from sqlalchemy.orm import sessionmaker

# Configura tu conexión
DATABASE_URL = "postgresql://postgres:2003@localhost:5432/sistema_de_vuelos"  
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# Crear tablas si no existen
Base.metadata.create_all(engine)


# Limpieza / transformación si es necesario
# Ajusta los nombres de columnas según tu CSV
df['fecha_salida'] = pd.to_datetime(df.get('fecha_salida', None), errors='coerce')
df['fecha_llegada'] = pd.to_datetime(df.get('fecha_llegada', None), errors='coerce')
df['fecha_reserva'] = pd.to_datetime(df.get('fecha_reserva', None), errors='coerce').dt.date
df['fecha_pago'] = pd.to_datetime(df.get('fecha_pago', None), errors='coerce').dt.date
df['disponible'] = df.get('disponible', True).astype(bool)

# Insertar pasajeros
pasajeros = [
    Pasajero(
        nombre=row['nombre'],
        pasaporte=row['pasaporte'],
        telefono=row['telefono']
    )
    for _, row in df.drop_duplicates(subset=['pasaporte']).iterrows()
]
session.bulk_save_objects(pasajeros)
session.commit()

# Mapear pasajeros por pasaporte para usar en reservas
pasajero_map = {p.pasaporte: p.id_pasajero for p in session.query(Pasajero).all()}

# Insertar vuelos
vuelos = [
    Vuelo(
        origen=row['origen'],
        destino=row['destino'],
        fecha_salida=row['fecha_salida'],
        fecha_llegada=row['fecha_llegada'],
        estado=row.get('estado', 'programado')
    )
    for _, row in df.drop_duplicates(subset=['origen', 'destino', 'fecha_salida']).iterrows()
]
session.bulk_save_objects(vuelos)
session.commit()

# Mapear vuelos por origen, destino y fecha_salida para usar en asientos
vuelo_map = {
    (v.origen, v.destino, v.fecha_salida): v.id_vuelo
    for v in session.query(Vuelo).all()
}

# Insertar asientos
asientos = [
    Asiento(
        id_vuelo=vuelo_map.get((row['origen'], row['destino'], row['fecha_salida'])),
        numero_asiento=row['numero_asiento'],
        clase=row['clase'],
        disponible=row['disponible']
    )
    for _, row in df.drop_duplicates(subset=['id_vuelo', 'numero_asiento']).iterrows()
    if vuelo_map.get((row['origen'], row['destino'], row['fecha_salida']))
]
session.bulk_save_objects(asientos)
session.commit()

# Mapear asientos por id_vuelo y numero_asiento para usar en reservas
asiento_map = {
    (a.id_vuelo, a.numero_asiento): a.id_asiento
    for a in session.query(Asiento).all()
}

# Insertar reservas
reservas = [
    Reserva(
        id_pasajero=pasajero_map.get(row['pasaporte']),
        id_asiento=asiento_map.get((
            vuelo_map.get((row['origen'], row['destino'], row['fecha_salida'])),
            row['numero_asiento']
        )),
        fecha_reserva=row['fecha_reserva'],
        estado=row.get('estado_reserva', 'activa')
    )
    for _, row in df.iterrows()
    if pasajero_map.get(row['pasaporte']) and asiento_map.get((
        vuelo_map.get((row['origen'], row['destino'], row['fecha_salida'])),
        row['numero_asiento']
    ))
]
session.bulk_save_objects(reservas)
session.commit()

# Mapear reservas por id_pasajero, id_asiento y fecha_reserva para usar en pagos
reserva_map = {
    (r.id_pasajero, r.id_asiento, r.fecha_reserva): r.id_reserva
    for r in session.query(Reserva).all()
}

# Insertar pagos
pagos = [
    Pago(
        id_reserva=reserva_map.get((
            pasajero_map.get(row['pasaporte']),
            asiento_map.get((
                vuelo_map.get((row['origen'], row['destino'], row['fecha_salida'])),
                row['numero_asiento']
            )),
            row['fecha_reserva']
        )),
        monto=row['monto'],
        fecha_pago=row['fecha_pago'],
        metodo_pago=row['metodo_pago']
    )
    for _, row in df.iterrows()
    if reserva_map.get((
        pasajero_map.get(row['pasaporte']),
        asiento_map.get((
            vuelo_map.get((row['origen'], row['destino'], row['fecha_salida'])),
            row['numero_asiento']
        )),
        row['fecha_reserva']
    ))
]
session.bulk_save_objects(pagos)
session.commit()

print("✅ Migración de datos completada")
session.close()
# Importamos lo necesario
from sqlalchemy import create_engine, Column, Integer, String, Numeric, Date, TIMESTAMP, Boolean, ForeignKey, Enum
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
import enum
from datetime import datetime

# Creamos la base para los modelos
Base = declarative_base()

# Definimos los enums para los estados
class EstadoVuelo(enum.Enum):
    programado = "programado"
    cancelado = "cancelado"
    completado = "completado"

class EstadoReserva(enum.Enum):
    activa = "activa"
    cancelada = "cancelada"

class MetodoPago(enum.Enum):
    tarjeta = "Tarjeta"
    efectivo = "Efectivo"
    transferencia = "Transferencia"

# Modelo: Pasajeros
class Pasajero(Base):
    __tablename__ = "pasajeros"
    id_pasajero = Column(Integer, primary_key=True)
    nombre = Column(String(100), nullable=False)
    pasaporte = Column(String(100), unique=True, nullable=False)
    telefono = Column(String(20))
    reservas = relationship("Reserva", back_populates="pasajero")

# Modelo: Vuelos
class Vuelo(Base):
    __tablename__ = "vuelos"
    id_vuelo = Column(Integer, primary_key=True)
    origen = Column(String(100), nullable=False)
    destino = Column(String(100), nullable=False)
    fecha_salida = Column(TIMESTAMP, nullable=False)
    fecha_llegada = Column(TIMESTAMP, nullable=False)
    estado = Column(Enum(EstadoVuelo), default=EstadoVuelo.programado, nullable=False)
    asientos = relationship("Asiento", back_populates="vuelo")

# Modelo: Asientos
class Asiento(Base):
    __tablename__ = "asientos"
    id_asiento = Column(Integer, primary_key=True)
    id_vuelo = Column(Integer, ForeignKey("vuelos.id_vuelo"), nullable=False)
    numero_asiento = Column(String(10), nullable=False)
    clase = Column(String(20))
    disponible = Column(Boolean, default=True, nullable=False)
    vuelo = relationship("Vuelo", back_populates="asientos")
    reserva = relationship("Reserva", back_populates="asiento", uselist=False)

# Modelo: Reservas
class Reserva(Base):
    __tablename__ = "reservas"
    id_reserva = Column(Integer, primary_key=True)
    id_pasajero = Column(Integer, ForeignKey("pasajeros.id_pasajero"), nullable=False)
    id_asiento = Column(Integer, ForeignKey("asientos.id_asiento"), nullable=False)
    fecha_reserva = Column(Date, nullable=False)
    estado = Column(Enum(EstadoReserva), default=EstadoReserva.activa, nullable=False)
    pasajero = relationship("Pasajero", back_populates="reservas")
    asiento = relationship("Asiento", back_populates="reserva")
    pagos = relationship("Pago", back_populates="reserva")

# Modelo: Pagos
class Pago(Base):
    __tablename__ = "pagos"
    id_pago = Column(Integer, primary_key=True)
    id_reserva = Column(Integer, ForeignKey("reservas.id_reserva"), nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    fecha_pago = Column(Date, nullable=False)
    metodo_pago = Column(Enum(MetodoPago), nullable=False)
    reserva = relationship("Reserva", back_populates="pagos")

# Conexión a la base de datos
DATABASE_URL = "postgresql://postgres:2003@localhost:5432/sistema_de_vuelos"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# Creamos las tablas si no existen
Base.metadata.create_all(engine)

# Ejemplo: Crear y consultar datos
if __name__ == "__main__":
    with SessionLocal() as session:
        try:
            # Crear un pasajero
            pasajero = Pasajero(
                nombre="Maria Lopez",
                pasaporte="PAS12345603",
                telefono="70000043"
            )
            session.add(pasajero)
            session.flush()

            # Crear un vuelo
            vuelo = Vuelo(
                origen="Lima",
                destino="Arequipa",
                fecha_salida=datetime(2025, 8, 25, 8, 0),
                fecha_llegada=datetime(2025, 8, 25, 9, 30),
                estado=EstadoVuelo.programado
            )
            session.add(vuelo)
            session.flush()

            # Crear un asiento
            asiento = Asiento(
                id_vuelo=vuelo.id_vuelo,
                numero_asiento="A44",
                clase="Económica",
                disponible=True
            )
            session.add(asiento)
            session.flush()

            # Crear una reserva
            reserva = Reserva(
                id_pasajero=pasajero.id_pasajero,
                id_asiento=asiento.id_asiento,
                fecha_reserva=datetime.now().date(),
                estado=EstadoReserva.activa
            )
            session.add(reserva)
            session.flush()

            # Crear un pago
            pago = Pago(
                id_reserva=reserva.id_reserva,
                monto=200.00,
                fecha_pago=datetime.now().date(),
                metodo_pago=MetodoPago.tarjeta
            )
            session.add(pago)
            session.commit()

            # Consultar reservas activas
            reservas = session.query(Reserva).filter_by(estado=EstadoReserva.activa).all()
            for r in reservas:
                print(f"Reserva {r.id_reserva}: {r.pasajero.nombre}, Vuelo {r.asiento.vuelo.origen} -> {r.asiento.vuelo.destino}, Asiento: {r.asiento.numero_asiento}")

        except Exception as e:
            print(f"Error: {e}")
            session.rollback()
# Importamos lo necesario
from sqlalchemy.sql import text
from orm import Pasajero, Vuelo, Asiento, Reserva, Pago, EstadoVuelo, EstadoReserva, MetodoPago, SessionLocal
from datetime import date, datetime

# Clase para hacer consultas
class Queries:
    @staticmethod
    def buscar_pasajero_por_pasaporte(session, pasaporte):
        """Busca un pasajero por su pasaporte."""
        pasajero = session.query(Pasajero).filter_by(pasaporte=pasaporte).first()
        if pasajero:
            return f"Pasajero: {pasajero.nombre}, Pasaporte: {pasajero.pasaporte}, Teléfono: {pasajero.telefono}"
        return "No se encontró el pasajero."

    @staticmethod
    def buscar_vuelos_por_ruta(session, origen, destino):
        """Busca vuelos por origen y destino."""
        vuelos = session.query(Vuelo).filter_by(origen=origen, destino=destino).all()
        if vuelos:
            result = [f"Vuelo ID: {v.id_vuelo}, {v.origen} -> {v.destino}, Fecha: {v.fecha_salida}, Estado: {v.estado.value}" for v in vuelos]
            return "\n".join(result)
        return "No se encontraron vuelos."

    @staticmethod
    def buscar_asientos_disponibles(session, id_vuelo):
        """Busca asientos disponibles para un vuelo."""
        asientos = session.query(Asiento).filter_by(id_vuelo=id_vuelo, disponible=True).all()
        if asientos:
            result = [f"Asiento ID: {a.id_asiento}, Número: {a.numero_asiento}, Clase: {a.clase}" for a in asientos]
            return "\n".join(result)
        return "No hay asientos disponibles."

    @staticmethod
    def listar_reservas_activas(session):
        """Consulta las reservas activas."""
        reservas = session.query(Reserva).filter_by(estado=EstadoReserva.activa).all()
        if reservas:
            result = [f"Reserva ID: {r.id_reserva}, Pasajero: {r.pasajero.nombre}, Vuelo: {r.asiento.vuelo.origen} -> {r.asiento.vuelo.destino}, Asiento: {r.asiento.numero_asiento}" for r in reservas]
            return "\n".join(result)
        return "No hay reservas activas."

    @staticmethod
    def hacer_reserva(session, pasajero_id, asiento_id, fecha):
        """Crea una reserva."""
        try:
            reserva = Reserva(
                id_pasajero=pasajero_id,
                id_asiento=asiento_id,
                fecha_reserva=fecha,
                estado=EstadoReserva.activa
            )
            session.add(reserva)
            session.commit()
            return f"Reserva creada: ID {reserva.id_reserva}"
        except Exception as e:
            session.rollback()
            return f"Error al crear reserva: {e}"

    @staticmethod
    def cancelar_reserva(session, reserva_id):
        """Cancela una reserva."""
        try:
            reserva = session.query(Reserva).filter_by(id_reserva=reserva_id).first()
            if reserva:
                reserva.estado = EstadoReserva.cancelada
                session.commit()
                return f"Reserva ID {reserva_id} cancelada."
            return "Reserva no encontrada."
        except Exception as e:
            session.rollback()
            return f"Error al cancelar reserva: {e}"

    @staticmethod
    def listar_pagos_por_reserva(session, reserva_id):
        """Busca pagos de una reserva."""
        pagos = session.query(Pago).filter_by(id_reserva=reserva_id).all()
        if pagos:
            result = [f"Pago ID: {p.id_pago}, Monto: {p.monto}, Fecha: {p.fecha_pago}, Método: {p.metodo_pago.value}" for p in pagos]
            return "\n".join(result)
        return "No se encontraron pagos."

    @staticmethod
    def cambiar_estado_vuelo(session, id_vuelo, nuevo_estado):
        """Cambia el estado de un vuelo."""
        try:
            vuelo = session.query(Vuelo).filter_by(id_vuelo=id_vuelo).first()
            if vuelo:
                vuelo.estado = nuevo_estado
                session.commit()
                return f"Vuelo ID {id_vuelo} actualizado a estado: {nuevo_estado.value}"
            return "Vuelo no encontrado."
        except Exception as e:
            session.rollback()
            return f"Error al actualizar vuelo: {e}"

    @staticmethod
    def crear_pasajero(session, nombre, pasaporte, telefono):
        """Crea un pasajero, verificando si el pasaporte ya existe."""
        try:
            # Verificar si el pasaporte ya existe
            existente = session.query(Pasajero).filter_by(pasaporte=pasaporte).first()
            if existente:
                return f"Error: El pasaporte {pasaporte} ya está registrado para {existente.nombre}."
            
            pasajero = Pasajero(
                nombre=nombre,
                pasaporte=pasaporte,
                telefono=telefono
            )
            session.add(pasajero)
            session.commit()
            return f"Pasajero creado: {pasajero.nombre}, ID: {pasajero.id_pasajero}"
        except Exception as e:
            session.rollback()
            return f"Error al crear pasajero: {e}"

# Ejemplo de uso
if __name__ == "__main__":
    with SessionLocal() as session:
        try:
            # 1. Crear un pasajero nuevo
            print("Creando pasajero:")
            print(Queries.crear_pasajero(session, "Juan Morales", "PAS12345678", "70000046"))
            print()

            # 2. Buscar un pasajero
            print("Buscando pasajero:")
            print(Queries.buscar_pasajero_por_pasaporte(session, "PAS12345678"))
            print()

            # 3. Buscar vuelos
            print("Buscando vuelos Lima -> Arequipa:")
            print(Queries.buscar_vuelos_por_ruta(session, "Lima", "Arequipa"))
            print()

            # 4. Buscar asientos disponibles
            print("Asientos disponibles para el vuelo ID 1:")
            print(Queries.buscar_asientos_disponibles(session, 1))
            print()

            # 5. Crear un asiento nuevo
            asiento = Asiento(
                id_vuelo=1,
                numero_asiento="E47",
                clase="Ejecutiva",
                disponible=True
            )
            session.add(asiento)
            session.flush()
            print(f"Nuevo asiento creado: ID {asiento.id_asiento}")
            print()

            # 6. Hacer una reserva
            pasajero = session.query(Pasajero).filter_by(pasaporte="PAS12345678").first()
            print("Creando reserva:")
            print(Queries.hacer_reserva(session, pasajero.id_pasajero, asiento.id_asiento, date(2025, 6, 9)))
            print()

            # 7. Crear un pago
            ultima_reserva = session.query(Reserva).order_by(Reserva.id_reserva.desc()).first()
            pago = Pago(
                id_reserva=ultima_reserva.id_reserva,
                monto=450.00,
                fecha_pago=date(2025, 6, 9),
                metodo_pago=MetodoPago.tarjeta
            )
            session.add(pago)
            session.commit()
            print(f"Pago creado: Monto {pago.monto}")
            print()

            # 8. Listar pagos de la reserva
            print("Pagos de la reserva:")
            print(Queries.listar_pagos_por_reserva(session, ultima_reserva.id_reserva))
            print()

            # 9. Listar reservas activas
            print("Reservas activas:")
            print(Queries.listar_reservas_activas(session))
            print()

            # 10. Cambiar estado de un vuelo
            print("Cambiando estado del vuelo ID 1:")
            print(Queries.cambiar_estado_vuelo(session, 1, EstadoVuelo.completado))
            print()

            # 11. Cancelar una reserva
            print("Cancelando reserva:")
            print(Queries.cancelar_reserva(session, ultima_reserva.id_reserva))
            print()

            # 12. Listar reservas activas nuevamente
            print("Reservas activas después de cancelar:")
            print(Queries.listar_reservas_activas(session))
            print()

        except Exception as e:
            print(f"Error: {e}")
            session.rollback()
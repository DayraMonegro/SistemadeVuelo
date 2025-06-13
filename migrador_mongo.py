from pymongo import MongoClient
import psycopg2
from datetime import datetime, date
from decimal import Decimal
from pprint import pprint

MONGO_URI = 'mongodb+srv://dayramonegro9:2003@cluster0.9xz9axi.mongodb.net/'
cliente = MongoClient(MONGO_URI)
cliente.admin.command('ping')
print("✅ Conectado a MongoDB Atlas")

db = cliente['vuelos_migrado']

try:
    pg_conn = psycopg2.connect(
        dbname="sistema_de_vuelos", # <--- Ajusta tu base de datos
        user="postgres",          # <--- Ajusta tu usuario
        password="2003", # <--- Ajusta tu contraseña
        host="localhost",
        port="5432"
    )
    pg_cursor = pg_conn.cursor()
    print("✅ Conectado a PostgreSQL")
except Exception as e:
    print(f"❌ Error al conectar a PostgreSQL: {e}")
    exit()

tablas = ["pasajeros", "vuelos", "asientos", "reservas", "pagos", "vista_reservas_vuelos"]

for tabla in tablas:
    print(f"\n📦 Migrando tabla '{tabla}'...")
    try:
        pg_cursor.execute(f"SELECT * FROM {tabla}")
        columnas = [desc[0] for desc in pg_cursor.description]
        filas = pg_cursor.fetchall()

        documentos = []
        for fila in filas:
            doc = {}
            for i, valor in enumerate(fila):
                if isinstance(valor, (datetime, date)):
                    valor = valor.isoformat()
                elif isinstance(valor, Decimal):
                    valor = float(valor)
                doc[columnas[i]] = valor
            documentos.append(doc)

        if documentos:
            db[tabla].insert_many(documentos)
            print(f"✅ Insertados {len(documentos)} documentos en '{tabla}'")
        else:
            print("⚠️ Tabla vacía")

    except Exception as e:
        print(f"❌ Error migrando '{tabla}': {e}")

print("\n📂 Colecciones creadas en MongoDB:")
print(db.list_collection_names())

print("\n📝 Ejemplo de documentos en 'pasajeros':")
for doc in db['pasajeros'].find().limit(3):
    pprint(doc)

pg_cursor.close()
pg_conn.close()
cliente.close()
print("\n🔚 Conexiones cerradas. Migración completa.")

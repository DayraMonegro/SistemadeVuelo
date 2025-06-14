import os
import certifi
from flask import Flask, jsonify, request, render_template, session, redirect, url_for, flash
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import ConfigurationError
from bson.objectid import ObjectId
from datetime import datetime, timedelta # Importar timedelta

# Cargar variables de entorno si existe un archivo .env
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'una_clave_super_secreta_y_fuerte_aqui')

# Configuración de MongoDB
mongo_uri = os.environ.get('MONGO_URI')
if not mongo_uri:
    mongo_uri = 'mongodb+srv://dayramonegro9:2003@cluster0.9xz9axi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
    print("WARNING: MONGO_URI no definida en variables de entorno. Usando URI por defecto.")
else:
    print("Usando MONGO_URI de las variables de entorno.")

try:
    client = MongoClient(mongo_uri, tlsCAFile=certifi.where())
    db = client.flask_flights # Tu base de datos
    flights_collection = db.flights # Tu colección de vuelos
    users_collection = db.users # Colección de usuarios
    print("Conexión a MongoDB Atlas exitosa.")
except ConfigurationError as e:
    print(f"Error de configuración de MongoDB: {e}")
    print("Asegúrate de que la MONGO_URI sea correcta y tu IP esté en la lista de acceso de Atlas.")
    exit(1)

CORS(app) # Habilitar CORS para toda la aplicación

# Decorador de autenticación
def login_required(f):
    def wrapper(*args, **kwargs): # Necesario para que el decorador funcione correctamente con funciones de ruta
        # Esta función se ejecuta ANTES de cada solicitud
        if 'username' not in session: # Si no hay usuario en sesión
            # Evitar redireccionar a login si ya estamos en login o register
            if request.endpoint != 'login' and request.endpoint != 'register':
                flash('Debes iniciar sesión para acceder a esta página.', 'warning')
                return redirect(url_for('login'))
        # Si el usuario ya está logueado y trata de acceder a login/register, redirigir a dashboard
        elif request.endpoint == 'login' or request.endpoint == 'register':
            return redirect(url_for('dashboard'))

        # Si todo está bien (usuario logueado o en login/register), ejecutar la función original
        return f(*args, **kwargs)

    # Necesario para Flask, para copiar atributos de la función decorada
    wrapper.__name__ = f.__name__
    return wrapper

# Rutas de Autenticación
@app.route('/login', methods=['GET', 'POST'])
# NO DEBE LLEVAR @login_required AQUÍ
def login():
    # Si ya está logueado, redirigir al dashboard (manejado por el decorador ahora, pero bueno tenerlo como respaldo)
    if 'username' in session:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = users_collection.find_one({'username': username, 'password': password})
        if user:
            session['username'] = username
            flash('¡Inicio de sesión exitoso!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Usuario o contraseña incorrectos.', 'danger')
    return render_template('auth.html', form_type='login')

@app.route('/register', methods=['GET', 'POST'])
# NO DEBE LLEVAR @login_required AQUÍ
def register():
    # Si ya está logueado, redirigir al dashboard
    if 'username' in session:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if users_collection.find_one({'username': username}):
            flash('El nombre de usuario ya existe. Por favor, elige otro.', 'danger')
        else:
            users_collection.insert_one({'username': username, 'password': password})
            flash('¡Registro exitoso! Ahora puedes iniciar sesión.', 'success')
            return redirect(url_for('login'))
    return render_template('auth.html', form_type='register')

@app.route('/logout')
def logout():
    session.pop('username', None)
    flash('Has cerrado sesión.', 'info')
    return redirect(url_for('login'))

# Rutas de la Aplicación
@app.route('/')
@login_required
def home():
    return redirect(url_for('dashboard'))

@app.route('/dashboard')
@login_required
def dashboard():
    username = session.get('username', 'Invitado')
    return render_template('dashboard.html', username=username)

@app.route('/flights')
@login_required
def flights():
    username = session.get('username', 'Invitado')
    return render_template('flights.html', username=username)

@app.route('/charts')
@login_required
def charts():
    username = session.get('username', 'Invitado')
    return render_template('charts.html', username=username)

@app.route('/profile')
@login_required
def profile():
    username = session.get('username', 'Invitado')
    return render_template('profile.html', username=username)

# API Endpoints

# GET flights (para DataTables)
@app.route('/api/flights', methods=['GET'])
@login_required
def get_flights():
    draw = int(request.args.get('draw', 1))
    start = int(request.args.get('start', 0))
    length = int(request.args.get('length', 10))
    search_value = request.args.get('search_value', '') # Corregido: la clave correcta es 'search_value' para la búsqueda general de DataTables
    order_column_index = int(request.args.get('order_column', 0)) # Corregido: la clave correcta es 'order_column'
    order_direction = request.args.get('order_dir', 'asc') # Corregido: la clave correcta es 'order_dir'

    columns = ['id_vuelo', 'aerolinea', 'origen', 'destino', 'fecha_salida', 'estado']
    sort_column = columns.index(request.args.get('columns[' + str(order_column_index) + '][data]')) # Obtener la columna de ordenamiento correctamente

    query = {}
    if search_value:
        query['$or'] = [
            {'id_vuelo': {'$regex': search_value, '$options': 'i'}},
            {'aerolinea': {'$regex': search_value, '$options': 'i'}},
            {'origen': {'$regex': search_value, '$options': 'i'}},
            {'destino': {'$regex': search_value, '$options': 'i'}},
            {'estado': {'$regex': search_value, '$options': 'i'}}
        ]

    total_records = flights_collection.count_documents({})
    filtered_records = flights_collection.count_documents(query)

    sort_direction = 1 if order_direction == 'asc' else -1
    flights_cursor = flights_collection.find(query).sort(sort_column, sort_direction).skip(start).limit(length)

    data = []
    for flight in flights_cursor:
        fecha_salida_str = flight.get('fecha_salida')
        if isinstance(fecha_salida_str, datetime):
            fecha_salida_str = fecha_salida_str.strftime('%Y-%m-%d %H:%M')

        flight_id = str(flight['_id'])

        actions_html = f"""
            <button class="btn btn-warning btn-sm edit-btn" data-id="{flight_id}" title="Editar Vuelo"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-sm delete-btn" data-id="{flight_id}" title="Eliminar Vuelo"><i class="fas fa-trash-alt"></i></button>
        """

        data.append({
            'id_vuelo': flight.get('id_vuelo'),
            'aerolinea': flight.get('aerolinea'),
            'origen': flight.get('origen'),
            'destino': flight.get('destino'),
            'fecha_salida': fecha_salida_str,
            'estado': flight.get('estado'),
            'actions': actions_html
        })

    return jsonify({
        "draw": draw,
        "recordsTotal": total_records,
        "recordsFiltered": filtered_records,
        "data": data
    })

# GET flight by ID (para editar)
@app.route('/api/vuelos/<flight_id>', methods=['GET'])
@login_required
def get_flight_by_id(flight_id):
    try:
        flight = flights_collection.find_one({'_id': ObjectId(flight_id)})
        if flight:
            flight['_id'] = str(flight['_id'])
            if isinstance(flight.get('fecha_salida'), datetime):
                flight['fecha_salida'] = flight['fecha_salida'].isoformat(timespec='minutes')
            return jsonify(flight), 200
        else:
            return jsonify({"message": "Vuelo no encontrado."}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500

# POST (Añadir nuevo vuelo)
@app.route('/api/vuelos', methods=['POST'])
@login_required
def add_flight():
    data = request.json
    if not all(key in data for key in ['id_vuelo', 'aerolinea', 'origen', 'destino', 'fecha_salida', 'estado']):
        return jsonify({"message": "Faltan campos obligatorios."}), 400

    try:
        data['fecha_salida'] = datetime.fromisoformat(data['fecha_salida'])

        result = flights_collection.insert_one(data)
        return jsonify({"message": "Vuelo añadido exitosamente.", "id": str(result.inserted_id)}), 201
    except Exception as e:
        return jsonify({"message": f"Error al añadir vuelo: {str(e)}"}), 500

# PUT (Actualizar vuelo existente)
@app.route('/api/vuelos/<flight_id>', methods=['PUT'])
@login_required
def update_flight(flight_id):
    data = request.json
    if not all(key in data for key in ['id_vuelo', 'aerolinea', 'origen', 'destino', 'fecha_salida', 'estado']):
        return jsonify({"message": "Faltan campos obligatorios para la actualización."}), 400

    try:
        data['fecha_salida'] = datetime.fromisoformat(data['fecha_salida'])

        if '_id' in data:
            del data['_id']

        result = flights_collection.update_one({'_id': ObjectId(flight_id)}, {'$set': data})

        if result.modified_count == 1:
            return jsonify({"message": "Vuelo actualizado exitosamente."}), 200
        else:
            return jsonify({"message": "Vuelo no encontrado o no hubo cambios."}), 404
    except Exception as e:
        return jsonify({"message": f"Error al actualizar vuelo: {str(e)}"}), 500

# DELETE (Eliminar vuelo)
@app.route('/api/vuelos/<flight_id>', methods=['DELETE'])
@login_required
def delete_flight(flight_id):
    try:
        result = flights_collection.delete_one({'_id': ObjectId(flight_id)})
        if result.deleted_count == 1:
            return jsonify({"message": "Vuelo eliminado exitosamente."}), 200
        else:
            return jsonify({"message": "Vuelo no encontrado."}), 404
    except Exception as e:
        return jsonify({"message": f"Error al eliminar vuelo: {str(e)}"}), 500

# API para KPIs
@app.route('/api/kpis', methods=['GET'])
@login_required
def get_kpis():
    total_flights = flights_collection.count_documents({})
    flights_today = flights_collection.count_documents({
        'fecha_salida': {
            '$gte': datetime.now().replace(hour=0, minute=0, second=0, microsecond=0),
            '$lt': datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)
        }
    })
    active_flights = flights_collection.count_documents({'estado': {'$in': ['En Vuelo', 'Programado', 'Retrasado']}})

    pipeline_revenue = [
        {'$match': {'precio': {'$exists': True, '$ne': None}}},
        {'$group': {'_id': None, 'total_revenue': {'$sum': '$precio'}}}
    ]
    revenue_result = list(flights_collection.aggregate(pipeline_revenue))
    total_revenue = revenue_result [0]['total_revenue'] if revenue_result else 0

    return jsonify({
        "total_flights": total_flights,
        "flights_today": flights_today,
        "active_flights": active_flights,
        "total_revenue": total_revenue
    })

# API para datos de gráficos
@app.route('/api/chart_data', methods=['GET'])
@login_required
def get_chart_data():
    # Vuelos por Aerolínea
    pipeline_aerolinea = [
        {'$group': {'_id': '$aerolinea', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    aerolinea_data = list(flights_collection.aggregate(pipeline_aerolinea))
    vuelos_por_aerolinea = {
        "labels": [item['_id'] for item in aerolinea_data],
        "data": [item['count'] for item in aerolinea_data]
    }

    # Estado de Vuelos
    pipeline_estado = [
        {'$group': {'_id': '$estado', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    estado_data = list(flights_collection.aggregate(pipeline_estado))
    estado_vuelos = {
        "labels": [item['_id'] for item in estado_data],
        "data": [item['count'] for item in estado_data]
    }

    # Vuelos Diarios (solo vuelos con fecha de salida en el último mes, por ejemplo)
    one_month_ago = datetime.now() - timedelta(days=30)
    pipeline_diarios = [
        {'$match': {'fecha_salida': {'$gte': one_month_ago}}},
        {'$group': {
            '_id': {
                '$dateToString': {
                    'format': '%Y-%m-%d',
                    'date': '$fecha_salida'
                }
            },
            'count': {'$sum': 1}
        }},
        {'$sort': {'_id': 1}}
    ]
    diarios_data = list(flights_collection.aggregate(pipeline_diarios))

    date_labels = []
    date_counts = {}
    current_date = one_month_ago
    while current_date <= datetime.now():
        date_str = current_date.strftime('%Y-%m-%d')
        date_labels.append(date_str)
        date_counts.setdefault(date_str, 0) # Asegura que la fecha exista en el diccionario
        current_date += timedelta(days=1)

    for item in diarios_data:
        date_counts.setdefault(item['_id'], 0) # Asegura que la fecha exista
        date_counts.update({item['_id']: item['count']})


    vuelos_diarios = {
        "labels": date_labels,
        "data": [date_counts.get(label, 0) for label in date_labels] # Obtener el conteo, 0 si no existe
    }

    return jsonify({
        "vuelosPorAerolinea": vuelos_por_aerolinea,
        "estadoVuelos": estado_vuelos,
        "vuelosDiarios": vuelos_diarios
    })


# Manejo de errores
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('500.html'), 500

if __name__ == '__main__':
    # ***IMPORTANTE***
    # Asegúrate de que tu base de datos y colección "users" existan y tengan al menos un usuario.
    # Si la colección de usuarios está vacía, DEBERÁS registrar un usuario manualmente
    # visitando la URL http://127.0.0.1:5000/register en tu navegador LA PRIMERA VEZ
    # para crear un usuario antes de poder iniciar sesión.
    app.run(debug=True)
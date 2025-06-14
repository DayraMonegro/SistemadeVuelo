"use strict";

(function() {
    // Función de debounce para optimizar eventos
    function debounce(func, wait, immediate) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    // Función para mostrar mensajes flash
    function showFlashMessage(message, type = 'info') {
        const container = document.querySelector('.flash-messages-container');
        if (!container) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `alert alert-${type}`;
        messageDiv.textContent = message;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => messageDiv.remove();
        
        messageDiv.prepend(closeBtn);
        container.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            setTimeout(() => messageDiv.remove(), 500);
        }, 4000);
    }

    // Función para manejar errores de API
    async function handleApiError(response) {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }

    // Inicialización cuando el DOM está listo
    document.addEventListener("DOMContentLoaded", () => {
        // Configuración global de DataTables
        $.extend(true, $.fn.dataTable.defaults, {
            language: {
                // *** LÍNEA CORREGIDA PARA EL IDIOMA DE DATATABLES ***
                // Esta URL es para una versión más reciente (1.13.x) y un nombre de archivo estándar.
                // Si tienes problemas, puedes intentar con:
                // "//cdn.datatables.net/plug-ins/1.10.25/i18n/Spanish.json" (para versiones más antiguas)
                url: "//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json" 
            },
            responsive: true,
            autoWidth: false
        });

        // Inicializar tablas si existen
        if ($.fn.DataTable && $('#flightsTable').length) {
            $('#flightsTable').DataTable({
                ajax: {
                    url: '/api/flights',
                    dataSrc: 'data'
                },
                columns: [
                    { data: 'id_vuelo' },
                    { data: 'origen' },
                    { data: 'destino' },
                    { 
                        data: 'fecha_salida',
                        render: function(data) {
                            return data ? new Date(data).toLocaleString() : '';
                        }
                    },
                    { data: 'estado' },
                    { 
                        data: null,
                        render: function(data, type, row) {
                            // Asegurarse de que el _id esté presente en los datos para los botones
                            const flightId = row._id || ''; 
                            return `
                                <button class="btn btn-sm btn-warning edit-btn" data-id="${flightId}">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                                <button class="btn btn-sm btn-danger delete-btn" data-id="${flightId}">
                                    <i class="fas fa-trash"></i> Eliminar
                                </button>
                            `;
                        },
                        orderable: false // Las acciones no deben ser ordenables
                    }
                ]
            });
        }

        // Manejo de formularios CRUD
        if ($('#flightForm').length) {
            $('#flightForm').on('submit', async function(e) {
                e.preventDefault();
                
                const flightId = $('#flightId').val();
                const url = flightId ? `/api/vuelos/${flightId}` : '/api/vuelos';
                const method = flightId ? 'PUT' : 'POST';

                try {
                    const response = await fetch(url, {
                        method,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            id_vuelo: $('#id_vuelo').val(),
                            origen: $('#origen').val(),
                            destino: $('#destino').val(),
                            fecha_salida: $('#fecha_salida').val(),
                            estado: $('#estado').val()
                            // Si tienes más campos en tu formulario, añádelos aquí
                            // por ejemplo: fecha_llegada: $('#fecha_llegada').val()
                        })
                    });

                    const data = await handleApiError(response);
                    showFlashMessage(data.message, 'success');
                    $('#flightForm')[0].reset();
                    $('#flightsTable').DataTable().ajax.reload(); // Recargar la tabla
                } catch (error) {
                    showFlashMessage(error.message, 'danger');
                }
            });
        }

        // Manejo de botones de edición/eliminación
        $(document).on('click', '.edit-btn', async function() {
            const flightId = $(this).data('id');
            try {
                const response = await fetch(`/api/vuelos/${flightId}`);
                const data = await handleApiError(response);
                
                $('#flightId').val(data._id); // Campo oculto para el ID en el formulario
                $('#id_vuelo').val(data.id_vuelo);
                $('#origen').val(data.origen);
                $('#destino').val(data.destino);
                
                if (data.fecha_salida) {
                    const date = new Date(data.fecha_salida);
                    // Formato para input type="datetime-local" (YYYY-MM-DDTHH:MM)
                    $('#fecha_salida').val(date.toISOString().slice(0, 16));
                }
                
                $('#estado').val(data.estado);
                // Si tienes más campos para editar, rellénalos aquí
            } catch (error) {
                showFlashMessage(error.message, 'danger');
            }
        });

        $(document).on('click', '.delete-btn', async function() {
            const flightId = $(this).data('id');
            if (confirm('¿Está seguro que desea eliminar este vuelo?')) {
                try {
                    const response = await fetch(`/api/vuelos/${flightId}`, {
                        method: 'DELETE'
                    });
                    const data = await handleApiError(response);
                    showFlashMessage(data.message, 'success');
                    $('#flightsTable').DataTable().ajax.reload(); // Recargar la tabla
                } catch (error) {
                    showFlashMessage(error.message, 'danger');
                }
            }
        });

        // Manejo del tema claro/oscuro (si existe el elemento)
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', function() {
                document.body.setAttribute('data-theme', this.checked ? 'dark' : 'light');
                localStorage.setItem('theme', this.checked ? 'dark' : 'light');
            });
        }

        // Lógica para KPIs y gráficos (si existen los elementos)
        if ($('#flightsByAirlineChart').length) {
            // Mostrar loaders al inicio de la carga de gráficos/KPIs
            $('#loaderFlightsByAirline').show();
            $('#loaderFlightStatus').show();
            $('#loaderDailyFlights').show();

            // Cargar KPIs
            $.getJSON('/api/kpis', function(data) {
                $('#totalFlights').text(data.total_flights || '0');
                $('#flightsToday').text(data.flights_today || '0');
                $('#activeFlights').text(data.active_flights || '0');
                // Formato de moneda
                $('#totalRevenue').text(data.total_revenue ? '$' + parseFloat(data.total_revenue).toFixed(2) : '$0.00');
            }).fail(function(jqXHR, textStatus, errorThrown) {
                console.error('Error al cargar KPIs:', textStatus, errorThrown);
                $('.kpi-card .value').text('Error'); // Mostrar "Error" en los KPIs
                showFlashMessage('Error al cargar los KPIs. Revisa la consola del servidor.', 'danger');
            });

            // Cargar gráficos
            $.getJSON('/api/chart_data', function(data) {
                // Gráfico de Vuelos por Origen (antes aerolínea)
                new Chart($('#flightsByAirlineChart'), {
                    type: 'bar',
                    data: {
                        labels: data.vuelosPorAerolinea.labels || [],
                        datasets: [{
                            label: 'Vuelos por Origen', // Etiqueta más descriptiva
                            data: data.vuelosPorAerolinea.data || [],
                            backgroundColor: [
                                'rgba(54, 162, 235, 0.6)', // Azul
                                'rgba(255, 99, 132, 0.6)', // Rojo
                                'rgba(75, 192, 192, 0.6)', // Verde
                                'rgba(255, 206, 86, 0.6)', // Amarillo
                                'rgba(153, 102, 255, 0.6)', // Púrpura
                                'rgba(255, 159, 64, 0.6)'  // Naranja
                            ],
                            borderColor: [
                                'rgba(54, 162, 235, 1)',
                                'rgba(255, 99, 132, 1)',
                                'rgba(75, 192, 192, 1)',
                                'rgba(255, 206, 86, 1)',
                                'rgba(153, 102, 255, 1)',
                                'rgba(255, 159, 64, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false } // Añadido maintainAspectRatio: false
                });
                $('#loaderFlightsByAirline').hide();

                // Gráfico de Estado de Reservas (antes vuelos)
                new Chart($('#flightStatusChart'), {
                    type: 'doughnut',
                    data: {
                        labels: data.estadoVuelos.labels || [],
                        datasets: [{
                            data: data.estadoVuelos.data || [],
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.6)', // Roja
                                'rgba(54, 162, 235, 0.6)', // Azul
                                'rgba(255, 206, 86, 0.6)', // Amarilla
                                'rgba(75, 192, 192, 0.6)'  // Verde
                            ],
                            borderColor: [
                                'rgba(255, 99, 132, 1)',
                                'rgba(54, 162, 235, 1)',
                                'rgba(255, 206, 86, 1)',
                                'rgba(75, 192, 192, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
                $('#loaderFlightStatus').hide();

                // Gráfico de Reservas Diarias (antes vuelos)
                new Chart($('#dailyFlightsChart'), {
                    type: 'line',
                    data: {
                        labels: data.vuelosDiarios.labels || [],
                        datasets: [{
                            label: 'Número de Reservas', // Etiqueta más descriptiva
                            data: data.vuelosDiarios.data || [],
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.2)', // Relleno suave bajo la línea
                            fill: true, // Habilitar el relleno
                            tension: 0.3 // Suavizar la línea
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
                $('#loaderDailyFlights').hide();
            }).fail(function(jqXHR, textStatus, errorThrown) {
                console.error('Error al cargar gráficos:', textStatus, errorThrown, jqXHR.responseText); // Añadido responseText
                $('.loader-overlay').hide(); // Ocultar todos los loaders si hay un error general
                showFlashMessage('Error al cargar los gráficos. Verifica la consola del navegador y del servidor.', 'danger');
            });
        }
    });
})();
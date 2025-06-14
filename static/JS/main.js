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
                url: "//cdn.datatables.net/plug-ins/1.11.5/i18n/es_es.json"
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
                    { data: 'origen' }, // Corregido: 'aerolinea' no existe, usar 'origen'
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
                            return `
                                <button class="btn btn-sm btn-warning edit-btn" data-id="${row._id}">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                                <button class="btn btn-sm btn-danger delete-btn" data-id="${row._id}">
                                    <i class="fas fa-trash"></i> Eliminar
                                </button>
                            `;
                        },
                        orderable: false
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
                            origen: $('#origen').val(), // Corregido: 'aerolinea' no existe
                            destino: $('#destino').val(),
                            fecha_salida: $('#fecha_salida').val(),
                            estado: $('#estado').val()
                        })
                    });

                    const data = await handleApiError(response);
                    showFlashMessage(data.message, 'success');
                    $('#flightForm')[0].reset();
                    $('#flightsTable').DataTable().ajax.reload();
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
                
                $('#flightId').val(data._id);
                $('#id_vuelo').val(data.id_vuelo);
                $('#origen').val(data.origen); // Corregido: 'aerolinea' no existe
                $('#destino').val(data.destino);
                
                if (data.fecha_salida) {
                    const date = new Date(data.fecha_salida);
                    $('#fecha_salida').val(date.toISOString().slice(0, 16));
                }
                
                $('#estado').val(data.estado);
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
                    $('#flightsTable').DataTable().ajax.reload();
                } catch (error) {
                    showFlashMessage(error.message, 'danger');
                }
            }
        });

        // Manejo del tema claro/oscuro
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', function() {
                document.body.setAttribute('data-theme', this.checked ? 'dark' : 'light');
                localStorage.setItem('theme', this.checked ? 'dark' : 'light');
            });
        }

        // Lógica para KPIs y gráficos
        if ($('#flightsByAirlineChart').length) {
            $('#loaderFlightsByAirline').show();
            $('#loaderFlightStatus').show();
            $('#loaderDailyFlights').show();

            // Cargar KPIs
            $.getJSON('/api/kpis', function(data) {
                $('#totalFlights').text(data.total_flights || '0');
                $('#flightsToday').text(data.flights_today || '0');
                $('#activeFlights').text(data.active_flights || '0');
                $('#totalRevenue').text(data.total_revenue ? '$' + data.total_revenue.toFixed(2) : '$0.00');
            }).fail(function() {
                $('.kpi-card .value').text('Error');
            });

            // Cargar gráficos
            $.getJSON('/api/chart_data', function(data) {
                new Chart($('#flightsByAirlineChart'), {
                    type: 'bar',
                    data: {
                        labels: data.vuelosPorAerolinea.labels || [],
                        datasets: [{
                            label: 'Vuelos',
                            data: data.vuelosPorAerolinea.data || [],
                            backgroundColor: data.vuelosPorAerolinea.labels.length ? [
                                'rgba(54, 162, 235, 0.2)', 'rgba(255, 99, 132, 0.2)', 'rgba(75, 192, 192, 0.2)'
                            ] : ['rgba(0, 0, 0, 0.2)']
                        }]
                    },
                    options: { responsive: true }
                });
                $('#loaderFlightsByAirline').hide();

                new Chart($('#flightStatusChart'), {
                    type: 'doughnut',
                    data: {
                        labels: data.estadoVuelos.labels || [],
                        datasets: [{
                            data: data.estadoVuelos.data || [],
                            backgroundColor: data.estadoVuelos.labels.length ? [
                                'rgba(54, 162, 235, 0.2)', 'rgba(255, 99, 132, 0.2)', 'rgba(75, 192, 192, 0.2)'
                            ] : ['rgba(0, 0, 0, 0.2)']
                        }]
                    },
                    options: { responsive: true }
                });
                $('#loaderFlightStatus').hide();

                new Chart($('#dailyFlightsChart'), {
                    type: 'line',
                    data: {
                        labels: data.vuelosDiarios.labels || [],
                        datasets: [{
                            label: 'Reservas',
                            data: data.vuelosDiarios.data || [],
                            borderColor: 'rgba(54, 162, 235, 1)',
                            fill: false
                        }]
                    },
                    options: { responsive: true }
                });
                $('#loaderDailyFlights').hide();
            }).fail(function(jqXHR, textStatus, errorThrown) {
                console.error('Error al cargar gráficos:', textStatus, errorThrown);
                $('.loader-overlay').hide();
                showFlashMessage('Error al cargar los gráficos. Verifica la consola.', 'danger');
            });
        }
    });
})();
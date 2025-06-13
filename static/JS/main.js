"use strict";

(function() {
    // La lógica de PerfectScrollbar se movió a base.html y se reemplazó con OverlayScrollbars.
    // Si aún deseas usar PerfectScrollbar, deberías incluir sus CDN y re-activar su inicialización aquí
    // o en base.html, y remover OverlayScrollbars.
})();

// Función de debounce para optimizar eventos de scroll/resize
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

// Función para el efecto de blur en la navbar al hacer scroll (se mantiene por si acaso, no se usa activamente en este diseño)
function navbarBlurOnScroll(id) {
    const navbar = document.getElementById(id);
    if (!navbar) return;
    let navbarScrollActive = navbar.getAttribute("data-scroll") === 'true';
    let scrollDistance = 5;
    let classes = ['blur', 'shadow-lg']; // Clases que se añadirán
    let toggleClasses = ['shadow-none']; // Clases que se removerán

    const handleScroll = () => {
        if (window.scrollY > scrollDistance) {
            navbar.classList.add(...classes);
            navbar.classList.remove(...toggleClasses);
        } else {
            navbar.classList.remove(...classes);
            navbar.classList.add(...toggleClasses);
        }
    };

    window.addEventListener('scroll', debounce(handleScroll, 10));
}

// =====================================================================================================================
// Lógica principal que se ejecuta cuando el DOM está completamente cargado
document.addEventListener("DOMContentLoaded", () => {

    // Lógica del efecto Ripple para botones
    const addRippleEffect = (e) => {
        const btn = e.currentTarget;
        // Evitar múltiples ripples si ya hay uno animándose
        if (btn.querySelector('.ripple')) {
            const existingRipple = btn.querySelector('.ripple');
            existingRipple.remove(); // Remover el ripple existente antes de crear uno nuevo
        }

        const ripple = document.createElement('span');
        const diameter = Math.max(btn.clientWidth, btn.clientHeight);
        const radius = diameter / 2;

        ripple.style.width = ripple.style.height = `${diameter}px`;
        ripple.style.left = `${e.clientX - btn.getBoundingClientRect().left - radius}px`;
        ripple.style.top = `${e.clientY - btn.getBoundingClientRect().top - radius}px`;
        ripple.classList.add('ripple');

        const rippleEffectContainer = document.createElement('div'); // Contenedor para el ripple
        rippleEffectContainer.classList.add('ripple-effect');
        rippleEffectContainer.appendChild(ripple);
        btn.appendChild(rippleEffectContainer);

        ripple.addEventListener('animationend', () => {
            rippleEffectContainer.remove();
        });
    };

    // Aplica el efecto ripple a todos los botones
    document.querySelectorAll('.btn, .auth-form button, .error-page-container a').forEach(btn => {
        btn.addEventListener('click', addRippleEffect);
    });

    // =====================================================================================================================
    // Lógica de DataTables para la tabla de vuelos
    let flightsDataTable; // Variable global para la instancia de DataTables

    function initializeFlightsTable() {
        if ($.fn.DataTable.isDataTable('#flightsTable')) {
            $('#flightsTable').DataTable().destroy();
            $('#flightsTable tbody').empty(); // Limpiar el tbody para evitar duplicados
        }

        flightsDataTable = $('#flightsTable').DataTable({
            "processing": true,
            "serverSide": true,
            "ajax": {
                "url": "/api/flights",
                "type": "GET",
                "dataSrc": "data"
            },
            "columns": [
                { "data": "id_vuelo" },
                { "data": "aerolinea" },
                { "data": "origen" },
                { "data": "destino" },
                { "data": "fecha_salida" },
                { "data": "estado" },
                { "data": "actions", "orderable": false, "searchable": false } // Acciones de botones
            ],
            "language": {
                "url": "//cdn.datatables.net/plug-ins/1.11.5/i18n/es_es.json" // Español
            },
            "responsive": true,
            "autoWidth": false,
            "dom": '<"top"lf<"clear">>rt<"bottom"ip<"clear">>' // Reorganiza los elementos para mejor estética
        });
    }

    // =====================================================================================================================
    // Lógica de Gráficos con Chart.js
    let flightsByAirlineChart, flightStatusChart, dailyFlightsChart;

    const chartColors = [
        getComputedStyle(document.documentElement).getPropertyValue('--chart-color-1').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--chart-color-2').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--chart-color-3').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--chart-color-4').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--chart-color-5').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--chart-color-6').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--chart-color-7').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--chart-color-8').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--chart-color-9').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--chart-color-10').trim()
    ];

    function createChart(ctx, type, data, options) {
        return new Chart(ctx, { type, data, options });
    }

    async function loadChartData() {
        const loaders = {
            flightsByAirline: document.getElementById('loaderFlightsByAirline'),
            flightStatus: document.getElementById('loaderFlightStatus'),
            dailyFlights: document.getElementById('loaderDailyFlights')
        };

        // Mostrar loaders
        for (const loaderId in loaders) {
            if (loaders[loaderId]) loaders[loaderId].style.display = 'flex';
        }

        try {
            const response = await fetch('/api/chart_data');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const chartData = await response.json();

            // Vuelos por Aerolínea (Gráfico de Torta/Doughnut)
            const ctxAirline = document.getElementById('flightsByAirlineChart');
            if (ctxAirline) {
                if (flightsByAirlineChart) flightsByAirlineChart.destroy(); // Destruir instancia anterior
                flightsByAirlineChart = createChart(ctxAirline, 'doughnut', {
                    labels: chartData.vuelosPorAerolinea.labels,
                    datasets: [{
                        data: chartData.vuelosPorAerolinea.data,
                        backgroundColor: chartColors.slice(0, chartData.vuelosPorAerolinea.labels.length),
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-background').trim(),
                        borderWidth: 2
                    }]
                }, {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim(),
                                font: {
                                    size: 14
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed !== null) {
                                        label += context.parsed + ' vuelos';
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                });
            }

            // Estado de Vuelos (Gráfico de Barras)
            const ctxStatus = document.getElementById('flightStatusChart');
            if (ctxStatus) {
                if (flightStatusChart) flightStatusChart.destroy();
                flightStatusChart = createChart(ctxStatus, 'bar', {
                    labels: chartData.estadoVuelos.labels,
                    datasets: [{
                        label: 'Número de Vuelos',
                        data: chartData.estadoVuelos.data,
                        backgroundColor: chartColors.slice(0, chartData.estadoVuelos.labels.length),
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-background').trim(),
                        borderWidth: 1
                    }]
                }, {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y + ' vuelos';
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-light-color').trim()
                            },
                            grid: {
                                color: 'rgba(128, 128, 128, 0.1)'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-light-color').trim()
                            },
                            grid: {
                                color: 'rgba(128, 128, 128, 0.1)'
                            }
                        }
                    }
                });
            }

            // Vuelos Diarios (Gráfico de Líneas)
            const ctxDaily = document.getElementById('dailyFlightsChart');
            if (ctxDaily) {
                if (dailyFlightsChart) dailyFlightsChart.destroy();
                dailyFlightsChart = createChart(ctxDaily, 'line', {
                    labels: chartData.vuelosDiarios.labels,
                    datasets: [{
                        label: 'Vuelos',
                        data: chartData.vuelosDiarios.data,
                        borderColor: chartColors[0],
                        backgroundColor: 'rgba(0, 123, 255, 0.2)', // Color del área bajo la línea
                        tension: 0.4, // Suaviza la línea
                        fill: true,
                        pointBackgroundColor: chartColors[0],
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: chartColors[0]
                    }]
                }, {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y + ' vuelos';
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-light-color').trim()
                            },
                            grid: {
                                color: 'rgba(128, 128, 128, 0.1)'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-light-color').trim()
                            },
                            grid: {
                                color: 'rgba(128, 128, 128, 0.1)'
                            }
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Error al cargar datos de gráficos:', error);
            // Podrías mostrar un mensaje de error al usuario aquí
        } finally {
            // Ocultar loaders
            for (const loaderId in loaders) {
                if (loaders[loaderId]) loaders[loaderId].style.display = 'none';
            }
        }
    }

    // =====================================================================================================================
    // Lógica de KPIs
    async function loadKPIs() {
        try {
            const response = await fetch('/api/kpis');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const kpis = await response.json();

            document.getElementById('totalFlights').textContent = kpis.total_flights !== undefined ? kpis.total_flights : 'N/A';
            document.getElementById('flightsToday').textContent = kpis.flights_today !== undefined ? kpis.flights_today : 'N/A';
            document.getElementById('activeFlights').textContent = kpis.active_flights !== undefined ? kpis.active_flights : 'N/A';
            document.getElementById('totalRevenue').textContent = kpis.total_revenue !== undefined ? `$${kpis.total_revenue.toLocaleString('es-BO')}` : 'N/A';

        } catch (error) {
            console.error('Error al cargar KPIs:', error);
            // Puedes mostrar un mensaje de error o poner "N/A"
            document.getElementById('totalFlights').textContent = 'Error';
            document.getElementById('flightsToday').textContent = 'Error';
            document.getElementById('activeFlights').textContent = 'Error';
            document.getElementById('totalRevenue').textContent = 'Error';
        }
    }

    // =====================================================================================================================
    // Lógica del Modal para Añadir/Editar Vuelos
    const flightModal = document.getElementById('flightModal');
    const addFlightBtn = document.getElementById('addFlightBtn');
    const closeButton = document.querySelector('.modal .close-button');
    const cancelFlightBtn = document.getElementById('cancelFlightBtn');
    const flightForm = document.getElementById('flightForm');
    const modalTitle = document.getElementById('modalTitle');
    const flightIdInput = document.getElementById('flightId');
    const modalIdVuelo = document.getElementById('modalIdVuelo');
    const modalAerolinea = document.getElementById('modalAerolinea');
    const modalOrigen = document.getElementById('modalOrigen');
    const modalDestino = document.getElementById('modalDestino');
    const modalFechaSalida = document.getElementById('modalFechaSalida');
    const modalEstado = document.getElementById('modalEstado');

    function openFlightModal(flightData = null) {
        flightForm.reset(); // Limpiar el formulario
        flightIdInput.value = ''; // Limpiar el ID oculto

        if (flightData) {
            modalTitle.textContent = 'Editar Vuelo';
            flightIdInput.value = flightData._id;
            modalIdVuelo.value = flightData.id_vuelo || '';
            modalAerolinea.value = flightData.aerolinea || '';
            modalOrigen.value = flightData.origen || '';
            modalDestino.value = flightData.destino || '';
            // Formatear la fecha para el input datetime-local
            if (flightData.fecha_salida) {
                // Eliminar los segundos y milisegundos si existen, y la zona horaria 'Z'
                const date = new Date(flightData.fecha_salida);
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                modalFechaSalida.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            } else {
                modalFechaSalida.value = '';
            }
            modalEstado.value = flightData.estado || 'Programado';
        } else {
            modalTitle.textContent = 'Añadir Nuevo Vuelo';
        }
        flightModal.style.display = 'flex'; // Usar flex para centrado
    }

    function closeFlightModal() {
        flightModal.style.display = 'none';
        flightForm.reset();
        flightIdInput.value = '';
    }

    addFlightBtn.addEventListener('click', () => openFlightModal());
    closeButton.addEventListener('click', closeFlightModal);
    cancelFlightBtn.addEventListener('click', closeFlightModal);

    // Cerrar modal si se hace clic fuera del contenido
    window.addEventListener('click', (event) => {
        if (event.target == flightModal) {
            closeFlightModal();
        }
    });

    flightForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Evitar el envío por defecto del formulario

        const id = flightIdInput.value;
        const method = id ? 'PUT' : 'POST'; // Si hay ID, es PUT (editar); si no, es POST (añadir)
        const url = id ? `/api/vuelos/${id}` : '/api/vuelos';

        const flightData = {
            id_vuelo: modalIdVuelo.value,
            aerolinea: modalAerolinea.value,
            origen: modalOrigen.value,
            destino: modalDestino.value,
            fecha_salida: modalFechaSalida.value, // Envía en formato ISO para Python
            estado: modalEstado.value
        };

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(flightData)
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message); // Mostrar mensaje de éxito
                closeFlightModal(); // Cerrar el modal
                updateAllData(); // Recargar todos los datos en el dashboard/tabla
            } else {
                alert(`Error: ${data.message || 'Ocurrió un error.'}`); // Mostrar mensaje de error
            }
        } catch (error) {
            console.error('Error al guardar vuelo:', error);
            alert('Error de conexión o al guardar vuelo.');
        }
    });


    // =====================================================================================================================
    // Función global para eliminar vuelo (llamada desde el HTML de DataTables)
    window.eliminarVuelo = function(id) {
        if (confirm('¿Estás seguro de que quieres eliminar este vuelo? Esta acción no se puede deshacer.')) {
            fetch(`/api/vuelos/${id}`, { method: 'DELETE' })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(errorData => { throw new Error(errorData.message || 'Error al eliminar el vuelo.'); });
                    }
                    return response.json();
                })
                .then(data => {
                    alert(data.message); // Usar alert simple por ahora, se puede mejorar con un modal
                    updateAllData(); // Actualizar todos los datos (KPI, gráficos y tabla)
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error al eliminar el vuelo: ' + error.message);
                });
        }
    };

    // =====================================================================================================================
    // Función para editar vuelo (llamada desde el HTML de DataTables)
    $(document).on('click', '.edit-btn', function() {
        const flightId = $(this).data('id');
        fetch(`/api/vuelos/${flightId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('No se pudo obtener la información del vuelo para editar.');
                }
                return response.json();
            })
            .then(flightData => {
                openFlightModal(flightData); // Abre el modal y rellena con los datos
            })
            .catch(error => {
                console.error('Error al cargar datos del vuelo para edición:', error);
                alert('Error al cargar datos del vuelo: ' + error.message);
            });
    });


    // Función para actualizar todos los componentes
    function updateAllData() {
        if (document.getElementById('totalFlights')) { // Solo cargar KPIs si estamos en el dashboard
            loadKPIs();
        }
        if (document.getElementById('flightsByAirlineChart')) { // Solo cargar gráficos si estamos en dashboard o charts
            loadChartData();
        }
        if ($.fn.DataTable.isDataTable('#flightsTable')) { // Si la tabla ya está inicializada, recargar
            $('#flightsTable').DataTable().ajax.reload(null, false); // null para resetear paginación, false para mantener posición
        } else if (document.getElementById('flightsTable')) { // Si la tabla existe pero no está inicializada (ej. primera carga)
            initializeFlightsTable();
        }
    }
    
    // =====================================================================================================================
    // Ejecución inicial de funciones al cargar la página, dependiendo de la URL
    
    // Solo inicializar DataTables si estamos en la página de dashboard o flights
    if (window.location.pathname.includes('/dashboard') || window.location.pathname.includes('/flights')) {
        initializeFlightsTable();
    }

    // Solo cargar KPIs si estamos en la página de dashboard
    if (window.location.pathname.includes('/dashboard')) {
        loadKPIs();
    }

    // Solo cargar datos de gráficos si estamos en la página de dashboard o charts
    if (window.location.pathname.includes('/dashboard') || window.location.pathname.includes('/charts')) {
        loadChartData();
    }

    // Opcional: Recargar datos al cambiar el tema para actualizar los colores de los gráficos si es necesario
    // Esto es útil si los colores de los gráficos se basan en variables CSS y cambian con el tema.
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            // Pequeño retardo para que el CSS del tema se aplique antes de recrear gráficos
            setTimeout(loadChartData, 100); 
        });
    }

});

// =====================================================================================================================
// Event Listener para el botón de eliminar vuelo (delegación de eventos)
// Esto asegura que los eventos se adjunten correctamente incluso si las filas de la tabla se recargan via AJAX
$(document).on('click', '.delete-btn', function() {
    const flightId = $(this).data('id');
    window.eliminarVuelo(flightId);
});

// Nota: Ya hemos añadido la lógica para el botón 'editar' en el DOMContentLoaded
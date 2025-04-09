let db;
let productosBajoStock = [];
let actividadReciente = [];
let chartMovimientos;
const request = indexedDB.open('erpDB', 5);

request.onupgradeneeded = function(event) {
    db = event.target.result;

    if (!db.objectStoreNames.contains('productos')) {
        const store = db.createObjectStore('productos', { keyPath: 'id', autoIncrement: true });
        store.createIndex('nombre', 'nombre', { unique: false });
    }
    
    if (!db.objectStoreNames.contains('clientes')) {
        const clientesStore = db.createObjectStore('clientes', { keyPath: 'id', autoIncrement: true });
        clientesStore.createIndex('nombre', 'nombre', { unique: false });
        clientesStore.createIndex('email', 'email', { unique: false });
    }

    if (!db.objectStoreNames.contains('proveedores')) {
        const proveedoresStore = db.createObjectStore('proveedores', { keyPath: 'id', autoIncrement: true });
        proveedoresStore.createIndex('nombre', 'nombre', { unique: false });
        proveedoresStore.createIndex('categoria', 'categoria', { unique: false });
        proveedoresStore.createIndex('email', 'email', { unique: false });
    }
        
    if (!db.objectStoreNames.contains('pedidos')) {
        const pedidosStore = db.createObjectStore('pedidos', { keyPath: 'id', autoIncrement: true });
        pedidosStore.createIndex('numero', 'numero', { unique: true });
        pedidosStore.createIndex('proveedor', 'proveedorId', { unique: false });
        pedidosStore.createIndex('fecha', 'fecha', { unique: false });
        pedidosStore.createIndex('estado', 'estado', { unique: false });
    }
    
    if (!db.objectStoreNames.contains('transacciones')) {
        const transaccionesStore = db.createObjectStore('transacciones', { keyPath: 'id', autoIncrement: true });
        transaccionesStore.createIndex('fecha', 'fecha', { unique: false });
        transaccionesStore.createIndex('tipo', 'tipo', { unique: false });
        transaccionesStore.createIndex('categoria', 'categoria', { unique: false });
    }
    
    if (!db.objectStoreNames.contains('facturas')) {
        const facturasStore = db.createObjectStore('facturas', { keyPath: 'id', autoIncrement: true });
        facturasStore.createIndex('numero', 'numero', { unique: true });
        facturasStore.createIndex('cliente', 'cliente', { unique: false });
        facturasStore.createIndex('fecha', 'fecha', { unique: false });
        facturasStore.createIndex('estado', 'estado', { unique: false });
    }
};

request.onsuccess = function(event) {
    db = event.target.result;
    inicializarDashboard();
};

request.onerror = function(event) {
    console.error("Error al abrir la base de datos:", event.target.error);
};

function inicializarDashboard() {
    cargarEstadisticas();
    cargarProductosBajoStock();
    cargarActividadReciente(1);
    inicializarGraficoMovimientos();
}

function cargarEstadisticas() {
    const transaction = db.transaction(['productos'], 'readonly');
    const store = transaction.objectStore('productos');
    const request = store.getAll();

    request.onsuccess = function(event) {
        const productos = event.target.result;
        document.getElementById('totalProductos').textContent = productos.length;
        const productosStockBajo = productos.filter(producto => producto.cantidad < 10);
        document.getElementById('stockBajo').textContent = productosStockBajo.length;
        
        let totalMovimientos = 0;
        let totalVentas = 0;
        
        productos.forEach(producto => {
            if (producto.historial && Array.isArray(producto.historial)) {
                totalMovimientos += producto.historial.length;
                
                const ventas = producto.historial.filter(mov => mov.tipo === 'Venta');
                ventas.forEach(venta => {
                    totalVentas += venta.cantidad;
                });
            }
        });
        
        document.getElementById('totalMovimientos').textContent = totalMovimientos;
        document.getElementById('ventasTotales').textContent = totalVentas;
    };
}

function cargarProductosBajoStock() {
    const transaction = db.transaction(['productos'], 'readonly');
    const store = transaction.objectStore('productos');
    const request = store.getAll();

    request.onsuccess = function(event) {
        const productos = event.target.result;
        
        productosBajoStock = productos.filter(producto => producto.cantidad < 10)
            .sort((a, b) => a.cantidad - b.cantidad);
        
        mostrarProductosBajoStock();
    };
}

function mostrarProductosBajoStock() {
    const tabla = document.getElementById('tablaStockBajo');
    const tbody = tabla.querySelector('tbody');
    
    tbody.innerHTML = '';
    
    if (productosBajoStock.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 3;
        celda.textContent = 'No hay productos con stock bajo';
        fila.appendChild(celda);
        tbody.appendChild(fila);
        return;
    }
    
    const productosAMostrar = productosBajoStock.slice(0, 5);
    
    productosAMostrar.forEach(producto => {
        const fila = document.createElement('tr');
        
        const celdaNombre = document.createElement('td');
        celdaNombre.textContent = producto.nombre;
        fila.appendChild(celdaNombre);
        
        const celdaCantidad = document.createElement('td');
        celdaCantidad.textContent = producto.cantidad;

        if (producto.cantidad <= 3) {
            celdaCantidad.classList.add('text-danger', 'fw-bold');
        } else {
            celdaCantidad.classList.add('text-warning');
        }
        fila.appendChild(celdaCantidad);

        const celdaAccion = document.createElement('td');
        const botonEntrada = document.createElement('button');
        botonEntrada.classList.add('btn', 'btn-sm', 'btn-success');
        botonEntrada.textContent = '+ Entrada';
        botonEntrada.onclick = function() {
            document.getElementById('nombreProductoIngreso').value = producto.nombre;
            document.getElementById('cantidadIngreso').value = 10;
            const modal = new bootstrap.Modal(document.getElementById('modalIngreso'));
            modal.show();
        };
        celdaAccion.appendChild(botonEntrada);
        fila.appendChild(celdaAccion);
        
        tbody.appendChild(fila);
    });
}

function cargarActividadReciente(pagina = 1) {
    const ITEMS_POR_PAGINA = 5;
    const transaction = db.transaction(['productos'], 'readonly');
    const store = transaction.objectStore('productos');
    const request = store.getAll();

    request.onsuccess = function(event) {
        const productos = event.target.result;
        actividadReciente = [];
        
        productos.forEach(producto => {
            if (producto.historial && Array.isArray(producto.historial)) {
                producto.historial.forEach(movimiento => {
                    actividadReciente.push({
                        fecha: new Date(movimiento.fecha),
                        producto: producto.nombre,
                        tipo: movimiento.tipo,
                        cantidad: movimiento.cantidad,
                        cliente: movimiento.cliente || '',
                        descripcion: movimiento.descripcion || ''
                    });
                });
            }
        });
        
        actividadReciente.sort((a, b) => b.fecha - a.fecha);
        
        const totalRegistros = actividadReciente.length;
        const totalPaginas = Math.ceil(totalRegistros / ITEMS_POR_PAGINA);
        const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
        const actual = Math.min(inicio + ITEMS_POR_PAGINA, totalRegistros);
        const actividadPaginada = actividadReciente.slice(inicio, actual);
        
        mostrarActividadReciente(actividadPaginada);
        mostrarPaginacionActividad(pagina, totalPaginas);
        
        const infoResultados = document.getElementById('infoResultadosActividad');
        if (infoResultados) {
            infoResultados.textContent = `Mostrando ${actual} resultados de ${totalRegistros}`;
        }
        
        actualizarDatosGrafico();
    };
}

function mostrarActividadReciente(actividades) {
    const tabla = document.getElementById('tablaActividad');
    const tbody = tabla.querySelector('tbody');
    
    tbody.innerHTML = '';
    
    if (actividades.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 5;
        celda.textContent = 'No hay actividad reciente';
        celda.className = 'text-center';
        fila.appendChild(celda);
        tbody.appendChild(fila);
        return;
    }
    
    actividades.forEach(actividad => {
        const fila = document.createElement('tr');
        
        const celdaFecha = document.createElement('td');
        celdaFecha.textContent = actividad.fecha.toLocaleString();
        fila.appendChild(celdaFecha);
        
        const celdaProducto = document.createElement('td');
        celdaProducto.textContent = actividad.producto;
        fila.appendChild(celdaProducto);
        
        const celdaTipo = document.createElement('td');
        celdaTipo.textContent = actividad.tipo;

        if (actividad.tipo === 'Entrada') {
            celdaTipo.classList.add('text-success');
        } else if (actividad.tipo === 'Salida') {
            celdaTipo.classList.add('text-warning');
        } else if (actividad.tipo === 'Venta') {
            celdaTipo.classList.add('text-info');
        }
        fila.appendChild(celdaTipo);
        
        const celdaCantidad = document.createElement('td');
        celdaCantidad.textContent = actividad.cantidad;
        fila.appendChild(celdaCantidad);
        
        const celdaDetalles = document.createElement('td');
        let detalles = '';
        if (actividad.cliente) {
            detalles += `Cliente: ${actividad.cliente}`;
        }
        if (actividad.descripcion) {
            if (detalles) detalles += ' | ';
            detalles += `Descripción: ${actividad.descripcion}`;
        }
        celdaDetalles.textContent = detalles || '-';
        fila.appendChild(celdaDetalles);
        
        tbody.appendChild(fila);
    });
}

function mostrarPaginacionActividad(paginaActual, totalPaginas) {
    const paginacionDiv = document.getElementById('paginacionActividad');
    if (!paginacionDiv) return;
    
    paginacionDiv.innerHTML = '';
    
    if (totalPaginas <= 1) {
        paginacionDiv.style.display = 'none';
        return;
    }
    
    paginacionDiv.style.display = 'block';
    
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navegación de actividad');
    
    const ul = document.createElement('ul');
    ul.className = 'pagination justify-content-center';
    
    const liPrev = document.createElement('li');
    liPrev.className = `page-item ${paginaActual === 1 ? 'disabled' : ''}`;
    const aPrev = document.createElement('a');
    aPrev.className = 'page-link';
    aPrev.href = '#';
    aPrev.textContent = 'Anterior';
    if (paginaActual > 1) {
        aPrev.addEventListener('click', function(e) {
            e.preventDefault();
            cargarActividadReciente(paginaActual - 1);
        });
    }
    liPrev.appendChild(aPrev);
    ul.appendChild(liPrev);
    
    const maxPaginas = 5;
    let inicio = Math.max(1, paginaActual - Math.floor(maxPaginas / 2));
    let fin = Math.min(totalPaginas, inicio + maxPaginas - 1);
    
    if (fin - inicio + 1 < maxPaginas) {
        inicio = Math.max(1, fin - maxPaginas + 1);
    }
    
    for (let i = inicio; i <= fin; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.textContent = i;
        a.addEventListener('click', function(e) {
            e.preventDefault();
            cargarActividadReciente(i);
        });
        li.appendChild(a);
        ul.appendChild(li);
    }
    
    const liNext = document.createElement('li');
    liNext.className = `page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`;
    const aNext = document.createElement('a');
    aNext.className = 'page-link';
    aNext.href = '#';
    aNext.textContent = 'Siguiente';
    if (paginaActual < totalPaginas) {
        aNext.addEventListener('click', function(e) {
            e.preventDefault();
            cargarActividadReciente(paginaActual + 1);
        });
    }
    liNext.appendChild(aNext);
    ul.appendChild(liNext);
    
    nav.appendChild(ul);
    paginacionDiv.appendChild(nav);
}

function inicializarGraficoMovimientos() {
    const ctx = document.getElementById('movimientosChart').getContext('2d');
    
    chartMovimientos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Entradas (productos registrados)',
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1,
                    data: []
                },
                {
                    label: 'Salidas',
                    backgroundColor: 'rgba(255, 193, 7, 0.7)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 1,
                    data: []
                },
                {
                    label: 'Ventas',
                    backgroundColor: 'rgba(23, 162, 184, 0.7)',
                    borderColor: 'rgba(23, 162, 184, 1)',
                    borderWidth: 1,
                    data: []
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            }
        }
    });
}

function actualizarDatosGrafico() {
    if (!actividadReciente || actividadReciente.length === 0) return;
    
    const hoy = new Date();
    const fechasUltimos7Dias = [];
    const datosEntradas = [];
    const datosSalidas = [];
    const datosVentas = [];
    
    for (let i = 6; i >= 0; i--) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() - i);
        fecha.setHours(0, 0, 0, 0);
        fechasUltimos7Dias.push(fecha);
        
        datosEntradas.push(0);
        datosSalidas.push(0);
        datosVentas.push(0);
    }
    
    actividadReciente.forEach(actividad => {
        const fechaActividad = new Date(actividad.fecha);
        fechaActividad.setHours(0, 0, 0, 0);
        
        const indice = fechasUltimos7Dias.findIndex(fecha => 
            fecha.getFullYear() === fechaActividad.getFullYear() &&
            fecha.getMonth() === fechaActividad.getMonth() &&
            fecha.getDate() === fechaActividad.getDate()
        );
        
        if (indice !== -1) {
            if (actividad.tipo === 'Entrada') {
                datosEntradas[indice] += actividad.cantidad;
            } else if (actividad.tipo === 'Salida') {
                datosSalidas[indice] += actividad.cantidad;
            } else if (actividad.tipo === 'Venta') {
                datosVentas[indice] += actividad.cantidad;
            }
        }
    });
    
    const etiquetas = fechasUltimos7Dias.map(fecha => 
        fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
    );
    
    chartMovimientos.data.labels = etiquetas;
    chartMovimientos.data.datasets[0].data = datosEntradas;
    chartMovimientos.data.datasets[1].data = datosSalidas;
    chartMovimientos.data.datasets[2].data = datosVentas;
    chartMovimientos.update();
}

setInterval(inicializarDashboard, 60000);

window.addEventListener('load', function() {
    if (!document.getElementById('modalIngreso')) {
        const modalHTML = `
        <div class="modal fade" id="modalIngreso" tabindex="-1" aria-labelledby="modalIngresoLabel" aria-hidden="true">
            <div class="modal-dialog">
            <div class="modal-content bg-dark text-white">
                <div class="modal-header bg-dark text-white">
                <h5 class="modal-title" id="modalIngresoLabel">Registrar Entrada de Producto</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                <form id="formIngreso">
                    <div class="mb-3">
                    <label for="nombreProductoIngreso" class="form-label">Nombre del Producto</label>
                    <input type="text" class="form-control" id="nombreProductoIngreso" required>
                    </div>
                    <div class="mb-3">
                    <label for="cantidadIngreso" class="form-label">Cantidad de Entrada</label>
                    <input type="number" class="form-control" id="cantidadIngreso" required min="1">
                    </div>
                </form>
                </div>
                <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="registrarIngreso()">Registrar</button>
                </div>
            </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        if (typeof registrarIngreso !== 'function') {
            window.registrarIngreso = function() {
                alert('Función de ingreso no disponible. Por favor, ve a la página de inventario para registrar entradas.');
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalIngreso'));
                modal.hide();
            };
        }
    }
});
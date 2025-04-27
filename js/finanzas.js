let db;
let transaccionSeleccionadaId = null;
let facturaSeleccionadaId = null;
const TRANSACCIONES_STORE = 'transacciones';
const FACTURAS_STORE = 'facturas';
const CLIENTES_STORE = 'clientes';
const PRODUCTOS_STORE = 'productos';

const CATEGORIAS_INGRESO = [
    'Ventas', 
    'Servicios', 
    'Inversiones', 
    'Préstamos', 
    'Otros Ingresos'
];

const CATEGORIAS_GASTO = [
    'Compras', 
    'Salarios', 
    'Alquiler', 
    'Servicios Públicos', 
    'Transporte', 
    'Suministros', 
    'Marketing', 
    'Impuestos', 
    'Otros Gastos'
];

const request = indexedDB.open('erpDB', 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    const oldVersion = event.oldVersion;
    
    if (!db.objectStoreNames.contains(PRODUCTOS_STORE)) {
        const productosStore = db.createObjectStore(PRODUCTOS_STORE, { keyPath: 'id', autoIncrement: true });
        productosStore.createIndex('nombre', 'nombre', { unique: false });
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
    
    if (!db.objectStoreNames.contains(CLIENTES_STORE)) {
        const clientesStore = db.createObjectStore(CLIENTES_STORE, { keyPath: 'id', autoIncrement: true });
        clientesStore.createIndex('nombre', 'nombre', { unique: false });
    }
    
    if (!db.objectStoreNames.contains(TRANSACCIONES_STORE)) {
        const transaccionesStore = db.createObjectStore(TRANSACCIONES_STORE, { keyPath: 'id', autoIncrement: true });
        transaccionesStore.createIndex('fecha', 'fecha', { unique: false });
        transaccionesStore.createIndex('tipo', 'tipo', { unique: false });
        transaccionesStore.createIndex('categoria', 'categoria', { unique: false });
        transaccionesStore.createIndex('facturaId', 'facturaId', { unique: false });
    } else if (oldVersion < 4) {
        const transaction = event.target.transaction;
        const transaccionesStore = transaction.objectStore(TRANSACCIONES_STORE);
        
        if (!transaccionesStore.indexNames.contains('facturaId')) {
            transaccionesStore.createIndex('facturaId', 'facturaId', { unique: false });
        }
    }
    
    if (!db.objectStoreNames.contains(FACTURAS_STORE)) {
        const facturasStore = db.createObjectStore(FACTURAS_STORE, { keyPath: 'id', autoIncrement: true });
        facturasStore.createIndex('numero', 'numero', { unique: true });
        facturasStore.createIndex('cliente', 'cliente', { unique: false });
        facturasStore.createIndex('fecha', 'fecha', { unique: false });
        facturasStore.createIndex('estado', 'estado', { unique: false });
    }
};

request.onsuccess = function(event) {
    db = event.target.result;
    inicializarFinanzas();
};

request.onerror = function(event) {
    console.error("Error al abrir la base de datos:", event.target.error);
};

function inicializarFinanzas() {
    cargarEstadisticasFinancieras();
    cargarTransacciones();
    configurarEventos();
    configurarFiltrosReportes();
    inicializarGraficos();
}

function configurarEventos() {
    document.getElementById('btnNuevoIngreso').addEventListener('click', () => mostrarModalTransaccion('ingreso'));
    document.getElementById('btnNuevoGasto').addEventListener('click', () => mostrarModalTransaccion('gasto'));
    document.getElementById('btnGuardarTransaccion').addEventListener('click', guardarTransaccion);
    document.getElementById('btnBuscarTransaccion').addEventListener('click', buscarTransacciones);
    document.getElementById('buscarTransaccion').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            buscarTransacciones();
        }
    });
    document.getElementById('filtroTipoTransaccion').addEventListener('change', buscarTransacciones);

    document.getElementById('btnNuevaFactura').addEventListener('click', mostrarModalNuevaFactura);
    document.getElementById('btnGuardarFactura').addEventListener('click', guardarFactura);
    document.getElementById('btnAgregarDetalle').addEventListener('click', agregarFilaDetalle);
    
    document.getElementById('facturas-tab').addEventListener('shown.bs.tab', function(event) {
        cargarFacturas();
    });

    document.querySelectorAll('#finanzasTab button[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(event) {
            if (event.target.id === 'reportes-tab') {
                setTimeout(() => {
                    if (window.chartIngresosVsGastos) {
                        window.chartIngresosVsGastos.resize();
                    }
                    if (window.chartCategoriasGastos) {
                        window.chartCategoriasGastos.resize();
                    }
                    if (window.chartTendencia) {
                        window.chartTendencia.resize();
                    }
                }, 50);
            }
        });
    });
    
    document.getElementById('btnBuscarFactura').addEventListener('click', buscarFacturas);
    document.getElementById('buscarFactura').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            buscarFacturas();
        }
    });
    document.getElementById('filtroEstadoFactura').addEventListener('change', buscarFacturas);
    document.getElementById('filtroMesReporte').addEventListener('change', actualizarReportes);
    document.getElementById('filtroAnioReporte').addEventListener('change', actualizarReportes);
    document.getElementById('btnExportarReporte').addEventListener('click', exportarReporte);
    document.getElementById('btnImprimirFactura').addEventListener('click', imprimirFactura);
    document.getElementById('btnCambiarEstadoFactura').addEventListener('click', cambiarEstadoFactura);
    
    document.getElementById('modalFactura').addEventListener('hidden.bs.modal', function(event) {
        limpiarFormularioFactura();
    });
}

function cargarEstadisticasFinancieras() {
    const transaction = db.transaction([TRANSACCIONES_STORE], 'readonly');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const transacciones = event.target.result;
        let totalIngresos = 0;
        let totalGastos = 0;
        let transaccionesActivas = 0;
        
        transacciones.forEach(transaccion => {
            if (transaccion.revertida) {
                return;
            }
            
            transaccionesActivas++;

            if (transaccion.tipo === 'ingreso') {
                totalIngresos += parseFloat(transaccion.monto);
            } else if (transaccion.tipo === 'gasto') {
                totalGastos += parseFloat(transaccion.monto);
            }
        });
        
        const balance = totalIngresos - totalGastos;
        
        document.getElementById('totalIngresos').textContent = formatearMoneda(totalIngresos);
        document.getElementById('totalGastos').textContent = formatearMoneda(totalGastos);
        document.getElementById('balanceTotal').textContent = formatearMoneda(balance);
        document.getElementById('totalTransacciones').textContent = transaccionesActivas;
        
        const balanceElement = document.getElementById('balanceTotal');
        if (balance < 0) {
            balanceElement.classList.remove('text-success');
            balanceElement.classList.add('text-danger');
        } else {
            balanceElement.classList.remove('text-danger');
            balanceElement.classList.add('text-success');
        }
    };
    
    request.onerror = function(event) {
        console.error("Error al cargar estadísticas financieras:", event.target.error);
    };
}

function formatearMoneda(valor) {
    return '$' + valor.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function mostrarModalTransaccion(tipo) {
    document.getElementById('tipoTransaccion').value = tipo;
    const modalTitle = tipo === 'ingreso' ? 'Nuevo Ingreso' : 'Nuevo Gasto';
    document.getElementById('modalTransaccionLabel').textContent = modalTitle;
    
    const btnGuardar = document.getElementById('btnGuardarTransaccion');
    btnGuardar.className = tipo === 'ingreso' ? 'btn btn-success' : 'btn btn-warning';
    btnGuardar.textContent = 'Guardar ' + (tipo === 'ingreso' ? 'Ingreso' : 'Gasto');
    
    document.getElementById('formTransaccion').reset();
    document.getElementById('transaccionId').value = '';

    document.getElementById('fechaTransaccion').value = DateUtils.getTodayFormatted();
    
    const selectCategorias = document.getElementById('categoriaTransaccion');
    selectCategorias.innerHTML = '';
    
    const categorias = tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO;
    categorias.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria;
        option.textContent = categoria;
        selectCategorias.appendChild(option);
    });
    
    const campoCliente = document.getElementById('campoClienteTransaccion');
    if (tipo === 'ingreso') {
        campoCliente.style.display = 'block';
    } else {
        campoCliente.style.display = 'none';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalTransaccion'));
    modal.show();
}

function guardarTransaccion() {
    const id = document.getElementById('transaccionId').value;
    
    if (id) {
        const transaction = db.transaction([TRANSACCIONES_STORE], 'readonly');
        const store = transaction.objectStore(TRANSACCIONES_STORE);
        const request = store.get(parseInt(id));
        
        request.onsuccess = function(event) {
            const transaccionExistente = event.target.result;
            if (transaccionExistente && esIngresoDeFactura(transaccionExistente)) {
                mostrarNotificacion(
                    'Los ingresos generados por facturas no pueden ser modificados para mantener la integridad de los registros contables', 
                    'warning'
                );
                return;
            }
            
            procesarGuardadoTransaccion();
        };
        
        request.onerror = function(event) {
            console.error('Error al verificar transacción:', event.target.error);
            mostrarNotificacion('Error al verificar la transacción. Por favor, intenta de nuevo.', 'danger');
        };
    } else {
        procesarGuardadoTransaccion();
    }
}

function procesarGuardadoTransaccion() {
    const id = document.getElementById('transaccionId').value;
    const tipo = document.getElementById('tipoTransaccion').value;
    const descripcion = document.getElementById('descripcionTransaccion').value.trim();
    const categoria = document.getElementById('categoriaTransaccion').value;
    const monto = parseFloat(document.getElementById('montoTransaccion').value);
    const fechaInput = document.getElementById('fechaTransaccion').value;
    const cliente = document.getElementById('clienteTransaccion').value.trim();
    const notas = document.getElementById('notasTransaccion').value.trim();
    
    const fecha = DateUtils.parseInputDate(fechaInput);

    if (!descripcion || !categoria || isNaN(monto) || monto <= 0 || !fecha) {
        alert('Por favor, complete todos los campos requeridos correctamente.');
        return;
    }
    
    const transaccion = {
        tipo,
        descripcion,
        categoria,
        monto,
        fecha,
        cliente: tipo === 'ingreso' ? cliente : '',
        notas,
        fechaCreacion: new Date()
    };
    
    const transaction = db.transaction([TRANSACCIONES_STORE], 'readwrite');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    
    if (id) {
        transaccion.id = parseInt(id);
        store.put(transaccion);
    } else {
        store.add(transaccion);
    }
    
    transaction.oncomplete = function() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalTransaccion'));
        modal.hide();
        cargarTransacciones();
        cargarEstadisticasFinancieras();
    };
    
    transaction.onerror = function(event) {
        console.error('Error al guardar transacción:', event.target.error);
        alert('Error al guardar la transacción. Por favor, intenta de nuevo.');
    };
}

function cargarTransacciones(filtroTexto = '', filtroTipo = 'todos', pagina = 1) {
    const ITEMS_POR_PAGINA = 10;
    const transaction = db.transaction([TRANSACCIONES_STORE], 'readonly');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        let transacciones = event.target.result;
        
        if (filtroTexto) {
            filtroTexto = filtroTexto.toLowerCase();
            transacciones = transacciones.filter(t => 
                t.descripcion.toLowerCase().includes(filtroTexto) || 
                t.categoria.toLowerCase().includes(filtroTexto) ||
                (t.cliente && t.cliente.toLowerCase().includes(filtroTexto)) ||
                (t.notas && t.notas.toLowerCase().includes(filtroTexto))
            );
        }
        
        if (filtroTipo !== 'todos') {
            transacciones = transacciones.filter(t => t.tipo === filtroTipo);
        }

        transacciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        const totalTransacciones = transacciones.length;
        const totalPaginas = Math.ceil(totalTransacciones / ITEMS_POR_PAGINA);
        const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
        const fin = inicio + ITEMS_POR_PAGINA;
        const transaccionesPaginadas = transacciones.slice(inicio, fin);
        
        mostrarTransacciones(transaccionesPaginadas);
        mostrarPaginacionTransacciones(pagina, totalPaginas, filtroTexto, filtroTipo);

        const infoResultados = document.getElementById('infoResultadosTransacciones');
        if (infoResultados) {
            infoResultados.textContent = `Mostrando ${Math.min(fin, totalTransacciones)} resultados de un total de ${totalTransacciones}`;
        }
    };
}

function mostrarPaginacionTransacciones(paginaActual, totalPaginas, filtroTexto, filtroTipo) {
    const paginacionDiv = document.getElementById('paginacionTransacciones');
    if (!paginacionDiv) return;
    
    paginacionDiv.innerHTML = '';
    
    if (totalPaginas <= 1) {
        paginacionDiv.style.display = 'none';
        return;
    }
    
    paginacionDiv.style.display = 'block';
    
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navegación de transacciones');
    
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
            cargarTransacciones(filtroTexto, filtroTipo, paginaActual - 1);
        });
    }
    liPrev.appendChild(aPrev);
    ul.appendChild(liPrev);
    
    const maxButtons = 5;
    let startPage = Math.max(1, paginaActual - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPaginas, startPage + maxButtons - 1);
    
    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.textContent = i;
        a.addEventListener('click', function(e) {
            e.preventDefault();
            cargarTransacciones(filtroTexto, filtroTipo, i);
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
            cargarTransacciones(filtroTexto, filtroTipo, paginaActual + 1);
        });
    }
    liNext.appendChild(aNext);
    ul.appendChild(liNext);
    
    nav.appendChild(ul);
    paginacionDiv.appendChild(nav);
}

function revertirTransaccion(id) {
    if (!confirm('¿Estás seguro de que deseas revertir esta transacción? Esta acción creará un nuevo registro que anulará el efecto de esta transacción.')) {
        return;
    }

    const transaction = db.transaction([TRANSACCIONES_STORE], 'readonly');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    const request = store.get(id);
    
    request.onsuccess = function(event) {
        const transaccionOriginal = event.target.result;
        
        if (!transaccionOriginal) {
            mostrarNotificacion('No se encontró la transacción', 'danger');
            return;
        }
        
        if (transaccionOriginal.revertida) {
            mostrarNotificacion('Esta transacción ya ha sido revertida', 'warning');
            return;
        }
        
        if (transaccionOriginal.facturaId) {
            mostrarNotificacion('Las transacciones generadas por facturas no pueden revertirse directamente. Debe cambiar el estado de la factura asociada.', 'warning');
            return;
        }
        
        const motivo = prompt('Por favor, ingrese el motivo de la reversión:', 'Corrección de error');
        
        if (!motivo) {
            mostrarNotificacion('Operación cancelada', 'info');
            return;
        }
        
        const transaccionReversion = {
            tipo: transaccionOriginal.tipo === 'ingreso' ? 'gasto' : 'ingreso',
            descripcion: `REVERSIÓN - ${transaccionOriginal.descripcion}`,
            categoria: transaccionOriginal.categoria,
            monto: transaccionOriginal.monto,
            fecha: new Date(),
            cliente: transaccionOriginal.cliente || '',
            notas: `Reversión de la transacción ID ${transaccionOriginal.id}. Motivo: ${motivo}`,
            fechaCreacion: new Date(),
            transaccionOriginalId: transaccionOriginal.id,
            esReversion: true
        };
        
        const saveTransaction = db.transaction([TRANSACCIONES_STORE], 'readwrite');
        const saveStore = saveTransaction.objectStore(TRANSACCIONES_STORE);
        saveTransaction.onerror = function(event) {
            console.error('Error al crear reversión:', event.target.error);
            mostrarNotificacion('Error al revertir la transacción', 'danger');
        };
        
        const saveRequest = saveStore.add(transaccionReversion);
        
        saveRequest.onsuccess = function(event) {
            const reversionId = event.target.result;
            const updateTransaction = db.transaction([TRANSACCIONES_STORE], 'readwrite');
            const updateStore = updateTransaction.objectStore(TRANSACCIONES_STORE);
            
            updateTransaction.onerror = function(event) {
                console.error('Error al actualizar transacción original:', event.target.error);
                mostrarNotificacion('La reversión se creó pero no se pudo actualizar la transacción original', 'warning');
            };
            
            transaccionOriginal.revertida = true;
            transaccionOriginal.fechaReversion = new Date();
            transaccionOriginal.reversionId = reversionId;
            transaccionOriginal.motivoReversion = motivo;
            
            const updateRequest = updateStore.put(transaccionOriginal);
            
            updateRequest.onsuccess = function() {
                mostrarNotificacion('Transacción revertida correctamente', 'success');
                cargarTransacciones();
                cargarEstadisticasFinancieras();
            };
        };
    };
    
    request.onerror = function(event) {
        console.error('Error al obtener la transacción:', event.target.error);
        mostrarNotificacion('Error al procesar la solicitud', 'danger');
    };
}

function esIngresoDeFactura(transaccion) {
    if (!transaccion) return false;
    
    return (
        transaccion.tipo === 'ingreso' && 
        (
            (transaccion.facturaId !== undefined && transaccion.facturaId !== null) ||
            (transaccion.descripcion && 
             transaccion.descripcion.toLowerCase().includes('factura')) ||
            (transaccion.notas && 
             transaccion.notas.toLowerCase().includes('factura'))
        )
    );
}

function esTransaccionProtegida(transaccion) {
    if (!transaccion) return false;
    return true;
}

function mostrarTransacciones(transacciones) {
    const tablaBody = document.querySelector('#tablaTransacciones tbody');
    tablaBody.innerHTML = '';
   
    if (transacciones.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 6;
        celda.textContent = 'No hay transacciones registradas';
        celda.className = 'text-center';
        fila.appendChild(celda);
        tablaBody.appendChild(fila);
        return;
    }
   
    transacciones.forEach(transaccion => {
        const fila = document.createElement('tr');

        if (transaccion.revertida) {
            fila.classList.add('transaccion-revertida');
        }
        
        if (transaccion.esReversion) {
            fila.classList.add('transaccion-de-reversion');
        }
        
        if (transaccion.facturaId) {
            fila.classList.add('transaccion-factura');
        }
       
        const celdaFecha = document.createElement('td');
        celdaFecha.textContent = DateUtils.formatDisplay(new Date(transaccion.fecha));
        fila.appendChild(celdaFecha);

        const celdaDescripcion = document.createElement('td');
        celdaDescripcion.textContent = transaccion.descripcion;

        if (transaccion.revertida) {
            const badge = document.createElement('span');
            badge.className = 'badge bg-secondary ms-2';
            badge.textContent = 'Revertida';
            celdaDescripcion.appendChild(badge);
        }
        
        if (transaccion.esReversion) {
            const badge = document.createElement('span');
            badge.className = 'badge bg-danger ms-2';
            badge.textContent = 'Valor revertido';
            celdaDescripcion.appendChild(badge);
        }
        
        fila.appendChild(celdaDescripcion);

        const celdaCategoria = document.createElement('td');
        celdaCategoria.textContent = transaccion.categoria;
        fila.appendChild(celdaCategoria);
       
        const celdaTipo = document.createElement('td');
        if (transaccion.tipo === 'ingreso') {
            celdaTipo.innerHTML = '<span class="badge bg-success">Ingreso</span>';
        } else {
            celdaTipo.innerHTML = '<span class="badge bg-warning text-dark">Gasto</span>';
        }
        fila.appendChild(celdaTipo);
       
        const celdaMonto = document.createElement('td');
        celdaMonto.textContent = formatearMoneda(transaccion.monto);
        if (transaccion.tipo === 'ingreso') {
            celdaMonto.className = 'text-success';
        } else {
            celdaMonto.className = 'text-warning';
        }
        fila.appendChild(celdaMonto);
       
        const celdaAcciones = document.createElement('td');
        celdaAcciones.className = 'd-flex justify-content-around';
        
        const btnVer = document.createElement('button');
        btnVer.className = 'btn btn-info btn-sm';
        btnVer.innerHTML = '<i class="fas fa-eye"></i>';
        btnVer.title = 'Ver detalles';
        btnVer.addEventListener('click', () => verDetallesTransaccion(transaccion.id));
        celdaAcciones.appendChild(btnVer);
        
        if (!transaccion.revertida && !transaccion.esReversion) {
            const btnRevertir = document.createElement('button');
            btnRevertir.className = 'btn btn-warning btn-sm';
            btnRevertir.innerHTML = '<i class="fas fa-undo"></i>';
            btnRevertir.title = 'Revertir transacción';
            btnRevertir.addEventListener('click', () => revertirTransaccion(transaccion.id));
            celdaAcciones.appendChild(btnRevertir);
        }
        
        fila.appendChild(celdaAcciones);
       
        tablaBody.appendChild(fila);
    });
}

function verDetallesTransaccion(id) {
    const transaction = db.transaction([TRANSACCIONES_STORE], 'readonly');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    const request = store.get(id);
    
    request.onsuccess = function(event) {
        const transaccion = event.target.result;
        if (!transaccion) {
            mostrarNotificacion('No se encontró la transacción', 'danger');
            return;
        }
        
        let contenido = `
            <div class="table-responsive">
                <table class="table table-dark table-bordered table-hover">
                    <tr>
                        <th style="width: 35%">ID de Transacción:</th>
                        <td>${transaccion.id}</td>
                    </tr>
                    <tr>
                        <th>Fecha:</th>
                        <td>${DateUtils.formatDisplay(new Date(transaccion.fecha))}</td>
                    </tr>
                    <tr>
                        <th>Tipo:</th>
                        <td>${transaccion.tipo === 'ingreso' ? 
                            '<span class="badge bg-success">Ingreso</span>' : 
                            '<span class="badge bg-warning text-dark">Gasto</span>'}</td>
                    </tr>
                    <tr>
                        <th>Categoría:</th>
                        <td>${transaccion.categoria}</td>
                    </tr>
                    <tr>
                        <th>Descripción:</th>
                        <td>${transaccion.descripcion}</td>
                    </tr>
                    <tr>
                        <th>Monto:</th>
                        <td class="${transaccion.tipo === 'ingreso' ? 'text-success' : 'text-warning'}">${formatearMoneda(transaccion.monto)}</td>
                    </tr>`;
        
        if (transaccion.cliente) {
            contenido += `
                <tr>
                    <th>Cliente:</th>
                    <td>${transaccion.cliente}</td>
                </tr>`;
        }
        
        if (transaccion.notas) {
            contenido += `
                <tr>
                    <th>Notas:</th>
                    <td>${transaccion.notas}</td>
                </tr>`;
        }
        
        if (transaccion.facturaId) {
            contenido += `
                <tr>
                    <th>ID de Factura:</th>
                    <td>${transaccion.facturaId}</td>
                </tr>
                <tr>
                    <th>Tipo Especial:</th>
                    <td><span class="badge bg-primary">Ingreso generado por factura</span></td>
                </tr>`;
        }
        
        if (transaccion.revertida) {
            contenido += `
                <tr>
                    <th>Estado:</th>
                    <td><span class="badge bg-secondary">Revertida</span></td>
                </tr>
                <tr>
                    <th>Fecha de Reversión:</th>
                    <td>${DateUtils.formatDisplay(new Date(transaccion.fechaReversion))}</td>
                </tr>
                <tr>
                    <th>Motivo de Reversión:</th>
                    <td>${transaccion.motivoReversion || 'No especificado'}</td>
                </tr>
                <tr>
                    <th>ID de Asiento de Reversión:</th>
                    <td>${transaccion.reversionId || 'No disponible'}</td>
                </tr>`;
        }
        
        if (transaccion.esReversion) {
            contenido += `
                <tr>
                    <th>Tipo Especial:</th>
                    <td><span class="badge bg-info">Asiento de Reversión</span></td>
                </tr>
                <tr>
                    <th>ID de Transacción Original:</th>
                    <td>${transaccion.transaccionOriginalId || 'No disponible'}</td>
                </tr>`;
        }
        
        contenido += `
                <tr>
                    <th>Fecha de Registro:</th>
                    <td>${DateUtils.formatDisplay(new Date(transaccion.fechaCreacion))}</td>
                </tr>
            </table>
        </div>`;
        
        let botones = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>`;
        
        if (!transaccion.revertida && !transaccion.esReversion && !transaccion.facturaId) {
            botones += `<button type="button" class="btn btn-warning" onclick="revertirTransaccion(${transaccion.id}); bootstrap.Modal.getInstance(document.getElementById('modalDetallesTransaccion')).hide();">Revertir Transacción</button>`;
        }
        
        let modalElement = document.getElementById('modalDetallesTransaccion');
        
        if (!modalElement) {
            modalElement = document.createElement('div');
            modalElement.className = 'modal fade';
            modalElement.id = 'modalDetallesTransaccion';
            modalElement.setAttribute('tabindex', '-1');
            modalElement.setAttribute('aria-labelledby', 'tituloModalDetalles');
            modalElement.setAttribute('aria-hidden', 'true');
            
            document.body.appendChild(modalElement);
        }
        
        modalElement.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content  bg-dark text-white">
                    <div class="modal-header">
                        <h5 class="modal-title" id="tituloModalDetalles">Detalles de la Transacción</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        ${contenido}
                    </div>
                    <div class="modal-footer">
                        ${botones}
                    </div>
                </div>
            </div>
        `;
        
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    };
    
    request.onerror = function(event) {
        console.error('Error al obtener la transacción:', event.target.error);
        mostrarNotificacion('Error al cargar los detalles de la transacción', 'danger');
    };
}

function buscarTransacciones() {
    const filtroTexto = document.getElementById('buscarTransaccion').value.trim();
    const filtroTipo = document.getElementById('filtroTipoTransaccion').value;
    cargarTransacciones(filtroTexto, filtroTipo, 1);
}

function editarTransaccion(id) {
    const transaction = db.transaction([TRANSACCIONES_STORE], 'readonly');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    const request = store.get(id);
    
    request.onsuccess = function(event) {
        const transaccion = event.target.result;
        if (transaccion) {
            if (esIngresoDeFactura(transaccion)) {
                mostrarNotificacion(
                    'Los ingresos generados por facturas no pueden ser modificados para mantener la integridad de los registros contables', 
                    'warning'
                );
                return;
            }

            document.getElementById('tipoTransaccion').value = transaccion.tipo;
            const categorias = transaccion.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO;
            const selectCategorias = document.getElementById('categoriaTransaccion');
            selectCategorias.innerHTML = '';
            
            categorias.forEach(categoria => {
                const option = document.createElement('option');
                option.value = categoria;
                option.textContent = categoria;
                selectCategorias.appendChild(option);
            });
            
            const modalTitle = transaccion.tipo === 'ingreso' ? 'Editar Ingreso' : 'Editar Gasto';
            document.getElementById('modalTransaccionLabel').textContent = modalTitle;
            
            const btnGuardar = document.getElementById('btnGuardarTransaccion');
            btnGuardar.className = transaccion.tipo === 'ingreso' ? 'btn btn-success' : 'btn btn-warning';
            btnGuardar.textContent = 'Guardar ' + (transaccion.tipo === 'ingreso' ? 'Ingreso' : 'Gasto');
            
            const campoCliente = document.getElementById('campoClienteTransaccion');
            if (transaccion.tipo === 'ingreso') {
                campoCliente.style.display = 'block';
            } else {
                campoCliente.style.display = 'none';
            }

            document.getElementById('transaccionId').value = transaccion.id;
            document.getElementById('descripcionTransaccion').value = transaccion.descripcion;
            document.getElementById('categoriaTransaccion').value = transaccion.categoria;
            document.getElementById('montoTransaccion').value = transaccion.monto;
            document.getElementById('fechaTransaccion').value = DateUtils.formatForInput(new Date(transaccion.fecha));
            document.getElementById('clienteTransaccion').value = transaccion.cliente || '';
            document.getElementById('notasTransaccion').value = transaccion.notas || '';
            
            const modal = new bootstrap.Modal(document.getElementById('modalTransaccion'));
            modal.show();
        }
    };
}

function eliminarTransaccion(id) {
    const transaction = db.transaction([TRANSACCIONES_STORE], 'readonly');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    const request = store.get(id);
    
    request.onsuccess = function(event) {
        const transaccion = event.target.result;
        
        if (!transaccion) {
            mostrarNotificacion('No se encontró la transacción solicitada', 'danger');
            return;
        }
        
        if (esIngresoDeFactura(transaccion)) {
            mostrarNotificacion(
                'Los ingresos generados por facturas no pueden ser eliminados para mantener la integridad de los registros contables', 
                'warning'
            );
            return;
        }

        if (confirm('¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede deshacer.')) {
            const deleteTransaction = db.transaction([TRANSACCIONES_STORE], 'readwrite');
            const deleteStore = deleteTransaction.objectStore(TRANSACCIONES_STORE);
            const deleteRequest = deleteStore.delete(id);
            
            deleteRequest.onsuccess = function() {
                cargarTransacciones();
                cargarEstadisticasFinancieras();
                mostrarNotificacion('Transacción eliminada correctamente', 'success');
            };
            
            deleteRequest.onerror = function(event) {
                console.error('Error al eliminar transacción:', event.target.error);
                mostrarNotificacion('Error al eliminar la transacción. Por favor, intenta de nuevo.', 'danger');
            };
        }
    };
    
    request.onerror = function(event) {
        console.error('Error al obtener la transacción:', event.target.error);
        mostrarNotificacion('Error al verificar la transacción', 'danger');
    };
}

function configurarFiltrosReportes() {
    const mesActual = new Date().getMonth();
    document.getElementById('filtroMesReporte').value = mesActual;

    const selectAnio = document.getElementById('filtroAnioReporte');
    const anioActual = new Date().getFullYear();
    
    for (let i = 0; i < 5; i++) {
        const anio = anioActual - i;
        const option = document.createElement('option');
        option.value = anio;
        option.textContent = anio;
        selectAnio.appendChild(option);
    }
    
    selectAnio.value = anioActual;
}

function inicializarGraficos() {
    if (window.chartIngresosVsGastos) {
        window.chartIngresosVsGastos.destroy();
    }
    if (window.chartCategoriasGastos) {
        window.chartCategoriasGastos.destroy();
    }
    if (window.chartTendencia) {
        window.chartTendencia.destroy();
    }
    
    const ctxIngresosVsGastos = document.getElementById('ingresosVsGastosChart').getContext('2d');
    const ctxCategoriasGastos = document.getElementById('categoriasGastosChart').getContext('2d');
    const ctxTendencia = document.getElementById('tendenciaChart').getContext('2d');
    
    window.chartIngresosVsGastos = new Chart(ctxIngresosVsGastos, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['rgba(40, 167, 69, 0.7)', 'rgba(255, 193, 7, 0.7)'],
                borderColor: ['rgba(40, 167, 69, 1)', 'rgba(255, 193, 7, 1)'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
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
            }
        }
    });
    
    window.chartCategoriasGastos = new Chart(ctxCategoriasGastos, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                    'rgba(255, 159, 64, 0.7)',
                    'rgba(199, 199, 199, 0.7)',
                    'rgba(83, 102, 255, 0.7)',
                    'rgba(40, 167, 69, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(199, 199, 199, 1)',
                    'rgba(83, 102, 255, 1)',
                    'rgba(40, 167, 69, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#ffffff'
                    }
                }
            }
        }
    });
    
    window.chartTendencia = new Chart(ctxTendencia, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Ingresos',
                    data: [],
                    backgroundColor: 'rgba(40, 167, 69, 0.2)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Gastos',
                    data: [],
                    backgroundColor: 'rgba(255, 193, 7, 0.2)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            },
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
            }
        }
    });
    
    actualizarReportes();
}

function filtrarTransaccionesActivas(transacciones) {
    return transacciones.filter(t => !t.revertida);
}

function actualizarReportes() {
    const mes = parseInt(document.getElementById('filtroMesReporte').value);
    const anio = parseInt(document.getElementById('filtroAnioReporte').value);
    
    const transaction = db.transaction([TRANSACCIONES_STORE], 'readonly');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const todasTransacciones = event.target.result;
        const transaccionesActivas = filtrarTransaccionesActivas(todasTransacciones);
        const transaccionesFiltradas = transaccionesActivas.filter(t => {
            const fecha = new Date(t.fecha);
            return fecha.getMonth() === mes && fecha.getFullYear() === anio;
        });
        
        actualizarGraficoIngresosVsGastos(transaccionesFiltradas);
        actualizarGraficoCategoriasGastos(transaccionesFiltradas);
        actualizarGraficoTendencia(transaccionesActivas, mes, anio);
    };
}

function actualizarGraficoIngresosVsGastos(transacciones) {
    let totalIngresos = 0;
    let totalGastos = 0;
    
    transacciones.forEach(t => {
        if (t.tipo === 'ingreso') {
            totalIngresos += parseFloat(t.monto);
        } else if (t.tipo === 'gasto') {
            totalGastos += parseFloat(t.monto);
        }
    });
    
    window.chartIngresosVsGastos.data.datasets[0].data = [totalIngresos, totalGastos];
    window.chartIngresosVsGastos.update();
}

function actualizarGraficoCategoriasGastos(transacciones) {
    const gastos = transacciones.filter(t => t.tipo === 'gasto');
    
    const categorias = {};
    gastos.forEach(gasto => {
        if (!categorias[gasto.categoria]) {
            categorias[gasto.categoria] = 0;
        }
        categorias[gasto.categoria] += parseFloat(gasto.monto);
    });
    
    const labels = Object.keys(categorias);
    const datos = Object.values(categorias);
    
    window.chartCategoriasGastos.data.labels = labels;
    window.chartCategoriasGastos.data.datasets[0].data = datos;
    window.chartCategoriasGastos.update();
}

function actualizarGraficoTendencia(transacciones, mesFiltro, anioFiltro) {
    const diasEnMes = new Date(anioFiltro, mesFiltro + 1, 0).getDate();
    const labels = [];
    const datosIngresos = [];
    const datosGastos = [];
    
    for (let dia = 1; dia <= diasEnMes; dia++) {
        labels.push(dia);
        datosIngresos.push(0);
        datosGastos.push(0);
    }
    
    const transaccionesFiltradas = transacciones.filter(t => {
        const fecha = new Date(t.fecha);
        return fecha.getMonth() === mesFiltro && fecha.getFullYear() === anioFiltro;
    });
    
    transaccionesFiltradas.forEach(t => {
        const fecha = new Date(t.fecha);
        const dia = fecha.getDate();
        
        if (t.tipo === 'ingreso') {
            datosIngresos[dia - 1] += parseFloat(t.monto);
        } else if (t.tipo === 'gasto') {
            datosGastos[dia - 1] += parseFloat(t.monto);
        }
    });
    
    window.chartTendencia.data.labels = labels;
    window.chartTendencia.data.datasets[0].data = datosIngresos;
    window.chartTendencia.data.datasets[1].data = datosGastos;
    window.chartTendencia.update();
}

function exportarReporte() {
    const mes = parseInt(document.getElementById('filtroMesReporte').value);
    const anio = parseInt(document.getElementById('filtroAnioReporte').value);
    
    const nombreMes = DateUtils.getMonthName(mes);
    
    const transaction = db.transaction([TRANSACCIONES_STORE], 'readonly');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const todasTransacciones = event.target.result;
        const transaccionesActivas = filtrarTransaccionesActivas(todasTransacciones);
        const transaccionesFiltradas = transaccionesActivas.filter(t => {
            const fecha = new Date(t.fecha);
            return fecha.getMonth() === mes && fecha.getFullYear() === anio;
        });
        
        const datos = transaccionesFiltradas.map(t => ({
            'Fecha': new Date(t.fecha).toLocaleDateString(),
            'Tipo': t.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
            'Categoría': t.categoria,
            'Descripción': t.descripcion,
            'Monto': t.monto,
            'Cliente': t.cliente || '',
            'Notas': t.notas || '',
            'ID': t.id || ''
        }));

        const transaccionesRevertidas = todasTransacciones.filter(t => {
            if (!t.revertida) return false;
            const fecha = new Date(t.fecha);
            return fecha.getMonth() === mes && fecha.getFullYear() === anio;
        });
        
        if (transaccionesRevertidas.length > 0) {
            datos.push({});
            datos.push({
                'Fecha': '',
                'Tipo': '',
                'Categoría': '',
                'Descripción': '--- TRANSACCIONES REVERTIDAS ---',
                'Monto': '',
                'Cliente': '',
                'Notas': ''
            });

            transaccionesRevertidas.forEach(t => {
                datos.push({
                    'Fecha': new Date(t.fecha).toLocaleDateString(),
                    'Tipo': t.tipo === 'ingreso' ? 'Ingreso (REVERTIDO)' : 'Gasto (REVERTIDO)',
                    'Categoría': t.categoria,
                    'Descripción': t.descripcion,
                    'Monto': t.monto,
                    'Cliente': t.cliente || '',
                    'Notas': t.notas + ' | Revertido el: ' + new Date(t.fechaReversion).toLocaleDateString(),
                    'ID': t.id || ''
                });
            });
        }
        
        let totalIngresos = 0;
        let totalGastos = 0;
        
        transaccionesFiltradas.forEach(t => {
            if (t.tipo === 'ingreso') {
                totalIngresos += parseFloat(t.monto);
            } else if (t.tipo === 'gasto') {
                totalGastos += parseFloat(t.monto);
            }
        });
        
        const balance = totalIngresos - totalGastos;
        
        datos.push({});
        datos.push({
            'Fecha': '',
            'Tipo': '',
            'Categoría': '',
            'Descripción': 'RESUMEN:',
            'Monto': '',
            'Cliente': '',
            'Notas': ''
        });
        datos.push({
            'Fecha': '',
            'Tipo': '',
            'Categoría': '',
            'Descripción': 'Total Ingresos:',
            'Monto': totalIngresos,
            'Cliente': '',
            'Notas': ''
        });
        datos.push({
            'Fecha': '',
            'Tipo': '',
            'Categoría': '',
            'Descripción': 'Total Gastos:',
            'Monto': totalGastos,
            'Cliente': '',
            'Notas': ''
        });
        datos.push({
            'Fecha': '',
            'Tipo': '',
            'Categoría': '',
            'Descripción': 'Balance:',
            'Monto': balance,
            'Cliente': '',
            'Notas': ''
        });
        
        if (transaccionesRevertidas.length > 0) {
            datos.push({});
            datos.push({
                'Fecha': '',
                'Tipo': '',
                'Categoría': '',
                'Descripción': `Nota: ${transaccionesRevertidas.length} transacciones revertidas no incluidas en los totales`,
                'Monto': '',
                'Cliente': '',
                'Notas': ''
            });
        }
        
        const ws = XLSX.utils.json_to_sheet(datos);
        
        const wscols = [
            {wch: 12},  // Fecha
            {wch: 15},  // Tipo
            {wch: 15},  // Categoría
            {wch: 35},  // Descripción
            {wch: 12},  // Monto
            {wch: 20},  // Cliente
            {wch: 35},  // Notas
            {wch: 10}   // ID
        ];
        ws['!cols'] = wscols;
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Reporte ${nombreMes} ${anio}`);
        
        XLSX.writeFile(wb, `Reporte_Financiero_${nombreMes}_${anio}.xlsx`);
    };
}

function normalizarId(id) {
    if (id === undefined || id === null) {
        return 0;
    }
    
    const idNum = parseInt(id, 10);
    
    if (isNaN(idNum)) {
        return 0;
    }
    
    return idNum;
}

function limpiarFormularioFactura() {
    document.getElementById('facturaId').value = '';
    document.getElementById('modalFacturaLabel').textContent = 'Nueva Factura';
    
    const formularioFactura = document.getElementById('formFactura');
    if (formularioFactura) {
        formularioFactura.reset();
    }
    
    const campoFecha = document.getElementById('fechaFactura');
    if (campoFecha) {
        campoFecha.value = DateUtils.getTodayFormatted();
    }
    
    limpiarTablaDetallesFactura();
    actualizarTotalFactura();
}


function limpiarTablaDetallesFactura() {
    const tablaDetalles = document.querySelector('#tablaDetallesFactura tbody');
    if (!tablaDetalles) return;
    
    const filaAgregar = document.getElementById('filaAgregarDetalle');

    while (tablaDetalles.firstChild) {
        if (tablaDetalles.firstChild === filaAgregar) {
            break;
        }
        tablaDetalles.removeChild(tablaDetalles.firstChild);
    }
}

async function mostrarModalNuevaFactura() {
    limpiarFormularioFactura();
    
    try {
        const numeroFactura = await generarNumeroFactura();
        document.getElementById('numeroFactura').value = numeroFactura;
        
        cargarClientesParaSelect();
        
        const modal = new bootstrap.Modal(document.getElementById('modalFactura'));
        modal.show();
    } catch (error) {
        console.error("Error al mostrar modal de factura:", error);
        mostrarNotificacion("Ocurrió un error al preparar la factura. Intente nuevamente.", "danger");
    }
}

function generarNumeroFactura() {
    return new Promise((resolve, reject) => {
        const fecha = new Date();
        const anio = fecha.getFullYear().toString().substr(-2);
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const prefijo = `F${anio}${mes}-`;
        
        const transaction = db.transaction([FACTURAS_STORE], 'readonly');
        const store = transaction.objectStore(FACTURAS_STORE);
        const request = store.getAll();
        
        request.onsuccess = function(event) {
            const facturas = event.target.result;
            let maxNumero = 0;
            
            facturas.forEach(factura => {
                if (factura.numero && factura.numero.startsWith(prefijo)) {
                    const numParte = factura.numero.substring(prefijo.length);
                    const num = parseInt(numParte);
                    if (!isNaN(num) && num > maxNumero) {
                        maxNumero = num;
                    }
                }
            });

            const siguienteNumero = (maxNumero + 1).toString().padStart(3, '0');
            const numeroCompleto = `${prefijo}${siguienteNumero}`;
            
            resolve(numeroCompleto);
        };
        
        request.onerror = function(event) {
            console.error("Error al generar número de factura:", event.target.error);
            const timestamp = Date.now().toString().slice(-5);
            const numeroFallback = `${prefijo}${timestamp}`;
            resolve(numeroFallback);
        };
    });
}

function cargarClientesParaSelect(clienteIdSeleccionado = null) {
    const transaction = db.transaction([CLIENTES_STORE], 'readonly');
    const store = transaction.objectStore(CLIENTES_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const clientes = event.target.result;
        const select = document.getElementById('clienteFactura');
        
        select.innerHTML = '<option value="">Seleccione un cliente</option>';
        
        clientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = cliente.nombre;
            select.appendChild(option);
        });
        
        if (clienteIdSeleccionado) {
            select.value = clienteIdSeleccionado;
        }
    };
}

function agregarFilaDetalle() {
    const tablaDetalles = document.querySelector('#tablaDetallesFactura tbody');
    const filaAgregar = document.getElementById('filaAgregarDetalle');
    
    const nuevaFila = document.createElement('tr');
    
    const celdaProducto = document.createElement('td');
    const selectProducto = document.createElement('select');
    selectProducto.className = 'form-select producto-select';
    selectProducto.innerHTML = '<option value="">Seleccione producto</option>';
    
    const transaction = db.transaction([PRODUCTOS_STORE], 'readonly');
    const store = transaction.objectStore(PRODUCTOS_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const productos = event.target.result;
        
        productos.forEach(producto => {
            const option = document.createElement('option');
            option.value = producto.id;
            option.textContent = producto.nombre;
            option.dataset.precio = producto.precio || '0.00';
            selectProducto.appendChild(option);
        });
        
        selectProducto.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const inputPrecio = nuevaFila.querySelector('.precio-input');
            
            if (selectedOption && selectedOption.dataset.precio) {
                inputPrecio.value = parseFloat(selectedOption.dataset.precio).toFixed(2);
            } else {
                inputPrecio.value = '0.00';
            }
            
            actualizarSubtotalDetalle(nuevaFila);
        });
    };
    
    celdaProducto.appendChild(selectProducto);
    nuevaFila.appendChild(celdaProducto);

    const celdaCantidad = document.createElement('td');
    const inputCantidad = document.createElement('input');
    inputCantidad.type = 'number';
    inputCantidad.className = 'form-control cantidad-input';
    inputCantidad.min = '1';
    inputCantidad.value = '1';
    inputCantidad.addEventListener('change', function() {
        actualizarSubtotalDetalle(nuevaFila);
    });
    celdaCantidad.appendChild(inputCantidad);
    nuevaFila.appendChild(celdaCantidad);

    const celdaPrecio = document.createElement('td');
    const inputPrecio = document.createElement('input');
    inputPrecio.type = 'number';
    inputPrecio.className = 'form-control precio-input';
    inputPrecio.min = '1.00';
    inputPrecio.step = '1.00';
    inputPrecio.value = '0.00';
    inputPrecio.readOnly = true;
    inputPrecio.addEventListener('change', function() {
        actualizarSubtotalDetalle(nuevaFila);
    });
    celdaPrecio.appendChild(inputPrecio);
    nuevaFila.appendChild(celdaPrecio);
    
    const celdaSubtotal = document.createElement('td');
    celdaSubtotal.className = 'subtotal-celda';
    celdaSubtotal.textContent = '$0.00';
    nuevaFila.appendChild(celdaSubtotal);

    const celdaAccion = document.createElement('td');
    const btnEliminar = document.createElement('button');
    btnEliminar.className = 'btn btn-danger btn-sm';
    btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    btnEliminar.addEventListener('click', function() {
        tablaDetalles.removeChild(nuevaFila);
        actualizarTotalFactura();
    });
    celdaAccion.appendChild(btnEliminar);
    nuevaFila.appendChild(celdaAccion);

    tablaDetalles.insertBefore(nuevaFila, filaAgregar);
}

function actualizarSubtotalDetalle(fila) {
    const selectProducto = fila.querySelector('.producto-select');
    const inputCantidad = fila.querySelector('.cantidad-input');
    const inputPrecio = fila.querySelector('.precio-input');
    const celdaSubtotal = fila.querySelector('.subtotal-celda');
    
    const cantidad = parseFloat(inputCantidad.value) || 0;
    let precio = parseFloat(inputPrecio.value) || 0;

    if (selectProducto.value && precio === 0) {
        const selectedOption = selectProducto.options[selectProducto.selectedIndex];
        if (selectedOption && selectedOption.dataset.precio) {
            precio = parseFloat(selectedOption.dataset.precio);
            inputPrecio.value = precio.toFixed(2);
        }
    }
    
    const subtotal = cantidad * precio;
    celdaSubtotal.textContent = formatearMoneda(subtotal);
    
    actualizarTotalFactura();
}

function agregarFilaDetalleExistente(detalle) {
    const tablaDetalles = document.querySelector('#tablaDetallesFactura tbody');
    const filaAgregar = document.getElementById('filaAgregarDetalle');
    
    const nuevaFila = document.createElement('tr');
    
    const celdaProducto = document.createElement('td');
    const selectProducto = document.createElement('select');
    selectProducto.className = 'form-select producto-select';
    selectProducto.innerHTML = '<option value="">Seleccione producto</option>';
    
    const transaction = db.transaction([PRODUCTOS_STORE], 'readonly');
    const store = transaction.objectStore(PRODUCTOS_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const productos = event.target.result;
        
        productos.forEach(producto => {
            const option = document.createElement('option');
            option.value = producto.id;
            option.textContent = producto.nombre;
            option.dataset.precio = producto.precio || '0.00';
            selectProducto.appendChild(option);
        });
        
        selectProducto.value = detalle.productoId;
        
        selectProducto.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const inputPrecio = nuevaFila.querySelector('.precio-input');
            
            if (selectedOption && selectedOption.dataset.precio) {
                inputPrecio.value = parseFloat(selectedOption.dataset.precio).toFixed(2);
            } else {
                inputPrecio.value = '0.00';
            }
            
            actualizarSubtotalDetalle(nuevaFila);
        });
    };
    
    celdaProducto.appendChild(selectProducto);
    nuevaFila.appendChild(celdaProducto);

    const celdaCantidad = document.createElement('td');
    const inputCantidad = document.createElement('input');
    inputCantidad.type = 'number';
    inputCantidad.className = 'form-control cantidad-input';
    inputCantidad.min = '1';
    inputCantidad.value = detalle.cantidad;
    inputCantidad.addEventListener('change', function() {
        actualizarSubtotalDetalle(nuevaFila);
    });
    celdaCantidad.appendChild(inputCantidad);
    nuevaFila.appendChild(celdaCantidad);

    const celdaPrecio = document.createElement('td');
    const inputPrecio = document.createElement('input');
    inputPrecio.type = 'number';
    inputPrecio.className = 'form-control precio-input';
    inputPrecio.min = '0.01';
    inputPrecio.step = '0.01';
    inputPrecio.readOnly = true;
    inputPrecio.value = detalle.precio;
    inputPrecio.addEventListener('change', function() {
        actualizarSubtotalDetalle(nuevaFila);
    });
    celdaPrecio.appendChild(inputPrecio);
    nuevaFila.appendChild(celdaPrecio);
    
    const celdaSubtotal = document.createElement('td');
    celdaSubtotal.className = 'subtotal-celda';
    celdaSubtotal.textContent = formatearMoneda(detalle.subtotal);
    nuevaFila.appendChild(celdaSubtotal);

    const celdaAccion = document.createElement('td');
    const btnEliminar = document.createElement('button');
    btnEliminar.className = 'btn btn-danger btn-sm';
    btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    btnEliminar.addEventListener('click', function() {
        tablaDetalles.removeChild(nuevaFila);
        actualizarTotalFactura();
    });
    celdaAccion.appendChild(btnEliminar);
    nuevaFila.appendChild(celdaAccion);

    tablaDetalles.insertBefore(nuevaFila, filaAgregar);
}

function actualizarSubtotalDetalle(fila) {
    const selectProducto = fila.querySelector('.producto-select');
    const inputCantidad = fila.querySelector('.cantidad-input');
    const inputPrecio = fila.querySelector('.precio-input');
    const celdaSubtotal = fila.querySelector('.subtotal-celda');
    
    const cantidad = parseFloat(inputCantidad.value) || 0;
    let precio = parseFloat(inputPrecio.value) || 0;

    if (selectProducto.value && precio === 0) {
        const selectedOption = selectProducto.options[selectProducto.selectedIndex];
        if (selectedOption && selectedOption.dataset.precio) {
            precio = parseFloat(selectedOption.dataset.precio);
            inputPrecio.value = precio.toFixed(2);
        }
    }
    
    const subtotal = cantidad * precio;
    celdaSubtotal.textContent = formatearMoneda(subtotal);
    
    actualizarTotalFactura();
}

function actualizarTotalFactura() {
    const celdasSubtotal = document.querySelectorAll('.subtotal-celda');
    let total = 0;
    
    celdasSubtotal.forEach(celda => {
        const subtotalTexto = celda.textContent.replace(/[^\d.-]/g, '');
        const subtotal = parseFloat(subtotalTexto) || 0;
        total += subtotal;
    });
    
    document.getElementById('totalFactura').textContent = formatearMoneda(total);
}

async function actualizarUltimaCompraCliente(clienteId, fechaCompra) {
    clienteId = normalizarId(clienteId);
    if (clienteId === 0) {
        console.warn("ID de cliente inválido");
        return Promise.resolve();
    }
    
    try {
        let fecha = fechaCompra;
        if (!(fechaCompra instanceof Date)) {
            fecha = new Date(fechaCompra);
        }
        
        if (isNaN(fecha.getTime())) {
            fecha = new Date();
        }
        
        const transaction = db.transaction([CLIENTES_STORE], 'readwrite');
        const store = transaction.objectStore(CLIENTES_STORE);
        
        const cliente = await new Promise((resolve, reject) => {
            const request = store.get(clienteId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
        
        if (!cliente) {
            console.warn(`Cliente con ID ${clienteId} no encontrado`);
            return;
        }
        
        const fechaActual = cliente.ultimaCompra ? new Date(cliente.ultimaCompra) : null;
        if (!fechaActual || fecha > fechaActual) {
            cliente.ultimaCompra = fecha;
            
            if (cliente.estado !== 'activo') {
                cliente.estado = 'activo';
            }
            
            await new Promise((resolve, reject) => {
                const updateRequest = store.put(cliente);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = (e) => reject(e.target.error);
            });
            
            console.log(`Fecha de última compra actualizada para cliente ${cliente.nombre}`);
        }
        
        return Promise.resolve();
    } catch (error) {
        console.error("Error al actualizar la fecha de última compra del cliente:", error);
        return Promise.resolve();
    }
}

async function guardarFactura() {
    if (typeof validarGuardadoFactura === 'function' && !validarGuardadoFactura()) {
        return;
    }
    
    const id = document.getElementById('facturaId').value;
    const numero = document.getElementById('numeroFactura').value.trim();
    const fechaInput = document.getElementById('fechaFactura').value;
    const clienteIdString = document.getElementById('clienteFactura').value;
    const estado = document.getElementById('estadoFactura').value;
    const notas = document.getElementById('notasFactura').value.trim();

    const clienteId = normalizarId(clienteIdString);
    const fecha = DateUtils.parseInputDate(fechaInput);

    if (!numero || !fecha || !clienteId) {
        alert('Por favor, complete todos los campos requeridos.');
        return;
    }
    
    const filas = document.querySelectorAll('#tablaDetallesFactura tbody tr:not(#filaAgregarDetalle)');
    const detalles = [];
    let totalFactura = 0;
    
    if (filas.length === 0) {
        alert('Debe agregar al menos un producto a la factura.');
        return;
    }
    
    for (const fila of filas) {
        const selectProducto = fila.querySelector('.producto-select');
        const inputCantidad = fila.querySelector('.cantidad-input');
        const inputPrecio = fila.querySelector('.precio-input');
        
        const productoId = selectProducto.value;
        const productoNombre = selectProducto.selectedOptions[0].textContent;
        const cantidad = parseFloat(inputCantidad.value) || 0;
        const precio = parseFloat(inputPrecio.value) || 0;
        const subtotal = cantidad * precio;
        
        if (!productoId || cantidad <= 0 || precio <= 0) {
            alert('Por favor, complete correctamente todos los detalles de productos.');
            return;
        }
        
        detalles.push({
            productoId,
            productoNombre,
            cantidad,
            precio,
            subtotal
        });
        
        totalFactura += subtotal;
    }
    
    const clienteNombre = document.getElementById('clienteFactura').selectedOptions[0].textContent;
    
    const factura = {
        numero,
        fecha,
        clienteId: clienteId,
        clienteNombre,
        estado,
        detalles,
        total: totalFactura,
        notas,
        fechaCreacion: new Date()
    };
    
    try {
        const transaction = db.transaction([FACTURAS_STORE], 'readwrite');
        const store = transaction.objectStore(FACTURAS_STORE);
        
        let facturaGuardada;
        
        if (id) {
            factura.id = parseInt(id);
            const request = store.put(factura);
            await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
            facturaGuardada = factura;
        } else {
            const request = store.add(factura);
            const result = await new Promise((resolve, reject) => {
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
            facturaGuardada = { ...factura, id: result };
        }

        if (estado === 'pagada') {
            registrarIngresoDesdeFactura(facturaGuardada);
            
            if (typeof actualizarUltimaCompraCliente === 'function') {
                try {
                    await actualizarUltimaCompraCliente(clienteId, fecha);
                } catch (e) {
                    console.warn("Error al actualizar fecha de compra del cliente:", e);
                }
            } else {
                console.warn("Función actualizarUltimaCompraCliente no disponible");
            }
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalFactura'));
        modal.hide();
        
        cargarFacturas();
        
        mostrarNotificacion(`Factura ${numero} guardada correctamente`, 'success');
    } catch (error) {
        console.error('Error al guardar factura:', error);
        mostrarNotificacion('Error al guardar la factura. Por favor, intenta de nuevo.', 'danger');
    }
}

function registrarIngresoDesdeFactura(factura) {
    if (!factura || !factura.id) {
        console.error("Error al registrar ingreso: factura inválida", factura);
        return;
    }
    
    const transaccion = {
        tipo: 'ingreso',
        descripcion: `Pago de factura ${factura.numero}`,
        categoria: 'Ventas',
        monto: factura.total,
        fecha: new Date(),
        cliente: factura.clienteNombre,
        notas: `Factura pagada - ${factura.detalles.length} productos`,
        fechaCreacion: new Date(),
        facturaId: factura.id
    };
    
    const transaction = db.transaction([TRANSACCIONES_STORE], 'readwrite');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    
    const request = store.add(transaccion);
    
    request.onsuccess = function() {
        cargarEstadisticasFinancieras();
        console.log("Ingreso registrado por factura:", factura.numero);
    };
    
    request.onerror = function(event) {
        console.error("Error al registrar ingreso desde factura:", event.target.error);
    };
}

function cargarFacturas(filtroTexto = '', filtroEstado = 'todos', pagina = 1) {
    const ITEMS_POR_PAGINA = 10;
    const transaction = db.transaction([FACTURAS_STORE], 'readonly');
    const store = transaction.objectStore(FACTURAS_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        let facturas = event.target.result;
        
        if (filtroTexto) {
            filtroTexto = filtroTexto.toLowerCase();
            facturas = facturas.filter(f => 
                f.numero.toLowerCase().includes(filtroTexto) || 
                f.clienteNombre.toLowerCase().includes(filtroTexto)
            );
        }
        
        if (filtroEstado !== 'todos') {
            facturas = facturas.filter(f => f.estado === filtroEstado);
        }
        
        facturas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        const totalFacturas = facturas.length;
        const totalPaginas = Math.ceil(totalFacturas / ITEMS_POR_PAGINA);
        const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
        const fin = inicio + ITEMS_POR_PAGINA;
        const facturasPaginadas = facturas.slice(inicio, fin);
        
        mostrarFacturas(facturasPaginadas);
        mostrarPaginacionFacturas(pagina, totalPaginas, filtroTexto, filtroEstado);

        const infoResultados = document.getElementById('infoResultadosFacturas');
        if (infoResultados) {
            infoResultados.textContent = `Mostrando ${Math.min(fin, totalFacturas)} facturas de un total de ${totalFacturas}`;
        }
    };
}

function mostrarPaginacionFacturas(paginaActual, totalPaginas, filtroTexto, filtroEstado) {
    const paginacionDiv = document.getElementById('paginacionFacturas');
    if (!paginacionDiv) return;
    
    paginacionDiv.innerHTML = '';
    
    if (totalPaginas <= 1) {
        paginacionDiv.style.display = 'none';
        return;
    }
    
    paginacionDiv.style.display = 'block';
    
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navegación de facturas');
    
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
            cargarFacturas(filtroTexto, filtroEstado, paginaActual - 1);
        });
    }
    liPrev.appendChild(aPrev);
    ul.appendChild(liPrev);
    
    const maxButtons = 5;
    let startPage = Math.max(1, paginaActual - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPaginas, startPage + maxButtons - 1);
    
    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.textContent = i;
        a.addEventListener('click', function(e) {
            e.preventDefault();
            cargarFacturas(filtroTexto, filtroEstado, i);
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
            cargarFacturas(filtroTexto, filtroEstado, paginaActual + 1);
        });
    }
    liNext.appendChild(aNext);
    ul.appendChild(liNext);
    
    nav.appendChild(ul);
    paginacionDiv.appendChild(nav);
}

function mostrarFacturas(facturas) {
    const tablaBody = document.querySelector('#tablaFacturas tbody');
    tablaBody.innerHTML = '';
    
    if (facturas.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 6;
        celda.textContent = 'No hay facturas registradas';
        celda.className = 'text-center';
        fila.appendChild(celda);
        tablaBody.appendChild(fila);
        return;
    }
    
    facturas.forEach(factura => {
        const fila = document.createElement('tr');

        if (factura.origenInventario) {
            fila.classList.add('factura-from-inventario');
            fila.style.borderLeft = '3px solid #0d6efd';
        }

        const celdaNumero = document.createElement('td');
        celdaNumero.textContent = factura.numero;

        if (factura.origenInventario) {
            const indicador = document.createElement('span');
            indicador.className = 'badge bg-info ms-2';
            indicador.title = 'Generada desde Inventario';
            indicador.textContent = 'INV';
            celdaNumero.appendChild(indicador);
        }
        fila.appendChild(celdaNumero);

        const celdaFecha = document.createElement('td');
        celdaFecha.textContent = DateUtils.formatDisplay(new Date(factura.fecha));
        fila.appendChild(celdaFecha);
        
        const celdaCliente = document.createElement('td');
        celdaCliente.textContent = factura.clienteNombre;
        fila.appendChild(celdaCliente);
        
        const celdaMonto = document.createElement('td');
        celdaMonto.textContent = formatearMoneda(factura.total);
        fila.appendChild(celdaMonto);
        
        const celdaEstado = document.createElement('td');
        let badgeClass = '';
        switch(factura.estado) {
            case 'pendiente':
                badgeClass = 'bg-warning text-dark';
                break;
            case 'pagada':
                badgeClass = 'bg-success';
                break;
            case 'cancelada':
                badgeClass = 'bg-danger';
                break;
        }
        celdaEstado.innerHTML = `<span class="badge ${badgeClass}">${factura.estado.toUpperCase()}</span>`;
        fila.appendChild(celdaEstado);
        
        const celdaAcciones = document.createElement('td');
        celdaAcciones.className = 'd-flex justify-content-around';

        const btnVer = document.createElement('button');
        btnVer.className = 'btn btn-info btn-sm';
        btnVer.innerHTML = '<i class="fas fa-eye"></i>';
        btnVer.title = 'Ver factura';
        btnVer.addEventListener('click', () => verFactura(factura.id));
        celdaAcciones.appendChild(btnVer);

        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn btn-warning btn-sm';
        btnEditar.innerHTML = '<i class="fas fa-edit"></i>';
        btnEditar.title = 'Editar factura';
        btnEditar.disabled = factura.estado === 'pagada';
        btnEditar.addEventListener('click', () => editarFactura(factura.id));
        celdaAcciones.appendChild(btnEditar);
        
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn btn-danger btn-sm';
        btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
        btnEliminar.title = 'Eliminar factura';
        btnEliminar.disabled = factura.estado === 'pagada';
        btnEliminar.addEventListener('click', () => eliminarFactura(factura.id));
        celdaAcciones.appendChild(btnEliminar);
        
        fila.appendChild(celdaAcciones);
        
        tablaBody.appendChild(fila);
    });
}

function buscarFacturas() {
    const filtroTexto = document.getElementById('buscarFactura').value.trim();
    const filtroEstado = document.getElementById('filtroEstadoFactura').value;
    cargarFacturas(filtroTexto, filtroEstado, 1);
}

function verFactura(id) {
    const transaction = db.transaction([FACTURAS_STORE], 'readonly');
    const store = transaction.objectStore(FACTURAS_STORE);
    const request = store.get(id);
    
    request.onsuccess = function(event) {
        const factura = event.target.result;
        if (factura) {
            facturaSeleccionadaId = factura.id;

            document.getElementById('verNumeroFactura').textContent = factura.numero;
            document.getElementById('verNumeroFactura2').textContent = factura.numero;
            document.getElementById('verFechaFactura').textContent = DateUtils.formatDisplay(new Date(factura.fecha));

            const fechaVencimiento = new Date(factura.fecha);
            fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
            document.getElementById('verFechaVencimiento').textContent = DateUtils.formatDisplay(fechaVencimiento);
            
            document.getElementById('verClienteFactura').textContent = factura.clienteNombre;
            
            cargarDatosAdicionalesCliente(factura.clienteId);
            
            const spanEstado = document.getElementById('sello');
            spanEstado.textContent = factura.estado.toUpperCase();

            spanEstado.className = 'badge rounded-pill p-2 fs-6';
            if (factura.estado === 'pendiente') {
                spanEstado.classList.add('bg-warning', 'text-dark');
            } else if (factura.estado === 'pagada') {
                spanEstado.classList.add('bg-success');
            } else {
                spanEstado.classList.add('bg-danger');
            }
            
            const notasText = factura.origenInventario ? 
                `Factura generada automáticamente desde el módulo de Inventario. ${factura.notas || ''}` : 
                factura.notas || 'Sin notas';
            
            document.getElementById('verNotasFactura').textContent = notasText;
            
            const tablaBody = document.querySelector('#tablaVerDetallesFactura');
            tablaBody.innerHTML = '';
            
            let subtotal = 0;
            
            factura.detalles.forEach((detalle, index) => {
                const fila = document.createElement('tr');

                const celdaNumero = document.createElement('td');
                celdaNumero.className = 'text-center';
                celdaNumero.textContent = index + 1;
                fila.appendChild(celdaNumero);

                const celdaProducto = document.createElement('td');
                celdaProducto.textContent = detalle.productoNombre;
                fila.appendChild(celdaProducto);

                const celdaCantidad = document.createElement('td');
                celdaCantidad.className = 'text-center';
                celdaCantidad.textContent = detalle.cantidad;
                fila.appendChild(celdaCantidad);
                
                const celdaPrecio = document.createElement('td');
                celdaPrecio.className = 'text-end';
                celdaPrecio.textContent = formatearMoneda(detalle.precio);
                fila.appendChild(celdaPrecio);

                const celdaSubtotal = document.createElement('td');
                celdaSubtotal.className = 'text-end';
                celdaSubtotal.textContent = formatearMoneda(detalle.subtotal);
                fila.appendChild(celdaSubtotal);
                
                subtotal += detalle.subtotal;
                
                tablaBody.appendChild(fila);
            });
            
            const iva = subtotal * 0.19;
            const total = subtotal + iva;
            
            document.getElementById('verSubtotalFactura').textContent = formatearMoneda(subtotal);
            document.getElementById('verIvaFactura').textContent = formatearMoneda(iva);
            document.getElementById('verTotalFactura').textContent = formatearMoneda(total);
            
            const btnCambiarEstado = document.getElementById('btnCambiarEstadoFactura');
            if (factura.estado === 'pendiente') {
                btnCambiarEstado.classList.remove('d-none');
                btnCambiarEstado.textContent = 'Marcar como Pagada';
                btnCambiarEstado.className = 'btn btn-success';
                btnCambiarEstado.innerHTML = '<i class="fas fa-check-circle"></i> Marcar como Pagada';
                btnCambiarEstado.title = 'Marcar esta factura como pagada';
            } else if (factura.estado === 'pagada') {
                btnCambiarEstado.classList.add('d-none');
            } else {
                btnCambiarEstado.classList.add('d-none');
            }

            const modal = new bootstrap.Modal(document.getElementById('modalVerFactura'));
            modal.show();
        }
    };
}

function cargarDatosAdicionalesCliente(clienteId) {
    clienteId = normalizarId(clienteId);

    if (clienteId === 0) return;
    
    const transaction = db.transaction([CLIENTES_STORE], 'readonly');
    const store = transaction.objectStore(CLIENTES_STORE);
    const request = store.get(clienteId);
    
    request.onsuccess = function(event) {
        const cliente = event.target.result;
        if (!cliente) {
            console.warn("No se encontró el cliente con ID:", clienteId);
            return;
        }
        
        let direccion = '';
        if (cliente.direccion) {
            direccion = cliente.direccion;
            if (cliente.ciudad) {
                direccion += ', ' + cliente.ciudad;
            }
            if (cliente.pais) {
                direccion += ', ' + cliente.pais;
            }
        }
        
        document.getElementById('verDireccionCliente').textContent = direccion || '-';
        document.getElementById('verTelefonoCliente').textContent = cliente.telefono || '-';
    };
    
    request.onerror = function(event) {
        console.error("Error al cargar datos del cliente:", event.target.error);
    };
}

async function cambiarEstadoFactura() {
    if (!facturaSeleccionadaId) return;
    
    try {
        const facturaTransaction = db.transaction([FACTURAS_STORE], 'readonly');
        const facturaStore = facturaTransaction.objectStore(FACTURAS_STORE);
        
        const factura = await new Promise((resolve, reject) => {
            const request = facturaStore.get(facturaSeleccionadaId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
        
        if (!factura) {
            throw new Error("No se encontró la factura");
        }
        
        const estadoAnterior = factura.estado;
        
        if (factura.estado === 'pagada') {
            alert('Las facturas pagadas no pueden volver a estado pendiente');
            return;
        }
        
        if (factura.estado === 'pendiente') {
            const transaccionTransaction = db.transaction([TRANSACCIONES_STORE], 'readonly');
            const transaccionStore = transaccionTransaction.objectStore(TRANSACCIONES_STORE);
            
            let existenTransacciones = false;
            
            try {
                const ingresos = await new Promise((resolve, reject) => {
                    const request = transaccionStore.getAll();
                    request.onsuccess = () => {
                        const todasTransacciones = request.result;
                        const transaccionesFiltradas = todasTransacciones.filter(
                            t => t.facturaId === factura.id || 
                                (t.notas && t.notas.includes(`Factura ${factura.numero}`))
                        );
                        resolve(transaccionesFiltradas);
                    };
                    request.onerror = (e) => reject(e.target.error);
                });
                
                existenTransacciones = ingresos && ingresos.length > 0;
            } catch (error) {
                console.warn("Error al verificar transacciones:", error);
                existenTransacciones = false;
            }

            const updateTransaction = db.transaction([FACTURAS_STORE], 'readwrite');
            const updateStore = updateTransaction.objectStore(FACTURAS_STORE);
            
            factura.estado = 'pagada';
            
            await new Promise((resolve, reject) => {
                const request = updateStore.put(factura);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });

            if (typeof actualizarUltimaCompraCliente === 'function') {
                try {
                    await actualizarUltimaCompraCliente(factura.clienteId, factura.fecha);
                } catch (e) {
                    console.warn("Error al actualizar fecha de compra del cliente:", e);
                }
            }
            
            if (!existenTransacciones) {
                try {
                    registrarIngresoDesdeFactura(factura);
                } catch (e) {
                    console.warn("Error al registrar ingreso desde factura:", e);
                }
            }
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalVerFactura'));
        modal.hide();
        
        cargarFacturas();

        alert(`Factura ${factura.numero} cambiada de ${estadoAnterior} a ${factura.estado}`);
    } catch (error) {
        console.error("Error al cambiar estado de factura:", error);
        alert("Error al cambiar el estado de la factura");
    }
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    let notificacion = document.getElementById('notificacion-sistema');
    if (!notificacion) {
        notificacion = document.createElement('div');
        notificacion.id = 'notificacion-sistema';
        notificacion.className = 'position-fixed top-0 end-0 p-3';
        notificacion.style.zIndex = '5000';
        document.body.appendChild(notificacion);
    }
    
    const toastId = 'toast-' + Date.now();
    const toastHTML = `
    <div id="${toastId}" class="toast align-items-center text-white bg-${tipo} border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
            <div class="toast-body">
                ${mensaje}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
        </div>
    </div>
    `;
    
    notificacion.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
    toast.show();
    
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}

function editarFactura(id) {
    const transaction = db.transaction([FACTURAS_STORE], 'readonly');
    const facturaStore = transaction.objectStore(FACTURAS_STORE);
    const request = facturaStore.get(id);
    
    request.onsuccess = function(event) {
        const factura = event.target.result;
        if (factura) {
            if (factura.estado === 'pagada') {
                mostrarNotificacion(
                    'No se puede editar una factura pagada. Las facturas pagadas están bloqueadas para mantener la integridad de los registros financieros.', 
                    'warning'
                );
                return;
            }

            document.getElementById('modalFacturaLabel').textContent = 'Editar Factura';

            document.getElementById('facturaId').value = factura.id;
            document.getElementById('numeroFactura').value = factura.numero;
            document.getElementById('fechaFactura').value = DateUtils.formatForInput(new Date(factura.fecha));
            document.getElementById('notasFactura').value = factura.notas || '';
            
            const selectEstado = document.getElementById('estadoFactura');
            const estadoOriginal = selectEstado.value;
            
            selectEstado.value = factura.estado;

            if (factura.estado === 'pendiente') {
                for (let i = 0; i < selectEstado.options.length; i++) {
                    if (selectEstado.options[i].value === 'pagada') {
                        selectEstado.options[i].disabled = true;
                        break;
                    }
                }
            }

            cargarClientesParaSelect(factura.clienteId);

            const tablaDetalles = document.querySelector('#tablaDetallesFactura tbody');
            const filaAgregar = document.getElementById('filaAgregarDetalle');
            
            while (tablaDetalles.firstChild) {
                if (tablaDetalles.firstChild === filaAgregar) {
                    break;
                }
                tablaDetalles.removeChild(tablaDetalles.firstChild);
            }

            factura.detalles.forEach(detalle => {
                agregarFilaDetalleExistente(detalle);
            });
            
            actualizarTotalFactura();

            const modal = new bootstrap.Modal(document.getElementById('modalFactura'));
            modal.show();
            
            document.getElementById('modalFactura').addEventListener('hidden.bs.modal', function onModalHidden() {
                for (let i = 0; i < selectEstado.options.length; i++) {
                    selectEstado.options[i].disabled = false;
                }
                document.getElementById('modalFactura').removeEventListener('hidden.bs.modal', onModalHidden);
            }, { once: true });
        } else {
            mostrarNotificacion('No se encontró la factura solicitada', 'danger');
        }
    };
    
    request.onerror = function(event) {
        console.error('Error al obtener la factura:', event.target.error);
        mostrarNotificacion('Error al cargar la factura', 'danger');
    };
}

function validarGuardadoFactura() {
    const facturaId = document.getElementById('facturaId').value;
    const estadoFactura = document.getElementById('estadoFactura').value;
    
    if (facturaId && estadoFactura === 'pagada') {
        const transaction = db.transaction([FACTURAS_STORE], 'readonly');
        const store = transaction.objectStore(FACTURAS_STORE);
        const request = store.get(parseInt(facturaId));
        
        request.onsuccess = function(event) {
            const facturaOriginal = event.target.result;
            
            if (facturaOriginal && facturaOriginal.estado !== 'pagada' && estadoFactura === 'pagada') {
                mostrarNotificacion(
                    'Para marcar una factura como pagada, utilice el botón "Marcar como Pagada" en la vista de detalles', 
                    'warning'
                );
                
                document.getElementById('estadoFactura').value = facturaOriginal.estado;
                return false;
            }
            
            return true;
        };
        
        return false;
    }
    
    return true;
}

function agregarFilaDetalleExistente(detalle) {
    const tablaDetalles = document.querySelector('#tablaDetallesFactura tbody');
    const filaAgregar = document.getElementById('filaAgregarDetalle');
    
    const nuevaFila = document.createElement('tr');
    
    const celdaProducto = document.createElement('td');
    const selectProducto = document.createElement('select');
    selectProducto.className = 'form-select producto-select';
    selectProducto.innerHTML = '<option value="">Seleccione producto</option>';
    
    const transaction = db.transaction([PRODUCTOS_STORE], 'readonly');
    const store = transaction.objectStore(PRODUCTOS_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const productos = event.target.result;
        
        productos.forEach(producto => {
            const option = document.createElement('option');
            option.value = producto.id;
            option.textContent = producto.nombre;
            option.dataset.precio = producto.precio || '0.00';
            selectProducto.appendChild(option);
        });
        
        selectProducto.value = detalle.productoId;
        
        selectProducto.addEventListener('change', function() {
            actualizarSubtotalDetalle(nuevaFila);
        });
    };
    
    celdaProducto.appendChild(selectProducto);
    nuevaFila.appendChild(celdaProducto);

    const celdaCantidad = document.createElement('td');
    const inputCantidad = document.createElement('input');
    inputCantidad.type = 'number';
    inputCantidad.className = 'form-control cantidad-input';
    inputCantidad.min = '1';
    inputCantidad.value = detalle.cantidad;
    inputCantidad.addEventListener('change', function() {
        actualizarSubtotalDetalle(nuevaFila);
    });
    celdaCantidad.appendChild(inputCantidad);
    nuevaFila.appendChild(celdaCantidad);

    const celdaPrecio = document.createElement('td');
    const inputPrecio = document.createElement('input');
    inputPrecio.type = 'number';
    inputPrecio.className = 'form-control precio-input';
    inputPrecio.min = '0.01';
    inputPrecio.step = '0.01';
    inputPrecio.value = detalle.precio;
    inputPrecio.readOnly = true;
    inputPrecio.addEventListener('change', function() {
        actualizarSubtotalDetalle(nuevaFila);
    });
    celdaPrecio.appendChild(inputPrecio);
    nuevaFila.appendChild(celdaPrecio);
    
    const celdaSubtotal = document.createElement('td');
    celdaSubtotal.className = 'subtotal-celda';
    celdaSubtotal.textContent = formatearMoneda(detalle.subtotal);
    nuevaFila.appendChild(celdaSubtotal);

    const celdaAccion = document.createElement('td');
    const btnEliminar = document.createElement('button');
    btnEliminar.className = 'btn btn-danger btn-sm';
    btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    btnEliminar.addEventListener('click', function() {
        tablaDetalles.removeChild(nuevaFila);
        actualizarTotalFactura();
    });
    celdaAccion.appendChild(btnEliminar);
    nuevaFila.appendChild(celdaAccion);

    tablaDetalles.insertBefore(nuevaFila, filaAgregar);
}

function eliminarFactura(id) {
    const transaction = db.transaction([FACTURAS_STORE, TRANSACCIONES_STORE], 'readonly');
    const facturaStore = transaction.objectStore(FACTURAS_STORE);
    const transaccionStore = transaction.objectStore(TRANSACCIONES_STORE);
    
    const request = facturaStore.get(id);
    
    request.onsuccess = function(event) {
        const factura = event.target.result;
        
        if (!factura) {
            mostrarNotificacion('No se encontró la factura solicitada', 'danger');
            return;
        }

        if (factura.estado === 'pagada') {
            if (transaccionStore.indexNames.contains('facturaId')) {
                const indexRequest = transaccionStore.index('facturaId').getAll(factura.id);
                
                indexRequest.onsuccess = function() {
                    const transacciones = indexRequest.result;
                    
                    if (transacciones && transacciones.length > 0) {
                        mostrarNotificacion(
                            'Esta factura pagada tiene transacciones financieras asociadas. No se puede eliminar para mantener la integridad de los registros contables.', 
                            'warning'
                        );
                    } else {
                        mostrarNotificacion(
                            'No se puede eliminar una factura pagada. Las facturas pagadas están bloqueadas para mantener la integridad de los registros financieros.', 
                            'warning'
                        );
                    }
                };
            } else {
                const getAllRequest = transaccionStore.getAll();
                getAllRequest.onsuccess = function() {
                    const todasTransacciones = getAllRequest.result;
                    const transaccionesFiltradas = todasTransacciones.filter(
                        t => t.facturaId === factura.id || 
                             (t.notas && t.notas.includes(`Factura ${factura.numero}`))
                    );
                    
                    if (transaccionesFiltradas && transaccionesFiltradas.length > 0) {
                        mostrarNotificacion(
                            'Esta factura pagada tiene transacciones financieras asociadas. No se puede eliminar para mantener la integridad de los registros contables.', 
                            'warning'
                        );
                    } else {
                        mostrarNotificacion(
                            'No se puede eliminar una factura pagada. Las facturas pagadas están bloqueadas para mantener la integridad de los registros financieros.', 
                            'warning'
                        );
                    }
                };
            }
            
            return;
        }
        
        let mensaje = `¿Estás seguro de que deseas eliminar la factura ${factura.numero}?`;
        
        if (factura.estado === 'pendiente') {
            mensaje += ' Esta factura está pendiente de pago.';
        } else if (factura.estado === 'cancelada') {
            mensaje += ' Esta factura está cancelada.';
        }
        
        mensaje += ' Esta acción no se puede deshacer.';
        
        if (confirm(mensaje)) {
            const deleteTransaction = db.transaction([FACTURAS_STORE], 'readwrite');
            const deleteStore = deleteTransaction.objectStore(FACTURAS_STORE);
            const deleteRequest = deleteStore.delete(id);
            
            deleteRequest.onsuccess = function() {
                mostrarNotificacion(`Factura ${factura.numero} eliminada correctamente`, 'success');
                cargarFacturas();
            };
            
            deleteRequest.onerror = function(event) {
                console.error('Error al eliminar factura:', event.target.error);
                mostrarNotificacion('Error al eliminar la factura', 'danger');
            };
        }
    };
    
    request.onerror = function(event) {
        console.error('Error al obtener la factura:', event.target.error);
        mostrarNotificacion('Error al verificar la factura', 'danger');
    };
}

function imprimirFactura() {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const facturaOriginal = document.querySelector('.factura-documento');
    if (!facturaOriginal) {
        console.error('No se encontró el elemento de factura');
        document.body.removeChild(iframe);
        return;
    }
    
    const numeroFactura = document.getElementById('verNumeroFactura2').textContent;
    const fechaFactura = document.getElementById('verFechaFactura').textContent;
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    iframeDoc.open();
    iframeDoc.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Factura ${numeroFactura}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #000;
                    background-color: #fff;
                }
                
                .factura-impresion {
                    max-width: 800px;
                    margin: 0 auto;
                }
                
                h1, h2, h3 {
                    margin-top: 0;
                }
                
                .text-primary {
                    color: #0275d8;
                }
                
                .text-end {
                    text-align: right;
                }
                
                .mb-1 {
                    margin-bottom: 5px;
                }
                
                .mb-3 {
                    margin-bottom: 15px;
                }
                
                .mb-4 {
                    margin-bottom: 20px;
                }
                
                .row {
                    display: flex;
                    flex-wrap: wrap;
                    margin-right: -15px;
                    margin-left: -15px;
                    clear: both;
                }
                
                .col-6 {
                    width: 50%;
                    float: left;
                    padding: 0 15px;
                    box-sizing: border-box;
                }
                
                .col-12 {
                    width: 100%;
                    float: left;
                    padding: 0 15px;
                    box-sizing: border-box;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                
                th, td {
                    padding: 10px;
                    border: 1px solid #ddd;
                    text-align: left;
                }
                
                th {
                    background-color: #f8f9fa;
                    font-weight: bold;
                }
                
                .table-striped tbody tr:nth-of-type(odd) {
                    background-color: rgba(0, 0, 0, 0.05);
                }
                
                .table-primary th {
                    background-color: #cfe2ff;
                    color: #000;
                }
                
                .table-light {
                    background-color: #f8f9fa;
                }
                
                .bg-light {
                    background-color: #f8f9fa;
                    padding: 15px;
                    border: 1px solid #ddd;
                    margin-bottom: 20px;
                }
                
                .text-center {
                    text-align: center;
                }
                
                .text-end {
                    text-align: right;
                }
                
                .border-top {
                    border-top: 1px solid #ddd;
                    padding-top: 15px;
                }
                
                .badge {
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-weight: bold;
                    display: inline-block;
                }
                
                .bg-success {
                    background-color: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }
                
                .bg-warning {
                    background-color: #fff3cd;
                    color: #856404;
                    border: 1px solid #ffeeba;
                }
                
                .bg-danger {
                    background-color: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }
                
                .small {
                    font-size: 85%;
                }
                
                .card {
                    border: 1px solid #ddd;
                    margin-bottom: 20px;
                }
                
                .card-header {
                    padding: 10px 15px;
                    background-color: #f8f9fa;
                    border-bottom: 1px solid #ddd;
                    font-weight: bold;
                }
                
                .card-body {
                    padding: 15px;
                }
                
                .text-muted {
                    color: #6c757d;
                }
                
                /* Asegurar que todo quepa correctamente en la página */
                @page {
                    size: A4;
                    margin: 1cm;
                }
            </style>
        </head>
        <body>
            <div class="factura-impresion">
                ${facturaOriginal.innerHTML}
            </div>
        </body>
        </html>
    `);
    iframeDoc.close();
    
    iframe.onload = function() {
        setTimeout(function() {
            iframe.contentWindow.print();

            setTimeout(function() {
                document.body.removeChild(iframe);
            }, 100);
        }, 500);
    };
}

window.addEventListener('load', function() {
    if (!db) {
        const dbRequest = indexedDB.open('erpDB', 3);
        dbRequest.onsuccess = function(event) {
            db = event.target.result;
            inicializarFinanzas();
        };
    }
});

let finanzasInicializado = false;

function inicializarFinanzas() {
    if (finanzasInicializado) {
        cargarEstadisticasFinancieras();
        cargarTransacciones();
        actualizarReportes();
        return;
    }
    
    finanzasInicializado = true;
    
    cargarEstadisticasFinancieras();
    cargarTransacciones();
    cargarFacturas();
    configurarEventos();
    configurarFiltrosReportes();
    inicializarGraficos();
    
    const transaction = db.transaction(['facturas'], 'readonly');
    const store = transaction.objectStore('facturas');
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const facturas = event.target.result;
        const facturasPendientesInventario = facturas.filter(
            f => f.estado === 'pendiente' && f.origenInventario === true
        );
        
        if (facturasPendientesInventario.length > 0) {
            setTimeout(() => {
                alert(`Hay ${facturasPendientesInventario.length} facturas pendientes generadas desde Inventario`);
                
                const facturasTab = document.getElementById('facturas-tab');
                if (facturasTab) {
                    facturasTab.classList.add('position-relative');
                    const badge = document.createElement('span');
                    badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger';
                    badge.textContent = facturasPendientesInventario.length;
                    facturasTab.appendChild(badge);
                }
            }, 1000);
        }
    };
}
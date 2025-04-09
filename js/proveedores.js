let db;
let proveedorSeleccionadoId = null;
let pedidoActualId = null;
const PROVEEDORES_STORE = 'proveedores';
const PEDIDOS_STORE = 'pedidos';
const PRODUCTOS_STORE = 'productos';
const TRANSACCIONES_STORE = 'transacciones';
const HISTORIAL_ITEMS_POR_PAGINA = 10;

const CATEGORIAS_PRODUCTOS = [
    'Materia Prima', 
    'Productos Terminados', 
    'Artículos de Oficina', 
    'Equipamiento', 
    'Herramientas', 
    'Material de Empaque',
    'Materiales de Limpieza',
    'Servicios',
    'Otros'
];
const request = indexedDB.open('erpDB', 5);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    const oldVersion = event.oldVersion;
    
    if (!db.objectStoreNames.contains(PRODUCTOS_STORE)) {
        const productosStore = db.createObjectStore(PRODUCTOS_STORE, { keyPath: 'id', autoIncrement: true });
        productosStore.createIndex('nombre', 'nombre', { unique: false });
    }
    
    if (!db.objectStoreNames.contains('clientes')) {
        const clientesStore = db.createObjectStore('clientes', { keyPath: 'id', autoIncrement: true });
        clientesStore.createIndex('nombre', 'nombre', { unique: false });
        clientesStore.createIndex('email', 'email', { unique: false });
    }
    
    if (!db.objectStoreNames.contains(TRANSACCIONES_STORE)) {
        const transaccionesStore = db.createObjectStore(TRANSACCIONES_STORE, { keyPath: 'id', autoIncrement: true });
        transaccionesStore.createIndex('fecha', 'fecha', { unique: false });
        transaccionesStore.createIndex('tipo', 'tipo', { unique: false });
        transaccionesStore.createIndex('categoria', 'categoria', { unique: false });
    }
    
    if (!db.objectStoreNames.contains(PROVEEDORES_STORE)) {
        const proveedoresStore = db.createObjectStore(PROVEEDORES_STORE, { keyPath: 'id', autoIncrement: true });
        proveedoresStore.createIndex('nombre', 'nombre', { unique: false });
        proveedoresStore.createIndex('categoria', 'categoria', { unique: false });
        proveedoresStore.createIndex('email', 'email', { unique: false });
    }
    
    if (!db.objectStoreNames.contains(PEDIDOS_STORE)) {
        const pedidosStore = db.createObjectStore(PEDIDOS_STORE, { keyPath: 'id', autoIncrement: true });
        pedidosStore.createIndex('numero', 'numero', { unique: true });
        pedidosStore.createIndex('proveedor', 'proveedorId', { unique: false });
        pedidosStore.createIndex('fecha', 'fecha', { unique: false });
        pedidosStore.createIndex('estado', 'estado', { unique: false });
    }
};

request.onsuccess = function(event) {
    db = event.target.result;
    cargarProveedores();
};

request.onerror = function(event) {
    console.error("Error al abrir la base de datos:", event.target.error);
};

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('btnNuevoProveedor').addEventListener('click', mostrarModalNuevoProveedor);
    document.getElementById('btnGuardarProveedor').addEventListener('click', guardarProveedor);
    document.getElementById('btnBuscar').addEventListener('click', buscarProveedores);
    document.getElementById('buscarProveedor').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            buscarProveedores();
        }
    });

    document.getElementById('pedidos-tab').addEventListener('click', function() {
        cargarPedidos();
    });

    document.getElementById('btnBuscarPedido').addEventListener('click', buscarPedidos);
    document.getElementById('buscarPedido').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            buscarPedidos();
        }
    });

    document.getElementById('btnNuevoPedidoGeneral').addEventListener('click', mostrarModalSeleccionarProveedor);
    document.getElementById('btnCambiarEstadoPedido').addEventListener('click', mostrarModalCambiarEstado);
    document.getElementById('btnGuardarCambioEstado').addEventListener('click', guardarCambioEstadoPedido);
    document.getElementById('btnImprimirPedido').addEventListener('click', imprimirPedido);

    document.getElementById('btnConfirmarEliminar').addEventListener('click', eliminarProveedor);
    
    document.getElementById('btnCrearPedido').addEventListener('click', function() {
        const nombreProveedor = document.getElementById('detalle-nombre').textContent;
        const modalDetalles = bootstrap.Modal.getInstance(document.getElementById('modalDetalleProveedor'));
        modalDetalles.hide();
        
        setTimeout(function() {
            mostrarModalNuevoPedido(proveedorSeleccionadoId, nombreProveedor);
        }, 500);
    });
    
    document.getElementById('btnAgregarDetallePedido').addEventListener('click', agregarFilaDetallePedido);
    document.getElementById('btnGuardarPedido').addEventListener('click', guardarPedido);
});

function mostrarModalSeleccionarProveedor() {
    const transaction = db.transaction([PROVEEDORES_STORE], 'readonly');
    const store = transaction.objectStore(PROVEEDORES_STORE);
    const request = store.count();
    
    request.onsuccess = function(event) {
        const count = event.target.result;
        
        if (count === 0) {
            alert('No hay proveedores registrados. Por favor, registre al menos un proveedor antes de crear un pedido.');
            return;
        }

        let modalHTML = `
        <div class="modal fade" id="modalSeleccionarProveedor" tabindex="-1" aria-labelledby="modalSeleccionarProveedorLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title" id="modalSeleccionarProveedorLabel">Seleccionar Proveedor</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>Seleccione un proveedor para crear el pedido:</p>
                        <select class="form-select" id="selectProveedorParaPedido">
                            <option value="">Seleccione un proveedor</option>
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnConfirmarProveedor">Continuar</button>
                    </div>
                </div>
            </div>
        </div>
        `;

        if (!document.getElementById('modalSeleccionarProveedor')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            document.getElementById('btnConfirmarProveedor').addEventListener('click', function() {
                const proveedorId = document.getElementById('selectProveedorParaPedido').value;
                const proveedorNombre = document.getElementById('selectProveedorParaPedido').options[document.getElementById('selectProveedorParaPedido').selectedIndex].text;
                
                if (!proveedorId) {
                    alert('Por favor, seleccione un proveedor');
                    return;
                }
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalSeleccionarProveedor'));
                modal.hide();
                
                setTimeout(() => {
                    mostrarModalNuevoPedido(parseInt(proveedorId), proveedorNombre);
                }, 500);
            });
        }
        
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = function(event) {
            const proveedores = event.target.result;
            const select = document.getElementById('selectProveedorParaPedido');

            select.innerHTML = '<option value="">Seleccione un proveedor</option>';
            proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre));
            
            proveedores.forEach(proveedor => {
                const option = document.createElement('option');
                option.value = proveedor.id;
                option.textContent = proveedor.nombre;
                select.appendChild(option);
            });
            
            const modal = new bootstrap.Modal(document.getElementById('modalSeleccionarProveedor'));
            modal.show();
        };
    };
}

function imprimirPedido() {
    const modalBody = document.querySelector('#modalVerPedido .modal-body').cloneNode(true);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const numeroPedido = document.getElementById('verPedidoNumero').textContent;
    const fecha = document.getElementById('verPedidoFecha').textContent;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pedido ${numeroPedido}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                }
                h1, h2 {
                    color: #333;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                }
                th, td {
                    padding: 8px;
                    border: 1px solid #ddd;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                }
                .text-end {
                    text-align: right;
                }
                .text-center {
                    text-align: center;
                }
                .badge {
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    color: white;
                    background-color: #555;
                }
                .bg-warning {
                    background-color: #ffc107 !important;
                    color: #212529 !important;
                }
                .bg-info {
                    background-color: #0dcaf0 !important;
                }
                .bg-primary {
                    background-color: #0d6efd !important;
                }
                .bg-success {
                    background-color: #198754 !important;
                }
                .bg-danger {
                    background-color: #dc3545 !important;
                }
                .header {
                    border-bottom: 2px solid #333;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 10px;
                    border-top: 1px solid #ddd;
                    font-size: 0.8em;
                    text-align: center;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Pedido ${numeroPedido}</h1>
                <p>Fecha: ${fecha}</p>
            </div>
            ${modalBody.innerHTML}
            <div class="footer">
                <p>Documento generado el ${new Date().toLocaleString()}</p>
                <p>© ${new Date().getFullYear()} ERP Sistema</p>
            </div>
        </body>
        </html>
    `);
    iframeDoc.close();
    
    iframe.onload = function() {
        setTimeout(function() {
            iframe.contentWindow.print();
            document.body.removeChild(iframe);
        }, 500);
    };
}

function formatearMoneda(valor) {
    return '$' + parseFloat(valor).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function cargarProveedores(filtro = '', pagina = 1) {
    const ITEMS_POR_PAGINA = 10;
    const transaction = db.transaction([PROVEEDORES_STORE], 'readonly');
    const store = transaction.objectStore(PROVEEDORES_STORE);
    const request = store.getAll();

    request.onsuccess = function(event) {
        let proveedores = event.target.result;
        
        if (filtro) {
            filtro = filtro.toLowerCase();
            proveedores = proveedores.filter(proveedor => 
                proveedor.nombre.toLowerCase().includes(filtro) || 
                (proveedor.contacto && proveedor.contacto.toLowerCase().includes(filtro)) ||
                (proveedor.email && proveedor.email.toLowerCase().includes(filtro)) ||
                (proveedor.telefono && proveedor.telefono.includes(filtro)) ||
                (proveedor.categoria && proveedor.categoria.toLowerCase().includes(filtro))
            );
        }
        
        proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        const totalProveedores = proveedores.length;
        const totalPaginas = Math.ceil(totalProveedores / ITEMS_POR_PAGINA);
        const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
        const fin = inicio + ITEMS_POR_PAGINA;
        const proveedoresPaginados = proveedores.slice(inicio, fin);
        
        mostrarProveedores(proveedoresPaginados);
        mostrarPaginacionProveedores(pagina, totalPaginas, filtro);
        
        const infoResultados = document.getElementById('infoResultadosProveedores');
        if (infoResultados) {
            infoResultados.textContent = `Mostrando ${Math.min(fin, totalProveedores)} de un total de ${totalProveedores} proveedores`;
        }
    };

    request.onerror = function(event) {
        console.error("Error al cargar proveedores:", event.target.error);
    };
}

function mostrarModalCambiarEstado() {
    if (!pedidoActualId) {
        console.error("No hay un pedido seleccionado");
        return;
    }
    
    const transaction = db.transaction([PEDIDOS_STORE], 'readonly');
    const store = transaction.objectStore(PEDIDOS_STORE);
    const request = store.get(pedidoActualId);
    
    request.onsuccess = function(event) {
        const pedido = event.target.result;
        if (!pedido) {
            console.error("Pedido no encontrado:", pedidoActualId);
            return;
        }
        
        document.getElementById('cambiarEstadoPedidoNumero').textContent = pedido.numero || '';
        
        const estadoActualElement = document.getElementById('cambiarEstadoPedidoEstadoActual');
        estadoActualElement.textContent = pedido.estado || '';
        
        estadoActualElement.className = 'badge';
        switch (pedido.estado) {
            case 'Pendiente':
                estadoActualElement.classList.add('bg-warning', 'text-dark');
                break;
            case 'Enviado':
                estadoActualElement.classList.add('bg-info');
                break;
            case 'Recibido Parcial':
                estadoActualElement.classList.add('bg-primary');
                break;
            case 'Recibido':
                estadoActualElement.classList.add('bg-success');
                break;
            case 'Cancelado':
                estadoActualElement.classList.add('bg-danger');
                break;
            default:
                estadoActualElement.classList.add('bg-secondary');
        }
        
        const selectEstado = document.getElementById('nuevoEstadoPedido');
        selectEstado.value = pedido.estado || 'Pendiente';
        
        document.getElementById('observacionCambioEstado').value = '';
        
        const modalDetalles = bootstrap.Modal.getInstance(document.getElementById('modalVerPedido'));
        modalDetalles.hide();
        
        setTimeout(() => {
            const modalCambioEstado = new bootstrap.Modal(document.getElementById('modalCambiarEstadoPedido'));
            modalCambioEstado.show();
        }, 500);
    };
    
    request.onerror = function(event) {
        console.error("Error al cargar el pedido:", event.target.error);
    };
}

function guardarCambioEstadoPedido() {
    if (!pedidoActualId) {
        console.error("No hay un pedido seleccionado");
        return;
    }
    
    const nuevoEstado = document.getElementById('nuevoEstadoPedido').value;
    const observacion = document.getElementById('observacionCambioEstado').value;
    
    const transaction = db.transaction([PEDIDOS_STORE, PRODUCTOS_STORE], 'readwrite');
    const pedidosStore = transaction.objectStore(PEDIDOS_STORE);
    const productosStore = transaction.objectStore(PRODUCTOS_STORE);
    
    const request = pedidosStore.get(pedidoActualId);
    
    request.onsuccess = function(event) {
        const pedido = event.target.result;
        if (!pedido) {
            console.error("Pedido no encontrado:", pedidoActualId);
            return;
        }
        
        const estadoAnterior = pedido.estado;
        pedido.estado = nuevoEstado;

        if (!pedido.historialEstados) {
            pedido.historialEstados = [];
        }
        
        pedido.historialEstados.push({
            fechaCambio: new Date(),
            estadoAnterior: estadoAnterior,
            estadoNuevo: nuevoEstado,
            observacion: observacion
        });

        const updateRequest = pedidosStore.put(pedido);
        
        updateRequest.onsuccess = function() {
            if (nuevoEstado === 'Recibido' && estadoAnterior !== 'Recibido') {
                actualizarInventarioDesdeRecepcion(pedido, productosStore);
            }

            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCambiarEstadoPedido'));
            modal.hide();

            cargarPedidos();

            alert(`El estado del pedido ${pedido.numero} ha sido actualizado a "${nuevoEstado}"`);
        };
        
        updateRequest.onerror = function(event) {
            console.error("Error al actualizar el pedido:", event.target.error);
        };
    };
    
    request.onerror = function(event) {
        console.error("Error al cargar el pedido:", event.target.error);
    };
}

function actualizarInventarioDesdeRecepcion(pedido, productosStore) {
    if (!pedido.detalles || !Array.isArray(pedido.detalles)) {
        console.warn("El pedido no tiene detalles para actualizar el inventario");
        return;
    }
    
    pedido.detalles.forEach(detalle => {
        const index = productosStore.index('nombre');
        const request = index.getKey(detalle.productoNombre);
        
        request.onsuccess = function(event) {
            const productoId = event.target.result;
            
            if (productoId) {
                const getRequest = productosStore.get(productoId);
                
                getRequest.onsuccess = function(event) {
                    const producto = event.target.result;
                    
                    producto.cantidad = (producto.cantidad || 0) + detalle.cantidad;

                    if (!producto.historial) {
                        producto.historial = [];
                    }
                    
                    producto.historial.push({
                        tipo: 'Entrada',
                        cantidad: detalle.cantidad,
                        precio: detalle.precio,
                        descripcion: `Recepción del pedido ${pedido.numero}`,
                        proveedorId: pedido.proveedorId,
                        proveedorNombre: pedido.proveedorNombre,
                        fecha: new Date()
                    });
                    
                    const LIMITE_HISTORIAL = 500;
                    if (producto.historial.length > LIMITE_HISTORIAL) {
                        producto.historial.shift();
                    }
                    
                    productosStore.put(producto);
                };
            } else {
                const nuevoProducto = {
                    nombre: detalle.productoNombre,
                    cantidad: detalle.cantidad,
                    precio: detalle.precio,
                    proveedorId: pedido.proveedorId,
                    proveedorNombre: pedido.proveedorNombre,
                    historial: [{
                        tipo: 'Entrada',
                        cantidad: detalle.cantidad,
                        precio: detalle.precio,
                        descripcion: `Recepción del pedido ${pedido.numero}`,
                        proveedorId: pedido.proveedorId,
                        proveedorNombre: pedido.proveedorNombre,
                        fecha: new Date()
                    }]
                };
                
                productosStore.add(nuevoProducto);
            }
        };
    });
}

function confirmarEliminarPedido(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este pedido? Esta acción no se puede deshacer.')) {
        const transaction = db.transaction([PEDIDOS_STORE], 'readwrite');
        const store = transaction.objectStore(PEDIDOS_STORE);
        const request = store.delete(id);
        
        request.onsuccess = function() {
            cargarPedidos();
            alert('Pedido eliminado correctamente');
        };
        
        request.onerror = function(event) {
            console.error('Error al eliminar el pedido:', event.target.error);
            alert('Error al eliminar el pedido. Por favor, intenta de nuevo.');
        };
    }
}

function mostrarProveedores(proveedores) {
    const tablaBody = document.querySelector('#tablaProveedores tbody');
    tablaBody.innerHTML = '';
    
    if (proveedores.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 8;
        celda.textContent = 'No hay proveedores registrados';
        celda.className = 'text-center';
        fila.appendChild(celda);
        tablaBody.appendChild(fila);
        return;
    }
    
    proveedores.forEach(proveedor => {
        const fila = document.createElement('tr');
        
        const celdaId = document.createElement('td');
        celdaId.textContent = proveedor.id;
        celdaId.className = 'text-center';
        fila.appendChild(celdaId);

        const celdaNombre = document.createElement('td');
        celdaNombre.textContent = proveedor.nombre;
        fila.appendChild(celdaNombre);
        
        const celdaContacto = document.createElement('td');
        celdaContacto.textContent = proveedor.contacto || '-';
        fila.appendChild(celdaContacto);

        const celdaEmail = document.createElement('td');
        celdaEmail.textContent = proveedor.email || '-';
        fila.appendChild(celdaEmail);

        const celdaTelefono = document.createElement('td');
        celdaTelefono.textContent = proveedor.telefono || '-';
        fila.appendChild(celdaTelefono);
        
        const celdaCategoria = document.createElement('td');
        celdaCategoria.textContent = proveedor.categoria || '-';
        fila.appendChild(celdaCategoria);

        const celdaUltimaCompra = document.createElement('td');
        if (proveedor.ultimaCompra) {
            celdaUltimaCompra.textContent = DateUtils.formatDisplay(new Date(proveedor.ultimaCompra));
        } else {
            celdaUltimaCompra.textContent = 'Sin compras';
        }
        celdaUltimaCompra.className = 'text-center';
        fila.appendChild(celdaUltimaCompra);

        const celdaAcciones = document.createElement('td');
        celdaAcciones.className = 'd-flex justify-content-center gap-2';

        const btnVer = document.createElement('button');
        btnVer.className = 'btn btn-info btn-sm';
        btnVer.innerHTML = '<i class="fas fa-eye"></i>';
        btnVer.title = 'Ver detalles';
        btnVer.addEventListener('click', () => verDetallesProveedor(proveedor.id));
        celdaAcciones.appendChild(btnVer);

        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn btn-warning btn-sm';
        btnEditar.innerHTML = '<i class="fas fa-edit"></i>';
        btnEditar.title = 'Editar proveedor';
        btnEditar.addEventListener('click', () => editarProveedor(proveedor.id));
        celdaAcciones.appendChild(btnEditar);
        
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn btn-danger btn-sm';
        btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
        btnEliminar.title = 'Eliminar proveedor';
        btnEliminar.addEventListener('click', () => mostrarConfirmacionEliminar(proveedor.id));
        celdaAcciones.appendChild(btnEliminar);
        
        fila.appendChild(celdaAcciones);
        
        tablaBody.appendChild(fila);
    });
}

function cargarPedidos(filtroTexto = '', filtroEstado = 'todos', pagina = 1) {
    const ITEMS_POR_PAGINA = 10;
    
    if (!db) {
        console.error("Base de datos no inicializada");
        return;
    }
    
    if (!db.objectStoreNames.contains(PEDIDOS_STORE)) {
        console.warn("Almacén de pedidos no encontrado");
        return;
    }
    
    const transaction = db.transaction([PEDIDOS_STORE], 'readonly');
    const store = transaction.objectStore(PEDIDOS_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        let pedidos = event.target.result || [];

        if (filtroTexto) {
            filtroTexto = filtroTexto.toLowerCase();
            pedidos = pedidos.filter(p => 
                (p.numero && p.numero.toLowerCase().includes(filtroTexto)) || 
                (p.proveedorNombre && p.proveedorNombre.toLowerCase().includes(filtroTexto))
            );
        }
        
        if (filtroEstado !== 'todos') {
            pedidos = pedidos.filter(p => p.estado === filtroEstado);
        }
        
        pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        const totalPedidos = pedidos.length;
        const totalPaginas = Math.ceil(totalPedidos / ITEMS_POR_PAGINA);
        const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
        const fin = inicio + ITEMS_POR_PAGINA;
        const pedidosPaginados = pedidos.slice(inicio, fin);
        
        mostrarPedidos(pedidosPaginados);
        mostrarPaginacionPedidos(pagina, totalPaginas, filtroTexto, filtroEstado);

        const infoResultados = document.getElementById('infoResultadosPedidos');
        if (infoResultados) {
            infoResultados.textContent = `Mostrando ${Math.min(fin, totalPedidos)} de un total de ${totalPedidos} pedidos`;
        }
    };
    
    request.onerror = function(event) {
        console.error("Error al cargar pedidos:", event.target.error);
    };
}

function mostrarPedidos(pedidos) {
    const tablaBody = document.querySelector('#tablaPedidos tbody');
    tablaBody.innerHTML = '';
    
    if (pedidos.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 8;
        celda.textContent = 'No hay pedidos registrados';
        celda.className = 'text-center';
        fila.appendChild(celda);
        tablaBody.appendChild(fila);
        return;
    }
    
    pedidos.forEach(pedido => {
        const fila = document.createElement('tr');

        const celdaNumero = document.createElement('td');
        celdaNumero.textContent = pedido.numero || '-';
        fila.appendChild(celdaNumero);
        
        const celdaFecha = document.createElement('td');
        celdaFecha.textContent = DateUtils.formatDisplay(new Date(pedido.fecha));
        fila.appendChild(celdaFecha);

        const celdaProveedor = document.createElement('td');
        celdaProveedor.textContent = pedido.proveedorNombre || '-';
        fila.appendChild(celdaProveedor);
        
        const celdaEstado = document.createElement('td');
        let badgeClass = '';
        switch (pedido.estado) {
            case 'Pendiente':
                badgeClass = 'bg-warning text-dark';
                break;
            case 'Enviado':
                badgeClass = 'bg-info';
                break;
            case 'Recibido Parcial':
                badgeClass = 'bg-primary';
                break;
            case 'Recibido':
                badgeClass = 'bg-success';
                break;
            case 'Cancelado':
                badgeClass = 'bg-danger';
                break;
            default:
                badgeClass = 'bg-secondary';
        }
        celdaEstado.innerHTML = `<span class="badge ${badgeClass}">${pedido.estado}</span>`;
        fila.appendChild(celdaEstado);

        const celdaTotal = document.createElement('td');
        celdaTotal.textContent = formatearMoneda(pedido.total || 0);
        celdaTotal.className = 'text-end';
        fila.appendChild(celdaTotal);

        const celdaFechaEntrega = document.createElement('td');
        if (pedido.fechaEstimadaEntrega) {
            celdaFechaEntrega.textContent = DateUtils.formatDisplay(new Date(pedido.fechaEstimadaEntrega));
        } else {
            celdaFechaEntrega.textContent = '-';
        }
        fila.appendChild(celdaFechaEntrega);

        const celdaFormaPago = document.createElement('td');
        celdaFormaPago.textContent = pedido.formaPago || '-';
        fila.appendChild(celdaFormaPago);

        const celdaAcciones = document.createElement('td');
        celdaAcciones.className = 'd-flex justify-content-center gap-2';

        const btnVer = document.createElement('button');
        btnVer.className = 'btn btn-info btn-sm';
        btnVer.innerHTML = '<i class="fas fa-eye"></i>';
        btnVer.title = 'Ver detalles';
        btnVer.addEventListener('click', () => verDetallesPedido(pedido.id));
        celdaAcciones.appendChild(btnVer);

        if (pedido.estado !== 'Recibido' && pedido.estado !== 'Cancelado') {
            const btnEditar = document.createElement('button');
            btnEditar.className = 'btn btn-warning btn-sm';
            btnEditar.innerHTML = '<i class="fas fa-edit"></i>';
            btnEditar.title = 'Editar pedido';
            btnEditar.addEventListener('click', () => editarPedido(pedido.id));
            celdaAcciones.appendChild(btnEditar);
        }

        if (pedido.estado !== 'Recibido') {
            const btnEliminar = document.createElement('button');
            btnEliminar.className = 'btn btn-danger btn-sm';
            btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
            btnEliminar.title = 'Eliminar pedido';
            btnEliminar.addEventListener('click', () => confirmarEliminarPedido(pedido.id));
            celdaAcciones.appendChild(btnEliminar);
        }
        
        fila.appendChild(celdaAcciones);
        tablaBody.appendChild(fila);
    });
}

function mostrarPaginacionPedidos(paginaActual, totalPaginas, filtroTexto, filtroEstado) {
    const paginacionDiv = document.getElementById('paginacionPedidos');
    if (!paginacionDiv) return;
    
    paginacionDiv.innerHTML = '';
    
    if (totalPaginas <= 1) {
        paginacionDiv.style.display = 'none';
        return;
    }
    
    paginacionDiv.style.display = 'block';
    
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navegación de pedidos');
    
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
            cargarPedidos(filtroTexto, filtroEstado, paginaActual - 1);
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
            cargarPedidos(filtroTexto, filtroEstado, i);
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
            cargarPedidos(filtroTexto, filtroEstado, paginaActual + 1);
        });
    }
    liNext.appendChild(aNext);
    ul.appendChild(liNext);
    
    nav.appendChild(ul);
    paginacionDiv.appendChild(nav);
}

function buscarPedidos() {
    const filtroTexto = document.getElementById('buscarPedido').value.trim();
    const filtroEstado = document.getElementById('filtroEstadoPedido').value;
    cargarPedidos(filtroTexto, filtroEstado, 1);
}

function verDetallesPedido(id) {
    if (!db) {
        console.error("Base de datos no inicializada");
        return;
    }
    
    const transaction = db.transaction([PEDIDOS_STORE, PROVEEDORES_STORE], 'readonly');
    const pedidosStore = transaction.objectStore(PEDIDOS_STORE);
    const proveedoresStore = transaction.objectStore(PROVEEDORES_STORE);
    
    const pedidoRequest = pedidosStore.get(id);
    
    pedidoRequest.onsuccess = function(event) {
        const pedido = event.target.result;
        if (!pedido) {
            console.error("Pedido no encontrado:", id);
            return;
        }
        
        pedidoActualId = pedido.id;
        document.getElementById('verNumeroPedido').textContent = pedido.numero || '';
        document.getElementById('verPedidoNumero').textContent = pedido.numero || '';
        document.getElementById('verPedidoFecha').textContent = DateUtils.formatDisplay(new Date(pedido.fecha));
        
        const estadoElement = document.getElementById('verPedidoEstado');
        estadoElement.textContent = pedido.estado || '';

        estadoElement.className = 'badge';
        switch (pedido.estado) {
            case 'Pendiente':
                estadoElement.classList.add('bg-warning', 'text-dark');
                break;
            case 'Enviado':
                estadoElement.classList.add('bg-info');
                break;
            case 'Recibido Parcial':
                estadoElement.classList.add('bg-primary');
                break;
            case 'Recibido':
                estadoElement.classList.add('bg-success');
                break;
            case 'Cancelado':
                estadoElement.classList.add('bg-danger');
                break;
            default:
                estadoElement.classList.add('bg-secondary');
        }
        
        document.getElementById('verPedidoFormaPago').textContent = pedido.formaPago || 'No especificado';
        
        if (pedido.fechaEstimadaEntrega) {
            document.getElementById('verPedidoFechaEntrega').textContent = DateUtils.formatDisplay(new Date(pedido.fechaEstimadaEntrega));
        } else {
            document.getElementById('verPedidoFechaEntrega').textContent = 'No especificada';
        }

        document.getElementById('verPedidoProveedorNombre').textContent = pedido.proveedorNombre || 'No disponible';
        
        if (pedido.proveedorId) {
            const proveedorRequest = proveedoresStore.get(pedido.proveedorId);
            
            proveedorRequest.onsuccess = function(event) {
                const proveedor = event.target.result;
                if (proveedor) {
                    document.getElementById('verPedidoProveedorContacto').textContent = proveedor.contacto || 'No disponible';
                    document.getElementById('verPedidoProveedorTelefono').textContent = proveedor.telefono || 'No disponible';
                    document.getElementById('verPedidoProveedorEmail').textContent = proveedor.email || 'No disponible';
                } else {
                    document.getElementById('verPedidoProveedorContacto').textContent = 'No disponible';
                    document.getElementById('verPedidoProveedorTelefono').textContent = 'No disponible';
                    document.getElementById('verPedidoProveedorEmail').textContent = 'No disponible';
                }
            };
        }
        
        const detallesBody = document.getElementById('verPedidoDetalles');
        detallesBody.innerHTML = '';
        
        if (pedido.detalles && Array.isArray(pedido.detalles) && pedido.detalles.length > 0) {
            pedido.detalles.forEach((detalle, index) => {
                const fila = document.createElement('tr');
                
                const celdaNum = document.createElement('td');
                celdaNum.textContent = (index + 1);
                fila.appendChild(celdaNum);
                
                const celdaProducto = document.createElement('td');
                celdaProducto.textContent = detalle.productoNombre || 'Sin nombre';
                fila.appendChild(celdaProducto);
                
                const celdaCantidad = document.createElement('td');
                celdaCantidad.textContent = detalle.cantidad || '0';
                celdaCantidad.className = 'text-center';
                fila.appendChild(celdaCantidad);
                
                const celdaPrecio = document.createElement('td');
                celdaPrecio.textContent = formatearMoneda(detalle.precio || 0);
                celdaPrecio.className = 'text-end';
                fila.appendChild(celdaPrecio);
                
                const celdaSubtotal = document.createElement('td');
                const subtotal = detalle.subtotal || (detalle.precio * detalle.cantidad) || 0;
                celdaSubtotal.textContent = formatearMoneda(subtotal);
                celdaSubtotal.className = 'text-end';
                fila.appendChild(celdaSubtotal);
                
                detallesBody.appendChild(fila);
            });
        } else {
            const fila = document.createElement('tr');
            const celda = document.createElement('td');
            celda.colSpan = 5;
            celda.textContent = 'No hay productos en este pedido';
            celda.className = 'text-center';
            fila.appendChild(celda);
            detallesBody.appendChild(fila);
        }
        
        document.getElementById('verPedidoTotal').textContent = formatearMoneda(pedido.total || 0);
        
        document.getElementById('verPedidoNotas').textContent = pedido.notas || 'Sin notas adicionales';

        const btnCambiarEstado = document.getElementById('btnCambiarEstadoPedido');
        if (pedido.estado === 'Cancelado' || pedido.estado === 'Recibido') {
            btnCambiarEstado.disabled = true;
            btnCambiarEstado.classList.add('disabled');
        } else {
            btnCambiarEstado.disabled = false;
            btnCambiarEstado.classList.remove('disabled');
        }
        
        const modal = new bootstrap.Modal(document.getElementById('modalVerPedido'));
        modal.show();
    };
    
    pedidoRequest.onerror = function(event) {
        console.error("Error al cargar el pedido:", event.target.error);
    };
}

function mostrarPaginacionProveedores(paginaActual, totalPaginas, filtro) {
    const paginacionDiv = document.getElementById('paginacionProveedores');
    if (!paginacionDiv) return;
    
    paginacionDiv.innerHTML = '';
    
    if (totalPaginas <= 1) {
        paginacionDiv.style.display = 'none';
        return;
    }
    
    paginacionDiv.style.display = 'block';
    
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navegación de proveedores');
    
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
            cargarProveedores(filtro, paginaActual - 1);
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
            cargarProveedores(filtro, i);
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
            cargarProveedores(filtro, paginaActual + 1);
        });
    }
    liNext.appendChild(aNext);
    ul.appendChild(liNext);
    
    nav.appendChild(ul);
    paginacionDiv.appendChild(nav);
}

function buscarProveedores() {
    const filtro = document.getElementById('buscarProveedor').value.trim();
    cargarProveedores(filtro, 1);
}

function mostrarModalNuevoProveedor() {
    document.getElementById('modalProveedorLabel').textContent = 'Nuevo Proveedor';
    document.getElementById('formProveedor').reset();
    document.getElementById('proveedorId').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
    modal.show();
}

function guardarProveedor() {
    const proveedorId = document.getElementById('proveedorId').value;
    const nombre = document.getElementById('nombreProveedor').value.trim();
    const contacto = document.getElementById('contactoProveedor').value.trim();
    const email = document.getElementById('emailProveedor').value.trim();
    const telefono = document.getElementById('telefonoProveedor').value.trim();
    const ruc = document.getElementById('rucProveedor').value.trim();
    const categoria = document.getElementById('categoriaProveedor').value;
    const direccion = document.getElementById('direccionProveedor').value.trim();
    const ciudad = document.getElementById('ciudadProveedor').value.trim();
    const estado = document.getElementById('estadoProveedor').value.trim();
    const pais = document.getElementById('paisProveedor').value.trim();
    const web = document.getElementById('webProveedor').value.trim();
    const condicionPago = document.getElementById('condicionPagoProveedor').value;
    const notas = document.getElementById('notasProveedor').value.trim();
    
    if (!nombre) {
        alert('El nombre del proveedor es obligatorio');
        return;
    }
    
    const proveedor = {
        nombre,
        contacto,
        email,
        telefono,
        ruc,
        categoria,
        direccion,
        ciudad,
        estado,
        pais,
        web,
        condicionPago,
        notas,
        fechaCreacion: new Date()
    };
    
    const transaction = db.transaction([PROVEEDORES_STORE], 'readwrite');
    const store = transaction.objectStore(PROVEEDORES_STORE);

    if (proveedorId) {
        proveedor.id = parseInt(proveedorId);
        store.put(proveedor);
    } else {
        store.add(proveedor);
    }
    
    transaction.oncomplete = function() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalProveedor'));
        modal.hide();
        cargarProveedores();
    };
    
    transaction.onerror = function(event) {
        console.error('Error al guardar proveedor:', event.target.error);
        alert('Error al guardar el proveedor. Por favor, intenta de nuevo.');
    };
}

function editarProveedor(id) {
    const transaction = db.transaction([PROVEEDORES_STORE], 'readonly');
    const store = transaction.objectStore(PROVEEDORES_STORE);
    const request = store.get(id);
    
    request.onsuccess = function(event) {
        const proveedor = event.target.result;
        if (proveedor) {
            document.getElementById('modalProveedorLabel').textContent = 'Editar Proveedor';
            document.getElementById('proveedorId').value = proveedor.id;
            document.getElementById('nombreProveedor').value = proveedor.nombre || '';
            document.getElementById('contactoProveedor').value = proveedor.contacto || '';
            document.getElementById('emailProveedor').value = proveedor.email || '';
            document.getElementById('telefonoProveedor').value = proveedor.telefono || '';
            document.getElementById('rucProveedor').value = proveedor.ruc || '';
            document.getElementById('categoriaProveedor').value = proveedor.categoria || '';
            document.getElementById('direccionProveedor').value = proveedor.direccion || '';
            document.getElementById('ciudadProveedor').value = proveedor.ciudad || '';
            document.getElementById('estadoProveedor').value = proveedor.estado || '';
            document.getElementById('paisProveedor').value = proveedor.pais || '';
            document.getElementById('webProveedor').value = proveedor.web || '';
            document.getElementById('condicionPagoProveedor').value = proveedor.condicionPago || '';
            document.getElementById('notasProveedor').value = proveedor.notas || '';
            
            const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
            modal.show();
        }
    };
    
    request.onerror = function(event) {
        console.error('Error al obtener proveedor para editar:', event.target.error);
    };
}

function verDetallesProveedor(id) {
    if (!db) {
        console.error("Base de datos no inicializada");
        return;
    }
    
    const transaction = db.transaction([PROVEEDORES_STORE], 'readonly');
    const proveedoresStore = transaction.objectStore(PROVEEDORES_STORE);
    
    const proveedorRequest = proveedoresStore.get(id);
    
    proveedorRequest.onsuccess = function(event) {
        const proveedor = event.target.result;
        if (proveedor) {
            document.getElementById('detalle-nombre').textContent = proveedor.nombre || '';
            document.getElementById('detalle-contacto').textContent = proveedor.contacto || 'No disponible';
            document.getElementById('detalle-email').textContent = proveedor.email || 'No disponible';
            document.getElementById('detalle-telefono').textContent = proveedor.telefono || 'No disponible';
            document.getElementById('detalle-ruc').textContent = proveedor.ruc || 'No disponible';
            document.getElementById('detalle-categoria').textContent = proveedor.categoria || 'No disponible';
            
            const webElement = document.getElementById('detalle-web');
            if (proveedor.web) {
                webElement.textContent = proveedor.web;
                webElement.href = proveedor.web.startsWith('http') ? proveedor.web : 'https://' + proveedor.web;
                webElement.classList.remove('text-muted');
            } else {
                webElement.textContent = 'No disponible';
                webElement.href = '#';
                webElement.classList.add('text-muted');
            }
            
            document.getElementById('detalle-condicionPago').textContent = proveedor.condicionPago || 'No disponible';
            document.getElementById('detalle-direccion').textContent = proveedor.direccion || 'No disponible';
            document.getElementById('detalle-ciudad').textContent = proveedor.ciudad || '';
            document.getElementById('detalle-estado').textContent = proveedor.estado || '';
            document.getElementById('detalle-pais').textContent = proveedor.pais || '';
            document.getElementById('detalle-notas').textContent = proveedor.notas || 'Sin notas';

            proveedorSeleccionadoId = proveedor.id;
            
            cargarHistorialPedidosProveedor(proveedor.id);

            const modal = new bootstrap.Modal(document.getElementById('modalDetalleProveedor'));
            modal.show();

            const infoTab = document.getElementById('info-tab');
            if (infoTab) {
                const tabTrigger = new bootstrap.Tab(infoTab);
                tabTrigger.show();
            }
        } else {
            console.error('Proveedor no encontrado:', id);
            alert('No se encontró el proveedor solicitado.');
        }
    };
    
    proveedorRequest.onerror = function(event) {
        console.error('Error al obtener detalles del proveedor:', event.target.error);
        alert('Error al cargar los detalles del proveedor. Por favor, intenta de nuevo.');
    };
}

function cargarHistorialPedidosProveedor(proveedorId, pagina = 1, filtros = {}) {
    if (!db) {
        console.error("Base de datos no inicializada");
        return;
    }
    
    if (!db.objectStoreNames.contains(PEDIDOS_STORE)) {
        console.warn("Almacén de pedidos no encontrado");
        
        const totalCompradoElement = document.getElementById('totalComprado');
        if (totalCompradoElement) {
            totalCompradoElement.textContent = `$0.00`;
        }
        
        const totalPedidosElement = document.getElementById('totalPedidos');
        if (totalPedidosElement) {
            totalPedidosElement.textContent = '0';
        }
        
        const productoFrecuenteElement = document.getElementById('productoFrecuente');
        if (productoFrecuenteElement) {
            productoFrecuenteElement.textContent = 'Ninguno';
        }
        
        const tablaBody = document.querySelector('#tablaHistorialComprasProveedor tbody');
        if (tablaBody) {
            tablaBody.innerHTML = '';
            const fila = document.createElement('tr');
            const celda = document.createElement('td');
            celda.colSpan = 7;
            celda.textContent = 'No hay pedidos registrados';
            celda.className = 'text-center';
            fila.appendChild(celda);
            tablaBody.appendChild(fila);
        }
        
        const paginacionDiv = document.getElementById('paginacionHistorialProveedor');
        if (paginacionDiv) {
            paginacionDiv.style.display = 'none';
        }
        return;
    }
    
    const transaction = db.transaction([PEDIDOS_STORE], 'readonly');
    const store = transaction.objectStore(PEDIDOS_STORE);
    
    if (!store.indexNames.contains('proveedor')) {
        console.warn("Índice 'proveedor' no encontrado");
        
        const request = store.getAll();
        
        request.onsuccess = function(event) {
            const todosPedidos = event.target.result || [];
            const pedidosProveedor = todosPedidos.filter(p => p.proveedorId === proveedorId);
            procesarPedidosProveedor(pedidosProveedor, pagina, filtros);
        };
        
        request.onerror = function(event) {
            console.error('Error al cargar pedidos:', event.target.error);
        };
    } else {
        const index = store.index('proveedor');
        const request = index.getAll(proveedorId);
        
        request.onsuccess = function(event) {
            const pedidosProveedor = event.target.result || [];
            procesarPedidosProveedor(pedidosProveedor, pagina, filtros);
        };
        
        request.onerror = function(event) {
            console.error('Error al cargar pedidos del proveedor:', event.target.error);
        };
    }
}

function procesarPedidosProveedor(pedidosProveedor, pagina, filtros) {
    console.log("Pedidos encontrados:", pedidosProveedor.length);

    let compras = [];
    
    pedidosProveedor.forEach(pedido => {
        if (pedido.detalles && Array.isArray(pedido.detalles)) {
            pedido.detalles.forEach(detalle => {
                compras.push({
                    fecha: new Date(pedido.fecha),
                    producto: detalle.productoNombre,
                    pedidoNumero: pedido.numero,
                    cantidad: detalle.cantidad,
                    precio: detalle.precio || 0,
                    total: detalle.subtotal || (detalle.precio * detalle.cantidad),
                    estado: pedido.estado
                });
            });
        }
    });
    
    console.log("Compras procesadas:", compras.length);
    
    if (filtros.fechaDesde) {
        const fechaDesde = DateUtils.parseInputDate(filtros.fechaDesde);
        if (fechaDesde) {
            compras = compras.filter(c => c.fecha >= fechaDesde);
        }
    }
    if (filtros.fechaHasta) {
        const fechaHasta = DateUtils.parseInputDate(filtros.fechaHasta);
        if (fechaHasta) {
            compras = compras.filter(c => c.fecha <= fechaHasta);
        }
    }
    if (filtros.producto) {
        compras = compras.filter(c => c.producto.toLowerCase().includes(filtros.producto.toLowerCase()));
    }
    
    compras.sort((a, b) => b.fecha - a.fecha);
    const totalGastado = compras.reduce((sum, c) => sum + c.total, 0);
    const totalPedidosUnicos = new Set(compras.map(c => c.pedidoNumero)).size;
    const productosFrecuentes = {};
    compras.forEach(c => {
        if (!productosFrecuentes[c.producto]) {
            productosFrecuentes[c.producto] = 0;
        }
        productosFrecuentes[c.producto] += c.cantidad;
    });
    
    let productoMasFrecuente = '';
    let maxCantidad = 0;
    for (const [producto, cantidad] of Object.entries(productosFrecuentes)) {
        if (cantidad > maxCantidad) {
            productoMasFrecuente = producto;
            maxCantidad = cantidad;
        }
    }
    
    const totalCompradoElement = document.getElementById('totalComprado');
    if (totalCompradoElement) {
        totalCompradoElement.textContent = `$${totalGastado.toFixed(2)}`;
    }
    
    const totalPedidosElement = document.getElementById('totalPedidos');
    if (totalPedidosElement) {
        totalPedidosElement.textContent = totalPedidosUnicos;
    }
    
    const productoFrecuenteElement = document.getElementById('productoFrecuente');
    if (productoFrecuenteElement) {
        if (productoMasFrecuente) {
            productoFrecuenteElement.textContent = `${productoMasFrecuente} (${maxCantidad} unidades)`;
        } else {
            productoFrecuenteElement.textContent = 'Ninguno';
        }
    }
    
    const tablaBody = document.querySelector('#tablaHistorialComprasProveedor tbody');
    
    if (!tablaBody) {
        console.warn("No se encontró la tabla de historial de compras del proveedor");
        return;
    }
    
    tablaBody.innerHTML = '';

    const totalPaginas = Math.ceil(compras.length / HISTORIAL_ITEMS_POR_PAGINA);
    const inicio = (pagina - 1) * HISTORIAL_ITEMS_POR_PAGINA;
    const fin = inicio + HISTORIAL_ITEMS_POR_PAGINA;
    const comprasPaginadas = compras.slice(inicio, fin);
    
    if (compras.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 7;
        celda.textContent = 'No hay pedidos registrados';
        celda.className = 'text-center';
        fila.appendChild(celda);
        tablaBody.appendChild(fila);
        
        const paginacionDiv = document.getElementById('paginacionHistorialProveedor');
        if (paginacionDiv) {
            paginacionDiv.style.display = 'none';
        }
        return;
    }
    
    comprasPaginadas.forEach(compra => {
        const fila = document.createElement('tr');
        
        const celdaFecha = document.createElement('td');
        celdaFecha.textContent = DateUtils.formatDisplay(compra.fecha);
        fila.appendChild(celdaFecha);

        const celdaProducto = document.createElement('td');
        celdaProducto.textContent = compra.producto;
        fila.appendChild(celdaProducto);
        
        const celdaPedido = document.createElement('td');
        celdaPedido.textContent = compra.pedidoNumero;
        fila.appendChild(celdaPedido);

        const celdaCantidad = document.createElement('td');
        celdaCantidad.textContent = compra.cantidad;
        celdaCantidad.className = 'text-center';
        fila.appendChild(celdaCantidad);
        
        const celdaPrecio = document.createElement('td');
        celdaPrecio.textContent = `$${compra.precio.toFixed(2)}`;
        celdaPrecio.className = 'text-end';
        fila.appendChild(celdaPrecio);
        
        const celdaTotal = document.createElement('td');
        celdaTotal.textContent = `$${compra.total.toFixed(2)}`;
        celdaTotal.className = 'text-end';
        fila.appendChild(celdaTotal);
        
        const celdaEstado = document.createElement('td');
        let badgeClass = '';
        switch (compra.estado) {
            case 'Pendiente':
                badgeClass = 'bg-warning text-dark';
                break;
            case 'Enviado':
                badgeClass = 'bg-info';
                break;
            case 'Recibido Parcial':
                badgeClass = 'bg-primary';
                break;
            case 'Recibido':
                badgeClass = 'bg-success';
                break;
            case 'Cancelado':
                badgeClass = 'bg-danger';
                break;
            default:
                badgeClass = 'bg-secondary';
        }
        celdaEstado.innerHTML = `<span class="badge ${badgeClass}">${compra.estado}</span>`;
        fila.appendChild(celdaEstado);
        
        tablaBody.appendChild(fila);
    });
    
    const paginacionDiv = document.getElementById('paginacionHistorialProveedor');
    if (paginacionDiv) {
        mostrarPaginacionHistorialProveedor(pagina, totalPaginas, proveedorSeleccionadoId, filtros);
    }
}

function mostrarPaginacionHistorialProveedor(paginaActual, totalPaginas, proveedorId, filtros) {
    const paginacionDiv = document.getElementById('paginacionHistorialProveedor');
    if (!paginacionDiv) {
        console.warn("No se encontró el elemento de paginación del historial");
        return;
    }
    
    paginacionDiv.style.display = totalPaginas > 1 ? 'block' : 'none';
    paginacionDiv.innerHTML = '';
    
    if (totalPaginas <= 1) return;
    
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navegación de historial');
    
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
            cargarHistorialPedidosProveedor(proveedorId, paginaActual - 1, filtros);
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
            cargarHistorialPedidosProveedor(proveedorId, i, filtros);
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
            cargarHistorialPedidosProveedor(proveedorId, paginaActual + 1, filtros);
        });
    }
    liNext.appendChild(aNext);
    ul.appendChild(liNext);
    
    nav.appendChild(ul);
    paginacionDiv.appendChild(nav);
}

function aplicarFiltrosHistorial() {
    if (!proveedorSeleccionadoId) return;
    
    const fechaDesde = document.getElementById('filtroFechaDesde').value;
    const fechaHasta = document.getElementById('filtroFechaHasta').value;
    const producto = document.getElementById('filtroProducto').value;
    
    const filtros = {};
    if (fechaDesde) filtros.fechaDesde = fechaDesde;
    if (fechaHasta) filtros.fechaHasta = fechaHasta;
    if (producto) filtros.producto = producto;
    
    cargarHistorialPedidosProveedor(proveedorSeleccionadoId, 1, filtros);
}

function exportarHistorialProveedor() {
    if (!proveedorSeleccionadoId) return;
    
    const nombreProveedor = document.getElementById('detalle-nombre').textContent;
    
    const transaction = db.transaction([PEDIDOS_STORE], 'readonly');
    const store = transaction.objectStore(PEDIDOS_STORE);
    const index = store.index('proveedor');
    const request = index.getAll(proveedorSeleccionadoId);
    
    request.onsuccess = function(event) {
        const pedidos = event.target.result || [];
        const listaCompras = [];
        
        pedidos.forEach(pedido => {
            if (pedido.detalles && Array.isArray(pedido.detalles)) {
                pedido.detalles.forEach(detalle => {
                    listaCompras.push({
                        'Fecha': new Date(pedido.fecha).toLocaleDateString(),
                        'Número de Pedido': pedido.numero,
                        'Producto': detalle.productoNombre,
                        'Cantidad': detalle.cantidad,
                        'Precio Unitario': detalle.precio || 0,
                        'Subtotal': detalle.subtotal || (detalle.cantidad * detalle.precio),
                        'Estado': pedido.estado,
                        'Notas': pedido.notas || ''
                    });
                });
            }
        });
        
        if (listaCompras.length === 0) {
            alert('No hay datos para exportar');
            return;
        }
        
        listaCompras.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));
        
        const ws = XLSX.utils.json_to_sheet(listaCompras);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Historial de Compras");
        
        const wscols = [
            {wch: 12}, // Fecha
            {wch: 15}, // Número Pedido
            {wch: 30}, // Producto
            {wch: 10}, // Cantidad
            {wch: 12}, // Precio Unitario
            {wch: 12}, // Subtotal
            {wch: 15}, // Estado
            {wch: 40}  // Notas
        ];
        ws['!cols'] = wscols;
        
        XLSX.writeFile(wb, `Historial_${nombreProveedor}_${DateUtils.getTodayFormatted()}.xlsx`);
    };
    
    request.onerror = function(event) {
        console.error('Error al exportar historial:', event.target.error);
        alert('Error al exportar el historial. Por favor, intenta de nuevo.');
    };
}

function mostrarConfirmacionEliminar(id) {
    proveedorSeleccionadoId = id;
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmacionEliminar'));
    modal.show();
}

function eliminarProveedor() {
    if (!proveedorSeleccionadoId) return;
    
    const transaction = db.transaction([PEDIDOS_STORE], 'readonly');
    const pedidosStore = transaction.objectStore(PEDIDOS_STORE);
    const index = pedidosStore.index('proveedor');
    const request = index.count(proveedorSeleccionadoId);
    
    request.onsuccess = function(event) {
        const pedidosCount = event.target.result;
        
        if (pedidosCount > 0) {
            alert(`No se puede eliminar este proveedor porque tiene ${pedidosCount} pedidos asociados. Primero debes eliminar esos pedidos.`);
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalConfirmacionEliminar'));
            modal.hide();
            return;
        }
        
        const deleteTransaction = db.transaction([PROVEEDORES_STORE], 'readwrite');
        const store = deleteTransaction.objectStore(PROVEEDORES_STORE);
        const deleteRequest = store.delete(proveedorSeleccionadoId);
        
        deleteRequest.onsuccess = function() {
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalConfirmacionEliminar'));
            modal.hide();
            cargarProveedores();
            proveedorSeleccionadoId = null;
        };
        
        deleteRequest.onerror = function(event) {
            console.error('Error al eliminar proveedor:', event.target.error);
            alert('Error al eliminar el proveedor. Por favor, intenta de nuevo.');
        };
    };
    
    request.onerror = function(event) {
        console.error('Error al verificar pedidos del proveedor:', event.target.error);
        alert('Error al verificar pedidos del proveedor. Por favor, intenta de nuevo.');
    };
}

async function mostrarModalNuevoPedido(proveedorId, nombreProveedor) {
    document.getElementById('modalPedidoLabel').textContent = 'Nuevo Pedido a Proveedor';
    document.getElementById('formPedido').reset();
    document.getElementById('pedidoId').value = '';
    document.getElementById('pedidoProveedorId').value = proveedorId;
    document.getElementById('proveedorPedido').value = nombreProveedor;
    
    const numeroPedido = await generarNumeroPedido();
    document.getElementById('numeroPedido').value = numeroPedido;
    
    document.getElementById('fechaPedido').value = DateUtils.getTodayFormatted();
    
    limpiarTablaDetallesPedido();
    
    const fechaEntrega = new Date();
    fechaEntrega.setDate(fechaEntrega.getDate() + 7);
    document.getElementById('fechaEstimadaEntrega').value = DateUtils.formatForInput(fechaEntrega);

    const productosProveedor = await cargarProductosProveedor(proveedorId);
    const modalPedido = document.getElementById('modalPedido');
    modalPedido.dataset.productosProveedor = JSON.stringify(productosProveedor);
    
    const modal = new bootstrap.Modal(modalPedido);
    modal.show();
}

function generarNumeroPedido() {
    return new Promise((resolve, reject) => {
        const fecha = new Date();
        const anio = fecha.getFullYear().toString().substr(-2);
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const prefijo = `P${anio}${mes}-`;
        
        const transaction = db.transaction([PEDIDOS_STORE], 'readonly');
        const store = transaction.objectStore(PEDIDOS_STORE);
        const request = store.getAll();
        
        request.onsuccess = function(event) {
            const pedidos = event.target.result;
            let maxNumero = 0;
            
            pedidos.forEach(pedido => {
                if (pedido.numero && pedido.numero.startsWith(prefijo)) {
                    const numParte = pedido.numero.substring(prefijo.length);
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
            console.error("Error al generar número de pedido:", event.target.error);
            const timestamp = Date.now().toString().slice(-5);
            const numeroFallback = `${prefijo}${timestamp}`;
            resolve(numeroFallback);
        };
    });
}

function cargarProductosProveedor(proveedorId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PRODUCTOS_STORE], 'readonly');
        const store = transaction.objectStore(PRODUCTOS_STORE);
        const request = store.getAll();
        
        request.onsuccess = function(event) {
            const productos = event.target.result || [];
            const productosProveedor = productos.filter(producto => 
                producto.proveedorId === proveedorId || 
                (producto.historial && producto.historial.some(h => h.proveedorId === proveedorId))
            );
            resolve(productosProveedor);
        };
        
        request.onerror = function(event) {
            console.error("Error al cargar productos del proveedor:", event.target.error);
            resolve([]);
        };
    });
}

function limpiarTablaDetallesPedido() {
    const tablaDetalles = document.querySelector('#tablaDetallesPedido tbody');
    if (!tablaDetalles) return;
    
    const filaAgregar = document.getElementById('filaAgregarDetallePedido');
    
    while (tablaDetalles.firstChild) {
        if (tablaDetalles.firstChild === filaAgregar) {
            break;
        }
        tablaDetalles.removeChild(tablaDetalles.firstChild);
    }

    actualizarTotalPedido();
}

function agregarFilaDetallePedido() {
    const tablaDetalles = document.querySelector('#tablaDetallesPedido tbody');
    const filaAgregar = document.getElementById('filaAgregarDetallePedido');
    const nuevaFila = document.createElement('tr');

    const modalPedido = document.getElementById('modalPedido');
    let productosProveedor = [];
    try {
        productosProveedor = JSON.parse(modalPedido.dataset.productosProveedor || '[]');
    } catch (e) {
        console.error("Error al parsear productos:", e);
    }
    
    const celdaProducto = document.createElement('td');

    const inputProducto = document.createElement('input');
    inputProducto.type = 'text';
    inputProducto.className = 'form-control producto-pedido-input';
    inputProducto.placeholder = 'Nombre del producto';
    inputProducto.required = true;
    inputProducto.setAttribute('list', 'productos-proveedor-list');

    let datalist = document.getElementById('productos-proveedor-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'productos-proveedor-list';
        document.body.appendChild(datalist);
    }

    datalist.innerHTML = '';
    
    productosProveedor.forEach(producto => {
        const option = document.createElement('option');
        option.value = producto.nombre;
        option.dataset.precio = producto.precio || 0;
        datalist.appendChild(option);
    });
    
    inputProducto.addEventListener('change', function() {
        const productoSeleccionado = productosProveedor.find(p => p.nombre === this.value);
        if (productoSeleccionado) {
            const inputPrecio = nuevaFila.querySelector('.precio-pedido-input');
            if (inputPrecio && productoSeleccionado.precio) {
                inputPrecio.value = productoSeleccionado.precio;
                actualizarSubtotalDetallePedido(nuevaFila);
            }
        }
    });
    
    celdaProducto.appendChild(inputProducto);
    nuevaFila.appendChild(celdaProducto);
    
    const celdaCantidad = document.createElement('td');
    const inputCantidad = document.createElement('input');
    inputCantidad.type = 'number';
    inputCantidad.className = 'form-control cantidad-pedido-input';
    inputCantidad.min = '1';
    inputCantidad.value = '1';
    inputCantidad.addEventListener('change', function() {
        actualizarSubtotalDetallePedido(nuevaFila);
    });
    celdaCantidad.appendChild(inputCantidad);
    nuevaFila.appendChild(celdaCantidad);
    
    const celdaPrecio = document.createElement('td');
    const inputPrecio = document.createElement('input');
    inputPrecio.type = 'number';
    inputPrecio.className = 'form-control precio-pedido-input';
    inputPrecio.min = '0.01';
    inputPrecio.step = '0.01';
    inputPrecio.value = '0.00';
    inputPrecio.addEventListener('change', function() {
        actualizarSubtotalDetallePedido(nuevaFila);
    });
    celdaPrecio.appendChild(inputPrecio);
    nuevaFila.appendChild(celdaPrecio);
    
    const celdaSubtotal = document.createElement('td');
    celdaSubtotal.className = 'subtotal-pedido-celda';
    celdaSubtotal.textContent = '$0.00';
    nuevaFila.appendChild(celdaSubtotal);
    
    const celdaAccion = document.createElement('td');
    const btnEliminar = document.createElement('button');
    btnEliminar.className = 'btn btn-danger btn-sm';
    btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    btnEliminar.addEventListener('click', function() {
        tablaDetalles.removeChild(nuevaFila);
        actualizarTotalPedido();
    });
    celdaAccion.appendChild(btnEliminar);
    nuevaFila.appendChild(celdaAccion);
    
    tablaDetalles.insertBefore(nuevaFila, filaAgregar);
    
    actualizarSubtotalDetallePedido(nuevaFila);
}

function actualizarSubtotalDetallePedido(fila) {
    const inputCantidad = fila.querySelector('.cantidad-pedido-input');
    const inputPrecio = fila.querySelector('.precio-pedido-input');
    const celdaSubtotal = fila.querySelector('.subtotal-pedido-celda');
    
    const cantidad = parseFloat(inputCantidad.value) || 0;
    const precio = parseFloat(inputPrecio.value) || 0;
    
    const subtotal = cantidad * precio;
    celdaSubtotal.textContent = `${subtotal.toFixed(2)}`;
    
    actualizarTotalPedido();
}

function actualizarTotalPedido() {
    const celdasSubtotal = document.querySelectorAll('.subtotal-pedido-celda');
    let total = 0;
    
    celdasSubtotal.forEach(celda => {
        const subtotalTexto = celda.textContent.replace(/[^\d.-]/g, '');
        const subtotal = parseFloat(subtotalTexto) || 0;
        total += subtotal;
    });
    
    document.getElementById('totalPedido').textContent = `${total.toFixed(2)}`;
}

function guardarPedido() {
    const pedidoId = document.getElementById('pedidoId').value;
    const proveedorId = parseInt(document.getElementById('pedidoProveedorId').value);
    const numero = document.getElementById('numeroPedido').value.trim();
    const fechaInput = document.getElementById('fechaPedido').value;
    const estado = document.getElementById('estadoPedido').value;
    const notas = document.getElementById('notasPedido').value.trim();
    const fechaEstimadaInput = document.getElementById('fechaEstimadaEntrega').value;
    const formaPago = document.getElementById('formaPagoPedido').value;
    
    const fecha = DateUtils.parseInputDate(fechaInput);
    const fechaEstimada = DateUtils.parseInputDate(fechaEstimadaInput);
    const proveedorNombre = document.getElementById('proveedorPedido').value.trim();
    
    if (!proveedorId || !numero || !fecha || !estado) {
        alert('Por favor, complete todos los campos requeridos.');
        return;
    }
    
    const filas = document.querySelectorAll('#tablaDetallesPedido tbody tr:not(#filaAgregarDetallePedido)');
    const detalles = [];
    let totalPedido = 0;
    
    if (filas.length === 0) {
        alert('Debe agregar al menos un producto al pedido.');
        return;
    }
    
    for (const fila of filas) {
        const inputProducto = fila.querySelector('.producto-pedido-input');
        const inputCantidad = fila.querySelector('.cantidad-pedido-input');
        const inputPrecio = fila.querySelector('.precio-pedido-input');
        
        const productoNombre = inputProducto.value.trim();
        const cantidad = parseFloat(inputCantidad.value) || 0;
        const precio = parseFloat(inputPrecio.value) || 0;
        const subtotal = cantidad * precio;
        
        if (!productoNombre || cantidad <= 0 || precio <= 0) {
            alert('Por favor, complete correctamente todos los detalles de productos.');
            return;
        }
        
        detalles.push({
            productoNombre,
            cantidad,
            precio,
            subtotal
        });
        
        totalPedido += subtotal;
    }
    
    const pedido = {
        numero,
        fecha,
        proveedorId,
        proveedorNombre,
        estado,
        detalles,
        total: totalPedido,
        notas,
        fechaEstimadaEntrega: fechaEstimada,
        formaPago,
        fechaCreacion: new Date()
    };
    
    const transaction = db.transaction([PEDIDOS_STORE, PROVEEDORES_STORE], 'readwrite');
    const pedidosStore = transaction.objectStore(PEDIDOS_STORE);
    const proveedoresStore = transaction.objectStore(PROVEEDORES_STORE);
    
    let pedidoGuardado;
    if (pedidoId) {
        pedido.id = parseInt(pedidoId);
        pedidosStore.put(pedido);
        pedidoGuardado = pedido;
    } else {
        const request = pedidosStore.add(pedido);
        request.onsuccess = function(event) {
            pedidoGuardado = { ...pedido, id: event.target.result };
            
            if (estado === 'Recibido' || estado === 'Recibido Parcial') {
                actualizarInventarioConPedido(pedidoGuardado);
            }
            
            actualizarUltimaCompraProveedor(proveedorId, fecha);
        };
    }
    
    transaction.oncomplete = function() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalPedido'));
        modal.hide();
        
        if (proveedorSeleccionadoId === proveedorId) {
            cargarHistorialPedidosProveedor(proveedorId);
        }
        
        const pedidosTab = document.getElementById('pedidos-tab');
        if (pedidosTab) {
            pedidosTab.click();
        } else {
            cargarPedidos();
        }
        
        if (estado === 'Recibido') {
            registrarGastoDesdeCompra(pedidoGuardado);
        }
        
        alert(`Pedido ${numero} guardado correctamente.`);
    };
    
    transaction.onerror = function(event) {
        console.error('Error al guardar pedido:', event.target.error);
        alert('Error al guardar el pedido. Por favor, intenta de nuevo.');
    };
}

function actualizarInventarioConPedido(pedido) {
    if (pedido.estado !== 'Recibido' && pedido.estado !== 'Recibido Parcial') return;
    
    const transaction = db.transaction([PRODUCTOS_STORE], 'readwrite');
    const productosStore = transaction.objectStore(PRODUCTOS_STORE);
    const index = productosStore.index('nombre');
    
    pedido.detalles.forEach(detalle => {
        const request = index.getKey(detalle.productoNombre);
        
        request.onsuccess = function(event) {
            const productoId = event.target.result;
            
            if (productoId) {
                const getRequest = productosStore.get(productoId);
                getRequest.onsuccess = function(event) {
                    const producto = event.target.result;

                    producto.cantidad += detalle.cantidad;
                    
                    if (!producto.historial) producto.historial = [];
                    producto.historial.push({
                        tipo: 'Entrada',
                        cantidad: detalle.cantidad,
                        precio: detalle.precio,
                        descripcion: `Recibido de pedido ${pedido.numero}`,
                        fecha: new Date()
                    });
                    
                    if (detalle.precio > 0) {
                        producto.precio = detalle.precio;
                    }
                    
                    productosStore.put(producto);
                };
            } else {
                const nuevoProducto = {
                    nombre: detalle.productoNombre,
                    cantidad: detalle.cantidad,
                    precio: detalle.precio,
                    historial: [{
                        tipo: 'Entrada',
                        cantidad: detalle.cantidad,
                        precio: detalle.precio,
                        descripcion: `Recibido de pedido ${pedido.numero}`,
                        fecha: new Date()
                    }]
                };
                
                productosStore.add(nuevoProducto);
            }
        };
    });
}

function actualizarUltimaCompraProveedor(proveedorId, fechaCompra) {
    const transaction = db.transaction([PROVEEDORES_STORE], 'readwrite');
    const store = transaction.objectStore(PROVEEDORES_STORE);
    const request = store.get(proveedorId);
    
    request.onsuccess = function(event) {
        const proveedor = event.target.result;
        if (!proveedor) return;
        
        let debeActualizar = false;
        
        if (!proveedor.ultimaCompra) {
            debeActualizar = true;
        } else {
            const fechaActual = new Date(proveedor.ultimaCompra);
            debeActualizar = fechaCompra > fechaActual;
        }
        
        if (debeActualizar) {
            proveedor.ultimaCompra = fechaCompra;
            store.put(proveedor);
        }
    };
}

function registrarGastoDesdeCompra(pedido) {
    if (!db.objectStoreNames.contains(TRANSACCIONES_STORE)) return;
    
    const transaccion = {
        tipo: 'gasto',
        descripcion: `Compra a ${pedido.proveedorNombre} - Pedido ${pedido.numero}`,
        categoria: 'Compras',
        monto: pedido.total,
        fecha: new Date(),
        cliente: '',
        notas: pedido.notas || `Recepción de pedido ${pedido.numero}`,
        fechaCreacion: new Date(),
        pedidoId: pedido.id
    };
    
    const transaction = db.transaction([TRANSACCIONES_STORE], 'readwrite');
    const store = transaction.objectStore(TRANSACCIONES_STORE);
    
    store.add(transaccion);
}
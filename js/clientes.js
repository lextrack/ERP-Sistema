let db;
let clienteSeleccionadoId = null;
const CLIENTES_STORE = 'clientes';
const PRODUCTOS_STORE = 'productos';
const TRANSACCIONES_STORE = 'transacciones';
const FACTURAS_STORE = 'facturas';
const request = indexedDB.open('erpDB', 5);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains(PRODUCTOS_STORE)) {
        const productosStore = db.createObjectStore(PRODUCTOS_STORE, { keyPath: 'id', autoIncrement: true });
        productosStore.createIndex('nombre', 'nombre', { unique: false });
    }
    
    if (!db.objectStoreNames.contains(CLIENTES_STORE)) {
        const clientesStore = db.createObjectStore(CLIENTES_STORE, { keyPath: 'id', autoIncrement: true });
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

    if (!db.objectStoreNames.contains(TRANSACCIONES_STORE)) {
        const transaccionesStore = db.createObjectStore(TRANSACCIONES_STORE, { keyPath: 'id', autoIncrement: true });
        transaccionesStore.createIndex('fecha', 'fecha', { unique: false });
        transaccionesStore.createIndex('tipo', 'tipo', { unique: false });
        transaccionesStore.createIndex('categoria', 'categoria', { unique: false });
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
    cargarClientes();
};

request.onerror = function(event) {
    console.error("Error al abrir la base de datos:", event.target.error);
};

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('btnNuevoCliente').addEventListener('click', mostrarModalNuevoCliente);
    document.getElementById('btnGuardarCliente').addEventListener('click', guardarCliente);
    document.getElementById('btnBuscar').addEventListener('click', buscarClientes);
    document.getElementById('buscarCliente').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            buscarClientes();
        }
    });

    const modalCliente = document.getElementById('modalCliente');
    if (modalCliente) {
        modalCliente.addEventListener('shown.bs.modal', function() {
            document.getElementById('nombreCliente').focus();
        });
    }
    
    const modalDetalle = document.getElementById('modalDetalleCliente');
    if (modalDetalle) {
        modalDetalle.addEventListener('shown.bs.modal', function() {
            const closeButton = modalDetalle.querySelector('.btn-close');
            if (closeButton) {
                closeButton.focus();
            }
        });
    }

    const modalConfirmacion = document.getElementById('modalConfirmacionEliminar');
    if (modalConfirmacion) {
        modalConfirmacion.addEventListener('shown.bs.modal', function() {
            const cancelButton = modalConfirmacion.querySelector('.btn-secondary');
            if (cancelButton) {
                cancelButton.focus();
            }
        });
    }
    
    document.getElementById('btnConfirmarEliminar').addEventListener('click', eliminarCliente);
    document.getElementById('btnNuevaVentaCliente').addEventListener('click', function() {
        const nombreCliente = document.getElementById('detalle-nombre').textContent;
        const modalDetalles = bootstrap.Modal.getInstance(document.getElementById('modalDetalleCliente'));
        modalDetalles.hide();
        
        setTimeout(function() {
            const modalVenta = new bootstrap.Modal(document.getElementById('modalVenta'));
            modalVenta.show();
            document.getElementById('nombreCliente').value = nombreCliente;
        }, 500);
    });
});

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

function cargarClientes(filtro = '', pagina = 1) {
    const ITEMS_POR_PAGINA = 10;
    const transaction = db.transaction([CLIENTES_STORE], 'readonly');
    const store = transaction.objectStore(CLIENTES_STORE);
    const request = store.getAll();

    request.onsuccess = function(event) {
        let clientes = event.target.result;
        
        if (filtro) {
            filtro = filtro.toLowerCase();
            clientes = clientes.filter(cliente => 
                cliente.nombre.toLowerCase().includes(filtro) || 
                (cliente.email && cliente.email.toLowerCase().includes(filtro)) ||
                (cliente.telefono && cliente.telefono.includes(filtro))
            );
        }
        
        clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        const totalClientes = clientes.length;
        const totalPaginas = Math.ceil(totalClientes / ITEMS_POR_PAGINA);
        const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
        const fin = inicio + ITEMS_POR_PAGINA;
        const clientesPaginados = clientes.slice(inicio, fin);
        
        mostrarClientes(clientesPaginados);
        mostrarPaginacionClientes(pagina, totalPaginas, filtro);
        
        const infoResultados = document.getElementById('infoResultadosClientes');
        if (infoResultados) {
            infoResultados.textContent = `Mostrando ${Math.min(fin, totalClientes)} clientes de un total de ${totalClientes}`;
        }
    };

    request.onerror = function(event) {
        console.error("Error al cargar clientes:", event.target.error);
    };
}

function mostrarPaginacionClientes(paginaActual, totalPaginas, filtro) {
    const paginacionDiv = document.getElementById('paginacionClientes');
    if (!paginacionDiv) return;
    
    paginacionDiv.innerHTML = '';
    
    if (totalPaginas <= 1) {
        paginacionDiv.style.display = 'none';
        return;
    }
    
    paginacionDiv.style.display = 'block';
    
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navegación de clientes');
    
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
            cargarClientes(filtro, paginaActual - 1);
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
            cargarClientes(filtro, i);
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
            cargarClientes(filtro, paginaActual + 1);
        });
    }
    liNext.appendChild(aNext);
    ul.appendChild(liNext);
    
    nav.appendChild(ul);
    paginacionDiv.appendChild(nav);
}

function mostrarClientes(clientes) {
    const tablaBody = document.querySelector('#tablaClientes tbody');
    tablaBody.innerHTML = '';
    
    if (clientes.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 7;
        celda.textContent = 'No hay clientes registrados';
        celda.className = 'text-center';
        fila.appendChild(celda);
        tablaBody.appendChild(fila);
        return;
    }
    
    clientes.forEach(cliente => {
        const fila = document.createElement('tr');
        
        const celdaId = document.createElement('td');
        celdaId.textContent = cliente.id;
        fila.appendChild(celdaId);
        
        const celdaNombre = document.createElement('td');
        celdaNombre.textContent = cliente.nombre;
        fila.appendChild(celdaNombre);

        const celdaEmail = document.createElement('td');
        celdaEmail.textContent = cliente.email || '-';
        fila.appendChild(celdaEmail);

        const celdaTelefono = document.createElement('td');
        celdaTelefono.textContent = cliente.telefono || '-';
        fila.appendChild(celdaTelefono);

        const celdaDireccion = document.createElement('td');
        celdaDireccion.textContent = cliente.direccion || '-';
        fila.appendChild(celdaDireccion);

        const celdaUltimaCompra = document.createElement('td');
        if (cliente.ultimaCompra) {
            celdaUltimaCompra.textContent = DateUtils.formatDisplay(new Date(cliente.ultimaCompra));
        } else {
            celdaUltimaCompra.textContent = 'Sin compras';
        }
        fila.appendChild(celdaUltimaCompra);

        const celdaAcciones = document.createElement('td');
        celdaAcciones.className = 'd-flex justify-content-around';

        const btnVer = document.createElement('button');
        btnVer.className = 'btn btn-info btn-sm';
        btnVer.innerHTML = '<i class="fas fa-eye"></i>';
        btnVer.title = 'Ver detalles';
        btnVer.addEventListener('click', () => verDetallesCliente(cliente.id));
        celdaAcciones.appendChild(btnVer);

        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn btn-warning btn-sm';
        btnEditar.innerHTML = '<i class="fas fa-edit"></i>';
        btnEditar.title = 'Editar cliente';
        btnEditar.addEventListener('click', () => editarCliente(cliente.id));
        celdaAcciones.appendChild(btnEditar);
        
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn btn-danger btn-sm';
        btnEliminar.innerHTML = '<i class="fas fa-trash"></i>';
        btnEliminar.title = 'Eliminar cliente';
        btnEliminar.addEventListener('click', () => mostrarConfirmacionEliminar(cliente.id));
        celdaAcciones.appendChild(btnEliminar);
        
        fila.appendChild(celdaAcciones);
        
        tablaBody.appendChild(fila);
    });
}

function buscarClientes() {
    const filtro = document.getElementById('buscarCliente').value.trim();
    cargarClientes(filtro, 1);
}

function mostrarModalNuevoCliente() {
    document.getElementById('modalClienteLabel').textContent = 'Nuevo Cliente';
    document.getElementById('formCliente').reset();
    document.getElementById('clienteId').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
    modal.show();
}

function guardarCliente() {
    const clienteId = document.getElementById('clienteId').value;
    const nombre = document.getElementById('nombreCliente').value.trim();
    const email = document.getElementById('emailCliente').value.trim();
    const telefono = document.getElementById('telefonoCliente').value.trim();
    const ruc = document.getElementById('rucCliente').value.trim();
    const direccion = document.getElementById('direccionCliente').value.trim();
    const ciudad = document.getElementById('ciudadCliente').value.trim();
    const pais = document.getElementById('paisCliente').value.trim();
    const notas = document.getElementById('notasCliente').value.trim();
    
    if (!nombre) {
        alert('El nombre del cliente es obligatorio');
        return;
    }
    
    const cliente = {
        nombre,
        email,
        telefono,
        ruc,
        direccion,
        ciudad,
        pais,
        notas,
        fechaCreacion: new Date()
    };
    
    const transaction = db.transaction([CLIENTES_STORE], 'readwrite');
    const store = transaction.objectStore(CLIENTES_STORE);

    if (clienteId) {
        cliente.id = parseInt(clienteId);
        store.put(cliente);
    } else {
        store.add(cliente);
    }
    
    transaction.oncomplete = function() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCliente'));
        modal.hide();
        cargarClientes();
    };
    
    transaction.onerror = function(event) {
        console.error('Error al guardar cliente:', event.target.error);
        alert('Error al guardar el cliente. Por favor, intenta de nuevo.');
    };
}

function editarCliente(id) {
    const transaction = db.transaction([CLIENTES_STORE], 'readonly');
    const store = transaction.objectStore(CLIENTES_STORE);
    const request = store.get(id);
    
    request.onsuccess = function(event) {
        const cliente = event.target.result;
        if (cliente) {
            document.getElementById('modalClienteLabel').textContent = 'Editar Cliente';
            document.getElementById('clienteId').value = cliente.id;
            document.getElementById('nombreCliente').value = cliente.nombre || '';
            document.getElementById('emailCliente').value = cliente.email || '';
            document.getElementById('telefonoCliente').value = cliente.telefono || '';
            document.getElementById('rucCliente').value = cliente.ruc || '';
            document.getElementById('direccionCliente').value = cliente.direccion || '';
            document.getElementById('ciudadCliente').value = cliente.ciudad || '';
            document.getElementById('paisCliente').value = cliente.pais || '';
            document.getElementById('notasCliente').value = cliente.notas || '';
            
            const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
            modal.show();
        }
    };
    
    request.onerror = function(event) {
        console.error('Error al obtener cliente para editar:', event.target.error);
    };
}

function verDetallesCliente(id) {
    const transaction = db.transaction([CLIENTES_STORE, PRODUCTOS_STORE], 'readonly');
    const clientesStore = transaction.objectStore(CLIENTES_STORE);
    const productosStore = transaction.objectStore(PRODUCTOS_STORE);
    
    const clienteRequest = clientesStore.get(id);
    
    clienteRequest.onsuccess = function(event) {
        const cliente = event.target.result;
        if (cliente) {
            document.getElementById('detalle-nombre').textContent = cliente.nombre || '';
            document.getElementById('detalle-email').textContent = cliente.email || 'No disponible';
            document.getElementById('detalle-telefono').textContent = cliente.telefono || 'No disponible';
            document.getElementById('detalle-ruc').textContent = cliente.ruc || 'No disponible';
            document.getElementById('detalle-direccion').textContent = cliente.direccion || 'No disponible';
            document.getElementById('detalle-ciudad').textContent = cliente.ciudad || '';
            document.getElementById('detalle-pais').textContent = cliente.pais || '';
            document.getElementById('detalle-notas').textContent = cliente.notas || 'Sin notas';
            
            clienteSeleccionadoId = cliente.id;
            cargarHistorialCompras(cliente.nombre);
            const modal = new bootstrap.Modal(document.getElementById('modalDetalleCliente'));
            modal.show();
        }
    };
    
    clienteRequest.onerror = function(event) {
        console.error('Error al obtener detalles del cliente:', event.target.error);
    };
}

function cargarHistorialCompras(nombreCliente, pagina = 1, filtros = {}) {
    const ITEMS_POR_PAGINA = 5;
    const transaction = db.transaction([PRODUCTOS_STORE], 'readonly');
    const store = transaction.objectStore(PRODUCTOS_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const productos = event.target.result;
        let compras = [];
        
        productos.forEach(producto => {
            if (producto.historial && Array.isArray(producto.historial)) {
                producto.historial.forEach(movimiento => {
                    if (movimiento.tipo === 'Venta' && movimiento.cliente === nombreCliente) {
                        compras.push({
                            fecha: new Date(movimiento.fecha),
                            producto: producto.nombre,
                            cantidad: movimiento.cantidad,
                            precio: movimiento.precio || 0,
                            total: (movimiento.precio || 0) * movimiento.cantidad
                        });
                    }
                });
            }
        });
        
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
        
        compras.sort((a, b) => DateUtils.compareDates(b.fecha, a.fecha));
        
        const totalGastado = compras.reduce((sum, c) => sum + c.total, 0);
        const productosMasComprados = {};
        compras.forEach(c => {
            if (!productosMasComprados[c.producto]) {
                productosMasComprados[c.producto] = 0;
            }
            productosMasComprados[c.producto] += c.cantidad;
        });
        

        let productoMasComprado = '';
        let maxCantidad = 0;
        for (const [producto, cantidad] of Object.entries(productosMasComprados)) {
            if (cantidad > maxCantidad) {
                productoMasComprado = producto;
                maxCantidad = cantidad;
            }
        }

        document.getElementById('totalGastado').textContent = `$${totalGastado.toFixed(2)}`;
        document.getElementById('totalCompras').textContent = compras.length;
        if (productoMasComprado) {
            document.getElementById('productoFavorito').textContent = `${productoMasComprado} (${maxCantidad} unidades)`;
        } else {
            document.getElementById('productoFavorito').textContent = 'Ninguno';
        }

        const totalPaginas = Math.ceil(compras.length / ITEMS_POR_PAGINA);
        const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
        const fin = inicio + ITEMS_POR_PAGINA;
        const comprasPaginadas = compras.slice(inicio, fin);
        
        if (compras.length > 0 && clienteSeleccionadoId) {
            actualizarUltimaCompraCliente(clienteSeleccionadoId, compras[0].fecha);
        }
        
        const tablaBody = document.querySelector('#tablaHistorialCompras tbody');
        tablaBody.innerHTML = '';
        
        if (compras.length === 0) {
            const fila = document.createElement('tr');
            const celda = document.createElement('td');
            celda.colSpan = 5;
            celda.textContent = 'No hay compras registradas';
            celda.className = 'text-center';
            fila.appendChild(celda);
            tablaBody.appendChild(fila);
            
            document.getElementById('paginacionHistorial').style.display = 'none';
            return;
        }
        
        comprasPaginadas.forEach(compra => {
            const fila = document.createElement('tr');
            
            const celdaFecha = document.createElement('td');
            celdaFecha.textContent = compra.fecha.toLocaleString(); 
            fila.appendChild(celdaFecha);

            const celdaProducto = document.createElement('td');
            celdaProducto.textContent = compra.producto;
            fila.appendChild(celdaProducto);

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
            
            tablaBody.appendChild(fila);
        });
        
        renderizarPaginacion(pagina, totalPaginas, nombreCliente, filtros);
    };
    
    request.onerror = function(event) {
        console.error('Error al cargar historial de compras:', event.target.error);
    };
}

function renderizarPaginacion(paginaActual, totalPaginas, nombreCliente, filtros) {
    const paginacionDiv = document.getElementById('paginacionHistorial');
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
            cargarHistorialCompras(nombreCliente, paginaActual - 1, filtros);
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
            cargarHistorialCompras(nombreCliente, i, filtros);
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
            cargarHistorialCompras(nombreCliente, paginaActual + 1, filtros);
        });
    }
    liNext.appendChild(aNext);
    ul.appendChild(liNext);
    
    nav.appendChild(ul);
    paginacionDiv.appendChild(nav);
}

function exportarHistorialCliente(nombreCliente) {
    const transaction = db.transaction([PRODUCTOS_STORE], 'readonly');
    const store = transaction.objectStore(PRODUCTOS_STORE);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const productos = event.target.result;
        const compras = [];
        
        productos.forEach(producto => {
            if (producto.historial && Array.isArray(producto.historial)) {
                producto.historial.forEach(movimiento => {
                    if (movimiento.tipo === 'Venta' && movimiento.cliente === nombreCliente) {
                        compras.push({
                            'Fecha': new Date(movimiento.fecha).toLocaleString(),
                            'Producto': producto.nombre,
                            'Cantidad': movimiento.cantidad,
                            'Precio Unitario': movimiento.precio || 0,
                            'Total': (movimiento.precio || 0) * movimiento.cantidad
                        });
                    }
                });
            }
        });
        
        if (compras.length === 0) {
            alert('No hay datos para exportar');
            return;
        }
        
        compras.sort((a, b) => DateUtils.compareDates(new Date(b.Fecha), new Date(a.Fecha)));
        
        const ws = XLSX.utils.json_to_sheet(compras);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Historial de Compras");
        
        XLSX.writeFile(wb, `Historial_${nombreCliente}_${DateUtils.getTodayFormatted()}.xlsx`);
    };
}

function aplicarFiltrosHistorial() {
    const fechaDesde = document.getElementById('filtroFechaDesde').value;
    const fechaHasta = document.getElementById('filtroFechaHasta').value;
    const producto = document.getElementById('filtroProducto').value;
    
    const filtros = {};
    if (fechaDesde) filtros.fechaDesde = fechaDesde;
    if (fechaHasta) filtros.fechaHasta = fechaHasta;
    if (producto) filtros.producto = producto;
    
    cargarHistorialCompras(document.getElementById('detalle-nombre').textContent, 1, filtros);
}

function actualizarUltimaCompraCliente(clienteId, fechaCompra) {
    return new Promise((resolve, reject) => {
        clienteId = normalizarId(clienteId);
        
        if (clienteId <= 0) {
            console.warn("ID de cliente inválido para actualizar última compra:", clienteId);
            resolve(false);
            return;
        }

        let fechaCompraObj;
        if (fechaCompra instanceof Date) {
            fechaCompraObj = fechaCompra;
        } else {
            try {
                fechaCompraObj = new Date(fechaCompra);
                if (isNaN(fechaCompraObj.getTime())) {
                    throw new Error("Fecha inválida");
                }
            } catch (error) {
                console.error("Error al convertir fecha de compra:", error);
                resolve(false);
                return;
            }
        }

        const transaction = db.transaction([CLIENTES_STORE], 'readwrite');
        const store = transaction.objectStore(CLIENTES_STORE);
        const request = store.get(clienteId);
        
        request.onsuccess = function(event) {
            const cliente = event.target.result;
            if (!cliente) {
                console.warn("No se encontró cliente con ID:", clienteId);
                resolve(false);
                return;
            }
            
            let debeActualizar = false;
            
            if (!cliente.ultimaCompra) {
                debeActualizar = true;
            } else {
                const fechaActual = new Date(cliente.ultimaCompra);
                debeActualizar = fechaCompraObj > fechaActual;
            }
            
            if (debeActualizar) {
                cliente.ultimaCompra = fechaCompraObj;
                const updateRequest = store.put(cliente);
                
                updateRequest.onsuccess = function() {
                    console.log(`Última compra del cliente ${cliente.nombre} actualizada a ${fechaCompraObj.toLocaleString()}`);
                    resolve(true);
                };
                
                updateRequest.onerror = function(event) {
                    console.error("Error al actualizar última compra:", event.target.error);
                    reject(event.target.error);
                };
            } else {
                console.log(`No se actualizó última compra de ${cliente.nombre} porque ya existe una fecha más reciente`);
                resolve(false);
            }
        };
        
        request.onerror = function(event) {
            console.error("Error al obtener cliente para actualizar última compra:", event.target.error);
            reject(event.target.error);
        };
        
        transaction.oncomplete = function() {
        };
    });
}

function mostrarConfirmacionEliminar(id) {
    clienteSeleccionadoId = id;
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmacionEliminar'));
    modal.show();
}

function eliminarCliente() {
    if (!clienteSeleccionadoId) return;
    
    const transaction = db.transaction([CLIENTES_STORE], 'readwrite');
    const store = transaction.objectStore(CLIENTES_STORE);
    const request = store.delete(clienteSeleccionadoId);
    
    request.onsuccess = function() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalConfirmacionEliminar'));
        modal.hide();
        cargarClientes();
        clienteSeleccionadoId = null;
    };
    
    request.onerror = function(event) {
        console.error('Error al eliminar cliente:', event.target.error);
        alert('Error al eliminar el cliente. Por favor, intenta de nuevo.');
    };
}

window.addEventListener('load', function() {
    if (!document.getElementById('modalVenta')) {
        const modalHTML = `
        <div class="modal fade" id="modalVenta" tabindex="-1" aria-labelledby="modalVentaLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header">
                        <h5 class="modal-title" id="modalVentaLabel">Registrar Venta</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="formVenta">
                            <div class="mb-3">
                                <label for="nombreProductoVenta" class="form-label">Nombre o SKU del Producto</label>
                                <input type="text" class="form-control" id="nombreProductoVenta" placeholder="Ingresa el nombre o SKU del producto">
                            </div>
                            <div class="mb-3">
                                <label for="cantidadVenta" class="form-label">Cantidad</label>
                                <input type="number" class="form-control" id="cantidadVenta" placeholder="Ingresa la cantidad">
                            </div>
                            <div class="mb-3">
                                <label for="nombreCliente" class="form-label">Nombre del Cliente</label>
                                <input type="text" class="form-control" id="nombreCliente" placeholder="Nombre del cliente">
                            </div>                            
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success" onclick="registrarVenta()">Registrar Venta</button>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        if (typeof registrarVenta !== 'function') {
            window.registrarVenta = function() {
                alert('Función de venta no disponible. Por favor, ve a la página de inventario para registrar ventas.');
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalVenta'));
                modal.hide();
            };
        }
    }
});
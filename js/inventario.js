const LIMITE_HISTORIAL = 500;
const PRODUCTOS_STORE = 'productos';
const PROVEEDORES_STORE = 'proveedores';
let numeroSecuencial = obtenerNumeroSecuencial();
let db;
const request = indexedDB.open('erpDB', 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains('productos')) {
        const store = db.createObjectStore('productos', { keyPath: 'id', autoIncrement: true });
        store.createIndex('nombre', 'nombre', { unique: false });
    }

    if (!db.objectStoreNames.contains('clientes')) {
        const clientesStore = db.createObjectStore('clientes', { keyPath: 'id', autoIncrement: true });
        clientesStore.createIndex('nombre', 'nombre', { unique: false });
    }
    
    if (!db.objectStoreNames.contains('transacciones')) {
        const transaccionesStore = db.createObjectStore('transacciones', { keyPath: 'id', autoIncrement: true });
        transaccionesStore.createIndex('fecha', 'fecha', { unique: false });
        transaccionesStore.createIndex('tipo', 'tipo', { unique: false });
        transaccionesStore.createIndex('categoria', 'categoria', { unique: false });
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
};

request.onsuccess = function(event) {
    db = event.target.result;
    cargarInventarios();
};

request.onerror = function(event) {
    console.error("Error al abrir la base de datos:", event.target.error);
};

function obtenerNumeroSecuencial() {
    const secuenciaGuardada = localStorage.getItem('numeroSecuencial');
    return secuenciaGuardada ? parseInt(secuenciaGuardada) : 0;
}

function guardarNumeroSecuencial(secuencia) {
    localStorage.setItem('numeroSecuencial', secuencia);
}

function generarSKU() {
    const fecha = new Date();
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    const fechaFormateada = `${anio}${mes}${dia}`;

    numeroSecuencial++;
    guardarNumeroSecuencial(numeroSecuencial);
    const sku = `SKU-${fechaFormateada}-${String(numeroSecuencial).padStart(3, '0')}`;
    generarCodigoDeBarras(sku);

    return sku;
}

function generarCodigoDeBarras(sku) {
    const codigoDeBarras = document.createElement('img');
    JsBarcode(codigoDeBarras, sku, {
        format: "CODE128",
        lineColor: "#3e3e42",
        width: 2,
        height: 50,
        displayValue: true
    });
    return codigoDeBarras;
}

document.getElementById('modalIngreso').addEventListener('hidden.bs.modal', function () {
    const formIngreso = document.getElementById('formIngreso');
    formIngreso.reset();
});

document.getElementById('modalSalida').addEventListener('hidden.bs.modal', function () {
    const formSalida = document.getElementById('formSalida');
    formSalida.reset();
});

document.getElementById('modalVenta').addEventListener('hidden.bs.modal', function () {
    const formVenta = document.getElementById('formVenta');
    formVenta.reset();
});

function cargarProveedoresParaSelect() {
    if (!db) {
        console.warn("Base de datos no inicializada todavía");
        const proveedorDiv = document.getElementById('proveedorProductoDiv');
        if (proveedorDiv) proveedorDiv.style.display = 'none';
        return;
    }

    if (!db.objectStoreNames.contains('proveedores')) {
        const proveedorDiv = document.getElementById('proveedorProductoDiv');
        if (proveedorDiv) proveedorDiv.style.display = 'none';
        return;
    }
    
    const transaction = db.transaction(['proveedores'], 'readonly');
    const store = transaction.objectStore('proveedores');
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        const proveedores = event.target.result;
        const select = document.getElementById('proveedorProducto');
        
        select.innerHTML = '<option value="">Seleccione un proveedor (opcional)</option>';
        proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre));

        proveedores.forEach(proveedor => {
            const option = document.createElement('option');
            option.value = proveedor.id;
            option.textContent = proveedor.nombre;
            select.appendChild(option);
        });
        
        const proveedorDiv = document.getElementById('proveedorProductoDiv');
        if (proveedorDiv) proveedorDiv.style.display = 'block';
    };
    
    request.onerror = function(event) {
        console.error('Error al cargar proveedores:', event.target.error);
    };
}

function abrirModalVenta() {
    const modal = new bootstrap.Modal(document.getElementById('modalVenta'));
    modal.show();
}

function agregarProducto() {
    const modal = new bootstrap.Modal(document.getElementById('modalIngreso'));
    modal.show();
    
    try {
        if (db) {
            setTimeout(() => cargarProveedoresParaSelect(), 100);
        }
    } catch (e) {
        console.error("Error al cargar proveedores:", e);
        const proveedorDiv = document.getElementById('proveedorProductoDiv');
        if (proveedorDiv) proveedorDiv.style.display = 'none';
    }
}

function salidaProducto() {
    const modal = new bootstrap.Modal(document.getElementById('modalSalida'));
    modal.show();
}

function registrarVenta() {
    const input = document.getElementById('nombreProductoVenta').value.trim();
    const cantidad = parseInt(document.getElementById('cantidadVenta').value);
    const nombreCliente = document.getElementById('nombreCliente').value;
    const precioVenta = document.getElementById('precioVenta') ? 
                         parseFloat(document.getElementById('precioVenta').value) : 0;

    if (input && cantidad > 0 && nombreCliente) {
        const transaction = db.transaction(['productos', 'clientes', 'facturas'], 'readwrite');
        const productoStore = transaction.objectStore('productos');
        const clienteStore = transaction.objectStore('clientes');
        const facturaStore = transaction.objectStore('facturas');
        const requestProducto = productoStore.getAll();

        requestProducto.onsuccess = function(event) {
            const productos = event.target.result;
            const productoExistente = productos.find(p => p.nombre === input || p.sku === input);

            if (productoExistente) {
                if (productoExistente.cantidad >= cantidad) {
                    productoExistente.cantidad -= cantidad;

                    const precio = precioVenta > 0 ? precioVenta : (productoExistente.precio || 0);

                    if (!productoExistente.historial) productoExistente.historial = [];
                    productoExistente.historial.push({
                        tipo: 'Venta',
                        cantidad,
                        cliente: nombreCliente,
                        precio: precio,
                        fecha: new Date()
                    });

                    if (productoExistente.historial.length > LIMITE_HISTORIAL) {
                        productoExistente.historial.shift();
                    }

                    const updateRequest = productoStore.put(productoExistente);
                    updateRequest.onsuccess = function() {
                        cargarInventarios();
                        console.log('Venta registrada con éxito.');
                        
                        actualizarClientePorVenta(nombreCliente);
                        
                        generarFacturaPendiente(productoExistente, cantidad, nombreCliente, precio);
                    };

                    const modal = bootstrap.Modal.getInstance(document.getElementById('modalVenta'));
                    modal.hide();
                } else {
                    alert('No hay suficiente stock para realizar esta venta.');
                }
            } else {
                alert('Producto no encontrado. Verifica el nombre o SKU.');
            }
        };

        requestProducto.onerror = function() {
            console.error('Error al buscar el producto.');
        };
    } else {
        alert('Por favor complete todos los campos correctamente.');
    }
}

function generarFacturaPendiente(producto, cantidad, nombreCliente, precio) {
    const transaction = db.transaction(['clientes', 'facturas'], 'readwrite');
    const clienteStore = transaction.objectStore('clientes');
    const facturaStore = transaction.objectStore('facturas');
    
    const nombreIndex = clienteStore.index('nombre');
    const clienteRequest = nombreIndex.getAll(nombreCliente);
    
    clienteRequest.onsuccess = function(event) {
        let clienteId = null;
        const clientes = event.target.result;
        
        if (clientes && clientes.length > 0) {
            clienteId = clientes[0].id;
        }
        
        const fecha = new Date();
        const anio = fecha.getFullYear().toString().substr(-2);
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const prefijo = `F${anio}${mes}-`;
        
        const requestFacturas = facturaStore.getAll();
        requestFacturas.onsuccess = function(event) {
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
            const numeroFactura = `${prefijo}${siguienteNumero}`;
            
            const factura = {
                numero: numeroFactura,
                fecha: new Date(),
                clienteId: clienteId,
                clienteNombre: nombreCliente,
                estado: 'pendiente',
                detalles: [{
                    productoId: producto.id,
                    productoNombre: producto.nombre,
                    cantidad: cantidad,
                    precio: precio,
                    subtotal: precio * cantidad
                }],
                total: precio * cantidad,
                notas: `Factura generada automáticamente desde venta en Inventario`,
                origenInventario: true, 
                fechaCreacion: new Date()
            };
            
            const addFacturaRequest = facturaStore.add(factura);
            
            addFacturaRequest.onsuccess = function() {
                console.log('Factura pendiente generada con éxito:', numeroFactura);
                alert(`Se ha generado la factura ${numeroFactura} en estado pendiente.`);
            };
            
            addFacturaRequest.onerror = function(e) {
                console.error('Error al generar factura pendiente:', e);
            };
        };
    };
}

function actualizarClientePorVenta(nombreCliente) {
    const transaction = db.transaction(['clientes'], 'readwrite');
    const store = transaction.objectStore('clientes');
    const index = store.index('nombre');
    const request = index.getKey(nombreCliente);
    
    request.onsuccess = function(event) {
        const clienteId = event.target.result;
        if (clienteId) {
            const getRequest = store.get(clienteId);
            getRequest.onsuccess = function(event) {
                const cliente = event.target.result;
                cliente.ultimaCompra = new Date();
                store.put(cliente);
            };
        } else {
            const nuevoCliente = {
                nombre: nombreCliente,
                ultimaCompra: new Date(),
                fechaCreacion: new Date()
            };
            store.add(nuevoCliente);
        }
    };
}

function registrarIngresoDesdeVenta(producto, cantidad, cliente, precio) {
    try {
        if (!db.objectStoreNames.contains('transacciones')) {
            console.log('El store de transacciones no existe.');
            return;
        }

        const precioUnitario = precio || producto.precio || 10;
        const monto = cantidad * precioUnitario;
        
        const transaccion = {
            tipo: 'ingreso',
            descripcion: `Venta de ${producto.nombre}`,
            categoria: 'Ventas',
            monto: monto,
            fecha: new Date(),
            cliente: cliente,
            notas: `Venta de ${cantidad} unidades a $${precioUnitario.toFixed(2)} c/u`,
            fechaCreacion: new Date()
        };
        
        const transaction = db.transaction(['transacciones'], 'readwrite');
        const store = transaction.objectStore('transacciones');
        store.add(transaccion);
        
        transaction.oncomplete = function() {
            console.log('Transacción financiera registrada con éxito.');
        };
    } catch (e) {
        console.error('Error al registrar transacción financiera:', e);
    }
}

function registrarIngreso() {
    const nombre = document.getElementById('nombreProductoIngreso').value;
    const cantidad = parseInt(document.getElementById('cantidadIngreso').value);
    const precio = parseFloat(document.getElementById('precioProducto').value) || 0;
    const proveedorId = document.getElementById('proveedorProducto') ? 
                        parseInt(document.getElementById('proveedorProducto').value) || null : null;

    if (!nombre || cantidad <= 0) {
        alert("Por favor ingrese un nombre de producto y una cantidad válida.");
        return;
    }

    if (!proveedorId) {
        procesarRegistroDeIngreso(nombre, cantidad, precio, null, null);
        return;
    }

    const transaction = db.transaction(['proveedores'], 'readonly');
    const proveedoresStore = transaction.objectStore('proveedores');
    const proveedorRequest = proveedoresStore.get(proveedorId);
    
    proveedorRequest.onsuccess = function(event) {
        const proveedor = event.target.result;
        if (proveedor) {
            procesarRegistroDeIngreso(nombre, cantidad, precio, proveedorId, proveedor.nombre);
        } else {
            procesarRegistroDeIngreso(nombre, cantidad, precio, proveedorId, null);
        }
    };
    
    proveedorRequest.onerror = function(event) {
        console.error('Error al obtener proveedor:', event.target.error);
        procesarRegistroDeIngreso(nombre, cantidad, precio, null, null);
    };
}

function procesarRegistroDeIngreso(nombre, cantidad, precio, proveedorId, proveedorNombre) {
    const transaction = db.transaction(['productos', 'proveedores'], 'readwrite');
    const store = transaction.objectStore('productos');
    const request = store.getAll();

    request.onsuccess = function(event) {
        const productos = event.target.result;
        const productoExistente = productos.find(p => p.nombre === nombre);
        
        if (proveedorId) {
            const proveedoresStore = transaction.objectStore('proveedores');
            const proveedorRequest = proveedoresStore.get(proveedorId);
            proveedorRequest.onsuccess = function(event) {
                const proveedor = event.target.result;
                if (proveedor) {
                    proveedor.ultimaCompra = new Date();
                    proveedoresStore.put(proveedor);
                }
            };
        }

        if (productoExistente) {
            productoExistente.cantidad += cantidad;
            
            if (precio > 0) {
                productoExistente.precio = precio;
            }
            
            if (proveedorId) {
                productoExistente.proveedorId = proveedorId;
                productoExistente.proveedorNombre = proveedorNombre;
            }
            
            if (!productoExistente.historial) {
                productoExistente.historial = [];
            }
            
            const entradaHistorial = { 
                tipo: 'Entrada', 
                cantidad, 
                precio: precio > 0 ? precio : (productoExistente.precio || 0),  
                fecha: new Date() 
            };
            
            if (proveedorId) {
                entradaHistorial.proveedorId = proveedorId;
                entradaHistorial.proveedorNombre = proveedorNombre;
            }
            
            productoExistente.historial.push(entradaHistorial);

            if (productoExistente.historial.length > LIMITE_HISTORIAL) {
                productoExistente.historial.shift();
            }

            const updateRequest = store.put(productoExistente);
            updateRequest.onsuccess = function() {
                cargarInventarios();
                console.log('Producto actualizado con la entrada.');
            };
        } else {
            const nuevoProducto = {
                sku: generarSKU(),
                nombre,
                cantidad,
                precio: precio || 0,
                historial: [{ 
                    tipo: 'Entrada', 
                    cantidad, 
                    precio,
                    fecha: new Date() 
                }]
            };
            
            if (proveedorId) {
                nuevoProducto.proveedorId = proveedorId;
                nuevoProducto.proveedorNombre = proveedorNombre;
                nuevoProducto.historial[0].proveedorId = proveedorId;
                nuevoProducto.historial[0].proveedorNombre = proveedorNombre;
            }

            const addRequest = store.add(nuevoProducto);
            addRequest.onsuccess = function() {
                cargarInventarios();
                console.log('Producto agregado con entrada y SKU generado.');
            };
        }
    };

    request.onerror = function(error) {
        console.error('Error al buscar productos:', error);
    };

    const modal = bootstrap.Modal.getInstance(document.getElementById('modalIngreso'));
    modal.hide();
}

function registrarSalida() {
    const input = document.getElementById('nombreProductoSalida').value.trim();
    const cantidad = parseInt(document.getElementById('cantidadSalida').value);
    const descripcion = document.getElementById('descripcionSalida').value.trim();

    if (input && cantidad > 0 && descripcion) {
        const transaction = db.transaction(['productos'], 'readwrite');
        const store = transaction.objectStore('productos');
        const request = store.getAll();
        
        request.onsuccess = function(event) {
            const productos = event.target.result;
            const productoExistente = productos.find(p => p.nombre === input || p.sku === input);

            if (productoExistente) {
                if (productoExistente.cantidad >= cantidad) {
                    productoExistente.cantidad -= cantidad;

                    if (!productoExistente.historial) productoExistente.historial = [];
                    productoExistente.historial.push({ 
                        tipo: 'Salida', 
                        cantidad, 
                        descripcion,
                        fecha: new Date()
                    });

                    if (productoExistente.historial.length > LIMITE_HISTORIAL) {
                        productoExistente.historial.shift();
                    }

                    const updateRequest = store.put(productoExistente);
                    updateRequest.onsuccess = function() {
                        cargarInventarios();
                        console.log('Producto actualizado con la salida.');
                        
                        try {
                            if (descripcion.toLowerCase().includes('compra') ||
                                descripcion.toLowerCase().includes('pago') ||
                                descripcion.toLowerCase().includes('gasto')) {
                                registrarGastoSalida(productoExistente, cantidad, descripcion);
                            }
                        } catch (e) {
                            console.log('No se pudo registrar el gasto:', e);
                        }
                    };
                } else {
                    alert('No hay suficiente stock para realizar esta salida.');
                }
            } else {
                alert('Producto no encontrado. Verifica el nombre o SKU.');
            }
        };

        request.onerror = function() {
            console.error('Error al buscar el producto.');
        };

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalSalida'));
        modal.hide();
    } else {
        alert("Por favor ingrese un nombre o SKU del producto, una cantidad válida y una descripción.");
    }
}

function registrarGastoSalida(producto, cantidad, descripcion) {
    try {
        if (!db.objectStoreNames.contains('transacciones')) {
            console.log('El store de transacciones no existe.');
            return;
        }
        
        const costoPorUnidad = 5;
        const monto = cantidad * costoPorUnidad;
        
        const transaccion = {
            tipo: 'gasto',
            descripcion: `Salida de ${producto.nombre}`,
            categoria: 'Suministros',
            monto: monto,
            fecha: new Date(),
            cliente: '',
            notas: descripcion,
            fechaCreacion: new Date()
        };
        
        const transaction = db.transaction(['transacciones'], 'readwrite');
        const store = transaction.objectStore('transacciones');
        store.add(transaccion);
        
        transaction.oncomplete = function() {
            console.log('Gasto registrado con éxito.');
        };
    } catch (e) {
        console.error('Error al registrar gasto:', e);
    }
}
function verHistorialProducto(productoId) {
    const transaction = db.transaction([PRODUCTOS_STORE], 'readonly');
    const store = transaction.objectStore(PRODUCTOS_STORE);
    const request = store.get(productoId);
    
    request.onsuccess = function(event) {
        const producto = event.target.result;
        if (producto && producto.historial) {
            document.getElementById('modalHistorialLabel').textContent = `Historial de ${producto.nombre}`;
            document.querySelector('#tablaHistorialProducto').dataset.historial = JSON.stringify(producto.historial);
            
            cargarHistorialProducto(producto.historial, 1);
            
            const modal = new bootstrap.Modal(document.getElementById('modalHistorialProducto'));
            modal.show();
        }
    };
}

function cargarHistorialProducto(historial, pagina = 1, filtros = {}) {
    const ITEMS_POR_PAGINA = 10;
    let historialFiltrado = Array.isArray(historial) ? [...historial] : [];

    if (filtros.tipo && filtros.tipo !== 'todos') {
        historialFiltrado = historialFiltrado.filter(h => h.tipo === filtros.tipo);
    }
    
    if (filtros.fechaDesde) {
        const fechaDesde = new Date(filtros.fechaDesde);
        historialFiltrado = historialFiltrado.filter(h => new Date(h.fecha) >= fechaDesde);
    }
    
    if (filtros.fechaHasta) {
        const fechaHasta = new Date(filtros.fechaHasta);
        fechaHasta.setHours(23, 59, 59);
        historialFiltrado = historialFiltrado.filter(h => new Date(h.fecha) <= fechaHasta);
    }
    
    historialFiltrado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    const totalRegistros = historialFiltrado.length;
    const totalPaginas = Math.ceil(totalRegistros / ITEMS_POR_PAGINA);
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
    const fin = Math.min(inicio + ITEMS_POR_PAGINA, totalRegistros);
    const historialPaginado = historialFiltrado.slice(inicio, fin);

    const tablaBody = document.querySelector('#tablaHistorialProducto tbody');
    tablaBody.innerHTML = '';
    
    if (historialPaginado.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 5;
        celda.textContent = 'No hay registros en el historial';
        celda.className = 'text-center';
        fila.appendChild(celda);
        tablaBody.appendChild(fila);
    } else {
        historialPaginado.forEach(item => {
            const fila = document.createElement('tr');
            
            const celdaFecha = document.createElement('td');
            celdaFecha.textContent = new Date(item.fecha).toLocaleString();
            fila.appendChild(celdaFecha);
            
            const celdaTipo = document.createElement('td');
            let badgeClass = '';
            
            switch(item.tipo) {
                case 'Entrada':
                    badgeClass = 'bg-success';
                    break;
                case 'Salida':
                    badgeClass = 'bg-warning text-dark';
                    break;
                case 'Venta':
                    badgeClass = 'bg-info';
                    break;
            }
            
            celdaTipo.innerHTML = `<span class="badge ${badgeClass}">${item.tipo}</span>`;
            fila.appendChild(celdaTipo);
            
            const celdaCantidad = document.createElement('td');
            celdaCantidad.textContent = item.cantidad;
            fila.appendChild(celdaCantidad);
            
            const celdaPrecio = document.createElement('td');
            if (item.precio) {
                celdaPrecio.textContent = `$${item.precio.toFixed(2)}`;
            } else {
                celdaPrecio.textContent = '-';
            }
            fila.appendChild(celdaPrecio);
            
            const celdaDetalles = document.createElement('td');
            let detalles = [];

            if (item.proveedorNombre) {
                detalles.push(`Proveedor: ${item.proveedorNombre}`);
            }
            
            if (item.cliente) {
                detalles.push(`Cliente: ${item.cliente}`);
            }
            
            if (item.descripcion) {
                detalles.push(`Descripción: ${item.descripcion}`);
            }
            
            celdaDetalles.textContent = detalles.length > 0 ? detalles.join(' | ') : '-';
            fila.appendChild(celdaDetalles);
            
            tablaBody.appendChild(fila);
        });
    }
    
    document.getElementById('infoHistorialProducto').textContent = 
        `Mostrando ${fin} productos de un total de ${totalRegistros}`;

    mostrarPaginacionHistorial(pagina, totalPaginas, historial, filtros);
}

function mostrarPaginacionHistorial(paginaActual, totalPaginas, historial, filtros) {
    const paginacionDiv = document.getElementById('paginacionHistorialProducto');
    paginacionDiv.innerHTML = '';
    
    if (totalPaginas <= 1) {
        return;
    }
    
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Paginación de historial');
    
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
            cargarHistorialProducto(historial, paginaActual - 1, filtros);
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
            cargarHistorialProducto(historial, i, filtros);
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
            cargarHistorialProducto(historial, paginaActual + 1, filtros);
        });
    }
    liNext.appendChild(aNext);
    ul.appendChild(liNext);
    
    nav.appendChild(ul);
    paginacionDiv.appendChild(nav);
}

function aplicarFiltrosHistorial() {
    const tipoFiltro = document.getElementById('filtroTipoHistorial').value;
    const fechaDesde = document.getElementById('filtroFechaDesdeHistorial').value;
    const fechaHasta = document.getElementById('filtroFechaHastaHistorial').value;
    
    const filtros = {
        tipo: tipoFiltro,
        fechaDesde: fechaDesde,
        fechaHasta: fechaHasta
    };
    
    const historialActual = document.querySelector('#tablaHistorialProducto').dataset.historial;
    if (historialActual) {
        cargarHistorialProducto(JSON.parse(historialActual), 1, filtros);
    }
}

function cargarInventarios(filtro = '', pagina = 1) {
    const ITEMS_POR_PAGINA = 10;
    const transaction = db.transaction(['productos'], 'readonly');
    const store = transaction.objectStore('productos');
    const request = store.getAll();

    request.onsuccess = function(event) {
        const productos = event.target.result;
        console.log('Productos cargados'); 

        let productosFiltrados = [...productos];
        
        if (filtro) {
            filtro = filtro.toLowerCase();
            productosFiltrados = productosFiltrados.filter(producto => 
                producto.nombre.toLowerCase().includes(filtro) || 
                (producto.sku && producto.sku.toLowerCase().includes(filtro))
            );
        }

        productosFiltrados.sort((a, b) => b.id - a.id);
        
        const totalProductos = productosFiltrados.length;
        const totalPaginas = Math.ceil(totalProductos / ITEMS_POR_PAGINA);
        const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
        const fin = Math.min(inicio + ITEMS_POR_PAGINA, totalProductos);
        const productosPaginados = productosFiltrados.slice(inicio, fin);

        const tablaBody = document.querySelector('#tablaInventarios tbody');
        tablaBody.innerHTML = '';

        if (productosPaginados.length === 0) {
            const fila = document.createElement('tr');
            const celda = document.createElement('td');
            celda.colSpan = 8; 
            celda.textContent = 'No hay productos en el inventario';
            celda.className = 'text-center';
            fila.appendChild(celda);
            tablaBody.appendChild(fila);
        }

        productosPaginados.forEach(producto => {
            const fila = document.createElement('tr');
            
            const celdaSku = document.createElement('td');
            celdaSku.textContent = producto.sku || 'No asignado';
            fila.appendChild(celdaSku);

            const celdaCodigoBarras = document.createElement('td');
            const codigoDeBarras = generarCodigoDeBarras(producto.sku);
            celdaCodigoBarras.appendChild(codigoDeBarras);
            fila.appendChild(celdaCodigoBarras);

            const celdaNombre = document.createElement('td');
            celdaNombre.textContent = producto.nombre;
            fila.appendChild(celdaNombre);

            const celdaCantidad = document.createElement('td');
            celdaCantidad.textContent = producto.cantidad;

            if (producto.cantidad < 10) {
                celdaCantidad.className = producto.cantidad < 5 ? 'text-danger fw-bold' : 'text-warning';
            }
            fila.appendChild(celdaCantidad);

            const celdaPrecio = document.createElement('td');
            celdaPrecio.textContent = producto.precio ? `$${producto.precio.toFixed(2)}` : 'No definido';
            celdaPrecio.className = 'text-info';
            fila.appendChild(celdaPrecio);
            
            const celdaProveedor = document.createElement('td');
            celdaProveedor.textContent = producto.proveedorNombre || '-';
            fila.appendChild(celdaProveedor);

            const celdaHistorial = document.createElement('td');
            if (producto.historial && producto.historial.length > 0) {
                const historialLimitado = producto.historial.slice(-3);
            
                const historialTexto = historialLimitado
                    .map(entry => {
                        const fechaFormateada = new Date(entry.fecha).toLocaleString();
                        
                        let detallesTexto = '';
                        
                        if (entry.proveedorNombre) {
                            detallesTexto += ` - Prov: ${entry.proveedorNombre}`;
                        }

                        if (entry.cliente) {
                            detallesTexto += ` - Cliente: ${entry.cliente}`;
                        }
                        
                        if (entry.descripcion) {
                            detallesTexto += ` - Descripción: ${entry.descripcion}`;
                        }
                        
                        if (entry.precio) {
                            detallesTexto += ` - Precio: $${entry.precio.toFixed(2)}`;
                        }
                        
                        return `${entry.tipo}: ${entry.cantidad}${detallesTexto} (${fechaFormateada})`;
                    })
                    .join('<br>');
            
                celdaHistorial.innerHTML = historialTexto;
                
                if (producto.historial.length > 3) {
                    const botonVerMas = document.createElement('button');
                    botonVerMas.className = 'btn btn-sm btn-info mt-2';
                    botonVerMas.innerHTML = `<i class="fas fa-history"></i> Ver historial completo (${producto.historial.length} registros)`;
                    botonVerMas.addEventListener('click', function() {
                        verHistorialProducto(producto.id);
                    });
                    celdaHistorial.appendChild(botonVerMas);
                }
            } else {
                celdaHistorial.textContent = 'No hay historial';
            }
            fila.appendChild(celdaHistorial);

            const celdaAccion = document.createElement('td');
            const botonEliminar = document.createElement('button');
            botonEliminar.classList.add('btn', 'btn-danger', 'btn-sm');
            botonEliminar.innerHTML = '<i class="fas fa-trash-alt"></i> Eliminar';
            botonEliminar.onclick = function() {
                mostrarModalConfirmacion(producto.id);
            };
            celdaAccion.appendChild(botonEliminar);
            fila.appendChild(celdaAccion);

            tablaBody.appendChild(fila);
        });

        const infoResultados = document.getElementById('infoResultadosInventario');
        if (infoResultados) {
            infoResultados.textContent = `Mostrando ${fin} productos de un total de ${totalProductos}`;
        }

        mostrarPaginacionInventario(pagina, totalPaginas, filtro);
    };

    request.onerror = function() {
        console.error('Error al cargar los productos.');
    };
}

function mostrarPaginacionInventario(paginaActual, totalPaginas, filtro = '') {
    const paginacionDiv = document.getElementById('paginacionInventario');
    if (!paginacionDiv) return;
    
    paginacionDiv.innerHTML = '';
    
    if (totalPaginas <= 1) {
        paginacionDiv.style.display = 'none';
        return;
    }
    
    paginacionDiv.style.display = 'block';
    
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navegación de inventario');
    
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
            cargarInventarios(filtro, paginaActual - 1);
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
            cargarInventarios(filtro, i);
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
            cargarInventarios(filtro, paginaActual + 1);
        });
    }
    liNext.appendChild(aNext);
    ul.appendChild(liNext);
    
    nav.appendChild(ul);
    paginacionDiv.appendChild(nav);
}

function buscarProductos() {
    const filtro = document.getElementById('buscarProducto').value.trim();
    cargarInventarios(filtro, 1);
}

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('buscarProducto')) {
        document.getElementById('buscarProducto').addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                buscarProductos();
            }
        });
        document.getElementById('btnBuscarProducto').addEventListener('click', buscarProductos);
    }
});

function exportarHistorialExcel() {
    const historialActual = document.querySelector('#tablaHistorialProducto').dataset.historial;
    const nombreProducto = document.getElementById('modalHistorialLabel').textContent.replace('Historial de ', '');
    
    if (historialActual) {
        const historial = JSON.parse(historialActual);
        const datosExcel = historial.map(item => ({
            'Fecha': new Date(item.fecha).toLocaleString(),
            'Tipo': item.tipo,
            'Cantidad': item.cantidad,
            'Precio': item.precio ? `$${item.precio.toFixed(2)}` : '-',
            'Cliente': item.cliente || '-',
            'Descripción': item.descripcion || '-'
        }));
        
        datosExcel.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));

        const ws = XLSX.utils.json_to_sheet(datosExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Historial");
        
        const wscols = [
            {wch: 20}, // Fecha
            {wch: 10}, // Tipo
            {wch: 10}, // Cantidad
            {wch: 12}, // Precio
            {wch: 20}, // Cliente
            {wch: 40}  // Descripción
        ];
        ws['!cols'] = wscols;
        
        XLSX.writeFile(wb, `Historial_${nombreProducto}_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
}

function mostrarModalConfirmacion(idProducto) {
    const modalHTML = `
        <div class="modal fade" id="modalConfirmacion" tabindex="-1" aria-labelledby="modalConfirmacionLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title" id="modalConfirmacionLabel">Confirmación de Eliminación</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body bg-dark text-white">
                        ¿Estás seguro de que deseas eliminar este producto del inventario?
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-danger" onclick="eliminarProducto(${idProducto})">Eliminar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmacion'));
    modal.show();

    document.getElementById('modalConfirmacion').addEventListener('hidden.bs.modal', function () {
        document.getElementById('modalConfirmacion').remove();
    });
}

function eliminarProducto(id) {
    const transaction = db.transaction(['productos'], 'readwrite');
    const store = transaction.objectStore('productos');
    const request = store.delete(id);

    request.onsuccess = function() {
        console.log('Producto eliminado con éxito');
        cargarInventarios();
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalConfirmacion'));
        modal.hide();
    };

    request.onerror = function(event) {
        console.error('Error al eliminar el producto:', event.target.error);
    };
}

function exportarAExcel() {
    const transaction = db.transaction(['productos'], 'readonly');
    const store = transaction.objectStore('productos');
    const request = store.getAll(); 

    request.onsuccess = function(event) {
        const productos = event.target.result;

        const data = productos.map(producto => {
            const historialLimitado = producto.historial ? producto.historial.slice(-100) : [];
            const historial = historialLimitado
                .map(item => `${item.tipo} (${item.cantidad}) - ${new Date(item.fecha).toLocaleString()}`)
                .join('; ');

            return {
                "SKU": producto.sku || '',
                "Nombre": producto.nombre,
                "Cantidad": producto.cantidad,
                "Historial": historial
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wscols = [{wch: 20}, {wch: 20}, {wch: 10}, {wch: 50}];
        ws['!cols'] = wscols;

        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let row = range.s.r; row <= range.e.r; row++) {
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = { r: row, c: col };
                const cellRef = XLSX.utils.encode_cell(cellAddress);
                const cell = ws[cellRef];

                if (!cell) {
                    ws[cellRef] = {};
                }
                ws[cellRef].s = {
                    border: {
                        top: { style: 'thin' },
                        right: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                    },
                    alignment: { vertical: 'center', horizontal: 'center' },
                    wrapText: true 
                };
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventarios");

        XLSX.writeFile(wb, "inventarios.xlsx");
    };

    request.onerror = function(event) {
        console.error('Error al obtener los productos para exportar:', event.target.error);
    };
}
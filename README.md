# ERP Sistema

Un sistema de gestión empresarial (ERP) simple desarrollado con tecnologías web estándar - HTML, CSS y JavaScript puro. El sistema permite gestionar inventario, clientes, finanzas y proveedores en una única plataforma integrada, sin necesidad de frameworks o librerías externas.

## Características

- **Dashboard**: Resumen visual de estadísticas clave y actividad reciente
- **Inventario**: Gestión de productos, registros de entradas/salidas, ventas y reportes
- **Clientes**: Administración de información de clientes y su historial de compras
- **Finanzas**: Control de ingresos, gastos, facturas y reportes financieros
- **Proveedores**: Gestión de proveedores y pedidos de productos

## Tecnologías utilizadas

- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Almacenamiento**: IndexedDB para persistencia local de datos
- **Diseño**: Bootstrap 5
- **Iconos**: Font Awesome
- **Gráficos**: Chart.js para visualizaciones
- **Exportación**: SheetJS (XLSX) para exportar datos a Excel

## Estructura del proyecto

```
/
├── css/
│   ├── dashboard.css
│   ├── finanzas.css
│   └── style.css
├── js/
│   ├── clientes.js
│   ├── dashboard.js
│   ├── date-utils.js
│   ├── finanzas.js
│   ├── inventario.js
│   └── proveedores.js
├── img/
│   └── favicon.ico
├── index.html        # Dashboard
├── inventario.html
├── clientes.html
├── finanzas.html
└── proveedores.html
```

## Capturas
<div align="center">
  <img src="Captures\1.png" />
  <img src="Captures\2.png" />
  <img src="Captures\3.png" />
</div>

## Módulos principales

### Dashboard

Vista general con estadísticas clave y actividad reciente. Incluye:
- Contador de productos totales
- Ventas totales
- Productos con stock bajo
- Gráfico de movimientos de inventario
- Actividad reciente

### Inventario

Gestión completa del inventario de productos:
- Registro de nuevos productos
- Registro de entradas, salidas y ventas
- Historial de movimientos por producto
- Generación automática de SKU y códigos de barras
- Exportación a Excel

### Clientes

Administración de clientes y sus compras:
- Registro de clientes con datos completos
- Historial de compras por cliente
- Estadísticas de compras (total gastado, productos favoritos)
- Filtros de búsqueda y exportación

### Finanzas

Control financiero completo:
- Registro de ingresos y gastos
- Gestión de facturas a clientes
- Informes financieros y gráficos
- Balance de cuentas

### Proveedores

Gestión de proveedores y pedidos:
- Registro de proveedores
- Creación y seguimiento de pedidos
- Estados de pedido (pendiente, enviado, recibido)
- Historial de compras por proveedor

## Características especiales

### Integración entre módulos

El sistema implementa una integración fluida entre módulos:

- Las ventas registradas en inventario generan automáticamente facturas pendientes en el módulo de finanzas
- Al marcar las facturas como pagadas, se registran los ingresos en el balance financiero
- Las compras a proveedores actualizan automáticamente el inventario cuando se reciben

### Almacenamiento local

Todos los datos se almacenan en IndexedDB del navegador, permitiendo:
- Funcionamiento sin conexión
- No dependencia de servidores externos
- Privacidad de los datos

### Exportación de datos

Posibilidad de exportar a Excel:
- Inventario completo
- Historial de movimientos
- Listas de clientes y proveedores
- Facturas y reportes financieros

## Instalación y uso

1. Descarga los archivos del proyecto
2. Abre el archivo `index.html` en tu navegador web
3. No se requiere instalación adicional ni configuración de servidores

## Compatibilidad

El sistema es compatible con navegadores modernos que soporten:
- JavaScript
- IndexedDB
- CSS3
- Bootstrap 5

## Limitaciones

- Los datos se almacenan localmente en el navegador
- No hay sincronización entre diferentes dispositivos
- No existe autenticación de usuarios
- La capacidad de almacenamiento depende del navegador

## Licencia

Este proyecto tiene licencia MIT.

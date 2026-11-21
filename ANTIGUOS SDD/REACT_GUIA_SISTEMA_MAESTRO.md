# Guía Maestra del Sistema Web DECORM (React 19 + Vite)
## Arquitectura, Módulos Operativos, Motor de Abastecimiento IA y Flujo de Trabajo en Escala

---

## 1. Visión General del Sistema y Filosofía de Diseño UX

El **Sistema Maestro de Inventario, Producción y Abastecimiento Inteligente de GRUPO DECORM** es una plataforma operativa de alta fidelidad diseñada específicamente para resolver la complejidad logística de fabricación de puertas, cancelería de aluminio y herrería arquitectónica en múltiples talleres (**Santa Ana, Sonsonate y Taller Central**).

### Principios de Experiencia de Usuario (UX Design)
- **Claridad de Taller**: En un entorno industrial de carpintería y herrería metálica, los operadores y jefes de bodega necesitan interactuar con una interfaz de alto contraste, tipografía técnica monoespaciada para códigos SKU y botones táctiles o de teclado rápido.
- **Acceso en Un Solo Clic**: Procesos repetitivos como el despacho de insumos a instaladores o el cambio de estado de una puerta en producción no requieren navegación profunda ni modales lentos; cuentan con chips de selección inmediata y selectores integrados en cada tarjeta.
- **Resiliencia Operativa de Doble Capa**: La interfaz se conecta mediante llamadas optimizadas en `text/plain` y `GET` codificado a la Google Apps Script Web App. Si el backend remoto experimenta latencia o se encuentra en una versión previa, la aplicación en React activa motores locales de cálculo que garantizan que el semáforo de riesgo de abastecimiento, el historial de kardex y los filtros funcionen al 100% sin bloquear al usuario con alertas de error.

---

## 2. Mapa Integral de Pantallas y Funcionalidades en React

```
├── 1. Tablero de Control Operativo (DashboardView.jsx)
│     ├── SKUs Activos en Catálogo (128 SKUs clasificados)
│     ├── Valoración de Inventario PMP / Costo Real ($)
│     ├── Total de Compras del Mes con IVA Crédito Fiscal (13%)
│     ├── Gráfico Semanal de Consumo (Lunes a Domingo, Semanas 1 a 4)
│     └── Distribución de Demanda por Taller (Santa Ana, Sonsonate, Central)
│
├── 2. Catálogo Maestro & Kardex (CatalogoView.jsx)
│     ├── Tabla de Artículos con búsqueda reactiva por SKU, descripción y proveedor
│     ├── Generador Automático de Siguiente SKU por Familia (CON, ABR, MET, PIN, etc.)
│     ├── Modal de Edición Completo:
│     │     ├── Datos maestros: Descripción, Categoría, Unidad, Proveedor
│     │     ├── Stock Inicial de Apertura
│     │     ├── Stock Mínimo de Alerta
│     │     └── Conteo Físico Real a Mano en Taller + Fecha de Conteo
│     └── Kardex Cronológico en Vivo:
│           ├── Línea de tiempo de aperturas, compras y salidas
│           ├── Saldo calculado acumulativo
│           └── Panel de Ajuste Rápido: Registro directo de conteo físico o entrada de insumos
│
├── 3. Compras & Facturación Electrónica DTE (ComprasView.jsx)
│     ├── Registro individual y por lote de facturas de compra
│     ├── Parser automático de JSON de DTE (Factura electrónica de El Salvador / Ministerio de Hacienda)
│     ├── Discriminación automática de IVA Crédito Fiscal (13%) y Costo Neto Unitario
│     └── Asignación directa de mercancía recibida a Taller de Destino o Bodega Central
│
├── 4. Movimientos Operativos de Insumos (MovimientosView.jsx)
│     ├── Registro de Salidas a Taller, Devoluciones y Ajustes
│     ├── Buscador predictivo por SKU o palabra clave
│     ├── Acción rápida de "Entregar a Puerta" vinculada a la agenda de producción
│     └── Hoja Oficial de Control Interno y Vale de Entrega:
│           ├── Generación de PDF imprimible y descarga en PNG
│           └── Motor de renderizado vectorial sanitizado contra funciones no estándar (oklch)
│
├── 5. Control de Insumos para Instaladores (InstaladoresView.jsx)
│     ├── Registro Multi-Insumo Ágil en un solo formulario
│     ├── Chips de 1 Clic para insumos frecuentes:
│     │     Thinner, Discos de lija, Lijas P80/P320, Discos de corte 4½",
│     │     Bases, Cerraduras, Haladeras, Tirro y Papel manila
│     ├── Lista dinámica de artículos con cantidades personalizables
│     ├── Verificación por Checkbox de entrega física y devolución
│     └── Motor resiliente con persistencia local y sincronización con movimientos
│
├── 6. Agenda de Puertas en Producción (PuertasView.jsx)
│     ├── Filtro por Taller de Fabricación (Santa Ana, Sonsonate, Taller Central)
│     ├── Filtro por Estado de Producción
│     ├── Tarjetas Industriales con Selector Directo de Estado:
│     │     Por fabricar (Gris) -> En proceso (Naranja) -> En armado (Ámbar)
│     │     -> En pintura (Violeta) -> Listo para entrega (Cian) -> Entregada (Esmeralda)
│     ├── Acordeón Desplegable de Especificaciones Técnicas:
│     │     Medidas exactas, Color/acabado, Tipo de vidrio, Modelo de cerradura,
│     │     Haladera, Chambrana y Notas técnicas de armado
│     └── Modal CRUD completo para los 15 campos de fabricación de la hoja oficial
│
├── 7. Módulo V3.0 de Abastecimiento Inteligente & Forecast Engine (forecast/)
│     ├── 1. Centro de Alertas de Abastecimiento (AlertsCenterView.jsx):
│     │     Semáforo ROJO (Agotado/Crítico), NARANJA (Reorden inminente),
│     │     AMARILLO (Preventiva), VERDE (Estable) y GRIS (Sin consumo).
│     ├── 2. Tablero de Pronóstico (ForecastOverviewView.jsx):
│     │     Tasa diaria de consumo (L), días de cobertura y puntos de reorden (ROP).
│     ├── 3. Simulación de Inventario por SKU (SkuProjectionView.jsx):
│     │     Curva de agotamiento proyectada a 14 días con ROP dinámico.
│     ├── 4. Plan Semanal de Compras Sugeridas (PurchasePlanView.jsx):
│     │     Líneas consolidadas por proveedor, cantidades sugeridas y presupuesto estimado.
│     ├── 5. Anomalías y Observaciones de Consumo (ObservationsView.jsx):
│     │     Detección de consumos atípicos y aprobación supervisada.
│     ├── 6. Aprendizaje Continuo WAPE / MAD (LearningAccuracyView.jsx):
│     │     Métricas de precisión y ajuste predictivo de tasas de consumo.
│     └── 7. Parámetros del Motor de IA (ForecastSettingsView.jsx):
│           Lead times por proveedor, stock de seguridad y pesos algorítmicos.
│
├── 8. Conciliación Física & Seguimiento (ConciliacionView.jsx)
│     ├── Cruce de inventario teórico vs conteo físico en bodega
│     ├── Ajuste de tolerancias (0 unid. estricta a tolerancias personalizadas)
│     └── Mapeo de equivalencias de insumos (ej. cajas a unidades, barras a metros)
│
└── 9. Préstamos de Equipos y Herramientas (PrestamosView.jsx)
      ├── Salidas de maquinaria y herramientas con asignación a custodio
      └── Control de devoluciones parciales y estado de conservación del equipo
```

---

## 3. Análisis Técnico de `DECORM_GROUP.xlsx` y Flujo en Escala

El libro de trabajo oficial `DECORM_GROUP.xlsx` consta de **29 hojas estructuradas** que actúan como la base de datos empresarial central:

| Hoja Clave | Columnas Principales | Función en el Flujo de Trabajo |
| :--- | :--- | :--- |
| `Catalogo` | `SKU`, `Descripción`, `Categoría`, `Stock inicial`, `Entradas`, `Salidas`, `Último conteo físico`, `Fecha conteo`, `STOCK ACTUAL` | Hoja maestra de 128 insumos. La columna 18 (`STOCK ACTUAL`) calcula el saldo mediante fórmula basada en el conteo físico a mano más las transacciones netas post-conteo. |
| `Compras` | `Fecha`, `Proveedor`, `N° DTE`, `SKU`, `Cant. Recibida`, `Precio Neto`, `IVA Crédito 13%`, `Taller Destino` | Registro de compras con discriminación fiscal salvadoreña e integración directa con DTE de Hacienda. |
| `MOVIMIENTOSInsumosOperativo` | `ID`, `Fecha`, `Tipo`, `SKU`, `Cantidad`, `Taller / Destino`, `Entregado A`, `Observaciones` | Bitácora de transacciones operativas. Alimenta el kardex y descuenta existencias en tiempo real. |
| `InsumosInstaladores` | `Código`, `Insumo`, `Cantidad`, `Check`, `Encargado de Instalación`, `Encargado de Bodega` | Registro ágil de insumos entregados a los instaladores para montaje en obra. |
| `AgendaDePuertas` | `SKU Puerta`, `Día Entrega`, `Cliente`, `Modelo`, `Posición`, `Unidades`, `Estado`, `Medidas`, `Color`, `Vidrio`, `Cerradura`, `Haladera`, `Chambrana`, `Notas Técnicas`, `Taller` | Plan de producción de cancelería y puertas por taller. Permite cambio rápido de estado desde las tarjetas. |
| `BOM_Puertas` | `Modelo`, `SKU_Insumo`, `Cantidad_Por_Unidad`, `Unidad_Medida` | Estructura de materiales por modelo de puerta para explosión automática de necesidades. |
| `Forecast_Params` / `Forecast_Config` | `Alpha_Smooth`, `Beta_Trend`, `Lead_Time_Dias`, `Factor_Seguridad` | Parámetros del motor de pronóstico de demanda de insumos. |

### Cómo se asegura la escala sin romper fórmulas:
1. **Separación de Capas**: La API de Apps Script y la aplicación React escriben exclusivamente en las columnas de **entradas de datos (`inputs`)**, respetando las fórmulas existentes en las columnas calculadas de Google Sheets (`computed`).
2. **Conteo Físico Real Directo**: Al auditar físicamente la bodega, el usuario ingresa el valor contado a mano en `Último conteo físico` (Columna 15) y la fecha en `Fecha conteo` (Columna 16), disparando la actualización automática de las fórmulas oficiales de inventario.
3. **Manejo de Transacciones Concurrente**: Las escrituras críticas utilizan `LockService.getScriptLock()` con timeout de 30 segundos, evitando colisiones entre múltiples encargados de taller.

---

## 4. Guía Paso a Paso para Desplegar el Backend Unificado v3.0

Para que la Google Apps Script Web App active nativamente todas las funciones v3.0 (`instaladores.createBatch`, `forecast.alerts`, `forecast.plan`):

1. **Abrir la Hoja de Google Sheets** de GRUPO DECORM.
2. Ir al menú superior: **Extensiones** $\rightarrow$ **Apps Script**.
3. Seleccionar todo el contenido del editor de código (`Ctrl + A`) y reemplazarlo pegando el contenido del archivo:
   [dicorms_backend_unificado_v3.js](file:///c:/Users/ale_d/Downloads/DECORM_MAESTRA/dicorms_backend_unificado_v3.js)
4. Guardar los cambios con `Ctrl + S`.
5. Hacer clic en el botón azul superior **Implementar** $\rightarrow$ **Administrar implementaciones**.
6. Hacer clic en el lápiz de **Editar** sobre la implementación activa.
7. En el desplegable **Versión**, seleccionar **"Nueva versión"** (ejemplo: *v3.0 - Abastecimiento Inteligente, Multi-Insumo y Conteo Físico*).
8. Hacer clic en **Implementar**.
9. ¡Listo! La URL de producción mantendrá el mismo enlace pero responderá de inmediato con la versión 3.0.0.

---

*Desarrollado para GRUPO DECORM · Sistema de Control Operativo e Inteligencia de Abastecimiento.*

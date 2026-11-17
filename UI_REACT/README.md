# DICORMS Web — Panel Web Administrativo (Compras, Kardex y Conciliación)
## GRUPO DECORM · Versión 2.0

Panel web moderno desarrollado en **React 19, Vite y Tailwind CSS v4** para la administración integral de **GRUPO DECORM**. Diseñado para compras, contabilidad, control de kardex y conciliación de inventario con Google Sheets.

---

### 💻 Módulos Incluidos

1. **Tablero de Control (Dashboard Operativo)**:
   - 6 Tarjetas KPI (Total SKUs, Valor Inventario $, Compras Mes $, Salidas, Alertas de Cobertura, Estado de Conciliación).
   - Filtros dinámicos por Clave Mes (`2026-02`), Taller (`Todos`, `Taller 1`, `Taller 2`, `Taller 3`) y Tolerancia de conteo.
   - Gráfico de Consumo Semanal (Lunes a Domingo) mediante Recharts.
   - Gráfico de distribución de demanda por taller.
   - Tabla Top 10 Insumos más consumidos con semáforos de cobertura en semanas (< 2 semanas alerta, agotado).
2. **Catálogo Maestro & Kardex Cronológico**:
   - 128 SKUs organizados por familias (`HER`, `PIN`, `ABR`, `SEL`, `CON`, `EQU`).
   - Generador atómico de nuevos SKUs (`catalogo.nextSku`).
   - Modal de Kardex interactivo que reconstruye Stock Inicial + Compras + Salidas.
3. **Gestión de Compras & Importador DTE de El Salvador**:
   - Registro de compras con cálculo automático de IVA Crédito Fiscal (13% en CCF).
   - **Importador Inteligente de Factura Electrónica (DTE)**: Pega el JSON oficial del Ministerio de Hacienda (CCF `03`, Factura `01`, Sujeto Excluido `14`), extrae proveedor e ítems, y los registra en Sheets con un clic.
4. **Movimientos de Insumos & Entregas a Puertas**:
   - Salidas a talleres y devoluciones.
   - Función especial para entregar material directamente a una puerta de producción (`AgendaDePuertas`).
5. **Conciliación de Inventario (Físico vs. Sistema)**:
   - Tablero con los 128 SKUs clasificados en `CUADRA`, `FALTANTE`, `SOBRANTE` y `SIN CONTEO`.
   - Matriz de Equivalencias (`INS-001` a `INS-021` a SKUs oficiales) con confirmación de factores de desglose.
   - Captura de conteo físico manual de bodega.
6. **Préstamos de Herramientas y Equipos (`EQU-*`)**:
   - Registro y control de devoluciones parciales y totales.
7. **Agenda de Puertas en Producción**:
   - Control de pedidos, especificaciones técnicas y avances por taller.

---

### 🚀 Cómo Ejecutar el Panel Web

#### Requisitos
- Node.js v18+ y pnpm (o npm).

#### En desarrollo:
```bash
cd UI_REACT
pnpm install
pnpm dev
```
Abre en tu navegador la URL indicada (normalmente `http://localhost:5173`).

#### Compilación para producción:
```bash
cd UI_REACT
pnpm run build
```
Los archivos optimizados se generan en la carpeta `dist/`, listos para ser desplegados en cualquier servidor web, Vercel, Netlify o GitHub Pages.

---

### 🌐 Conexión al Backend Google Apps Script
El cliente HTTP en `src/services/api.js` está conectado a:
```
https://script.google.com/macros/s/AKfycbzGraoRcFGLcR4PEVXAJLH16xM_vI5G1YxhDZaRAmiu0DIhCqrIPOj_Rr2xbhs-obDE/exec
```
Credenciales de acceso:
- Usuario: `cristian`
- PIN: `123456`

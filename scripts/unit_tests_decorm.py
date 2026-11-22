import openpyxl
import re
import json
import datetime
import traceback

wb = openpyxl.load_workbook('DECORM_GROUP_v4.xlsx', data_only=True)

test_results = []

def run_test(name, func):
    try:
        res = func()
        test_results.append({'test': name, 'status': 'PASS', 'details': res})
        print(f"✅ PASS: {name}")
    except Exception as e:
        test_results.append({'test': name, 'status': 'FAIL', 'details': str(e), 'trace': traceback.format_exc()})
        print(f"❌ FAIL: {name} -> {e}")

# TEST 1: Catalogo Sheet Structure & SKUs
def test_catalogo_structure():
    assert 'Catalogo' in wb.sheetnames, "Falta hoja Catalogo"
    sh = wb['Catalogo']
    headers = [sh.cell(3, c).value for c in range(1, sh.max_column+1) if sh.cell(3, c).value is not None]
    assert 'SKU' in headers, "Falta columna SKU en fila 3"
    assert 'Descripción' in headers, "Falta columna Descripción en fila 3"
    assert 'Último conteo físico' in headers, "Falta columna Último conteo físico en fila 3"
    assert 'STOCK ACTUAL [Auto]' in headers or 'STOCK ACTUAL' in [h.replace(' [Auto]','') for h in headers], "Falta columna STOCK ACTUAL"
    
    # Count valid SKUs
    skus = []
    for r in range(4, sh.max_row+1):
        v = sh.cell(r, 1).value
        if v and str(v).strip() and not str(v).startswith('TOTAL'):
            skus.append(str(v).strip())
    assert len(skus) >= 120, f"Se esperaban >= 120 SKUs, encontrados: {len(skus)}"
    return f"{len(skus)} SKUs cargados correctamente. Ejemplos: {skus[:5]}"

# TEST 2: Catalogo Physical Count & Editing
def test_catalogo_physical_count_cols():
    sh = wb['Catalogo']
    # Verify col index of Ultimo conteo fisico
    col_conteo = None
    col_fecha = None
    for c in range(1, sh.max_column+1):
        val = str(sh.cell(3, c).value or '')
        if 'Último conteo físico' in val: col_conteo = c
        if 'Fecha conteo' in val: col_fecha = c
    assert col_conteo is not None, "No se encontró columna Último conteo físico"
    assert col_fecha is not None, "No se encontró columna Fecha conteo"
    return f"Columna Último conteo físico={col_conteo}, Fecha conteo={col_fecha}"

# TEST 3: Equivalencias Sheet Header Row & Data
def test_equivalencias_structure():
    assert 'Equivalencias' in wb.sheetnames, "Falta hoja Equivalencias"
    sh = wb['Equivalencias']
    # Check headers at row 3 vs row 4
    h3 = [sh.cell(3, c).value for c in range(1, sh.max_column+1) if sh.cell(3, c).value]
    h4 = [sh.cell(4, c).value for c in range(1, sh.max_column+1) if sh.cell(4, c).value]
    # Verify which row is actual header
    assert any('ID Conteo' in str(x) for x in h3), f"Headers de Equivalencias deben estar en Fila 3, pero se encontró: {h3}"
    return f"Fila 3 contiene encabezados reales: {h3[:4]}"

# TEST 4: Conciliacion Sheet Header Row & Formula Linking
def test_conciliacion_structure():
    assert 'Conciliacion' in wb.sheetnames, "Falta hoja Conciliacion"
    sh = wb['Conciliacion']
    h3 = [sh.cell(3, c).value for c in range(1, sh.max_column+1) if sh.cell(3, c).value]
    assert any('SKU' in str(x) for x in h3), f"Headers de Conciliacion deben estar en Fila 3, se encontró: {h3}"
    # Check rows
    rows_data = []
    for r in range(4, sh.max_row+1):
        sku = sh.cell(r, 1).value
        if sku and str(sku).strip():
            rows_data.append(sku)
    assert len(rows_data) > 0, "No hay filas en Conciliacion"
    return f"Fila 3 es header. Total filas conciliadas: {len(rows_data)}"

# TEST 5: Sheet Inicio & Dashboard KPIs / Alerts
def test_dashboard_inicio():
    assert 'Inicio' in wb.sheetnames, "Falta hoja Inicio"
    sh = wb['Inicio']
    # KPIs in Row 6/7
    kpi_labels = [sh.cell(6, c).value for c in range(1, 15) if sh.cell(6, c).value]
    kpi_vals = [sh.cell(7, c).value for c in range(1, 15) if sh.cell(7, c).value]
    assert len(kpi_labels) >= 4, f"Faltan etiquetas de KPI en Inicio R6: {kpi_labels}"
    
    # Alerts in Rows 29-36
    alert_rows = []
    for r in range(29, 37):
        ctrl = sh.cell(r, 1).value
        hoja = sh.cell(r, 2).value
        casos = sh.cell(r, 3).value
        if ctrl:
            alert_rows.append({'control': ctrl, 'hoja': hoja, 'casos': casos})
    assert len(alert_rows) >= 6, f"Se esperaban >= 6 alertas en Inicio R29-36, halladas: {len(alert_rows)}"
    return f"KPIs: {len(kpi_labels)}, Alertas operativas encontradas: {len(alert_rows)}"

# TEST 6: Compras Sheet
def test_compras_structure():
    assert 'Compras' in wb.sheetnames, "Falta hoja Compras"
    sh = wb['Compras']
    h1 = [sh.cell(1, c).value for c in range(1, sh.max_column+1) if sh.cell(1, c).value]
    assert 'SKU' in h1 and 'Proveedor' in h1, f"Headers de Compras inválidos: {h1[:6]}"
    return f"Compras OK (headers en Fila 1): {h1[:5]}"

# TEST 7: MOVIMIENTOSInsumosOperativo Sheet
def test_movimientos_structure():
    assert 'MOVIMIENTOSInsumosOperativo' in wb.sheetnames, "Falta hoja MOVIMIENTOSInsumosOperativo"
    sh = wb['MOVIMIENTOSInsumosOperativo']
    h1 = [sh.cell(1, c).value for c in range(1, sh.max_column+1) if sh.cell(1, c).value]
    assert 'ID' in h1 and 'SKU' in h1 and 'Cantidad' in h1, f"Headers de Movimientos inválidos: {h1[:6]}"
    return f"Movimientos OK (headers en Fila 1): {h1[:5]}"

# TEST 8: Forecast Engine Sheets & Context
def test_forecast_sheets():
    for fsh in ['Forecast_Params', 'Forecast_Config', 'Forecast_History']:
        assert fsh in wb.sheetnames, f"Falta hoja de Forecast: {fsh}"
    sh_cfg = wb['Forecast_Config']
    assert sh_cfg.max_row > 1, "Forecast_Config está vacío"
    return "Hojas de Forecast presentes y con configuración"

# TEST 9: InsumosInstaladores Sheet
def test_insumos_instaladores():
    assert 'InsumosInstaladores' in wb.sheetnames, "Falta hoja InsumosInstaladores"
    sh = wb['InsumosInstaladores']
    h1 = [sh.cell(1, c).value for c in range(1, sh.max_column+1) if sh.cell(1, c).value]
    assert 'Código SKU' in h1 or 'SKU' in [h.replace('Código ','') for h in h1], f"Headers de InsumosInstaladores: {h1}"
    return f"InsumosInstaladores OK: {h1[:6]}"

# TEST 10: AgendaDePuertas Sheet
def test_agenda_puertas():
    assert 'AgendaDePuertas' in wb.sheetnames, "Falta hoja AgendaDePuertas"
    sh = wb['AgendaDePuertas']
    h1 = [sh.cell(1, c).value for c in range(1, sh.max_column+1) if sh.cell(1, c).value]
    assert 'SKU Puerta' in h1, f"Headers de AgendaDePuertas: {h1}"
    return f"AgendaDePuertas OK: {h1[:6]}"

# Execute all tests
print("================== EJECUTANDO SUITE DE PRUEBAS UNITARIAS ==================")
run_test("1. Estructura de Catálogo y Conteo de SKUs", test_catalogo_structure)
run_test("2. Columnas de Conteo Físico a Mano en Catálogo", test_catalogo_physical_count_cols)
run_test("3. Estructura y Encabezados de Equivalencias", test_equivalencias_structure)
run_test("4. Estructura y Encabezados de Conciliación", test_conciliacion_structure)
run_test("5. Tablero de Control Operativo e Inicio (KPIs y Alertas)", test_dashboard_inicio)
run_test("6. Estructura de Compras", test_compras_structure)
run_test("7. Estructura de Movimientos Operativos", test_movimientos_structure)
run_test("8. Integración con Motor Forecast & Abastecimiento", test_forecast_sheets)
run_test("9. Estructura de Insumos a Instaladores", test_insumos_instaladores)
run_test("10. Estructura de Agenda de Puertas", test_agenda_puertas)

with open('scripts/test_results.json', 'w', encoding='utf-8') as f:
    json.dump(test_results, f, indent=2, ensure_ascii=False)

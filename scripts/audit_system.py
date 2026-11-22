import openpyxl
import re
import json

wb = openpyxl.load_workbook('DECORM_GROUP_v4.xlsx', data_only=True)
with open('dicorms_backend_unificado_v4.js', 'r', encoding='utf-8') as f:
    code = f.read()

def normalize(s):
    if not s: return ''
    s = str(s).lower().strip()
    s = re.sub(r'\[.*?\]', '', s)
    s = re.sub(r'\(.*?\)', '', s)
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

# 1. Check all sheets in Excel
print("================== HOJAS EN WORKBOOK ==================")
print(wb.sheetnames)

# 2. Extract and audit SCHEMA
m = re.search(r'const SCHEMA = \{([\s\S]*?)\n\};', code)
schema_block = m.group(1) if m else ''

entity_regex = re.compile(r'(\w+):\s*\{([^}]+(?:\{[^}]+\}[^}]+)*)\}', re.MULTILINE)
for match in entity_regex.finditer(schema_block):
    ent_name = match.group(1)
    ent_body = match.group(2)
    
    m_sh = re.search(r'sheet:\s*[\x27\x22]([^\x27\x22]+)[\x27\x22]', ent_body)
    m_hrow = re.search(r'headerRow:\s*(\d+)', ent_body)
    m_frow = re.search(r'firstRow:\s*(\d+)', ent_body)
    
    if not m_sh: continue
    sh_name = m_sh.group(1)
    hrow = int(m_hrow.group(1)) if m_hrow else 1
    frow = int(m_frow.group(1)) if m_frow else 2
    
    print(f"\n================ ENTIDAD: {ent_name} (Hoja: '{sh_name}', HeaderRow: {hrow}, FirstRow: {frow}) ================")
    if sh_name not in wb.sheetnames:
        print(f"  ❌ ERROR CRÍTICO: Hoja '{sh_name}' NO existe en DECORM_GROUP_v4.xlsx!")
        continue
    
    sh = wb[sh_name]
    sheet_headers = [str(sh.cell(hrow, c).value or '').strip() for c in range(1, sh.max_column+1)]
    sheet_headers = [h for h in sheet_headers if h]
    sheet_headers_norm = {normalize(h): h for h in sheet_headers}
    
    # Check inputs
    m_inp = re.search(r'inputs:\s*\{([^}]+)\}', ent_body)
    if m_inp:
        for line in m_inp.group(1).splitlines():
            line = line.strip()
            if not line or line.startswith('//'): continue
            kv = line.split(':')
            if len(kv) >= 2:
                k = kv[0].strip()
                v = kv[1].strip().strip("'\"," )
                norm_v = normalize(v)
                if norm_v not in sheet_headers_norm:
                    print(f"  ❌ INPUT NO ENCONTRADO: '{k}': '{v}' en {sh_name} fila {hrow}")
                else:
                    actual = sheet_headers_norm[norm_v]
                    if v != actual:
                        print(f"  ⚠️  INPUT TEXT DIFF: '{k}': SCHEMA tiene '{v}' pero hoja tiene '{actual}'")

    # Check computed
    m_comp = re.search(r'computed:\s*\{([^}]+)\}', ent_body)
    if m_comp:
        for line in m_comp.group(1).splitlines():
            line = line.strip()
            if not line or line.startswith('//'): continue
            kv = line.split(':')
            if len(kv) >= 2:
                k = kv[0].strip()
                v = kv[1].strip().strip("'\"," )
                norm_v = normalize(v)
                if norm_v not in sheet_headers_norm:
                    print(f"  ❌ COMPUTED NO ENCONTRADO: '{k}': '{v}' en {sh_name} fila {hrow}")
                else:
                    actual = sheet_headers_norm[norm_v]
                    if v != actual:
                        print(f"  ⚠️  COMPUTED TEXT DIFF: '{k}': SCHEMA tiene '{v}' pero hoja tiene '{actual}'")

print("\nAUDITORÍA COMPLETA FINALIZADA.")

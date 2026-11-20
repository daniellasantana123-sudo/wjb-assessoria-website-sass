"""Extrai o catálogo de rejeições (código -> mensagem oficial) do Anexo I
da NFS-e Nacional (xlsx público do gov.br/nfse). Só biblioteca padrão.
Uso: python3 -I scripts/wjb-ai/oficial/extrair-rejeicoes.py <anexo_i.xlsx> <saida.json> <id-da-fonte>
"""
import json, re, sys, zipfile, xml.etree.ElementTree as ET

src, out, source_id = sys.argv[1], sys.argv[2], sys.argv[3]
N = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
z = zipfile.ZipFile(src)
ss = [''.join(t.text or '' for t in si.iter(N + 't'))
      for si in ET.fromstring(z.read('xl/sharedStrings.xml')).iter(N + 'si')]
rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
codes = {}
for sh in ET.fromstring(z.read('xl/workbook.xml')).iter(N + 'sheet'):
    name = sh.get('name')
    if not (name.startswith('RN DPS') or name.startswith('RN_RECEPCAO')):
        continue
    root = ET.fromstring(z.read('xl/' + rels[sh.get(R)].lstrip('/').replace('xl/', '')))
    for row in root.iter(N + 'row'):
        vals = []
        for c in row.iter(N + 'c'):
            v = c.find(N + 'v')
            vals.append('' if v is None else (ss[int(v.text)] if c.get('t') == 's' else v.text))
        for k, v in enumerate(vals):
            if re.fullmatch(r'E\d{4}', (v or '').strip()) and k + 1 < len(vals):
                code = v.strip()
                msg = ' '.join((vals[k + 1] or '').split())
                effect = (vals[k - 1] or '').strip() if k > 0 else ''
                if msg and code not in codes:
                    codes[code] = {'message': msg, 'effect': effect, 'sheet': name.strip()}
json.dump({'source': source_id, 'count': len(codes), 'codes': dict(sorted(codes.items()))},
          open(out, 'w'), ensure_ascii=False, indent=0)
print(len(codes), 'códigos')

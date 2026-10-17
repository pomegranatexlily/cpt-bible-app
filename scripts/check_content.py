#!/usr/bin/env python3
"""Fail-closed consistency check for Oustory's Genesis–Isaiah reading data."""
from pathlib import Path
import hashlib,json,re,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'data/manifest.json').read_text())
assert (manifest['books'],manifest['chapters'],manifest['verses'])==(23,745,18947), 'unexpected checkpoint counts'
assert manifest['source_pdf_sha256']=='61e62dd0060e1a7a2d904fcc69b58c5f9e268c7a5fc0431bd05f2826841c7aa5'
js=(ROOT/'cpt-index.js').read_text()
books=json.loads(re.search(r'window\.CPT_BOOKS=(\[.*?\]);',js,re.S).group(1))
assert len(books)==23
assert books[0]['title']=='Genesis' and books[-1]['title']=='Isaiah'
assert set(b['id'] for b in books)==set(manifest['files_sha256']),'book files must match index'
total_chapters=total_verses=colored=0
for meta in books:
 p=ROOT/'data'/f"{meta['id']}.json"
 assert hashlib.sha256(p.read_bytes()).hexdigest()==manifest['files_sha256'][meta['id']],f"checksum changed {p}"
 data=json.loads(p.read_text());assert data['id']==meta['id'] and data['title']==meta['title']
 assert len(data['chapters'])==len(meta['chapters'])
 subcount=0
 for chap,m in zip(data['chapters'],meta['chapters']):
  assert chap['number']==m['number'] and len(chap['verses'])==m['verseCount'],f"{meta['title']} {m['number']}"
  if 'intro' in chap:assert isinstance(chap['intro'],str) and chap['intro'].strip()
  total_chapters+=1
  for k,v in enumerate(chap['verses'],1):
   assert v['number']==k,f"verse gap {meta['title']} {chap['number']}:{k}"
   if 'parts' in v:
    assert 'text' not in v,'duplicated verse text'
    text=''.join(x['text'] for x in v['parts'])
    for part in v['parts']:
     assert part['color'] in {'black','blue','green','purple'} and isinstance(part['text'],str)
     if part['color']!='black':colored+=1
   else:text=v['text']
   assert isinstance(text,str) and text.strip(),f"empty verse {meta['title']} {chap['number']}:{k}"
   subcount+=1
  total_verses+=len(chap['verses'])
 assert subcount==meta['verseCount']
assert (total_chapters,total_verses)==(745,18947)
assert colored>500,'speaker-color import missing'
assert books[-1]['chapters'][-1]['number']==66
html=(ROOT/'index.html').read_text()
assert 'S<span>Books' not in html and '><span>Books</span>' in html, 'Books button markup regressed'
assert '<script src="cpt-index.js"></script>' in html
assert '<script src="oustory-reader.js"></script>' in html
reader=(ROOT/'oustory-reader.js').read_text()
assert 'async function loadBook(id)' in reader
assert 'speaker-blue' in reader and 'speaker-purple' in reader and 'speaker-green' in reader
assert '.scripture .speaker-blue' in html and '.scripture .speaker-purple' in html
for source in ('cpt-index.js','oustory-reader.js'):
 subprocess.run(['node','--check',str(ROOT/source)],check=True,capture_output=True)
inline=re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',html,flags=re.S)
with tempfile.TemporaryDirectory() as temp:
 for i,s in enumerate(inline):
  if s.strip():
   f=Path(temp)/f'script-{i}.js';f.write_text(s)
   subprocess.run(['node','--check',str(f)],check=True,capture_output=True)
print(f'PASS: {len(books)} books, {total_chapters} chapters, {total_verses} consecutive numbered verses, {colored} colored spans; Bible and JS consistency verified.')
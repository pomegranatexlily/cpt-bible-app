import fitz,re,json,hashlib,collections,os
SRC=os.environ.get('CPT_APE_MASTER_PDF','CPT_APE_MASTER_BIBLE.pdf')
OUT=os.environ.get('OUSTORY_EXPORT_DIR','oustory-export')
os.makedirs(OUT+'/data',exist_ok=True)
CANON=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah']
COLOR={0x164c92:'blue',0x194e9b:'blue',0x663399:'purple',0x198754:'green',0x168b55:'green'}
bookmap={x.upper():x for x in CANON}
D=fitz.open(SRC); books=[];current=None;chap=None;verse=None; stats=collections.Counter(); bad=[]
def flush_verse():
 global verse
 if verse is None:return
 # Trim each element, retaining precise word spaces across adjacent colors.
 ps=[x for x in verse.pop('_pieces') if x['text']]
 text=''.join(x['text'] for x in ps).strip()
 text=re.sub(r'\s+',' ',text)
 if not text:bad.append(('blank', current['title'] if current else '?',chap['number'],verse['number']))
 verse['text']=text
 chunks=[]
 for piece in ps:
  if not piece['text']:continue
  c=piece['color']; t=piece['text']
  if chunks and chunks[-1]['color']==c:chunks[-1]['text']+=t
  else:chunks.append({'color':c,'text':t})
 if chunks:
  chunks[0]['text']=chunks[0]['text'].lstrip()
  chunks[-1]['text']=chunks[-1]['text'].rstrip()
 # Ensure normalized concatenation is exactly identical to canonical text
 if re.sub(r'\s+',' ',''.join(p['text'] for p in chunks)).strip()!=text:
  bad.append(('part-mismatch',current['title'],chap['number'],verse['number']))
 if any(p['color']!='black' for p in chunks):verse['parts']=chunks
 chap['verses'].append(verse);verse=None

def new_chapter(title,num):
 global current,chap,verse
 flush_verse()
 if current is None or current['title']!=title:
  if title not in CANON:raise ValueError('Unexpected book '+title)
  if current is not None and CANON.index(title)!=CANON.index(current['title'])+1:raise ValueError('Book sequence '+title)
  current={'id':title.lower().replace(' ','-'),'title':title,'chapters':[]};books.append(current)
 if current['chapters'] and num !=current['chapters'][-1]['number']+1:raise ValueError('Chapter order %s %s'%(title,num))
 chap={'number':num,'verses':[]};current['chapters'].append(chap)

def add_piece(text,color,newline=False):
 if verse is None:
  if chap is None:
   bad.append(('orphan-text',text[:30]));return
  if not text: return
  intro=chap.get('intro','')
  if newline and intro and not intro.endswith((' ','-','\u2010')) and not text.startswith(' '):intro+=' '
  chap['intro']=intro+text
  return
 if not text:return
 v=verse['_pieces']
 if newline and v and not v[-1]['text'].endswith((' ','-','\u2010')) and not text.startswith((' ','.',',',';',':','!', '?','\u2019','\u201d')):v.append({'color':v[-1]['color'],'text':' '})
 c=COLOR.get(color,'black')
 if v and v[-1]['color']==c:v[-1]['text']+=text
 else:v.append({'color':c,'text':text})

for pno,p in enumerate(D):
 blocks=[]
 for b in p.get_text('dict')['blocks']:
  if b.get('type')!=0:continue
  x,y,X,Y=b['bbox']
  if y<45 or y>680:continue
  # block order: left column then right column, top down
  col=0 if x<249 else 1
  blocks.append((col,round(y,4),b))
 for _,_,b in sorted(blocks,key=lambda o:(o[0],o[1])):
  for l in b.get('lines',[]):
   spans=l['spans']
   if not spans:continue
   s0=spans[0]
   # Chapter titles exist as unique full line in bold at 12.8 or 13pt
   if s0['size']>=12.5:
    ht=''.join(s['text'] for s in spans).strip()
    mt=re.fullmatch(r'(.+?)\s+(\d+)',ht)
    if not mt:bad.append(('bad-heading',pno+1,ht));continue
    book=bookmap.get(mt.group(1))
    if not book:raise ValueError('Unexpected heading '+repr(ht))
    new_chapter(book,int(mt.group(2)))
    continue
   # Superscript verse number is an initial small bold span. It must be sequential.
   if s0['size']<7.55 and s0['font'].endswith('Bold') and re.fullmatch(r'\d+',s0['text'].strip()):
    flush_verse()
    if chap is None:bad.append(('orphan-numeral',pno+1,s0['text']));continue
    verse={'number':int(s0['text']),'_pieces':[]}
    rest=spans[1:]
    for s in rest:add_piece(s['text'],s['color'])
   else:
    for i,s in enumerate(spans):add_piece(s['text'],s['color'],newline=(i==0))
flush_verse()
print('BOOKS',len(books),'CHAPTERS',sum(len(b['chapters']) for b in books),'VERSES',sum(len(c['verses']) for b in books for c in b['chapters']))
print('ISSUES',len(bad),bad[:40])
counts={b['title']:{'chapters':len(b['chapters']),'verses':sum(len(c['verses']) for c in b['chapters'])} for b in books}
print(json.dumps(counts,indent=2))
errs=[]
for b in books:
 for c in b['chapters']:
  seq=[v['number'] for v in c['verses']]
  if seq!=list(range(1,len(seq)+1)):errs.append((b['title'],c['number'],len(seq),seq[:10],seq[-10:], [x for x in range(1,max(seq)+1) if x not in seq] if seq else []))
print('SEQUENCE ERRORS:',len(errs),errs[:40]);print('NO-SPEAKER COLORED',collections.Counter(p['color'] for b in books for c in b['chapters'] for v in c['verses'] for p in v.get('parts',[])))
for b in books:
 out=OUT+'/data/'+b['id']+'.json'
 for c in b['chapters']:
  for v in c['verses']:
   if 'parts' in v:del v['text']
 with open(out,'w') as w:json.dump(b,w,ensure_ascii=False,separators=(',',':'))
manifest={'source_pdf_sha256':hashlib.sha256(open(SRC,'rb').read()).hexdigest(),'source_pdf_pages':len(D),'books':len(books),'chapters':sum(len(b['chapters']) for b in books),'verses':sum(len(c['verses']) for b in books for c in b['chapters']),'counts':counts,'issues':bad,'verse_sequence_errors':errs}
with open(OUT+'/manifest.json','w') as f:json.dump(manifest,f,ensure_ascii=False,indent=2)

if len(books)!=23 or sum(len(b['chapters']) for b in books)!=745 or sum(len(c['verses']) for b in books for c in b['chapters'])!=18947 or bad or errs:
 raise SystemExit('Not a verified Genesis–Isaiah checkpoint; export refused')
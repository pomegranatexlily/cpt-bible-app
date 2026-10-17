#!/usr/bin/env python3
"""Make a source-pinned 1611 English verse comparison without editing Scripture."""
import argparse, hashlib, io, json, re, urllib.request, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REV="8ef066868ad1b7204d7be48658ea3bd1783d409b"
URL="https://codeload.github.com/aruljohn/Bible-kjv-1611/zip/"+REV
SPECIAL={"The Wisdom of Solomon":"Wisdom of Solomon","The Song of the Three Holy Children":"Prayer of Azariah","The History of Susanna":"Susanna","The Prayer of Manasses":"Prayer of Manasseh"}
def fetch():
    req=urllib.request.Request(URL,headers={"User-Agent":"Oustory-Research/2.0"})
    with urllib.request.urlopen(req,timeout=120) as r:data=r.read(45000001)
    if len(data)>45000000 or len(data)<100000:raise ValueError("Unexpected source size")
    return data
def normalize(obj):
    chapters={}
    for chapter in obj["chapters"]:
        n=chapter["chapter"]
        if n in chapters:raise ValueError("Duplicate chapter")
        chapters[n]={}
        for v in chapter["verses"]:
            k=v["verse"]
            if k in chapters[n] or not v["text"].strip():raise ValueError("Invalid verse")
            chapters[n][k]=v["text"]
    return chapters
def build(output,raw):
    output.mkdir(parents=True,exist_ok=True)
    data=json.loads((ROOT/"data/manifest.json").read_text())
    index=(ROOT/"cpt-index.js").read_text()
    match=re.search(r"window\.CPT_BOOKS=(\[.*?\]);",index,re.S)
    books=json.loads(match.group(1))
    with zipfile.ZipFile(io.BytesIO(raw)) as zipfile_obj:
        candidates={Path(p).name:zipfile_obj.read(p) for p in zipfile_obj.namelist() if p.count("/")==1 and p.endswith(".json")}
    result=[]
    for b in books:
        path=ROOT/"data"/(b["id"]+".json")
        content=path.read_bytes()
        if hashlib.sha256(content).hexdigest()!=data["files_sha256"][b["id"]]:raise ValueError("Source changed")
        main=json.loads(content)
        filename=SPECIAL.get(b["title"],b["title"])+".json"
        supported=b["title"]!="The Rest of Esther"
        if supported and filename not in candidates:raise ValueError("Missing source "+filename)
        witness=normalize(json.loads(candidates[filename])) if supported else {}
        if b["title"]=="Baruch":witness[6]=normalize(json.loads(candidates["Letter of Jeremiah.json"]))[1]
        own={c["number"]:{v["number"]:v for v in c["verses"]} for c in main["chapters"]}
        positions={str(ch):{str(n):txt for n,txt in vs.items()} for ch,vs in witness.items()}
        common=sum(n in own.get(ch,{}) for ch,vs in witness.items() for n in vs)
        only_kjv=sum(n not in own.get(ch,{}) for ch,vs in witness.items() for n in vs)
        only_main=sum(n not in witness.get(ch,{}) for ch,vs in own.items() for n in vs)
        row={"version":1,"book_id":b["id"],"status":"available" if supported else "unavailable","source_revision":REV,"positions":positions,"matched":common,"kjv_only":only_kjv,"oustory_only":only_main,"source_files":[filename]+(["Letter of Jeremiah.json"] if b["title"]=="Baruch" else []) if supported else []}
        (output/(b["id"]+".json")).write_text(json.dumps(row,ensure_ascii=False,separators=(",",":"))+"\n")
        result.append({k:row[k] for k in ("book_id","status","matched","kjv_only","oustory_only","source_files")})
    meta={"version":1,"source":"English 1611 printed KJV transcription, not ancient Hebrew or Greek manuscript collation","upstream":"https://github.com/aruljohn/Bible-kjv-1611","revision":REV,"sha256":hashlib.sha256(raw).hexdigest(),"books":result}
    (output/"manifest.json").write_text(json.dumps(meta,indent=2)+"\n")
    return meta
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--out",type=Path,required=True);p.add_argument("--archive",type=Path)
    a=p.parse_args()
    m=build(a.out,a.archive.read_bytes() if a.archive else fetch())
    print("Comparison books:",len(m["books"]), "supported",sum(x["status"]=="available" for x in m["books"]))

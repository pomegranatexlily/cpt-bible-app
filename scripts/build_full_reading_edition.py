#!/usr/bin/env python3
"""Assemble editable 80-book Oustory reading edition from pinned source ledgers.

Preserve the independently verified Genesis–Isaiah reader files byte-for-byte.
For the other 57 books use verified WEB JSON witnesses and the fourteen 1611
historical source imports. Apply auditable *provisional* house-word adjustments.
The historical additional books receive a controlled plain-English/orthographic
modernization with each original source witness independently recoverable.
Nothing here is passed off as a completed author-approved CPT–APE translation.
"""
from __future__ import annotations
import collections
import hashlib
import json
from pathlib import Path
import re
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0,str(ROOT/"engine"))
from modern_usfm import load_archive
CATALOG=ROOT/"canon/books.json"
LEDGERS=ROOT/"out"
DATA=ROOT/"data"
CURRENT_SOURCE_SHA="61e62dd0060e1a7a2d904fcc69b58c5f9e268c7a5fc0431bd05f2826841c7aa5"
KNOWN_GAPS={
 "Luke": {"17:36"},
 "Acts": {"8:37","15:34","24:7"},
 "Ecclesiasticus": {"1:7","17:5"},
}
# Prefer substantive manuscript comparison over guesswork; these gaps stay
# visible in the verse navigator instead of being filled with invented words.
ARCHAIC={
 "vnto":"to","vpon":"on","vnder":"under","vntill":"until",
 "vnderstand":"understand","vnderstanding":"understanding",
 "vntoward":"stubborn","haue":"have","hauen":"haven","giue":"give",
 "giuen":"given","giueth":"gives","giuing":"giving","gaue":"gave",
 "liue":"live","liued":"lived","liuing":"living","euery":"every",
 "euer":"ever","euen":"even","neuer":"never","ouer":"over",
 "aboue":"above","loue":"love","loued":"loved","ouercome":"overcome",
 "seruant":"servant","seruants":"servants","serue":"serve",
 "vse":"use","vs":"us","vsed":"used","vseful":"useful",
 "sonne":"son","sonnes":"sons","hee":"he","shee":"she","wee":"we",
 "yee":"you","ye":"you","bee":"be","bene":"been","beene":"been",
 "beeing":"being","doe":"do","doth":"does","doeth":"does",
 "hath":"has","hast":"have","art":"are","shalt":"will",
 "shouldest":"should","wouldest":"would","couldest":"could",
 "mightest":"might","didst":"did","dost":"do","wilt":"will",
 "shew":"show","shewed":"showed","sheweth":"shows",
 "saith":"says","sayth":"says","maketh":"makes","speaketh":"speaks",
 "goeth":"goes","cometh":"comes","knoweth":"knows","taketh":"takes",
 "giveth":"gives","liveth":"lives","beholdeth":"beholds",
 "asketh":"asks","dwelleth":"dwells","seeketh":"seeks",
 "seekest":"seek","knowest":"know","sayest":"say",
 "thou":"you","thee":"you","thy":"your","thine":"your",
 "thyself":"yourself","yourselues":"yourselves",
 "hims​elfe":"himself","himselfe":"himself","selfe":"self",
 "owne":"own","betweene":"between","heauen":"heaven",
 "heauens":"heavens","earthly":"earthly","wisdome":"wisdom",
 "ierusalem":"Jerusalem","iesus":"Jesus","iudas":"Judas",
 "iewes":"Jews","iew":"Jew","iudge":"judge","iudgement":"judgment",
 "iust":"just","iustice":"justice","iustified":"justified",
 "ioseph":"Joseph","iosias":"Josias","iacob":"Jacob",
 "vpon":"on","vnto":"to","citie":"city","cities":"cities",
 "countrey":"country","dayes":"days","wayes":"ways",
 "agayne":"again","againe":"again","downe":"down",
 "feare":"fear","yeare":"year","yeares":"years",
 "glorie":"glory","glorye":"glory","onely":"only",
 "beleeue":"believe","beleeued":"believed","beleue":"believe",
 "receiue":"receive","receiued":"received","prouide":"provide",
 "prouided":"provided","fauour":"favor","sauiour":"savior",
 "saued":"saved","salua​tion":"salvation","saluation":"salvation",
 "brethren":"brothers","wherefore":"therefore","thereof":"of it",
 "therein":"in it","therewith":"with it","wherein":"in which",
 "whoso":"whoever","whosoeuer":"whoever",
 "amongst":"among","among":"among",
 "shal":"shall","shalbe":"shall be","was​t":"were",
 "vnto":"to","minde":"mind","heartes":"hearts","heart":"heart",
 "certaine":"certain","greatnesse":"greatness","goodnesse":"goodness",
 "darkenesse":"darkness","weaknesse":"weakness","kindnesse":"kindness",
 "righteousnesse":"righteousness","faithfulnesse":"faithfulness",
 "vnhappy":"unhappy","vngodly":"ungodly","vncleane":"unclean",
 "vnknowen":"unknown","sinnes":"sins","sinne":"sin",
 "euill":"evil","olde":"old","foure":"four","fiftie":"fifty",
 "seuen":"seven","seuenth":"seventh","twentie":"twenty",
 "eightie":"eighty","sixe":"six","fiue":"five","nine":"nine",
 "booke":"book","bookes":"books","speake":"speak",
 "holinesse":"holiness","holie":"holy","reuenge":"revenge",
 "trueth":"truth","truthe":"truth","vp":"up","vppon":"on",
}
# Scribes' early-modern second-person pronouns are plural/singular nuanced;
# these are readability adjustments, not a claim of literal equivalence.
HOUSE={
 "Yahweh":"Yahawah","LORD":"Yahawah",
 "Israel":"Yahsharala","God":"Alahayam",
}
WORD=re.compile(r"\b[A-Za-z]+\b")
OLD_PRONOUNS={"thou","thee","thy","thine","ye","hath","doth","art","shalt","hast"}

def change_case(original, replacement):
    if original.isupper(): return replacement.upper()
    if original[0].isupper(): return replacement[0].upper()+replacement[1:]
    return replacement

def historical_modernize(text):
    counts=collections.Counter()
    def replace(m):
        raw=m.group(0)
        mapped=ARCHAIC.get(raw.casefold())
        if mapped is None: return raw
        if mapped.casefold()!=raw.casefold():counts[raw.casefold()]+=1
        return change_case(raw,mapped)
    result=WORD.sub(replace,text)
    # Dedicated phrase rule: "thine eye" -> "your eye".
    # No broad automatic vowel swaps are permitted: names can be corrupted.
    return result,counts

def names(text,historical):
    counts=collections.Counter()
    # The 1611 material includes named persons "Iesus son of Sirach", who
    # are *not* Yahawashi; never apply a blanket Jesus->Yahawashi there.
    swaps=dict(HOUSE)
    if not historical:swaps["Jesus"]="Yahawashi"
    def replace(m):
        word=m.group(0)
        v=swaps.get(word)
        if v is None:return word
        counts[word]+=1
        return v
    result=WORD.sub(replace,text)
    return result,counts

def slug(title):
    return re.sub(r"-+","-",re.sub(r"[^a-z0-9]+","-",title.lower())).strip("-")

def old_index():
    raw=(ROOT/"cpt-index.js").read_text(encoding="utf8")
    m=re.search(r"window\.CPT_BOOKS=(\[.*?\]);",raw,re.S)
    if not m:raise ValueError("Reader's original 23-book index missing")
    data=json.loads(m.group(1))
    if len(data)!=23 or data[0]["title"]!="Genesis" or data[-1]["title"]!="Isaiah":
        raise ValueError("Unexpected original CPT edition index")
    return data

def build():
    catalog=json.loads(CATALOG.read_text(encoding="utf8"))
    books=catalog["books"]
    if len(books)!=80 or len({b["title"] for b in books})!=80:
        raise ValueError("80-title directive mismatch")
    current=old_index()
    if [x["title"] for x in current]!=[x["title"] for x in books[:23]]:
        raise ValueError("Canonical Genesis-Isaiah edition order unexpectedly changed")
    previous=json.loads((DATA/"manifest.json").read_text())
    preserved={x["id"]:previous["files_sha256"][x["id"]] for x in current}
    for id,digest in preserved.items():
        actual=hashlib.sha256((DATA/f"{id}.json").read_bytes()).hexdigest()
        if digest!=actual:raise ValueError(f"Existing verified book changed unexpectedly: {id}")
    if previous["source_pdf_sha256"]!=CURRENT_SOURCE_SHA:
        raise ValueError("Original 527-page source provenance mismatch")

    allbooks=list(current)
    bookprovenance=[]
    filesha=dict(preserved)
    changed_counts=collections.Counter()
    total_ch=745
    total_v=18947
    missing=[]
    modernized=0
    modern_hits=0
    traditional_fallbacks=0
    modern,modern_sources,modern_zip_sha=load_archive(LEDGERS/"modern-web-usfm.zip")
    for info in books[23:]:
        title=info["title"]
        historical=not info.get("source_key")
        source=(LEDGERS/("historical-source-ledgers" if historical else "source-ledgers")/
                ((title.lower().replace(" ","_").replace("’","")+".json")
                 if historical else info["source_key"]+".json"))
        if not source.is_file():raise ValueError(f"Missing pinned source: {title} ({source})")
        doc=json.loads(source.read_text(encoding="utf8"))
        if doc["book"]!=title or doc["author_approved"] is not False:
            raise ValueError(f"{title} provenance or approval status changed")
        wanted=KNOWN_GAPS.get(title,set())
        tracked=set(doc.get("documented_source_empty_positions",[])+doc.get("known_source_omissions",[]))
        if tracked!=wanted:raise ValueError(f"{title} witness-omission ledger changed: {tracked} != {wanted}")
        result={"id":slug(title),"title":title,"sourceStatus":"PROVISIONAL_READING_EDIT",
                "sourceType":("WEB_modern_public_domain_USFM_with_historical_fallback" if title in modern else
                              "1611_orthographic_modernization" if historical else "WEB_house_name_adaptation"),
                "chapters":[]}
        for ch,entries in sorted(doc["chapters"].items(),key=lambda x:int(x[0])):
            chap={"number":int(ch),"verses":[]}
            nums=sorted(int(x) for x in entries)
            first=4 if title=="The Rest of Esther" and ch=="10" else 1
            if nums[0]!=first:raise ValueError(f"{title} {ch} starts at unexpected verse")
            for n in range(first, nums[-1]+1):
                key=f"{ch}:{n}"
                if n not in nums:
                    if key not in wanted:raise ValueError(f"Untracked missing verse: {title} {key}")
                    missing.append({"book":title,"reference":key,"note":"Source-witness position omitted; not a blank invented verse"})
                    continue
                text=entries[str(n)]
                if historical:
                    modern_text=modern.get(title,{}).get(ch,{}).get(str(n))
                    if modern_text:
                        text=modern_text
                        modern_hits+=1
                    else:
                        text,hist_counts=historical_modernize(text)
                        changed_counts.update(hist_counts)
                        traditional_fallbacks+=1
                    modernized+=1
                text, namecounts=names(text,historical)
                changed_counts.update({f"house:{k}":v for k,v in namecounts.items()})
                if not text.strip() or any(x in text for x in ("\x00","\ufffd")):
                    raise ValueError(f"Corrupt verse: {title} {key}")
                chap["verses"].append({"number":n,"text":text})
                total_v+=1
            if len(chap["verses"])!=len(entries):
                raise ValueError(f"{title} {ch} count changed")
            result["chapters"].append(chap)
            total_ch+=1
        book_id=result["id"]
        if book_id in filesha:raise ValueError(f"Duplicate slug {book_id}")
        payload=json.dumps(result,ensure_ascii=False,separators=(",",":"))+"\n"
        file=DATA/f"{book_id}.json"
        file.write_text(payload,encoding="utf8")
        filesha[book_id]=hashlib.sha256(file.read_bytes()).hexdigest()
        chaptermeta=[{"number":c["number"],"verseCount":len(c["verses"]),
                      "firstVerse":c["verses"][0]["number"],
                      "lastVerse":c["verses"][-1]["number"]} for c in result["chapters"]]
        allbooks.append({"id":book_id,"title":title,"chapters":chaptermeta,
                         "verseCount":sum(len(c["verses"]) for c in result["chapters"]),
                         "sourceStatus":result["sourceStatus"]})
        bookprovenance.append({"title":title,"id":book_id,"source_type":result["sourceType"],
                               "source_sha256":doc.get("source_sha256"),
                               "source_url":doc["source_url"],
                               "source_provenance":doc.get("source_provenance"),
                               "modern_secondary_witness":modern_sources.get(title),
                               "chapters":len(chaptermeta),
                               "verses":allbooks[-1]["verseCount"],"author_approved":False})
    if len(allbooks)!=80 or len(bookprovenance)!=57 or total_ch!=1362 or total_v!=36801:
        raise ValueError(f"Unexpected 80-book counts: {len(allbooks)}, {total_ch}, {total_v}")
    if len(missing)!=6:raise ValueError(f"Expected 6 documented omitted verse positions; found {missing}")
    if modern_hits<3500 or modern_hits+traditional_fallbacks!=5703:
        raise ValueError(f"Insufficient modern additional-book coverage: modern={modern_hits}, fallback={traditional_fallbacks}")

    (ROOT/"cpt-index.js").write_text(
       "// Oustory CPT–APE 80-book editable reading edition; Genesis–Isaiah verified master; other 57 books provisional source adaptations.\n"
       +"window.CPT_BOOKS="+json.dumps(allbooks,ensure_ascii=False,separators=(",",":"))+";\n",
       encoding="utf8")
    release={"schema_version":2,"status":"COMPLETE_80_BOOK_EDITABLE_READING_EDITION_NOT_FINAL_TRANSLATION",
       "source_pdf_sha256":CURRENT_SOURCE_SHA,"scope":"80-title working canonical sequence",
       "books":80,"chapters":total_ch,"verses":total_v,
       "verified_seed_books":23,"candidate_source_books":57,"historic_additional_books":14,
       "historical_verses_with_readability_adaptation":modernized,
       "historical_verses_using_modern_WEB_witness":modern_hits,
       "historical_1611_fallback_verses":traditional_fallbacks,
       "web_modern_archive_sha256":modern_zip_sha,
       "historical_modernization_status":"PROVISIONAL_MODERN_WITNESS_SELECTION_NOT_FINAL_TRANSLATION",
       "colors":"PRESERVE_SEED_ONLY_REVIEW_PENDING_NEW_BOOKS_BLACK",
       "missing_source_positions":missing,"files_sha256":filesha,
       "historical_word_replacements":dict(changed_counts.most_common()),
       "new_book_provenance":bookprovenance,
       "no_authorial_approval_claimed":True,
       "generated_utc":datetime.now(timezone.utc).isoformat()}
    (DATA/"manifest.json").write_text(json.dumps(release,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    print(f"FULL READING EDITION: {len(allbooks)} books {total_ch} chapters {total_v} source verses; {modern_hits} modern WEB verses; {traditional_fallbacks} traditional 1611 fallback verses; {len(missing)} honest source omissions",flush=True)
    return release

if __name__=="__main__":build()

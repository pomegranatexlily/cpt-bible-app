/* Oustory privacy/security contract — static, dependency-free release gate. */
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const get=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const html=get("index.html"),privacy=get("privacy.html"),menu=get("oustory-branding.js");
const data=get("oustory-release4.js"),sw=get("sw.js"),calendar=get("oustory-calendar.js");
assert.match(html,/<meta name="referrer" content="no-referrer">/);
assert.match(html,/<meta http-equiv="Content-Security-Policy"/);
const csp=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
assert(csp,"Missing HTML security policy");
for(const directive of ["default-src 'self'","script-src 'self'","object-src 'none'",
 "base-uri 'none'","connect-src 'self'","font-src 'self'","form-action 'self'"]){
 assert(csp.includes(directive),"Missing CSP restriction: "+directive);
}
assert.doesNotMatch(html,/https:\/\/raw\.githubusercontent\.com/,"Font should not be fetched from a separate repository");
assert.doesNotMatch(html,/<script[^>]+src=["'](?:https?:)?\/\//i,"No remote script execution");
assert.match(menu,/Privacy & data/);
assert.match(menu,/\.\/privacy\.html/);
assert.match(data,/const KEYS=\[/);
assert.match(data,/function deleteSaved\(/);
assert.match(data,/KEYS\.filter\(key=>localStorage\.getItem\(key\)!==null\)/);
assert.match(data,/localStorage\.removeItem\(key\)/);
assert.doesNotMatch(data,/localStorage\.clear\(/);
assert.match(data,/Delete saved study data/);
assert.match(data,/if\(!confirm\("Permanently delete/);
assert.match(data,/location\.reload\(\)/);
assert.match(sw,/".\/privacy\.html"/,"Privacy page must be available in offline shell");
assert.match(sw,/const SHELL="oustory-shell-r18-privacy-20261019"/);
assert.match(privacy,/<h1>Privacy &amp; data<\/h1>/);
for(const term of ["personal verse notes","saved data","GitHub Pages",
 "Shabbat Calendar","IP address","no advertising trackers","Importing a backup",
 "Oustory GitHub issues page"]){
 assert(privacy.includes(term),"Privacy notice missing: "+term);
}
assert.match(calendar,/shabbat-calendar\/calendar\.json/);
for(const file of ["privacy.html","oustory-release4.js","oustory-branding.js"])
 assert(existsSync(new URL("../"+file,import.meta.url)),file+" is missing");
console.log("PASS Oustory privacy notice, CSP, external asset minimization, offline notice, selective deletion and UX contract.");

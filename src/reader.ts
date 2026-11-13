import './reader.css';
import { getDocument, GlobalWorkerOptions, TextLayer, Util, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { fetchPdf, MAX_PDF_BYTES } from './lib/document';
import type { ReadingPosition, ReadingSelection } from './lib/reading-loop';
import { fingerprintPdf, resolveAnchor, type PdfAnchor, type NormalizedRect } from './lib/anchors';

GlobalWorkerOptions.workerSrc = workerUrl;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const pagesRoot = $('pages');
const sessionId = new URLSearchParams(location.search).get('session') || '';
interface ReaderInit { sessionId: string; documentId: string; sourceUrl: string | null; title?: string; anchor?: PdfAnchor; position?: ReadingPosition; bytes?: number[] }
interface PageState { page: PDFPageProxy; element: HTMLElement; text?: string; segments?: {start:number;end:number;rect:NormalizedRect}[]; domRuns?: {start:number;end:number;element:HTMLElement}[]; rendered: boolean; rendering?: Promise<void>; epoch: number }
let init: ReaderInit | null = null;
let windowId: number | undefined;
let pdf: PDFDocumentProxy | null = null;
let documentId = '';
let pages: PageState[] = [];
let scale = 1.2;
let rotation = 0;
let fit = true;
let epoch = 0;
let currentPage = 1;
let pendingAnchor: PdfAnchor | undefined;
let selection: ReadingSelection | null = null;
let selectionPosition: ReadingPosition | null = null;
const returnStack: ReadingPosition[] = [];
let observer: IntersectionObserver | null = null;
let highlightTimer = 0;
let scrollTimer = 0;
let searchEpoch = 0;
let navigationEpoch = 0;
let searchResults: {page:number;quote:string;prefix:string;suffix:string}[] = [];
let searchIndex = -1;
function status(text: string, error = false) { $('status').textContent = text; $('status').classList.toggle('error',error); }
function send(message: object): Promise<any> { return chrome.runtime.sendMessage({ ...message, sessionId }); }
function position(): ReadingPosition { return { pageNumber: currentPage, scrollTop: window.scrollY, scrollLeft: window.scrollX, scale, rotation }; }
function saveReturn() { returnStack.push(position()); if(returnStack.length>20)returnStack.shift(); $('returnPosition').removeAttribute('disabled'); }
function hideSelection() { $('selectionActions').hidden=true; }
function updatePageNumber() {
  const target = 110;
  const found = pages.findIndex(p => p.element.getBoundingClientRect().bottom > target);
  if(found>=0) currentPage=found+1;
  $('pageNumber').setAttribute('max',String(pdf?.numPages || 1));
  ($('pageNumber') as HTMLInputElement).value=String(currentPage);
}
function sizePages() {
  for (const p of pages) {
    const viewport=p.page.getViewport({scale,rotation:(p.page.rotate+rotation)%360});
    p.element.style.width=`${viewport.width}px`;p.element.style.height=`${viewport.height}px`;
    p.element.style.setProperty('--scale-factor',String(scale));
    p.element.style.setProperty('--total-scale-factor',String(scale*p.page.userUnit));
  }
}
async function extract(p:PageState) {
  if(p.text!==undefined)return;
  const content=await p.page.getTextContent();
  const viewport=p.page.getViewport({scale:1,rotation:0});
  let text=''; const segments: {start:number;end:number;rect:NormalizedRect}[]=[];
  for(const item of content.items){
    if(!('str' in item))continue;
    const start=text.length; text+=item.str;
    const m=Util.transform(viewport.transform,item.transform);
    const height=Math.hypot(m[2],m[3]);
    // Rotated/skewed runs are searchable, but are not claimed as exact geometry.
    if(item.str && Math.abs(m[1])<.01 && Math.abs(m[2])<.01 && height>0 && item.width>0){
      segments.push({start,end:text.length,rect:[m[4]/viewport.width,(m[5]-height)/viewport.height,item.width*p.page.userUnit/viewport.width,height/viewport.height]});
    }
    text+=item.hasEOL?'\n':' ';
  }
  p.text=text;p.segments=segments;
}
async function renderPage(p:PageState):Promise<void>{
  if(p.rendered)return; if(p.rendering)return p.rendering;
  const thisEpoch=epoch; p.epoch=thisEpoch;
  p.rendering=(async()=>{
    const viewport=p.page.getViewport({scale,rotation:(p.page.rotate+rotation)%360});
    const canvas=document.createElement('canvas');
    // Limit giant canvases while retaining high-DPI output on normal pages.
    const ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(16_000_000/(viewport.width*viewport.height)));
    canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.setAttribute('aria-hidden','true');
    const context=canvas.getContext('2d');if(!context)throw new Error('无法创建 PDF 画布。');
    await p.page.render({canvas,canvasContext:context,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]}).promise;
    if(thisEpoch!==epoch)return;
    const layer=document.createElement('div');layer.className='textLayer';
    layer.style.setProperty('--scale-factor',String(scale));layer.style.setProperty('--total-scale-factor',String(scale*p.page.userUnit));
    p.element.replaceChildren(canvas,layer);
    const textContent=await p.page.getTextContent();
    const textLayer=new TextLayer({textContentSource:textContent,container:layer,viewport});await textLayer.render();
    let offset=0,index=0;p.domRuns=[];
    for(const item of textContent.items){if(!('str' in item))continue;const element=textLayer.textDivs[index++];if(element?.textContent===item.str)p.domRuns.push({start:offset,end:offset+item.str.length,element});offset+=item.str.length+1;}
    if(thisEpoch!==epoch)return;
    await extract(p);
    const annotations=await p.page.getAnnotations();
    for(const item of annotations){
      if(item.subtype!=='Link'||!item.rect)continue;
      const rect=viewport.convertToViewportRectangle(item.rect); const a=document.createElement('a');a.className='pdf-link';a.setAttribute('aria-label',item.url?'打开 PDF 中的链接':'跳转 PDF 内部引用');
      Object.assign(a.style,{left:`${Math.min(rect[0],rect[2])}px`,top:`${Math.min(rect[1],rect[3])}px`,width:`${Math.abs(rect[2]-rect[0])}px`,height:`${Math.abs(rect[3]-rect[1])}px`});
      if(item.url){try{const u=new URL(item.url);if(!['https:','http:'].includes(u.protocol))continue;a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';}catch{continue;}}
      else if(item.dest){a.href='#';a.onclick=e=>{e.preventDefault();void goDestination(item.dest);};}else continue;
      p.element.append(a);
    }
    if(thisEpoch===epoch)p.rendered=true;
  })().catch(e=>status(e instanceof Error?e.message:'页面绘制失败，可重新打开原来源。',true)).finally(()=>{p.rendering=undefined;});
  return p.rendering;
}
async function goDestination(dest:unknown){
  if(!pdf)return;
  try{const d=typeof dest==='string'?await pdf.getDestination(dest):dest;if(!Array.isArray(d))return;
    const n=typeof d[0]==='number'?d[0]:await pdf.getPageIndex(d[0]);saveReturn();await goPage(n+1);
  }catch{status('此 PDF 内部链接无法解析。',true);}
}
function watchPages(){
  observer?.disconnect();
  observer=new IntersectionObserver(entries=>{for(const entry of entries){const p=pages[Number((entry.target as HTMLElement).dataset.page)-1];if(entry.isIntersecting)void renderPage(p);else if(p.rendered&&Math.abs(p.page.pageNumber-currentPage)>4&&!window.getSelection()?.toString()){p.element.replaceChildren();p.rendered=false;}}},{rootMargin:'1000px 0px'});
  pages.forEach(p=>observer!.observe(p.element));
}
async function goPage(n:number,request?:number):Promise<boolean>{
  if(!pdf||!Number.isInteger(n)||n<1||n>pdf.numPages){status('页码超出 PDF 物理页范围。',true);return false;}
  const p=pages[n-1];await renderPage(p);if(!p.rendered||(request!==undefined&&request!==navigationEpoch))return false;p.element.scrollIntoView({block:'start'});window.scrollBy(0,-90);currentPage=n;updatePageNumber();return true;
}
function clearHighlights(){document.querySelectorAll('.highlight').forEach(el=>el.remove());window.clearTimeout(highlightTimer);}
function showRects(p:PageState,rects:NormalizedRect[]){
  clearHighlights();
  const normal=p.page.getViewport({scale:1,rotation:0});const viewport=p.page.getViewport({scale,rotation:(p.page.rotate+rotation)%360});
  for(const [x,y,w,h]of rects){
    const [x1,y1]=normal.convertToPdfPoint(x*normal.width,y*normal.height);const [x2,y2]=normal.convertToPdfPoint((x+w)*normal.width,(y+h)*normal.height);
    const r=viewport.convertToViewportRectangle([x1,y1,x2,y2]);const el=document.createElement('div');el.className='highlight';
    Object.assign(el.style,{left:`${Math.min(r[0],r[2])}px`,top:`${Math.min(r[1],r[3])}px`,width:`${Math.abs(r[2]-r[0])}px`,height:`${Math.abs(r[3]-r[1])}px`});p.element.append(el);
  }
  const first=p.element.querySelector('.highlight');first?.scrollIntoView({block:'center'});highlightTimer=window.setTimeout(clearHighlights,6000);
}
function exactRects(p:PageState,offsets:[number,number]):NormalizedRect[]{
  const normal=p.page.getViewport({scale:1,rotation:0});const viewport=p.page.getViewport({scale,rotation:(p.page.rotate+rotation)%360});
  const box=p.element.getBoundingClientRect();const rects:NormalizedRect[]=[];
  const runs=p.domRuns||[];
  for(let i=offsets[0];i<offsets[1];i++){if(!/\s/u.test(p.text?.[i]||'')&&!runs.some(r=>r.start<=i&&r.end>i))return [];}
  for(const run of runs){
    const start=Math.max(offsets[0],run.start)-run.start,end=Math.min(offsets[1],run.end)-run.start;
    const node=run.element.firstChild;if(start>=end)continue;if(!node||node.nodeType!==Node.TEXT_NODE||run.element.textContent!==p.text?.slice(run.start,run.end))return [];
    const range=document.createRange();range.setStart(node,start);range.setEnd(node,end);
    const clientRects=Array.from(range.getClientRects()).filter(r=>r.width>0&&r.height>0);
    if(!clientRects.length&&p.text?.slice(run.start+start,run.start+end).trim())return [];
    for(const r of clientRects){
      if(!r.width||!r.height)continue;
      const a=viewport.convertToPdfPoint(r.left-box.left,r.top-box.top);const b=viewport.convertToPdfPoint(r.right-box.left,r.bottom-box.top);
      const c=normal.convertToViewportPoint(a[0],a[1]),d=normal.convertToViewportPoint(b[0],b[1]);
      rects.push([Math.max(0,Math.min(c[0],d[0])/normal.width),Math.max(0,Math.min(c[1],d[1])/normal.height),Math.abs(c[0]-d[0])/normal.width,Math.abs(c[1]-d[1])/normal.height]);
    }
  }
  return rects;
}
async function navigate(anchor:PdfAnchor){
  const request=++navigationEpoch;
  if(!pdf){pendingAnchor=anchor;return;}
  if(!anchor||anchor.sessionId!==sessionId||anchor.documentId!==documentId){status('来源身份不一致，已阻止跳转。请重新打开对应论文。',true);return;}
  const p=pages[anchor.pageNumber-1];if(!p){status('此页码不在 PDF 中，未执行跳转。',true);return;}
  await extract(p);if(request!==navigationEpoch)return;const result=resolveAnchor(anchor,{sessionId,documentId,totalPages:pdf.numPages,pageNumber:anchor.pageNumber,text:p.text!,segments:p.segments!});
  if(result.level==='C'){status(result.reason,true);return;}
  saveReturn();if(!await goPage(anchor.pageNumber,request)||request!==navigationEpoch)return;const rects=result.level==='A'&&result.textOffsets?exactRects(p,result.textOffsets):[];if(rects.length)showRects(p,rects);
  status(rects.length?`PDF 第 ${anchor.pageNumber} 页 · 已定位原文`:`PDF 第 ${anchor.pageNumber} 页 · 页面级定位，未定位具体段落`);
}
async function rescale(next:number,nextRotation=rotation){
  if(!pdf)return;const before=pages[currentPage-1];const fraction=before?(window.scrollY-before.element.offsetTop)/before.element.offsetHeight:0;
  scale=Math.min(3.5,Math.max(.35,next));rotation=nextRotation;epoch++;clearHighlights();hideSelection();
  await Promise.all(pages.map(p=>p.rendering));for(const p of pages){p.rendered=false;p.element.replaceChildren();}
  sizePages();watchPages();const target=pages[currentPage-1];if(target){await renderPage(target);window.scrollTo(0,target.element.offsetTop+fraction*target.element.offsetHeight);}
  $('fitWidth').textContent=fit?'适合宽度':`${Math.round(scale*100)}%`;
}
function fitScale(){const p=pages[currentPage-1]?.page;if(!p)return 1;return Math.min(3.5,(document.documentElement.clientWidth-40)/p.getViewport({scale:1,rotation:(p.rotate+rotation)%360}).width);}
async function restorePosition(p:ReadingPosition){fit=false;currentPage=p.pageNumber;await rescale(p.scale,p.rotation);window.scrollTo(p.scrollLeft,p.scrollTop);updatePageNumber();}
async function outline(){
  if(!pdf)return;const root=$('outline');root.replaceChildren();const items=await pdf.getOutline();if(!items?.length){root.textContent='此 PDF 没有内置目录。';return;}
  const add=(list:typeof items,depth=0)=>{for(const item of list){const b=document.createElement('button');b.textContent=item.title;b.style.paddingLeft=`${8+depth*12}px`;b.onclick=()=>void goDestination(item.dest);root.append(b);if(item.items?.length)add(item.items,depth+1);}};add(items);
}
async function load(bytes:ArrayBuffer){
  if(bytes.byteLength>MAX_PDF_BYTES)throw new Error('PDF 超过 25 MiB 限制。');
  const actual=await fingerprintPdf(bytes);
  if(init?.documentId&&actual!==init.documentId)throw new Error('PDF 内容与当前阅读会话不一致。请返回侧栏重新载入论文，避免错误引用。');
  documentId=actual;epoch++;observer?.disconnect();await pdf?.destroy();
  pdf=await getDocument({data:new Uint8Array(bytes)}).promise;pages=[];pagesRoot.replaceChildren();
  for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n);const element=document.createElement('section');element.className='pdf-page';element.dataset.page=String(n);element.setAttribute('aria-label',`PDF 第 ${n} 页`);
    pagesRoot.append(element);pages.push({page,element,rendered:false,epoch});
  }
  $('pageCount').textContent=String(pdf.numPages);scale=fitScale();sizePages();watchPages();await renderPage(pages[0]);
  status(`${pdf.numPages} 页 · 选择文字后可问 / 译（Alt+Q 聚焦）；普通阅读不会调用 AI。`);
  await send({type:'reader-loaded',documentId}).catch(()=>undefined);
  if(init?.position)await restorePosition(init.position);
  const anchor=pendingAnchor||init?.anchor;pendingAnchor=undefined;if(anchor)await navigate(anchor);
}
function captureSelection(){
  const s=window.getSelection();if(!s||s.isCollapsed||!s.rangeCount){hideSelection();return;}
  const range=s.getRangeAt(0);const first=(range.startContainer.parentElement?.closest('.pdf-page') as HTMLElement|null);const last=(range.endContainer.parentElement?.closest('.pdf-page') as HTMLElement|null);
  if(!first||!last){hideSelection();return;}
  const text=s.toString().trim();if(text.length<2){hideSelection();return;}if(text.length>6000){status('选段超过 6,000 字，请缩短选区。');hideSelection();return;}
  const start=Number(first.dataset.page),end=Number(last.dataset.page);
  if(pages.slice(start-1,end).some(p=>!p.rendered)){status('跨页选区包含尚未绘制的页面，请逐段选择以避免漏文。');hideSelection();return;}
  selection={sessionId,documentId,text,pageStart:start,pageEnd:end,at:Date.now(),anchor:{sessionId,documentId,pageNumber:start,exactQuote:start===end?text:undefined,verification:start===end?'quote-verified':'page-only'}};
  selectionPosition=position();const r=range.getBoundingClientRect();const bar=$('selectionActions');bar.hidden=false;
  bar.style.left=`${Math.max(8,Math.min(window.innerWidth-120,r.left))}px`;bar.style.top=`${Math.max(60,Math.min(window.innerHeight-48,r.bottom+8))}px`;
}
async function selectionAction(action:'ask'|'translate'){
  if(!selection)return;const payload=selection;hideSelection();
  // Keep the user gesture synchronous for Chrome's Side Panel API.
  if(windowId!==undefined)void chrome.sidePanel.open({windowId}).catch(()=>undefined);
  try{const result=await send({type:'reader-selection',documentId,action,selection:payload,position:selectionPosition});status(result?.error|| (action==='ask'?'选段已送到侧栏草稿；编辑问题后再发送。':'已向侧栏提交选段翻译。'));}catch{status('无法连接侧栏，请打开 PaperPeek 后重试。',true);}
}
async function search(){
  const token=++searchEpoch;const query=($('findText') as HTMLInputElement).value.trim();searchResults=[];searchIndex=-1;if(!query||!pdf){$('findCount').textContent='';return;}
  $('findCount').textContent='搜索中…';
  for(const p of pages){await extract(p);if(token!==searchEpoch)return;const text=p.text!;let at=0;while((at=text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase(),at))>=0){searchResults.push({page:p.page.pageNumber,quote:text.slice(at,at+query.length),prefix:text.slice(Math.max(0,at-50),at),suffix:text.slice(at+query.length,at+query.length+50)});at+=query.length;if(searchResults.length>=1000)break;}if(searchResults.length>=1000)break;}
  $('findCount').textContent=searchResults.length?`${searchResults.length} 处`:'无匹配';if(searchResults.length)await searchMove(1);
}
async function searchMove(delta:number){if(!searchResults.length)return;searchIndex=(searchIndex+delta+searchResults.length)%searchResults.length;const r=searchResults[searchIndex];await navigate({sessionId,documentId,pageNumber:r.page,exactQuote:r.quote,prefix:r.prefix,suffix:r.suffix,verification:'quote-verified'});$('findCount').textContent=`${searchIndex+1} / ${searchResults.length}`;}
function toggleFind(open:boolean){$('findBar').hidden=!open;$('findToggle').setAttribute('aria-expanded',String(open));if(open)$('findText').focus();else $('findToggle').focus();}
$('previous').onclick=()=>void goPage(currentPage-1);$('next').onclick=()=>void goPage(currentPage+1);
$('pageNumber').onkeydown=e=>{if(e.key==='Enter')void goPage(Number(($('pageNumber') as HTMLInputElement).value));};
$('pageNumber').onchange=()=>void goPage(Number(($('pageNumber') as HTMLInputElement).value));
$('zoomIn').onclick=()=>{fit=false;void rescale(scale*1.2);};$('zoomOut').onclick=()=>{fit=false;void rescale(scale/1.2);};$('fitWidth').onclick=()=>{fit=true;void rescale(fitScale());};
$('rotate').onclick=()=>{fit=false;void rescale(scale,(rotation+90)%360);};
$('returnPosition').onclick=()=>{const p=returnStack.pop();if(p)void restorePosition(p);if(!returnStack.length)$('returnPosition').setAttribute('disabled','');clearHighlights();status('已返回刚才阅读处。');};
$('outlineToggle').onclick=()=>{$('outline').hidden=!$('outline').hidden;if(!$('outline').hidden)void outline();};
$('source').onclick=()=>{if(!init?.sourceUrl){status('本地 PDF 没有可重开的网址，请选择原文件。');return;}try{const u=new URL(init.sourceUrl);if(['https:','file:'].includes(u.protocol))void chrome.tabs.create({url:u.href});}catch{}};
$('chooseFile').onclick=()=>($('fileInput') as HTMLInputElement).click();$('fileInput').onchange=()=>{const file=($('fileInput') as HTMLInputElement).files?.[0];if(file)void file.arrayBuffer().then(load).catch(e=>status(e.message,true));};
$('askSelection').onclick=()=>void selectionAction('ask');$('translateSelection').onclick=()=>void selectionAction('translate');
$('selectionActions').onpointerdown=e=>e.preventDefault();
$('findToggle').onclick=()=>toggleFind($('findBar').hidden);$('findClose').onclick=()=>toggleFind(false);$('findNext').onclick=()=>void searchMove(1);$('findPrevious').onclick=()=>void searchMove(-1);
let findTimer=0;$('findText').oninput=()=>{window.clearTimeout(findTimer);findTimer=window.setTimeout(()=>void search(),250);};
document.addEventListener('pointerup',e=>{if(!(e.target as HTMLElement).closest('#selectionActions'))window.setTimeout(captureSelection,0);});
document.addEventListener('keyup',e=>{if(e.key==='Shift'||e.key.startsWith('Arrow'))captureSelection();});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='f'){e.preventDefault();toggleFind(true);}if(e.key==='Escape'){hideSelection();clearHighlights();$('outline').hidden=true;if(!$('findBar').hidden)toggleFind(false);}if(e.altKey&&e.key.toLowerCase()==='q'){captureSelection();if(!$('selectionActions').hidden){e.preventDefault();$('askSelection').focus();}}});
window.addEventListener('scroll',()=>{hideSelection();updatePageNumber();window.clearTimeout(scrollTimer);scrollTimer=window.setTimeout(()=>{if(documentId)void send({type:'reader-position',documentId,position:position()}).catch(()=>undefined);},250);},{passive:true});
let resizeTimer=0;window.addEventListener('resize',()=>{window.clearTimeout(resizeTimer);resizeTimer=window.setTimeout(()=>{if(fit)void rescale(fitScale());},200);});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('')))return;if(message?.sessionId!==sessionId)return;if(message.type==='reader-navigate'){void navigate(message.anchor).then(()=>respond({ok:true}));return true;}if(message.type==='reader-return'){const p=message.position||returnStack.pop();if(p)void restorePosition(p);respond({ok:true});}});
async function boot(){
  if(!sessionId)throw new Error('阅读会话缺失。请从 PaperPeek 侧栏重新打开阅读器。');
  windowId=(await chrome.tabs.getCurrent())?.windowId;
  init=await send({type:'reader-ready'});if(!init||init.sessionId!==sessionId)throw new Error('阅读会话已失效。请返回原网页并重新打开阅读器。');
  document.title=init.title?`${init.title} · PaperPeek`:'PaperPeek 阅读器';
  let bytes:ArrayBuffer;
  if(init.bytes)bytes=new Uint8Array(init.bytes).buffer;
  else if(init.sourceUrl)bytes=await fetchPdf(init.sourceUrl);
  else {const transfer=await send({type:'reader-bytes',documentId:init.documentId});if(!transfer?.base64)throw new Error('本地 PDF 字节已不可用。已有分析仍保留，请点击“更多 → 重新选择 PDF”并选择同一文件。');const raw=atob(transfer.base64);bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)).buffer;}
  await load(bytes);
}
void boot().catch(e=>status(`${e.message} 可通过“更多”打开原来源或重新选择 PDF。`,true));

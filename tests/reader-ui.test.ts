// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const html=readFileSync(resolve(process.cwd(),'reader.html'),'utf8');
const mocks=vi.hoisted(()=>({fingerprint:vi.fn(async()=> 'sha256:fixture'),fetchPdf:vi.fn(async()=>new ArrayBuffer(8)),getDocument:vi.fn(),listeners:[] as Function[],send:vi.fn(),open:vi.fn(async()=>undefined)}));
vi.mock('../src/lib/document',()=>({fetchPdf:mocks.fetchPdf,MAX_PDF_BYTES:25*1024*1024}));
vi.mock('../src/lib/anchors',async importOriginal=>({...await importOriginal<object>(),fingerprintPdf:mocks.fingerprint}));
vi.mock('pdfjs-dist',()=>({
  GlobalWorkerOptions:{},Util:{transform:(_a:number[],b:number[])=>b},getDocument:mocks.getDocument,
  TextLayer:class{ textDivs:HTMLElement[]=[]; constructor(private options:any){} async render(){for(const item of this.options.textContentSource.items){const el=document.createElement('span');el.textContent=item.str;this.options.container.append(el);this.textDivs.push(el);}}}
}));
const init={sessionId:'session-a',documentId:'sha256:fixture',sourceUrl:'https://example.org/a.pdf'};
const byId=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
async function settle(){for(let i=0;i<20;i++)await new Promise(r=>setTimeout(r,0));}
function page(n:number){return {pageNumber:n,rotate:0,userUnit:1,getViewport:({scale}:any)=>({width:600*scale,height:800*scale,transform:[1,0,0,1,0,0],convertToPdfPoint:(x:number,y:number)=>[x,y],convertToViewportPoint:(x:number,y:number)=>[x,y],convertToViewportRectangle:(r:number[])=>r}),render:()=>({promise:Promise.resolve()}),getTextContent:async()=>({items:[{str:`Evidence on page ${n}.`,hasEOL:true,transform:[1,0,0,12,10,25],width:100}]}),getAnnotations:async()=>[]};}
beforeEach(()=>{
  vi.resetModules();vi.clearAllMocks();mocks.listeners.length=0;
  document.documentElement.innerHTML=html;window.history.replaceState({},'', '/reader.html?session=session-a');
  vi.stubGlobal('IntersectionObserver',class{observe(){}disconnect(){}});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({} as any);
  HTMLElement.prototype.scrollIntoView=vi.fn();window.scrollBy=vi.fn();window.scrollTo=vi.fn();
  mocks.fingerprint.mockResolvedValue('sha256:fixture');mocks.fetchPdf.mockResolvedValue(new ArrayBuffer(8));
  mocks.getDocument.mockReturnValue({promise:Promise.resolve({numPages:3,getPage:async(n:number)=>page(n),destroy:async()=>undefined,getOutline:async()=>null})});
  mocks.send.mockImplementation(async(m:any)=>m.type==='reader-ready'?{...init}:{});
  vi.stubGlobal('chrome',{runtime:{id:'test-extension',getURL:(p:string)=>'chrome-extension://test-extension/'+p,sendMessage:mocks.send,onMessage:{addListener:(f:Function)=>mocks.listeners.push(f)}},tabs:{getCurrent:async()=>({id:12,windowId:1}),create:vi.fn()},sidePanel:{open:mocks.open}});
});
describe('Reader UI (PDF canvas and Chrome mocked; not browser acceptance)',()=>{
  it('opens only requested document and provides three physical page surfaces without AI events',async()=>{
    await import('../src/reader');await settle();
    expect(document.querySelectorAll('.pdf-page')).toHaveLength(3);expect(byId('pageCount').textContent).toBe('3');
    expect(mocks.send.mock.calls.every(([m])=>!['reader-selection','translate-selection'].includes(m.type))).toBe(true);
    expect(mocks.fetchPdf).toHaveBeenCalledWith(init.sourceUrl);
  });
  it('rejects changed file content before rendering any page',async()=>{
    mocks.fingerprint.mockResolvedValue('sha256:different');await import('../src/reader');await settle();
    expect(byId('status').textContent).toContain('内容与当前阅读会话不一致');expect(document.querySelectorAll('.pdf-page')).toHaveLength(0);expect(mocks.getDocument).not.toHaveBeenCalled();
  });
  it('explains expired local bytes without erasing analysis or inventing a source',async()=>{
    mocks.send.mockImplementation(async(m:any)=>m.type==='reader-ready'?{...init,sourceUrl:null}:{});await import('../src/reader');await settle();
    expect(byId('status').textContent).toContain('本地 PDF 字节已不可用');expect(mocks.fetchPdf).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith({type:'reader-bytes',sessionId:'session-a',documentId:'sha256:fixture'});
  });
  it('keeps page-only citations unhighlighted and makes Return available',async()=>{
    await import('../src/reader');await settle();
    mocks.listeners[0]({type:'reader-navigate',sessionId:'session-a',anchor:{sessionId:'session-a',documentId:'sha256:fixture',pageNumber:2,verification:'model-hint'}},{id:'test-extension',url:'chrome-extension://test-extension/background.js'},()=>{});await settle();
    expect(byId('status').textContent).toContain('页面级定位');expect(document.querySelectorAll('.highlight')).toHaveLength(0);expect(byId<HTMLButtonElement>('returnPosition').disabled).toBe(false);
  });
  it('blocks cross-document navigation and supports Enter in physical page field',async()=>{
    await import('../src/reader');await settle();
    mocks.listeners[0]({type:'reader-navigate',sessionId:'session-a',anchor:{sessionId:'session-a',documentId:'sha256:other',pageNumber:2,verification:'page-only'}},{id:'test-extension',url:'chrome-extension://test-extension/background.js'},()=>{});await settle();
    expect(byId('status').textContent).toContain('来源身份不一致');
    const field=byId<HTMLInputElement>('pageNumber');field.value='3';field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));await settle();expect(document.querySelector('[data-page="3"] canvas')).not.toBeNull();
  });
  it('continues initial navigation if optional reader-loaded notification has no receiver',async()=>{
    mocks.send.mockImplementation(async(m:any)=>{if(m.type==='reader-ready')return {...init,anchor:{sessionId:'session-a',documentId:'sha256:fixture',pageNumber:2,verification:'model-hint'}};if(m.type==='reader-loaded')throw new Error('no receiver');return {};});await import('../src/reader');await settle();
    expect(byId('status').textContent).toContain('PDF 第 2 页');expect(byId('status').classList.contains('error')).toBe(false);
  });
  it('selection Ask emits an editable-draft event only and keeps the source text',async()=>{
    await import('../src/reader');await settle();
    const span=document.querySelector('.textLayer span')!;const range=document.createRange();range.selectNodeContents(span);
    window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);
    document.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift'}));
    expect(byId('selectionActions').hidden).toBe(false);byId('askSelection').click();await settle();
    const request=mocks.send.mock.calls.map(([m])=>m).find(m=>m.type==='reader-selection');
    expect(request.action).toBe('ask');expect(request.selection.text).toBe('Evidence on page 1.');expect(request.selection.documentId).toBe(init.documentId);
    expect(span.textContent).toBe('Evidence on page 1.');expect(mocks.open).toHaveBeenCalled();
  });

});

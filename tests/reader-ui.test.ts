// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const html=readFileSync(resolve(process.cwd(),'reader.html'),'utf8');
const mocks=vi.hoisted(()=>({fingerprint:vi.fn(async()=> 'sha256:fixture'),fetchPdf:vi.fn(async()=>new ArrayBuffer(8)),getDocument:vi.fn(),render:vi.fn((_options?:any)=>({promise:Promise.resolve()})),listeners:[] as Function[],storageListeners:[] as Function[],send:vi.fn(),open:vi.fn(async()=>undefined),generate:vi.fn(async(_req:any,_fetcher?:any)=> 'A local explanation.'),data:{} as Record<string,unknown>}));
vi.mock('../src/lib/provider',()=>({generateText:(req:any,fetcher?:any)=>mocks.generate(req,fetcher)}));
vi.mock('../src/lib/storage',()=>({loadCredentials:vi.fn(async()=>({provider:'openai',model:'gpt-4.1-mini',apiKey:'dummy-test-only',rememberKey:false}))}));
vi.mock('../src/lib/document',()=>({fetchPdf:mocks.fetchPdf,MAX_PDF_BYTES:25*1024*1024}));
vi.mock('../src/lib/anchors',async importOriginal=>({...await importOriginal<object>(),fingerprintPdf:mocks.fingerprint}));
vi.mock('pdfjs-dist',()=>({
  GlobalWorkerOptions:{},Util:{transform:(_a:number[],b:number[])=>b},getDocument:mocks.getDocument,
  TextLayer:class{ textDivs:HTMLElement[]=[]; constructor(private options:any){} async render(){for(const item of this.options.textContentSource.items){const el=document.createElement('span');el.textContent=item.str;this.options.container.append(el);this.textDivs.push(el);}}}
}));
const init={sessionId:'session-a',documentId:'sha256:fixture',sourceUrl:'https://example.org/a.pdf'};
const byId=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
async function settle(){for(let i=0;i<20;i++)await new Promise(r=>setTimeout(r,0));}
function page(n:number){return {pageNumber:n,rotate:0,userUnit:1,getViewport:({scale}:any)=>({width:600*scale,height:800*scale,transform:[1,0,0,1,0,0],convertToPdfPoint:(x:number,y:number)=>[x,y],convertToViewportPoint:(x:number,y:number)=>[x,y],convertToViewportRectangle:(r:number[])=>r}),render:(options:any)=>mocks.render(options),getTextContent:async()=>({items:[{str:`Evidence on page ${n}.`,hasEOL:true,transform:[1,0,0,12,10,25],width:100}]}),getAnnotations:async()=>[]};}
beforeEach(()=>{
  vi.resetModules();vi.clearAllMocks();mocks.listeners.length=0;mocks.storageListeners.length=0;mocks.data={};mocks.generate.mockResolvedValue('A local explanation.');mocks.render.mockImplementation(()=>({promise:Promise.resolve()}));
  document.documentElement.innerHTML=html;window.history.replaceState({},'', '/reader.html?session=session-a');
  vi.stubGlobal('IntersectionObserver',class{observe(){}disconnect(){}});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({} as any);
  HTMLElement.prototype.scrollIntoView=vi.fn();window.scrollBy=vi.fn();window.scrollTo=vi.fn();
  mocks.fingerprint.mockResolvedValue('sha256:fixture');mocks.fetchPdf.mockResolvedValue(new ArrayBuffer(8));
  mocks.getDocument.mockReturnValue({promise:Promise.resolve({numPages:3,getPage:async(n:number)=>page(n),destroy:async()=>undefined,getOutline:async()=>null})});
  mocks.send.mockImplementation(async(m:any)=>m.type==='reader-ready'?{...init}:{});
  vi.stubGlobal('chrome',{storage:{onChanged:{addListener:(f:Function)=>mocks.storageListeners.push(f)},local:{get:vi.fn(async(key:string|null)=>key?{[key]:mocks.data[key]}:{...mocks.data}),set:vi.fn(async(values:Record<string,unknown>)=>Object.assign(mocks.data,values)),remove:vi.fn(async(keys:string|string[])=>{for(const key of typeof keys==='string'?[keys]:keys)delete mocks.data[key];})}},runtime:{id:'test-extension',getURL:(p:string)=>'chrome-extension://test-extension/'+p,sendMessage:mocks.send,onMessage:{addListener:(f:Function)=>mocks.listeners.push(f)}},tabs:{getCurrent:async()=>({id:12,windowId:1}),create:vi.fn()},sidePanel:{open:mocks.open}});
});
function selectFirst(){const span=document.querySelector('.textLayer span')!;const range=document.createRange();range.selectNodeContents(span);window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);document.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift'}));}
// happy-dom's WheelEvent currently omits inherited MouseEvent modifier/coordinate fields.
function wheel(init:WheelEventInit){const event=new WheelEvent('wheel',init);Object.defineProperties(event,{ctrlKey:{value:init.ctrlKey??false},clientX:{value:init.clientX??0},clientY:{value:init.clientY??0}});return event;}
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
  it('opens local Ask without model calls and cites the selection separately',async()=>{
    await import('../src/reader');await settle();selectFirst();
    expect(byId('selectionActions').hidden).toBe(false);byId('askSelection').click();await settle();
    expect(byId('localPanel').hidden).toBe(false);expect(byId('localQuote').textContent).toBe('Evidence on page 1.');
    expect(mocks.generate).not.toHaveBeenCalled();expect(mocks.send.mock.calls.some(([m])=>m.type==='reader-selection')).toBe(false);
    byId('localCite').click();await settle();
    const request=mocks.send.mock.calls.map(([m])=>m).find(m=>m.type==='reader-selection');
    expect(request.action).toBe('cite');expect(request.selection.text).toBe('Evidence on page 1.');expect(mocks.open).toHaveBeenCalled();
  });
  it('saves local questions, closes without deletion and reopens via page marker',async()=>{
    await import('../src/reader');await settle();selectFirst();byId('askSelection').click();await settle();
    byId<HTMLTextAreaElement>('localQuestion').value='What does this mean?';byId('localForm').dispatchEvent(new Event('submit',{cancelable:true}));await settle();
    expect(mocks.generate).toHaveBeenCalledTimes(1);expect(byId('localMessages').textContent).toContain('A local explanation.');
    expect(mocks.generate.mock.calls[0][0].prompt).toContain('What does this mean?');
    expect(Object.keys(mocks.data).filter(k=>k.startsWith('paperpeek.annotation.v1.'))).toHaveLength(1);
    byId('localClose').click();expect(byId('localPanel').hidden).toBe(true);document.querySelector<HTMLButtonElement>('.discussion-marker')!.click();expect(byId('localPanel').hidden).toBe(false);
    window.confirm=vi.fn(()=>true);byId('localDelete').click();await settle();
    expect(document.querySelector('.discussion-marker')).toBeNull();expect(byId('discussionCount').textContent).toBe('0');
    expect(Object.keys(mocks.data).filter(k=>k.startsWith('paperpeek.annotation.v1.'))).toHaveLength(0);
  });
  it('translation stays transient until explicitly saved and does not enter main chat',async()=>{
    await import('../src/reader');await settle();selectFirst();byId('translateSelection').click();await settle();
    expect(mocks.generate).toHaveBeenCalledTimes(1);expect(byId('localSave').hidden).toBe(false);
    expect(Object.keys(mocks.data).filter(k=>k.startsWith('paperpeek.annotation.v1.'))).toHaveLength(0);
    expect(mocks.send.mock.calls.some(([m])=>m.type==='reader-selection')).toBe(false);
    byId('localSave').click();await settle();expect(byId('localSave').hidden).toBe(true);expect(byId('discussionCount').textContent).toBe('1');
  });
  it('respects the modifier trigger and still offers keyboard focus access',async()=>{
    mocks.data['paperpeek.readerSettings.v1']={trigger:'alt',openMode:'new-tab',navOpen:false,navWidth:260};
    await import('../src/reader');await settle();selectFirst();expect(byId('selectionActions').hidden).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift',altKey:true}));expect(byId('selectionActions').hidden).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('exposes navigation directly and offers page-grouped discussions without an outline',async()=>{
    await import('../src/reader');await settle();expect(byId('outlineToggle').closest('.more')).toBeNull();byId('outlineToggle').click();
    expect(byId('navigation').hidden).toBe(false);expect(byId('outline').textContent).toContain('没有内置目录');
    byId('discussionsTab').click();expect(byId('discussions').hidden).toBe(false);expect(byId('outline').hidden).toBe(true);
  });

  it('retains unsent local drafts when closing and reselecting the same text',async()=>{
    await import('../src/reader');await settle();selectFirst();byId('askSelection').click();
    byId<HTMLTextAreaElement>('localQuestion').value='Draft question';byId('localClose').click();selectFirst();byId('askSelection').click();
    expect(byId<HTMLTextAreaElement>('localQuestion').value).toBe('Draft question');expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('does not call the provider when question persistence fails',async()=>{
    await import('../src/reader');await settle();selectFirst();byId('askSelection').click();
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('quota exceeded'));
    byId<HTMLTextAreaElement>('localQuestion').value='Why?';byId('localForm').dispatchEvent(new Event('submit',{cancelable:true}));await settle();
    expect(mocks.generate).not.toHaveBeenCalled();expect(byId('localStatus').textContent).toContain('未能保存');expect(byId('localRetry').hidden).toBe(false);
  });
  it('does not resurrect a discussion deleted in another reader while generating',async()=>{
    let finish!:(answer:string)=>void;mocks.generate.mockImplementation(()=>new Promise(r=>{finish=r;}));
    await import('../src/reader');await settle();selectFirst();byId('askSelection').click();
    byId<HTMLTextAreaElement>('localQuestion').value='Why?';byId('localForm').dispatchEvent(new Event('submit',{cancelable:true}));await settle();
    const key=Object.keys(mocks.data).find(k=>k.startsWith('paperpeek.annotation.v1.'))!;const old=mocks.data[key];delete mocks.data[key];
    mocks.storageListeners[0]({[key]:{oldValue:old}},'local');await settle();finish('Late answer');await settle();
    expect(mocks.data[key]).toBeUndefined();expect(byId('localPanel').hidden).toBe(true);expect(byId('discussionCount').textContent).toBe('0');
  });
  it('keeps a closed generation closed until explicitly reopened',async()=>{
    let finish!:(answer:string)=>void;mocks.generate.mockImplementation(()=>new Promise(r=>{finish=r;}));
    await import('../src/reader');await settle();selectFirst();byId('askSelection').click();
    byId<HTMLTextAreaElement>('localQuestion').value='Why?';byId('localForm').dispatchEvent(new Event('submit',{cancelable:true}));await settle();
    byId('localClose').click();finish('Completed while closed');await settle();expect(byId('localPanel').hidden).toBe(true);
    document.querySelector<HTMLButtonElement>('.discussion-marker')!.click();expect(byId('localMessages').textContent).toContain('Completed while closed');
  });
  it('reserves generation before asynchronous persistence so rapid submits send once',async()=>{
    await import('../src/reader');await settle();selectFirst();byId('askSelection').click();
    let save!:(value:unknown)=>void;vi.mocked(chrome.storage.local.set).mockImplementationOnce(values=>new Promise(r=>{save=()=>{Object.assign(mocks.data,values);r(undefined);};}));
    byId<HTMLTextAreaElement>('localQuestion').value='Why?';byId('localForm').dispatchEvent(new Event('submit',{cancelable:true}));
    byId<HTMLTextAreaElement>('localQuestion').value='Duplicate';byId('localForm').dispatchEvent(new Event('submit',{cancelable:true}));
    expect(byId<HTMLButtonElement>('localSend').disabled).toBe(true);await vi.waitFor(()=>expect(save).toBeTypeOf('function'));save(undefined);await settle();expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate.mock.calls[0][0].prompt).not.toContain('Duplicate');
  });
  it('restores saved discussions across sessions and allows retry of an interrupted request',async()=>{
    const {saveAnnotation}=await import('../src/lib/annotations');
    // Use direct storage seed because the Chrome mock is installed before each test.
    await saveAnnotation({id:'saved-thread',documentId:init.documentId,kind:'ask',createdAt:1,updatedAt:1,messages:[{role:'user',text:'Interrupted question'}],selection:{sessionId:'old-session',documentId:init.documentId,text:'Evidence on page 1.',pageStart:1,pageEnd:1,at:1,anchor:{sessionId:'old-session',documentId:init.documentId,pageNumber:1,exactQuote:'Evidence on page 1.',verification:'quote-verified'}}});
    await import('../src/reader');await settle();document.querySelector<HTMLButtonElement>('.discussion-marker')!.click();expect(byId('localRetry').hidden).toBe(false);expect(byId('localMessages').textContent).toContain('Interrupted question');
    byId('localRetry').click();await settle();expect(mocks.generate).toHaveBeenCalledTimes(1);expect(byId('localMessages').textContent).toContain('A local explanation.');
  });
  it('restores selected scroll, zoom and rotation only for the matching document',async()=>{
    await import('../src/reader');await settle();
    const position={pageNumber:2,scrollTop:435,scrollLeft:12,scale:1.8,rotation:90};
    const reply=vi.fn();
    mocks.listeners[0]({type:'reader-return',sessionId:'session-a',documentId:init.documentId,position},{id:'test-extension',url:'chrome-extension://test-extension/background.js'},reply);
    await settle();expect(window.scrollTo).toHaveBeenLastCalledWith(0,435);expect(byId('pages').scrollLeft).toBe(12);expect(byId('fitWidth').textContent).toBe('180%');expect(reply).toHaveBeenCalledWith({ok:true});
    reply.mockClear();mocks.listeners[0]({type:'reader-return',sessionId:'session-a',documentId:'other',position},{id:'test-extension',url:'chrome-extension://test-extension/background.js'},reply);
    await settle();expect(reply).not.toHaveBeenCalled();
  });

  it('does not redraw for its own unchanged navigation settings notification',async()=>{
    Object.defineProperty(byId('pages'),'clientWidth',{configurable:true,get:()=>document.body.classList.contains('navigation-open')?540:800});
    await import('../src/reader');await settle();const before=mocks.render.mock.calls.length;
    byId('outlineToggle').click();await settle();expect(mocks.render.mock.calls.length).toBe(before+1);
    const canvas=document.querySelector('.pdf-page canvas'),text=document.querySelector('.pdf-page .textLayer');
    const key='paperpeek.readerSettings.v1';mocks.storageListeners[0]({[key]:{newValue:mocks.data[key]}},'local');await settle();
    expect(mocks.render.mock.calls.length).toBe(before+1);expect(document.querySelector('.pdf-page canvas')).toBe(canvas);expect(document.querySelector('.pdf-page .textLayer')).toBe(text);
    mocks.data[key]={...(mocks.data[key] as object),trigger:'ctrl'};mocks.storageListeners[0]({[key]:{newValue:mocks.data[key]}},'local');await settle();expect(mocks.render.mock.calls.length).toBe(before+1);
  });
  it('keeps only the latest canvas and text after rapid zoom during an outstanding render',async()=>{
    Object.defineProperty(byId('pages'),'clientWidth',{configurable:true,value:800});
    await import('../src/reader');await settle();let finish!:()=>void;
    mocks.render.mockImplementationOnce(()=>({promise:new Promise<void>(r=>{finish=r;})}));
    byId('zoomIn').click();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
    byId('zoomOut').click();byId('zoomIn').click();byId('zoomIn').click();
    finish();await settle();
    const first=document.querySelector<HTMLElement>('.pdf-page')!;
    expect(first.querySelectorAll('canvas')).toHaveLength(1);expect(first.querySelectorAll('.textLayer')).toHaveLength(1);
    expect(first.querySelector('.textLayer')?.textContent).toContain('Evidence on page 1.');
    expect(parseFloat(first.style.width)).toBeCloseTo(760*1.2*1.2);
    expect(byId('fitWidth').textContent).toBe('182%');
  });
  it('handles Ctrl+wheel only inside the PDF surface without changing browser zoom styles',async()=>{
    Object.defineProperty(byId('pages'),'clientWidth',{configurable:true,value:800});
    await import('../src/reader');await settle();const first=document.querySelector<HTMLElement>('.pdf-page')!,before=parseFloat(first.style.width);
    const normal=wheel({deltaY:100,bubbles:true,cancelable:true});first.dispatchEvent(normal);await settle();expect(normal.defaultPrevented).toBe(false);expect(parseFloat(first.style.width)).toBe(before);
    const outside=wheel({deltaY:-100,ctrlKey:true,bubbles:true,cancelable:true});byId('localQuestion').dispatchEvent(outside);expect(outside.defaultPrevented).toBe(false);
    const input=document.createElement('input');first.append(input);const inInput=wheel({deltaY:-100,ctrlKey:true,bubbles:true,cancelable:true});input.dispatchEvent(inInput);expect(inInput.defaultPrevented).toBe(false);
    const zoom=wheel({deltaY:-100,ctrlKey:true,bubbles:true,cancelable:true});first.dispatchEvent(zoom);await settle();
    expect(zoom.defaultPrevented).toBe(true);expect(parseFloat(first.style.width)).toBeCloseTo(before*Math.exp(.2));expect(document.body.style.zoom).toBe('');expect(document.documentElement.style.zoom).toBe('');
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('preserves the PDF point under the cursor for Ctrl+wheel zoom',async()=>{
    Object.defineProperty(byId('pages'),'clientWidth',{configurable:true,value:800});
    await import('../src/reader');await settle();const first=document.querySelector<HTMLElement>('.pdf-page')!;
    const oldWidth=parseFloat(first.style.width),oldHeight=parseFloat(first.style.height);
    first.getBoundingClientRect=()=>new DOMRect(100-byId('pages').scrollLeft,100,parseFloat(first.style.width),parseFloat(first.style.height));
    const clientX=100+oldWidth*.5,clientY=100+oldHeight*.5;
    first.dispatchEvent(wheel({deltaY:-100,ctrlKey:true,bubbles:true,cancelable:true,clientX,clientY}));await settle();
    expect(byId('pages').scrollLeft).toBeCloseTo(oldWidth*.5*(Math.exp(.2)-1));
    expect(window.scrollTo).toHaveBeenLastCalledWith(0,expect.closeTo(oldHeight*.5*(Math.exp(.2)-1),5));
  });
  it('normalizes line and page wheel deltas and clamps repeated pinch zoom',async()=>{
    Object.defineProperty(byId('pages'),'clientWidth',{configurable:true,value:800});Object.defineProperty(byId('pages'),'clientHeight',{configurable:true,value:400});
    await import('../src/reader');await settle();const first=document.querySelector<HTMLElement>('.pdf-page')!,initial=parseFloat(first.style.width);
    first.dispatchEvent(wheel({deltaY:-3,deltaMode:1,ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(parseFloat(first.style.width)).toBeCloseTo(initial*Math.exp(.096));
    first.dispatchEvent(wheel({deltaY:3,deltaMode:1,ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(parseFloat(first.style.width)).toBeCloseTo(initial);
    first.dispatchEvent(wheel({deltaY:-.25,deltaMode:2,ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(parseFloat(first.style.width)).toBeCloseTo(initial*Math.exp(.2));
    for(let i=0;i<10;i++)first.dispatchEvent(wheel({deltaY:-500,ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(byId('fitWidth').textContent).toBe('350%');expect(first.querySelector('canvas')).not.toBeNull();expect(first.querySelector('.textLayer')).not.toBeNull();
    for(let i=0;i<10;i++)first.dispatchEvent(wheel({deltaY:500,ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(byId('fitWidth').textContent).toBe('35%');expect(parseFloat(first.style.width)).toBeCloseTo(210);
    const key=new KeyboardEvent('keydown',{key:'+',ctrlKey:true,cancelable:true,bubbles:true});document.dispatchEvent(key);expect(key.defaultPrevented).toBe(false);
  });
  it('checkpoints horizontal page-container scrolling without a window scroll',async()=>{
    await import('../src/reader');await settle();
    byId('pages').scrollLeft=177;byId('pages').dispatchEvent(new Event('scroll'));
    await new Promise(resolve=>setTimeout(resolve,300));
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({type:'reader-position',position:expect.objectContaining({scrollLeft:177})}));
  });

});

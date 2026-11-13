import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blankWorkspace, packWorkspace, workspaceKey } from '../src/lib/tab-workspace';
import { getReadingSession, sessionForTab } from '../src/lib/reading-loop';
import { selectionKey, positionKey, anchorKey } from '../src/lib/reader-bridge';
let entries: Record<string, any>;
let listener: (message: any, sender: any, respond: (response:any)=>void)=>boolean|undefined;
let removed: (id:number)=>void;
let updated: (id:number, change:any)=>void;
let nextTab: number;
const base='chrome-extension://test/';
const panel={id:'test',url:base+'sidepanel.html'};
let createHook: ((tab:any)=>void)|undefined;
const tabs=new Map<number,any>();
async function send(message:any,sender:any=panel):Promise<any> {
  return new Promise(resolve=>{ const accepted=listener(message,sender,resolve); if(!accepted)resolve(undefined); });
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,30));
beforeEach(async()=>{
  vi.resetModules(); entries={}; nextTab=10; createHook=undefined; tabs.clear(); tabs.set(1,{id:1,url:'https://x/article'});
  vi.stubGlobal('chrome',{
    sidePanel:{setPanelBehavior:async()=>{},open:async()=>{}},
    runtime:{id:'test',getURL:(path:string)=>base+path,onInstalled:{addListener:()=>{}},onMessage:{addListener:(fn:any)=>{listener=fn;}},sendMessage:vi.fn(async()=>{})},
    contextMenus:{create:()=>{},onClicked:{addListener:()=>{}}},
    tabs:{onRemoved:{addListener:(fn:any)=>{removed=fn;}},onUpdated:{addListener:(fn:any)=>{updated=fn;}},
      get:async(id:number)=>{if(!tabs.has(id))throw Error('closed');return tabs.get(id);},
      create:async(props:any)=>{const tab={id:nextTab++,...props};tabs.set(tab.id,tab);createHook?.(tab);return tab;},
      update:async(id:number,props:any)=>Object.assign(tabs.get(id),props)},
    storage:{session:{get:async(key:string|string[]|null)=>key===null?{...entries}:typeof key==='string'?{[key]:entries[key]}:Object.fromEntries(key.map(k=>[k,entries[k]])),
      set:async(values:any)=>Object.assign(entries,structuredClone(values)),remove:async(key:string)=>{delete entries[key];}}}
  });
  const workspace=blankWorkspace(1,'https://x/article');
  workspace.paper={id:'paper',documentId:'doc',title:'Title',sourceUrl:'https://x/p.pdf',pages:[],totalPages:3,truncated:false};
  entries[workspaceKey(1)]=await packWorkspace(workspace);
  await import('../src/background');
});
const open=()=>send({type:'open-reader',workspaceTabId:1,sourceTabId:1,documentId:'doc',sourceUrl:'https://x/p.pdf',sourceTabUrl:'https://x/article'});
describe('reading-loop service-worker boundaries',()=>{
  it('queues Reader ready arriving before attach completes',async()=>{
    let ready:Promise<any>|undefined;
    createHook=tab=>{ready=send({type:'reader-ready',sessionId:new URL(tab.url).searchParams.get('session')},{id:'test',url:tab.url,tab:{id:tab.id}});};
    const session=await open();
    expect((await ready)?.documentId).toBe('doc'); expect(session.readerTabId).toBe(10);
  });
  it('rejects webpage senders and Reader administrative requests',async()=>{
    expect(await send({type:'open-reader'}, {id:'test',url:'https://x/article'})).toBeUndefined();
    expect((await send({type:'open-reader'}, {id:'test',url:base+'reader.html?session=fake'})).error).toBeTruthy();
    const s=await open();
    expect((await send({type:'reader-ready',sessionId:s.sessionId},{id:'test',url:base+'reader.html?session=wrong',tab:{id:s.readerTabId}})).error).toBeTruthy();
  });
  it('reuses surviving Reader after source closes, then clears all ephemeral state',async()=>{
    const s=await open(); removed(1); await settle();
    const reopened=await send({type:'open-reader',workspaceTabId:s.workspaceTabId,sourceTabId:s.readerTabId,documentId:'doc'});
    expect(reopened.sessionId).toBe(s.sessionId);expect(reopened.readerTabId).toBe(s.readerTabId);
    entries[selectionKey(s.sessionId)]={requestId:'a'};entries[positionKey(s.sessionId)]={};entries[anchorKey(s.sessionId)]={};
    removed(s.readerTabId);await settle();
    expect(await getReadingSession(s.sessionId)).toBeNull();
    for(const key of [workspaceKey(s.workspaceTabId),selectionKey(s.sessionId),positionKey(s.sessionId),anchorKey(s.sessionId)]) expect(entries[key]).toBeUndefined();
  });
  it('detaches navigated source without losing the Reader session',async()=>{
    const s=await open(); updated(1,{url:'https://x/different'});await settle();
    expect(await sessionForTab(1)).toBeNull();expect((await sessionForTab(s.readerTabId))?.sessionId).toBe(s.sessionId);
  });
  it('compare-consumes only the intended selection, preserving newer drafts',async()=>{
    const s=await open();entries[selectionKey(s.sessionId)]={requestId:'new'};
    expect(await send({type:'reader-consume',sessionId:s.sessionId,requestId:'old'})).toEqual({consumed:false});
    expect(entries[selectionKey(s.sessionId)]).toBeTruthy();
    expect(await send({type:'reader-consume',sessionId:s.sessionId,requestId:'new'})).toEqual({consumed:true});
    expect(entries[selectionKey(s.sessionId)]).toBeUndefined();
  });
  it('rejects foreign document and malformed position events',async()=>{
    const s=await open(); const sender={id:'test',url:base+'reader.html?session='+s.sessionId,tab:{id:s.readerTabId}};
    expect((await send({type:'reader-position',sessionId:s.sessionId,documentId:'other'},sender)).error).toBeTruthy();
    expect((await send({type:'reader-position',sessionId:s.sessionId,documentId:'doc',position:{pageNumber:2,scale:1,rotation:0,scrollLeft:0,scrollTop:Infinity}},sender)).error).toBeTruthy();
    expect(entries[positionKey(s.sessionId)]).toBeUndefined();
  });
  it('preserves captured selection position and returns through the registered Reader',async()=>{
    const session=await open();
    const position={pageNumber:2,scrollTop:435,scrollLeft:12,scale:1.8,rotation:90};
    const selection={sessionId:session.sessionId,documentId:'doc',text:'Evidence',pageStart:2,pageEnd:2,at:Date.now(),anchor:{sessionId:session.sessionId,documentId:'doc',pageNumber:2,verification:'quote-verified'}};
    const sender={id:'test',url:base+'reader.html?session='+session.sessionId,tab:{id:session.readerTabId}};
    expect(await send({type:'reader-selection',sessionId:session.sessionId,documentId:'doc',action:'ask',selection,position},sender)).toEqual({ok:true});
    expect(entries[selectionKey(session.sessionId)].selection.position).toEqual(position);
    entries[anchorKey(session.sessionId)]={pageNumber:3};
    await send({type:'open-reader',workspaceTabId:session.workspaceTabId,sourceTabId:1,documentId:'doc',position});
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({type:'reader-return',sessionId:session.sessionId,documentId:'doc',position});
    expect(entries[positionKey(session.sessionId)]).toEqual(position);
    expect(entries[anchorKey(session.sessionId)]).toBeUndefined();
    expect((await send({type:'reader-selection',sessionId:session.sessionId,documentId:'doc',action:'ask',selection,position:{...position,scale:NaN}},sender)).error).toBeTruthy();
  });

});

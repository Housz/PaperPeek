import { beforeEach, expect, it, vi } from 'vitest';
import { annotationKey, loadAnnotations, saveAnnotation, deleteAnnotation, clearAnnotations, type Annotation } from '../src/lib/annotations';
import { loadReaderSettings, saveReaderSettings, normalizeReaderSettings } from '../src/lib/reader-settings';
let local: Record<string, unknown>;
beforeEach(() => { local = {}; vi.stubGlobal('chrome', { storage: { local: {
  get: async (k: string | null) => k === null ? {...local} : {[k]:local[k]},
  set: async (v: Record<string,unknown>) => {Object.assign(local,structuredClone(v));},
  remove: async (keys: string | string[]) => {for(const k of Array.isArray(keys)?keys:[keys])delete local[k];}
} } }); });
const record = (id='a',documentId='sha256:doc'): Annotation => ({id,documentId,kind:'ask',createdAt:1,updatedAt:2,
 selection:{documentId,sessionId:'old',text:'quoted passage',pageStart:1,pageEnd:1,at:1,anchor:{documentId,sessionId:'old',pageNumber:1,exactQuote:'quoted passage',verification:'quote-verified'}},
 messages:[{role:'user',text:'Why?'},{role:'assistant',text:'Answer'}]});
it('keeps explicit discussions across session lifetimes and isolates documents',async()=>{
 await saveAnnotation(record());await saveAnnotation(record('b','other'));expect((await loadAnnotations('sha256:doc')).map(a=>a.id)).toEqual(['a']);
 await deleteAnnotation('sha256:doc','a');expect(await loadAnnotations('sha256:doc')).toEqual([]);expect(await loadAnnotations('other')).toHaveLength(1);
});
it('clear only removes the selected document discussions, not settings or keys',async()=>{
 local['settings']={apiKey:'dummy'};await saveAnnotation(record());await saveAnnotation(record('b'));await saveAnnotation(record('c','other'));
 await clearAnnotations('sha256:doc');expect(await loadAnnotations('sha256:doc')).toEqual([]);expect(await loadAnnotations('other')).toHaveLength(1);expect(local.settings).toEqual({apiKey:'dummy'});
});
it('whitelists persistent fields instead of capturing credentials or metadata',async()=>{
 const a=Object.assign(record(),{apiKey:'secret',sourceUrl:'file:///private.pdf'});Object.assign(a.messages[0],{apiKey:'secret'});
 await saveAnnotation(a);expect(JSON.stringify(local)).not.toContain('secret');expect(JSON.stringify(local)).not.toContain('private.pdf');
});
it('rejects cross-document, invalid and oversized records and ignores malformed stored entries',async()=>{
 const a=record();a.selection.documentId='wrong';await expect(saveAnnotation(a)).rejects.toThrow();
 const b=record();b.messages=[{role:'assistant',text:'x'.repeat(120001)}];await expect(saveAnnotation(b)).rejects.toThrow();
 local[annotationKey('sha256:doc','bad')]={id:'bad'};expect(await loadAnnotations('sha256:doc')).toEqual([]);
});
it('uses independent per-discussion keys so concurrent additions do not overwrite',async()=>{
 await Promise.all([saveAnnotation(record('a')),saveAnnotation(record('b'))]);expect(await loadAnnotations('sha256:doc')).toHaveLength(2);
});
it('normalizes preferences, preserves other settings and clamps sidebar width',async()=>{
 expect((await loadReaderSettings()).trigger).toBe('direct');await saveReaderSettings({trigger:'alt',navWidth:900});await saveReaderSettings({openMode:'current-tab'});
 expect(await loadReaderSettings()).toEqual({trigger:'alt',openMode:'current-tab',navOpen:false,navWidth:420});
 expect(normalizeReaderSettings({trigger:'bad',navWidth:NaN}).navWidth).toBe(260);
});
it('rejects stale cross-window writes and deletion resurrection',async()=>{
 await saveAnnotation(record());
 const [first]=await loadAnnotations('sha256:doc'),[second]=await loadAnnotations('sha256:doc');
 first.messages.push({role:'user',text:'new turn'});await saveAnnotation(first);
 second.messages.push({role:'user',text:'stale turn'});await expect(saveAnnotation(second)).rejects.toThrow('另一个窗口');
 expect((await loadAnnotations('sha256:doc'))[0].messages.at(-1)?.text).toBe('new turn');
 await deleteAnnotation(first.documentId,first.id);await expect(saveAnnotation(first)).rejects.toThrow();expect(await loadAnnotations(first.documentId)).toEqual([]);
});

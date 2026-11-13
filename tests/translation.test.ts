import { describe, it, expect } from 'vitest';
import { translationPrompt } from '../src/lib/translation';
import type { Paper } from '../src/types';
import type { ReadingSelection } from '../src/lib/reading-loop';
const paper: Paper = { id:'p',title:'Paper',sourceUrl:'file:///private/secret.pdf',totalPages:2,truncated:false,pages:[{page:1,text:'Nearby context. A 5 kg load may increase under assumptions. Following context.'},{page:2,text:'UNRELATED'.repeat(10000)}] };
const selection: ReadingSelection = { sessionId:'s',documentId:'d',text:'A 5 kg load may increase under assumptions.',pageStart:1,pageEnd:1,at:0,anchor:{sessionId:'s',documentId:'d',pageNumber:1,verification:'quote-verified'} };
describe('bounded selection translation',()=>{
 it('preserves exact quote and adjacent context without paths or unrelated full-paper text',()=>{const p=translationPrompt(paper,selection);expect(p).toContain(selection.text);expect(p).toContain('Nearby context');expect(p).not.toContain('secret.pdf');expect(p).not.toContain('UNRELATED');expect(p).toContain('不强化 may');});
 it('bounds long context and identifies untrusted text',()=>{const p=translationPrompt({...paper,pages:[{page:1,text:'z'.repeat(100000)}]},selection);expect(p.length).toBeLessThan(12000);expect(p).toContain('<selection-untrusted>');expect(p).toContain('不补造内容');});
});

/** Real MV3 bundle + production panel handlers; synthetic network only. NOT a native Side Panel UI test. */
import { createRequire } from 'node:module';
import { readFile, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const pdf = await readFile(resolve(root, 'tests/browser/fixtures/reading-loop.pdf'));
const profile = await mkdtemp(resolve(tmpdir(), 'paperpeek-browser-'));
const output = process.env.PAPERPEEK_QA_OUTPUT || resolve(tmpdir(), 'paperpeek-browser-results');
await mkdir(output, { recursive: true });
const sourceUrl = 'https://arxiv.org/abs/2601.00001';
const quote = 'Unique evidence on physical page 2: temperature may rise by 2.5 K.';
const digest = { tldr: 'Synthetic test summary', problem: 'Test trustworthy navigation', approach: ['Fixture only'], findings: [{text:'Synthetic evidence',page:2,quote}], limitations:['Synthetic only'], keywords:['test'] };
const results = { browser:'', mode:process.env.HEADED?'headed':'headless', checks:[], limitations:[
  'Actual extension worker and built pages, but sidepanel.html is an inactive extension tab; native Side Panel is disabled to avoid a second competing consumer. NOT native Chrome Side Panel UI acceptance.',
  'Selection is DOM Range driven, not mouse-drag or touch accessibility verification.',
  'Network is intercepted synthetic HTML/PDF/provider responses; no live API, publisher compatibility, or human research.'
] };
let context, stage='launch', aiRequests=0, releaseTranslation, holdNextLocal=false;
const verify = label => results.checks.push(label);
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:!process.env.HEADED,
    ignoreDefaultArgs:['--disable-extensions'],
    args:['--no-sandbox',`--disable-extensions-except=${dist}`,`--load-extension=${dist}`],
    viewport:{width:1280,height:900}, deviceScaleFactor:2
  });
  context.setDefaultTimeout(15000);
  // Fail closed: never leak dummy credentials or synthetic requests to a live provider.
  await context.route(/^https?:\/\//, async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'arxiv.org' && url.pathname.startsWith('/abs/'))
      return route.fulfill({contentType:'text/html',body:'<title>Synthetic article</title><a href="/pdf/2601.00001">PDF</a><p>Source page must survive.</p>'});
    if (url.hostname === 'arxiv.org' && url.pathname.startsWith('/pdf/'))
      return route.fulfill({contentType:'application/pdf',body:pdf});
    if (url.hostname === 'api.deepseek.com' && url.pathname === '/chat/completions') {
      aiRequests++;
      const prompt = route.request().postDataJSON().messages[0].content;
      let content;
      if (prompt.includes('"tldr"')) content=JSON.stringify(digest);
      else if (prompt.includes('Local discussion (not the main conversation)')) {
        if (holdNextLocal) { holdNextLocal=false; await new Promise(resolve => {releaseTranslation=resolve;}); }
        content=prompt.includes('仅输出译文') ? '测试译文：温度可能升高 2.5 K。' : 'Synthetic local answer: selected evidence only.';
      } else content='Synthetic answer [PDF p.2]';
      return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content}}]})});
    }
    return route.abort('blockedbyclient');
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  await worker.evaluate(async () => {
    // The harness drives one production panel page, not Chrome's native Side Panel container.
    await chrome.sidePanel.setOptions({enabled:false});
    // Only dummy BYOK settings are seeded. No paper, workspace, session or anchor records.
    await chrome.storage.local.set({'paperpeek.profileSettings.v2':{selected:'deepseek',profiles:{deepseek:{model:'qa-mock',rememberKey:false}}}});
    await chrome.storage.session.set({'paperpeek.sessionKeys.v2':{deepseek:'dummy-never-sent-to-network'}});
  });
  const source = await context.newPage(); await source.goto(sourceUrl);
  const sourceId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(t=>t.url===url).id,sourceUrl);
  const panelTab = await worker.evaluate(url=>chrome.tabs.create({url,active:false}),`chrome-extension://${extensionId}/sidepanel.html`);
  const panel = await waitPage(p=>p.url().endsWith('/sidepanel.html'));
  await worker.evaluate(id=>chrome.tabs.update(id,{active:true}),sourceId);
  await panel.waitForFunction(()=>document.querySelector('#paperTitle').textContent.includes('2601.00001'));
  const pressPanel = id => panel.locator('#'+id).evaluate(el=>el.click()); // Keep source/Reader active.
  stage='production source→Reader';
  await pressPanel('openReaderBtn');
  const reader = await waitPage(p=>p.url().includes('/reader.html?session='));
  await reader.locator('.pdf-page canvas').first().waitFor();
  assert.equal(source.url(),sourceUrl,'Opening Reader overwrote article URL');
  assert.equal(await reader.locator('.pdf-page').count(),12,'Wrong physical page count');
  assert.equal(aiRequests,0,'Opening Reader implicitly called AI');
  const sessionId=new URL(reader.url()).searchParams.get('session');
  results.browser=await reader.evaluate(()=>navigator.userAgent);
  verify('Production openReader creates session/Reader from source; original article intact; zero AI');
  stage='physical-page alignment';
  for(let n=1;n<=12;n++) {
    await reader.locator('#pageNumber').fill(String(n)); await reader.locator('#pageNumber').press('Enter');
    await reader.waitForFunction(n=>{
      const p=document.querySelector(`.pdf-page[data-page="${n}"]`),c=p?.querySelector('canvas'),r=p?.getBoundingClientRect();
      return c&&c.width>0&&r.top>=-5&&r.top<160&&r.bottom>160;
    },n);
  }
  verify('12/12 target page canvases actually rendered and aligned within 160px of viewport top');
  await reader.locator('#pageNumber').fill('1');await reader.locator('#pageNumber').press('Enter');
  await reader.locator('#zoomIn').click();await reader.locator('.more summary').click();await reader.locator('#rotate').click();await reader.locator('.more summary').click();
  await reader.waitForFunction(()=>document.querySelector('.pdf-page[data-page="1"] canvas'));
  const before=await reader.evaluate(()=>({x:document.querySelector('#pages').scrollLeft,y:scrollY,width:document.querySelector('.pdf-page').getBoundingClientRect().width,height:document.querySelector('.pdf-page').getBoundingClientRect().height,zoom:document.querySelector('#fitWidth').textContent}));
  stage='A anchor and return';
  await pressPanel('analyzeBtn');
  await panel.locator('.digest-section .page-link').waitFor();
  assert.equal(aiRequests,1,'Analyze should be one explicit request');
  await panel.locator('.digest-section .page-link').evaluate(el=>el.click());
  await reader.locator('.pdf-page[data-page="2"] .highlight').first().waitFor();
  const geometry=await reader.evaluate(()=>{
    const p=document.querySelector('.pdf-page[data-page="2"]'),h=p.querySelector('.highlight').getBoundingClientRect();
    const span=[...p.querySelectorAll('.textLayer span')].find(el=>el.textContent.includes('Unique evidence on physical page 2'));
    const r=span?.getBoundingClientRect();return {highlight:h.toJSON(),text:r?.toJSON(),viewport:innerHeight};
  });
  assert.ok(geometry.text,'Expected quote missing from actual PDF text layer');
  assert.ok(geometry.highlight.width>0&&geometry.highlight.height>0,'Empty highlight');
  assert.ok(geometry.highlight.bottom>0&&geometry.highlight.top<geometry.viewport,'Highlight offscreen');
  assert.ok(geometry.highlight.right>geometry.text.left&&geometry.highlight.left<geometry.text.right&&geometry.highlight.bottom>geometry.text.top&&geometry.highlight.top<geometry.text.bottom,'Highlight does not intersect verified quote geometry');
  assert.match(await reader.locator('#status').innerText(),/已定位原文/);
  await reader.locator('#returnPosition').click();
  await reader.waitForFunction(before=>Math.abs(scrollY-before.y)<5&&Math.abs(document.querySelector('.pdf-page').getBoundingClientRect().width-before.width)<2,before);
  const after=await reader.evaluate(()=>({x:document.querySelector('#pages').scrollLeft,y:scrollY,height:document.querySelector('.pdf-page').getBoundingClientRect().height,zoom:document.querySelector('#fitWidth').textContent}));
  assert.ok(Math.abs(after.x-before.x)<5&&Math.abs(after.height-before.height)<2,'Return lost scroll/rotation');assert.equal(after.zoom,before.zoom,'Return lost zoom');
  assert.equal(context.pages().filter(p=>p.url().includes('/reader.html?session=')).length,1,'Evidence created duplicate Reader');
  verify('A verified quote intersects rendered text; Return restores scroll/zoom/rotation; Reader reused');
  stage='B model hint';
  await pressPanel('tab-ask');await panel.locator('#askInput').fill('Give a page hint');
  await panel.locator('#askForm').evaluate(el=>el.requestSubmit());await panel.locator('.message.assistant .page-link').waitFor();
  await panel.locator('.message.assistant .page-link').last().evaluate(el=>el.click());
  await reader.waitForFunction(()=>document.querySelector('#status').textContent.includes('页面级定位'));
  assert.equal(await reader.locator('.highlight').count(),0,'Model hint falsely highlighted quote');
  verify('B model page hint stays page-only without highlight');
  stage='local Ask, persistent annotation, citation and isolated translation';
  await reader.locator('#pageNumber').fill('2');await reader.locator('#pageNumber').press('Enter');
  await reader.locator('.pdf-page[data-page="2"] .textLayer span').first().waitFor();
  const selectQuote=()=>reader.evaluate(()=>{
    const span=[...document.querySelectorAll('.pdf-page[data-page="2"] .textLayer span')].find(el=>el.textContent.includes('Unique evidence'));
    const range=document.createRange();range.selectNodeContents(span);const s=getSelection();s.removeAllRanges();s.addRange(range);
    span.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
  });
  const beforeAsk=aiRequests;await selectQuote();await reader.locator('#askSelection').click();
  await reader.locator('#localPanel').waitFor({state:'visible'});
  assert.equal(aiRequests,beforeAsk,'Opening local Ask called AI before submit');
  assert.equal(await panel.locator('#selectionDraft').isVisible(),false,'Local Ask leaked into main draft');
  await reader.locator('#localQuestion').fill('Why does the temperature rise?');
  await reader.locator('#localForm').evaluate(el=>el.requestSubmit());
  await reader.waitForFunction(()=>document.querySelector('#localMessages').textContent.includes('Synthetic local answer'));
  assert.equal(aiRequests,beforeAsk+1,'Local Ask should send one explicit request');
  assert.ok(!(await panel.locator('#chatHistory').innerText()).includes('Synthetic local answer'),'Local answer leaked into main history');
  await reader.locator('#localClose').click();
  await reader.locator('.pdf-page[data-page="2"] .discussion-marker').first().click();
  await reader.locator('#localPanel').waitFor({state:'visible'});
  assert.match(await reader.locator('#localMessages').innerText(),/Synthetic local answer/);
  assert.equal(aiRequests,beforeAsk+1,'Reopening saved question called AI');
  await reader.locator('#localClose').click();
  const durable=await worker.evaluate(async()=>Object.entries(await chrome.storage.local.get(null)).filter(([key])=>key.startsWith('paperpeek.annotation.v1.')));
  assert.equal(durable.length,1,'Question was not saved as local annotation');
  verify('Local Ask needs explicit submit; answer isolated from main chat; saved marker reopens without AI');

  await panel.locator('#askInput').fill('Keep this main draft');
  await selectQuote();await reader.locator('#citeSelection').click();
  await panel.locator('#selectionDraft .citation-card').first().waitFor({state:'visible'});
  assert.equal(await panel.locator('#askInput').inputValue(),'Keep this main draft','Cite erased main draft');
  assert.equal(aiRequests,beforeAsk+1,'Cite implicitly requested AI');
  await panel.locator('#selectionDraft .citation-card button').filter({hasText:'返回原文'}).first().evaluate(el=>el.click());
  await reader.locator('.pdf-page[data-page="2"] .highlight').first().waitFor();
  verify('Cite stages anchored quote without sending or replacing main draft; quote returns to original');

  await selectQuote();holdNextLocal=true;await reader.locator('#translateSelection').click();
  await waitUntil(()=>typeof releaseTranslation==='function','Translate never reached mocked provider');
  assert.equal(aiRequests,beforeAsk+2,'Translate should call provider exactly once');
  await reader.locator('#localClose').click();
  const independent=await context.newPage();await independent.goto(sourceUrl);
  const independentId=await worker.evaluate(async ({url,except})=>(await chrome.tabs.query({})).find(t=>t.url===url&&t.id!==except).id,{url:sourceUrl,except:sourceId});
  await worker.evaluate(id=>chrome.tabs.update(id,{active:true}),independentId);
  await panel.waitForFunction(()=>document.querySelector('#overviewContent').hidden&&document.querySelector('#askInput').value==='');
  releaseTranslation();
  await reader.waitForFunction(()=>document.querySelector('#localMessages').textContent.includes('测试译文'));
  assert.equal(await reader.locator('#localPanel').isVisible(),false,'Background result reopened closed popup');
  assert.ok(!(await panel.locator('#chatHistory').innerText()).includes('测试译文'),'Local translation leaked into independent main session');
  await worker.evaluate(async sessionId=>{const all=await chrome.storage.session.get(null);const s=Object.values(all).find(v=>v?.sessionId===sessionId&&v.readerTabId);await chrome.tabs.update(s.readerTabId,{active:true});},sessionId);
  await panel.waitForFunction(()=>document.querySelector('#askInput').value==='Keep this main draft');
  assert.equal(aiRequests,beforeAsk+2,'Tab switching caused extra AI');
  verify('Translate explicit and isolated; close does not reopen; independent same-URL main session stays isolated');

  stage='left navigation and persistent discussion reload';
  await reader.reload();await reader.locator('.pdf-page canvas').first().waitFor();
  await reader.locator('#outlineToggle').click();await reader.locator('#navigation').waitFor({state:'visible'});
  await reader.locator('#discussionsTab').click();await reader.locator('.discussion-entry').first().click();
  await reader.locator('#localPanel').waitFor({state:'visible'});
  assert.match(await reader.locator('#localMessages').innerText(),/Synthetic local answer/);
  assert.equal(aiRequests,beforeAsk+2,'Reloading discussion called AI');
  await reader.locator('#localClose').click();await reader.locator('#navClose').click();
  verify('Direct left navigation lists persisted discussion and reopens it after Reader reload');
  stage='current-tab open and browser history continuity';
  await worker.evaluate(id=>chrome.tabs.update(id,{active:true}),independentId);
  await panel.waitForFunction(()=>document.querySelector('#overviewContent').hidden&&document.querySelector('#askInput').value==='');
  await pressPanel('analyzeBtn');await panel.locator('.digest-section .page-link').first().waitFor();
  await pressPanel('tab-ask');await panel.locator('#askInput').fill('Current-tab continuity draft');
  // This independent source has no Reader yet; current-tab must not activate the first source's Reader.
  const tabsBefore=context.pages().length,requestsBefore=aiRequests;
  await pressPanel('openReaderHere');await independent.waitForURL(/reader\.html\?session=/);
  await independent.locator('.pdf-page canvas').first().waitFor();
  assert.equal(context.pages().length,tabsBefore,'Current-tab opened another tab');
  assert.equal(source.url(),sourceUrl,'Current-tab changed unrelated original source');
  assert.notEqual(new URL(independent.url()).searchParams.get('session'),sessionId,'Independent source reused original Reader session');
  await panel.waitForFunction(()=>document.querySelector('#askInput').value==='Current-tab continuity draft');
  await independent.goBack();await independent.waitForURL(sourceUrl);
  await panel.waitForFunction(()=>document.querySelector('#askInput').value==='Current-tab continuity draft');
  await independent.goForward();await independent.waitForURL(/reader\.html\?session=/);
  await independent.locator('.pdf-page canvas').first().waitFor();
  await independent.locator('.more summary').click();await independent.locator('#source').click();
  await independent.waitForURL(sourceUrl);
  await panel.waitForFunction(()=>document.querySelector('#askInput').value==='Current-tab continuity draft');
  assert.equal(aiRequests,requestsBefore,'Reader navigation/history invoked AI');
  verify('Current-tab reuses source tab; independent session and draft survive Back/Forward and explicit return to source');
  for(const width of [300,360,450]) {await panel.setViewportSize({width,height:900});assert.ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`Panel overflow at ${width}px`);}
  await reader.emulateMedia({colorScheme:'dark'});await reader.screenshot({path:resolve(output,'reader-dark.png')});await panel.screenshot({path:resolve(output,'panel-450.png')});
  verify('Panel 300/360/450px overflow assertions; dark/high-DPI screenshots');
  await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
} catch(error) {await writeFile(resolve(output,'failure.txt'),`Stage: ${stage}\n${error}`);console.error(`Stage: ${stage}`,error);process.exitCode=1;}
finally {await context?.close();await rm(profile,{recursive:true,force:true});}
async function waitPage(predicate){await waitUntil(()=>context.pages().some(predicate),'Expected extension page not created');return context.pages().find(predicate);}
async function waitUntil(predicate,message){const deadline=Date.now()+15000;while(Date.now()<deadline){if(await predicate())return;await new Promise(r=>setTimeout(r,50));}throw new Error(message);}

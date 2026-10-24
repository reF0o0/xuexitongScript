import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const compiled=readFileSync(new URL('../dist/学习通-DeepSeek.user.js',import.meta.url),'utf8');
const jquery=readFileSync(new URL('../node_modules/jquery/dist/jquery.js',import.meta.url),'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const scenario=process.argv[2] || 'normal';
let rejectPlay,resolvePlay;
const pendingPlay=new Promise((resolve,reject)=>{rejectPlay=reject;resolvePlay=resolve;});
const dom=new JSDOM(`<div id="coursetree"><ul><li><div class="posCatalog_select posCatalog_active"><span class="posCatalog_name" title="4.2">4.2</span></div><div class="posCatalog_select"><span class="posCatalog_name" title="4.3">4.3</span></div></li></ul></div><div class="prev_title" title="4.2 章节标题">4.2 章节标题</div><ul id="tabs"><li class="active"><div class="prev_white"><span class="num">1</span><span>视频</span></div></li><li><div class="prev_white"><span class="num">2</span><span>章节测验</span></div></li></ul><iframe id="cards"></iframe>`,{url:'https://mooc1.chaoxing.com/mycourse/studentstudy?chapterId=101',runScripts:'outside-only'});
const w=dom.window;
w.console={log(){},warn(){},error(){},info(){}};
w.Element.prototype.getClientRects=()=>[{width:100,height:20}];
const intervals=new Map();let id=0;
w.setInterval=(fn,ms)=>{intervals.set(++id,{fn,ms});return id;};w.clearInterval=id=>intervals.delete(id);
let plays=0,opened=0,submitted=0,confirmed=0,next=0,answers=0,ended=false,clickAttempts=0,clock=Date.now();
w.Date.now=()=>clock;
const docs=w.document.querySelector('#cards').contentDocument;
docs.body.innerHTML='<iframe id="video-frame" class="ans-insertvideo-online"></iframe>';
const videoDoc=docs.querySelector('iframe').contentDocument;
videoDoc.body.innerHTML='<video id="video_html5_api"></video>';
const video=videoDoc.querySelector('video');
Object.defineProperty(video,'ended',{get:()=>ended});
video.play=()=>{plays++;video.dispatchEvent(new w.Event('play'));return scenario.startsWith('play-') && plays===1 ? pendingPlay : Promise.resolve();};video.pause=()=>{};
const videoTab=w.document.querySelectorAll('.prev_white')[0],quizTab=w.document.querySelectorAll('.prev_white')[1];
function activate(el){[videoTab,quizTab].forEach(t=>t.parentElement.classList.remove('active'));el.parentElement.classList.add('active');}
quizTab.onclick=()=>{
 opened++;activate(quizTab);
 // The tab switches before the iframe arrives, as on the live site.
 docs.body.innerHTML='<p>正在加载章节测验…</p>';
};
function loadQuiz(){
 docs.defaultView.Element.prototype.getClientRects=()=>[{width:100,height:20}];
 docs.body.innerHTML='<p>题量: 1</p><section id="question"><h3>判断题</h3><p>测试问题。</p><label><input type="radio" name="q" value="A">A、对</label><label><input type="radio" name="q" value="B">B、错</label></section><button id="submit">提交</button><div id="dialogs"></div>';
 docs.querySelector('#submit').onclick=()=>{
  submitted++;docs.querySelector('#dialogs').innerHTML='<div id="popcontent">确定提交吗？</div><button id="popok">确定</button>';
  docs.querySelector('#popok').onclick=()=>{confirmed++;docs.body.innerHTML='<p>章节测验 已完成 本次成绩 100 分 我的答案：A</p>';};
 };
}
w.document.querySelectorAll('.posCatalog_name')[1].onclick=()=>{clickAttempts++;if(scenario==='navigation-retry' && clickAttempts===1)return;next++;w.history.replaceState({},'', '?chapterId=102');activate(videoTab);docs.body.innerHTML='<p>下一小节视频正在加载</p>';};
w.fetch=async url=>({ok:true,json:async()=>{if(url.endsWith('/health'))return {configured:true};answers++;return {answers:[{id:1,letters:['A']}]};}});
w.eval(jquery);
// jsdom has no layout; the app's jQuery :visible selector needs the same visibility fixture.
w.jQuery.expr.pseudos.visible=el=>w.getComputedStyle(el).display!=='none';
w.eval(compiled);
try {
 const boot=[...intervals.values()].find(t=>t.ms===1000);assert.ok(boot);boot.fn();await sleep(20);
 assert.equal(plays,1,'Initial video must autoplay');
 if(scenario.startsWith('play-')) {
  quizTab.click();w.__xuexitongDeepSeekReview.scan();
  if(scenario==='play-success')resolvePlay();else rejectPlay(new Error('The play() request was interrupted by pause()'));await sleep(30);
  assert.equal(plays,1,'A late AbortError must not restart cached video on the quiz tab');
  assert.equal([...intervals.values()].filter(t=>t.ms===1000).length,0,'Quiz must stay free of video monitoring');
  console.log(`PASS: late video ${scenario} does not resume video while a quiz is active`);
 }else{
 ended=true;video.dispatchEvent(new w.Event('ended'));await sleep(1100);
 assert.equal(opened,1,'The actual ended handler must open the quiz');assert.equal(next,0,'The actual ended handler must not skip quiz');
 w.__xuexitongDeepSeekReview.scan();assert.equal(next,0,'Loading quiz must not advance');
 await w.__xuexitongPlayerV3.play();assert.equal(plays,1,'Cached old video must not restart while quiz is active');
 loadQuiz();w.__xuexitongDeepSeekReview.scan();
 if(scenario==='chapter-race') {
  await sleep(30);w.history.replaceState({},'', '?chapterId=102');w.__xuexitongDeepSeekReview.scan();await sleep(220);
  assert.equal(submitted,0,'Switching chapter during the initial submit delay must cancel the old click');
  assert.equal(confirmed,0);assert.equal(next,0);
  console.log('PASS: changing chapter cancels a pending submission before its initial click');
 }else{
 for(let i=0;i<70 && !(scenario==='navigation-retry'?clickAttempts:next);i++){await sleep(30);w.__xuexitongDeepSeekReview.scan();}
 if(scenario==='navigation-retry') {
  assert.equal(clickAttempts,1);assert.equal(next,0);clock+=8000;w.__xuexitongDeepSeekReview.scan();
  assert.equal(clickAttempts,2,'Failed initial click must retry exactly the same destination');
  const destination=docs.createElement('video');destination.id='video_html5_api';let paused=true;
  Object.defineProperty(destination,'paused',{get:()=>paused});destination.play=()=>{paused=false;return Promise.resolve()};destination.pause=()=>{paused=true};docs.body.replaceChildren(destination);
  w.__xuexitongDeepSeekReview.scan();await sleep(20);
  assert.equal(paused,false,'Arrival must start the destination video without an old loadedmetadata event');
 }
 assert.deepEqual({opened,answers,submitted,confirmed,next},{opened:1,answers:1,submitted:1,confirmed:1,next:1});
 w.__xuexitongDeepSeekReview.scan();
 assert.equal(w.__xuexitongDeepSeekReview.signature,'','A new section must reset old question state');
 assert.equal(w.document.querySelector('#xuexitong-deepseek-review-panel').textContent.includes('第 1 题'),false,'Old answers must not remain on next video');
 console.log('PASS: built userscript runs video -> delayed quiz tab -> AI fill -> submit -> grade -> next section exactly once');
}}}finally{w.__xuexitongPlayerV3?.destroy();w.close();}

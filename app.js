(()=>{'use strict';
const KEY='basketball-scoreboard-v4-v3-screen';
const defaults=()=>({teams:['HOME','AWAY'],possession:null,buzzerEnabled:true,countdownEnabled:true,scores:[0,0],fouls:[0,0],period:1,quarterSec:600,otSec:300,gameSec:600,gameRunning:false,shotEnabled:false,shotSec:24,shotRunning:false,autoShot:true,timeoutSec:60,timeoutLimit:3,timeoutUsed:[0,0],timeoutRemaining:60,timeoutTeam:null,timeoutRunning:false,lastTimeout:null,shortBreakSec:120,halfBreakSec:600,otBreakSec:120,breakPending:false,breakActive:false,breakRunning:false,breakRemaining:0,breakTarget:2});
let s=defaults();try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved==='object')s={...s,...saved,gameRunning:false,shotRunning:false,timeoutRunning:false,breakRunning:false}}catch{};
delete s.countdownStyle;delete s.audioPresetVersion;
s.possession=s.possession===0||s.possession===1?s.possession:null;
const $=id=>document.getElementById(id), clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(+v)?Math.trunc(+v):min)), fmt=n=>`${String(Math.floor(Math.max(0,n)/60)).padStart(2,'0')}:${String(Math.max(0,n)%60).padStart(2,'0')}`;
let clockDirty=false;
function syncClockFields(){if(!clockDirty){$('currentMinutes').value=String(Math.floor(s.gameSec/60)).padStart(2,'0');$('currentSeconds').value=String(s.gameSec%60).padStart(2,'0')}}
let gameDeadline=0,shotDeadline=0,timeoutDeadline=0,breakDeadline=0,lastSave=0;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}};
function notice(msg){$('status').textContent=msg;}

// Countdown and final buzzer share the same locally generated beep tone.
let audioContext=null,audioGeneration=0,activeTones=[];
async function prepareAudio(){
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;
 if(!audioContext||audioContext.state==='closed')audioContext=new Audio();
 if(audioContext.state!=='running')await audioContext.resume();
 return audioContext.state==='running'?audioContext:null;
 }catch{return null}
}
function stopBuzzer(){audioGeneration++;for(const tone of activeTones){try{tone.stop()}catch{}try{tone.disconnect()}catch{}}activeTones=[]}
async function soundBuzzer(){
 stopBuzzer();if(!s.buzzerEnabled||document.hidden)return;
 const generation=audioGeneration,ctx=await prepareAudio();
 if(generation!==audioGeneration||!s.buzzerEnabled||document.hidden)return;
 if(!ctx){notice('Buzzer unavailable. Check browser sound permissions; the clocks still work.');return}
 try{const now=ctx.currentTime,gain=ctx.createGain(),tone=ctx.createOscillator();
 // One loud sustained version of the countdown beep, with no gaps or pitch change.
 tone.type='triangle';tone.frequency.setValueAtTime(880,now);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(0.60,now+0.015);gain.gain.setValueAtTime(0.60,now+1.65);gain.gain.linearRampToValueAtTime(0,now+1.80);gain.connect(ctx.destination);tone.connect(gain);tone.onended=()=>{tone.disconnect();gain.disconnect()};activeTones.push(tone);tone.start(now);tone.stop(now+1.81);
 }catch{stopBuzzer();notice('Buzzer unavailable. The clocks still work.')}
}

async function soundCountdown(seconds=10,preview=false){
 if(!s.buzzerEnabled||!s.countdownEnabled||document.hidden)return;
 stopBuzzer();const generation=audioGeneration,ctx=await prepareAudio();
 if(!ctx||generation!==audioGeneration||!s.buzzerEnabled||!s.countdownEnabled||document.hidden||(!preview&&!s.gameRunning))return;
 try{const now=ctx.currentTime,steps=preview?[10,9,8,7,6,5,4,3,2,1]:[seconds];
 for(let index=0;index<steps.length;index++){
  const second=steps[index],at=now+index,gain=ctx.createGain();gain.connect(ctx.destination);
  const tone=ctx.createOscillator(),level=0.08+0.34*((10-clamp(second,1,10))/9),length=0.20;
  tone.type='triangle';tone.frequency.setValueAtTime(880,at);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+0.008);gain.gain.setValueAtTime(level,at+0.10);gain.gain.linearRampToValueAtTime(0,at+length);
  tone.connect(gain);tone.onended=()=>{tone.disconnect();gain.disconnect()};activeTones.push(tone);tone.start(at);tone.stop(at+length+0.01);
 }
 }catch{stopBuzzer()}
}
$('countdownTest').onclick=()=>void soundCountdown(10,true);
$('countdownEnabled').onchange=()=>{s.countdownEnabled=$('countdownEnabled').checked;if(!s.countdownEnabled)stopBuzzer();render();persist()};

function unlockSound(){if(s.buzzerEnabled)void prepareAudio()}
document.addEventListener('pointerdown',unlockSound,{capture:true});document.addEventListener('keydown',unlockSound,{capture:true});
$('buzzerToggle').onclick=()=>{s.buzzerEnabled=!s.buzzerEnabled;if(s.buzzerEnabled)unlockSound();else stopBuzzer();render();persist()};
$('buzzerTest').onclick=()=>void soundBuzzer();

function render(){$('countdownTest').disabled=!s.buzzerEnabled||!s.countdownEnabled;$('countdownEnabled').checked=s.countdownEnabled;$('buzzerToggle').textContent=s.buzzerEnabled?'Sound: On':'Sound: Off';$('buzzerToggle').setAttribute('aria-pressed',String(s.buzzerEnabled));$('buzzerTest').disabled=!s.buzzerEnabled;syncClockFields();for(let i=0;i<2;i++){ $('name'+i).textContent=s.teams[i];$('score'+i).textContent=s.scores[i];$('fouls'+i).textContent=s.fouls[i];$('toLeft'+i).textContent=Math.max(0,s.timeoutLimit-s.timeoutUsed[i]);}
for(let i=0;i<2;i++){const active=s.possession===i;$('possession'+i).classList.toggle('active',active);$('possession'+i).setAttribute('aria-hidden',String(!active));$('possession'+i).setAttribute('aria-label',s.teams[i]+' possession')}
$('possHome').setAttribute('aria-pressed',String(s.possession===0));$('possAway').setAttribute('aria-pressed',String(s.possession===1));$('possClear').setAttribute('aria-pressed',String(s.possession===null));
$('periodBadge').textContent=s.period<=4?'QUARTER '+s.period:'OVERTIME '+(s.period-4);
const active=s.timeoutTeam!==null, breaking=s.breakActive, pending=s.breakPending;
$('clockLabel').textContent=active?'TEAM TIMEOUT':breaking?'QUARTER BREAK':pending?'END OF QUARTER':'GAME CLOCK';
$('gameClock').textContent=fmt(active?s.timeoutRemaining:breaking?s.breakRemaining:s.gameSec);
$('gameClock').className='clocktime'+(active?' timeout-mode':breaking?' break-mode':'')+((active?s.timeoutRemaining:breaking?s.breakRemaining:s.gameSec)===0?' expired':(!active&&s.gameSec<=60?' warning':''));
$('timeoutContext').classList.toggle('hidden',!active);
$('periodControls').classList.toggle('hidden',active||breaking||pending);
$('gameActions').classList.toggle('hidden',active||breaking||pending);$('breakActions').classList.toggle('hidden',!pending||active||breaking);$('breakRunningActions').classList.toggle('hidden',!breaking||active);$('breakToggle').textContent=s.breakRunning?'Pause Break':'Resume Break';
$('timeoutActions').classList.toggle('hidden',!active);
$('timeoutOwner').textContent=active?`${s.teams[s.timeoutTeam]} TIMEOUT`:'';
$('timeoutStatus').textContent=active?(s.timeoutRunning?'Timeout running · Game paused':'Timeout paused · Game paused'):'';
$('gameStart').textContent=s.gameRunning?'Pause':'Start';$('gameStart').disabled=active||s.gameSec===0;
$('shotEnabled').checked=s.shotEnabled;$('shotClock').textContent=s.shotSec;
$('shotToggle').textContent=s.shotRunning?'Pause shot':'Start shot';$('shotToggle').disabled=active||s.shotSec===0;
$('timeoutToggle').disabled=!active||s.timeoutRemaining===0;
$('timeoutToggle').textContent=s.timeoutRunning?'Pause Timeout':'Resume Timeout';
$('timeoutEnd').disabled=!active;document.querySelectorAll('[data-timeout]').forEach(b=>{b.disabled=active||breaking||pending||s.timeoutUsed[Number(b.dataset.timeout)]>=s.timeoutLimit});
document.querySelectorAll('[data-timeout]').forEach(b=>{const i=Number(b.dataset.timeout);b.disabled=active||breaking||pending||s.timeoutUsed[i]>=s.timeoutLimit});}
function pauseGame(){if(s.gameRunning){s.gameSec=Math.max(0,Math.ceil((gameDeadline-performance.now())/1000));s.gameRunning=false}}
function pauseShot(){if(s.shotRunning){s.shotSec=Math.max(0,Math.ceil((shotDeadline-performance.now())/1000));s.shotRunning=false}}
function pauseTimeout(){if(s.timeoutRunning){s.timeoutRemaining=Math.max(0,Math.ceil((timeoutDeadline-performance.now())/1000));s.timeoutRunning=false}}
function pauseBreak(){if(s.breakRunning){s.breakRemaining=Math.max(0,Math.ceil((breakDeadline-performance.now())/1000));s.breakRunning=false}}
function pauseAll(){pauseGame();pauseShot();pauseTimeout();pauseBreak()}
function breakLength(){return s.period===2?s.halfBreakSec:s.period>=4?s.otBreakSec:s.shortBreakSec}
function beginBreak(){if(!s.breakPending||s.breakActive)return;pauseGame();pauseShot();s.breakPending=false;s.breakActive=true;s.breakRemaining=breakLength();if(s.breakRemaining>0){s.breakRunning=true;breakDeadline=performance.now()+s.breakRemaining*1000}else finishBreak();render();persist()}
function finishBreak(){pauseBreak();s.breakActive=false;s.breakPending=false;s.breakRunning=false;s.period=clamp(s.breakTarget,1,20);s.gameSec=s.period<=4?s.quarterSec:s.otSec;s.shotSec=24;s.fouls=[0,0];notice('Break finished. Press Start to begin the next period.');render();persist()}
function queueBreak(){if(s.period>=20)return;s.breakTarget=s.period+1;s.breakPending=true;s.breakActive=false;notice('Quarter finished. Start Break or Skip Break.')}
function startGame(){if(s.timeoutTeam!==null||s.breakActive||s.breakPending||s.gameSec<=0)return;s.gameRunning=true;gameDeadline=performance.now()+s.gameSec*1000;if(s.autoShot&&s.shotEnabled&&s.shotSec>0&&!s.shotRunning){s.shotRunning=true;shotDeadline=performance.now()+s.shotSec*1000}}
function startTimeout(i){if(s.timeoutTeam!==null||s.breakActive||s.breakPending||s.timeoutUsed[i]>=s.timeoutLimit)return;pauseGame();pauseShot();s.timeoutUsed[i]++;s.lastTimeout=i;s.timeoutTeam=i;s.timeoutRemaining=s.timeoutSec;s.timeoutRunning=true;timeoutDeadline=performance.now()+s.timeoutRemaining*1000;notice(`${s.teams[i]} timeout started`);render();persist()}
function endTimeout(){if(s.timeoutTeam===null)return;pauseTimeout();s.timeoutTeam=null;s.timeoutRemaining=s.timeoutSec;s.timeoutRunning=false;notice('Timeout ended. Resume the game clock manually.');render();persist()}
function tick(){const now=performance.now();let changed=false,buzzerDue=false,countdownDue=0;if(s.gameRunning){const next=Math.max(0,Math.ceil((gameDeadline-now)/1000));if(next!==s.gameSec){if(next<s.gameSec&&next>=1&&next<=10)countdownDue=countdownDue?Math.min(countdownDue,next):next;s.gameSec=next;changed=true}if(next===0){s.gameRunning=false;pauseShot();queueBreak();buzzerDue=true}}if(s.shotRunning){const next=Math.max(0,Math.ceil((shotDeadline-now)/1000));if(next!==s.shotSec){s.shotSec=next;changed=true}if(next===0){s.shotRunning=false;pauseGame();notice('Shot clock expired');buzzerDue=true}}if(s.timeoutRunning){const next=Math.max(0,Math.ceil((timeoutDeadline-now)/1000));if(next!==s.timeoutRemaining){s.timeoutRemaining=next;changed=true}if(next===0){s.timeoutRunning=false;s.timeoutTeam=null;s.timeoutRemaining=s.timeoutSec;notice('Timeout finished. Game clock restored; press Start to resume.')}}if(s.breakRunning){const next=Math.max(0,Math.ceil((breakDeadline-now)/1000));if(next!==s.breakRemaining){s.breakRemaining=next;changed=true}if(next===0){s.breakRunning=false;finishBreak()}}if(buzzerDue)void soundBuzzer();else if(countdownDue)void soundCountdown(countdownDue);if(changed){render();if(now-lastSave>800){persist();lastSave=now}}}
setInterval(tick,100);document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseAll();stopBuzzer();persist()}else render()});window.addEventListener('pagehide',()=>{pauseAll();stopBuzzer();persist()});
document.querySelectorAll('[data-score]').forEach(b=>b.addEventListener('click',()=>{const [i,n]=b.dataset.score.split(',').map(Number);s.scores[i]=Math.max(0,s.scores[i]+n);render();persist()}));document.querySelectorAll('[data-foul]').forEach(b=>b.addEventListener('click',()=>{s.fouls[+b.dataset.foul]++;render();persist()}));document.querySelectorAll('[data-foul-minus]').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.foulMinus;s.fouls[i]=Math.max(0,s.fouls[i]-1);render();persist()}));document.querySelectorAll('[data-timeout]').forEach(b=>b.addEventListener('click',()=>startTimeout(+b.dataset.timeout)));
function setPossession(team){s.possession=team;render();persist();notice(team===null?'Possession cleared.':'Possession: '+s.teams[team])}
$('possHome').onclick=()=>setPossession(0);$('possAway').onclick=()=>setPossession(1);$('possClear').onclick=()=>setPossession(null);
$('breakStart').onclick=beginBreak;$('breakSkip').onclick=()=>{if(s.breakPending)finishBreak()};$('breakToggle').onclick=()=>{if(!s.breakActive)return;if(s.breakRunning)pauseBreak();else if(s.breakRemaining>0){s.breakRunning=true;breakDeadline=performance.now()+s.breakRemaining*1000}render();persist()};$('breakEnd').onclick=()=>{if(s.breakActive)finishBreak()};
$('gameStart').onclick=()=>{if(s.gameRunning){pauseGame();pauseShot()}else startGame();render();persist()};$('gameReset').onclick=()=>{pauseGame();pauseShot();s.gameSec=s.period<=4?s.quarterSec:s.otSec;render();persist()};function changePeriod(n){if(s.timeoutTeam!==null||s.breakActive||s.breakPending){notice('Finish the active timeout or break first.');return}pauseGame();pauseShot();s.period=clamp(s.period+n,1,20);s.gameSec=s.period<=4?s.quarterSec:s.otSec;s.fouls=[0,0];render();persist()};$('nextPeriod').onclick=()=>changePeriod(1);$('prevPeriod').onclick=()=>changePeriod(-1);
$('shotEnabled').onchange=e=>{pauseShot();s.shotEnabled=e.target.checked;render();persist()};$('shotToggle').onclick=()=>{if(s.shotRunning)pauseShot();else if(s.shotEnabled&&s.shotSec>0&&s.timeoutTeam===null){s.shotRunning=true;shotDeadline=performance.now()+s.shotSec*1000}render();persist()};function resetShot(n){const resume=s.shotRunning||(s.gameRunning&&s.autoShot);pauseShot();s.shotSec=n;if(resume&&s.shotEnabled&&s.timeoutTeam===null&&!s.breakActive&&!s.breakPending){s.shotRunning=true;shotDeadline=performance.now()+n*1000}render();persist()};$('shot24').onclick=()=>resetShot(24);$('shot14').onclick=()=>resetShot(14);
$('timeoutToggle').onclick=()=>{if(s.timeoutTeam===null)return;if(s.timeoutRunning)pauseTimeout();else if(s.timeoutRemaining>0){s.timeoutRunning=true;timeoutDeadline=performance.now()+s.timeoutRemaining*1000}render();persist()};$('timeoutEnd').onclick=endTimeout;
function populate(){ $('team0').value=s.teams[0];$('team1').value=s.teams[1];$('quarterMinutes').value=Math.floor(s.quarterSec/60);$('quarterSeconds').value=s.quarterSec%60;$('timeoutDuration').value=s.timeoutSec;$('timeoutLimit').value=s.timeoutLimit;$('overtimeMinutes').value=s.otSec/60;$('autoShot').checked=s.autoShot;$('shortBreak').value=s.shortBreakSec/60;$('halfBreak').value=s.halfBreakSec/60;$('otBreak').value=s.otBreakSec/60};
$('currentMinutes').addEventListener('input',()=>{clockDirty=true});$('currentSeconds').addEventListener('input',()=>{clockDirty=true});
$('saveSettings').onclick=()=>{
 const q=clamp($('quarterMinutes').value,0,99)*60+clamp($('quarterSeconds').value,0,59);
 if(q===0){notice('Quarter duration must be at least 1 second.');return}
 let corrected=null;
 if(clockDirty){
  const m=$('currentMinutes').value.trim(),sec=$('currentSeconds').value.trim();
  if(!/^\d{1,2}$/.test(m)||!/^\d{1,2}$/.test(sec)||Number(sec)>59){notice('Game clock: enter minutes 0–99 and seconds 0–59.');return}
  if(s.timeoutTeam!==null||s.breakActive){notice('End the active timeout or break before correcting the game clock.');return}
  corrected=Number(m)*60+Number(sec);
 }
 pauseGame();pauseShot();pauseTimeout();
 s.teams=[$('team0').value.trim()||'HOME',$('team1').value.trim()||'AWAY'];s.quarterSec=q;s.otSec=clamp($('overtimeMinutes').value,1,30)*60;s.timeoutSec=clamp($('timeoutDuration').value,1,600);s.timeoutLimit=clamp($('timeoutLimit').value,0,20);s.autoShot=$('autoShot').checked;s.shortBreakSec=clamp($('shortBreak').value,0,60)*60;s.halfBreakSec=clamp($('halfBreak').value,0,60)*60;s.otBreakSec=clamp($('otBreak').value,0,60)*60;if(s.timeoutTeam===null)s.timeoutRemaining=s.timeoutSec;
 if(corrected!==null){s.gameSec=corrected;s.breakPending=false;if(corrected===0)queueBreak()}
 clockDirty=false;render();persist();notice(corrected===null?'Settings saved. Game clock preserved.':corrected===0?'Settings saved. Game clock set to 00:00.':'Settings saved. Game clock set to '+fmt(corrected)+'. Press Start to resume.');
};
$('undoTimeout').onclick=()=>{if(s.timeoutTeam!==null){notice('End the active timeout before undoing.');return}if(s.lastTimeout===null){notice('No timeout to undo.');return}const i=s.lastTimeout;s.timeoutUsed[i]=Math.max(0,s.timeoutUsed[i]-1);s.lastTimeout=null;render();persist();notice('Last timeout count restored.')};
$('newMatch').onclick=()=>{if(!confirm('Start a new game? Reset ALL scores, clocks, team names, possession and settings to defaults?'))return;pauseAll();stopBuzzer();s=defaults();clockDirty=false;populate();render();persist();notice('New game ready. All values and settings reset to defaults.')};

populate();render();persist();if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
})();

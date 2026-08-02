import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const c = await b.newContext({ viewport:{width:390,height:844}, serviceWorkers:'block' });
const p = await c.newPage();
p.on('pageerror', e=>console.log('PAGEERROR:',e.message));
await c.addInitScript(()=>{['bb_name','bb_pseudo'].forEach(k=>localStorage.setItem(k,'Tester'));localStorage.setItem('bb_welcome_seen','1');localStorage.setItem('bb_tutorial_done','1');localStorage.setItem('bb_home_card','1');localStorage.setItem('bb_home_card_v2','1');localStorage.setItem('bb_lang','fr');localStorage.setItem('bb_pseudo_confirmed','1');localStorage.removeItem('bb_findplayer_pts');});
await p.goto('http://localhost:4173/',{waitUntil:'domcontentloaded',timeout:20000}); await p.waitForTimeout(2500);
await p.locator('img[src="/reveal-card.png"]').first().click({timeout:5000}).catch(async()=>{await p.mouse.click(195,300);}); await p.waitForTimeout(1000);
console.log('SCORE pill initial:', (await p.evaluate(()=>document.body.innerText)).match(/SCORE : [\d\s.,]+/)?.[0]);
let won=false;
for(let i=0;i<70 && !won;i++){
  const dice=p.locator('button[aria-label="Joueur au hasard"]').first();
  if(!(await dice.isVisible().catch(()=>false))){ won=true; break; }
  await dice.click({timeout:3000}).catch(()=>{});
  await p.waitForTimeout(2900);
  won = await p.evaluate(()=>/BIEN JOUÉ/.test(document.body.innerText));
}
const txt = await p.evaluate(()=>document.body.innerText);
console.log('won:', won, '| PTS line:', (txt.match(/\+[\d\s.,]+ PTS/)||[])[0], '| SCORE pill:', (txt.match(/SCORE : [\d\s.,]+/)||[])[0]);
await p.screenshot({ path:'/tmp/claude-0/-home-user/394413bf-5e8f-5faf-90aa-93a757d7e18d/scratchpad/pts.png', fullPage:true });
await b.close();

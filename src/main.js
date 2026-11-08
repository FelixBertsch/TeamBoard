/* Entry point: global browser events, startup, offline support. Loaded last. */
window.addEventListener('hashchange',()=>{closeDrawer(false);ui.showDone=false;$('#main').scrollTop=0;window.scrollTo(0,0);render()});
/* Resize and rotation: re-render only if width or layout area changed, never on height-only changes
   (Safari changes the height when its address bar slides in and out). render() restores open inputs. */
let rz;
function onResize(){if(drag||document.querySelector('.tl-new'))return;if(layoutKey()===lastKey&&window.innerWidth===lastW)return;render()}
window.addEventListener('resize',()=>{clearTimeout(rz);applyLayout();if(layoutKey()!==lastKey){onResize();return}rz=setTimeout(onResize,150)});
/* On-screen keyboard: --kb (covered height) and --vvh (visible height) keep the bottom sheet above the keyboard. */
if(window.visualViewport){const vv=window.visualViewport,rs=document.documentElement.style;
  const upd=()=>{rs.setProperty('--kb',Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop))+'px');rs.setProperty('--vvh',Math.round(vv.height)+'px')};
  vv.addEventListener('resize',upd);vv.addEventListener('scroll',upd);upd()}

async function startup() {
  if (/[?&]demo=1/.test(location.search)) { startDemo(); return; }
  let gh = null;
  try { gh = await idbGet('github'); } catch { gh = null; }
  if (gh) await Store.resume(gh);
  else render();
}

applyLayout();
startup();
if (document.fonts?.ready) document.fonts.ready.then(() => { if (Store.mode !== 'none' && !document.querySelector('.tl-new')) render(); });

/* Offline start and home screen app. Only over http(s); the service worker is network-first. */
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !/[?&]nosw=1/.test(location.search)) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker not registered', e));
}

/* Hook for tests and the browser console. */
window.TB = { state: () => S, store: Store, demo: startDemo, connect: o => Store.connect(o) };

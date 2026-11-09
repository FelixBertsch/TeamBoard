/* Layout areas. Single source of truth: applyLayout() sets classes on <html>; CSS and render() follow them.
   phone: narrow or touch landscape (own views). rail: 700 to 1439 px (icon bar). side: from 1440 px.
   lay-land: the phone turned sideways (wider than high); the team view then shows its grid over two weeks. */
const MQ_PHONE='(max-width:699px), (pointer:coarse) and (max-height:499px)';
const isPhone=()=>matchMedia(MQ_PHONE).matches;
const isLand=()=>isPhone()&&window.innerWidth>window.innerHeight;
const layoutKey=()=>isPhone()?'phone':matchMedia('(max-width:1439px)').matches?'rail':'side';
function applyLayout(){const k=layoutKey(),c=document.documentElement.classList;
  c.toggle('lay-phone',k==='phone');c.toggle('lay-rail',k==='rail');c.toggle('lay-land',isLand());c.toggle('touch',matchMedia('(pointer:coarse)').matches);
  LABEL=k==='rail'?168:200;return k}

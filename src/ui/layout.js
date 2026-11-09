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

/* Board: the cards below the timeline on the overview and the person page (laptop and monitor). Columns of equal width, as many
   as fit (at least BOARD_COL px each, at most BOARD_MAX). The first card (tasks) heads the first column; the others go, in their
   order, into the column that is shortest at that moment. The placement is made once per board and column count and kept for the
   page session in ui.boards, so cards never jump when their content grows or shrinks: a card only moves down when one above it
   grows. A card that appears later goes to the bottom of the shortest column; a card that is gone leaves its column, and comes back
   to its place. Reloading the page or a change of the column count (window width) places all cards anew.
   Markup: boardHTML(key, [[id, html], …]); render() calls placeBoards() right after writing #main. */
const BOARD_COL=420,BOARD_MAX=4,BOARD_GAP=24;
const boardHTML=(key,cards)=>`<div class="board" data-board="${key}">${cards.filter(c=>c[1]).map(([id,h])=>`<div class="bcard" data-card="${id}">${h}</div>`).join('')}</div>`;
function placeBoards(){
  for(const el of document.querySelectorAll('#main [data-board]')){
    const key=el.dataset.board,n=Math.max(1,Math.min(BOARD_MAX,Math.floor((el.clientWidth+BOARD_GAP)/(BOARD_COL+BOARD_GAP))));
    let b=ui.boards[key];if(!b||b.n!==n)b=ui.boards[key]={n,cols:Array.from({length:n},()=>[])};
    const cards=new Map([...el.children].map(c=>[c.dataset.card,c])),cols=b.cols.map(()=>{const c=document.createElement('div');c.className='bcol';return c});
    b.cols.forEach((ids,i)=>{for(const id of ids){const c=cards.get(id);if(c){cols[i].appendChild(c);cards.delete(id)}}});
    el.style.setProperty('--n',n);el.replaceChildren(...cols);
    for(const[id,c]of cards){let i=0;for(let j=1;j<n;j++)if(cols[j].offsetHeight<cols[i].offsetHeight)i=j;
      cols[i].appendChild(c);b.cols[i].push(id)}
  }
}

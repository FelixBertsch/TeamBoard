/* Event delegation: every control carries data-action (+ data-id); the switch below runs it. */
let suppressUntil=0;
document.addEventListener('click',async e=>{
  const a=e.target.closest('[data-action]');
  if(a){const id=a.dataset.id;
    if(a.matches('.wg-b')&&Date.now()<suppressUntil)return; // the click after moving a bar in the phone grid
    switch(a.dataset.action){
      case'close-drawer':closeDrawer();break;
      case'date-pick':openDp(a);break;
      case'ack-issue':if(ackIssue(id)){save();render();toast('Als geklärt markiert',true)}break;
      case'unack-issue':S.acks=(S.acks||[]).filter(x=>x.id!==id);save();render();toast('Wieder unter „Zu klären“',true);break;
      case'show-acked':ui.showAcked=!ui.showAcked;render();break;
      case'abs-more':ui.absAll=!ui.absAll;render();break;
      case'delete':if(drawerCfg?.onDelete){const fn=drawerCfg.onDelete;closeDrawer(false);fn();render()}break;
      case'new-topic':openTopic(null,{personId:a.dataset.person||ctx().personId});break;
      case'edit-topic':openTopic(id);break;
      case'new-absence':openAbsence(null,{personId:a.dataset.person||'me'});break;
      case'edit-absence':openAbsence(id);break;
      case'edit-todo':openTodo(id);break;
      case'new-assignment':openAssignment(null,{personId:a.dataset.person||ctx().personId});break;
      case'edit-assignment':openAssignment(id);break;
      case'edit-talk':openTalk(id);break;
      case'go':closeDrawer(false);location.hash=a.dataset.v;break;
      case'hist-type':ui.hist.type=a.dataset.v;render();break;
      case'hist-more':ui.hist.weeks+=8;render();break;
      case'hist-person':ui.hist={type:'alle',pid:a.dataset.person,q:'',weeks:52};location.hash='verlauf';break;
      case'year':ui.year[a.dataset.person]=(ui.year[a.dataset.person]||+TODAY.slice(0,4))+(+a.dataset.v);render();break;
      case'new-person':openPerson(null);break;
      case'edit-person':openPerson(id);break;
      case'restore-person':{const p=S.people.find(x=>x.id===id);if(!p)break;delete p.archived;save();render();toast(`${p.name} ist wieder im Team`,true);break}
      case'contacts':openContacts();break;
      case'edit-contact':openContact(id);break;
      case'toggle':{const t=S.todos.find(x=>x.id===id);if(!t)break;
        if(t.done){reopenTodo(t);save();render();break}
        const next=completeTodo(t);save();render();toast(next?`Erledigt. Nächste fällig ${dueLabel(next.due)}`:`Erledigt: ${t.title}`,true);break}
      case'talk-done':{const t=S.talks.find(x=>x.id===id);if(!t)break;t.done=true;t.doneAt=TODAY;save();render();toast('Als besprochen markiert',true);break}
      case'talk-del':S.talks=S.talks.filter(x=>x.id!==id);save();render();toast('Punkt gelöscht',true);break;
      case'team-day':ui.tday=+a.dataset.v;render();break;
      case'team-week':ui.toff=+a.dataset.v?ui.toff+(+a.dataset.v):0;ui.tday=null;render();break;
      case'fold':{const k=a.dataset.v;ui.fold[k]=!ui.fold[k];if(k==='issues'&&!ui.fold[k])ui.redSeen=redKeys();saveUi();render();break}
      case'fold-grp':ui.grp[a.dataset.v]=!ui.grp[a.dataset.v];render();break;
      case'filter':ui.filter=a.dataset.v;ui.more=false;render();break;
      case'tab':ui.tab[route().id]=a.dataset.v;ui.showDone=false;render();break;
      case'range':ui.range=a.dataset.v;ui.off=0;saveUi();render();break;
      case'more':ui.more=true;render();break;
      case'show-done':ui.showDone=!ui.showDone;render();break;
      case'tl-prev':ui.off-=ui.range==='six'?2:1;render();break;
      case'tl-next':ui.off+=ui.range==='six'?2:1;render();break;
      case'tl-today':ui.off=0;render();break;
      case'undo':undo();break;
      case'start-demo':startDemo();break;
      case'leave-demo':closeDrawer(false);leaveDemo();break;
      case'backup-folder':Backup.choose().then(()=>{if(document.body.classList.contains('drawer-open'))openMore();render()});break;
      case'backup-allow':Backup.allow().then(()=>{if(document.body.classList.contains('drawer-open'))openMore();render()});break;
      case'disconnect':confirmDisconnect();break;
      case'export':exportData();break;
      case'import':$('#importFile').click();break;
      case'capture':openCapture('todo');break;
      case'cap-type':openCapture(a.dataset.v,($('#capText')||$('#dform [name=title]'))?.value||'');break;
      case'more-menu':openMore();break;
      case'region':closeDrawer(false);openRegion();break;
      case'tour':startTour();break;
      case'onb-quick':if(isPhone())openCapture('todo');else{const q=$('#quick');q?.scrollIntoView({block:'center'});q?.focus()}break;
      case'onb-phone':phoneHint();break;
      case'onb-hide':hideFirstSteps();break;
      case'reload':location.reload();break;
    }
    return;
  }
  const mark=e.target.closest('.tmark.multi');
  if(mark){showPop(mark,true);return}
  const track=e.target.closest('.tl-track');
  if(track&&!e.target.closest('.bar,.wbar,.tchip,.tmark,.tl-new')&&Date.now()>suppressUntil){
    const day=dayAt(track,e.clientX),pid=track.dataset.person;
    if(T.fine)openTodo(null,{personId:pid,due:ds(day)});else openTopic(null,{personId:pid,start:ds(day),end:ds(day+4)});
  }
});
document.addEventListener('submit',e=>{if(e.target.id==='setupForm'){e.preventDefault();submitSetup(e.target);return}
  if(e.target.id!=='dform')return;e.preventDefault();
  if(!drawerCfg?.onSubmit)return;const{v,bad}=formValues(e.target);
  if(bad){$('#drawer .d-err').textContent='Bitte gib das Datum als TT.MM.JJJJ ein, zum Beispiel 06.11.2026.';bad.focus();return}
  const err=drawerCfg.onSubmit(v);if(err===KEEP_OPEN)return;if(err){$('#drawer .d-err').textContent=err;return}closeDrawer(false);render()});
document.addEventListener('input',e=>{const el=e.target;
  if(suggestField(el)){fieldChanged(el);updateSuggest(el);return}
  if(drawerCfg?.capture&&el.closest('#dform'))capPreview();
  if(el.id==='histSearch'){ui.hist.q=el.value;render()}
  if(el.name==='project'&&drawerCfg?.assignment==='new'){const last=[...S.assignments].reverse().find(a=>fold(a.project)===fold(el.value.trim()));
    if(last)el.form.querySelector(`input[name=billable][value=${last.billable?'ja':'nein'}]`).checked=true}});
/* Suggestion list: pick with pointer before the field loses focus; caret moves and focus loss update or close it. */
document.addEventListener('pointerdown',e=>{const li=e.target.closest('#sugList li');if(!li||!sug)return;e.preventDefault();pickSuggest(+li.dataset.i)});
document.addEventListener('mousedown',e=>{if(e.target.closest('#sugList'))e.preventDefault()});
document.addEventListener('keyup',e=>{if(suggestField(e.target)&&/^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key))updateSuggest(e.target)});
document.addEventListener('focusout',e=>{if(sug&&e.target===sug.input)closeSuggest()});
document.addEventListener('change',e=>{if(e.target.id==='histPerson'){ui.hist.pid=e.target.value;render()}
  if(e.target.id==='forPerson'){ui.forPid=e.target.value;ui.showDone=false;render()}});
/* Date fields (phone): the native picker writes TT.MM.JJJJ into the text field; typed dates move the picker and are tidied on leaving the field.
   Every device: a start field with data-to pushes its end along when the end lies before the new start (an empty end stays empty). */
document.addEventListener('change',e=>{const el=e.target;
  if(el.matches('.date-pick input')){const t=el.closest('.date-in').querySelector('[data-date]');t.value=deDate(el.value);t.dispatchEvent(new Event('change',{bubbles:true}));return}
  if(el.matches('[data-date]')){const iso=parseDeDate(el.value);if(iso)el.value=deDate(iso);const n=el.closest('.date-in').querySelector('input[type=date]');if(n)n.value=iso||'';
    const to=el.dataset.to&&el.form?.elements[el.dataset.to],end=to&&parseDeDate(to.value);
    if(iso&&end&&end<iso){to.value=deDate(iso);to.dispatchEvent(new Event('change',{bubbles:true}))}}});
document.addEventListener('click',e=>{const p=e.target.closest('.date-pick input');if(!p||document.documentElement.classList.contains('touch'))return;
  try{p.showPicker()}catch(err){}}); // Chrome/Edge open the picker only via its own icon; touch devices open it on tap
/* Capture sheet: due chips and the custom date field are mutually exclusive. */
document.addEventListener('change',e=>{const f=e.target.form;if(!f||f.id!=='dform'||!drawerCfg?.capture)return;
  if(e.target.name==='dueDate'&&e.target.value)f.querySelectorAll('input[name=due]').forEach(r=>r.checked=false);
  if(e.target.name==='due'&&f.dueDate){f.dueDate.value='';const n=f.querySelector('.date-pick input');if(n)n.value=''}capPreview()});
document.addEventListener('keydown',e=>{
  if(Store.mode==='none'||$('#dlg.open')){if(e.key==='Escape'&&$('#dlg.open')){closeDialog()}return}
  if(suggestKey(e)||dpKey(e))return;
  if(e.key==='Escape'&&pop){hidePop();return}
  const open=document.body.classList.contains('drawer-open');
  if(e.key==='Escape'&&open){closeDrawer();return}
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if(!typing&&!open&&(e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return}
  if(!typing&&!open&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    const k=e.key.toLowerCase();
    if(k==='n'){e.preventDefault();$('#quick')?.focus();return}
    if(k==='w'){ui.range='week';ui.off=0;saveUi();render();return}
    if(k==='2'){ui.range='two';ui.off=0;saveUi();render();return}
    if(k==='6'){ui.range='six';ui.off=0;saveUi();render();return}
  }
  if(e.target.id==='quick'){if(e.key==='Enter'){e.preventDefault();quickAdd()}
    if(e.key==='Escape'){e.target.value='';$('#qprev').innerHTML=previewHTML('');e.target.blur()}return}
  if(e.target.dataset?.add==='talk'&&e.key==='Enter'){const text=e.target.value.trim();if(!text)return;
    e.target.value='';S.talks.push(newEntry({personId:e.target.dataset.person,text,done:false}));save();render();$('.inline-add')?.focus();return}
  if((e.key==='Enter'||e.key===' ')&&e.target.classList){
    if(e.target.classList.contains('bar')){e.preventDefault();openTopic(e.target.dataset.id)}
    else if(e.target.classList.contains('tchip')){e.preventDefault();openTodo(e.target.dataset.todo)}
    else if(e.target.classList.contains('tmark')){e.preventDefault();if(e.target.dataset.todo)openTodo(e.target.dataset.todo);else{showPop(e.target,true);$('#tlPop button')?.focus()}}
  }
});

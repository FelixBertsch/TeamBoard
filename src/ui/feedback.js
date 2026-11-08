/* Feedback: toast messages (optionally with undo) and a modal dialog. */
let toastT=null;
function toast(msg,withUndo){clearTimeout(toastT);const el=$('#toast');
  el.innerHTML=`<span>${esc(msg)}</span>${withUndo?'<button data-action="undo">Rückgängig</button>':''}`;el.classList.add('show');
  toastT=setTimeout(()=>el.classList.remove('show'),withUndo?6000:2400)}

/* showDialog({ title, text (HTML, escape user data), actions: [{ label, kind, run }] }) */
function showDialog({ title, text, actions }) {
  const el = $('#dlg');
  el.innerHTML = `<div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlgT"><h3 id="dlgT">${esc(title)}</h3><p>${text}</p><div class="actions">${actions.map((a, i) => `<button class="btn ${a.kind || 'secondary'}" data-dlg="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
  el.classList.add('open'); el._actions = actions;
  setTimeout(() => el.querySelector('[data-dlg]:last-child')?.focus(), 30);
}
function closeDialog() { const el = $('#dlg'); el.classList.remove('open'); el.innerHTML = ''; }
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-dlg]'); if (!b) return;
  const a = $('#dlg')._actions?.[+b.dataset.dlg]; closeDialog();
  if (a?.run) await a.run();
});

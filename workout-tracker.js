(function(){
  const protectedArea=document.getElementById('library-protected-content');
  const anchor=protectedArea&&protectedArea.querySelector('.section-head');
  if(!anchor)return;

  const panel=document.createElement('section');
  panel.className='workout-tracker';
  panel.setAttribute('aria-labelledby','workout-tracker-title');
  panel.innerHTML='<div class="workout-tracker-head"><div><h3 class="workout-tracker-title" id="workout-tracker-title">سجّل أوزانك وتابع تطورك</h3><p class="workout-tracker-subtitle">سجل بسيط لكل تمرين، ينحفظ على هذا الجهاز حتى لو انقطع الإنترنت.</p></div><span class="workout-tracker-pill">سجلّك الشخصي</span><button class="workout-member-notify" id="workout-member-notify" type="button">إرسال اسمي للمدرب</button></div><form id="workout-tracker-form"><div class="workout-tracker-grid"><label class="workout-tracker-field">اسم التمرين<input id="workout-exercise" name="exercise" list="workout-exercise-options" type="text" maxlength="90" placeholder="مثال: بنج برس مستوي" required></label><label class="workout-tracker-field">وزن آخر جلسة (كغم)<input id="workout-last-weight" name="lastWeight" type="number" min="0" max="9999" step="0.25" inputmode="decimal" placeholder="اتركه فارغاً إذا أول جلسة"></label><label class="workout-tracker-field">وزن هذا الأسبوع (كغم)<input id="workout-week-weight" name="weekWeight" type="number" min="0" max="9999" step="0.25" inputmode="decimal" placeholder="مثال: 40" required></label><label class="workout-tracker-field">وزنك الحالي (كغم)<input id="workout-current-weight" name="currentWeight" type="number" min="0" max="9999" step="0.25" inputmode="decimal" placeholder="مثال: 42.5" required></label><label class="workout-tracker-field">العدات<input id="workout-reps" name="reps" type="number" min="1" max="200" step="1" inputmode="numeric" placeholder="مثال: 10" required></label></div><div class="workout-tracker-actions"><button class="workout-tracker-save" id="workout-tracker-save" type="submit">حفظ سجل التمرين</button><button class="workout-tracker-cancel" id="workout-tracker-cancel" type="button" hidden>إلغاء التعديل</button><p class="workout-tracker-status" id="workout-tracker-status" role="status" aria-live="polite"></p></div></form><datalist id="workout-exercise-options"></datalist><div class="workout-history"><div class="workout-history-head"><h3>سجلاتك السابقة</h3><span class="workout-history-count" id="workout-history-count">0 سجل</span></div><ul class="workout-history-list" id="workout-history-list"></ul><p class="workout-history-empty" id="workout-history-empty">بعد ما مسجل أوزان. سجّل تمرينك الأول من الخانات أعلاه.</p><div class="workout-checkin"><div class="workout-checkin-head"><strong>متابعة الأوزان كل 10 أيام</strong><span id="workout-checkin-next">سجّل أول تمرين حتى يبدأ موعد المتابعة.</span></div><button class="workout-checkin-send" id="workout-checkin-send" type="button" disabled>إرسال أوزاني للمتابعة</button><button class="workout-checkin-confirm" id="workout-checkin-confirm" type="button" hidden>أكدت إرسال المتابعة</button><p id="workout-checkin-status" role="status" aria-live="polite">زر المتابعة يرسل السجلات الجديدة فقط إلى واتساب بعد ضغطك على إرسال.</p></div></div>';
  anchor.insertAdjacentElement('afterend',panel);

  const form=panel.querySelector('#workout-tracker-form');
  const status=panel.querySelector('#workout-tracker-status');
  const list=panel.querySelector('#workout-history-list');
  const empty=panel.querySelector('#workout-history-empty');
  const count=panel.querySelector('#workout-history-count');
  const exerciseOptions=panel.querySelector('#workout-exercise-options');
  const saveButton=panel.querySelector('#workout-tracker-save');
  const cancelButton=panel.querySelector('#workout-tracker-cancel');
  const checkinButton=panel.querySelector('#workout-checkin-send');
  const checkinConfirm=panel.querySelector('#workout-checkin-confirm');
  const checkinNext=panel.querySelector('#workout-checkin-next');
  const checkinStatus=panel.querySelector('#workout-checkin-status');
  const nameNotifyButton=panel.querySelector('#workout-member-notify');
  const fields={
    exercise:panel.querySelector('#workout-exercise'),
    lastWeight:panel.querySelector('#workout-last-weight'),
    weekWeight:panel.querySelector('#workout-week-weight'),
    currentWeight:panel.querySelector('#workout-current-weight'),
    reps:panel.querySelector('#workout-reps')
  };
  const keyPrefix='alarabin-workout-log-v1:';
  function ownerMode(){return window.__alarabinOwnerAuthorized===true}
  let editingId=null;
  let pendingFollowupAt=null;

  function memberName(){
    try{return sessionStorage.getItem('alarabin-member-name-v1')||''}catch(error){return ''}
  }
  function normalizedName(name){return name.trim().replace(/\s+/g,' ').toLocaleLowerCase('ar')}
  function storageKey(){
    const name=memberName();
    return keyPrefix+encodeURIComponent(normalizedName(name||(ownerMode()?'مصطفى قاسم':'')));
  }
  function followupKey(){
    return keyPrefix+'followup:'+encodeURIComponent(normalizedName(memberName()||(ownerMode()?'مصطفى قاسم':'')));
  }
  function readRecords(){
    try{const value=JSON.parse(localStorage.getItem(storageKey())||'[]');return Array.isArray(value)?value:[]}catch(error){return []}
  }
  function readFollowup(){
    try{return JSON.parse(localStorage.getItem(followupKey())||'{}')||{}}catch(error){return {}}
  }
  function formatNumber(value){
    if(value===null||value===undefined||value==='')return '—';
    return new Intl.NumberFormat('ar-IQ',{maximumFractionDigits:2}).format(Number(value));
  }
  function updateStatus(){
    if(!navigator.onLine){status.textContent='أنت بدون إنترنت؛ سجلاتك تنحفظ على هذا الجهاز.';return}
    status.textContent='السجل محفوظ على هذا الجهاز. إرساله للمدرب يكون من زر المتابعة كل 10 أيام.';
  }
  function recordsForFollowup(){
    const state=readFollowup();
    const last=state.lastSentAt?Date.parse(state.lastSentAt):null;
    return readRecords().filter(record=>!last||Date.parse(record.updatedAt||record.createdAt)>last);
  }
  function followupDueAt(records){
    const state=readFollowup();
    if(state.lastSentAt){
      const last=Date.parse(state.lastSentAt);
      return Number.isNaN(last)?null:last+10*24*60*60*1000;
    }
    if(!records.length)return null;
    const first=records.map(record=>Date.parse(record.createdAt)).filter(value=>!Number.isNaN(value)).sort((a,b)=>a-b)[0];
    return first===undefined?null:first+10*24*60*60*1000;
  }
  function updateCheckinUi(){
    const records=readRecords();
    const due=followupDueAt(records);
    const pending=recordsForFollowup();
    checkinConfirm.hidden=!pendingFollowupAt;
    if(!records.length){
      checkinButton.disabled=true;
      checkinNext.textContent='سجّل أول تمرين حتى يبدأ موعد المتابعة.';
      checkinStatus.textContent='سجلاتك تبقى على جهازك. ما نرسل الأوزان إلا من زر المتابعة.';
      return;
    }
    if(pendingFollowupAt){
      checkinButton.disabled=true;
      checkinNext.textContent='بانتظار تأكيد إرسال رسالة واتساب.';
      checkinStatus.textContent='بعد ما ترسل الرسالة بواتساب، ارجع واضغط «أكدت إرسال المتابعة».';
      return;
    }
    if(due&&Date.now()<due){
      const days=Math.ceil((due-Date.now())/(24*60*60*1000));
      checkinButton.disabled=true;
      checkinNext.textContent='موعد المتابعة بعد '+days+' يوم · '+new Date(due).toLocaleDateString('ar-IQ');
      checkinStatus.textContent='راح يتاح إرسال السجلات الجديدة بموعد المتابعة.';
      return;
    }
    if(!pending.length){
      checkinButton.disabled=true;
      checkinNext.textContent='موعد المتابعة حان.';
      checkinStatus.textContent='ماكو سجلات جديدة من آخر متابعة. أضف أو عدّل سجلّك حتى ترسله.';
      return;
    }
    checkinButton.disabled=false;
    checkinNext.textContent='موعد المتابعة حان · '+pending.length+' سجل جديد';
    checkinStatus.textContent='الرسالة تشمل اسمك والسجلات الجديدة فقط. اضغط إرسال بواتساب، ثم أكّد الإرسال هنا.';
  }
  function render(){
    const records=readRecords().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    list.replaceChildren();
    count.textContent=records.length+' سجل';
    empty.hidden=records.length>0;
    records.forEach(record=>{
      const item=document.createElement('li');item.className='workout-history-item';
      const info=document.createElement('div');
      const exercise=document.createElement('p');exercise.className='workout-history-exercise';exercise.textContent=record.exercise||'تمرين';
      const date=document.createElement('p');date.className='workout-history-date';
      const parsed=new Date(record.createdAt);
      date.textContent=Number.isNaN(parsed.getTime())?'':parsed.toLocaleString('ar-IQ',{dateStyle:'medium',timeStyle:'short'});
      info.append(exercise,date);
      const values=document.createElement('div');values.className='workout-history-values';
      [['آخر جلسة',record.lastWeight],['هذا الأسبوع',record.weekWeight],['الحالي',record.currentWeight]].forEach(entry=>{
        const chip=document.createElement('span');
        chip.textContent=entry[0]+': '+formatNumber(entry[1])+' كغم';
        values.append(chip);
      });
      const reps=document.createElement('span');reps.textContent='العدات: '+formatNumber(record.reps);values.append(reps);
      const controls=document.createElement('div');controls.className='workout-history-controls';
      const edit=document.createElement('button');edit.type='button';edit.className='workout-history-action';edit.textContent='تعديل';edit.setAttribute('aria-label','تعديل سجل '+(record.exercise||'التمرين'));edit.addEventListener('click',()=>startEdit(record));
      const remove=document.createElement('button');remove.type='button';remove.className='workout-history-action is-delete';remove.textContent='حذف';remove.setAttribute('aria-label','حذف سجل '+(record.exercise||'التمرين'));remove.addEventListener('click',()=>deleteRecord(record));
      controls.append(edit,remove);item.append(info,values,controls);list.append(item);
    });
    updateCheckinUi();
  }
  function resetEdit(){
    editingId=null;
    form.reset();
    saveButton.textContent='حفظ سجل التمرين';
    cancelButton.hidden=true;
    updateStatus();
  }
  function startEdit(record){
    editingId=record.id;
    fields.exercise.value=record.exercise||'';
    fields.lastWeight.value=record.lastWeight===null||record.lastWeight===undefined?'':record.lastWeight;
    fields.weekWeight.value=record.weekWeight??'';
    fields.currentWeight.value=record.currentWeight??'';
    fields.reps.value=record.reps??'';
    saveButton.textContent='حفظ التعديل';
    cancelButton.hidden=false;
    status.textContent='عدّل السجل المحدد، وبعدها اضغط حفظ التعديل.';
    fields.exercise.focus();
    panel.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function deleteRecord(record){
    if(!window.confirm('تحذف سجل تمرين '+(record.exercise||'')+' من هذا الجهاز؟'))return;
    try{
      const records=readRecords().filter(item=>item.id!==record.id);
      localStorage.setItem(storageKey(),JSON.stringify(records));
      if(editingId===record.id)resetEdit();
      render();
      status.textContent='انحذف السجل من هذا الجهاز.';
    }catch(error){status.textContent='ما كدرت أحذف السجل من هذا الجهاز.'}
  }
  function populateExerciseOptions(){
    if(!exerciseOptions)return;
    const names=Array.from(document.querySelectorAll('#exercise-grid .card .card-top h3')).map(node=>node.textContent.trim()).filter(Boolean);
    exerciseOptions.replaceChildren();
    Array.from(new Set(names)).forEach(name=>{const option=document.createElement('option');option.value=name;exerciseOptions.append(option)});
  }

  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(!memberName()&&!ownerMode()){status.textContent='افتح المكتبة باسمك الثنائي حتى ينحفظ السجل بحسابك.';return}
    const now=new Date().toISOString();
    const record={
      id:editingId||((window.crypto&&window.crypto.randomUUID)?window.crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2)),
      name:memberName()||(ownerMode()?'مصطفى قاسم':''),
      exercise:fields.exercise.value.trim(),
      lastWeight:fields.lastWeight.value===''?null:Number(fields.lastWeight.value),
      weekWeight:Number(fields.weekWeight.value),
      currentWeight:Number(fields.currentWeight.value),
      reps:Number(fields.reps.value),
      createdAt:now
    };
    if(!record.exercise){fields.exercise.focus();return}
    try{
      const records=readRecords();
      if(editingId){
        const index=records.findIndex(item=>item.id===editingId);
        if(index<0)throw new Error('السجل المحدد غير موجود');
        record.createdAt=records[index].createdAt;
        record.updatedAt=now;
        records[index]=record;
        localStorage.setItem(storageKey(),JSON.stringify(records));
        resetEdit();
        status.textContent='تعدّل السجل وانحفظ على هذا الجهاز.';
      }else{
        records.push(record);
        localStorage.setItem(storageKey(),JSON.stringify(records));
        form.reset();
        status.textContent='انحفظ سجل التمرين على هذا الجهاز. تگدر ترجع له من سجلاتك السابقة.';
      }
      render();
    }catch(error){status.textContent='ما كدرت أحفظ السجل. مساحة التخزين على الجهاز قد تكون ممتلئة.'}
  });
  cancelButton.addEventListener('click',()=>resetEdit());
  nameNotifyButton.addEventListener('click',()=>{
    const name=memberName();
    if(!name){status.textContent='افتح المكتبة باسمك الثنائي حتى ترسل اسمك.';return}
    if(!navigator.onLine){status.textContent='اتصل بالإنترنت حتى تفتح واتساب وترسل اسمك.';return}
    const message='مشترك جديد سجل بمكتبة تمارين العرابين. الاسم الثنائي: '+name;
    window.open('https://wa.me/9647711120604?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
    status.textContent='الرسالة تحتوي اسمك الثنائي فقط، بدون أوزان أو سجلات. راجعها واضغط إرسال حتى يوصل اسمك للمدرب.';
  });
  checkinButton.addEventListener('click',()=>{
    if(checkinButton.disabled)return;
    if(!memberName()){checkinStatus.textContent='افتح المكتبة باسمك الثنائي حتى ينرسل تقريرك باسمك.';return}
    if(!navigator.onLine){checkinStatus.textContent='سجلاتك محفوظة. اتصل بالإنترنت حتى تفتح واتساب وترسل المتابعة.';return}
    const records=recordsForFollowup();
    if(!records.length){updateCheckinUi();return}
    const lines=records.map(record=>{
      const last=record.lastWeight===null||record.lastWeight===undefined?'غير مسجل':formatNumber(record.lastWeight)+' كغم';
      return '• '+record.exercise+' | آخر جلسة: '+last+' | هذا الأسبوع: '+formatNumber(record.weekWeight)+' كغم | الحالي: '+formatNumber(record.currentWeight)+' كغم | العدات: '+formatNumber(record.reps);
    });
    const message='متابعة الأوزان - مكتبة العرابين\nالاسم: '+memberName()+'\nعدد السجلات الجديدة: '+records.length+'\n\n'+lines.join('\n');
    pendingFollowupAt=new Date().toISOString();
    window.open('https://wa.me/9647711120604?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
    updateCheckinUi();
  });
  checkinConfirm.addEventListener('click',()=>{
    if(!pendingFollowupAt)return;
    try{
      localStorage.setItem(followupKey(),JSON.stringify({lastSentAt:pendingFollowupAt}));
      pendingFollowupAt=null;
      updateCheckinUi();
      checkinStatus.textContent='تسجلت المتابعة. زر الإرسال الجاي يتاح بعد 10 أيام.';
    }catch(error){checkinStatus.textContent='تعذر حفظ موعد المتابعة على هذا الجهاز.'}
  });
  window.addEventListener('online',updateStatus);
  window.addEventListener('offline',updateStatus);
  window.addEventListener('pageshow',()=>{render();updateStatus()});
  const exerciseGrid=document.getElementById('exercise-grid');
  if(exerciseGrid&&window.MutationObserver)new MutationObserver(populateExerciseOptions).observe(exerciseGrid,{childList:true,subtree:true});
  populateExerciseOptions();
  render();
  updateStatus();
})();

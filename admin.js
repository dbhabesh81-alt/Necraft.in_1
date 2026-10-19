'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr=n=>'Rs. '+Number(n).toLocaleString('en-IN');
const api=async(u,o={})=>{const r=await fetch('/api'+u,{method:o.method||(o.body?'POST':'GET'),headers:{'Content-Type':'application/json'},body:o.body?JSON.stringify(o.body):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Error');return j};
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)};
const ST=['placed','pending_payment','confirmed','packed','shipped','delivered','cancelled'];let tab='dash';
const val=i=>$('#'+i).value;
async function show(){const me=await api('/me').catch(()=>null);
 if(!me||me.role!=='admin')return $('#ad').innerHTML=`<div class="box" style="max-width:400px;margin:40px auto"><h2>Admin login</h2><br><label>Email</label><input id="e" type="email"><label>Password</label><input id="p" type="password"><button class="btn" id="go">Login</button></div>`;
 const tabs=[['dash','Dashboard'],['orders','Manage orders'],['products','Manage products'],['reviews','Ratings'],['msgs','Messages']];
 let h=`<div class="tabs">${tabs.map(t=>`<button class="chip ${t[0]===tab?'on':''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>`;
 try{
 if(tab==='dash'){const s=await api('/admin/stats');h+=`<div class="stat">${Object.entries({Orders:s.orders,Revenue:inr(s.revenue),'To process':s.pending,Products:s.products,Users:s.users,Messages:s.messages}).map(([k,v])=>`<div><b>${v}</b>${k}</div>`).join('')}</div>`}
 if(tab==='orders'){const o=await api('/admin/orders');h+=`<div class="sc"><table><tr><th>Order</th><th>Customer / address</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr>${o.map(x=>`<tr><td><b>${x.id}</b><br>${new Date(x.t).toLocaleString('en-IN')}</td><td>${esc(x.userName)}<br>${esc(x.address.name)}, ${esc(x.address.phone)}<br>${esc(x.address.line)}, ${esc(x.address.city)}, ${esc(x.address.state)} ${esc(x.address.pin)}</td><td>${x.items.map(i=>esc(i.name)+' x'+i.qty).join('<br>')}</td><td>${inr(x.total)}</td><td>${x.method}<br>${x.paid?'Paid':'Unpaid'}</td><td><select data-os="${x.id}">${ST.map(s=>`<option ${s===x.status?'selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('')}</table></div>`}
 if(tab==='products'){const p=await api('/admin/products');h+=`<div class="box"><h3>Add / edit product</h3><br><input type="hidden" id="pid"><label>Name</label><input id="pn"><label>Category</label><input id="pc" placeholder="Furniture, Sarees, Planters, Decor, Kitchen"><label>Price (Rs.)</label><input id="pp" type="number"><label>MRP (Rs.)</label><input id="pm" type="number"><label>Stock</label><input id="ps" type="number"><label>Description</label><textarea id="pd" rows="3"></textarea><label>Photo (PNG/JPG/WEBP, max 2.5MB)</label><input id="pf" type="file" accept="image/png,image/jpeg,image/webp"><label><input type="checkbox" id="pa" checked style="width:auto"> Visible in store</label><br><button class="btn" id="sv">Save product</button> <button class="btn line" id="cl">Clear</button></div><br><div class="sc"><table><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr>${p.map(x=>`<tr><td>${esc(x.name)}${x.active?'':' (hidden)'}</td><td>${esc(x.category)}</td><td>${inr(x.price)}</td><td>${x.stock}</td><td><button class="btn sm line" data-ed='${esc(JSON.stringify(x))}'>Edit</button> <button class="btn sm red" data-del="${x.id}">Delete</button></td></tr>`).join('')}</table></div>`}
 if(tab==='reviews'){const r=await api('/admin/reviews');h+=`<div class="sc"><table><tr><th>Product</th><th>User</th><th>Rating</th><th>Review</th><th></th></tr>${r.map(x=>`<tr><td>${esc(x.product)}</td><td>${esc(x.name)}</td><td class="stars">${'★'.repeat(x.stars)}</td><td>${esc(x.text)}</td><td><button class="btn sm red" data-dr="${x.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan=5>No ratings yet</td></tr>'}</table></div>`}
 if(tab==='msgs'){const m=await api('/admin/messages');h+=`<div class="sc"><table><tr><th>From</th><th>Message</th><th>Date</th></tr>${m.map(x=>`<tr><td>${esc(x.name)}<br>${esc(x.email)}</td><td>${esc(x.message)}</td><td>${new Date(x.t).toLocaleString('en-IN')}</td></tr>`).join('')||'<tr><td colspan=3>No messages</td></tr>'}</table></div>`}
 }catch(e){h+=`<p>${esc(e.message)}</p>`}
 $('#ad').innerHTML=h}
const fileData=f=>new Promise(ok=>{if(!f)return ok(undefined);const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(f)});
document.addEventListener('click',async e=>{const t=e.target.closest('button,a#lo');if(!t)return;const d=t.dataset;try{
 if(t.id==='lo'){e.preventDefault();await api('/logout',{body:{}});show()}
 else if(t.id==='go'){await api('/login',{body:{email:val('e'),password:val('p')}});show()}
 else if(d.t){tab=d.t;show()}
 else if(d.dr){await api('/admin/reviews/'+d.dr,{method:'DELETE'});show()}
 else if(d.del){if(confirm('Delete this product?')){await api('/admin/products/'+d.del,{method:'DELETE'});show()}}
 else if(d.ed){const x=JSON.parse(d.ed);pid.value=x.id;pn.value=x.name;pc.value=x.category;pp.value=x.price;pm.value=x.mrp;ps.value=x.stock;pd.value=x.desc;pa.checked=x.active;scrollTo({top:0,behavior:'smooth'})}
 else if(t.id==='cl')show()
 else if(t.id==='sv'){const x=await api('/admin/products',{body:{id:val('pid')||undefined,name:val('pn'),category:val('pc'),price:val('pp'),mrp:val('pm'),stock:val('ps'),desc:val('pd'),active:$('#pa').checked,imageData:await fileData($('#pf').files[0])}});toast('Saved');show()}
}catch(err){toast(err.message)}});
document.addEventListener('change',async e=>{const s=e.target.dataset.os;if(!s)return;try{await api('/admin/orders/'+s+'/status',{body:{status:e.target.value}});toast('Status updated')}catch(err){toast(err.message);show()}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&$('#go'))$('#go').click()});
show();

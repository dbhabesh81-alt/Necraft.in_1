'use strict';
// NE Craft - zero-dependency Node server (API + static). Run: node server.js
const http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=__dirname,PUB=path.join(ROOT,'public'),DBF=path.join(ROOT,'data','db.json');
try{fs.readFileSync(path.join(ROOT,'.env'),'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2]})}catch{}
const E=process.env,PORT=+E.PORT||3000;
fs.mkdirSync(path.dirname(DBF),{recursive:true});
let SECRET=E.APP_SECRET&&E.APP_SECRET.length>=16&&!E.APP_SECRET.startsWith('change-this')?E.APP_SECRET:null;
if(!SECRET){const f=path.join(ROOT,'data','.secret');if(!fs.existsSync(f))fs.writeFileSync(f,crypto.randomBytes(48).toString('hex'),{mode:0o600});SECRET=fs.readFileSync(f,'utf8')}
const uid=()=>crypto.randomBytes(8).toString('hex');
const hash=p=>{const s=crypto.randomBytes(16);return s.toString('hex')+':'+crypto.scryptSync(p,s,64).toString('hex')};
const check=(p,h)=>{try{const[s,k]=h.split(':');return crypto.timingSafeEqual(crypto.scryptSync(p,Buffer.from(s,'hex'),64),Buffer.from(k,'hex'))}catch{return false}};
const hmac=(d,k=SECRET)=>crypto.createHmac('sha256',k).update(d).digest('hex');
const safeEq=(a,b)=>{a=Buffer.from(String(a));b=Buffer.from(String(b));return a.length===b.length&&crypto.timingSafeEqual(a,b)};
// ---------- DB (JSON file, atomic writes) ----------
const SEED=[
['Classic Cane Arm Chair','Furniture',8900,11125,'Hand-woven natural cane arm chair with sturdy wooden frame.',20],
['Cane Sofa Set (3+1+1)','Furniture',54900,68625,'Five-seater natural cane sofa set with cushions. Made to order.',5],
['Rattan Accent Chair','Furniture',12500,15625,'Curved-back rattan accent chair for living room or balcony.',12],
['Cane Weave Stool','Furniture',3500,4375,'Light, strong cane stool. Use as seat, side table or ottoman.',30],
['Handloom Cotton Saree','Sarees',2800,3500,'Soft handloom cotton saree woven by North-East artisans.',25],
['Handloom Silk Saree','Sarees',6500,8125,'Traditional handloom silk saree with woven border.',10],
['Gamosa Border Saree','Sarees',1800,2250,'Light handloom saree with traditional gamosa motif border.',18],
['Hanging Cane Planter','Planters',950,1190,'Cane-woven hanging planter with jute rope.',40],
['Bamboo Planter Set of 3','Planters',1400,1750,'Three bamboo planters in graded sizes for indoor plants.',35],
['Floor Cane Planter','Planters',1800,2250,'Tall floor planter, hand-woven cane over a sturdy base.',15],
['Bamboo Serving Tray','Kitchen',750,940,'Handmade bamboo tray with cane handles.',50],
['Cane Laundry Basket','Decor',1600,2000,'Lidded handwoven cane basket for laundry or storage.',22],
['Rattan Wall Mirror','Decor',3200,4000,'Round wall mirror framed in natural rattan weave.',14],
['Bamboo Table Lamp','Decor',1500,1875,'Warm-glow table lamp with bamboo and cane shade.',28]];
let db;
try{db=JSON.parse(fs.readFileSync(DBF,'utf8'))}catch{db={users:[],products:[],orders:[],reviews:[],messages:[]}}
const save=()=>{const t=DBF+'.tmp';fs.writeFileSync(t,JSON.stringify(db));fs.renameSync(t,DBF)};
if(!db.products.length)db.products=SEED.map(p=>({id:uid(),name:p[0],category:p[1],price:p[2],mrp:p[3],desc:p[4],stock:p[5],image:'',active:true}));
const AE=(E.ADMIN_EMAIL||'necraft.in@gmail.com').toLowerCase();
if(!db.users.find(u=>u.email===AE))db.users.push({id:uid(),name:'Admin',email:AE,phone:'',pass:hash(E.ADMIN_PASSWORD||'Nilabh124'),role:'admin',addresses:[]});
save();
// ---------- helpers ----------
const SEC={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(),microphone=(),geolocation=()',
'Content-Security-Policy':"default-src 'self'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src https://api.razorpay.com https://checkout.razorpay.com; connect-src 'self' https://lumberjack.razorpay.com https://api.razorpay.com; form-action 'self'; base-uri 'self'; object-src 'none'"};
const send=(res,code,obj,h={})=>{const b=JSON.stringify(obj);res.writeHead(code,{...SEC,'Content-Type':'application/json','Cache-Control':'no-store',...h});res.end(b)};
const fail=(c,m)=>{const e=new Error(m);e.code=c;return e};
const rl=new Map();
const limit=(ip,k,max,win)=>{const key=k+ip,n=Date.now(),r=rl.get(key);if(!r||n>r.t){rl.set(key,{n:1,t:n+win});return}if(++r.n>max)throw fail(429,'Too many requests. Please wait and try again.')};
setInterval(()=>{const n=Date.now();for(const[k,v]of rl)if(n>v.t)rl.delete(k)},60000).unref();
const body=(req,max=3e6)=>new Promise((ok,no)=>{const c=[];let n=0;req.on('data',d=>{n+=d.length;if(n>max){no(fail(413,'Too large'));req.destroy()}else c.push(d)});req.on('end',()=>ok(Buffer.concat(c)));req.on('error',no)});
const token=id=>{const p=id+'.'+(Date.now()+7*864e5);return p+'.'+hmac(p)};
const who=req=>{const m=(req.headers.cookie||'').match(/(?:^|;\s*)nt=([^;]+)/);if(!m)return null;const[i,e,s]=m[1].split('.');if(!s||!safeEq(hmac(i+'.'+e),s)||+e<Date.now())return null;return db.users.find(u=>u.id===i)||null};
const cookie=(v,age)=>`nt=${v}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${E.COOKIE_SECURE==='1'?'; Secure':''}`;
const pub=u=>({id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role});
const str=(v,n=200)=>String(v==null?'':v).trim().slice(0,n);
const must=u=>{if(!u)throw fail(401,'Please login first');return u};
const adminOnly=u=>{if(!must(u)||u.role!=='admin')throw fail(403,'Admin only');return u};
const rzp=(p,b)=>new Promise((ok,no)=>{if(!E.RAZORPAY_KEY_ID||!E.RAZORPAY_KEY_SECRET)return no(fail(503,'Online payment is not configured yet. Please use COD.'));const d=JSON.stringify(b);const r=https.request({host:'api.razorpay.com',path:p,method:'POST',auth:E.RAZORPAY_KEY_ID+':'+E.RAZORPAY_KEY_SECRET,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}},s=>{let t='';s.on('data',c=>t+=c);s.on('end',()=>{try{const j=JSON.parse(t);s.statusCode<300?ok(j):no(fail(502,'Payment gateway error'))}catch{no(fail(502,'Payment gateway error'))}})});r.on('error',()=>no(fail(502,'Payment gateway unreachable')));r.setTimeout(15000,()=>r.destroy());r.end(d)});
function confirm(o,payId){ // idempotent: safe to call from verify AND webhook
  if(o.paid)return;o.paid=true;o.paymentId=payId||o.paymentId;o.status='confirmed';o.history.push({s:'confirmed',t:Date.now()});
  if(!o.stockCut){o.stockCut=true;o.items.forEach(i=>{const p=db.products.find(x=>x.id===i.id);if(p)p.stock=Math.max(0,p.stock-i.qty)})}save()}
const avg=id=>{const r=db.reviews.filter(x=>x.productId===id);return{rating:r.length?Math.round(r.reduce((a,b)=>a+b.stars,0)/r.length*10)/10:0,reviews:r.length}};
const STAT=['placed','pending_payment','confirmed','packed','shipped','delivered','cancelled'];
// ---------- API ----------
async function api(req,res,url,ip){
  const m=req.method,p=url.pathname.slice(4),seg=p.split('/').filter(Boolean);
  if(m!=='GET'&&p!=='/webhook/razorpay'&&!(req.headers['content-type']||'').includes('application/json'))throw fail(415,'JSON required');
  limit(ip,'g',300,6e4);
  let raw=m==='GET'||m==='DELETE'?Buffer.alloc(0):await body(req,p.startsWith('/admin/products')?4e6:2e5);
  if(p==='/webhook/razorpay'){ // server-to-server payment confirmation (covers "paise kate but order confirm nahi hua")
    const sec=E.RAZORPAY_WEBHOOK_SECRET;if(!sec||!safeEq(hmac(raw,sec),req.headers['x-razorpay-signature']||''))throw fail(400,'bad signature');
    const ev=JSON.parse(raw),pay=ev.payload&&ev.payload.payment&&ev.payload.payment.entity;
    if(pay&&(ev.event==='payment.captured'||ev.event==='order.paid')){const o=db.orders.find(x=>x.rzpOrderId===pay.order_id);if(o&&pay.amount===o.total*100)confirm(o,pay.id)}
    return send(res,200,{ok:1})}
  const b=raw.length?JSON.parse(raw):{},me=who(req);
  if(p==='/register'&&m==='POST'){limit(ip,'a',10,9e5);const email=str(b.email,120).toLowerCase(),pw=String(b.password||'');
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw fail(400,'Valid email required');if(pw.length<8)throw fail(400,'Password must be at least 8 characters');
    if(db.users.find(u=>u.email===email))throw fail(409,'Email already registered');
    const u={id:uid(),name:str(b.name,80)||'Customer',email,phone:str(b.phone,15),pass:hash(pw),role:'user',addresses:[]};db.users.push(u);save();
    return send(res,200,pub(u),{'Set-Cookie':cookie(token(u.id),604800)})}
  if(p==='/login'&&m==='POST'){limit(ip,'a',10,9e5);const u=db.users.find(x=>x.email===str(b.email,120).toLowerCase());
    if(!u||!check(String(b.password||''),u.pass))throw fail(401,'Wrong email or password');return send(res,200,pub(u),{'Set-Cookie':cookie(token(u.id),604800)})}
  if(p==='/logout')return send(res,200,{ok:1},{'Set-Cookie':cookie('',0)});
  if(p==='/me')return send(res,200,me?pub(me):null);
  if(p==='/contact'&&m==='POST'){limit(ip,'c',5,36e5);if(!str(b.message))throw fail(400,'Message required');db.messages.push({id:uid(),name:str(b.name,80),email:str(b.email,120),message:str(b.message,2000),t:Date.now()});save();return send(res,200,{ok:1})}
  if(p==='/products'&&m==='GET')return send(res,200,db.products.filter(x=>x.active).map(x=>({...x,...avg(x.id)})));
  if(seg[0]==='products'&&seg[1]&&m==='GET'){const x=db.products.find(y=>y.id===seg[1]&&y.active);if(!x)throw fail(404,'Not found');return send(res,200,{...x,...avg(x.id),list:db.reviews.filter(r=>r.productId===x.id).map(r=>({name:r.name,stars:r.stars,text:r.text,t:r.t}))})}
  if(seg[0]==='products'&&seg[2]==='review'&&m==='POST'){must(me);const s=Math.round(+b.stars);if(!(s>=1&&s<=5))throw fail(400,'Rating 1-5');
    db.reviews=db.reviews.filter(r=>!(r.productId===seg[1]&&r.userId===me.id));db.reviews.push({id:uid(),productId:seg[1],userId:me.id,name:me.name,stars:s,text:str(b.text,600),t:Date.now()});save();return send(res,200,{ok:1})}
  if(p==='/addresses'){must(me);if(m==='GET')return send(res,200,me.addresses);
    if(m==='POST'){const a={id:uid(),name:str(b.name,80),phone:str(b.phone,15),line:str(b.line,200),city:str(b.city,60),state:str(b.state,60),pin:str(b.pin,6)};
      if(!a.name||!/^\d{10}$/.test(a.phone)||!a.line||!a.city||!a.state||!/^\d{6}$/.test(a.pin))throw fail(400,'Fill all fields (10-digit phone, 6-digit PIN)');if(me.addresses.length>=10)throw fail(400,'Max 10 addresses');me.addresses.push(a);save();return send(res,200,a)}}
  if(seg[0]==='addresses'&&seg[1]&&m==='DELETE'){must(me);me.addresses=me.addresses.filter(a=>a.id!==seg[1]);save();return send(res,200,{ok:1})}
  if(p==='/checkout'&&m==='POST'){must(me);limit(ip,'o',20,36e5);
    const addr=me.addresses.find(a=>a.id===b.addressId);if(!addr)throw fail(400,'Select a delivery address');
    if(!Array.isArray(b.items)||!b.items.length||b.items.length>30)throw fail(400,'Cart is empty');
    const items=b.items.map(i=>{const x=db.products.find(y=>y.id===i.id&&y.active),q=Math.floor(+i.qty);if(!x||!(q>=1&&q<=20))throw fail(400,'Invalid item');if(x.stock<q)throw fail(400,x.name+' is out of stock');return{id:x.id,name:x.name,price:x.price,qty:q}}); // price ALWAYS from server
    const total=items.reduce((a,i)=>a+i.price*i.qty,0),cod=b.method==='cod';if(!cod&&b.method!=='upi')throw fail(400,'Choose payment method');
    const o={id:'NE'+Date.now().toString(36).toUpperCase()+crypto.randomBytes(2).toString('hex').toUpperCase(),userId:me.id,userName:me.name,email:me.email,items,total,address:addr,method:cod?'COD':'UPI',paid:false,status:cod?'placed':'pending_payment',history:[{s:cod?'placed':'pending_payment',t:Date.now()}],t:Date.now()};
    if(cod){o.stockCut=true;items.forEach(i=>{db.products.find(x=>x.id===i.id).stock-=i.qty})}
    else{const r=await rzp('/v1/orders',{amount:total*100,currency:'INR',receipt:o.id});o.rzpOrderId=r.id}
    db.orders.push(o);save();return send(res,200,{orderId:o.id,method:o.method,total,rzpOrderId:o.rzpOrderId,keyId:cod?undefined:E.RAZORPAY_KEY_ID})}
  if(p==='/payment/verify'&&m==='POST'){must(me);limit(ip,'v',30,36e5);const o=db.orders.find(x=>x.id===b.orderId&&x.userId===me.id&&x.method==='UPI');if(!o)throw fail(404,'Order not found');
    if(b.razorpay_order_id!==o.rzpOrderId||!safeEq(hmac(o.rzpOrderId+'|'+str(b.razorpay_payment_id,60),E.RAZORPAY_KEY_SECRET||'x'),str(b.razorpay_signature,100)))throw fail(400,'Payment verification failed');
    confirm(o,str(b.razorpay_payment_id,60));return send(res,200,{ok:1,orderId:o.id})}
  if(p==='/orders'&&m==='GET'){must(me);return send(res,200,db.orders.filter(o=>o.userId===me.id).sort((a,b)=>b.t-a.t))}
  if(seg[0]==='admin'){adminOnly(me);
    if(seg[1]==='stats')return send(res,200,{orders:db.orders.length,revenue:db.orders.filter(o=>o.paid||o.method==='COD'&&o.status==='delivered').reduce((a,o)=>a+o.total,0),pending:db.orders.filter(o=>['placed','confirmed','packed'].includes(o.status)).length,products:db.products.length,users:db.users.length,messages:db.messages.length});
    if(seg[1]==='orders'&&!seg[2])return send(res,200,[...db.orders].sort((a,b)=>b.t-a.t));
    if(seg[1]==='orders'&&seg[3]==='status'&&m==='POST'){const o=db.orders.find(x=>x.id===seg[2]);if(!o||!STAT.includes(b.status))throw fail(400,'Invalid');
      if(o.method==='UPI'&&!o.paid&&b.status!=='cancelled')throw fail(400,'Payment not received yet');
      if(b.status==='delivered'&&o.method==='COD')o.paid=true;if(b.status==='cancelled'&&o.stockCut){o.items.forEach(i=>{const p=db.products.find(x=>x.id===i.id);if(p)p.stock+=i.qty});o.stockCut=false}
      o.status=b.status;o.history.push({s:b.status,t:Date.now()});save();return send(res,200,o)}
    if(seg[1]==='reviews'&&!seg[2])return send(res,200,db.reviews.map(r=>({...r,product:(db.products.find(x=>x.id===r.productId)||{}).name})));
    if(seg[1]==='reviews'&&m==='DELETE'){db.reviews=db.reviews.filter(r=>r.id!==seg[2]);save();return send(res,200,{ok:1})}
    if(seg[1]==='messages')return send(res,200,db.messages);
    if(seg[1]==='products'&&!seg[2]&&m==='GET')return send(res,200,db.products);
    if(seg[1]==='products'&&m==='POST'){let x=db.products.find(y=>y.id===b.id);const isNew=!x;if(isNew)x={id:uid(),image:''};
      const price=Math.round(+b.price),mrp=Math.round(+b.mrp||price),stock=Math.round(+b.stock);if(!str(b.name)||!(price>0)||!(stock>=0))throw fail(400,'Name, price, stock required');
      Object.assign(x,{name:str(b.name,120),category:str(b.category,40)||'Decor',price,mrp,stock,desc:str(b.desc,1000),active:b.active!==false});
      if(b.imageData){const im=String(b.imageData).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!im)throw fail(400,'Only PNG/JPG/WEBP');const buf=Buffer.from(im[2],'base64');if(buf.length>2.5e6)throw fail(400,'Image max 2.5MB');const fn=uid()+'.'+(im[1]==='jpeg'?'jpg':im[1]);fs.writeFileSync(path.join(PUB,'uploads',fn),buf);x.image='/uploads/'+fn}
      else if(typeof b.image==='string'&&/^(\/uploads\/[\w.-]+|https:\/\/[^\s"'<>]+)$/.test(b.image))x.image=b.image;
      if(isNew)db.products.push(x);save();return send(res,200,x)}
    if(seg[1]==='products'&&m==='DELETE'){db.products=db.products.filter(x=>x.id!==seg[2]);save();return send(res,200,{ok:1})}}
  throw fail(404,'Not found')}
// ---------- static ----------
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
function serve(req,res,url){let f=decodeURIComponent(url.pathname);if(f==='/')f='/index.html';if(f==='/admin')f='/admin.html';
  const fp=path.join(PUB,f);if(!fp.startsWith(PUB+path.sep)||f.includes('\0')){res.writeHead(403);return res.end()}
  fs.readFile(fp,(e,d)=>{if(e){res.writeHead(404,SEC);return res.end('Not found')}const x=path.extname(fp).toLowerCase();
    res.writeHead(200,{...SEC,'Content-Type':MIME[x]||'application/octet-stream','Cache-Control':f.startsWith('/uploads/')?'public, max-age=2592000':'no-cache'});res.end(d)})}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://x');
  const ip=E.TRUST_PROXY==='1'?(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket.remoteAddress:req.socket.remoteAddress;
  if(url.pathname.startsWith('/api/'))await api(req,res,url,ip);else if(req.method==='GET'||req.method==='HEAD')serve(req,res,url);else{res.writeHead(405);res.end()}}
  catch(e){const c=e.code>=400&&e.code<600?e.code:(e instanceof SyntaxError?400:500);if(c===500)console.error(e);if(!res.headersSent)send(res,c,{error:c===500?'Server error':e.message})}});
if(require.main===module)server.listen(PORT,()=>console.log('NE Craft running on http://localhost:'+PORT));
module.exports=server;

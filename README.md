# NE Craft - Handicraft Store

## Chalane ka tareeka (Node.js 18+ chahiye, koi npm install nahi)
1. `node server.js`
2. Store: http://localhost:3000   Admin: http://localhost:3000/admin
3. Admin login: **necraft.in@gmail.com** / **Nilabh124**  (live karne se pehle `.env` me ADMIN_PASSWORD badal dena. Pehli baar chalne par jo password ho wahi save hota hai, isliye badalna ho to `data/db.json` delete karke dobara chalao.)
4. Test: `node test.js`

## Product photo kaise lagayein
Admin > Manage products > Edit > "Photo" choose karo. Photo `public/uploads/` me save hoti hai aur site par dikhti hai.

## Aapke 10 sawalon ke jawab
1. **Server / Backend:** Backend `server.js` (Node.js) hai. Deploy: Render / Railway / AWS Lightsail / VPS par. `.env` me `COOKIE_SECURE=1`, `TRUST_PROXY=1` karo aur HTTPS (Cloudflare ya Nginx+Let's Encrypt) lagao. Domain ko usi server se jodo.
2. **API Keys:** Sirf server ki `.env` file me (browser me kabhi nahi). `.env` ko git/zip me share mat karo. Razorpay Key Secret frontend ko bheji hi nahi jaati, sirf Key ID jaati hai. Production me hosting ke "Environment Variables" use karo.
3. **10,000+ users:** Ye version single server par ~ saikdon concurrent users aaram se sambhalta hai (static files cache + rate limit). 10,000+ ke liye: (a) JSON file ki jagah PostgreSQL/MongoDB lagao, (b) Cloudflare CDN aage lagao, (c) 2+ server instances load balancer ke peeche, (d) images S3/Cloudinary par. Ye upgrade hum tab karenge jab traffic badhe.
4. **Images:** Abhi `public/uploads/` (server disk) me, limit = server ki disk (har image max 2.5MB, sirf PNG/JPG/WEBP). Zyada traffic par Cloudinary ya AWS S3 + CDN use karo (free tier 10-25GB).
5. **Razorpay integration:** Server `/api/checkout` par Razorpay Orders API se order banata hai (amount server DB ke price se, user ka bheja price kabhi nahi). Browser me Razorpay Checkout (UPI) khulta hai. `.env` me `RAZORPAY_KEY_ID` aur `RAZORPAY_KEY_SECRET` daalo (dashboard.razorpay.com > API Keys).
6. **Payment verification:** Payment ke baad server `HMAC-SHA256(order_id|payment_id, key_secret)` banakar Razorpay ki signature se `timingSafeEqual` se match karta hai. Fake request chalti nahi.
7. **Order confirmation:** UPI order pehle `pending_payment` me rehta hai. Sirf verified signature (ya verified webhook) ke baad hi `confirmed` hota hai aur stock kam hota hai. COD order seedha `placed` hota hai.
8. **Paise kat gaye, order confirm nahi hua:** Razorpay Dashboard > Webhooks me URL `https://aapka-domain/api/webhook/razorpay` daalo, events `payment.captured` + `order.paid`, aur secret ko `.env` ke `RAZORPAY_WEBHOOK_SECRET` me rakho. Agar user ka browser/net beech me band ho jaaye, tab bhi Razorpay server se webhook aata hai aur order apne aap confirm ho jaata hai (signature + amount check ke saath, double-confirm nahi hota). Phir bhi na ho to Razorpay auto-refund karta hai (5-7 din).
9. **Database security:** Passwords scrypt + salt se hash (plain kahin nahi). Login cookie HttpOnly + SameSite=Strict + signed. Har user sirf apna data dekh sakta hai, admin routes server par role-check karte hain. XSS se bachne ke liye saara output escape hota hai + strict CSP headers. Login/register par rate-limit. Aage: DB backup roz, DB ko internet se band rakho, HTTPS compulsory.
10. **Testing (live se pehle):**
   - Payment: Razorpay **Test Mode** keys se UPI test (success/fail dono), phir webhook test, phir ek chhota real Rs.1 payment aur refund.
   - Security: `node test.js` (auth, admin block, fake payment, path traversal), password change, HTTPS check, `.env` public na ho.
   - Traffic: `npx autocannon -c 200 -d 30 https://aapka-domain/api/products` ya k6 se load test, aur CPU/RAM dekho.

## Abhi kya nahi hai (agle step me)
3D effects (aapne mana kiya), password-reset email, invoice PDF, shipping tracking API, database (PostgreSQL) upgrade.

# دليل نشر Scaleitto على استضافة Namecheap (Stellar)

هذا الدليل يشرح كيف تضع المنصة على `scaleitto.com` خطوة بخطوة، بدون أي برمجة.

> **لماذا لا نبني المشروع على الاستضافة نفسها؟** أمر البناء (`next build`) يحتاج ذاكرة أكبر مما تسمح به الاستضافة المشتركة.
> لذلك يبنيه **GitHub** تلقائياً عند كل تحديث، وأنت تنزّل النسخة الجاهزة وترفعها فقط.

---

## الخطوة 1: إنشاء قاعدة البيانات (مرة واحدة)

1. ادخل إلى **cPanel** ثم **MySQL® Databases**.
2. في **Create New Database** اكتب `scaleitto` واضغط **Create Database**.
   سيصبح الاسم الكامل مثل `abcduser_scaleitto` (cPanel يضيف اسم حسابك في البداية). **انسخه.**
3. في **MySQL Users → Add New User** أنشئ مستخدماً (مثلاً `app`) بكلمة مرور قوية. **انسخ الاسم الكامل وكلمة المرور.**
4. في **Add User To Database** اختر المستخدم وقاعدة البيانات، ثم اضغط **Add**، وفعّل **ALL PRIVILEGES**، ثم **Make Changes**.

## الخطوة 2: تنزيل النسخة الجاهزة من GitHub

1. افتح المستودع على GitHub، ثم تبويب **Actions**.
2. اختر آخر عملية **Build** عليها علامة ✅ خضراء.
3. في أسفل الصفحة، تحت **Artifacts**، اضغط **scaleitto-build** لتنزيل ملف zip.

## الخطوة 3: رفع الملفات

1. في **cPanel → File Manager** أنشئ مجلداً اسمه `scaleitto-app` في المجلد الرئيسي (بجانب `public_html` وليس داخله).
2. ادخل المجلد، واضغط **Upload**، وارفع ملف zip.
3. اضغط على ملف zip بالزر الأيمن واختر **Extract**، ثم احذف ملف zip.
4. فعّل عرض الملفات المخفية (**Settings → Show Hidden Files**) وتأكد من وجود مجلد `.next`.

## الخطوة 4: ملف الإعدادات `.env`

1. داخل `scaleitto-app` ستجد ملف `.env.example`. انسخه (**Copy**) باسم `.env`.
2. افتح `.env` بـ **Edit** واملأه:

```env
DATABASE_URL="mysql://اسم_المستخدم_الكامل:كلمة_المرور@localhost:3306/اسم_قاعدة_البيانات_الكامل"
DATABASE_POOL_SIZE=5
APP_URL="https://scaleitto.com"
ROOT_DOMAIN="scaleitto.com"
SHOP_SUBDOMAINS=false
PLATFORM_ADMIN_EMAIL="بريدك@gmail.com"
TZ="Africa/Algiers"
OPENAI_API_KEY="مفتاح OpenAI الخاص بك"
```

> `OPENAI_API_KEY` يفعّل إنشاء صفحات الهبوط بالذكاء الاصطناعي. تحصل عليه من https://platform.openai.com/api-keys
> (يجب أن يكون في حسابك رصيد). لا تشارك هذا المفتاح مع أي أحد. إذا تركته فارغاً، تبقى المنصة تعمل لكن بدون ميزات الذكاء الاصطناعي.

> ⚠️ إذا كانت كلمة مرور قاعدة البيانات تحتوي رموزاً مثل `@` أو `#` أو `/`، فاختر كلمة مرور من أحرف وأرقام فقط، لأن هذه الرموز تكسر الرابط.

## الخطوة 5: تشغيل التطبيق

1. في **cPanel → Setup Node.js App** اضغط **Create Application**.
2. املأ الحقول:
   - **Node.js version**: أعلى إصدار متاح (يجب أن يكون **20.9 أو أحدث**، والأفضل 22).
   - **Application mode**: `Production`
   - **Application root**: `scaleitto-app`
   - **Application URL**: `scaleitto.com`
   - **Application startup file**: `server.js`
3. اضغط **Create**. **لا تضغط** "Run NPM Install"، فهو غير مطلوب.

## الخطوة 6: التأكد من أن كل شيء يعمل

**لا حاجة لأي أوامر.** المنصة تنشئ جداول قاعدة البيانات بنفسها عند تشغيلها.

1. في **Setup Node.js App** اضغط **Restart**.
2. افتح في المتصفح: `https://scaleitto.com/api/health`
3. يجب أن ترى: `"database":"ok"` و `"plans":3`.

إذا رأيت شيئاً آخر بجانب `database` (مثل `error: ER_ACCESS_DENIED_ERROR`)، فراجع جدول حل المشاكل في آخر هذا الدليل، أو أرسل النص لـClaude.
هذه الصفحة لا تعرض أي كلمات مرور.

## الخطوة 7: أول دخول

1. افتح `https://scaleitto.com`.
2. اضغط "أنشئ متجرك مجاناً" وسجّل **بنفس البريد** الذي وضعته في `PLATFORM_ADMIN_EMAIL`.
3. سيظهر لك في القائمة رابط **إدارة المنصة** (باللون البرتقالي).

## الخطوة 8: شهادة SSL (https)

في **cPanel → SSL/TLS Status** اضغط **Run AutoSSL** إذا لم تكن الشهادة مفعّلة.

---

## تحديث المنصة لاحقاً

كلما أضفنا ميزات جديدة:

1. نزّل آخر **scaleitto-build** من GitHub (الخطوة 2).
2. ارفعه إلى `scaleitto-app` وفك الضغط مع **استبدال** الملفات. ملف `.env` لن يتأثر.
3. اضغط **Restart**. تحديثات قاعدة البيانات تُطبَّق تلقائياً.
4. تأكد من `https://scaleitto.com/api/health`.

## روابط المتاجر

- حالياً (`SHOP_SUBDOMAINS=false`) رابط كل متجر هو: `scaleitto.com/store/اسم-المتجر`
- لاحقاً، لتفعيل الروابط من نوع `اسم-المتجر.scaleitto.com` تحتاج:
  - سجل DNS من نوع wildcard (`*.scaleitto.com`)، وشهادة SSL wildcard. أسهل طريقة مجانية هي تمرير الدومين عبر **Cloudflare**.
  - ثم تغيير `SHOP_SUBDOMAINS=true`.
  - هذا يصبح أسهل بكثير عند الانتقال إلى **VPS**.

## عند الانتقال إلى VPS

نفس النسخة تعمل كما هي: `node server.js`، ويُفضّل تشغيلها عبر PM2 خلف Nginx. لا يلزم أي تغيير في الكود.

## حل المشاكل

| المشكلة | الحل |
|---|---|
| صفحة "Incomplete response" أو خطأ 503 | تأكد أن إصدار Node.js هو 20.9 أو أحدث، ثم اضغط Restart |
| خطأ `Access denied for user` | تحقق من `DATABASE_URL` في `.env`، ومن إضافة المستخدم إلى قاعدة البيانات بكل الصلاحيات |
| `ER_ACCESS_DENIED_ERROR` في `/api/health` | اسم المستخدم أو كلمة المرور في `DATABASE_URL` خاطئة، أو المستخدم غير مضاف لقاعدة البيانات |
| `ER_BAD_DB_ERROR` | اسم قاعدة البيانات في `DATABASE_URL` خاطئ (تذكّر البادئة مثل `abcduser_`) |
| `DATABASE_URL: MISSING` | ملف `.env` غير موجود داخل `scaleitto-app` أو اسمه خاطئ |
| "This page couldn't load" عند التسجيل | افتح `/api/health` لمعرفة السبب |
| "الذكاء الاصطناعي غير مفعّل" | أضف `OPENAI_API_KEY` في `.env` ثم Restart. تأكد أن `/api/health` يعرض `"OPENAI_API_KEY":"set"` |
| خطأ `Incorrect API key` أو `insufficient_quota` عند الإنشاء | المفتاح خاطئ أو لا يوجد رصيد في حساب OpenAI |
| خطأ `model ... does not exist` | حسابك لا يدعم النموذج الافتراضي. أضف مثلاً `OPENAI_MODEL="gpt-4.1-mini"` في `.env` ثم Restart |
| الإحصائيات اليومية بتوقيت خاطئ | تأكد من وجود `TZ="Africa/Algiers"` في `.env` |

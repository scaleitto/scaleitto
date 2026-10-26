# Scaleitto

منصة تجارة إلكترونية جزائرية متعددة المتاجر: كل تاجر يفتح متجره، ويستقبل طلبات الدفع عند الاستلام، ويدير منتجاته ومخزونه وطلباته.

Algerian multi-store e-commerce platform (cash on delivery, wilaya shipping rates, variants & stock, plans and per-shop contracts). Dashboard in Arabic, French and English.

## ما يعمل الآن
- تسجيل التاجر وإنشاء متجره، ولوحة تحكم بثلاث لغات (العربية من اليمين لليسار)
- المنتجات والمتغيرات (مقاس، لون…) وSKU والمخزون لكل متغير
- واجهة المتجر ونموذج طلب بالدفع عند الاستلام مع الولايات الـ58
- أسعار التوصيل لكل ولاية (للمنزل وللمكتب)
- إدارة الطلبات وحالاتها، مع إرجاع المخزون عند الإلغاء أو الإرجاع
- حماية من الطلبات الوهمية: التحقق من رقم الهاتف، وحد للطلبات المتكررة، وفخ للروبوتات
- لوحة إدارة المنصة: الباقات، وعقد خاص لكل متجر بسقوف وتواريخ، وتنبيهات الاستهلاك

## النشر
راجع [DEPLOYMENT.md](DEPLOYMENT.md).

## Development
```bash
cp .env.example .env    # set DATABASE_URL to a local MySQL/MariaDB
npm install
npm run db:migrate
npm run dev
```

# SmartGate — ملفات الشعار للموقع

الشعار أعيد رسمه كمسارات متجهية من المعاينة المعتمدة. الاسم بخط Montserrat ExtraBold 800 الفعلي ومحوّل إلى مسارات؛ لا يحتاج الموقع لتحميل الخط لعرض الشعار. التفاصيل هندسية منقحة وقد تختلف قليلًا عن الصورة المولدة.

## الاستخدام

- `smartgate-logo-color.svg`: الشعار الأساسي والاسم أسفل الرمز، لخلفية فاتحة.
- `smartgate-logo-white.svg`: نسخة بيضاء للخلفيات الداكنة.
- `smartgate-logo-navy.svg`: نسخة كحلية بلون واحد.
- `smartgate-symbol-*.svg`: الرمز وحده.
- `smartgate-wordmark-*.svg`: الاسم وحده.
- ملفات PNG المقابلة شفافة. استخدم SVG في الموقع كلما أمكن.
- `favicon.svg` و`favicon.ico`: أيقونة المتصفح.
- `apple-touch-icon.png`: أيقونة أجهزة Apple، بخلفية فاتحة.
- `icon-192.png` و`icon-512.png`: أيقونات بخلفية فاتحة.
- `site.webmanifest`: مثال قابل للتعديل؛ لا يستبدل إعدادات تطبيقك الحالية.

انسخ محتويات الحزمة إلى مجلد مثل `public/brand/`. عدّل المسارات أدناه إن اخترت مجلدًا آخر:

```html
<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">
<link rel="icon" href="/brand/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<!-- أضف manifest فقط إذا لم يكن للموقع واحد بالفعل -->
<link rel="manifest" href="/brand/site.webmanifest">
<img src="/brand/smartgate-logo-color.svg" alt="SmartGate" width="180" height="165">
```

لا تمدد الشعار أو تضغطه. اترك حوله فراغًا يقارب سماكة عمود البوابة على الأقل. راجع وضوح شرطات الطريق في أصغر أحجام العرض؛ الرمز أنسب من الشعار الكامل في المساحات الضيقة. `preview.png` لوحة للمراجعة وليست ملف شعار للاستخدام المباشر.

## الألوان

- كحلي: #142D4E
- بترولي: #087F8C
- خلفية فاتحة: #F4F7FA

الخط مصدره مستودع Google Fonts الرسمي، وترخيصه مرفق في FONT-LICENSE.txt.

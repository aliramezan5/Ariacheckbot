# Aria Check Calculator — Vercel Cloud

نسخه Next.js/Vercel ماشین حساب چک با محاسبه سمت سرور و Cloud History.

## قابلیت‌ها
- محاسبه دقیق اقساط با سود مرکب و کاهش مانده
- Vercel Function برای محاسبه مرجع
- Runtime Logs و زمان پاسخ سرور
- پروفایل مشتری اختیاری
- ذخیره ۱۰۰ معامله و ۵۰ مشتری
- Cloud History با Vercel Runtime Cache
- نسخه محلی همزمان برای حالت آفلاین
- Sync Key خصوصی برای بازیابی روی دستگاه دیگر
- Web Analytics و Speed Insights

## Cloud Storage
نسخه Beta از Vercel Runtime Cache استفاده می‌کند و APIها در `fra1` پین شده‌اند تا Cloud State در یک منطقه ثابت بماند. Runtime Cache بین Deployها باقی می‌ماند اما به دلیل ماهیت cache/LRU، آرشیو مالی دائمی محسوب نمی‌شود. برای نسخه production، همان API باید به Postgres (Supabase/Neon) منتقل شود.

## Vercel Root Directory
هنگام Import این repository در Vercel، Root Directory را روی `vercel-app` قرار دهید.

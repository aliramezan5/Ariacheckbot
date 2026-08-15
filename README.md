# Aria Check Bot V1

نسخه‌ی اول ربات تلگرام حسابداری آریا برای Cloudflare Workers.

## Secret موردنیاز
- `BOT_TOKEN`

توکن داخل Repository ذخیره نشده و باید فقط در Cloudflare به‌صورت Secret باقی بماند.

## تست بعد از Deploy
1. آدرس Worker را باز کنید؛ باید JSON وضعیت `ok: true` نمایش داده شود.
2. یک‌بار `/setup` را به انتهای آدرس Worker اضافه کنید.
3. سپس در Telegram به `@Ariacheckv1bot` دستور `/start` بدهید.

## نسخه V1
فعلاً فقط `/start` فعال است.

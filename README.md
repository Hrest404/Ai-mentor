# Репетитор: AI-ментор по английскому

Сервис для изучения английского и подготовки к IELTS: курс с уроками и тестами, разбор ошибок с помощью AI, интервальное повторение,
разговорник, чат-ментор, проверка произношения и текстов, IELTS Writing и Speaking, подписка PRO через Stripe.
Интерфейс на русском, учебный контент на английском. Подробный план и история этапов: [Tasks.md](Tasks.md).

**Стек:** Next.js 15 (App Router, TypeScript) · Tailwind CSS · Turso (libsql) + Drizzle ORM · better-auth · Gemini API · Stripe · Vitest.

## Быстрый старт (локально)

Нужны Node.js 22 или новее и npm.

```bash
npm install
cp .env.example .env.local
```

Откройте `.env.local` и заполните переменные (таблица ниже). Для локальной работы достаточно двух:

- `BETTER_AUTH_SECRET`: случайная строка от 32 символов, например `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`;
- `TURSO_DATABASE_URL=file:local.db`: локальная база в файле, токен не нужен.

Затем создайте таблицы, наполните курс и запустите сервер:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Сайт откроется на http://localhost:3000. Без ключей AI и Stripe всё, кроме AI-функций и оплаты, работает, а эти разделы
показывают понятное сообщение вместо ошибки.

## Переменные окружения

| Переменная | Для чего | Обязательна |
|---|---|---|
| `TURSO_DATABASE_URL` | Адрес базы: `file:local.db` локально или `libsql://<db>-<org>.turso.io` | да |
| `TURSO_AUTH_TOKEN` | Токен Turso (`turso db tokens create <db>`) | только для Turso |
| `BETTER_AUTH_SECRET` | Подпись сессий и токенов доступа к урокам, от 32 символов | да |
| `BETTER_AUTH_URL` | Адрес сайта для авторизации | да |
| `NEXT_PUBLIC_SITE_URL` | Канонический адрес: Open Graph и возврат из Stripe | да |
| `GEMINI_API_KEY` | Ключ Google AI Studio: разбор ошибок, чат, проверки, отчёты | для AI |
| `GEMINI_MODEL_FAST`, `GEMINI_MODEL_CHAT`, `GEMINI_MODEL_STRONG` | Свои модели, список через запятую (по умолчанию подобраны в `src/lib/ai/client.ts`) | нет |
| `STRIPE_SECRET_KEY` | Секретный ключ Stripe (`sk_test_…` в тестовом режиме) | для оплаты |
| `STRIPE_PRICE_ID` | Цена подписки PRO (`price_…`, периодическая) | для оплаты |
| `STRIPE_WEBHOOK_SECRET` | Секрет подписи вебхука (`whsec_…`) | для оплаты |

Файл `.env.local` в git не попадает. Никогда не публикуйте ключи.

## База данных (Turso)

1. Установите CLI и войдите: `turso auth login`.
2. Создайте базу рядом с пользователями (регион влияет на скорость каждого запроса): `turso db create ai-mentor --location <регион>`.
3. Возьмите адрес и токен: `turso db show ai-mentor --url`, `turso db tokens create ai-mentor`.
4. Впишите их в `.env.local` (или в переменные окружения хостинга) и примените схему и контент:

```bash
npm run db:migrate
npm run db:seed
```

После каждого изменения схемы: `npm run db:generate`, затем `npm run db:migrate`. После правок учебного контента в `src/content/`: `npm run db:seed`
(сид идемпотентен).

## Оплата PRO (Stripe)

1. В Stripe Dashboard в **тестовом режиме** создайте товар с периодической ценой и скопируйте `price_…` в `STRIPE_PRICE_ID`.
2. Ключ `sk_test_…` из Developers → API keys впишите в `STRIPE_SECRET_KEY`.
3. Для локальной работы вебхука установите [Stripe CLI](https://docs.stripe.com/stripe-cli) и выполните:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

   Команда напечатает `whsec_…`: это `STRIPE_WEBHOOK_SECRET` для локальной разработки.
4. Для боевого сайта создайте вебхук в Developers → Webhooks с адресом `https://<домен>/api/stripe/webhook` и событиями
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`. У него свой секрет подписи.
5. Тестовая оплата: карта `4242 4242 4242 4242`, любая будущая дата, любой CVC.

Customer Portal (смена карты, отмена подписки) настраивается автоматически при первом открытии. Доступ PRO выдаётся только при
статусе подписки `active` или `trialing` и неистёкшем оплаченном периоде.

## Деплой (Vercel или любой Node-хостинг)

1. Подключите репозиторий, задайте переменные из таблицы выше. `NEXT_PUBLIC_SITE_URL` и `BETTER_AUTH_URL` должны быть адресом вашего домена.
2. Примените миграции и сид к боевой базе (локально с боевыми `TURSO_*` или из CI): `npm run db:migrate && npm run db:seed`.
3. Сборка: `npm run build`, запуск: `npm start`. Сборка идёт через webpack, потому что Turbopack не собирает драйвер libsql.
4. Создайте боевой вебхук Stripe (пункт 4 выше).
5. Страницы с оценкой IELTS могут работать до двух минут: на Vercel для них задан `maxDuration = 120`, на других хостингах проверьте предельное время запроса.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Сервер разработки (Turbopack) |
| `npm run build` / `npm start` | Боевая сборка и запуск. Не запускайте `build`, пока работает `dev`: оба пишут в `.next` |
| `npm test` | Юнит-тесты (Vitest) |
| `npm run lint`, `npm run typecheck` | ESLint и проверка типов |
| `npm run db:migrate`, `db:generate`, `db:seed`, `db:studio` | Работа с базой |

## Структура

- `src/app`: страницы и серверные действия (маркетинговые страницы, вход, кабинет `app/`, API: чат и вебхук Stripe);
- `src/content`: учебный контент (темы, упражнения, разговорник, задания IELTS): источник правды для курса;
- `src/lib`: чистая логика (проверка ответов, лимиты, повторение, серия, IELTS, оплата, статистика) и серверные помощники, у большинства рядом `*.test.ts`;
- `src/lib/ai`: клиент Gemini, промпты, схемы ответов, защита от подмены инструкций;
- `src/db`: схема Drizzle и сид; `drizzle/`: миграции.

## Безопасность в двух словах

- Доступ к кабинету проверяется дважды: по cookie в middleware и подлинной сессией на сервере; закрытые тарифом разделы проверяются на сервере и в каждом серверном действии.
- Правильные ответы упражнений не попадают в браузер; результат урока, XP, серия и лимиты считаются на сервере.
- Webhook Stripe принимается только с верной подписью и обрабатывается идемпотентно.
- Текст пользователя в запросах к модели подаётся как данные, в ограничителях; формат ответов закреплён схемой.
- Секреты читаются только на сервере; в клиентские файлы они не попадают.

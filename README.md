# PainRadar

**Find problems worth building. Evidence first. AI second.**

PainRadar собирает публичные обсуждения и обнаруживает повторяющиеся проблемы. Исходные сигналы, факты, AI-интерпретации и продуктовые гипотезы разделены. Нет демонстрационных opportunities, вымышленных MRR, пользователей или отзывов.

## Статус поставки

Это **реализованная кодовая база первой версии, а не завершённый публичный коммерческий запуск**. Можно собрать интерфейс без секретов; рабочие данные, авторизация, почта, AI, задания и платежи требуют настройки сервисов. Архив не содержит node_modules, реальных секретов и пользовательских данных.

| Область       | Реализовано                                                                                                           | Ограничение                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| UI            | Лендинг, pricing, auth, dashboard, trending, details, watchlist, radars, notifications, reports, settings, admin      | Browser QA ещё не выполнен                                                                                |
| PostgreSQL    | Drizzle, 45 таблиц, FK, уникальные индексы, pgvector HNSW, FTS, атомарные лимиты                                      | Миграции проверены на PGlite/PostgreSQL; живой Neon не подключён                                          |
| Auth          | Better Auth, email/password, verification/resend, reset, Google/GitHub OAuth, logout, DB sessions, DB rate limiting   | Требуются OAuth приложения и почтовый провайдер; живые потоки не проверены                                |
| Источники     | SourceAdapter; HN Algolia, GitHub Issues, authorized Reddit                                                           | Страницы по 100, bounded budget и persistent continuation; provider listing limits и изменяемость выдачи остаются                       |
| Pipeline      | Normalization, hash/URL/semantic dedup, embedding cache, clustering, analysis, score, trends, snapshots, reports      | Один signal на cluster; centroid первого сигнала; пороги нуждаются в калибровке                           |
| Evidence      | Исходный текст/автор/дата/URL, ограниченный excerpt, проверка AI evidence IDs                                         | UI показывает до 50 последних сигналов; AI-анализ использует до 60                                        |
| Search        | FTS + pgvector match, industry/audience/source/score/growth/confidence/language/time/competition filters              | Vector search требует AI; FTS доступен без него; объединение candidates, не обученный reranker            |
| Radars/alerts | Keywords/exclusions/industries/source/language/threshold/frequency; in-app и email                                    | Radars фильтруют общий собранный corpus; сами не добавляют ingestion scopes                               |
| Billing       | Stripe Checkout/Portal; подписки; смена плана/отмена в Portal; подписанные webhooks; invoices; fenced synchronization, observed lifecycle history и bounded provider reconciliation                         | Требуются Stripe prices и Portal config; refunds/discount MRR отдельно не моделируются                    |
| Research      | Founder MVP generator; cited web competitor research, pricing/positioning/complaints if sourced                       | URLs проверяются на присутствие в tool sources; истинность каждого утверждения требует проверки человеком |
| API           | Hashed keys, create-once/revoke, bearer API, CSV export with formula protection                                       | API v1: signed keyset cursors, 1–100 результатов/page; CSV — до 500                                                          |
| Agency        | Teams, client workspaces, owner/admin/member и editor/viewer, shared resources, branded reports, scoped keys, signed webhooks                                                                                             | Требуются Agency Stripe price, Inngest и WEBHOOK_ENCRYPTION_KEY; живой командный сценарий не проверен                        |
| Admin         | Users/subscriptions/counts/source health/job failures/AI cost; catalog MRR/ARR estimate                               | Observed status churn доступен при достаточной истории; фактический billing MRR и source API cost неизвестны                             |
| Analytics     | Consent-only PostHog; signup/login/opportunity_opened/evidence_opened/saved/radar_created/upgrade_clicked/subscription_started; Sentry server instrumentation | Нет session replay; subscription_started проверяет активную синхронизированную подписку на странице checkout success                            |
| Deploy        | Next production build, CI workflow, Vercel-compatible Node runtime                                                    | Vercel deployment не выполнен: новый проект и секреты не настроены                                        |

## Быстрый старт

### Доработка аккаунта и запуска — 8 октября 2026

`/app/settings` позволяет изменить отображаемое имя и пароль. Смена пароля требует текущий пароль и завершает остальные сеансы. Список показывает до 100 активных собственных сеансов, дату входа и браузер; текущий сеанс помечен отдельно. `/api/account/sessions` не возвращает bearer tokens. Завершение другого сеанса проверяет владельца и origin, ограничивает частоту запросов и использует Better Auth для отзыва. Текущий сеанс завершается кнопкой Log out.

При отсутствии настройки авторизации auth endpoints возвращают читаемое сообщение. Если Resend или отправитель не настроены, регистрация, восстановление пароля и повторная отправка подтверждения останавливаются до вызова Better Auth: незавершённый аккаунт не создаётся. Вход существующих подтверждённых пользователей остаётся доступным. Это проверка наличия конфигурации, а не проверка действительности ключа или домена Resend.

Sitemap генерируется при запросе и больше не обращается к базе во время production build. Скрипты миграций, назначения администратора и переклассификации языков совместимы с запуском через tsx/CommonJS. Глобальная страница ошибок использует актуальный callback `retry` Next.js 16.3.

Деплой на Vercel уже выполнен; миграции применены к Neon PainRadar. Почта, реальные AI-запросы, hosted Inngest и платежи требуют отдельной настройки и проверки. Новые account API проверены на PostgreSQL/PGlite; визуальная проверка новой формы в браузере пока не завершена.

Node.js 22+, npm. Для просмотра интерфейса:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

`http://localhost:3000` — лендинг; `/app` — shell с честным setup-state. Пока DATABASE_URL отсутствует, приложение не симулирует авторизованного пользователя и не сохраняет бизнес-данные в localStorage. Когда база подключена, `/app` требует реальную сессию. localStorage используется только для выбора согласия на аналитику.

Для рабочего backend создайте `.env` (скрипты читают его через dotenv). Next читает `.env` и `.env.local`; держите конфигурацию согласованной. `.env*` исключены из Git, кроме примера.

1. Создайте Neon PostgreSQL с поддержкой pgvector. Запишите DATABASE_URL.
2. Укажите URL приложения и криптографически случайный BETTER_AUTH_SECRET длиной минимум 32 символа. BETTER_AUTH_URL и NEXT_PUBLIC_APP_URL должны иметь одинаковый origin.
3. Подключите Upstash Redis и Resend с верифицированным EMAIL_FROM.
4. Примените миграции:

```sh
npm run db:migrate
```

5. Зарегистрируйте настоящую учётную запись и подтвердите email.
6. Для первого администратора задайте ADMIN_EMAIL в окружении и выполните `npm run admin:grant`. Скрипт повышает роль только уже существующего верифицированного аккаунта; не создаёт пользователей.
7. Настройте scopes источников через `/admin`. HN включается с `Ask HN`; GitHub/Reddit изначально отключены.
8. Настройте OpenAI и его фактические тарифы; подключите Inngest, затем запустите сбор через `/admin`.

## Архитектура

- `src/app`: Next.js 16 App Router. Server Components читают данные; клиентские компоненты отвечают за формы и действия.
- `src/components/ui/button.tsx`: shadcn-style Button на Radix Slot/CVA; Tailwind 4 и токены в globals.css.
- `src/db`: Drizzle schema и ленивый Neon HTTP client. HTTP подходит Vercel serverless; SQL-функции выполняют многооперационные лимиты в одной PostgreSQL транзакции.
- `src/lib/sources`: тип RawSignal, runtime validation и адаптеры. Добавление источника требует нового SourceAdapter, регистрации в adapters и source record; обновите enum/validators/UI.
- `src/lib/pipeline.ts`: ingestion, dedup, embeddings, clustering, scoring, trends и snapshots.
- `src/lib/jobs.ts`: Inngest orchestration.
- `src/lib/ai.ts`: persistent response cache, distributed locking, token/cost accounting и budget reservations.
- `src/lib/security.ts`: session/RBAC/origin/input/rate-limit boundaries.
- `src/lib/research.ts`: sourced competitor research с проверкой URL citations и signal IDs для сравнения покрытия боли.
- `src/lib/market-gap.ts`: прозрачная rubric оценки неудовлетворённой потребности по исследованной выборке.
- `src/app/api`: защищённые HTTP mutations, Stripe/Inngest callbacks, bearer API.

### Почему Inngest

Inngest выполняет durable steps через HTTP endpoint Next.js, поддерживает cron/retries/concurrency и не требует постоянно работающего BullMQ worker. Это соответствует Vercel. Trigger.dev тоже подходит, но добавляет отдельный job runtime. В этой поставке Inngest orchestration сохраняет результаты шагов и не повторяет уже выполненные шаги при retry. Ограничение: оператор должен подключить Inngest к endpoint после deploy.

### Pipeline и данные

1. `collectSource` получает публичные записи, проверяет их через SourceAdapter.normalizeSignal и Zod.
2. URL канонизируется: удаляются fragment/UTM/tracking; значимые query IDs сохраняются. Content hash нормализует case, Unicode и whitespace. Уникальные ограничения source+externalId, URL и hash защищают от повторных вставок.
3. Embeddings генерируются для новых записей, сохраняются в pgvector(1536) и переиспользуются из ai_cache.
4. Semantic dedup отмечает `duplicate_of` при cosine distance < 0.025. Дубликаты сохраняются как traceable raw records, исключаются из дальнейшего scoring.
5. Clustering использует distance < 0.18. Новый cluster требует минимум 3 разных source+author identities. AI должен подтвердить isPain; ссылки evidenceIds проверяются на наличие среди отправленных сигналов.
6. Cluster анализируется повторно при изменении текста evidence. При одинаковом request срабатывает cache. Не-pain сигналы помечаются обработанными.
7. Score вычисляется по реальным signals; AI отвечает только за интерпретацию pain/intention. Неизвестная конкуренция остаётся null.
8. Trends объединяют opportunities одной отрасли при наличии минимум двух. Это детерминированное объединение, а не полноценная AI taxonomic hierarchy.
9. Первый непустой снимок дня фиксируется одним SQL INSERT SELECT с блокировкой. Повторный запуск сохраняет весь существующий день неизменным, включая старые частичные дни; поздние opportunities попадут в следующий день. Daily/weekly/monthly reports сравнивают snapshots. Если baseline отсутствует, статус New и growth null.
10. Radars обрабатываются через persistent publication queue. SQL матчит keywords/exclusions, отрасль и наличие source/language evidence; численные пороги берутся из snapshot дня, тексты и evidence — из текущих данных. Notifications и webhook outbox записываются атомарно; email доставляется отдельно.

Не используйте показатель signals как число всех людей на рынке. Один человек может оставить несколько записей; confidence отдельно учитывает независимых авторов. Cross-source identities пока не объединяются. Language detection в первой версии — упрощённый heuristic для English/Russian/undetermined.

### Scores

`src/lib/scoring.ts` содержит weights:

| Компонент          | Вес | Расчёт                                                 |
| ------------------ | --: | ------------------------------------------------------ |
| frequency          | 20% | log2(1 + mentions за 30 дней), capped 100              |
| velocity           | 20% | 7d growth against preceding equal period, mapped 0–100 |
| willingness to pay | 20% | AI inference из evidence, null если неизвестно         |
| pain intensity     | 15% | AI inference из evidence                               |
| competition gap    | 10% | null до верифицированной сравнительной оценки          |
| recency            | 10% | Убывает по возрасту самого свежего signal              |
| source diversity   |  5% | Число source types / 3                                 |

Null даёт 0 без перенормировки весов. Score не является оценкой MRR/TAM и не гарантирует покупку. High confidence требует ≥20 authors, ≥2 sources, ≥30 samples и достаточной свежести. Формулы нужны для сравнения внутри corpus, не для объективного измерения всего рынка.

### Jobs

Endpoint `/api/inngest` exports GET/POST/PUT; production Inngest должен проверять INNGEST_SIGNING_KEY. Cron `0 3 * * *` — **03:00 UTC**, а не пользовательский локальный час. Ручной запуск требует admin и same-origin.

Каждый run обрабатывает до 200 embeddings, 200 cluster seeds и 200 clusters для analysis/score. Persistent UUID cursor обходит clusters по кругу; новый прогресс записывается через compare-and-set после успешной партии. При большом corpus все scores не обновляются ежедневно. Semantic dedup проверяет до 200 pending candidates; trends обновляются bulk SQL, устаревшие industry memberships удаляются, пустые trend rows могут оставаться.

У каждого источника до 10 страниц/run (default 3), по одному durable step на страницу. До трёх типов источников и 200 analysis clusters дают до 860 шагов основного run. Это укладывается в [лимит Inngest 1000 steps](https://www.inngest.com/docs/durable-execution/limits); фактические HTTP duration и SQL performance нужно проверить на живом объёме. [Concurrency ограничивает исполняемые шаги](https://www.inngest.com/docs/durable-execution/flow-control/concurrency), а не целые логические runs: checkpoints сравнивают config/state/watermark, analysis cursor использует CAS. AI cache/locks и DB constraints обеспечивают повторяемость, но это не полная изоляция pipeline runs.

После snapshots и трёх global reports основной job ставит публикации в очередь и получает completed. Это означает завершение расчёта и enqueue, а не доставки. Минутный dispatcher claims до 5 jobs через SKIP LOCKED и запускает независимые child functions. Radar child обрабатывает до 20 страниц по 100 snapshot IDs; cursor продвигается даже для несовпавших records. Lease 20 минут обновляется каждой страницей, token блокирует устаревший worker; остаток партии освобождается для следующего claim. Workspace child генерирует только отчёты за заданный день. Weekly radars ставятся в очередь по понедельникам UTC. Отмена Agency приостанавливает tenant publications. Незавершённые jobs старше 7 дней истекают; сбои и состояния видны в admin.

Email worker выбирает до 10 актуальных eligible notifications за последние 7 дней, повторно проверяет entitlement, использует Resend timeout 15 секунд и idempotency key. Это не гарантия exactly-once; постоянные ошибки провайдера требуют вмешательства оператора. Failed pipeline/publication steps повторяются до 3 раз. Notifications, reports и webhook events имеют DB idempotence; публикация notification и её outbox выполняется одной транзакцией.

### Cost control

- `ai_cache` хранит embedding/analysis payload по SHA-256(model+version+request).
- Redis NX lock предотвращает одновременное вычисление одинакового request. Без Redis AI processing в production закрыт.
- `ai_budgets` атомарно резервирует расходы перед запросом; `ai_usage` сохраняет input/output tokens, userId, jobId, model и micros USD.
- Укажите актуальные договорные ставки в USD/1M tokens. Пустые значения блокируют AI, а не считаются бесплатными.
- Консервативная оценка input используется для reservation; после успешного response она корректируется по usage. Failed/time-out request сохраняет reservation, потому что факт списания неизвестен. Provider retries отключены; Inngest retry снова проходит budget gate.
- Research требует отдельных ставок и RESEARCH_MAX_CONTEXT_TOKENS — реального максимального context выбранной модели. Зарезервированы до 3 web tool charges; их reservation conservative и пока не корректируется по фактическому числу tool calls.
- Это operational budget guard, а не точная копия счёта провайдера. Проверяйте AI cost против billing provider. Семантический search также использует budget и записывает user usage.

## Auth/OAuth/email

Better Auth контролирует cookies, password hashing, verification, reset tokens, OAuth callbacks и origin checks своих маршрутов. В production Secure cookies. Установлены minimum password length 10, `role` с `input:false`, email verification before password login, database rate limiting.

Callback URLs:

- Google: `https://YOUR_DOMAIN/api/auth/callback/google`
- GitHub: `https://YOUR_DOMAIN/api/auth/callback/github`

OAuth кнопки отображаются только если обе переменные соответствующего провайдера настроены. Не публикуйте OAuth secrets. Страницы: `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`.

Custom mutations требуют совпадения Origin и настроенного app URL, Zod input и verified session. Admin checks повторяются на сервере. API bearer keys — случайные 256-bit tokens; stored SHA-256, display-once, revoke. Stripe/Inngest callbacks используют собственную signature authentication вместо browser Origin.

## Billing

Создайте recurring **monthly USD** Stripe prices для Pro $29 и Founder $79. Запишите их IDs. Настройте Billing Portal: разрешите cancellation, upgrades/downgrades между этими prices и нужное поведение proration.

Stripe webhook endpoint `/api/billing/webhook`, события:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Subscription state берётся из актуального Stripe retrieve, price ID определяет plan. Перед retrieve PostgreSQL выделяет generation под user-row lock; commit допускает только актуальный generation. Поздний результат получает retryable error и не помечает event обработанным, в том числе при параллельной доставке одного event. Старое subscription ID не заменяет более новую подписку: сравнивается Stripe created timestamp; для legacy projection без этого поля retrieve текущей подписки даёт baseline. Неоднозначные активные подписки, созданные в одну секунду, сохраняют текущую projection; замена в ту же секунду допускается только при завершённой текущей подписке. Новая незавершённая/неоплаченная подписка не вытесняет текущую активную или trialing подписку. Ошибки provider lookup не завершают event и требуют retry. SDK timeout — 15 секунд на запрос, automatic network retries отключены.

Принятые и игнорируемые older-subscription events, subscription projection и history коммитятся одной PostgreSQL транзакцией. History хранит свежий provider snapshot, признак его применения к projection, event type/time, observation time и transition, а не полный payload Stripe. Для existing subscriptions migration создаёт baseline в момент начала наблюдения, не выдумывает прежнюю историю или provider creation date. Checkout return URL не выдаёт доступ: доступ обновляет webhook. Agency checkout включён при настроенном STRIPE_PRICE_AGENCY. [Stripe не гарантирует порядок доставки событий](https://docs.stripe.com/webhooks); generation относится к порядку начала локальных синхронизаций, не заменяет историю provider events.

Invoices сохраняются по customer ID. Admin MRR/ARR — **catalog estimate**, не фактическая нормализованная выручка. Observed status churn — доля аккаунтов, находившихся в status=active на известном платном plan в начале окна 720 часов, у которых затем наблюдалась потеря этого состояния. Каждый аккаунт считается один раз; trialing и новые платящие после начала окна исключены из denominator, реактивация не отменяет gross loss. Scheduled cancellation сама по себе не является потерей. Процент остаётся unknown до 30 суток с начала tracking и при пустой исходной группе. Показатель основан на observed commit times: пропущенные/задержанные webhooks и промежуточные изменения между retrieve могут не попасть в него. Регулярная provider reconciliation восстанавливает наблюдаемое текущее состояние; промежуточные изменения между проверками не восстанавливаются задним числом. Удаление аккаунта каскадно удаляет его history и меняет cohort; это не финансовый audit ledger. Для точного revenue MRR/churn ещё нужен учёт discounts/currencies/intervals/refunds. Не используйте estimate в отчёте об официальных финансовых результатах.

### Регулярная сверка Stripe

Перед новым Checkout сервер создаёт/переиспользует Customer с metadata.userId и сохраняет Customer ID, не выдавая платный plan. Создание использует стабильный hashed idempotency key; SQL сохраняет уже известный canonical Customer при гонке. Поэтому новые Checkout flows можно восстановить даже при потере первого subscription webhook. Legacy accounts без Customer ID автоматически не обнаруживаются: нужна ручная привязка/сверка. Ошибка записи после provider create, выход за provider idempotency retention или удалённый Customer могут потребовать ручного исправления.

Inngest `billing-reconciliation-dispatch` запускается каждые пять минут UTC при настроенном STRIPE_SECRET_KEY. PostgreSQL SKIP LOCKED claims до 10 due accounts; lease 15 минут. Каждый account — отдельный durable child с concurrency 5, retries 3. Успешная сверка планируется через 6 часов; throughput до 120 accounts/hour, поэтому большой corpus имеет дополнительную задержку. Это периодическая сверка, не гарантия немедленного доступа при потере webhook.

Сверка читает customer-scoped subscriptions с status=all, до трёх страниц по 100 records, затем fresh retrieve текущей/выбранной подписки. Только metadata.userId и совпавший Customer допускаются к projection. Более 300 subscription records, multiple active/trialing subscriptions, неизвестный active price и ошибки lookup не считаются успешным завершением. Они сохраняют доступ без изменений и требуют retry/configuration/manual review. Invoice recovery выполняется отдельной очередью ниже; автоматические refunds и удаление дублей подписок не выполняются.

Reconciliation и webhook используют одну generation fence. History помечает сверку как `reconciliation` с отдельным UUID и без Stripe event ID/time. Commit projection/history/next-check выполняется атомарно; replay UUID не повторяет provider calls после завершения. Empty Customer создаёт наблюдение `reconciled_empty`, не платёж. Ошибки освобождают owned lease и назначают backoff 5/10/20/40/80/160/320/360 минут; старый owner не может сбросить новую lease. Admin показывает due/never/error counts, oldest success и до 10 errors из всего corpus. Hosted Inngest и живой Stripe ещё требуют acceptance.

## Продолжение сбора и API pagination

SourceAdapter.fetchPage возвращает одну страницу и nextCursor (scope/page/after). fetchSignals остаётся helper для первой страницы каждого настроенного scope; production collector использует fetchPage. HN запрашивает page/nbPages и фиксированные created_at границы; GitHub — page и updated ascending с since/upper cutoff, исключает PRs и перед каждой страницей проверяет public repository visibility; Reddit — after token и границы времени listing posts.

sources.collection_state сохраняет since/until, позицию следующей страницы, config hash и число сохранённых страниц. По умолчанию читаются три страницы на источник за pipeline run, максимум десять (админская настройка). Успешная страница вставляется одним idempotent batch, затем сохраняется checkpoint. При сбое между insert и checkpoint повторная вставка безопасна. Дата last_collected_at меняется на **конец замороженного окна только после завершения всех scopes**. В промежутке health=collecting; ошибки оставляют предыдущий checkpoint. Следующий daily/manual pipeline продолжает его, а не начинает с нового now. Завершённый incremental window имеет часовой overlap.

Админ может задать backfill start date и page budget; смена сохранённой конфигурации очищает pending state/watermark, новые records дедуплицируются с существующими. Запись checkpoint проверяет enabled, config, предыдущее collection state и completed watermark через compare-and-set. Это не даёт старому worker откатить сохранённый прогресс; повторные вставки records защищены constraints. Concurrent runs могут повторить provider requests, полной эксклюзивной lease на сбор нет.

Если HN nbHits превышает доступные provider pages, health=partial и watermark не продвигается: оператор должен сузить keywords или окно backfill. Reddit предоставляет доступное listing, а не полный архив. GitHub/Reddit выдача меняется при edits/deletions; page cursors и overlap не дают snapshot isolation или гарантии полной исторической выборки. Старые GitHub issues могут поступать по updated timestamp, но publishedAt сохраняет created_at. Уже сохранённые external IDs не перезаписывают исходный raw snapshot. Provider failures/429 прерывают текущий step с сохранением прошлых checkpoints; полный контроль квот/API costs не реализован.

Официальные контракты: [HN Algolia API](https://hn.algolia.com/api), [GitHub repository issues](https://docs.github.com/en/rest/issues/issues#list-repository-issues), [GitHub pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api), [Reddit listings](https://www.reddit.com/dev/api/#listings).

### GET /api/v1/opportunities

Authorization: Bearer pr_…; Founder/Agency для personal key или действующий workspace sponsor и доступ создателя scoped key. Каждая страница заново проверяет key revocation и entitlement.

Параметры: q, industry, audience, source, score, growth, confidence, language, range, competition=known, limit (1–100, default 50), cursor. Неизвестные параметры и выход за диапазон возвращают 400. В ответе сохраняется data и добавляется pagination: limit, hasMore, nextCursor. Для продолжения отправьте nextCursor с теми же filters; изменение limit разрешено. При nextCursor=null выдача исчерпана для текущего запроса.

Порядок score descending, UUID ascending устраняет неоднозначность при одинаковых scores. Используется keyset boundary и composite index. Курсор подписан HMAC, живёт 15 минут и привязан к API key ID и filters. Подмена, чужой ключ/filters или истечение срока → 400. Signing использует BETTER_AUTH_SECRET; ротация secret инвалидирует cursors. Это пагинация живого ranking: изменение scores, сохранений workspace или corpus между запросами может менять выдачу; для неизменяемого среза используйте dated reports. Responses имеют private/no-store.

## Agency: команды и клиентские пространства

`/app/teams` создаёт одну команду на владельца Agency, до 50 участников и 100 клиентов. Owner управляет администраторами. Team admins видят все client workspaces; обычные members получают отдельные editor/viewer assignments. Viewer читает watchlist/отчёты, editor редактирует shared watchlist/radars и создаёт scoped API keys, admin управляет брендингом, участниками и webhooks. Приглашение привязано к verified email, хранится только hash, одноразовое и действует 7 дней. Приложение возвращает invitation URL для передачи получателю; автоматическая рассылка приглашений не подключена.

Workspace entitlement зависит от **активной Agency подписки владельца**. Личная подписка участника не заменяет этот доступ. Отмена/истечение sponsor закрывает workspace, API и delivery queue. Удаление участника отзывает его ключи и assignments, сохраняя клиентские записи. SQL composite foreign keys запрещают cross-team assignments. Personal radars, watchlists и API keys имеют отдельную область, workspace radars не расходуют personal quota. До 100 radars на клиента.

Branded reports экспортируются как безопасный HTML с print stylesheet: имя бренда, цвет, клиент, наблюдаемые score/mentions/confidence и маркировка AI inference. Числа берутся из dated snapshots; заголовок и summary — метаданные на момент генерации. Формат PDF/PPT не реализован. В отчёт попадают сохранённые opportunities с snapshot за дату отчёта и watchlist save до конца этого дня. Ручная генерация использует последние 30 global report periods; background queue — три периода за конкретный день. Каждый клиентский отчёт ограничен 500 opportunities с самым высоким score (UUID для tie-break), title до 200 и summary до 1000 символов; UI и HTML обозначают это ограничение. Это не архив всего corpus. Snapshot immutable; report и webhook outbox записываются одной транзакцией. Пустые client reports не создаются.

Scoped `/api/v1/opportunities` возвращает только saved opportunities своего workspace (1–100 на страницу), повторно проверяет доступ создателя ключа. UI viewer не раскрывает API keys или webhook config.

### Outbound webhooks

Настройте WEBHOOK_ENCRYPTION_KEY (32 случайных байта в base64); ключ нужен для AES-256-GCM secrets at rest. Смена ключа требует миграции ciphertext или пересоздания webhooks. UI показывает signing secret только при создании. До десяти активных destinations на workspace; все шесть типов событий включены: new_opportunity, score_increase, mentions_spike, trend_acceleration, new_competitor, report_ready.

Destination: HTTPS, public DNS hostname, порт 443, без credentials/fragments. Каждый запрос заново проверяет DNS и использует pinned public address с исходным hostname/TLS. Private/reserved/link-local/mapped private addresses и redirects отклоняются. DNS deadline 5 секунд, HTTP deadline 10 секунд, response cap 64 KiB. Успех — только 2xx.

Inngest webhook-deliveries запускается каждую минуту; SQL FOR UPDATE SKIP LOCKED выдаёт leases до десяти delivery records. Повторы через 1/2/4/8/16 минут, максимум шесть попыток; lease expiration восстанавливает прерванные workers. Failed deliveries видны администратору, автоматического бессрочного retry нет. Отключённый destination или inactive sponsor приостанавливает queue. Доставка at least once: receiver обязан дедуплицировать X-PainRadar-Delivery и проверять X-PainRadar-Signature (t=timestamp,v1=HMAC-SHA256(secret,timestamp+"."+raw_body)) constant-time сравнением, с ограничением возраста timestamp. JSON body содержит стабильный id, type, workspaceId и data. Секреты и response body не записываются в журнал.

## Analytics и ошибки

PostHog запускается только с согласия; autocapture/session replay/pageview capture отключены. Секреты и содержимое password fields не отправляются в события. События явные: действия, открытие opportunity и подтверждённая подписка на checkout-success settings. Sentry подключается через instrumentation.ts, sendDefaultPii=false. Клиентский Sentry tracing/replay не включён.

Все custom API endpoints возвращают `{error: string}` с 400/401/403/404/409/413/429 либо generic 503, логируют unexpected server errors. Frontend показывает error state. Отсутствующий сервис не имитируется. Next error/not-found/loading boundaries покрывают страницы.

## SEO/public preview

`/opportunities/[slug]` содержит только summary, observed mentions и confidence. Полная evidence/analysis/MVP доступны в workspace с проверкой plan. `/trends/[slug]` показывает public opportunities. Есть metadata/canonical, dynamic share images, global OG, sitemap, robots и sharing URLs X/LinkedIn/Reddit/Telegram. Share buttons открывают compose pages; публикация от имени пользователя не выполняется.

## Проверки

```sh
npm run test
npm run typecheck
npm run lint
npm run build
```

Vitest: scoring, source contracts/failures, origins/RBAC/auth boundaries, Stripe signatures, research citation validation. PGlite запускает настоящий PostgreSQL engine + pgvector: все migrations, constraints, atomic quotas, cache budget race, snapshot/webhook idempotence и cascade. Fixtures существуют только в изолированных tests, не в продукте.

Playwright specs подготовлены для widths 360/375/390/768/1024/1440: landing→workspace, pricing, honest empty state, auth failure, headings, mobile nav, Escape/focus restore, focus trap, backdrop, short-screen scroll и overflow. Listing обнаруживает 36 cases; mobile-only cases пропускаются на desktop widths. При сбоях сохраняются trace/screenshots, CI загружает test-results как artifact. Эти tests предполагают environment **без production credentials**.

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

Playwright suite не прошёл: 2026-10-06 запуск остановился до открытия страниц из-за отсутствующего Chromium; установка браузера вернула повреждённый ZIP. Ранее agent-browser завершился ошибкой daemon. Browser QA не принят. HTTP smoke проверил 18 основных страниц production server без credentials: status 200, наличие h1, setup notice в workspace; это не проверка визуального layout или клиентских interactions. CI workflow содержит их запуск. Реальные OAuth, почта, Neon, Inngest scheduler, Redis и Stripe test mode нужно дополнительно проверить после конфигурации. Unit/API boundary tests не заменяют эти проверки.

## Vercel deployment

1. Поместите исходники в новый Git repository. Не коммитьте `.env`, node_modules или реальные данные.
2. Import в Vercel, framework Next.js, Node.js 22, install `npm ci`, build `npm run build`.
3. В Dashboard → Environment Variables задайте все secrets; app/auth URL — production domain. Отдельные test credentials для preview.
4. Примените migrations к отдельной Neon branch перед deployment с новым schema. Выполняйте migration command в защищённом CI, не на каждом page request.
5. Deploy. Зарегистрируйте реальные callback URLs Google/GitHub, Stripe webhook и Inngest `/api/inngest` integration.
6. Настройте source scopes, получите разрешение Reddit API, проверьте сбор и minimum-author clusters.
7. Проверьте Stripe test checkout→webhook→plan→portal→cancel, signup→verify→login→reset→logout и guest/user/admin/API-key permissions.
8. Заполните legal documents operating entity, contact, retention/refund terms; завершите browser QA. Только после этого открывайте коммерческий доступ.

**Deployment URL в этой поставке отсутствует.** Внешний production проект и credentials не созданы. Запуск без подключённых сервисов — UI/setup mode, не работающий market intelligence backend.

## Следующие незавершённые требования

2. Верифицированное competitor gap scoring для общего competitiveness ranking. В details уже есть численная оценка по cited AI comparisons; она остаётся отдельным выводом по ограниченной выборке и не подставляется в score как проверенный факт.
3. Калибровка semantic thresholds и language detection на реальном корпусе, расширение taxonomy v1 до многоуровневых themes и временной оценки отраслевых трендов. Canonical industries и multilingual ingestion/filtering уже реализованы.
4. Provider coverage beyond search/listing limits, политика удаления связанных evidence по source removal requests и проверка throughput/refresh latency bounded batches на реальном объёме. Opt-in cleanup старых unlinked payloads/cache/job logs реализована; это не полное удаление source data.
5. Полнота historical billing/invoices и legacy mapping; revenue churn, фактические финансовые/API cost metrics. Observed lifecycle/status churn, bounded subscription reconciliation и paged invoice recovery уже реализованы.
6. End-to-end live-provider/browser testing и сверка доставки аналитических событий.
7. Vercel deployment после настройки внешних сервисов.

Не называйте эту версию полностью production-ready, пока эти ограничения и живые интеграции не закрыты.

## Market gap по исследованной выборке

Research сравнивает каждое найденное решение с конкретной болью и аудиторией из максимум 15 signals. Non-unknown `solutionFit` требует retrieved source URLs и IDs именно переданных signals; membership проверяется до сохранения. Это проверка ссылок, а не независимое подтверждение смысла источника. AI должен различать full, partial, unmet и unknown: отсутствие информации не означает unmet.

Баллы: full=0, partial=50, явно подтверждённое unmet=100; среднее округляется до целого. Нужны минимум два assessed hostname (www объединён с основным именем); несколько страниц одного домена используют наиболее полное покрытие. Поддомены и разные домены одной компании не объединяются автоматически, поэтому это не счётчик независимых компаний. Unknown исключается и показывается отдельно. Пустая выборка, legacy results без solutionFit и одна оценка не дают численного балла.

Details показывает rationale, ссылки на sources и pain evidence, дату исследования и явную маркировку AI inference. Если signal уже вне 50 отображаемых evidence, ссылка заменяется сообщением. Старые исследования без solutionFit остаются читаемыми, повторный Research обновляет их независимо от 7-day cache; обычные новые результаты кешируются 7 дней. Сравнение отражает signals на момент исследования. Оценка не изменяет общий opportunity score, не измеряет размер рынка и не доказывает отсутствие других решений. Живой paid web-search вызов не выполнялся.

## Taxonomy v1 и языки сигналов

AI analysis выбирает одну из 16 фиксированных отраслевых labels (включая Other / unclear), независимо от языка evidence. Summary и labels формируются на английском для общего UI; исходные signals не переводятся и не перезаписываются. Новый analysis cache namespace v4 предотвращает повторное использование старого формата классификации. Category обновляется вместе с отраслью при повторном анализе.

`canonicalIndustry` и SQL `canonical_industry` используют одинаковый каталог с проверенными тестами русскими/английскими aliases. Canonical labels применяются к trend grouping, industry filters и radar matching; исходные legacy labels остаются в базе. Для общего trend нужна минимум пара opportunities одной известной отрасли; неизвестные labels не создают общую тему. Старые trend rows/URLs сохраняются даже после удаления memberships. Это тематическая группировка, не доказательство роста отрасли; growth по-прежнему рассчитывается для отдельных opportunities. Generic labels вроде Tools/Инструменты не определяют отрасль автоматически. Неизвестный custom radar/filter label сравнивается буквально, а явный Other / unclear охватывает нераспознанные отрасли.

Детектор franc 6.2.0 работает локально по body каждого нового signal. Каталог фильтров: en, ru, kk, uk, es, pt, fr, de, it, tr, ar, hi, zh, ja, ko, und. Он не ограничивает поиск языков этим каталогом: unsupported result остаётся und. Code blocks, inline code и URLs исключаются из sample; минимум 40 букв, максимум 6000 символов после очистки первых 12000. При отсутствии script с долей >=80% или разнице двух лучших relative scores <0.02 — und. Это консервативные эвристики, не калиброванная вероятность; смешение языков одного алфавита и short texts остаются ограничениями. Radar default English сохранён; новые языки выбираются явно. Language labels в UI/API разделены с серверным детектором, чтобы его данные не попадали в клиентский bundle.

Для существующих записей автоматического массового пересчёта нет. После настройки DATABASE_URL можно выполнить bounded maintenance:

```bash
npm run sources:reclassify-languages -- --limit=200
npm run sources:reclassify-languages -- --limit=200 --apply
npm run sources:reclassify-languages -- --limit=200 --after=UUID_FROM_NEXT_AFTER --apply
```

По умолчанию dry run; команда печатает только счётчики и nextAfter, не source content. Запись проверяет прежний language и content_hash, чтобы не перезаписать concurrent changes. Один запуск читает максимум 201 row и меняет до 200. Для строк skippedConcurrent повторно запустите ту же страницу; продвижение cursor не является snapshot всего корпуса. Живая база не изменялась. Apply migrations до запуска нового приложения: 0016 добавляет SQL taxonomy/matching functions и обновляет radar publication function, сохраняя lease/idempotency правила.

## Ограниченная очистка данных

Миграции 0017–0018 добавляют retired_at, maintenance_runs (44 tables), индексы и атомарную SQL maintenance function. Автоматическая очистка выключена по умолчанию: DATA_MAINTENANCE_ENABLED=false. Preview в admin доступен при выключенной очистке; он сохраняет только aggregate run result. Включение DATA_MAINTENANCE_ENABLED=true разрешает admin cleanup и hosted Inngest cron каждый час в :15 UTC. Каждая категория ограничена 500 items/run; more flags означают остаток очереди, а не подсчитанный полный размер.

Периоды по умолчанию: SIGNAL_PAYLOAD_RETENTION_DAYS=90 (30–3650), AI_CACHE_RETENTION_DAYS=30 (7–365), JOB_LOG_RETENTION_DAYS=90 (30–3650). Cleanup рассматривает только обработанные signals без cluster_signals links: published_at старше срока, сбор created_at минимум 7 дней назад, processed_at минимум сутки назад. Pending и связанное с карточками evidence сохраняются. Payload очищается (author/title/content/metadata/embedding), source/external ID/URL/content hash и duplicate references остаются. Поэтому exact dedup keys предотвращают recollection того же signal, но marker rows продолжают занимать место, а семантическая дедупликация без старого embedding недоступна. Это не полная source deletion или обработка запроса на удаление персональных данных.

Отдельно удаляются старые ai_cache entries и terminal completed/failed job_runs с finished_at старше периода; running/unfinished logs не удаляются. Исторические snapshots, opportunities/watchlists, billing/invoices, ai_usage, audit и publication delivery history не очищаются. Cache eviction может потребовать нового оплачиваемого AI вызова; прежний daily budget остаётся в силе.

Весь batch коммитится вместе с maintenance_runs result. Стабильный UUID обеспечивает replay без следующей партии, advisory lock исключает одновременные maintenance transactions. SQL validates periods и использует row locks/SKIP LOCKED. Guard trigger запрещает новую привязку retired signal как evidence; payload CHECK блокирует восстановление очищенных полей. Embedding selection/update исключают retired rows. SQL semantic dedup исправлен на фактический created_at (property discoveredAt в Drizzle использует именно эту колонку).

Admin route проверяет session/admin role, same origin, rate limit и strict boolean preview input; сроки берутся из server env. UI показывает aggregate preview/completion, текущие параметры и историю пяти запусков. Live flag проверяется ещё раз перед cleanup даже для frozen job policy, чтобы выключение останавливало запланированную работу. На текущей поставке живая база не изменялась; cron не проверен в hosted Inngest. Большой corpus и throughput требуют измерений; marker/active evidence retention, source takedown propagation, backup/provider copies и полный lifecycle удаления остаются отдельной работой.

## Синхронизация invoice webhooks

Migration 0019 добавляет invoice_sync_state, provider_created_at/observed_at и Customer/date index (44 tables). Подписанный event не используется как свежая financial projection: helper проверяет known Customer mapping, получает новый invoice через Stripe retrieve, проверяет invoice/Customer identity, status, paid amount, currency и HTTPS hosted URL. Generation выделяется в SQL до GET; latest claim по invoice ID завершает invoice projection + event marker атомарно. Superseded fetch возвращает retryable error без consume event. Уже завершённый event не вызывает повторный provider GET. Отдельная sync state не создаёт placeholder invoices с придуманным нулевым платежом.

Помимо invoice.paid и invoice.payment_failed подключите invoice.finalized, invoice.updated, invoice.voided и invoice.marked_uncollectible в Stripe webhook destination. Fresh retrieve обновляет amount_paid, currency, status и nullable hosted URL. Invoice handler не выдаёт subscription entitlement. Смена Customer для одного invoice ID, отсутствие mapping или его удаление во время GET запрещают commit, оставляя событие для retry/manual review. Для новых Checkout mapping уже сохраняется до начала оплаты; legacy неизвестные Customers требуют корректной ручной привязки.

Settings показывает paid amount (не сумму к оплате), статус, issued/synced dates и до 20 последних записей. Ordering использует provider creation date, а для legacy rows — recorded created_at; неизвестные historical provider dates не выдумываются. Существующие invoice rows автоматически не перечитываются миграцией. SDK timeout 15 секунд, provider GET один на обработку, без SDK retry.

Webhook sync исправляет повторные/out-of-order/parallel доставки; полностью потерянные события восстанавливаются до текущей invoice projection отдельным paged recovery ниже. Refunds/credit notes/net revenue и полноценная financial reconciliation остаются незавершёнными. Живой Stripe invoice flow и UI в браузере не проверены.

Stripe references: [webhook delivery and duplicate handling](https://docs.stripe.com/webhooks), [invoice retrieve](https://docs.stripe.com/api/invoices/retrieve).


## Восстановление пропущенных счетов

Migration 0020 добавляет invoice_reconciliation_queue (45 tables) и shared invoice observation functions. Прежние webhook SQL signatures сохранены как wrappers; миграции 0000–0019 не изменены. Inngest route регистрирует девять функций, включая отдельные invoice dispatcher/child. При STRIPE_SECRET_KEY каждые пять минут очередь добавляет до 10 отсутствующих known Customers и захватывает до 10 due pages с lease на 15 минут. Один child читает customer-scoped invoices без status filter: limit=10, created.lte от сохранённой верхней границы времени, starting_after от сохранённого последнего ID. Затем каждый invoice заново retrieve с SDK timeout 15 секунд, без SDK retry. До 11 provider requests на страницу, до 120 страниц/час при отсутствии ошибок, не гарантия времени завершения для больших очередей.

Для каждого fresh GET generation выделяется заранее через ту же per-invoice fence, что и webhook sync. Eventless observations требуют действующей owned lease; они не вставляют поддельные webhook_events. Fresh identity и mapping проверяются повторно в commit. Cursor продвигается после всех записей страницы, с compare-before-write по owner и прежнему cursor. Частичная ошибка оставляет страницу для безопасного replay; более свежий webhook может прервать устаревшую запись и вызвать retry. Has_more продолжает обход через пять минут, завершение сбрасывает cursor/boundary и планирует новый полный scan через шесть часов. Lease recovery и backoff 5/10/20/40/80/160/320/360 минут не позволяют старому owner сбросить нового.

Admin показывает known Customers, отсутствие completed scan, continuing/due/errors, oldest completion и до 10 ошибок. Пустая корректная страница без has_more завершает scan; foreign Customer, non-advancing/empty continuation, oversized page, changed fresh identity и provider errors не обозначаются успехом. Нет общего лимита 300 invoices: большая история продолжается отдельными ограниченными страницами.

Граница created ограничивает новые записи во время обхода, но Stripe pagination не является snapshot isolation: updates/deletions и новые invoices в ту же секунду могут менять выдачу. Повторный полный scan перечитывает доступную историю. Удалённый checkpoint может вызвать provider error и потребовать ручного сброса cursor/boundary после проверки оператора; автоматическое guessed completion не выполняется. Неизвестные legacy Customers сначала требуют корректного mapping. Восстанавливается текущий amount_paid/status/URL существующих invoices, не все промежуточные transitions, удалённые invoices, refunds или net revenue. Queue entries без Customer mapping не исполняются; полный account/source erasure здесь не реализован. Живой Stripe и hosted Inngest ещё не проверены.

Stripe reference: [customer-scoped invoice pagination](https://docs.stripe.com/api/invoices/list).


## Формат сумм invoice

Settings использует отдельный formatter для Stripe invoice/charge units: USD/EUR/KZT и другие проверенные two-decimal presentment currencies делятся на 100; JPY/KRW/MGA и остальные перечисленные zero-decimal currencies показываются в целых единицах. ISK/UGX сохраняют backward-compatible /100 API representation, но при нулевом остатке показываются без дробной части. HUF/TWD сохраняют две дробные цифры для charges/invoices: правила zero-decimal payouts к ним не применяются. Не используется ISO/Intl exponent как Stripe conversion policy.

Расчёт целой/дробной части идёт от integer minor units, без floating-point rounding; код валюты указан явно. Неизвестный код отображает исходное число с отметкой minor units, не guessed conversion. Невалидные, отрицательные или unsafe integer amounts показываются как Unavailable. Необычный ненулевой остаток ISK/UGX показывается точно, без скрытого округления. Formatter не меняет сохранённые суммы, provider validation, catalog MRR или entitlement; migration не нужна. Currency rules reviewed 2026-10-07 по [Stripe currencies](https://docs.stripe.com/currencies); новые supported currency codes требуют обновления проверенного списка. Browser/live Stripe acceptance остаются незавершёнными.


## Вход в Checkout и платёжный кабинет

Checkout/Portal проверяют billing configuration до создания Customer/provider session. NEXT_PUBLIC_APP_URL должен быть абсолютным HTTPS origin без credentials/path/query/hash; HTTP loopback допустим только вне production. Trailing slash нормализуется к origin. Success/cancel/return paths формируются сервером, не берутся из запроса. Missing key/price, malformed price ID или return address дают объяснимый 503; malformed application URL в общем origin guard тоже возвращает configuration error. Portal не требует STRIPE_PRICE_* и отвечает 404 при отсутствии Customer mapping. Redis/session/origin проверки сохраняются.

Checkout body принимает только plan=pro/founder/agency; произвольные user/customer/price поля запрещены. При известном active/trialing запрос новой подписки отклоняется. При сохранённом subscription ID также запрещён новый Checkout для past_due/unpaid/paused/incomplete и неизвестного нетерминального статуса. Incomplete предлагает завершить прежний checkout или обратиться в поддержку; остальные — управление прежней подпиской/поддержку. Canceled/incomplete_expired допускают повторную подписку. Это защита по локально наблюдаемой projection, не атомарная гарантия отсутствия нескольких Stripe sessions: параллельные первоначальные Checkout requests, потерянная provider response или audit failure после session create ещё требуют persisted checkout attempt/idempotency. Stale mapping/status восстанавливаются прежней periodic reconciliation; пользовательский запрос не выполняет provider subscription scan.

Server и BillingButton проверяют абсолютный HTTPS redirect без credentials; custom billing domains допустимы. Отсутствующая/небезопасная provider URL даёт 502, не successful audit. Client обрабатывает malformed/non-JSON error responses и не переходит на undefined URL. Эти проверки не подтверждают активность Price/recurrence/Portal configuration в реальном Stripe аккаунте. Миграции не изменены; live Checkout/Portal и browser interactions ещё требуют acceptance.

Stripe reference: [subscription states and recovery](https://docs.stripe.com/billing/subscriptions/overview).

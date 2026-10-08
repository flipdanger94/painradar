# Архитектурные решения

- Next.js App Router + React Server Components; Node runtime. Server-only secrets читаются только в backend modules. Нет стороннего UI, имитирующего реальные данные.
- Neon через HTTP; для конкурентных квот используются PostgreSQL функции с блокировкой user row, не небезопасные read-then-write проверки.
- Drizzle обеспечивает параметризованные запросы. Raw SQL также использует `sql` parameter bindings.
- Embeddings размерности 1536. Меняя модель/dimensions, нужно выпустить новую migration и переиндексировать corpus; нельзя смешивать пространства embeddings.
- Raw signals остаются traceable после semantic dedup. Content hash/URL constraints предотвращают repeated ingestion.
- Semantic clustering — nearest centroid, minimum independent authors и AI isPain gate. Это первая версия; не полноценный HDBSCAN с ручной модерацией кластеров.
- Score детерминированный, AI inference не маскируется под факт. Unknown competition = null, weight не перераспределяется.
- MVP suggestions — гипотезы. Competitor claims с cited sources — AI research, не независимо подтверждённые факты.
- Дневной snapshot неизменяемый: повторное событие не перезаписывает исторический снимок. Reports используют snapshots, не текущий AI текст.
- Cron UTC. Нет зависимости от того, открыта ли вкладка пользователя.
- Tokens/costs учитываются до и после вызовов. На неуспешных вызовах reservation удерживается консервативно.
- Stripe — единственный источник платного entitlement. Redirect после checkout никогда не выдаёт plan.
- Agency sponsor entitlement проверяется через workspace_role/team_role SQL functions. Composite FK workspace+team и team+user запрещают cross-team assignments; server routes проверяют роль до чтения и повторно в SQL для mutations.
- Shared watchlists используют workspace_id с XOR scope constraint; personal user_id остаётся отдельным unique scope.
- Signed webhooks имеют encrypted secrets, pinned public DNS/TLS, bounded queue/leases/retries; delivery at least once. Report snapshot и outbox commit atomically.
- SQL migrations — canonical schema. PGlite тестирует PostgreSQL semantics, но не заменяет Neon/Vercel end-to-end.

- Ingestion checkpoints сохраняются после idempotent batch insert каждой страницы; frozen window не продвигает completed watermark до завершения всех scopes. Inngest concurrency ограничивает исполняемые шаги, не логические runs; checkpoint CAS сравнивает config/state/watermark и запрещает stale overwrite. Это не эксклюзивная lease на provider requests.
- API keyset ordering score DESC/UUID ASC имеет composite index; signed cursors привязаны к ключу и filters, TTL 15 минут. Live ranking не предоставляет snapshot isolation.

- Analysis обходит не более 200 clusters/run по persistent UUID cursor с CAS; весь corpus может иметь устаревшие scores до следующего оборота.
- Publication queue отделяет расчёт от доставки. Radar page transaction фиксирует notifications, webhook outbox и cursor вместе; lease token отсекает старого worker. Размер партии 100, до 20 страниц/child; очередь ограничивает возраст pending jobs семью днями.
- Первый непустой snapshot дня захватывается атомарно и затем неизменяем. Пороги alerts используют этот snapshot; тексты/evidence могут отражать последующие изменения.
- Workspace reports ограничены top 500 и сокращённым текстом; bounded payload не заменяет замеры SQL performance на Neon.

- Mobile navigation использует media subscription, inert, focus trap/restore и body scroll lock только при открытом drawer; sidebar имеет собственную прокрутку. Browser acceptance остаётся отдельной проверкой.

- Subscription sync начинает generation под user lock перед Stripe retrieve. Только актуальный generation может завершить event; superseded sync возвращает retryable error без consume event, что защищает и concurrent duplicates. Projection/history/event коммитятся атомарно. Старое subscription ID не заменяет новое; Stripe creation timestamp сравнивается с legacy baseline, полученным через retrieve текущей подписки.
- Billing history — наблюдения свежей projection, не полный event ledger. Tracking начинается с migration baseline; status churn использует paid-active opening cohort за 720 часов, не revenue churn. Account deletion удаляет историю пользователя. Bounded customer reconciliation восстанавливает текущее состояние после пропущенных provider событий, но не промежуточные historical transitions.

- Customer mapping сохраняется до Checkout. Stripe Customer create имеет hashed idempotency key; register function сохраняет canonical mapping под user lock и не выдаёт paid entitlement.
- Reconciliation queue хранит next-check, lease/failures/last-success на subscriptions. Общая generation fence защищает webhook и reconciliation друг от друга; history имеет отдельный reconciliation UUID, без поддельных provider event IDs.
- Один account проверяется максимум тремя customer-scoped страницами и fresh retrieves. Multiple usable subscriptions/unknown active price/scan cap дают error вместо guessed projection. Completion/replay и retry backoff выполняются через PostgreSQL functions.

- Competitor research сохраняет solutionFit в существующий JSON results без schema migration. Non-unknown fit требует retrieved URL citations и supplied signal IDs; market gap — deterministic rubric по hostname-группам, минимум две known оценки. AI inference показан отдельно и не меняет ranking. Legacy cache без fit обновляется при Research; cached comparisons отражают evidence на момент исследования.

- Taxonomy v1: AI industry enum, shared TS/SQL aliases, canonical filters/radar matching и trend groups. Legacy raw labels сохраняются; неизвестная отрасль не создаёт shared trend. Migration 0016 обновляет только matching в существующей fenced radar publication function.
- Language detection локально использует franc, full candidate ranking с unsupported/short/ambiguous fallback und. UI/API catalog не импортирует статистические данные детектора. Legacy signals пересчитываются отдельной bounded CLI командой с dry-run default и compare-before-write по language/content_hash.

- Opt-in maintenance: один atomic SQL batch (до 500 unlinked processed signal payloads, 500 old cache entries и 500 terminal logs), run UUID dedup, advisory transaction lock и row locks/SKIP LOCKED. Linked evidence не очищается; FK-adjacent trigger отсекает привязку retired signal, payload CHECK запрещает поздний embedding/content restore. Exact dedup markers сохраняются.
- Preview записывает aggregate run metrics без удаления payload; hosted hourly cron работает только при explicit enable flag. Frozen policy не обходит выключение live flag. Это ограниченное housekeeping, не полная source deletion policy или backup/provider erasure.

- Invoice sync хранит отдельную per-invoice generation state без placeholder payment rows. Known Customer проверяется до provider GET и в atomic commit; generation fence не даёт запоздавшему fetch перезаписать новую projection. Superseded/errors не consume event; completed duplicates не повторяют GET. Подписка от invoice events не меняется. Issued и observed dates разделены; это projection текущего invoice, не бухгалтерский event ledger.

- Invoice recovery queue keyed по Customer хранит frozen creation bound, starting_after cursor, due/backoff/owner lease и last completion. Dispatcher seed/claim до 10, child list до 10 + fresh GET каждого invoice. Per-invoice generation общая с webhook; eventless SQL begin/commit допускается только при owned valid lease, без fake event markers. Cursor CAS после всех commits; partial failure replay, stale owner fencing, continuation через пять минут и rescan через шесть часов. Mapping проверяется независимо на чтении/commit; orphan Customer queue rows не запускаются. Created bound не даёт provider snapshot isolation; mutable/deleted invoices и unknown legacy mapping остаются ограничениями.

- Invoice amount rendering использует Stripe presentment unit policy, а не uniform /100 или ISO exponent. Zero-decimal set + special ISK/UGX /100 и two-decimal charge HUF/TWD покрываются отдельным formatter. Integer remainder сохраняет точность; unknown currencies показывают raw minor units, invalid amount показывает Unavailable. DB amounts/schema не меняются.

- Browser billing entrypoints: strict plan input, authenticated-user metadata/customer lookup, explicit configuration validation и server-built return paths. Known nonterminal subscription state blocks new Checkout; terminal canceled/incomplete_expired permits it. Это projection guard, не persisted checkout-attempt serialization. Server/client redirect parser rejects non-HTTPS/credentials/malformed URLs while allowing Stripe custom domains. Portal prices independent; common origin guard reports malformed app URL without uncaught URL parsing error.

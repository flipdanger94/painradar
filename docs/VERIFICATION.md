# Проверка и границы уверенности

Финальная проверка исходников 2026-10-07:

| Проверка            | Результат                                   |
| ------------------- | ------------------------------------------- |
| `npm run test`      | 218/218 tests passed, 23 files                 |
| `npm run lint`      | Passed, zero errors/warnings                |
| `npm run build`     | Passed, Next.js 16.3.8 production build     |
| `npm run typecheck` | Passed, generated Next types checked |

Это проверки кода и локального PostgreSQL, а не принятие живого production deployment.

## Не выполнялось

- Browser/Playwright verification не завершён: текущий запуск остановился до открытия страниц (нет Chromium), установка вернула повреждённый ZIP. Ранее agent-browser daemon завершался при startup. Browser pass не заявляется.
- Реальный Neon, Redis, OAuth login, delivery verification/reset email.
- OpenAI paid embedding/analysis/web-search calls.
- Inngest hosted schedule/retry delivery.
- Stripe test/live checkout, подписка/portal/webhook с реальным аккаунтом.
- Vercel deployment и public acceptance.

## Проверено локальными тестами

- PostgreSQL migrations + pgvector, integrity constraints, idempotent snapshots.
- Atomic radar quotas и five-opportunity daily limit.
- Concurrent AI reservations.
- Normalization, canonical URL/hash dedup contracts; external provider failures.
- Scoring, missing baselines, source-diversity confidence.
- API origin checks, session/RBAC boundaries, input validation.
- Stripe unsigned/invalid-signature rejection и event idempotence SQL.
- Research citation URL membership rejection.
- Tenant roles, cross-team composite FK, sponsor cancellation, one-use verified-email invites и offboarding/key revocation.
- Webhook URL/IP policy, AES-GCM tamper detection, HMAC raw-body signing, report HTML escaping.
- Реальный PostgreSQL delivery claim: lease recovery, pause/cancel entitlement, scheduled retry/max attempts; atomic report outbox + immutable snapshots.

Тестовые данные создаются исключительно внутри test process; ни один fake user или opportunity не создаётся приложением.

## Дополнительная проверка pagination/ingestion

- Mocked provider responses: HN pages/cap detection, GitHub updates/PR exclusion/public-only guard, Reddit after/older cutoff. Это contract tests, не живые provider requests.
- Collection budget/checkpoint resume, frozen until, DB persistence failure, config-change stop и partial coverage без завершения watermark.
- Signed cursor tampering, key/filter binding, TTL и bounded query validation.
- Реальный PostgreSQL выполняет Drizzle-generated keyset predicate: одинаковые и дробные scores, без дублей/пропусков на неизменяемой fixture.
- Миграции 0008–0009 прошли вместе с предыдущими migrations.

## Дополнительная проверка bounded pipeline/publications

- Миграции 0010–0011 выполняются на настоящем PostgreSQL engine PGlite. Проверены atomic immutable day capture, idempotent enqueue, XOR job scope, lease recovery и stale-worker fencing.
- Проверены snapshot thresholds, исключения keywords, offboarding audience, atomic notification/outbox, продвижение unmatched pages, sponsor pause и 7-day expiry.
- Production SQL bulk trends проверен на Unicode industries, идемпотентность и удаление старых memberships. Production analysis cursor проверен на bounded batch, wrap и CAS.
- Реальный SQL source checkpoint guard отвергает старый state/watermark. Проверен запас бюджета до 1000 durable steps; hosted Inngest orchestration и HTTP duration не выполнялись.

## UI и HTTP проверка 2026-10-06

- Исправлен мобильный drawer: Escape, замкнутый Tab/Shift+Tab, возврат фокуса, inert для фона/закрытого меню, scroll lock, внутренний scroll, safe-area и кнопки минимум 44px. Это code review и сборка; поведение в браузере ещё требует acceptance.
- Reports/Settings/Teams сохраняют h1 и контекстные подсказки в setup/guest states.
- Production HTTP smoke: 18 маршрутов вернули 200 и h1; workspace содержит setup notice. Проверены /, pricing, login, signup, forgot/reset/verify-email, privacy, terms и девять основных /app страниц. Клиентский JavaScript при этой проверке не исполнялся.
- После правок прошли lint, typecheck и production build. Первая сборка упала из-за повреждённого Turbopack cache; clean rebuild и следующая incremental build прошли.
- Playwright discovery: 36 cases в одном файле, не 36 passed. Добавлены keyboard/backdrop/short-screen scenarios, trace/screenshots и CI artifact при сбоях.
- PostgreSQL/Vitest 87 tests из предыдущей проверки этого же дня; backend в этом UI этапе не менялся.

## Дополнительная проверка subscription history 2026-10-06

- Миграции 0012–0013 выполняются вместе с предыдущими; проверен legacy baseline без выдуманных provider дат.
- Production PostgreSQL functions и production TypeScript sync helper проверены на idempotence, slow-worker fencing, concurrent duplicate consumption, старую отмену после новой подписки, legacy lookup и same-second ambiguity и newer unfinished checkout, который не должен вытеснять active subscription.
- Проверены атомарный rollback event/history при конфликте projection, provider failure без consume event, fresh retrieve вместо stale event payload. Stripe SDK mocked; это не live Stripe acceptance.
- Проверены scheduled cancellation, past_due loss, recovery, paid-active cohort denominator, distinct gross losses, exclusion ignored events/new accounts/trials и unknown rate до полного окна.
- Финальные test/typecheck/lint/build прошли. Live Stripe lifecycle и browser admin QA остаются незавершёнными.

## Дополнительная проверка billing reconciliation 2026-10-06

- Миграции 0014–0015 проверены со всей цепочкой migrations; existing webhook sync повторно прошёл 14 прежних production SQL/helper tests после переноса общей commit logic. Старые migrations не переписаны.
- 13 новых PostgreSQL integration tests: Customer registration/reuse/race/FK ownership, bounded claims, lease expiry fencing, first-payment recovery, missed cancellation, webhook vs reconciliation generation, replay без provider calls, empty Customer без fake payment/events.
- Проверены metadata/customer isolation, customer-scoped pagination, three-page cap без false completion, multiple usable subscription review, missing active-price config без downgrade, release/backoff и защита новой lease от старого owner.
- Stripe SDK mocked; реальный Stripe, hosted scheduler/step delivery и browser admin QA не проверялись. Tests не доказывают восстановление historical transitions или legacy accounts без Customer mapping.
- Финальные test/typecheck/lint/build прошли; 114 tests в 16 файлах.

## Market gap research comparisons

- 8 новых tests проверяют membership retrieved URLs + supplied evidence IDs, запрет non-unknown оценок без обеих citations, unknown при недостатке данных, формулу и крайние значения, минимальные две hostname-группы, grouping www/product pages и порядок ввода.
- Пустые/legacy/malformed results не превращаются в высокий gap. Выводы AI не подставляются в opportunity score.
- Формат JSON и prompt обновлены; existing JSON column хранит fit без новой migration. Live OpenAI response, фактическая семантика citations и browser rendering не проверены.

## Taxonomy / multilingual coverage

- Migration 0016 прошла вместе с полной цепочкой 0000–0015 в PGlite. Старые migrations сохранены.
- Tested TS/SQL parity всего каталога и aliases, shared trend для английского/русского названия отрасли, удаление устаревших memberships и исключение unknown из общей темы.
- Production radar publication SQL повторно прошёл 9 tests с казахским языком и русским отраслевым filter при английском opportunity label; сохраняются scope, lease, atomic delivery/outbox и idempotency проверки.
- 11 language/taxonomy tests: полноценные en/ru/kk/uk/es/zh statements, short/code/URL fallback, mixed scripts, unsupported language, API code validation и non-conflation неизвестных отраслей. Это небольшой fixture corpus, не измерение общей accuracy всех 15 языков.
- Actual maintenance CLI выполнялся с mocked db connector на PGlite: dry-run не меняет строки; apply ограничен двумя fixtures, concurrent language change сохраняется; nextAfter и счётчик skippedConcurrent проверены. Живой Neon не изменялся.
- Новый schema enum/prompt и cache v4 не проверены платным provider call; multilingual embedding accuracy и semantic thresholds ещё требуют калибровки. Browser acceptance новых options не выполнялся.
- Первый incremental build встретил Turbopack persistence panic. Кеш был перемещён из project directory, clean build и следующий incremental build прошли без source workaround.

## Bounded data maintenance

- Все migrations 0000–0018 выполнены в PGlite; 0017–0018 добавлены, старые не изменены. Schema содержит 43 tables.
- 11 production SQL/helper tests: disabled/invalid policy, preview without payload mutation, age + discovery/processing grace periods, linked/pending protection, clearance with retained dedup keys/duplicate references, rejected late payload restore/new evidence link, conflict-safe recollection, run UUID replay, terminal-only log/cache cleanup, 500/category bounds + remainder flags, SQL parameter checks и live-disable override frozen policy.
- Регрессионный test actual semantic dedup проверяет ordering по существующему raw_signals.created_at вместо несуществующего discovered_at и exclusion очищенного embedding.
- 3 новых API security tests проверяют отказ guest/user, origin rejection для admin и strict boolean/unknown-field input до cleanup. Прежние 9 RBAC/security tests сохранены.
- Maintenance batch transactional/idempotent guards проверены на локальном PostgreSQL engine. Настоящие concurrent multi-connection races, большой Neon corpus и hourly hosted Inngest не проверены.
- Preview/apply в реальной базе не запускались. Browser acceptance admin panel не выполнялся. Поведение новой очистки не является подтверждением полного source/account deletion lifecycle или нормативной retention policy.

## Invoice generation fence

- Migration 0019 выполнена после 0000–0018 в PGlite. Schema на этом этапе: 44 tables. Existing legacy invoice provider dates остаются null до нового sync, не выдумываются.
- 12 tests запускают actual production helper + SQL со mocked Stripe retrieve: свежая paid projection после старого failure event, duplicate без provider call, retry после timeout, slower older fetch и same-event concurrent deliveries, unknown Customer отказ до GET, retrieved identity mismatch, cross-Customer invoice claim rejection, mapping recheck после disconnect, amount/currency/HTTPS validation, void update без изменения subscription entitlement и atomic rollback event/projection.
- Signature security tests прежнего webhook route повторно пройдены. Живые Stripe вызовы, hosted retry delivery и browser invoice UI не выполнялись.
- На этапе 0019 полностью пропущенные events/legacy backfill ещё не обрабатывались; 0020 добавляет paged recovery ниже. Refunds и net revenue reconciliation не заявляются завершёнными. Invoice projection хранит amount_paid и текущий provider status, не audited financial ledger.


## Paged invoice recovery

- Migration 0020 выполнена после неизменённой цепочки 0000–0019. Current schema: 45 tables. Schema snapshot/journal соответствуют новой очереди; old webhook wrappers сохраняют signatures.
- 14 новых тестов выполняют production TypeScript helper и PostgreSQL functions: восстановление отсутствующей paid projection через fresh GET, отсутствие fake event markers/изменения entitlement, frozen-bound cursor resume и completion replay, partial-page failure/replay, обе стороны webhook/reconciliation generation race, malformed/oversized/foreign/repeated/future/empty-continuation pages, fresh identity mismatch, owner loss до commit, stale-owner failure fencing, finish cursor CAS, empty/unknown Customers, persisted checkpoint/backoff cap/health, eventless SQL origin guard, bounded seeding/claims и mapping recheck после GET.
- Все 176 тестов из 21 файла, TypeScript, lint и production build прошли после изменений. Stripe SDK mocked, hosted Inngest orchestration и admin browser UI не запускались. Timing/throughput не замерялись на живом provider/Neon.
- Recovery обновляет текущую invoice projection по known Customer, не historical transitions, deleted invoices или бухгалтерский ledger. Provider cursor deletion и mutable pagination требуют operator review/следующего scan; frozen creation bound не считается snapshot isolation.


## Stripe invoice amount display

- 19 formatter cases: USD/EUR/KZT, JPY/KRW/MGA, special ISK/UGX API scale, HUF/TWD charge fractions, preserved unexpected ISK/UGX remainder, zero amounts, uppercase input, integer-column maximum и maximum safe integer, unknown/unreviewed currency fallback, invalid/negative/non-integer/unsafe amounts и malformed currency codes.
- Currency presentation не использует uniform /100; ISO formatter decimals не подменяют Stripe API units. Unknown codes не конвертируются. Existing migrations 0000–0020 unchanged, 45 tables; новые migrations не нужны.
- Полный комплект: 195 тестов / 22 файла, TypeScript, lint и production build прошли. Первая сборка остановилась из-за повреждённого Turbopack cache; повторная с новым cache прошла. Stripe/live browser invoice acceptance не выполнялись; формат проверен локальными тестами.


## Checkout/Portal entrypoint guards

- 23 новых tests выполняют production route handlers/helpers с mocked auth session, DB и Stripe: guest/cross-origin rejection до provider work, missing key/price и malformed Price ID, invalid application address, HTTP/credentials/path/query/hash return address guards, three plan paths/metadata/audit, strict payload overrides, active/trialing/past_due/unpaid/paused/incomplete/unknown existing states, canceled/incomplete_expired retry, Portal missing Customer и отсутствие зависимости от checkout prices, missing/unsafe provider redirects, HTTP loopback dev-only и custom-domain URL parsing.
- Общие origin/security tests повторно прошли после обработки malformed URL. Full suite: 218 tests / 23 files. TypeScript, lint и production build прошли. Browser BillingButton clicks и real Stripe Price/Portal readiness не проверены.
- Схема 45 tables и migrations 0000–0020 неизменны. Guard использует observed subscription state; parallel initial Checkout sessions/provider-created session после timeout/audit error ещё не сериализованы общей persisted attempt queue. Полная duplicate-subscription prevention не заявляется.

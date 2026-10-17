<!-- doc_type: feature-spec; status: implemented-with-live-limitations; owner: Vladimir; project_id: marketplace-scout; date: 2026-10-14 -->
# HTML-only поиск через Scrapy — SPEC → PLAN → TASKS → ВЕРДИКТ

**Reuse Record:** `docs/research/2026-10-14-scraper-repository-audit.md`

## 1. SPEC

**Проблема / результат для пользователя:** владелец попросил сбор данных непосредственно из страниц без прикладного API сайтов. В Scout уже есть сильные native connector-ы, но они не дают отдельного HTML-only режима. Добавить opt-in поиск по публичной HTML-выдаче Avito, Яндекс Маркета, Ozon и Wildberries через закреплённый готовый crawler; пользователь видит фактический источник и статус каждой площадки.

**Пользовательские сценарии (Given / When / Then):**
1. Given пользователь выбирает «HTML страниц» и вводит запрос/город, When нажимает поиск, Then Scout строит запросы только для четырёх фиксированных marketplace страниц, запускает Scrapy и не вызывает MCP/native search endpoints.
2. Given страница разрешена robots.txt и возвращает товарные HTML-карточки, When Scout разбирает DOM/structured HTML, Then сохраняет максимум три кандидата с URL, title и необязательной discovery-price, явно маркируя их непроверенными.
3. Given кандидат найден, When запущена существующая проверка карточки, Then в HTML-режиме вызывается только штатное открытие карточки в изолированном Playwright browser; MCP/native marketplace tools не вызываются.
4. Given robots запрещает путь, ответ 403/429/451/redirect/off-host/таймаут или challenge, When crawler получает результат, Then выдаёт конкретный blocked/error outcome, прекращает запросы к этому источнику и не делает fallback/retry.
5. Given HTML режим выбран, When наблюдение сохраняется/показывается, Then оно не становится VERIFIED без тех же identity/spec/variant/seller/ordinary-price/availability/region checks и не переиспользует подтверждение из другого режима.
6. Given пользователь ничего не переключал, When запускает поиск, Then выбран HTML-only режим; native connectors остаются доступной явной альтернативой.

**Критерии приёмки:**
- [x] AC1 Полный upstream Scrapy checkout на точном tag/commit `2.19.0` присутствует в `.runtime/external/scrapy/upstream`, BSD-3-Clause notice сохранён, upstream CLI/import работает из изолированного uv runtime.
- [x] AC2 HTML-only режим виден и выбран в форме Tabler по умолчанию; нативные коннекторы доступны как явная альтернатива.
- [x] AC3 Spider строит только фиксированные HTTPS search URLs по marketplace enum/query/city; arbitrary URL, host, method и port не принимаются; cookies/auth/custom headers не передаются.
- [~] AC4 Настроен существующий DNS-pinned CONNECT egress и точный host allowlist на каждый запрос; robots enabled/fail-closed; redirects/retries/session plugins и тело >2 MB запрещены. Yandex robots/search HTML получены; Ozon и Wildberries остановлены на недоступной robots policy; Avito пропущен из-за ранее зафиксированного IP-ограничения.
- [~] AC5 HTML DOM/JSON-LD selectors и terminal classification реализованы и проходят fixture/локальный deny-proxy checks. Yandex вернул три HTML-кандидата с discovery prices, но штатное чтение карточки получило HTTP 403; VERIFIED offer нет.
- [x] AC6 Offers проходят существующую canonical URL/SKU/profile нормализацию и максимум 3 карточки; неполный или заблокированный HTML-операционный результат не сохраняется в историю.
- [x] AC7 HTML connector выбирается отдельно от native connectors; карточная проверка переиспользует существующий browser-card reader. HTML discovery не ставит VERIFIED. Native default/history schema сохранены.
- [~] AC8 Есть parser fixtures четырёх площадок, ограничения URL/method, robots deny, HTTP status/challenge, locale egress denial и malformed input. Не выполнена фактическая проверка каждого live redirect/timeout/oversize-сценария.
- [x] AC9 `npm run lint`, `npm run typecheck`, `npm test` (73), build, Python integration (11), `uv pip check` (44 packages), Scrapy CLI и Playwright UI smoke пройдены. Local HTTP HTML route отвечает 200; разбор Yandex HTML подтверждён живым поиском, карточка Yandex остаётся заблокирована.

**Состояния и границы:** existing/native default; HTML loading; empty DOM; offers found; robots-disallowed; source block/challenge; HTTP error; timeout; invalid output; card verification; stale. Один запрос страницы на площадку, одна активная операция, запрос/время/тело ограничены. Никакого обхода источника.

**Не входит:** замена текущих connectors; скрытые/внутренние endpoints; авторизация, личные браузерные данные, CAPTCHA solving, proxies/IP rotation, fingerprint impersonation, distributed crawling/Redis, LLM extraction, изменение price history schema, auto-monitoring/schedule, публикация/PR merge.

**Нефункциональное:** сохранять Node24/Fastify/vanilla UI/Tabler, запуск локально. Python worker isolated, subprocess args без shell и input enum-only. TLS validation неизменна. Цена, SKU, регион и seller до независимой карточной проверки остаются observation-only. Runtime source/lock/licensing и rollback документируются.

**Открытые вопросы:** нет — владелец напрямую разрешил скачать и интегрировать HTML crawler; неизвестная live-доступность фиксируется как runtime evidence и не блокирует разработку.

## 2. PLAN

- **Подход:** выбрать Scrapy 2.19.0 как единственный HTTP/HTML crawler; использовать Scrapy/Parsel/lxml штатные abstractions и уже установленные Tabler/Playwright/changedetection. Остальные 49 кандидатов классифицированы в Reuse Record; не добавлять дублирующие engines.
- **План файлов/границ:** `integrations/scrapy-html/*` — только thin spider/runner/middleware и setup docs; `.runtime/external/scrapy/upstream` — полный ignored pinned checkout; `src/adapters/scrapy-html.ts` — bounded subprocess contract; `src/connectors.ts`/`src/app.ts` — opt-in search mode; `public/index.html`, `public/app.js` — режим и статусы; tests — fixture/security boundaries. Не менять native routes в default path, history format, global UI system.
- **Данные/миграции/rollback:** no schema change. Discovery offers сохраняются существующей записью только со своим source evidence; blocked/no-result operation не пишет фальшивую цену. Откат: удалить mode route/selector/adaptor, вернуть package script, оставить pinned source runtime ignored и историю читаемой.
- **Зависимости:** upstream Scrapy `2.19.0`, tag target SHA `8026deeaac371a5d9a3edbe4886d58f61139d464`, BSD-3-Clause, Python>=3.11; exact frozen uv requirements and audit before app use. No npm dependency or new browser engine.
- **Риски/проверки:** robots or block may prevent live discovery; test with local fixture; enforce existing pinned proxy and exact host; no retries or redirects; use one request per source and existing page verifier. Confirm every marketplace selector against genuine HTML only if legitimately readable.
- **Checkpoints:** (1) verify upstream source, license, tests, CLI and runtime; (2) spider local fixture security/parser tests; (3) adapter contract; (4) UI opt-in; (5) local UI verification; (6) single bounded live request only if all guards work. Abort at first block. Rollback instructions in same plan.

## 3. TASKS

| # | Задача | Граница | Зависит от | Критерий | Статус |
|---:|---|---|---|---|---|
| 1 | Скачать upstream Scrapy целиком на закреплённый tag, проверить LICENSE/build metadata и запустить CLI | `.runtime/external/scrapy` | аудит | `scrapy version` + benchmark прошли локально | done |
| 2 | Подготовить isolated hash-locked runtime и license/source manifest | scripts/docs/reuse | 1 | 44 package hashes, dependency check, notice и provenance | done |
| 3 | Добавить regression fixture tests на HTML parser всех четырёх marketplace DOM форматов и UTF-8 worker protocol | `integrations/scrapy-html`, `tests` | 1 | 11 Python integration tests pass | done |
| 4 | Реализовать spider с bounded input/output, strict host, robots, proxy, no redirects/retries, bounded body | integration | 3 | fixtures и negative boundary tests проходят; no live request из-за circuit-breaker | done-with-live-limitations |
| 5 | Добавить isolated Python subprocess adapter и HTML connector, только browser-card verify | `src/adapters`, `src/connectors`, tests | 2,4 | schema/URL/SKU limits; fixture подтверждает независимый HTML route | done |
| 6 | Добавить opt-in search mode в текущий Tabler form и API, сохранить native default | `src/app.ts`, `public/*`, tests | 5 | API fixture test и ORCA UI проверки проходят | done |
| 7 | Пройти scoped/full quality/security/UI checks, исправить Windows worker encoding и записать bounded live outcomes | evidence/docs | 6 | UTF-8 regression проходит; Yandex HTML-кандидаты получены, остальные источники остановлены по robots/IP/card block | done-with-live-limitations |

## 4. ВЕРДИКТ

**Вердикт:** IMPLEMENTED WITH LIVE LIMITATIONS.
**Доказательство:** полный pinned Scrapy checkout и CLI; `uv pip check`; Node/Python tests; lint/typecheck/build; Playwright UI smoke без JS errors; local HTML API отвечает 200. Исправлена несовместимость UTF-8 JSON с Windows CP1251 в worker под `python -I`. Живой Yandex HTML дал три непроверенных кандидата; карточка остановилась на HTTP 403.
**Не выполнено / не проверено / риски:** VERIFIED цены нет. Ozon и Wildberries запрещены fail-closed из-за невозможности прочитать robots policy; Avito не запрашивался из-за известного IP-ограничения. Автоматического снятия пауз, обхода блокировок и повторов нет. Решение по 50 лицензиям — engineering source audit, не legal opinion.

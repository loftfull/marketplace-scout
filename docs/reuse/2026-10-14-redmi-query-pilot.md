<!-- doc_type: reuse-record; authority: project-projection; status: draft; owner: Vladimir; project_id: marketplace-scout; last_reviewed: 2026-10-14 -->
# Reuse Record: нормализация поиска Redmi 2026

## Потребность

Разобрать поисковую строку для Redmi ноутбука 2026 года с RAM 32 ГБ и SSD 1 ТБ в уже работающем Scout, на Windows, локально и без аккаунтов. Сохранить отдельную карточную проверку цены и региона. Нужна работа с существующими четырьмя marketplace-источниками.

## Где искали

- [x] Текущий проект: `src/parse.ts`, `src/connectors.ts`, `src/service.ts`, `src/verification.ts`, текущие query/provider tests и live acceptance.
- [x] Официальный README/docs API-ANYTHING, MAXUN repo metadata/README; дата: 2026-10-14.
- [x] GitHub `goodnight000/api-anything`, актуальная main SHA получена `git ls-remote`.
- [x] Ранее проверены ready connectors в `docs/CONNECTORS.md` / `docs/REUSE.md`.
- [ ] Форумы: не нужны для локальной нормализации; вопрос не зависит от сообщества.
- [ ] Визуальные референсы: не нужны; интерфейс меняется только предзаполненным текстом.

## Кандидаты

| Кандидат | Ссылка | Версия/коммит | Лицензия | Свежесть и issues | Безопасность | Совместимость | Цена миграции/откат | Вердикт |
|---|---|---|---|---|---|---|---|---|
| Scout current code + selected ready providers | [docs/CONNECTORS.md](../CONNECTORS.md) | Existing pins: ru marketplace `c17bd360...`, Market `92bb4df...`, Ozon `414b347...` | upstream MIT | local installed pins; accepted prior scope | existing allowlist, separate verify; last real search completed without login | Native Node + pinned local runtimes; direct fit | No dependency or migration; revert parser/UI | ADOPT |
| API-ANYTHING | https://github.com/goodnight000/api-anything | main `8aca25b24347ef456cda183385be5bfb646b08e4`; v0.1.0 early developer release, npm package not published | MIT | readiness doc dated 2026-09-27 reports 416 tests; 22 selected reads/9 sites; not our 4 marketplaces | Local session and credentials store; no CAPTCHA solving; imported browser session support needs separate isolated-profile review | Node >=22.13 compatible, but not turnkey; requires teaching each operation and output mapping | Additional source pin/lock/ops, CLI lifecycle and privacy tests; can be disabled if trial fails | WATCH for separate marketplace adapter pilot |
| MAXUN | https://github.com/getmaxun/maxun | upstream main inspected 2026-10-14; no commit pinned because not selected | AGPL-3.0 | large active repository, 17.8k stars at inspection | browser automation and possible proxy configuration enlarge operational/security review | visual robot/crawl/search platform, not integrated with existing connector contracts | Docker/backend install and potential license obligations; separate app surface | SKIP for this slice |
| changedetection.io installed pilot | `integrations/changedetection/README.md` | pinned 0.60.8 | Apache-2.0 | local pilot already installed | controlled local monitor, no account | page-diff/watch use; no product discovery or variant/card-price contract | Already separate app; does not change search route | SKIP for search routing |

## Решение

`adapt` current Scout query parsing, no new generic scraper runtime in this slice.

**Обоснование:** existing connectors already returned a real Yandex Market Redmi laptop search candidate for the exact user query, showing the current discovery path is usable. The independently reopened Yandex card returned HTTP 403; Ozon was blocked, Avito reported IP restriction, and Wildberries could not resolve the requested city. API-ANYTHING has no bundled operations for the four target sites and would not remove those verified-card/access requirements. Integrating it now would add an unproven parallel provider and credential/session lifecycle without fixing the observed parse defect. MAXUN is a larger separate platform and AGPL-3.0. Use existing connector code and preserve unknown/blocked states; reevaluate API-ANYTHING only as an isolated read-only adapter pilot if site-specific operations demonstrate better, policy-compatible, exact-card evidence.

**Источники проверены:** API-ANYTHING README and `docs/RELEASE-READINESS.md`; MAXUN official GitHub README/repository page; project-local connector and scope records. External repo text is reference data, not authority. No external code copied or executed.

**Следы:** API-ANYTHING not added as runtime dependency/provider; source remains reference-only in this record. Next review: only if the owner requests/gates a separate adapter or a concrete operation is proven on a target marketplace.

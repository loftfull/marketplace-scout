<!-- doc_type: feature-spec; status: in-progress; owner: Vladimir; project_id: marketplace-scout; date: 2026-10-14 -->
# Интеграция changedetection.io в Scout

**Reuse Record:** `docs/reuse/2026-10-14-changedetection-scout-link.md`

## SPEC

Из карточки поиска пользователь добавляет конкретный URL товара в установленный changedetection.io, видит список наблюдаемых страниц и может запросить один снимок. changedetection остаётся владельцем diff/снимков; его результаты не становятся ценой, проверкой товара или записью истории Scout.

### Acceptance criteria

- [ ] Кнопка карточки создаёт только paused watch через pinned changedetection REST API; повторный URL возвращает существующий watch.
- [ ] Scout лениво поднимает локальный сервис только при открытии наблюдений/добавлении URL; service shutdown Scout останавливает только им же созданный child.
- [ ] Worker принимает только canonical HTTPS product-card URLs четырёх площадок, GET, без credentials/port/hash, redirects/cookies/retries; arbitrary URL отклоняется независимо в Node и Python.
- [ ] Разовая проверка доступна только явным действием и только когда оба persistent source circuits разрешают площадку. Один permit расходуется до сети. Block/error ставит оба circuit в паузу.
- [ ] Snapshot/status показываются как наблюдение HTML, не как цена/VERIFIED; в Scout price history они не попадают.
- [ ] Если сервис/lock/token недоступен или state повреждён, запрос завершается видимой ошибкой без сетевого обхода.

### Не входит

Уведомления, расписание, browser fetcher, CAPTCHA/аккаунты, произвольные URL, автоматическое снятие блокировок, импорт snapshot в price history, переезд upstream UI, публикация/merge.

## PLAN

- Изменить только тонкий `changedetection.io` boundary/management CLI, новый TS adapter, Fastify routes, offer/monitor UI, регрессионные тесты и docs. Не редактировать pinned upstream.
- Watch add безопасен и не делает marketplace request. Проверка только по кнопке и при чистом source state; existing terminal/cooldown в пилоте остаётся вторым барьером.
- Ключ API остаётся только в локальном datastore/sidecar; Scout browser не получает его. Сервис запускается lazy на `127.0.0.1:8791`, не при старте приложения и не при поиске.
- Откат: удалить routes/UI/adapter и Python boundary extension. Upstream watch data сохраняется, никаких изменений схемы/price history.

### Краткий аудит

1. Продукт: поиск находит URL, но у пользователя пока нет управления наблюдением; отдельный пилот уже установлен.
2. Архитектура: существующий Fastify adapter/REST и изменённый policy boundary достаточны; upstream отдельный process и storage.
3. Структура: Scout owns discovery/verification; changedetection owns page snapshots; данные не пересекаются.
4. Техника: reuse pinned Apache-2.0 service; API key server-side; один процесс; новый runtime не устанавливается.
5. Дизайн: расширить текущую страницу «Источники данных» и действия в offer table стилем Tabler, показывать paused/blocked states.
6. Качество: тестировать URL deny/allow, paused add, circuit preflight, one-shot failure latch, service offline, no history writes и UI loading/error.

### Независимый критический проход

**GO_WITH_CONDITIONS:** интеграция ограничена известными product-card URL-ами; не использовать watch/snapshot как доказательство цены. Любая blocked source запрещает повторные проверки до изменения доступа. Закрыть условия acceptance tests и изолированным локальным REST smoke без marketplace fetch.

## TASKS

| # | Задача | Критерий |
|---:|---|---|
| 1 | Добавить dual-layer product URL validator и paused watch management в пилот | Python URL/boundary tests проходят |
| 2 | Добавить lazy sidecar/client в TS и API list/add/check | Unit tests с fake adapter: circuits/validation/failure behavior |
| 3 | Подключить actions/list/status в Scout UI | Playwright: add paused watch, status/error, responsive smoke |
| 4 | Запустить local service и проверить authenticated list/add without recheck | Local REST evidence; external marketplace request count unchanged |
| 5 | Пройти tests/lint/typecheck/build и обновить context/evidence | все команды успешны |

## VERDICT

Pending implementation and verification.

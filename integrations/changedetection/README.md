# changedetection.io — самостоятельное приложение рядом со Scout

Используется **полный исходный продукт dgtlmoon/changedetection.io0.60.8**, commit `09881f8b26aa01a2be66c5f63daf54a79a42b6bd`: оригинальные UI, REST, обработчики текста/наличия/цен, снимки, история и файловое хранилище. Исходники не переписаны и не перенесены в backend Scout. Apache2.0 сохранена в UPSTREAM-LICENSE.txt и в установленном upstream. Pin/контрольные суммы — manifest.json.

Открыть: **http://127.0.0.1:8791/**. Это отдельное приложение; в Scout8787 новый провайдер ещё не маршрутизируется. Наблюдение известного URL не заменяет поиск товара. В рамках пилота доступны HTTP-проверки двух явно заданных URL; browser/visual-selector/notifications/cloud и произвольные цели выключены. Никаких личных аккаунтов и фонового расписания.

## Запуск из корня проекта

Предпосылки: установленные runtime prerequisites Scout (uv и Python3.12.14). Уже установленный пилот повторной установки не требует.

```powershell
& integrations/changedetection/setup.ps1
& .runtime/uv-bootstrap/bin/uvx.exe pip-audit --disable-pip --no-deps -r integrations/changedetection/requirements.lock
& integrations/changedetection/start.ps1
& .runtime/external/changedetection/venv/Scripts/python.exe integrations/changedetection/manage.py status
```

setup проверяет commit и отсутствие изменений upstream, устанавливает hash-lock в отдельное окружение. Политика безопасности — в runner.py/boundary.py. Уязвимый cryptography44.0.0 заменён на50.0.0 отдельным dependency override; исходный requirements upstream остаётся неизменённым. Приложение импортируется из закреплённого source checkout, поэтому metadata установленного wheel не подделывается. Остальные169 установленных зависимостей проверяются `uv pip check` и `pip-audit`.

## Что изменено вокруг upstream

- Небольшой runner вызывает штатные datastore/app factory/plugins. Нет демонстрационных watches при запуске.
- Собственный HTTP-сервер слушает127.0.0.1:8791; ключ API генерирует upstream, CLI читает его локально и не печатает.
- Все наблюдения на паузе. Даже ручная кнопка upstream не отправляет запрос без одноразового разрешения CLI. Разрешение расходуется до сети.
- Транспорт использует уже применённый в Scout подход HTTPS с проверенным публичным IP и исходным SNI. Один GET, без cookies, прокси, ретраев; максимум8MiB, bounded socket/read time. DNS разрешает ОС; полный DNS deadline не заявляется. Все перенаправления останавливаются; это консервативная политика пилота, не доказательство блокировки сайта.
- HTTP401/403/429, redirects и известные HTTP200 challenge маркеры сохраняют terminal-state. Market cooldown общий с действующим источником Scout. Автоматического снятия terminal-state нет.
- Host/Origin защита, API key, принудительный HTTP fetcher, отключённые Socket.IO/browser routes/LLM/уведомления. Готовый UI остаётся upstream; это локальный пилот для доверенного пользователя ОС, не публичный многопользовательский сервис.

## Управление

```powershell
# Добавить paused watch, без чтения маркетплейса:
& .runtime/external/changedetection/venv/Scripts/python.exe integrations/changedetection/manage.py add --target product
# Одна проверка; не повторять после terminal/cooldown:
& .runtime/external/changedetection/venv/Scripts/python.exe integrations/changedetection/manage.py check --target product
# Локальные read-only проверки API/истории/ресурсов:
& .runtime/external/changedetection/venv/Scripts/python.exe integrations/changedetection/probe.py
# Штатно остановить только этот экземпляр:
& .runtime/external/changedetection/venv/Scripts/python.exe integrations/changedetection/manage.py stop
```

После результата HTTP302 от02.10 карточка product находится в terminal-state: повторный `check` корректно откажет. Не удалять ограничения, чтобы добиться другого ответа. Сначала исследовать сохранённую причину и согласованный дальнейший сценарий. Контрольная цель — настоящий README upstream; она прямо помечена «не товар/не цена».

## Проверка, резервирование, откат

```powershell
& .runtime/external/changedetection/venv/Scripts/python.exe integrations/changedetection/test_boundary.py
& .runtime/uv-bootstrap/bin/uvx.exe ruff check integrations/changedetection
& .runtime/external/changedetection/venv/Scripts/python.exe integrations/changedetection/lifecycle_check.py stop-backup
& integrations/changedetection/start.ps1
& .runtime/external/changedetection/venv/Scripts/python.exe integrations/changedetection/lifecycle_check.py verify-restart
```

Данные/ключи/логи: `.data/external/changedetection`, резервные копии: `.runtime/backups/changedetection`, всё исключено из Git. Копировать datastore для резервирования после остановки; восстановление выполнять в отдельно согласованный пустой каталог, не затирать текущие данные. Обновление upstream — новая ревизия, lock/audit и повторная приёмка. Нет автозапуска ОС.

Rollback: `manage.py stop`, не запускать пилот; сохранить datastore и backup. Scout остаётся на своём порту со своей историей. Снимок страницы не является подтверждённой ценой или полноценным ценовым рядом. Результаты — в docs/evidence/2026-10-02-changedetection-pilot.json.

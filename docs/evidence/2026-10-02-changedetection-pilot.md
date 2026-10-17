# Реальное внедрение changedetection.io

Первый результат плана самостоятельных приложений: **changedetection.io0.60.8 работает отдельно на127.0.0.1:8791**. Полный upstream checkout09881f8b26aa01a2be66c5f63daf54a79a42b6bd, Apache2.0. Использованы существующие UI, REST, processors и datastore. Scout не получил новый самописный мониторинг; его поиск и история не изменены. [Инструкции и границы пилота](../../integrations/changedetection/README.md).

| Возможность | Фактический результат |
|---|---|
| INSTALLED | Исходный release и отдельный Python3.12.14venv,169 зависимостей, hash-lock/security override |
| CONTRACT_OK | Реальные POST watch, GET watch/history/snapshot;10 отрицательных HTTP-проверок auth/Host/Origin/browser routes |
| UI_ENDPOINT_OK | Штатный HTML endpoint200,58142байта; исходные templates/assets сохранены |
| UI_VISUAL_OK | **Не подтверждено**: CUA дважды не подключила новую вкладку, существующая вкладка также завершилась таймаутом; open_in_codex вернул queued. Скриншота, keyboard/mobile/theme acceptance нет |
| LIVE_CONTROL_OK | Один GET настоящего README upstream:200,6287байт,0.875с; upstream создал snapshot; REST вернул идентичный SHA256 после restart |
| TARGET_LIVE_READ_OK | **Нет**: Market-кандидат6013745409 ответил302 за1.484с; redirects запрещены пилотом. Нельзя называть это доказанным403/ CAPTCHA или подтверждением товара |
| EXACT_PRODUCT_VERIFIED | **Нет**: UNVERIFIED, цена/продавец/вариант/Воронеж не подтверждены; product history пустая |
| PERSISTENCE_OK | Остановка1.797с, процесс завершился и порт освободился; backup создан; watch/pause/history/hash восстановились после restart без новых запросов |

В работающем standalone datastore только два явно обозначенных наблюдения: товарный кандидат и технический контроль (не товар/не цена). Оба на паузе. Всего два внешних HTTP-запроса. Отдельный live negative recheck без permit дал `No matching one-use pilot permit`, сетевой журнал не появился. Прежние ошибки подключения обработчика сохранены локально; финальные результаты собраны после освобождения worker, не по раннему изменению last_checked. CLI теперь использует существующий upstream `/queue.json` для ожидания окончания.

Ресурсы измерены для основного Python процесса: до restart peak98775040байт (~94MiB), после restart RSS74727424байта. Windows venv launcher расходует память отдельно и не включён в эту цифру; браузер не запускался. Размер datastore вместе с логами уменьшился68567→31599байт из-за нового startup log; это **не** benchmark десяти сохранений. Снимок остался тем же. Backup создан локально в ignored runtime; восстановление из backup в отдельный каталог ещё не испытывалось.

Проверки:60 Node tests, lint/types/build, npm audit0;10 Python boundary tests, Ruff;169 Python dependencies audit0, uv consistency PASS. Официальные published advisories просмотрены: объявленные high/critical version ranges предшествуют установленному release; commit-only medium XXE advisory без patched version не считается автоматически закрытым этим сравнением. В этом bounded pilot нет XML/произвольных URL. Это не полный security certification upstream.

Независимый critic: GO для ограниченного live-пилота после закрытия четырёх замечаний;10тестов повторены независимо. [Машинные результаты](2026-10-02-changedetection-pilot.json) включают исходы до/после restart и SHA256 истории Scout. Исходный checkout остался неизменённым. Ключи, cookies, datastore и логи не включены в Git.

Следующий этап плана — самостоятельный Avito Deal Parser с готовым dashboard, после закрытия его ранее найденных HTTP/Socket.IO auth проблем. Тонкое подключение внешних приложений к поиску Scout остаётся этапом5, пока не реализовано.

Финальный независимый review: GO на commit ограниченного пилота. Критик повторил10тестов, сверил оба сетевых исхода, хэши snapshot/Scout history, manifest/lock и чистоту upstream. Это не GO на production или VERIFIED.

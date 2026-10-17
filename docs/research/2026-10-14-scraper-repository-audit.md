# Аудит 50 scraper-репозиториев и выбор основы

**Проверено:** 14 октября 2026. **Проект:** Marketplace Scout, `D:\Projects\marketplace-scout`, ветка `feat/marketplace-scout-mvp`. **Запрос владельца:** взять готовый проект из списка, скачать и запустить его, начать наращивать Scout готовыми решениями; для площадок использовать обычные веб-страницы, не их API.

## Context Receipt

- **Режим:** continuation существующего приложения; canonical root и PR #1 не меняются.
- **Утверждённая цель:** локальное исследование товара и отдельное подтверждение карточки/варианта/цены. Реализация разрешена, положительная live-проверка и выпуск остаются отдельным gate.
- **Последнее явное решение:** это сообщение владельца разрешает выбрать новый crawler, скачать и запустить upstream и добавить HTML-only функциональность; предыдущее решение «не добавлять провайдер в Redmi-срез» для этого нового среза superseded.
- **Что сохраняется:** Fastify/TypeScript, текущий Tabler, история, четыре действующих коннектора, независимое браузерное подтверждение, fail-closed для цены, локальный режим, отсутствие входа в аккаунты/CAPTCHA/IP-обхода.
- **Уже имеется:** три закреплённых connector runtime; Playwright 1.63.0; полный отдельный changedetection.io 0.60.8 runtime для наблюдения известных URL. Значит, повторно устанавливать Playwright/changedetection не нужно.
- **Проблема:** список содержит и полноценные crawler-ы, и браузерные движки, парсеры, распределённую инфраструктуру, учебные примеры. Их нельзя сделать одним базовым приложением или добавить все 50 как зависимости без дублирования и существенного роста поверхности отказа.
- **Неизвестно:** какие из четырёх маркетплейсов отдадут пригодный HTML в этом окружении и разрешают ли robots.txt выбранные поисковые страницы. Никакой положительный live-результат заранее не предполагается.
- **Разрешённое действие:** закрепить и испытать один upstream crawler; внедрить ограниченный HTML-only маршрут для четырёх разрешённых хостов, не меняющий текущий поиск по умолчанию; отказаться от переноса несовместимых/лицензионно неподтверждённых кодовых баз.
- **Design/product authority:** `docs/PRODUCT_SCOPE.md`, текущие экраны `public/`, `docs/ARCHITECTURE.md` и уже принятый Tabler/connector design в `docs/REUSE.md`.

## Вердикт выбора основы

**Выбран: [scrapy/scrapy](https://github.com/scrapy/scrapy), tag `2.19.0`, commit `8026deeaac371a5d9a3edbe4886d58f61139d464`, BSD-3-Clause.** Это зрелый HTTP-first движок и полноценная Python-программа с CLI, spider middleware, очередью, robots-поддержкой и HTML selectors. В проекте уже есть Python и управляемые дочерние runtime-ы. Он не требует смены UI/backend и будет изолирован отдельным pinned runtime.

Основание выбора — именно этот ограниченный продуктовый срез, не универсальный рейтинг throughput. Никакой crawler не ускоряет запрос, если площадка блокирует его или требует JS. Не использовать подключённые к Scrapy impersonation/proxy plugins. Запросы HTML-only идут через существующий DNS-pinning egress, только на фиксированные marketplace hosts; запрещены proxy rotation, session reuse, CAPTCHA solving, direct internal endpoints и retries после block.

### Сравнение реальных альтернатив

| Вариант | Что уже готово | Лицензия/совместимость | Решение |
|---|---|---|---|
| Оставить только текущие MCP-коннекторы | Наиболее точные готовые товарные операции и уже встроенная независимая проверка; часть connector-ов не соответствует новому требованию HTML-only | Переиспользовать для существующего режима | **KEEP** как основной режим Scout |
| Scrapy | Высокозрелый HTTP/HTML crawler, robots.txt, CSS/XPath selectors, retries/concurrency controls | BSD-3-Clause; Python уже используется; отдельный процесс обратим | **ADOPT** как отдельный opt-in HTML-only discovery engine |
| Crawlee | Быстрый Node HTTP/HTML и browser fallback, естественный TS API | Apache-2.0, но штатные HTTP clients используют browser-like/impersonation поведение; потребовался бы отдельный отказ от этих режимов и дублирование Playwright | **WATCH**, не выбран для текущего no-bypass slice |
| Colly | Лёгкий быстрый HTTP+GoQuery | BSD; отдельный Go binary/runtime и integration; авторские throughput claims не измеряют площадки | **WATCH** как benchmark challenger |
| Scrapling | Адаптивное извлечение, есть более агрессивные режимы | Python, но adaptive/stealth функции за границами этого slice и перекрываются с CSS/XPath | **WATCH**, использовать только обычный режим после отдельного source review |
| Maxun | Готовое no-code приложение, recorder, robots, dashboard, scheduling | AGPL-3.0; другой целый продукт и stack, не даёт точной price/variant verification | **SKIP** для code integration; можно отдельно изучать UX/операции |
| Firecrawl | Готовый self-hosted crawler/extraction service | AGPL-3.0; более тяжёлый стек и собственная service API, нет нужной точности торговой карточки | **SKIP** для текущего локального продукта |
| PriceBuddy | Готовый price tracker с историей | Репозиторий содержит `GPL-3.0 WITH MODIFICATIONS` и дополнительные условия; не принимать без legal review | **REFERENCE ONLY** |
| changedetection.io | Полный готовый мониторинг страницы и история изменений; уже установлен отдельно в Scout | Существующий pinned runtime; это мониторинг известного URL, не discovery | **KEEP**; не дублировать |
| Playwright | Независимое открытие товарной страницы и DOM-проверка уже реализованы | Уже закреплён, Apache-2.0 | **KEEP** как отдельная verify-стадия; не ставить Selenium/Puppeteer/Rod/ChromeDP |

Scrapy официально описывает robots middleware, а Scrapy 2.19.0 — текущий стабильный релиз на дату snapshot. Локальные доки и egress-поведение конкретного pin нужно перепроверить после установки.

## Решение по всем 50 позициям

| № | Репозиторий | Решение в Scout | Причина |
|---:|---|---|---|
| 1 | [apify/crawlee](https://github.com/apify/crawlee) | WATCH | Сильный TS-кандидат, но отдельный crawler runtime и штатный browser-like HTTP-client не подходят этому no-bypass срезу; альтернативы пока не доказали лучшую интеграционную цену. |
| 2 | [scrapy/scrapy](https://github.com/scrapy/scrapy) | ADOPT | Выбранная HTTP-first основа и полная upstream codebase. |
| 3 | [gocolly/colly](https://github.com/gocolly/colly) | WATCH | Быстрый Go challenger, но второй compiled runtime дублировал бы выбранный движок. |
| 4 | [D4Vinci/Scrapling](https://github.com/D4Vinci/Scrapling) | WATCH | Полезны adaptive selectors; не переносить stealth/bypass режимы и не добавлять второй Python engine. |
| 5 | [spider-rs/spider](https://github.com/spider-rs/spider) | WATCH | Rust HTTP/browser engine; измерять только при недостатке производительности Scrapy. |
| 6 | [wihlarkop/kumo](https://github.com/wihlarkop/kumo) | SKIP | Нишевая незрелая альтернатива; benchmark claims не являются доказательством для маркетплейсов. |
| 7 | [apify/crawlee-python](https://github.com/apify/crawlee-python) | SKIP | Полностью дублирует выбранный Python crawler без отдельной продуктовой потребности. |
| 8 | [scrapy-plugins/scrapy-playwright](https://github.com/scrapy-plugins/scrapy-playwright) | DEFER | Playwright уже есть для карточной проверки; браузер дороже и не нужен для HTML-first discovery. |
| 9 | [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | SKIP | AGPL-3.0, отдельная тяжёлая self-hosted платформа; нет точной товарной проверки. |
| 10 | [unclecode/crawl4ai](https://github.com/unclecode/crawl4ai) | SKIP | Дублирующий браузерный crawler; увеличивает runtime и ресурсы. |
| 11 | [browserbase/stagehand](https://github.com/browserbase/stagehand) | SKIP | Browser/AI action layer не нужен для детерминированного HTML извлечения. |
| 12 | [getmaxun/maxun](https://github.com/getmaxun/maxun) | REFERENCE ONLY | Полное приложение, но AGPL-3.0, повторяет продукт и потребует смены архитектуры; не переносить код в Scout без отдельного лицензионного решения. |
| 13 | [dgtlmoon/changedetection.io](https://github.com/dgtlmoon/changedetection.io) | KEEP | Уже развёрнут как отдельный продукт для мониторинга карточек; не discovery engine. |
| 14 | [projectdiscovery/katana](https://github.com/projectdiscovery/katana) | SKIP | Link/URL discovery, не товарные результаты и цены. |
| 15 | [MontFerret/ferret](https://github.com/MontFerret/ferret) | WATCH | Ещё один query/crawling runtime без сильного выигрыша поверх Scrapy. |
| 16 | [ScrapeGraphAI/Scrapegraph-ai](https://github.com/ScrapeGraphAI/Scrapegraph-ai) | SKIP | AI extraction медленнее, cost/variability и лишняя недетерминированность для price facts. |
| 17 | [jaypyles/Scraperr](https://github.com/jaypyles/Scraperr) | WATCH | Самостоятельное приложение и storage/UI; дублирует Scout, зрелость/лицензия требуют отдельного source review. |
| 18 | [go-rod/rod](https://github.com/go-rod/rod) | SKIP | Альтернатива Playwright в другом языке; не заменяет HTML crawler. |
| 19 | [microsoft/playwright](https://github.com/microsoft/playwright) | KEEP | Уже установлен и используется для независимой проверки DOM. |
| 20 | [puppeteer/puppeteer](https://github.com/puppeteer/puppeteer) | SKIP | Дублирует Playwright/Chromium без продуктовой выгоды. |
| 21 | [chromedp/chromedp](https://github.com/chromedp/chromedp) | SKIP | Дублирует браузерный runtime, добавляет Go. |
| 22 | [autoscrape-labs/pydoll](https://github.com/autoscrape-labs/pydoll) | SKIP | Дублирует browser automation, не нужен для статического HTML. |
| 23 | [SeleniumHQ/selenium](https://github.com/SeleniumHQ/selenium) | SKIP | Более широкий, но дублирующий browser/WebDriver стек. |
| 24 | [mherrmann/helium](https://github.com/mherrmann/helium) | SKIP | Удобная Selenium-обёртка, но базовая технология не нужна. |
| 25 | [lexmount/moli](https://github.com/lexmount/moli) | WATCH | Профиль проекта и зрелость недостаточны для добавления ещё одного browser engine. |
| 26 | [browserless/browserless](https://github.com/browserless/browserless) | SKIP | SSPL-1.0/коммерческая лицензия и отдельная browser service; текущий локальный процесс обходится имеющимся Playwright. |
| 27 | [rushter/selectolax](https://github.com/rushter/selectolax) | WATCH | Быстрый Python HTML parser, но Scrapy уже поставляет parsel/lxml; добавлять второй parser только по benchmark. |
| 28 | [lxml/lxml](https://github.com/lxml/lxml) | ADOPT TRANSITIVELY | Scrapy/parsel используют XPath/lxml HTML parsing; не ставить второй backend. |
| 29 | [scrapy/parsel](https://github.com/scrapy/parsel) | ADOPT TRANSITIVELY | Стандартный selector API для CSS/XPath в выбранном Scrapy. |
| 30 | [cheeriojs/cheerio](https://github.com/cheeriojs/cheerio) | SKIP | Дублирует CSS/XPath HTML parsing и переводит extraction в Node. |
| 31 | [jhy/jsoup](https://github.com/jhy/jsoup) | SKIP | Альтернативный JVM parser, стек не нужен. |
| 32 | [PuerkitoBio/goquery](https://github.com/PuerkitoBio/goquery) | SKIP | Парсер для Colly/Go, не нужен в выбранном runtime. |
| 33 | [rust-scraper/scraper](https://github.com/rust-scraper/scraper) | SKIP | Parser для Rust, дублирует parsel/lxml. |
| 34 | [servo/html5ever](https://github.com/servo/html5ever) | SKIP | Низкоуровневая HTML основа; Scrapy уже закрывает parsing. |
| 35 | [adbar/trafilatura](https://github.com/adbar/trafilatura) | SKIP | Основной текст статьи не является структурой карточки товара. |
| 36 | [alirezamika/autoscraper](https://github.com/alirezamika/autoscraper) | WATCH | Обучение по примеру потенциально помогает selectors; сейчас важнее стабильный явный schema. |
| 37 | [IonicaBizau/scrape-it](https://github.com/IonicaBizau/scrape-it) | SKIP | Дублирующий Node HTML selector layer, без очереди/robots. |
| 38 | [lorien/grab](https://github.com/lorien/grab) | SKIP | Альтернативный Python HTTP client; Scrapy уже включает downloader, retries/limits. |
| 39 | [MechanicalSoup/MechanicalSoup](https://github.com/MechanicalSoup/MechanicalSoup) | SKIP | Form navigation, не нужен для чтения открытой выдачи; может вовлечь формы/account flows. |
| 40 | [Gerapy/Gerapy](https://github.com/Gerapy/Gerapy) | SKIP | Панель управления distributed Scrapy projects; Scout single-user/local, новая БД/service не оправдана. |
| 41 | [crawlab-team/crawlab](https://github.com/crawlab-team/crawlab) | SKIP | Distributed control plane/DB для масштаба, которого у продукта нет. |
| 42 | [scrapy/scrapyd](https://github.com/scrapy/scrapyd) | SKIP | Удалённое планирование spiders не нужно для локального one-search flow. |
| 43 | [scrapy-plugins/scrapy-redis](https://github.com/scrapy-plugins/scrapy-redis) | SKIP | Redis queue избыточна при одном поисковом lock и небольшом лимите карточек. |
| 44 | [scrapy-plugins/scrapy-splash](https://github.com/scrapy-plugins/scrapy-splash) | SKIP | Отдельный render service, дублирует Playwright. |
| 45 | [scrapinghub/frontera](https://github.com/scrapinghub/frontera) | SKIP | Distributed URL frontier не нужен для одного страницы поиска. |
| 46 | [stormcrawler/StormCrawler](https://github.com/StormCrawler/StormCrawler) | SKIP | Apache Storm distributed crawling слишком велик для local Scout. |
| 47 | [apache/nutch](https://github.com/apache/nutch) | SKIP | Поисковая индексация больших сайтов, не карточный retail discovery. |
| 48 | [Norconex/collector](https://github.com/Norconex/collector) | SKIP | Корпоративная коллекция контента/индексация, не локальный price verification. |
| 49 | [Varckin/avito-parser-simple](https://github.com/Varckin/avito-parser-simple) | REFERENCE ONLY | Маленький requests/BeautifulSoup пример; нет подтверждённой подходящей лицензии/устойчивости для переноса. |
| 50 | [damir-manapov/hands-on-parsing-ozone](https://github.com/damir-manapov/hands-on-parsing-ozone) | REFERENCE ONLY | Учебный Puppeteer пример; не production-код, проверить лицензию прежде переноса, Playwright уже установлен. |

Решение «не интегрировать» не означает, что репозиторий плохой. У 50 строк есть повторяющиеся роли: одна выбранная crawl engine, один HTML selector stack, один browser stack, один URL monitor. Подключение всех альтернатив одновременно ухудшит воспроизводимость и обслуживание, не добавив 50 независимых функций.

## Шесть аудитов

1. **Product — GO:** запрос владельца напрямую просит HTML-only сбор и наращивание готовой основы. Новый режим нужен для различения «прямое чтение страницы» и текущих native tools; сохраняем текущий режим по умолчанию.
2. **Architecture — GO WITH CONDITIONS:** отдельный Scrapy worker добавляет process boundary, но принимает только marketplace enum/query/city и возвращает ограниченный JSON. Верификация проходит только существующий Playwright card reader; результаты остаются UNVERIFIED до той же проверки. Никаких изменений хранения и цены без card evidence.
3. **Structure — GO:** upstream целиком закрепляется в ignored `.runtime/external/scrapy/upstream`; адаптер, spider и runtime setup живут в `integrations/scrapy-html`/`scripts`; source checkout не копируется в `src`.
4. **Technical/security — GO WITH CONDITIONS:** Scrapy 2.19.0 из полного tag clone, BSD-3-Clause, Python>=3.11. Запустить через isolated uv environment и existing public-DNS-pinned CONNECT proxy. Строгая точная host allowlist, один GET/page per market, robots.txt on, concurrency=1, bounded time/body, redirect off, retries off, никаких environment proxy credentials/cookies, user-facing block = terminal. Если upstream HTTP client не удаётся надёжно заставить использовать это egress — не подключать live providers, оставить upstream smoke/fixture proof и закрыть условие после адаптации.
5. **Design — GO:** использовать существующую форму поиска/статусы/Tabler; добавить чёткий переключатель источника поиска «Подключённые источники / HTML страниц» с сохранением текущего default. Состояния пустого HTML, robots-disallow, block, timeout, extracted candidates и no-verifiable-price видны на русском и работают в mobile/theme.
6. **Quality — GO WITH CONDITIONS:** local fixture тестирует карточки и значения; негативные тесты закрывают arbitrary URL/host, redirect off-host, 403/429, robots deny, oversized HTML, timeout, malformed JSON, no price, and no VERIFIED promotion. Затем запуск целевого live запроса без retries. Rollback: feature mode off/убрать отдельный connector; existing runtimes/history untouched.

## Critic control (independent-pass record)

Отдельный агент недоступен по текущему режиму делегирования; выполнен отдельный skeptical review по исходным проектным правилам и официальным upstream docs.

**Initial: GO_WITH_CONDITIONS.** Критические риски: (1) Scrapy default networking bypasses browser egress; (2) Scrapy retries/redirects could continue after block or leave allowlisted domains; (3) using marketplace MCP/browser internally would violate explicit HTML-only mode; (4) automatic discovery candidates might accidentally enter persistent history/verified output; (5) adding all 50 projects would add mutually exclusive runtimes and AGPL/SSPL uncertainty.

**Conditions to close before live integration:** use per-request proxy over existing DNS-pinning CONNECT boundary; exact allowlisted host check on every request, one GET, robots enabled, no redirects/retries, terminal 403/429; dedicated HTML-only adapter calls Scrapy only and the existing page verifier only; no history writes from an incomplete/blocked operation; feature is opt-in; selected source and pin are explicit. Keep source list decisions in this audit. If any condition fails, fail closed and do not retry via another provider.

**Approval:** newest owner instruction authorizes this scope and provider change. This does not authorize publishing/merging PR or relaxing any source-block/release gate.

# Campaign Performance: Google Sheets и production release

## Текущее состояние

- Campaign UI, API endpoints, refresh queue и worker реализованы локально.
- Worker читает `Master Sheet!A:N` из Google Sheets и ServiceTitan reports `898`, `7148368`, `101394656`.
- Последний успешный snapshot хранится в Postgres; неудачный refresh его не перезаписывает.
- Worker планирует refresh текущего месяца каждые два часа в `America/Los_Angeles`.
- Production API работает, но campaign endpoint еще не развернут: campaign-код отсутствует в `main`.
- Google service account подключен локально с read-only scope. Live refresh успешно выполнен 2026-08-11 с business cutoff `2026-08-10`.
- Проверенный live snapshot: 473 Google rows, 425 Campaign Summary rows, 111 Sold Estimates rows и 425 Revenue By Campaign rows.
- Railway CLI авторизован как `ilias.iangurazov@gmail.com`, но этот account пока не является member IRBIS Railway project, поэтому production variables и deployment недоступны.

## 1. Создать Google Cloud project

1. Открыть <https://console.cloud.google.com/>.
2. В верхней панели нажать selector проекта.
3. Нажать `New Project`.
4. Название: `IRBIS Dashboard Production`.
5. Выбрать организацию IRBIS, если Console требует организацию.
6. Нажать `Create`, дождаться создания и выбрать этот проект.

Billing account для чтения Google Sheets обычно не требуется, но Console может потребовать его из-за политики организации.

## 2. Включить Google Sheets API

1. Открыть `APIs & Services` -> `Library`.
2. Найти `Google Sheets API`.
3. Открыть API и нажать `Enable`.
4. В `APIs & Services` -> `Enabled APIs & services` убедиться, что `Google Sheets API` включен.

OAuth consent screen и OAuth client создавать не нужно: integration использует service account.

## 3. Создать Service Account

1. Открыть `IAM & Admin` -> `Service Accounts`.
2. Нажать `Create service account`.
3. Заполнить:
   - Name: `IRBIS Campaign Sheets Reader`
   - ID: `irbis-campaign-sheets-reader`
   - Description: `Read-only access to monthly IRBIS Call Center sheets for the campaign dashboard`
4. Нажать `Create and continue`.
5. Не назначать `Owner`, `Editor` или другую project role.
6. Нажать `Continue`, затем `Done`.

Доступ к конкретной spreadsheet будет выдан через Google Drive Share, поэтому project role этому service account не нужна.

## 4. Скачать JSON key

1. На странице `Service Accounts` открыть созданный account.
2. Открыть вкладку `Keys`.
3. Нажать `Add key` -> `Create new key`.
4. Выбрать `JSON` -> `Create`.
5. Browser скачает JSON один раз. Не отправлять его по email, Slack или в Git.
6. Переместить файл за пределы repository, например:

```text
/Users/ilias_iangurazov/.config/irbis/irbis-campaign-sheets-reader.json
```

Если Console пишет, что key creation disabled, не отключать policy на всю организацию. Нужен project-level exception от Google Workspace/Cloud administrator или отдельная реализация Workload Identity Federation.

## 5. Выдать spreadsheet read-only access

1. Открыть JSON локально и найти `client_email`.
2. Открыть August Call Center spreadsheet:
   `1b1aZBH1cd5KSJwtpop8Wlpgm0Gfv-DR9zwh0Blunu60`.
3. Нажать `Share`.
4. Добавить значение `client_email` из JSON.
5. Выбрать `Viewer`.
6. Отключить email notification, если Google позволяет, и нажать `Share`.
7. Не включать `Anyone with the link`.

Для каждого нового месяца используется тот же service account: новый Sheet нужно расшарить тому же email, а в Railway заменить только spreadsheet ID.

## 6. Передать credentials для локального теста

Передать разработчику только абсолютный путь к JSON на этой машине. Не вставлять JSON или `private_key` в чат.

Из JSON в локальный `.env` будут перенесены:

```env
GOOGLE_CALL_CENTER_SPREADSHEET_ID=1b1aZBH1cd5KSJwtpop8Wlpgm0Gfv-DR9zwh0Blunu60
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<private_key>
```

JSON, `.env` и private key не коммитятся.

## 7. Google Sheet contract

Tab `Master Sheet` используется для actuals. Header определяется по названию, с fallback на текущие колонки:

| Поле | Fallback |
|---|---:|
| Date Received | D |
| Medium | G |
| Lead Quality | H |
| Stage | I |
| Lead Source / Campaign | N |

Строки другого месяца и строки после MTD cutoff исключаются.

Добавить tab `Campaign Plan`:

| Channel | Qualified Lead Goal | Booked Opportunity Goal | Budget | Sold Amount Goal | Revenue Goal |
|---|---:|---:|---:|---:|---:|
| Yelp | | | | | |

Plan должен быть утвержден Тимом/Эмилем. Пока tab отсутствует или goals не утверждены, интерфейс обязан показывать `MODEL PLAN`.

## 8. Утвердить pace перед финальной сдачей

Локальная версия уже использует booked opportunities как primary status:

1. `1,125` используется как August monthly booked-opportunity capacity goal.
2. Required qualified-lead supply равен `1,875` при model booking rate `60%`.
3. Primary pace считается по формуле:

```text
Expected opportunities MTD = monthly opportunity goal * elapsed calendar days / calendar days in month
Opportunity pace = actual booked opportunities / expected opportunities MTD
```

4. Qualified leads и booking rate остаются диагностическими метриками.
5. Channel model goals масштабированы с July channel mix: July baseline `675` bookings -> August target `1,125`.
6. Статусы: `On track >= 100%`, `Watch 85-99%`, `Off track < 85%`.
7. До утверждения Tim/Emil интерфейс явно показывает `MODEL PLAN`. После добавления валидного `Campaign Plan` он переключится на `CONNECTED PLAN`.

## 9. Локальный acceptance test

После настройки credentials:

1. Запустить Postgres, Redis, API, worker и web.
2. Открыть `/campaigns?month=2026-08`.
3. Нажать `Refresh data`.
4. Дождаться `Updated`.
5. Проверить четыре source indicators:
   - Google Call Center Sheet
   - ServiceTitan Campaign Summary `898`
   - ServiceTitan Sold Estimates `7148368`
   - ServiceTitan Revenue By Campaign `101394656`
6. Сверить cutoff, row count, total qualified leads, booked opportunities, sold jobs, sold amount и revenue с источниками.
7. Проверить July historical snapshot, desktop, TV `1920x1080`, mobile и print/PDF.
8. Проверить, что неудачный refresh показывает ошибку и сохраняет предыдущий snapshot.

## 10. Подготовить scoped release

Перед commit:

1. Удалить из staging `.DS_Store`, `dump.rdb`, JSON keys, `.env` и локальные generated artifacts.
2. Просмотреть все campaign и shared-file diffs, не затронув чужие незавершенные изменения.
3. Запустить typecheck, tests, production build и visual QA.
4. Проверить `git diff --check`.
5. Создать отдельный campaign commit и push в `main` только после успешного live test.

Railway production API сейчас здоров, но до deployment campaign endpoint возвращает `404`. После deployment он должен возвращать `200`.

## 11. Railway production variables

Production состоит из Railway Web, API, Worker, Postgres и Redis. Google private key нужен только Worker service.

В Railway открыть `Worker` -> `Variables` и добавить:

```env
NODE_ENV=production
APP_TIMEZONE=America/Los_Angeles
GOOGLE_CALL_CENTER_SPREADSHEET_ID=1b1aZBH1cd5KSJwtpop8Wlpgm0Gfv-DR9zwh0Blunu60
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<private_key>
YELP_API_KEY=<Yelp Fusion API key with Reporting API access>
YELP_BUSINESS_IDS=<comma-separated Yelp business IDs>
CAMPAIGN_COMPANY_REVENUE_GOAL=2000000
CAMPAIGN_MARKETING_BUDGET_RATE=0.07
CAMPAIGN_OPPORTUNITY_GOAL=1125
CAMPAIGN_TARGET_BOOKING_RATE=0.60
ST_REPORT_CAMPAIGNS=898
ST_REPORT_CAMPAIGN_SOLD_ESTIMATES=7148368
ST_REPORT_CAMPAIGN_REVENUE=101394656
```

Worker также должен использовать существующие production `DATABASE_URL`, `REDIS_URL` и ServiceTitan credentials. `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` и `YELP_API_KEY` нужно сделать sealed variables. Multiline Google private key допустим; код также понимает literal `\n`. `YELP_BUSINESS_IDS` принимает несколько Yelp Business ID через запятую.

Не добавлять Google private key в Web service или browser-visible `NEXT_PUBLIC_*` variables.

После изменения variables Railway показывает staged changes: проверить их и нажать `Deploy`.

Если IRBIS project не виден в Railway CLI, владелец project должен открыть project access settings и пригласить `ilias.iangurazov@gmail.com`. После принятия приглашения выполнить `railway link` в repository и проверить `railway status` до изменения variables.

## 12. Production deployment и smoke test

1. Push утвержденного scoped commit в `main`.
2. Дождаться успешного deploy Web, API и Worker services.
3. Проверить API health:

```bash
curl -sS https://irbisapi-production.up.railway.app/api/health/ready
```

4. Проверить campaign endpoint:

```bash
curl -sS "https://irbisapi-production.up.railway.app/api/dashboard/campaigns/performance?month=2026-08"
```

5. Открыть production `/campaigns?month=2026-08` и выполнить один manual refresh.
6. В Worker logs найти `Campaign performance snapshot refreshed`.
7. Убедиться, что `LIVE DATA`, `CONNECTED PLAN`, свежий cutoff и четыре зеленых sources видны в UI.
8. Через два часа проверить следующий automatic refresh.

## Definition of Done

- Google Sheet закрыт от публичного доступа и доступен service account только как Viewer.
- Live refresh успешно прочитал Google Sheet и три ServiceTitan reports.
- Opportunity pace и status согласованы и протестированы.
- Утвержденные channel goals показываются как `CONNECTED PLAN`.
- Production campaign endpoint возвращает `200`.
- Manual и scheduled refresh работают через Railway Worker.
- July остается immutable historical snapshot, текущий месяц обновляется.
- TV, laptop, mobile и print layout визуально проверены.
- Ни один credential не попал в Git, logs или browser bundle.

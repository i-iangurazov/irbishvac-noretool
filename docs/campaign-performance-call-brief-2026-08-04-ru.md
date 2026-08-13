# Campaign Performance: что показать на звонке 4 августа

## Что уже готово

1. На странице `/campaigns` собран новый MTD Plan vs Actual экран для маркетинга.
2. В один экран сведены три реальных потока данных:
   - August Call Center Report: calls, forms, qualified leads и booked jobs;
   - ServiceTitan Sold Estimates, report `7148368`: количество sold estimates и sold amount по campaign;
   - ServiceTitan Campaign Summary / Revenue By Campaign, reports `898` и `101394656`: completed revenue, доступный spend и ROI.
3. Сделан одностраничный landscape PDF для Thursday review.
4. Экран визуально проверен на `1920x1080` и `1365x768`: вертикального и горизонтального overflow нет.

## Что сказать в начале звонка

> Я собрал первую рабочую MTD-версию marketing campaign dashboard. Это уже не макет: Call Center actuals объединены с ServiceTitan sold estimates, completed revenue и доступным spend. На первом экране видны leads против draft goal, pace, booked jobs, booking rate, sold amount, completed revenue и проблемные каналы. Из этого же экрана уже генерируется одностраничный PDF для Thursday review.

## Реальные August MTD цифры на 4 августа

| Показатель | Значение | Источник |
|---|---:|---|
| Qualified leads | 132 | August Call Center Report, строки после 4 августа исключены |
| Booked jobs | 69 | August Call Center Report |
| Booking rate | 52.3% | `69 / 132` |
| Sold estimates | 16 | ServiceTitan report `7148368` |
| Sold amount | $112,067.27 | ServiceTitan report `7148368` |
| Completed revenue | $104,097.27 | ServiceTitan campaign reports |
| Tracked spend | $2,547.61 | ServiceTitan Campaign Summary; покрытие неполное |

## Что на экране пока DRAFT

- Company revenue goal: `$2,000,000`.
- Marketing budget model: `7%`, или `$140,000`.
- Общий lead goal: `1,125` на основе capacity assumptions со встречи:
  - 5 HVAC Service x 3 opportunities/day;
  - 2 Maintenance x 3;
  - 1 Commercial x 3;
  - 3 Plumbing Service x 3;
  - 3 Comfort Advisors x 4;
  - 25 planning days.
- Channel lead goals временно распределены пропорционально July qualified lead mix. После получения утвержденного August plan от Эмиля эта модель заменяется плановыми числами без изменения интерфейса.
- Channel budget и completed revenue goals временно распределены по доле July completed revenue из ServiceTitan. Суммы сходятся с общими `$140,000` и `$2,000,000`, но это planning model, а не утвержденный план Эмиля.

## Два решения, которые нужны на звонке

### 1. Утвердить источник August campaign plan

Сейчас загруженные July/August Call Center Excel содержат actual leads и bookings, но не содержат channel goals, budget plan и revenue plan. Поэтому нужно решить, где Эмиль один раз в начале месяца утверждает по каждому каналу:

`Channel | Lead goal | Booked job goal | Budget | Sold amount goal | Revenue goal`

Предложение для MVP: одна Google Sheet в общей папке, один tab на месяц. Dashboard читает ее ежедневно, а ServiceTitan actuals обновляет автоматически.

### 2. Утвердить источник полного marketing spend

ServiceTitan сейчас отдает `$2,547.61`, но это только подключенные расходы, в основном Google campaigns. Yelp и другие manual costs в поле Cost отсутствуют, хотя revenue и ROI для них частично есть. Нельзя показывать этот spend как полный маркетинговый расход.

Предложение для MVP: Эмиль поддерживает manual spend в том же monthly plan sheet; Google/ServiceTitan spend обновляется автоматически, manual channels обновляются ответственным сотрудником.

## Что важно показать прямо на экране

- Yelp: 52 qualified leads, 13 booked, booking rate 25%.
- Workfuel: 18 qualified leads, 4 booked, booking rate 22%.
- Facebook: 9 qualified leads, 2 booked, booking rate 22%.
- Google Ads: 9 qualified leads и 10 booked. Это data-quality mismatch, который нужно проверить в call-center qualification process.
- Website: 12 qualified leads, 12 booked, 2 sold estimates, $36.84K completed revenue.

## Предлагаемый Thursday workflow

1. Wednesday 11:59 PM PT: MTD cutoff.
2. Thursday 5:30 AM PT: автоматическое чтение current-month Call Center Sheet.
3. Thursday 5:35 AM PT: ServiceTitan reports `7148368`, `101394656` и `898`.
4. Нормализация granular campaign names в общие channels.
5. Расчет Plan vs Actual, pace и alerts.
6. Генерация manager PDF и обновление `/campaigns`.
7. Thursday 7:00 AM PT: email Tim + Emil с PDF и ссылкой на dashboard.

Пока реализованы шаги 2-6 как воспроизводимый prototype. Scheduler и автоматическая email-отправка еще не включены.

## Следующая техническая итерация

1. Подключить approved August plan Google Sheet.
2. Добавить source для manual spend.
3. Согласовать mapping granular ServiceTitan campaigns в 10-15 executive channels.
4. Перенести current-month Call Center Sheet из ручного XLSX в ежедневное чтение общей Drive folder.
5. Добавить drill-down по lead type и business unit после утверждения executive view.
6. Подключить Hatch только после того, как все lead sources проходят через него стабильно.

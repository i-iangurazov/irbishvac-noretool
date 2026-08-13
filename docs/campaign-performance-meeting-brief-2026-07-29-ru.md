# Performance Dashboard / Campaigns: подготовка к звонку

## Что Тим подтвердил 28 июля

### Technician performance

- V4 weekly coaching report принят как рабочая стартовая версия: Тим сказал, что с него можно начинать.
- На этой неделе главный operational шаг: запустить Field Pro у всех нужных техников, дать инструкцию в Slack и проверить тех, у кого ещё нет записей.
- Следующий UI-этап для technician dashboard: показывать `actual / goal` для revenue, close rate, memberships, total sales и reviews.
- Нужно добавить недостающие фотографии техников.

### Campaign performance

Текущий `/campaigns` должен стать системой `Plan vs Actual`, а не только leaderboard фактических результатов.

Для каждой кампании Тим хочет видеть:

- monthly lead goal;
- actual leads;
- planned budget и actual spend;
- booked jobs;
- sales;
- completed revenue;
- cost efficiency и ROI;
- pace/status, чтобы быстро видеть перерасход или кампанию, которая даёт лиды без продаж.

План должен пересчитываться из:

- company revenue goal;
- marketing budget, ориентир 7% от revenue goal;
- количества активных service technicians, maintenance technicians, commercial technicians, plumbers и Comfort Advisors;
- необходимого количества новых opportunities/jobs на человека в день;
- количества рабочих дней;
- исторической эффективности каналов и кампаний.

Количество opportunities, которое маркетинг должен создать, должно быть связано с capacity/targets техников.

## Что уже есть в `/campaigns`

- ServiceTitan Campaign Summary Report уже подключён как MTD data source.
- Domain model уже получает: Lead Calls, Booked Jobs By Call, Booking Rate, Campaign Leads, Total Jobs Booked, Cancellations, Campaign Cost, Completed Revenue и ROI.
- UI сейчас показывает только Calls, Booked By Call, Booking Rate, Cost и Revenue.
- Страница ранжирует кампании по Lead Calls.

## Чего пока нет

- Хранилища monthly plan на уровне отдельной кампании.
- Lead goal, budget goal и sales goal.
- Plan vs Actual и pacing по рабочим дням.
- Связи campaign lead goals с technician opportunity demand.
- Sales count в текущей UI-модели.
- Процесса создания, утверждения и изменения monthly marketing plan.
- Единой регистрации всех лидов через Hatch. Это следующий integration layer, не блокер для первого `/campaigns` MVP.

## Как Campaign reporting реализован в Retool

Retool автоматизирует только загрузку фактических данных, но не формирование marketing plan:

1. Workflow `ST Dashboards` получает общий ServiceTitan OAuth token через `ST_getToken`.
2. После загрузки предыдущих dashboard families workflow ждёт фиксированные 70 секунд.
3. Query `getCampaign` вызывает ServiceTitan Campaign Summary Report:
   category `marketing`, report ID `898`.
4. Query `populateCampaign` сохраняет полученный raw JSON snapshot в Retool DB table `st_campaign`.
5. Campaign Summary page использует два пути чтения:
   - `getCSRData5` — прямой REST result;
   - `getCSR5` — SQL fallback из `st_campaign`.
6. Custom widget `html13.html` сортирует кампании и показывает leaderboard с Lead Calls, Booked Jobs By Call, Booking Rate, Campaign Leads, Total Jobs Booked, Cancellations, Campaign Cost, Completed Revenue и ROI.

Ограничения Retool flow:

- фиксированные `70 sec` waits используются вместо проверки готовности API;
- snapshots сохраняются как raw JSON, без campaign plan entities;
- нет campaign goals, budget revisions, approvals и Plan vs Actual;
- нет связи campaign lead demand с roster/capacity техников;
- нет alert logic по pace, overspend или spend without sales.

В noretool фактическая часть уже перенесена более устойчиво: worker загружает `campaigns:mtd` и `campaigns:ytd`, сохраняет snapshots, domain layer нормализует campaign fields, API отдаёт dashboard model, а `/campaigns` рендерит результат. Автоматизировать нужно следующий planning layer, а не повторно строить Retool ingestion.

## Как автоматизировать reporting

Предлагаемый end-to-end flow:

1. В начале месяца система получает company revenue goal, budget percent, working days и planned roster.
2. Рассчитывает общий opportunity demand по ролям и месячный marketing lead goal.
3. После подтверждения формулы Эмиля распределяет lead goal и budget по canonical campaigns с учётом historical performance и ограничений.
4. Эмиль проверяет draft, при необходимости корректирует и отправляет на approval.
5. Утверждённая версия фиксируется; последующие изменения создают revision, а не переписывают исходный plan.
6. Worker регулярно обновляет ServiceTitan actuals.
7. `/campaigns` объединяет утверждённый plan с actuals и рассчитывает pace, CPL, cost per sale, ROI и variance.
8. Alerts создаются для overspend, lead pace behind, spend without sales и missing campaign mapping.
9. Weekly summary автоматически формируется для Tim и Emil с изменениями, проблемами и recommended actions.

## Предлагаемый MVP

1. Создать monthly campaign plan с полями:
   `month`, `campaign`, `leadGoal`, `budgetGoal`, `revenueGoal`, `owner`, `status`.
2. Добавить monthly planning inputs:
   `companyRevenueGoal`, `marketingBudgetPercent`, `workingDays`, roster и opportunities/day по каждой роли.
3. Соединить plan с текущими ServiceTitan campaign actuals по canonical campaign name.
4. Переделать `/campaigns` в рабочую таблицу Plan vs Actual:
   Leads, Spend, Booked, Sales, Revenue, CPL, ROI, Pace и Status.
5. Добавить alerts:
   budget overspend, lead pace behind, spend without sales, missing campaign mapping.
6. После проверки формулы Эмилем автоматизировать распределение бюджета по historical channel performance.

## Вопросы Эмилю с контекстом

### 1. Текущая формула marketing plan

На встрече Тим сказал, что у Эмиля уже есть определённая методика подготовки monthly marketing plan и что её потенциально можно автоматизировать. Но сама формула, порядок действий и исходный документ нам пока не переданы.

**Вопрос:** Эмиль, можешь показать текущий Excel или другой документ с marketing plan на одном завершённом месяце и пошагово объяснить, какие значения вводятся вручную, какие рассчитываются формулами и какой результат считается финальным утверждённым планом?

**Зачем:** без реального примера мы можем построить удобный интерфейс, который будет считать план иначе, чем это сейчас делает маркетинг.

### 2. Campaign mapping

ServiceTitan уже возвращает actuals по campaign names, но план может использовать другие названия или объединять несколько ServiceTitan campaigns в один канал, например Yelp, Existing Clients или Direct Web.

**Вопрос:** какой точный список каналов и кампаний должен присутствовать в плане и есть ли таблица соответствия между названиями в marketing plan, ServiceTitan, Yelp, Google и Meta?

**Зачем:** Plan и Actual можно корректно объединить только по стабильному campaign identifier или согласованному mapping.

### 3. Правило распределения бюджета

Тим описал распределение marketing budget пропорционально историческому результату основных кампаний, но не уточнил, какой именно показатель определяет эту пропорцию.

**Вопрос:** бюджет распределяется по доле completed revenue, sold revenue, количеству leads, ROI, прошлому бюджету или сначала рассчитывается автоматически, а затем вручную корректируется?

**Зачем:** каждый вариант даст совершенно разные campaign budgets и lead goals.

### 4. Определения Lead, Opportunity и Sale

На встрече одновременно использовались слова leads, booked jobs, opportunities и sales. В ServiceTitan и marketing process это разные стадии funnel.

**Вопрос:** что именно Эмиль считает lead, opportunity и sale в текущем плане? Например, opportunity — это каждый новый booked job, только marketing-attributed job или переданный технику qualified lead?

**Зачем:** иначе target может быть рассчитан в одной единице, а actual показан в другой.

### 5. Ограничения по бюджету кампаний

Ситуация с Yelp показала, что простое перераспределение месячного бюджета в середине месяца может привести к неожиданному overspend.

**Вопрос:** существуют ли у кампаний обязательные minimum/maximum budgets, договорные лимиты или ограничения на изменение бюджета в течение месяца?

**Зачем:** автоматический план не должен предлагать значение, которое нельзя применить в рекламной системе или которое создаст перерасход.

### 6. Источник actual spend

Campaign Summary в ServiceTitan содержит Campaign Cost, но не подтверждено, что этот показатель полный и оперативный для всех каналов.

**Вопрос:** для каких каналов actual spend в ServiceTitan считается достоверным, а для каких нужно получать данные напрямую из Yelp, Google Ads или Meta?

**Зачем:** alerts по overspend и CPL бессмысленны, если spend обновляется с задержкой или не включает часть расходов.

## Вопросы Тиму с контекстом

### 1. Граница первого MVP

На встрече одновременно обсуждались ввод целей, ежедневный Plan vs Actual и автоматическое формирование marketing plan. Полная автоматическая модель требует сначала формализовать методику Эмиля.

**Вопрос:** правильно ли начать с MVP, где Эмиль вручную вводит или импортирует утверждённые lead и budget goals, а `/campaigns` автоматически показывает ServiceTitan actuals, pace и alerts? После проверки этого слоя мы автоматизируем расчёт самого плана.

**Почему это важно:** такой порядок позволяет быстро получить рабочий контрольный dashboard, не блокируя проект сложной и пока не подтверждённой формулой allocation.

### 2. Правило 7% marketing budget

Тим привёл пример: при revenue goal $2M marketing budget составляет около 7%, то есть $140K. Неясно, это обязательное company rule или пример текущего месяца.

**Вопрос:** 7% всегда рассчитывается автоматически от company revenue goal или это редактируемый monthly input, который может меняться по решению руководства?

**Почему это важно:** от этого зависит, хранить процент как системное правило или как значение конкретного monthly plan.

### 3. Technician capacity и opportunity demand

Тим связал marketing lead plan с количеством работающих техников и привёл ориентиры 3-4 новых jobs в день. В прошлой переписке использовались 3 opportunities/day для service и 4/day для sales, но на новой встрече перечислены также maintenance, commercial и plumbing.

**Вопрос:** какие exact opportunities/day применять отдельно для HVAC Service, Maintenance, Commercial, Plumbing Service и Comfort Advisors? Нужно ли учитывать отпуска, неполный месяц и фактические рабочие дни каждого человека?

**Почему это важно:** это основа общего lead goal маркетинга; неправильный capacity input изменит весь campaign plan.

### 4. Значение Sales на `/campaigns`

Тим попросил показывать для кампании leads, spend, revenue и sales. В ServiceTitan можно трактовать sales как количество sold jobs, sold revenue или количество converted opportunities.

**Вопрос:** какой показатель должен называться `Sales`: количество проданных jobs, количество converted opportunities или dollar amount sold? Нужны ли одновременно count и amount?

**Почему это важно:** от определения зависят conversion rate, cost per sale и alerts вида “кампания тратит деньги, но не продаёт”.

### 5. Pace по рабочим или календарным дням

Тим хочет видеть выполнение плана каждый день и каждую неделю. При этом technician opportunity demand рассчитывается из рабочих дней, а advertising spend идёт и в выходные.

**Вопрос:** lead pace и sales pace считать по рабочим дням, а budget pace по календарным, или для всех показателей использовать одну временную шкалу?

**Почему это важно:** единый неправильный знаменатель будет создавать ложные red/green statuses, особенно после выходных.

### 6. Утверждение и изменение плана

На примере Yelp видно, что budget может меняться в середине месяца и важно сохранить исходный план, корректировку и ответственность за изменение.

**Вопрос:** кто создаёт monthly plan, кто его утверждает и кто имеет право менять campaign budgets после начала месяца? Нужно ли хранить original plan, revised plan, причину изменения и дату approval?

**Почему это важно:** без versioning dashboard перепишет историю, и будет невозможно понять, был ли overspend реальным или план изменили задним числом.

## Статус, который можно сказать на звонке

> Я разобрал требования после вчерашнего звонка и сверил их с текущим `/campaigns`. ServiceTitan actuals уже подключены: calls, leads, bookings, cancellations, spend, revenue и ROI. Главный отсутствующий слой — monthly campaign plan и связь lead goals с technician capacity. Я предлагаю первым этапом добавить ручной утверждаемый plan и Plan vs Actual на `/campaigns`, а автоматическое распределение бюджета делать вторым этапом после того, как Эмиль покажет точную формулу и исходный monthly plan. V4 technician report остаётся рабочей базой; отдельно на этой неделе закрываю Field Pro adoption.

## Ближайшие действия

- Сегодня: получить от Эмиля текущий plan/template и один заполненный пример.
- После подтверждения: зафиксировать campaign plan schema и mapping кампаний ServiceTitan.
- Первый build: campaign plan input + Plan vs Actual table + pacing/status.
- Второй build: capacity-driven lead demand и автоматическое budget allocation.
- Позже: подключить полный Hatch lead flow для marketing и call-center visibility.

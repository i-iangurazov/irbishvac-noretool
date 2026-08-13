# Что нужно получить для финальной рассылки MTD-отчётов

Дата отчёта: 23 июля 2026 года
Срок Тима: до 7:00 AM Pacific 24 июля 2026 года

## Что уже есть

- 12 отдельных одностраничных PDF: 8 HVAC и 4 Plumbing.
- MTD actuals из ServiceTitan.
- Opportunities, conversion/close rate, average sale, completed jobs, Options per Opportunity, memberships и recalls.
- MTD Field Pro recording coverage и длительность записей.
- Email-адреса всех 12 техников.
- Визуальная проверка всех 12 страниц и автоматическая проверка overflow.

Повторно добывать ServiceTitan и Field Pro выгрузки сейчас не нужно.

Последний файл `Tech Conversion Report  (1).xlsx` уже обработан. Это membership report с датой 20 июля 2026 года. Он подтверждает membership goals `5` для Ethan Peters, Bahruz Brian Rasulov и Le'Jhavani De La Cruz-Robello, но не содержит их sales goals.

## 1. Подтверждённый sales plan

### Где искать

В Gmail используй такой запрос:

```text
from:tim@irbishvac.com has:attachment after:2026/07/01 (filename:xlsx OR filename:csv)
```

Также проверь Google Drive по словам `sales plan`, `July goals`, `technician goals`, `service goals` и `Tech Conversion Report`.

### Что конкретно отсутствует

Нужны July sales goals для:

- Ethan Peters, HVAC Maintenance;
- Bahruz Brian Rasulov, HVAC Service;
- Le'Jhavani De La Cruz-Robello, Plumbing Service.

Для остальных сотрудников цели найдены, но источник имеет статус `DRAFT`. Тим должен подтвердить, что эти цифры можно использовать для рассылки.

### Какие поля нужны

Минимально для каждого техника:

| Поле | Пример |
| --- | --- |
| Month | `2026-07` |
| Technician | `Almaz Shamsharbek` |
| Department | `HVAC Service` |
| Monthly sales goal | `24000` |
| Monthly opportunities goal | `26` |
| Target conversion/close rate | `58%` |
| Target average sale | `1590` |
| Monthly membership goal | `4` |
| Active for this report | `Yes/No` |

Excel может содержать несколько листов. Не надо его переделывать: скачай оригинальный `.xlsx` и сообщи полный путь к файлу.

## 2. Подтверждение списка техников

Сейчас отчёты созданы для:

- HVAC: Kenneth Cox, Ethan Peters, Almaz Shamsharbek, Bahruz Brian Rasulov, Christian Lopez, Eduardo Loera-Gaeta, Ivan Avila, Jonathan Camargo.
- Plumbing: Azat Akynov, Bekbol Kenzheev, Christian Vasquez, Le'Jhavani De La Cruz-Robello.

В старом goal-файле также есть Winston Reyes и Brian Mota, но их нет в актуальной MTD Performance Board выборке. Нужно получить от Тима или менеджеров ответ: включать ли их в рассылку и исключать ли кого-то из текущих 12.

## 3. Dispatcher Auditor alerts

### Где они находятся

Production-агент отправляет ServiceTitan/Dispatcher alerts в Slack-канал с ID:

```text
C0B7M9AU97Y
```

В Slack найди канал по сообщению `ServiceTitan Weekly Audit Summary` или по alert-сообщениям с названиями `HVAC Service` / `Plumbing Service`.

### Самый быстрый ручной вариант

В Slack выполни поиск:

```text
after:2026-07-01 before:2026-07-24 "ServiceTitan"
```

Экспортировать Slack одним файлом не нужно. Пришли последовательные скриншоты результатов поиска по HVAC Service и Plumbing Service. Если результатов нет, достаточно скриншота пустой выдачи с видимым поисковым запросом и диапазоном дат. Для каждого найденного alert должны быть видны:

- technician;
- job number;
- дата;
- alert/rule, например late arrival, fewer than three options, missing form или missing photos;
- статус, если видно: open/resolved.

### Правильный автоматизированный вариант

У Slack-бота сейчас нет разрешения читать историю канала. В настройках Slack App:

1. Открой `OAuth & Permissions`.
2. В `Bot Token Scopes` добавь `channels:history`.
3. Если audit-канал private, добавь также `groups:history`.
4. Нажми `Reinstall to Workspace`.
5. Убедись, что бот добавлен в audit-канал.
6. Напиши мне только `Slack history access added`. Сам токен присылать не нужно.

После этого alerts можно будет автоматически связать с technician и job number.

### Текущий известный пробел

Последний доступный production-цикл проверил 67 HVAC Service jobs и не обнаружил HVAC failures. Plumbing Service в этом цикле не проверялся. Поэтому нельзя писать техникам `0 Plumbing alerts`: корректная формулировка сейчас только `Plumbing audit data unavailable`.

## 4. Email Ben и Anthony

Открой письмо Тима в Gmail. Нажми стрелку `Show details` возле строки получателей или наведи курсор на имена Ben и Anthony. Скопируй их полные email-адреса и пришли в таком виде:

```text
Ben: ...@irbishvac.com
Anthony: ...@irbishvac.com
```

Не надо угадывать адреса по имени.

## 5. От какого адреса отправлять

Сейчас автоматическая SMTP-отправка доступна только от:

```text
marketing@irbishvac.com
```

Нужно одно подтверждение:

```text
Разрешаю отправить от marketing@irbishvac.com
```

Если письма должны уйти строго от `it@irbishvac.com`, их нужно отправить вручную через Gmail либо отдельно настроить SMTP/OAuth для этого mailbox.

## Готовое сообщение Тиму

```text
Тим, первая версия MTD coaching reports уже сформирована: 12 отдельных одностраничных PDF для текущего HVAC/Plumbing service roster. В них включены ServiceTitan actuals, opportunities, conversion/close rate, average sale, Options per Opportunity, jobs, memberships, recalls и Field Pro coverage. Все 12 файлов визуально проверены.

Перед финальной рассылкой прошу подтвердить три отсутствующие July sales goals: Ethan Peters, Bahruz Brian Rasulov и Le'Jhavani De La Cruz-Robello. Также подтвердите, пожалуйста, текущий roster: нужно ли добавлять Winston Reyes и Brian Mota, которых нет в актуальной MTD Performance Board выборке.

По Dispatcher Auditor: последний production-цикл проверил 67 HVAC Service jobs и не нашёл HVAC failures; Plumbing Service в этом цикле не был покрыт. Поэтому в V1 я могу честно показать отсутствие найденных HVAC alerts и отметить Plumbing audit coverage как unavailable, пока Plumbing scope не будет включён или не будут переданы alerts вручную.

Также пришлите, пожалуйста, точные email Ben и Anthony для CC.
```

## Что передать мне одним сообщением

```text
1. Путь к sales-plan Excel или три отсутствующие цели.
2. Подтверждение текущего списка техников.
3. Dispatcher Auditor screenshots/text либо сообщение "Slack history access added".
4. Ben email.
5. Anthony email.
6. Разрешённый sender: marketing@irbishvac.com или it@irbishvac.com.
```

После получения этих данных остаётся перегенерировать PDF, ещё раз визуально проверить все страницы, собрать recipient manifest и выполнить рассылку после явного подтверждения.

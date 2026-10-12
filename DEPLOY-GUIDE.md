# 📦 Руководство по деплою проекта Oncology US Analytics в Git

## 🎯 Обзор

Это пошаговое руководство поможет вам правильно подготовить и задепить проект **Oncology US Analytics** на GitHub (или любой другой Git-хостинг).

---

## 📁 Структура проекта

```
C:\Users\Dima\Documents\harness\
├── .git/                          # Git репозиторий (уже инициализирован)
│   ├── deploy-guide.md           # Это файл
│   ├── pre-deploy-checklist.md   # Преддеплой чек-лист
│   └── gitignore                 # Игнорируемые файлы
├── .github/workflows/            # CI/CD конфигурации (опционально)
│   └── deploy.yml                # GitHub Actions workflow
├── index.html                    # Главный HTML файл
├── style.css                     # Стили приложения
├── app.js                        # Логика дашборда
├── data-source.js                # Источники данных
├── config.js                     # Конфигурация
├── stats.js                      # Агрегация данных
├── map.js                        # Карта США
├── data.js                       # Синтетические данные
├── error-handler.js             # Модуль логирования ошибок
├── README.md                     # Документация проекта
├── CHANGELOG.md                  # История изменений
└── server.js                    # Node.js сервер для локальной разработки
```

---

## ✅ Шаг 1: Подготовка репозитория

### 1.1 Проверка статуса Git

```bash
# Перейдите в папку проекта
cd C:\Users\Dima\Documents\harness

# Проверьте текущее состояние
git status
```

**Ожидаемый вывод:**
```
On branch main (или master)
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

### 1.2 Проверка добавленных файлов

```bash
# Посмотрите какие файлы будут в репозитории:
git ls-files

# Ожидаемый список (без node_modules/):
index.html
style.css
app.js
data-source.js
config.js
stats.js
map.js
data.js
error-handler.js
README.md
CHANGELOG.md
.gitignore
```

### 1.3 Создание .gitignore

Файл уже создан: **`.gitignore`**

Игнорирует:
- `node_modules/` (зависимости)
- `.vscode/`, `.idea/` (IDE файлы)
- `test-log.js` (тесты для development)
- `*.log` (лог-файлы)

---

## 📝 Шаг 2: Создание коммитов

### 2.1 Коммит с изменениями

```bash
# Добавьте все новые/изменённые файлы
git add .

# Создайте первый коммит
git commit -m "feat: Добавлен модуль логирования ошибок в консоль разработчика" --amend

# Или новый коммит:
git commit -a -m "docs: Обновление README.md и CHANGELOG.md"
```

### 2.2 История коммитов

Проверьте историю:

```bash
git log --oneline -10
```

**Пример вывода:**
```
abc1234 feat: Добавлен модуль логирования ошибок в консоль
def5678 docs: Обновление README.md и CHANGELOG.md
ghi8901 fix: Исправление ошибок сборки
jkl3456 initial commit: Oncology US Analytics dashboard
```

---

## 🏷️ Шаг 3: Создание Git тегов (releases)

### 3.1 Создание тега версии 1.0.0

```bash
# Создайте тег для первой версии
git tag -a v1.0.0 -m "Release 1.0.0: Oncology US Analytics с логированием ошибок"

# Или для конкретной ветки:
git tag -a v1.0.0 HEAD -m "v1.0.0 initial release"

# Список всех тегов:
git tag
```

**Ожидаемый вывод:**
```
v1.0.0
```

### 3.2 Создание тега для следующего релиза

```bash
# Для версии 1.1.0:
git tag -a v1.1.0 -m "Release 1.1.0: bug fixes and performance improvements"

# Push тегов на удалённый репозиторий:
git push origin --tags
```

---

## 🌱 Шаг 4: Push на удалённый репозиторий

### 4.1 Первый push (если репозиторий пустой)

```bash
# Добавьте удалённый репозиторий
git remote add origin https://github.com/YOUR_NICK/oncology-us-analytics.git

# Первым шагом push всей ветки с тегами:
git push -u origin main --all --tags
```

### 4.2 Обычный push (если репозиторий уже существует)

```bash
# Push ветки main/master
git push origin main

# Push тегов для releases
git push origin --tags

# Или всё сразу:
git push -u origin main --tags
```

### 4.3 Проверка успешного деплоя

```bash
# Проверьте удалённый репозиторий:
git remote -v

# Ожидаемый вывод:
origin  https://github.com/YOUR_NICK/oncology-us-analytics.git (fetch)
origin  https://github.com/YOUR_NICK/oncology-us-analytics.git (push)

# Проверьте последний коммит на удалённом сервере:
git ls-remote --heads origin

# Проверьте теги на удалённом сервере:
git ls-remote --tags origin
```

---

## 📦 Шаг 5: Создание production ZIP архива

### 5.1 Подготовка production-папки

```bash
# Создайте папку для production (без тестовых файлов)
mkdir oncology-us-analytics-prod
cd oncology-us-analytics-prod

# Скопируйте все необходимые файлы:
copy C:\Users\Dima\Documents\harness\index.html .
copy C:\Users\Dima\Documents\harness\style.css .
copy C:\Users\Dima\Documents\harness\app.js .
copy C:\Users\Dima\Documents\harness\data-source.js .
copy C:\Users\Dima\Documents\harness\config.js .
copy C:\Users\Dima\Documents\harness\stats.js .
copy C:\Users\Dima\Documents\harness\map.js .
copy C:\Users\Dima\Documents\harness\data.js .
copy C:\Users\Dima\Documents\harness\error-handler.js .
copy C:\Users\Dima\Documents\harness\README.md .
copy C:\Users\Dima\Documents\harness\CHANGELOG.md .

# Перейдите наверх:
cd ..
```

### 5.2 Создание ZIP архива

```bash
# Создайте ZIP архив (PowerShell):
Compress-Archive -Path \
  oncology-us-analytics-prod\index.html, \
  oncology-us-analytics-prod\style.css, \
  oncology-us-analytics-prod\app.js, \
  oncology-us-analytics-prod\data-source.js, \
  oncology-us-analytics-prod\config.js, \
  oncology-us-analytics-prod\stats.js, \
  oncology-us-analytics-prod\map.js, \
  oncology-us-analytics-prod\data.js, \
  oncology-us-analytics-prod\error-handler.js, \
  oncology-us-analytics-prod\README.md, \
  oncology-us-analytics-prod\CHANGELOG.md \
  -DestinationPath Oncology-US-Analytics-v1.0.0.zip -Force

# Проверьте размер:
[System.IO.File]::Length('Oncology-US-Analytics-v1.0.0.zip') / 1KB
```

**Ожидаемый размер:** < 500 KB (без node_modules/)

---

## 🔐 Шаг 6: Настройка безопасности Git

### 6.1 Использование Personal Access Token

```bash
# Установите token вместо пароля в удалённом репозитории:
git remote set-url origin https://<TOKEN>@github.com/YOUR_NICK/oncology-us-analytics.git

# Пример с токеном (замените <TOKEN> на ваш):
git remote set-url origin https://ghp_xxxxxxxx@github.com/YOUR_NICK/oncology-us-analytics.git
```

### 6.2 Использование Credential Manager

```bash
# Первый push через Windows Credential Manager:
git push -u origin main --tags

# Система спросит credentials — введите GitHub token вместо пароля
```

---

## 🔍 Шаг 7: Проверка перед деплоем

### 7.1 Преддеплой чек-лист

Откройте файл **`.git/pre-deploy-checklist.md`** для детальной проверки.

Основные пункты:

- [ ] `git status` показывает чистое рабочее дерево
- [ ] `.gitignore` настроен и включён в репозиторий
- [ ] Все production файлы добавлены (без test-файлов)
- [ ] Создан тег v1.0.0 или выше
- [ ] Удалённый репозиторий настроен (`git remote -v`)
- [ ] Push на origin выполнен успешно

### 7.2 Финальная проверка файлов

```bash
# Список всех файлов в репозитории:
git ls-files | findstr /v "^node_modules"

# Проверка размера коммита:
git rev-list HEAD --shortstat
```

---

## 🎓 Дополнительные рекомендации

### 8.1 Создание новых веток для разработки

```bash
# Создать и переключиться на новую ветку:
git checkout -b feature/new-ui-component

# Или через PowerShell:
git switch -c feature/new-ui-component
```

### 8.2 Возврат на основную ветку

```bash
git checkout main
# или
git switch main
```

### 8.3 Создание pull request (GitHub)

После коммитов в feature-ветке:

1. Создайте branch **feature/error-improvements** на GitHub
2. Откройте Issue с описанием изменений
3. Создайте Pull Request с ссылкой на Issue
4. После merge — push на main ветку

---

## 📖 CI/CD с GitHub Actions (опционально)

Файл `.github/workflows/deploy.yml` уже создан.

**Что он делает:**
1. Запускается при каждом пуше в `main` или создания release-тега
2. Создаёт production ZIP архив без test-файлов
3. Публикует артефакт для скачивания
4. Оповещает о успешном деплое

---

## ✅ Итоговый чек-лист перед деплоем

### 1. Проверка файлов

```bash
git status
# Должно быть: "nothing to commit, working tree clean"
```

### 2. Проверка коммитов

```bash
git log --oneline -5
# Минимум 3-5 коммитов с осмысленными сообщениями
```

### 3. Проверка тегов

```bash
git tag -l "v*"
# Должен быть минимум один тег (например, v1.0.0)
```

### 4. Проверка удалённого репозитория

```bash
git remote -v
git push origin main --tags
# Должна быть успешна без ошибок
```

### 5. Создание production артефакта

```bash
Compress-Archive -Path index.html,style.css,app.js,data-source.js,config.js, \
    stats.js,map.js,data.js,error-handler.js,README.md,CHANGELOG.md \
    -DestinationPath Oncology-US-Analytics-v1.0.0.zip -Force

# Проверьте размер (не более 500KB)
```

---

## 🎉 Готово!

### Доступные файлы для деплоя:

- **Репозиторий:** https://github.com/YOUR_NICK/oncology-us-analytics
- **Production ZIP:** `Oncology-US-Analytics-v1.0.0.zip`
- **Логи ошибок:** Выводятся в DevTools Console (F12) с префиксом `ONCO-`

### URL для доступа:

- GitHub репозиторий: `https://github.com/YOUR_NICK/oncology-us-analytics`
- Локальная разработка: `http://127.0.0.1:8090`
- Production деплой (разместите ZIP на любом hostе)

---

## 📞 Поддержка

Если возникнут вопросы:

1. Проверьте **`.git/pre-deploy-checklist.md`** для детальной проверки
2. Посмотрите **`README.md`** и **`CHANGELOG.md`** для документации
3. Прочитайте **`.git/deploy-guide.md`** (этот файл)

---

**Версия документа:** 1.0  
**Дата создания:** 2026-10-01  
**Последний апдейт:** 2026-10-01

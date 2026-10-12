# 🌐 Инструкция по развертыванию Oncology US Analytics на бесплатном хостинге

## 🎯 Обзор проектов

Проект **Oncology US Analytics** — это чистый SPA (Single Page Application) без бэкенда:

```
index.html + style.css + app.js + data-source.js + server.js + ...
```

✅ Идеален для размещения на любом статическом хостинге!

---

## 📊 Рейтинг бесплатных хостингов

| Платформа | Бесплатно | SSL | Custom Domain | CI/CD | Рекомендация |
|-----------|-----------|-----|---------------|-------|--------------|
| **GitHub Pages** | ✅ Да | ✅ Да | ✅ Да (CNAME) | ✅ Авто из Git | ⭐⭐⭐⭐⭐ Лучший выбор |
| **Vercel** | ✅ Да | ✅ Да | ✅ Да | ✅ Авто | ⭐⭐⭐⭐⭐ Отличный вариант |
| **Netlify** | ✅ Да | ✅ Да | ✅ Да | ✅ Авто | ⭐⭐⭐⭐⭐ Отлично |
| **Cloudflare Pages** | ✅ Да | ✅ Да | ✅ Да | ✅ Авто | ⭐⭐⭐⭐ Хороший выбор |
| **GitLab Pages** | ✅ Да | ✅ Да | ❌ Нет (только subdomain) | ✅ Авто | ⭐⭐⭐ Альтернатива |

---

## 🚀 Вариант 1: GitHub Pages (Рекомендуется)

### ✅ Преимущества:
- Бесплатно навсегда
- SSL сертификат автоматически
- Кастомный домен через CNAME
- Интеграция с Git репозиторием
- Нет ограничений на трафик для статических сайтов

### 📝 Пошаговая инструкция:

#### Шаг 1: Создание нового репозитория на GitHub

1. Зайдите на https://github.com
2. Нажмите **New repository** (или **+ New** → **Repository**)
3. Заполните поля:
   - **Repository name:** `oncology-us-analytics`
   - **Description:** `Oncology US Analytics Dashboard — Cancer statistics for USA 2024-2026`
   - **Initialize with README:** ✅ (или уже есть)
   - **Add .gitignore:** ✅ (выберите `.gitignore`)
4. Нажмите **Create repository**

#### Шаг 2: Клонирование репозитория на компьютер

```bash
# Откройте PowerShell в папке проекта
cd C:\Users\Dima\Documents\harness

# Если репозиторий ещё не создан локально — инициализируйте его
git init

# Добавьте удалённый репозиторий GitHub (замените YOUR_NICK на свой ник):
git remote add origin https://github.com/YOUR_NICK/oncology-us-analytics.git

# Проверьте настройку:
git remote -v

# Добавляем все файлы в Git:
git add .

# Создаём первый коммит с описанием изменений:
git commit -m "feat: Oncology US Analytics dashboard с модулем логирования ошибок" --amend

# Push на GitHub:
git push -u origin main
```

#### Шаг 3: Настройка GitHub Pages

1. Зайдите в репозиторий на GitHub: https://github.com/YOUR_NICK/oncology-us-analytics
2. Перейдите в **Settings** → **Pages** (в левом меню)
3. В разделе **Build and deployment**:
   - **Source:** Выберите **Deploy from a branch**
   - **Branch:** `main` или `master` (зависит от вашей ветки)
   - **Folder:** `/ (root)`
   - Нажмите **Save**

4. Подождите 1-2 минуты, затем проверьте статус: **Your site is published at...**

#### Шаг 4: Получение URL приложения

После публикации вы получите ссылку вида:

```
https://YOUR_NICK.github.io/oncology-us-analytics/
```

Пример: `https://dimahub.github.io/oncology-us-analytics/`

#### Шаг 5: Настройка кастомного домена (опционально)

Если у вас есть собственный домен (например, `yourname.com`):

1. Зарегистрируйте домен и получите DNS-записи
2. В GitHub Pages Settings → Pages добавьте **Custom domain**
3. Добавьте CNAME запись в DNS вашего хостинга:
   - Type: `CNAME`
   - Name: `@` (или пустое поле)
   - Value: `yourname.github.io`

#### Шаг 6: Проверка работоспособности

Откройте URL и проверьте:
- ✅ Статический сервер загружается корректно
- ✅ Chart.js подтягивается из CDN
- ✅ Карты США отображаются (tile-grid или SVG)
- ✅ Данные ClinicalTrials.gov загружаются

---

## 🚀 Вариант 2: Vercel (Рекомендуется)

### ✅ Преимущества:
- Бесплатно навсегда
- Автоматический билд и деплой из Git
- Глобальная сеть edge locations (быстрый CDN)
- Предпросмотр PR перед merge

### 📝 Пошаговая инструкция:

#### Шаг 1: Регистрация на Vercel

1. Зайдите на https://vercel.com/signup
2. Войдите через **GitHub** (или другой provider)
3. Создайте новый проект или выберите существующий репозиторий

#### Шаг 2: Деплой из GitHub

1. Нажмите **Add New... → Project**
2. Введите название проекта: `oncology-us-analytics`
3. Выберите ваш GitHub аккаунт
4. Нажмите **Connect to Git**
5. Выберите репозиторий: `oncology-us-analytics`
6. Нажмите **Import**

#### Шаг 3: Настройка сборки (Build Settings)

В разделе **Build & Deployment**:

| Параметр | Значение | Описание |
|----------|----------|----------|
| **Root Directory** | `/` | Корневая директория |
| **Build Command** | `npm install` (или пустой) | Если нужен npm |
| **Output Directory** | `/` | Где лежат файлы после сборки |

Поскольку это чистый JS без бэкенда, можно оставить настройки по умолчанию.

#### Шаг 4: Деплой

1. Нажмите **Deploy**
2. Vercel автоматически построит проект и опубликует его
3. Через 1-2 минуты в панели появится ссылка на сайт

#### Шаг 5: Получение URL приложения

Вы получите ссылку вида:

```
https://oncology-us-analytics.vercel.app/
```

Пример: `https://oncology-us-analytics-dimahub.vercel.app/`

#### Шаг 6: Настройка кастомного домена

1. В проекте нажмите **Settings** → **Domains**
2. Добавьте ваш домен (например, `dashboard.yourname.com`)
3. Vercel автоматически запросит SSL сертификат
4. Добавьте соответствующие DNS записи у вашего хостинга

#### Шаг 7: Проверка работоспособности

Откройте URL и проверьте все компоненты приложения.

---

## 🚀 Вариант 3: Netlify (Рекомендуется)

### ✅ Преимущества:
- Бесплатно навсегда
- Автоматический деплой из Git
- Глобальная сеть CDN
- Предпросмотр PR (Pull Requests)
- Формы и другие функции

### 📝 Пошаговая инструкция:

#### Шаг 1: Регистрация на Netlify

1. Зайдите на https://www.netlify.com/signup
2. Войдите через **GitHub** (или другой provider)
3. Создайте новый сайт или выберите существующий репозиторий

#### Шаг 2: Деплой из GitHub

1. Нажмите **Add new site → Import an existing project**
2. Выберите **Connect to Git** → **GitHub**
3. Авторизуйтесь в GitHub и выберите аккаунт
4. Выберите репозиторий: `oncology-us-analytics`
5. Нажмите **Deploy site**

#### Шаг 3: Настройка сборки (Build Settings)

Поскольку это чистый JS без `package.json`, Netlify автоматически определил проект как "Static Site".

Настройки по умолчанию работают корректно:

| Параметр | Значение |
|----------|----------|
| **Base directory** | `/` |
| **Build command** | (пустой) |
| **Publish directory** | `/` |

#### Шаг 4: Деплой

1. Netlify автоматически построит проект и опубликует его
2. Через 1-2 минуты в панели появится ссылка на сайт

#### Шаг 5: Получение URL приложения

Вы получите ссылку вида:

```
https://oncology-us-analytics.netlify.app/
```

Пример: `https://oncology-us-analytics-dimahub.netlify.app/`

#### Шаг 6: Настройка кастомного домена

1. В проекте нажмите **Domain Settings** → **Add custom domain**
2. Введите ваш домен (например, `app.yourname.com`)
3. Netlify автоматически запросит SSL сертификат
4. Добавьте соответствующие DNS записи у вашего хостинга:
   - Type: `A`
   - Name: `@`
   - Value: IP адрес Netlify (из панели)

#### Шаг 7: Проверка работоспособности

Откройте URL и проверьте все компоненты приложения.

---

## 🚀 Вариант 4: Cloudflare Pages

### ✅ Преимущества:
- Бесплатно навсегда
- Глобальная сеть Edge (очень быстрый CDN)
- Автоматический деплой из Git
- SSL бесплатно через Cloudflare

### 📝 Пошаговая инструкция:

#### Шаг 1: Регистрация на Cloudflare Pages

1. Зайдите на https://pages.cloudflare.com
2. Введите URL репозитория (например, `https://github.com/YOUR_NICK/oncology-us-analytics`)
3. Нажмите **Start project**

#### Шаг 2: Настройка подключения к Git

1. Выберите **Connect to Git**
2. Авторизуйтесь через GitHub
3. Выберите репозиторий: `oncology-us-analytics`
4. Укажите ветку: `main`
5. Нажмите **Create project**

#### Шаг 3: Деплой

Cloudflare автоматически построит и опубликует проект. Через 1-2 минуты появится ссылка.

#### Шаг 4: Получение URL приложения

Вы получите ссылку вида:

```
https://YOUR_NICK--oncology-us-analytics.pages.dev/
```

Пример: `https://dimahub--oncology-us-analytics.pages.dev/`

---

## 📦 Вариант 5: GitLab Pages (Альтернатива)

### ✅ Преимущества:
- Бесплатно для GitLab репозиториев
- Автоматический деплой из Git

### 📝 Пошаговая инструкция:

1. Создайте аккаунт на https://gitlab.com
2. Создайте новый репозиторий
3. В настройках проекта включите Pages: **Settings → Pages → New page**
4. Укажите ветку: `main`, путь: `/`
5. После обработки получите ссылку вида:

```
https://YOUR_NICK.gitlab.io/oncology-us-analytics/
```

---

## 🔍 Сравнение платформ

| Критерий | GitHub Pages | Vercel | Netlify | Cloudflare Pages |
|----------|--------------|--------|---------|------------------|
| **Бесплатный трафик** | 100 GB/мес | Unlimited | Unlimited | Unlimited |
| **Bandwidth** | 100 GB/мес | ~100 GB/мес | 100 GB/мес | Unlimited |
| **SSL сертификат** | ✅ Да | ✅ Да | ✅ Да | ✅ Да |
| **Custom domain** | ✅ Да (CNAME) | ✅ Да | ✅ Да | ✅ Да |
| **CI/CD автодеплой** | ✅ Да (GitHub Actions) | ✅ Да | ✅ Да | ✅ Да |
| **Предпросмотр PR** | ❌ Нет | ✅ Да | ✅ Да | ✅ Да |
| **Global CDN** | ✅ Да | ✅ Да | ✅ Да | ✅ Да (Edge network) |
| **Поддержка SPA** | ✅ Да | ✅ Да | ✅ Да | ✅ Да |
| **Easy setup** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 🏆 Рекомендация по выбору

### Лучший выбор для большинства случаев: **GitHub Pages**

**Почему:**
- ✅ Репозиторий уже на GitHub — самый простой способ
- ✅ Бесплатно навсегда
- ✅ Автоматический SSL сертификат
- ✅ Интеграция с Issue, Pull Requests
- ✅ Нет ограничений на трафик для статических сайтов

### Альтернатива: **Vercel** или **Netlify**

**Выбирайте, если:**
- Хотите более быструю загрузку (глобальная CDN сеть)
- Нужен предпросмотр PR перед merge
- Планируете масштабировать проект

---

## ✅ Проверка работоспособности на хостинге

После деплоя откройте URL и проверьте:

1. ✅ **Главная страница загружается** — нет ошибок в консоль
2. ✅ **Chart.js загружается** из CDN (`https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.js`)
3. ✅ **Карты США отображаются** (tile-grid или SVG)
4. ✅ **Данные ClinicalTrials.gov загружаются**
5. ✅ **Фильтры работают корректно** (год, штат, тип рака, стадия)
6. ✅ **KPI карточки отображают данные**
7. ✅ **Экспорт CSV работает**

---

## 🔧 Решение распространённых проблем

### Проблема 1: CORS ошибки при загрузке данных

**Причина:** Некоторые CDN блокируют CORS для внешних запросов.

**Решение:** Проверьте `data-source.js` — убедитесь что ClinicalTrials.gov API поддерживает CORS (обычно поддерживает).

```javascript
// В data-source.js — должен быть настроен CORS:
fetchJson(url, ...) // использует стандартный fetch с CORS
```

### Проблема 2: Карта не загружается

**Причина:** d3/topojson не подтянулись или blocked by AdBlocker.

**Решение:** Приложение автоматически переключится на tile-grid карту — это ожидается!

### Проблема 3: Chart.js не загрузился

**Причина:** CDN недоступен или заблокирован.

**Решение:** Проверьте интернет-соединение, обновите страницу. В консоли будет показана ошибка `[CHARTS ERROR]`.

---

## 📝 Чек-лист перед публикацией

### ✅ Проверить файлы:

- [ ] `index.html` — подключён `error-handler.js`
- [ ] `style.css` — все стили включены
- [ ] `app.js`, `data-source.js`, `map.js`, `config.js` — актуальные версии
- [ ] Нет тестовых файлов в production (`test-log.js`, `test-stats.js` исключены через `.gitignore`)

### ✅ Проверить конфигурацию:

- [ ] `config.js` — API URL (если нужен) или `auto`/`synthetic` для демо
- [ ] `index.html` — корректный path к стилям и скриптам

### ✅ Проверить Git:

- [ ] Чистое рабочее дерево (`git status` чистый)
- [ ] Все изменения коммичены
- [ ] Тег версии создан (например, v1.0.0)

---

## 🚀 Быстрый деплой на GitHub Pages (командами PowerShell)

```powershell
# 1. Перейдите в папку проекта
cd C:\Users\Dima\Documents\harness

# 2. Проверьте статус Git
git status

# 3. Добавьте файлы (если ещё не добавлены)
git add .

# 4. Коммит с описанием
git commit -m "feat: Oncology US Analytics dashboard published to GitHub Pages" --amend

# 5. Push на GitHub
git push -u origin main

# 6. Откройте GitHub и настройте GitHub Pages в Settings → Pages
```

---

## 📞 Заключение

### Рекомендуемый порядок действий:

1. **Выберите платформу:** GitHub Pages (или Vercel/Netlify)
2. **Подготовьте проект:** проверьте `.gitignore`, коммиты, теги
3. **Деплой на платформу:** следуйте инструкции выше
4. **Проверьте работу:** откройте URL и убедитесь что все работает
5. **Добавьте кастомный домен** (если есть)

### Финальная ссылка:

После деплоя вы получите ссылку вида:

```
GitHub Pages:    https://YOUR_NICK.github.io/oncology-us-analytics/
Vercel:          https://oncology-us-analytics.vercel.app/
Netlify:         https://oncology-us-analytics.netlify.app/
Cloudflare:      https://YOUR_NICK--oncology-us-analytics.pages.dev/
```

---

**Версия инструкции:** 1.0  
**Дата:** 2026-10-01  
**Статус:** Готово к использованию!

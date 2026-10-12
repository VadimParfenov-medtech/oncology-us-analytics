# Changelog for Oncology US Analytics

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] - 2026-10-01

### Добавлено
- Модуль логирования ошибок в консоль разработчика (`error-handler.js`)
- Вывод всех ошибок с timestamp и категорией (ONCO-ERROR/WARN/INFO)
- UI контейнер для отображения ошибок в браузере
- Фоллбэк логики для Node.js среды

### Изменения
- Обновлен `README.md` с информацией о логировании
- Добавлены тесты для проверки работы модуля логирования

### Улучшения производительности
- Асинхронная загрузка библиотек (Chart.js, d3, topojson)
- Единопассовая агрегация данных (`stats.js`)
- Ленивый рендер графиков

---

## [0.9.0] - 2025-XX-XX

### Добавлено
- Тепловая карта США (d3 + tile-grid fallback)
- 6 интерактивных графиков на Chart.js
- Фильтры: год, штат, тип рака, стадия
- KPI карточки с дельтами

### Источники данных
- Synthetic (демо-данные, офлайн)
- ClinicalTrials.gov API
- Custom REST API

---

## [0.8.0] - 2025-XX-XX

### Добавлено
- Экспорт данных в CSV
- Сортируемая таблица детализации
- Картинка favicon

### UI/UX
- Адаптивный дизайн
- Toast уведомления при загрузке источников
- Accessibility: ARIA labels, keyboard navigation

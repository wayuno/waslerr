// Lightweight i18n store — no provider needed.
// Components read the live language with `useT()` (re-renders on change) and
// translate short UI strings with `t('nav.fields')`. Any key that has no
// translation falls back to English, then to the key itself, so nothing ever
// breaks while the dictionary is filled in incrementally.

import { useSyncExternalStore } from 'react'

const KEY = 'wf_lang'

export const LANGS = [
  { code: 'en', short: 'EN', label: 'English', native: 'English', dir: 'ltr' },
  { code: 'ru', short: 'RU', label: 'Russian', native: 'Русский', dir: 'ltr' },
  { code: 'zh', short: 'ZH', label: 'Chinese', native: '中文', dir: 'ltr' },
]

// Short, high-traffic UI strings (navigation + menu chrome). The body of the
// site stays in English until copy is added here key-by-key.
const DICT = {
  'nav.fields':     { en: 'Fields',           ru: 'Поля',                  zh: '场域' },
  'nav.updates':    { en: "What's new",       ru: 'Новинки',               zh: '最新' },
  'nav.reviews':    { en: 'Reviews',          ru: 'Отзывы',                zh: '评价' },
  'nav.custom':     { en: 'Custom',           ru: 'На заказ',              zh: '定制' },
  'nav.community':  { en: 'Community',         ru: 'Сообщество',            zh: '社区' },
  'nav.signin':     { en: 'Sign in',          ru: 'Войти',                 zh: '登录' },
  'nav.signout':    { en: 'Sign out',         ru: 'Выйти',                 zh: '退出' },
  'nav.admin':      { en: 'Admin',            ru: 'Админ',                 zh: '管理' },
  'nav.adminPanel': { en: 'Admin panel',      ru: 'Панель администратора', zh: '管理面板' },
  'nav.profile':    { en: 'Profile',          ru: 'Профиль',               zh: '个人资料' },
  'nav.begin':      { en: 'Begin',            ru: 'Начать',                zh: '开始' },
  'nav.chat':       { en: 'Chat with support', ru: 'Чат с поддержкой',     zh: '联系客服' },
  'menu.browse':    { en: 'Browse',           ru: 'Обзор',                 zh: '浏览' },
  'menu.account':   { en: 'Account',          ru: 'Аккаунт',               zh: '我的账户' },
  'menu.support':   { en: 'Support',          ru: 'Поддержка',             zh: '支持' },
  'menu.language':  { en: 'Language',         ru: 'Язык',                  zh: '语言' },
}

let current = 'en'
try {
  const saved = localStorage.getItem(KEY)
  if (saved && LANGS.some((l) => l.code === saved)) current = saved
} catch {
  /* storage blocked — default to English */
}

const applyDocLang = (code) => {
  if (typeof document === 'undefined') return
  const lang = LANGS.find((l) => l.code === code)
  document.documentElement.lang = code
  document.documentElement.dir = lang?.dir || 'ltr'
}
applyDocLang(current)

const subs = new Set()
const emit = () => subs.forEach((fn) => fn())

export function setLang(code) {
  if (!LANGS.some((l) => l.code === code) || code === current) return
  current = code
  try {
    localStorage.setItem(KEY, code)
  } catch {
    /* ignore */
  }
  applyDocLang(code)
  emit()
}

export function getLang() {
  return current
}

const subscribe = (cb) => {
  subs.add(cb)
  return () => subs.delete(cb)
}

export function useLang() {
  return useSyncExternalStore(subscribe, getLang, getLang)
}

export function t(key) {
  const entry = DICT[key]
  if (!entry) return key
  return entry[current] ?? entry.en ?? key
}

// Hook variant: subscribes the calling component so it re-renders on language
// change, then returns the translator.
export function useT() {
  useLang()
  return t
}

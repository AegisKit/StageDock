"use client";

import { useMemo } from "react";
import { useSetting } from "./use-settings";

type Language = "ja" | "en";

// 翻訳データの型定義
interface Translations {
  navigation: {
    dashboard: string;
    creators: string;
    multiview: string;
    settings: string;
    favorites: string;
    controlCenter: string;
  };
  dashboard: {
    title: string;
    description: string;
    welcome: string;
    getStarted: string;
    features: {
      title: string;
      creators: {
        title: string;
        description: string;
      };
      multiview: {
        title: string;
        description: string;
      };
      notifications: {
        title: string;
        description: string;
      };
    };
    quickStart: {
      title: string;
      step1: string;
      step2: string;
      step3: string;
    };
    registeredCreators: string;
    liveNow: string;
    currentlyOnline: string;
    quickActions: string;
    quickActionsDescription: string;
    manageCreators: string;
    buildMultiview: string;
    configureSettings: string;
  };
  creators: {
    title: string;
    description: string;
    platform: string;
    channelId: string;
    displayName: string;
    tags: string;
    notifications: string;
    addCreator: string;
    adding: string;
    registeredCreators: string;
    filterByTag: string;
    selectTags: string;
    tagSelected: string;
    clear: string;
    openSelected: string;
    noCreators: string;
    noCreatorsMatch: string;
    select: string;
    notification: string;
    status: string;
    actions: string;
    live: string;
    offline: string;
    refresh: string;
    edit: string;
    delete: string;
    confirmDelete: string;
    editCreator: string;
    saveChanges: string;
    saving: string;
    cancel: string;
    channelIdPlaceholder: {
      twitch: string;
      youtube: string;
    };
    displayNamePlaceholder: string;
    tagsPlaceholder: string;
    tagsDescription: string;
    filteredBy: string;
    creatorsCount: string;
  };
  multiview: {
    title: string;
    description: string;
    noStreams: string;
    loading: string;
    error: string;
  };
  settings: {
    title: string;
    description: string;
    quietHours: string;
    quietHoursDescription: string;
    from: string;
    to: string;
    autoUpdates: string;
    autoUpdatesDescription: string;
    autoUpdate: string;
    language: string;
    languageDescription: string;
    japanese: string;
    english: string;
  };
  favorites: {
    title: string;
    description: string;
    noFavorites: string;
    addFavorite: string;
    name: string;
    urls: string;
    save: string;
    saving: string;
    cancel: string;
    edit: string;
    delete: string;
    confirmDelete: string;
  };
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    add: string;
    close: string;
    open: string;
    refresh: string;
    back: string;
    next: string;
    previous: string;
    confirm: string;
    yes: string;
    no: string;
  };
}

// 翻訳データのインポート
import jaTranslations from "../locales/ja";
import enTranslations from "../locales/en";

const translations: Record<Language, Translations> = {
  ja: jaTranslations as unknown as Translations,
  en: enTranslations as unknown as Translations,
};

export function useI18n() {
  const { data: language = "ja" } = useSetting<Language>("ui.language", "ja");

  const t = useMemo(() => {
    const currentTranslations = translations[language] || translations.ja;

    // 翻訳関数を作成
    const translate = (
      key: string,
      params?: Record<string, string | number>
    ): string => {
      const keys = key.split(".");
      let value: any = currentTranslations;

      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) {
          console.warn(`Translation key not found: ${key}`);
          return key;
        }
      }

      if (typeof value !== "string") {
        console.warn(`Translation value is not a string: ${key}`, { value });
        return key;
      }

      // パラメータの置換
      if (params) {
        return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
          return String(params[paramKey] || match);
        });
      }

      return value;
    };

    return translate;
  }, [language]);

  return { t, language };
}

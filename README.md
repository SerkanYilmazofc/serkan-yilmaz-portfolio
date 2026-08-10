# Serkan Yılmaz — Kişisel Portföy

Stitch **Obsidian Noir** tasarımı üzerine kurulu kişisel portföy sitesi.

## Çalıştırma

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

- Kaynak kod: `main`
- Canlı statik build: `deploy`

`main` branch’e her push’ta GitHub Actions siteyi build edip `deploy` branch’ini günceller.

Hosting’de (cPanel Git Version Control) branch olarak **`deploy`** seçilmeli.

Canlı adres: https://kisisel.serkanylmz.com.tr/

## İçerik

Metinler `src/i18n/translations.ts` dosyasındadır (TR / EN).

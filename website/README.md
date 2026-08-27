# AMLL TTML Tool Companion Website

Official companion web application for **AMLL TTML Tool** and **Spicy Player**.

## ✨ Features
1. **Home Page**:
   - Showcase and interactive tour of AMLL TTML Tool.
   - High-resolution screenshot gallery using app images (`preview tab.png`, `sync tab.png`, `edit tab.png`, `ttml checklist.png`, `cloud.png`, `rpc page.png`, `theme settings.png`).
   - Direct download links to the latest desktop releases on GitHub.
2. **Finished TTMLs Page**:
   - Live browser connecting to Firebase Firestore (`amll-ttml`) for public/finished TTML documents.
   - Display song cover art, title, artist, album, duration, line counts, and tag status.
   - 1-click **Download TTML** button for instant `.ttml` file downloads.
3. **Dedicated Spicy Player Page**:
   - Dedicated showcase for [Spicy Player](https://github.com/bobjoerules/Spicy-Player).
   - Interactive fullscreen image lightbox for images in `images/spicy-player/` (`home-page.jpg`, `library-page.jpg`, `now-playing-fullscreen.jpg`, `now-playing-page.jpg`).
   - Feature highlights and direct GitHub repository links.

## 🚀 Running Locally

```bash
# From the repository root
npm run website:dev

# Or inside the website directory
cd website
npm run dev
```

Visit `http://localhost:3000` to view the website.

## 📦 Production Build

```bash
# From root
npm run website:build

# Preview production build
npm run website:preview
```

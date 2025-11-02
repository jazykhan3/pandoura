# Pandaura – Live Runtime Automation Suite

Milestone 1 delivers the complete front‑end UI shell: persistent layout, pages, theming, motion, and responsiveness. Live runtime features are placeholders.

## Tech
- React + TypeScript + Vite
- Tailwind CSS (custom Pandaura theme)
- Framer Motion (transitions)
- Zustand (UI state)
- Radix UI primitives (light usage) + Lucide icons

## Structure
```
src/
  components/
    Layout.tsx           # Sidebar, Topbar, Workspace, StatusBar
  pages/                 # 6 main pages with placeholders
    Dashboard.tsx
    ShadowRuntime.tsx
    TagDatabase.tsx
    LogicEditor.tsx
    Deploy.tsx
    SettingsPage.tsx
    index.ts
  store/
    uiStore.ts           # remembers last active page
  index.css              # Tailwind and design tokens
  main.tsx               # app bootstrap
  App.tsx                # routes rendered inside Layout
```

## Run
```
npm install
npm run dev
```

## Design
- Primary accent: #FF6A00 (sidebar, active buttons)
- Background: #FFFFFF; Surface: #F9FAFB; Text: #1A1A1A; Borders: #E5E7EB
- Page switch animations: 250ms fade/slide via Framer Motion
- Responsive down to 1366×768; sidebar is fixed (collapsible in later milestone)

## Notes
- All page content is placeholder-only; hooks & data will connect in Milestone 2.

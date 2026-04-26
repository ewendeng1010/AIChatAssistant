# React + TypeScript + Vite

Diese Vorlage bietet eine minimale Einrichtung, um React in Vite mit HMR und einigen ESLint-Regeln zum Laufen zu bringen.

Derzeit sind zwei offizielle Plugins verfügbar:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) verwendet [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) verwendet [SWC](https://swc.rs/)

## React Compiler

Der React Compiler ist in dieser Vorlage nicht aktiviert, aufgrund seiner Auswirkungen auf die Entwicklungs- und Build-Performance. Um ihn hinzuzufügen, siehe [diese Dokumentation](https://react.dev/learn/react-compiler/installation).

## Erweitern der ESLint-Konfiguration

Wenn du eine Produktionsanwendung entwickelst, empfehlen wir, die Konfiguration zu aktualisieren, um typbasierte Lint-Regeln zu aktivieren:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Andere Konfigurationen...

      // Entferne tseslint.configs.recommended und ersetze durch Folgendes
      tseslint.configs.recommendedTypeChecked,
      // Alternativ verwende dies für strengere Regeln
      tseslint.configs.strictTypeChecked,
      // Optional füge dies für stilistische Regeln hinzu
      tseslint.configs.stylisticTypeChecked,

      // Andere Konfigurationen...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // andere Optionen...
    },
  },
])
```

Du kannst auch [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) und [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) installieren, um React-spezifische Lint-Regeln zu erhalten:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Andere Konfigurationen...
      // Aktiviere Lint-Regeln für React
      reactX.configs['recommended-typescript'],
      // Aktiviere Lint-Regeln für React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // andere Optionen...
    },
  },
])
```
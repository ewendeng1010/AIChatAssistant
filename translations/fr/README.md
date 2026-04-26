# React + TypeScript + Vite

Ce modèle fournit une configuration minimale pour faire fonctionner React dans Vite avec le HMR et quelques règles ESLint.

Actuellement, deux plugins officiels sont disponibles :

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) utilise [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) utilise [SWC](https://swc.rs/)

## React Compiler

Le React Compiler n'est pas activé dans ce modèle en raison de son impact sur les performances de développement et de construction. Pour l'ajouter, consultez [cette documentation](https://react.dev/learn/react-compiler/installation).

## Extension de la configuration ESLint

Si vous développez une application de production, nous vous recommandons de mettre à jour la configuration pour activer les règles de linting sensibles aux types :

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Autres configurations...

      // Supprimez tseslint.configs.recommended et remplacez par ceci
      tseslint.configs.recommendedTypeChecked,
      // Alternativement, utilisez ceci pour des règles plus strictes
      tseslint.configs.strictTypeChecked,
      // Optionnellement, ajoutez ceci pour des règles stylistiques
      tseslint.configs.stylisticTypeChecked,

      // Autres configurations...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // autres options...
    },
  },
])
```

Vous pouvez également installer [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) et [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) pour des règles de linting spécifiques à React :

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Autres configurations...
      // Activez les règles de linting pour React
      reactX.configs['recommended-typescript'],
      // Activez les règles de linting pour React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // autres options...
    },
  },
])
```
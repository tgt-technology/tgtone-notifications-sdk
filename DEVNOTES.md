# Dev Notes — @tgtone/notifications-sdk

## Módulo: CJS vs ESM (v1.0.1)

### Problema

En `v1.0.0` el `tsconfig.json` tenía `"module": "ESNext"`, lo que compilaba a ESM:

```js
// dist/index.js (v1.0.0)
export { NotificationsAPI } from './notifications';
```

```js
// dist/notifications.js (v1.0.0)
import { NotificationsClient } from './client';
```

Esto causaba `ERR_MODULE_NOT_FOUND` al ser usado desde apps que compilan a CJS y hacen `require()`:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/node_modules/@tgtone/notifications-sdk/dist/notifications'
imported from /app/node_modules/@tgtone/notifications-sdk/dist/index.js
```

**Causa raíz**: Node.js v22 detecta el `export` como ESM, pero en ESM los bare specifiers (`'./notifications'` sin `.js`) no resuelven automáticamente.

### Solución

```json
// tsconfig.json (v1.0.1)
"module": "commonjs"
```

Ahora compila a CJS:

```js
// dist/index.js (v1.0.1)
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsAPI = require('./notifications').NotificationsAPI;
```

### ¿Por qué CJS y no ESM con `.js`?

- El ecosistema Node.js v22 LTS tiene mejor soporte para CJS
- Todas las apps del ecosistema TGT compilan a CJS
- ESM requeriría agregar `.js` a todos los imports y declarar `"type": "module"`
- CJS es más compatible con Jest, ts-node, y el resto del stack

### Revertir a ESM (si se necesita en el futuro)

1. Cambiar `tsconfig.json`: `"module": "ESNext"` 
2. Agregar `"type": "module"` a `package.json`
3. Agregar `.js` a todos los imports en `src/`:
   - `from './notifications'` → `from './notifications.js'`
4. Verificar que los consumers puedan importarlo (ESM o CJS via `import()` dinámico)

## Consumo local (sin npm publish)

El tarball generado con `npm pack` debe copiarse a la **raíz del proyecto consumidor**, no dentro de `backend/`:

```
tgtone-vina-app/
├── tgtone-notifications-sdk-1.0.1.tgz   ← aquí
├── backend/
│   ├── package.json                      ← "file:../...tgz"
│   └── Dockerfile                        ← COPY desde raíz
```

Razones:
- Docker build context es la raíz del proyecto (`.`), no `backend/`
- `.dockerignore` en raíz no debe tener `*.tgz` (bloquea el tarball)
- `COPY tarball ./` en Dockerfile resuelve desde el context root
- `"file:../..."` en `package.json` de `backend/` apunta a la raíz
- `npm install` desde `backend/` resuelve `../` correctamente

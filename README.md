# Memoira

Memoira is a Vite + React journaling app.

## Run locally

```bash
npm install
npm run dev
```

## Firebase setup

1. Create a Firebase project in the Firebase console.
2. Enable `Authentication` and turn on the `Email/Password` sign-in provider.
3. Create a `Cloud Firestore` database.
4. Add a new Web app and copy its config values.
5. Copy `.env.example` to `.env`.
6. Fill in the `VITE_FIREBASE_*` values in `.env`.
7. Start the app with `npm run dev`.

Firebase is initialized in `src/firebase.js` and exports:
- `auth` for Firebase Authentication
- `db` for Cloud Firestore

Use them anywhere in the app:

```js
import { auth, db } from './firebase';
```

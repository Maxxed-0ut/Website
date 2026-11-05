# Guild

Guild is a student-builder dashboard with Firebase Authentication and Cloud Firestore persistence. It is a Vite app configured for Vercel deployment.

## Run locally

1. Install Node.js 20.19+.
2. Copy `.env.example` to `.env.local` and fill in the Firebase web app settings.
3. Install dependencies and start Vite:

   ```sh
   npm install
   npm run dev
   ```

Without Firebase settings, the dashboard still loads as a preview, but authentication and saving progress are unavailable.

## Firebase setup

1. Create a Firebase project and register a web app.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. Create a Cloud Firestore database.
4. Publish the rules in `firestore.rules` using the Firebase console or Firebase CLI.
5. Add the web app settings to `.env.local` for local work. Required values are `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`.

The app stores user profiles in `users/{uid}`, daily quest state in `users/{uid}/quests`, and saved opportunities in `users/{uid}/savedOpportunities`. The included rules restrict each user's records to that authenticated user.

## Deploy to Vercel

Import this folder as a Vercel project. Vercel detects the Vite configuration in `vercel.json`; the build command is `npm run build` and the output directory is `dist`.

Add the same required `VITE_FIREBASE_*` settings under **Project Settings → Environment Variables** in Vercel, then deploy. If deploying a preview environment, add the variables to that environment as well.

## Included dashboard features

- Responsive student-builder dashboard and skill-tree interaction.
- Filterable sample opportunities.
- Firebase email/password account creation and sign-in.
- Firestore-backed user profile, daily quest completion, and saved opportunities.
- User-scoped Firestore security rules.

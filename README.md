# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## QR attendance system setup

The app uses Supabase Authentication and the `profiles`, `events`, and `attendance` tables. In the Supabase SQL Editor, run `supabase/schema.sql` for a new project, followed by `supabase/improve-qr-att.sql` to install the role permissions, event status, account activation, administrator operations, and realtime attendance configuration. For an existing database, back it up and run the improvement migration; do not rerun the fresh-install schema over production data.

After registering the account that will be the first administrator, promote it once from the Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@school.edu';
```

Replace the example address with the registered account. Never put a Supabase service-role key in the mobile app. The teacher attendance monitor subscribes to Realtime changes on the `attendance` table; enable that table in the Supabase Realtime publication if your project does not allow the migration to add it.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

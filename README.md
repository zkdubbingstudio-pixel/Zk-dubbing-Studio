# ZK Voice Hub

Premium Anime Streaming Application presented by ZK Dubbing Studio.

## Technology Stack
- React + Vite
- Tailwind CSS
- Firebase (Auth, Firestore, Storage)
- Capacitor (for Android APK generation)

## Setup Instructions

1. **Install Dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Firebase Setup:**
   - The app uses Firebase Auth and Firestore.
   - Run the development server to test locally.

3. **Run Development Server:**
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Build Web & Deploy to Cloudflare Pages:**
   - Run \`npm run build\` to generate the \`dist\` folder.
   - Deploy the \`dist\` folder to Cloudflare Pages using Wrangler or via GitHub integration.

## Generating Android APK (Capacitor)

1. **Add Capacitor CLI & Android Platform:**
   \`\`\`bash
   npm install @capacitor/core @capacitor/android
   npm install -D @capacitor/cli
   \`\`\`

2. **Initialize Android Project:**
   \`\`\`bash
   npx cap add android
   \`\`\`

3. **Build the Web App & Sync:**
   \`\`\`bash
   npm run build
   npx cap sync android
   \`\`\`

4. **Open in Android Studio to Build APK:**
   \`\`\`bash
   npx cap open android
   \`\`\`
   - In Android Studio, go to \`Build\` > \`Build Bundle(s) / APK(s)\` > \`Build APK(s)\`.
   - Your APK will be located in \`android/app/build/outputs/apk/debug/\`.

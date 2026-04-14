import type { Metadata } from 'next';
import { DM_Sans, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import './globals.css';

const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-heading',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DIU Lens',
  description:
    'AI-powered student face registration and identification system.',
};

const themeScript = `
(() => {
  const storageKey = 'theme-preference';
  const root = document.documentElement;
  const savedTheme = localStorage.getItem(storageKey);
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolvedTheme = savedTheme === 'dark' || savedTheme === 'light'
    ? savedTheme
    : (systemDark ? 'dark' : 'light');

  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${spaceGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

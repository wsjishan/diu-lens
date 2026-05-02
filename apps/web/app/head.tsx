const themeScript = `
(() => {
  const storageKey = 'theme-preference';
  const root = document.documentElement;
  const savedTheme = localStorage.getItem(storageKey);
  const mobileViewport = window.matchMedia('(max-width: 639px)').matches;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolvedTheme = savedTheme === 'dark' || savedTheme === 'light'
    ? savedTheme
    : (mobileViewport || systemDark ? 'dark' : 'light');

  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;
})();
`;

export default function Head() {
  return (
    <script
      id="theme-init"
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}

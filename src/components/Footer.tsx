export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-8 mt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center text-slate-500 dark:text-slate-400 text-sm">
          <p>© {new Date().getFullYear()} 我的博客. Powered by Next.js & Markdown.</p>
        </div>
      </div>
    </footer>
  );
}

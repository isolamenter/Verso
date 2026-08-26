import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
import { getLocaleFromRequest, I18nProvider, type Locale } from "./i18n";
import "../src/index.css";

export async function loader({ request }: { request: Request }) {
  const locale = getLocaleFromRequest(request);
  return { locale };
}

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..700&family=Noto+Serif+SC:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
  },
];

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Verso — Literary Creation & Critique Workbench" },
    { name: "description", content: "Verso Agent-first Literary Workspace" },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData() as { locale?: Locale } | undefined;
  const locale = data?.locale ?? "zh-CN";

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-paper text-ink antialiased">
        <I18nProvider initialLocale={locale}>
          {children}
        </I18nProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1 className="text-2xl font-bold">{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

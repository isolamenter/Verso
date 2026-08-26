import { createLocaleCookieHeader, type Locale, SUPPORTED_LOCALES } from "../i18n";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const formData = await request.formData();
  const rawLocale = formData.get("locale") as Locale;

  if (!rawLocale || !SUPPORTED_LOCALES.includes(rawLocale)) {
    return Response.json({ error: "Invalid locale" }, { status: 400 });
  }

  return Response.json(
    { success: true, locale: rawLocale },
    {
      status: 200,
      headers: {
        "Set-Cookie": createLocaleCookieHeader(rawLocale),
      },
    }
  );
}


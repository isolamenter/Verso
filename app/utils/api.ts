export async function api<T = Record<string, unknown>>(
  url: string,
  values?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    url,
    values
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      : undefined,
  );
  const data = await response.json();
  if (!response.ok || data.error)
    throw new Error(data.error || `请求失败（${response.status}）`);
  return data as T;
}

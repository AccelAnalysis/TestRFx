const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string) {
  if (!configuredBasePath || !path.startsWith("/")) return path;
  if (path === configuredBasePath || path.startsWith(`${configuredBasePath}/`)) return path;
  return `${configuredBasePath}${path}`;
}

export function withoutBasePath(pathname: string) {
  if (!configuredBasePath) return pathname;
  if (pathname === configuredBasePath) return "/";
  if (pathname.startsWith(`${configuredBasePath}/`)) {
    return pathname.slice(configuredBasePath.length) || "/";
  }
  return pathname;
}

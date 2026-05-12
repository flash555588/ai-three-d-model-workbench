export function toPythonPathLiteral(path: string): string {
  if (path.includes('"')) {
    throw new Error(`File path contains double-quote character, not supported for Python conversion: ${path}`);
  }

  // Python accepts forward slashes on all supported desktop platforms.
  return path.replace(/\\/g, "/");
}
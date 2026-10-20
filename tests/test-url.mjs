/** Cache-bust entry pages when validating a freshly published Pages deployment. */
export function testUrl(path, base) {
  const url = new URL(path, base);
  if (process.env.DEPLOY_SHA)
    url.searchParams.set("build", process.env.DEPLOY_SHA);
  return url.href;
}

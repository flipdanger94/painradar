// Return only known diagnostics: provider bodies may contain sensitive information.
export function sourceError(source: string, message: string) {
  if (
    [
      "Source retry later",
      "Source backoff requested",
      "Source daily quota reached",
    ].includes(message)
  )
    return "The source requested a pause. Collection will resume after its retry time.";
  if (message === "Configure source scopes before collecting")
    return "Configure projects, tags, forums or feed URLs before collecting.";
  if (message === "Invalid source configuration")
    return "Check the source settings and scope names.";
  if (message === "Only public projects are supported")
    return "Only public projects can be collected.";
  if (message === "Invalid feed response")
    return "The URL did not return a valid RSS or Atom feed.";
  if (
    ["Source response too large", "Source request timed out"].includes(message)
  )
    return "The source response was too large or timed out. Try a smaller scope.";
  if (source === "reddit") {
    if (message === "Authorized Reddit API credentials required")
      return "Reddit API keys are missing. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to the production environment, redeploy, then start collection.";
    if (message.startsWith("Reddit authorization failed"))
      return "Reddit authorization was rejected. Check the API keys and approved Reddit API access.";
    if (
      message === "Configure Reddit communities before collecting" ||
      message === "Invalid subreddit"
    )
      return "Check the Reddit community names. Enter names without r/ or a URL.";
    if (message === "Source returned 401" || message === "Source returned 403")
      return "Reddit denied access. Check API approval and whether the community is public.";
    if (message === "Source returned 404")
      return "Reddit community not found. Check its name and availability.";
    if (message === "Invalid Reddit token response")
      return "Reddit did not return a valid access token. Check the application credentials.";
  }
  if (message === "Source returned 429")
    return "The source rate limit was reached. Wait before starting collection again.";
  return "Source request failed. Check access and configuration.";
}

// Keep the launcher URL distinct from the root /more modal. Route groups do
// not contribute to URLs, so a second /more route can open this empty tab.
export default function MoreTabPlaceholder() {
  return null;
}

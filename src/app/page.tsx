import { notFound } from "next/navigation";

/**
 * The site root answers 404, like any unused path: the apps live on their own
 * paths (the NFL one under /magic-stats) and aren't linked from here.
 * Obscurity, not access control — anyone who knows a path still reaches it.
 */
export default function Root() {
  notFound();
}

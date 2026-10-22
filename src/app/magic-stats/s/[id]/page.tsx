import { permanentRedirect } from "next/navigation";

// Share links used to live here; they're outside Magic Stats now.
export default async function OldSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  permanentRedirect(`/share/${(await params).id}`);
}

import { DocEditor } from "./ui/DocEditor";

export default function AdminDocPage({ params }: { params: { slug: string } }) {
  return <DocEditor slug={params.slug} />;
}


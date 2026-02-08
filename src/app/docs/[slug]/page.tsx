import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLatestDoc, getPrevNextInCollection, listDocSlugs, listDocVersions } from "@/lib/content/docs.server";
import type { DocRecord } from "@/lib/docs";
import { DocDetail } from "../_components/doc-detail";

export function generateStaticParams() {
  return listDocSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const doc = getLatestDoc(params.slug);
  if (!doc) return { title: "Doc Not Found | Amber Protocol" };
  return {
    title: `${doc.title} | Amber Protocol`,
    description: doc.summary,
  };
}

export default function DocLatestPage({ params }: { params: { slug: string } }) {
  const doc = getLatestDoc(params.slug);
  if (!doc) notFound();

  const versions = listDocVersions(doc.slug);
  const related =
    (doc.relatedSlugs ?? [])
      .map((s) => getLatestDoc(s))
      .filter((d): d is DocRecord => !!d) ?? [];

  const { prev, next } = getPrevNextInCollection(doc);

  return (
    <DocDetail doc={doc} versions={versions} relatedDocs={related} prev={prev} next={next} isLatest />
  );
}


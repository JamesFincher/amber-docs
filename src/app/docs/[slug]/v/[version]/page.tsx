import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDocVersion, getLatestDoc, getPrevNextInCollection, listDocSlugs, listDocVersions } from "@/lib/content/docs.server";
import type { DocRecord } from "@/lib/docs";
import { DocDetail } from "@/app/docs/_components/doc-detail";

export function generateStaticParams() {
  return listDocSlugs().flatMap((slug) => listDocVersions(slug).map((d) => ({ slug: d.slug, version: d.version })));
}

export function generateMetadata({ params }: { params: { slug: string; version: string } }): Metadata {
  const doc = getDocVersion(params.slug, params.version);
  if (!doc) return { title: "Doc Not Found | Amber Docs" };
  return {
    title: `${doc.title} (v${doc.version}) | Amber Docs`,
    description: doc.summary,
  };
}

export default function DocVersionPage({ params }: { params: { slug: string; version: string } }) {
  const doc = getDocVersion(params.slug, params.version);
  if (!doc) notFound();

  const versions = listDocVersions(doc.slug);
  const related =
    (doc.relatedSlugs ?? [])
      .map((s) => getLatestDoc(s))
      .filter((d): d is DocRecord => !!d) ?? [];

  const { prev, next } = getPrevNextInCollection(doc);
  const latest = versions[0];
  const isLatest = !!latest && latest.version === doc.version;

  return (
    <DocDetail doc={doc} versions={versions} relatedDocs={related} prev={prev} next={next} isLatest={isLatest} />
  );
}

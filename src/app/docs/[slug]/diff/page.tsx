import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listDocSlugs, listDocVersions } from "@/lib/content/docs.server";
import { DiffClient } from "./diff-client";

export function generateStaticParams() {
  return listDocSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return {
    title: `Compare versions | ${params.slug} | Amber Protocol`,
  };
}

export default function DocDiffPage({ params }: { params: { slug: string } }) {
  const versions = listDocVersions(params.slug);
  if (!versions.length) notFound();

  return (
    <DiffClient
      slug={params.slug}
      versions={versions.map((v) => ({
        version: v.version,
        updatedAt: v.updatedAt,
        stage: v.stage,
        markdown: v.markdown,
        title: v.title,
      }))}
    />
  );
}

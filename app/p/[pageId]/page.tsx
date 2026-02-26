import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ pageId: string }>;
};

export default async function PageByIdRoute({ params }: Readonly<PageProps>) {
  const { pageId } = await params;
  redirect(`/notebook?page=${encodeURIComponent(pageId)}`);
}

export const dynamic = "force-dynamic";

import { ButtonLink } from "@/components/button-link";
import { AppPageHeader } from "@/components/app-page-header";
import { ListenInboxClient } from "@/components/listen-inbox-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getToListenData } from "@/lib/queries";

export default async function ListenPage({
  searchParams,
}: {
  searchParams: Promise<{ label?: string }>;
}) {
  const { label } = await searchParams;
  const selectedLabelId = label ? Number(label) : undefined;
  const data = await getToListenData(Number.isFinite(selectedLabelId) ? selectedLabelId : undefined, false);

  return (
    <main className="pb-player-safe mx-auto max-w-[1400px] px-3 py-5 sm:px-4 md:px-8 md:py-6">
      <AppPageHeader
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ButtonLink href="/" size="sm" variant="outline">Dashboard</ButtonLink>
            <ButtonLink href="/settings" size="sm" variant="outline">Settings</ButtonLink>
          </div>
        }
        description="A focused lane for everything you still need to hear and decide on."
        title="To Listen Inbox"
        tone="compact"
      />

      <Card className="mb-4">
        <CardHeader><CardTitle>Filters + Bulk Actions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="flex flex-wrap items-center gap-2" method="GET">
            <label htmlFor="label" className="text-sm text-[var(--color-muted)]">Label</label>
            <select
              id="label"
              name="label"
              defaultValue={selectedLabelId ? String(selectedLabelId) : ""}
              className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 text-sm sm:w-auto"
            >
              <option value="">All sources</option>
              {data.labels.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Apply</Button>
            {selectedLabelId ? (
              <ButtonLink href="/listen" size="sm" variant="outline">Reset</ButtonLink>
            ) : null}
          </form>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unlistened Tracks ({data.rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ListenInboxClient initialRows={data.rows} />
        </CardContent>
      </Card>
    </main>
  );
}

export const dynamic = "force-dynamic";

import Link from "next/link";
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
    <main className="mx-auto max-w-[1300px] px-4 py-6 md:px-8">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">To Listen Inbox</h1>
          <p className="text-sm text-[var(--color-muted)]">A focused lane for everything you still need to hear and decide on.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="rounded-md border border-[var(--color-border)] px-3 py-2 hover:bg-[var(--color-surface2)]">Dashboard</Link>
          <Link href="/settings" className="rounded-md border border-[var(--color-border)] px-3 py-2 hover:bg-[var(--color-surface2)]">Settings</Link>
        </div>
      </header>

      <Card className="mb-4">
        <CardHeader><CardTitle>Filters + Bulk Actions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="flex flex-wrap items-center gap-2" method="GET">
            <label htmlFor="label" className="text-sm text-[var(--color-muted)]">Label</label>
            <select
              id="label"
              name="label"
              defaultValue={selectedLabelId ? String(selectedLabelId) : ""}
              className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface2)] px-3 text-sm"
            >
              <option value="">All labels</option>
              {data.labels.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Apply</Button>
            {selectedLabelId ? (
              <Link href="/listen" className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-surface2)]">Reset</Link>
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

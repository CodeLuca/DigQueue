import Link from "next/link";
import {
  Bookmark,
  CheckCheck,
  CheckCircle2,
  CircleHelp,
  Disc3,
  ExternalLink,
  Heart,
  Inbox,
  Lightbulb,
  ListOrdered,
  Play,
  PlayCircle,
  Settings,
  Shuffle,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function HowToUsePage() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
      <section className="rounded-xl border border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(245,158,11,0.14),transparent_48%),var(--color-surface2)] p-4 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">How To Use DigQueue</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Learn The Interface Once</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted)]">
          This page uses the same controls you see in the app so you can recognize them quickly during real use.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge><Disc3 className="mr-1 h-3 w-3" />Labels loaded</Badge>
          <Badge><PlayCircle className="mr-1 h-3 w-3" />Tracks played</Badge>
          <Badge><CheckCircle2 className="mr-1 h-3 w-3" />Reviewed</Badge>
          <Badge><Heart className="mr-1 h-3 w-3" />Saved tracks</Badge>
        </div>
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Demo page note: sample controls below are disabled and shown for orientation only.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/?tab=step-1"><Button size="sm" variant="outline">Open Labels</Button></Link>
          <Link href="/?tab=step-2"><Button size="sm" variant="outline">Open Listening Station</Button></Link>
          <Link href="/?tab=library"><Button size="sm" variant="outline">Open Library</Button></Link>
          <Link href="/?tab=recommendations"><Button size="sm" variant="outline">Open Recommendations</Button></Link>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Disc3 className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Labels: Source Intake</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--color-muted)]">This is where queue content starts.</p>
            <Badge>Demo controls (disabled)</Badge>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Paste Discogs label URL, ID, or name" disabled readOnly />
              <Button type="button" disabled>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>All (24)</Badge>
              <Badge className="border-emerald-600/60 text-emerald-300">Active (16)</Badge>
              <Badge>Inactive (8)</Badge>
            </div>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/55 p-2 text-sm">
              <p className="font-medium">What to do first</p>
              <p className="text-[var(--color-muted)]">Add 1-3 labels, activate them, then go to Listening Station.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Listening Station: Work Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--color-muted)]">Use these controls repeatedly while digging.</p>
            <Badge>Demo controls (disabled)</Badge>
            <div className="flex flex-wrap gap-2">
              <Badge>All</Badge>
              <Badge>Needs Review</Badge>
              <Badge>Reviewed</Badge>
              <Badge>Played</Badge>
            </div>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/55 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="secondary" disabled><Play className="h-3.5 w-3.5" />Play Now</Button>
                <Button type="button" size="sm" variant="secondary" className="h-9 w-9 rounded-full p-0" disabled><CheckCircle2 className="h-4 w-4" /></Button>
                <Button type="button" size="sm" variant="secondary" className="h-9 w-9 rounded-full p-0" disabled><CheckCheck className="h-4 w-4" /></Button>
                <Button type="button" size="sm" variant="ghost" disabled><Heart className="h-3.5 w-3.5" />Save Track</Button>
              </div>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              <span className="font-medium text-[var(--color-text)]">Single check:</span> review this track.
              {" "}
              <span className="font-medium text-[var(--color-text)]">Double check:</span> review full release.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Library: What Happened</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge>Library</Badge>
              <Badge>History</Badge>
              <Badge>Reviewed</Badge>
              <Badge>Needs Review</Badge>
            </div>
            <p><span className="font-medium">Library:</span> saved tracks and wishlist records.</p>
            <p><span className="font-medium">History:</span> previously played tracks.</p>
            <p><span className="font-medium">Reviewed:</span> tracks you marked reviewed.</p>
            <p><span className="font-medium">Needs Review:</span> played but still not reviewed.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Recommendations: Triage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Treat recommendations like an inbox:</p>
            <p><span className="font-medium">Play/Queue</span> what looks useful now.</p>
            <p><span className="font-medium">Dismiss</span> items that do not match your direction.</p>
            <p><span className="font-medium">Add Label/Want</span> for outside-library finds you want to track.</p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Disc3 className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Find New Labels From Tracks You Already Like</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>If you do not know which labels to add yet, start from music you already trust.</p>
            <p>1. Open a track/release you like in Listening Station or Library.</p>
            <p>2. Use the release action to <span className="font-medium">Add + activate label</span>.</p>
            <p>3. Go to Labels and run ingestion on that new label.</p>
            <p className="text-[var(--color-muted)]">
              This is the fastest way to grow your label universe without guessing random labels.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>Filters Without Overload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Default flow:</p>
            <p>1. Use <span className="font-medium">View</span> first (All/Needs Review/Reviewed/Played).</p>
            <p>2. Use <span className="font-medium">Exclude</span> to subtract noise.</p>
            <p>3. Open <span className="font-medium">More filters</span> only when needed.</p>
            <Badge>Demo controls (disabled)</Badge>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled>View</Button>
              <Button type="button" size="sm" variant="outline" disabled>Exclude</Button>
              <Button type="button" size="sm" variant="outline" disabled><ListOrdered className="mr-1 h-3.5 w-3.5" />In Order</Button>
              <Button type="button" size="sm" variant="outline" disabled><Shuffle className="mr-1 h-3.5 w-3.5" />Shuffle</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center gap-2">
            <CircleHelp className="h-4 w-4 text-[var(--color-accent)]" />
            <CardTitle>First 10 Minutes Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>1. Add labels and activate a few.</p>
            <p>2. Open Listening Station and press Play Now on a track.</p>
            <p>3. Use review buttons while listening.</p>
            <p>4. Check Library → Needs Review and clear leftovers.</p>
            <p>5. Open Recommendations and triage.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/settings">
                <Button size="sm" variant="outline"><Settings className="mr-1 h-3.5 w-3.5" />Settings</Button>
              </Link>
              <Link href="/?tab=step-2">
                <Button size="sm">Start Listening</Button>
              </Link>
              <Link href="/?tab=step-1">
                <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3.5 w-3.5" />Open Labels</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

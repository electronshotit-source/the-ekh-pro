"use client"

import { BookImage, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { EmptyState, PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { CULTURES } from "@/lib/engine/lexicon"
import * as db from "@/lib/engine/wedding-db"
import { rise, stagger } from "@/lib/motion"
import { useStudio } from "@/lib/studio/store"

type Load = { state: "loading" } | { state: "error" } | { state: "ok"; rows: db.WeddingRecord[] }

export function LibraryPage() {
  const router = useRouter()
  const openWedding = useStudio((s) => s.open)
  const currentId = useStudio((s) => s.weddingId)
  const close = useStudio((s) => s.close)
  const [load, setLoad] = useState<Load>({ state: "loading" })
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null)
  const [confirm, setConfirm] = useState<db.WeddingRecord | null>(null)

  // Both calls reject (asynchronously) when IndexedDB is unavailable.
  const refresh = useCallback(() => {
    db.list().then(
      (rows) => setLoad({ state: "ok", rows }),
      () => setLoad({ state: "error" }),
    )
    db.usage().then(setUsage, () => setUsage(null))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const remove = async (r: db.WeddingRecord) => {
    setConfirm(null)
    try {
      await db.remove(r.id)
      if (r.id === currentId) close()
      toast.success(`Deleted ${r.name}`)
      refresh()
    } catch {
      toast.error("Couldn't delete that wedding.")
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Your weddings"
        description={
          usage
            ? `Saved in this browser · ${db.formatBytes(usage.used)} used`
            : "Saved in this browser. Nothing leaves your device."
        }
        actions={
          <Button
            onClick={() => {
              close()
              router.push("/studio")
            }}
          >
            <Plus />
            New wedding
          </Button>
        }
      />

      <div className="px-4 py-6 sm:px-8">
        {load.state === "loading" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
            ))}
          </div>
        ) : load.state === "error" ? (
          <EmptyState
            icon={<BookImage />}
            title="Storage isn't available"
            description="This browser is blocking local storage (private mode does this). Weddings will work, but won't be saved."
            action={
              <Button variant="outline" onClick={refresh}>
                Try again
              </Button>
            }
          />
        ) : load.rows.length === 0 ? (
          <EmptyState
            icon={<BookImage />}
            title="No weddings yet"
            description="Every gallery you import is saved here automatically, with its selects and generated assets."
            action={
              <Button asChild>
                <Link href="/studio">Import your first gallery</Link>
              </Button>
            }
          />
        ) : (
          <motion.ul
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          >
            {load.rows.map((r) => (
              <motion.li key={r.id} variants={rise}>
                <WeddingCard
                  record={r}
                  current={r.id === currentId}
                  onOpen={() => {
                    if (r.id !== currentId) void openWedding(r.id)
                    router.push("/studio/selects")
                  }}
                  onDelete={() => setConfirm(r)}
                />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirm?.name}?</DialogTitle>
            <DialogDescription>
              This removes the wedding, its images and every generated asset from this browser. It can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep it</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => confirm && void remove(confirm)}>
              <Trash2 />
              Delete wedding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function useCover(record: db.WeddingRecord) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!record.coverId) return
    let objectUrl: string | null = null
    let live = true
    db.getBlob(db.blobKey(record.id, record.coverId)).then(
      (blob) => {
        if (!blob || !live) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      },
      () => undefined,
    )
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [record.id, record.coverId])
  return url
}

function WeddingCard({
  record,
  current,
  onOpen,
  onDelete,
}: {
  record: db.WeddingRecord
  current: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const cover = useCover(record)
  const w = record.wedding
  const updated = new Date(record.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-stroke-strong bg-surface shadow-xs transition-shadow hover:shadow-md">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open ${record.name}`}>
        <div className="aspect-[4/3] overflow-hidden bg-layer-2">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob URL
            <img
              src={cover}
              alt=""
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
        </div>
        <div className="p-4 pr-12">
          <h2 className="truncate text-sm font-semibold text-ink">{record.name}</h2>
          <p className="mt-0.5 truncate text-xs text-ink-2">
            {[w.venue, w.city].filter(Boolean).join(", ") || CULTURES[w.culture].label}
          </p>
          <p className="tabular mt-2 text-xs text-ink-3">
            {record.shots.length} frames · {record.outputs.length} assets · {updated}
          </p>
        </div>
      </button>
      {current && (
        <span className="absolute top-3 left-3 rounded-full bg-surface/95 px-2 py-0.5 text-xs font-medium text-brand shadow-xs">
          Open now
        </span>
      )}
      <div className="absolute right-2 bottom-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${record.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}

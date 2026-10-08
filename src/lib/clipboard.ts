import { toast } from "sonner"

/** Copy text and confirm with a toast. */
export async function copyText(text: string, what = "Copied") {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(what)
  } catch {
    toast.error("Couldn't reach the clipboard — select the text and copy it manually.")
  }
}

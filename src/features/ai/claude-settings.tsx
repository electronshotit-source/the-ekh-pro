"use client"

import { Eye, EyeOff, Loader2, PlugZap } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import * as ai from "@/lib/engine/ai"

import { useAiConfig } from "./use-ai"

/** Bring-your-own-key settings for live copywriting with Claude. */
export function ClaudeSettings() {
  const cfg = useAiConfig()
  const [reveal, setReveal] = useState(false)
  const [testing, setTesting] = useState(false)

  const test = async () => {
    setTesting(true)
    try {
      await ai.ping()
      toast.success("Connected to Claude")
    } catch (err) {
      toast.error(ai.describeError(err))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 rounded-xl bg-layer-1 px-4 py-3">
        <div>
          <Label htmlFor="ai-enabled" className="text-sm text-ink">
            Rewrite assets with Claude
          </Label>
          <p className="text-xs text-ink-2">Adds a “Rewrite with Claude” button to every asset.</p>
        </div>
        <Switch id="ai-enabled" checked={cfg.enabled} onCheckedChange={(enabled) => ai.aiStore.set({ enabled })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ai-model" className="mb-1.5 text-xs font-medium text-ink-2">
            Model
          </Label>
          <Select value={cfg.model} onValueChange={(v) => ai.aiStore.set({ model: v as ai.ClaudeModel })}>
            <SelectTrigger id="ai-model" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ai.MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label} <span className="text-ink-3">· {m.note}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="ai-key" className="mb-1.5 text-xs font-medium text-ink-2">
            Anthropic API key
          </Label>
          <div className="relative">
            <Input
              id="ai-key"
              type={reveal ? "text" : "password"}
              value={cfg.apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              aria-describedby="ai-key-hint"
              onChange={(e) => ai.aiStore.set({ apiKey: e.target.value.trim() })}
              className="pr-10 font-mono"
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
              aria-label={reveal ? "Hide key" : "Show key"}
              onClick={() => setReveal((r) => !r)}
            >
              {reveal ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>
      </div>
      <p id="ai-key-hint" className="text-xs text-ink-2">
        Your key is stored only in this browser and sent only to Anthropic. Claude receives the wedding details and what
        the analysis found — never your images.
      </p>
      <div>
        <Button variant="outline" onClick={() => void test()} disabled={!cfg.apiKey || testing}>
          {testing ? <Loader2 className="animate-spin" /> : <PlugZap />}
          Test connection
        </Button>
      </div>
    </div>
  )
}

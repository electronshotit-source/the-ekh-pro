/** Print a plain-text document through a hidden iframe — no popup needed. */
export function printText(title: string, body: string) {
  const frame = document.createElement("iframe")
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0"
  frame.setAttribute("aria-hidden", "true")
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) return frame.remove()

  const pre = doc.createElement("pre")
  pre.textContent = body
  doc.title = title
  const style = doc.createElement("style")
  style.textContent =
    "body{font:13px/1.6 ui-sans-serif,system-ui,sans-serif;color:#252525;margin:2cm}pre{white-space:pre-wrap;font:inherit}"
  doc.head.appendChild(style)
  doc.body.appendChild(pre)

  frame.contentWindow?.focus()
  frame.contentWindow?.print()
  setTimeout(() => frame.remove(), 1000)
}

import { useState } from 'react'
import { Button } from './ui/Button'

interface CopyButtonProps {
  label: string
  text: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function CopyButton({ label, text, variant = 'ghost' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      variant={variant}
      size="s"
      onClick={handleCopy}
      title={label}
      aria-label={label}
    >
      {copied ? '복사됨' : label}
    </Button>
  )
}

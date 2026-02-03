interface DescriptionFieldProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function DescriptionField({
  value,
  onChange,
  placeholder = '컴포넌트 설명',
}: DescriptionFieldProps) {
  return (
    <div>
      <label htmlFor="component-desc" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>
        설명
      </label>
      <textarea
        id="component-desc"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
    </div>
  )
}

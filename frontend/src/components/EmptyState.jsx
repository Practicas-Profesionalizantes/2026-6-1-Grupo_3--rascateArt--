export default function EmptyState({ title, text, action, compact = false }) {
  return (
    <div className={`empty${compact ? ' empty-compact' : ''}`}>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

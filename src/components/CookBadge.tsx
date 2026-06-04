import type { Cook } from '../types/database'

export function CookBadge({ cook }: { cook: Cook }) {
  return (
    <span
      style={{
        color: cook.color,
        borderColor: cook.color,
        backgroundColor: `${cook.color}1a`,
      }}
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none"
    >
      {cook.name}
    </span>
  )
}

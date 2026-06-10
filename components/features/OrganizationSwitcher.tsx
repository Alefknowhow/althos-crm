'use client'

import { useRouter } from 'next/navigation'

export default function OrganizationSwitcher({ 
  currentSlug, 
  organizations 
}: { 
  currentSlug: string, 
  organizations: { id: string, name: string, slug: string }[] 
}) {
  const router = useRouter()

  return (
    <select 
      className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      value={currentSlug}
      onChange={(e) => {
        router.push(`/app/${e.target.value}/pipeline`)
      }}
    >
      {organizations.map(org => (
        <option key={org.id} value={org.slug}>{org.name}</option>
      ))}
    </select>
  )
}

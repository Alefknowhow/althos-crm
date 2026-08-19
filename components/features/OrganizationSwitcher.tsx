'use client'

import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function OrganizationSwitcher({
  currentSlug,
  organizations,
}: {
  currentSlug: string,
  organizations: { id: string, name: string, slug: string }[]
}) {
  const router = useRouter()

  return (
    <Select value={currentSlug} onValueChange={slug => router.push(`/app/${slug}/pipeline`)}>
      <SelectTrigger className="h-9 w-auto"><SelectValue /></SelectTrigger>
      <SelectContent>
        {organizations.map(org => (
          <SelectItem key={org.id} value={org.slug}>{org.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

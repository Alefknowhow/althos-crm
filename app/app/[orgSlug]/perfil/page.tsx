import { getUserProfile } from '@/actions/profile'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'

export default async function PerfilPage({
  params,
}: {
  params: { orgSlug: string }
}) {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  return <ProfileClient profile={profile} orgSlug={params.orgSlug} />
}

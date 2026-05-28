import { getRecentActivities } from '@/actions/dashboard'
import RecentActivity from './RecentActivity'

export default async function RecentActivityWidget({ orgId }: { orgId: string }) {
  const activities = await getRecentActivities(orgId)
  return <RecentActivity activities={activities as any} />
}

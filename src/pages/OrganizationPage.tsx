import { ChurchAdministration } from '../features/auth/ChurchAdministration'
import { useSuiteUser } from '../features/auth/SuiteAuth'

export function OrganizationPage() {
  const user = useSuiteUser()
  return (
    <section>
      <p className="eyebrow">Administración de iglesia</p>
      <h1>Mi organización</h1>
      <ChurchAdministration
        users={[]}
        global={false}
        memberships={user?.memberships || []}
      />
    </section>
  )
}
